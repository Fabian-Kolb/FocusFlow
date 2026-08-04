// src/lib/calendarAPI.js
// A lightweight wrapper for Google Calendar REST API

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

/**
 * Holt die kommenden Termine aus dem Hauptkalender
 */
export async function fetchCalendarEvents(accessToken, year, monthIndex) {
  if (!accessToken) throw new Error("No access token provided");

  let timeMin, timeMax;
  
  // Wenn ein spezifischer Monat angefragt wird (dynamisches Laden)
  if (year !== undefined && monthIndex !== undefined) {
    // 1. Tag des Monats - 7 Tage Puffer (für Events die davor starten)
    timeMin = new Date(year, monthIndex, 1);
    timeMin.setDate(timeMin.getDate() - 7);
    
    // Letzter Tag des Monats + 7 Tage Puffer
    timeMax = new Date(year, monthIndex + 1, 0);
    timeMax.setDate(timeMax.getDate() + 7);
  } else {
    // Fallback (z.B. fürs generelle Dashboard): Letzte 3 Monate und nächste 6 Monate
    timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 3);
    timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6);
  }
  
  const response = await fetch(
    `${BASE_URL}/calendars/primary/events?timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=2500`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Erstellt einen neuen Kalendereintrag
 * eventData = { title, description, startTime (ISO), endTime (ISO) }
 */
export async function createCalendarEvent(accessToken, eventData) {
  if (!accessToken) throw new Error("No access token provided");

  let startObj = {};
  let endObj = {};

  if (eventData.allDay) {
    startObj = { date: eventData.startDate }; // e.g. "2026-08-04"
    endObj = { date: eventData.endDate };     // e.g. "2026-08-05" (End-Datum bei ganztägig ist exklusiv, also +1 Tag)
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
      overrides: [{ method: 'popup', minutes: parseInt(eventData.reminderMinutes) }]
    };
  } else if (eventData.reminderMinutes === "") {
    body.reminders = { useDefault: true };
  }

  const response = await fetch(`${BASE_URL}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.statusText}`);
  }

  const data = await response.json();
  return data; // Returns the full event object including event.id
}

/**
 * Aktualisiert einen bestehenden Eintrag
 */
export async function updateCalendarEvent(accessToken, eventId, eventData) {
  if (!accessToken) throw new Error("No access token provided");

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
      overrides: [{ method: 'popup', minutes: parseInt(eventData.reminderMinutes) }]
    };
  } else if (eventData.reminderMinutes === "") {
    body.reminders = { useDefault: true };
  }

  const response = await fetch(`${BASE_URL}/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to update event: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Löscht einen Eintrag
 */
export async function deleteCalendarEvent(accessToken, eventId) {
  if (!accessToken) throw new Error("No access token provided");

  const response = await fetch(`${BASE_URL}/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete event: ${response.statusText}`);
  }

  return true;
}
