import {
  refreshAccessToken,
  fetchEventsFromGoogle,
  createEventInGoogle,
  updateEventInGoogle,
  deleteEventInGoogle
} from '../../server/calendarService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { authorizeUser } from '../../server/authHelper.js';
import { getStoredUserRefreshToken, deleteStoredUserRefreshToken } from '../../server/tokenStore.js';
import { checkRateLimit } from '../../server/rateLimiter.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'GET, POST, PATCH, PUT, DELETE, OPTIONS')) {
    return;
  }

  // 1. Zwingende Authentifizierung per Firebase ID-Token & Whitelist
  let user;
  try {
    user = await authorizeUser(req);
  } catch (authErr) {
    return res.status(authErr.statusCode || 401).json({ error: authErr.message || 'Nicht autorisiert' });
  }

  // 2. Rate-Limiting Prüfung
  const rateLimit = checkRateLimit(req, user);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Anfrage-Limit erreicht: Bitte warte ca. ${rateLimit.minutesLeft} Minute(n).`
    });
  }

  const uid = user.uid;
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // 2. Refresh-Token des Nutzers sicher serverseitig abrufen
    const refreshToken = await getStoredUserRefreshToken(uid);

    if (!refreshToken) {
      if (req.method === 'GET') {
        return res.status(200).json({ connected: false, items: [] });
      }
      return res.status(401).json({ error: 'Nicht mit Google Kalender verknüpft.' });
    }

    // 3. Google Access-Token serverseitig erneuern (keine Client-Tokens beteiligt)
    let accessToken;
    try {
      const refreshed = await refreshAccessToken({
        refreshToken,
        clientId: googleClientId,
        clientSecret: googleClientSecret
      });
      accessToken = refreshed.accessToken;
    } catch (refreshErr) {
      if (refreshErr.isInvalidGrant || refreshErr.status === 400 || refreshErr.message?.includes('invalid_grant')) {
        console.warn(`[events] Google Refresh-Token für UID ${uid} ist abgelaufen oder widerrufen (invalid_grant). Lösche Token.`);
        await deleteStoredUserRefreshToken(uid);
        if (req.method === 'GET') {
          return res.status(200).json({ connected: false, items: [], reauthRequired: true });
        }
        return res.status(401).json({ error: 'Google Kalender Sitzung ist abgelaufen. Bitte neu verknüpfen.', connected: false, reauthRequired: true });
      }
      throw refreshErr;
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    // A) GET: Termine abrufen
    if (req.method === 'GET') {
      const year = req.query.year;
      const monthIndex = req.query.monthIndex;
      const items = await fetchEventsFromGoogle({ accessToken, year, monthIndex });
      return res.status(200).json({ connected: true, items });
    }

    // B) POST: Neuen Termin anlegen
    if (req.method === 'POST') {
      const eventData = body.eventData || body;
      const created = await createEventInGoogle({ accessToken, eventData });
      return res.status(200).json(created);
    }

    // C) PATCH / PUT: Termin bearbeiten
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const eventId = req.query.id || body.id || body.eventId;
      if (!eventId) {
        return res.status(400).json({ error: 'Event-ID fehlt für Aktualisierung.' });
      }
      const eventData = body.eventData || body;
      const updated = await updateEventInGoogle({ accessToken, eventId, eventData });
      return res.status(200).json(updated);
    }

    // D) DELETE: Termin löschen
    if (req.method === 'DELETE') {
      const eventId = req.query.id || body.id || body.eventId;
      if (!eventId) {
        return res.status(400).json({ error: 'Event-ID fehlt für Löschung.' });
      }
      await deleteEventInGoogle({ accessToken, eventId });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Calendar Events Proxy Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler bei Kalender-Aktion' });
  }
}
