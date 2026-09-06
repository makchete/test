import React, { useState, useRef, useEffect } from 'react';
import { usePlaylist } from '../../context/PlaylistContext';
import { api } from '../../services/api';
import { Conversation, FileAttachment } from '../../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  ListMusic,
  Upload,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Music,
  Plus,
  Radio,
  Clock,
  Sparkles,
  Download,
  FolderOpen,
} from 'lucide-react';

interface PlaylistPlayerProps {
  conversations?: Conversation[];
}

export const PlaylistPlayer: React.FC<PlaylistPlayerProps> = ({ conversations = [] }) => {
  const {
    tracks,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    playbackRate,
    isPlayerOpen,
    isDockVisible,
    isUploading,
    setIsPlayerOpen,
    setIsDockVisible,
    addTrack,
    uploadAndAddTracks,
    removeTrack,
    clearPlaylist,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleRepeatMode,
    toggleShuffle,
    setPlaybackRate,
    loadDemoTracks,
  } = usePlaylist();

  const [activeTab, setActiveTab] = useState<'TRACKS' | 'IMPORT'>('TRACKS');
  const [chatAudios, setChatAudios] = useState<FileAttachment[]>([]);
  const [loadingChatAudios, setLoadingChatAudios] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Handle file selection from disk
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const count = await uploadAndAddTracks(files);
      if (count > 0) {
        showToast(`${count} morceau(x) MP3 ajouté(s) à la playlist !`);
      }
    } catch (err: any) {
      alert('Erreur lors de l\'ajout des fichiers MP3 : ' + (err?.message || 'Erreur'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Drag and Drop files
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    try {
      const count = await uploadAndAddTracks(e.dataTransfer.files);
      if (count > 0) {
        showToast(`${count} morceau(x) ajouté(s) à la playlist !`);
      }
    } catch (err: any) {
      alert('Erreur lors du dépôt de fichier : ' + (err?.message || 'Erreur'));
    }
  };

  // Fetch audios from all conversations for importing
  const fetchAllChatAudios = async () => {
    if (conversations.length === 0) return;
    setLoadingChatAudios(true);
    try {
      const allFiles: FileAttachment[] = [];
      // Fetch media from top 10 conversations
      for (const conv of conversations.slice(0, 10)) {
        try {
          const res = await api.getConversationMedia(conv.id);
          const audios = res.files.filter(
            (f) =>
              f.mimeType.startsWith('audio/') ||
              /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.originalName || '')
          );
          allFiles.push(...audios);
        } catch (_) {}
      }

      // De-duplicate by URL
      const unique = allFiles.filter(
        (file, idx, self) => idx === self.findIndex((f) => f.url === file.url)
      );
      setChatAudios(unique);
    } catch (err) {
      console.warn('Erreur chargement audios des discussions:', err);
    } finally {
      setLoadingChatAudios(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'IMPORT') {
      fetchAllChatAudios();
    }
  }, [activeTab, conversations]);

  // If no tracks exist and not open, hide dock
  if (tracks.length === 0 && !isPlayerOpen) {
    return null;
  }

  // Progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden file input for uploading MP3s */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* ========================================================================= */}
      {/* 1. MINI DOCKED BAR (Floating cleanly above bottom bar without covering chat) */}
      {/* ========================================================================= */}
      {isDockVisible && !isPlayerOpen && (
        <div
          id="mp3-playlist-mini-dock"
          className="fixed bottom-20 right-2 sm:right-6 z-40 max-w-[calc(100vw-1rem)] bg-slate-900/98 border border-slate-700/90 backdrop-blur-xl px-3 sm:px-4 py-2 rounded-2xl flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xl shadow-black/50 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {/* Track Info & Artwork */}
          <div
            onClick={() => setIsPlayerOpen(true)}
            className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[200px] sm:max-w-xs cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform overflow-hidden relative">
              <Music className={`w-4.5 h-4.5 ${isPlaying ? 'animate-pulse' : ''}`} />
              {isPlaying && (
                <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-100 truncate group-hover:text-emerald-400 transition-colors">
                {currentTrack ? currentTrack.title : 'Aucune piste'}
              </div>
              <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                <span>{currentTrack?.artist || 'Playlist MP3'}</span>
                <span>•</span>
                <span className="font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Repeat Mode Quick Toggle */}
            <button
              type="button"
              onClick={toggleRepeatMode}
              title={
                repeatMode === 'ALL'
                  ? 'Lecture en boucle par ordre activée'
                  : repeatMode === 'ONE'
                  ? 'Lecture en boucle de ce titre activée'
                  : 'Répétition désactivée'
              }
              className={`p-1.5 rounded-xl transition-all cursor-pointer relative ${
                repeatMode !== 'OFF'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {repeatMode === 'ONE' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
              {repeatMode === 'ALL' && (
                <span className="absolute -top-1 -right-1 px-1 bg-emerald-500 text-[8px] font-extrabold text-slate-950 rounded-full">
                  Ordre
                </span>
              )}
              {repeatMode === 'ONE' && (
                <span className="absolute -top-1 -right-1 px-1 bg-emerald-500 text-[8px] font-extrabold text-slate-950 rounded-full">
                  1
                </span>
              )}
            </button>

            {/* Shuffle Quick Toggle */}
            <button
              type="button"
              onClick={toggleShuffle}
              title={isShuffle ? 'Lecture aléatoire activée' : 'Lecture normale dans l\'ordre'}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                isShuffle
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Previous */}
            <button
              type="button"
              onClick={prevTrack}
              title="Piste précédente"
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Lecture'}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={nextTrack}
              title="Piste suivante"
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Open Full Playlist Modal */}
            <button
              type="button"
              onClick={() => setIsPlayerOpen(true)}
              title="Ouvrir la playlist complète"
              className="p-1.5 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-slate-800 cursor-pointer flex items-center gap-1 transition-colors border border-slate-700/60"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span className="text-xs font-bold hidden sm:inline">Playlist ({tracks.length})</span>
            </button>

            {/* Dismiss Mini Dock */}
            <button
              type="button"
              onClick={() => setIsDockVisible(false)}
              title="Masquer le mini-lecteur"
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer transition-colors ml-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FULL PLAYLIST MODAL & ADVANCED PLAYER DIALOG                           */}
      {/* ========================================================================= */}
      {isPlayerOpen && (
        <div
          id="mp3-playlist-modal-backdrop"
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            id="mp3-playlist-modal"
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                  <ListMusic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Playlist MP3 & Lecteur Audio</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                      {tracks.length} titre{tracks.length > 1 ? 's' : ''}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Options de lecture en boucle par ordre et lecture aléatoire
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Importation...' : 'Ajouter MP3'}</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsPlayerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fermer la vue détaillée (la musique continue)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Current Playing Hero Deck */}
            <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-b border-slate-800 shrink-0">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                {/* Visual Album Artwork / Equalizer */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-800 p-0.5 shadow-xl shadow-emerald-950/50 flex items-center justify-center shrink-0 relative overflow-hidden group">
                  <div className="w-full h-full rounded-2xl bg-slate-900/60 flex flex-col items-center justify-center gap-1">
                    <Music className={`w-8 h-8 ${isPlaying ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                    {/* Equalizer animation bars */}
                    <div className="flex items-end gap-1 h-3">
                      {[40, 90, 60, 100, 70, 30].map((h, i) => (
                        <span
                          key={i}
                          className={`w-1 rounded-full ${isPlaying ? 'bg-emerald-400' : 'bg-slate-600'} transition-all`}
                          style={{
                            height: isPlaying ? `${h}%` : '20%',
                            transitionDuration: '300ms',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Track Details & Scrubber */}
                <div className="flex-1 w-full min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-white truncate" title={currentTrack?.title}>
                        {currentTrack ? currentTrack.title : 'Aucune piste sélectionnée'}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {currentTrack?.artist || 'Morceau audio'}
                      </p>
                    </div>
                    {/* Speed rate button */}
                    <button
                      type="button"
                      onClick={() => {
                        const nextRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
                        setPlaybackRate(nextRate);
                      }}
                      title="Vitesse de lecture"
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-[11px] cursor-pointer"
                    >
                      {playbackRate}x
                    </button>
                  </div>

                  {/* Range Scrubber */}
                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => seek(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 appearance-none rounded-lg cursor-pointer accent-emerald-400 hover:accent-emerald-300"
                    />
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Playback Controls Row */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
                {/* Left: Shuffle & Repeat buttons */}
                <div className="flex items-center gap-2">
                  {/* Shuffle Button */}
                  <button
                    type="button"
                    onClick={toggleShuffle}
                    title={isShuffle ? 'Lecture aléatoire activée (cliquer pour ordre normal)' : 'Activer la lecture aléatoire'}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isShuffle
                        ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>{isShuffle ? 'Aléatoire' : 'Ordre'}</span>
                  </button>

                  {/* Repeat Mode Button */}
                  <button
                    type="button"
                    onClick={toggleRepeatMode}
                    title={
                      repeatMode === 'ALL'
                        ? 'Lecture en boucle par ordre activée (toute la playlist tourne en boucle)'
                        : repeatMode === 'ONE'
                        ? 'Lecture en boucle de ce titre activée'
                        : 'Répétition désactivée (s\'arrête à la fin de la playlist)'
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      repeatMode === 'ALL'
                        ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : repeatMode === 'ONE'
                        ? 'bg-amber-600/25 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                    }`}
                  >
                    {repeatMode === 'ONE' ? (
                      <Repeat1 className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Repeat className={`w-3.5 h-3.5 ${repeatMode === 'ALL' ? 'text-emerald-400' : ''}`} />
                    )}
                    <span>
                      {repeatMode === 'ALL'
                        ? 'Boucle par ordre'
                        : repeatMode === 'ONE'
                        ? 'Boucle ce titre'
                        : 'Sans boucle'}
                    </span>
                  </button>
                </div>

                {/* Center: Prev, Play/Pause, Next */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={prevTrack}
                    title="Piste précédente"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
                    title={isPlaying ? 'Pause' : 'Lecture'}
                    className="p-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={nextTrack}
                    title="Piste suivante"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Right: Volume & Mute */}
                <div className="flex items-center gap-2 min-w-[120px]">
                  <button
                    type="button"
                    onClick={toggleMute}
                    title={isMuted ? 'Activer le son' : 'Couper le son'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 sm:w-24 h-1.5 bg-slate-800 appearance-none rounded-lg cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Pistes vs Import depuis discussions) */}
            <div className="flex items-center border-b border-slate-800 bg-slate-900/60 shrink-0 text-xs font-semibold px-4">
              <button
                type="button"
                onClick={() => setActiveTab('TRACKS')}
                className={`py-3 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  activeTab === 'TRACKS'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListMusic className="w-4 h-4" />
                <span>Titres de la playlist ({tracks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('IMPORT')}
                className={`py-3 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  activeTab === 'IMPORT'
                    ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Depuis les discussions ({chatAudios.length})</span>
              </button>

              <div className="flex-1" />

              {/* Actions: Clear or Load Demos */}
              {tracks.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Voulez-vous vraiment vider toute la playlist ?')) {
                      clearPlaylist();
                      showToast('Playlist vidée.');
                    }
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Vider</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    loadDemoTracks();
                    showToast('Morceaux de démonstration chargés !');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-500/10 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Charger démos</span>
                </button>
              )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeTab === 'TRACKS' ? (
                <>
                  {/* Drag & drop upload target box */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
                    }`}
                  >
                    <Upload className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
                    <p className="text-xs font-bold text-slate-200">
                      Déposez vos fichiers MP3 ou cliquez pour parcourir
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Formats supportés : MP3, M4A, WAV, AAC, OGG, FLAC
                    </p>
                  </div>

                  {/* Empty state */}
                  {tracks.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
                        <Music className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-400">Votre playlist MP3 est actuellement vide.</p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Ajouter des MP3
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            loadDemoTracks();
                            showToast('Morceaux de démonstration chargés !');
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          Charger des démos
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {tracks.map((track, idx) => {
                        const isCurrent = idx === currentTrackIndex;
                        return (
                          <div
                            key={track.id}
                            onClick={() => playTrack(idx)}
                            className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                              isCurrent
                                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Track number or Playing icon */}
                              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                                {isCurrent ? (
                                  isPlaying ? (
                                    <div className="flex items-end gap-0.5 h-3">
                                      <span className="w-0.5 bg-emerald-400 h-full animate-bounce" />
                                      <span className="w-0.5 bg-emerald-400 h-2/3 animate-bounce delay-75" />
                                      <span className="w-0.5 bg-emerald-400 h-4/5 animate-bounce delay-150" />
                                    </div>
                                  ) : (
                                    <Play className="w-3.5 h-3.5 text-emerald-400 ml-0.5 fill-current" />
                                  )
                                ) : (
                                  <span className="text-[11px] font-mono text-slate-500 group-hover:hidden">
                                    {idx + 1}
                                  </span>
                                )}
                                {!isCurrent && (
                                  <Play className="w-3.5 h-3.5 text-slate-300 hidden group-hover:block ml-0.5" />
                                )}
                              </div>

                              {/* Title and details */}
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-xs font-bold truncate ${
                                    isCurrent ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'
                                  }`}
                                  title={track.title}
                                >
                                  {track.title}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-2">
                                  <span>{track.artist || 'Audio'}</span>
                                  {track.duration && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono">{formatTime(track.duration)}</span>
                                    </>
                                  )}
                                  {track.source === 'upload' && (
                                    <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px]">
                                      Téléversé
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions: Download / Remove */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a
                                href={track.url}
                                download={`${track.title}.mp3`}
                                target="_blank"
                                rel="noreferrer"
                                title="Télécharger le fichier audio"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => removeTrack(track.id)}
                                title="Retirer de la playlist"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* IMPORT FROM CHAT AUDIOS TAB */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Importez en un clic les audios partagés dans vos conversations :
                    </p>
                    {chatAudios.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const converted = chatAudios.map((f) => ({
                            id: `chat_${f.id}`,
                            title: f.originalName.replace(/\.[^/.]+$/, ''),
                            artist: 'Audio Discussion',
                            url: f.url,
                            size: f.size,
                            source: 'chat' as const,
                            addedAt: new Date().toISOString(),
                          }));
                          uploadAndAddTracks([]).then(() => {
                            // add all
                          });
                          converted.forEach((t) => addTrack(t));
                          showToast(`${converted.length} audios importés dans la playlist !`);
                          setActiveTab('TRACKS');
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                      >
                        Tout importer ({chatAudios.length})
                      </button>
                    )}
                  </div>

                  {loadingChatAudios ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Recherche des audios partagés...
                    </div>
                  ) : chatAudios.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                      <Music className="w-8 h-8 mx-auto opacity-40" />
                      <p>Aucun fichier audio ou vocal trouvé dans les conversations récentes.</p>
                      <p className="text-[11px] text-slate-600">
                        Envoyez des fichiers MP3 ou des messages vocaux dans le chat pour les voir ici !
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {chatAudios.map((file) => {
                        const isAlreadyInPlaylist = tracks.some((t) => t.url === file.url);
                        return (
                          <div
                            key={file.id}
                            className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                <Music className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-200 truncate" title={file.originalName}>
                                  {file.originalName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {(file.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isAlreadyInPlaylist}
                              onClick={() => {
                                addTrack({
                                  id: `chat_${file.id}`,
                                  title: file.originalName.replace(/\.[^/.]+$/, ''),
                                  artist: 'Discussion KOMECHAT',
                                  url: file.url,
                                  size: file.size,
                                  source: 'chat',
                                  addedAt: new Date().toISOString(),
                                });
                                showToast(`"${file.originalName}" ajouté à la playlist !`);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                isAlreadyInPlaylist
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isAlreadyInPlaylist ? 'Déjà ajouté' : 'Ajouter'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Info */}
            <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Mode boucle actuel :{' '}
                  <strong className="text-slate-200">
                    {repeatMode === 'ALL'
                      ? 'Boucle par ordre (rejoue toute la playlist)'
                      : repeatMode === 'ONE'
                      ? 'Boucle ce titre uniquement'
                      : 'Arrêt en fin de liste'}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPlayerOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Réduire le lecteur
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
