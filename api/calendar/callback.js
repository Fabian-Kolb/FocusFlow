// api/calendar/callback.js - Vercel Serverless Function for Google Calendar OAuth Callback
import { verifyOAuthState, exchangeCodeForTokens } from '../../server/calendarService.js';

export default async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<h3>Fehler: Kein Autorisierungs-Code empfangen.</h3>');
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const clientRedirectUri = req.query.redirectUri;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = clientRedirectUri || process.env.GOOGLE_REDIRECT_URI || `${proto}://${host}/api/calendar/callback`;

  try {
    const { uid } = verifyOAuthState(state, googleClientSecret);
    const tokens = await exchangeCodeForTokens({
      code,
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      redirectUri
    });

    const accessToken = tokens.accessToken || '';
    const refreshToken = tokens.refreshToken || '';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Google Kalender verbunden</title></head>
        <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; background: #0f172a; color: white;">
          <div style="background: #1e293b; padding: 32px; border-radius: 16px; text-align: center; border: 1px solid #334155; max-width: 400px;">
            <div style="font-size: 40px; margin-bottom: 12px;">🗓️</div>
            <h2 style="color: #38bdf8; margin: 0 0 8px;">Erfolgreich verknüpft!</h2>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">Dein Google Kalender ist jetzt dauerhaft verbunden.</p>
            <p style="color: #64748b; font-size: 12px; margin-top: 16px;">Dieses Fenster schließt sich automatisch...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'FOCUSFLOW_CALENDAR_CONNECTED',
                uid: '${uid}',
                accessToken: '${accessToken}',
                refreshToken: '${refreshToken}'
              }, '*');
            }
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Calendar Callback Error:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(`<h3>Fehler bei der Kalender-Verknüpfung: ${err?.message || err}</h3>`);
  }
}
