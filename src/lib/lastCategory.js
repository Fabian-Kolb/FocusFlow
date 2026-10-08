// Merkt sich die zuletzt beim Anlegen gewählte Kategorie (pro Typ), damit sie beim nächsten Mal vorausgewählt ist.

const LAST_CATEGORY_KEYS = {
  reminder: 'focusflow_last_reminder_category',
  project: 'focusflow_last_project_category',
};

/** Zuletzt gewählte Kategorie lesen; nur IDs übernehmen, die es noch gibt */
export function readLastCategory(type, categories) {
  try {
    const id = localStorage.getItem(LAST_CATEGORY_KEYS[type]);
    if (id && categories?.some((c) => c.id === id)) return id;
  } catch {
    // Storage gesperrt – Standard nutzen
  }
  return 'allgemein';
}

export function writeLastCategory(type, id) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEYS[type], id);
  } catch {
    // Wahl gilt dann nur für diesen Vorgang
  }
}
