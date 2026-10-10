// Gemeinsame Befehle für Befehlsleiste (Strg+K), Tastenkürzel und Kürzel-Übersicht.
// `keys`: Anzeige-Text des Kürzels; „g h“ = erst g, dann h drücken.

export const NAV_COMMANDS = [
  { screen: 'dashboard', label: 'Home', icon: 'home', keys: 'g h', key: 'h', keywords: 'start übersicht dashboard heute' },
  { screen: 'inbox', label: 'Gedanken', icon: 'lightbulb', keys: 'g i', key: 'i', keywords: 'inbox notizen ideen' },
  { screen: 'reminders', label: 'Erinnerungen', icon: 'notifications', keys: 'g e', key: 'e', keywords: 'aufgaben todo' },
  { screen: 'projects', label: 'Projekte', icon: 'folder', keys: 'g p', key: 'p' },
  { screen: 'board', label: 'Kanban Board', icon: 'view_kanban', keys: 'g b', key: 'b' },
  { screen: 'calendar', label: 'Kalender', icon: 'calendar_today', keys: 'g k', key: 'k', keywords: 'termine' },
  { screen: 'coach', label: 'Fio', icon: 'fio', keys: 'g f', key: 'f', keywords: 'ki coach chat assistent' },
  { screen: 'review', label: 'Wochenrückblick', icon: 'analytics', keys: 'g r', key: 'r', keywords: 'review woche' },
  { screen: 'trash', label: 'Papierkorb', icon: 'delete', keys: 'g t', key: 't', keywords: 'gelöscht wiederherstellen' },
];

export const ACTION_COMMANDS = [
  { action: 'new-thought', label: 'Neuer Gedanke', icon: 'lightbulb', keys: 'n', key: 'n', keywords: 'schnell erfassen notiz idee' },
  { action: 'new-reminder', label: 'Neue Erinnerung', icon: 'add_alert', keys: 'e', key: 'e', keywords: 'aufgabe todo' },
  { action: 'new-project', label: 'Neues Projekt', icon: 'create_new_folder', keys: 'p', key: 'p' },
  { action: 'settings', label: 'Einstellungen und Hilfe', icon: 'settings', keys: ',', key: ',', keywords: 'account profil konto' },
  { action: 'shortcuts', label: 'Tastenkürzel anzeigen', icon: 'keyboard', keys: '?', key: '?', keywords: 'hilfe shortcuts' },
];

/** Kürzel auf dem Kalender-Screen (PC); sie gelten nur dort und nicht beim Tippen */
export const CALENDAR_SHORTCUTS = [
  { label: 'Zurück und weiter', keys: '← →' },
  { label: 'Heute', keys: 't' },
  { label: 'Monat, Woche, Tag, Agenda', keys: 'm w d a' },
  { label: 'Tagesleiste ein oder aus', keys: 's' },
  { label: 'Neuer Termin', keys: 'c' },
];

export const PALETTE_KEYS = 'Strg K';

/** Tippt der Nutzer gerade in ein Feld? Dann keine Einzeltasten-Kürzel auslösen. */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
