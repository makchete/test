import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Message, UserStatus } from '../types';

interface TypingState {
  [conversationId: string]: {
    userId: string;
    userName: string;
  }[];
}

interface UserPresenceMap {
  [userId: string]: {
    status: UserStatus;
    lastSeenAt: string;
  };
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  userPresenceMap: UserPresenceMap;
  typingState: TypingState;
  sendSocketMessage: (msg: Partial<Message>) => void;
  sendEditMessage: (messageId: string, conversationId: string, content: string) => void;
  sendDeleteMessage: (messageId: string, conversationId: string, forEveryone: boolean) => void;
  sendTyping: (conversationId: string) => void;
  sendStopTyping: (conversationId: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  markRead: (conversationId: string, messageId?: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userPresenceMap, setUserPresenceMap] = useState<UserPresenceMap>({});
  const [typingState, setTypingState] = useState<TypingState>({});
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(window.location.origin, {
      auth: { token },
      query: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connecté avec succès:', newSocket.id);
      setIsConnected(true);
      newSocket.emit('auth:join', { token });

      // Setup heartbeat every 20s
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('presence:heartbeat');
        }
      }, 20000);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Socket.IO connect_error (tentative de reconnexion auto):', err.message);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO déconnecté');
      setIsConnected(false);
    });

    newSocket.on('presence:update', ({ userId, status, lastSeenAt }) => {
      setUserPresenceMap((prev) => ({
        ...prev,
        [userId]: { status, lastSeenAt },
      }));
    });

    newSocket.on('typing:start', ({ conversationId, userId, userName }) => {
      if (userId === user.id) return;
      setTypingState((prev) => {
        const currentList = prev[conversationId] || [];
        if (currentList.some((t) => t.userId === userId)) return prev;
        return {
          ...prev,
          [conversationId]: [...currentList, { userId, userName }],
        };
      });
    });

    newSocket.on('branding:updated', (data) => {
      window.dispatchEvent(new CustomEvent('komechat:branding_updated', { detail: data }));
    });

    newSocket.on('typing:stop', ({ conversationId, userId }) => {
      setTypingState((prev) => {
        const currentList = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: currentList.filter((t) => t.userId !== userId),
        };
      });
    });

    setSocket(newSocket);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      newSocket.disconnect();
    };
  }, [token, user?.id]);

  const sendSocketMessage = (msg: Partial<Message>) => {
    if (socket && isConnected) {
      socket.emit('message:send', msg);
    }
  };

  const sendEditMessage = (messageId: string, conversationId: string, content: string) => {
    if (socket && isConnected) {
      socket.emit('message:edit', { messageId, conversationId, content });
    }
  };

  const sendDeleteMessage = (messageId: string, conversationId: string, forEveryone: boolean) => {
    if (socket && isConnected) {
      socket.emit('message:delete', { messageId, conversationId, forEveryone });
    }
  };

  const sendTyping = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('message:typing', { conversationId });
    }
  };

  const sendStopTyping = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('message:stop-typing', { conversationId });
    }
  };

  const joinConversation = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('conversation:join', { conversationId });
    }
  };

  const leaveConversation = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('conversation:leave', { conversationId });
    }
  };

  const markRead = (conversationId: string, messageId?: string) => {
    if (socket && isConnected) {
      socket.emit('message:read', { conversationId, messageId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        userPresenceMap,
        typingState,
        sendSocketMessage,
        sendEditMessage,
        sendDeleteMessage,
        sendTyping,
        sendStopTyping,
        joinConversation,
        leaveConversation,
        markRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
