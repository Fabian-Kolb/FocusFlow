// api/calendar/auth-url.js - Vercel Serverless Function for Google Calendar OAuth URL
import { getGoogleOAuthUrl } from '../../server/calendarService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${proto}://${host}/api/calendar/callback`;

  const uid = req.query.uid || 'vercel_user';

  try {
    const authUrl = getGoogleOAuthUrl({
      uid,
      clientId: googleClientId,
      redirectUri,
      clientSecret: googleClientSecret
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ url: authUrl });
  } catch (err) {
    console.error('Calendar Auth URL Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Erstellen der Auth-URL' });
  }
}
