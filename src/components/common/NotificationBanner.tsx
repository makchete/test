import React, { useState, useEffect } from 'react';
import { notificationService } from '../../services/notificationService';
import { BellRing, X, Check, ShieldAlert, Sparkles } from 'lucide-react';

export const NotificationBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (notificationService.isSupported()) {
      const perm = notificationService.getPermission();
      setPermissionState(perm);
      // Demander l'activation dès l'ouverture si non activée (perm !== 'granted')
      if (perm !== 'granted') {
        setShow(true);
      }
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await notificationService.requestPermission();
      setPermissionState(res);
      if (res === 'granted') {
        setShow(false);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissSession = () => {
    setShow(false);
  };

  if (!show || permissionState === 'granted') return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-slate-900 border border-blue-500/40 p-6 rounded-3xl shadow-2xl shadow-blue-950/60 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Activer les notifications</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-semibold">Important</span>
              </h3>
              <p className="text-xs text-slate-400">Pour ne manquer aucun message ni appel</p>
            </div>
          </div>
          <button
            onClick={handleDismissSession}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="Ignorer pour l'instant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Recevez des alertes sonores et visuelles instantanées sur votre appareil dès la réception d'un nouveau message.</span>
          </div>
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Restez joignable même lorsque votre application est fermée ou en arrière-plan.</span>
          </div>
        </div>

        {permissionState === 'denied' && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              Les notifications sont actuellement bloquées par votre navigateur. Cliquez sur l'icône de cadenas 🔒 à gauche de la barre d'adresse pour autoriser les notifications, puis actualisez.
            </span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            onClick={handleDismissSession}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Ignorer pour cette session
          </button>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{loading ? 'Activation...' : 'Activer les notifications'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
