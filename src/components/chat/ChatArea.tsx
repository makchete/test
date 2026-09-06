import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import { api } from '../../services/api';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { MediaGalleryDrawer } from './MediaGalleryDrawer';
import { GroupInfoModal } from './GroupInfoModal';
import { ForwardModal } from './ForwardModal';
import {
  Phone,
  Video as VideoIcon,
  FolderOpen,
  ArrowLeft,
  Circle,
  MoreVertical,
  ShieldAlert,
  Users,
  Info,
  Music,
  Check,
} from 'lucide-react';
import { usePlaylist } from '../../context/PlaylistContext';

interface ChatAreaProps {
  conversation: Conversation;
  onBackToConversations: () => void;
  onRefreshConversations: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  onBackToConversations,
  onRefreshConversations,
}) => {
  const { user } = useAuth();
  const { socket, userPresenceMap, typingState, joinConversation, leaveConversation, markRead } = useSocket();
  const { initiateCall, initiateGroupCall } = useCall();
  const { isPlaying, setIsPlayerOpen } = usePlaylist();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleSaveMessage = async (msg: Message) => {
    try {
      if (msg.file?.url) {
        const fileName = msg.file.originalName || 'fichier_enregistre';
        try {
          const res = await fetch(msg.file.url);
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          const a = document.createElement('a');
          a.href = msg.file.url;
          a.download = fileName;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        showToast(`Fichier "${fileName}" enregistré avec succès !`);
      } else if (msg.content) {
        const dateStr = new Date(msg.createdAt).toISOString().slice(0, 10);
        const sender = msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` : 'KomeChat';
        const textContent = `Message KomeChat\nExpéditeur : ${sender}\nDate : ${new Date(msg.createdAt).toLocaleString()}\n\n${msg.content}`;
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `komechat_message_${dateStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);

        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(msg.content);
          }
        } catch {}

        showToast('Message enregistré dans vos téléchargements !');
      }
    } catch (err) {
      console.error('Erreur enregistrement:', err);
      showToast('Impossible d\'enregistrer ce message');
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isGroup = conversation.type === 'GROUP';
  const otherUser = conversation.otherUser;
  const displayName = isGroup
    ? (conversation.name || 'Discussion de groupe')
    : otherUser
    ? `${otherUser.firstName} ${otherUser.lastName}`
    : 'Discussion';

  // Online status for direct chat
  const realTimePresence = otherUser ? userPresenceMap[otherUser.id] : null;
  const isOnline = realTimePresence
    ? realTimePresence.status === 'ONLINE'
    : otherUser?.status === 'ONLINE';

  const lastSeenText = realTimePresence?.lastSeenAt || otherUser?.lastSeenAt;

  // Load conversation messages
  const fetchMessages = async () => {
    try {
      const res = await api.getConversationMessages(conversation.id, 100);
      setMessages(res.messages);
      // Mark read
      if (res.messages.length > 0) {
        const last = res.messages[res.messages.length - 1];
        markRead(conversation.id, last.id);
      }
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    setEditingMessage(null);
    setReplyingTo(null);
    joinConversation(conversation.id);

    return () => {
      leaveConversation(conversation.id);
    };
  }, [conversation.id]);

  // Listen to new real-time messages and updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markRead(conversation.id, msg.id);
        onRefreshConversations();
      }
    };

    const handleMessageUpdated = (data: { messageId: string; conversationId: string; content: string; isEdited: boolean }) => {
      if (data.conversationId === conversation.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, content: data.content, isEdited: true, updatedAt: new Date().toISOString() }
              : m
          )
        );
      }
    };

    const handleMessageDeleted = (data: { messageId: string; conversationId: string; forEveryone?: boolean; deletedForUserId?: string }) => {
      if (data.conversationId === conversation.id) {
        if (data.forEveryone === false) {
          setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId
                ? { ...m, content: 'Ce message a été supprimé.', deletedAt: new Date().toISOString() }
                : m
            )
          );
        }
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:deleted', handleMessageDeleted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:deleted', handleMessageDeleted);
    };
  }, [socket, conversation.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleDeleteForMe = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId, false);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    try {
      await api.deleteMessage(messageId, true);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: 'Ce message a été supprimé.', deletedAt: new Date().toISOString() } : m))
      );
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  const handleInitiateAudioCall = () => {
    if (otherUser) {
      initiateCall(conversation.id, otherUser, 'AUDIO');
    }
  };

  const handleInitiateVideoCall = () => {
    if (otherUser) {
      initiateCall(conversation.id, otherUser, 'VIDEO');
    }
  };

  const handleCallBack = (targetUserId: string, isGroupCall?: boolean, mode: 'AUDIO' | 'VIDEO' = 'AUDIO') => {
    if (isGroupCall || isGroup) {
      initiateGroupCall(conversation, mode);
    } else if (otherUser) {
      initiateCall(conversation.id, otherUser, mode);
    } else {
      const member = conversation.members?.find((m) => m.userId === targetUserId);
      if (member?.user) {
        initiateCall(conversation.id, member.user, mode);
      }
    }
  };

  const activeTypers = typingState[conversation.id] || [];

  return (
    <div className="flex-1 flex bg-slate-950 h-full w-full relative overflow-hidden">
      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden relative">
        {/* Chat Header (Cross-browser safe top header) */}
        <div className="safe-top px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md flex items-center justify-between z-20 shrink-0 w-full min-h-[58px] shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-2">
            {/* Mobile Back Button */}
            <button
              onClick={onBackToConversations}
              className="md:hidden p-2 -ml-1 rounded-xl text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 cursor-pointer shrink-0"
              title="Retour aux discussions"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Target Avatar / Group Icon */}
            <div className="relative shrink-0">
              {isGroup ? (
                <div
                  onClick={() => setShowGroupModal(true)}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-500/40 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20 cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden"
                >
                  {conversation.avatarUrl ? (
                    <img
                      src={conversation.avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-5 h-5 text-white" />
                  )}
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center font-bold text-slate-200 text-sm">
                    {otherUser?.avatarUrl ? (
                      <img src={otherUser.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{displayName.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                      isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  />
                </>
              )}
            </div>

            <div
              className={`min-w-0 flex-1 ${isGroup ? 'cursor-pointer' : ''}`}
              onClick={isGroup ? () => setShowGroupModal(true) : undefined}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate leading-tight">{displayName}</h2>
                {isGroup && (
                  <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold rounded-md shrink-0">
                    Groupe
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                {isGroup ? (
                  <span className="text-indigo-300/80 hover:text-indigo-300 transition-colors flex items-center gap-1">
                    <span>{conversation.members?.length || 0} membres</span>
                    <span>• Gérer & infos</span>
                  </span>
                ) : isOnline ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    En ligne
                  </span>
                ) : (
                  <span>
                    Dernière connexion{' '}
                    {lastSeenText
                      ? new Date(lastSeenText).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'récemment'}
                  </span>
                )}
                {otherUser?.statusMessage && (
                  <span className="text-slate-500 truncate hidden sm:inline">
                    • {otherUser.statusMessage}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Audio Call, Video Call, Gallery */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {isGroup ? (
              <>
                <button
                  onClick={() => initiateGroupCall(conversation, 'AUDIO')}
                  title="Lancer un appel vocal de groupe"
                  className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold hidden md:inline">Vocal</span>
                </button>
                <button
                  onClick={() => initiateGroupCall(conversation, 'VIDEO')}
                  title="Lancer un appel vidéo de groupe"
                  className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <VideoIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold hidden md:inline">Vidéo</span>
                </button>
                <button
                  onClick={() => setShowGroupModal(true)}
                  title="Informations et membres du groupe"
                  className="p-2 sm:p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 transition-colors cursor-pointer"
                >
                  <Info className="w-4 h-4" />
                </button>
              </>
            ) : otherUser ? (
              <>
                <button
                  onClick={handleInitiateAudioCall}
                  title="Lancer un appel vocal WebRTC"
                  className="p-2 sm:p-2.5 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 hover:border-emerald-400/40 transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={handleInitiateVideoCall}
                  title="Lancer un appel vidéo HD WebRTC"
                  className="p-2 sm:p-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25 hover:border-blue-400/40 transition-colors cursor-pointer"
                >
                  <VideoIcon className="w-4 h-4" />
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => setIsPlayerOpen(true)}
              title="Playlist MP3 & Lecteur audio"
              className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isPlaying
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Music className={`w-4 h-4 text-emerald-400 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Musique</span>
            </button>

            <button
              onClick={() => setShowGallery(!showGallery)}
              title="Galerie des médias et fichiers"
              className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                showGallery
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Galerie</span>
            </button>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Chargement des messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                {isGroup ? <Users className="w-6 h-6 text-indigo-400" /> : <Phone className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  {isGroup ? 'Groupe de discussion' : 'Commencez la discussion'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Les messages, fichiers et vocaux sont synchronisés de manière privée et sécurisée en temps réel.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onReply={(m) => setReplyingTo(m)}
                onEdit={(m) => setEditingMessage(m)}
                onForward={(m) => setForwardingMessage(m)}
                onSave={(m) => handleSaveMessage(m)}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForEveryone={handleDeleteForEveryone}
                onCallBack={handleCallBack}
              />
            ))
          )}

          {/* Typing Indicator Banner */}
          {activeTypers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-400 italic py-1 px-2 animate-pulse">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>
                {activeTypers.map((t) => t.userName).join(', ')} est en train d'écrire...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <MessageInput
          conversationId={conversation.id}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onMessageSent={fetchMessages}
        />
      </div>

      {/* Side Media Gallery Drawer */}
      {showGallery && (
        <MediaGalleryDrawer
          conversationId={conversation.id}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* Group Info Modal */}
      {showGroupModal && (
        <GroupInfoModal
          conversationId={conversation.id}
          onClose={() => setShowGroupModal(false)}
          onGroupUpdated={() => {
            onRefreshConversations();
            fetchMessages();
          }}
        />
      )}

      {/* Forward to Contact or Group Modal */}
      <ForwardModal
        isOpen={Boolean(forwardingMessage)}
        message={forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        onForwardSuccess={(targetName) => {
          showToast(`Message transféré avec succès à ${targetName} !`);
        }}
        onRefreshConversations={onRefreshConversations}
      />

      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
