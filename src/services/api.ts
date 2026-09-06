import {
  User,
  Conversation,
  Message,
  FileAttachment,
  Call,
  AppNotification,
  AuditLog,
  AdminStats,
  AppSettings,
  UserPreferences,
  HostingStorageDetails,
  BackupExportPayload,
} from '../types';

const API_BASE = '/api/v1';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('mmd_chat_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function executeFetch(url: string, init: RequestInit, retries = 1): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: any) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return executeFetch(url, init, retries - 1);
    }
    throw err;
  }
}

async function parseResponseBody(response: Response): Promise<{ data: any; isJson: boolean; rawText: string }> {
  const rawText = await response.text();
  try {
    const data = rawText ? JSON.parse(rawText) : {};
    return { data, isJson: true, rawText };
  } catch {
    return { data: null, isJson: false, rawText };
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await executeFetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Connexion au serveur impossible. Vérifiez votre connexion Internet.');
    }
    throw err;
  }

  const { data, isJson } = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('mmd_chat_token');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error(data?.error || 'Votre session a expiré. Veuillez vous reconnecter.');
    }
    if (response.status === 413) {
      throw new Error('La taille des données dépasse la limite autorisée par le serveur.');
    }
    throw new Error(data?.error || `Erreur serveur (${response.status})`);
  }

  if (!isJson && response.status !== 204) {
    throw new Error('Réponse invalide du serveur (format HTML reçu au lieu de JSON).');
  }

  // Seamlessly store upgraded token if server updated the signing key
  const upgradedToken = response.headers.get('x-upgraded-token');
  if (upgradedToken) {
    localStorage.setItem('mmd_chat_token', upgradedToken);
  }

  return (data || {}) as T;
}

export const api = {
  // Auth
  login: (identifierOrPhone: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: identifierOrPhone, phone: identifierOrPhone, password }),
    }),

  getMe: () => request<{ user: User; token?: string }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string; user: User }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  // Users
  getUsers: () => request<{ users: User[] }>('/users'),

  getUserById: (id: string) => request<{ user: User }>(`/users/${id}`),

  updateProfile: (data: Partial<User>) =>
    request<{ user: User }>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Admin User operations
  createUser: (data: { phone: string; username?: string; firstName: string; lastName: string; role?: string; avatarUrl?: string }) =>
    request<{ user: User; initialCredentials: { phone: string; username?: string; initialPassword: string } }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: Partial<User>) =>
    request<{ user: User }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  activateUser: (id: string) =>
    request<{ user: User }>(`/users/${id}/activate`, { method: 'POST' }),

  deactivateUser: (id: string) =>
    request<{ user: User }>(`/users/${id}/deactivate`, { method: 'POST' }),

  resetUserPassword: (id: string) =>
    request<{ message: string; tempPassword: string }>(`/users/${id}/reset-password`, { method: 'POST' }),

  deleteUser: (id: string) =>
    request<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),

  // Conversations
  getConversations: () => request<{ conversations: Conversation[] }>('/conversations'),

  getOrCreateDirectConversation: (targetUserId: string) =>
    request<{ conversation: Conversation }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  getConversationById: (id: string) =>
    request<{ conversation: Conversation }>(`/conversations/${id}`),

  getConversationMessages: (id: string, limit = 50) =>
    request<{ messages: Message[] }>(`/conversations/${id}/messages?limit=${limit}`),

  getConversationMedia: (id: string) =>
    request<{ files: FileAttachment[] }>(`/conversations/${id}/media`),

  createGroup: (data: { name: string; memberUserIds: string[]; avatarUrl?: string; description?: string }) =>
    request<{ conversation: Conversation }>('/conversations/group', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addGroupMembers: (conversationId: string, userIds: string[]) =>
    request<{ conversation: Conversation }>(`/conversations/${conversationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),

  removeGroupMember: (conversationId: string, userId: string) =>
    request<{ conversation: Conversation }>(`/conversations/${conversationId}/members/${userId}`, {
      method: 'DELETE',
    }),

  updateGroup: (conversationId: string, data: { name?: string; description?: string; avatarUrl?: string }) =>
    request<{ conversation: Conversation }>(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteConversation: (conversationId: string) =>
    request<{ message: string }>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    }),

  getAdminGroups: () =>
    request<{ groups: Conversation[] }>('/admin/groups'),

  // Messages
  sendMessage: (data: { conversationId: string; content?: string; type?: string; replyToId?: string | null; fileId?: string | null; file?: FileAttachment | null }) =>
    request<{ message: Message }>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  editMessage: (id: string, content: string) =>
    request<{ message: Message }>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  markMessageRead: (id: string, conversationId: string) =>
    request<{ success: boolean }>(`/messages/${id}/read`, {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),

  deleteMessage: (id: string, forEveryone = false) =>
    request<{ message: string }>(`/messages/${id}?forEveryone=${forEveryone}`, {
      method: 'DELETE',
    }),

  // Files
  uploadFile: async (file: File) => {
    // Client-side guard for Cloud Run / proxy body size (30MB safe limit)
    const maxMb = 30;
    if (file.size > maxMb * 1024 * 1024) {
      throw new Error(`Le fichier (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de ${maxMb} Mo.`);
    }

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('mmd_chat_token');
    let response: Response;
    try {
      response = await executeFetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }, 1);
    } catch (err: any) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error("Échec du téléversement : impossible de joindre le serveur. Vérifiez votre connexion ou la taille du fichier.");
      }
      throw err;
    }

    const { data, isJson } = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('Le fichier est trop volumineux pour être accepté par le serveur (limite de 30 Mo).');
      }
      if (response.status === 401) {
        localStorage.removeItem('mmd_chat_token');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
      }
      throw new Error(data?.error || `Erreur lors de l'envoi du fichier (${response.status})`);
    }

    if (!isJson || !data?.file) {
      throw new Error("Réponse inattendue du serveur lors de l'envoi du fichier.");
    }

    const upgradedToken = response.headers.get('x-upgraded-token');
    if (upgradedToken) {
      localStorage.setItem('mmd_chat_token', upgradedToken);
    }

    return data as { file: FileAttachment };
  },

  // Calls
  getCallHistory: () => request<{ calls: Call[] }>('/calls/history'),

  deleteCall: (id: string) =>
    request<{ message: string }>(`/calls/history/${id}`, { method: 'DELETE' }),

  clearCallHistory: () =>
    request<{ message: string }>('/calls/history', { method: 'DELETE' }),

  // Notifications
  getNotifications: () => request<{ notifications: AppNotification[] }>('/notifications'),

  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),

  // Search
  search: (query: string) =>
    request<{ users: User[]; messages: Message[] }>(`/search?q=${encodeURIComponent(query)}`),

  // Branding & Public App Info
  getBranding: () => request<{ appName: string; appLogoUrl: string }>('/branding'),

  uploadAppLogo: async (file: File) => {
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      throw new Error(`Le logo dépasse la limite autorisée de ${maxMb} Mo.`);
    }

    const formData = new FormData();
    formData.append('logo', file);

    const token = localStorage.getItem('mmd_chat_token');
    let response: Response;
    try {
      response = await executeFetch(`${API_BASE}/admin/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }, 1);
    } catch (err: any) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Échec du téléversement : impossible de joindre le serveur.');
      }
      throw err;
    }

    const { data, isJson } = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('Le logo est trop volumineux (maximum 10 Mo).');
      }
      if (response.status === 401) {
        localStorage.removeItem('mmd_chat_token');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
      }
      throw new Error(data?.error || 'Erreur lors du téléversement du logo.');
    }

    if (!isJson) {
      throw new Error('Réponse inattendue du serveur lors du téléversement du logo.');
    }

    const upgradedToken = response.headers.get('x-upgraded-token');
    if (upgradedToken) {
      localStorage.setItem('mmd_chat_token', upgradedToken);
    }

    return data as { success: boolean; appLogoUrl: string; settings: AppSettings };
  },

  resetAppLogo: () =>
    request<{ success: boolean; appLogoUrl: string; settings: AppSettings }>('/admin/logo/reset', {
      method: 'POST',
    }),

  // Admin
  getAdminStats: () => request<{ stats: AdminStats }>('/admin/dashboard'),

  getAuditLogs: () => request<{ logs: AuditLog[] }>('/admin/activity'),

  getSettings: () => request<{ settings: AppSettings }>('/admin/settings'),

  updateSettings: (data: Partial<AppSettings>) =>
    request<{ settings: AppSettings }>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // User Preferences
  getPreferences: () => request<{ preferences: UserPreferences }>('/users/me/preferences'),

  updatePreferences: (data: Partial<UserPreferences>) =>
    request<{ preferences: UserPreferences }>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Storage Stats (50 GB)
  getStorageStats: () => request<{ storage: HostingStorageDetails }>('/storage/stats'),

  // Backup & Restore
  exportFullBackup: async () => {
    const token = localStorage.getItem('mmd_chat_token');
    const response = await fetch(`${API_BASE}/backup/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error('Erreur lors du téléchargement de la sauvegarde.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmd-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  importFullBackup: (backupData: any, mode: 'MERGE' | 'REPLACE' = 'MERGE') =>
    request<{ message: string; result: any }>(`/backup/import?mode=${mode}`, {
      method: 'POST',
      body: JSON.stringify(backupData),
    }),

  exportMyData: async () => {
    const token = localStorage.getItem('mmd_chat_token');
    const response = await fetch(`${API_BASE}/users/me/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error('Erreur lors de l\'exportation de vos discussions.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmd-chat-mes-discussions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  importMyData: (data: any) =>
    request<{ message: string; result: any }>('/users/me/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
