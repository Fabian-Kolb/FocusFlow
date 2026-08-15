// server/calendarService.js
// Server-side Google Calendar & OAuth 2.0 service for token exchange & API proxying

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

// Lokaler Cache-Speicher für Entwicklung
const DEV_TOKEN_FILE = path.join(process.cwd(), '.gemini', 'dev_calendar_tokens.json');

function getDevTokens() {
  try {
    if (fs.existsSync(DEV_TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(DEV_TOKEN_FILE, 'utf-8'));
    }
  } catch {
    // pass
  }
  return {};
}

function saveDevTokens(tokens) {
  try {
    const dir = path.dirname(DEV_TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEV_TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch {
    // pass
  }
}

/**
 * Generates an encrypted & signed state parameter to prevent CSRF attacks
 */
export function generateOAuthState(uid, clientSecret) {
  const timestamp = Date.now();
  const rawData = `${uid}:${timestamp}`;
  const signature = crypto.createHmac('sha256', clientSecret || 'default_secret').update(rawData).digest('hex');
  return Buffer.from(`${rawData}:${signature}`).toString('base64url');
}

/**
 * Verifies the CSRF state parameter and extracts the userId
 */
export function verifyOAuthState(stateStr, clientSecret) {
  if (!stateStr) throw new Error('State-Parameter fehlt.');

  try {
    const decoded = Buffer.from(stateStr, 'base64url').toString('utf-8');
    const [uid, timestampStr, signature] = decoded.split(':');

    if (!uid || !timestampStr || !signature) {
      throw new Error('Ungültige State-Struktur.');
    }

    const timestamp = parseInt(timestampStr, 10);
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      throw new Error('State-Parameter abgelaufen (älter als 15 Minuten).');
    }

    const expectedSignature = crypto.createHmac('sha256', clientSecret || 'default_secret').update(`${uid}:${timestamp}`).digest('hex');
    if (signature !== expectedSignature) {
      throw new Error('State-Signatur ungültig (möglicher CSRF-Angriff).');
    }

    return { uid };
  } catch (err) {
    throw new Error('State-Verifikation fehlgeschlagen: ' + err.message);
  }
}

/**
 * Generates the Google OAuth 2.0 Consent URL with offline access and mandatory consent prompt
 */
export function getGoogleOAuthUrl({ uid, clientId, redirectUri, clientSecret }) {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('OAuth-Konfiguration unvollständig (clientId, clientSecret oder redirectUri fehlt).');
  }

  const state = generateOAuthState(uid, clientSecret);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent', // Zwingend: Garantiert, dass Google immer einen refresh_token mitsendet
    state: state
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges the one-time authorization code for access_token and refresh_token
 */
export async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Token-Exchange fehlgeschlagen (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in
  };
}

/**
 * Uses a refresh_token to acquire a fresh 60-minute access_token in milliseconds
 */
export async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  if (!refreshToken) throw new Error('Kein Refresh-Token vorhanden.');

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    }).toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Token-Refresh fehlgeschlagen (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  };
}

/**
 * Fetches calendar events from Google Calendar REST API
 */
export async function fetchEventsFromGoogle({ accessToken, year, monthIndex }) {
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

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar API Fehler (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Creates a new calendar event in Google
 */
export async function createEventInGoogle({ accessToken, eventData }) {
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

  const response = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Termin-Erstellung fehlgeschlagen (${response.status}): ${errText}`);
  }

  return await response.json();
}

/**
 * Updates a calendar event in Google
 */
export async function updateEventInGoogle({ accessToken, eventId, eventData }) {
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

  const response = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Termin-Aktualisierung fehlgeschlagen (${response.status}): ${errText}`);
  }

  return await response.json();
}

/**
 * Deletes a calendar event in Google
 */
export async function deleteEventInGoogle({ accessToken, eventId }) {
  const response = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Termin-Löschung fehlgeschlagen (${response.status}): ${errText}`);
  }

  return true;
}

// -------------------------------------------------------------
// Unified Handler Methods (shared between Vite Dev Server & Cloud Functions)
// -------------------------------------------------------------

export function saveDevRefreshToken(uid, refreshToken) {
  const tokens = getDevTokens();
  tokens[uid] = { refreshToken, updatedAt: new Date().toISOString() };
  saveDevTokens(tokens);
}

export function getDevRefreshToken(uid) {
  const tokens = getDevTokens();
  return tokens[uid]?.refreshToken || null;
}

export function deleteDevRefreshToken(uid) {
  const tokens = getDevTokens();
  delete tokens[uid];
  saveDevTokens(tokens);
}
