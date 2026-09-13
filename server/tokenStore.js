// server/tokenStore.js
// Secure server-side storage and retrieval of Google OAuth refresh tokens.
// Stores tokens strictly in Firestore (or dev store in local dev), never exposing them to the client.

import { db } from './authHelper.js';
import {
  getDevRefreshToken,
  saveDevRefreshToken,
  deleteDevRefreshToken
} from './calendarService.js';

/**
 * Retrieves the stored Google Calendar refresh token for a user.
 * @param {string} uid - Firebase user ID
 * @returns {Promise<string|null>} Refresh token if present, null otherwise
 */
export async function getStoredUserRefreshToken(uid) {
  if (!uid) return null;

  try {
    if (db) {
      const doc = await db.collection('users').doc(uid).collection('tokens').doc('google').get();
      if (doc.exists && doc.data()?.refreshToken) {
        return doc.data().refreshToken;
      }
    }
  } catch (err) {
    // In local dev without credentials, fall back gracefully to local dev store
    console.warn('[tokenStore] Firestore token read failed, checking dev store fallback:', err?.message);
  }

  return getDevRefreshToken(uid) || null;
}

/**
 * Saves or updates a Google Calendar refresh token for a user.
 * @param {string} uid - Firebase user ID
 * @param {string} refreshToken - Google OAuth 2.0 refresh token
 * @returns {Promise<void>}
 */
export async function saveStoredUserRefreshToken(uid, refreshToken) {
  if (!uid || !refreshToken) return;

  try {
    if (db) {
      await db.collection('users').doc(uid).collection('tokens').doc('google').set({
        refreshToken,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err) {
    console.warn('[tokenStore] Firestore token write failed, saving to dev store fallback:', err?.message);
  }

  // Always keep dev store synchronized for local development convenience
  saveDevRefreshToken(uid, refreshToken);
}

/**
 * Deletes the stored Google Calendar refresh token for a user.
 * @param {string} uid - Firebase user ID
 * @returns {Promise<void>}
 */
export async function deleteStoredUserRefreshToken(uid) {
  if (!uid) return;

  try {
    if (db) {
      await db.collection('users').doc(uid).collection('tokens').doc('google').delete();
    }
  } catch (err) {
    console.warn('[tokenStore] Firestore token delete failed:', err?.message);
  }

  deleteDevRefreshToken(uid);
}
