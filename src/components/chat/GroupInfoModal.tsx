import React, { useState, useEffect, useRef } from 'react';
import { Conversation, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import { api } from '../../services/api';
import {
  X,
  Users,
  UserPlus,
  Trash2,
  Phone,
  Shield,
  Search,
  Check,
  AlertCircle,
  Camera,
  Loader2,
  Edit2,
  Save,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface GroupInfoModalProps {
  conversationId?: string;
  conversation?: Conversation;
  onClose: () => void;
  onGroupUpdated?: () => void;
  onUpdateConversation?: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  conversationId,
  conversation,
  onClose,
  onGroupUpdated,
  onUpdateConversation,
}) => {
  const { user } = useAuth();
  const { userPresenceMap } = useSocket();
  const { initiateGroupCall } = useCall();

  const targetId = conversationId || conversation?.id;

  const [groupDetails, setGroupDetails] = useState<Conversation | null>(conversation || null);
  const [loading, setLoading] = useState(!conversation);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Group Photo Upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Name & Description state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Add Members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIdsToAdd, setSelectedUserIdsToAdd] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  // Load group details
  const fetchGroupDetails = async () => {
    if (!targetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getConversationById(targetId);
      setGroupDetails(res.conversation);
      setEditName(res.conversation.name || '');
      setEditDescription(res.conversation.description || '');
    } catch (err: any) {
      console.error('Erreur chargement détails groupe:', err);
      setError(err.message || 'Impossible de charger les détails du groupe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetId) {
      fetchGroupDetails();
    }
  }, [targetId]);

  // Load candidate users for adding to group
  const loadUsersForAdd = async () => {
    try {
      const res = await api.getUsers();
      // Filter out users already in the group
      const existingMemberIds = (groupDetails?.members || []).map((m) => m.userId);
      const candidates = res.users.filter(
        (u) => u.isActive && !existingMemberIds.includes(u.id)
      );
      setAllUsers(candidates);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

  useEffect(() => {
    if (showAddMembers) {
      loadUsersForAdd();
    }
  }, [showAddMembers, groupDetails?.members]);

  const notifyUpdates = () => {
    if (onGroupUpdated) onGroupUpdated();
    if (onUpdateConversation) onUpdateConversation();
  };

  // Group Photo Upload Handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupDetails) return;

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner un fichier image valide.');
      return;
    }

    try {
      setUploadingPhoto(true);
      setError(null);
      const uploadRes = await api.uploadFile(file);
      const newAvatarUrl = uploadRes.file.url;

      // Update group with new avatar
      const updateRes = await api.updateGroup(groupDetails.id, {
        avatarUrl: newAvatarUrl,
      });

      setGroupDetails((prev) => (prev ? { ...prev, avatarUrl: newAvatarUrl } : updateRes.conversation));
      setSuccessMsg('Photo du groupe mise à jour avec succès !');
      setTimeout(() => setSuccessMsg(null), 3500);
      notifyUpdates();
    } catch (err: any) {
      console.error('Erreur téléversement photo groupe:', err);
      setError(err.message || 'Erreur lors du changement de la photo de profil.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove Group Photo
  const handleRemovePhoto = async () => {
    if (!groupDetails) return;
    try {
      setUploadingPhoto(true);
      setError(null);
      const updateRes = await api.updateGroup(groupDetails.id, {
        avatarUrl: null as any,
      });
      setGroupDetails((prev) => (prev ? { ...prev, avatarUrl: null } : updateRes.conversation));
      setSuccessMsg('Photo du groupe supprimée.');
      setTimeout(() => setSuccessMsg(null), 3000);
      notifyUpdates();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression de la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Save Name & Description
  const handleSaveInfo = async () => {
    if (!groupDetails || !editName.trim()) return;
    try {
      setSavingInfo(true);
      setError(null);
      const res = await api.updateGroup(groupDetails.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setGroupDetails(res.conversation);
      setIsEditingInfo(false);
      setSuccessMsg('Informations du groupe modifiées !');
      setTimeout(() => setSuccessMsg(null), 3000);
      notifyUpdates();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour des informations.');
    } finally {
      setSavingInfo(false);
    }
  };

  // Add Members to Group
  const handleAddMembersSubmit = async () => {
    if (!groupDetails || selectedUserIdsToAdd.length === 0) return;
    try {
      setAddingMembers(true);
      setError(null);
      const res = await api.addGroupMembers(groupDetails.id, selectedUserIdsToAdd);
      setGroupDetails(res.conversation);
      setSelectedUserIdsToAdd([]);
      setShowAddMembers(false);
      setSuccessMsg(`${selectedUserIdsToAdd.length} membre(s) ajouté(s) au groupe.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      notifyUpdates();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout des membres.");
    } finally {
      setAddingMembers(false);
    }
  };

  // Remove Member from Group
  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!groupDetails) return;
    if (!confirm(`Êtes-vous certain de vouloir retirer ${memberName} de ce groupe ?`)) return;

    try {
      setError(null);
      const res = await api.removeGroupMember(groupDetails.id, memberUserId);
      setGroupDetails(res.conversation);
      setSuccessMsg(`${memberName} a été retiré du groupe.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      notifyUpdates();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du retrait du membre.');
    }
  };

  // Group Call trigger
  const handleStartGroupCall = () => {
    if (!groupDetails) return;
    onClose();
    initiateGroupCall(groupDetails);
  };

  const members = groupDetails?.members || [];
  const filteredMembers = members.filter((m) => {
    const u = m.user;
    if (!u) return false;
    const q = searchMemberQuery.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Informations & Membres du groupe
              </h2>
              <p className="text-xs text-slate-400">
                {groupDetails ? `${members.length} membre${members.length > 1 ? 's' : ''}` : 'Chargement...'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs">Chargement des données du groupe...</p>
            </div>
          ) : groupDetails ? (
            <>
              {/* Group Profile Card */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5 relative">
                {/* Avatar with Photo Upload Button */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-indigo-500/60 overflow-hidden flex items-center justify-center font-bold text-3xl text-white shadow-xl shadow-indigo-600/20">
                    {groupDetails.avatarUrl ? (
                      <img
                        src={groupDetails.avatarUrl}
                        alt={groupDetails.name || 'Groupe'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{groupDetails.name ? groupDetails.name.slice(0, 2).toUpperCase() : <Users className="w-10 h-10" />}</span>
                    )}
                  </div>

                  {/* Upload overlay button */}
                  {isAdmin && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      title="Changer la photo du groupe"
                      className="absolute inset-0 bg-slate-950/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold cursor-pointer gap-1 backdrop-blur-xs"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-indigo-300" />
                          <span>Photo</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Info and Actions */}
                <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
                  {isEditingInfo ? (
                    <div className="space-y-3 w-full">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nom du groupe"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-sm text-white font-bold outline-none"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description du groupe..."
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none resize-none"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setIsEditingInfo(false)}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleSaveInfo}
                          disabled={savingInfo || !editName.trim()}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingInfo ? 'Enregistrement...' : 'Enregistrer'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <h3 className="text-lg font-bold text-white truncate">
                          {groupDetails.name || 'Groupe sans nom'}
                        </h3>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setEditName(groupDetails.name || '');
                              setEditDescription(groupDetails.description || '');
                              setIsEditingInfo(true);
                            }}
                            title="Modifier le nom et la description"
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {groupDetails.description || 'Aucune description définie pour ce groupe.'}
                      </p>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Créé le {new Date(groupDetails.createdAt).toLocaleDateString()}</span>
                        </span>
                        <span>•</span>
                        <span className="text-indigo-400 font-semibold">
                          {members.length} membre{members.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Photo action buttons for admin */}
                  {isAdmin && !isEditingInfo && (
                    <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Changer la photo</span>
                      </button>
                      {groupDetails.avatarUrl && (
                        <button
                          onClick={handleRemovePhoto}
                          disabled={uploadingPhoto}
                          className="px-2.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer photo</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Group Quick Actions (Appel de groupe) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartGroupCall}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Phone className="w-4 h-4 animate-pulse" />
                  <span>Lancer un appel audio de groupe</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setShowAddMembers(true)}
                    className="py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Ajouter des membres</span>
                  </button>
                )}
              </div>

              {/* Members List Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Membres du groupe ({members.length})
                    </h4>
                  </div>

                  {/* Search input in members */}
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchMemberQuery}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      placeholder="Filtrer les membres..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      Aucun membre trouvé avec ce filtre.
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const u = member.user;
                      if (!u) return null;

                      const isSelf = u.id === user?.id;
                      const isUserOnline = userPresenceMap[u.id]?.status === 'ONLINE' || u.status === 'ONLINE';
                      const isUserAdmin = u.role === 'ADMIN';

                      return (
                        <div
                          key={member.id}
                          className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar with Status */}
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/80 overflow-hidden flex items-center justify-center font-bold text-xs text-slate-200">
                                {u.avatarUrl ? (
                                  <img
                                    src={u.avatarUrl}
                                    alt={u.firstName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{u.firstName[0]}</span>
                                )}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                                  isUserOnline ? 'bg-emerald-500' : 'bg-slate-600'
                                }`}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-white truncate">
                                  {u.firstName} {u.lastName}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    (Vous)
                                  </span>
                                )}
                                {isUserAdmin && (
                                  <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold rounded-md flex items-center gap-0.5">
                                    <Shield className="w-2.5 h-2.5" />
                                    <span>Admin</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {u.phone}
                              </div>
                            </div>
                          </div>

                          {/* Member actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAdmin && !isSelf && (
                              <button
                                onClick={() => handleRemoveMember(u.id, `${u.firstName} ${u.lastName}`)}
                                title="Retirer du groupe"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal: Add Members Overlay */}
        {showAddMembers && (
          <div className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-md flex flex-col p-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Ajouter des membres ({selectedUserIdsToAdd.length} sélectionnés)
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddMembers(false);
                  setSelectedUserIdsToAdd([]);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Tous les membres actifs font déjà partie de ce groupe.
                </div>
              ) : (
                allUsers.map((candidate) => {
                  const isSelected = selectedUserIdsToAdd.includes(candidate.id);
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedUserIdsToAdd(selectedUserIdsToAdd.filter((id) => id !== candidate.id));
                        } else {
                          setSelectedUserIdsToAdd([...selectedUserIdsToAdd, candidate.id]);
                        }
                      }}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center font-bold text-xs">
                          {candidate.avatarUrl ? (
                            <img
                              src={candidate.avatarUrl}
                              alt={candidate.firstName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{candidate.firstName[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">
                            {candidate.firstName} {candidate.lastName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{candidate.phone}</div>
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
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => {
                  setShowAddMembers(false);
                  setSelectedUserIdsToAdd([]);
                }}
                className="py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleAddMembersSubmit}
                disabled={addingMembers || selectedUserIdsToAdd.length === 0}
                className="py-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {addingMembers ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ajout en cours...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Valider l'ajout ({selectedUserIdsToAdd.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
