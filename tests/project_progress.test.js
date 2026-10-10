import { describe, it, expect } from 'vitest';
import {
  parseIsoDay,
  formatTaskDate,
  normalizeProjectStatus,
  getPhaseStats,
  getProjectTimeline,
  getProjectStats,
} from '../src/lib/projectProgress';

// Feste lokale Uhrzeit, damit die Tests in jeder Zeitzone gelten
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);

const task = (id, completed = false) => ({ id, title: `Aufgabe ${id}`, completed });

describe('parseIsoDay / formatTaskDate', () => {
  it('liest YYYY-MM-DD als lokalen Tag', () => {
    const day = parseIsoDay('2026-10-09');
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(9);
    expect(day.getDate()).toBe(9);
    expect(day.getHours()).toBe(0);
  });

  it('lehnt andere Formate ab', () => {
    expect(parseIsoDay('09.10.26')).toBeNull();
    expect(parseIsoDay('')).toBeNull();
    expect(parseIsoDay(undefined)).toBeNull();
  });

  it('formatiert ISO-Tage kurz und lässt Freitext stehen', () => {
    expect(formatTaskDate('2026-10-12')).toBe('12.10.26');
    expect(formatTaskDate('Freitag, 17. Mai')).toBe('Freitag, 17. Mai');
    expect(formatTaskDate('')).toBe('');
  });
});

describe('normalizeProjectStatus', () => {
  it('macht aus IN ARBEIT den Status AKTIV', () => {
    expect(normalizeProjectStatus('IN ARBEIT')).toBe('AKTIV');
    expect(normalizeProjectStatus('GEPLANT')).toBe('GEPLANT');
  });
});

describe('getPhaseStats', () => {
  it('zählt erledigte Aufgaben live statt gespeichertem badgeText', () => {
    const phase = { badgeText: '0/0 ERLEDIGT', tasks: [task(1, true), task(2, true), task(3)] };
    expect(getPhaseStats(phase)).toMatchObject({ total: 3, completed: 2, isDone: false, label: '2/3 erledigt' });
  });

  it('meldet Erledigt, wenn alle Aufgaben abgehakt sind', () => {
    const phase = { completed: false, tasks: [task(1, true), task(2, true)] };
    expect(getPhaseStats(phase)).toMatchObject({ isDone: true, label: 'Erledigt' });
  });

  it('nutzt ohne Aufgaben das gespeicherte Häkchen', () => {
    expect(getPhaseStats({ tasks: [] }).label).toBe('Keine Aufgaben');
    expect(getPhaseStats({ completed: true, tasks: [] }).isDone).toBe(true);
  });
});

describe('getProjectTimeline', () => {
  const project = { startDate: '2026-08-01', endDate: '2026-09-30', status: 'AKTIV' };

  it('zeigt bei abgelaufenem Projekt 100 % und Überfälligkeit', () => {
    const t = getProjectTimeline(project, at(2026, 10, 9));
    expect(t.timeElapsed).toBe(100);
    expect(t.isOverdue).toBe(true);
    expect(t.daysLeft).toBe(-9);
    expect(t.deadlineLabel).toBe('9 Tage überfällig');
    expect(t.dateRange).toBe('01.08.26 – 30.09.26');
    expect(t.dayLabel).toBe('');
  });

  it('rechnet die verstrichene Zeit mitten im Zeitraum', () => {
    // 1.–10. Oktober = 10 Tage; am 6. Oktober um 0 Uhr sind 5 Tage vorbei
    const t = getProjectTimeline({ startDate: '2026-10-01', endDate: '2026-10-10' }, at(2026, 10, 6, 0));
    expect(t.timeElapsed).toBe(50);
    expect(t.dayLabel).toBe('Tag 6 von 10');
    expect(t.deadlineLabel).toBe('Noch 4 Tage');
    expect(t.isOverdue).toBe(false);
  });

  it('kennt morgen, heute und den Start in der Zukunft', () => {
    expect(getProjectTimeline({ endDate: '2026-10-10' }, at(2026, 10, 9)).deadlineLabel).toBe('Bis morgen');
    expect(getProjectTimeline({ endDate: '2026-10-09' }, at(2026, 10, 9, 23)).deadlineLabel).toBe('Heute fällig');
    expect(getProjectTimeline({ startDate: '2026-10-12', endDate: '2026-10-30' }, at(2026, 10, 9)).deadlineLabel)
      .toBe('Start in 3 Tagen');
  });

  it('meldet abgeschlossene Projekte nicht als überfällig', () => {
    const t = getProjectTimeline({ ...project, status: 'ABGESCHLOSSEN' }, at(2026, 10, 9));
    expect(t.isOverdue).toBe(false);
    expect(t.deadlineLabel).toBe('');
  });

  it('liefert ohne Daten leere Werte statt erfundener Daten', () => {
    const t = getProjectTimeline({}, at(2026, 10, 9));
    expect(t).toMatchObject({ dateRange: '', timeElapsed: null, daysLeft: null, deadlineLabel: '', isOverdue: false });
  });
});

describe('getProjectStats', () => {
  const project = {
    status: 'IN ARBEIT',
    progress: 12, // veraltet, darf nicht angezeigt werden
    phases: [
      { id: 'a', tasks: [task(1, true), task(2, true)] },
      { id: 'b', tasks: [task(3, true), task(4, true), task(5)] },
      { id: 'c', tasks: [task(6)] },
    ],
  };

  it('rechnet Fortschritt und Zähler aus den Aufgaben', () => {
    const s = getProjectStats(project, at(2026, 10, 9));
    expect(s).toMatchObject({ tasksTotal: 6, tasksCompleted: 4, phasesTotal: 3, phasesCompleted: 1, progress: 67 });
  });

  it('findet die nächste offene Aufgabe im ersten offenen Abschnitt', () => {
    const { nextTask } = getProjectStats(project);
    expect(nextTask.task.id).toBe(5);
    expect(nextTask.phase.id).toBe('b');
  });

  it('kommt ohne Abschnitte aus', () => {
    expect(getProjectStats({})).toMatchObject({ tasksTotal: 0, progress: 0, nextTask: null, phasesTotal: 0 });
    expect(getProjectStats({ status: 'ABGESCHLOSSEN' }).progress).toBe(100);
  });
});
