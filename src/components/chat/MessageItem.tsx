import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useFontSize } from '../../context/FontSizeContext';
import {
  Check,
  CheckCheck,
  FileText,
  Download,
  Trash2,
  Reply,
  MoreVertical,
  Play,
  Pause,
  Mic,
  FileArchive,
  Image as ImageIcon,
  Film,
  Music,
  X,
  Edit3,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  Video as VideoIcon,
  VideoOff,
  Users,
  Repeat,
  Repeat1,
  ListMusic,
  Plus,
  Forward,
} from 'lucide-react';
import { usePlaylist } from '../../context/PlaylistContext';

interface MessageItemProps {
  message: Message;
  onReply: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onSave?: (message: Message) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onCallBack?: (targetUserId: string, isGroup?: boolean, mode?: 'AUDIO' | 'VIDEO') => void;
}

const VoiceNotePlayer: React.FC<{
  url: string;
  isMine: boolean;
  title?: string;
  size?: number;
}> = ({ url, isMine, title, size }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  const { addTrack } = usePlaylist();

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.loop = isLoopingRef.current;

    const handleLoaded = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onloadedmetadata = handleLoaded;
    audio.ondurationchange = handleLoaded;
    audio.oncanplay = handleLoaded;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (audio.duration && isFinite(audio.duration) && audio.duration !== duration) {
        setDuration(audio.duration);
      }
    };

    audio.onended = () => {
      if (isLoopingRef.current || audio.loop) {
        audio.currentTime = 0;
        audio.play().then(() => setIsPlaying(true)).catch(console.error);
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    isLoopingRef.current = next;
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const toggleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleAddToPlaylist = () => {
    addTrack(
      {
        id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: title || 'Audio discussion',
        artist: 'Discussion KOMECHAT',
        url,
        duration,
        size,
        source: 'chat',
        addedAt: new Date().toISOString(),
      },
      false
    );
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  };

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`p-2.5 rounded-2xl flex items-center gap-3 ${isMine ? 'bg-blue-700/60' : 'bg-slate-900/80'} border border-white/10 shadow-inner`}>
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`p-2.5 rounded-full ${isMine ? 'bg-white text-blue-600' : 'bg-emerald-500 text-white'} hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer shrink-0`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform and Progress Bar */}
      <div className="flex-1 flex flex-col gap-1 min-w-[150px]">
        {/* Visual Waveform bars with progress highlight */}
        <div className="flex items-center gap-0.5 h-6">
          {[30, 60, 40, 80, 50, 90, 70, 30, 100, 60, 40, 80, 50, 90, 70, 30, 60, 40, 80, 50, 70, 40, 20].map((h, i, arr) => {
            const barPercent = (i / arr.length) * 100;
            const isPassed = barPercent <= progressPercent;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors ${
                  isPassed
                    ? isMine ? 'bg-white' : 'bg-emerald-400'
                    : isMine ? 'bg-white/30' : 'bg-slate-700'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        {/* Range slider for scrubbing */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-white/20 appearance-none rounded cursor-pointer accent-emerald-400"
        />

        {/* Controls row: Duration, Speed, Loop toggle, Add to playlist */}
        <div className="flex items-center justify-between text-[10px] opacity-90 pt-0.5 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono">
            <span>{formatSecs(currentTime > 0 ? currentTime : duration)}</span>
            {isLooping && (
              <span className="inline-flex items-center px-1 py-0.2 rounded text-[8px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40">
                ∞ boucle
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Speed toggle */}
            <button
              type="button"
              onClick={toggleSpeed}
              title="Vitesse de lecture"
              className="px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/40 font-mono font-bold text-[9px] cursor-pointer"
            >
              {playbackRate}x
            </button>

            {/* Loop Toggle Button */}
            <button
              type="button"
              onClick={toggleLoop}
              title={
                isLooping
                  ? "Lecture en boucle activée (ce fichier audio sera répété continuellement. Cliquez pour désactiver)"
                  : "Activer la lecture en boucle de ce fichier audio"
              }
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold text-[10px] cursor-pointer transition-all ${
                isLooping
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm ring-1 ring-emerald-300'
                  : 'bg-black/25 hover:bg-black/45 text-slate-200 hover:text-white'
              }`}
            >
              {isLooping ? (
                <Repeat1 className="w-3 h-3 text-slate-950" />
              ) : (
                <Repeat className="w-3 h-3 text-slate-300" />
              )}
              <span>{isLooping ? 'En boucle' : 'Boucle'}</span>
            </button>

            {/* Add to MP3 Playlist button */}
            <button
              type="button"
              onClick={handleAddToPlaylist}
              title="Ajouter ce morceau à la playlist MP3"
              className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold text-[9px] cursor-pointer transition-colors ${
                addedToast
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-black/20 hover:bg-black/40 text-slate-300 hover:text-emerald-300'
              }`}
            >
              <ListMusic className="w-2.5 h-2.5" />
              <span>{addedToast ? 'Ajouté !' : '+ Playlist'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onReply,
  onEdit,
  onForward,
  onSave,
  onDeleteForMe,
  onDeleteForEveryone,
  onCallBack,
}) => {
  const { user } = useAuth();
  const { messageTextClass, fileTextClass, subTextClass } = useFontSize();
  const isMine = message.senderId === user?.id;
  const isAdmin = user?.role === 'ADMIN';

  const [showOptions, setShowOptions] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  // Sauvegarde locale de secours si non prise en charge par le parent
  const handleSaveInternal = async () => {
    if (onSave) {
      onSave(message);
      return;
    }
    try {
      if (message.file?.url) {
        const fileName = message.file.originalName || 'fichier_enregistre';
        try {
          const res = await fetch(message.file.url);
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
          a.href = message.file.url;
          a.download = fileName;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else if (message.content) {
        const dateStr = new Date(message.createdAt).toISOString().slice(0, 10);
        const sender = message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : 'KomeChat';
        const textContent = `Message KomeChat\nExpéditeur : ${sender}\nDate : ${new Date(message.createdAt).toLocaleString()}\n\n${message.content}`;
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `komechat_message_${dateStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.error('Erreur enregistrement interne:', err);
    }
  };

  // Status indicator
  const renderStatus = () => {
    if (!isMine) return null;
    const isRead = message.statuses?.some((s) => s.status === 'READ');
    if (isRead) {
      return (
        <span title="Lu" className="inline-flex">
          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
        </span>
      );
    }
    return (
      <span title="Reçu" className="inline-flex">
        <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
      </span>
    );
  };

  const isDeleted = Boolean(message.deletedAt);
  const canEdit = (isMine || isAdmin) && !isDeleted;
  const canDelete = !isDeleted; // Expéditeur ou destinataire peuvent supprimer à tout moment
  const isEdited = Boolean(message.isEdited || (message.updatedAt && message.createdAt && message.updatedAt !== message.createdAt && !isDeleted));
  const isCallLog = message.type === 'CALL_LOG' || Boolean(message.callLog);

  // If this is a Call Log message (missed, received, outgoing, group call, audio or video)
  if (isCallLog) {
    const callLog = message.callLog;
    const isGroup = Boolean(callLog?.isGroup);
    const isVideo = callLog?.callMode === 'VIDEO' || Boolean(callLog?.isVideo);
    const isMissed = callLog?.status === 'MISSED' || (!isMine && (callLog?.status === 'REJECTED' || (callLog?.duration ?? 0) === 0));
    const duration = callLog?.duration || 0;
    const durationStr = duration > 0
      ? `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`
      : null;

    let title = isVideo ? 'Appel vidéo' : 'Appel vocal';
    let subtitle = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let icon = isVideo ? <VideoIcon className="w-5 h-5 text-blue-400" /> : <PhoneIncoming className="w-5 h-5 text-emerald-400" />;
    let cardBg = isVideo ? 'bg-blue-950/40 border-blue-500/30' : 'bg-slate-800/90 border-slate-700/80';
    let textTone = isVideo ? 'text-blue-200' : 'text-slate-200';

    if (isGroup) {
      title = `${isVideo ? 'Appel vidéo de groupe' : 'Appel vocal de groupe'} ${callLog?.groupName ? `• ${callLog.groupName}` : ''}`;
      icon = isVideo ? <VideoIcon className="w-5 h-5 text-indigo-400" /> : <Users className="w-5 h-5 text-indigo-400" />;
      cardBg = 'bg-indigo-950/40 border-indigo-500/30';
      textTone = 'text-indigo-200';
    } else if (isMissed) {
      title = isMine
        ? (isVideo ? 'Appel vidéo sans réponse' : 'Appel sortant sans réponse')
        : (isVideo ? 'Appel vidéo manqué' : 'Appel vocal manqué');
      icon = isMine
        ? (isVideo ? <VideoIcon className="w-5 h-5 text-amber-400" /> : <PhoneOutgoing className="w-5 h-5 text-amber-400" />)
        : (isVideo ? <VideoOff className="w-5 h-5 text-red-400" /> : <PhoneMissed className="w-5 h-5 text-red-400" />);
      cardBg = isMine ? 'bg-amber-950/30 border-amber-500/30' : 'bg-red-950/30 border-red-500/30';
      textTone = isMine ? 'text-amber-200' : 'text-red-200';
    } else if (isMine) {
      title = isVideo ? 'Appel vidéo sortant' : 'Appel vocal sortant';
      icon = isVideo ? <VideoIcon className="w-5 h-5 text-blue-400" /> : <PhoneOutgoing className="w-5 h-5 text-blue-400" />;
      cardBg = 'bg-blue-950/40 border-blue-500/30';
      textTone = 'text-blue-200';
    } else {
      title = isVideo ? 'Appel vidéo entrant' : 'Appel vocal entrant';
      icon = isVideo ? <VideoIcon className="w-5 h-5 text-emerald-400" /> : <PhoneIncoming className="w-5 h-5 text-emerald-400" />;
      cardBg = 'bg-emerald-950/40 border-emerald-500/30';
      textTone = 'text-emerald-200';
    }

    return (
      <div className="w-full flex justify-center my-2.5 px-4">
        <div className={`relative max-w-sm w-full rounded-2xl p-3.5 border shadow-lg backdrop-blur-sm flex items-center justify-between gap-3.5 transition-all ${cardBg}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-black/30 border border-white/10 shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold truncate ${textTone}`}>{title}</span>
                {isVideo && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    HD
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                {durationStr && (
                  <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                    {durationStr}
                  </span>
                )}
                <span>{subtitle}</span>
              </div>
            </div>
          </div>

          {/* Actions & Delete for Call Log */}
          <div className="flex items-center gap-1 shrink-0">
            {onCallBack && (
              <button
                onClick={() => {
                  const targetId = isMine ? (callLog?.receiverId || message.conversationId) : (callLog?.callerId || message.senderId);
                  onCallBack(targetId, isGroup, isVideo ? 'VIDEO' : 'AUDIO');
                }}
                className={`px-2.5 py-1.5 rounded-xl text-white font-medium text-xs flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                  isVideo ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
                title={isVideo ? "Rappeler en vidéo" : "Rappeler"}
              >
                {isVideo ? <VideoIcon className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5 fill-current" />}
                <span className="hidden sm:inline">Rappeler</span>
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowOptions(!showOptions)}
                title="Options"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-black/20 transition-colors cursor-pointer"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {showOptions && (
                <div
                  className="absolute z-20 top-7 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1 w-44 text-xs font-medium space-y-0.5 text-slate-200"
                  onMouseLeave={() => setShowOptions(false)}
                >
                  <button
                    onClick={() => {
                      onDeleteForMe(message.id);
                      setShowOptions(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-slate-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Supprimer pour moi</span>
                  </button>
                  <button
                    onClick={() => {
                      onDeleteForEveryone(message.id);
                      setShowOptions(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Supprimer pour tous</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex flex-col my-1 ${
        isMine ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender Name if not mine */}
      {!isMine && message.sender && (
        <span className="text-[10px] font-semibold text-slate-400 mb-1 ml-1">
          {message.sender.firstName} {message.sender.lastName}
        </span>
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-md transition-all ${
          isMine
            ? 'bg-blue-600 text-white rounded-br-xs'
            : 'bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/60'
        }`}
      >
        {/* Options Button */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          title="Options du message"
          className="absolute top-2 right-2 p-1 rounded-lg opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/20 text-slate-300 transition-opacity cursor-pointer z-10"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {/* Options Dropdown */}
        {showOptions && (
          <div
            className="absolute z-20 top-8 right-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1 w-48 text-xs font-medium space-y-0.5 text-slate-200"
            onMouseLeave={() => setShowOptions(false)}
          >
            <button
              onClick={() => {
                onReply(message);
                setShowOptions(false);
              }}
              className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left cursor-pointer"
            >
              <Reply className="w-3.5 h-3.5 text-blue-400" />
              <span>Répondre</span>
            </button>

            {/* Edit message option */}
            {canEdit && onEdit && message.content && (
              <button
                onClick={() => {
                  onEdit(message);
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-emerald-400 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Modifier le message</span>
              </button>
            )}

            {/* Transférer vers un contact */}
            {!isDeleted && onForward && (
              <button
                onClick={() => {
                  onForward(message);
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-slate-200 hover:text-indigo-400 cursor-pointer transition-colors"
                title="Transférer ce message ou fichier à un contact ou un groupe"
              >
                <Forward className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transférer vers un contact</span>
              </button>
            )}

            {/* Enregistrer */}
            {!isDeleted && (
              <button
                onClick={() => {
                  handleSaveInternal();
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-slate-200 hover:text-emerald-400 cursor-pointer transition-colors"
                title="Enregistrer et télécharger ce message ou fichier sur votre appareil"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Enregistrer</span>
              </button>
            )}

            {/* Supprimer pour moi (accessible à l'expéditeur et au destinataire) */}
            {canDelete && (
              <button
                onClick={() => {
                  onDeleteForMe(message.id);
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-slate-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Supprimer pour moi</span>
              </button>
            )}

            {/* Supprimer pour tous (accessible à l'expéditeur et au destinataire à tout moment) */}
            {canDelete && (
              <button
                onClick={() => {
                  onDeleteForEveryone(message.id);
                  setShowOptions(false);
                }}
                className="w-full px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Supprimer pour tous</span>
              </button>
            )}
          </div>
        )}

        {/* Reply To Reference */}
        {message.replyTo && (
          <div
            className={`mb-2 p-2 rounded-xl text-xs border-l-3 ${
              isMine
                ? 'bg-blue-700/50 border-blue-300 text-blue-100'
                : 'bg-slate-900/60 border-blue-500 text-slate-300'
            }`}
          >
            <div className="font-bold text-[11px]">{message.replyTo.senderName}</div>
            <div className="truncate opacity-80">{message.replyTo.content || `[${message.replyTo.type}]`}</div>
          </div>
        )}

        {/* Content body */}
        {isDeleted ? (
          <p className="text-xs italic opacity-70">Ce message a été supprimé.</p>
        ) : (
          <div className="space-y-2">
            {/* Attachment Display avec nom visible pour tout média */}
            {message.file && (
              <div className="rounded-xl overflow-hidden space-y-1.5">
                {/* Images */}
                {message.type === 'IMAGE' && (
                  <div className="space-y-1.5">
                    <div className="overflow-hidden rounded-xl bg-black/20">
                      <img
                        src={message.file.url}
                        alt={message.file.originalName || 'Image'}
                        onClick={() => setShowImageLightbox(true)}
                        className="max-h-64 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                      />
                    </div>
                    {/* Nom et détails du fichier image */}
                    <div
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${
                        isMine ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className={`${fileTextClass} truncate`} title={message.file.originalName}>
                          {message.file.originalName || 'Image'}
                        </span>
                        {message.file.size > 0 && (
                          <span className={`${subTextClass} opacity-70 shrink-0`}>
                            ({formatFileSize(message.file.size)})
                          </span>
                        )}
                      </div>
                      <a
                        href={message.file.url}
                        download={message.file.originalName || 'image'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Télécharger l'image"
                        className="p-1 rounded hover:bg-black/20 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Vidéos */}
                {message.type === 'VIDEO' && (
                  <div className="space-y-1.5">
                    <video
                      controls
                      src={message.file.url}
                      className="max-h-64 w-full rounded-xl bg-black"
                    />
                    {/* Nom et détails du fichier vidéo */}
                    <div
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${
                        isMine ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className={`${fileTextClass} truncate`} title={message.file.originalName}>
                          {message.file.originalName || 'Vidéo'}
                        </span>
                        {message.file.size > 0 && (
                          <span className={`${subTextClass} opacity-70 shrink-0`}>
                            ({formatFileSize(message.file.size)})
                          </span>
                        )}
                      </div>
                      <a
                        href={message.file.url}
                        download={message.file.originalName || 'video'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Télécharger la vidéo"
                        className="p-1 rounded hover:bg-black/20 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Audios / Vocaux / Fichiers MP3 */}
                {(message.type === 'AUDIO' ||
                  (message.type === 'FILE' &&
                    message.file &&
                    (message.file.mimeType?.startsWith('audio/') ||
                      /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(message.file.originalName || '')))) && (
                  <div className="space-y-1.5">
                    {/* Nom et détails du fichier audio */}
                    <div
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${
                        isMine ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className={`${fileTextClass} truncate`} title={message.file.originalName}>
                          {message.file.originalName || 'Fichier audio'}
                        </span>
                        {message.file.size > 0 && (
                          <span className={`${subTextClass} opacity-70 shrink-0`}>
                            ({formatFileSize(message.file.size)})
                          </span>
                        )}
                      </div>
                      <a
                        href={message.file.url}
                        download={message.file.originalName || 'audio.mp3'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Télécharger l'audio"
                        className="p-1 rounded hover:bg-black/20 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <VoiceNotePlayer
                      url={message.file.url}
                      isMine={isMine}
                      title={message.file.originalName}
                      size={message.file.size}
                    />
                  </div>
                )}

                {/* Documents / Autres Fichiers non-audio */}
                {message.type === 'FILE' &&
                  !(
                    message.file &&
                    (message.file.mimeType?.startsWith('audio/') ||
                      /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(message.file.originalName || ''))
                  ) && (
                  <a
                    href={message.file.url}
                    download={message.file.originalName}
                    target="_blank"
                    rel="noreferrer"
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isMine
                        ? 'bg-blue-700/60 hover:bg-blue-700'
                        : 'bg-slate-900/60 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className={`${fileTextClass} font-semibold truncate`} title={message.file.originalName}>
                          {message.file.originalName || 'Document'}
                        </div>
                        <div className={`${subTextClass} opacity-70`}>
                          {formatFileSize(message.file.size)}
                        </div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 shrink-0 opacity-80 hover:opacity-100 text-slate-200 hover:text-white" />
                  </a>
                )}
              </div>
            )}

            {/* Text Content with selected font size */}
            {message.content && (
              <p className={`${messageTextClass} whitespace-pre-wrap break-words leading-relaxed`}>
                {message.content}
              </p>
            )}
          </div>
        )}

        {/* Timestamp, modified indicator and Receipt */}
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
          {isEdited && (
            <span className="italic text-[9px] text-blue-200">modifié</span>
          )}
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {renderStatus()}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {showImageLightbox && message.file && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setShowImageLightbox(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={message.file.url}
            alt={message.file.originalName}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
