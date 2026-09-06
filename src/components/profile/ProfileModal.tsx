import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { X, User, Phone, Shield, Save, CheckCircle2, Upload, Camera, Trash2, Loader2, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [phoneChangedNotice, setPhoneChangedNotice] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Veuillez sélectionner un fichier image valide.');
      return;
    }

    setUploadingImage(true);
    setUploadError(null);

    try {
      const res = await api.uploadFile(file);
      setAvatarUrl(res.file.url);
    } catch (err: any) {
      console.error('Erreur téléversement image:', err);
      setUploadError(err.message || 'Échec du téléversement de l’image.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setPhoneChangedNotice(false);

    const isPhoneModified = phone.trim() !== (user?.phone || '').trim();

    try {
      const res = await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        username: username.trim() || undefined,
        avatarUrl,
        statusMessage,
      });
      updateUser(res.user);
      setSuccess(true);
      if (isPhoneModified) {
        setPhoneChangedNotice(true);
      }
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      console.error('Erreur mise à jour profil:', err);
      setFormError(err.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-200 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Mon Profil KOMECHAT
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Profil mis à jour avec succès !</span>
            </div>
            {phoneChangedNotice && (
              <p className="text-[11px] text-emerald-300">
                Vos contacts ont été automatiquement informés de votre nouveau numéro. Vos discussions continuent sans interruption.
              </p>
            )}
          </div>
        )}

        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {uploadError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center font-bold text-2xl text-slate-200 shadow-xl relative">
                {uploadingImage ? (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1 text-blue-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-[10px] text-slate-300 font-normal">Envoi...</span>
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{firstName ? firstName.slice(0, 1).toUpperCase() : 'U'}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg border-2 border-slate-900 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                title="Changer de photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Téléverser photo</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="py-1.5 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Supprimer la photo de profil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              )}
            </div>
          </div>

          {/* First & Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          {/* Phone Number with continuous notice */}
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+32484824481"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono outline-none"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 Si vous changez de numéro, une notification sera envoyée automatiquement à vos contacts et la discussion se poursuivra directement sur votre nouveau numéro.
            </p>
          </div>

          {/* Username (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Nom d'utilisateur (Optionnel)</span>
              <span className="text-[10px] text-slate-500 font-mono">Ex: @mon_nom</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@nom_utilisateur"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Permet à vos contacts de vous retrouver facilement et de vous connecter avec votre nom d'utilisateur.
            </p>
          </div>

          {/* Status Message */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Statut personnel</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="Ex: Disponible, En réunion..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none"
            />
          </div>

          {/* Role badge */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              Rôle système :
            </span>
            <span className="font-semibold text-slate-200 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {user?.role}
            </span>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-blue-600/20"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
