import { getReminderDateInfo } from './reminderDates';
import { parseIsoDay } from './projectProgress';
import { normalizeDateStringToIso } from './calendarSyncService';
import { getEventStartDate, isAllDayEvent, isEventOnDate, formatClock } from './calendarUtils';

/**
 * Tagesübersicht für das Dashboard: führt Kalendertermine, Erinnerungen und Projekt-Aufgaben
 * zu einer Liste pro Tag zusammen. Reine Funktion, damit sie ohne React testbar ist.
 *
 * Eintrag: { key, kind: 'event'|'reminder'|'task', id, title, subtitle, startAt, endAt, timeLabel,
 *            allDay, completed, projectId, phaseId }
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HH_MM = /^\d{2}:\d{2}$/;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (day, today) => Math.round((startOfDay(day) - today) / DAY_MS);

export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

/** Reihenfolge innerhalb eines Tages: ganztägig, dann nach Uhrzeit, dann ohne Uhrzeit */
function compareItems(a, b) {
  const rank = (i) => (i.allDay ? 0 : i.startAt ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.startAt && b.startAt) return a.startAt - b.startAt;
  return a.title.localeCompare(b.title, 'de');
}

/** Wie lange etwas schon überfällig ist: „gestern“, „vor 3 T.“ */
export const overdueLabel = (diff) => (diff === -1 ? 'gestern' : `vor ${-diff} T.`);

function reminderItem(rem, info) {
  const hasTime = HH_MM.test(rem.time || '') && info.dueAt;
  return {
    key: `reminder-${rem.id}`,
    kind: 'reminder',
    id: rem.id,
    title: rem.title || 'Erinnerung',
    subtitle: rem.description ? rem.description.split('\n')[0].replace(/[*#>-]/g, '').trim() : '',
    startAt: hasTime ? info.dueAt : null,
    endAt: null,
    timeLabel: hasTime ? rem.time : null,
    allDay: false,
    completed: rem.status === 'ABGESCHLOSSEN',
    dueLabel: info.dayDiff < 0 ? overdueLabel(info.dayDiff) : null,
    projectId: null,
    phaseId: null,
  };
}

function taskItem(project, phase, task, diff = 0) {
  return {
    key: `task-${project.id}-${task.id}`,
    kind: 'task',
    id: task.id,
    title: task.title || 'Aufgabe',
    subtitle: project.title,
    startAt: null,
    endAt: null,
    timeLabel: null,
    allDay: false,
    completed: !!task.completed,
    dueLabel: diff < 0 ? overdueLabel(diff) : null,
    projectId: project.id,
    phaseId: phase.id,
  };
}

function eventItem(evt, day) {
  const allDay = isAllDayEvent(evt);
  const start = getEventStartDate(evt);
  // Mehrtägige Termine zeigen sich an Folgetagen als ganztägig
  const continues = !allDay && startOfDay(start) < startOfDay(day);
  const timed = !allDay && !continues;
  return {
    key: `event-${evt.id}-${dayKey(day)}`,
    kind: 'event',
    id: evt.id,
    title: evt.summary || '(Ohne Titel)',
    subtitle: evt.location || '',
    startAt: timed ? start : null,
    endAt: timed && evt.end?.dateTime ? new Date(evt.end.dateTime) : null,
    timeLabel: timed ? formatClock(start) : null,
    allDay: allDay || continues,
    completed: false,
    dueLabel: null,
    projectId: null,
    phaseId: null,
  };
}

/**
 * @param {{ reminders?: object[], projects?: object[], eventsByMonth?: Record<string, object[]>, now?: Date, days?: number }} input
 * @returns {{ overdue: object[], days: { date: Date, key: string, isToday: boolean, items: object[] }[] }}
 */
export function buildAgenda({ reminders = [], projects = [], eventsByMonth = {}, now = new Date(), days = 7 } = {}) {
  const today = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    return { date, key: dayKey(date), isToday: i === 0, items: [] };
  });
  const overdue = [];
  const syncedEventIds = new Set();

  reminders.forEach((rem) => {
    if (rem.deletedAt) return;
    if (rem.googleEventId) syncedEventIds.add(rem.googleEventId);
    const info = getReminderDateInfo(rem, now);
    if (!info.hasDate) return;
    const done = rem.status === 'ABGESCHLOSSEN';
    if (!done && info.dayDiff < 0) {
      overdue.push(reminderItem(rem, info));
    } else if (info.dayDiff >= 0 && info.dayDiff < days && (!done || info.dayDiff === 0)) {
      buckets[info.dayDiff].items.push(reminderItem(rem, info));
    }
  });

  projects.forEach((proj) => {
    if (proj.deletedAt) return;
    (proj.phases || []).forEach((phase) => {
      (phase.tasks || []).forEach((task) => {
        if (task.googleEventId) syncedEventIds.add(task.googleEventId);
      });
    });
    if (proj.status === 'ABGESCHLOSSEN' || proj.isPaused) return;
    (proj.phases || []).forEach((phase) => {
      (phase.tasks || []).forEach((task) => {
        const iso = normalizeDateStringToIso(task.date);
        const day = iso ? parseIsoDay(iso) : null;
        if (!day) return;
        const diff = dayDiff(day, today);
        if (diff < 0 && !task.completed) overdue.push(taskItem(proj, phase, task, diff));
        else if (diff >= 0 && diff < days && (!task.completed || diff === 0)) buckets[diff].items.push(taskItem(proj, phase, task, diff));
      });
    });
  });

  // Kalendertermine; was als Erinnerung/Aufgabe synchronisiert wurde, steht schon oben
  buckets.forEach((bucket) => {
    const list = eventsByMonth[monthKey(bucket.date)] || [];
    list.forEach((evt) => {
      if (syncedEventIds.has(evt.id)) return;
      if (!isEventOnDate(evt, bucket.date)) return;
      bucket.items.push(eventItem(evt, bucket.date));
    });
    bucket.items.sort(compareItems);
  });

  overdue.sort((a, b) => a.title.localeCompare(b.title, 'de'));
  return { overdue, days: buckets };
}

/**
 * Nächster Eintrag mit Uhrzeit am heutigen Tag, der noch läuft oder bevorsteht.
 * @returns {{ item: object, state: 'running'|'upcoming', minutes: number } | null}
 */
export function getNextTimed(todayItems, now = new Date()) {
  const open = todayItems.filter((i) => i.startAt && !i.completed);
  for (const item of open) {
    const end = item.endAt || new Date(item.startAt.getTime() + 60 * 60 * 1000);
    if (now >= item.startAt && now < end) return { item, state: 'running', minutes: 0 };
    if (item.startAt > now) return { item, state: 'upcoming', minutes: Math.ceil((item.startAt - now) / 60000) };
  }
  return null;
}

/** „in 25 Min“, „in 2 Std.“ – nur für Einträge in den nächsten Stunden sinnvoll */
export function formatMinutes(minutes) {
  if (minutes < 60) return `in ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} Std.` : `in ${hours} Std. ${rest} Min`;
}
