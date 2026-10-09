import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

import { Alert, Badge, Button, Chip, Field, Icon, IconTile, Input, SectionHeader } from '../../ds';
import { THEME_CHOICES, useThemePreference } from '../../../lib/theme';
const DELETE_CONFIRM_WORD = 'LÖSCHEN';

function getDeleteErrorText(err) {
  const code = err?.code || '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/missing-password') {
    return 'Das Passwort ist falsch.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Bestätigung abgebrochen. Dein Konto wurde nicht gelöscht.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Das Google-Fenster wurde blockiert. Bitte erlaube Popups und versuche es erneut.';
  }
  if (code === 'auth/user-mismatch') {
    return 'Bitte bestätige mit demselben Google-Konto, dem du angemeldet bist.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Zu viele Versuche. Bitte warte einen Moment.';
  }
  return 'Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut.';
}

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
    disconnectGoogleCalendar,
    deleteAccount
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const canDelete = deleteConfirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD
    && (isGoogleUser || deletePassword.length > 0);

  const resetDeleteState = () => {
    setDeleteOpen(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (loadingAction || !canDelete) return;
    setDeleteError('');
    setLoadingAction('delete');
    try {
      await deleteAccount({ password: deletePassword });
      // Nach dem Löschen ist der Nutzer abgemeldet; Modal schließen
      onClose?.();
    } catch (err) {
      console.error('Delete account error:', err);
      if (isMountedRef.current) {
        setDeleteError(getDeleteErrorText(err));
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const userInitial = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  const [themePreference, chooseTheme] = useThemePreference();

  return (
    <div className="space-y-6">
      {/* Rückmeldung */}
      {msg.text && (
        <Alert
          tone={msg.type === 'error' ? 'danger' : 'success'}
          onDismiss={() => setMsg({ type: '', text: '' })}
        >
          {msg.text}
        </Alert>
      )}

      {/* Konto-Übersicht */}
      <div className="flex items-center gap-4 rounded-lg border border-subtle bg-subtle p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-default bg-surface text-heading text-primary">
          {formState.photoURL ? (
            <img
              src={formState.photoURL}
              alt="Avatar"
              className="h-full w-full rounded-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : user?.isGuest ? (
            <Icon name="person" size="lg" className="text-warning" />
          ) : (
            userInitial
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-subheading text-primary">
              {user?.displayName || 'Kein Name angegeben'}
            </p>
            {isProfileDirty && <Badge tone="warning" size="sm">Ungespeichert</Badge>}
          </div>
          <p className="truncate text-body text-secondary">{user?.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={user?.isGuest ? 'warning' : 'neutral'} size="sm">
              {user?.isGuest ? 'Gast-Modus (Vorschau)' : (isGoogleUser ? 'Google-Konto' : 'E-Mail und Passwort')}
            </Badge>
            {user && !user.isGuest && (
              <Badge tone={user.emailVerified ? 'success' : 'warning'} size="sm" icon={user.emailVerified ? 'verified' : 'pending'}>
                {user.emailVerified ? 'Verifiziert' : 'Nicht verifiziert'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Darstellung: Hell, Dunkel oder dem System folgen */}
      <section className="space-y-3" aria-labelledby="settings-theme-title">
        <SectionHeader title="Darstellung" />
        <div role="radiogroup" aria-labelledby="settings-theme-title" className="flex flex-wrap gap-2">
          <span id="settings-theme-title" className="sr-only">Farbschema</span>
          {THEME_CHOICES.map((choice) => (
            <Chip
              key={choice.value}
              role="radio"
              aria-checked={themePreference === choice.value}
              selected={themePreference === choice.value}
              leadingIcon={choice.icon}
              onClick={() => chooseTheme(choice.value)}
            >
              {choice.label}
            </Chip>
          ))}
        </div>
      </section>

      {/* Gast-Hinweis */}
      {user?.isGuest ? (
        <Alert
          tone="warning"
          title="Gast-Sitzung aktiv"
          action={<Button variant="secondary" size="sm" leadingIcon="logout" onClick={onLogout}>Gast-Modus beenden und anmelden</Button>}
        >
          Du erkundest FocusFlow im Gast-Modus. Deine Daten, Aufgaben und Chats bleiben in diesem Browser auch nach dem Neuladen erhalten. Cloud-Synchronisation und Google Kalender sind im Gast-Modus deaktiviert.
        </Alert>
      ) : (
        <>
          {/* E-Mail bestätigen (falls nötig) */}
          {!user?.emailVerified && (
            <Alert
              tone="warning"
              icon="mark_email_unread"
              title="E-Mail-Adresse noch nicht bestätigt"
              action={(
                <>
                  <Button size="sm" loading={loadingAction === 'verify'} onClick={handleSendVerification}>
                    Link senden
                  </Button>
                  <Button variant="ghost" size="sm" disabled={loadingAction === 'reload'} onClick={handleReloadUser}>
                    Prüfen
                  </Button>
                </>
              )}
            >
              Bitte bestätige deine E-Mail, um alle Sicherheitsfunktionen zu nutzen.
            </Alert>
          )}

          {/* Profil */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <SectionHeader title="Profil" />
            <Field label="Anzeigename">
              <Input
                id="settings-display-name"
                placeholder="Dein Name"
                value={formState.displayName}
                onChange={(e) => setFormState(prev => ({ ...prev, displayName: e.target.value }))}
              />
            </Field>
            <Field label="Profilbild-Adresse" optional>
              <Input
                id="settings-photo-url"
                type="url"
                placeholder="https://beispiel.de/bild.jpg"
                value={formState.photoURL}
                onChange={(e) => setFormState(prev => ({ ...prev, photoURL: e.target.value }))}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button type="submit" loading={loadingAction === 'profile'} disabled={!isProfileDirty}>
                Profil speichern
              </Button>
              {isProfileDirty && (
                <Button
                  variant="ghost"
                  onClick={() => setFormState(prev => ({
                    ...prev,
                    displayName: user?.displayName || '',
                    photoURL: user?.photoURL || ''
                  }))}
                >
                  Zurücksetzen
                </Button>
              )}
            </div>
          </form>

          {/* Passwort (nur für Konten mit Passwort) */}
          {!isGoogleUser && (
            <form onSubmit={handleChangePassword} className="space-y-4 border-t border-subtle pt-5">
              <SectionHeader title="Passwort ändern" action={isPasswordDirty && <Badge tone="warning" size="sm">Ungespeichert</Badge>} />
              <Field label="Neues Passwort">
                <Input
                  id="settings-new-password"
                  type="password"
                  required
                  placeholder="Mindestens 6 Zeichen"
                  value={formState.newPassword}
                  onChange={(e) => setFormState(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </Field>
              <Field label="Neues Passwort bestätigen">
                <Input
                  id="settings-confirm-password"
                  type="password"
                  required
                  placeholder="Passwort wiederholen"
                  value={formState.confirmPassword}
                  onChange={(e) => setFormState(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </Field>
              <Button variant="secondary" type="submit" loading={loadingAction === 'password'} disabled={!isPasswordDirty}>
                Passwort aktualisieren
              </Button>
            </form>
          )}

          {/* Verknüpfte Dienste */}
          <div className="space-y-3 border-t border-subtle pt-5">
            <SectionHeader title="Verknüpfte Dienste" />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-subtle p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile area="calendar" icon="calendar_month" />
                <div className="min-w-0">
                  <p className="truncate text-body-strong text-primary">Google Kalender</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-caption text-secondary">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCalendarConnected ? 'bg-success' : 'bg-control'}`} aria-hidden="true" />
                    {isCalendarConnected ? 'Verbunden und synchronisiert' : 'Nicht verknüpft'}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {isCalendarConnected ? (
                  <Button variant="danger-ghost" size="sm" loading={loadingAction === 'disconnect'} onClick={handleDisconnectCalendar}>
                    Trennen
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" loading={loadingAction === 'calendar'} onClick={handleConnectCalendar}>
                    Verbinden
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Konto löschen (DSGVO Art. 17) */}
          <div className="space-y-3 border-t border-subtle pt-5">
            <SectionHeader title="Konto löschen" />
            {!deleteOpen ? (
              <div className="flex flex-col justify-between gap-3 rounded-lg border border-danger bg-danger-subtle p-4 sm:flex-row sm:items-center">
                <p className="text-body text-secondary">
                  Löscht dein Konto und alle Projekte, Erinnerungen, Gedanken, Notizen und Chats endgültig.
                </p>
                <Button variant="danger-ghost" onClick={() => setDeleteOpen(true)} className="shrink-0">
                  Konto löschen …
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleDeleteAccount}
                className="space-y-4 rounded-lg border border-danger bg-danger-subtle p-4"
              >
                <p className="text-body text-secondary">
                  <strong className="text-danger">Das kann nicht rückgängig gemacht werden.</strong>{' '}
                  Alle Inhalte werden sofort gelöscht, auch der Papierkorb. Eine Google-Kalender-Verbindung wird getrennt;
                  deine Termine im Google Kalender selbst bleiben erhalten.
                </p>
                <Field label={`Gib zur Bestätigung ${DELETE_CONFIRM_WORD} ein`}>
                  <Input
                    id="settings-delete-confirm"
                    autoComplete="off"
                    autoCapitalize="characters"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                  />
                </Field>
                {isGoogleUser ? (
                  <p className="text-caption text-secondary">
                    Zur Sicherheit bestätigst du den Vorgang gleich noch einmal mit deinem Google-Konto.
                  </p>
                ) : (
                  <Field label="Aktuelles Passwort">
                    <Input
                      id="settings-delete-password"
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                    />
                  </Field>
                )}
                {deleteError && (
                  <p role="alert" className="text-caption text-danger">{deleteError}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="danger" type="submit" loading={loadingAction === 'delete'} disabled={!canDelete}>
                    Konto endgültig löschen
                  </Button>
                  <Button variant="ghost" disabled={loadingAction === 'delete'} onClick={resetDeleteState}>
                    Abbrechen
                  </Button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
