import { describe, it, expect } from 'vitest';
import {
  getLayoutedEvents,
  getCalendarDays,
  parseEventDate,
  isEventOnDate,
  sortEvents,
  isAllDayEvent,
  getEventColors,
  getEventStartDate,
} from '../src/lib/calendarUtils';

// Hilfsfunktionen: Termine immer aus LOKALEN Zeitangaben bauen, damit die Tests in jeder Zeitzone gelten
const timed = (id, y, m, d, sh, sm, eh, em) => ({
  id,
  summary: id,
  start: { dateTime: new Date(y, m, d, sh, sm).toISOString() },
  end: { dateTime: new Date(y, m, d, eh, em).toISOString() },
});
const day = (y, m, d) => new Date(y, m, d);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Gibt es in dieser Zeitzone 2026 Sommerzeit-Wechsel? (Frühjahr 2026-03-08 USA, 2026-03-29 EU)
const hasDst = new Date(2026, 0, 1).getTimezoneOffset() !== new Date(2026, 6, 1).getTimezoneOffset();

describe(`getLayoutedEvents (Zeitzone: ${zone})`, () => {
  const d = day(2026, 9, 8);

  it('liefert für leere Eingaben eine leere Liste', () => {
    expect(getLayoutedEvents([], d)).toEqual([]);
    expect(getLayoutedEvents(null, d)).toEqual([]);
  });

  it('platziert einen einzelnen Termin in Spalte 0 von 1 mit korrekten Minuten', () => {
    const [e] = getLayoutedEvents([timed('a', 2026, 9, 8, 9, 30, 10, 45)], d);
    expect(e).toMatchObject({ startMinutes: 570, endMinutes: 645, duration: 75, col: 0, totalCols: 1 });
    expect(e.startFormatted).toBe('09:30');
    expect(e.endFormatted).toBe('10:45');
  });

  it('legt überlappende Termine nebeneinander (zwei Spalten)', () => {
    const res = getLayoutedEvents([
      timed('a', 2026, 9, 8, 9, 0, 11, 0),
      timed('b', 2026, 9, 8, 10, 0, 12, 0),
    ], d);
    const a = res.find((e) => e.id === 'a');
    const b = res.find((e) => e.id === 'b');
    expect([a.col, b.col].sort()).toEqual([0, 1]);
    expect(a.totalCols).toBe(2);
    expect(b.totalCols).toBe(2);
  });

  it('behandelt direkt aufeinanderfolgende Termine (Ende = Start) nicht als Überlappung', () => {
    const res = getLayoutedEvents([
      timed('a', 2026, 9, 8, 9, 0, 10, 0),
      timed('b', 2026, 9, 8, 10, 0, 11, 0),
    ], d);
    expect(res.every((e) => e.col === 0 && e.totalCols === 1)).toBe(true);
  });

  it('verwendet Spalten wieder, wenn ein früherer Termin bereits endet (drei Termine, zwei Spalten)', () => {
    const res = getLayoutedEvents([
      timed('a', 2026, 9, 8, 9, 0, 10, 0),
      timed('b', 2026, 9, 8, 9, 30, 12, 0),
      timed('c', 2026, 9, 8, 10, 0, 11, 0),
    ], d);
    const byId = Object.fromEntries(res.map((e) => [e.id, e]));
    expect(byId.a.col).toBe(0);
    expect(byId.b.col).toBe(1);
    expect(byId.c.col).toBe(0); // Spalte 0 ist ab 10:00 wieder frei
    expect(res.every((e) => e.totalCols === 2)).toBe(true);
  });

  it('trennt Cluster: ein späterer Einzeltermin bleibt volle Breite', () => {
    const res = getLayoutedEvents([
      timed('a', 2026, 9, 8, 9, 0, 11, 0),
      timed('b', 2026, 9, 8, 10, 0, 11, 30),
      timed('c', 2026, 9, 8, 14, 0, 15, 0),
    ], d);
    expect(res.find((e) => e.id === 'c')).toMatchObject({ col: 0, totalCols: 1 });
    expect(res.find((e) => e.id === 'a').totalCols).toBe(2);
  });

  it('sortiert bei gleichem Start den längeren Termin zuerst', () => {
    const res = getLayoutedEvents([
      timed('kurz', 2026, 9, 8, 9, 0, 9, 30),
      timed('lang', 2026, 9, 8, 9, 0, 11, 0),
    ], d);
    expect(res[0].id).toBe('lang');
    expect(res[0].col).toBe(0);
    expect(res[1].col).toBe(1);
  });

  it('gibt Terminen ohne Dauer mindestens 30 Minuten', () => {
    const [e] = getLayoutedEvents([timed('a', 2026, 9, 8, 9, 0, 9, 0)], d);
    expect(e.duration).toBe(30);
    expect(e.endMinutes).toBe(570);
  });

  it('fehlendes Ende wird wie Start behandelt (30 Minuten)', () => {
    const evt = { id: 'a', start: { dateTime: new Date(2026, 9, 8, 9, 0).toISOString() } };
    const [e] = getLayoutedEvents([evt], d);
    expect(e.duration).toBe(30);
  });

  it('schneidet Termine über Mitternacht am Anzeigetag ab (Start gestern → 0 Uhr, Ende morgen → 24 Uhr)', () => {
    const overnight = {
      id: 'n',
      start: { dateTime: new Date(2026, 9, 7, 22, 0).toISOString() },
      end: { dateTime: new Date(2026, 9, 9, 2, 0).toISOString() },
    };
    const [e] = getLayoutedEvents([overnight], d);
    expect(e.startMinutes).toBe(0);
    expect(e.endMinutes).toBe(24 * 60);
  });

  it('Termin, der heute Abend beginnt und morgen früh endet, reicht bis 24 Uhr', () => {
    const evt = {
      id: 'n',
      start: { dateTime: new Date(2026, 9, 8, 22, 0).toISOString() },
      end: { dateTime: new Date(2026, 9, 9, 6, 0).toISOString() },
    };
    const [e] = getLayoutedEvents([evt], d);
    expect(e.startMinutes).toBe(22 * 60);
    expect(e.endMinutes).toBe(24 * 60);
  });

  it('Termin, der exakt um 24:00 endet, bleibt im Tag', () => {
    const evt = {
      id: 'e',
      start: { dateTime: new Date(2026, 9, 8, 23, 0).toISOString() },
      end: { dateTime: new Date(2026, 9, 9, 0, 0).toISOString() },
    };
    const [e] = getLayoutedEvents([evt], d);
    expect(e.endMinutes).toBe(24 * 60);
    expect(e.startMinutes).toBe(23 * 60);
  });

  it('verändert die übergebenen Termine nicht (Immutabilität)', () => {
    const input = timed('a', 2026, 9, 8, 9, 0, 10, 0);
    const copy = JSON.stringify(input);
    getLayoutedEvents([input], d);
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe('getLayoutedEvents an Sommerzeit-Tagen', () => {
  // EU: 29.03.2026 (02:00→03:00) und 25.10.2026 (03:00→02:00); USA: 08.03.2026 und 01.11.2026
  const cases = [
    ['EU Frühjahr', day(2026, 2, 29)],
    ['EU Herbst', day(2026, 9, 25)],
    ['USA Frühjahr', day(2026, 2, 8)],
    ['USA Herbst', day(2026, 10, 1)],
  ];

  it.each(cases)('rechnet Minuten nach lokaler Wanduhr (%s)', (_label, date) => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const dd = date.getDate();
    const [e] = getLayoutedEvents([timed('x', y, m, dd, 9, 0, 10, 0)], date);
    // 9:00–10:00 Wanduhrzeit bleibt 540–600, unabhängig vom Zeitumstellungs-Versatz davor
    expect(e.startMinutes).toBe(540);
    expect(e.endMinutes).toBe(600);
    expect(e.startFormatted).toBe('09:00');
  });

  it.runIf(hasDst)('ein Termin über die Zeitumstellung hinweg endet nach lokaler Uhrzeit, nicht nach Stunden', () => {
    const date = day(2026, 2, 29); // EU: 02:00 → 03:00
    const evt = timed('x', 2026, 2, 29, 1, 0, 4, 0);
    const [e] = getLayoutedEvents([evt], date);
    expect(e.startMinutes).toBe(60);
    expect(e.endMinutes).toBe(240); // 04:00 Wanduhr, obwohl nur 2 echte Stunden vergangen sind (nur EU/Berlin)
  });

  it('der Tag der Zeitumstellung hat im Raster genau einen Eintrag pro Kalendertag', () => {
    const cells = getCalendarDays(2026, 2); // März 2026
    const days = cells.filter((c) => c.isCurrentMonth).map((c) => c.day);
    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    // keine doppelten oder fehlenden Tage trotz Zeitumstellung
    expect(new Set(cells.map((c) => c.key)).size).toBe(cells.length);
  });
});

describe('getCalendarDays', () => {
  it('beginnt die Woche am Montag und füllt auf volle Wochen', () => {
    const cells = getCalendarDays(2026, 9); // Oktober 2026: 1. Okt. ist ein Donnerstag
    expect(cells.length % 7).toBe(0);
    expect(cells[0].dateObj.getDay()).toBe(1); // Montag
    expect(cells.find((c) => c.isCurrentMonth && c.day === 1).dateObj.getDay()).toBe(4); // Donnerstag
    expect(cells.filter((c) => c.isCurrentMonth).length).toBe(31);
  });

  it('kennzeichnet Vor- und Folgemonatstage', () => {
    const cells = getCalendarDays(2026, 9);
    expect(cells.filter((c) => c.isPrevMonth).every((c) => c.monthIndex === 8)).toBe(true);
    expect(cells.filter((c) => c.isNextMonth).every((c) => c.monthIndex === 10)).toBe(true);
  });

  it('kennt Schaltjahre (Februar 2028 hat 29 Tage, 2026 hat 28)', () => {
    expect(getCalendarDays(2028, 1).filter((c) => c.isCurrentMonth).length).toBe(29);
    expect(getCalendarDays(2026, 1).filter((c) => c.isCurrentMonth).length).toBe(28);
  });

  it('braucht bei Februar 2027 (beginnt Montag, 28 Tage) genau vier Wochen', () => {
    expect(getCalendarDays(2027, 1).length).toBe(28);
  });

  it('kann über den Jahreswechsel hinweg rechnen (Dezember → Januar)', () => {
    const cells = getCalendarDays(2026, 11);
    const next = cells.filter((c) => c.isNextMonth);
    expect(next.every((c) => c.year === 2027 && c.monthIndex === 0)).toBe(true);
    const jan = getCalendarDays(2026, 0).filter((c) => c.isPrevMonth);
    expect(jan.every((c) => c.year === 2025 && c.monthIndex === 11)).toBe(true);
  });

  it('vergibt eindeutige Schlüssel', () => {
    const cells = getCalendarDays(2026, 9);
    expect(new Set(cells.map((c) => c.key)).size).toBe(cells.length);
  });
});

describe('parseEventDate', () => {
  it('liest reine Datumsangaben als lokalen Tag (ohne UTC-Verschiebung)', () => {
    const d = parseEventDate('2026-10-08', false);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 8, 0]);
  });

  it('Ende eines ganztägigen Termins (exklusiv) liegt 1 ms vor Mitternacht des Folgetags', () => {
    const d = parseEventDate('2026-10-09', true);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 8, 23, 59]);
  });

  it('übernimmt dateTime-Angaben unverändert', () => {
    const iso = '2026-10-08T12:00:00Z';
    expect(parseEventDate(iso).getTime()).toBe(new Date(iso).getTime());
  });

  it('fällt bei leerem Wert auf "jetzt" zurück', () => {
    expect(Math.abs(parseEventDate('').getTime() - Date.now())).toBeLessThan(2000);
  });

  it('Datumsgrenzen am Zeitumstellungstag bleiben korrekte lokale Tage', () => {
    const d = parseEventDate('2026-03-29', false);
    expect([d.getMonth(), d.getDate()]).toEqual([2, 29]);
    const end = parseEventDate('2026-03-30', true);
    expect([end.getMonth(), end.getDate()]).toEqual([2, 29]);
  });
});

describe('isEventOnDate', () => {
  it('ganztägiger Termin mit exklusivem Ende liegt nur am Starttag (Google: end.date = Folgetag)', () => {
    const evt = { start: { date: '2026-10-08' }, end: { date: '2026-10-09' } };
    expect(isEventOnDate(evt, day(2026, 9, 8))).toBe(true);
    expect(isEventOnDate(evt, day(2026, 9, 9))).toBe(false);
    expect(isEventOnDate(evt, day(2026, 9, 7))).toBe(false);
  });

  it('mehrtägiger ganztägiger Termin deckt alle Tage ab, aber nicht den Endtag', () => {
    const evt = { start: { date: '2026-10-08' }, end: { date: '2026-10-11' } };
    [8, 9, 10].forEach((n) => expect(isEventOnDate(evt, day(2026, 9, n))).toBe(true));
    expect(isEventOnDate(evt, day(2026, 9, 11))).toBe(false);
  });

  it('Termin über Mitternacht erscheint an beiden Tagen', () => {
    const evt = {
      start: { dateTime: new Date(2026, 9, 8, 22, 0).toISOString() },
      end: { dateTime: new Date(2026, 9, 9, 2, 0).toISOString() },
    };
    expect(isEventOnDate(evt, day(2026, 9, 8))).toBe(true);
    expect(isEventOnDate(evt, day(2026, 9, 9))).toBe(true);
    expect(isEventOnDate(evt, day(2026, 9, 10))).toBe(false);
  });

  it('Termin über Monatsgrenze erscheint im Folgemonat', () => {
    const evt = {
      start: { dateTime: new Date(2026, 9, 31, 23, 0).toISOString() },
      end: { dateTime: new Date(2026, 10, 1, 1, 0).toISOString() },
    };
    expect(isEventOnDate(evt, day(2026, 9, 31))).toBe(true);
    expect(isEventOnDate(evt, day(2026, 10, 1))).toBe(true);
  });

  it('ignoriert Einträge ohne Startangabe', () => {
    expect(isEventOnDate({}, day(2026, 9, 8))).toBe(false);
    expect(isEventOnDate({ start: {} }, day(2026, 9, 8))).toBe(false);
  });

  it('ganztägiger Termin am Tag der Zeitumstellung liegt genau an diesem Tag', () => {
    const evt = { start: { date: '2026-03-29' }, end: { date: '2026-03-30' } };
    expect(isEventOnDate(evt, day(2026, 2, 29))).toBe(true);
    expect(isEventOnDate(evt, day(2026, 2, 30))).toBe(false);
    expect(isEventOnDate(evt, day(2026, 2, 28))).toBe(false);
  });
});

describe('sortEvents / Hilfsfunktionen', () => {
  it('stellt ganztägige Termine vor zeitgebundene und sortiert diese nach Startzeit', () => {
    const late = timed('spät', 2026, 9, 8, 15, 0, 16, 0);
    const early = timed('früh', 2026, 9, 8, 8, 0, 9, 0);
    const allDay = { id: 'tag', start: { date: '2026-10-08' }, end: { date: '2026-10-09' } };
    expect(sortEvents([late, allDay, early]).map((e) => e.id)).toEqual(['tag', 'früh', 'spät']);
  });

  it('verändert das Original-Array nicht', () => {
    const arr = [timed('b', 2026, 9, 8, 15, 0, 16, 0), timed('a', 2026, 9, 8, 8, 0, 9, 0)];
    sortEvents(arr);
    expect(arr.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('isAllDayEvent und getEventStartDate unterscheiden Datum und Zeitpunkt', () => {
    expect(isAllDayEvent({ start: { date: '2026-10-08' } })).toBe(true);
    expect(isAllDayEvent({ start: { dateTime: '2026-10-08T10:00:00Z' } })).toBe(false);
    const start = getEventStartDate({ start: { date: '2026-10-08' } });
    expect([start.getMonth(), start.getDate()]).toEqual([9, 8]); // lokaler Tag, in jeder Zeitzone
  });

  it('getEventColors liefert Standardfarbe bei unbekannter ID', () => {
    expect(getEventColors('999').border).toBe('#0284c7');
    expect(getEventColors('4').border).toBe('#f43f5e');
    expect(getEventColors(undefined).bg).toBe('#e0f2fe');
  });
});
