import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { Call, User, Conversation, GroupCallSession, CallMode } from '../types';
import { soundService } from '../services/soundService';
import { notificationService } from '../services/notificationService';

interface CallContextType {
  activeCall: Call | null;
  groupCallSession: GroupCallSession | null;
  isGroupCall: boolean;
  callMode: CallMode;
  isVideo: boolean;
  callState: 'IDLE' | 'RINGING_OUTGOING' | 'RINGING_INCOMING' | 'CONNECTED' | 'ENDED';
  isMuted: boolean;
  isCameraOn: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
  isFrontCamera: boolean;
  isRemoteCameraOn: boolean;
  callDuration: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  groupStreams: Record<string, MediaStream>;
  groupVideoStatuses: Record<string, boolean>;
  initiateCall: (conversationId: string, receiver: User, mode?: CallMode) => Promise<void>;
  initiateGroupCall: (group: Conversation, mode?: CallMode) => Promise<void>;
  acceptCall: () => Promise<void>;
  acceptGroupCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  flipCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleSpeaker: () => void;
  remoteUser: User | null;
  groupParticipants: User[];
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [groupCallSession, setGroupCallSession] = useState<GroupCallSession | null>(null);
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [callMode, setCallMode] = useState<CallMode>('AUDIO');
  const [groupParticipants, setGroupParticipants] = useState<User[]>([]);
  const [callState, setCallState] = useState<'IDLE' | 'RINGING_OUTGOING' | 'RINGING_INCOMING' | 'CONNECTED' | 'ENDED'>('IDLE');
  const [remoteUser, setRemoteUser] = useState<User | null>(null);
  
  // Media Controls States
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  // Streams state for UI rendering
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [groupStreams, setGroupStreams] = useState<Record<string, MediaStream>>({});
  const [groupVideoStatuses, setGroupVideoStatuses] = useState<Record<string, boolean>>({});

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const groupPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const groupAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeCallRef = useRef<Call | null>(null);
  const groupCallSessionRef = useRef<GroupCallSession | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const callModeRef = useRef<CallMode>('AUDIO');

  const updateActiveCall = (call: Call | null) => {
    activeCallRef.current = call;
    setActiveCall(call);
    if (call?.callMode) {
      callModeRef.current = call.callMode;
      setCallMode(call.callMode);
    }
  };

  const updateGroupCallSession = (session: GroupCallSession | null) => {
    groupCallSessionRef.current = session;
    setGroupCallSession(session);
    setIsGroupCall(!!session);
    if (session?.callMode) {
      callModeRef.current = session.callMode;
      setCallMode(session.callMode);
    }
  };

  // Audio element for direct remote voice fallback
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }
  }, []);

  // Duration timer & Call Ringtones
  useEffect(() => {
    if (callState === 'RINGING_INCOMING') {
      soundService.playIncomingRingtone();
    } else if (callState === 'RINGING_OUTGOING') {
      soundService.playOutgoingRingback();
    } else if (callState === 'CONNECTED') {
      soundService.playCallConnectedTone();
    } else if (callState === 'ENDED') {
      soundService.playCallEndTone();
    } else if (callState === 'IDLE') {
      soundService.stopAll();
    }

    if (callState === 'CONNECTED') {
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callState]);

  // Clean up all connections and media
  const cleanupCall = useCallback(() => {
    soundService.stopAll();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close group peers
    groupPeersRef.current.forEach((pc) => pc.close());
    groupPeersRef.current.clear();

    // Stop group audio elements
    groupAudioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
    });
    groupAudioElementsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setRemoteStream(null);
    setGroupStreams({});
    setGroupVideoStatuses({});

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    iceCandidatesQueueRef.current = [];
    updateActiveCall(null);
    updateGroupCallSession(null);
    setRemoteUser(null);
    setGroupParticipants([]);
    setIsGroupCall(false);
    setCallState('IDLE');
    setIsMuted(false);
    setIsCameraOn(true);
    setIsScreenSharing(false);
    setIsRemoteCameraOn(true);
    setCallDuration(0);
  }, []);

  const processPendingIceCandidates = async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Erreur vidage queue ICE candidate:', err);
        }
      }
    }
  };

  // Helper to obtain user media stream based on mode
  const getUserMediaStream = async (mode: CallMode, facing: 'user' | 'environment' = 'user') => {
    if (mode === 'VIDEO') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        return stream;
      } catch (videoErr) {
        console.warn('Impossible d\'obtenir la vidéo, essai avec audio seul:', videoErr);
        // Fallback to audio if video device is unavailable
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return audioStream;
      }
    } else {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    }
  };

  // Setup WebRTC PeerConnection for 1-on-1
  const createPeerConnection = (targetUserId: string, callId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', {
          targetUserId,
          candidate: event.candidate,
          callId,
        });
      }
    };

    pc.ontrack = (event) => {
      let stream = (event.streams && event.streams[0]) ? event.streams[0] : null;
      if (!stream && event.track) {
        stream = new MediaStream([event.track]);
      }
      if (stream) {
        setRemoteStream(stream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((e) => console.log('Autoplay remote audio:', e));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] 1-on-1 Connection state changed to: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setCallState('CONNECTED');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Create PeerConnection for a group peer
  const createGroupPeerConnection = (targetUserId: string, conversationId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('group-call:signal', {
          conversationId,
          targetUserId,
          signal: event.candidate,
          type: 'ice-candidate',
        });
      }
    };

    pc.ontrack = (event) => {
      let stream = (event.streams && event.streams[0]) ? event.streams[0] : null;
      if (!stream && event.track) {
        stream = new MediaStream([event.track]);
      }
      if (stream) {
        setGroupStreams((prev) => ({
          ...prev,
          [targetUserId]: stream!,
        }));

        let audio = groupAudioElementsRef.current.get(targetUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          groupAudioElementsRef.current.set(targetUserId, audio);
        }
        audio.srcObject = stream;
        audio.play().catch((e) => console.log('Group remote audio autoplay:', e));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Group peer (${targetUserId}) state: ${pc.connectionState}`);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }

    groupPeersRef.current.set(targetUserId, pc);
    return pc;
  };

  useEffect(() => {
    if (!socket) return;

    // 1-on-1 Incoming Call
    socket.on('call:incoming', ({ call }) => {
      const mode = call.callMode === 'VIDEO' || call.isVideo ? 'VIDEO' : 'AUDIO';
      callModeRef.current = mode;
      setCallMode(mode);
      updateActiveCall(call);
      updateGroupCallSession(null);
      setIsGroupCall(false);
      setRemoteUser(call.caller);
      setCallState('RINGING_INCOMING');

      const callerName = call.caller
        ? `${call.caller.firstName} ${call.caller.lastName}`
        : 'Correspondant';
      const isVid = mode === 'VIDEO';

      notificationService.showNotification({
        title: isVid ? `📹 Appel vidéo entrant` : `📞 Appel audio entrant`,
        body: `${callerName} vous appelle en ${isVid ? 'vidéo' : 'audio'} sur KOMECHAT...`,
        conversationId: call.conversationId,
        icon: call.caller?.avatarUrl || '/komechat_logo.jpg',
        tag: `call_${call.id}`,
      });
    });

    // Group Incoming Call
    socket.on('group-call:incoming', (data: { callId: string; conversationId: string; groupName: string; groupAvatarUrl?: string | null; caller: User; startedAt: string; callMode?: CallMode; isVideo?: boolean }) => {
      const mode = data.callMode === 'VIDEO' || data.isVideo ? 'VIDEO' : 'AUDIO';
      callModeRef.current = mode;
      setCallMode(mode);

      const session: GroupCallSession = {
        id: data.callId,
        conversationId: data.conversationId,
        groupName: data.groupName,
        groupAvatarUrl: data.groupAvatarUrl,
        callerId: data.caller.id,
        caller: data.caller,
        status: 'RINGING',
        participants: [data.caller],
        startedAt: data.startedAt,
        callMode: mode,
        isVideo: mode === 'VIDEO',
      };
      updateGroupCallSession(session);
      updateActiveCall({
        id: data.callId,
        conversationId: data.conversationId,
        callerId: data.caller.id,
        receiverId: data.conversationId,
        status: 'RINGING',
        startedAt: data.startedAt,
        answeredAt: null,
        endedAt: null,
        duration: 0,
        caller: data.caller,
        callMode: mode,
        isVideo: mode === 'VIDEO',
        isGroup: true,
        groupName: data.groupName,
        groupAvatarUrl: data.groupAvatarUrl,
      });
      setGroupParticipants([data.caller]);
      setCallState('RINGING_INCOMING');

      const callerName = data.caller
        ? `${data.caller.firstName} ${data.caller.lastName}`
        : 'Un membre';
      const isVid = mode === 'VIDEO';

      notificationService.showNotification({
        title: isVid ? `📹 Appel vidéo de groupe : ${data.groupName}` : `📞 Appel vocal de groupe : ${data.groupName}`,
        body: `${callerName} a lancé un appel ${isVid ? 'vidéo' : 'audio'} dans le groupe.`,
        conversationId: data.conversationId,
        icon: data.groupAvatarUrl || '/komechat_logo.jpg',
        tag: `call_${data.callId}`,
      });
    });

    socket.on('group-call:initiated', () => {
      setCallState('CONNECTED');
    });

    socket.on('group-call:user-joined', async ({ userId, user: joinedUser, conversationId }) => {
      if (joinedUser) {
        setGroupParticipants((prev) => {
          if (prev.some((p) => p.id === joinedUser.id)) return prev;
          return [...prev, joinedUser];
        });
      }

      // If we are already in call, send offer to the new participant
      const pc = createGroupPeerConnection(userId, conversationId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('group-call:signal', {
          conversationId,
          targetUserId: userId,
          signal: offer,
          type: 'offer',
        });
      } catch (err) {
        console.error('Erreur createOffer group call:', err);
      }
    });

    socket.on('group-call:user-left', ({ userId }) => {
      setGroupParticipants((prev) => prev.filter((p) => p.id !== userId));
      const pc = groupPeersRef.current.get(userId);
      if (pc) {
        pc.close();
        groupPeersRef.current.delete(userId);
      }
      const audio = groupAudioElementsRef.current.get(userId);
      if (audio) {
        audio.srcObject = null;
        groupAudioElementsRef.current.delete(userId);
      }
      setGroupStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on('group-call:camera-toggle', ({ userId, videoEnabled }) => {
      setGroupVideoStatuses((prev) => ({
        ...prev,
        [userId]: videoEnabled,
      }));
    });

    socket.on('call:camera-toggle', ({ videoEnabled }) => {
      setIsRemoteCameraOn(videoEnabled);
    });

    socket.on('group-call:signal', async ({ senderId, signal, type, conversationId }) => {
      let pc = groupPeersRef.current.get(senderId);
      if (!pc) {
        pc = createGroupPeerConnection(senderId, conversationId);
      }

      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('group-call:signal', {
          conversationId,
          targetUserId: senderId,
          signal: answer,
          type: 'answer',
        });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (type === 'ice-candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        } catch (e) {
          console.log('Group candidate err:', e);
        }
      }
    });

    socket.on('group-call:ended', () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      soundService.stopAll();
      soundService.playHangupSound();
      setCallState('ENDED');
      setTimeout(cleanupCall, 1000);
    });

    // 1-on-1 Outgoing call initiated confirmation from server
    socket.on('call:initiated', ({ call }) => {
      if (call) {
        updateActiveCall(call);
      }
    });

    // 1-on-1 Outgoing call accepted
    socket.on('call:accepted', async ({ callId }) => {
      setCallState('CONNECTED');
      const call = activeCallRef.current;
      if (peerConnectionRef.current && call) {
        const targetId = call.receiverId === user?.id ? call.callerId : call.receiverId;
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit('call:offer', {
          targetUserId: targetId,
          offer,
          callId: call.id || callId,
          callMode: callModeRef.current,
        });
      }
    });

    // Multi-device sync: Call was answered on another device/tab of this user
    socket.on('call:answered-elsewhere', () => {
      soundService.stopAll();
      cleanupCall();
      setCallState('IDLE');
    });

    // Call rejected or busy
    socket.on('call:rejected', () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      soundService.stopAll();
      soundService.playHangupSound();
      setCallState('ENDED');
      setTimeout(cleanupCall, 1200);
    });

    socket.on('call:busy', () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      soundService.stopAll();
      soundService.playHangupSound();
      setCallState('ENDED');
      setTimeout(cleanupCall, 1200);
    });

    socket.on('call:ended', () => {
      // Immediately stop all local tracks so camera/mic lights turn off right away
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      setRemoteStream(null);

      soundService.stopAll();
      soundService.playHangupSound();
      setCallState('ENDED');
      setTimeout(cleanupCall, 1000);
    });

    // 1-on-1 WebRTC Offer received
    socket.on('call:offer', async ({ callerId, offer, callId, callMode: incomingMode }) => {
      const mode = incomingMode === 'VIDEO' ? 'VIDEO' : callModeRef.current;
      let pc = peerConnectionRef.current;
      if (!pc) {
        pc = createPeerConnection(callerId, callId);
        try {
          const stream = await getUserMediaStream(mode);
          localStreamRef.current = stream;
          setLocalStream(stream);
          stream.getTracks().forEach((track) => pc!.addTrack(track, stream));
        } catch (err) {
          console.error('Erreur accès média lors de l\'offer:', err);
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processPendingIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', {
        targetUserId: callerId,
        answer,
        callId,
      });
      setCallState('CONNECTED');
    });

    // 1-on-1 WebRTC Answer received
    socket.on('call:answer', async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await processPendingIceCandidates();
      }
    });

    // 1-on-1 ICE Candidate received
    socket.on('call:ice-candidate', async ({ candidate }) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Erreur ajout ICE candidate:', err);
        }
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:rejected');
      socket.off('call:busy');
      socket.off('call:ended');
      socket.off('call:offer');
      socket.off('call:answer');
      socket.off('call:ice-candidate');
      socket.off('call:camera-toggle');
      socket.off('group-call:incoming');
      socket.off('group-call:initiated');
      socket.off('group-call:user-joined');
      socket.off('group-call:user-left');
      socket.off('group-call:signal');
      socket.off('group-call:camera-toggle');
      socket.off('group-call:ended');
    };
  }, [socket, user?.id, cleanupCall]);

  // Initiate 1-on-1 Call (Audio or Video)
  const initiateCall = async (conversationId: string, receiver: User, mode: CallMode = 'AUDIO') => {
    if (!socket || !user) return;

    callModeRef.current = mode;
    setCallMode(mode);
    setRemoteUser(receiver);
    setIsGroupCall(false);
    updateGroupCallSession(null);
    setCallState('RINGING_OUTGOING');
    setIsCameraOn(mode === 'VIDEO');

    try {
      const stream = await getUserMediaStream(mode);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const tempCallId = 'call_' + Date.now();
      const pc = createPeerConnection(receiver.id, tempCallId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const tempCall: Call = {
        id: tempCallId,
        conversationId,
        callerId: user.id,
        receiverId: receiver.id,
        status: 'RINGING',
        startedAt: new Date().toISOString(),
        answeredAt: null,
        endedAt: null,
        duration: 0,
        callMode: mode,
        isVideo: mode === 'VIDEO',
      };
      updateActiveCall(tempCall);

      socket.emit('call:initiate', {
        conversationId,
        receiverId: receiver.id,
        callMode: mode,
      });
    } catch (err) {
      console.error('Média inaccessible:', err);
      alert('Impossible d\'accéder aux périphériques média pour passer l\'appel.');
      cleanupCall();
    }
  };

  // Initiate Group Call (Audio or Video)
  const initiateGroupCall = async (group: Conversation, mode: CallMode = 'AUDIO') => {
    if (!socket || !user) return;

    callModeRef.current = mode;
    setCallMode(mode);
    setIsGroupCall(true);
    setRemoteUser(null);
    setGroupParticipants(user ? [user] : []);
    setCallState('RINGING_OUTGOING');
    setIsCameraOn(mode === 'VIDEO');

    try {
      const stream = await getUserMediaStream(mode);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const tempCallId = 'grpcall_' + Date.now();
      const session: GroupCallSession = {
        id: tempCallId,
        conversationId: group.id,
        groupName: group.name || 'Groupe',
        groupAvatarUrl: group.avatarUrl,
        callerId: user.id,
        caller: user,
        status: 'CONNECTED',
        participants: [user],
        startedAt: new Date().toISOString(),
        callMode: mode,
        isVideo: mode === 'VIDEO',
      };
      updateGroupCallSession(session);

      const tempCall: Call = {
        id: tempCallId,
        conversationId: group.id,
        callerId: user.id,
        receiverId: group.id,
        status: 'RINGING',
        startedAt: new Date().toISOString(),
        answeredAt: null,
        endedAt: null,
        duration: 0,
        callMode: mode,
        isVideo: mode === 'VIDEO',
        isGroup: true,
        groupName: group.name || 'Groupe',
        groupAvatarUrl: group.avatarUrl,
      };
      updateActiveCall(tempCall);

      socket.emit('group-call:initiate', {
        conversationId: group.id,
        callMode: mode,
      });
      setCallState('CONNECTED');
    } catch (err) {
      console.error('Média inaccessible pour appel de groupe:', err);
      alert('Impossible d\'accéder aux périphériques pour lancer l\'appel de groupe.');
      cleanupCall();
    }
  };

  // Accept 1-on-1 Call
  const acceptCall = async () => {
    if (!socket || !activeCall) return;

    if (isGroupCall || activeCall.isGroup) {
      await acceptGroupCall();
      return;
    }

    const mode = activeCall.callMode === 'VIDEO' || activeCall.isVideo ? 'VIDEO' : 'AUDIO';
    callModeRef.current = mode;
    setCallMode(mode);
    setIsCameraOn(mode === 'VIDEO');

    try {
      const stream = await getUserMediaStream(mode);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const callerId = activeCall.callerId;
      const pc = createPeerConnection(callerId, activeCall.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      socket.emit('call:accept', { callId: activeCall.id });
      setCallState('CONNECTED');
    } catch (err) {
      console.error('Média inaccessible lors de la réponse:', err);
      rejectCall();
    }
  };

  // Accept / Join Group Call
  const acceptGroupCall = async () => {
    if (!socket || !activeCall) return;

    const mode = activeCall.callMode === 'VIDEO' || activeCall.isVideo ? 'VIDEO' : 'AUDIO';
    callModeRef.current = mode;
    setCallMode(mode);
    setIsCameraOn(mode === 'VIDEO');

    try {
      const stream = await getUserMediaStream(mode);
      localStreamRef.current = stream;
      setLocalStream(stream);

      setIsGroupCall(true);
      if (user) {
        setGroupParticipants((prev) => (prev.some((p) => p.id === user.id) ? prev : [...prev, user]));
      }

      socket.emit('group-call:join', {
        conversationId: activeCall.conversationId,
        callId: activeCall.id,
      });

      setCallState('CONNECTED');
    } catch (err) {
      console.error('Média inaccessible lors de la connexion au groupe:', err);
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (socket && activeCall) {
      if (isGroupCall || activeCall.isGroup) {
        socket.emit('group-call:leave', {
          conversationId: activeCall.conversationId,
          callId: activeCall.id,
        });
      } else {
        const targetCallerId = remoteUser?.id || (activeCall.receiverId === user?.id ? activeCall.callerId : activeCall.receiverId);
        socket.emit('call:reject', {
          callId: activeCall.id,
          callerId: targetCallerId,
          conversationId: activeCall.conversationId,
        });
      }
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    cleanupCall();
  };

  const endCall = () => {
    if (socket && activeCall) {
      if (isGroupCall || activeCall.isGroup) {
        socket.emit('group-call:leave', {
          conversationId: activeCall.conversationId,
          callId: activeCall.id,
        });
        socket.emit('group-call:end', {
          conversationId: activeCall.conversationId,
          callId: activeCall.id,
          duration: callDuration,
          callMode: callModeRef.current,
        });
      } else {
        const targetUserId = remoteUser?.id || (activeCall.callerId === user?.id ? activeCall.receiverId : activeCall.callerId);
        socket.emit('call:end', {
          callId: activeCall.id,
          duration: callDuration,
          targetUserId,
          conversationId: activeCall.conversationId,
        });
      }
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setRemoteStream(null);
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);

        // Notify remote peers of camera state
        if (activeCall && socket) {
          if (isGroupCall) {
            socket.emit('group-call:camera-toggle', {
              conversationId: activeCall.conversationId,
              videoEnabled: videoTrack.enabled,
            });
          } else {
            const targetId = activeCall.receiverId === user?.id ? activeCall.callerId : activeCall.receiverId;
            socket.emit('call:camera-toggle', {
              targetUserId: targetId,
              videoEnabled: videoTrack.enabled,
              callId: activeCall.id,
            });
          }
        }
      } else {
        // Upgrade from audio to video track dynamically
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: isFrontCamera ? 'user' : 'environment' },
          });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          setIsCameraOn(true);
          setCallMode('VIDEO');
          callModeRef.current = 'VIDEO';

          // Add track to peer connections
          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
          }
          groupPeersRef.current.forEach((pc) => {
            pc.addTrack(newVideoTrack, localStreamRef.current!);
          });
        } catch (e) {
          console.error('Erreur activation caméra:', e);
        }
      }
    }
  };

  const flipCamera = async () => {
    if (!localStreamRef.current) return;
    const nextFacing = isFrontCamera ? 'environment' : 'user';
    try {
      let stream: MediaStream | null = null;

      // 1. Try exact facingMode constraint
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e1) {
        console.log('Tentative facingMode idéal échouée, essai direct:', e1);
      }

      // 2. If ideal failed, try simple facingMode string
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: nextFacing },
            audio: false,
          });
        } catch (e2) {
          console.log('Tentative facingMode string échouée, recherche périphériques:', e2);
        }
      }

      // 3. Fallback: Enumerate video devices and cycle
      if (!stream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          if (videoDevices.length > 1) {
            const currentTrack = localStreamRef.current.getVideoTracks()[0];
            const currentLabel = currentTrack?.label || '';
            const otherDevice = videoDevices.find((d) => d.label !== currentLabel) || videoDevices[1];
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: otherDevice.deviceId } },
              audio: false,
            });
          }
        } catch (e3) {
          console.log('Échec sélection autre périphérique vidéo:', e3);
        }
      }

      if (!stream) {
        console.warn('Aucune caméra alternative disponible sur cet appareil');
        return;
      }

      const newVideoTrack = stream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStreamRef.current.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      localStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setIsFrontCamera(!isFrontCamera);

      // Replace track on RTCPeerConnections
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const sender = senders.find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      }
      groupPeersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });
    } catch (e) {
      console.error('Erreur retournement caméra:', e);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          toggleScreenShare(); // revert
        };

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }
        groupPeersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Erreur partage écran:', err);
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        if (camTrack && peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(camTrack);
          }
        }
        groupPeersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender && camTrack) {
            sender.replaceTrack(camTrack);
          }
        });
      }
      setIsScreenSharing(false);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isSpeakerOn;
    }
    groupAudioElementsRef.current.forEach((audio) => {
      audio.muted = isSpeakerOn;
    });
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        groupCallSession,
        isGroupCall,
        callMode,
        isVideo: callMode === 'VIDEO',
        callState,
        isMuted,
        isCameraOn,
        isSpeakerOn,
        isScreenSharing,
        isFrontCamera,
        isRemoteCameraOn,
        callDuration,
        localStream,
        remoteStream,
        groupStreams,
        groupVideoStatuses,
        initiateCall,
        initiateGroupCall,
        acceptCall,
        acceptGroupCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        flipCamera,
        toggleScreenShare,
        toggleSpeaker,
        remoteUser,
        groupParticipants,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
