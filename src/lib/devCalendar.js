// Lokale Beispieltermine für den Dev-Account (nur `npm run dev`, nie im Build).
//
// Das Dev-Konto hat keinen Google-Token. Damit der Kalender trotzdem getestet werden kann, liefert `calendarAPI`
// in diesem Fall die Termine von hier: Beispieltermine relativ zu „heute“ plus alles, was im Kalender angelegt,
// geändert oder gelöscht wird (gespeichert nur im Browser). `ffDev.reset()` setzt alles zurück.

import { isDevSessionActive } from './devAccount';

export const DEV_CALENDAR_KEY = 'focusflow_dev_calendar';

export const isDevCalendarActive = () => Boolean(import.meta.env.DEV && isDevSessionActive());

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOffset = (n) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
};
const at = (n, hour, minute = 0) => {
  const d = dayOffset(n);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).toISOString();
};

const timed = (id, n, h1, m1, h2, m2, summary, extra = {}) => ({
  id,
  summary,
  start: { dateTime: at(n, h1, m1) },
  end: { dateTime: at(n, h2, m2) },
  ...extra,
});
const allDay = (id, n, days, summary, extra = {}) => ({
  id,
  summary,
  start: { date: isoDate(dayOffset(n)) },
  end: { date: isoDate(dayOffset(n + days)) },
  ...extra,
});

/** Beispieltermine, immer relativ zu heute (stabile IDs, damit Änderungen zuordenbar bleiben) */
export function buildSeedEvents() {
  const events = [];

  // Werktags kurzes Standup, drei Wochen zurück bis sechs Wochen voraus
  for (let n = -21; n <= 42; n++) {
    const day = dayOffset(n).getDay();
    if (day === 0 || day === 6) continue;
    events.push(timed(`dev_standup_${n}`, n, 9, 30, 9, 45, 'Standup', { colorId: '8' }));
  }

  // Heute: überlappende Termine, Meet-Link, Ort
  events.push(
    timed('dev_today_review', 0, 10, 0, 11, 30, 'Projekt-Review', { colorId: '9', hangoutLink: 'https://meet.google.com/dev-demo-room', description: 'Stand der Umzugsplanung durchgehen.' }),
    timed('dev_today_call', 0, 10, 30, 11, 0, 'Kurzer Anruf Vermieter', { colorId: '7' }),
    timed('dev_today_design', 0, 11, 0, 12, 0, 'Design-Feedback', { colorId: '2' }),
    timed('dev_today_lunch', 0, 12, 30, 13, 30, 'Mittagessen mit Lena', { colorId: '6', location: 'Café Central, Bahnhofstraße 4' }),
    timed('dev_today_dentist', 0, 16, 30, 17, 15, 'Zahnarzt', { colorId: '4', location: 'Praxis Dr. Meier' }),
    timed('dev_today_sport', 0, 18, 30, 19, 30, 'Sport', { colorId: '10' }),
  );

  // Gestern, morgen und die nächsten Tage
  events.push(
    timed('dev_prev_doctor', -1, 14, 0, 15, 0, 'Hausarzt', { colorId: '4' }),
    timed('dev_tomorrow_workshop', 1, 13, 0, 16, 0, 'Workshop Kundenportal', { colorId: '9', hangoutLink: 'https://meet.google.com/dev-demo-workshop' }),
    timed('dev_tomorrow_sport', 1, 18, 30, 19, 30, 'Sport', { colorId: '10' }),
    timed('dev_d2_coffee', 2, 15, 0, 16, 0, 'Kaffee mit Jonas', { colorId: '6', location: 'Rösterei am Markt' }),
    timed('dev_d3_dinner', 3, 19, 0, 21, 30, 'Abendessen bei Oma', { colorId: '11', location: 'Gartenstraße 12' }),
    timed('dev_d4_planning', 4, 10, 0, 12, 0, 'Quartalsplanung', { colorId: '3' }),
    timed('dev_d5_sport', 5, 18, 30, 19, 30, 'Sport', { colorId: '10' }),
    timed('dev_d7_movers', 7, 8, 0, 12, 0, 'Umzugsfirma Besichtigung', { colorId: '6' }),
    timed('dev_d9_notar', 9, 14, 30, 15, 30, 'Notartermin Mietvertrag', { colorId: '4' }),
    timed('dev_d14_hair', 14, 11, 0, 12, 0, 'Friseur', { colorId: '5' }),
    timed('dev_d20_gp', 20, 16, 0, 17, 0, 'Jahresgespräch', { colorId: '9' }),
  );

  // Ganztägig, auch über mehrere Tage
  events.push(
    allDay('dev_allday_birthday', 3, 1, 'Geburtstag Mama', { colorId: '11' }),
    allDay('dev_allday_conf', 5, 3, 'Fachkonferenz', { colorId: '3', location: 'Messe Köln' }),
    allDay('dev_allday_move', 12, 2, 'Umzug nach Köln', { colorId: '6' }),
    allDay('dev_allday_holiday', 18, 1, 'Feiertag', { colorId: '8' }),
    allDay('dev_allday_vacation', 31, 7, 'Urlaub', { colorId: '2' }),
  );

  return events;
}

const emptyState = () => ({ created: [], updated: {}, deleted: [] });

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(DEV_CALENDAR_KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...emptyState(), ...raw };
  } catch {
    // beschädigter Eintrag: neu beginnen
  }
  return emptyState();
}

function writeState(state) {
  try {
    localStorage.setItem(DEV_CALENDAR_KEY, JSON.stringify(state));
  } catch {
    // ohne Speicher gelten Änderungen nur für diese Sitzung nicht – für Entwicklung unkritisch
  }
}

/** Alle Termine: Beispieltermine (mit Änderungen und Löschungen) plus selbst angelegte */
export function listDevEvents() {
  const state = readState();
  const base = buildSeedEvents()
    .filter((evt) => !state.deleted.includes(evt.id))
    .map((evt) => state.updated[evt.id] || evt);
  return [...base, ...state.created];
}

/** Termine eines Monats inkl. 7 Tage Rand, wie der echte Server sie liefert */
export function devFetchEvents(year, monthIndex) {
  const from = new Date(year, monthIndex, 1);
  from.setDate(from.getDate() - 7);
  const to = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  to.setDate(to.getDate() + 7);
  return listDevEvents().filter((evt) => {
    const start = new Date(evt.start.dateTime || `${evt.start.date}T00:00:00`);
    return start >= from && start <= to;
  });
}

/** Formulardaten (siehe EventEditForm) in die Form eines Google-Termins bringen */
function toGoogleEvent(eventData, id) {
  const base = { id, summary: eventData.title, description: eventData.description || '' };
  if (eventData.colorId) base.colorId = eventData.colorId;
  if (eventData.allDay) {
    return { ...base, start: { date: eventData.startDate }, end: { date: eventData.endDate } };
  }
  return { ...base, start: { dateTime: eventData.startTime }, end: { dateTime: eventData.endTime } };
}

export function devCreateEvent(eventData) {
  const state = readState();
  const evt = toGoogleEvent(eventData, `dev_new_${Date.now()}`);
  state.created.push(evt);
  writeState(state);
  return evt;
}

export function devUpdateEvent(eventId, eventData) {
  const state = readState();
  const index = state.created.findIndex((e) => e.id === eventId);
  // Felder, die das Formular nicht kennt (Ort, Meet-Link), bleiben erhalten
  const previous = (index >= 0 ? state.created[index] : listDevEvents().find((e) => e.id === eventId)) || {};
  const evt = { ...previous, ...toGoogleEvent(eventData, eventId) };
  if (index >= 0) state.created[index] = evt;
  else state.updated[eventId] = evt;
  writeState(state);
  return evt;
}

export function devDeleteEvent(eventId) {
  const state = readState();
  state.created = state.created.filter((e) => e.id !== eventId);
  delete state.updated[eventId];
  if (!state.deleted.includes(eventId)) state.deleted.push(eventId);
  writeState(state);
  return true;
}
