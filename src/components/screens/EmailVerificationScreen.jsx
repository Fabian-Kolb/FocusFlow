import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Alert, Button, Card, Icon, IconTile } from '../ds';

export default function EmailVerificationScreen() {
  const { user, sendVerificationEmail, reloadUser, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleReload = async () => {
    setChecking(true);
    setFeedback({ type: '', text: '' });
    try {
      const refreshedUser = await reloadUser();
      if (refreshedUser?.emailVerified) {
        setFeedback({
          type: 'success',
          text: 'E-Mail erfolgreich verifiziert! Deine Daten werden geladen …'
        });
      } else {
        setFeedback({
          type: 'warning',
          text: 'Deine E-Mail ist noch nicht als verifiziert markiert. Bitte klicke auf den Bestätigungslink in deiner E-Mail und versuche es erneut.'
        });
      }
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Verifizierungsstatus:', err);
      setFeedback({
        type: 'error',
        text: 'Fehler beim Abrufen des Status. Bitte überprüfe deine Internetverbindung.'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleSendEmail = async () => {
    if (resendCooldown > 0) return;
    setSending(true);
    setFeedback({ type: '', text: '' });
    try {
      await sendVerificationEmail();
      setFeedback({
        type: 'success',
        text: `Bestätigungs-E-Mail erfolgreich an ${user?.email} gesendet! Bitte prüfe deinen Posteingang und eventuell den Spam-Ordner.`
      });
      // 60-Sekunden-Cooldown aktivieren
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Fehler beim Senden der Verifizierungs-E-Mail:', err);
      if (err.code === 'auth/too-many-requests') {
        setFeedback({
          type: 'warning',
          text: 'Zu viele Anfragen. Bitte warte einen Moment, bevor du eine neue E-Mail anforderst.'
        });
      } else {
        setFeedback({
          type: 'error',
          text: 'E-Mail konnte nicht gesendet werden. Bitte versuche es in wenigen Minuten erneut.'
        });
      }
    } finally {
      setSending(false);
    }
  };

  const tone = feedback.type === 'error' ? 'danger' : feedback.type;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <Card padding="lg" className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <IconTile area="neutral" icon="mark_email_unread" size="lg" className="mx-auto !bg-warning-subtle !text-warning" />
          <h1 className="text-title text-primary">E-Mail-Bestätigung erforderlich</h1>
          <p className="text-body text-secondary">
            Dein Account ist per E-Mail und Passwort angemeldet. Um deine Projekte und Aufgaben sicher freizuschalten, muss deine E-Mail-Adresse einmalig bestätigt werden.
          </p>
        </div>

        <div className="space-y-1 rounded-lg border border-subtle bg-subtle p-3.5 text-center">
          <span className="block text-caption text-secondary">Angemeldete E-Mail</span>
          <span className="block select-all break-all text-subheading text-primary">{user?.email}</span>
        </div>

        {feedback.text && <Alert tone={tone}>{feedback.text}</Alert>}

        <div className="space-y-3">
          <Button size="lg" fullWidth leadingIcon="refresh" loading={checking} onClick={handleReload}>
            {checking ? 'Status wird geprüft …' : 'Ich habe bestätigt, Status prüfen'}
          </Button>

          <Button variant="secondary" fullWidth leadingIcon="send" disabled={sending || resendCooldown > 0} loading={sending} onClick={handleSendEmail}>
            {sending ? 'Wird gesendet …' : resendCooldown > 0 ? `Erneut senden in ${resendCooldown} s` : 'Bestätigungs-E-Mail senden'}
          </Button>

          <Button variant="ghost" fullWidth onClick={logout}>
            Mit anderem Account anmelden
          </Button>
        </div>

        <p className="flex items-start justify-center gap-2 border-t border-subtle pt-4 text-caption text-secondary">
          <Icon name="lock" size="sm" className="mt-0.5 shrink-0" />
          Alle Daten bleiben strikt an deine Nutzer-ID gebunden. Nach der Bestätigung lädt FocusFlow deine Daten automatisch.
        </p>
      </Card>
    </div>
  );
}
