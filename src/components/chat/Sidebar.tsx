import React, { useState, useEffect } from 'react';
import { Conversation, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useBranding } from '../../context/BrandingContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { api } from '../../services/api';
import {
  Search,
  MessageSquarePlus,
  Shield,
  Settings,
  LogOut,
  Image,
  Video,
  FileText,
  Archive,
  User as UserIcon,
  Circle,
  X,
  PhoneCall,
  Sparkles,
  UserCheck,
  UserX,
  Clock,
  FolderPlus,
  Users,
  Music,
} from 'lucide-react';
import { usePlaylist } from '../../context/PlaylistContext';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onOpenAdmin: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenCallHistory?: () => void;
  onOpenCreateGroup?: () => void;
  onRefreshConversations: (selectId?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenAdmin,
  onOpenSettings,
  onOpenProfile,
  onOpenCallHistory,
  onOpenCreateGroup,
  onRefreshConversations,
}) => {
  const { user, logout } = useAuth();
  const { isConnected, userPresenceMap, typingState } = useSocket();
  const { appName, appLogoUrl } = useBranding();
  const { t } = useLanguage();
  const { tracks, isPlaying, setIsPlayerOpen } = usePlaylist();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [phoneSearchQuery, setPhoneSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    if (c.otherUser) {
      const name = `${c.otherUser.firstName} ${c.otherUser.lastName}`.toLowerCase();
      const phone = c.otherUser.phone.replaceAll(' ', '');
      return name.includes(q) || phone.includes(q);
    }
    return c.name?.toLowerCase().includes(q);
  });

  // Load active users when opening new chat modal
  const handleOpenNewChat = async (initialQuery: any = '') => {
    const queryStr = typeof initialQuery === 'string' ? initialQuery : '';
    setShowNewChatModal(true);
    setPhoneSearchQuery(queryStr);
    setLoadingUsers(true);
    try {
      const res = await api.getUsers();
      setAvailableUsers(res.users);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartConversation = async (targetUserId: string) => {
    try {
      setLoadingUsers(true);
      const res = await api.getOrCreateDirectConversation(targetUserId);
      setShowNewChatModal(false);
      setPhoneSearchQuery('');
      onRefreshConversations(res.conversation.id);
    } catch (err) {
      console.error('Erreur création conversation:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Filter users by strict COMPLETE phone search query in the modal
  const normalizeDigits = (str: string) => str.replace(/\D/g, '');
  const normalizePhone = (str: string) => str.trim().toLowerCase().replace(/[\s\-\.\(\)]/g, '');

  const cleanPhoneQuery = normalizePhone(phoneSearchQuery);
  const queryDigits = normalizeDigits(phoneSearchQuery);
  const isPhoneComplete = queryDigits.length >= 8;

  const matchedUsers = !isPhoneComplete
    ? []
    : availableUsers.filter((u) => {
        const uPhoneClean = normalizePhone(u.phone);
        const uPhoneDigits = normalizeDigits(u.phone);

        // Exact match with country code or full national digits
        if (uPhoneClean === cleanPhoneQuery) return true;
        if (uPhoneDigits === queryDigits) return true;

        // Exact full national suffix match (e.g. contact +228 90 00 00 00 and entered full 8 digits 90000000)
        if (queryDigits.length >= 8 && uPhoneDigits.endsWith(queryDigits) && uPhoneDigits.length - queryDigits.length <= 4) {
          return true;
        }

        return false;
      });

  // Format last message content
  const renderLastMessageSnippet = (conv: Conversation) => {
    const isTyping = typingState[conv.id] && typingState[conv.id].length > 0;
    if (isTyping) {
      return (
        <span className="text-blue-400 italic text-xs flex items-center gap-1 font-medium">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
          écrit un message...
        </span>
      );
    }

    const msg = conv.lastMessage;
    if (!msg) return <span className="text-slate-500 italic text-xs">Aucun message</span>;

    if (msg.type === 'IMAGE') {
      return (
        <span className="flex items-center gap-1 text-slate-400 text-xs">
          <Image className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Photo
        </span>
      );
    }
    if (msg.type === 'VIDEO') {
      return (
        <span className="flex items-center gap-1 text-slate-400 text-xs">
          <Video className="w-3.5 h-3.5 text-purple-400 shrink-0" /> Vidéo
        </span>
      );
    }
    if (msg.type === 'AUDIO') {
      return (
        <span className="flex items-center gap-1 text-slate-400 text-xs">
          <PhoneCall className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Vocal
        </span>
      );
    }
    if (msg.type === 'FILE') {
      return (
        <span className="flex items-center gap-1 text-slate-400 text-xs">
          <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Fichier
        </span>
      );
    }
    if (msg.type === 'CALL_LOG' || msg.callLog) {
      const isVid = msg.callLog?.callMode === 'VIDEO' || msg.callLog?.isVideo;
      return (
        <span className="flex items-center gap-1 text-slate-400 text-xs truncate">
          {isVid ? (
            <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <PhoneCall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{msg.content || (isVid ? 'Appel vidéo' : 'Appel vocal')}</span>
        </span>
      );
    }

    return (
      <span className="truncate text-slate-400 text-xs block max-w-[180px]">
        {msg.content}
      </span>
    );
  };

  // Helper for status dot
  const getOnlineStatus = (targetUser?: User) => {
    if (!targetUser) return false;
    const realTime = userPresenceMap[targetUser.id];
    if (realTime) return realTime.status === 'ONLINE';
    return targetUser.status === 'ONLINE';
  };

  return (
    <div className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none overflow-hidden">
      {/* Top Header */}
      <div className="safe-top px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0 min-h-[58px]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/95 border border-blue-500/30 p-0.5 overflow-hidden flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <img src={appLogoUrl || '/komechat_logo.jpg'} alt={appName} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide">{appName}</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span>{isConnected ? t.chat.online : t.common.loading}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Language Switcher */}
          <LanguageSelector variant="dropdown" />

          {/* Settings & Alerts quick button */}
          <button
            onClick={onOpenSettings}
            title={t.sidebar.settings}
            className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Call History Button */}
          {onOpenCallHistory && (
            <button
              onClick={onOpenCallHistory}
              title={t.sidebar.callHistory}
              className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4" />
            </button>
          )}

          {/* MP3 Playlist & Audio Player Button */}
          <button
            type="button"
            onClick={() => setIsPlayerOpen(true)}
            title="Playlist MP3 & Lecteur Audio"
            className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
              isPlaying
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-emerald-400'
            }`}
          >
            <Music className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />
            {tracks.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 bg-emerald-500 text-slate-950 font-mono font-extrabold text-[8px] rounded-full min-w-[14px] text-center leading-tight">
                {tracks.length}
              </span>
            )}
          </button>

          {/* Admin Create Group Button (Admin only) */}
          {user?.role === 'ADMIN' && onOpenCreateGroup && (
            <button
              onClick={onOpenCreateGroup}
              title="Créer un groupe de discussion (Admin)"
              className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 text-indigo-400 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          )}

          {/* New Chat Button */}
          <button
            onClick={() => handleOpenNewChat('')}
            title={t.sidebar.newChat}
            className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-800/50">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.sidebar.searchPlaceholder}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/30 p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs px-4 space-y-2">
            <p>{t.sidebar.noConversations}</p>
            <button
              onClick={() => handleOpenNewChat('')}
              className="text-blue-400 font-medium hover:underline cursor-pointer"
            >
              + {t.sidebar.newChat}
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isGroup = conv.type === 'GROUP';
            const otherUser = conv.otherUser;
            const isOnline = getOnlineStatus(otherUser);
            const displayName = isGroup
              ? (conv.name || 'Groupe sans nom')
              : otherUser
              ? `${otherUser.firstName} ${otherUser.lastName}`
              : 'Conversation';

            const unread = conv.unreadCount || 0;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                  isActive
                    ? isGroup
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                      : 'bg-blue-600/15 border border-blue-500/30 text-white'
                    : 'hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                {/* Avatar with Status Dot / Group Icon */}
                <div className="relative shrink-0">
                  {isGroup ? (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-500/40 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20 overflow-hidden">
                      {conv.avatarUrl ? (
                        <img
                          src={conv.avatarUrl}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-white" />
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center font-bold text-slate-300">
                        {otherUser?.avatarUrl ? (
                          <img
                            src={otherUser.avatarUrl}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{displayName.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      />
                    </>
                  )}
                </div>

                {/* Content Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <h3 className="text-xs font-semibold text-slate-100 truncate">
                        {displayName}
                      </h3>
                      {isGroup && (
                        <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold rounded-md shrink-0">
                          Groupe
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {conv.lastMessageAt
                        ? new Date(conv.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    {renderLastMessageSnippet(conv)}
                    {unread > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white font-bold text-[10px] rounded-full shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-2">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 flex-1 min-w-0 p-1.5 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-slate-200">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover" />
            ) : (
              <span>{user?.firstName?.slice(0, 1)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-200 truncate">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{user?.phone}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {user?.role === 'ADMIN' && (
            <button
              onClick={onOpenAdmin}
              title={t.sidebar.admin}
              className="p-2 rounded-xl hover:bg-slate-800 text-amber-400 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenSettings}
            title={t.sidebar.settings}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={logout}
            title={t.sidebar.logout}
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal New Conversation */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-blue-400" />
                  {t.sidebar.searchPhone}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Saisissez le numéro de téléphone ajouté par l'administrateur.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setPhoneSearchQuery('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Phone search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phoneSearchQuery}
                onChange={(e) => setPhoneSearchQuery(e.target.value)}
                placeholder="Entrez le numéro (ex: +228 90 00 00 00)..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 pl-9 pr-9 text-xs text-white placeholder-slate-500 outline-none transition-all"
                autoFocus
              />
              {phoneSearchQuery && (
                <button
                  onClick={() => setPhoneSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results list or prompts */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {loadingUsers ? (
                <div className="py-8 text-center text-xs text-slate-500">Recherche dans l'annuaire sécurisé...</div>
              ) : !cleanPhoneQuery ? (
                <div className="py-8 px-4 text-center border border-slate-800/80 rounded-2xl bg-slate-950/50 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">Recherche par numéro complet</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Pour garantir la confidentialité de l'annuaire, saisissez le <strong>numéro complet</strong> de la personne (ex: +228 90 00 00 00).
                  </p>
                </div>
              ) : !isPhoneComplete ? (
                <div className="py-8 px-4 text-center border border-blue-500/20 rounded-2xl bg-blue-500/5 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Search className="w-5 h-5 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">Numéro incomplet</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Veuillez continuer la saisie du numéro au complet pour afficher le contact.
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-mono">
                    <span>{queryDigits.length} / 8 chiffres minimum</span>
                  </div>
                </div>
              ) : matchedUsers.length === 0 ? (
                <div className="py-8 px-4 text-center border border-amber-500/20 rounded-2xl bg-amber-500/5 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <UserX className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">Aucun membre trouvé</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Aucun membre inscrit ne correspond au numéro complet <span className="font-mono text-amber-300">"{phoneSearchQuery}"</span>.
                    Vérifiez que le numéro a été correctement créé par l'administrateur.
                  </p>
                </div>
              ) : (
                matchedUsers.map((u) => {
                  const isOnline = getOnlineStatus(u);
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleStartConversation(u.id)}
                      className="p-3 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:bg-blue-600/10 flex items-center justify-between cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-200">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt={u.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{u.firstName.slice(0, 1)}</span>
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                            {u.firstName} {u.lastName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.phone}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        Discuter
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
