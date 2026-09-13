import { getGoogleOAuthUrl } from '../../server/calendarService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { verifyAuthToken } from '../../server/authHelper.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'GET, OPTIONS')) {
    return;
  }

  // 1. Zwingende Authentifizierung über Firebase ID-Token (Schwachstelle #1 behoben)
  let user;
  try {
    user = await verifyAuthToken(req);
  } catch (authErr) {
    return res.status(authErr.statusCode || 401).json({ error: authErr.message || 'Nicht autorisiert' });
  }

  const uid = user.uid;
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // 2. Sichere Ableitung der redirectUri ohne ungeprüfte Query-Parameter
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const defaultRedirectUri = `${proto}://${host}/api/calendar/callback`;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;

  try {
    const authUrl = getGoogleOAuthUrl({
      uid,
      clientId: googleClientId,
      redirectUri,
      clientSecret: googleClientSecret
    });

    return res.status(200).json({ url: authUrl });
  } catch (err) {
    console.error('Calendar Auth URL Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Erstellen der Auth-URL' });
  }
}
