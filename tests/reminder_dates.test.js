import { describe, it, expect } from 'vitest';
import { getReminderDateInfo, groupRemindersByTime } from '../src/lib/reminderDates';

// Fester "Jetzt"-Zeitpunkt: Donnerstag, 08.10.2026, 22:00 Uhr (lokale Zeit)
const NOW = new Date(2026, 9, 8, 22, 0, 0);

describe('getReminderDateInfo', () => {
  it('ohne Datum: Gruppe "none", Label "Kein Datum"', () => {
    const info = getReminderDateInfo({ date: 'Demnächst' }, NOW);
    expect(info.hasDate).toBe(false);
    expect(info.group).toBe('none');
    expect(info.dateLabel).toBe('Kein Datum');
  });

  it('heute ohne Uhrzeit ist noch nicht überfällig (gilt bis Tagesende)', () => {
    const info = getReminderDateInfo({ date: '2026-10-08' }, NOW);
    expect(info.group).toBe('today');
    expect(info.relativeLabel).toBe('heute');
  });

  it('heute mit vergangener Uhrzeit ist überfällig', () => {
    const info = getReminderDateInfo({ date: '2026-10-08', time: '09:00' }, NOW);
    expect(info.group).toBe('overdue');
    expect(info.urgency).toBe('overdue');
  });

  it('rechnet in Kalendertagen: morgen früh bleibt "morgen"', () => {
    const info = getReminderDateInfo({ date: '2026-10-09', time: '08:00' }, NOW);
    expect(info.dayDiff).toBe(1);
    expect(info.relativeLabel).toBe('morgen');
    expect(info.group).toBe('week');
  });

  it('unterscheidet nächste 7 Tage und später', () => {
    expect(getReminderDateInfo({ date: '2026-10-15' }, NOW).group).toBe('week');
    expect(getReminderDateInfo({ date: '2026-10-16' }, NOW).group).toBe('later');
  });

  it('versteht die Wörter "Heute" und "Morgen"', () => {
    expect(getReminderDateInfo({ date: 'Heute' }, NOW).group).toBe('today');
    expect(getReminderDateInfo({ date: 'Morgen' }, NOW).relativeLabel).toBe('morgen');
  });

  it('erledigte Erinnerungen landen immer in "done"', () => {
    expect(getReminderDateInfo({ date: '2026-10-01', status: 'ABGESCHLOSSEN' }, NOW).group).toBe('done');
    expect(getReminderDateInfo({ status: 'ABGESCHLOSSEN' }, NOW).group).toBe('done');
  });

  it('berechnet die verstrichene Zeit zwischen Anlage und Fälligkeit', () => {
    const created = new Date(2026, 9, 6, 22, 0, 0).getTime();
    const info = getReminderDateInfo({ date: '2026-10-10', time: '22:00', createdAt: created }, NOW);
    expect(info.timeElapsed).toBe(50);
  });
});

describe('groupRemindersByTime', () => {
  it('sortiert innerhalb der Gruppe nach Fälligkeit', () => {
    const groups = groupRemindersByTime([
      { id: 'b', date: '2026-10-12' },
      { id: 'a', date: '2026-10-10' },
      { id: 'x' },
    ], NOW);
    const week = groups.find((g) => g.id === 'week');
    expect(week.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(groups.find((g) => g.id === 'none').items.map((r) => r.id)).toEqual(['x']);
  });
});
