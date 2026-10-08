import { describe, it, expect } from 'vitest';
import {
  normalizeRecurrence,
  getNextOccurrence,
  advanceRecurringReminder,
  formatRecurrence,
  getRecurrenceOptionId,
  isRecurring,
} from '../src/lib/recurrence';

// Freitag, 9. Oktober 2026, 10:00 Uhr
const NOW = new Date(2026, 9, 9, 10, 0);

describe('recurrence – Normalisierung & Anzeige', () => {
  it('verwirft ungültige Regeln', () => {
    expect(normalizeRecurrence(null)).toBeNull();
    expect(normalizeRecurrence({ freq: 'hourly' })).toBeNull();
    expect(isRecurring({ recurrence: { freq: 'daily', interval: 1 } })).toBe(true);
    expect(isRecurring({})).toBe(false);
  });

  it('begrenzt das Intervall und ignoriert es bei Werktags', () => {
    expect(normalizeRecurrence({ freq: 'weekly', interval: 0 })).toEqual({ freq: 'weekly', interval: 1 });
    expect(normalizeRecurrence({ freq: 'weekdays', interval: 5 })).toEqual({ freq: 'weekdays', interval: 1 });
  });

  it('formatiert Regeln auf Deutsch', () => {
    expect(formatRecurrence({ freq: 'daily', interval: 1 })).toBe('Täglich');
    expect(formatRecurrence({ freq: 'weekly', interval: 2 })).toBe('Alle 2 Wochen');
    expect(formatRecurrence({ freq: 'weekdays', interval: 1 })).toBe('Werktags');
    expect(formatRecurrence(null)).toBe('');
  });

  it('findet die passende Auswahl-Option', () => {
    expect(getRecurrenceOptionId(null)).toBe('none');
    expect(getRecurrenceOptionId({ freq: 'weekly', interval: 2 })).toBe('biweekly');
    expect(getRecurrenceOptionId({ freq: 'monthly', interval: 1, anchorDay: 31 })).toBe('monthly');
    expect(getRecurrenceOptionId({ freq: 'daily', interval: 3 })).toBeNull();
  });
});

describe('recurrence – nächster Termin', () => {
  it('täglich: heute fällig → morgen', () => {
    expect(getNextOccurrence('2026-10-09', { freq: 'daily', interval: 1 }, NOW)).toBe('2026-10-10');
  });

  it('wöchentlich: früh erledigt → genau eine Woche weiter', () => {
    expect(getNextOccurrence('2026-10-12', { freq: 'weekly', interval: 1 }, NOW)).toBe('2026-10-19');
  });

  it('überfällig: springt auf den ersten Termin nach heute (gleicher Wochentag)', () => {
    // Montag, 14.09. wöchentlich → nächster Montag nach dem 09.10. ist der 12.10.
    expect(getNextOccurrence('2026-09-14', { freq: 'weekly', interval: 1 }, NOW)).toBe('2026-10-12');
  });

  it('werktags: Freitag → Montag', () => {
    expect(new Date(2026, 9, 9).getDay()).toBe(5);
    expect(getNextOccurrence('2026-10-09', { freq: 'weekdays', interval: 1 }, NOW)).toBe('2026-10-12');
  });

  it('monatlich: 31. wird im kürzeren Monat gekürzt und kehrt danach zurück', () => {
    const jan31 = new Date(2027, 0, 31, 8, 0);
    const first = advanceRecurringReminder({ date: '2027-01-31', recurrence: { freq: 'monthly', interval: 1 } }, jan31);
    expect(first.date).toBe('2027-02-28');
    expect(first.recurrence.anchorDay).toBe(31);

    const feb28 = new Date(2027, 1, 28, 8, 0);
    const second = advanceRecurringReminder({ date: first.date, recurrence: first.recurrence }, feb28);
    expect(second.date).toBe('2027-03-31');
  });

  it('jährlich: 29.02. → 28.02. im Nicht-Schaltjahr', () => {
    const leap = new Date(2028, 1, 29, 8, 0);
    expect(getNextOccurrence('2028-02-29', { freq: 'yearly', interval: 1 }, leap)).toBe('2029-02-28');
  });

  it('ohne festes Datum („Heute“ / „Demnächst“) wird ab heute gerechnet', () => {
    expect(getNextOccurrence('Heute', { freq: 'daily', interval: 1 }, NOW)).toBe('2026-10-10');
    expect(getNextOccurrence('Demnächst', { freq: 'weekly', interval: 1 }, NOW)).toBe('2026-10-16');
  });

  it('ohne Regel kein nächster Termin', () => {
    expect(getNextOccurrence('2026-10-09', null, NOW)).toBeNull();
    expect(advanceRecurringReminder({ date: '2026-10-09' }, NOW)).toBeNull();
  });
});
