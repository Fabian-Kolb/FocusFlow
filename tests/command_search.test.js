import { describe, it, expect } from 'vitest';
import { normalizeSearchText, scoreMatch, searchCommands } from '../src/lib/commandSearch';

describe('commandSearch', () => {
  it('ignoriert Groß-/Kleinschreibung und Umlaute', () => {
    expect(normalizeSearchText('Müll Straße')).toBe('mull strasse');
    expect(scoreMatch('mull', 'Müll rausbringen')).toBeGreaterThan(0);
    expect(scoreMatch('STRASSE', 'Straße fegen')).toBeGreaterThan(0);
  });

  it('bewertet Titelanfang höher als Treffer mitten im Wort', () => {
    expect(scoreMatch('rev', 'Review vorbereiten')).toBeGreaterThan(scoreMatch('rev', 'Wochen-Review'));
    expect(scoreMatch('rev', 'Wochen-Review')).toBeGreaterThan(scoreMatch('view', 'Review'));
  });

  it('findet mehrere Wörter in beliebiger Reihenfolge und Buchstabenfolgen', () => {
    expect(scoreMatch('projekt review', 'Review der Projekt-Ziele')).toBeGreaterThan(0);
    expect(scoreMatch('kldr', 'Kalender')).toBeGreaterThan(0);
    expect(scoreMatch('xyz', 'Kalender')).toBe(0);
  });

  it('sortiert nach Relevanz und begrenzt pro Gruppe', () => {
    const items = [
      { id: 'a', label: 'Wochenrückblick', group: 'nav' },
      { id: 'b', label: 'Rückblick schreiben', group: 'reminder' },
      { id: 'c', label: 'Kalender', group: 'nav' },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, label: `Rückruf ${i}`, group: 'reminder' })),
    ];
    const result = searchCommands('rück', items, { limitPerGroup: 3 });
    // Titelanfang (kürzere Titel zuerst) vor Treffer mitten im Wort
    expect(result[0].label.startsWith('Rück')).toBe(true);
    expect(result.at(-1).id).toBe('a');
    expect(result.filter((r) => r.group === 'reminder')).toHaveLength(3);
    expect(result.some((r) => r.id === 'c')).toBe(false);
  });

  it('nutzt Stichwörter als schwächeren Treffer', () => {
    const items = [{ id: 'trash', label: 'Papierkorb', keywords: 'gelöscht wiederherstellen', group: 'nav' }];
    expect(searchCommands('geloscht', items).map((r) => r.id)).toEqual(['trash']);
  });

  it('leere Suche liefert alles', () => {
    const items = [{ id: 'a', label: 'A', group: 'g' }, { id: 'b', label: 'B', group: 'g' }];
    expect(searchCommands('', items)).toHaveLength(2);
  });
});
