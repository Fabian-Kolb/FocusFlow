import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleCoachStream, handleSummarize, handleGenerateProject, handleGenerateReminder } from './server/geminiService.js';
import {
  getGoogleOAuthUrl,
  verifyOAuthState,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchEventsFromGoogle,
  createEventInGoogle,
  updateEventInGoogle,
  deleteEventInGoogle,
  saveDevRefreshToken,
  getDevRefreshToken,
  deleteDevRefreshToken
} from './server/calendarService.js';

function apiProxyPlugin(envConfig) {
  const { geminiApiKey, googleClientId, googleClientSecret } = envConfig;

  return {
    name: 'focusflow-api-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // -------------------------------------------------------------
        // 1. GEMINI AI PROXY
        // -------------------------------------------------------------
        if (url.startsWith('/api/gemini/')) {
          const endpoint = url.replace('/api/gemini/', '').split('?')[0];

          let body = {};
          if (req.method === 'POST') {
            try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const rawBody = Buffer.concat(chunks).toString('utf-8');
              if (rawBody) body = JSON.parse(rawBody);
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Ungültiger JSON-Body: ' + err.message }));
            }
          }

          const key = geminiApiKey || process.env.GEMINI_API_KEY;
          if (!key) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Server: Kein GEMINI_API_KEY in Umgebungsvariablen gefunden.' }));
          }

          try {
            if (endpoint === 'coach') {
              res.setHeader('Content-Type', 'text/event-stream');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');

              await handleCoachStream(
                {
                  apiKey: key,
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
                apiKey: key,
                text: body.text,
                aiModel: body.aiModel,
                lengthMode: body.lengthMode
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(result));
            }

            if (endpoint === 'generate-project') {
              const result = await handleGenerateProject({
                apiKey: key,
                text: body.text,
                options: body.options,
                aiModel: body.aiModel
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(result));
            }

            if (endpoint === 'generate-reminder') {
              const result = await handleGenerateReminder({
                apiKey: key,
                text: body.text,
                aiModel: body.aiModel
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(result));
            }

            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Unbekannter Gemini-Endpunkt: ' + endpoint }));
          } catch (err) {
            console.error('[Gemini Proxy Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err?.message || 'Interner Server-Fehler beim KI-Aufruf.' }));
          }
        }

        // -------------------------------------------------------------
        // 2. GOOGLE CALENDAR PROXY & OAUTH
        // -------------------------------------------------------------
        if (url.startsWith('/api/calendar/')) {
          const parsedUrl = new URL(url, 'http://localhost:5173');
          const endpoint = parsedUrl.pathname.replace('/api/calendar/', '');
          const redirectUri = 'http://localhost:5173/api/calendar/callback';

          // Helper to parse JSON body
          let body = {};
          if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
            try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const rawBody = Buffer.concat(chunks).toString('utf-8');
              if (rawBody) body = JSON.parse(rawBody);
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Ungültiger JSON-Body: ' + err.message }));
            }
          }

          // User ID aus Header oder Query/Body ermitteln
          const uid = body.uid || parsedUrl.searchParams.get('uid') || 'dev_user';

          try {
            // A) Auth URL anfordern
            if (endpoint === 'auth-url') {
              const authUrl = getGoogleOAuthUrl({
                uid,
                clientId: googleClientId,
                redirectUri,
                clientSecret: googleClientSecret
              });
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ url: authUrl }));
            }

            // B) OAuth Callback
            if (endpoint === 'callback') {
              const code = parsedUrl.searchParams.get('code');
              const state = parsedUrl.searchParams.get('state');

              if (!code) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.end('<h3>Fehler: Kein Autorisierungs-Code von Google empfangen.</h3>');
              }

              const { uid: verifiedUid } = verifyOAuthState(state, googleClientSecret);
              const tokens = await exchangeCodeForTokens({
                code,
                clientId: googleClientId,
                clientSecret: googleClientSecret,
                redirectUri
              });

              if (tokens.refreshToken) {
                saveDevRefreshToken(verifiedUid, tokens.refreshToken);
              }

              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              return res.end(`
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
              const refreshToken = getDevRefreshToken(uid);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ connected: Boolean(refreshToken) }));
            }

            // D) Events abrufen (GET) oder erstellen (POST)
            if (endpoint === 'events') {
              const refreshToken = getDevRefreshToken(uid);
              if (!refreshToken) {
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ connected: false, items: [] }));
              }

              const { accessToken } = await refreshAccessToken({
                refreshToken,
                clientId: googleClientId,
                clientSecret: googleClientSecret
              });

              if (req.method === 'GET') {
                const year = parsedUrl.searchParams.get('year');
                const monthIndex = parsedUrl.searchParams.get('monthIndex');
                const items = await fetchEventsFromGoogle({ accessToken, year, monthIndex });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ connected: true, items }));
              }

              if (req.method === 'POST') {
                const created = await createEventInGoogle({ accessToken, eventData: body.eventData || body });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(created));
              }
            }

            // E) Event löschen oder aktualisieren (/api/calendar/events/:id)
            if (endpoint.startsWith('events/')) {
              const eventId = endpoint.replace('events/', '').split('?')[0];
              const refreshToken = getDevRefreshToken(uid);

              if (!refreshToken) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Nicht mit Google Kalender verbunden.' }));
              }

              const { accessToken } = await refreshAccessToken({
                refreshToken,
                clientId: googleClientId,
                clientSecret: googleClientSecret
              });

              if (req.method === 'DELETE') {
                await deleteEventInGoogle({ accessToken, eventId });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true }));
              }

              if (req.method === 'PATCH' || req.method === 'PUT') {
                const updated = await updateEventInGoogle({ accessToken, eventId, eventData: body.eventData || body });
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(updated));
              }
            }

            // F) Trennen
            if (endpoint === 'disconnect') {
              deleteDevRefreshToken(uid);
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, connected: false }));
            }

            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Unbekannter Kalender-Endpunkt: ' + endpoint }));
          } catch (calErr) {
            console.error('[Calendar Proxy Error]:', calErr);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: calErr?.message || 'Interner Server-Fehler bei Kalender-Aktion.' }));
          }
        }

        return next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiApiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
  const googleClientId = env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '';
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET || '';

  return {
    plugins: [
      react(),
      apiProxyPlugin({
        geminiApiKey,
        googleClientId,
        googleClientSecret
      })
    ]
  };
});
