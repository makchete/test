import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { UserRole } from '../src/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'komechat_secret_cle_2026_super_securisee';
const LEGACY_JWT_SECRETS = [
  'mmd_chat_secret_key_2026_tok',
  'mmd_chat_secret_key_2025_tok',
  'mmd_secret_key_2026',
];

export interface AuthPayload {
  userId: string;
  phone: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function generateToken(userId: string, phone: string, role: UserRole): string {
  return jwt.sign({ userId, phone, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    // Backward-compatibility: allow valid tokens signed with previous key
    for (const legacySecret of LEGACY_JWT_SECRETS) {
      if (legacySecret === JWT_SECRET) continue;
      try {
        return jwt.verify(token, legacySecret) as AuthPayload;
      } catch {}
    }
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = '';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié. Token manquant.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }

  const user = db.getUserById(payload.userId);
  if (!user || !user.isActive) {
    return res.status(403).json({ error: 'Compte désactivé ou inexistant.' });
  }

  // If the token was signed with a legacy secret, provide an upgraded token transparently
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    const upgradedToken = generateToken(user.id, user.phone, user.role);
    res.setHeader('X-Upgraded-Token', upgradedToken);
    res.setHeader('Access-Control-Expose-Headers', 'X-Upgraded-Token');
  }

  req.user = payload;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
  });
}

export function requireConversationMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  requireAuth(req, res, () => {
    const conversationId =
      req.params.id ||
      req.params.conversationId ||
      req.body.conversationId ||
      req.query.conversationId;
    if (!conversationId) {
      return res.status(400).json({ error: 'ID de conversation manquant.' });
    }

    const conversation = db.getConversationById(String(conversationId));
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée.' });
    }

    const isAdmin = req.user?.role === 'ADMIN';
    const isMember = isAdmin || conversation.members.some((m) => m.userId === req.user?.userId);
    if (!isMember) {
      return res.status(403).json({ error: "Vous ne faites pas partie de cette conversation." });
    }

    next();
  });
}
