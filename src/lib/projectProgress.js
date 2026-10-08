/**
 * Projekt-Kennzahlen, live aus Abschnitten, Aufgaben und Zeitraum berechnet.
 * Gespeicherte Felder wie `badgeText`, `progress`, `timeElapsed` oder `daysRemaining`
 * veralten (z. B. wenn Aufgaben an anderer Stelle abgehakt werden oder einfach Zeit vergeht),
 * deshalb werden sie für die Anzeige nicht mehr gelesen.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const formatShort = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** 'YYYY-MM-DD' als lokaler Kalendertag (nicht UTC), sonst null */
export function parseIsoDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(day.getTime()) ? null : day;
}

/** Aufgaben-Datum für die Anzeige: ISO-Tage als 12.10.26, ältere Freitext-Daten unverändert */
export function formatTaskDate(value) {
  const day = parseIsoDay(value);
  return day ? formatShort(day) : value || '';
}

/** Ältere Projekte speichern noch 'IN ARBEIT' statt 'AKTIV' */
export function normalizeProjectStatus(status) {
  return status === 'IN ARBEIT' ? 'AKTIV' : status;
}

export function getPhaseStats(phase) {
  const tasks = phase?.tasks || [];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  // Ohne Aufgaben zählt das gespeicherte Häkchen des Abschnitts
  const isDone = total > 0 ? completed === total : !!phase?.completed;

  let label = `${completed}/${total} ERLEDIGT`;
  if (isDone) label = 'ERLEDIGT';
  else if (total === 0) label = 'KEINE AUFGABEN';

  return { total, completed, isDone, label };
}

/**
 * Zeitraum eines Projekts relativ zu `now`.
 * @returns {{ dateRange: string, timeElapsed: number|null, dayLabel: string,
 *   daysLeft: number|null, deadlineLabel: string, isOverdue: boolean }}
 */
export function getProjectTimeline(project, now = new Date()) {
  const start = parseIsoDay(project?.startDate);
  const end = parseIsoDay(project?.endDate);
  const today = startOfDay(now);
  const isDone = normalizeProjectStatus(project?.status) === 'ABGESCHLOSSEN';

  let dateRange = '';
  if (start && end) dateRange = `${formatShort(start)} – ${formatShort(end)}`;
  else if (start) dateRange = `ab ${formatShort(start)}`;
  else if (end) dateRange = `bis ${formatShort(end)}`;

  let timeElapsed = null;
  let dayLabel = '';
  if (start && end && end >= start) {
    const totalDays = Math.round((end - start) / DAY_MS) + 1; // Endtag zählt mit
    const ratio = (now - start) / (totalDays * DAY_MS);
    timeElapsed = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    const dayNum = Math.round((today - start) / DAY_MS) + 1;
    if (dayNum >= 1 && dayNum <= totalDays) dayLabel = `TAG ${dayNum} VON ${totalDays}`;
  }

  let daysLeft = null;
  let deadlineLabel = '';
  let isOverdue = false;
  if (end) {
    daysLeft = Math.round((end - today) / DAY_MS);
    if (isDone) {
      deadlineLabel = '';
    } else if (start && today < start) {
      const daysToStart = Math.round((start - today) / DAY_MS);
      deadlineLabel = daysToStart === 1 ? 'START MORGEN' : `START IN ${daysToStart} TAGEN`;
    } else if (daysLeft > 1) {
      deadlineLabel = `NOCH ${daysLeft} TAGE`;
    } else if (daysLeft === 1) {
      deadlineLabel = 'BIS MORGEN';
    } else if (daysLeft === 0) {
      deadlineLabel = 'HEUTE FÄLLIG';
    } else {
      isOverdue = true;
      deadlineLabel = daysLeft === -1 ? '1 TAG ÜBERFÄLLIG' : `${-daysLeft} TAGE ÜBERFÄLLIG`;
    }
  }

  return { dateRange, timeElapsed, dayLabel, daysLeft, deadlineLabel, isOverdue };
}

/**
 * Alle Kennzahlen eines Projekts.
 * `nextTask` ist die erste offene Aufgabe im ersten offenen Abschnitt ({ task, phase } oder null).
 */
export function getProjectStats(project, now = new Date()) {
  const phases = project?.phases || [];
  let tasksTotal = 0;
  let tasksCompleted = 0;
  let phasesCompleted = 0;
  let nextTask = null;

  phases.forEach((phase) => {
    const stats = getPhaseStats(phase);
    tasksTotal += stats.total;
    tasksCompleted += stats.completed;
    if (stats.isDone) phasesCompleted += 1;
    if (!nextTask && !stats.isDone) {
      const task = (phase.tasks || []).find((t) => !t.completed);
      if (task) nextTask = { task, phase };
    }
  });

  const isDone = normalizeProjectStatus(project?.status) === 'ABGESCHLOSSEN';
  let progress = isDone ? 100 : 0;
  if (tasksTotal > 0) progress = Math.round((tasksCompleted / tasksTotal) * 100);

  return {
    tasksTotal,
    tasksCompleted,
    phasesTotal: phases.length,
    phasesCompleted,
    progress,
    nextTask,
    timeline: getProjectTimeline(project, now),
  };
}
