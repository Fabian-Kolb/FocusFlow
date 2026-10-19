import {
  ageInDays, ageLabel, countdownLabel, countdownTone, describeDay, describeTask, entryToReminder,
  getQuickTasks, getStaleTasks, getUndatedTasks, isActiveTask, isStale, matchByName, matchCategory, parseQuickEntry, STALE_AFTER_DAYS,
} from '../src/lib/taskOverview';

// Donnerstag, 15. Oktober 2026, 10:00 Uhr
const NOW = new Date(2026, 9, 15, 10, 0);
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => NOW.getTime() - n * DAY;

const CATS = [
  { id: 'allgemein', name: 'Allgemein' },
  { id: 'mathe', name: 'Mathe 2' },
  { id: 'prog', name: 'Programmieren' },
  { id: 'bwl', name: 'BWL' },
];

const rem = (over = {}) => ({
  id: 'r1', title: 'Aufgabe', status: 'AKTIV', date: '', time: '', categoryId: 'allgemein', createdAt: daysAgo(1), ...over,
});

const parse = (text, opts = {}) => parseQuickEntry(text, { categories: CATS, now: NOW, ...opts });

describe('parseQuickEntry – Fristen', () => {
  it('erkennt „bis Freitag“, Bereich und kürzt den Titel', () => {
    const e = parse('Mathe Blatt 5 bis Freitag');
    expect(e.date).toBe('2026-10-16');
    expect(e.title).toBe('Mathe Blatt 5');
    expect(e.categoryId).toBe('mathe');
    expect(e.categoryDetected).toBe(true);
  });

  it('erkennt heute, morgen und übermorgen (auch mit „ü“ am Wortanfang)', () => {
    expect(parse('Müll rausbringen heute').date).toBe('2026-10-15');
    expect(parse('Bücher zurückgeben morgen').date).toBe('2026-10-16');
    const e = parse('übermorgen Arzt anrufen');
    expect(e.date).toBe('2026-10-17');
    expect(e.title).toBe('Arzt anrufen');
  });

  it('lässt „morgens“ und „Morgenroutine“ in Ruhe', () => {
    expect(parse('Morgenroutine aufschreiben').date).toBe('');
    expect(parse('morgens Vitamine nehmen').date).toBe('');
  });

  it('entfernt Tageszeiten hinter dem Tag', () => {
    const e = parse('Einkaufen heute Abend');
    expect(e.date).toBe('2026-10-15');
    expect(e.title).toBe('Einkaufen');
  });

  it('rechnet „in N Tagen/Wochen“', () => {
    expect(parse('Wäsche in 3 Tagen').date).toBe('2026-10-18');
    expect(parse('Review in 2 Wochen').date).toBe('2026-10-29');
    expect(parse('Anruf in einer Woche').date).toBe('2026-10-22');
  });

  it('nächste Woche meint den kommenden Montag', () => {
    expect(parse('Treffen nächste Woche').date).toBe('2026-10-19');
  });

  it('liest Datumsangaben mit und ohne Jahr, ohne Jahr das nächste Vorkommen', () => {
    expect(parse('20.10. Laborbericht').date).toBe('2026-10-20');
    expect(parse('Klausur am 3.11.2026').date).toBe('2026-11-03');
    expect(parse('Formular 1.10.').date).toBe('2027-10-01');
    expect(parse('Abgabe bis 20.10').date).toBe('2026-10-20');
  });

  it('ignoriert ungültige Daten und Versionsnummern', () => {
    expect(parse('Rechnung 31.02.').date).toBe('');
    expect(parse('Version 3.5 testen').date).toBe('');
  });

  it('derselbe Wochentag wie heute meint nächste Woche', () => {
    expect(parse('Mathe Donnerstag').date).toBe('2026-10-22');
    expect(parse('Sport am Samstag').date).toBe('2026-10-17');
  });

  it('erkennt Uhrzeiten und setzt dann heute, wenn kein Tag genannt ist', () => {
    const a = parse('Sport um 18:30');
    expect(a.time).toBe('18:30');
    expect(a.date).toBe('2026-10-15');
    expect(a.title).toBe('Sport');
    const b = parse('Gym morgen um 18 Uhr');
    expect(b.time).toBe('18:00');
    expect(b.date).toBe('2026-10-16');
    expect(b.title).toBe('Gym');
    expect(parse('Treffen 14.30 Uhr').time).toBe('14:30');
    expect(parse('Termin um 25 Uhr').time).toBe('');
  });

  it('ohne Angaben bleibt der Text als Titel und die Frist leer', () => {
    const e = parse('zahnarzt anrufen');
    expect(e.title).toBe('Zahnarzt anrufen');
    expect(e.date).toBe('');
    expect(e.time).toBe('');
    expect(e.quick).toBe(false);
    expect(e.kind).toBeNull();
  });

  it('behält den Originaltext, wenn nur ein Datum eingegeben wurde', () => {
    expect(parse('morgen').title).toBe('Morgen');
  });
});

describe('parseQuickEntry – schnell und Art', () => {
  it('erkennt „schnell“ und „5 Minuten“ und entfernt sie aus dem Titel', () => {
    const a = parse('schnell Pfand wegbringen');
    expect(a.quick).toBe(true);
    expect(a.title).toBe('Pfand wegbringen');
    const b = parse('5 Minuten Mensakarte aufladen');
    expect(b.quick).toBe(true);
    expect(b.title).toBe('Mensakarte aufladen');
    expect(parse('kurzfristig planen').quick).toBe(false);
  });

  it('erkennt Prüfung immer, Abgabe nur mit Frist', () => {
    expect(parse('Klausur Mathe 2 am 2.11.').kind).toBe('pruefung');
    expect(parse('Klausur lernen').kind).toBe('pruefung');
    expect(parse('Übungsblatt 3 abgeben bis Freitag').kind).toBe('abgabe');
    expect(parse('Bücher abgeben').kind).toBeNull();
  });
});

describe('parseQuickEntry – Kategorie', () => {
  it('voller Name schlägt einzelnes Wort, Gleichstand zählt als nicht erkannt', () => {
    const twin = [{ id: 'allgemein', name: 'Allgemein' }, { id: 'm1', name: 'Mathe 1' }, { id: 'm2', name: 'Mathe 2' }];
    expect(matchCategory('Mathe Blatt', twin)).toBeNull();
    expect(matchCategory('Mathe 2 Blatt', twin).id).toBe('m2');
  });

  it('matchByName arbeitet mit beliebigen Dingen und Namen, zum Beispiel Fächern', () => {
    const faecher = [{ id: 'f1', title: 'Mathe 2' }, { id: 'f2', title: 'Programmieren' }, { id: 'f3', title: 'Mathe 1' }];
    expect(matchByName('Programmieren Labor bis Freitag', faecher, (f) => f.title).id).toBe('f2');
    expect(matchByName('Mathe 2 Blatt 5', faecher, (f) => f.title).id).toBe('f1');
    expect(matchByName('Mathe Blatt 5', faecher, (f) => f.title)).toBeNull(); // Gleichstand
    expect(matchByName('Einkaufen', faecher, (f) => f.title)).toBeNull();
    expect(matchByName('Programmieren', faecher, (f) => f.title, (f) => f.id === 'f2')).toBeNull(); // übersprungen
  });

  it('erkennt Wörter ganz, nicht als Teilstück', () => {
    expect(matchCategory('Mathematik wiederholen', CATS)).toBeNull();
    expect(matchCategory('BWL Skript', CATS).id).toBe('bwl');
  });

  it('nennt der Text eine Kategorie, gilt sie; sonst Allgemein', () => {
    const named = parse('BWL lernen');
    expect(named.categoryId).toBe('bwl');
    expect(named.categoryName).toBe('BWL');
    expect(named.categoryDetected).toBe(true);
    const none = parse('Bücher zurückgeben');
    expect(none.categoryId).toBe('allgemein');
    expect(none.categoryName).toBe('Allgemein');
    expect(none.categoryDetected).toBe(false);
  });

  it('entryToReminder setzt optionale Felder nur, wenn sie gesetzt sind', () => {
    const plain = entryToReminder(parse('Bücher zurückgeben morgen'));
    expect(plain).toEqual({ title: 'Bücher zurückgeben', date: '2026-10-16', time: '', categoryId: 'allgemein', status: 'AKTIV' });
    expect(Object.keys(plain)).not.toContain('quick');
    expect(Object.keys(plain)).not.toContain('kind');
    const full = entryToReminder(parse('schnell Klausur Mathe 2 am 2.11.'));
    expect(full).toMatchObject({ quick: true, kind: 'pruefung', categoryId: 'mathe', date: '2026-11-02' });
  });
});

describe('Zustand einer Aufgabe', () => {
  it('liegt zu lange: offen, ohne Datum, nicht schnell, nach 7 Tagen', () => {
    expect(isStale(rem({ createdAt: daysAgo(STALE_AFTER_DAYS) }), NOW)).toBe(true);
    expect(isStale(rem({ createdAt: daysAgo(STALE_AFTER_DAYS - 1) }), NOW)).toBe(false);
  });

  it('liegt nicht zu lange: mit Frist, schnell, geparkt, erledigt, pausiert, gelöscht, wiederkehrend, ohne Zeitstempel', () => {
    const old = { createdAt: daysAgo(30) };
    expect(isStale(rem({ ...old, date: '2026-10-20' }), NOW)).toBe(false);
    expect(isStale(rem({ ...old, quick: true }), NOW)).toBe(false);
    expect(isStale(rem({ ...old, parked: true }), NOW)).toBe(false);
    expect(isStale(rem({ ...old, status: 'ABGESCHLOSSEN' }), NOW)).toBe(false);
    expect(isStale(rem({ ...old, isPaused: true }), NOW)).toBe(false);
    expect(isStale(rem({ ...old, deletedAt: '2026-10-01' }), NOW)).toBe(false);
    expect(isStale(rem({ ...old, recurrence: { freq: 'weekly', interval: 1 } }), NOW)).toBe(false);
    expect(isStale(rem({ createdAt: undefined }), NOW)).toBe(false);
  });

  it('geparkt ist nicht aktiv, aber offen', () => {
    expect(isActiveTask(rem({ parked: true }))).toBe(false);
    expect(isActiveTask(rem())).toBe(true);
  });

  it('Alter in Tagen und Text', () => {
    expect(ageInDays(rem({ createdAt: daysAgo(9) }), NOW)).toBe(9);
    expect(ageLabel(rem({ createdAt: daysAgo(9) }), NOW)).toBe('Seit 9 Tagen offen');
    expect(ageLabel(rem({ createdAt: daysAgo(1) }), NOW)).toBe('Seit einem Tag offen');
    expect(ageLabel(rem({ createdAt: NOW.getTime() }), NOW)).toBe('Seit heute offen');
  });

  it('Frist-Texte und Töne', () => {
    expect(countdownLabel(-2)).toBe('Überfällig');
    expect(countdownLabel(0)).toBe('Heute');
    expect(countdownLabel(1)).toBe('Morgen');
    expect(countdownLabel(18)).toBe('in 18 Tagen');
    expect(countdownTone(-1)).toBe('danger');
    expect(countdownTone(3)).toBe('warning');
    expect(countdownTone(4)).toBe('neutral');
    expect(countdownTone(null)).toBe('neutral');
  });

  it('describeTask liefert Countdown und Datum', () => {
    const info = describeTask(rem({ date: '2026-11-02', time: '09:00' }), NOW);
    expect(info.countdown).toBe('in 18 Tagen');
    expect(info.dateText).toContain('2. Nov');
    expect(info.dateText).toContain('09:00');
    expect(describeTask(rem(), NOW).hasDate).toBe(false);
  });

  it('describeDay nennt Heute, Morgen, Wochentag und Datum', () => {
    expect(describeDay(new Date(2026, 9, 15), NOW)).toBe('Heute');
    expect(describeDay(new Date(2026, 9, 16), NOW)).toBe('Morgen');
    expect(describeDay(new Date(2026, 9, 19), NOW)).toBe('Montag');
    expect(describeDay(new Date(2026, 10, 3), NOW)).toContain('3.');
  });
});

describe('Auswahl für Heute', () => {
  const list = [
    rem({ id: 'q1', quick: true, createdAt: daysAgo(3) }),
    rem({ id: 'q2', quick: true, createdAt: daysAgo(5) }),
    rem({ id: 'q-dated', quick: true, date: '2026-10-15' }),
    rem({ id: 'fresh', createdAt: daysAgo(2) }),
    rem({ id: 'fresher', createdAt: daysAgo(1) }),
    rem({ id: 'old', createdAt: daysAgo(9) }),
    rem({ id: 'older', createdAt: daysAgo(14), categoryId: 'mathe' }),
    rem({ id: 'parked', parked: true, createdAt: daysAgo(20) }),
    rem({ id: 'done', status: 'ABGESCHLOSSEN', createdAt: daysAgo(20) }),
    rem({ id: 'dated', date: '2026-10-20', createdAt: daysAgo(20) }),
  ];

  it('Schnell erledigt: nur schnelle ohne Frist, älteste zuerst', () => {
    expect(getQuickTasks(list, NOW).map((r) => r.id)).toEqual(['q2', 'q1']);
  });

  it('Ohne Frist: frische ohne Frist, neueste zuerst, ohne die zu langen', () => {
    expect(getUndatedTasks(list, NOW).map((r) => r.id)).toEqual(['fresher', 'fresh']);
  });

  it('Liegt zu lange: älteste zuerst', () => {
    expect(getStaleTasks(list, NOW).map((r) => r.id)).toEqual(['older', 'old']);
    expect(getStaleTasks([], NOW)).toEqual([]);
  });
});

describe('getWaitingTasks', () => {
  it('nimmt nur offene Einträge mit Wartet-auf, am längsten wartend zuerst', async () => {
    const { getWaitingTasks } = await import('../src/lib/taskOverview');
    const list = [
      { id: 'a', title: 'A', waitingFor: 'Herr Meier', createdAt: 2000, status: 'GEPLANT' },
      { id: 'b', title: 'B', waitingFor: 'Frau Berger', createdAt: 1000, status: 'GEPLANT' },
      { id: 'c', title: 'C', waitingFor: 'x', createdAt: 1, status: 'ABGESCHLOSSEN' },
      { id: 'd', title: 'D', waitingFor: '   ', createdAt: 1, status: 'GEPLANT' },
      { id: 'e', title: 'E', createdAt: 1, status: 'GEPLANT' },
    ];
    expect(getWaitingTasks(list).map((r) => r.id)).toEqual(['b', 'a']);
  });
});
