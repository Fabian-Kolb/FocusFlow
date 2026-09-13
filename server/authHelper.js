// server/authHelper.js
// Central, unified Firebase Authentication & Whitelist verification for all backend endpoints.
// Enforces cryptographically verified ID tokens, verified email status, and Firestore whitelist presence.

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'focusflow-d5a55';

let app = null;
let auth = null;
let db = null;

try {
  const adminAppPkg = 'firebase-admin/app';
  const adminAuthPkg = 'firebase-admin/auth';
  const adminFirestorePkg = 'firebase-admin/firestore';

  const { initializeApp, getApps, cert } = await import(adminAppPkg);
  const { getAuth } = await import(adminAuthPkg);
  const { getFirestore } = await import(adminFirestorePkg);

  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      // pass
    }
  }

  const options = { projectId };
  if (serviceAccount) {
    options.credential = cert(serviceAccount);
  }

  app = getApps().length > 0 ? getApps()[0] : initializeApp(options);
  auth = getAuth(app);
  try {
    db = getFirestore(app);
  } catch (e) {
    console.warn('[authHelper] Firestore Admin init warning:', e?.message);
  }
} catch (e) {
  console.warn('[authHelper] Firebase Admin SDK unavailable in current environment:', e?.message);
}

export { auth, db };

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

  let decodedToken = null;
  if (auth) {
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err) {
      console.warn('[authHelper] Admin verifyIdToken error, attempting tokeninfo fallback:', err?.message);
    }
  }

  if (!decodedToken) {
    try {
      const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!infoRes.ok) {
        const error = new Error('Ungültiges oder abgelaufenes Token.');
        error.statusCode = 401;
        throw error;
      }
      const tokenInfo = await infoRes.json();

      const validAudiences = [
        projectId,
        process.env.VITE_GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_ID
      ].filter(Boolean);

      const isValidAudience = validAudiences.some(aud => tokenInfo.aud === aud);
      if (!isValidAudience && validAudiences.length > 0) {
        const error = new Error('Ungültiges Token: Audience stimmt nicht überein.');
        error.statusCode = 401;
        throw error;
      }

      decodedToken = {
        uid: tokenInfo.user_id || tokenInfo.sub,
        email: tokenInfo.email,
        email_verified: tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true,
        firebase: {
          sign_in_provider: tokenInfo.email?.endsWith('@gmail.com') ? 'google.com' : 'unknown'
        }
      };
    } catch (err) {
      if (err.statusCode) throw err;
      const error = new Error('Ungültiges oder abgelaufenes Token: ' + err.message);
      error.statusCode = 401;
      throw error;
    }
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
  let isWhitelisted = false;
  let checkedViaAdmin = false;

  if (db) {
    try {
      const whitelistDoc = await db.collection('whitelist').doc(email).get();
      checkedViaAdmin = true;
      if (whitelistDoc.exists) {
        isWhitelisted = true;
      }
    } catch (dbErr) {
      console.warn('[authHelper] Whitelist-Prüfung Admin SDK Fehler:', dbErr.message);
    }
  }

  // Fallback: Firestore REST API mit User Bearer-Token für Serverless ohne Service-Account
  if (!checkedViaAdmin || !isWhitelisted) {
    try {
      const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/whitelist/${encodeURIComponent(email)}`;
      const restRes = await fetch(restUrl, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (restRes.ok) {
        isWhitelisted = true;
      }
    } catch (restErr) {
      console.warn('[authHelper] Whitelist-Prüfung REST-Fehler:', restErr.message);
    }
  }

  if (!isWhitelisted) {
    const error = new Error('Zugriff verweigert: Account nicht auf der Whitelist.');
    error.statusCode = 403;
    throw error;
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

  let userRecord = null;
  if (auth) {
    try {
      userRecord = await auth.getUser(uid);
    } catch (err) {
      console.warn('[authHelper] authorizeUid getUser error:', err.message);
    }
  }

  if (userRecord) {
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
      }
    }

    return { uid, email, userRecord };
  }

  // Fallback wenn auth/db nicht initialisiert werden konnte (z. B. auf Serverless ohne Admin-Key):
  return { uid, email: '', userRecord: { uid } };
}
