import React, { useState, useEffect } from 'react';
import { Call, User, CallMode } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video as VideoIcon,
  VideoOff,
  Trash2,
  X,
  Clock,
  Calendar,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';

interface CallHistoryModalProps {
  onClose: () => void;
  onInitiateCall?: (targetUser: User, mode?: CallMode) => void;
}

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({
  onClose,
  onInitiateCall,
}) => {
  const { user } = useAuth();
  const { initiateCall } = useCall();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCallHistory();
      setCalls(res.calls);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de l\'historique');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteCall = async (callId: string) => {
    try {
      await api.deleteCall(callId);
      setCalls((prev) => prev.filter((c) => c.id !== callId));
    } catch (err: any) {
      alert(err.message || 'Impossible de supprimer cet appel');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Êtes-vous sûr de vouloir effacer tout l\'historique des appels ?')) return;
    try {
      await api.clearCallHistory();
      setCalls([]);
    } catch (err: any) {
      alert(err.message || 'Impossible d\'effacer l\'historique');
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Journal des appels</h2>
              <p className="text-xs text-slate-400">
                {calls.length} appel{calls.length > 1 ? 's' : ''} enregistré{calls.length > 1 ? 's' : ''} (audio & vidéo)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {calls.length > 0 && (
              <button
                onClick={handleClearAll}
                title="Effacer tout l'historique"
                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Effacer tout</span>
              </button>
            )}
            <button
              onClick={fetchHistory}
              title="Rafraîchir"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-2">
          {loading && calls.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Chargement de l'historique...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
              {error}
            </div>
          ) : calls.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <Phone className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Aucun appel dans l'historique</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Les appels audio et vidéo passés ou reçus s'afficheront ici avec leur statut, type et durée.
              </p>
            </div>
          ) : (
            calls.map((call) => {
              const isOutgoing = call.callerId === user?.id;
              const contactUser = isOutgoing ? call.receiver : call.caller;
              const isMissed = call.status === 'MISSED' || call.status === 'REJECTED';
              const callTime = call.startedAt || (call as any).createdAt;
              const duration = call.duration || (call as any).durationSeconds;
              const isVideo = call.callMode === 'VIDEO' || Boolean(call.isVideo);

              return (
                <div
                  key={call.id}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                        isMissed
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : isVideo
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          : isOutgoing
                          ? 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {isMissed ? (
                        isVideo ? <VideoOff className="w-5 h-5" /> : <PhoneMissed className="w-5 h-5" />
                      ) : isVideo ? (
                        <VideoIcon className="w-5 h-5" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing className="w-5 h-5" />
                      ) : (
                        <PhoneIncoming className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                        <span>
                          {contactUser
                            ? `${contactUser.firstName} ${contactUser.lastName}`
                            : call.groupName || 'Utilisateur inconnu'}
                        </span>

                        {isVideo && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Vidéo HD
                          </span>
                        )}

                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                            call.status === 'MISSED'
                              ? 'bg-red-500/20 text-red-300'
                              : call.status === 'REJECTED'
                              ? 'bg-amber-500/20 text-amber-300'
                              : call.status === 'ENDED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {call.status === 'MISSED'
                            ? 'Manqué'
                            : call.status === 'REJECTED'
                            ? 'Refusé'
                            : call.status === 'ENDED'
                            ? 'Terminé'
                            : call.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>
                            {callTime
                              ? new Date(callTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                              : ''}
                          </span>
                        </span>
                        {duration != null && duration > 0 && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{formatDuration(duration)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {contactUser && (
                      <>
                        <button
                          onClick={() => {
                            if (onInitiateCall) {
                              onInitiateCall(contactUser, 'AUDIO');
                            } else {
                              initiateCall(call.conversationId || '', contactUser, 'AUDIO');
                            }
                            onClose();
                          }}
                          title="Rappeler en audio"
                          className="p-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (onInitiateCall) {
                              onInitiateCall(contactUser, 'VIDEO');
                            } else {
                              initiateCall(call.conversationId || '', contactUser, 'VIDEO');
                            }
                            onClose();
                          }}
                          title="Rappeler en vidéo HD"
                          className="p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition-colors cursor-pointer"
                        >
                          <VideoIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteCall(call.id)}
                      title="Supprimer cet appel de l'historique"
                      className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
