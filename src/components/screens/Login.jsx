import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Alert, Button, Card, Dialog, Divider, Field, IconButton, Input } from '../ds';
import WordmarkWord from '../brand/WordmarkWord';
import LoginMarquee from '../brand/LoginMarquee';
import { LEGAL_PATHS } from '../../lib/legal';
import { getDevCredentials } from '../../lib/devAccount';
import { captureBrandHandoff, clearBrandHandoff } from '../../lib/brandTransition';
import { resolveTheme, useThemePreference } from '../../lib/theme';

const LINK_CLASS = 'rounded-xs py-1 text-caption text-secondary underline underline-offset-2 transition-colors duration-fast hover:text-primary';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { loginWithEmail, loginWithGoogle, loginAsGuest, resetPassword } = useAuth();
  const [resetSuccess, setResetSuccess] = useState('');
  // Hell/Dunkel gilt app-weit (data-theme); ohne eigene Wahl folgt der Login der Systemeinstellung
  const [themePreference, chooseTheme] = useThemePreference();
  const theme = resolveTheme(themePreference);
  const isDark = theme === 'dark';

  // Wortmarke reagiert auf das Formular: richtet sich auf die Karte aus und hüpft bei jedem Tastendruck
  const [formEngaged, setFormEngaged] = useState(false);
  const [typingPulse, setTypingPulse] = useState(0);
  const focusWordRef = useRef(null);
  const flowWordRef = useRef(null);
  const formRef = useRef(null);
  const typed = (setter) => (e) => {
    setter(e.target.value);
    setTypingPulse((n) => n + 1);
  };
  // Vor dem Login merken, wo die Wörter stehen, damit die App sie in die Kopfzeile fliegen lässt
  const focusCtl = useRef(null);
  const flowCtl = useRef(null);
  const leavingRef = useRef(false);
  const prepareLeave = async (immediate = false) => {
    leavingRef.current = true;
    const [focusImage, flowImage] = await Promise.all([
      focusCtl.current?.prepareExit?.(immediate),
      flowCtl.current?.prepareExit?.(immediate),
    ]);
    captureBrandHandoff(
      { FOCUS: { el: focusWordRef.current, image: focusImage }, FLOW: { el: flowWordRef.current, image: flowImage } },
      theme,
    );
  };
  // Login hat nicht geklappt: Wörter dürfen wieder dem Cursor folgen
  const cancelLeave = () => {
    leavingRef.current = false;
    clearBrandHandoff();
    focusCtl.current?.resume?.();
    flowCtl.current?.resume?.();
  };

  const toggleTheme = () => chooseTheme(isDark ? 'light' : 'dark');

  useEffect(() => {
    const handleAuthError = (e) => {
      setError(e.detail);
      setLoading(false);
      cancelLeave();
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    setLoading(true);
    await prepareLeave();
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      cancelLeave();
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
    await prepareLeave(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      cancelLeave();
      console.error(err);
      setError('Fehler beim Google-Login.');
    }
    setLoading(false);
  };

  const handleGuestLogin = async () => {
    if (leavingRef.current) return;
    setError('');
    await prepareLeave();
    loginAsGuest();
  };

  // Nur Entwicklung (npm run dev) mit .env.development.local: lokaler Test-Account, kein Netzwerk
  const devCredentials = getDevCredentials();
  const handleDevLogin = async () => {
    if (leavingRef.current || !devCredentials) return;
    await prepareLeave();
    loginWithEmail(devCredentials.email, devCredentials.password);
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center gap-6 overflow-x-hidden bg-canvas px-4 pb-8 pt-16 lg:flex-row lg:gap-10 lg:py-8 xl:gap-14">
      <LoginMarquee />

      <IconButton
        icon={isDark ? 'light_mode' : 'dark_mode'}
        label={isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
        variant="secondary"
        className="absolute right-4 top-4 z-10"
        onClick={toggleTheme}
      />

      {/* Wortmarke: Mobil/Tablet zweizeilig über der Karte, Desktop FOCUS | Karte | FLOW */}
      <WordmarkWord ref={focusWordRef} controlRef={focusCtl} word="FOCUS" theme={theme} attention={formEngaged} attentionTargetRef={formRef} pulse={typingPulse} className="order-1 -mb-8 w-full max-w-[24rem] sm:max-w-[30rem] lg:mb-0 lg:max-w-[32rem] lg:flex-1 xl:max-w-[36rem]" />
      <WordmarkWord ref={flowWordRef} controlRef={flowCtl} word="FLOW" theme={theme} attention={formEngaged} attentionTargetRef={formRef} pulse={typingPulse} className="order-2 w-full max-w-[24rem] sm:max-w-[30rem] lg:order-3 lg:max-w-[32rem] lg:flex-1 xl:max-w-[36rem]" />

      <Card padding="lg" variant="outlined" className="relative order-3 w-full max-w-md shrink-0 space-y-6 lg:order-2 lg:max-w-sm xl:max-w-md">
        <div className="text-center">
          {/* Sichtbar übernimmt die 3D-Wortmarke den Titel, für Screenreader bleibt er erhalten */}
          <h1 className="sr-only">FocusFlow</h1>
          <p className="text-body text-secondary">
            Dein intelligentes System für Fokus, Projekte und Workflows
          </p>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {resetSuccess && <Alert tone="success">{resetSuccess}</Alert>}

        {devCredentials && (
          <Button variant="secondary" fullWidth leadingIcon="bug_report" onClick={handleDevLogin} data-dev-login>
            Mit Test-Konto anmelden (nur Entwicklung)
          </Button>
        )}

        {/* 1-Klick Gast-Zugang */}
        <div className="space-y-3 rounded-lg border border-subtle bg-subtle p-4 text-center">
          <p className="text-caption text-secondary">
            Möchtest du FocusFlow direkt ohne Registrierung ausprobieren?
          </p>
          <Button variant="secondary" fullWidth leadingIcon="explore" onClick={handleGuestLogin} disabled={loading}>
            Als Gast ausprobieren (Demo)
          </Button>
        </div>

        <Divider label="Mit Konto anmelden" />

        <form
          ref={formRef}
          className="space-y-4"
          onSubmit={handleEmailLogin}
          onFocus={() => setFormEngaged(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFormEngaged(false); }}
        >
          <Field label="E-Mail">
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="deine.email@beispiel.de"
              value={email}
              onChange={typed(setEmail)}
            />
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-password" className="text-label text-primary">Passwort</label>
              <button type="button" onClick={handleResetPassword} className="rounded-xs text-caption-strong text-accent underline-offset-2 hover:underline">
                Passwort vergessen?
              </button>
            </div>
            <Input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={typed(setPassword)}
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Mit E-Mail anmelden
          </Button>
        </form>

        <Button variant="secondary" fullWidth onClick={handleGoogleLogin} disabled={loading}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Mit Google anmelden
        </Button>

        {/* Rechtliche Links und Nutzungshinweise */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-subtle pt-3">
          <button type="button" onClick={() => setShowPrivacyModal(true)} className={LINK_CLASS}>
            Nutzungshinweise
          </button>
          <a href={LEGAL_PATHS.datenschutz} className={LINK_CLASS}>Datenschutz</a>
          <a href={LEGAL_PATHS.impressum} className={LINK_CLASS}>Impressum</a>
        </div>
      </Card>

      {/* Nutzungshinweise */}
      <Dialog
        open={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        size="lg"
        title="Nutzungshinweise"
        footer={<Button onClick={() => setShowPrivacyModal(false)}>Verstanden</Button>}
      >
        <div className="max-h-[55vh] space-y-3 overflow-y-auto text-body text-secondary">
          <p>
            <strong className="text-primary">1. Bereitstellung („Wie besehen“):</strong> FocusFlow wird als webbasierte Anwendung zur Workflow- und Aufgabenorganisation zur Verfügung gestellt. Die Nutzung aller Funktionen erfolgt stets auf eigenes Risiko und in eigener Verantwortung.
          </p>
          <p>
            <strong className="text-primary">2. Haftungsausschluss für Daten und Verfügbarkeit:</strong> Es wird ausdrücklich keine Haftung oder Gewährleistung für die Richtigkeit, Vollständigkeit, dauerhafte Speicherung oder Wiederherstellung von erstellten Projekten, Aufgaben, Notizen oder Terminen übernommen. Ein Anspruch auf eine unterbrechungsfreie oder fehlerfreie Verfügbarkeit des Dienstes besteht nicht.
          </p>
          <p>
            <strong className="text-primary">3. KI-generierte Inhalte:</strong> Alle vom KI-Coach oder automatisierten Assistenten erzeugten Antworten, Vorschläge und Zusammenfassungen dienen reinen Informationszwecken. Für etwaige Entscheidungen, Handlungen oder Folgeschäden, die aus der Nutzung der KI-Ausgaben resultieren, wird jegliche Haftung ausgeschlossen.
          </p>
          <p>
            <strong className="text-primary">4. Schnittstellen und Drittanbieter:</strong> Für die ständige Erreichbarkeit und fehlerfreie Funktion von angebundenen Drittanbieter-Diensten (z. B. Google Kalender oder externe Cloud-Dienste) sowie für etwaige Datenübertragungsfehler wird keine Haftung übernommen.
          </p>
          <p className="text-primary">
            <strong>5. Eigenverantwortung:</strong> Das Betreten und Ausprobieren dieser App geschieht vollkommen auf eigene Gefahr und in reiner Selbstverantwortung – es gibt hier weder Sicherheiten noch Garantien.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

export default Login;
