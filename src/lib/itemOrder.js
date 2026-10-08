/**
 * Reihenfolge von Projekten/Erinnerungen innerhalb einer Kategorie.
 * `sortOrder` wird erst beim manuellen Verschieben vergeben; Elemente ohne Wert (z. B. frisch angelegt)
 * stehen vorn, bei Gleichstand bleibt die bisherige Reihenfolge erhalten (stabile Sortierung).
 */
export const sortByOrder = (list) =>
  list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => ((a.item.sortOrder ?? -1) - (b.item.sortOrder ?? -1)) || (a.index - b.index))
    .map(({ item }) => item);

/** Gruppiert Elemente nach Kategorie (fehlende Kategorie = "allgemein") und sortiert jede Gruppe */
export function groupByCategory(items, categories, { sortWithin = sortByOrder } = {}) {
  const map = {};
  categories.forEach((cat) => {
    map[cat.id] = sortWithin(items.filter((item) => (item.categoryId || 'allgemein') === cat.id));
  });
  return map;
}

// ── Sortier-Modi für die Kategorie-Ansicht ──────────────────────────────────

export const PROJECT_SORT_OPTIONS = [
  { value: 'custom', label: 'Benutzerdefiniert', icon: 'drag_indicator' },
  { value: 'newest', label: 'Neueste zuerst', icon: 'schedule' },
  { value: 'name', label: 'Name (A–Z)', icon: 'sort_by_alpha' },
  { value: 'deadline', label: 'Enddatum', icon: 'event' },
  { value: 'progress', label: 'Fortschritt', icon: 'trending_up' },
];

export const REMINDER_SORT_OPTIONS = [
  { value: 'custom', label: 'Benutzerdefiniert', icon: 'drag_indicator' },
  { value: 'due', label: 'Fälligkeit', icon: 'event' },
  { value: 'priority', label: 'Priorität', icon: 'priority_high' },
  { value: 'name', label: 'Name (A–Z)', icon: 'sort_by_alpha' },
  { value: 'newest', label: 'Neueste zuerst', icon: 'schedule' },
];

const byText = (a, b) => (a || '').localeCompare(b || '', 'de', { sensitivity: 'base' });
const PRIORITY_RANK = { hoch: 0, mittel: 1, niedrig: 2 };

/**
 * Sortiert eine Liste nach Modus. 'custom' = manuelle Reihenfolge (`sortOrder`), 'newest' = Reihenfolge der Daten
 * (neu angelegte Elemente stehen vorn). `compareDue` liefert die Fälligkeits-Sortierung für Erinnerungen.
 */
export function sortItems(list, mode, { compareDue } = {}) {
  switch (mode) {
    case 'name':
      return [...list].sort((a, b) => byText(a.title, b.title));
    case 'deadline':
      // Elemente ohne Enddatum ans Ende
      return [...list].sort((a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999'));
    case 'progress':
      return [...list].sort((a, b) => (b.progress || 0) - (a.progress || 0));
    case 'priority':
      return [...list].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1));
    case 'due':
      return compareDue ? [...list].sort(compareDue) : list;
    case 'newest':
      return list;
    case 'custom':
    default:
      return sortByOrder(list);
  }
}
