// server/tokenStore.js
// Secure server-side storage and retrieval of Google OAuth refresh tokens.
// Stores tokens strictly in Firestore 'server_tokens/{uid}' (isolated from client-accessible collections).
// Performs verified one-time migration and immediate deletion of legacy token paths.

import { db } from './authHelper.js';
import {
  getDevRefreshToken,
  saveDevRefreshToken,
  deleteDevRefreshToken
} from './calendarService.js';

/**
 * Retrieves the stored Google Calendar refresh token for a user.
 * 1. Checks isolated server collection: server_tokens/{uid}
 * 2. If missing, checks legacy path users/{uid}/tokens/google, migrates to server_tokens,
 *    and immediately DELETES the legacy document to eliminate security exposure.
 * 3. Falls back to dev store in local development environment.
 * @param {string} uid - Firebase user ID
 * @returns {Promise<string|null>} Refresh token if present, null otherwise
 */
export async function getStoredUserRefreshToken(uid) {
  if (!uid) return null;

  try {
    if (db) {
      // 1. Primary secure store
      const secureDoc = await db.collection('server_tokens').doc(uid).get();
      if (secureDoc.exists && secureDoc.data()?.refreshToken) {
        return secureDoc.data().refreshToken;
      }

      // 2. One-time Migration from legacy path with mandatory deletion
      const legacyDoc = await db.collection('users').doc(uid).collection('tokens').doc('google').get();
      if (legacyDoc.exists && legacyDoc.data()?.refreshToken) {
        const legacyToken = legacyDoc.data().refreshToken;
        
        // Write to new secure location
        await db.collection('server_tokens').doc(uid).set({
          refreshToken: legacyToken,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Immediately delete from legacy path so no token remains accessible
        await db.collection('users').doc(uid).collection('tokens').doc('google').delete();
        console.log(`[tokenStore] Successfully migrated and deleted legacy token for user ${uid}`);

        return legacyToken;
      }
    }
  } catch (err) {
    console.warn('[tokenStore] Firestore token read failed, checking dev store fallback:', err?.message);
  }

  return getDevRefreshToken(uid) || null;
}

/**
 * Saves or updates a Google Calendar refresh token for a user in server_tokens/{uid}.
 * Also ensures any residual legacy token document is destroyed.
 * @param {string} uid - Firebase user ID
 * @param {string} refreshToken - Google OAuth 2.0 refresh token
 * @returns {Promise<void>}
 */
export async function saveStoredUserRefreshToken(uid, refreshToken) {
  if (!uid || !refreshToken) return;

  try {
    if (db) {
      // Save strictly to isolated server_tokens collection
      await db.collection('server_tokens').doc(uid).set({
        refreshToken,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Clean up legacy document if it existed
      await db.collection('users').doc(uid).collection('tokens').doc('google').delete().catch(() => {});
    }
  } catch (err) {
    console.warn('[tokenStore] Firestore token write failed, saving to dev store fallback:', err?.message);
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
    if (db) {
      await Promise.all([
        db.collection('server_tokens').doc(uid).delete().catch(() => {}),
        db.collection('users').doc(uid).collection('tokens').doc('google').delete().catch(() => {})
      ]);
    }
  } catch (err) {
    console.warn('[tokenStore] Firestore token delete failed:', err?.message);
  }

  deleteDevRefreshToken(uid);
}
