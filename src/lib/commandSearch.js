/**
 * Suche für die Befehlsleiste (Strg+K).
 * Bewertet Treffer: Anfang des Titels > Wortanfang > irgendwo enthalten > Buchstabenfolge (fuzzy).
 * Groß-/Kleinschreibung und Umlaute (ä → a, ß → ss) werden ignoriert.
 */

export function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function isSubsequence(needle, haystack) {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

/** @returns {number} 0 = kein Treffer, höher = besser */
export function scoreMatch(query, text) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(text);
  if (!q) return 1;
  if (!t) return 0;
  if (t.startsWith(q)) return 100 - Math.min(t.length - q.length, 50) * 0.1;
  const idx = t.indexOf(q);
  if (idx > 0 && /[\s\-_/.(,]/.test(t[idx - 1])) return 70;
  if (idx > 0) return 50;
  // Alle Wörter der Suche irgendwo enthalten („projekt review“ findet „Review der Projekt-Ziele“)
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => t.includes(w))) return 40;
  if (q.length >= 2 && isSubsequence(q.replace(/\s+/g, ''), t)) return 10;
  return 0;
}

/**
 * @param {string} query
 * @param {Array<{ id: string, label: string, keywords?: string, group: string }>} items
 * @param {{ limitPerGroup?: number }} [options]
 */
export function searchCommands(query, items, { limitPerGroup = 6 } = {}) {
  const scored = items
    .map((item) => {
      const main = scoreMatch(query, item.label);
      const extra = item.keywords ? scoreMatch(query, item.keywords) * 0.6 : 0;
      return { item, score: Math.max(main, extra) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const perGroup = {};
  return scored
    .filter(({ item }) => {
      perGroup[item.group] = (perGroup[item.group] || 0) + 1;
      return perGroup[item.group] <= limitPerGroup;
    })
    .map((r) => r.item);
}
