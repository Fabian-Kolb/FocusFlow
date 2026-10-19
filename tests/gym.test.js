import { describe, it, expect } from 'vitest';
import {
  MAX_SETS_PER_WORKOUT, activeWorkout, bestWeight, bodyChange, bodySeries, clampGoal, describeSets, exerciseSeries, exercisesWithData,
  formatWeight, isRecord, lastDoneDate, lastSession, makeBodyEntry, makeSet, newWorkout, nextPlan, parseNumber, recordSetIds, relativeDay,
  sortBody, sortPlans, sortWorkouts, stepWeight, thisWeekCount, topWeight, volumeOf, weekDays, weekStart, withExercise, withSet, withoutSet,
  workoutExerciseIds, workoutMinutes, workoutSummary, workoutsPerWeek,
} from '../src/lib/gym';

// Montag, 19. Oktober 2026, 10:00 Uhr
const NOW = new Date(2026, 9, 19, 10, 0);
const at = (y, m, d, h = 18) => new Date(y, m, d, h, 0).getTime();
const set = (exerciseId, weight, reps, id) => ({ id: id || `s${exerciseId}${weight}${reps}${Math.random()}`, exerciseId, weight, ...(reps ? { reps } : {}), at: 1 });
const workout = (id, startedAt, sets, over = {}) => ({
  id, date: new Date(startedAt).toISOString().slice(0, 10), startedAt, endedAt: startedAt + 3600000, exerciseIds: [], sets, ...over,
});

describe('Gewicht und Sätze', () => {
  it('formatiert Gewichte deutsch', () => {
    expect(formatWeight(62.5)).toBe('62,5 kg');
    expect(formatWeight(60)).toBe('60 kg');
    expect(formatWeight(0)).toBe('0 kg');
  });

  it('liest Zahlen mit Komma oder Punkt und lehnt Ungültiges ab', () => {
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber(' 60 ')).toBe(60);
    expect(parseNumber('62.5')).toBe(62.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('-5')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(0)).toBe(0);
  });

  it('verändert das Gewicht in Schritten, gerundet und begrenzt', () => {
    expect(stepWeight('60', 2.5)).toBe(62.5);
    expect(stepWeight('60', -2.5)).toBe(57.5);
    expect(stepWeight('', 2.5)).toBe(2.5);
    expect(stepWeight('1', -2.5)).toBe(0);
    expect(stepWeight('998', 2.5)).toBe(999);
    expect(stepWeight('60,1', 2.5)).toBe(62.5); // auf 0,25 gerundet
    expect(stepWeight('abc', 2.5)).toBe(2.5);
  });

  it('baut einen Satz; Wiederholungen sind optional und nur als positive ganze Zahl gültig', () => {
    expect(makeSet({ exerciseId: 'e1', weight: '60', reps: '8' })).toMatchObject({ exerciseId: 'e1', weight: 60, reps: 8 });
    const noReps = makeSet({ exerciseId: 'e1', weight: '60', reps: '' });
    expect(noReps.weight).toBe(60);
    expect('reps' in noReps).toBe(false);
    expect('reps' in makeSet({ exerciseId: 'e1', weight: 60, reps: '0' })).toBe(false);
    expect('reps' in makeSet({ exerciseId: 'e1', weight: 60, reps: '8,5' })).toBe(false);
    expect('reps' in makeSet({ exerciseId: 'e1', weight: 60, reps: '1000' })).toBe(false);
    expect(makeSet({ exerciseId: 'e1', weight: 'x' })).toBeNull();
    expect(makeSet({ exerciseId: 'e1', weight: '' })).toBeNull();
    expect(makeSet({ exerciseId: 'e1', weight: '1000' })).toBeNull();
    expect(makeSet({ exerciseId: '', weight: '60' })).toBeNull();
    expect(makeSet({ exerciseId: 'e1', weight: '0' }).weight).toBe(0); // Eigengewicht
  });

  it('beschreibt Sätze zusammengefasst', () => {
    expect(describeSets([set('e', 60, 8), set('e', 60, 8), set('e', 60, 7)])).toBe('60 kg × 8, 8, 7');
    expect(describeSets([set('e', 60, 8), set('e', 62.5, 5)])).toBe('60 kg × 8 · 62,5 kg × 5');
    expect(describeSets([set('e', 60), set('e', 60), set('e', 60)])).toBe('60 kg (3 Sätze)');
    expect(describeSets([set('e', 60)])).toBe('60 kg');
    expect(describeSets([set('e', 60, 8), set('e', 60)])).toBe('60 kg × 8, –');
    expect(describeSets([])).toBe('');
  });

  it('höchstes Gewicht und Volumen', () => {
    expect(topWeight([set('e', 60, 8), set('e', 62.5, 5), set('e', 57.5, 10)])).toBe(62.5);
    expect(topWeight([])).toBe(0);
    expect(volumeOf([set('e', 60, 8), set('e', 62.5, 5)])).toBe(60 * 8 + 62.5 * 5);
    expect(volumeOf([set('e', 60), set('e', 62.5)])).toBeNull();
    expect(volumeOf([set('e', 60, 8), set('e', 70)])).toBe(480); // Sätze ohne Wiederholungen zählen nicht
  });
});

describe('Training anlegen und füllen', () => {
  it('ein neues Training übernimmt die Übungen des Trainingstags', () => {
    const plan = { id: 'p1', name: 'Push', exerciseIds: ['a', 'b'] };
    const w = newWorkout({ plan, now: NOW });
    expect(w).toMatchObject({ date: '2026-10-19', planId: 'p1', exerciseIds: ['a', 'b'], sets: [] });
    expect(w.startedAt).toBe(NOW.getTime());
    expect('endedAt' in w).toBe(false);
    plan.exerciseIds.push('c');
    expect(w.exerciseIds).toEqual(['a', 'b']); // Kopie, nicht dieselbe Liste
  });

  it('ein freies Training hat keinen Plan und keine Übungen', () => {
    const w = newWorkout({ now: NOW });
    expect('planId' in w).toBe(false);
    expect(w.exerciseIds).toEqual([]);
  });

  it('Sätze anhängen nimmt die Übung in die Liste auf und entfernen löscht den Satz', () => {
    let w = newWorkout({ now: NOW });
    const s1 = set('a', 60, 8, 's1');
    w = withSet(w, s1);
    expect(w.sets).toHaveLength(1);
    expect(w.exerciseIds).toEqual(['a']);
    w = withSet(w, set('a', 60, 8, 's2'));
    expect(w.exerciseIds).toEqual(['a']);
    w = withoutSet(w, 's1');
    expect(w.sets.map((s) => s.id)).toEqual(['s2']);
    expect(withSet(w, null)).toBe(w);
  });

  it('eine Übung wird nur einmal hinzugefügt', () => {
    const w = withExercise(withExercise(newWorkout({ now: NOW }), 'a'), 'a');
    expect(w.exerciseIds).toEqual(['a']);
  });

  it('begrenzt die Zahl der Sätze', () => {
    let w = newWorkout({ now: NOW });
    w = { ...w, sets: Array.from({ length: MAX_SETS_PER_WORKOUT }, (_, i) => set('a', 60, 8, `s${i}`)) };
    expect(withSet(w, set('a', 60, 8, 'extra'))).toBe(w);
  });

  it('die Übungsliste enthält auch Übungen, die nur über Sätze im Training stehen', () => {
    expect(workoutExerciseIds({ exerciseIds: ['a'], sets: [set('b', 10), set('a', 10)] })).toEqual(['a', 'b']);
    expect(workoutExerciseIds({ sets: [] })).toEqual([]);
  });

  it('erkennt das laufende Training und misst die Dauer erst nach dem Ende', () => {
    const running = { id: 'r', startedAt: 5, sets: [] };
    const done = workout('d', 1000, []);
    expect(activeWorkout([done, running]).id).toBe('r');
    expect(activeWorkout([done])).toBeNull();
    expect(workoutMinutes(done)).toBe(60);
    expect(workoutMinutes(running)).toBeNull();
    expect(workoutMinutes({ startedAt: 1000, endedAt: 1500 })).toBe(1);
  });
});

describe('Letztes Mal und Bestwerte', () => {
  const w1 = workout('w1', at(2026, 9, 5), [set('bank', 60, 8), set('bank', 60, 8), set('rudern', 50, 10)]);
  const w2 = workout('w2', at(2026, 9, 12), [set('bank', 62.5, 6), set('bank', 60, 8)]);
  const w3 = workout('w3', at(2026, 9, 19), [set('bank', 65, 5, 'sNew')]);
  const all = [w1, w2, w3];

  it('sortiert Trainings neueste zuerst', () => {
    expect(sortWorkouts(all).map((w) => w.id)).toEqual(['w3', 'w2', 'w1']);
  });

  it('Letztes Mal ist das jüngste andere Training mit der Übung', () => {
    expect(lastSession(all, 'bank', { excludeId: 'w3' }).workout.id).toBe('w2');
    expect(lastSession(all, 'bank').workout.id).toBe('w3');
    expect(lastSession(all, 'rudern', { excludeId: 'w3' }).workout.id).toBe('w1');
    expect(lastSession(all, 'rudern', { excludeId: 'w3' }).sets).toHaveLength(1);
    expect(lastSession(all, 'gibtsnicht')).toBeNull();
    expect(lastSession([], 'bank')).toBeNull();
  });

  it('Bestwert ist das höchste Gewicht, ohne das ausgeschlossene Training', () => {
    expect(bestWeight(all, 'bank')).toBe(65);
    expect(bestWeight(all, 'bank', { excludeId: 'w3' })).toBe(62.5);
    expect(bestWeight(all, 'rudern')).toBe(50);
    expect(bestWeight(all, 'x')).toBe(0);
  });

  it('ein Satz ist ein Rekord, wenn er schwerer ist als alles davor', () => {
    expect(isRecord(all, w3, w3.sets[0])).toBe(true); // 65 > 62,5
    expect(isRecord(all, w2, w2.sets[0])).toBe(true); // 62,5 > 60
    expect(isRecord(all, w2, w2.sets[1])).toBe(false); // 60 nicht schwerer
    expect(isRecord(all, w1, w1.sets[0])).toBe(false); // erster Satz überhaupt: kein Vergleich
    expect(isRecord(all, w1, w1.sets[1])).toBe(false); // gleiches Gewicht
  });

  it('Rekorde zählen auch innerhalb eines Trainings, aber nicht für spätere Trainings', () => {
    const today = workout('t', at(2026, 9, 19), [set('bank', 60, 8, 'a'), set('bank', 62.5, 6, 'b'), set('bank', 62.5, 5, 'c')]);
    const history = [w1, today];
    expect(isRecord(history, today, today.sets[1])).toBe(true); // 62,5 > 60 aus w1 und Satz a
    expect(isRecord(history, today, today.sets[2])).toBe(false); // gleich wie Satz b
    // ein Training, das später stattfand, beeinflusst ältere nicht
    const future = workout('f', at(2026, 10, 2), [set('bank', 100, 1)]);
    expect(isRecord([w1, w2, future], w2, w2.sets[0])).toBe(true);
  });

  it('recordSetIds sammelt alle Rekord-Sätze eines Trainings', () => {
    expect([...recordSetIds(all, w3)]).toEqual(['sNew']);
    expect(recordSetIds(all, w1).size).toBe(0);
  });

  it('ein neues Gewicht für eine neue Übung ist kein Rekord', () => {
    const neu = workout('n', at(2026, 9, 20), [set('kreuzheben', 100, 5, 'k')]);
    expect(isRecord([...all, neu], neu, neu.sets[0])).toBe(false);
  });
});

describe('Fortschritt', () => {
  const exercises = [{ id: 'bank', name: 'Bankdrücken' }, { id: 'rudern', name: 'Rudern' }, { id: 'leer', name: 'Leer' }];
  const w1 = workout('w1', at(2026, 9, 5), [set('bank', 60, 8), set('bank', 60, 8), set('rudern', 50)]);
  const w2 = workout('w2', at(2026, 9, 12), [set('bank', 62.5, 6)]);

  it('der Verlauf einer Übung hat pro Training Höchstgewicht und Volumen, ältestes zuerst', () => {
    expect(exerciseSeries([w2, w1], 'bank')).toEqual([
      { date: w1.date, workoutId: 'w1', top: 60, volume: 960 },
      { date: w2.date, workoutId: 'w2', top: 62.5, volume: 375 },
    ]);
    expect(exerciseSeries([w1], 'rudern')).toEqual([{ date: w1.date, workoutId: 'w1', top: 50, volume: null }]);
    expect(exerciseSeries([w1], 'nix')).toEqual([]);
  });

  it('Übungen mit Daten, häufigste zuerst, ohne leere', () => {
    expect(exercisesWithData([w1, w2], exercises).map((e) => e.id)).toEqual(['bank', 'rudern']);
    expect(exercisesWithData([], exercises)).toEqual([]);
  });

  it('fasst ein Training für Listen zusammen', () => {
    const names = { bank: 'Bankdrücken', rudern: 'Rudern' };
    const summary = workoutSummary(w1, (id) => names[id]);
    expect(summary).toMatchObject({ exerciseCount: 2, setCount: 3, names: ['Bankdrücken', 'Rudern'], volume: 960 });
    expect(workoutSummary({ sets: [] }, () => 'x')).toMatchObject({ exerciseCount: 0, setCount: 0, volume: null });
  });
});

describe('Trainingstage', () => {
  const plans = [
    { id: 'beine', name: 'Beine', order: 2 },
    { id: 'push', name: 'Push', order: 0 },
    { id: 'pull', name: 'Pull', order: 1 },
  ];

  it('sortiert nach Reihenfolge', () => {
    expect(sortPlans(plans).map((p) => p.id)).toEqual(['push', 'pull', 'beine']);
  });

  it('der nächste Tag kommt nach dem zuletzt trainierten, reihum', () => {
    expect(nextPlan(plans, []).id).toBe('push');
    expect(nextPlan(plans, [workout('a', 100, [set('x', 1)], { planId: 'push' })]).id).toBe('pull');
    expect(nextPlan(plans, [workout('a', 100, [], { planId: 'push' }), workout('b', 200, [], { planId: 'beine' })]).id).toBe('push');
    expect(nextPlan([], [])).toBeNull();
    // Training ohne Plan oder mit gelöschtem Plan wird ignoriert
    expect(nextPlan(plans, [workout('a', 300, [], { planId: 'weg' }), workout('b', 100, [], { planId: 'pull' })]).id).toBe('beine');
  });

  it('wann war ein Trainingstag zuletzt dran', () => {
    const ws = [workout('a', at(2026, 9, 5), [], { planId: 'push' }), workout('b', at(2026, 9, 12), [], { planId: 'push' })];
    expect(lastDoneDate(ws, 'push')).toBe(ws[1].date);
    expect(lastDoneDate(ws, 'pull')).toBeNull();
  });
});

describe('Häufigkeit', () => {
  const day = (d, h = 18, sets = [set('a', 1)]) => workout(`w${d}${h}`, at(2026, 9, d, h), sets);

  it('die Woche beginnt am Montag', () => {
    expect(weekStart(new Date(2026, 9, 19, 10)).getDate()).toBe(19); // Montag
    expect(weekStart(new Date(2026, 9, 25, 23)).getDate()).toBe(19); // Sonntag
    expect(weekStart(new Date(2026, 9, 18, 10)).getDate()).toBe(12); // Sonntag davor
  });

  it('zählt die Trainings dieser Woche; ein Training braucht mindestens einen Satz', () => {
    const ws = [day(19), day(21), day(18), day(26), day(20, 18, [])];
    expect(thisWeekCount(ws, NOW)).toBe(2); // 19. und 21.; 18. und 26. liegen in anderen Wochen
    expect(thisWeekCount([], NOW)).toBe(0);
  });

  it('zeigt, an welchen Tagen trainiert wurde', () => {
    expect(weekDays([day(19), day(21), day(25)], NOW)).toEqual([true, false, true, false, false, false, true]);
    expect(weekDays([day(18)], NOW)).toEqual([false, false, false, false, false, false, false]);
  });

  it('Trainings pro Woche, älteste zuerst, mit der aktuellen Woche zuletzt', () => {
    const ws = [day(19), day(21), day(12), day(13), day(14), day(5)];
    const weeks = workoutsPerWeek(ws, NOW, 4);
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 3, 2]);
    expect(weeks[3].start.getDate()).toBe(19);
    expect(weeks).toHaveLength(4);
    expect(workoutsPerWeek([], NOW)).toHaveLength(8);
  });

  it('begrenzt das Wochenziel auf 1 bis 7', () => {
    expect(clampGoal(0)).toBe(1);
    expect(clampGoal(10)).toBe(7);
    expect(clampGoal('4')).toBe(4);
    expect(clampGoal('abc')).toBe(3);
    expect(clampGoal(undefined)).toBe(3);
  });
});

describe('Körperwerte', () => {
  const entries = [
    { id: 'a', date: '2026-10-05', weight: 82.4, createdAt: 1 },
    { id: 'b', date: '2026-10-12', weight: 81.9, createdAt: 2 },
    { id: 'c', date: '2026-10-12', weight: 81.6, createdAt: 3 },
    { id: 'd', date: '2026-10-19', weight: 81.2, createdAt: 4 },
  ];

  it('sortiert neueste zuerst', () => {
    expect(sortBody(entries).map((e) => e.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('die Reihe zählt pro Tag den neuesten Eintrag, ältestes zuerst', () => {
    expect(bodySeries(entries).map((e) => e.id)).toEqual(['a', 'c', 'd']);
    expect(bodySeries([])).toEqual([]);
  });

  it('Änderung zwischen erstem und letztem Eintrag', () => {
    expect(bodyChange(bodySeries(entries))).toBe(-1.2);
    expect(bodyChange([{ date: '2026-10-05', weight: 80 }])).toBeNull();
    expect(bodyChange([])).toBeNull();
  });

  it('baut einen Eintrag mit Datum von heute, gerundet, ohne leere Notiz', () => {
    const entry = makeBodyEntry({ weight: '81,25', note: '  ' }, NOW);
    expect(entry).toMatchObject({ date: '2026-10-19', weight: 81.3 });
    expect('note' in entry).toBe(false);
    expect(makeBodyEntry({ weight: '80', date: '2026-10-01', note: ' nüchtern ' }, NOW)).toMatchObject({ date: '2026-10-01', note: 'nüchtern' });
    expect(makeBodyEntry({ weight: '0' }, NOW)).toBeNull();
    expect(makeBodyEntry({ weight: '1000' }, NOW)).toBeNull();
    expect(makeBodyEntry({ weight: 'x' }, NOW)).toBeNull();
    expect(makeBodyEntry({ weight: '' }, NOW)).toBeNull();
  });
});

describe('Datumstext', () => {
  it('Heute, Gestern, vor N Tagen, sonst Datum', () => {
    expect(relativeDay('2026-10-19', NOW)).toBe('Heute');
    expect(relativeDay('2026-10-18', NOW)).toBe('Gestern');
    expect(relativeDay('2026-10-15', NOW)).toBe('vor 4 Tagen');
    expect(relativeDay('2026-10-01', NOW)).toContain('1.');
  });
});

describe('Eingabefelder', () => {
  it('zeigt Zahlen mit deutschem Komma und liest sie wieder ein', async () => {
    const { toInput } = await import('../src/lib/gym');
    expect(toInput(62.5)).toBe('62,5');
    expect(toInput(60)).toBe('60');
    expect(parseNumber(toInput(62.5))).toBe(62.5);
  });
});

describe('buildTimeline', () => {
  it('mischt Trainings und Körperwerte, neueste zuerst, mit Abstand, Veränderung und Bestwerten', async () => {
    const { buildTimeline } = await import('../src/lib/gym');
    const set = (id, exerciseId, weight) => ({ id, exerciseId, weight, reps: 8, at: 1 });
    const w = (id, date, planId, weight) => ({
      id, date, planId, startedAt: Date.parse(`${date}T10:00:00`), endedAt: Date.parse(`${date}T11:00:00`),
      exerciseIds: ['e1'], sets: [set(`${id}s`, 'e1', weight)],
    });
    const workouts = [w('w1', '2026-10-01', 'p1', 60), w('w2', '2026-10-08', 'p1', 70), { ...w('w3', '2026-10-09', 'p1', 70), endedAt: null }];
    const body = [
      { id: 'b1', date: '2026-10-03', weight: 82, createdAt: 1 },
      { id: 'b2', date: '2026-10-05', weight: 81, createdAt: 2 },
    ];
    const items = buildTimeline({ workouts, body, plans: [{ id: 'p1', name: 'Push' }], exercises: [{ id: 'e1', name: 'Bankdrücken' }] });
    expect(items.map((i) => i.key)).toEqual(['w2', 'b2', 'b1', 'w1']);
    expect(items[0]).toMatchObject({ kind: 'workout', title: 'Push', gapDays: 3, volumeChange: 17, records: 1 });
    expect(items[1]).toMatchObject({ kind: 'body', delta: -1, gapDays: 2 });
    expect(items[3].gapDays).toBeNull();
  });
});

describe('Einstellungen einer Übung', () => {
  it('cleanSettings trimmt, wirft leere und doppelte Bezeichnungen weg und begrenzt', async () => {
    const { cleanSettings, settingsText, knownSettingLabels, MAX_SETTINGS } = await import('../src/lib/gym');
    expect(cleanSettings([
      { label: '  Sitzhöhe ', value: ' 4 ' },
      { label: 'sitzhöhe', value: '9' },
      { label: '', value: 'x' },
      { label: 'Loch', value: '' },
    ])).toEqual([{ label: 'Sitzhöhe', value: '4' }, { label: 'Loch', value: '' }]);
    expect(cleanSettings(null)).toEqual([]);
    expect(cleanSettings(Array.from({ length: 20 }, (_, i) => ({ label: 'L' + i, value: '1' }))).length).toBe(MAX_SETTINGS);
    expect(settingsText([{ label: 'Sitzhöhe', value: '4' }, { label: 'Loch', value: '' }])).toBe('Sitzhöhe 4 · Loch');
    expect(knownSettingLabels([
      { settings: [{ label: 'Loch', value: '1' }, { label: 'Sitzhöhe', value: '2' }] },
      { settings: [{ label: 'Sitzhöhe', value: '3' }] },
    ])).toEqual(['Sitzhöhe', 'Loch']);
  });
});

describe('moveId (Umsortieren per Ziehen)', () => {
  it('schiebt eine Id an die Zielstelle, gezählt ohne sie selbst', async () => {
    const { moveId } = await import('../src/hooks/useReorderList');
    expect(moveId(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveId(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b']);
  });
});
