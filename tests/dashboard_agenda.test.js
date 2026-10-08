import { describe, it, expect } from 'vitest';
import { buildAgenda, getNextTimed, formatMinutes, overdueLabel } from '../src/lib/dashboardAgenda';

// Freitag, 9. Oktober 2026, 10:00 Uhr
const NOW = new Date(2026, 9, 9, 10, 0);

const reminder = (over) => ({ id: 'r1', title: 'Zahnarzt', status: 'AKTIV', date: '2026-10-09', time: '', ...over });
const project = (tasks, over = {}) => ({
  id: 'p1',
  title: 'Umzug',
  status: 'AKTIV',
  phases: [{ id: 'ph1', title: 'Phase', tasks }],
  ...over,
});
const event = (over) => ({
  id: 'e1',
  summary: 'Team-Meeting',
  start: { dateTime: new Date(2026, 9, 9, 14, 0).toISOString() },
  end: { dateTime: new Date(2026, 9, 9, 15, 0).toISOString() },
  ...over,
});
const monthKeyOf = (d) => `${d.getFullYear()}-${d.getMonth()}`;

describe('buildAgenda – Tage und Überfälliges', () => {
  it('liefert 7 Tage, der erste ist heute', () => {
    const agenda = buildAgenda({ now: NOW });
    expect(agenda.days).toHaveLength(7);
    expect(agenda.days[0].isToday).toBe(true);
    expect(agenda.days[0].key).toBe('2026-10-09');
    expect(agenda.days[6].key).toBe('2026-10-15');
  });

  it('sortiert Erinnerungen nach Datum in Heute, Folgetage und Überfällig', () => {
    const agenda = buildAgenda({
      now: NOW,
      reminders: [
        reminder({ id: 'a', date: '2026-10-09' }),
        reminder({ id: 'b', date: '2026-10-11' }),
        reminder({ id: 'c', date: '2026-10-07' }),
        reminder({ id: 'd', date: '2026-10-30' }),
      ],
    });
    expect(agenda.days[0].items.map((i) => i.id)).toEqual(['a']);
    expect(agenda.days[2].items.map((i) => i.id)).toEqual(['b']);
    expect(agenda.overdue.map((i) => i.id)).toEqual(['c']);
    expect(agenda.overdue[0].dueLabel).toBe('vor 2 T.');
  });

  it('zeigt Erledigtes nur heute, nicht in Überfällig oder an Folgetagen', () => {
    const agenda = buildAgenda({
      now: NOW,
      reminders: [
        reminder({ id: 'done-today', status: 'ABGESCHLOSSEN', date: '2026-10-09' }),
        reminder({ id: 'done-old', status: 'ABGESCHLOSSEN', date: '2026-10-01' }),
        reminder({ id: 'done-later', status: 'ABGESCHLOSSEN', date: '2026-10-12' }),
      ],
    });
    expect(agenda.days[0].items.map((i) => i.id)).toEqual(['done-today']);
    expect(agenda.days[0].items[0].completed).toBe(true);
    expect(agenda.overdue).toHaveLength(0);
    expect(agenda.days[3].items).toHaveLength(0);
  });

  it('ordnet Erinnerungen mit Uhrzeit vor denen ohne ein', () => {
    const agenda = buildAgenda({
      now: NOW,
      reminders: [
        reminder({ id: 'ohne', title: 'Ohne Zeit', date: '2026-10-09' }),
        reminder({ id: 'mit', title: 'Mit Zeit', date: '2026-10-09', time: '16:30' }),
      ],
    });
    expect(agenda.days[0].items.map((i) => i.id)).toEqual(['mit', 'ohne']);
    expect(agenda.days[0].items[0].timeLabel).toBe('16:30');
  });

  it('übernimmt Projekt-Aufgaben, ignoriert pausierte und abgeschlossene Projekte', () => {
    const agenda = buildAgenda({
      now: NOW,
      projects: [
        project([
          { id: 't1', title: 'Kartons packen', date: '2026-10-09', completed: false },
          { id: 't2', title: 'Alt', date: '2026-10-05', completed: false },
          { id: 't3', title: 'Fertig', date: '2026-10-05', completed: true },
          { id: 't4', title: 'Ohne Datum', date: 'Demnächst', completed: false },
        ]),
        project([{ id: 'x', title: 'Pausiert', date: '2026-10-09' }], { id: 'p2', isPaused: true }),
        project([{ id: 'y', title: 'Abgeschlossen', date: '2026-10-09' }], { id: 'p3', status: 'ABGESCHLOSSEN' }),
      ],
    });
    expect(agenda.days[0].items.map((i) => i.title)).toEqual(['Kartons packen']);
    expect(agenda.days[0].items[0]).toMatchObject({ kind: 'task', projectId: 'p1', phaseId: 'ph1', subtitle: 'Umzug' });
    expect(agenda.overdue.map((i) => i.title)).toEqual(['Alt']);
  });

  it('ignoriert gelöschte Erinnerungen', () => {
    const agenda = buildAgenda({ now: NOW, reminders: [reminder({ deletedAt: '2026-10-08T10:00:00Z' })] });
    expect(agenda.days[0].items).toHaveLength(0);
  });
});

describe('buildAgenda – Kalendertermine', () => {
  it('ordnet Termine dem richtigen Tag zu und sortiert nach Uhrzeit', () => {
    const early = event({ id: 'e0', summary: 'Frühstück', start: { dateTime: new Date(2026, 9, 9, 8, 0).toISOString() } });
    const agenda = buildAgenda({
      now: NOW,
      eventsByMonth: { [monthKeyOf(NOW)]: [event(), early] },
    });
    expect(agenda.days[0].items.map((i) => i.id)).toEqual(['e0', 'e1']);
    expect(agenda.days[0].items[1].timeLabel).toBe('14:00');
  });

  it('stellt ganztägige Termine an den Anfang', () => {
    const allDay = { id: 'ad', summary: 'Urlaub', start: { date: '2026-10-09' }, end: { date: '2026-10-10' } };
    const agenda = buildAgenda({ now: NOW, eventsByMonth: { [monthKeyOf(NOW)]: [event(), allDay] } });
    expect(agenda.days[0].items.map((i) => i.id)).toEqual(['ad', 'e1']);
    expect(agenda.days[0].items[0].allDay).toBe(true);
  });

  it('blendet Termine aus, die schon als Erinnerung oder Aufgabe existieren', () => {
    const agenda = buildAgenda({
      now: NOW,
      reminders: [reminder({ id: 'r', googleEventId: 'e1', time: '14:00' })],
      eventsByMonth: { [monthKeyOf(NOW)]: [event({ id: 'e1' }), event({ id: 'e2', summary: 'Anderer' })] },
    });
    expect(agenda.days[0].items.map((i) => i.id).sort()).toEqual(['e2', 'r']);
  });

  it('findet Termine im Folgemonat, wenn die Woche den Monatswechsel überspannt', () => {
    const lateOct = new Date(2026, 9, 29, 9, 0);
    const nov = event({ id: 'n1', start: { dateTime: new Date(2026, 10, 2, 9, 0).toISOString() }, end: { dateTime: new Date(2026, 10, 2, 10, 0).toISOString() } });
    const agenda = buildAgenda({ now: lateOct, eventsByMonth: { '2026-9': [], '2026-10': [nov] } });
    const day = agenda.days.find((d) => d.key === '2026-11-02');
    expect(day.items.map((i) => i.id)).toEqual(['n1']);
  });

  it('läuft ohne Kalenderdaten und ohne Eingaben', () => {
    expect(buildAgenda().days).toHaveLength(7);
    expect(buildAgenda({ now: NOW, reminders: [], projects: [], eventsByMonth: {} }).overdue).toEqual([]);
  });
});

describe('getNextTimed / formatMinutes', () => {
  const items = (agenda) => agenda.days[0].items.filter((i) => i.startAt);

  it('findet den nächsten anstehenden Termin heute', () => {
    const agenda = buildAgenda({ now: NOW, eventsByMonth: { [monthKeyOf(NOW)]: [event()] } });
    const next = getNextTimed(items(agenda), NOW);
    expect(next).toMatchObject({ state: 'upcoming', minutes: 240 });
  });

  it('erkennt einen laufenden Termin', () => {
    const during = new Date(2026, 9, 9, 14, 30);
    const agenda = buildAgenda({ now: during, eventsByMonth: { [monthKeyOf(during)]: [event()] } });
    expect(getNextTimed(items(agenda), during)).toMatchObject({ state: 'running' });
  });

  it('liefert null, wenn nichts mehr ansteht', () => {
    const late = new Date(2026, 9, 9, 18, 0);
    const agenda = buildAgenda({ now: late, eventsByMonth: { [monthKeyOf(late)]: [event()] } });
    expect(getNextTimed(items(agenda), late)).toBeNull();
  });

  it('formatiert Minuten lesbar', () => {
    expect(formatMinutes(25)).toBe('in 25 Min');
    expect(formatMinutes(120)).toBe('in 2 Std.');
    expect(formatMinutes(90)).toBe('in 1 Std. 30 Min');
    expect(overdueLabel(-1)).toBe('gestern');
    expect(overdueLabel(-3)).toBe('vor 3 T.');
  });
});
