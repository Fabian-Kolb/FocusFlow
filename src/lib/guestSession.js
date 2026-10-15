// Gast-Modus: Daten bleiben im Browser. Für die KI melden sich Gäste unsichtbar anonym bei
// Firebase an, damit der Server sie erkennen und begrenzen kann (server/guestAiPolicy.js).
// Anonyme Konten haben laut firestore.rules keinen Zugriff auf Daten (alles verlangt Whitelist).

import { signInAnonymously, signOut, deleteUser } from 'firebase/auth';
import { auth } from './firebase';

export const GUEST_STORAGE_FLAG = 'focusflow_is_guest';

export function isGuestSession() {
  try {
    return localStorage.getItem(GUEST_STORAGE_FLAG) === 'true';
  } catch {
    return false;
  }
}

let pendingSignIn = null;

/**
 * Liefert den anonymen Firebase-Nutzer des Gastes und legt ihn erst bei Bedarf an
 * (nur wenn ein Gast wirklich eine KI-Funktion nutzt).
 */
export async function ensureAnonymousGuest() {
  if (auth.currentUser) return auth.currentUser;
  if (!pendingSignIn) {
    pendingSignIn = signInAnonymously(auth)
      .then((cred) => cred.user)
      .finally(() => {
        pendingSignIn = null;
      });
  }
  try {
    return await pendingSignIn;
  } catch (err) {
    console.warn('[Gast] Anonyme Anmeldung fehlgeschlagen:', err?.code || err);
    throw new Error('Die KI für Gäste ist gerade nicht verfügbar. Bitte versuch es später noch einmal.');
  }
}

/** Beendet die anonyme Anmeldung und löscht das anonyme Konto, wenn möglich */
export async function endAnonymousGuest() {
  const current = auth.currentUser;
  if (!current?.isAnonymous) return;
  try {
    await deleteUser(current);
  } catch {
    await signOut(auth).catch(() => {});
  }
}
