import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';

function ProfileModal() {
  const { activeModal, closeModal } = useModalContext();
  const { user, updateUserProfile, changePassword, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  if (activeModal !== 'profile') return null;

  const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setLoading(true);
    try {
      await updateUserProfile(displayName, photoURL);
      setMsg({ type: 'success', text: 'Profil erfolgreich aktualisiert.' });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Fehler beim Aktualisieren des Profils.' });
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' });
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      setMsg({ type: 'success', text: 'Passwort erfolgreich geändert.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Fehler beim Ändern des Passworts. (Ggf. neu einloggen erforderlich)' });
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    closeModal();
    await logout();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden text-primary">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">account_circle</span>
            <h2 className="text-xl font-bold tracking-tight">Mein Profil</h2>
          </div>
          <button 
            onClick={closeModal}
            className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-lg hover:bg-surface-variant/50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {msg.text && (
            <div className={`p-3 rounded-lg text-sm ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {msg.text}
            </div>
          )}

          {/* User Info Overview */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-variant/20 border border-border/50">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xl text-primary overflow-hidden flex-shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base truncate">{user?.displayName || 'Kein Name angegeben'}</p>
              <p className="text-sm text-on-surface-variant truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full bg-surface border border-border text-on-surface-variant font-mono">
                {isGoogleUser ? 'Google Konto' : 'E-Mail & Passwort'}
              </span>
            </div>
          </div>

          {/* Edit Profile Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Profil-Informationen</h3>
            <div>
              <label className="block text-xs font-medium text-on-surface mb-1">Anzeigename</label>
              <input
                type="text"
                className="w-full bg-surface-variant/30 border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Dein Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface mb-1">Profilbild URL</label>
              <input
                type="url"
                className="w-full bg-surface-variant/30 border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="https://beispiel.de/bild.jpg"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-bg-surface rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Profil speichern
            </button>
          </form>

          {/* Change Password Form */}
          {!isGoogleUser && (
            <form onSubmit={handleChangePassword} className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Passwort ändern</h3>
              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">Neues Passwort</label>
                <input
                  type="password"
                  required
                  className="w-full bg-surface-variant/30 border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">Neues Passwort bestätigen</label>
                <input
                  type="password"
                  required
                  className="w-full bg-surface-variant/30 border border-border rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-surface-variant hover:bg-surface-variant/80 border border-border text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Passwort ändern
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-variant/10 flex items-center justify-between">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Abmelden
          </button>
          <button
            onClick={closeModal}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-variant/50 transition-colors"
          >
            Schließen
          </button>
        </div>

      </div>
    </div>
  );
}

export default ProfileModal;
