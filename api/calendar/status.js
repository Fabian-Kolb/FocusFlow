import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { verifyAuthToken, getAdminInitStatus } from '../../server/authHelper.js';
import { getStoredUserRefreshToken } from '../../server/tokenStore.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'GET, OPTIONS')) {
    return;
  }

  // 1. Zwingende Authentifizierung per Firebase ID-Token (Schwachstelle #4 behoben)
  let user;
  try {
    user = await verifyAuthToken(req);
  } catch (authErr) {
    return res.status(authErr.statusCode || 401).json({ error: authErr.message || 'Nicht autorisiert' });
  }

  const uid = user.uid;

  try {
    const refreshToken = await getStoredUserRefreshToken(uid);
    const adminStatus = getAdminInitStatus();
    return res.status(200).json({ 
      connected: Boolean(refreshToken),
      diagnostics: {
        isDbReady: adminStatus.isReady,
        hasServiceAccountEnv: adminStatus.hasEnv,
        adminError: adminStatus.error || null
      }
    });
  } catch (err) {
    console.error('Calendar Status Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler bei Status-Prüfung' });
  }
}
