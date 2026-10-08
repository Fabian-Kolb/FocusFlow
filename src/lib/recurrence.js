/**
 * Wiederkehrende Erinnerungen.
 * Datenmodell auf der Erinnerung: `recurrence: { freq, interval }` oder `null`.
 *   freq: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
 *   interval: ganze Zahl ≥ 1 (z. B. 2 + 'weekly' = alle 2 Wochen; bei 'weekdays' ignoriert)
 *   anchorDay: optional, ursprünglicher Tag im Monat (1–31) für 'monthly'/'yearly'
 * Wird eine wiederkehrende Erinnerung erledigt, springt `date` auf den nächsten Termin
 * (immer nach heute), statt dass sie erledigt liegen bleibt.
 */

export const RECURRENCE_OPTIONS = [
  { id: 'none', label: 'Nicht wiederholen', value: null },
  { id: 'daily', label: 'Täglich', value: { freq: 'daily', interval: 1 } },
  { id: 'weekdays', label: 'Werktags (Mo–Fr)', value: { freq: 'weekdays', interval: 1 } },
  { id: 'weekly', label: 'Wöchentlich', value: { freq: 'weekly', interval: 1 } },
  { id: 'biweekly', label: 'Alle 2 Wochen', value: { freq: 'weekly', interval: 2 } },
  { id: 'monthly', label: 'Monatlich', value: { freq: 'monthly', interval: 1 } },
  { id: 'yearly', label: 'Jährlich', value: { freq: 'yearly', interval: 1 } },
];

const FREQS = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'];

export function normalizeRecurrence(rec) {
  if (!rec || typeof rec !== 'object' || !FREQS.includes(rec.freq)) return null;
  const interval = Math.max(1, Math.min(365, Math.round(Number(rec.interval) || 1)));
  const norm = { freq: rec.freq, interval: rec.freq === 'weekdays' ? 1 : interval };
  const anchorDay = Number(rec.anchorDay);
  if (Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= 31) norm.anchorDay = anchorDay;
  return norm;
}

export function isRecurring(reminder) {
  return Boolean(normalizeRecurrence(reminder?.recurrence));
}

/** Passende Option für ein Auswahlfeld finden (unbekannte Kombinationen → null) */
export function getRecurrenceOptionId(rec) {
  const norm = normalizeRecurrence(rec);
  if (!norm) return 'none';
  const match = RECURRENCE_OPTIONS.find(
    (o) => o.value && o.value.freq === norm.freq && o.value.interval === norm.interval
  );
  return match ? match.id : null;
}

export function formatRecurrence(rec) {
  const norm = normalizeRecurrence(rec);
  if (!norm) return '';
  const { freq, interval } = norm;
  if (freq === 'weekdays') return 'Werktags';
  if (interval === 1) {
    return { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich' }[freq];
  }
  const unit = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate', yearly: 'Jahre' }[freq];
  return `Alle ${interval} ${unit}`;
}

const pad = (n) => String(n).padStart(2, '0');
export const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseBaseDate(dateStr, now) {
  const today = startOfDay(now);
  if (dateStr === 'Morgen') {
    today.setDate(today.getDate() + 1);
    return today;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return today; // „Heute“, „Demnächst“ oder leer: ab heute rechnen
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function step(date, rec, anchorDay) {
  const d = new Date(date);
  switch (rec.freq) {
    case 'daily':
      d.setDate(d.getDate() + rec.interval);
      return d;
    case 'weekdays':
      do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
      return d;
    case 'weekly':
      d.setDate(d.getDate() + 7 * rec.interval);
      return d;
    case 'monthly': {
      // Tag des Monats beibehalten, am Monatsende kürzen (31. → 30./28.); dank anchorDay danach wieder der 31.
      const target = new Date(d.getFullYear(), d.getMonth() + rec.interval, 1);
      target.setDate(Math.min(anchorDay, daysInMonth(target.getFullYear(), target.getMonth())));
      return target;
    }
    case 'yearly': {
      const target = new Date(d.getFullYear() + rec.interval, d.getMonth(), 1);
      target.setDate(Math.min(anchorDay, daysInMonth(target.getFullYear(), target.getMonth())));
      return target;
    }
    default:
      return d;
  }
}

/**
 * Nächster Termin nach dem aktuellen Fälligkeitsdatum, mindestens aber nach heute.
 * @returns {string|null} YYYY-MM-DD
 */
export function getNextOccurrence(dateStr, recurrence, now = new Date()) {
  const rec = normalizeRecurrence(recurrence);
  if (!rec) return null;
  const base = parseBaseDate(dateStr, now);
  const anchorDay = rec.anchorDay || base.getDate();
  const today = startOfDay(now);

  let next = step(base, rec, anchorDay);
  let guard = 0;
  while (next <= today && guard < 2000) {
    next = step(next, rec, anchorDay);
    guard++;
  }
  return toIsoDate(next);
}

/**
 * Erledigen einer wiederkehrenden Erinnerung: neues Datum + Regel mit festem Ankertag.
 * @returns {{ date: string, recurrence: object } | null}
 */
export function advanceRecurringReminder(reminder, now = new Date()) {
  const rec = normalizeRecurrence(reminder?.recurrence);
  if (!rec) return null;
  const date = getNextOccurrence(reminder.date, rec, now);
  const anchorDay = rec.anchorDay || parseBaseDate(reminder.date, now).getDate();
  const recurrence = rec.freq === 'monthly' || rec.freq === 'yearly' ? { ...rec, anchorDay } : rec;
  return { date, recurrence };
}

/** „Mo, 13.10.“ für Toasts */
export function formatShortDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
  if (!m) return isoDate || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
