import {
  refreshAccessToken,
  fetchEventsFromGoogle,
  createEventInGoogle,
  updateEventInGoogle,
  deleteEventInGoogle
} from '../../server/calendarService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'GET, POST, PATCH, DELETE, OPTIONS')) {
    return;
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // If request has query or body event actions
    if (req.method === 'GET') {
      const year = req.query.year;
      const monthIndex = req.query.monthIndex;

      // When token is provided via Authorization header or fallback
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

      if (!token) {
        return res.status(200).json({ connected: false, items: [] });
      }

      try {
        const items = await fetchEventsFromGoogle({ accessToken: token, year, monthIndex });
        return res.status(200).json({ connected: true, items });
      } catch {
        return res.status(200).json({ connected: false, items: [] });
      }
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

      if (!token) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      const created = await createEventInGoogle({ accessToken: token, eventData: body.eventData || body });
      return res.status(200).json(created);
    }

    return res.status(200).json({ items: [] });
  } catch (err) {
    console.error('Calendar Events Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler bei Kalender-Aktion' });
  }
}
