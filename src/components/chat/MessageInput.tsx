import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageType } from '../../types';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { usePlaylist } from '../../context/PlaylistContext';
import {
  Send,
  Paperclip,
  Smile,
  X,
  FileText,
  Loader2,
  Mic,
  Trash2,
  Edit3,
  Check,
  Music,
  Video,
  ListMusic,
  ChevronRight,
  Plus,
  FolderPlus,
  ChevronDown,
} from 'lucide-react';

interface MessageInputProps {
  conversationId: string;
  replyingTo: Message | null;
  onClearReply: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onMessageSent: () => void;
}

const COMMON_EMOJIS = ['😊', '👍', '❤️', '🔥', '👏', '🎉', '🤝', '🙌', '🙏', '💯', '👋', '✅', '🤣', '😍', '😭', '💩'];

export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  replyingTo,
  onClearReply,
  editingMessage,
  onCancelEdit,
  onMessageSent,
}) => {
  const { socket, isConnected, sendSocketMessage, sendEditMessage, sendTyping, sendStopTyping } = useSocket();
  const { addTrack, uploadAndAddTracks, setIsPlayerOpen } = usePlaylist();

  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const playlistInputRef = useRef<HTMLInputElement>(null);

  const attachMenuRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Escape key to close open popovers
  useEffect(() => {
    const handleKeyEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAttachMenu(false);
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener('keydown', handleKeyEsc);
    return () => window.removeEventListener('keydown', handleKeyEsc);
  }, []);

  // Click-outside listener for "Joindre des fichiers" sub-menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node) &&
        attachButtonRef.current &&
        !attachButtonRef.current.contains(event.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };

    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showAttachMenu]);

  // When editing message changes, update text and focus
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || '');
      setSelectedFile(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [editingMessage]);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle text typing
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Trigger typing event
    sendTyping(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping(conversationId);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxMb = 50;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`Le fichier sélectionné (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de ${maxMb} Mo.`);
        if (e.target) e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxMb = 50;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`Le fichier audio (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de ${maxMb} Mo.`);
        if (e.target) e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxMb = 100;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`La vidéo (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de ${maxMb} Mo.`);
        if (e.target) e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxMb = 50;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`Le document (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de ${maxMb} Mo.`);
        if (e.target) e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handlePlaylistFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        await uploadAndAddTracks(e.target.files);
        setIsPlayerOpen(true);
      } catch (err) {
        console.error('Erreur importation morceaux playlist:', err);
      }
      if (e.target) e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Votre navigateur ne prend pas en charge l\'enregistrement audio.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Erreur accès microphone:', err);
      alert('Impossible d\'accéder au microphone. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current) return;

    setSendingAudio(true);
    const recorder = mediaRecorderRef.current;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (timerRef.current) clearInterval(timerRef.current);

    const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    setIsRecording(false);

    if (audioBlob.size === 0) {
      setSendingAudio(false);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const vocalName = `Note_vocale_${timeStr}.webm`;
    const audioFile = new File([audioBlob], vocalName, {
      type: audioBlob.type || 'audio/webm',
    });

    try {
      const uploadRes = await api.uploadFile(audioFile);
      const audioPayload = {
        conversationId,
        content: '',
        replyToId: replyingTo ? replyingTo.id : null,
        file: uploadRes.file,
        fileId: uploadRes.file?.id,
        type: 'AUDIO' as const,
      };

      if (socket && isConnected) {
        sendSocketMessage(audioPayload);
      } else {
        await api.sendMessage(audioPayload);
      }

      onClearReply();
      onMessageSent();
    } catch (err: any) {
      console.error('Erreur envoi audio:', err);
      const msg = err?.message && (err.message.includes('<!doctype') || err.message.includes('Unexpected token') || err.message.includes('JSON'))
        ? 'Erreur lors de l\'envoi du vocal : réponse inattendue du serveur.'
        : (err?.message || 'Échec de l\'envoi du message vocal.');
      alert(msg);
    } finally {
      setSendingAudio(false);
      setRecordingTime(0);
      audioChunksRef.current = [];
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const handleSend = async () => {
    if (!text.trim() && !selectedFile) return;

    setUploading(true);
    sendStopTyping(conversationId);

    try {
      if (editingMessage) {
        // We are in edit mode
        const newContent = text.trim();
        await api.editMessage(editingMessage.id, newContent);
        sendEditMessage(editingMessage.id, conversationId, newContent);

        setText('');
        if (onCancelEdit) onCancelEdit();
        onMessageSent();
        return;
      }

      let fileAttachment = null;
      if (selectedFile) {
        const uploadRes = await api.uploadFile(selectedFile);
        fileAttachment = uploadRes.file;
      }

      const msgType: MessageType = fileAttachment
        ? fileAttachment.mimeType.startsWith('image/')
          ? 'IMAGE'
          : fileAttachment.mimeType.startsWith('video/')
          ? 'VIDEO'
          : fileAttachment.mimeType.startsWith('audio/')
          ? 'AUDIO'
          : 'FILE'
        : 'TEXT';

      const payload = {
        conversationId,
        content: text.trim(),
        replyToId: replyingTo ? replyingTo.id : null,
        file: fileAttachment,
        fileId: fileAttachment ? fileAttachment.id : undefined,
        type: msgType,
      };

      // Send via socket for instant sync, with HTTP fallback if offline/disconnected
      if (socket && isConnected) {
        sendSocketMessage(payload);
      } else {
        await api.sendMessage({
          conversationId,
          content: text.trim(),
          replyToId: replyingTo ? replyingTo.id : null,
          fileId: fileAttachment ? fileAttachment.id : null,
          type: msgType,
        });
      }

      // Clear input state
      setText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
      onClearReply();
      onMessageSent();
    } catch (err: any) {
      console.error('Erreur lors de l\'envoi:', err);
      const userMessage = err?.message && (err.message.includes('<!doctype') || err.message.includes('Unexpected token') || err.message.includes('JSON'))
        ? 'Erreur lors de l\'envoi : réponse inattendue du serveur. Veuillez réessayer.'
        : (err?.message || 'Impossible d\'envoyer le message.');
      alert(userMessage);
    } finally {
      setUploading(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-2 sm:p-3 border-t border-slate-800/80 bg-slate-900/95 backdrop-blur-md relative">
      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="mb-2 p-2 rounded-xl bg-emerald-950/60 border-l-4 border-l-emerald-500 border-slate-700/80 flex items-center justify-between text-xs text-emerald-200 shadow-md">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Edit3 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-emerald-400">Modification du message :</span>
              <p className="truncate opacity-80 text-slate-300">{editingMessage.content}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setText('');
              if (onCancelEdit) onCancelEdit();
            }}
            title="Annuler la modification"
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && !editingMessage && (
        <div className="mb-2 p-2 rounded-xl bg-slate-800/90 border-l-4 border-l-blue-500 border-slate-700/80 flex items-center justify-between text-xs text-slate-300 shadow-md">
          <div className="min-w-0 pr-2">
            <span className="font-bold text-blue-400">
              Réponse à {replyingTo.sender?.firstName || 'Message'} :
            </span>
            <p className="truncate opacity-80">{replyingTo.content || `[${replyingTo.type}]`}</p>
          </div>
          <button
            onClick={onClearReply}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && !editingMessage && (
        <div className="mb-2 p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs text-slate-200 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFile.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(selectedFile.name) ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Music className="w-4 h-4" />
              </div>
            ) : selectedFile.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(selectedFile.name) ? (
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <span className="truncate font-semibold block text-slate-100">{selectedFile.name}</span>
              <span className="opacity-70 text-[10px] text-slate-400">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(selectedFile.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(selectedFile.name)) && (
              <button
                type="button"
                onClick={() => {
                  const tempTrack = {
                    id: `chat_preview_${Date.now()}`,
                    title: selectedFile.name.replace(/\.[^/.]+$/, ''),
                    artist: 'Fichier local',
                    url: URL.createObjectURL(selectedFile),
                    size: selectedFile.size,
                    source: 'chat' as const,
                    addedAt: new Date().toISOString(),
                  };
                  addTrack(tempTrack, false);
                  alert('Morceau ajouté à votre playlist MP3 !');
                }}
                title="Ajouter aussi à la Playlist MP3"
                className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ListMusic className="w-3 h-3" />
                <span>+ Playlist MP3</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (audioInputRef.current) audioInputRef.current.value = '';
                if (videoInputRef.current) videoInputRef.current.value = '';
                if (docInputRef.current) docInputRef.current.value = '';
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker(false);
            }}
          />
          <div className="absolute bottom-full mb-3 left-2 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-50 grid grid-cols-6 gap-2 animate-in fade-in zoom-in-95 duration-150">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="p-2 hover:bg-slate-800 rounded-xl text-lg transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Attachment Sub-menus Popover (4 options: Audio, Vidéo, Document, Playlist) */}
      {showAttachMenu && !editingMessage && (
        <>
          {/* Transparent / subtle backdrop overlay that catches clicks outside reliably */}
          <div
            id="attach-menu-backdrop"
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px] sm:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setShowAttachMenu(false);
            }}
          />

          {/* Submenus floating card cleanly placed right above the input bar */}
          <div
            id="attachment-submenus-popover"
            ref={attachMenuRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-3 left-2 sm:left-4 z-50 w-76 sm:w-84 max-w-[calc(100vw-1.5rem)] bg-slate-900/98 backdrop-blur-xl border border-blue-500/40 rounded-2xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150 space-y-1.5"
          >
            <div className="px-2.5 py-1.5 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FolderPlus className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Joindre des fichiers
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                  4 sous-menus
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachMenu(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Ajouter un audio */}
            <button
              id="btn-attach-audio"
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                audioInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all shadow-sm">
                <Music className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <span>Ajouter un audio</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Audio</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  MP3, WAV, AAC, vocal (max 50 Mo)
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* 2. Ajouter une vidéo */}
            <button
              id="btn-attach-video"
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                videoInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:text-slate-950 transition-all shadow-sm">
                <Video className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-100 group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                  <span>Ajouter une vidéo</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">Vidéo</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  MP4, WebM, MOV HD (max 100 Mo)
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* 3. Ajouter un document */}
            <button
              id="btn-attach-document"
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                docInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-slate-950 transition-all shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  <span>Ajouter un document</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">Doc</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  PDF, Word, Excel, ZIP, TXT
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* 4. Ajouter une playlist */}
            <div className="pt-1.5 border-t border-slate-800/80">
              <button
                id="btn-attach-playlist"
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  setIsPlayerOpen(true);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-sm">
                  <ListMusic className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber-300 group-hover:text-amber-200 flex items-center gap-1.5">
                    <span>Ajouter une playlist</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 font-mono font-extrabold">
                      MP3
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300/80 truncate">
                    Lecteur, boucle par ordre & aléatoire
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Quick action to import multiple MP3 files straight into the playlist */}
              <div className="mt-1.5 flex items-center justify-between px-2 py-0.5">
                <button
                  id="btn-import-mp3-quick"
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    playlistInputRef.current?.click();
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Importer des fichiers MP3 dans la playlist</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Hidden File Inputs for the 4 sub-menus */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
      />
      <input
        type="file"
        ref={audioInputRef}
        onChange={handleAudioSelect}
        className="hidden"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoSelect}
        className="hidden"
        accept="video/*,.mp4,.mov,.webm,.mkv,.avi"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.tar,.gz,.csv,application/*"
      />
      <input
        type="file"
        ref={playlistInputRef}
        onChange={handlePlaylistFilesSelect}
        className="hidden"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
      />

      {/* Audio Recording Bar (WhatsApp / Telegram style) */}
      {isRecording ? (
        <div className="flex items-center gap-2 bg-slate-950 border border-red-500/30 rounded-2xl px-3 py-2 animate-fadeIn shadow-lg">
          {/* Pulsing red dot + timer */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs font-mono font-bold text-red-400 min-w-[36px]">
              {formatTime(recordingTime)}
            </span>
          </div>

          {/* Animated Waveform Bars */}
          <div className="flex-1 flex items-center justify-center gap-1 px-2 h-6 overflow-hidden">
            {[40, 70, 30, 90, 60, 100, 40, 80, 50, 90, 30, 70, 100, 60, 40, 80].map((h, idx) => (
              <div
                key={idx}
                className="w-1 bg-red-500/70 rounded-full animate-pulse"
                style={{
                  height: `${Math.max(20, (h * (1 + (idx % 3) * 0.2))) % 100}%`,
                  animationDuration: `${0.4 + (idx % 4) * 0.2}s`,
                }}
              />
            ))}
          </div>

          {/* Delete / Cancel Recording button */}
          <button
            onClick={cancelRecording}
            disabled={sendingAudio}
            title="Annuler l'enregistrement"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Stop & Send Recording Button */}
          <button
            onClick={stopAndSendRecording}
            disabled={sendingAudio}
            title="Envoyer la note vocale"
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
          >
            {sendingAudio ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      ) : (
        /* Standard WhatsApp-style Input Bar */
        <div className="flex items-center gap-2">
          {/* Main Input Pill Bar */}
          <div className={`flex-1 flex items-center gap-1.5 bg-slate-950 border ${editingMessage ? 'border-emerald-500/70' : 'border-slate-800 focus-within:border-blue-500/70'} rounded-2xl px-2.5 py-1.5 transition-all shadow-inner`}>
            {/* Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Insérer un émoji"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors cursor-pointer shrink-0"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* 1. Bouton "Fichier rapide" (renommé du bouton joindre un fichier) */}
            {!editingMessage && (
              <button
                id="btn-fichier-rapide"
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  fileInputRef.current?.click();
                }}
                title="Fichier rapide (Sélection directe d'un fichier)"
                aria-label="Fichier rapide"
                className="p-1.5 px-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 text-xs"
              >
                <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-[11px] whitespace-nowrap hidden min-[480px]:inline">
                  Fichier rapide
                </span>
              </button>
            )}

            {/* 2. Nouveau bouton "Joindre des fichiers" avec les sous-menus dedans */}
            {!editingMessage && (
              <button
                id="btn-joindre-des-fichiers"
                ref={attachButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAttachMenu((prev) => !prev);
                  setShowEmojiPicker(false);
                }}
                title="Joindre des fichiers (Audio, Vidéo, Document, Playlist)"
                aria-label="Joindre des fichiers"
                aria-expanded={showAttachMenu}
                className={`p-1.5 px-2.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold border shadow-sm ${
                  showAttachMenu
                    ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30'
                    : 'text-slate-200 hover:text-white bg-blue-950/40 hover:bg-blue-900/50 border-blue-500/40'
                }`}
              >
                <FolderPlus className="w-4 h-4 text-blue-400 group-hover:text-white shrink-0" />
                <span className="font-bold text-[11px] whitespace-nowrap">
                  Joindre des fichiers
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAttachMenu ? 'rotate-180 text-white' : 'text-blue-300'}`} />
              </button>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? 'Modifier votre message...' : 'Message...'}
              rows={1}
              className="flex-1 bg-transparent py-1 px-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none resize-none max-h-28 leading-relaxed"
            />
          </div>

          {/* Action Button: Checkmark/Send if editing or text/file present */}
          {editingMessage ? (
            <button
              onClick={handleSend}
              disabled={uploading || !text.trim()}
              title="Valider la modification"
              className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-transform active:scale-95 shadow-lg shadow-emerald-600/30 disabled:opacity-40 cursor-pointer shrink-0 flex items-center justify-center"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
            </button>
          ) : text.trim() || selectedFile ? (
            <button
              onClick={handleSend}
              disabled={uploading}
              title="Envoyer"
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-transform active:scale-95 shadow-lg shadow-blue-600/30 disabled:opacity-40 cursor-pointer shrink-0 flex items-center justify-center"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button
              onClick={startRecording}
              title="Enregistrer un vocal (Cliquer pour démarrer)"
              className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-transform active:scale-95 shadow-lg shadow-emerald-600/30 cursor-pointer shrink-0 flex items-center justify-center"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

