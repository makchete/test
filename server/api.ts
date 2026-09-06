import express, { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import {
  generateToken,
  requireAuth,
  requireAdmin,
  requireConversationMember,
  AuthenticatedRequest,
} from './auth.js';
import {
  broadcastSystemMessage,
  broadcastUserUpdated,
  broadcastBrandingUpdated,
  broadcastConversationCreated,
  ioInstance,
} from './sockets.js';
import { Message, FileAttachment } from '../src/types.js';

export const apiRouter = Router();

// Configure file upload storage
const ROOT_DIR = process.env.APP_ROOT || process.cwd();
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create uploads dir:', e);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB Cloud Run safe threshold
});

// Helper for audit logs
function logAudit(
  req: AuthenticatedRequest,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: any
) {
  if (req.user?.userId) {
    db.addAuditLog(
      req.user.userId,
      action,
      targetType,
      targetId,
      metadata,
      req.ip || '127.0.0.1',
      req.headers['user-agent']
    );
  }
}

// ==================== AUTH ROUTES ====================

// POST /api/v1/auth/login
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { phone, username, identifier, password } = req.body;
    const loginId = identifier || phone || username;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Identifiant (numéro de téléphone ou nom d’utilisateur) et mot de passe requis.' });
    }

    const cleanedId = String(loginId).trim();
    const user = db.getUserByPhoneOrUsername(cleanedId);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Ce compte est désactivé. Veuillez contacter un administrateur.' });
    }

    const hash = db.getPasswordHash(user.id);
    if (!hash) {
      return res.status(401).json({ error: 'Erreur de configuration du compte.' });
    }

    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    // Update status to ONLINE
    db.updateUser(user.id, {
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    });

    const token = generateToken(user.id, user.phone, user.role);

    db.addAuditLog(
      user.id,
      'USER_LOGIN',
      'USER',
      user.id,
      { phone: user.phone, username: user.username },
      req.ip || '127.0.0.1',
      req.headers['user-agent']
    );

    const freshUser = db.getUserById(user.id);
    res.json({
      token,
      user: freshUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// GET /api/v1/auth/me
apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.getUserById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }
  const freshToken = generateToken(user.id, user.phone, user.role);
  res.json({ user, token: freshToken });
});

// POST /api/v1/auth/change-password
apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' });
    }

    const userId = req.user!.userId;
    const user = db.getUserById(userId);
    const hash = db.getPasswordHash(userId);

    if (user?.mustChangePassword === false && currentPassword) {
      const match = await bcrypt.compare(currentPassword, hash || '');
      if (!match) {
        return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    db.setUserPassword(userId, newHash);

    logAudit(req, 'PASSWORD_CHANGED', 'USER', userId);

    const updatedUser = db.getUserById(userId);
    res.json({ message: 'Mot de passe modifié avec succès.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
  }
});

// POST /api/v1/auth/logout
apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  db.updateUser(userId, {
    status: 'OFFLINE',
    lastSeenAt: new Date().toISOString(),
  });
  logAudit(req, 'USER_LOGOUT', 'USER', userId);
  res.json({ message: 'Déconnecté avec succès.' });
});

// ==================== USERS ROUTES ====================

// GET /api/v1/users
apiRouter.get('/users', requireAuth, (req: AuthenticatedRequest, res) => {
  const allUsers = db.getUsers();
  // Filter for regular users: show only active users
  const visibleUsers = req.user?.role === 'ADMIN'
    ? allUsers
    : allUsers.filter((u) => u.isActive && u.id !== req.user?.userId);

  res.json({ users: visibleUsers });
});

// GET /api/v1/users/:id
apiRouter.get('/users/:id', requireAuth, (req, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  res.json({ user });
});

// PATCH /api/v1/users/profile
apiRouter.patch('/users/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName, avatarUrl, statusMessage, phone, username } = req.body;

    const currentUser = db.getUserById(userId);
    if (!currentUser) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    // Handle username update if provided
    let cleanedUsername: string | null | undefined = undefined;
    if (username !== undefined) {
      if (username === '' || username === null) {
        cleanedUsername = null;
      } else {
        const candidate = String(username).trim().toLowerCase().replace(/^@+/, '');
        if (candidate.length < 3) {
          return res.status(400).json({ error: 'Le nom d’utilisateur doit comporter au moins 3 caractères.' });
        }
        const existingWithUsername = db.getUserByUsername(candidate);
        if (existingWithUsername && existingWithUsername.id !== userId) {
          return res.status(400).json({ error: 'Ce nom d’utilisateur est déjà pris.' });
        }
        cleanedUsername = candidate;
      }
    }

    // Handle phone update if provided and different
    if (phone && phone.trim() !== currentUser.phone.trim()) {
      const cleanedNewPhone = String(phone).trim();
      const existingWithPhone = db.getUserByPhone(cleanedNewPhone);
      if (existingWithPhone && existingWithPhone.id !== userId) {
        return res.status(400).json({ error: 'Ce numéro de téléphone est déjà utilisé par un autre compte.' });
      }

      // Update phone and generate system notifications in conversations
      const { user: updatedWithPhone, systemMessages } = db.updateUserPhone(userId, cleanedNewPhone, userId);

      // Broadcast system messages to active socket rooms
      for (const msg of systemMessages) {
        broadcastSystemMessage(msg);
      }

      logAudit(req, 'PHONE_NUMBER_CHANGED', 'USER', userId, {
        oldPhone: currentUser.phone,
        newPhone: cleanedNewPhone,
      });
    }

    const updated = db.updateUser(userId, {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(statusMessage !== undefined && { statusMessage }),
      ...(cleanedUsername !== undefined && { username: cleanedUsername }),
    });

    if (updated) {
      broadcastUserUpdated(updated);
    }

    logAudit(req, 'PROFILE_UPDATED', 'USER', userId);
    res.json({ user: updated });
  } catch (err: any) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la mise à jour du profil.' });
  }
});

// Admin User Creation
// POST /api/v1/users
apiRouter.post('/users', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { phone, username, firstName, lastName, role, avatarUrl } = req.body;
    if (!phone || !firstName || !lastName) {
      return res.status(400).json({ error: 'Le prénom, le nom et le numéro de téléphone sont requis.' });
    }

    const cleanedPhone = String(phone).trim();
    const existing = db.getUserByPhone(cleanedPhone);
    if (existing) {
      return res.status(400).json({ error: 'Un utilisateur existe déjà avec ce numéro de téléphone.' });
    }

    let cleanedUsername: string | null = null;
    if (username && String(username).trim()) {
      const candidate = String(username).trim().toLowerCase().replace(/^@+/, '');
      const existingUser = db.getUserByUsername(candidate);
      if (existingUser) {
        return res.status(400).json({ error: 'Ce nom d’utilisateur est déjà pris.' });
      }
      cleanedUsername = candidate;
    }

    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const initialPassword = cleanedPhone; // Phone number as initial password
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const now = new Date().toISOString();

    const newUser = db.createUser(
      {
        id: userId,
        phone: cleanedPhone,
        username: cleanedUsername,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl: avatarUrl || null,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        status: 'OFFLINE',
        statusMessage: null,
        isActive: true,
        mustChangePassword: false,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      },
      passwordHash
    );

    broadcastUserUpdated(newUser);
    logAudit(req, 'ADMIN_CREATED_USER', 'USER', userId, { phone: cleanedPhone, username: cleanedUsername, name: `${firstName} ${lastName}` });

    res.status(201).json({
      user: newUser,
      initialCredentials: {
        phone: cleanedPhone,
        username: cleanedUsername,
        initialPassword,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la création de l'utilisateur." });
  }
});

// Admin User Update (Edit details, phone number, username, role)
// PATCH /api/v1/users/:id
apiRouter.patch('/users/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = db.getUserById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

    const { firstName, lastName, phone, username, role, statusMessage, isActive } = req.body;

    // Handle username
    let cleanedUsername: string | null | undefined = undefined;
    if (username !== undefined) {
      if (username === '' || username === null) {
        cleanedUsername = null;
      } else {
        const candidate = String(username).trim().toLowerCase().replace(/^@+/, '');
        const existingWithUsername = db.getUserByUsername(candidate);
        if (existingWithUsername && existingWithUsername.id !== targetUserId) {
          return res.status(400).json({ error: 'Ce nom d’utilisateur est déjà utilisé par un autre compte.' });
        }
        cleanedUsername = candidate;
      }
    }

    // Handle phone change
    if (phone && phone.trim() !== targetUser.phone.trim()) {
      const cleanedNewPhone = String(phone).trim();
      const existingWithPhone = db.getUserByPhone(cleanedNewPhone);
      if (existingWithPhone && existingWithPhone.id !== targetUserId) {
        return res.status(400).json({ error: 'Ce numéro de téléphone est déjà attribué à un autre compte.' });
      }

      const { user: updatedWithPhone, systemMessages } = db.updateUserPhone(
        targetUserId,
        cleanedNewPhone,
        req.user!.userId
      );

      for (const msg of systemMessages) {
        broadcastSystemMessage(msg);
      }

      logAudit(req, 'ADMIN_CHANGED_USER_PHONE', 'USER', targetUserId, {
        oldPhone: targetUser.phone,
        newPhone: cleanedNewPhone,
      });
    }

    const updated = db.updateUser(targetUserId, {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(role && { role }),
      ...(statusMessage !== undefined && { statusMessage }),
      ...(isActive !== undefined && { isActive }),
      ...(cleanedUsername !== undefined && { username: cleanedUsername }),
    });

    if (updated) {
      broadcastUserUpdated(updated);
    }

    logAudit(req, 'ADMIN_UPDATED_USER', 'USER', targetUserId);
    res.json({ user: updated });
  } catch (err: any) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: err.message || "Erreur lors de la modification de l'utilisateur." });
  }
});

// Admin toggle activate/deactivate
// POST /api/v1/users/:id/activate
apiRouter.post('/users/:id/activate', requireAdmin, (req: AuthenticatedRequest, res) => {
  const updated = db.updateUser(req.params.id, { isActive: true });
  if (!updated) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  logAudit(req, 'ADMIN_ENABLED_USER', 'USER', req.params.id);
  res.json({ user: updated });
});

// POST /api/v1/users/:id/deactivate
apiRouter.post('/users/:id/deactivate', requireAdmin, (req: AuthenticatedRequest, res) => {
  const updated = db.updateUser(req.params.id, { isActive: false, status: 'OFFLINE' });
  if (!updated) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  logAudit(req, 'ADMIN_DISABLED_USER', 'USER', req.params.id);
  res.json({ user: updated });
});

// Admin reset password
// POST /api/v1/users/:id/reset-password
apiRouter.post('/users/:id/reset-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  const tempPassword = user.phone; // reset to phone number
  const hash = await bcrypt.hash(tempPassword, 10);
  db.setUserPassword(user.id, hash);
  db.updateUser(user.id, { mustChangePassword: true });

  logAudit(req, 'ADMIN_RESET_PASSWORD', 'USER', user.id);

  res.json({
    message: 'Mot de passe réinitialisé.',
    tempPassword,
  });
});

// Admin Delete User
// DELETE /api/v1/users/:id
apiRouter.delete('/users/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  if (req.params.id === req.user?.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' });
  }
  const deleted = db.deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  logAudit(req, 'ADMIN_DELETED_USER', 'USER', req.params.id);
  res.json({ message: 'Utilisateur supprimé.' });
});

// ==================== CONVERSATIONS ROUTES ====================

// GET /api/v1/conversations
apiRouter.get('/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
  const conversations = db.getConversationsForUser(req.user!.userId);
  res.json({ conversations });
});

// POST /api/v1/conversations (get or create direct chat)
apiRouter.post('/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'ID utilisateur cible manquant.' });
  }

  const currentUserId = req.user!.userId;
  if (targetUserId === currentUserId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas créer une conversation avec vous-même.' });
  }

  const targetUser = db.getUserById(targetUserId);
  if (!targetUser || !targetUser.isActive) {
    return res.status(404).json({ error: 'Utilisateur cible indisponible.' });
  }

  let conversation = db.findDirectConversation(currentUserId, targetUserId);
  if (!conversation) {
    conversation = db.createConversation('DIRECT', [currentUserId, targetUserId]);
    broadcastConversationCreated(conversation, [currentUserId, targetUserId]);
  }

  res.json({ conversation });
});

// POST /api/v1/conversations/group (ADMIN SEUL)
apiRouter.post('/conversations/group', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { name, memberUserIds, avatarUrl, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du groupe est obligatoire.' });
  }

  if (!memberUserIds || !Array.isArray(memberUserIds) || memberUserIds.length === 0) {
    return res.status(400).json({ error: 'Veuillez sélectionner au moins un membre pour créer le groupe.' });
  }

  const group = db.createGroup(name, req.user!.userId, memberUserIds, avatarUrl, description);
  broadcastConversationCreated(group, [req.user!.userId, ...memberUserIds]);

  logAudit(req, 'ADMIN_CREATED_GROUP', 'CONVERSATION', group.id, {
    name,
    membersCount: memberUserIds.length + 1,
  });

  res.status(201).json({ conversation: group });
});

// POST /api/v1/conversations/:id/members (ADMIN SEUL)
apiRouter.post('/conversations/:id/members', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Veuillez spécifier les identifiants des membres à ajouter.' });
  }

  const conv = db.getConversationById(req.params.id);
  if (!conv || conv.type !== 'GROUP') {
    return res.status(404).json({ error: 'Groupe non trouvé.' });
  }

  const updated = db.addMembersToConversation(req.params.id, userIds);
  broadcastConversationCreated(updated, userIds);

  logAudit(req, 'ADMIN_ADDED_MEMBERS', 'CONVERSATION', req.params.id, { userIds });
  res.json({ conversation: updated });
});

// DELETE /api/v1/conversations/:id/members/:userId (ADMIN SEUL)
apiRouter.delete('/conversations/:id/members/:userId', requireAdmin, (req: AuthenticatedRequest, res) => {
  const conv = db.getConversationById(req.params.id);
  if (!conv || conv.type !== 'GROUP') {
    return res.status(404).json({ error: 'Groupe non trouvé.' });
  }

  const updated = db.removeMemberFromConversation(req.params.id, req.params.userId);
  logAudit(req, 'ADMIN_REMOVED_MEMBER', 'CONVERSATION', req.params.id, { userId: req.params.userId });
  res.json({ conversation: updated });
});

// PATCH /api/v1/conversations/:id (ADMIN SEUL)
apiRouter.patch('/conversations/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { name, description, avatarUrl } = req.body;
  const updated = db.updateConversation(req.params.id, {
    ...(name && { name: name.trim() }),
    ...(description !== undefined && { description: description?.trim() || null }),
    ...(avatarUrl !== undefined && { avatarUrl }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Conversation non trouvée.' });
  }

  logAudit(req, 'ADMIN_UPDATED_GROUP', 'CONVERSATION', req.params.id);
  res.json({ conversation: updated });
});

// DELETE /api/v1/conversations/:id (ADMIN SEUL)
apiRouter.delete('/conversations/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const conv = db.getConversationById(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation non trouvée.' });
  }

  const deleted = db.deleteConversation(req.params.id);
  if (!deleted) {
    return res.status(500).json({ error: 'Impossible de supprimer la conversation.' });
  }

  logAudit(req, 'ADMIN_DELETED_CONVERSATION', 'CONVERSATION', req.params.id, { name: conv.name, type: conv.type });
  res.json({ message: 'Conversation supprimée avec succès.' });
});

// GET /api/v1/admin/groups (ADMIN SEUL)
apiRouter.get('/admin/groups', requireAdmin, (req: AuthenticatedRequest, res) => {
  const groups = db.getAllGroups();
  res.json({ groups });
});

// GET /api/v1/conversations/:id
apiRouter.get('/conversations/:id', requireConversationMember, (req, res) => {
  const conv = db.getConversationById(req.params.id);
  res.json({ conversation: conv });
});

// GET /api/v1/conversations/:id/messages
apiRouter.get('/conversations/:id/messages', requireConversationMember, (req: AuthenticatedRequest, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 500;
  const messages = db.getMessagesForConversation(req.params.id, req.user!.userId, limit);
  res.json({ messages });
});

// GET /api/v1/conversations/:id/media
apiRouter.get('/conversations/:id/media', requireConversationMember, (req, res) => {
  const files = db.getFilesForConversation(req.params.id);
  res.json({ files });
});

// ==================== MESSAGES ROUTES ====================

// POST /api/v1/messages
apiRouter.post('/messages', requireAuth, (req: AuthenticatedRequest, res) => {
  const { conversationId, content, type, replyToId, fileId, file } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: 'ID de conversation requis.' });
  }

  const conversation = db.getConversationById(conversationId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation non trouvée.' });
  }

  const isMember = conversation.members.some((m) => m.userId === req.user!.userId);
  if (!isMember) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  const now = new Date().toISOString();
  const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  let fileObj: FileAttachment | null = null;
  const fId = fileId || (file && file.id);
  if (fId) {
    fileObj = db.getFileById(fId) || null;
    if (fileObj) {
      fileObj.messageId = messageId;
    }
  } else if (file) {
    fileObj = {
      ...file,
      messageId,
    };
    db.createFileAttachment(fileObj);
  }

  const newMsg: Message = {
    id: messageId,
    conversationId,
    senderId: req.user!.userId,
    content: content || '',
    type: type || (fileObj ? fileTypeFromMime(fileObj.mimeType) : 'TEXT'),
    replyToId: replyToId || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    file: fileObj,
  };

  db.createMessage(newMsg);

  // Set initial status SENT for sender, DELIVERED/READ for others
  db.updateMessageStatus(messageId, req.user!.userId, 'READ');

  const createdFull = db.getMessagesForConversation(conversationId, req.user!.userId, 100).find((m) => m.id === messageId);
  const msgToSend = createdFull || newMsg;

  if (ioInstance) {
    ioInstance.to(`conversation:${conversationId}`).emit('message:new', msgToSend);
    for (const mem of conversation.members) {
      ioInstance.to(`user:${mem.userId}`).emit('message:new', msgToSend);
      if (mem.userId !== req.user!.userId) {
        ioInstance.to(`user:${mem.userId}`).emit('notification:new', {
          title: msgToSend.sender ? `${msgToSend.sender.firstName} ${msgToSend.sender.lastName}` : 'Nouveau message',
          body: msgToSend.type === 'TEXT' ? msgToSend.content : `[${msgToSend.type}]`,
          conversationId,
        });
      }
    }
  }

  res.status(201).json({ message: msgToSend });
});

// PATCH /api/v1/messages/:id (MODIFIER MESSAGE: EXPÉDITEUR OU ADMIN)
apiRouter.patch('/messages/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Le contenu du message ne peut pas être vide.' });
  }

  const existing = db.getMessageById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Message non trouvé.' });
  }

  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';
  if (existing.senderId !== userId && !isAdmin) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres messages envoyés.' });
  }

  const updated = db.editMessage(req.params.id, content);
  if (!updated) {
    return res.status(400).json({ error: 'Impossible de modifier ce message (déjà supprimé).' });
  }

  logAudit(req, 'MESSAGE_EDITED', 'MESSAGE', req.params.id, { originalSender: existing.senderId });
  const fullUpdated = db.getMessageById(req.params.id);
  res.json({ message: fullUpdated || updated });
});

function fileTypeFromMime(mime: string): Message['type'] {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}

// POST /api/v1/messages/:id/read
apiRouter.post('/messages/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const { conversationId } = req.body;
  if (conversationId) {
    db.markConversationAsRead(conversationId, req.user!.userId, req.params.id);
  } else {
    db.updateMessageStatus(req.params.id, req.user!.userId, 'READ');
  }
  res.json({ success: true });
});

// DELETE /api/v1/messages/:id (SUPPRIMER MESSAGE: EXPÉDITEUR OU DESTINATAIRE À TOUT MOMENT)
apiRouter.delete('/messages/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const forEveryone = req.query.forEveryone === 'true';
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const existing = db.getMessageById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Message non trouvé.' });
  }

  const convId = existing.conversationId;
  const conversation = db.getConversationById(convId);
  const isMember = conversation?.members.some((m) => m.userId === userId);

  // L'expéditeur ET le destinataire (membre de la conversation) ou l'admin peuvent supprimer à tout moment
  if (existing.senderId !== userId && !isAdmin && !isMember) {
    return res.status(403).json({ error: 'Vous ne faites pas partie de cette discussion.' });
  }

  if (forEveryone) {
    db.deleteMessageForEveryone(req.params.id);
    if (ioInstance) {
      const payload = { messageId: req.params.id, conversationId: convId, forEveryone: true };
      ioInstance.to(`conversation:${convId}`).emit('message:deleted', payload);
      if (conversation) {
        for (const mem of conversation.members) {
          ioInstance.to(`user:${mem.userId}`).emit('message:deleted', payload);
        }
      }
    }
  } else {
    db.deleteMessageForMe(req.params.id, userId);
    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('message:deleted', {
        messageId: req.params.id,
        conversationId: convId,
        forEveryone: false,
        deletedForUserId: userId,
      });
    }
  }

  logAudit(req, 'MESSAGE_DELETED', 'MESSAGE', req.params.id, { forEveryone, deletedBy: userId });
  res.json({ message: 'Message supprimé.' });
});

// ==================== FILE UPLOAD ROUTES ====================

// POST /api/v1/files/upload
apiRouter.post('/files/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Le fichier dépasse la taille maximale autorisée (30 Mo).' });
      }
      return res.status(400).json({ error: err.message || 'Erreur lors du téléversement du fichier.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const file = req.file;
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const ext = path.extname(file.originalname).toLowerCase();
    const fileUrl = `/api/v1/files/raw/${file.filename}`;

    const attachment: FileAttachment = {
      id: fileId,
      messageId: null,
      originalName: file.originalname,
      storageKey: file.filename,
      mimeType: file.mimetype,
      extension: ext,
      size: file.size,
      url: fileUrl,
      createdAt: new Date().toISOString(),
    };

    db.createFileAttachment(attachment);
    logAudit(req, 'FILE_UPLOADED', 'FILE', fileId, { originalName: file.originalname, size: file.size });

    res.json({ file: attachment });
  });
});

// Stream raw upload file
apiRouter.get('/files/raw/:filename', (req, res) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('Fichier non trouvé');
  }
  res.sendFile(filepath);
});

// ==================== CALLS ROUTES ====================

// GET /api/v1/calls/history
apiRouter.get('/calls/history', requireAuth, (req: AuthenticatedRequest, res) => {
  const calls = db.getCallsForUser(req.user!.userId);
  res.json({ calls });
});

// DELETE /api/v1/calls/history/:id
apiRouter.delete('/calls/history/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const success = db.deleteCall(req.params.id, req.user!.userId);
  if (!success) {
    return res.status(404).json({ error: 'Appel non trouvé ou déjà supprimé.' });
  }
  res.json({ message: 'Historique d\'appel supprimé.' });
});

// DELETE /api/v1/calls/history
apiRouter.delete('/calls/history', requireAuth, (req: AuthenticatedRequest, res) => {
  db.clearCallHistory(req.user!.userId);
  res.json({ message: 'Historique des appels effacé.' });
});

// ==================== NOTIFICATIONS ROUTES ====================

// GET /api/v1/notifications
apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  const notifications = db.getNotificationsForUser(req.user!.userId);
  res.json({ notifications });
});

// POST /api/v1/notifications/:id/read
apiRouter.post('/notifications/:id/read', requireAuth, (req, res) => {
  db.markNotificationAsRead(req.params.id);
  res.json({ success: true });
});

// ==================== SEARCH ROUTE ====================

// GET /api/v1/search?q=
apiRouter.get('/search', requireAuth, (req: AuthenticatedRequest, res) => {
  const q = String(req.query.q || '');
  const results = db.search(req.user!.userId, q);
  res.json(results);
});

// ==================== ADMIN ROUTES ====================

// GET /api/v1/admin/dashboard
apiRouter.get('/admin/dashboard', requireAdmin, (req, res) => {
  const stats = db.getAdminStats();
  res.json({ stats });
});

// GET /api/v1/admin/activity
apiRouter.get('/admin/activity', requireAdmin, (req, res) => {
  const logs = db.getAuditLogs(100);
  res.json({ logs });
});

// Public branding endpoint (for login page & unauthenticated clients)
// GET /api/v1/branding
apiRouter.get('/branding', (req, res) => {
  const settings = db.getSettings();
  res.json({
    appName: settings.appName || 'KOMECHAT',
    appLogoUrl: settings.appLogoUrl || '/komechat_logo.jpg',
  });
});

// GET /api/v1/admin/settings
apiRouter.get('/admin/settings', requireAdmin, (req, res) => {
  const settings = db.getSettings();
  res.json({ settings });
});

// PATCH /api/v1/admin/settings
apiRouter.patch('/admin/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
  const updated = db.updateSettings(req.body);
  if (req.body.appLogoUrl !== undefined || req.body.appName !== undefined) {
    broadcastBrandingUpdated(updated);
  }
  logAudit(req, 'ADMIN_SETTINGS_UPDATED', 'SETTINGS', null, req.body);
  res.json({ settings: updated });
});

// Admin App Logo Upload
// POST /api/v1/admin/logo
apiRouter.post('/admin/logo', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  upload.single('logo')(req as any, res as any, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Le fichier dépasse la taille maximale autorisée (30 Mo).' });
      }
      return res.status(400).json({ error: err.message || 'Erreur lors du téléversement du logo.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier de logo reçu.' });
    }

    const file = req.file;
    const fileUrl = `/api/v1/files/raw/${file.filename}`;

    // Update in settings
    const updatedSettings = db.updateSettings({
      appLogoUrl: fileUrl,
    });

    // Mirror to public directory for fallback
    try {
      const publicLogoPath = path.join(process.cwd(), 'public', 'komechat_logo.jpg');
      fs.copyFileSync(file.path, publicLogoPath);
      const distDir = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        fs.copyFileSync(file.path, path.join(distDir, 'komechat_logo.jpg'));
      }
    } catch (mirrorErr) {
      console.warn('Could not mirror logo to static public directory:', mirrorErr);
    }

    broadcastBrandingUpdated(updatedSettings);
    logAudit(req, 'APP_LOGO_UPDATED', 'BRANDING', null, { url: fileUrl, filename: file.originalname });

    res.json({
      success: true,
      appLogoUrl: fileUrl,
      settings: updatedSettings,
    });
  });
});

// Admin App Logo Reset
// POST /api/v1/admin/logo/reset
apiRouter.post('/admin/logo/reset', requireAdmin, (req: AuthenticatedRequest, res) => {
  const updatedSettings = db.updateSettings({
    appLogoUrl: '/komechat_logo.jpg',
  });
  broadcastBrandingUpdated(updatedSettings);
  logAudit(req, 'APP_LOGO_RESET', 'BRANDING', null);
  res.json({
    success: true,
    appLogoUrl: '/komechat_logo.jpg',
    settings: updatedSettings,
  });
});

// ==================== USER PREFERENCES & CROSS-DEVICE SYNC ====================

// GET /api/v1/users/me/preferences
apiRouter.get('/users/me/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  const preferences = db.getUserPreferences(req.user!.userId);
  res.json({ preferences });
});

// PATCH /api/v1/users/me/preferences
apiRouter.patch('/users/me/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  const preferences = db.updateUserPreferences(req.user!.userId, req.body);
  res.json({ preferences });
});

// ==================== STORAGE & HOSTING METRICS (50 GB) ====================

// GET /api/v1/storage/stats
apiRouter.get('/storage/stats', requireAuth, (req: AuthenticatedRequest, res) => {
  const storage = db.getHostingStorageDetails();
  res.json({ storage });
});

// ==================== BACKUP & DATA EXPORT / IMPORT ====================

// GET /api/v1/backup/export - Full system backup (Admin)
apiRouter.get('/backup/export', requireAdmin, (req: AuthenticatedRequest, res) => {
  const backup = db.exportBackupData(req.user!.userId);
  logAudit(req, 'FULL_BACKUP_EXPORTED', 'SYSTEM', null, { itemsCount: backup.stats });
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="mmd-chat-full-backup-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.json(backup);
});

// POST /api/v1/backup/import - Full system backup restore (Admin)
apiRouter.post('/backup/import', requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const backupData = req.body;
    const mode = (req.query.mode as 'MERGE' | 'REPLACE') || 'MERGE';

    if (!backupData || (!Array.isArray(backupData.messages) && !Array.isArray(backupData.users) && !Array.isArray(backupData.conversations))) {
      return res.status(400).json({ error: 'Fichier de sauvegarde invalide ou corrompu.' });
    }

    const result = db.importBackupData(backupData, mode);
    logAudit(req, 'FULL_BACKUP_IMPORTED', 'SYSTEM', null, { mode, result });

    res.json({
      message: 'Restauration effectuée avec succès.',
      result,
    });
  } catch (err: any) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: err?.message || 'Erreur lors de la restauration de la sauvegarde.' });
  }
});

// GET /api/v1/users/me/export - Personal data export (Discussions, Media, Preferences)
apiRouter.get('/users/me/export', requireAuth, (req: AuthenticatedRequest, res) => {
  const backup = db.exportUserData(req.user!.userId);
  logAudit(req, 'USER_DATA_EXPORTED', 'USER', req.user!.userId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="mmd-chat-my-data-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.json(backup);
});

// POST /api/v1/users/me/import - Personal data restore
apiRouter.post('/users/me/import', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Données d\'importation invalides.' });
    }

    const result = db.importUserData(req.user!.userId, data);
    res.json({
      message: 'Données personnelles restaurées avec succès.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erreur lors de l\'importation des données.' });
  }
});

// Fallback for unmatched API routes in apiRouter
apiRouter.all('*', (req, res) => {
  res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.baseUrl}${req.path}` });
});

// API router error handler
apiRouter.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Router error:', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const msg = err.code === 'LIMIT_FILE_SIZE'
    ? 'Le fichier dépasse la taille maximale autorisée (30 Mo).'
    : (err.message || 'Erreur interne du serveur API');
  res.status(status).json({ error: msg });
});


