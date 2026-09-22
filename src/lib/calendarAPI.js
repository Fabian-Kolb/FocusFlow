// src/lib/calendarAPI.js
// Client API for Google Calendar proxy (/api/calendar/*)
// Authenticates every request with Firebase Auth ID-Token.
// NEVER exposes Google OAuth tokens in the browser or storage.

import { auth } from './firebase';

/**
 * Legacy Token-Bereinigung & Verbindungs-Flag
 */
export function saveCalendarTokens() {
  const uid = auth?.currentUser?.uid || 'user';
  localStorage.setItem(`ff_cal_connected_${uid}`, 'true');
  sessionStorage.removeItem(`ff_cal_token_${uid}`);
  localStorage.removeItem(`ff_cal_token_${uid}`);
  localStorage.removeItem(`ff_cal_refresh_${uid}`);
}

export function clearCalendarTokens() {
  const uid = auth?.currentUser?.uid || 'user';
  sessionStorage.removeItem(`ff_cal_token_${uid}`);
  localStorage.removeItem(`ff_cal_token_${uid}`);
  localStorage.removeItem(`ff_cal_refresh_${uid}`);
  localStorage.removeItem(`ff_cal_connected_${uid}`);
}

/**
 * Helper to get authorization headers with Firebase ID token
 */
async function getCalendarAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && auth.currentUser && !auth.currentUser.isGuest) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (e) {
      console.warn('[Calendar Auth] Konnte Firebase ID-Token nicht abrufen:', e);
    }
  }
  return headers;
}

/**
 * Checks if current user is connected to Google Calendar via backend status check
 */
export async function getCalendarConnectionStatus() {
  try {
    const headers = await getCalendarAuthHeaders();
    const response = await fetch('/api/calendar/status', { headers });
    if (response.ok) {
      const data = await response.json();
      const uid = auth?.currentUser?.uid || 'user';
      if (data.connected) {
        localStorage.setItem(`ff_cal_connected_${uid}`, 'true');
      } else {
        localStorage.removeItem(`ff_cal_connected_${uid}`);
      }
      return Boolean(data.connected);
    }
  } catch (err) {
    console.warn('[Calendar Status] Fehler bei Verbindungsprüfung:', err);
  }

  const uid = auth?.currentUser?.uid || 'user';
  return localStorage.getItem(`ff_cal_connected_${uid}`) === 'true';
}

/**
 * Requests Google OAuth 2.0 Consent URL from secure backend proxy
 */
export async function getCalendarAuthUrl() {
  const headers = await getCalendarAuthHeaders();
  const response = await fetch('/api/calendar/auth-url', { headers });

  if (!response.ok) {
    let errorMsg = 'Konnte Autorisierungs-URL nicht vom Server laden.';
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {
      // pass
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.url;
}

/**
 * Fetches calendar events for a specific month via backend proxy
 */
export async function fetchCalendarEvents(year, monthIndex) {
  try {
    const headers = await getCalendarAuthHeaders();
    const params = new URLSearchParams();
    if (year !== undefined && monthIndex !== undefined) {
      params.set('year', String(year));
      params.set('monthIndex', String(monthIndex));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/calendar/events${query}`, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        clearCalendarTokens();
        window.dispatchEvent(new CustomEvent('focusflow_calendar_sync_status', { detail: { connected: false } }));
      } else {
        console.error('Fehler beim Abrufen der Kalenderevents:', response.status);
      }
      return [];
    }

    const data = await response.json();
    if (data.connected === false) {
      clearCalendarTokens();
      window.dispatchEvent(new CustomEvent('focusflow_calendar_sync_status', { detail: { connected: false } }));
      return [];
    }
    return data.items || [];
  } catch (err) {
    console.error('Netzwerkfehler beim Abrufen der Kalenderevents:', err);
    return [];
  }
}

/**
 * Creates a new calendar event via backend proxy
 */
export async function createCalendarEvent(eventData) {
  const headers = await getCalendarAuthHeaders();
  const response = await fetch('/api/calendar/events', {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventData })
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearCalendarTokens();
      window.dispatchEvent(new CustomEvent('focusflow_calendar_sync_status', { detail: { connected: false } }));
    }
    let errorMsg = `Termin konnte nicht erstellt werden (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {
      // pass
    }
    throw new Error(errorMsg);
  }

  return await response.json();
}

/**
 * Updates an existing calendar event via backend proxy
 */
export async function updateCalendarEvent(eventId, eventData) {
  const headers = await getCalendarAuthHeaders();
  const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ eventId, eventData })
  });

  if (!response.ok) {
    let errorMsg = `Termin konnte nicht aktualisiert werden (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {
      // pass
    }
    throw new Error(errorMsg);
  }

  return await response.json();
}

/**
 * Deletes a calendar event via backend proxy
 */
export async function deleteCalendarEvent(eventId) {
  const headers = await getCalendarAuthHeaders();
  const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    let errorMsg = `Termin konnte nicht gelöscht werden (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {
      // pass
    }
    throw new Error(errorMsg);
  }

  return true;
}

/**
 * Disconnects Google Calendar on backend and local state
 */
export async function disconnectGoogleCalendar() {
  clearCalendarTokens();
  try {
    const headers = await getCalendarAuthHeaders();
    await fetch('/api/calendar/disconnect', {
      method: 'POST',
      headers
    });
  } catch (err) {
    console.warn('Fehler beim Backend-Disconnect:', err);
  }
  return true;
}
