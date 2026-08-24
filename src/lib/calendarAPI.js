// src/lib/calendarAPI.js
// Client API for Google Calendar proxy routes (/api/calendar/*)
// Automatically authenticates with Firebase ID-Token

import { auth } from './firebase';

/**
 * Helper to build authenticated headers
 */
async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.warn('[Auth] Konnte ID-Token für Kalender nicht abrufen:', err);
    }
  }
  return headers;
}

/**
 * Checks if the current user has connected Google Calendar
 */
export async function getCalendarConnectionStatus() {
  try {
    const uid = auth?.currentUser?.uid || '';
    if (!uid) return false;

    const localFlag = localStorage.getItem('ff_cal_connected_' + uid);
    if (localFlag !== null) {
      return localFlag === 'true';
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/calendar/status?uid=${encodeURIComponent(uid)}`, {
      headers
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.connected);
  } catch (err) {
    console.error('Fehler beim Prüfen des Kalender-Status:', err);
    return false;
  }
}

/**
 * Gets the Google OAuth 2.0 Consent URL from backend
 */
export async function getCalendarAuthUrl() {
  const headers = await getAuthHeaders();
  const uid = auth?.currentUser?.uid || '';
  const response = await fetch(`/api/calendar/auth-url?uid=${encodeURIComponent(uid)}`, {
    headers
  });
  if (!response.ok) {
    throw new Error('Konnte Autorisierungs-URL nicht vom Server laden.');
  }
  const data = await response.json();
  return data.url;
}

/**
 * Fetches calendar events via secure backend proxy
 */
export async function fetchCalendarEvents(year, monthIndex) {
  const headers = await getAuthHeaders();
  const uid = auth?.currentUser?.uid || '';
  let url = `/api/calendar/events?uid=${encodeURIComponent(uid)}`;

  if (year !== undefined && monthIndex !== undefined) {
    url += `&year=${encodeURIComponent(year)}&monthIndex=${encodeURIComponent(monthIndex)}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Kalender-Events konnten nicht geladen werden (${response.status})`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Creates a new calendar event via backend proxy
 */
export async function createCalendarEvent(eventData) {
  const headers = await getAuthHeaders();
  const uid = auth?.currentUser?.uid || '';
  const response = await fetch('/api/calendar/events', {
    method: 'POST',
    headers,
    body: JSON.stringify({ uid, eventData })
  });

  if (!response.ok) {
    throw new Error(`Termin konnte nicht erstellt werden (${response.status})`);
  }

  return await response.json();
}

/**
 * Updates an existing calendar event via backend proxy
 */
export async function updateCalendarEvent(eventId, eventData) {
  const headers = await getAuthHeaders();
  const uid = auth?.currentUser?.uid || '';
  const response = await fetch(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ uid, eventData })
  });

  if (!response.ok) {
    throw new Error(`Termin konnte nicht aktualisiert werden (${response.status})`);
  }

  return await response.json();
}

/**
 * Deletes a calendar event via backend proxy
 */
export async function deleteCalendarEvent(eventId) {
  const headers = await getAuthHeaders();
  const uid = auth?.currentUser?.uid || '';
  const response = await fetch(`/api/calendar/events/${encodeURIComponent(eventId)}?uid=${encodeURIComponent(uid)}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    throw new Error(`Termin konnte nicht gelöscht werden (${response.status})`);
  }

  return true;
}

/**
 * Disconnects Google Calendar for current user
 */
export async function disconnectGoogleCalendar() {
  const uid = auth?.currentUser?.uid || '';
  if (uid) {
    localStorage.removeItem('ff_cal_connected_' + uid);
  }

  try {
    const headers = await getAuthHeaders();
    await fetch('/api/calendar/disconnect', {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid })
    });
  } catch {
    // ignore
  }

  return true;
}
