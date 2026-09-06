import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  SwitchCamera,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Radio,
  ArrowLeftRight,
  Sparkles,
  Layers,
} from 'lucide-react';

export const CallOverlay: React.FC = () => {
  const { user } = useAuth();
  const {
    activeCall,
    groupCallSession,
    isGroupCall,
    isVideo,
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
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
    toggleScreenShare,
    toggleSpeaker,
    remoteUser,
    groupParticipants,
  } = useCall();

  const [isFullscreen, setIsFullscreen] = useState(false);
  // Swapping main view vs PiP (like WhatsApp):
  // false = Remote video in big background, Local video in small PiP
  // true  = Local video in big background, Remote video in small PiP
  const [isSwappedVideo, setIsSwappedVideo] = useState(false);
  const [pipPosition, setPipPosition] = useState<'bottom-right' | 'top-right' | 'bottom-left' | 'top-left'>('bottom-right');
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Callback refs to guarantee immediate stream binding and play execution
  const attachLocalStream = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node && localStream) {
        node.srcObject = localStream;
        node.muted = true;
        node.play().catch((e) => console.log('Autoplay local video track:', e));
      }
    },
    [localStream]
  );

  const attachRemoteStream = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node && remoteStream) {
        node.srcObject = remoteStream;
        node.muted = false;
        node.play().catch((e) => console.log('Autoplay remote video track:', e));
      }
    },
    [remoteStream]
  );

  // Reset swap state when call ends or mode changes
  useEffect(() => {
    if (callState === 'IDLE' || callState === 'ENDED') {
      setIsSwappedVideo(false);
    }
  }, [callState]);

  if (callState === 'IDLE') return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isGroup = isGroupCall || !!activeCall?.isGroup;
  const groupTitle = activeCall?.groupName || groupCallSession?.groupName || 'Groupe';
  const groupAvatar = activeCall?.groupAvatarUrl || groupCallSession?.groupAvatarUrl;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleFlipCamera = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSwitchingCamera(true);
    try {
      await flipCamera();
    } finally {
      setTimeout(() => setSwitchingCamera(false), 500);
    }
  };

  const handleToggleSwapVideo = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSwappedVideo((prev) => !prev);
  };

  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0 && isRemoteCameraOn;
  const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0 && isCameraOn;

  // Local video transform class depending on front vs rear camera
  const localVideoTransform = isFrontCamera ? 'scale-x-[-1]' : 'scale-x-100';

  return (
    <div
      ref={containerRef}
      id="mmd-call-overlay"
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-between p-3 sm:p-6 animate-in fade-in duration-200 select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                callState === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'
              }`}
            />
            <span className="text-xs font-bold text-white tracking-wide">
              {isVideo ? 'Appel Vidéo HD' : 'Appel Vocal'}
            </span>
            {isGroup && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Groupe
              </span>
            )}
          </div>

          {callState === 'CONNECTED' && (
            <div className="px-3 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          )}
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Swap Video Button (WhatsApp Style) */}
          {isVideo && callState === 'CONNECTED' && !isGroup && (
            <button
              onClick={handleToggleSwapVideo}
              className={`px-3 py-1.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                isSwappedVideo
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-600/30'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={
                isSwappedVideo
                  ? "Mettre en avant la vidéo du correspondant"
                  : "Mettre en avant ma propre vidéo"
              }
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isSwappedVideo ? 'Vue : Moi en grand' : 'Vue : Correspondant'}
              </span>
            </button>
          )}

          {/* Quick Flip Camera in Top Header */}
          {isVideo && isCameraOn && hasLocalVideo && (
            <button
              onClick={handleFlipCamera}
              disabled={switchingCamera}
              className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-lg flex items-center gap-1.5"
              title={`Basculer vers la caméra ${isFrontCamera ? 'arrière' : 'frontale'}`}
            >
              <SwitchCamera className={`w-4 h-4 ${switchingCamera ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-medium hidden md:inline">
                {isFrontCamera ? 'Caméra Avant' : 'Caméra Arrière'}
              </span>
            </button>
          )}

          {isVideo && (
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-lg"
              title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-5xl flex items-center justify-center my-2 sm:my-4 relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-2xl">
        {/* Glow ambient background */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
            isVideo ? 'bg-indigo-600/15' : 'bg-blue-600/15'
          }`}
        />

        {/* 1. OUTGOING VIDEO CALL (Caller camera active immediately) */}
        {isVideo && callState === 'RINGING_OUTGOING' ? (
          <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
            {/* Live Camera Preview of Caller */}
            {hasLocalVideo ? (
              <video
                ref={attachLocalStream}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${localVideoTransform}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 p-8">
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-2xl text-white">
                  <VideoOff className="w-10 h-10 text-slate-500" />
                </div>
                <p className="text-xs text-slate-400">Caméra désactivée</p>
              </div>
            )}

            {/* Dark glassmorphism overlay card showing calling state */}
            <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-3xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-xl flex items-center gap-4 shadow-2xl max-w-md w-[92%] z-20">
              <div className="relative shrink-0">
                {isGroup ? (
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-400 flex items-center justify-center text-white font-bold overflow-hidden shadow-md">
                    {groupAvatar ? (
                      <img src={groupAvatar} alt={groupTitle} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-white" />
                    )}
                  </div>
                ) : (
                  <div className="w-13 h-13 rounded-full bg-slate-800 border-2 border-indigo-500/60 overflow-hidden flex items-center justify-center font-bold text-lg text-white shadow-md">
                    {remoteUser?.avatarUrl ? (
                      <img src={remoteUser.avatarUrl} alt={remoteUser.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{remoteUser?.firstName?.[0] || 'U'}</span>
                    )}
                  </div>
                )}
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-slate-950 animate-ping" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-slate-950" />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white truncate">
                  {isGroup ? groupTitle : remoteUser ? `${remoteUser.firstName} ${remoteUser.lastName}` : 'Correspondant'}
                </h4>
                <p className="text-xs text-blue-400 font-semibold flex items-center gap-1.5 mt-0.5">
                  <VideoIcon className="w-3.5 h-3.5 animate-pulse" />
                  <span>Appel vidéo en cours d'envoi...</span>
                </p>
              </div>

              {/* Quick flip camera in ringing overlay */}
              {hasLocalVideo && (
                <button
                  onClick={handleFlipCamera}
                  disabled={switchingCamera}
                  title={`Changer de caméra (${isFrontCamera ? 'Arrière' : 'Avant'})`}
                  className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  <SwitchCamera className={`w-4 h-4 ${switchingCamera ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Hint pill at the bottom */}
            <div className="absolute bottom-6 px-4 py-1.5 rounded-full bg-slate-950/85 border border-slate-800 text-[11px] text-slate-300 font-medium backdrop-blur-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Votre caméra ({isFrontCamera ? 'frontale' : 'arrière'}) est active
              </span>
            </div>
          </div>
        ) : isVideo && callState === 'CONNECTED' ? (
          /* 2. CONNECTED VIDEO CALL (1-on-1 or Group) */
          <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
            {isGroup ? (
              /* Group Video Grid */
              <div className="w-full h-full p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto auto-rows-fr">
                {/* Local user tile in group */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg aspect-video">
                  {hasLocalVideo ? (
                    <video
                      ref={attachLocalStream}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${localVideoTransform}`}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center font-bold text-lg text-white">
                        {user?.firstName?.[0] || 'V'}
                      </div>
                      <span className="text-xs">Caméra désactivée</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-white flex items-center gap-1.5">
                    <span>{user?.firstName} (Vous)</span>
                    {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                  </div>

                  {/* Flip button in group tile */}
                  {hasLocalVideo && (
                    <button
                      onClick={handleFlipCamera}
                      title="Changer de caméra"
                      className="absolute top-2 right-2 p-1.5 rounded-xl bg-slate-950/80 text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                      <SwitchCamera className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Other group participants tiles */}
                {groupParticipants
                  .filter((p) => p.id !== user?.id)
                  .map((p) => {
                    const stream = groupStreams[p.id];
                    const isVidOn = groupVideoStatuses[p.id] !== false && !!stream && stream.getVideoTracks().length > 0;
                    return (
                      <GroupVideoTile
                        key={p.id}
                        participant={p}
                        stream={stream}
                        isVideoOn={isVidOn}
                      />
                    );
                  })}
              </div>
            ) : (
              /* 1-on-1 Direct WhatsApp-like Swappable Video Layout */
              <div className="w-full h-full relative flex items-center justify-center">
                {/* ---------------- MAIN VIEW (Background / Full Screen) ---------------- */}
                {!isSwappedVideo ? (
                  /* Standard: Remote User is in Main View */
                  <div className="w-full h-full relative flex items-center justify-center">
                    {hasRemoteVideo ? (
                      <video
                        ref={attachRemoteStream}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover rounded-3xl"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4 p-8">
                        <div className="w-28 h-28 rounded-full bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center font-bold text-3xl text-white shadow-xl shadow-indigo-500/20 overflow-hidden">
                          {remoteUser?.avatarUrl ? (
                            <img src={remoteUser.avatarUrl} alt={remoteUser.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{remoteUser?.firstName?.[0] || 'U'}</span>
                          )}
                        </div>
                        <div className="text-center">
                          <h4 className="text-lg font-bold text-white">
                            {remoteUser ? `${remoteUser.firstName} ${remoteUser.lastName}` : 'Correspondant'}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                            <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                            <span>La caméra du correspondant est désactivée</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Remote participant indicator */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-white flex items-center gap-2 shadow-lg z-10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{remoteUser ? `${remoteUser.firstName} ${remoteUser.lastName}` : 'Correspondant'}</span>
                      {!isRemoteCameraOn && <VideoOff className="w-3 h-3 text-amber-400" />}
                    </div>
                  </div>
                ) : (
                  /* Swapped: Local User (You) is in Main View */
                  <div className="w-full h-full relative flex items-center justify-center">
                    {hasLocalVideo ? (
                      <video
                        ref={attachLocalStream}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover rounded-3xl ${localVideoTransform}`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4 p-8">
                        <div className="w-28 h-28 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-3xl text-white shadow-xl">
                          {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.firstName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <span>{user?.firstName?.[0] || 'V'}</span>
                          )}
                        </div>
                        <div className="text-center">
                          <h4 className="text-lg font-bold text-white">{user?.firstName} (Vous)</h4>
                          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                            <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                            <span>Votre caméra est désactivée</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Local participant indicator */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-md text-xs font-bold text-white flex items-center gap-2 shadow-lg z-10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Vous ({isFrontCamera ? 'Caméra avant' : 'Caméra arrière'})</span>
                      {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                    </div>
                  </div>
                )}

                {/* ---------------- FLOATING PiP THUMBNAIL (WhatsApp Style) ---------------- */}
                {/* Clicking anywhere on the PiP swaps the views */}
                <div
                  onClick={handleToggleSwapVideo}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleToggleSwapVideo()}
                  className="absolute bottom-4 right-4 w-36 sm:w-52 aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden border-2 border-indigo-500/80 bg-slate-900/95 shadow-2xl z-30 transition-all duration-200 hover:scale-105 hover:border-indigo-400 cursor-pointer group select-none ring-2 ring-black/40"
                  title="Cliquer pour permuter et mettre en avant cette vidéo (comme sur WhatsApp)"
                >
                  {!isSwappedVideo ? (
                    /* PiP shows Local User (You) */
                    <div className="w-full h-full relative">
                      {hasLocalVideo ? (
                        <video
                          ref={attachLocalStream}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${localVideoTransform}`}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2">
                          <VideoOff className="w-5 h-5 mb-1 text-slate-500" />
                          <span className="text-[10px] text-center font-medium">Caméra éteinte</span>
                        </div>
                      )}

                      {/* PiP Badge: Vous */}
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1 border border-slate-800">
                        <span>Vous</span>
                        {isMuted && <MicOff className="w-2.5 h-2.5 text-red-400" />}
                      </div>

                      {/* Quick Flip camera button inside local PiP */}
                      {hasLocalVideo && (
                        <button
                          type="button"
                          onClick={handleFlipCamera}
                          disabled={switchingCamera}
                          title={`Changer de caméra (${isFrontCamera ? 'Arrière' : 'Avant'})`}
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-slate-950/85 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-opacity opacity-90 group-hover:opacity-100 cursor-pointer shadow"
                        >
                          <SwitchCamera className={`w-3.5 h-3.5 ${switchingCamera ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  ) : (
                    /* PiP shows Remote User */
                    <div className="w-full h-full relative">
                      {hasRemoteVideo ? (
                        <video
                          ref={attachRemoteStream}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white mb-1">
                            {remoteUser?.firstName?.[0] || 'U'}
                          </div>
                          <span className="text-[10px] text-center font-medium truncate max-w-[90%]">
                            {remoteUser?.firstName || 'Correspondant'}
                          </span>
                        </div>
                      )}

                      {/* PiP Badge: Remote User Name */}
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1 border border-slate-800 truncate max-w-[85%]">
                        <span className="truncate">{remoteUser?.firstName || 'Correspondant'}</span>
                        {!isRemoteCameraOn && <VideoOff className="w-2.5 h-2.5 text-amber-400" />}
                      </div>
                    </div>
                  )}

                  {/* Swap Overlay Hover Hint */}
                  <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white pointer-events-none p-2">
                    <ArrowLeftRight className="w-5 h-5 text-indigo-300 drop-shadow animate-pulse" />
                    <span className="text-[10px] font-bold text-center bg-slate-950/80 px-2 py-0.5 rounded-full border border-indigo-400/40">
                      Mettre en avant
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 3. Audio Mode or Incoming Ringing State */
          <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center z-10">
            {/* Avatar with Sound Radar */}
            <div className="relative">
              {isGroup ? (
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-indigo-500/80 overflow-hidden flex items-center justify-center font-bold text-3xl text-white shadow-2xl shadow-indigo-600/30">
                  {groupAvatar ? (
                    <img src={groupAvatar} alt={groupTitle} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-12 h-12 text-white" />
                  )}
                </div>
              ) : (
                <div className="w-28 h-28 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center font-bold text-3xl text-white shadow-2xl">
                  {remoteUser?.avatarUrl ? (
                    <img src={remoteUser.avatarUrl} alt={remoteUser.firstName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{remoteUser?.firstName?.[0] || 'U'}</span>
                  )}
                </div>
              )}

              {(callState === 'RINGING_INCOMING' || callState === 'RINGING_OUTGOING') && (
                <span
                  className={`absolute inset-0 ${
                    isGroup ? 'rounded-3xl border-indigo-400' : 'rounded-full border-blue-500'
                  } border-2 animate-ping opacity-60`}
                />
              )}
            </div>

            {/* Title & Status */}
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-xl font-bold text-white truncate">
                {isGroup ? groupTitle : remoteUser ? `${remoteUser.firstName} ${remoteUser.lastName}` : 'Appel en cours'}
              </h3>

              <p className="text-sm font-semibold text-indigo-400">
                {callState === 'RINGING_INCOMING' &&
                  (isVideo ? '📹 Appel vidéo entrant...' : '📞 Appel audio entrant...')}
                {callState === 'RINGING_OUTGOING' &&
                  (isVideo ? '📹 Appel vidéo en cours d\'appel...' : '📞 Appel vocal en cours d\'appel...')}
                {callState === 'CONNECTED' && (
                  <span className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>Connecté • {formatDuration(callDuration)}</span>
                  </span>
                )}
                {callState === 'ENDED' && 'Appel terminé'}
              </p>
            </div>

            {/* Group participants pill for audio */}
            {isGroup && (
              <div className="flex flex-wrap gap-2 justify-center max-w-md bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                {groupParticipants.map((p) => {
                  const isMe = p.id === user?.id;
                  return (
                    <div
                      key={p.id}
                      className={`px-3 py-1 rounded-xl text-xs flex items-center gap-2 border ${
                        isMe
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>
                        {p.firstName} {isMe ? '(Vous)' : ''}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full max-w-xl flex items-center justify-center gap-2 sm:gap-4 p-3 bg-slate-900/90 border border-slate-800/90 rounded-3xl backdrop-blur-md shadow-2xl z-20 shrink-0">
        {callState === 'RINGING_INCOMING' ? (
          <div className="flex items-center gap-8 py-2">
            <button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all active:scale-95 cursor-pointer"
              title="Refuser l'appel"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all active:scale-95 animate-bounce cursor-pointer"
              title={isVideo ? 'Répondre avec la vidéo' : 'Répondre'}
            >
              {isVideo ? <VideoIcon className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Microphone Toggle */}
            <button
              onClick={toggleMute}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                isMuted
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
              title={isMuted ? 'Activer le micro' : 'Couper le micro'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                !isCameraOn
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : isVideo
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
              title={isCameraOn ? 'Couper la caméra' : 'Activer la caméra'}
            >
              {isCameraOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Camera Flip (Frontal / Rear) */}
            {isCameraOn && (
              <button
                onClick={handleFlipCamera}
                disabled={switchingCamera}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                title={`Changer de caméra (${isFrontCamera ? 'Arrière' : 'Frontale'})`}
              >
                <SwitchCamera className={`w-5 h-5 ${switchingCamera ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}

            {/* WhatsApp Swap View Button in Bottom Bar for easy access on mobile */}
            {isVideo && callState === 'CONNECTED' && !isGroup && (
              <button
                onClick={handleToggleSwapVideo}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center transition-all cursor-pointer ${
                  isSwappedVideo
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                }`}
                title="Permuter la vue (Moi / Correspondant en grand)"
              >
                <ArrowLeftRight className="w-5 h-5" />
              </button>
            )}

            {/* Screen Share Toggle */}
            {callState === 'CONNECTED' && (
              <button
                onClick={toggleScreenShare}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  isScreenSharing
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                }`}
                title={isScreenSharing ? 'Arrêter le partage d\'écran' : 'Partager l\'écran'}
              >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>
            )}

            {/* Speaker Toggle */}
            <button
              onClick={toggleSpeaker}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                !isSpeakerOn
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
              }`}
              title={isSpeakerOn ? 'Haut-parleur actif' : 'Activer le haut-parleur'}
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Hangup / Leave Button */}
            <button
              onClick={endCall}
              className="w-13 h-11 sm:w-14 sm:h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer ml-1 sm:ml-2"
              title={isGroup ? 'Quitter l\'appel de groupe' : 'Raccrocher'}
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for individual participant tile in group video call
const GroupVideoTile: React.FC<{
  participant: any;
  stream?: MediaStream;
  isVideoOn: boolean;
}> = ({ participant, stream, isVideoOn }) => {
  const attachGroupStream = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node && stream) {
        node.srcObject = stream;
        node.play().catch((e) => console.log('Autoplay group video track:', e));
      }
    },
    [stream]
  );

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg aspect-video">
      {isVideoOn && stream ? (
        <video
          ref={attachGroupStream}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-lg text-white">
            {participant.avatarUrl ? (
              <img src={participant.avatarUrl} alt={participant.firstName} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span>{participant.firstName?.[0] || 'U'}</span>
            )}
          </div>
          <span className="text-xs">
            {participant.firstName} {participant.lastName}
          </span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-white flex items-center gap-1.5">
        <span>{participant.firstName}</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </div>
  );
};
