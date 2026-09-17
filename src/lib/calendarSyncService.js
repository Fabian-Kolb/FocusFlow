// src/lib/calendarSyncService.js
// Client-Service für die Synchronisation von FocusFlow-Entitäten (Erinnerungen & Aufgaben) mit Google Calendar.
// Nutzt ausschließlich calendarAPI.js für sichere Proxy-Kommunikation. Verarbeitet keine Tokens direkt.

import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendarAPI';

/**
 * Parst unterschiedliche Datums-Strings in ein standardisiertes 'YYYY-MM-DD' Format.
 * Unterstützt:
 * - 'YYYY-MM-DD'
 * - 'DD.MM.YY' (z. B. '18.09.26')
 * - 'DD.MM.YYYY' (z. B. '18.09.2026')
 * - 'Heute' / 'Morgen'
 */
export function normalizeDateStringToIso(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean || clean.toLowerCase() === 'demnächst' || clean.toLowerCase() === 'kein termin') {
    return null;
  }

  // Handle 'Heute' / 'Morgen'
  const now = new Date();
  if (clean.toLowerCase() === 'heute') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (clean.toLowerCase() === 'morgen') {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // DD.MM.YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // DD.MM.YY (z. B. 18.09.26 -> 2026-09-18)
  const ddmmyy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (ddmmyy) {
    const day = ddmmyy[1].padStart(2, '0');
    const month = ddmmyy[2].padStart(2, '0');
    const year = `20${ddmmyy[3]}`;
    return `${year}-${month}-${day}`;
  }

  // Fallback: try parsing with Date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Berechnet das exklusive Enddatum (+1 Tag) für ganztägige Google-Termine (RFC 5545).
 */
export function getExclusiveAllDayEndDate(isoDateStr) {
  if (!isoDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) return isoDateStr;
  const [y, m, d] = isoDateStr.split('-').map(Number);
  const nextDay = new Date(y, m - 1, d + 1);
  return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
}

/**
 * Bereitet die Google Calendar Event-Payload aus einer FocusFlow-Entität vor.
 */
export function parseDateToGooglePayload({
  title,
  description = '',
  date,
  time,
  durationMinutes = 60,
  colorId = ''
}) {
  if (!title || !title.trim()) {
    return { valid: false, error: 'Titel darf nicht leer sein.' };
  }

  const isoDate = normalizeDateStringToIso(date);
  if (!isoDate) {
    return { valid: false, error: 'Kein gültiges Datum vorhanden.' };
  }

  const cleanTime = (time || '').trim().replace(/uhr/i, '').trim();
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})/);

  // All-Day Event
  if (!timeMatch) {
    const endDate = getExclusiveAllDayEndDate(isoDate);
    return {
      valid: true,
      payload: {
        title: title.trim(),
        description: description.trim(),
        allDay: true,
        startDate: isoDate,
        endDate: endDate,
        ...(colorId && { colorId })
      }
    };
  }

  // Timed Event (Uhrzeit vorhanden)
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);

  const [year, month, day] = isoDate.split('-').map(Number);
  const startDt = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (isNaN(startDt.getTime())) {
    return { valid: false, error: 'Ungültige Zeitangabe.' };
  }

  const endDt = new Date(startDt.getTime() + (durationMinutes || 60) * 60 * 1000);

  const formatLocalIso = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return {
    valid: true,
    payload: {
      title: title.trim(),
      description: description.trim(),
      allDay: false,
      startTime: formatLocalIso(startDt),
      endTime: formatLocalIso(endDt),
      ...(colorId && { colorId })
    }
  };
}

/**
 * Synchronisiert eine Erinnerung oder Projektaufgabe idempotent mit Google Calendar.
 * Erkennt, ob bereits eine googleEventId existiert (führt dann Update statt Create aus).
 */
export async function syncEntityToGoogle({
  entity,
  type = 'reminder',
  projectTitle = '',
  phaseTitle = '',
  durationMinutes = 60,
  isConnected = false,
  isGuest = false
}) {
  if (isGuest) {
    throw new Error('Kalender-Synchronisation ist im Gastmodus nicht verfügbar.');
  }
  if (!isConnected) {
    throw new Error('Google Kalender ist nicht verbunden. Bitte zuerst in den Einstellungen verbinden.');
  }
  if (!entity) {
    throw new Error('Keine Entität zum Synchronisieren übergeben.');
  }

  let description = entity.description || '';
  if (type === 'task') {
    description = `Aufgabe aus Projekt: ${projectTitle || 'Unbenannt'}\nAbschnitt: ${phaseTitle || 'Allgemein'}${entity.note ? `\nNotiz: ${entity.note}` : ''}`;
  } else if (!description) {
    description = 'FocusFlow Erinnerung';
  }

  const { valid, payload, error } = parseDateToGooglePayload({
    title: entity.title,
    description,
    date: entity.date,
    time: entity.time,
    durationMinutes
  });

  if (!valid) {
    throw new Error(error || 'Datum oder Uhrzeit konnten nicht verarbeitet werden.');
  }

  // Idempotenz: Falls googleEventId bereits existiert -> Update
  if (entity.googleEventId) {
    try {
      const updated = await updateCalendarEvent(entity.googleEventId, payload);
      return {
        success: true,
        action: 'updated',
        googleEventId: entity.googleEventId,
        isCalendarSynced: true,
        event: updated
      };
    } catch (err) {
      // 404 Not Found: Das Event wurde in Google Calendar gelöscht
      if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
        return {
          success: false,
          action: 'notFound',
          error: 'Event existiert nicht mehr in Google Calendar.',
          googleEventId: null,
          isCalendarSynced: false
        };
      }
      throw err;
    }
  }

  // Neues Event anlegen
  const created = await createCalendarEvent(payload);
  const newEventId = created.id || created.eventId || (created.event && created.event.id);

  if (!newEventId) {
    throw new Error('Google Calendar API hat keine Event-ID zurückgegeben.');
  }

  return {
    success: true,
    action: 'created',
    googleEventId: newEventId,
    isCalendarSynced: true,
    event: created
  };
}

/**
 * Beendet die Synchronisation einer Entität.
 * Optional wird das Event in Google Calendar gelöscht.
 */
export async function desyncEntityFromGoogle({
  googleEventId,
  deleteInGoogle = false,
  isConnected = false,
  isGuest = false
}) {
  if (deleteInGoogle && googleEventId && isConnected && !isGuest) {
    try {
      await deleteCalendarEvent(googleEventId);
    } catch (err) {
      console.warn('[CalendarSync] Event konnte in Google nicht gelöscht werden (womöglich bereits entfernt):', err.message);
    }
  }

  return {
    success: true,
    googleEventId: null,
    isCalendarSynced: false
  };
}

/**
 * Batch-Synchronisation aller datierten Aufgaben eines Projekt-Abschnitts.
 * Gibt ein detailliertes Teilergebnis zurück ({ synced, skipped, failed }).
 */
export async function batchSyncPhaseTasksToGoogle({
  phase,
  projectTitle = '',
  isConnected = false,
  isGuest = false
}) {
  if (isGuest) {
    throw new Error('Kalender-Synchronisation ist im Gastmodus nicht verfügbar.');
  }
  if (!isConnected) {
    throw new Error('Google Kalender ist nicht verbunden.');
  }
  if (!phase || !Array.isArray(phase.tasks)) {
    return { synced: [], skipped: [], failed: [] };
  }

  const tasks = phase.tasks;
  const synced = [];
  const skipped = [];
  const failed = [];

  const promises = tasks.map(async (task) => {
    const isoDate = normalizeDateStringToIso(task.date);
    if (!isoDate) {
      skipped.push({
        taskId: task.id,
        title: task.title,
        reason: 'no_date'
      });
      return;
    }

    if (task.isCalendarSynced && task.googleEventId) {
      skipped.push({
        taskId: task.id,
        title: task.title,
        reason: 'already_synced'
      });
      return;
    }

    try {
      const result = await syncEntityToGoogle({
        entity: task,
        type: 'task',
        projectTitle,
        phaseTitle: phase.title,
        isConnected,
        isGuest
      });

      if (result.success && result.googleEventId) {
        synced.push({
          taskId: task.id,
          title: task.title,
          googleEventId: result.googleEventId
        });
      } else {
        failed.push({
          taskId: task.id,
          title: task.title,
          error: result.error || 'Unbekannter Fehler'
        });
      }
    } catch (err) {
      failed.push({
        taskId: task.id,
        title: task.title,
        error: err.message || 'Netzwerkfehler'
      });
    }
  });

  await Promise.allSettled(promises);

  return {
    synced,
    skipped,
    failed
  };
}
