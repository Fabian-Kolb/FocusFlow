import { toIsoDate } from './recurrence';

/**
 * Gym-Logbuch: reine Funktionen für Trainings, Sätze, Bestwerte, Fortschritt und Häufigkeit.
 *
 * Datenmodell (Sammlungen unter users/{uid}/, für Gäste ein JSON im Browser):
 *   gymExercises: { id, name }
 *   gymPlans:     { id, name, exerciseIds: [id], order }            Trainingstag (Push, Pull, Beine …)
 *   gymWorkouts:  { id, date 'YYYY-MM-DD', planId?, startedAt, endedAt?, exerciseIds: [id], sets: [set], note? }
 *   set:          { id, exerciseId, weight, reps?, at }             Wiederholungen sind optional
 *   gymBody:      { id, date, weight, note? }                       Körpergewicht
 * Felder nur setzen, wenn sie einen Wert haben (Firestore-Regeln: hasOnly).
 */

export const WEIGHT_STEP = 2.5;
export const MAX_WEIGHT = 999;
export const MAX_SETS_PER_WORKOUT = 300;
export const MAX_EXERCISES_PER_PLAN = 40;

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const newGymId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ Gewicht und Sätze */

/** „1 Satz“, „3 Sätze“ */
export const satzText = (count) => `${count} ${count === 1 ? 'Satz' : 'Sätze'}`;

/** „62,5 kg“, „60 kg“ */
export const formatWeight = (weight) => `${Number(weight).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`;

/** Zahl für ein Eingabefeld mit deutschem Komma: 62.5 → „62,5“ */
export const toInput = (value) => String(value).replace('.', ',');

/** Zahl aus einer Eingabe („62,5“, „62.5“); leer, ungültig oder negativ → null */
export function parseNumber(input) {
  const text = String(input ?? '').trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Gewicht um einen Schritt ändern, auf 0,25 gerundet, zwischen 0 und MAX_WEIGHT */
export function stepWeight(value, delta) {
  const base = parseNumber(value) ?? 0;
  const next = Math.round((base + delta) * 4) / 4;
  return Math.min(MAX_WEIGHT, Math.max(0, next));
}

/** Satz bauen; Wiederholungen nur, wenn eine positive ganze Zahl angegeben ist; ungültiges Gewicht → null */
export function makeSet({ exerciseId, weight, reps }, now = Date.now()) {
  const w = parseNumber(weight);
  if (!exerciseId || w === null || w > MAX_WEIGHT) return null;
  const r = parseNumber(reps);
  return {
    id: newGymId('s'),
    exerciseId,
    weight: w,
    ...(r !== null && Number.isInteger(r) && r > 0 && r <= 999 ? { reps: r } : {}),
    at: now,
  };
}

/**
 * Sätze als Text: gleiche Gewichte hintereinander werden zusammengefasst.
 * „60 kg × 8, 8, 7 · 62,5 kg × 5“, ohne Wiederholungen „60 kg (3 Sätze)“.
 */
export function describeSets(sets = []) {
  const groups = [];
  sets.forEach((set) => {
    const last = groups[groups.length - 1];
    if (last && last.weight === set.weight) last.sets.push(set);
    else groups.push({ weight: set.weight, sets: [set] });
  });
  return groups.map((g) => {
    if (g.sets.some((s) => s.reps)) return `${formatWeight(g.weight)} × ${g.sets.map((s) => s.reps || '–').join(', ')}`;
    return g.sets.length > 1 ? `${formatWeight(g.weight)} (${g.sets.length} Sätze)` : formatWeight(g.weight);
  }).join(' · ');
}

export const topWeight = (sets = []) => sets.reduce((max, s) => Math.max(max, s.weight), 0);

/** Volumen = Summe Gewicht × Wiederholungen, nur über Sätze mit Wiederholungen; ohne solche null */
export function volumeOf(sets = []) {
  const withReps = sets.filter((s) => s.reps);
  return withReps.length ? withReps.reduce((sum, s) => sum + s.weight * s.reps, 0) : null;
}

/* ------------------------------------------------------------------ Trainings */

const startKey = (w) => Number(w.startedAt) || Date.parse(w.date) || Number(w.createdAt) || 0;

/** Neueste zuerst */
export const sortWorkouts = (workouts = []) => [...workouts].sort((a, b) => startKey(b) - startKey(a));

export const setsOf = (workout, exerciseId) => (workout?.sets || []).filter((s) => s.exerciseId === exerciseId);

/** Läuft gerade ein Training? (gestartet, nicht beendet; das neueste) */
export const activeWorkout = (workouts = []) => sortWorkouts(workouts).find((w) => w.startedAt && !w.endedAt) || null;

/** Dauer in Minuten, nur bei beendeten Trainings */
export const workoutMinutes = (workout) => (
  workout?.startedAt && workout?.endedAt ? Math.max(1, Math.round((workout.endedAt - workout.startedAt) / 60000)) : null
);

export function newWorkout({ plan = null, now = new Date() } = {}) {
  const ms = now.getTime();
  return {
    id: newGymId('w'),
    date: toIsoDate(now),
    ...(plan ? { planId: plan.id } : {}),
    startedAt: ms,
    exerciseIds: plan ? [...(plan.exerciseIds || [])] : [],
    sets: [],
    createdAt: ms,
  };
}

/** Übung zum Training hinzufügen (einmal) */
export const withExercise = (workout, exerciseId) => (
  (workout.exerciseIds || []).includes(exerciseId) ? workout : { ...workout, exerciseIds: [...(workout.exerciseIds || []), exerciseId] }
);

/** Satz anhängen; die Übung rückt in die Liste des Trainings, falls sie fehlt. Mehr als MAX_SETS_PER_WORKOUT gibt es nicht. */
export function withSet(workout, set) {
  if (!set || (workout.sets || []).length >= MAX_SETS_PER_WORKOUT) return workout;
  return withExercise({ ...workout, sets: [...(workout.sets || []), set] }, set.exerciseId);
}

export const withoutSet = (workout, setId) => ({ ...workout, sets: (workout.sets || []).filter((s) => s.id !== setId) });

/** Übungen eines Trainings in der Reihenfolge der Liste, dazu alle mit Sätzen (falls Sätze ohne Eintrag existieren) */
export function workoutExerciseIds(workout) {
  const ids = [...(workout.exerciseIds || [])];
  (workout.sets || []).forEach((s) => { if (!ids.includes(s.exerciseId)) ids.push(s.exerciseId); });
  return ids;
}

/**
 * „Letztes Mal“: das jüngste andere Training, in dem die Übung Sätze hat.
 * @returns {{ workout: object, sets: object[] } | null}
 */
export function lastSession(workouts, exerciseId, { excludeId = null } = {}) {
  for (const workout of sortWorkouts(workouts)) {
    if (workout.id === excludeId) continue;
    const sets = setsOf(workout, exerciseId);
    if (sets.length) return { workout, sets };
  }
  return null;
}

/** Bestwert = höchstes Gewicht, das je mit der Übung bewegt wurde (optional ohne ein Training) */
export function bestWeight(workouts, exerciseId, { excludeId = null } = {}) {
  let best = 0;
  workouts.forEach((w) => {
    if (w.id === excludeId) return;
    best = Math.max(best, topWeight(setsOf(w, exerciseId)));
  });
  return best;
}

/**
 * Ist dieser Satz ein neuer Bestwert? Er muss schwerer sein als alles davor (frühere Trainings und frühere Sätze
 * im selben Training). Der erste Satz überhaupt zählt nicht: ohne Vergleich gibt es keinen Rekord.
 */
export function isRecord(workouts, workout, set) {
  const index = (workout.sets || []).findIndex((s) => s.id === set.id);
  const earlier = (workout.sets || []).slice(0, index < 0 ? undefined : index).filter((s) => s.exerciseId === set.exerciseId);
  const before = workouts.filter((w) => w.id !== workout.id && startKey(w) < startKey(workout));
  let previous = topWeight(earlier);
  before.forEach((w) => { previous = Math.max(previous, topWeight(setsOf(w, set.exerciseId))); });
  return previous > 0 && set.weight > previous;
}

/** Welche Sätze eines Trainings sind Bestwerte? → Menge von Satz-Ids */
export function recordSetIds(workouts, workout) {
  const ids = new Set();
  (workout.sets || []).forEach((set) => { if (isRecord(workouts, workout, set)) ids.add(set.id); });
  return ids;
}

/** Übungen, zu denen es Sätze gibt (für die Auswahl im Fortschritt), häufigste zuerst */
export function exercisesWithData(workouts, exercises) {
  const counts = new Map();
  workouts.forEach((w) => (w.sets || []).forEach((s) => counts.set(s.exerciseId, (counts.get(s.exerciseId) || 0) + 1)));
  return exercises
    .filter((e) => counts.has(e.id))
    .sort((a, b) => counts.get(b.id) - counts.get(a.id) || a.name.localeCompare(b.name, 'de'));
}

/**
 * Verlauf einer Übung: pro Training das höchste Gewicht und das Volumen, ältestes zuerst.
 * @returns {{ date: string, workoutId: string, top: number, volume: number|null }[]}
 */
export function exerciseSeries(workouts, exerciseId) {
  return [...workouts]
    .sort((a, b) => startKey(a) - startKey(b))
    .map((w) => ({ w, sets: setsOf(w, exerciseId) }))
    .filter((x) => x.sets.length)
    .map(({ w, sets }) => ({ date: w.date, workoutId: w.id, top: topWeight(sets), volume: volumeOf(sets) }));
}

/** Übung in einer Zeile zusammenfassen („Bankdrücken · 3 Sätze · 62,5 kg“) für Listen */
export function workoutSummary(workout, nameOf) {
  const exerciseIds = workoutExerciseIds(workout).filter((id) => setsOf(workout, id).length);
  const sets = (workout.sets || []).length;
  return {
    exerciseCount: exerciseIds.length,
    setCount: sets,
    names: exerciseIds.map((id) => nameOf(id)).filter(Boolean),
    volume: volumeOf(workout.sets || []),
  };
}

/* ------------------------------------------------------------------ Trainingstage */

export const sortPlans = (plans = []) => [...plans].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'de'));

/**
 * Welcher Trainingstag ist als Nächstes dran? Der nach dem zuletzt trainierten, reihum;
 * ohne bisheriges Training mit Plan der erste.
 */
export function nextPlan(plans, workouts) {
  const sorted = sortPlans(plans);
  if (sorted.length === 0) return null;
  const lastWithPlan = sortWorkouts(workouts).find((w) => w.planId && sorted.some((p) => p.id === w.planId));
  if (!lastWithPlan) return sorted[0];
  const index = sorted.findIndex((p) => p.id === lastWithPlan.planId);
  return sorted[(index + 1) % sorted.length];
}

/** Wann war der Trainingstag zuletzt dran? (Datum oder null) */
export const lastDoneDate = (workouts, planId) => sortWorkouts(workouts).find((w) => w.planId === planId)?.date || null;

/* ------------------------------------------------------------------ Häufigkeit */

/** Montag der Woche, in der `date` liegt (00:00 Uhr) */
export function weekStart(date) {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // Montag = 0
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

/** Zählt ein Training? Es braucht mindestens einen Satz. */
export const countsAsWorkout = (w) => (w.sets || []).length > 0;

/** Trainings der Woche, in der `now` liegt */
export function thisWeekCount(workouts, now = new Date()) {
  const start = weekStart(now).getTime();
  return workouts.filter((w) => countsAsWorkout(w) && startKey(w) >= start && startKey(w) < start + 7 * DAY_MS).length;
}

/** An welchen Tagen dieser Woche (Mo = 0) wurde trainiert? */
export function weekDays(workouts, now = new Date()) {
  const start = weekStart(now);
  const days = Array.from({ length: 7 }, () => false);
  workouts.filter(countsAsWorkout).forEach((w) => {
    const day = Math.floor((startOfDay(new Date(startKey(w))).getTime() - start.getTime()) / DAY_MS);
    if (day >= 0 && day < 7) days[day] = true;
  });
  return days;
}

/** Trainings pro Woche der letzten `weeks` Wochen, älteste zuerst */
export function workoutsPerWeek(workouts, now = new Date(), weeks = 8) {
  const current = weekStart(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (weeks - 1 - i));
    const from = start.getTime();
    const count = workouts.filter((w) => countsAsWorkout(w) && startKey(w) >= from && startKey(w) < from + 7 * DAY_MS).length;
    return { start, count };
  });
}

/** Wochenziel: 1 bis 7 Trainings, Standard 3 */
export const DEFAULT_WEEKLY_GOAL = 3;
export const clampGoal = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(7, Math.max(1, n)) : DEFAULT_WEEKLY_GOAL;
};

/* ------------------------------------------------------------------ Körperwerte */

export const sortBody = (entries = []) => [...entries].sort((a, b) => b.date.localeCompare(a.date) || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

/** Verlauf, ältestes zuerst; mehrere Einträge am selben Tag: der neueste zählt */
export function bodySeries(entries = []) {
  const byDate = new Map();
  sortBody(entries).forEach((e) => { if (!byDate.has(e.date)) byDate.set(e.date, e); });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, weight: e.weight, id: e.id }));
}

/** Änderung zwischen erstem und letztem Eintrag der Reihe (kg, vorzeichenbehaftet) oder null */
export function bodyChange(series) {
  if (series.length < 2) return null;
  return Math.round((series[series.length - 1].weight - series[0].weight) * 10) / 10;
}

/** Neuer Körperwert-Eintrag; ungültiges Gewicht (0, negativ, ≥ 1000) → null */
export function makeBodyEntry({ weight, date, note }, now = new Date()) {
  const w = parseNumber(weight);
  if (w === null || w <= 0 || w >= 1000) return null;
  const clean = String(note || '').trim().slice(0, 500);
  return {
    id: newGymId('b'),
    date: date || toIsoDate(now),
    weight: Math.round(w * 10) / 10,
    ...(clean ? { note: clean } : {}),
    createdAt: now.getTime(),
  };
}

/* ------------------------------------------------------------------ Text zu Datum */

/** „Heute“, „Gestern“, „vor 3 Tagen“, sonst „12. Okt.“ */
export function relativeDay(iso, now = new Date()) {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const diff = Math.round((startOfDay(now) - day) / DAY_MS);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff > 1 && diff < 7) return `vor ${diff} Tagen`;
  return day.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

/** Kompakte Zusammenfassung des Trainings für Fio: Woche, Ziel und die letzten Trainings mit Übungen */
export function buildGymSummary({ workouts = [], plans = [], exercises = [], weeklyGoal = 3, now = new Date() }) {
  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || null;
  const done = workouts.filter((w) => w.endedAt && (w.sets || []).length > 0);
  return {
    wochenziel: weeklyGoal,
    trainingsDieseWoche: thisWeekCount(workouts, now),
    alsNaechstes: nextPlan(plans, workouts)?.name || null,
    letzteTrainings: done.slice(0, 5).map((w) => {
      const s = workoutSummary(w, nameOf);
      return {
        datum: w.date,
        trainingstag: plans.find((p) => p.id === w.planId)?.name || 'Freies Training',
        uebungen: s.names,
        saetze: s.setCount,
        volumenKg: Math.round(s.volume || 0),
      };
    }),
  };
}

/* ------------------------------------------------------------------ Verlauf (Zeitleiste) */

const isoDays = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

/**
 * Zeitleiste aus Trainings (mit mindestens einem Satz, beendet) und Körperwerten, neueste zuerst.
 * Jeder Eintrag kennt, was davor war: `gapDays` = Tage seit dem vorherigen Eintrag, bei Trainings `volumeChange`
 * (Prozent gegenüber dem letzten Training desselben Trainingstags) und `records` (Anzahl Bestwerte),
 * bei Körperwerten `delta` (kg gegenüber dem vorherigen Wert).
 */
export function buildTimeline({ workouts = [], body = [], plans = [], exercises = [] }) {
  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || null;
  const planName = (id) => plans.find((p) => p.id === id)?.name || 'Freies Training';
  const done = sortWorkouts(workouts).filter((w) => w.endedAt && (w.sets || []).length > 0);

  const items = done.map((workout, index) => {
    const summary = workoutSummary(workout, nameOf);
    const previous = done.slice(index + 1).find((w) => w.planId === workout.planId);
    const prevVolume = previous ? volumeOf(previous.sets || []) : 0;
    return {
      kind: 'workout',
      key: workout.id,
      date: workout.date,
      sortKey: startKey(workout),
      workout,
      title: planName(workout.planId),
      names: summary.names,
      setCount: summary.setCount,
      volume: summary.volume,
      minutes: workoutMinutes(workout),
      records: recordSetIds(workouts, workout).size,
      volumeChange: prevVolume > 0 && summary.volume > 0 ? Math.round(((summary.volume - prevVolume) / prevVolume) * 100) : null,
    };
  });

  const bodyAsc = sortBody(body).reverse();
  bodyAsc.forEach((entry, index) => {
    items.push({
      kind: 'body',
      key: entry.id,
      date: entry.date,
      sortKey: new Date(`${entry.date}T12:00:00`).getTime() + (Number(entry.createdAt) || 0) % 1000,
      entry,
      delta: index > 0 ? Math.round((entry.weight - bodyAsc[index - 1].weight) * 10) / 10 : null,
    });
  });

  items.sort((a, b) => b.date.localeCompare(a.date) || b.sortKey - a.sortKey);
  return items.map((item, index) => {
    const older = items[index + 1];
    return { ...item, gapDays: older ? Math.max(0, isoDays(item.date) - isoDays(older.date)) : null };
  });
}
