import { getReminderDateInfo } from './reminderDates';
import { isRecurring, toIsoDate } from './recurrence';

/**
 * Aufgaben der Merkliste: Auswahl für Heute, „liegt zu lange“ und Schnelleingabe. Reine Funktionen, damit sie
 * ohne React testbar sind. Die Umgebung (Hochschule, Gym …) filtert schon der DataContext; hier geht es nur
 * um die Aufgaben der aktiven Umgebung.
 *
 * Datenmodell: Eine Aufgabe ist eine Erinnerung (Anzeigename „Merkliste“). Drei optionale Felder, sie stehen nur
 * auf dem Dokument, wenn sie gesetzt sind (Firestore-Regeln arbeiten mit `hasOnly`):
 *   kind:   'abgabe' | 'pruefung'   → Abgaben und Prüfungen mit Countdown
 *   quick:  true                     → „Schnell erledigt“, Kleinkram für zwischendurch
 *   parked: true                     → „Irgendwann“, bewusst auf später geschoben, nicht mehr auf Heute
 *
 * „Liegt zu lange“ (stale): offen, ohne Datum, nicht schnell, nicht geparkt, nicht wiederkehrend und seit
 * mindestens STALE_AFTER_DAYS angelegt. Dann fragt Fio nach („Noch wichtig?“).
 */

export const DEFAULT_CATEGORY_ID = 'allgemein';
export const STALE_AFTER_DAYS = 7;

export const TASK_KINDS = {
  abgabe: { label: 'Abgabe', icon: 'assignment' },
  pruefung: { label: 'Prüfung', icon: 'school' },
};
export const isTaskKind = (value) => Object.prototype.hasOwnProperty.call(TASK_KINDS, value);

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* ------------------------------------------------------------------ Zustand einer Aufgabe */

/** Offen = nicht gelöscht, nicht erledigt, nicht pausiert */
export const isOpenTask = (rem) => Boolean(rem) && !rem.deletedAt && rem.status !== 'ABGESCHLOSSEN' && !rem.isPaused;
/** Aktiv = offen und nicht auf „Irgendwann“ geschoben */
export const isActiveTask = (rem) => isOpenTask(rem) && rem.parked !== true;

export function ageInDays(rem, now = new Date()) {
  const created = Number(rem?.createdAt);
  if (!created) return 0;
  return Math.max(0, Math.floor((now.getTime() - created) / DAY_MS));
}

export function isStale(rem, now = new Date()) {
  return (
    isActiveTask(rem) &&
    rem.quick !== true &&
    !isRecurring(rem) &&
    !getReminderDateInfo(rem, now).hasDate &&
    ageInDays(rem, now) >= STALE_AFTER_DAYS
  );
}

/* ------------------------------------------------------------------ Texte zu Fristen */

/** „Überfällig“, „Heute“, „Morgen“, „in 5 Tagen“ */
export function countdownLabel(dayDiff) {
  if (dayDiff == null) return '';
  if (dayDiff < 0) return 'Überfällig';
  if (dayDiff === 0) return 'Heute';
  if (dayDiff === 1) return 'Morgen';
  return `in ${dayDiff} Tagen`;
}

/** Badge-Ton: Rot überfällig, Bernstein bald fällig, sonst neutral */
export function countdownTone(dayDiff) {
  if (dayDiff == null) return 'neutral';
  if (dayDiff < 0) return 'danger';
  if (dayDiff <= 3) return 'warning';
  return 'neutral';
}

/** „Mo., 2. Nov.“ */
export const formatDayShort = (date) => date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

/** „Heute“, „Morgen“, „Freitag“ (bis 6 Tage voraus), sonst „23. Okt.“ */
export function describeDay(date, now = new Date()) {
  const diff = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff > 1 && diff < 7) return date.toLocaleDateString('de-DE', { weekday: 'long' });
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

/** „Seit 9 Tagen offen“ */
export function ageLabel(rem, now = new Date()) {
  const age = ageInDays(rem, now);
  if (age <= 0) return 'Seit heute offen';
  if (age === 1) return 'Seit einem Tag offen';
  return `Seit ${age} Tagen offen`;
}

/** Alles, was eine Zeile über die Frist einer Aufgabe anzeigen will */
export function describeTask(rem, now = new Date()) {
  const info = getReminderDateInfo(rem, now);
  return {
    hasDate: info.hasDate,
    dayDiff: info.dayDiff,
    dueAt: info.dueAt,
    countdown: info.hasDate ? countdownLabel(info.dayDiff) : '',
    tone: info.hasDate ? countdownTone(info.dayDiff) : 'neutral',
    dateText: info.hasDate ? `${formatDayShort(info.dueAt)}${rem.time ? ` · ${rem.time}` : ''}` : '',
  };
}

/* ------------------------------------------------------------------ Auswahl für Heute */

const byCreatedAsc = (a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
const byCreatedDesc = (a, b) => byCreatedAsc(b, a);

/** Schnell erledigt: aktiv, markiert und ohne Frist (mit Frist stehen sie schon unter Fällig/Heute) */
export function getQuickTasks(reminders, now = new Date()) {
  return reminders
    .filter((r) => isActiveTask(r) && r.quick === true && !getReminderDateInfo(r, now).hasDate)
    .sort(byCreatedAsc);
}

/** Ohne Frist: aktiv, nicht schnell, noch nicht „zu lange“ (die fragt Fio) */
export function getUndatedTasks(reminders, now = new Date()) {
  return reminders
    .filter((r) => isActiveTask(r) && r.quick !== true && !getReminderDateInfo(r, now).hasDate && !isStale(r, now))
    .sort(byCreatedDesc);
}

/** Liegt zu lange: ältestes zuerst */
export function getStaleTasks(reminders, now = new Date()) {
  return reminders.filter((r) => isStale(r, now)).sort(byCreatedAsc);
}

/* ------------------------------------------------------------------ Schnelleingabe */

// Wortgrenzen mit Unicode, denn \b kennt „ü“ nicht („übermorgen“)
const WB_BEFORE = '(?<![\\p{L}\\p{N}])';
const WB_AFTER = '(?![\\p{L}\\p{N}])';
const word = (src) => `${WB_BEFORE}(?:${src})${WB_AFTER}`;
const rx = (src) => new RegExp(src, 'iu');

const PREP = '(?:(?:bis|am|ab|spätestens|zum)\\s+)?';
const DAYPART = '(?:\\s+(?:früh|morgens|mittags|vormittags?|nachmittags?|abends?|nachts?))?';
const WEEKDAYS = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };

const validDate = (year, month, day) => {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
};

/** Ein Datum aus „dd.mm.“ oder „dd.mm.yy(yy)“; ohne Jahr gilt das nächste Vorkommen ab heute */
function dateFromParts(dayStr, monthStr, yearStr, today) {
  const day = Number(dayStr);
  const month = Number(monthStr);
  if (yearStr) {
    const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
    return validDate(year, month, day);
  }
  const thisYear = validDate(today.getFullYear(), month, day);
  if (!thisYear) return null;
  return thisYear < today ? validDate(today.getFullYear() + 1, month, day) : thisYear;
}

function extractTime(text) {
  const rules = [
    rx(`(?:(?:um|gegen|ab)\\s+)?(?<![\\p{N}.:])(\\d{1,2}):(\\d{2})(?:\\s*uhr)?${WB_AFTER}`),
    rx(`(?:(?:um|gegen|ab)\\s+)?(?<![\\p{N}.:])(\\d{1,2})(?:\\.(\\d{2}))?\\s*uhr${WB_AFTER}`),
  ];
  for (const re of rules) {
    const m = re.exec(text);
    if (!m) continue;
    const hours = Number(m[1]);
    const minutes = Number(m[2] || 0);
    if (hours > 23 || minutes > 59) continue;
    return { time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, text: text.replace(m[0], ' ') };
  }
  return { time: '', text };
}

function extractDate(text, today) {
  const rules = [
    { re: rx(`${PREP}${word('übermorgen')}${DAYPART}`), date: () => addDays(today, 2) },
    { re: rx(`${PREP}${word('morgen')}${DAYPART}`), date: () => addDays(today, 1) },
    { re: rx(`${PREP}${word('heute')}${DAYPART}`), date: () => today },
    {
      re: rx(`${WB_BEFORE}in\\s+(einem|einer|\\d{1,3})\\s+(tag|tagen|woche|wochen)${WB_AFTER}`),
      date: (m) => {
        const n = /^\d/.test(m[1]) ? Number(m[1]) : 1;
        return addDays(today, /^woche/i.test(m[2]) ? 7 * n : n);
      },
    },
    {
      re: rx(`${WB_BEFORE}(?:nächste|kommende)\\s+woche${WB_AFTER}`),
      date: () => addDays(today, ((8 - today.getDay()) % 7) || 7), // nächster Montag
    },
    {
      re: rx(`${PREP}(?<![\\p{N}.,])(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4}|\\d{2})?(?![\\p{N}])`),
      date: (m) => dateFromParts(m[1], m[2], m[3], today),
    },
    {
      re: rx(`(?:bis|am|ab|spätestens|zum)\\s+(\\d{1,2})\\.(\\d{1,2})(?![\\p{N}.])`),
      date: (m) => dateFromParts(m[1], m[2], undefined, today),
    },
    {
      // Gleicher Wochentag wie heute meint nächste Woche („heute“ schreibt man aus)
      re: rx(`${PREP}(?:(?:nächste[nmrs]?|kommende[nmrs]?)\\s+)?${word(Object.keys(WEEKDAYS).join('|'))}`),
      date: (m) => {
        const name = /(sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)/i.exec(m[0])[1].toLowerCase();
        return addDays(today, ((WEEKDAYS[name] - today.getDay() + 7) % 7) || 7);
      },
    },
  ];
  for (const rule of rules) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const date = rule.date(m);
    if (!date) continue;
    return { date, text: text.replace(m[0], ' ') };
  }
  return { date: null, text };
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsWord = (haystack, needle) => rx(word(escapeRegExp(needle))).test(haystack);

/**
 * Welches Ding (Kategorie, Fach …) wird im Text genannt? Voller Name schlägt einzelnes Wort („Mathe 2“ vor „Mathe“).
 * Gleichstand zwischen verschiedenen Dingen gilt als nicht erkannt.
 * @param {string} text
 * @param {object[]} items
 * @param {(item: object) => string} getName
 * @param {(item: object) => boolean} [skip]
 */
export function matchByName(text, items = [], getName = (i) => i.name, skip = () => false) {
  const haystack = norm(text);
  let best = null;
  let tie = false;
  items.forEach((item) => {
    const raw = getName(item);
    if (skip(item) || !raw) return;
    const name = norm(raw);
    let score = 0;
    if (containsWord(haystack, name)) score = 100 + name.length;
    else {
      const tokens = name.split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t));
      const hit = tokens.filter((t) => containsWord(haystack, t));
      if (hit.length) score = 10 + Math.max(...hit.map((t) => t.length));
    }
    if (!score) return;
    if (!best || score > best.score) { best = { item, score }; tie = false; } else if (score === best.score) tie = true;
  });
  return best && !tie ? best.item : null;
}

/** Welche Kategorie wird im Text genannt? („Allgemein“ zählt nie als genannt.) */
export const matchCategory = (text, categories = []) => matchByName(text, categories, (c) => c.name, (c) => c.id === DEFAULT_CATEGORY_ID);

const KIND_PRUEFUNG = rx(word('klausur|prüfung|pruefung|test|exam'));
const KIND_ABGABE = rx(word('abgabe|abgeben|einreichen|hochladen|abschicken'));
const QUICK_RE = rx(`${word('schnell|kurz')}|${WB_BEFORE}(?:5|fünf)\\s*min(?:uten)?${WB_AFTER}`);

const tidyTitle = (text) => text
  .replace(/\s+/g, ' ')
  .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '')
  .replace(/\s+(?:bis|am|um|ab|zum|spätestens)$/i, '')
  .trim();

/**
 * Freitext → Aufgabe. Erkennt Frist („bis Freitag“, „morgen“, „in 3 Tagen“, „20.10.“), Uhrzeit („um 14 Uhr“),
 * Kategorie (Name im Text), „schnell“ und die Art (Klausur, Abgabe).
 *
 * @param {string} text
 * @param {{ categories?: object[], now?: Date }} [options]
 * @returns {{ title: string, categoryId: string, categoryName: string, categoryDetected: boolean, date: string, time: string,
 *             quick: boolean, kind: 'abgabe'|'pruefung'|null }}
 */
export function parseQuickEntry(text, { categories = [], now = new Date() } = {}) {
  const original = (text || '').trim();
  const today = startOfDay(now);

  let work = original;
  const timeResult = extractTime(work);
  work = timeResult.text;
  const dateResult = extractDate(work, today);
  work = dateResult.text;

  const quick = QUICK_RE.test(work);
  if (quick) work = work.replace(new RegExp(QUICK_RE.source, 'giu'), ' ');

  let date = dateResult.date ? toIsoDate(dateResult.date) : '';
  const time = timeResult.time;
  if (time && !date) date = toIsoDate(today); // Uhrzeit ohne Tag meint heute

  let kind = null;
  if (KIND_PRUEFUNG.test(original)) kind = 'pruefung';
  else if (date && KIND_ABGABE.test(original)) kind = 'abgabe';

  const detected = matchCategory(original, categories);
  const categoryId = detected?.id || DEFAULT_CATEGORY_ID;
  const categoryName = categories.find((c) => c.id === categoryId)?.name || 'Allgemein';

  let title = tidyTitle(work);
  if (!title) title = original;
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return { title, categoryId, categoryName, categoryDetected: Boolean(detected), date, time, quick, kind };
}

/** Eingabe → Daten für addReminder (optionale Felder nur, wenn sie gesetzt sind) */
export function entryToReminder(entry) {
  return {
    title: entry.title,
    date: entry.date || '',
    time: entry.time || '',
    categoryId: entry.categoryId,
    status: 'AKTIV',
    ...(entry.quick ? { quick: true } : {}),
    ...(entry.kind ? { kind: entry.kind } : {}),
  };
}
