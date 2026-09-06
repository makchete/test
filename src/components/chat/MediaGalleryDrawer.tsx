import React, { useState, useEffect } from 'react';
import { FileAttachment } from '../../types';
import { api } from '../../services/api';
import { usePlaylist } from '../../context/PlaylistContext';
import {
  X,
  Image,
  Video,
  FileText,
  Download,
  FolderOpen,
  Music,
  Plus,
  Play,
  ListMusic,
} from 'lucide-react';

interface MediaGalleryDrawerProps {
  conversationId: string;
  onClose: () => void;
}

export const MediaGalleryDrawer: React.FC<MediaGalleryDrawerProps> = ({
  conversationId,
  onClose,
}) => {
  const { addTrack, playTrack, tracks, setIsPlayerOpen } = usePlaylist();

  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MEDIA' | 'AUDIO' | 'FILES'>('MEDIA');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      try {
        const res = await api.getConversationMedia(conversationId);
        setFiles(res.files);
      } catch (err) {
        console.error('Erreur chargement médias:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [conversationId]);

  const mediaFiles = files.filter(
    (f) => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')
  );

  const audioFiles = files.filter(
    (f) =>
      f.mimeType.startsWith('audio/') ||
      /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.originalName || '')
  );

  const documentFiles = files.filter(
    (f) =>
      !f.mimeType.startsWith('image/') &&
      !f.mimeType.startsWith('video/') &&
      !f.mimeType.startsWith('audio/') &&
      !/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.originalName || '')
  );

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 animate-in fade-in duration-200"
      />

      {/* Drawer Container */}
      <div className="fixed md:relative inset-y-0 right-0 w-full sm:w-84 md:w-84 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-40 md:z-20 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-400" />
            Galerie & Fichiers
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('MEDIA')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'MEDIA'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-800/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Médias ({mediaFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUDIO')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'AUDIO'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Audios ({audioFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FILES')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'FILES'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-800/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Docs ({documentFiles.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Chargement...</div>
          ) : activeTab === 'MEDIA' ? (
            mediaFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">Aucun média partagé.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaFiles.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-blue-500/50 transition-all relative group"
                  >
                    {f.mimeType.startsWith('image/') ? (
                      <img src={f.url} alt={f.originalName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-950/40 text-purple-400">
                        <Video className="w-6 h-6" />
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )
          ) : activeTab === 'AUDIO' ? (
            audioFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <Music className="w-6 h-6 mx-auto opacity-40 text-emerald-400" />
                <p>Aucun fichier audio ou vocal partagé.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {audioFiles.map((f) => {
                  const isInPlaylist = tracks.some((t) => t.url === f.url);
                  return (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 flex items-center justify-between gap-2.5 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-200 truncate" title={f.originalName}>
                            {f.originalName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const trackItem = {
                              id: `chat_${f.id}`,
                              title: f.originalName.replace(/\.[^/.]+$/, ''),
                              artist: 'Discussion',
                              url: f.url,
                              size: f.size,
                              source: 'chat' as const,
                              addedAt: new Date().toISOString(),
                            };
                            addTrack(trackItem, true);
                            setIsPlayerOpen(true);
                          }}
                          title="Écouter dans le lecteur"
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 cursor-pointer transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>

                        <button
                          type="button"
                          disabled={isInPlaylist}
                          onClick={() => {
                            const trackItem = {
                              id: `chat_${f.id}`,
                              title: f.originalName.replace(/\.[^/.]+$/, ''),
                              artist: 'Discussion',
                              url: f.url,
                              size: f.size,
                              source: 'chat' as const,
                              addedAt: new Date().toISOString(),
                            };
                            addTrack(trackItem, false);
                            showToast('Ajouté à la playlist !');
                          }}
                          title={isInPlaylist ? 'Déjà dans la playlist' : 'Ajouter à la playlist MP3'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isInPlaylist
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                          }`}
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={f.url}
                          download={f.originalName}
                          target="_blank"
                          rel="noreferrer"
                          title="Télécharger l'audio"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : documentFiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">Aucun document partagé.</div>
          ) : (
            <div className="space-y-2">
              {documentFiles.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  download={f.originalName}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 flex items-center justify-between gap-2 group transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate">{f.originalName}</div>
                      <div className="text-[10px] text-slate-500">
                        {(f.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-400 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
