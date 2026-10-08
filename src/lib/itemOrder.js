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
