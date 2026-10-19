import { buildAgenda } from './dashboardAgenda';

/**
 * Umgebungen: Allgemein, Hochschule, Arbeit, Gym. In einer Umgebung verhält sich die ganze App anders
 * (Menü, Inhalte, Funktionen). Reine Definitionen und Funktionen, ohne React, damit sie testbar sind.
 *
 * Regeln:
 *  - Alles gehört zu genau einer Umgebung. Fehlt `environmentId`, gilt Allgemein (keine Migration nötig).
 *  - `environmentId` wird nur gesetzt, wenn die Umgebung nicht Allgemein ist (Firestore-Regeln: hasOnly,
 *    erlaubt sind 'hochschule' | 'arbeit' | 'gym'); beim Verschieben nach Allgemein wird der Schlüssel entfernt.
 *  - Allgemein ist immer eingeschaltet und die App wie bisher.
 *
 * Plan und Stand: docs/Wissen/13_Umgebungen/01-Umgebungen-Plan-und-Stand.md
 */

export const DEFAULT_ENVIRONMENT_ID = 'allgemein';
export const ENVIRONMENT_IDS = ['allgemein', 'hochschule', 'arbeit', 'gym'];

/** Alle Bildschirme, die ein Menü zeigen kann (Id = Screen-Id in App.jsx). `screens` = Ids, bei denen der Eintrag aktiv aussieht. */
const NAV = {
  dashboard: { id: 'dashboard', label: 'Home', icon: 'home', screens: ['dashboard'] },
  inbox: { id: 'inbox', label: 'Gedanken', icon: 'lightbulb', screens: ['inbox'] },
  reminders: { id: 'reminders', label: 'Merkliste', icon: 'checklist', screens: ['reminders', 'reminder-detail'] },
  projects: { id: 'projects', label: 'Projekte', icon: 'folder', screens: ['projects', 'project-detail'] },
  board: { id: 'board', label: 'Kanban Board', icon: 'view_kanban', screens: ['board'] },
  calendar: { id: 'calendar', label: 'Kalender', icon: 'calendar_today', screens: ['calendar'] },
  coach: { id: 'coach', label: 'Fio', icon: 'fio', screens: ['coach'] },
  review: { id: 'review', label: 'Wochenrückblick', icon: 'analytics', screens: ['review'] },
  trash: { id: 'trash', label: 'Papierkorb', icon: 'delete', screens: ['trash'] },
  'gym-log': { id: 'gym-log', label: 'Training', icon: 'fitness_center', screens: ['gym-log'] },
  'gym-history': { id: 'gym-history', label: 'Verlauf', icon: 'history', screens: ['gym-history'] },
  'gym-progress': { id: 'gym-progress', label: 'Fortschritt', icon: 'show_chart', screens: ['gym-progress'] },
  'gym-body': { id: 'gym-body', label: 'Körper', icon: 'monitor_weight', screens: ['gym-body'] },
};

/**
 * Vorlagen. `tabs` = die vier Plätze der unteren Leiste am Handy (Mitte = Hub), `hub` = Kacheln hinter dem
 * mittleren Knopf, `sidebar` = Reihenfolge der Seitenleiste am Desktop, `labels` überschreibt Beschriftungen.
 * `ready: false` blendet die Umgebung aus, bis ihre Bildschirme existieren.
 */
export const ENVIRONMENTS = {
  allgemein: {
    id: 'allgemein',
    label: 'Allgemein',
    icon: 'wb_sunny',
    description: 'Alltag und spontane Einfälle',
    ready: true,
    tabs: ['dashboard', 'projects', 'reminders', 'calendar'],
    hub: ['inbox', 'board', 'review', 'trash'],
    sidebar: ['dashboard', 'inbox', 'reminders', 'projects', 'board', 'calendar', 'coach', 'review', 'trash'],
    labels: {},
  },
  hochschule: {
    id: 'hochschule',
    label: 'Hochschule',
    icon: 'school',
    description: 'Fächer und Abgaben',
    ready: true,
    tabs: ['dashboard', 'projects', 'reminders', 'calendar'],
    hub: ['inbox', 'board', 'trash'],
    sidebar: ['dashboard', 'projects', 'reminders', 'inbox', 'board', 'calendar', 'coach', 'trash'],
    labels: { projects: 'Fächer' },
  },
  arbeit: {
    id: 'arbeit',
    label: 'Arbeit',
    icon: 'work',
    description: 'Projekte, Aufgaben und Meetings',
    ready: true,
    tabs: ['dashboard', 'projects', 'reminders', 'calendar'],
    hub: ['inbox', 'board', 'trash'],
    sidebar: ['dashboard', 'projects', 'reminders', 'inbox', 'board', 'calendar', 'coach', 'trash'],
    labels: {},
  },
  gym: {
    id: 'gym',
    label: 'Gym',
    icon: 'fitness_center',
    description: 'Training und Fortschritt',
    ready: true,
    tabs: ['dashboard', 'gym-log', 'gym-history', 'gym-progress'],
    hub: ['gym-body', 'calendar'],
    sidebar: ['dashboard', 'gym-log', 'gym-history', 'gym-progress', 'gym-body', 'calendar', 'coach'],
    labels: {},
  },
};

export const isEnvironmentId = (id) => ENVIRONMENT_IDS.includes(id);
export const getEnvironment = (id) => ENVIRONMENTS[isEnvironmentId(id) ? id : DEFAULT_ENVIRONMENT_ID];

/** Menüeinträge einer Umgebung mit ihren Beschriftungen */
export function getEnvironmentNav(id) {
  const env = getEnvironment(id);
  const item = (navId) => ({ ...NAV[navId], label: env.labels[navId] || NAV[navId].label });
  return {
    tabs: env.tabs.map(item),
    hub: env.hub.map(item),
    sidebar: env.sidebar.map(item),
  };
}

/** Name eines Bildschirms in der Umgebung (für Titel), z. B. „Fächer“ statt „Projekte“ */
export const screenLabel = (envId, screenId) => {
  const env = getEnvironment(envId);
  return env.labels[screenId] || NAV[screenId]?.label || null;
};

/* ------------------------------------------------------------------ Zugehörigkeit */

/** Umgebung eines Dings: fehlt das Feld oder ist es unbekannt, gilt Allgemein */
export const environmentOf = (item) => (isEnvironmentId(item?.environmentId) ? item.environmentId : DEFAULT_ENVIRONMENT_ID);

export const inEnvironment = (item, envId) => environmentOf(item) === (isEnvironmentId(envId) ? envId : DEFAULT_ENVIRONMENT_ID);

/** Feld für neue Dinge: nur gesetzt, wenn die Umgebung nicht Allgemein ist */
export const environmentField = (envId) => (
  isEnvironmentId(envId) && envId !== DEFAULT_ENVIRONMENT_ID ? { environmentId: envId } : {}
);

/** Kopie in einer anderen Umgebung; nach Allgemein wird der Schlüssel entfernt */
export function withEnvironment(item, envId) {
  const { environmentId: _old, ...rest } = item;
  return { ...rest, ...environmentField(envId) };
}

/* ------------------------------------------------------------------ Eingeschaltete Umgebungen */

/** Standard: alle fertigen Umgebungen. Allgemein ist immer dabei, Unbekanntes und Unfertiges fliegt raus. */
export function normalizeEnabled(list) {
  const ready = ENVIRONMENT_IDS.filter((id) => ENVIRONMENTS[id].ready);
  if (!Array.isArray(list)) return ready;
  return ready.filter((id) => id === DEFAULT_ENVIRONMENT_ID || list.includes(id));
}

/** Aktive Umgebung muss eingeschaltet sein, sonst Allgemein */
export const resolveActive = (activeId, enabledIds) => (enabledIds.includes(activeId) ? activeId : DEFAULT_ENVIRONMENT_ID);

/* ------------------------------------------------------------------ Lage je Umgebung */

/**
 * Was ist in einer Umgebung heute dran? Überfälliges und Heutiges aus Merkliste und Projekt-Aufgaben
 * (Termine gehören keiner Umgebung und zählen nicht mit).
 * @returns {{ due: number, overdue: number }}
 */
export function summarizeEnvironment(envId, { reminders = [], projects = [], now = new Date() } = {}) {
  const agenda = buildAgenda({
    reminders: reminders.filter((r) => inEnvironment(r, envId)),
    projects: projects.filter((p) => inEnvironment(p, envId)),
    now,
    days: 1,
  });
  const today = agenda.days[0].items.filter((i) => i.kind !== 'event' && !i.completed).length;
  return { due: agenda.overdue.length + today, overdue: agenda.overdue.length };
}

/** „Anderswo heute“: Umgebungen außer der aktiven, in denen etwas fällig ist */
export function summarizeElsewhere(activeId, enabledIds, data) {
  return enabledIds
    .filter((id) => id !== activeId)
    .map((id) => ({ id, ...summarizeEnvironment(id, data) }))
    .filter((e) => e.due > 0);
}

/**
 * Kurze Beschreibung der aktiven Umgebung für Fio (Systemanweisung): welche Umgebung, worum es geht und
 * dass die Daten darauf begrenzt sind. Gym-Daten kommen aus `gymSummary` (siehe buildGymSummary in gym.js).
 */
export function describeEnvironmentForFio(envId, gymSummary = null) {
  const env = ENVIRONMENTS[envId] || ENVIRONMENTS.allgemein;
  const info = {
    umgebung: env.label,
    worumEsGeht: env.description,
    hinweis: envId === 'allgemein'
      ? 'Die Daten gehören zur Umgebung Allgemein. Hochschule, Arbeit und Gym sind eigene Umgebungen.'
      : 'Die Daten unten gehören nur zu dieser Umgebung. Andere Umgebungen siehst du hier nicht.',
  };
  if (envId === 'gym' && gymSummary) info.training = gymSummary;
  return info;
}
