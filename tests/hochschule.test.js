import { describe, it, expect } from 'vitest';
import {
  MAX_HINTS, addHint, buildDeadlineList, getCaptureTarget, getExam, isFach, isOpenFach, nextFachDeadline, pickFachPhase, removeHint, toggleHintExam,
} from '../src/lib/hochschule';

// Montag, 19. Oktober 2026, 10:00 Uhr
const NOW = new Date(2026, 9, 19, 10, 0);

const fach = (over = {}) => ({
  id: 'f1', type: 'fach', title: 'Mathe 2', status: 'AKTIV', phases: [{ id: 'ph', title: 'Aufgaben', tasks: [] }], ...over,
});
const task = (over = {}) => ({ id: 't', title: 'Blatt', date: '2026-10-22', completed: false, ...over });
const reminder = (over = {}) => ({ id: 'r', title: 'Eintrag', status: 'AKTIV', date: '2026-10-25', kind: 'abgabe', createdAt: 1, ...over });

describe('Fach erkennen', () => {
  it('nur Projekte mit type fach sind Fächer', () => {
    expect(isFach(fach())).toBe(true);
    expect(isFach({ id: 'p', title: 'Umzug' })).toBe(false);
    expect(isFach(undefined)).toBe(false);
  });

  it('ein Fach läuft, solange es nicht gelöscht oder erledigt ist', () => {
    expect(isOpenFach(fach())).toBe(true);
    expect(isOpenFach(fach({ status: 'ABGESCHLOSSEN' }))).toBe(false);
    expect(isOpenFach(fach({ deletedAt: '2026-10-01' }))).toBe(false);
    expect(isOpenFach({ id: 'p', title: 'Umzug', status: 'AKTIV' })).toBe(false);
  });
});

describe('Prüfungstermin', () => {
  it('liefert Datum, Abstand, Countdown und Ton', () => {
    const exam = getExam(fach({ exam: { date: '2026-11-06' } }), NOW);
    expect(exam.dayDiff).toBe(18);
    expect(exam.countdown).toBe('in 18 Tagen');
    expect(exam.tone).toBe('neutral');
    expect(getExam(fach({ exam: { date: '2026-10-21' } }), NOW)).toMatchObject({ dayDiff: 2, tone: 'warning' });
    expect(getExam(fach({ exam: { date: '2026-10-19' } }), NOW)).toMatchObject({ dayDiff: 0, countdown: 'Heute' });
  });

  it('ohne oder mit ungültigem Termin gibt es keinen', () => {
    expect(getExam(fach(), NOW)).toBeNull();
    expect(getExam(fach({ exam: {} }), NOW)).toBeNull();
    expect(getExam(fach({ exam: { date: 'bald' } }), NOW)).toBeNull();
    expect(getExam(undefined, NOW)).toBeNull();
  });
});

describe('Nächste Frist eines Fachs', () => {
  it('nimmt die früheste offene Aufgabe mit Datum', () => {
    const f = fach({ phases: [{ id: 'ph', tasks: [task({ id: 'a', title: 'Später', date: '2026-10-30' }), task({ id: 'b', title: 'Blatt 5', date: '2026-10-22' })] }] });
    expect(nextFachDeadline(f, NOW)).toMatchObject({ kind: 'aufgabe', title: 'Blatt 5', dayDiff: 3, countdown: 'in 3 Tagen', tone: 'warning' });
  });

  it('überfällige offene Aufgaben zählen, erledigte nicht', () => {
    const f = fach({ phases: [{ id: 'ph', tasks: [task({ title: 'Alt', date: '2026-10-15' }), task({ id: 'c', title: 'Fertig', date: '2026-10-10', completed: true })] }] });
    expect(nextFachDeadline(f, NOW)).toMatchObject({ title: 'Alt', countdown: 'Überfällig', tone: 'danger' });
  });

  it('die Prüfung zählt, wenn sie vor den Aufgaben liegt; eine vergangene Prüfung zählt nicht', () => {
    const f = fach({ exam: { date: '2026-10-21' }, phases: [{ id: 'ph', tasks: [task({ date: '2026-10-30' })] }] });
    expect(nextFachDeadline(f, NOW)).toMatchObject({ kind: 'pruefung', dayDiff: 2 });
    const past = fach({ exam: { date: '2026-10-01' } });
    expect(nextFachDeadline(past, NOW)).toBeNull();
  });

  it('ohne Termine gibt es nichts; Aufgaben ohne gültiges Datum werden ignoriert', () => {
    expect(nextFachDeadline(fach(), NOW)).toBeNull();
    const f = fach({ phases: [{ id: 'ph', tasks: [task({ date: 'Demnächst' }), task({ date: '' })] }] });
    expect(nextFachDeadline(f, NOW)).toBeNull();
  });
});

describe('Abgaben und Prüfungen', () => {
  it('führt Prüfungstermine der Fächer und Einträge mit Art zusammen, früheste zuerst', () => {
    const list = buildDeadlineList({
      now: NOW,
      projects: [fach({ exam: { date: '2026-11-06' } }), fach({ id: 'f2', title: 'BWL', exam: { date: '2026-11-12' } })],
      reminders: [
        reminder({ id: 'r1', title: 'Blatt 4 abgeben', date: '2026-10-26' }),
        reminder({ id: 'r2', title: 'Laborbericht', date: '2026-10-20', kind: 'abgabe' }),
        reminder({ id: 'r3', title: 'Ohne Art', date: '2026-10-21', kind: undefined }),
      ],
    });
    expect(list.map((i) => i.title)).toEqual(['Laborbericht', 'Blatt 4 abgeben', 'Mathe 2', 'BWL']);
    expect(list[0]).toMatchObject({ source: 'reminder', subtitle: 'Abgabe', countdown: 'Morgen', tone: 'warning' });
    expect(list[2]).toMatchObject({ source: 'exam', subtitle: 'Prüfung', id: 'f1', dayDiff: 18 });
  });

  it('lässt Erledigtes, Geparktes, Gelöschtes, Undatiertes und vergangene Prüfungen weg', () => {
    const list = buildDeadlineList({
      now: NOW,
      projects: [
        fach({ exam: { date: '2026-10-01' } }), // vorbei
        fach({ id: 'f2', exam: { date: '2026-11-01' }, status: 'ABGESCHLOSSEN' }), // erledigt
        { id: 'p', title: 'Kein Fach', exam: { date: '2026-11-01' } },
      ],
      reminders: [
        reminder({ id: 'a', status: 'ABGESCHLOSSEN' }),
        reminder({ id: 'b', parked: true }),
        reminder({ id: 'c', deletedAt: '2026-10-01' }),
        reminder({ id: 'd', date: '' }),
      ],
    });
    expect(list).toEqual([]);
  });

  it('überfällige Abgaben bleiben sichtbar, das Limit schneidet ab', () => {
    const reminders = Array.from({ length: 8 }, (_, i) => reminder({ id: `r${i}`, title: `Abgabe ${i}`, date: `2026-10-${String(10 + i).padStart(2, '0')}` }));
    const list = buildDeadlineList({ now: NOW, reminders, limit: 3 });
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ countdown: 'Überfällig', tone: 'danger' });
  });
});

describe('Hinweise aus der Stunde', () => {
  it('fügt neue Hinweise vorne ein, mit Datum von heute und optional prüfungsrelevant', () => {
    let hints = addHint([], '  Kapitel 3 kommt sicher dran  ', { exam: true, now: NOW });
    hints = addHint(hints, 'Skript bis Freitag lesen', { now: NOW });
    expect(hints.map((h) => h.text)).toEqual(['Skript bis Freitag lesen', 'Kapitel 3 kommt sicher dran']);
    expect(hints[1]).toMatchObject({ exam: true, date: '2026-10-19' });
    expect('exam' in hints[0]).toBe(false);
    expect(new Set(hints.map((h) => h.id)).size).toBe(2);
  });

  it('ignoriert leere Texte und kürzt zu lange', () => {
    const base = [{ id: 'x', text: 'alt', date: '2026-10-01' }];
    expect(addHint(base, '   ', { now: NOW })).toBe(base);
    expect(addHint(base, '', { now: NOW })).toBe(base);
    expect(addHint([], 'a'.repeat(900), { now: NOW })[0].text).toHaveLength(500);
  });

  it('begrenzt die Anzahl', () => {
    const many = Array.from({ length: MAX_HINTS }, (_, i) => ({ id: `h${i}`, text: `t${i}`, date: '2026-10-01' }));
    const out = addHint(many, 'neu', { now: NOW });
    expect(out).toHaveLength(MAX_HINTS);
    expect(out[0].text).toBe('neu');
    expect(out.some((h) => h.id === `h${MAX_HINTS - 1}`)).toBe(false);
  });

  it('Prüfungsrelevant lässt sich umschalten, das Feld verschwindet beim Ausschalten', () => {
    const start = [{ id: 'a', text: 'x', date: '2026-10-01' }, { id: 'b', text: 'y', date: '2026-10-01' }];
    const on = toggleHintExam(start, 'a');
    expect(on[0].exam).toBe(true);
    expect(on[1]).toBe(start[1]);
    const off = toggleHintExam(on, 'a');
    expect('exam' in off[0]).toBe(false);
    expect(start[0]).toEqual({ id: 'a', text: 'x', date: '2026-10-01' }); // Original unverändert
  });

  it('entfernt einen Hinweis', () => {
    expect(removeHint([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }]);
    expect(removeHint([{ id: 'a' }], 'z')).toEqual([{ id: 'a' }]);
  });
});

describe('Schnelleingabe in Hochschule', () => {
  const entry = (over = {}) => ({ title: 'Blatt 5', date: '2026-10-23', time: '', quick: false, kind: null, ...over });

  it('ohne genanntes Fach landet alles in der Merkliste', () => {
    expect(getCaptureTarget(entry(), null)).toBe('reminder');
  });

  it('mit Fach wird es eine Aufgabe im Fach, auch ohne Datum', () => {
    expect(getCaptureTarget(entry(), fach())).toBe('fachTask');
    expect(getCaptureTarget(entry({ date: '' }), fach())).toBe('fachTask');
    expect(getCaptureTarget(entry({ kind: 'abgabe' }), fach())).toBe('fachTask');
  });

  it('eine Prüfung mit Datum setzt den Prüfungstermin des Fachs', () => {
    expect(getCaptureTarget(entry({ kind: 'pruefung', date: '2026-11-02' }), fach())).toBe('exam');
    // ohne Datum gibt es keinen Termin: dann eine normale Aufgabe
    expect(getCaptureTarget(entry({ kind: 'pruefung', date: '' }), fach())).toBe('fachTask');
  });

  it('mit Uhrzeit bleibt es in der Merkliste, ebenso wenn das Fach keinen Abschnitt hat', () => {
    expect(getCaptureTarget(entry({ time: '14:00' }), fach())).toBe('reminder');
    expect(getCaptureTarget(entry(), fach({ phases: [] }))).toBe('reminder');
  });

  it('der Abschnitt für neue Aufgaben ist der erste offene, sonst der erste', () => {
    const f = fach({ phases: [{ id: 'a', completed: true }, { id: 'b', completed: false }, { id: 'c', completed: false }] });
    expect(pickFachPhase(f).id).toBe('b');
    expect(pickFachPhase(fach({ phases: [{ id: 'a', completed: true }] })).id).toBe('a');
    expect(pickFachPhase(fach({ phases: [] }))).toBeNull();
    expect(pickFachPhase(undefined)).toBeNull();
  });
});
