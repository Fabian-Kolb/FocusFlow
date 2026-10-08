import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WordmarkWord from '../brand/WordmarkWord';
import { LEGAL_PATHS } from '../../lib/legal';
import { getDevCredentials } from '../../lib/devAccount';

const THEME_STORAGE_KEY = 'focusflow_theme';

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // Storage gesperrt (z. B. Private Browsing) – Systemeinstellung nutzen
  }
  return null;
}

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { loginWithEmail, loginWithGoogle, loginAsGuest, resetPassword } = useAuth();
  const [resetSuccess, setResetSuccess] = useState('');
  const [storedTheme, setStoredTheme] = useState(readStoredTheme);
  const [osTheme, setOsTheme] = useState(systemTheme);
  const theme = storedTheme || osTheme;
  const isDark = theme === 'dark';

  // Ohne eigene Wahl folgt der Login-Screen dem System-Design
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (e) => setOsTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setStoredTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Wahl gilt dann nur für diese Sitzung
    }
  };

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

  // Nur Entwicklung (npm run dev) mit .env.development.local: lokaler Test-Account, kein Netzwerk
  const devCredentials = getDevCredentials();
  const handleDevLogin = () => {
    if (devCredentials) loginWithEmail(devCredentials.email, devCredentials.password);
  };

  return (
    <div className={isDark ? 'dark' : ''}>
    <div className="relative min-h-screen overflow-x-hidden bg-surface dark:bg-[#090a0f] transition-colors duration-300 motion-reduce:transition-none px-4 pt-16 pb-8 lg:py-8 flex flex-col items-center justify-center gap-6 lg:flex-row lg:gap-10 xl:gap-14">
      {/* Blaues Leuchten hinter der Wortmarke (nur im dunklen Design) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100 transition-opacity duration-300 motion-reduce:transition-none bg-[radial-gradient(ellipse_at_center,rgba(0,82,255,0.28),transparent_65%)]"
      />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
        title={isDark ? 'Helles Design' : 'Dunkles Design'}
        className="touch-target absolute top-4 right-4 z-10 flex items-center justify-center rounded-full border border-outline-variant bg-surface-card text-primary hover:border-primary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/40 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
      </button>

      {/* Wortmarke: Mobil/Tablet zweizeilig über der Karte, Desktop FOCUS | Karte | FLOW */}
      <WordmarkWord word="FOCUS" theme={theme} className="order-1 w-full max-w-[17rem] sm:max-w-xs lg:max-w-[22rem] lg:flex-1 -mb-8 lg:mb-0" />
      <WordmarkWord word="FLOW" theme={theme} className="order-2 lg:order-3 w-full max-w-[17rem] sm:max-w-xs lg:max-w-[22rem] lg:flex-1" />

      <Card padding="large" className="relative order-3 lg:order-2 w-full max-w-md shrink-0 space-y-6 bg-surface/50 backdrop-blur-sm border-outline-variant dark:bg-[#12131a] dark:border-white/10">
        <div className="text-center">
          {/* Sichtbar übernimmt die 3D-Wortmarke den Titel, für Screenreader bleibt er erhalten */}
          <h1 className="sr-only">FocusFlow</h1>
          <p className="text-sm text-on-surface-variant dark:text-neutral-400">
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

        {devCredentials && (
          <Button variant="secondary" fullWidth onClick={handleDevLogin} data-dev-login>
            <span className="material-symbols-outlined text-[18px]">bug_report</span>
            Mit Test-Konto anmelden (nur Entwicklung)
          </Button>
        )}

        {/* 1-Klick Gast-Zugang */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-2 dark:bg-white/5 dark:border-white/15">
          <p className="text-xs text-on-surface-variant dark:text-neutral-400">
            Möchtest du FocusFlow direkt ohne Registrierung ausprobieren?
          </p>
          <Button
            variant="outline"
            fullWidth
            onClick={handleGuestLogin}
            disabled={loading}
            className="gap-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all shadow-sm dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            Als Gast ausprobieren (Demo)
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant dark:border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="px-3 bg-surface text-on-surface-variant font-medium dark:bg-[#12131a] dark:text-neutral-400">Mit Konto anmelden</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleEmailLogin}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-primary mb-1 dark:text-white">E-Mail</label>
              <Input
                type="email"
                required
                className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-white/60"
                placeholder="deine.email@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-primary dark:text-white">Passwort</label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-primary hover:underline font-medium dark:text-neutral-300"
                >
                  Passwort vergessen?
                </button>
              </div>
              <Input
                type="password"
                required
                className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-white/60"
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
              className="dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:focus:ring-white/60 dark:focus:ring-offset-[#12131a]"
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
            className="gap-3 text-xs dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:border-white/40"
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

        {/* Rechtliche Links & Nutzungshinweise */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-outline-variant/30 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="py-1 text-[11px] text-on-surface-variant/80 hover:text-primary transition-colors underline dark:text-neutral-400 dark:hover:text-white"
          >
            Nutzungshinweise
          </button>
          <a
            href={LEGAL_PATHS.datenschutz}
            className="py-1 text-[11px] text-on-surface-variant/80 hover:text-primary transition-colors underline dark:text-neutral-400 dark:hover:text-white"
          >
            Datenschutz
          </a>
          <a
            href={LEGAL_PATHS.impressum}
            className="py-1 text-[11px] text-on-surface-variant/80 hover:text-primary transition-colors underline dark:text-neutral-400 dark:hover:text-white"
          >
            Impressum
          </a>
        </div>
      </Card>

      {/* Modal: Nutzungshinweise */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto dark:bg-[#12131a] dark:border-white/10">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-primary flex items-center gap-2 dark:text-white">
                <span className="material-symbols-outlined text-[20px]">shield</span>
                Nutzungshinweise
              </h3>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg dark:text-neutral-400 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-on-surface-variant leading-relaxed dark:text-neutral-400">
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
              <p className="pt-1 font-semibold text-primary dark:text-white">
                <strong>5. Eigenverantwortung:</strong> Das Betreten und Ausprobieren dieser App geschieht vollkommen auf eigene Gefahr und in reiner Selbstverantwortung – es gibt hier weder Sicherheiten noch Garantien.
              </p>
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end dark:border-white/10">
              <Button
                variant="primary"
                onClick={() => setShowPrivacyModal(false)}
                className="dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                Verstanden
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default Login;
