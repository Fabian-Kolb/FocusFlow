import { getReminderDateInfo } from './reminderDates';
import { normalizeDateStringToIso } from './calendarSyncService';
import { normalizeProjectStatus, parseIsoDay } from './projectProgress';
import { toIsoDate } from './recurrence';
import { TASK_KINDS, countdownLabel, countdownTone, isActiveTask, isTaskKind } from './taskOverview';

/**
 * Hochschule: Fächer, Prüfungstermine und die Liste der Abgaben und Prüfungen. Reine Funktionen.
 *
 * Ein Fach ist ein Projekt mit `type: 'fach'` (sonst weglassen). Dazu zwei optionale Felder:
 *   exam:  { date: 'YYYY-MM-DD' }                       Prüfungstermin (Countdown)
 *   hints: [{ id, text, date, exam? }]                   „Hinweise aus der Stunde“: kurze Einträge, was der
 *                                                        Professor als wichtig sagte; `exam` = prüfungsrelevant
 * Übungsblätter und andere Abgaben sind normale Aufgaben mit Datum in den Abschnitten des Fachs. Ein Fach als
 * erledigt markieren (Status „Erledigt“) ist das Archivieren am Semesterende.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiffOf = (day, now) => Math.round((startOfDay(day) - startOfDay(now)) / DAY_MS);

export const MAX_HINTS = 200;

export const isFach = (project) => project?.type === 'fach';

/** Fach, das noch läuft: nicht gelöscht, nicht erledigt */
export const isOpenFach = (project) => (
  isFach(project) && !project.deletedAt && normalizeProjectStatus(project.status) !== 'ABGESCHLOSSEN'
);

/** Prüfungstermin eines Fachs: { date, iso, dayDiff, countdown, tone } oder null */
export function getExam(project, now = new Date()) {
  const iso = project?.exam?.date;
  const day = iso ? parseIsoDay(iso) : null;
  if (!day) return null;
  const dayDiff = dayDiffOf(day, now);
  return { date: day, iso, dayDiff, countdown: countdownLabel(dayDiff), tone: countdownTone(dayDiff) };
}

/** Aufgaben eines Fachs mit Frist, die noch offen sind */
function openDatedTasks(project, now) {
  const found = [];
  (project?.phases || []).forEach((phase) => {
    (phase.tasks || []).forEach((task) => {
      if (task.completed) return;
      const iso = normalizeDateStringToIso(task.date);
      const day = iso ? parseIsoDay(iso) : null;
      if (!day) return;
      found.push({ task, phase, day, dayDiff: dayDiffOf(day, now) });
    });
  });
  return found;
}

/**
 * Nächste Frist eines Fachs: die früheste offene Aufgabe mit Datum oder der Prüfungstermin (vorbei zählt nicht).
 * @returns {{ kind: 'pruefung'|'aufgabe', title: string, dayDiff: number, countdown: string, tone: string } | null}
 */
export function nextFachDeadline(project, now = new Date(), { includeExam = true } = {}) {
  const candidates = openDatedTasks(project, now).map((t) => ({ kind: 'aufgabe', title: t.task.title, dayDiff: t.dayDiff }));
  const exam = includeExam ? getExam(project, now) : null;
  if (exam && exam.dayDiff >= 0) candidates.push({ kind: 'pruefung', title: 'Prüfung', dayDiff: exam.dayDiff });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dayDiff - b.dayDiff);
  const first = candidates[0];
  return { ...first, countdown: countdownLabel(first.dayDiff), tone: countdownTone(first.dayDiff) };
}

/**
 * Abgaben und Prüfungen für Home: Prüfungstermine der Fächer und Merklisten-Einträge mit Art Abgabe/Prüfung,
 * früheste zuerst. Aufgaben in den Fächern stehen schon in Überfällig/Heute/Woche und fehlen hier.
 * @returns {{ key: string, source: 'exam'|'reminder', id: string, title: string, subtitle: string, icon: string,
 *             dayDiff: number, countdown: string, tone: string }[]}
 */
export function buildDeadlineList({ projects = [], reminders = [], now = new Date(), limit = 6 } = {}) {
  const items = [];

  projects.filter(isOpenFach).forEach((project) => {
    const exam = getExam(project, now);
    if (!exam || exam.dayDiff < 0) return;
    items.push({
      key: `exam-${project.id}`, source: 'exam', id: project.id, title: project.title, subtitle: 'Prüfung',
      icon: TASK_KINDS.pruefung.icon, dayDiff: exam.dayDiff, countdown: exam.countdown, tone: exam.tone,
    });
  });

  reminders.filter((r) => isActiveTask(r) && isTaskKind(r.kind)).forEach((reminder) => {
    const info = getReminderDateInfo(reminder, now);
    if (!info.hasDate) return;
    items.push({
      key: `reminder-${reminder.id}`, source: 'reminder', id: reminder.id, title: reminder.title,
      subtitle: TASK_KINDS[reminder.kind].label, icon: TASK_KINDS[reminder.kind].icon,
      dayDiff: info.dayDiff, countdown: countdownLabel(info.dayDiff), tone: countdownTone(info.dayDiff),
    });
  });

  return items.sort((a, b) => a.dayDiff - b.dayDiff || a.title.localeCompare(b.title, 'de')).slice(0, limit);
}

/* ------------------------------------------------------------------ Hinweise aus der Stunde */

const newHintId = () => `hint_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/** Neuen Hinweis vorne einfügen. Leere Texte werden ignoriert, mehr als MAX_HINTS gibt es nicht. */
export function addHint(hints = [], text, { exam = false, now = new Date() } = {}) {
  const clean = String(text || '').trim().slice(0, 500);
  if (!clean) return hints;
  const hint = { id: newHintId(), text: clean, date: toIsoDate(now), ...(exam ? { exam: true } : {}) };
  return [hint, ...hints].slice(0, MAX_HINTS);
}

/** „Prüfungsrelevant“ umschalten; das Feld verschwindet, wenn es nicht gesetzt ist */
export function toggleHintExam(hints = [], id) {
  return hints.map((h) => {
    if (h.id !== id) return h;
    if (h.exam) {
      const { exam: _exam, ...rest } = h;
      return rest;
    }
    return { ...h, exam: true };
  });
}

export const removeHint = (hints = [], id) => hints.filter((h) => h.id !== id);

/* ------------------------------------------------------------------ Schnelleingabe */

/** Abschnitt, in den neue Aufgaben eines Fachs kommen: der erste offene, sonst der erste */
export const pickFachPhase = (project) => (project?.phases || []).find((p) => !p.completed) || project?.phases?.[0] || null;

/**
 * Wohin gehört eine Eingabe in Hochschule, wenn der Text ein Fach nennt?
 *  'exam'     → Prüfungstermin des Fachs („Klausur Mathe 2 am 2.11.“)
 *  'fachTask' → Aufgabe im Fach („Mathe Blatt 5 bis Freitag“)
 *  'reminder' → Merkliste (kein Fach genannt, Uhrzeit angegeben oder das Fach hat keinen Abschnitt)
 */
export function getCaptureTarget(entry, fach) {
  if (!fach) return 'reminder';
  if (entry.kind === 'pruefung' && entry.date) return 'exam';
  if (entry.time) return 'reminder'; // Uhrzeiten kennt die Merkliste, Aufgaben im Fach nicht
  return pickFachPhase(fach) ? 'fachTask' : 'reminder';
}
