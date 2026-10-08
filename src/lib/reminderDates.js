/**
 * Datums-Logik für Erinnerungen.
 * Erinnerungen speichern `date` (YYYY-MM-DD oder die Wörter "Heute" / "Morgen" / "Demnächst"),
 * optional `time` (HH:MM) und `createdAt` (ms). Daraus leiten Karte und Zeit-Gruppen alles ab.
 */

export const REMINDER_TIME_GROUPS = [
  { id: 'overdue', label: 'Überfällig', icon: 'error' },
  { id: 'today', label: 'Heute', icon: 'today' },
  { id: 'week', label: 'Nächste 7 Tage', icon: 'date_range' },
  { id: 'later', label: 'Später', icon: 'event_upcoming' },
  { id: 'none', label: 'Ohne Datum', icon: 'event_busy' },
  { id: 'done', label: 'Erledigt', icon: 'task_alt' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseDueDate(reminder, now) {
  const { date, time } = reminder;
  if (!date || date === 'Demnächst') return null;
  if (date === 'Heute' || date === 'Morgen') {
    const base = startOfDay(now);
    if (date === 'Morgen') base.setDate(base.getDate() + 1);
    return { day: base, withTime: false };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(day.getTime())) return null;
  return { day, withTime: /^\d{2}:\d{2}$/.test(time || '') };
}

/**
 * @param {object} reminder
 * @param {Date} [now]
 * @returns {{
 *   hasDate: boolean, dueAt: Date|null, dayDiff: number|null,
 *   dateLabel: string, relativeLabel: string, urgency: 'overdue'|'today'|'soon'|'later'|'none',
 *   timeElapsed: number|null, group: string
 * }}
 */
export function getReminderDateInfo(reminder, now = new Date()) {
  const isDone = reminder?.status === 'ABGESCHLOSSEN';
  const parsed = reminder ? parseDueDate(reminder, now) : null;

  if (!parsed) {
    return {
      hasDate: false,
      dueAt: null,
      dayDiff: null,
      dateLabel: 'Kein Datum',
      relativeLabel: '',
      urgency: 'none',
      timeElapsed: null,
      group: isDone ? 'done' : 'none',
    };
  }

  const { day, withTime } = parsed;
  const dueAt = new Date(day);
  if (withTime) {
    const [h, m] = reminder.time.split(':').map(Number);
    dueAt.setHours(h, m, 0, 0);
  } else {
    dueAt.setHours(23, 59, 59, 999); // ohne Uhrzeit gilt der ganze Tag
  }

  // Kalendertage, nicht 24-Stunden-Blöcke: "morgen 08:00" ist morgen, auch wenn es jetzt 22 Uhr ist
  const dayDiff = Math.round((startOfDay(day) - startOfDay(now)) / DAY_MS);
  const overdue = dueAt < now;

  let relativeLabel;
  if (overdue && dayDiff < 0) relativeLabel = dayDiff === -1 ? 'seit gestern' : `${-dayDiff} T. überfällig`;
  else if (overdue) relativeLabel = 'überfällig';
  else if (dayDiff === 0) relativeLabel = 'heute';
  else if (dayDiff === 1) relativeLabel = 'morgen';
  else relativeLabel = `in ${dayDiff} T.`;

  let urgency = 'later';
  if (overdue) urgency = 'overdue';
  else if (dayDiff === 0) urgency = 'today';
  else if (dayDiff <= 7) urgency = 'soon';

  let group = 'later';
  if (isDone) group = 'done';
  else if (overdue) group = 'overdue';
  else if (dayDiff === 0) group = 'today';
  else if (dayDiff <= 7) group = 'week';

  let dateLabel = day.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  if (withTime) dateLabel += ` · ${reminder.time}`;

  let timeElapsed = null;
  const created = Number(reminder.createdAt);
  if (created && dueAt.getTime() > created) {
    const ratio = (now.getTime() - created) / (dueAt.getTime() - created);
    timeElapsed = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  } else if (overdue) {
    timeElapsed = 100;
  }

  return { hasDate: true, dueAt, dayDiff, dateLabel, relativeLabel, urgency, timeElapsed, group };
}

/** Sortierschlüssel: früheste Fälligkeit zuerst, ohne Datum ans Ende */
export function compareReminderDue(a, b, now = new Date()) {
  const da = getReminderDateInfo(a, now).dueAt;
  const db = getReminderDateInfo(b, now).dueAt;
  if (da && db) return da - db;
  if (da) return -1;
  if (db) return 1;
  return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
}

/** Erinnerungen in die Zeit-Gruppen einsortieren (Reihenfolge wie REMINDER_TIME_GROUPS) */
export function groupRemindersByTime(reminders, now = new Date()) {
  const buckets = Object.fromEntries(REMINDER_TIME_GROUPS.map((g) => [g.id, []]));
  reminders.forEach((r) => buckets[getReminderDateInfo(r, now).group].push(r));
  Object.entries(buckets).forEach(([id, list]) => {
    list.sort((a, b) => compareReminderDue(a, b, now));
    if (id === 'done') list.reverse(); // zuletzt fällige Erledigte zuerst
  });
  return REMINDER_TIME_GROUPS.map((g) => ({ ...g, items: buckets[g.id] }));
}
