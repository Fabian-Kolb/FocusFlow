// server/authHelper.js
// Central Firebase ID-Token verification for Vercel Serverless & Node.js backends
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'focusflow-d5a55';

const app = getApps().length > 0
  ? getApps()[0]
  : initializeApp({ projectId });

const auth = getAuth(app);

/**
 * Verifies the Bearer Firebase ID Token in the request header.
 * @param {object} req - HTTP request object
 * @returns {Promise<{ uid: string, email: string, decodedToken: object }>}
 */
export async function verifyAuthToken(req) {
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

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const email = decodedToken.email ? decodedToken.email.trim().toLowerCase() : '';

    return {
      uid: decodedToken.uid,
      email,
      decodedToken
    };
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error('Ungültiges oder abgelaufenes Token: ' + err.message);
    error.statusCode = 401;
    throw error;
  }
}
