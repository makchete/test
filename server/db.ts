import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  Conversation,
  ConversationMember,
  Message,
  MessageStatus,
  FileAttachment,
  Call,
  AppNotification,
  AuditLog,
  UserSession,
  AppSettings,
  UserPreferences,
  HostingStorageDetails,
  BackupExportPayload,
} from '../src/types.js';

interface DatabaseSchema {
  users: User[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
  messageStatuses: MessageStatus[];
  files: FileAttachment[];
  calls: Call[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  sessions: UserSession[];
  settings: AppSettings;
  userPreferences?: Record<string, UserPreferences>;
  passwordHashes?: Record<string, string>;
}

const ROOT_DIR = process.env.APP_ROOT || process.cwd();
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'mmd_chat_db.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
const TOTAL_STORAGE_QUOTA_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'KOMECHAT',
  appLogoUrl: '/komechat_logo.jpg',
  maxFileSizeMb: 50,
  allowPublicMediaPreview: false,
  heartbeatIntervalSec: 25,
  offlineTimeoutSec: 60,
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'dark',
  enterToSend: true,
  fontSize: 'medium',
  autoDownloadMedia: true,
  language: 'fr',
};

class DatabaseService {
  private data: DatabaseSchema = {
    users: [],
    conversations: [],
    conversationMembers: [],
    messages: [],
    messageStatuses: [],
    files: [],
    calls: [],
    notifications: [],
    auditLogs: [],
    sessions: [],
    settings: DEFAULT_SETTINGS,
  };

  constructor() {
    this.init();
  }

  private async init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure default settings exist
        if (!this.data.settings) {
          this.data.settings = DEFAULT_SETTINGS;
        }
        if (!this.data.userPreferences) {
          this.data.userPreferences = {};
        }

        // Restore password hashes from disk
        if (this.data.passwordHashes) {
          for (const [userId, hash] of Object.entries(this.data.passwordHashes)) {
            this.passwordHashes.set(userId, hash);
          }
        }

        // Migration: Ensure admin phone & password are +32484824481 and avatar is updated
        const admin = this.data.users.find((u) => u.id === 'usr_admin' || u.role === 'ADMIN');
        if (admin) {
          if (admin.phone === '+22890000000' || !admin.username) {
            admin.phone = '+32484824481';
            admin.username = admin.username || 'admin';
            const newAdminHash = await bcrypt.hash('+32484824481', 10);
            this.passwordHashes.set(admin.id, newAdminHash);
          }
          if (admin.lastName === 'MMD') {
            admin.lastName = 'KOMECHAT';
          }
          admin.avatarUrl = '/komechat_logo.jpg';
          admin.statusMessage = 'Administrateur système KOMECHAT';
        }

        // Fallback for any user missing password hash
        for (const user of this.data.users) {
          if (!this.passwordHashes.has(user.id)) {
            const hash = await bcrypt.hash(user.phone, 10);
            this.passwordHashes.set(user.id, hash);
          }
        }
        this.save();
      } catch (err) {
        console.error('Error reading DB file, re-initializing database:', err);
        await this.seed();
      }
    } else {
      await this.seed();
    }
  }

  public save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Sync in-memory password hashes to data schema for persistence
      const hashObj: Record<string, string> = {};
      this.passwordHashes.forEach((hash, userId) => {
        hashObj[userId] = hash;
      });
      this.data.passwordHashes = hashObj;

      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save DB file:', err);
    }
  }

  public async seed() {
    console.log('Seeding initial KOMECHAT database...');
    const now = new Date().toISOString();
    const defaultPasswordHash = await bcrypt.hash('+32484824481', 10);
    const userPasswordHash = await bcrypt.hash('+22891234567', 10);
    const mariePasswordHash = await bcrypt.hash('+22892345678', 10);
    const paulPasswordHash = await bcrypt.hash('+22893456789', 10);

    const adminUser: User = {
      id: 'usr_admin',
      phone: '+32484824481',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'KOMECHAT',
      avatarUrl: '/komechat_logo.jpg',
      role: 'ADMIN',
      status: 'ONLINE',
      statusMessage: 'Administrateur système KOMECHAT',
      isActive: true,
      mustChangePassword: false,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const userJean: User = {
      id: 'usr_jean',
      phone: '+22891234567',
      username: 'jean',
      firstName: 'Jean',
      lastName: 'Dupont',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'USER',
      status: 'ONLINE',
      statusMessage: 'En réunion projet',
      isActive: true,
      mustChangePassword: false,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const userMarie: User = {
      id: 'usr_marie',
      phone: '+22892345678',
      firstName: 'Marie',
      lastName: 'Lawson',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: 'USER',
      status: 'OFFLINE',
      statusMessage: 'En congé',
      isActive: true,
      mustChangePassword: false,
      lastSeenAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    const userPaul: User = {
      id: 'usr_paul',
      phone: '+22893456789',
      firstName: 'Paul',
      lastName: 'Kogan',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: 'USER',
      status: 'OFFLINE',
      statusMessage: 'Disponible par message',
      isActive: true,
      mustChangePassword: false,
      lastSeenAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    // Password hashes store
    this.passwordHashes.set(adminUser.id, defaultPasswordHash);
    this.passwordHashes.set(userJean.id, userPasswordHash);
    this.passwordHashes.set(userMarie.id, mariePasswordHash);
    this.passwordHashes.set(userPaul.id, paulPasswordHash);

    // Initial Conversation between Admin & Jean
    const conv1Id = 'conv_admin_jean';
    const conv1: Conversation = {
      id: conv1Id,
      type: 'DIRECT',
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      members: [
        { id: 'mem_1', conversationId: conv1Id, userId: adminUser.id, joinedAt: now, lastReadMessageId: 'msg_2', muted: false },
        { id: 'mem_2', conversationId: conv1Id, userId: userJean.id, joinedAt: now, lastReadMessageId: 'msg_2', muted: false },
      ],
    };

    const msg1: Message = {
      id: 'msg_1',
      conversationId: conv1Id,
      senderId: adminUser.id,
      content: 'Bienvenue sur la plateforme sécurisée KOMECHAT !',
      type: 'TEXT',
      replyToId: null,
      createdAt: new Date(Date.now() - 100000).toISOString(),
      updatedAt: new Date(Date.now() - 100000).toISOString(),
      deletedAt: null,
    };

    const msg2: Message = {
      id: 'msg_2',
      conversationId: conv1Id,
      senderId: userJean.id,
      content: 'Merci ! Tout fonctionne parfaitement en temps réel.',
      type: 'TEXT',
      replyToId: 'msg_1',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.data = {
      users: [adminUser, userJean, userMarie, userPaul],
      conversations: [conv1],
      conversationMembers: conv1.members,
      messages: [msg1, msg2],
      messageStatuses: [
        { id: 'st_1', messageId: 'msg_1', userId: userJean.id, status: 'READ', createdAt: now, updatedAt: now },
        { id: 'st_2', messageId: 'msg_2', userId: adminUser.id, status: 'READ', createdAt: now, updatedAt: now },
      ],
      files: [],
      calls: [],
      notifications: [
        {
          id: 'notif_1',
          userId: adminUser.id,
          type: 'WELCOME',
          title: 'KOMECHAT',
          body: 'Votre application de messagerie privée est active.',
          readAt: null,
          createdAt: now,
        },
      ],
      auditLogs: [
        {
          id: 'log_init',
          actorId: adminUser.id,
          action: 'SYSTEM_INITIALIZED',
          targetType: 'SYSTEM',
          targetId: null,
          metadata: { note: 'Initial setup & seed executed' },
          ipAddress: '127.0.0.1',
          userAgent: 'Server Startup',
          createdAt: now,
        },
      ],
      sessions: [],
      settings: DEFAULT_SETTINGS,
    };

    this.save();
    console.log('KOMECHAT DB seeded successfully.');
  }

  // Password hashes stored in a separate internal map/property or table to separate from public User objects
  public passwordHashes: Map<string, string> = new Map();

  // User methods
  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByPhone(phone: string): User | undefined {
    const cleaned = phone.replace(/\s+/g, '');
    return this.data.users.find((u) => u.phone.replace(/\s+/g, '') === cleaned);
  }

  public getUserByUsername(username: string): User | undefined {
    if (!username) return undefined;
    const cleaned = username.trim().toLowerCase().replace(/^@+/, '');
    if (!cleaned) return undefined;
    return this.data.users.find(
      (u) => u.username && u.username.trim().toLowerCase().replace(/^@+/, '') === cleaned
    );
  }

  public getUserByPhoneOrUsername(identifier: string): User | undefined {
    if (!identifier) return undefined;
    const raw = identifier.trim();
    // Try username first if starts with @ or if no +
    const byUser = this.getUserByUsername(raw);
    if (byUser) return byUser;

    // Try by phone
    const byPhone = this.getUserByPhone(raw);
    if (byPhone) return byPhone;

    // Check if phone matches with/without country code or spacing
    const cleanDigits = raw.replace(/\D/g, '');
    if (cleanDigits.length >= 6) {
      const match = this.data.users.find((u) => {
        const uDigits = u.phone.replace(/\D/g, '');
        return uDigits === cleanDigits || uDigits.endsWith(cleanDigits);
      });
      if (match) return match;
    }

    return undefined;
  }

  public updateUserPhone(
    userId: string,
    newPhone: string,
    actorId?: string
  ): { user: User; systemMessages: Message[] } {
    const user = this.getUserById(userId);
    if (!user) throw new Error('Utilisateur non trouvé.');

    const cleanedNewPhone = newPhone.trim();
    const existingWithPhone = this.getUserByPhone(cleanedNewPhone);
    if (existingWithPhone && existingWithPhone.id !== userId) {
      throw new Error('Ce numéro de téléphone est déjà utilisé par un autre compte.');
    }

    const oldPhone = user.phone;
    const now = new Date().toISOString();

    // Update user phone
    this.updateUser(userId, {
      phone: cleanedNewPhone,
      updatedAt: now,
    });

    const updatedUser = this.getUserById(userId)!;
    const systemMessages: Message[] = [];

    // Find all conversations of this user
    const memberships = this.data.conversationMembers.filter((m) => m.userId === userId);
    const convIds = memberships.map((m) => m.conversationId);

    const actor = actorId ? this.getUserById(actorId) : null;
    const isSelf = !actorId || actorId === userId;
    const actorNote = isSelf
      ? `📱 ${updatedUser.firstName} ${updatedUser.lastName} a mis à jour son numéro de téléphone.`
      : `📱 Le numéro de ${updatedUser.firstName} ${updatedUser.lastName} a été mis à jour par l'administrateur.`;

    const content = `${actorNote} Ancien numéro : ${oldPhone} ➔ Nouveau numéro : ${cleanedNewPhone}. La discussion continue sur ce numéro.`;

    for (const convId of convIds) {
      const sysMsgId = 'msg_sys_ph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const sysMsg: Message = {
        id: sysMsgId,
        conversationId: convId,
        senderId: 'SYSTEM',
        content,
        type: 'TEXT',
        replyToId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      this.data.messages.push(sysMsg);
      systemMessages.push(sysMsg);

      // Update conversation lastMessageAt
      const convIdx = this.data.conversations.findIndex((c) => c.id === convId);
      if (convIdx !== -1) {
        this.data.conversations[convIdx].lastMessageAt = now;
        this.data.conversations[convIdx].updatedAt = now;
      }
    }

    this.save();
    return { user: updatedUser, systemMessages };
  }

  public createUser(user: User, passwordHash: string): User {
    this.data.users.push(user);
    this.passwordHashes.set(user.id, passwordHash);
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.users[idx];
  }

  public setUserPassword(userId: string, hash: string) {
    this.passwordHashes.set(userId, hash);
    this.updateUser(userId, { mustChangePassword: false });
  }

  public getPasswordHash(userId: string): string | undefined {
    return this.passwordHashes.get(userId);
  }

  public deleteUser(userId: string): boolean {
    const idx = this.data.users.findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this.passwordHashes.delete(userId);

    // Clean user memberships
    this.data.conversationMembers = this.data.conversationMembers.filter(
      (m) => m.userId !== userId
    );
    this.save();
    return true;
  }

  // Conversations
  public getConversationsForUser(userId: string): Conversation[] {
    const memberships = this.data.conversationMembers.filter(
      (m) => m.userId === userId
    );
    const convIds = new Set(memberships.map((m) => m.conversationId));

    const conversations = this.data.conversations
      .filter((c) => convIds.has(c.id))
      .map((c) => {
        const members = this.data.conversationMembers
          .filter((m) => m.conversationId === c.id)
          .map((m) => ({
            ...m,
            user: this.getUserById(m.userId),
          }));

        // Find last message
        const convMessages = this.data.messages.filter(
          (msg) => msg.conversationId === c.id && !msg.deletedAt
        );
        convMessages.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const lastMsg = convMessages[0] || null;

        // Populate file attachment if exists
        if (lastMsg && lastMsg.type !== 'TEXT') {
          const file = this.data.files.find((f) => f.messageId === lastMsg.id);
          if (file) lastMsg.file = file;
        }

        // Count unread
        const userMem = members.find((m) => m.userId === userId);
        let unreadCount = 0;
        if (userMem) {
          if (!userMem.lastReadMessageId) {
            unreadCount = convMessages.length;
          } else {
            const readIndex = convMessages.findIndex(
              (m) => m.id === userMem.lastReadMessageId
            );
            if (readIndex !== -1) {
              unreadCount = readIndex; // since convMessages is sorted desc
            } else {
              unreadCount = convMessages.length;
            }
          }
        }

        // Find other user for DIRECT chat
        const otherMem = members.find((m) => m.userId !== userId);

        return {
          ...c,
          members,
          lastMessage: lastMsg,
          unreadCount,
          otherUser: otherMem?.user,
        };
      });

    // Sort by lastMessageAt descending
    conversations.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
    );

    return conversations;
  }

  public getConversationById(id: string): Conversation | undefined {
    const conv = this.data.conversations.find((c) => c.id === id);
    if (!conv) return undefined;

    const members = this.data.conversationMembers
      .filter((m) => m.conversationId === conv.id)
      .map((m) => ({
        ...m,
        user: this.getUserById(m.userId),
      }));

    return {
      ...conv,
      members,
    };
  }

  public findDirectConversation(userAId: string, userBId: string): Conversation | undefined {
    const directConvs = this.data.conversations.filter((c) => c.type === 'DIRECT');
    for (const c of directConvs) {
      const members = this.data.conversationMembers.filter(
        (m) => m.conversationId === c.id
      );
      const userIds = members.map((m) => m.userId);
      if (userIds.includes(userAId) && userIds.includes(userBId)) {
        return this.getConversationById(c.id);
      }
    }
    return undefined;
  }

  public createConversation(
    type: 'DIRECT' | 'GROUP' | 'CHANNEL',
    memberUserIds: string[],
    name?: string
  ): Conversation {
    const convId = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();

    const conv: Conversation = {
      id: convId,
      type,
      name: name || null,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      members: [],
    };

    const members: ConversationMember[] = memberUserIds.map((uId, idx) => ({
      id: `mem_${convId}_${idx}`,
      conversationId: convId,
      userId: uId,
      joinedAt: now,
      lastReadMessageId: null,
      muted: false,
    }));

    this.data.conversations.push(conv);
    this.data.conversationMembers.push(...members);
    this.save();

    return this.getConversationById(convId)!;
  }

  public createGroup(
    name: string,
    creatorId: string,
    memberUserIds: string[],
    avatarUrl?: string,
    description?: string
  ): Conversation {
    const convId = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();

    const uniqueMembers = Array.from(new Set([creatorId, ...memberUserIds]));

    const conv: Conversation = {
      id: convId,
      type: 'GROUP',
      name: name.trim(),
      description: description?.trim() || null,
      avatarUrl: avatarUrl || null,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      members: [],
    };

    const members: ConversationMember[] = uniqueMembers.map((uId, idx) => ({
      id: `mem_${convId}_${idx}`,
      conversationId: convId,
      userId: uId,
      joinedAt: now,
      lastReadMessageId: null,
      muted: false,
    }));

    this.data.conversations.push(conv);
    this.data.conversationMembers.push(...members);

    // Create system message
    const creator = this.getUserById(creatorId);
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'L\'administrateur';
    const sysMsg: Message = {
      id: 'msg_sys_' + Date.now(),
      conversationId: convId,
      senderId: creatorId,
      content: `🎉 ${creatorName} a créé le groupe "${name}".`,
      type: 'TEXT',
      replyToId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.data.messages.push(sysMsg);

    this.save();
    return this.getConversationById(convId)!;
  }

  public addMembersToConversation(conversationId: string, userIds: string[]): Conversation | undefined {
    const conv = this.data.conversations.find((c) => c.id === conversationId);
    if (!conv) return undefined;

    const existingMembers = this.data.conversationMembers.filter((m) => m.conversationId === conversationId);
    const existingUserIds = new Set(existingMembers.map((m) => m.userId));
    const now = new Date().toISOString();

    const newMembersToAdd = userIds.filter((uId) => !existingUserIds.has(uId));
    if (newMembersToAdd.length === 0) {
      return this.getConversationById(conversationId);
    }

    const newMembers: ConversationMember[] = newMembersToAdd.map((uId, idx) => ({
      id: `mem_${conversationId}_${Date.now()}_${idx}`,
      conversationId,
      userId: uId,
      joinedAt: now,
      lastReadMessageId: null,
      muted: false,
    }));

    this.data.conversationMembers.push(...newMembers);
    conv.updatedAt = now;

    // System message
    const addedNames = newMembersToAdd
      .map((id) => {
        const u = this.getUserById(id);
        return u ? `${u.firstName} ${u.lastName}` : id;
      })
      .join(', ');

    const sysMsg: Message = {
      id: 'msg_sys_' + Date.now(),
      conversationId,
      senderId: 'SYSTEM',
      content: `👤 ${addedNames} a été ajouté au groupe.`,
      type: 'TEXT',
      replyToId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.data.messages.push(sysMsg);

    this.save();
    return this.getConversationById(conversationId);
  }

  public removeMemberFromConversation(conversationId: string, userId: string): Conversation | undefined {
    const conv = this.data.conversations.find((c) => c.id === conversationId);
    if (!conv) return undefined;

    const initialLen = this.data.conversationMembers.length;
    this.data.conversationMembers = this.data.conversationMembers.filter(
      (m) => !(m.conversationId === conversationId && m.userId === userId)
    );

    if (this.data.conversationMembers.length !== initialLen) {
      const now = new Date().toISOString();
      conv.updatedAt = now;

      const removedUser = this.getUserById(userId);
      const name = removedUser ? `${removedUser.firstName} ${removedUser.lastName}` : 'Un membre';

      const sysMsg: Message = {
        id: 'msg_sys_' + Date.now(),
        conversationId,
        senderId: 'SYSTEM',
        content: `👋 ${name} a été retiré du groupe.`,
        type: 'TEXT',
        replyToId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.data.messages.push(sysMsg);

      this.save();
    }

    return this.getConversationById(conversationId);
  }

  public updateConversation(conversationId: string, updates: Partial<Conversation>): Conversation | undefined {
    const idx = this.data.conversations.findIndex((c) => c.id === conversationId);
    if (idx === -1) return undefined;

    this.data.conversations[idx] = {
      ...this.data.conversations[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.save();
    return this.getConversationById(conversationId);
  }

  public getAllGroups(): Conversation[] {
    const groupConvs = this.data.conversations.filter((c) => c.type === 'GROUP');
    return groupConvs.map((c) => this.getConversationById(c.id)!);
  }

  public deleteConversation(conversationId: string): boolean {
    const idx = this.data.conversations.findIndex((c) => c.id === conversationId);
    if (idx === -1) return false;

    this.data.conversations.splice(idx, 1);
    this.data.conversationMembers = this.data.conversationMembers.filter(
      (m) => m.conversationId !== conversationId
    );
    this.data.messages = this.data.messages.filter(
      (m) => m.conversationId !== conversationId
    );
    this.save();
    return true;
  }

  // Messages
  public getMessageById(messageId: string): Message | undefined {
    const m = this.data.messages.find((msg) => msg.id === messageId);
    if (!m) return undefined;

    const sender = this.getUserById(m.senderId);
    const file = this.data.files.find((f) => f.messageId === m.id) || null;
    let replyTo = null;
    if (m.replyToId) {
      const parent = this.data.messages.find((p) => p.id === m.replyToId);
      if (parent) {
        const parentSender = this.getUserById(parent.senderId);
        replyTo = {
          id: parent.id,
          senderName: parentSender
            ? `${parentSender.firstName} ${parentSender.lastName}`
            : 'Utilisateur',
          content: parent.content,
          type: parent.type,
        };
      }
    }

    const statuses = this.data.messageStatuses.filter(
      (s) => s.messageId === m.id
    );

    return {
      ...m,
      sender,
      file,
      replyTo,
      statuses,
    };
  }

  public getMessagesForConversation(
    conversationId: string,
    userId: string,
    limit = 50
  ): Message[] {
    let messages = this.data.messages.filter(
      (m) =>
        m.conversationId === conversationId &&
        (!m.deletedForUserIds || !m.deletedForUserIds.includes(userId))
    );

    messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (limit > 0) {
      messages = messages.slice(-limit);
    }

    return messages.map((m) => {
      const sender = this.getUserById(m.senderId);
      const file = this.data.files.find((f) => f.messageId === m.id) || null;
      let replyTo = null;
      if (m.replyToId) {
        const parent = this.data.messages.find((p) => p.id === m.replyToId);
        if (parent) {
          const parentSender = this.getUserById(parent.senderId);
          replyTo = {
            id: parent.id,
            senderName: parentSender
              ? `${parentSender.firstName} ${parentSender.lastName}`
              : 'Utilisateur',
            content: parent.content,
            type: parent.type,
          };
        }
      }

      // Populate receipts
      const statuses = this.data.messageStatuses.filter(
        (s) => s.messageId === m.id
      );

      return {
        ...m,
        sender,
        file,
        replyTo,
        statuses,
      };
    });
  }

  public createMessage(msg: Message): Message {
    this.data.messages.push(msg);

    // Update conversation lastMessageAt
    const convIdx = this.data.conversations.findIndex(
      (c) => c.id === msg.conversationId
    );
    if (convIdx !== -1) {
      this.data.conversations[convIdx].lastMessageAt = msg.createdAt;
      this.data.conversations[convIdx].updatedAt = msg.createdAt;
    }

    this.save();
    return msg;
  }

  public updateMessageStatus(
    messageId: string,
    userId: string,
    status: 'SENT' | 'DELIVERED' | 'READ'
  ): MessageStatus {
    const existing = this.data.messageStatuses.find(
      (s) => s.messageId === messageId && s.userId === userId
    );

    const now = new Date().toISOString();
    if (existing) {
      existing.status = status;
      existing.updatedAt = now;
      this.save();
      return existing;
    } else {
      const st: MessageStatus = {
        id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        messageId,
        userId,
        status,
        createdAt: now,
        updatedAt: now,
      };
      this.data.messageStatuses.push(st);
      this.save();
      return st;
    }
  }

  public markConversationAsRead(conversationId: string, userId: string, lastMessageId: string) {
    const memIdx = this.data.conversationMembers.findIndex(
      (m) => m.conversationId === conversationId && m.userId === userId
    );
    if (memIdx !== -1) {
      this.data.conversationMembers[memIdx].lastReadMessageId = lastMessageId;
    }

    // Mark messages in conversation as read for this user
    const messages = this.data.messages.filter(
      (m) => m.conversationId === conversationId && m.senderId !== userId
    );
    for (const m of messages) {
      this.updateMessageStatus(m.id, userId, 'READ');
    }

    this.save();
  }

  public deleteMessageForMe(messageId: string, userId: string): boolean {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return false;
    if (!msg.deletedForUserIds) msg.deletedForUserIds = [];
    if (!msg.deletedForUserIds.includes(userId)) {
      msg.deletedForUserIds.push(userId);
      this.save();
    }
    return true;
  }

  public editMessage(messageId: string, newContent: string): Message | undefined {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg || msg.deletedAt) return undefined;
    msg.content = newContent.trim();
    msg.updatedAt = new Date().toISOString();
    msg.isEdited = true;
    this.save();
    return msg;
  }

  public deleteMessageForEveryone(messageId: string): boolean {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return false;
    msg.content = 'Ce message a été supprimé.';
    msg.deletedAt = new Date().toISOString();
    this.save();
    return true;
  }

  // Files
  public createFileAttachment(file: FileAttachment): FileAttachment {
    this.data.files.push(file);
    this.save();
    return file;
  }

  public getFilesForConversation(conversationId: string): FileAttachment[] {
    const messageIds = new Set(
      this.data.messages
        .filter((m) => m.conversationId === conversationId && !m.deletedAt)
        .map((m) => m.id)
    );
    return this.data.files.filter((f) => f.messageId && messageIds.has(f.messageId));
  }

  public getFileById(id: string): FileAttachment | undefined {
    return this.data.files.find((f) => f.id === id);
  }

  // Calls
  public createCall(call: Call): Call {
    this.data.calls.push(call);
    this.save();
    return call;
  }

  public updateCall(id: string, updates: Partial<Call>): Call | undefined {
    const idx = this.data.calls.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.calls[idx] = {
      ...this.data.calls[idx],
      ...updates,
    };
    this.save();
    return this.data.calls[idx];
  }

  public getCallsForUser(userId: string): Call[] {
    const calls = this.data.calls.filter(
      (c) => c.callerId === userId || c.receiverId === userId
    );
    calls.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return calls.map((c) => ({
      ...c,
      caller: this.getUserById(c.callerId),
      receiver: this.getUserById(c.receiverId),
    }));
  }

  public deleteCall(callId: string, userId: string): boolean {
    const idx = this.data.calls.findIndex(
      (c) => c.id === callId && (c.callerId === userId || c.receiverId === userId)
    );
    if (idx === -1) return false;
    this.data.calls.splice(idx, 1);
    this.save();
    return true;
  }

  public clearCallHistory(userId: string): boolean {
    this.data.calls = this.data.calls.filter(
      (c) => c.callerId !== userId && c.receiverId !== userId
    );
    this.save();
    return true;
  }

  // Notifications
  public createNotification(notif: AppNotification): AppNotification {
    this.data.notifications.push(notif);
    this.save();
    return notif;
  }

  public getNotificationsForUser(userId: string): AppNotification[] {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  public markNotificationAsRead(id: string): boolean {
    const notif = this.data.notifications.find((n) => n.id === id);
    if (!notif) return false;
    notif.readAt = new Date().toISOString();
    this.save();
    return true;
  }

  // Audit Logs
  public addAuditLog(
    actorId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ): AuditLog {
    const actor = this.getUserById(actorId);
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actorId,
      actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Inconnu',
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      metadata,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log); // Newer first
    this.save();
    return log;
  }

  public getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // Admin Statistics
  public getAdminStats() {
    const users = this.data.users;
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();

    const messagesToday = this.data.messages.filter(
      (m) => m.createdAt >= startOfDay
    ).length;

    const callsToday = this.data.calls.filter(
      (c) => c.startedAt >= startOfDay
    ).length;

    const storageUsedBytes = this.data.files.reduce(
      (acc, f) => acc + (f.size || 0),
      0
    );

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      onlineUsers: users.filter((u) => u.status === 'ONLINE').length,
      messagesToday,
      filesSent: this.data.files.length,
      callsToday,
      storageUsedBytes,
      maxStorageBytes: TOTAL_STORAGE_QUOTA_BYTES, // 50 GB
    };
  }

  // User Preferences (Persisted across devices & sessions)
  public getUserPreferences(userId: string): UserPreferences {
    if (!this.data.userPreferences) {
      this.data.userPreferences = {};
    }
    return this.data.userPreferences[userId] || { ...DEFAULT_USER_PREFERENCES };
  }

  public updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): UserPreferences {
    if (!this.data.userPreferences) {
      this.data.userPreferences = {};
    }
    const current = this.data.userPreferences[userId] || { ...DEFAULT_USER_PREFERENCES };
    this.data.userPreferences[userId] = {
      ...current,
      ...updates,
    };
    this.save();
    return this.data.userPreferences[userId];
  }

  // Hosting Storage Breakdown (50 GB Capacity)
  public getHostingStorageDetails(): HostingStorageDetails {
    let imagesBytes = 0;
    let voiceNotesAudioBytes = 0;
    let videosBytes = 0;
    let documentsFilesBytes = 0;

    let imagesCount = 0;
    let voiceNotesCount = 0;
    let videosCount = 0;
    let documentsCount = 0;

    for (const f of this.data.files) {
      const size = f.size || 0;
      const mime = (f.mimeType || '').toLowerCase();
      if (mime.startsWith('image/')) {
        imagesBytes += size;
        imagesCount++;
      } else if (mime.startsWith('audio/')) {
        voiceNotesAudioBytes += size;
        voiceNotesCount++;
      } else if (mime.startsWith('video/')) {
        videosBytes += size;
        videosCount++;
      } else {
        documentsFilesBytes += size;
        documentsCount++;
      }
    }

    // Estimate JSON database size
    let dbFileSizeBytes = 0;
    try {
      if (fs.existsSync(DB_FILE)) {
        dbFileSizeBytes = fs.statSync(DB_FILE).size;
      }
    } catch {
      dbFileSizeBytes = 1024 * 100;
    }

    const totalUsedBytes =
      imagesBytes + voiceNotesAudioBytes + videosBytes + documentsFilesBytes + dbFileSizeBytes;
    const totalAllocatedBytes = TOTAL_STORAGE_QUOTA_BYTES; // 50 GB
    const freeBytes = Math.max(0, totalAllocatedBytes - totalUsedBytes);
    const usedPercentage = Math.min(100, Math.round((totalUsedBytes / totalAllocatedBytes) * 1000) / 10);

    return {
      totalAllocatedBytes,
      totalUsedBytes,
      usedPercentage,
      freeBytes,
      breakdown: {
        messagesAndDbBytes: dbFileSizeBytes,
        imagesBytes,
        voiceNotesAudioBytes,
        videosBytes,
        documentsFilesBytes,
      },
      counts: {
        totalFiles: this.data.files.length,
        imagesCount,
        voiceNotesCount,
        videosCount,
        documentsCount,
        messagesCount: this.data.messages.length,
      },
    };
  }

  // Backup: Full System Export
  public exportBackupData(exportedByUserId: string): BackupExportPayload {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: exportedByUserId,
      system: {
        appName: 'KOMECHAT',
        allocatedStorageGb: 50,
      },
      stats: {
        usersCount: this.data.users.length,
        conversationsCount: this.data.conversations.length,
        messagesCount: this.data.messages.length,
        filesCount: this.data.files.length,
        callsCount: this.data.calls.length,
      },
      users: this.data.users,
      conversations: this.data.conversations,
      conversationMembers: this.data.conversationMembers,
      messages: this.data.messages,
      messageStatuses: this.data.messageStatuses,
      files: this.data.files,
      calls: this.data.calls,
      settings: this.data.settings,
    };
  }

  // Backup: Full System Import (Merge or Replace)
  public importBackupData(
    backup: Partial<BackupExportPayload>,
    mode: 'MERGE' | 'REPLACE' = 'MERGE'
  ): {
    importedUsers: number;
    importedConversations: number;
    importedMessages: number;
    importedFiles: number;
    importedCalls: number;
  } {
    if (mode === 'REPLACE') {
      if (Array.isArray(backup.users) && backup.users.length > 0) {
        this.data.users = backup.users;
      }
      if (Array.isArray(backup.conversations)) {
        this.data.conversations = backup.conversations;
      }
      if (Array.isArray(backup.conversationMembers)) {
        this.data.conversationMembers = backup.conversationMembers;
      }
      if (Array.isArray(backup.messages)) {
        this.data.messages = backup.messages;
      }
      if (Array.isArray(backup.messageStatuses)) {
        this.data.messageStatuses = backup.messageStatuses;
      }
      if (Array.isArray(backup.files)) {
        this.data.files = backup.files;
      }
      if (Array.isArray(backup.calls)) {
        this.data.calls = backup.calls;
      }
      if (backup.settings) {
        this.data.settings = { ...this.data.settings, ...backup.settings };
      }
      this.save();
      return {
        importedUsers: this.data.users.length,
        importedConversations: this.data.conversations.length,
        importedMessages: this.data.messages.length,
        importedFiles: this.data.files.length,
        importedCalls: this.data.calls.length,
      };
    }

    // MERGE MODE
    let importedUsers = 0;
    let importedConversations = 0;
    let importedMessages = 0;
    let importedFiles = 0;
    let importedCalls = 0;

    // Merge Users
    if (Array.isArray(backup.users)) {
      for (const u of backup.users) {
        const existingIdx = this.data.users.findIndex((ex) => ex.id === u.id || ex.phone === u.phone);
        if (existingIdx === -1) {
          this.data.users.push(u);
          importedUsers++;
        }
      }
    }

    // Merge Conversations
    if (Array.isArray(backup.conversations)) {
      for (const c of backup.conversations) {
        const existingIdx = this.data.conversations.findIndex((ex) => ex.id === c.id);
        if (existingIdx === -1) {
          this.data.conversations.push(c);
          importedConversations++;
        }
      }
    }

    // Merge Members
    if (Array.isArray(backup.conversationMembers)) {
      for (const m of backup.conversationMembers) {
        const exists = this.data.conversationMembers.some(
          (ex) => ex.conversationId === m.conversationId && ex.userId === m.userId
        );
        if (!exists) {
          this.data.conversationMembers.push(m);
        }
      }
    }

    // Merge Messages
    if (Array.isArray(backup.messages)) {
      for (const msg of backup.messages) {
        const exists = this.data.messages.some((ex) => ex.id === msg.id);
        if (!exists) {
          this.data.messages.push(msg);
          importedMessages++;
        }
      }
    }

    // Merge Files
    if (Array.isArray(backup.files)) {
      for (const f of backup.files) {
        const exists = this.data.files.some((ex) => ex.id === f.id);
        if (!exists) {
          this.data.files.push(f);
          importedFiles++;
        }
      }
    }

    // Merge Calls
    if (Array.isArray(backup.calls)) {
      for (const call of backup.calls) {
        const exists = this.data.calls.some((ex) => ex.id === call.id);
        if (!exists) {
          this.data.calls.push(call);
          importedCalls++;
        }
      }
    }

    if (backup.settings) {
      this.data.settings = { ...this.data.settings, ...backup.settings };
    }

    this.save();
    return {
      importedUsers,
      importedConversations,
      importedMessages,
      importedFiles,
      importedCalls,
    };
  }

  // Backup: Personal User Data Export
  public exportUserData(userId: string) {
    const user = this.getUserById(userId);
    const userConvs = this.getConversationsForUser(userId);
    const convIds = new Set(userConvs.map((c) => c.id));
    const userMessages = this.data.messages.filter((m) => convIds.has(m.conversationId));
    const messageIds = new Set(userMessages.map((m) => m.id));
    const userFiles = this.data.files.filter((f) => f.messageId && messageIds.has(f.messageId));
    const userCalls = this.data.calls.filter((c) => c.callerId === userId || c.receiverId === userId);
    const preferences = this.getUserPreferences(userId);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user,
      preferences,
      conversations: userConvs,
      messages: userMessages,
      files: userFiles,
      calls: userCalls,
    };
  }

  // Backup: Personal User Data Import
  public importUserData(userId: string, data: any) {
    let restoredMessages = 0;
    if (data.preferences) {
      this.updateUserPreferences(userId, data.preferences);
    }
    if (Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        const exists = this.data.messages.some((m) => m.id === msg.id);
        if (!exists) {
          this.data.messages.push(msg);
          restoredMessages++;
        }
      }
      this.save();
    }
    return { restoredMessages };
  }

  // Settings
  public getSettings(): AppSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
    };
    this.save();
    return this.data.settings;
  }

  // Search messages/users
  public search(userId: string, query: string) {
    const q = query.toLowerCase().trim();
    if (!q) return { users: [], messages: [] };

    // Search active users
    const matchedUsers = this.data.users.filter(
      (u) =>
        u.isActive &&
        (u.phone.includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q))
    );

    // Search messages in user's conversations
    const userConvIds = new Set(
      this.data.conversationMembers
        .filter((m) => m.userId === userId)
        .map((m) => m.conversationId)
    );

    const matchedMessages = this.data.messages
      .filter(
        (m) =>
          userConvIds.has(m.conversationId) &&
          !m.deletedAt &&
          m.content.toLowerCase().includes(q)
      )
      .slice(0, 30)
      .map((m) => ({
        ...m,
        sender: this.getUserById(m.senderId),
      }));

    return {
      users: matchedUsers,
      messages: matchedMessages,
    };
  }
}

export const db = new DatabaseService();
