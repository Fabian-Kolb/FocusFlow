// server/authHelper.js
// Central, unified Firebase Authentication & Whitelist verification for all backend endpoints.
// Enforces cryptographically verified ID tokens, verified email status, and Firestore whitelist presence.

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'focusflow-d5a55';

const app = getApps().length > 0
  ? getApps()[0]
  : initializeApp({ projectId });

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Validates request authorization header, verifies Firebase ID-Token, checks email verification and whitelist.
 * Used by all API endpoints to guarantee uniform authorization rules.
 * @param {object} req - HTTP request object
 * @returns {Promise<{ uid: string, email: string, decodedToken: object }>}
 */
export async function authorizeUser(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Nicht autorisiert: Fehlendes Authentifizierungs-Token.');
    error.statusCode = 401;
    throw error;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    const error = new Error('Nicht autorisiert: Ungültiges Token-Format.');
    error.statusCode = 401;
    throw error;
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (err) {
    const error = new Error('Ungültiges oder abgelaufenes Token: ' + err.message);
    error.statusCode = 401;
    throw error;
  }

  const rawEmail = decodedToken.email;
  if (!rawEmail) {
    const error = new Error('Zugriff verweigert: Keine E-Mail-Adresse im Authentifizierungs-Token.');
    error.statusCode = 403;
    throw error;
  }

  const email = rawEmail.trim().toLowerCase();

  // 1. E-Mail-Verifizierungsprüfung (oder verifizierter Federated-Provider wie Google)
  const isEmailVerified = Boolean(
    decodedToken.email_verified || 
    decodedToken.firebase?.sign_in_provider === 'google.com'
  );

  if (!isEmailVerified) {
    const error = new Error('Zugriff verweigert: Die E-Mail-Adresse ist noch nicht verifiziert.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Whitelist-Prüfung in Firestore (verhindert unbefugte Nutzung aller APIs)
  if (db) {
    try {
      const whitelistDoc = await db.collection('whitelist').doc(email).get();
      if (!whitelistDoc.exists) {
        const error = new Error('Zugriff verweigert: Account nicht auf der Whitelist.');
        error.statusCode = 403;
        throw error;
      }
    } catch (dbErr) {
      if (dbErr.statusCode === 403) throw dbErr;
      console.warn('[authHelper] Whitelist-Prüfung Firestore-Fehler:', dbErr.message);
      if (process.env.NODE_ENV === 'production') {
        const error = new Error('Zugriff verweigert: Whitelist-Dienst nicht erreichbar.');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  return {
    uid: decodedToken.uid,
    email,
    decodedToken
  };
}

/**
 * Backward compatibility alias for existing code while transitioning
 */
export const verifyAuthToken = authorizeUser;

/**
 * Verifies that a given UID corresponds to an active, whitelisted user.
 * Used by OAuth Callbacks where authentication relies on signed HMAC states rather than Bearer headers.
 * @param {string} uid - Firebase user ID
 * @returns {Promise<{ uid: string, email: string, userRecord: object }>}
 */
export async function authorizeUid(uid) {
  if (!uid) {
    const error = new Error('Nicht autorisiert: Fehlende Benutzer-ID.');
    error.statusCode = 401;
    throw error;
  }

  let userRecord;
  try {
    userRecord = await auth.getUser(uid);
  } catch (err) {
    const error = new Error('Benutzerkonto existiert nicht oder wurde gelöscht.');
    error.statusCode = 403;
    throw error;
  }

  if (userRecord.disabled) {
    const error = new Error('Zugriff verweigert: Benutzerkonto ist deaktiviert.');
    error.statusCode = 403;
    throw error;
  }

  const rawEmail = userRecord.email;
  if (!rawEmail) {
    const error = new Error('Zugriff verweigert: Keine E-Mail im Benutzerkonto hinterlegt.');
    error.statusCode = 403;
    throw error;
  }

  const email = rawEmail.trim().toLowerCase();

  // Whitelist-Prüfung
  if (db) {
    try {
      const whitelistDoc = await db.collection('whitelist').doc(email).get();
      if (!whitelistDoc.exists) {
        const error = new Error('Zugriff verweigert: Account nicht auf der Whitelist.');
        error.statusCode = 403;
        throw error;
      }
    } catch (dbErr) {
      if (dbErr.statusCode === 403) throw dbErr;
      console.warn('[authHelper] authorizeUid Whitelist-Fehler:', dbErr.message);
      if (process.env.NODE_ENV === 'production') {
        const error = new Error('Zugriff verweigert: Whitelist-Dienst nicht erreichbar.');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  return { uid, email, userRecord };
}
