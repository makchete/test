import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { BrandingProvider, useBranding } from './context/BrandingContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { FontSizeProvider } from './context/FontSizeContext';
import { LoginForm } from './components/auth/LoginForm';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { Sidebar } from './components/chat/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { CallOverlay } from './components/calls/CallOverlay';
import { ProfileModal } from './components/profile/ProfileModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CallHistoryModal } from './components/calls/CallHistoryModal';
import { NotificationBanner } from './components/common/NotificationBanner';
import { PlaylistProvider } from './context/PlaylistContext';
import { PlaylistPlayer } from './components/audio/PlaylistPlayer';
import { Conversation, Message } from './types';
import { api } from './services/api';
import { notificationService } from './services/notificationService';
import { MessageSquare, Shield, Sparkles } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const { socket } = useSocket();
  const { appName, appLogoUrl } = useBranding();
  const { t } = useLanguage();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'CHAT' | 'ADMIN'>('CHAT');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);

  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Fetch conversations list
  const fetchConversations = async (selectConversationId?: string) => {
    if (!user) return;
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
      // Auto select conversation if requested, or select first if none active on desktop
      if (selectConversationId) {
        setActiveConversationId(selectConversationId);
      } else if (!activeConversationId && res.conversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setActiveConversationId(res.conversations[0].id);
      }
    } catch (err) {
      console.error('Erreur chargement conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user?.id]);

  // Handle custom event to switch to a conversation (from Push Notification click)
  useEffect(() => {
    const handleSelectConversationEvent = (event: any) => {
      const convId = event.detail?.conversationId;
      if (convId) {
        setViewMode('CHAT');
        setActiveConversationId(convId);
        fetchConversations(convId);
      }
    };

    window.addEventListener('mmd:select-conversation', handleSelectConversationEvent);
    return () => {
      window.removeEventListener('mmd:select-conversation', handleSelectConversationEvent);
    };
  }, []);

  // Global socket listener for new messages to trigger browser Push Notifications & multi-device sync
  useEffect(() => {
    if (!socket || !user) return;

    const handleGlobalNewMessage = (msg: Message) => {
      // Multi-device sync: always re-fetch conversations to refresh badge, latest snippet, and order
      fetchConversations();

      // Don't send system push notification if sent by current user
      if (msg.senderId === user.id) return;

      // Determine if we should display a system push notification:
      // When the user is on another conversation OR the window/tab is hidden in background
      const isDifferentConv = activeConversationIdRef.current !== msg.conversationId;
      const isWindowHidden = typeof document !== 'undefined' && document.hidden;

      if (isDifferentConv || isWindowHidden) {
        const senderName = msg.sender
          ? `${msg.sender.firstName} ${msg.sender.lastName}`
          : 'Nouveau message';

        const bodySnippet = notificationService.formatMessageBody(msg);

        notificationService.showNotification({
          title: senderName,
          body: bodySnippet,
          conversationId: msg.conversationId,
          icon: msg.sender?.avatarUrl || '/komechat_logo.jpg',
          onClick: () => {
            setViewMode('CHAT');
            setActiveConversationId(msg.conversationId);
          },
        });
      }
    };

    const handleConversationsRefresh = () => {
      fetchConversations();
    };

    socket.on('message:new', handleGlobalNewMessage);
    socket.on('conversations:refresh', handleConversationsRefresh);
    socket.on('conversation:read', handleConversationsRefresh);
    socket.on('message:deleted', handleConversationsRefresh);
    socket.on('message:updated', handleConversationsRefresh);

    return () => {
      socket.off('message:new', handleGlobalNewMessage);
      socket.off('conversations:refresh', handleConversationsRefresh);
      socket.off('conversation:read', handleConversationsRefresh);
      socket.off('message:deleted', handleConversationsRefresh);
      socket.off('message:updated', handleConversationsRefresh);
    };
  }, [socket, user?.id]);

  // If an activeConversationId is set that does not exist in conversations list, reset it
  useEffect(() => {
    if (activeConversationId && conversations.length > 0 && !conversations.some(c => c.id === activeConversationId)) {
      setActiveConversationId(null);
    }
  }, [conversations, activeConversationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-20 h-20 rounded-3xl p-1.5 bg-white/95 overflow-hidden shadow-xl shadow-blue-500/20 animate-pulse border border-blue-500/30 flex items-center justify-center">
          <img src={appLogoUrl || '/komechat_logo.jpg'} alt={appName} className="w-full h-full object-contain" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          {t.common.loading} {appName}...
        </p>
      </div>
    );
  }

  // Unauthenticated -> Login view
  if (!user) {
    return <LoginForm />;
  }

  // Admin Dashboard view
  if (viewMode === 'ADMIN' && user.role === 'ADMIN') {
    return <AdminDashboard onBackToChat={() => setViewMode('CHAT')} />;
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const isChatOpen = Boolean(activeConversationId && activeConversation);

  return (
    <div className="fixed inset-0 h-full w-full h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Sidebar: visible on desktop, or on mobile when no conversation selected */}
      <div
        className={`${
          isChatOpen ? 'hidden md:flex' : 'flex'
        } w-full md:w-auto h-full shrink-0`}
      >
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onOpenAdmin={() => setViewMode('ADMIN')}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenCallHistory={() => setShowCallHistoryModal(true)}
          onOpenCreateGroup={user.role === 'ADMIN' ? () => setViewMode('ADMIN') : undefined}
          onRefreshConversations={(selectId) => fetchConversations(selectId)}
        />
      </div>

      {/* Main Chat Content Area: visible on desktop, or on mobile when conversation selected */}
      <div
        className={`${
          !isChatOpen ? 'hidden md:flex' : 'flex'
        } flex-1 h-full min-w-0`}
      >
        {activeConversation ? (
          <ChatArea
            conversation={activeConversation}
            onBackToConversations={() => setActiveConversationId(null)}
            onRefreshConversations={fetchConversations}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 bg-slate-950">
            <div className="w-28 h-28 rounded-3xl p-2 bg-white/95 overflow-hidden border border-blue-500/30 shadow-2xl shadow-blue-500/20 flex items-center justify-center">
              <img src={appLogoUrl || '/komechat_logo.jpg'} alt={appName} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t.chat.welcomeTitle} {appName}</h2>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {t.chat.welcomeSubtitle}
              </p>
            </div>
            <button
              onClick={() => setActiveConversationId(null)}
              className="md:hidden mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <span>{t.sidebar.conversations}</span>
            </button>
          </div>
        )}
      </div>

      {/* Real-time WebRTC Audio Call Overlay */}
      <CallOverlay />

      {/* Discreet Push Notification Request Banner */}
      <NotificationBanner />

      {/* Call History Modal */}
      {showCallHistoryModal && (
        <CallHistoryModal onClose={() => setShowCallHistoryModal(false)} />
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {/* MP3 Playlist Player Dock & Full Deck */}
      <PlaylistPlayer conversations={conversations} />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <FontSizeProvider>
        <BrandingProvider>
          <AuthProvider>
            <SocketProvider>
              <CallProvider>
                <PlaylistProvider>
                  <MainApp />
                </PlaylistProvider>
              </CallProvider>
            </SocketProvider>
          </AuthProvider>
        </BrandingProvider>
      </FontSizeProvider>
    </LanguageProvider>
  );
}

