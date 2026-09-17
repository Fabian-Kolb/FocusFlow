// tests/calendar_sync.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeDateStringToIso,
  getExclusiveAllDayEndDate,
  parseDateToGooglePayload,
  syncEntityToGoogle,
  desyncEntityFromGoogle,
  batchSyncPhaseTasksToGoogle
} from '../src/lib/calendarSyncService';
import { parseIntentChoice, parseAiActions } from '../src/lib/aiActionEngine';
import * as calendarAPI from '../src/lib/calendarAPI';

vi.mock('../src/lib/calendarAPI', () => ({
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn()
}));

describe('calendarSyncService - Datums- & Zeitzonenparser', () => {
  it('parst Standard YYYY-MM-DD korrekt', () => {
    expect(normalizeDateStringToIso('2026-09-17')).toBe('2026-09-17');
  });

  it('parst deutsches Format DD.MM.YYYY', () => {
    expect(normalizeDateStringToIso('17.09.2026')).toBe('2026-09-17');
    expect(normalizeDateStringToIso('5.3.2026')).toBe('2026-03-05');
  });

  it('parst deutsches Kurzformat DD.MM.YY', () => {
    expect(normalizeDateStringToIso('18.09.26')).toBe('2026-09-18');
    expect(normalizeDateStringToIso('01.01.25')).toBe('2025-01-01');
  });

  it('behandelt "Heute" und "Morgen" dynamisch', () => {
    const todayIso = normalizeDateStringToIso('Heute');
    expect(todayIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const tomorrowIso = normalizeDateStringToIso('Morgen');
    expect(tomorrowIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayIso).not.toBe(tomorrowIso);
  });

  it('gibt null für ungültige oder textuelle Platzhalter zurück', () => {
    expect(normalizeDateStringToIso('Demnächst')).toBeNull();
    expect(normalizeDateStringToIso('Kein Termin')).toBeNull();
    expect(normalizeDateStringToIso('')).toBeNull();
    expect(normalizeDateStringToIso(null)).toBeNull();
  });

  it('berechnet das exklusive Enddatum (+1 Tag) für All-Day Google Events (RFC 5545)', () => {
    expect(getExclusiveAllDayEndDate('2026-09-17')).toBe('2026-09-18');
    // Monatswechsel
    expect(getExclusiveAllDayEndDate('2026-09-30')).toBe('2026-10-01');
    // Jahreswechsel
    expect(getExclusiveAllDayEndDate('2026-12-31')).toBe('2027-01-01');
  });

  it('erzeugt All-Day Payload, wenn keine Uhrzeit übergeben wird', () => {
    const res = parseDateToGooglePayload({
      title: 'Steuererklärung',
      description: 'Wichtig',
      date: '2026-09-17'
    });
    expect(res.valid).toBe(true);
    expect(res.payload.allDay).toBe(true);
    expect(res.payload.startDate).toBe('2026-09-17');
    expect(res.payload.endDate).toBe('2026-09-18');
  });

  it('erzeugt Timed Payload mit 60 Min Standard-Dauer bei Uhrzeit', () => {
    const res = parseDateToGooglePayload({
      title: 'Team Meeting',
      date: '17.09.26',
      time: '14:30 Uhr'
    });
    expect(res.valid).toBe(true);
    expect(res.payload.allDay).toBe(false);
    expect(res.payload.startTime).toBe('2026-09-17T14:30:00');
    expect(res.payload.endTime).toBe('2026-09-17T15:30:00');
  });
});

describe('calendarSyncService - Idempotenz & Synchronisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wirft Fehler im Gastmodus', async () => {
    await expect(
      syncEntityToGoogle({
        entity: { title: 'Test', date: '2026-09-17' },
        isConnected: true,
        isGuest: true
      })
    ).rejects.toThrow(/Gastmodus/);
  });

  it('wirft Fehler wenn Kalender nicht verbunden', async () => {
    await expect(
      syncEntityToGoogle({
        entity: { title: 'Test', date: '2026-09-17' },
        isConnected: false,
        isGuest: false
      })
    ).rejects.toThrow(/nicht verbunden/);
  });

  it('legt ein neues Event an, wenn keine googleEventId existiert (Create)', async () => {
    calendarAPI.createCalendarEvent.mockResolvedValueOnce({ id: 'google_evt_123' });

    const entity = { id: 'rem_1', title: 'Zahnarzt', date: '2026-09-18', time: '10:00' };
    const result = await syncEntityToGoogle({
      entity,
      isConnected: true,
      isGuest: false
    });

    expect(calendarAPI.createCalendarEvent).toHaveBeenCalledTimes(1);
    expect(calendarAPI.updateCalendarEvent).not.toHaveBeenCalled();
    expect(result.action).toBe('created');
    expect(result.googleEventId).toBe('google_evt_123');
    expect(result.isCalendarSynced).toBe(true);
  });

  it('aktualisiert bestehendes Event idempotent, wenn googleEventId existiert (Update)', async () => {
    calendarAPI.updateCalendarEvent.mockResolvedValueOnce({ id: 'google_evt_existing' });

    const entity = {
      id: 'rem_1',
      title: 'Zahnarzt verschoben',
      date: '2026-09-19',
      time: '11:00',
      googleEventId: 'google_evt_existing',
      isCalendarSynced: true
    };

    const result = await syncEntityToGoogle({
      entity,
      isConnected: true,
      isGuest: false
    });

    expect(calendarAPI.updateCalendarEvent).toHaveBeenCalledWith(
      'google_evt_existing',
      expect.objectContaining({ title: 'Zahnarzt verschoben' })
    );
    expect(calendarAPI.createCalendarEvent).not.toHaveBeenCalled();
    expect(result.action).toBe('updated');
    expect(result.googleEventId).toBe('google_evt_existing');
  });

  it('fängt 404 Fehler bei Update ab und setzt den lokalen Sync-Status zurück', async () => {
    calendarAPI.updateCalendarEvent.mockRejectedValueOnce(new Error('Google Calendar 404 Not Found'));

    const entity = {
      id: 'rem_1',
      title: 'Gelöschter Termin',
      date: '2026-09-18',
      googleEventId: 'deleted_in_google'
    };

    const result = await syncEntityToGoogle({
      entity,
      isConnected: true,
      isGuest: false
    });

    expect(result.success).toBe(false);
    expect(result.action).toBe('notFound');
    expect(result.googleEventId).toBeNull();
    expect(result.isCalendarSynced).toBe(false);
  });
});

describe('calendarSyncService - De-Synchronisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('löscht das Google-Event, wenn deleteInGoogle true ist', async () => {
    calendarAPI.deleteCalendarEvent.mockResolvedValueOnce({ success: true });

    const result = await desyncEntityFromGoogle({
      googleEventId: 'evt_to_delete',
      deleteInGoogle: true,
      isConnected: true,
      isGuest: false
    });

    expect(calendarAPI.deleteCalendarEvent).toHaveBeenCalledWith('evt_to_delete');
    expect(result.googleEventId).toBeNull();
    expect(result.isCalendarSynced).toBe(false);
  });

  it('löscht das Google-Event NICHT, wenn deleteInGoogle false ist (im Kalender behalten)', async () => {
    const result = await desyncEntityFromGoogle({
      googleEventId: 'evt_to_keep',
      deleteInGoogle: false,
      isConnected: true,
      isGuest: false
    });

    expect(calendarAPI.deleteCalendarEvent).not.toHaveBeenCalled();
    expect(result.googleEventId).toBeNull();
    expect(result.isCalendarSynced).toBe(false);
  });
});

describe('calendarSyncService - Batch-Synchronisation für Abschnitte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert detailliertes Teilergebnis mit synced, skipped und failed', async () => {
    calendarAPI.createCalendarEvent
      .mockResolvedValueOnce({ id: 'evt_task_1' })
      .mockRejectedValueOnce(new Error('API Rate Limit exceeded'));

    const phase = {
      id: 'ph_1',
      title: 'Sprint 1',
      tasks: [
        { id: 't1', title: 'Task mit Datum', date: '2026-09-20' },
        { id: 't2', title: 'Task ohne Datum', date: 'Demnächst' },
        { id: 't3', title: 'Bereits synchronisiert', date: '2026-09-21', isCalendarSynced: true, googleEventId: 'already_there' },
        { id: 't4', title: 'Task mit Fehler', date: '2026-09-22' }
      ]
    };

    const result = await batchSyncPhaseTasksToGoogle({
      phase,
      projectTitle: 'FocusFlow 2.0',
      isConnected: true,
      isGuest: false
    });

    expect(result.synced).toHaveLength(1);
    expect(result.synced[0].taskId).toBe('t1');
    expect(result.synced[0].googleEventId).toBe('evt_task_1');

    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.find(s => s.taskId === 't2')?.reason).toBe('no_date');
    expect(result.skipped.find(s => s.taskId === 't3')?.reason).toBe('already_synced');

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].taskId).toBe('t4');
    expect(result.failed[0].error).toContain('API Rate Limit');
  });

  it('toleriert 404 Fehler beim Löschen in Google (Event bereits bei Google gelöscht)', async () => {
    calendarAPI.deleteCalendarEvent.mockRejectedValueOnce(new Error('Google Calendar 404 Not Found'));

    const result = await desyncEntityFromGoogle({
      googleEventId: 'evt_deleted_remotely',
      deleteInGoogle: true,
      isConnected: true,
      isGuest: false
    });

    expect(result.success).toBe(true);
    expect(result.googleEventId).toBeNull();
    expect(result.isCalendarSynced).toBe(false);
  });

  it('meldet echte Löschfehler statt fälschlich Erfolg zu signalisieren', async () => {
    calendarAPI.deleteCalendarEvent.mockRejectedValueOnce(new Error('Google Calendar 403 Forbidden'));

    await expect(desyncEntityFromGoogle({
      googleEventId: 'evt_forbidden',
      deleteInGoogle: true,
      isConnected: true,
      isGuest: false
    })).rejects.toThrow(/403/);
  });
});

describe('aiActionEngine - Kalender & Intent Choice Parsing', () => {
  it('parst [INTENT_CHOICE: appointment | title | date | time] korrekt', () => {
    const raw = `Soll ich den Termin in FocusFlow, synchronisiert oder nur im Kalender anlegen?
[INTENT_CHOICE: appointment | Zahnarztkontrolle | 2026-09-25 | 14:00]`;

    const { cleanText, intentChoice } = parseIntentChoice(raw);
    expect(cleanText).toBe('Soll ich den Termin in FocusFlow, synchronisiert oder nur im Kalender anlegen?');
    expect(intentChoice).toEqual({
      type: 'appointment',
      title: 'Zahnarztkontrolle',
      date: '2026-09-25',
      time: '14:00'
    });
  });

  it('gibt null für intentChoice zurück, wenn keine Markierung vorhanden ist', () => {
    const raw = 'Hier ist dein Wochenplan für die nächste Woche.';
    const { cleanText, intentChoice } = parseIntentChoice(raw);
    expect(cleanText).toBe(raw);
    expect(intentChoice).toBeNull();
  });

  it('parst CREATE_REMINDER mit syncWithCalendar: true', () => {
    const raw = `Ich lege die Erinnerung an.
\`\`\`focusflow-action
{
  "actions": [
    {
      "type": "CREATE_REMINDER",
      "title": "Steuerberater",
      "date": "2026-09-30",
      "time": "15:00",
      "syncWithCalendar": true
    }
  ]
}
\`\`\``;

    const { cleanText, actions } = parseAiActions(raw);
    expect(cleanText).toBe('Ich lege die Erinnerung an.');
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CREATE_REMINDER');
    expect(actions[0].syncWithCalendar).toBe(true);
  });

  it('parst CREATE_CALENDAR_EVENT für reine Google Kalender Einträge', () => {
    const raw = `Termin wird im Kalender eingetragen.
\`\`\`focusflow-action
{
  "actions": [
    {
      "type": "CREATE_CALENDAR_EVENT",
      "title": "Google Meet Call",
      "date": "2026-10-01",
      "time": "09:00"
    }
  ]
}
\`\`\``;

    const { cleanText, actions } = parseAiActions(raw);
    expect(cleanText).toBe('Termin wird im Kalender eingetragen.');
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CREATE_CALENDAR_EVENT');
    expect(actions[0].title).toBe('Google Meet Call');
  });
});
