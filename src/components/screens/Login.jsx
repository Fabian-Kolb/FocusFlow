import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { loginWithEmail, loginWithGoogle, loginAsGuest, resetPassword } = useAuth();
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    const handleAuthError = (e) => {
      setError(e.detail);
      setLoading(false);
    };
    
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Login. Bitte überprüfe deine Daten.');
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Bitte gib deine E-Mail-Adresse ein, um das Passwort zurückzusetzen.');
      return;
    }
    setError('');
    setResetSuccess('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSuccess(`E-Mail zum Zurücksetzen des Passworts an ${email} gesendet!`);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Senden der E-Mail. Prüfe die E-Mail-Adresse.');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      setError('Fehler beim Google-Login.');
    }
    setLoading(false);
  };

  const handleGuestLogin = () => {
    setError('');
    loginAsGuest();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <Card padding="large" className="w-full max-w-md space-y-6 bg-surface/50 backdrop-blur-sm border-outline-variant">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary">FocusFlow</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Dein intelligentes System für Fokus, Projekte & Workflows
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm text-center font-medium">
            {error}
          </div>
        )}

        {resetSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-3 rounded-lg text-sm text-center font-medium">
            {resetSuccess}
          </div>
        )}

        {/* 1-Klick Gast-Zugang */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-on-surface-variant">
            Möchtest du FocusFlow direkt ohne Registrierung ausprobieren?
          </p>
          <Button
            variant="outline"
            fullWidth
            onClick={handleGuestLogin}
            disabled={loading}
            className="gap-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Als Gast ausprobieren (Demo)
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="px-3 bg-surface text-on-surface-variant font-medium">Mit Konto anmelden</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleEmailLogin}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-primary mb-1">E-Mail</label>
              <Input
                type="email"
                required
                placeholder="deine.email@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-primary">Passwort</label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Passwort vergessen?
                </button>
              </div>
              <Input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={loading}
              fullWidth
            >
              {loading ? 'Lädt...' : 'Mit E-Mail anmelden'}
            </Button>
          </div>
        </form>

        <div className="pt-1">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleGoogleLogin}
            disabled={loading}
            className="gap-3 text-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Mit Google anmelden
          </Button>
        </div>

        {/* Datenschutz & Nutzungshinweise Footer */}
        <div className="pt-2 text-center border-t border-outline-variant/30">
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="text-[11px] text-on-surface-variant/80 hover:text-primary transition-colors underline"
          >
            Datenschutz & Nutzungshinweise
          </button>
        </div>
      </Card>

      {/* Modal: Datenschutz & Nutzungshinweise */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">shield</span>
                Datenschutz & Nutzungshinweise
              </h3>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-on-surface-variant leading-relaxed">
              <p>
                <strong>1. Bereitstellung („Wie besehen“):</strong> FocusFlow wird als webbasierte Anwendung zur Workflow- und Aufgabenorganisation zur Verfügung gestellt. Die Nutzung aller Funktionen erfolgt stets auf eigenes Risiko und in eigener Verantwortung.
              </p>
              <p>
                <strong>2. Haftungsausschluss für Daten & Verfügbarkeit:</strong> Es wird ausdrücklich keine Haftung oder Gewährleistung für die Richtigkeit, Vollständigkeit, dauerhafte Speicherung oder Wiederherstellung von erstellten Projekten, Aufgaben, Notizen oder Terminen übernommen. Ein Anspruch auf eine unterbrechungsfreie oder fehlerfreie Verfügbarkeit des Dienstes besteht nicht.
              </p>
              <p>
                <strong>3. KI-generierte Inhalte:</strong> Alle vom KI-Coach oder automatisierten Assistenten erzeugten Antworten, Vorschläge und Zusammenfassungen dienen reinen Informationszwecken. Für etwaige Entscheidungen, Handlungen oder Folgeschäden, die aus der Nutzung der KI-Ausgaben resultieren, wird jegliche Haftung ausgeschlossen.
              </p>
              <p>
                <strong>4. Schnittstellen & Drittanbieter:</strong> Für die ständige Erreichbarkeit und fehlerfreie Funktion von angebundenen Drittanbieter-Diensten (z. B. Google Kalender oder externe Cloud-Dienste) sowie für etwaige Datenübertragungsfehler wird keine Haftung übernommen.
              </p>
              <p className="pt-1 font-semibold text-primary">
                <strong>5. Eigenverantwortung:</strong> Das Betreten und Ausprobieren dieser App geschieht vollkommen auf eigene Gefahr und in reiner Selbstverantwortung – es gibt hier weder Sicherheiten noch Garantien.
              </p>
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end">
              <Button
                variant="primary"
                onClick={() => setShowPrivacyModal(false)}
              >
                Verstanden
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
