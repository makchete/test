import React, { useState, useEffect, useRef } from 'react';
import { User, AdminStats, AuditLog, AppSettings, Conversation } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { GroupInfoModal } from '../chat/GroupInfoModal';
import { notificationService } from '../../services/notificationService';
import {
  Users,
  MessageSquare,
  HardDrive,
  PhoneCall,
  Activity,
  Shield,
  Plus,
  Search,
  UserCheck,
  UserX,
  KeyRound,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Settings,
  FolderPlus,
  UserPlus,
  UserMinus,
  Check,
  Bell,
  BellRing,
  Volume2,
  Send,
  Sparkles,
  Server,
  Smartphone,
  Radio,
  Pencil,
  Phone,
  Upload,
  Camera,
  RotateCcw,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToChat: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToChat }) => {
  const { user: currentUser, updateUser, logout } = useAuth();
  const { appName, appLogoUrl, uploadLogo, resetLogo } = useBranding();
  const [activeTab, setActiveTab] = useState<'USERS' | 'GROUPS' | 'ACTIVITY' | 'SETTINGS'>('USERS');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [adminLoadError, setAdminLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Branding & Avatar Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAdminAvatar, setUploadingAdminAvatar] = useState(false);
  const [brandingNotice, setBrandingNotice] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPhone, setNewPhone] = useState('+228');
  const [newUsername, setNewUsername] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdNotice, setCreatedNotice] = useState<{ phone: string; username?: string; pass: string } | null>(null);

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER');
  const [editStatusMessage, setEditStatusMessage] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editPhoneChangedNotice, setEditPhoneChangedNotice] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Create Group Modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupAvatarUrl, setNewGroupAvatarUrl] = useState<string | null>(null);
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Notification and Server Alert Preferences
  const [soundEnabled, setSoundEnabled] = useState(notificationService.isSoundEnabled());
  const [browserNotifications, setBrowserNotifications] = useState(notificationService.isNotificationsEnabled());
  const [permission, setPermission] = useState<NotificationPermission>(notificationService.getPermission());
  const [testSent, setTestSent] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Selected Group for Management Modal
  const [selectedGroupForModal, setSelectedGroupForModal] = useState<Conversation | null>(null);

  // Load Admin Data
  const loadAdminData = async () => {
    setLoading(true);
    setAdminLoadError(null);
    try {
      const [statsRes, usersRes, groupsRes, logsRes, settingsRes] = await Promise.all([
        api.getAdminStats(),
        api.getUsers(),
        api.getAdminGroups(),
        api.getAuditLogs(),
        api.getSettings(),
      ]);

      setStats(statsRes.stats);
      setUsers(usersRes.users);
      setGroups(groupsRes.groups);
      setAuditLogs(logsRes.logs);
      setSettings(settingsRes.settings);
    } catch (err: any) {
      console.error('Erreur chargement données administration:', err);
      setAdminLoadError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      const res = await api.createUser({
        phone: newPhone.trim(),
        username: newUsername.trim() || undefined,
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        role: newRole,
      });

      setCreatedNotice({
        phone: res.initialCredentials.phone,
        username: res.initialCredentials.username,
        pass: res.initialCredentials.initialPassword,
      });

      // Reset form
      setNewPhone('+228');
      setNewUsername('');
      setNewFirstName('');
      setNewLastName('');

      loadAdminData();
    } catch (err: any) {
      setCreateError(err.message || 'Erreur lors de la création');
    }
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setEditPhone(user.phone || '');
    setEditUsername(user.username || '');
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditRole(user.role || 'USER');
    setEditStatusMessage(user.statusMessage || '');
    setEditError(null);
    setEditPhoneChangedNotice(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingEdit(true);
    setEditError(null);
    setEditPhoneChangedNotice(false);

    const isPhoneModified = editPhone.trim() !== editingUser.phone.trim();

    try {
      await api.updateUser(editingUser.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim(),
        username: editUsername.trim() || undefined,
        role: editRole,
        statusMessage: editStatusMessage.trim(),
      });

      if (isPhoneModified) {
        setEditPhoneChangedNotice(true);
      }

      loadAdminData();
      if (!isPhoneModified) {
        setEditingUser(null);
      }
    } catch (err: any) {
      setEditError(err.message || "Erreur lors de la modification de l'utilisateur.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setGroupCreateError('Le nom du groupe est obligatoire.');
      return;
    }
    if (selectedGroupMemberIds.length === 0) {
      setGroupCreateError('Veuillez sélectionner au moins un membre pour le groupe.');
      return;
    }

    setCreatingGroup(true);
    setGroupCreateError(null);
    try {
      await api.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        avatarUrl: newGroupAvatarUrl || undefined,
        memberUserIds: selectedGroupMemberIds,
      });

      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupAvatarUrl(null);
      setSelectedGroupMemberIds([]);
      loadAdminData();
    } catch (err: any) {
      setGroupCreateError(err.message || 'Erreur lors de la création du groupe');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: Conversation) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le groupe "${group.name}" ?`)) {
      try {
        await api.deleteConversation(group.id);
        loadAdminData();
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression du groupe');
      }
    }
  };

  const handleToggleActivate = async (user: User) => {
    try {
      if (user.isActive) {
        await api.deactivateUser(user.id);
      } else {
        await api.activateUser(user.id);
      }
      loadAdminData();
    } catch (err) {
      console.error('Erreur activation/désactivation:', err);
    }
  };

  const handleResetPassword = async (user: User) => {
    if (confirm(`Réinitialiser le mot de passe de ${user.firstName} ${user.lastName} ?`)) {
      try {
        const res = await api.resetUserPassword(user.id);
        alert(`Nouveau mot de passe temporaire pour ${user.firstName}: ${res.tempPassword}`);
        loadAdminData();
      } catch (err) {
        console.error('Erreur réinitialisation:', err);
      }
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Supprimer définitivement le compte de ${user.firstName} ${user.lastName} ?`)) {
      try {
        await api.deleteUser(user.id);
        loadAdminData();
      } catch (err: any) {
        alert(err.message || 'Erreur suppression');
      }
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    notificationService.setSoundEnabled(next);
  };

  const handleToggleNotifications = async () => {
    if (!browserNotifications) {
      if (permission !== 'granted') {
        const res = await notificationService.requestPermission();
        setPermission(res);
        if (res === 'granted') {
          setBrowserNotifications(true);
          notificationService.setNotificationsEnabled(true);
        } else {
          setBrowserNotifications(false);
          notificationService.setNotificationsEnabled(false);
        }
      } else {
        setBrowserNotifications(true);
        notificationService.setNotificationsEnabled(true);
      }
    } else {
      setBrowserNotifications(false);
      notificationService.setNotificationsEnabled(false);
    }
  };

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      setBrowserNotifications(true);
      notificationService.setNotificationsEnabled(true);
    }
  };

  const handleTestNotification = async () => {
    setTestSent(true);
    await notificationService.sendTestNotification();
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleAppLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBrandingError('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, WebP).');
      return;
    }
    setUploadingLogo(true);
    setBrandingError(null);
    try {
      await uploadLogo(file);
      setBrandingNotice("Logo officiel de l'application mis à jour avec succès !");
      setTimeout(() => setBrandingNotice(null), 4500);
      loadAdminData();
    } catch (err: any) {
      console.error('Erreur téléversement logo:', err);
      setBrandingError(err.message || 'Erreur lors du téléversement du logo.');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleResetAppLogo = async () => {
    if (!confirm('Réinitialiser le logo officiel par défaut de KOMECHAT ?')) return;
    setUploadingLogo(true);
    setBrandingError(null);
    try {
      await resetLogo();
      setBrandingNotice('Logo réinitialisé avec succès !');
      setTimeout(() => setBrandingNotice(null), 4000);
      loadAdminData();
    } catch (err: any) {
      console.error('Erreur réinitialisation logo:', err);
      setBrandingError(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAdminAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBrandingError('Veuillez sélectionner un fichier image valide pour votre photo de profil.');
      return;
    }
    setUploadingAdminAvatar(true);
    setBrandingError(null);
    try {
      const uploadRes = await api.uploadFile(file);
      const updateRes = await api.updateProfile({
        avatarUrl: uploadRes.file.url,
      });
      updateUser(updateRes.user);
      setBrandingNotice('Photo de profil administrateur mise à jour avec succès !');
      setTimeout(() => setBrandingNotice(null), 4500);
      loadAdminData();
    } catch (err: any) {
      console.error('Erreur mise à jour photo admin:', err);
      setBrandingError(err.message || 'Erreur lors du changement de photo de profil.');
    } finally {
      setUploadingAdminAvatar(false);
      if (adminAvatarInputRef.current) adminAvatarInputRef.current.value = '';
    }
  };

  const handleSetAdminAvatarToAppLogo = async () => {
    setUploadingAdminAvatar(true);
    setBrandingError(null);
    try {
      const updateRes = await api.updateProfile({
        avatarUrl: appLogoUrl || '/komechat_logo.jpg',
      });
      updateUser(updateRes.user);
      setBrandingNotice('Votre photo de profil est maintenant le logo officiel !');
      setTimeout(() => setBrandingNotice(null), 4500);
      loadAdminData();
    } catch (err: any) {
      console.error('Erreur définition logo comme avatar:', err);
      setBrandingError(err.message || 'Erreur lors de la mise à jour de la photo.');
    } finally {
      setUploadingAdminAvatar(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await api.updateSettings(settings);
      setSaveSuccessMsg('Paramètres du serveur et alertes enregistrés avec succès !');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      loadAdminData();
    } catch (err: any) {
      console.error('Erreur sauvegarde paramètres:', err);
      alert(err.message || 'Erreur lors de la sauvegarde');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      u.phone.includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 h-full min-h-[100dvh] overflow-y-auto flex flex-col">
      {/* Header Bar */}
      <div className="safe-top px-4 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shrink-0 min-h-[58px]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChat}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/95 border border-blue-500/30 p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
              <img src={appLogoUrl || '/komechat_logo.jpg'} alt={appName} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">{appName} - Administration</h1>
              <p className="text-xs text-slate-400">Gestion centralisée de la communauté privée</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="py-2.5 px-3.5 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Créer un groupe</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Créer un utilisateur</span>
            <span className="sm:hidden">Utilisateur</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
        {adminLoadError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-300 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{adminLoadError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadAdminData()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Réessayer
              </button>
              {adminLoadError.toLowerCase().includes('token') && (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Se reconnecter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Metric Cards Grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Membres</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">{stats.totalUsers}</div>
              <div className="text-[10px] text-emerald-400 font-medium">
                {stats.activeUsers} actifs
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>En Ligne</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400">{stats.onlineUsers}</div>
              <div className="text-[10px] text-slate-500">Présents en temps réel</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Groupes</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-indigo-400">{groups.length}</div>
              <div className="text-[10px] text-slate-500">Gérés par l'admin</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Messages</span>
                <MessageSquare className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">{stats.messagesToday}</div>
              <div className="text-[10px] text-slate-500">Envoyés aujourd'hui</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Appels Audio</span>
                <PhoneCall className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">{stats.callsToday}</div>
              <div className="text-[10px] text-slate-500">Aujourd'hui</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Stockage</span>
                <HardDrive className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-extrabold text-white">
                {(stats.storageUsedBytes / (1024 * 1024)).toFixed(1)} MB
              </div>
              <div className="text-[10px] text-slate-500">Espace utilisé</div>
            </div>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex border-b border-slate-800 text-xs font-bold gap-6">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`pb-3 transition-colors cursor-pointer ${
              activeTab === 'USERS'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Utilisateurs ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('GROUPS')}
            className={`pb-3 transition-colors cursor-pointer ${
              activeTab === 'GROUPS'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Groupes ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('ACTIVITY')}
            className={`pb-3 transition-colors cursor-pointer ${
              activeTab === 'ACTIVITY'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Journal d'activité ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SETTINGS'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Paramètres du serveur & Notifications</span>
          </button>
        </div>

        {/* Tab 1: User Management Table */}
        {activeTab === 'USERS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-4">
            {/* Search Filter */}
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou numéro..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Membre</th>
                    <th className="p-3">Téléphone & Identifiant</th>
                    <th className="p-3">Rôle</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Compte</th>
                    <th className="p-3">Dernière connexion</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center font-bold text-slate-200 text-xs shrink-0">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.firstName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{u.firstName.slice(0, 1)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <span>{u.firstName} {u.lastName}</span>
                          </div>
                          {u.statusMessage && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{u.statusMessage}</div>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-mono text-slate-200 text-xs">{u.phone}</div>
                        {u.username && (
                          <div className="text-[11px] font-mono text-blue-400">@{u.username}</div>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              u.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-600'
                            }`}
                          />
                          <span>{u.status === 'ONLINE' ? 'En ligne' : 'Hors ligne'}</span>
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                            u.isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {u.isActive ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>

                      <td className="p-3 text-slate-500 text-[11px]">
                        {new Date(u.lastSeenAt).toLocaleString()}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit User (including phone change) */}
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            title="Modifier les informations ou changer de numéro"
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Toggle Active */}
                          <button
                            onClick={() => handleToggleActivate(u)}
                            title={u.isActive ? 'Désactiver le compte' : 'Activer le compte'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              u.isActive
                                ? 'hover:bg-red-500/10 text-slate-400 hover:text-red-400'
                                : 'hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400'
                            }`}
                          >
                            {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => handleResetPassword(u)}
                            title="Réinitialiser le mot de passe"
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteUser(u)}
                            title="Supprimer l'utilisateur"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Group Management */}
        {activeTab === 'GROUPS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Filter */}
              <div className="relative max-w-sm flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Rechercher un groupe..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none"
                />
              </div>

              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-indigo-600/20"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Nouveau groupe</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Nom du groupe</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Membres</th>
                    <th className="p-3">Créé le</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {groups
                    .filter((g) =>
                      !groupSearchQuery
                        ? true
                        : (g.name || '').toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                          (g.description || '').toLowerCase().includes(groupSearchQuery.toLowerCase())
                    )
                    .map((grp) => (
                      <tr key={grp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-semibold text-slate-100 flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-500/30 flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0">
                            {grp.avatarUrl ? (
                              <img src={grp.avatarUrl} alt={grp.name || 'G'} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{grp.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">ID: {grp.id}</div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-400 max-w-xs truncate">
                          {grp.description || <span className="italic text-slate-600">Aucune description</span>}
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 w-fit">
                            <Users className="w-3 h-3" />
                            <span>{grp.members?.length || 0} membres</span>
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(grp.createdAt).toLocaleDateString([], {
                            dateStyle: 'medium',
                          })}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedGroupForModal(grp)}
                              title="Gérer les membres et détails"
                              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>Gérer membres</span>
                            </button>

                            <button
                              onClick={() => handleDeleteGroup(grp)}
                              title="Supprimer le groupe"
                              className="p-1.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                        Aucun groupe de discussion créé pour l'instant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Activity Logs */}
        {activeTab === 'ACTIVITY' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Horodatage</th>
                    <th className="p-3">Acteur</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Cible</th>
                    <th className="p-3">Adresse IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-slate-200">{log.actorName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {log.targetType} {log.targetId ? `(${log.targetId})` : ''}
                      </td>
                      <td className="p-3 text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: System Settings & Push Notifications */}
        {activeTab === 'SETTINGS' && settings && (
          <div className="max-w-4xl space-y-6">
            {brandingNotice && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in duration-200 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold">{brandingNotice}</span>
              </div>
            )}

            {brandingError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3 animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span className="font-semibold">{brandingError}</span>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in duration-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold">{saveSuccessMsg}</span>
              </div>
            )}

            {/* Row 1: App Logo & Admin Profile Photo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card A: Logo Officiel de l'Application */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Logo de l'application</h3>
                      <p className="text-[11px] text-slate-400">Identité visuelle visible sur la page de connexion et l'app</p>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleAppLogoFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Logo Preview */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
                    <div className="w-36 h-28 rounded-2xl bg-white/95 border border-blue-500/30 p-2 overflow-hidden flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0 relative group">
                      <img
                        src={appLogoUrl || '/komechat_logo.jpg'}
                        alt={appName}
                        className="w-full h-full object-contain"
                      />
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1 text-blue-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-[10px] text-slate-200">Téléversement...</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 text-center sm:text-left">
                      <div className="text-xs font-bold text-white">{appName}</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Le logo est diffusé en temps réel à tous les utilisateurs connectés.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploadingLogo ? 'Envoi en cours...' : "Téléverser un nouveau logo d'app"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAppLogo}
                    disabled={uploadingLogo}
                    className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rétablir le logo par défaut</span>
                  </button>
                </div>
              </div>

              {/* Card B: Photo de Profil de l'Administrateur */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Photo de profil Administrateur</h3>
                      <p className="text-[11px] text-slate-400">Votre avatar affiché dans les discussions et appels</p>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={adminAvatarInputRef}
                    onChange={handleAdminAvatarFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Admin Avatar Preview */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-purple-500/40 overflow-hidden flex items-center justify-center text-xl font-bold text-white shadow-xl relative shrink-0">
                        {uploadingAdminAvatar ? (
                          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-purple-400">
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </div>
                        ) : currentUser?.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt="Admin Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>
                            {currentUser?.firstName
                              ? currentUser.firstName.slice(0, 1).toUpperCase()
                              : 'A'}
                          </span>
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 p-1 bg-purple-600 rounded-full text-[10px] text-white border-2 border-slate-900 shadow">
                        <Shield className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="space-y-1 text-center sm:text-left">
                      <div className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                        <span>{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Administrateur'}</span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 text-[10px] font-bold border border-purple-700/50">
                          ADMIN
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {currentUser?.phone || ''}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Photo synchronisée sur tous vos appareils
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => adminAvatarInputRef.current?.click()}
                    disabled={uploadingAdminAvatar}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {uploadingAdminAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <span>{uploadingAdminAvatar ? 'Envoi en cours...' : 'Téléverser ma photo de profil'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSetAdminAvatarToAppLogo}
                    disabled={uploadingAdminAvatar}
                    className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-purple-300 hover:text-purple-200 rounded-xl text-xs font-medium border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Utiliser le logo de l'app comme photo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Push Notifications & Server Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Section 1: Push Notifications & Alertes Système */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Notifications Push & Alertes</h3>
                    <p className="text-[11px] text-slate-400">Préférences d'alertes navigateur & système</p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Statut du navigateur :</span>
                    {permission === 'granted' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" /> Autorisée
                      </span>
                    ) : permission === 'denied' ? (
                      <span className="text-red-400 font-bold flex items-center gap-1 bg-red-500/10 px-2.5 py-0.5 rounded-lg border border-red-500/20">
                        <AlertCircle className="w-3.5 h-3.5" /> Bloquée
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                        En attente
                      </span>
                    )}
                  </div>

                  {permission !== 'granted' && (
                    <button
                      onClick={handleRequestPermission}
                      className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Autoriser les notifications sur ce navigateur</span>
                    </button>
                  )}
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  {/* Push Notification Toggle */}
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-indigo-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Popups Push Système</div>
                        <div className="text-[10px] text-slate-500">Alertes sur écran même en arrière-plan</div>
                      </div>
                    </div>
                    <button
                      type="button"
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

                  {/* Sound Toggle */}
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">Sons & Carillons audio</div>
                        <div className="text-[10px] text-slate-500">Signal sonore aux messages et appels</div>
                      </div>
                    </div>
                    <button
                      type="button"
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
                </div>

                {/* Test Action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={testSent}
                    className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>{testSent ? 'Notification de test envoyée !' : 'Tester la notification Push maintenant'}</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Configuration Réseau & Serveur */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Configuration du serveur KOMECHAT</h3>
                      <p className="text-[11px] text-slate-400">Paramètres techniques et limites globales</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveSettings} id="server-settings-form" className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Taille maximale des fichiers autorisés</span>
                        <span className="text-blue-400 font-mono font-bold">{settings.maxFileSizeMb} MB</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={settings.maxFileSizeMb}
                        onChange={(e) =>
                          setSettings({ ...settings, maxFileSizeMb: parseInt(e.target.value, 10) || 50 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none transition-all font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Intervalle Heartbeat Présence</span>
                        <span className="text-blue-400 font-mono font-bold">{settings.heartbeatIntervalSec} sec</span>
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={settings.heartbeatIntervalSec}
                        onChange={(e) =>
                          setSettings({ ...settings, heartbeatIntervalSec: parseInt(e.target.value, 10) || 20 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none transition-all font-mono"
                      />
                    </div>

                    {/* Server status pills */}
                    <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Canal WebSocket temps réel :</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Opérationnel
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Service Worker PWA :</span>
                        <span className="text-indigo-300 font-medium">Actif (/sw.js)</span>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    form="server-settings-form"
                    className="w-full py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Sauvegarder les paramètres du serveur</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Créer un compte membre
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreatedNotice(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createdNotice ? (
              <div className="space-y-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                  <CheckCircle2 className="w-5 h-5" />
                  Compte créé avec succès !
                </div>
                <div className="space-y-1 font-mono text-slate-200 bg-slate-950 p-3 rounded-lg">
                  <div>Identifiant: {createdNotice.phone}</div>
                  <div>Mot de passe initial: {createdNotice.pass}</div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Transmettez ces identifiants au membre. Il pourra directement l'utiliser pour se connecter et pourra modifier son mot de passe dans ses réglages s'il le souhaite.
                </p>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedNotice(null);
                  }}
                  className="w-full py-2 bg-emerald-600 text-white font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Prénom</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    required
                    placeholder="Ex: David"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Nom</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    required
                    placeholder="Ex: Mensah"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Numéro de téléphone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    required
                    placeholder="+32484824481"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Nom d'utilisateur (Optionnel)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Ex: @nom_utilisateur</span>
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="@nom_utilisateur"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Rôle</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                  >
                    <option value="USER">Utilisateur standard</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    Créer le compte
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit User (Admin) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-400" />
                <span>Modifier l'utilisateur ({editingUser.firstName} {editingUser.lastName})</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editPhoneChangedNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Numéro mis à jour avec succès !</span>
                </div>
                <p className="text-[11px] text-emerald-300">
                  Tous les contacts de l'utilisateur ont été notifiés automatiquement. La discussion se poursuit sur le nouveau numéro.
                </p>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Prénom</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Nom</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                  />
                </div>
              </div>

              {/* Phone Number with continuous transfer notice */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    Numéro de téléphone
                  </span>
                  <span className="text-[10px] text-blue-400">Modifiable</span>
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                  placeholder="+32484824481"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono outline-none"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 Si vous modifiez le numéro de téléphone, une notification système est envoyée dans toutes ses conversations pour prévenir ses contacts.
                </p>
              </div>

              {/* Username (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Nom d'utilisateur (Optionnel)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Ex: @nom_utilisateur</span>
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="@nom_utilisateur"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono outline-none"
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Rôle système</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                >
                  <option value="USER">Utilisateur standard</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              {/* Status Message */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Statut personnel</label>
                <input
                  type="text"
                  value={editStatusMessage}
                  onChange={(e) => setEditStatusMessage(e.target.value)}
                  placeholder="Disponible, En réunion..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-blue-600/20"
                >
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Create Group (ADMIN SEUL) */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Créer un nouveau groupe</h3>
                  <p className="text-[11px] text-slate-400">
                    Seul l'administrateur peut créer des groupes et intégrer des membres.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setGroupCreateError(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {groupCreateError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{groupCreateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              {/* Group Avatar Selection */}
              <div className="flex items-center gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-500/40 flex items-center justify-center font-bold text-white shadow-md overflow-hidden shrink-0">
                  {newGroupAvatarUrl ? (
                    <img src={newGroupAvatarUrl} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Photo de profil du groupe (optionnelle)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const res = await api.uploadFile(file);
                          setNewGroupAvatarUrl(res.file.url);
                        } catch (err: any) {
                          setGroupCreateError(err.message || 'Erreur lors du téléversement de la photo');
                        }
                      }
                    }}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/30 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Nom du groupe *</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  placeholder="Ex: Équipe Direction, Département Projet..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Description (optionnelle)</label>
                <input
                  type="text"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Objectif ou sujet du groupe..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                />
              </div>

              {/* Members Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Sélectionner les membres à intégrer ({selectedGroupMemberIds.length} sélectionnés)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allActiveIds = users.filter((u) => u.isActive).map((u) => u.id);
                      if (selectedGroupMemberIds.length === allActiveIds.length) {
                        setSelectedGroupMemberIds([]);
                      } else {
                        setSelectedGroupMemberIds(allActiveIds);
                      }
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    {selectedGroupMemberIds.length === users.filter((u) => u.isActive).length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  {users
                    .filter((u) => u.isActive)
                    .map((u) => {
                      const isSelected = selectedGroupMemberIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedGroupMemberIds(selectedGroupMemberIds.filter((id) => id !== u.id));
                            } else {
                              setSelectedGroupMemberIds([...selectedGroupMemberIds, u.id]);
                            }
                          }}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                              : 'hover:bg-slate-900 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-200">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt={u.firstName} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <span>{u.firstName[0]}</span>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-semibold">{u.firstName} {u.lastName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{u.phone}</div>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-700 bg-slate-800 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || !newGroupName.trim() || selectedGroupMemberIds.length === 0}
                  className="py-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {creatingGroup ? (
                    <span>Création...</span>
                  ) : (
                    <>
                      <FolderPlus className="w-4 h-4" />
                      <span>Créer le groupe</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Info / Member Management Modal */}
      {selectedGroupForModal && (
        <GroupInfoModal
          conversationId={selectedGroupForModal.id}
          onClose={() => {
            setSelectedGroupForModal(null);
            loadAdminData();
          }}
          onGroupUpdated={() => {
            loadAdminData();
          }}
        />
      )}
    </div>
  );
};
