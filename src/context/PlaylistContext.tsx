import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { AudioTrack, PlaylistRepeatMode } from '../types';
import { api } from '../services/api';

interface PlaylistContextType {
  tracks: AudioTrack[];
  currentTrackIndex: number;
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: PlaylistRepeatMode;
  isShuffle: boolean;
  playbackRate: number;
  isPlayerOpen: boolean;
  isDockVisible: boolean;
  isUploading: boolean;
  setIsPlayerOpen: (open: boolean) => void;
  setIsDockVisible: (visible: boolean) => void;
  addTrack: (track: AudioTrack, autoPlay?: boolean) => void;
  addTracks: (newTracks: AudioTrack[], autoPlay?: boolean) => void;
  uploadAndAddTracks: (files: FileList | File[]) => Promise<number>;
  removeTrack: (id: string) => void;
  clearPlaylist: () => void;
  playTrack: (index: number) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  loadDemoTracks: () => void;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_TRACKS = 'komechat_mp3_playlist_tracks';
const LOCAL_STORAGE_KEY_REPEAT = 'komechat_mp3_playlist_repeat';
const LOCAL_STORAGE_KEY_SHUFFLE = 'komechat_mp3_playlist_shuffle';
const LOCAL_STORAGE_KEY_VOLUME = 'komechat_mp3_playlist_volume';

// High quality, royalty-free MP3 demo tracks for instant testing
const DEMO_TRACKS: AudioTrack[] = [
  {
    id: 'demo_1',
    title: 'Acoustic Breeze',
    artist: 'Benjamin Tissot',
    url: 'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
    duration: 157,
    source: 'default',
    addedAt: new Date().toISOString(),
  },
  {
    id: 'demo_2',
    title: 'Sunny Day',
    artist: 'Bensound',
    url: 'https://www.bensound.com/bensound-music/bensound-sunny.mp3',
    duration: 140,
    source: 'default',
    addedAt: new Date().toISOString(),
  },
  {
    id: 'demo_3',
    title: 'Energy Beat',
    artist: 'Bensound Production',
    url: 'https://www.bensound.com/bensound-music/bensound-energy.mp3',
    duration: 179,
    source: 'default',
    addedAt: new Date().toISOString(),
  },
];

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<AudioTrack[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TRACKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erreur chargement playlist localStorage:', e);
    }
    return DEMO_TRACKS;
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_VOLUME);
      if (saved !== null) return parseFloat(saved);
    } catch (_) {}
    return 0.85;
  });

  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Repeat Mode: 'OFF' -> 'ALL' (Boucle par ordre) -> 'ONE' (Boucle un titre)
  const [repeatMode, setRepeatMode] = useState<PlaylistRepeatMode>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_REPEAT);
      if (saved === 'ALL' || saved === 'ONE' || saved === 'OFF') return saved;
    } catch (_) {}
    return 'ALL'; // Par défaut en boucle par ordre comme demandé !
  });

  // Shuffle Mode: true / false
  const [isShuffle, setIsShuffle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SHUFFLE);
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return false;
  });

  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [isDockVisible, setIsDockVisible] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const currentTrackIndexRef = useRef(currentTrackIndex);
  currentTrackIndexRef.current = currentTrackIndex;

  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  const isShuffleRef = useRef(isShuffle);
  isShuffleRef.current = isShuffle;

  // Persist tracks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TRACKS, JSON.stringify(tracks));
    } catch (e) {
      console.warn('Erreur sauvegarde playlist:', e);
    }
  }, [tracks]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_REPEAT, repeatMode);
    } catch (_) {}
  }, [repeatMode]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SHUFFLE, String(isShuffle));
    } catch (_) {}
  }, [isShuffle]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_VOLUME, String(volume));
    } catch (_) {}
  }, [volume]);

  // Initialize and handle Audio Element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = isMuted ? 0 : volume;
    audio.playbackRate = playbackRate;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (audio.duration && isFinite(audio.duration) && audio.duration !== duration) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleError = (e: Event) => {
      console.warn('Erreur lecture audio:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('canplay', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const currentTrack = tracks[currentTrackIndex] || null;

  // Handle track ended event with Repeat & Shuffle logic
  const handleEnded = useCallback(() => {
    const allTracks = tracksRef.current;
    if (allTracks.length === 0) return;

    const currentMode = repeatModeRef.current;
    const shuffleActive = isShuffleRef.current;
    const currentIndex = currentTrackIndexRef.current;

    // 1. If Repeat ONE is active: loop current track indefinitely
    if (currentMode === 'ONE') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      return;
    }

    // 2. If Shuffle is active: choose next random track
    if (shuffleActive && allTracks.length > 1) {
      let nextIndex = Math.floor(Math.random() * allTracks.length);
      if (nextIndex === currentIndex) {
        nextIndex = (currentIndex + 1) % allTracks.length;
      }
      setCurrentTrackIndex(nextIndex);
      return;
    }

    // 3. Normal sequential order
    const nextIndex = currentIndex + 1;
    if (nextIndex < allTracks.length) {
      // Advance to next track in order
      setCurrentTrackIndex(nextIndex);
    } else {
      // Reached the end of the playlist
      if (currentMode === 'ALL') {
        // "Lecture en boucle par ordre" -> Loop back to 1st track
        setCurrentTrackIndex(0);
      } else {
        // "OFF" -> Stop playing at end
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      }
    }
  }, []);

  // Attach onended handler whenever handleEnded changes
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.onended = handleEnded;
  }, [handleEnded]);

  // When current track or index changes, load and play if needed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = tracks[currentTrackIndex];
    if (!track) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const wasPlaying = isPlaying;
    const srcNeedsUpdate = audio.src !== track.url && !audio.src.endsWith(track.url);

    if (srcNeedsUpdate) {
      audio.src = track.url;
      audio.load();
      setCurrentTime(0);
      setDuration(track.duration || 0);

      // Update MediaSession API for OS/Lockscreen controls
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist || 'KOMECHAT Music',
            album: 'Playlist MP3',
            artwork: [
              { src: '/komechat_logo.jpg', sizes: '192x192', type: 'image/jpeg' },
              { src: '/komechat_full.jpg', sizes: '512x512', type: 'image/jpeg' },
            ],
          });
        } catch (_) {}
      }

      if (wasPlaying) {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Autoplay prevented or audio load error:', err);
            setIsPlaying(false);
          });
      }
    }
  }, [currentTrackIndex, tracks]);

  // MediaSession Action Handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
        navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      } catch (_) {}
    }
  }, []);

  // Controls implementation
  const play = useCallback(() => {
    if (!audioRef.current) return;
    if (!tracks[currentTrackIndex]) return;

    audioRef.current.playbackRate = playbackRate;
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsDockVisible(true);
      })
      .catch((err) => console.error('Erreur lecture:', err));
  }, [tracks, currentTrackIndex, playbackRate]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const playTrack = useCallback(
    (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      setCurrentTrackIndex(index);
      setIsDockVisible(true);
      const audio = audioRef.current;
      if (audio) {
        audio.src = tracks[index].url;
        audio.playbackRate = playbackRate;
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    },
    [tracks, playbackRate]
  );

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) return;

    if (isShuffle && tracks.length > 1) {
      let rand = Math.floor(Math.random() * tracks.length);
      if (rand === currentTrackIndex) {
        rand = (currentTrackIndex + 1) % tracks.length;
      }
      playTrack(rand);
      return;
    }

    const nextIndex = currentTrackIndex + 1;
    if (nextIndex < tracks.length) {
      playTrack(nextIndex);
    } else {
      // Loop back to first track in order
      playTrack(0);
    }
  }, [tracks, currentTrackIndex, isShuffle, playTrack]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0) return;

    // If current song played more than 3 seconds, restart it
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (isShuffle && tracks.length > 1) {
      let rand = Math.floor(Math.random() * tracks.length);
      if (rand === currentTrackIndex) {
        rand = (currentTrackIndex - 1 + tracks.length) % tracks.length;
      }
      playTrack(rand);
      return;
    }

    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      playTrack(prevIndex);
    } else {
      // Loop back to last track
      playTrack(tracks.length - 1);
    }
  }, [tracks, currentTrackIndex, isShuffle, currentTime, playTrack]);

  const seek = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    const valid = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
    audioRef.current.currentTime = valid;
    setCurrentTime(valid);
  }, []);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volume;
      }
      return next;
    });
  }, [volume]);

  // Cycle Repeat Mode: OFF -> ALL -> ONE -> OFF
  const toggleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'OFF') return 'ALL'; // Lecture en boucle par ordre
      if (prev === 'ALL') return 'ONE'; // Lecture en boucle du titre
      return 'OFF';
    });
  }, []);

  // Toggle Shuffle Mode
  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  // Add individual track
  const addTrack = useCallback(
    (track: AudioTrack, autoPlay: boolean = false) => {
      setTracks((prev) => {
        // Prevent duplicate url
        if (prev.some((t) => t.url === track.url)) {
          return prev;
        }
        const updated = [...prev, track];
        if (autoPlay) {
          setTimeout(() => {
            playTrack(updated.length - 1);
          }, 50);
        }
        return updated;
      });
      setIsDockVisible(true);
    },
    [playTrack]
  );

  // Add multiple tracks
  const addTracks = useCallback(
    (newTracks: AudioTrack[], autoPlay: boolean = false) => {
      if (!newTracks || newTracks.length === 0) return;
      setTracks((prev) => {
        const existingUrls = new Set(prev.map((t) => t.url));
        const filtered = newTracks.filter((t) => !existingUrls.has(t.url));
        if (filtered.length === 0) return prev;
        const updated = [...prev, ...filtered];
        if (autoPlay) {
          setTimeout(() => {
            playTrack(prev.length);
          }, 50);
        }
        return updated;
      });
      setIsDockVisible(true);
    },
    [playTrack]
  );

  // Upload local MP3/audio files to server and add to playlist
  const uploadAndAddTracks = useCallback(
    async (files: FileList | File[]): Promise<number> => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return 0;

      setIsUploading(true);
      const added: AudioTrack[] = [];

      try {
        for (const file of fileList) {
          // Check if audio file
          const isAudio =
            file.type.startsWith('audio/') ||
            /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(file.name);

          if (!isAudio) continue;

          try {
            // Upload to server for persistent access
            const uploadRes = await api.uploadFile(file);
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '');

            const track: AudioTrack = {
              id: `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              title: cleanTitle,
              artist: 'Mon audio',
              url: uploadRes.file.url,
              size: file.size,
              source: 'upload',
              addedAt: new Date().toISOString(),
            };
            added.push(track);
          } catch (uploadErr) {
            console.warn('Échec upload serveur, utilisation blob URL local:', uploadErr);
            // Fallback to local Blob URL so the user can play right away
            const localUrl = URL.createObjectURL(file);
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
            const track: AudioTrack = {
              id: `track_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              title: cleanTitle,
              artist: 'Audio local',
              url: localUrl,
              size: file.size,
              source: 'upload',
              addedAt: new Date().toISOString(),
            };
            added.push(track);
          }
        }

        if (added.length > 0) {
          addTracks(added, false);
          return added.length;
        }
      } finally {
        setIsUploading(false);
      }
      return 0;
    },
    [addTracks]
  );

  // Remove track
  const removeTrack = useCallback(
    (id: string) => {
      setTracks((prev) => {
        const indexToRemove = prev.findIndex((t) => t.id === id);
        if (indexToRemove === -1) return prev;

        const updated = prev.filter((t) => t.id !== id);

        if (indexToRemove === currentTrackIndex) {
          if (updated.length === 0) {
            setCurrentTrackIndex(0);
            pause();
          } else {
            const nextIdx = indexToRemove >= updated.length ? updated.length - 1 : indexToRemove;
            setCurrentTrackIndex(nextIdx);
          }
        } else if (indexToRemove < currentTrackIndex) {
          setCurrentTrackIndex((curr) => curr - 1);
        }

        return updated;
      });
    },
    [currentTrackIndex, pause]
  );

  // Clear playlist
  const clearPlaylist = useCallback(() => {
    pause();
    setTracks([]);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setDuration(0);
  }, [pause]);

  // Load demo tracks
  const loadDemoTracks = useCallback(() => {
    addTracks(DEMO_TRACKS, false);
  }, [addTracks]);

  return (
    <PlaylistContext.Provider
      value={{
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
        addTracks,
        uploadAndAddTracks,
        removeTrack,
        clearPlaylist,
        playTrack,
        togglePlay,
        play,
        pause,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleRepeatMode,
        toggleShuffle,
        setPlaybackRate,
        loadDemoTracks,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylist = (): PlaylistContextType => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylist doit être utilisé à l\'intérieur de PlaylistProvider');
  }
  return context;
};
