// Reine Kalender-Logik (ohne React): Konstanten, Farben, Layout überlappender Termine, Rasterberechnung, Datums-Helfer.
// Alle Zeiten werden in der lokalen Zeitzone des Geräts ausgewertet; Tests laufen in mehreren Zeitzonen (siehe scripts/run-tz-tests.js).

export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export const MONTH_NAMES_SHORT = [
  'Jan.', 'Feb.', 'Mär.', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'
];

export const MONTH_NAMES_HEADER = [
  'JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN',
  'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'
];

export const WEEKDAY_NAMES = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'
];

export const WEEKDAYS = [
  { short: 'MO.', isSunday: false },
  { short: 'DI.', isSunday: false },
  { short: 'MI.', isSunday: false },
  { short: 'DO.', isSunday: false },
  { short: 'FR.', isSunday: false },
  { short: 'SA.', isSunday: false },
  { short: 'SO.', isSunday: true },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MOBILE_PX_PER_MIN = 0.75; // 45px pro Stunde auf Mobile

// Harmonisierte Farbpalette für Termine nach den Screenshot-Vorgaben (Pastell-Hintergrund + solider linker Akzent)
export const EVENT_COLOR_MAP = {
  // 1: Lavender
  '1': { bg: '#ede9fe', border: '#8b5cf6', text: '#1e1b4b', accent: '#7c3aed' },
  // 2: Sage / Minzgrün (Screenshot 1 & 2)
  '2': { bg: '#dcfce7', border: '#10b981', text: '#064e3b', accent: '#059669' },
  // 3: Grape / Violett
  '3': { bg: '#f3e8ff', border: '#a855f7', text: '#3b0764', accent: '#9333ea' },
  // 4: Flamingo / Koralle
  '4': { bg: '#ffe4e6', border: '#f43f5e', text: '#4c0519', accent: '#e11d48' },
  // 5: Banana / Gelb
  '5': { bg: '#fef9c3', border: '#eab308', text: '#422006', accent: '#ca8a04' },
  // 6: Tangerine / Orange
  '6': { bg: '#ffedd5', border: '#f97316', text: '#431407', accent: '#ea580c' },
  // 7: Peacock / Eisblau (Screenshot 1 & 2)
  '7': { bg: '#e0f2fe', border: '#06b6d4', text: '#082f49', accent: '#0284c7' },
  // 8: Graphite / Grau
  '8': { bg: '#f1f5f9', border: '#64748b', text: '#0f172a', accent: '#475569' },
  // 9: Blueberry / Hellblau Standard (Screenshot 1 & 2)
  '9': { bg: '#e0f2fe', border: '#0284c7', text: '#0f172a', accent: '#0284c7' },
  // 10: Basil / Dunkelgrün
  '10': { bg: '#dcfce7', border: '#16a34a', text: '#052e16', accent: '#15803d' },
  // 11: Tomato / Rot
  '11': { bg: '#fee2e2', border: '#ef4444', text: '#450a0a', accent: '#dc2626' },
};

export function getEventColors(colorId) {
  if (colorId && EVENT_COLOR_MAP[colorId]) {
    return EVENT_COLOR_MAP[colorId];
  }
  // Standard-Himmelblau aus Screenshot 1 & 2
  return {
    bg: '#e0f2fe',
    border: '#0284c7',
    text: '#0f172a',
    accent: '#0284c7',
  };
}

// Hilfsfunktion: Berechnet Layout bei Überlappungen
export function getLayoutedEvents(timedEvents, selectedDate) {
  if (!timedEvents || timedEvents.length === 0) return [];

  const parsed = timedEvents.map((evt) => {
    const startD = new Date(evt.start.dateTime);
    const endD = new Date(evt.end?.dateTime || evt.start.dateTime);

    const dateStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const dateEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

    let startMinutes = startD.getHours() * 60 + startD.getMinutes();
    if (startD < dateStart) startMinutes = 0;

    let endMinutes = endD.getHours() * 60 + endD.getMinutes();
    if (endD > dateEnd || endD.getDate() !== selectedDate.getDate()) {
      endMinutes = 24 * 60;
    }
    if (endMinutes <= startMinutes) {
      endMinutes = Math.min(24 * 60, startMinutes + 30);
    }

    const duration = endMinutes - startMinutes;

    return {
      ...evt,
      startMinutes,
      endMinutes,
      duration,
      startFormatted: startD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      endFormatted: endD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  parsed.sort((a, b) => a.startMinutes - b.startMinutes || b.duration - a.duration);

  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -1;

  for (const evt of parsed) {
    if (currentCluster.length === 0) {
      currentCluster.push(evt);
      clusterEnd = evt.endMinutes;
    } else if (evt.startMinutes < clusterEnd) {
      currentCluster.push(evt);
      clusterEnd = Math.max(clusterEnd, evt.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [evt];
      clusterEnd = evt.endMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result = [];
  for (const cluster of clusters) {
    const colEndTimes = [];
    for (const evt of cluster) {
      let placedCol = -1;
      for (let i = 0; i < colEndTimes.length; i++) {
        if (colEndTimes[i] <= evt.startMinutes) {
          colEndTimes[i] = evt.endMinutes;
          placedCol = i;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEndTimes.length;
        colEndTimes.push(evt.endMinutes);
      }
      evt.col = placedCol;
    }
    const totalCols = colEndTimes.length;
    for (const evt of cluster) {
      evt.totalCols = totalCols;
      result.push(evt);
    }
  }

  return result;
}

// Hilfsfunktion: Berechnet alle Kalendertage für das 7-Spalten-Raster inkl. Padding
export function getCalendarDays(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  // In JS: 0 = Sonntag, 1 = Montag... Für Montag-basierten Wochenstart:
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const cells = [];

  // 1. Tage des Vormonats
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dateObj = new Date(year, monthIndex - 1, day);
    cells.push({
      day,
      dateObj,
      year: dateObj.getFullYear(),
      monthIndex: dateObj.getMonth(),
      isCurrentMonth: false,
      isPrevMonth: true,
      key: `prev-${dateObj.getFullYear()}-${dateObj.getMonth()}-${day}`
    });
  }

  // 2. Tage des aktuellen Monats
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, monthIndex, day);
    cells.push({
      day,
      dateObj,
      year,
      monthIndex,
      isCurrentMonth: true,
      key: `curr-${year}-${monthIndex}-${day}`
    });
  }

  // 3. Tage des Folgemonats
  const totalSlots = Math.ceil(cells.length / 7) * 7;
  const nextMonthDaysCount = totalSlots - cells.length;

  for (let day = 1; day <= nextMonthDaysCount; day++) {
    const dateObj = new Date(year, monthIndex + 1, day);
    cells.push({
      day,
      dateObj,
      year: dateObj.getFullYear(),
      monthIndex: dateObj.getMonth(),
      isCurrentMonth: false,
      isNextMonth: true,
      key: `next-${dateObj.getFullYear()}-${dateObj.getMonth()}-${day}`
    });
  }

  return cells;
}

export function parseEventDate(dateStr, isEnd) {
  if (!dateStr) return new Date();
  if (dateStr.includes('T')) return new Date(dateStr);
  const [y, m, d] = dateStr.split('-');
  const localDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  if (isEnd) return new Date(localDate.getTime() - 1);
  return localDate;
}

export function isEventOnDate(evt, dateObj) {
  if (!evt.start || (!evt.start.dateTime && !evt.start.date)) return false;
  const isAllDay = !!evt.start.date;
  const eventStart = parseEventDate(evt.start.dateTime || evt.start.date, false);
  const eventEnd = evt.end ? parseEventDate(evt.end.dateTime || evt.end.date, isAllDay) : eventStart;

  const checkStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const checkEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
  return eventStart <= checkEnd && eventEnd >= checkStart;
}

export function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const isAllDayA = !a.start?.dateTime && !!a.start?.date;
    const isAllDayB = !b.start?.dateTime && !!b.start?.date;
    if (isAllDayA && !isAllDayB) return -1;
    if (!isAllDayA && isAllDayB) return 1;
    const timeA = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0;
    const timeB = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0;
    return timeA - timeB;
  });
}

/** Ganztägiger Termin? (Google liefert dann `start.date` statt `start.dateTime`) */
export const isAllDayEvent = (evt) => !evt.start?.dateTime && !!evt.start?.date;

/** Startzeitpunkt eines Termins als lokales Date (Datums-Termine ohne UTC-Verschiebung) */
export function getEventStartDate(evt) {
  return parseEventDate(evt.start?.dateTime || evt.start?.date, false);
}

/** Uhrzeit im deutschen Format, z. B. "09:30" */
export const formatClock = (date) => date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Vorlage für einen neuen Termin an einem Tag (Standard: 09:00–10:00 Uhr lokal) */
export function defaultNewEvent(year, monthIndex, day, hour = 9) {
  return {
    start: { dateTime: new Date(year, monthIndex, day, hour, 0).toISOString() },
    end: { dateTime: new Date(year, monthIndex, day, hour + 1, 0).toISOString() },
  };
}

/** Ist `a` derselbe lokale Kalendertag wie `b` (Standard: heute)? */
export function isSameDay(a, b = new Date()) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

// ---------------------------------------------------------------------------
// Ansichten (Monat, Woche, Tag, Agenda): Datumsrechnung und Beschriftung
// ---------------------------------------------------------------------------

export const CALENDAR_VIEWS = ['month', 'week', 'day', 'agenda'];

export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Tag um `n` verschieben (lokal, sommerzeitsicher, weil über Kalenderfelder gerechnet wird) */
export const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Monat um `n` verschieben; der Tag wird auf die Länge des Zielmonats begrenzt (31. Jan. + 1 Monat = 28./29. Feb.) */
export function addMonthsClamped(date, n) {
  const target = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Montag der Woche, in der `date` liegt */
export const startOfWeek = (date) => addDays(date, -((date.getDay() + 6) % 7));

/** Die sieben Tage (Montag bis Sonntag) der Woche von `date` */
export function getWeekDays(date) {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const monthKeyOf = (date) => `${date.getFullYear()}-${date.getMonth()}`;

/** Um `step` Einheiten der Ansicht vor oder zurück (Monat: Monat, Woche: 7 Tage, Tag: 1 Tag, Agenda: 7 Tage) */
export function shiftByView(view, date, step) {
  if (view === 'month') return addMonthsClamped(date, step);
  if (view === 'week' || view === 'agenda') return addDays(date, 7 * step);
  return addDays(date, step);
}

/** Titel der Kopfzeile, z. B. "Oktober 2026", "5.–11. Oktober 2026" oder "Samstag, 10. Oktober 2026" */
export function formatViewTitle(view, date, { compact = false } = {}) {
  const month = (d) => (compact ? MONTH_NAMES_SHORT[d.getMonth()] : MONTH_NAMES[d.getMonth()]);
  if (view === 'day') {
    return compact
      ? `${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getFullYear()}`
      : `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()}. ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (view === 'week') {
    const days = getWeekDays(date);
    const first = days[0];
    const last = days[6];
    if (first.getMonth() === last.getMonth()) return `${first.getDate()}.–${last.getDate()}. ${month(last)} ${last.getFullYear()}`;
    if (first.getFullYear() === last.getFullYear()) return `${first.getDate()}. ${MONTH_NAMES_SHORT[first.getMonth()]} – ${last.getDate()}. ${MONTH_NAMES_SHORT[last.getMonth()]} ${last.getFullYear()}`;
    return `${first.getDate()}. ${MONTH_NAMES_SHORT[first.getMonth()]} ${first.getFullYear()} – ${last.getDate()}. ${MONTH_NAMES_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  }
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Zeitraster: Klick auf eine freie Stelle, Darstellung der Termine
// ---------------------------------------------------------------------------

export const SNAP_MINUTES = 30;

/** Auf einen Raster-Schritt abrunden (Standard 30 Minuten), im Bereich 00:00 bis 23:30 */
export function snapMinutes(minutes, step = SNAP_MINUTES) {
  return Math.max(0, Math.min(24 * 60 - step, Math.floor(minutes / step) * step));
}

/** Vorlage für einen neuen Termin an `date` ab `minutes` nach Mitternacht (Standard 09:00, eine Stunde) */
export function defaultNewEventAt(date, minutes = 9 * 60, durationMinutes = 60) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
}

/** "09:00 – 10:30" oder "Ganztägig" */
export function formatEventTimeRange(evt) {
  if (isAllDayEvent(evt)) return 'Ganztägig';
  const start = new Date(evt.start.dateTime);
  const end = evt.end?.dateTime ? new Date(evt.end.dateTime) : null;
  return end ? `${formatClock(start)} – ${formatClock(end)}` : formatClock(start);
}

/** Meet-Link und Ort eines Termins (für kleine Symbole und das Detail) */
export function getEventMeta(evt) {
  const meetLink = evt.hangoutLink || evt.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || '';
  return { meetLink, hasMeet: Boolean(meetLink), location: evt.location || '' };
}

/** Termine eines Tages aufgeteilt: ganztägig (sortiert) und zeitgebunden (mit Spaltenlayout bei Überlappung) */
export function splitDayEvents(events, date) {
  const allDay = sortEvents(events.filter(isAllDayEvent));
  const timed = events.filter((evt) => !evt.start?.date && !!evt.start?.dateTime);
  return { allDay, timed: getLayoutedEvents(timed, date) };
}

/** Tage mit Terminen ab `startDate` für die Agenda: [{ date, events }], leere Tage entfallen */
export function buildAgenda(startDate, dayCount, getEventsForDate) {
  const groups = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(startDate, i);
    const events = sortEvents(getEventsForDate(date));
    if (events.length > 0) groups.push({ date, events });
  }
  return groups;
}

/** Monate (year, month), die für `dayCount` Tage ab `startDate` geladen sein müssen */
export function monthsCovering(startDate, dayCount) {
  const last = addDays(startDate, Math.max(0, dayCount - 1));
  const months = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= last) {
    months.push([cursor.getFullYear(), cursor.getMonth()]);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}
