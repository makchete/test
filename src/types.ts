export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ONLINE' | 'OFFLINE';

export interface User {
  id: string;
  phone: string;
  username?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  statusMessage?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationType = 'DIRECT' | 'GROUP' | 'CHANNEL';

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadMessageId: string | null;
  muted: boolean;
  user?: User;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  members: ConversationMember[];
  lastMessage?: Message | null;
  unreadCount?: number;
  otherUser?: User; // helper for DIRECT
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL_LOG';
export type MessageReceiptStatus = 'SENT' | 'DELIVERED' | 'READ';

export type CallMode = 'AUDIO' | 'VIDEO';

export interface CallLogMetadata {
  callId: string;
  callerId: string;
  receiverId: string;
  status: CallStatus;
  duration: number; // in seconds
  callMode?: CallMode;
  isVideo?: boolean;
  isGroup?: boolean;
  groupName?: string;
  groupAvatarUrl?: string | null;
}

export interface FileAttachment {
  id: string;
  messageId?: string | null;
  originalName: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  size: number;
  thumbnailKey?: string | null;
  url: string;
  createdAt: string;
}

export interface MessageStatus {
  id: string;
  messageId: string;
  userId: string;
  status: MessageReceiptStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MessageReply {
  id: string;
  senderName: string;
  content: string;
  type: MessageType;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  replyToId: string | null;
  replyTo?: MessageReply | null;
  createdAt: string;
  updatedAt: string;
  isEdited?: boolean;
  deletedAt: string | null;
  deletedForUserIds?: string[];
  file?: FileAttachment | null;
  callLog?: CallLogMetadata | null;
  sender?: User;
  statuses?: MessageStatus[];
  status?: MessageReceiptStatus;
}

export type CallStatus =
  | 'RINGING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'MISSED'
  | 'ENDED'
  | 'FAILED'
  | 'BUSY';

export interface Call {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  status: CallStatus;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  duration: number; // seconds
  caller?: User;
  receiver?: User;
  callMode?: CallMode;
  isVideo?: boolean;
  isGroup?: boolean;
  groupName?: string;
  groupAvatarUrl?: string | null;
}

export interface GroupCallSession {
  id: string;
  conversationId: string;
  groupName: string;
  groupAvatarUrl?: string | null;
  callerId: string;
  caller: User;
  status: 'RINGING' | 'CONNECTED' | 'ENDED';
  participants: User[];
  startedAt: string;
  callMode?: CallMode;
  isVideo?: boolean;
}

export type CallRecord = Call;

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata?: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  messagesToday: number;
  filesSent: number;
  callsToday: number;
  storageUsedBytes: number;
  maxStorageBytes: number;
}

export interface AppSettings {
  appName?: string;
  appLogoUrl?: string | null;
  maxFileSizeMb: number;
  allowPublicMediaPreview: boolean;
  heartbeatIntervalSec: number;
  offlineTimeoutSec: number;
}

export type SupportedLanguage = 'fr' | 'en' | 'nl';

export interface UserPreferences {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
  enterToSend: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  autoDownloadMedia: boolean;
  language?: SupportedLanguage;
}

export interface HostingStorageDetails {
  totalAllocatedBytes: number; // 50 GB = 53687091200
  totalUsedBytes: number;
  usedPercentage: number;
  freeBytes: number;
  breakdown: {
    messagesAndDbBytes: number;
    imagesBytes: number;
    voiceNotesAudioBytes: number;
    videosBytes: number;
    documentsFilesBytes: number;
  };
  counts: {
    totalFiles: number;
    imagesCount: number;
    voiceNotesCount: number;
    videosCount: number;
    documentsCount: number;
    messagesCount: number;
  };
}

export interface BackupExportPayload {
  version: string;
  exportedAt: string;
  exportedBy: string;
  system: {
    appName: string;
    allocatedStorageGb: number;
  };
  stats: {
    usersCount: number;
    conversationsCount: number;
    messagesCount: number;
    filesCount: number;
    callsCount: number;
  };
  users: User[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
  messageStatuses: MessageStatus[];
  files: FileAttachment[];
  calls: Call[];
  settings: AppSettings;
}

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  url: string;
  duration?: number; // in seconds
  size?: number; // in bytes
  fileId?: string;
  source?: 'upload' | 'chat' | 'default';
  addedAt: string;
}

export type PlaylistRepeatMode = 'OFF' | 'ALL' | 'ONE';

