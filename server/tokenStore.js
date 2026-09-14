// server/tokenStore.js
// Secure server-side storage and retrieval of Google OAuth refresh tokens.
// Stores tokens strictly in Firestore 'server_tokens/{uid}' (isolated from client-accessible collections).
// Performs verified one-time migration and immediate deletion of legacy token paths.
// Supports both Firebase Admin SDK and zero-dependency Service Account REST API fallback for Vercel.

import { db, ensureAdminInit } from './authHelper.js';
import {
  firestoreRestGet,
  firestoreRestSet,
  firestoreRestDelete,
  getServiceAccountDiagnostics
} from './serviceAccountRest.js';
import {
  getDevRefreshToken,
  saveDevRefreshToken,
  deleteDevRefreshToken
} from './calendarService.js';

/**
 * Retrieves the stored Google Calendar refresh token for a user.
 * 1. Checks isolated server collection: server_tokens/{uid} via Admin SDK or REST API
 * 2. If missing, checks legacy path users/{uid}/tokens/google, migrates to server_tokens,
 *    and immediately DELETES the legacy document to eliminate security exposure.
 * 3. Falls back to dev store in local development environment.
 * @param {string} uid - Firebase user ID
 * @returns {Promise<string|null>} Refresh token if present, null otherwise
 */
export async function getStoredUserRefreshToken(uid) {
  if (!uid) return null;

  // 1. Try Firebase Admin SDK
  try {
    await ensureAdminInit();
    if (db) {
      const secureDoc = await db.collection('server_tokens').doc(uid).get();
      if (secureDoc.exists && secureDoc.data()?.refreshToken) {
        return secureDoc.data().refreshToken;
      }

      // One-time Migration from legacy path with mandatory deletion
      const legacyDoc = await db.collection('users').doc(uid).collection('tokens').doc('google').get();
      if (legacyDoc.exists && legacyDoc.data()?.refreshToken) {
        const legacyToken = legacyDoc.data().refreshToken;
        await db.collection('server_tokens').doc(uid).set({
          refreshToken: legacyToken,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        await db.collection('users').doc(uid).collection('tokens').doc('google').delete();
        console.log(`[tokenStore] Successfully migrated and deleted legacy token for user ${uid}`);
        return legacyToken;
      }
    }
  } catch (err) {
    console.warn('[tokenStore] Admin SDK token read failed, trying REST API:', err?.message);
  }

  // 2. Direct REST Fallback via Service Account
  try {
    const restData = await firestoreRestGet(`server_tokens/${uid}`);
    if (restData && restData.refreshToken) {
      return restData.refreshToken;
    }

    // Migration check via REST
    const legacyData = await firestoreRestGet(`users/${uid}/tokens/google`);
    if (legacyData && legacyData.refreshToken) {
      const legacyToken = legacyData.refreshToken;
      await firestoreRestSet(`server_tokens/${uid}`, {
        refreshToken: legacyToken,
        migratedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await firestoreRestDelete(`users/${uid}/tokens/google`);
      console.log(`[tokenStore] Successfully migrated and deleted legacy token via REST for user ${uid}`);
      return legacyToken;
    }
  } catch (restErr) {
    console.warn('[tokenStore] REST token read failed, checking dev store fallback:', restErr?.message);
  }

  return getDevRefreshToken(uid) || null;
}

/**
 * Saves or updates a Google Calendar refresh token for a user in server_tokens/{uid}.
 * Also ensures any residual legacy token document is destroyed.
 * Uses Admin SDK if available, or direct Service Account REST API.
 * @param {string} uid - Firebase user ID
 * @param {string} refreshToken - Google OAuth 2.0 refresh token
 * @returns {Promise<void>}
 */
export async function saveStoredUserRefreshToken(uid, refreshToken) {
  if (!uid || !refreshToken) {
    throw new Error('Speichern fehlgeschlagen: UID oder Refresh-Token fehlt.');
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  let saved = false;
  let lastError = null;

  // 1. Try Firebase Admin SDK
  try {
    await ensureAdminInit();
    if (db) {
      await db.collection('server_tokens').doc(uid).set({
        refreshToken,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await db.collection('users').doc(uid).collection('tokens').doc('google').delete().catch(() => {});
      console.log(`[tokenStore] Refresh-Token erfolgreich für UID ${uid} in Firestore via Admin SDK gespeichert.`);
      saved = true;
    }
  } catch (err) {
    console.warn('[tokenStore] Admin SDK write attempt failed, falling back to REST API:', err?.message);
    lastError = err;
  }

  // 2. Direct Service Account REST API fallback (guaranteed zero bundling issues on Vercel)
  if (!saved) {
    try {
      await firestoreRestSet(`server_tokens/${uid}`, {
        refreshToken,
        updatedAt: new Date().toISOString()
      });
      await firestoreRestDelete(`users/${uid}/tokens/google`).catch(() => {});
      console.log(`[tokenStore] Refresh-Token erfolgreich für UID ${uid} in Firestore via REST API gespeichert.`);
      saved = true;
    } catch (restErr) {
      console.error('[tokenStore] Firestore REST write failed:', restErr?.message);
      lastError = restErr;
    }
  }

  if (!saved && isServerless) {
    const diag = getServiceAccountDiagnostics();
    const hint = diag.error || lastError?.message || 'Unbekannter Serverless Fehler';
    throw new Error(`Firestore nicht bereit: ${hint}`);
  }

  // Always keep dev store synchronized for local development convenience
  saveDevRefreshToken(uid, refreshToken);
}

/**
 * Deletes the stored Google Calendar refresh token for a user.
 * Deletes from server_tokens, legacy path, and dev store.
 * @param {string} uid - Firebase user ID
 * @returns {Promise<void>}
 */
export async function deleteStoredUserRefreshToken(uid) {
  if (!uid) return;

  try {
    await ensureAdminInit();
    if (db) {
      await Promise.all([
        db.collection('server_tokens').doc(uid).delete().catch(() => {}),
        db.collection('users').doc(uid).collection('tokens').doc('google').delete().catch(() => {})
      ]);
    }
  } catch (err) {
    console.warn('[tokenStore] Firestore token delete via Admin SDK failed:', err?.message);
  }

  try {
    await Promise.all([
      firestoreRestDelete(`server_tokens/${uid}`),
      firestoreRestDelete(`users/${uid}/tokens/google`)
    ]);
  } catch (restErr) {
    console.warn('[tokenStore] Firestore token delete via REST failed:', restErr?.message);
  }

  deleteDevRefreshToken(uid);
}
