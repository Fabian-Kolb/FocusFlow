import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function AccountSection({ 
  formState, 
  setFormState, 
  onLogout,
  onClose
}) {
  const { 
    user, 
    isGoogleUser, 
    isEmailVerified, 
    isCalendarConnected,
    updateUserProfile, 
    changePassword, 
    sendVerificationEmail,
    reloadUser,
    linkGoogleCalendar, 
    disconnectGoogleCalendar 
  } = useAuth();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [loadingAction, setLoadingAction] = useState(null); // 'profile' | 'password' | 'verify' | 'calendar' | 'disconnect'
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Compute dirty states
  const isProfileDirty = 
    formState.displayName !== (user?.displayName || '') || 
    formState.photoURL !== (user?.photoURL || '');
  const isPasswordDirty = Boolean(formState.newPassword || formState.confirmPassword);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (loadingAction) return;
    setMsg({ type: '', text: '' });
    setLoadingAction('profile');

    try {
      await updateUserProfile(formState.displayName, formState.photoURL);
      if (isMountedRef.current) {
        setMsg({ type: 'success', text: 'Profil erfolgreich aktualisiert.' });
      }
    } catch (err) {
      console.error('Update profile error:', err);
      if (isMountedRef.current) {
        setMsg({ type: 'error', text: 'Fehler beim Aktualisieren des Profils.' });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (loadingAction) return;
    setMsg({ type: '', text: '' });

    if (formState.newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
      return;
    }

    if (formState.newPassword !== formState.confirmPassword) {
      setMsg({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' });
      return;
    }

    setLoadingAction('password');
    try {
      await changePassword(formState.newPassword);
      if (isMountedRef.current) {
        setMsg({ type: 'success', text: 'Passwort erfolgreich geändert.' });
        setFormState(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
      }
    } catch (err) {
      console.error('Change password error:', err);
      if (isMountedRef.current) {
        setMsg({ 
          type: 'error', 
          text: 'Fehler beim Ändern des Passworts. Bitte melde dich erneut an und versuche es noch einmal.' 
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const handleSendVerification = async () => {
    if (loadingAction) return;
    setMsg({ type: '', text: '' });
    setLoadingAction('verify');
    try {
      await sendVerificationEmail();
      if (isMountedRef.current) {
        setMsg({ type: 'success', text: 'Bestätigungs-E-Mail wurde gesendet. Bitte prüfe dein Postfach.' });
      }
    } catch (err) {
      console.error('Verification email error:', err);
      if (isMountedRef.current) {
        setMsg({ type: 'error', text: 'Konnte Bestätigungs-E-Mail nicht senden. Bitte warte einen Moment.' });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const handleReloadUser = async () => {
    if (loadingAction) return;
    setLoadingAction('reload');
    try {
      const refreshed = await reloadUser();
      if (isMountedRef.current) {
        if (refreshed?.emailVerified) {
          setMsg({ type: 'success', text: 'E-Mail erfolgreich bestätigt!' });
        } else {
          setMsg({ type: 'error', text: 'E-Mail ist noch nicht bestätigt.' });
        }
      }
    } catch (err) {
      console.error('Reload user error:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const handleConnectCalendar = async () => {
    if (loadingAction) return;
    setMsg({ type: '', text: '' });
    setLoadingAction('calendar');
    try {
      const success = await linkGoogleCalendar();
      if (isMountedRef.current) {
        if (success) {
          setMsg({ type: 'success', text: 'Google Kalender erfolgreich verbunden!' });
        } else {
          setMsg({ type: 'error', text: 'Kalender-Verbindung wurde abgebrochen oder ist abgelaufen.' });
        }
      }
    } catch (err) {
      console.error('Calendar link error:', err);
      if (isMountedRef.current) {
        const errorMsg = err?.message?.includes('Popup')
          ? 'Popup wurde vom Browser blockiert. Bitte erlaube Popups für FocusFlow in der Adressleiste.'
          : 'Fehler beim Verbinden mit Google Kalender.';
        setMsg({ type: 'error', text: errorMsg });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const handleDisconnectCalendar = async () => {
    if (loadingAction) return;
    setMsg({ type: '', text: '' });
    setLoadingAction('disconnect');
    try {
      await disconnectGoogleCalendar();
      if (isMountedRef.current) {
        setMsg({ type: 'success', text: 'Google Kalender-Verbindung getrennt.' });
      }
    } catch (err) {
      console.error('Calendar disconnect error:', err);
      if (isMountedRef.current) {
        setMsg({ type: 'error', text: 'Fehler beim Trennen der Kalender-Verbindung.' });
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const userInitial = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Feedback Message */}
      {msg.text && (
        <div 
          role="alert"
          className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 transition-all ${
            msg.type === 'error' 
              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}
        >
          <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
            {msg.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span className="flex-1 text-xs sm:text-sm">{msg.text}</span>
          <button 
            type="button" 
            onClick={() => setMsg({ type: '', text: '' })}
            className="text-current opacity-60 hover:opacity-100 p-0.5"
            title="Meldung schließen"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* User Info Overview Card */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-variant/20 border border-border">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xl text-primary overflow-hidden shrink-0">
          {formState.photoURL ? (
            <img 
              src={formState.photoURL} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-full"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : user?.isGuest ? (
            <span className="material-symbols-outlined text-2xl text-amber-500">person</span>
          ) : (
            userInitial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base truncate text-on-surface">
              {user?.displayName || 'Kein Name angegeben'}
            </p>
            {isProfileDirty && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded-md">
                Ungespeichert
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full border font-mono ${
              user?.isGuest 
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                : 'bg-surface border-border text-on-surface-variant'
            }`}>
              {user?.isGuest ? 'Gast-Modus (Vorschau)' : (isGoogleUser ? 'Google Konto' : 'E-Mail & Passwort')}
            </span>
            {user && !user.isGuest && (
              <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-mono ${
                user.emailVerified
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              }`}>
                <span className="material-symbols-outlined text-[12px]">
                  {user.emailVerified ? 'verified' : 'pending'}
                </span>
                {user.emailVerified ? 'Verifiziert' : 'Nicht verifiziert'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guest Mode Notice */}
      {user?.isGuest ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 text-on-surface">
          <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
            <span className="material-symbols-outlined text-[20px]">info</span>
            Gast-Sitzung aktiv
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Du erkundest FocusFlow im Gast-Modus. Deine erstellten Daten, Aufgaben und Chats bleiben in diesem Browser auch beim Neuladen der Seite erhalten. Cloud-Synchronisation und Google Kalender sind im Gast-Modus deaktiviert.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Gast-Modus beenden & Anmelden
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Email Verification Action (if unverified) */}
          {!user?.emailVerified && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">mark_email_unread</span>
                  E-Mail-Adresse noch nicht bestätigt
                </p>
                <p className="text-xs text-on-surface-variant">
                  Bitte bestätige deine E-Mail, um alle Sicherheitsfeatures nutzen zu können.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={loadingAction === 'verify'}
                  onClick={handleSendVerification}
                  className="px-3 py-1.5 bg-amber-500 text-neutral-900 rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loadingAction === 'verify' ? 'Sendet...' : 'Link senden'}
                </button>
                <button
                  type="button"
                  disabled={loadingAction === 'reload'}
                  onClick={handleReloadUser}
                  className="px-3 py-1.5 border border-border text-on-surface rounded-lg text-xs font-medium hover:bg-surface-variant/30 transition-colors cursor-pointer"
                >
                  Prüfen
                </button>
              </div>
            </div>
          )}

          {/* Edit Profile Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Profil-Informationen
            </h3>
            <div>
              <label htmlFor="settings-display-name" className="block text-xs font-medium text-on-surface mb-1">
                Anzeigename
              </label>
              <input
                id="settings-display-name"
                type="text"
                className="w-full bg-surface-variant/20 border border-border rounded-xl px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                placeholder="Dein Name"
                value={formState.displayName}
                onChange={(e) => setFormState(prev => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="settings-photo-url" className="block text-xs font-medium text-on-surface mb-1">
                Profilbild URL
              </label>
              <input
                id="settings-photo-url"
                type="url"
                className="w-full bg-surface-variant/20 border border-border rounded-xl px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                placeholder="https://beispiel.de/bild.jpg"
                value={formState.photoURL}
                onChange={(e) => setFormState(prev => ({ ...prev, photoURL: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loadingAction === 'profile' || !isProfileDirty}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {loadingAction === 'profile' ? 'Wird gespeichert...' : 'Profil speichern'}
              </button>
              {isProfileDirty && (
                <button
                  type="button"
                  onClick={() => setFormState(prev => ({
                    ...prev,
                    displayName: user?.displayName || '',
                    photoURL: user?.photoURL || ''
                  }))}
                  className="px-3 py-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </form>

          {/* Change Password Form (Only for Password Users) */}
          {!isGoogleUser && (
            <form onSubmit={handleChangePassword} className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Passwort ändern
                </h3>
                {isPasswordDirty && (
                  <span className="text-[10px] text-amber-500 font-medium">Ungespeichert</span>
                )}
              </div>
              <div>
                <label htmlFor="settings-new-password" className="block text-xs font-medium text-on-surface mb-1">
                  Neues Passwort
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  required
                  className="w-full bg-surface-variant/20 border border-border rounded-xl px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  placeholder="Mindestens 6 Zeichen"
                  value={formState.newPassword}
                  onChange={(e) => setFormState(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="settings-confirm-password" className="block text-xs font-medium text-on-surface mb-1">
                  Neues Passwort bestätigen
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  required
                  className="w-full bg-surface-variant/20 border border-border rounded-xl px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  placeholder="Passwort wiederholen"
                  value={formState.confirmPassword}
                  onChange={(e) => setFormState(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
              <button
                type="submit"
                disabled={loadingAction === 'password' || !isPasswordDirty}
                className="px-4 py-2 bg-surface-variant hover:bg-surface-variant/80 border border-border text-on-surface rounded-xl text-xs sm:text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {loadingAction === 'password' ? 'Wird geändert...' : 'Passwort aktualisieren'}
              </button>
            </form>
          )}

          {/* Calendar Connection */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Verknüpfte Dienste
            </h3>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-variant/20 border border-border">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-primary text-2xl shrink-0">calendar_month</span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-on-surface truncate">Google Kalender</p>
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCalendarConnected ? 'bg-emerald-500' : 'bg-neutral-500'}`} />
                    {isCalendarConnected ? 'Verbunden & synchronisiert' : 'Nicht verknüpft'}
                  </p>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                {isCalendarConnected ? (
                  <button
                    type="button"
                    disabled={loadingAction === 'disconnect'}
                    onClick={handleDisconnectCalendar}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loadingAction === 'disconnect' ? 'Trennt...' : 'Trennen'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loadingAction === 'calendar'}
                    onClick={handleConnectCalendar}
                    className="px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {loadingAction === 'calendar' ? 'Verbindet...' : 'Verbinden'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
