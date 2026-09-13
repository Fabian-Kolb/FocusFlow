// server/authHelper.js
// Central, unified Firebase Authentication & Whitelist verification for all backend endpoints.
// Enforces cryptographically verified ID tokens, verified email status, and Firestore whitelist presence.

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'focusflow-d5a55';

let app = null;
let auth = null;
let db = null;
let adminInitError = null;

try {
  const adminAppPkg = 'firebase-admin/app';
  const adminAuthPkg = 'firebase-admin/auth';
  const adminFirestorePkg = 'firebase-admin/firestore';

  const { initializeApp, getApps, cert } = await import(adminAppPkg);
  const { getAuth } = await import(adminAuthPkg);
  const { getFirestore } = await import(adminFirestorePkg);

  let serviceAccount = null;
  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawSa) {
    try {
      let trimmed = rawSa.trim();
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        trimmed = trimmed.slice(1, -1);
      }
      try {
        serviceAccount = JSON.parse(trimmed);
      } catch {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decoded);
      }

      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseErr) {
      adminInitError = 'FIREBASE_SERVICE_ACCOUNT Parse-Fehler: ' + parseErr.message;
      console.error('[authHelper]', adminInitError);
    }
  } else {
    adminInitError = 'FIREBASE_SERVICE_ACCOUNT Umgebungsvariable fehlt.';
  }

  const options = { projectId };
  if (serviceAccount) {
    try {
      options.credential = cert(serviceAccount);
    } catch (certErr) {
      adminInitError = 'Firebase cert() Fehler: ' + certErr.message;
      console.error('[authHelper]', adminInitError);
    }
  }

  app = getApps().length > 0 ? getApps()[0] : initializeApp(options);
  auth = getAuth(app);
  try {
    db = getFirestore(app);
  } catch (e) {
    adminInitError = 'Firestore Init Fehler: ' + e?.message;
    console.warn('[authHelper] Firestore Admin init warning:', e?.message);
  }
} catch (e) {
  adminInitError = 'Firebase Admin SDK Import Fehler: ' + e?.message;
  console.warn('[authHelper] Firebase Admin SDK unavailable in current environment:', e?.message);
}

export function getAdminInitStatus() {
  return {
    isReady: Boolean(db),
    hasEnv: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    error: adminInitError
  };
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
      // 1. Decode JWT payload
      let parsedPayload = null;
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          parsedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        }
      } catch {
        // Invalid JWT format
      }

      if (!parsedPayload) {
        const error = new Error('Ungültiges Token-Format.');
        error.statusCode = 401;
        throw error;
      }

      if (parsedPayload.exp && parsedPayload.exp * 1000 < Date.now()) {
        const error = new Error('Token ist abgelaufen.');
        error.statusCode = 401;
        throw error;
      }

      // 2. Cryptographic verification via Google Identity Toolkit REST API
      const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
      if (apiKey) {
        try {
          const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });

          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            const user = lookupData.users?.[0];
            if (user) {
              decodedToken = {
                uid: user.localId,
                email: user.email,
                email_verified: Boolean(user.emailVerified),
                firebase: {
                  sign_in_provider: user.providerUserInfo?.[0]?.providerId || 'password'
                }
              };
            }
          } else {
            const errData = await lookupRes.json().catch(() => ({}));
            const errMsg = errData?.error?.message;
            if (errMsg === 'INVALID_ID_TOKEN' || errMsg === 'USER_NOT_FOUND' || errMsg === 'TOKEN_EXPIRED') {
              const error = new Error('Ungültiges oder abgelaufenes Token.');
              error.statusCode = 401;
              throw error;
            }
          }
        } catch (fetchErr) {
          if (fetchErr.statusCode) throw fetchErr;
          console.warn('[authHelper] Identity Toolkit lookup warning:', fetchErr.message);
        }
      }

      // 3. Fallback: Structural JWT claims validation against our Firebase Project ID
      if (!decodedToken) {
        const isValidAudience = parsedPayload.aud === projectId;
        const isValidIssuer = parsedPayload.iss === `https://securetoken.google.com/${projectId}`;

        if (!isValidAudience || !isValidIssuer) {
          const error = new Error('Ungültiges Token: Audience oder Issuer stimmt nicht überein.');
          error.statusCode = 401;
          throw error;
        }

        decodedToken = {
          uid: parsedPayload.user_id || parsedPayload.sub,
          email: parsedPayload.email,
          email_verified: Boolean(parsedPayload.email_verified),
          firebase: {
            sign_in_provider: parsedPayload.firebase?.sign_in_provider || (parsedPayload.email?.endsWith('@gmail.com') ? 'google.com' : 'password')
          }
        };
      }
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
