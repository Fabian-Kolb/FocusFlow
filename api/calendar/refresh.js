import { refreshAccessToken } from '../../server/calendarService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  const refreshToken = body.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Kein refreshToken übergeben.' });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    const data = await refreshAccessToken({
      refreshToken,
      clientId: googleClientId,
      clientSecret: googleClientSecret
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('Refresh Token Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Aktualisieren des Tokens' });
  }
}
