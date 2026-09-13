import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';

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
          text: 'E-Mail erfolgreich verifiziert! Deine Daten werden geladen...'
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <Card padding="large" className="w-full max-w-md space-y-6 bg-surface/80 backdrop-blur-sm border-outline-variant shadow-lg">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">
            E-Mail-Bestätigung erforderlich
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Dein Account ist per E-Mail &amp; Passwort angemeldet. Um deine Projekte und Aufgaben sicher freizuschalten, muss deine E-Mail-Adresse einmalig bestätigt werden.
          </p>
        </div>

        {/* E-Mail Adress-Box */}
        <div className="p-3.5 rounded-xl bg-surface-low border border-outline-variant text-center space-y-1">
          <span className="text-xs text-on-surface-variant uppercase font-mono tracking-wider block">
            Angemeldete E-Mail
          </span>
          <span className="text-base font-semibold text-primary font-mono select-all">
            {user?.email || 'fabi@gmail.com'}
          </span>
        </div>

        {/* Feedback Alert */}
        {feedback.text && (
          <div
            role="alert"
            className={`p-3 rounded-xl text-xs sm:text-sm font-medium flex items-start gap-2.5 leading-relaxed ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : feedback.type === 'warning'
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200'
                : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
            }`}
          >
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
              {feedback.type === 'success' ? 'check_circle' : feedback.type === 'warning' ? 'info' : 'error'}
            </span>
            <span className="flex-1">{feedback.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center py-2.5 text-sm font-semibold"
            disabled={checking}
            onClick={handleReload}
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                Status wird geprüft...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">refresh</span>
                Ich habe die E-Mail bestätigt (Status prüfen)
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-center py-2 text-sm"
            disabled={sending || resendCooldown > 0}
            onClick={handleSendEmail}
          >
            {sending ? (
              'Wird gesendet...'
            ) : resendCooldown > 0 ? (
              `Erneut senden in ${resendCooldown}s`
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">send</span>
                Bestätigungs-E-Mail senden
              </span>
            )}
          </Button>

          <button
            type="button"
            onClick={logout}
            className="w-full text-center text-xs text-on-surface-variant hover:text-primary transition-colors pt-2 cursor-pointer"
          >
            Mit anderem Account anmelden / Abmelden
          </button>
        </div>

        {/* Hinweis zur Datensicherheit */}
        <p className="text-[11px] text-center text-on-surface-variant leading-normal border-t border-outline-variant pt-3">
          🔒 Alle Daten verbleiben strikt an deine UID gebunden. Nach erfolgreicher Verifizierung lädt FocusFlow deine Daten automatisch.
        </p>
      </Card>
    </div>
  );
}
