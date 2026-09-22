import { refreshAccessToken } from '../../server/calendarService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { verifyAuthToken } from '../../server/authHelper.js';
import { getStoredUserRefreshToken, deleteStoredUserRefreshToken } from '../../server/tokenStore.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Zwingende Authentifizierung per Firebase ID-Token
  let user;
  try {
    user = await verifyAuthToken(req);
  } catch (authErr) {
    return res.status(authErr.statusCode || 401).json({ error: authErr.message || 'Nicht autorisiert' });
  }

  const uid = user.uid;

  // 2. Schließen des Token-Exchange-Orakels (Schwachstelle #5 behoben):
  // Es wird niemals ein vom Client übermitteltes Refresh-Token akzeptiert.
  // Das Token wird ausschließlich serverseitig für die verifizierte UID aus Firestore/Store bezogen.
  const refreshToken = await getStoredUserRefreshToken(uid);

  if (!refreshToken) {
    return res.status(400).json({ error: 'Kein Kalender für diesen Account verknüpft.' });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    const data = await refreshAccessToken({
      refreshToken,
      clientId: googleClientId,
      clientSecret: googleClientSecret
    });

    return res.status(200).json({
      accessToken: data.accessToken,
      expiresIn: data.expiresIn
    });
  } catch (err) {
    if (err.isInvalidGrant || err.status === 400 || err.message?.includes('invalid_grant')) {
      console.warn(`[refresh] Refresh-Token für UID ${uid} abgelaufen (invalid_grant). Lösche Token.`);
      await deleteStoredUserRefreshToken(uid);
      return res.status(401).json({ error: 'Google Kalender Sitzung ist abgelaufen. Bitte neu verknüpfen.', connected: false, reauthRequired: true });
    }
    console.error('Refresh Token Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Aktualisieren des Tokens' });
  }
}
