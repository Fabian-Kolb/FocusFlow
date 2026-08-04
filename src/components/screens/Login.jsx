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
  const { loginWithEmail, loginWithGoogle, resetPassword } = useAuth();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card padding="large" className="w-full max-w-md space-y-8 bg-surface/50 backdrop-blur-sm border-outline-variant">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary">FocusFlow</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Melde dich an, um deinen Workflow zu starten
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

        <form className="mt-8 space-y-6" onSubmit={handleEmailLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-primary mb-1.5">E-Mail</label>
              <Input
                type="email"
                required
                placeholder="deine.email@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-primary">Passwort</label>
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

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-on-surface-variant font-medium">Oder</span>
            </div>
          </div>

          <div className="mt-6">
            <Button
              variant="secondary"
              fullWidth
              onClick={handleGoogleLogin}
              disabled={loading}
              className="gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Mit Google anmelden
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Login;
