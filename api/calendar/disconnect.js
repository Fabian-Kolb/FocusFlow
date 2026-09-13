import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { verifyAuthToken } from '../../server/authHelper.js';
import { deleteStoredUserRefreshToken } from '../../server/tokenStore.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    await deleteStoredUserRefreshToken(uid);
    return res.status(200).json({ success: true, connected: false });
  } catch (err) {
    console.error('Calendar Disconnect Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Trennen des Kalenders' });
  }
}
