import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from './db.js';
import { verifyToken } from './auth.js';
import { Message } from '../src/types.js';

interface SocketData {
  userId?: string;
  phone?: string;
}

// Map user ID to active socket IDs
const activeUserSockets = new Map<string, Set<string>>();
export let ioInstance: SocketIOServer | null = null;

// Module-level active calls tracking map shared across all sockets and devices
const activeCallsMap = new Map<string, {
  callId: string;
  callerId: string;
  receiverId: string;
  conversationId?: string;
  mode: 'AUDIO' | 'VIDEO';
}>();

export function joinUserToConversation(userId: string, conversationId: string) {
  if (!ioInstance) return;
  const sockets = activeUserSockets.get(userId);
  if (sockets) {
    for (const sId of sockets) {
      const s = ioInstance.sockets.sockets.get(sId);
      if (s) s.join(`conversation:${conversationId}`);
    }
  }
}

export function broadcastConversationCreated(conversation: any, memberIds: string[]) {
  if (!ioInstance) return;
  for (const uid of memberIds) {
    joinUserToConversation(uid, conversation.id);
    ioInstance.to(`user:${uid}`).emit('conversations:refresh', { conversationId: conversation.id });
  }
}

export function broadcastSystemMessage(message: Message) {
  if (!ioInstance) return;
  ioInstance.to(`conversation:${message.conversationId}`).emit('message:new', message);
}

export function broadcastUserUpdated(user: any) {
  if (!ioInstance) return;
  ioInstance.emit('user:updated', { user });
}

export function broadcastBrandingUpdated(settings: any) {
  if (!ioInstance) return;
  ioInstance.emit('branding:updated', {
    appName: settings.appName || 'KOMECHAT',
    appLogoUrl: settings.appLogoUrl || '/komechat_logo.jpg',
  });
}

export function setupSocketServer(io: SocketIOServer) {
  ioInstance = io;
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      const payload = verifyToken(String(token));
      if (payload) {
        socket.data.userId = payload.userId;
        socket.data.phone = payload.phone;
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;

    if (userId) {
      // Register socket
      if (!activeUserSockets.has(userId)) {
        activeUserSockets.set(userId, new Set());
      }
      activeUserSockets.get(userId)!.add(socket.id);

      // Join user room
      socket.join(`user:${userId}`);

      // Auto-join all conversation rooms for this user
      try {
        const userConvs = db.getConversationsForUser(userId);
        for (const conv of userConvs) {
          socket.join(`conversation:${conv.id}`);
        }
      } catch (err) {
        console.error('Error auto-joining conversation rooms:', err);
      }

      // Mark user online
      db.updateUser(userId, {
        status: 'ONLINE',
        lastSeenAt: new Date().toISOString(),
      });

      // Broadcast presence update
      io.emit('presence:update', {
        userId,
        status: 'ONLINE',
        lastSeenAt: new Date().toISOString(),
      });
    }

    // Manual join handler (if client connects without auth token in handshake)
    socket.on('auth:join', ({ token }) => {
      const payload = verifyToken(token);
      if (payload) {
        socket.data.userId = payload.userId;
        socket.data.phone = payload.phone;

        if (!activeUserSockets.has(payload.userId)) {
          activeUserSockets.set(payload.userId, new Set());
        }
        activeUserSockets.get(payload.userId)!.add(socket.id);

        socket.join(`user:${payload.userId}`);

        // Auto-join all conversation rooms for this user
        try {
          const userConvs = db.getConversationsForUser(payload.userId);
          for (const conv of userConvs) {
            socket.join(`conversation:${conv.id}`);
          }
        } catch (err) {
          console.error('Error auto-joining conversation rooms:', err);
        }

        db.updateUser(payload.userId, {
          status: 'ONLINE',
          lastSeenAt: new Date().toISOString(),
        });

        io.emit('presence:update', {
          userId: payload.userId,
          status: 'ONLINE',
          lastSeenAt: new Date().toISOString(),
        });
      }
    });

    // Heartbeat
    socket.on('presence:heartbeat', () => {
      const currentUserId = socket.data.userId;
      if (currentUserId) {
        db.updateUser(currentUserId, {
          status: 'ONLINE',
          lastSeenAt: new Date().toISOString(),
        });
      }
    });

    // Join conversation room
    socket.on('conversation:join', ({ conversationId }) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    // Leave conversation room
    socket.on('conversation:leave', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Typing indicators
    socket.on('message:typing', ({ conversationId }) => {
      const currentUserId = socket.data.userId;
      if (currentUserId && conversationId) {
        const user = db.getUserById(currentUserId);
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          userId: currentUserId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Quelqu\'un',
        });
      }
    });

    socket.on('message:stop-typing', ({ conversationId }) => {
      const currentUserId = socket.data.userId;
      if (currentUserId && conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId: currentUserId,
        });
      }
    });

    // Message send via socket
    socket.on('message:send', (msgData: Partial<Message> & { file?: any; fileId?: string }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !msgData.conversationId) return;

      const conversation = db.getConversationById(msgData.conversationId);
      if (!conversation) return;

      const now = new Date().toISOString();
      const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      let fileObj: any = null;
      const fId = msgData.fileId || msgData.file?.id;
      if (fId) {
        fileObj = db.getFileById(fId) || null;
        if (fileObj) {
          fileObj.messageId = messageId;
        }
      } else if (msgData.file) {
        fileObj = {
          ...msgData.file,
          messageId,
        };
        db.createFileAttachment(fileObj);
      }

      const msgType = msgData.type || (fileObj ? (fileObj.mimeType?.startsWith('audio/') ? 'AUDIO' : fileObj.mimeType?.startsWith('image/') ? 'IMAGE' : fileObj.mimeType?.startsWith('video/') ? 'VIDEO' : 'FILE') : 'TEXT');

      const newMsg: Message = {
        id: messageId,
        conversationId: msgData.conversationId,
        senderId: currentUserId,
        content: msgData.content || '',
        type: msgType,
        replyToId: msgData.replyToId || null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        file: fileObj,
      };

      db.createMessage(newMsg);
      db.updateMessageStatus(messageId, currentUserId, 'READ');

      const fullMessage = db
        .getMessagesForConversation(msgData.conversationId, currentUserId, 500)
        .find((m) => m.id === messageId) || newMsg;

      // Broadcast to conversation room & members
      io.to(`conversation:${msgData.conversationId}`).emit('message:new', fullMessage);

      // Multi-device sync: send to ALL conversation members (including all devices of the sender)
      for (const mem of conversation.members) {
        io.to(`user:${mem.userId}`).emit('message:new', fullMessage);
        if (mem.userId !== currentUserId) {
          io.to(`user:${mem.userId}`).emit('notification:new', {
            title: fullMessage.sender ? `${fullMessage.sender.firstName} ${fullMessage.sender.lastName}` : 'Nouveau message',
            body: fullMessage.type === 'TEXT' ? fullMessage.content : `[${fullMessage.type}]`,
            conversationId: msgData.conversationId,
          });
        }
      }
    });

    // Mark messages as read
    socket.on('message:read', ({ conversationId, messageId }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !conversationId) return;

      if (messageId) {
        db.markConversationAsRead(conversationId, currentUserId, messageId);
      } else {
        const msgs = db.getMessagesForConversation(conversationId, currentUserId, 1);
        if (msgs.length > 0) {
          db.markConversationAsRead(conversationId, currentUserId, msgs[0].id);
        }
      }

      io.to(`conversation:${conversationId}`).emit('message:read', {
        conversationId,
        userId: currentUserId,
        messageId,
      });

      // Multi-device sync: notify other devices/tabs of this user that conversation was read
      io.to(`user:${currentUserId}`).emit('conversation:read', {
        conversationId,
        userId: currentUserId,
        messageId,
      });
    });

    // Edit message via Socket
    socket.on('message:edit', ({ messageId, conversationId, content }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !messageId || !content || !content.trim()) return;

      const existing = db.getMessageById(messageId);
      if (!existing) return;

      const user = db.getUserById(currentUserId);
      const isAdmin = user?.role === 'ADMIN';

      if (existing.senderId !== currentUserId && !isAdmin) return;

      const updated = db.editMessage(messageId, content);
      if (!updated) return;

      const fullMessage = db.getMessageById(messageId);
      if (!fullMessage) return;

      const convId = conversationId || existing.conversationId;

      // Broadcast to room
      io.to(`conversation:${convId}`).emit('message:updated', fullMessage);

      // Broadcast to conversation members individually
      const conversation = db.getConversationById(convId);
      if (conversation) {
        for (const mem of conversation.members) {
          io.to(`user:${mem.userId}`).emit('message:updated', fullMessage);
        }
      }
    });

    // Delete message via Socket (expéditeur ou destinataire / membre à tout moment)
    socket.on('message:delete', ({ messageId, conversationId, forEveryone }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !messageId) return;

      const existing = db.getMessageById(messageId);
      if (!existing) return;

      const user = db.getUserById(currentUserId);
      const isAdmin = user?.role === 'ADMIN';

      const convId = conversationId || existing.conversationId;
      const conversation = db.getConversationById(convId);
      const isMember = conversation?.members.some((m) => m.userId === currentUserId);

      // L'expéditeur ET le destinataire (membre de la conversation) ou l'admin peuvent supprimer à tout moment
      if (existing.senderId !== currentUserId && !isAdmin && !isMember) return;

      if (forEveryone) {
        db.deleteMessageForEveryone(messageId);

        const payload = { messageId, conversationId: convId, forEveryone: true };
        io.to(`conversation:${convId}`).emit('message:deleted', payload);

        if (conversation) {
          for (const mem of conversation.members) {
            io.to(`user:${mem.userId}`).emit('message:deleted', payload);
          }
        }
      } else {
        db.deleteMessageForMe(messageId, currentUserId);
        io.to(`user:${currentUserId}`).emit('message:deleted', {
          messageId,
          conversationId: convId,
          forEveryone: false,
          deletedForUserId: currentUserId,
        });
      }
    });

    // ==================== WebRTC Call Signaling ====================

    socket.on('call:initiate', ({ conversationId, receiverId, callMode }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !receiverId) return;

      const caller = db.getUserById(currentUserId);
      const receiver = db.getUserById(receiverId);
      if (!caller || !receiver) return;

      const mode = callMode === 'VIDEO' ? 'VIDEO' : 'AUDIO';
      const isVideo = mode === 'VIDEO';
      const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      const newCall = db.createCall({
        id: callId,
        conversationId: conversationId || '',
        callerId: currentUserId,
        receiverId,
        status: 'RINGING',
        startedAt: now,
        answeredAt: null,
        endedAt: null,
        duration: 0,
        callMode: mode,
        isVideo,
      });

      // Track active call
      activeCallsMap.set(currentUserId, { callId, callerId: currentUserId, receiverId, conversationId, mode });
      activeCallsMap.set(receiverId, { callId, callerId: currentUserId, receiverId, conversationId, mode });

      const fullCallData = {
        ...newCall,
        caller,
        receiver,
        callMode: mode,
        isVideo,
      };

      // Emit incoming call event to receiver's user room
      io.to(`user:${receiverId}`).emit('call:incoming', {
        call: fullCallData,
      });

      // Also confirm initiated call to caller with the official callId
      socket.emit('call:initiated', {
        call: fullCallData,
      });
    });

    socket.on('call:accept', ({ callId }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !callId) return;

      const now = new Date().toISOString();
      const updated = db.updateCall(callId, {
        status: 'ACCEPTED',
        answeredAt: now,
      });

      if (updated) {
        io.to(`user:${updated.callerId}`).emit('call:accepted', { callId });
        // Multi-device: tell other devices of this receiver that the call was answered elsewhere
        socket.to(`user:${currentUserId}`).emit('call:answered-elsewhere', { callId });
      }
    });

    socket.on('call:reject', ({ callId, callerId, conversationId }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId) return;

      const now = new Date().toISOString();
      const updated = callId ? db.updateCall(callId, {
        status: 'REJECTED',
        endedAt: now,
      }) : null;

      const activeRecord = activeCallsMap.get(currentUserId);
      const targetCallerId = callerId || updated?.callerId || activeRecord?.callerId;
      const convId = conversationId || updated?.conversationId || activeRecord?.conversationId;

      activeCallsMap.delete(currentUserId);
      if (targetCallerId) activeCallsMap.delete(targetCallerId);

      if (targetCallerId) {
        io.to(`user:${targetCallerId}`).emit('call:rejected', { callId, rejectedBy: currentUserId });
        io.to(`user:${targetCallerId}`).emit('call:ended', { callId, endedBy: currentUserId });
      }
      io.to(`user:${currentUserId}`).emit('call:ended', { callId, endedBy: currentUserId });

      if (convId) {
        io.to(`conversation:${convId}`).emit('call:ended', { callId, endedBy: currentUserId });

        const isVideo = updated ? (updated.callMode === 'VIDEO' || updated.isVideo) : (activeRecord?.mode === 'VIDEO');
        const label = isVideo ? 'Appel vidéo manqué' : 'Appel vocal manqué';

        const callLogMsg = db.createMessage({
          id: 'msg_call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          conversationId: convId,
          senderId: targetCallerId || currentUserId,
          content: label,
          type: 'CALL_LOG',
          replyToId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          callLog: {
            callId: callId || ('call_' + Date.now()),
            callerId: targetCallerId || currentUserId,
            receiverId: currentUserId,
            status: 'MISSED',
            duration: 0,
            callMode: isVideo ? 'VIDEO' : 'AUDIO',
            isVideo: !!isVideo,
          },
        });

        const fullMsg = db.getMessageById(callLogMsg.id);
        if (fullMsg) {
          io.to(`conversation:${convId}`).emit('message:new', fullMsg);
          if (targetCallerId) io.to(`user:${targetCallerId}`).emit('message:new', fullMsg);
          io.to(`user:${currentUserId}`).emit('message:new', fullMsg);
        }
      }
    });

    socket.on('call:end', ({ callId, duration, targetUserId, conversationId }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId) return;

      const now = new Date().toISOString();
      const callDuration = typeof duration === 'number' ? Math.max(0, duration) : 0;
      const isAnswered = callDuration > 0;
      const callStatus = isAnswered ? 'ENDED' : 'MISSED';

      let updated = callId ? db.updateCall(callId, {
        status: callStatus,
        endedAt: now,
        duration: callDuration,
      }) : null;

      const activeRecord = activeCallsMap.get(currentUserId);
      const otherUserId = targetUserId || (updated ? (updated.callerId === currentUserId ? updated.receiverId : updated.callerId) : (activeRecord?.receiverId === currentUserId ? activeRecord?.callerId : activeRecord?.receiverId));
      const convId = conversationId || updated?.conversationId || activeRecord?.conversationId;
      const callerId = updated?.callerId || activeRecord?.callerId || currentUserId;
      const isVideo = updated ? (updated.callMode === 'VIDEO' || updated.isVideo) : (activeRecord?.mode === 'VIDEO');

      activeCallsMap.delete(currentUserId);
      if (otherUserId) activeCallsMap.delete(otherUserId);

      // ALWAYS emit call:ended to both users and conversation room
      if (otherUserId) {
        io.to(`user:${otherUserId}`).emit('call:ended', { callId, endedBy: currentUserId });
      }
      io.to(`user:${currentUserId}`).emit('call:ended', { callId, endedBy: currentUserId });
      if (convId) {
        io.to(`conversation:${convId}`).emit('call:ended', { callId, endedBy: currentUserId });
      }

      // Record call log message in the conversation
      if (convId && callerId) {
        const m = Math.floor(callDuration / 60);
        const s = callDuration % 60;
        const durationStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const typeName = isVideo ? 'Appel vidéo' : 'Appel vocal';
        const content = isAnswered ? `${typeName} (${durationStr})` : `${typeName} manqué`;

        const callLogMsg = db.createMessage({
          id: 'msg_call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          conversationId: convId,
          senderId: callerId,
          content,
          type: 'CALL_LOG',
          replyToId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          callLog: {
            callId: callId || ('call_' + Date.now()),
            callerId,
            receiverId: otherUserId || '',
            status: callStatus,
            duration: callDuration,
            callMode: isVideo ? 'VIDEO' : 'AUDIO',
            isVideo: !!isVideo,
          },
        });

        const fullMsg = db.getMessageById(callLogMsg.id);
        if (fullMsg) {
          io.to(`conversation:${convId}`).emit('message:new', fullMsg);
          io.to(`user:${callerId}`).emit('message:new', fullMsg);
          if (otherUserId) {
            io.to(`user:${otherUserId}`).emit('message:new', fullMsg);
          }
        }
      }
    });

    socket.on('call:camera-toggle', ({ targetUserId, videoEnabled, callId }) => {
      io.to(`user:${targetUserId}`).emit('call:camera-toggle', {
        senderId: socket.data.userId,
        videoEnabled,
        callId,
      });
    });

    socket.on('call:offer', ({ targetUserId, offer, callId, callMode }) => {
      io.to(`user:${targetUserId}`).emit('call:offer', {
        callerId: socket.data.userId,
        offer,
        callId,
        callMode,
      });
    });

    socket.on('call:answer', ({ targetUserId, answer, callId }) => {
      io.to(`user:${targetUserId}`).emit('call:answer', {
        responderId: socket.data.userId,
        answer,
        callId,
      });
    });

    socket.on('call:ice-candidate', ({ targetUserId, candidate, callId }) => {
      io.to(`user:${targetUserId}`).emit('call:ice-candidate', {
        senderId: socket.data.userId,
        candidate,
        callId,
      });
    });

    // ==================== Group Calls (Mesh WebRTC) ====================

    socket.on('group-call:initiate', ({ conversationId, callMode }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !conversationId) return;

      const conversation = db.getConversationById(conversationId);
      const caller = db.getUserById(currentUserId);
      if (!conversation || !caller) return;

      const mode = callMode === 'VIDEO' ? 'VIDEO' : 'AUDIO';
      const isVideo = mode === 'VIDEO';
      const callId = 'grpcall_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      // Create call history record
      db.createCall({
        id: callId,
        conversationId,
        callerId: currentUserId,
        receiverId: conversationId, // group
        status: 'RINGING',
        startedAt: now,
        answeredAt: null,
        endedAt: null,
        duration: 0,
        callMode: mode,
        isVideo,
      });

      socket.join(`group-call:${conversationId}`);

      const callData = {
        callId,
        conversationId,
        groupName: conversation.name || 'Groupe',
        groupAvatarUrl: conversation.avatarUrl || null,
        caller,
        startedAt: now,
        callMode: mode,
        isVideo,
      };

      // Notify all group members (except caller)
      for (const mem of conversation.members) {
        if (mem.userId !== currentUserId) {
          io.to(`user:${mem.userId}`).emit('group-call:incoming', callData);
        }
      }

      socket.emit('group-call:initiated', callData);
    });

    socket.on('group-call:join', ({ conversationId, callId }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !conversationId) return;

      const user = db.getUserById(currentUserId);
      socket.join(`group-call:${conversationId}`);

      // Broadcast to room that user joined
      socket.to(`group-call:${conversationId}`).emit('group-call:user-joined', {
        userId: currentUserId,
        user,
        conversationId,
        callId,
      });
    });

    socket.on('group-call:signal', ({ conversationId, targetUserId, signal, type }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !targetUserId) return;

      io.to(`user:${targetUserId}`).emit('group-call:signal', {
        senderId: currentUserId,
        signal,
        type,
        conversationId,
      });
    });

    socket.on('group-call:camera-toggle', ({ conversationId, videoEnabled }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !conversationId) return;

      socket.to(`group-call:${conversationId}`).emit('group-call:camera-toggle', {
        userId: currentUserId,
        videoEnabled,
      });
    });

    socket.on('group-call:leave', ({ conversationId, callId }) => {
      const currentUserId = socket.data.userId;
      if (!currentUserId || !conversationId) return;

      socket.leave(`group-call:${conversationId}`);
      io.to(`group-call:${conversationId}`).emit('group-call:user-left', {
        userId: currentUserId,
        conversationId,
        callId,
      });
    });

    socket.on('group-call:end', ({ conversationId, callId, duration, callMode }) => {
      const currentUserId = socket.data.userId;
      if (!conversationId) return;

      const callDuration = typeof duration === 'number' ? Math.max(0, duration) : 0;
      const conversation = db.getConversationById(conversationId);
      const isVideo = callMode === 'VIDEO';

      if (callId) {
        db.updateCall(callId, {
          status: 'ENDED',
          endedAt: new Date().toISOString(),
          duration: callDuration,
          callMode: isVideo ? 'VIDEO' : 'AUDIO',
          isVideo,
        });
      }

      // Record group call log in conversation
      if (currentUserId) {
        const m = Math.floor(callDuration / 60);
        const s = callDuration % 60;
        const durationStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const typeName = isVideo ? 'Appel vidéo de groupe' : 'Appel vocal de groupe';
        const content = callDuration > 0
          ? `${typeName} (${durationStr})`
          : `${typeName} terminé`;

        const now = new Date().toISOString();
        const callLogMsg = db.createMessage({
          id: 'msg_call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          conversationId,
          senderId: currentUserId,
          content,
          type: 'CALL_LOG',
          replyToId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          callLog: {
            callId: callId || ('grpcall_' + Date.now()),
            callerId: currentUserId,
            receiverId: conversationId,
            status: 'ENDED',
            duration: callDuration,
            callMode: isVideo ? 'VIDEO' : 'AUDIO',
            isVideo,
            isGroup: true,
            groupName: conversation?.name || 'Groupe',
          },
        });

        const fullMsg = db.getMessageById(callLogMsg.id);
        if (fullMsg) {
          io.to(`conversation:${conversationId}`).emit('message:new', fullMsg);
          if (conversation) {
            for (const mem of conversation.members) {
              io.to(`user:${mem.userId}`).emit('message:new', fullMsg);
            }
          }
        }
      }

      io.to(`group-call:${conversationId}`).emit('group-call:ended', {
        conversationId,
        callId,
      });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      const currentUserId = socket.data.userId;
      if (currentUserId) {
        // If user was in an ongoing call, terminate it immediately for the peer
        const activeCall = activeCallsMap.get(currentUserId);
        if (activeCall) {
          activeCallsMap.delete(currentUserId);
          const peerId = activeCall.callerId === currentUserId ? activeCall.receiverId : activeCall.callerId;
          if (peerId) {
            activeCallsMap.delete(peerId);
            io.to(`user:${peerId}`).emit('call:ended', { callId: activeCall.callId, endedBy: currentUserId });
          }
          if (activeCall.conversationId) {
            io.to(`conversation:${activeCall.conversationId}`).emit('call:ended', { callId: activeCall.callId, endedBy: currentUserId });
          }
        }

        const userSockets = activeUserSockets.get(currentUserId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            activeUserSockets.delete(currentUserId);

            const lastSeenAt = new Date().toISOString();
            db.updateUser(currentUserId, {
              status: 'OFFLINE',
              lastSeenAt,
            });

            io.emit('presence:update', {
              userId: currentUserId,
              status: 'OFFLINE',
              lastSeenAt,
            });
          }
        }
      }
    });
  });
}
