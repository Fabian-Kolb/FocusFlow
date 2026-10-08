// Lokaler Entwicklungs-Account (nur `npm run dev`, nie im Build).
//
// Zweck: Testen mit einem „echten“ Konto samt Daten, ohne Firebase. Die Zugangsdaten stehen in
// `.env.development.local` (von Git ignoriert) als VITE_DEV_ACCOUNT_EMAIL / VITE_DEV_ACCOUNT_PASSWORD.
// Die Anmeldung läuft rein im Browser (kein Netzwerk). Daten liegen im selben localStorage-Speicher wie
// der Gast-Modus (`focusflow_guest_*`), das Konto wird aber wie ein normales Konto dargestellt.
// Backend-Funktionen mit Firebase-Token (Fio/Gemini, Google Kalender) stehen damit nicht zur Verfügung.

export const DEV_ACCOUNT_FLAG = 'focusflow_dev_account';

const readEnv = (key) => (import.meta.env.DEV ? String(import.meta.env[key] || '') : '');

const email = () => readEnv('VITE_DEV_ACCOUNT_EMAIL').trim().toLowerCase();
const password = () => readEnv('VITE_DEV_ACCOUNT_PASSWORD');

export const isDevAccountAvailable = () => Boolean(import.meta.env.DEV && email() && password());

/** Nur Entwicklung: Zugangsdaten für den Ein-Klick-Login im Login-Screen */
export function getDevCredentials() {
  return isDevAccountAvailable() ? { email: email(), password: password() } : null;
}

export function matchesDevCredentials(inputEmail, inputPassword) {
  if (!isDevAccountAvailable()) return false;
  return String(inputEmail || '').trim().toLowerCase() === email() && inputPassword === password();
}

let cachedUser = null;

/** Stabiles Nutzerobjekt (gleiche Referenz, damit Effekte nicht ständig neu laufen) */
export function getDevUser() {
  if (!cachedUser) {
    cachedUser = {
      uid: 'dev_test_user',
      email: email(),
      displayName: 'Test-Konto',
      emailVerified: true,
      // Datenhaltung läuft über den lokalen Speicher des Gast-Modus
      isGuest: true,
      isDevAccount: true,
    };
  }
  return cachedUser;
}

export function isDevSessionActive() {
  if (!isDevAccountAvailable()) return false;
  try {
    return localStorage.getItem(DEV_ACCOUNT_FLAG) === 'true';
  } catch {
    return false;
  }
}
