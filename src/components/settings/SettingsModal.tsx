import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFontSize, ChatFontSize } from '../../context/FontSizeContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { notificationService } from '../../services/notificationService';
import { api } from '../../services/api';
import { HostingStorageDetails, UserPreferences } from '../../types';
import {
  Settings,
  Moon,
  Bell,
  BellRing,
  KeyRound,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Send,
  Database,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  FileCheck,
  Cloud,
  CheckCircle2,
  Globe,
  Type,
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { fontSize, setFontSize, messageTextClass } = useFontSize();
  const [activeTab, setActiveTab] = useState<'PREFERENCES' | 'BACKUP' | 'PASSWORD'>('PREFERENCES');

  const [soundEnabled, setSoundEnabled] = useState(notificationService.isSoundEnabled());
  const [browserNotifications, setBrowserNotifications] = useState(notificationService.isNotificationsEnabled());
  const [permission, setPermission] = useState<NotificationPermission>(notificationService.getPermission());
  const [testSent, setTestSent] = useState(false);

  const [storageDetails, setStorageDetails] = useState<HostingStorageDetails | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');

  useEffect(() => {
    setPermission(notificationService.getPermission());
    fetchStorageStats();
  }, []);

  const fetchStorageStats = async () => {
    try {
      setLoadingStorage(true);
      const res = await api.getStorageStats();
      setStorageDetails(res.storage);
    } catch (err) {
      console.error('Erreur stockage:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    notificationService.setSoundEnabled(next);
    try {
      setSyncStatus('SAVING');
      await api.updatePreferences({ soundEnabled: next });
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleNotifications = async () => {
    let nextVal = false;
    if (!browserNotifications) {
      if (permission !== 'granted') {
        const res = await notificationService.requestPermission();
        setPermission(res);
        if (res === 'granted') {
          nextVal = true;
          setBrowserNotifications(true);
          notificationService.setNotificationsEnabled(true);
        } else {
          nextVal = false;
          setBrowserNotifications(false);
          notificationService.setNotificationsEnabled(false);
        }
      } else {
        nextVal = true;
        setBrowserNotifications(true);
        notificationService.setNotificationsEnabled(true);
      }
    } else {
      nextVal = false;
      setBrowserNotifications(false);
      notificationService.setNotificationsEnabled(false);
    }

    try {
      setSyncStatus('SAVING');
      await api.updatePreferences({ notificationsEnabled: nextVal });
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestNotification = async () => {
    setTestSent(true);
    await notificationService.sendTestNotification();
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleExportData = async () => {
    try {
      await api.exportMyData();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors du téléchargement.');
    }
  };

  const handleImportDataFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportMessage(null);
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await api.importMyData(json);
      setImportMessage(res.message || 'Données restaurées avec succès !');
      fetchStorageStats();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la lecture du fichier de sauvegarde.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">{t.settings.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('PREFERENCES')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'PREFERENCES'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-800/40 rounded-t-xl'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.settings.tabPreferences}
          </button>
          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'BACKUP'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-800/40 rounded-t-xl'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.settings.tabBackup}
          </button>
          <button
            onClick={() => setActiveTab('PASSWORD')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'PASSWORD'
                ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-800/40 rounded-t-xl'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.settings.tabSecurity}
          </button>
        </div>

        {/* Tab 1: Preferences & Cross-device sync */}
        {activeTab === 'PREFERENCES' && (
          <div className="space-y-4 py-1">
            {/* Cloud Sync Status */}
            <div className="p-3 rounded-2xl bg-blue-950/30 border border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-4 h-4 text-blue-400" />
                <div className="text-xs text-blue-200">
                  {t.settings.cloudSyncActive}
                </div>
              </div>
              {syncStatus === 'SAVING' ? (
                <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" /> {t.settings.cloudSyncSaving}
                </span>
              ) : syncStatus === 'SAVED' ? (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3" /> {t.settings.cloudSyncSaved}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">{t.settings.allDevicesSynced}</span>
              )}
            </div>

            {/* Language Selection Section */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">{t.settings.languageSectionTitle}</div>
                  <div className="text-[10px] text-slate-500">{t.settings.languageSectionSubtitle}</div>
                </div>
              </div>
              <LanguageSelector variant="cards" />
            </div>

            {/* Apparence */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">{t.settings.darkMode}</div>
                  <div className="text-[10px] text-slate-500">{t.settings.darkModeSubtitle}</div>
                </div>
              </div>
              <span className="text-xs text-blue-400 font-semibold flex items-center gap-1 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                <Check className="w-3.5 h-3.5" /> {t.settings.activeBadge}
              </span>
            </div>

            {/* Taille des écritures dans les discussions */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Type className="w-5 h-5 text-indigo-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{t.settings.fontSizeTitle}</div>
                    <div className="text-[10px] text-slate-500">{t.settings.fontSizeSubtitle}</div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  {fontSize === 'small'
                    ? t.settings.fontSizeSmall
                    : fontSize === 'large'
                    ? t.settings.fontSizeLarge
                    : fontSize === 'xlarge'
                    ? t.settings.fontSizeXLarge
                    : t.settings.fontSizeNormal}
                </span>
              </div>

              {/* Sélecteur de tailles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'small' as const, label: t.settings.fontSizeSmall, sizePx: '13px' },
                  { key: 'medium' as const, label: t.settings.fontSizeNormal, sizePx: '15px' },
                  { key: 'large' as const, label: t.settings.fontSizeLarge, sizePx: '17px' },
                  { key: 'xlarge' as const, label: t.settings.fontSizeXLarge, sizePx: '19px' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={async () => {
                      setSyncStatus('SAVING');
                      await setFontSize(opt.key);
                      setSyncStatus('SAVED');
                      setTimeout(() => setSyncStatus('IDLE'), 1500);
                    }}
                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center border transition-all cursor-pointer ${
                      fontSize === opt.key
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm ring-1 ring-blue-500/50 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 font-medium'
                    }`}
                  >
                    <span className="text-xs">{opt.label}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">{opt.sizePx}</span>
                  </button>
                ))}
              </div>

              {/* Aperçu interactif en direct */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {t.settings.fontSizePreview}
                </div>
                <div className="rounded-xl p-3 bg-blue-600 text-white max-w-[92%] ml-auto shadow-sm">
                  <p className={messageTextClass}>
                    {t.settings.fontSizePreviewText}
                  </p>
                  <div className="text-[10px] text-blue-200 text-right mt-1 font-medium">12:30 ✓✓</div>
                </div>
              </div>
            </div>

            {/* Sons */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">{t.settings.soundNotification}</div>
                  <div className="text-[10px] text-slate-500">{t.settings.soundNotificationSubtitle}</div>
                </div>
              </div>
              <button
                onClick={handleToggleSound}
                className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                  soundEnabled ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notifications Push */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BellRing className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{t.settings.systemPushNotifications}</div>
                    <div className="text-[10px] text-slate-500">
                      {t.settings.systemPushNotificationsSubtitle}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    browserNotifications && permission === 'granted' ? 'bg-emerald-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      browserNotifications && permission === 'granted' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Status information badge */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                <span className="text-slate-400">{t.settings.browserStatus}</span>
                {permission === 'granted' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> {t.settings.allowed}
                  </span>
                ) : permission === 'denied' ? (
                  <span className="text-red-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {t.settings.blockedInBrowser}
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold">{t.settings.waitingPermission}</span>
                )}
              </div>

              {permission === 'granted' && (
                <div className="pt-2">
                  <button
                    onClick={handleTestNotification}
                    disabled={testSent}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{testSent ? t.settings.testPushSent : t.settings.testPushBtn}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Storage & Backup / Restore */}
        {activeTab === 'BACKUP' && (
          <div className="space-y-4 py-1">
            {/* Storage Quota Card (50 GB) */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-xs font-bold text-white">{t.settings.storageTitle}</div>
                    <div className="text-[10px] text-slate-400">{t.settings.storageCapacity}</div>
                  </div>
                </div>
                <button
                  onClick={fetchStorageStats}
                  disabled={loadingStorage}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Actualiser"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStorage ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>

              {/* Progress bar */}
              {storageDetails && (
                <div className="space-y-2">
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(1, storageDetails.usedPercentage)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {formatBytes(storageDetails.totalUsedBytes)} {t.settings.used} ({storageDetails.usedPercentage}%)
                    </span>
                    <span className="font-semibold text-slate-300">
                      {formatBytes(storageDetails.freeBytes)} {t.settings.freeOn50GB}
                    </span>
                  </div>

                  {/* Storage breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-[10px]">
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-400">{t.settings.photosImages}</span>
                      <span className="font-bold text-slate-200 ml-1">
                        {formatBytes(storageDetails.breakdown.imagesBytes)} ({storageDetails.counts.imagesCount})
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-400">{t.settings.voiceNotesAudio}</span>
                      <span className="font-bold text-slate-200 ml-1">
                        {formatBytes(storageDetails.breakdown.voiceNotesAudioBytes)} ({storageDetails.counts.voiceNotesCount})
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-400">{t.settings.videos}</span>
                      <span className="font-bold text-slate-200 ml-1">
                        {formatBytes(storageDetails.breakdown.videosBytes)} ({storageDetails.counts.videosCount})
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-400">{t.settings.filesAndDb}</span>
                      <span className="font-bold text-slate-200 ml-1">
                        {formatBytes(storageDetails.breakdown.documentsFilesBytes + storageDetails.breakdown.messagesAndDbBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Export & Import actions */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                {t.settings.backupTitle}
              </div>
              <p className="text-[11px] text-slate-400">
                {t.settings.backupDesc}
              </p>

              {importMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{importMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Export Button */}
                <button
                  onClick={handleExportData}
                  className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>{t.settings.exportMyData}</span>
                </button>

                {/* Import File Button */}
                <label className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>{importing ? t.settings.importing : t.settings.importData}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportDataFile}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Password */}
        {activeTab === 'PASSWORD' && (
          <ChangePasswordModal forced={false} onClose={onClose} />
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
          >
            {t.settings.close}
          </button>
        </div>
      </div>
    </div>
  );
};


