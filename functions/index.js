import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { handleCoachStream, handleSummarize, handleGenerateProject, handleGenerateReminder } from '../server/geminiService.js';
import {
  getGoogleOAuthUrl,
  verifyOAuthState,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchEventsFromGoogle,
  createEventInGoogle,
  updateEventInGoogle,
  deleteEventInGoogle
} from '../server/calendarService.js';

initializeApp();
const auth = getAuth();
const db = getFirestore();

export const api = onRequest({ region: 'europe-west3', cors: true, maxInstances: 10 }, async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const url = req.url || '';
  const pathname = url.split('?')[0];

  // Helper für Authentifizierung & Whitelist
  async function verifyUser() {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw { status: 401, message: 'Nicht autorisiert: Fehlendes Authentifizierungs-Token.' };
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userEmail = decodedToken.email ? decodedToken.email.trim().toLowerCase() : '';
    const uid = decodedToken.uid;

    if (!userEmail) {
      throw { status: 403, message: 'Zugriff verweigert: Keine verifizierte E-Mail-Adresse im Token.' };
    }

    const whitelistDoc = await db.collection('whitelist').doc(userEmail).get();
    if (!whitelistDoc.exists) {
      throw { status: 403, message: 'Zugriff verweigert: Account nicht auf der Whitelist.' };
    }

    return { uid, userEmail };
  }

  // -------------------------------------------------------------
  // 1. GEMINI AI PROXY
  // -------------------------------------------------------------
  if (pathname.includes('/gemini/')) {
    try {
      await verifyUser();
      const endpoint = pathname.replace('/api/gemini/', '').replace('/gemini/', '').replace('/api/', '');

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Server-Konfigurationsfehler: Kein GEMINI_API_KEY hinterlegt.' });
      }

      const body = req.body || {};

      if (endpoint === 'coach') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        await handleCoachStream(
          {
            apiKey,
            prompt: body.prompt,
            systemInstruction: body.systemInstruction,
            aiModel: body.aiModel
          },
          (chunkText, fullText) => {
            res.write(`data: ${JSON.stringify({ chunk: chunkText, fullText })}\n\n`);
          }
        );

        res.write(`data: [DONE]\n\n`);
        return res.end();
      }

      if (endpoint === 'summarize') {
        const result = await handleSummarize({
          apiKey,
          text: body.text,
          aiModel: body.aiModel,
          lengthMode: body.lengthMode
        });
        return res.status(200).json(result);
      }

      if (endpoint === 'generate-project') {
        const result = await handleGenerateProject({
          apiKey,
          text: body.text,
          options: body.options,
          aiModel: body.aiModel
        });
        return res.status(200).json(result);
      }

      if (endpoint === 'generate-reminder') {
        const result = await handleGenerateReminder({
          apiKey,
          text: body.text,
          aiModel: body.aiModel
        });
        return res.status(200).json(result);
      }

      return res.status(404).json({ error: 'Unbekannter Gemini-Endpunkt: ' + endpoint });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Serverfehler beim KI-Aufruf.' });
    }
  }

  // -------------------------------------------------------------
  // 2. GOOGLE CALENDAR PROXY & OAUTH REFRESH FLOW
  // -------------------------------------------------------------
  if (pathname.includes('/calendar/')) {
    const endpoint = pathname.replace('/api/calendar/', '').replace('/calendar/', '').replace('/api/', '');
    const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/calendar/callback`;

    try {
      // A) Auth-URL abrufen (Authentifiziert)
      if (endpoint === 'auth-url') {
        const { uid } = await verifyUser();
        const authUrl = getGoogleOAuthUrl({
          uid,
          clientId: googleClientId,
          redirectUri,
          clientSecret: googleClientSecret
        });
        return res.status(200).json({ url: authUrl });
      }

      // B) OAuth Callback (Google leitet hierher zurück)
      if (endpoint === 'callback') {
        const code = req.query.code;
        const state = req.query.state;

        if (!code) {
          return res.status(400).send('<h3>Fehler: Kein Autorisierungs-Code empfangen.</h3>');
        }

        const { uid: verifiedUid } = verifyOAuthState(state, googleClientSecret);
        const tokens = await exchangeCodeForTokens({
          code,
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          redirectUri
        });

        if (tokens.refreshToken) {
          await db.collection('users').doc(verifiedUid).collection('tokens').doc('google').set({
            refreshToken: tokens.refreshToken,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

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
                  window.opener.postMessage({ type: 'FOCUSFLOW_CALENDAR_CONNECTED' }, window.location.origin);
                }
                setTimeout(() => window.close(), 1200);
              </script>
            </body>
          </html>
        `);
      }

      // C) Status-Prüfung
      if (endpoint === 'status') {
        const { uid } = await verifyUser();
        const tokenDoc = await db.collection('users').doc(uid).collection('tokens').doc('google').get();
        const isConnected = tokenDoc.exists && Boolean(tokenDoc.data()?.refreshToken);
        return res.status(200).json({ connected: isConnected });
      }

      // D) Events abrufen (GET) oder anlegen (POST)
      if (endpoint === 'events') {
        const { uid } = await verifyUser();
        const tokenDoc = await db.collection('users').doc(uid).collection('tokens').doc('google').get();

        if (!tokenDoc.exists || !tokenDoc.data()?.refreshToken) {
          return res.status(200).json({ connected: false, items: [] });
        }

        const { accessToken } = await refreshAccessToken({
          refreshToken: tokenDoc.data().refreshToken,
          clientId: googleClientId,
          clientSecret: googleClientSecret
        });

        if (req.method === 'GET') {
          const year = req.query.year;
          const monthIndex = req.query.monthIndex;
          const items = await fetchEventsFromGoogle({ accessToken, year, monthIndex });
          return res.status(200).json({ connected: true, items });
        }

        if (req.method === 'POST') {
          const body = req.body || {};
          const created = await createEventInGoogle({ accessToken, eventData: body.eventData || body });
          return res.status(200).json(created);
        }
      }

      // E) Event löschen oder aktualisieren (/api/calendar/events/:id)
      if (endpoint.startsWith('events/')) {
        const eventId = endpoint.replace('events/', '').split('?')[0];
        const { uid } = await verifyUser();
        const tokenDoc = await db.collection('users').doc(uid).collection('tokens').doc('google').get();

        if (!tokenDoc.exists || !tokenDoc.data()?.refreshToken) {
          return res.status(401).json({ error: 'Nicht mit Google Kalender verbunden.' });
        }

        const { accessToken } = await refreshAccessToken({
          refreshToken: tokenDoc.data().refreshToken,
          clientId: googleClientId,
          clientSecret: googleClientSecret
        });

        if (req.method === 'DELETE') {
          await deleteEventInGoogle({ accessToken, eventId });
          return res.status(200).json({ success: true });
        }

        if (req.method === 'PATCH' || req.method === 'PUT') {
          const body = req.body || {};
          const updated = await updateEventInGoogle({ accessToken, eventId, eventData: body.eventData || body });
          return res.status(200).json(updated);
        }
      }

      // F) Verbindung trennen
      if (endpoint === 'disconnect') {
        const { uid } = await verifyUser();
        await db.collection('users').doc(uid).collection('tokens').doc('google').delete();
        return res.status(200).json({ success: true, connected: false });
      }

      return res.status(404).json({ error: 'Unbekannter Kalender-Endpunkt: ' + endpoint });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Serverfehler beim Kalender-Aufruf.' });
    }
  }

  return res.status(404).json({ error: 'Unbekannter API-Endpunkt: ' + pathname });
});
