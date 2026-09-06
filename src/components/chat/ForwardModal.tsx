import React, { useState, useEffect } from 'react';
import { Message, Conversation, User, FileAttachment } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  X,
  Forward,
  Search,
  Check,
  Users,
  User as UserIcon,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface ForwardModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onForwardSuccess?: (targetName: string) => void;
  onRefreshConversations?: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  message,
  isOpen,
  onClose,
  onForwardSuccess,
  onRefreshConversations,
}) => {
  const { user } = useAuth();
  const { userPresenceMap } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [forwardingIds, setForwardingIds] = useState<Set<string>>(new Set());
  const [forwardedIds, setForwardedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load conversations and users when modal opens
  useEffect(() => {
    if (!isOpen || !message) {
      setSearchQuery('');
      setForwardingIds(new Set());
      setForwardedIds(new Set());
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadTargets = async () => {
      try {
        const [convRes, usersRes] = await Promise.all([
          api.getConversations().catch(() => ({ conversations: [] })),
          api.getUsers().catch(() => ({ users: [] })),
        ]);

        if (isMounted) {
          setConversations(convRes.conversations || []);
          // Filter out current user from contacts list
          setUsers((usersRes.users || []).filter((u) => u.id !== user?.id && u.isActive));
        }
      } catch (err) {
        console.error('Erreur chargement contacts pour transfert:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTargets();

    return () => {
      isMounted = false;
    };
  }, [isOpen, message, user?.id]);

  if (!isOpen || !message) return null;

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Perform forward to an existing conversation
  const handleForwardToConversation = async (conv: Conversation) => {
    const targetId = `conv_${conv.id}`;
    if (forwardingIds.has(targetId) || forwardedIds.has(targetId)) return;

    setForwardingIds((prev) => new Set(prev).add(targetId));
    setErrorMsg(null);

    const targetName = conv.type === 'GROUP'
      ? (conv.name || 'Groupe')
      : conv.otherUser
      ? `${conv.otherUser.firstName} ${conv.otherUser.lastName}`
      : 'Contact';

    try {
      await api.sendMessage({
        conversationId: conv.id,
        content: message.content || undefined,
        type: message.type,
        fileId: message.file?.id,
        file: message.file || null,
      });

      setForwardedIds((prev) => new Set(prev).add(targetId));
      onForwardSuccess?.(targetName);
      onRefreshConversations?.();
    } catch (err: any) {
      console.error('Erreur lors du transfert:', err);
      setErrorMsg(err.message || 'Échec du transfert');
    } finally {
      setForwardingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  // Perform forward to a user (get or create conversation first)
  const handleForwardToUser = async (targetUser: User) => {
    const targetId = `user_${targetUser.id}`;
    if (forwardingIds.has(targetId) || forwardedIds.has(targetId)) return;

    setForwardingIds((prev) => new Set(prev).add(targetId));
    setErrorMsg(null);

    const targetName = `${targetUser.firstName} ${targetUser.lastName}`;

    try {
      // Find existing direct conversation or create one
      const existingConv = conversations.find(
        (c) => c.type === 'DIRECT' && c.otherUser?.id === targetUser.id
      );

      let convId = existingConv ? existingConv.id : '';
      if (!convId) {
        const res = await api.getOrCreateDirectConversation(targetUser.id);
        convId = res.conversation.id;
      }

      await api.sendMessage({
        conversationId: convId,
        content: message.content || undefined,
        type: message.type,
        fileId: message.file?.id,
        file: message.file || null,
      });

      setForwardedIds((prev) => new Set(prev).add(targetId));
      onForwardSuccess?.(targetName);
      onRefreshConversations?.();
    } catch (err: any) {
      console.error('Erreur lors du transfert vers utilisateur:', err);
      setErrorMsg(err.message || 'Échec du transfert');
    } finally {
      setForwardingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  // Build unified items: conversations first, then contacts that don't have an active conversation
  const query = searchQuery.toLowerCase().trim();

  const convUserIds = new Set(
    conversations
      .filter((c) => c.type === 'DIRECT' && c.otherUser)
      .map((c) => c.otherUser!.id)
  );

  const filteredConversations = conversations.filter((c) => {
    if (!query) return true;
    if (c.type === 'GROUP') {
      return (c.name || '').toLowerCase().includes(query);
    }
    if (c.otherUser) {
      const name = `${c.otherUser.firstName} ${c.otherUser.lastName}`.toLowerCase();
      const phone = c.otherUser.phone.toLowerCase();
      return name.includes(query) || phone.includes(query);
    }
    return false;
  });

  const otherContacts = users.filter((u) => {
    if (convUserIds.has(u.id)) return false; // already represented in conversations
    if (!query) return true;
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    const phone = u.phone.toLowerCase();
    return name.includes(query) || phone.includes(query);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Forward className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Transférer le message</h2>
              <p className="text-xs text-slate-400">Sélectionnez un contact ou un groupe</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Preview Box */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>Aperçu du contenu à transférer</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            {message.file ? (
              <>
                <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                  {message.type === 'IMAGE' ? (
                    <ImageIcon className="w-5 h-5" />
                  ) : message.type === 'VIDEO' ? (
                    <Film className="w-5 h-5" />
                  ) : message.type === 'AUDIO' ? (
                    <Music className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {message.file.originalName || 'Fichier joint'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {message.type} {message.file.size > 0 ? `• ${formatFileSize(message.file.size)}` : ''}
                  </div>
                  {message.content && (
                    <div className="text-xs text-slate-300 mt-1 line-clamp-2 italic">
                      "{message.content}"
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-200 italic line-clamp-3 leading-relaxed">
                "{message.content}"
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un contact, un groupe ou un numéro..."
              className="w-full bg-slate-800/90 text-xs text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-8 py-2.5 border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contacts & Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-800/40">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Chargement de vos contacts...</span>
            </div>
          ) : filteredConversations.length === 0 && otherContacts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aucun contact trouvé pour "{searchQuery}".
            </div>
          ) : (
            <>
              {/* Existing Conversations / Groups */}
              {filteredConversations.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Discussions récentes & Groupes
                  </div>
                  {filteredConversations.map((conv) => {
                    const isGroup = conv.type === 'GROUP';
                    const targetId = `conv_${conv.id}`;
                    const isForwarding = forwardingIds.has(targetId);
                    const isForwarded = forwardedIds.has(targetId);
                    const isOnline = !isGroup && conv.otherUser && userPresenceMap[conv.otherUser.id]?.status === 'ONLINE';

                    const title = isGroup
                      ? (conv.name || 'Groupe')
                      : conv.otherUser
                      ? `${conv.otherUser.firstName} ${conv.otherUser.lastName}`
                      : 'Discussion';

                    const subtitle = isGroup
                      ? `${conv.members?.length || 0} membres`
                      : conv.otherUser?.phone || '';

                    return (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                              {isGroup ? (
                                <Users className="w-5 h-5 text-indigo-400" />
                              ) : conv.otherUser?.avatarUrl ? (
                                <img
                                  src={conv.otherUser.avatarUrl}
                                  alt={title}
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                <span className="text-xs">
                                  {title.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-100 truncate flex items-center gap-1.5">
                              <span>{title}</span>
                              {isGroup && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                                  Groupe
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{subtitle}</div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="shrink-0 ml-2">
                          {isForwarded ? (
                            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Transféré</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isForwarding}
                              onClick={() => handleForwardToConversation(conv)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isForwarding ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Envoi...</span>
                                </>
                              ) : (
                                <>
                                  <Forward className="w-3.5 h-3.5" />
                                  <span>Transférer</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Other Contacts */}
              {otherContacts.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Autres contacts
                  </div>
                  {otherContacts.map((contact) => {
                    const targetId = `user_${contact.id}`;
                    const isForwarding = forwardingIds.has(targetId);
                    const isForwarded = forwardedIds.has(targetId);
                    const isOnline = userPresenceMap[contact.id]?.status === 'ONLINE';
                    const name = `${contact.firstName} ${contact.lastName}`;

                    return (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                              {contact.avatarUrl ? (
                                <img
                                  src={contact.avatarUrl}
                                  alt={name}
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                <span className="text-xs">
                                  {name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-100 truncate">
                              {name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{contact.phone}</div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="shrink-0 ml-2">
                          {isForwarded ? (
                            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Transféré</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isForwarding}
                              onClick={() => handleForwardToUser(contact)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isForwarding ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Envoi...</span>
                                </>
                              ) : (
                                <>
                                  <Forward className="w-3.5 h-3.5" />
                                  <span>Transférer</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {forwardedIds.size > 0
              ? `${forwardedIds.size} ${forwardedIds.size === 1 ? 'contact a reçu' : 'contacts ont reçu'} le message`
              : 'Choisissez un ou plusieurs destinataires'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            {forwardedIds.size > 0 ? 'Terminé' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
};
