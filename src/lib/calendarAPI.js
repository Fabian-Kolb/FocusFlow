// src/lib/calendarAPI.js
// Client API for Google Calendar REST API with invisible background token refresh

import { auth } from './firebase';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

function getStoredAccessToken() {
  const uid = auth?.currentUser?.uid || 'user';
  return localStorage.getItem(`ff_cal_token_${uid}`) || null;
}

function getStoredRefreshToken() {
  const uid = auth?.currentUser?.uid || 'user';
  return localStorage.getItem(`ff_cal_refresh_${uid}`) || null;
}

export function saveCalendarTokens({ accessToken, refreshToken }) {
  const uid = auth?.currentUser?.uid || 'user';
  if (accessToken) {
    localStorage.setItem(`ff_cal_token_${uid}`, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(`ff_cal_refresh_${uid}`, refreshToken);
  }
  localStorage.setItem(`ff_cal_connected_${uid}`, 'true');
}

export function clearCalendarTokens() {
  const uid = auth?.currentUser?.uid || 'user';
  localStorage.removeItem(`ff_cal_token_${uid}`);
  localStorage.removeItem(`ff_cal_refresh_${uid}`);
  localStorage.removeItem(`ff_cal_connected_${uid}`);
}

/**
 * Checks if current user is connected to Google Calendar
 */
export async function getCalendarConnectionStatus() {
  const uid = auth?.currentUser?.uid || 'user';
  const isConnected = localStorage.getItem(`ff_cal_connected_${uid}`) === 'true';
  const hasToken = Boolean(getStoredAccessToken() || getStoredRefreshToken());
  return isConnected && hasToken;
}

/**
 * Requests fresh access token using refresh token via backend proxy
 */
async function refreshActiveToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch('/api/calendar/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.accessToken) {
      saveCalendarTokens({ accessToken: data.accessToken });
      return data.accessToken;
    }
  } catch (err) {
    console.error('Fehler beim automatischen Token-Refresh:', err);
  }
  return null;
}

/**
 * Executes a Google Calendar API fetch with automatic token retry
 */
async function fetchWithGoogleAuth(url, options = {}) {
  let token = getStoredAccessToken();

  if (!token) {
    token = await refreshActiveToken();
  }

  if (!token) {
    throw new Error('Kein gültiges Google-Kalender-Token vorhanden. Bitte verbinde deinen Kalender neu.');
  }

  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`
  };

  let response = await fetch(url, options);

  // If 401 Unauthorized, automatically refresh and retry once
  if (response.status === 401) {
    const freshToken = await refreshActiveToken();
    if (freshToken) {
      options.headers.Authorization = `Bearer ${freshToken}`;
      response = await fetch(url, options);
    }
  }

  return response;
}

/**
 * Gets the Google OAuth 2.0 Consent URL from backend
 */
export async function getCalendarAuthUrl() {
  const uid = auth?.currentUser?.uid || 'user';
  const redirectUri = window.location.origin + '/api/calendar/callback';
  const response = await fetch(`/api/calendar/auth-url?uid=${encodeURIComponent(uid)}&redirectUri=${encodeURIComponent(redirectUri)}`);
  
  if (!response.ok) {
    throw new Error('Konnte Autorisierungs-URL nicht vom Server laden.');
  }
  const data = await response.json();
  return data.url;
}

/**
 * Fetches calendar events for a specific month
 */
export async function fetchCalendarEvents(year, monthIndex) {
  let timeMin, timeMax;

  if (year !== undefined && monthIndex !== undefined) {
    timeMin = new Date(parseInt(year, 10), parseInt(monthIndex, 10), 1);
    timeMin.setDate(timeMin.getDate() - 7);

    timeMax = new Date(parseInt(year, 10), parseInt(monthIndex, 10) + 1, 0);
    timeMax.setDate(timeMax.getDate() + 7);
  } else {
    timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 3);
    timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6);
  }

  const url = `${GOOGLE_CALENDAR_BASE}/calendars/primary/events?timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=2500`;

  const response = await fetchWithGoogleAuth(url);

  if (!response.ok) {
    console.error('Fehler beim Abrufen der Kalenderevents:', response.status);
    return [];
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Creates a new calendar event in Google Calendar
 */
export async function createCalendarEvent(eventData) {
  let startObj = {};
  let endObj = {};

  if (eventData.allDay) {
    startObj = { date: eventData.startDate };
    endObj = { date: eventData.endDate };
  } else {
    startObj = { dateTime: eventData.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    endObj = { dateTime: eventData.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  const body = {
    summary: eventData.title,
    description: eventData.description,
    start: startObj,
    end: endObj,
    ...(eventData.colorId && { colorId: eventData.colorId })
  };

  if (eventData.reminderMinutes !== undefined && eventData.reminderMinutes !== "") {
    body.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: parseInt(eventData.reminderMinutes, 10) }]
    };
  } else if (eventData.reminderMinutes === "") {
    body.reminders = { useDefault: true };
  }

  const response = await fetchWithGoogleAuth(`${GOOGLE_CALENDAR_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Termin konnte nicht erstellt werden (${response.status})`);
  }

  return await response.json();
}

/**
 * Updates an existing calendar event in Google Calendar
 */
export async function updateCalendarEvent(eventId, eventData) {
  let startObj = {};
  let endObj = {};

  if (eventData.allDay) {
    startObj = { date: eventData.startDate };
    endObj = { date: eventData.endDate };
  } else {
    startObj = { dateTime: eventData.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    endObj = { dateTime: eventData.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  const body = {
    summary: eventData.title,
    description: eventData.description,
    start: startObj,
    end: endObj,
    ...(eventData.colorId && { colorId: eventData.colorId })
  };

  if (eventData.reminderMinutes !== undefined && eventData.reminderMinutes !== "") {
    body.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: parseInt(eventData.reminderMinutes, 10) }]
    };
  } else if (eventData.reminderMinutes === "") {
    body.reminders = { useDefault: true };
  }

  const response = await fetchWithGoogleAuth(`${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Termin konnte nicht aktualisiert werden (${response.status})`);
  }

  return await response.json();
}

/**
 * Deletes a calendar event from Google Calendar
 */
export async function deleteCalendarEvent(eventId) {
  const response = await fetchWithGoogleAuth(`${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Termin konnte nicht gelöscht werden (${response.status})`);
  }

  return true;
}

/**
 * Disconnects Google Calendar
 */
export async function disconnectGoogleCalendar() {
  clearCalendarTokens();
  return true;
}
