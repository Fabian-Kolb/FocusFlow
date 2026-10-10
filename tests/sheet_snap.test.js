import { describe, it, expect } from 'vitest';
import { getSnapHeights, resolveSnap, stepSheetState } from '../src/lib/sheetSnap';

// Haltepunkte des Kalender-Tagessheets (Vorschau, halb, voll, zu) und wohin es nach dem Loslassen einrastet
describe('sheetSnap', () => {
  const heights = getSnapHeights(700);

  it('berechnet die Haltepunkte aus der Containerhöhe', () => {
    expect(heights).toEqual({ closed: 0, peek: 148, half: 385, full: 700 });
    // Kleine Bereiche: die Vorschau ist höchstens 40 % hoch
    expect(getSnapHeights(300).peek).toBe(120);
  });

  it('rastet ohne Schwung am nächsten Haltepunkt ein', () => {
    expect(resolveSnap(150, 0, heights)).toBe('peek');
    expect(resolveSnap(300, 0, heights)).toBe('half');
    expect(resolveSnap(560, 0, heights)).toBe('full');
    expect(resolveSnap(40, 0, heights)).toBe('closed');
  });

  it('ein schneller Wisch zählt: nach oben geschleudert geht es weiter hinauf, nach unten bis zu', () => {
    expect(resolveSnap(220, 1.2, heights)).toBe('half'); // Schwung nach oben
    expect(resolveSnap(220, 3, heights)).toBe('full');
    expect(resolveSnap(150, -1, heights)).toBe('closed'); // Schwung nach unten aus der Vorschau
    expect(resolveSnap(385, -1.5, heights)).toBe('peek');
  });

  it('stepSheetState geht Schritt für Schritt und bleibt in den Grenzen', () => {
    expect(stepSheetState('peek', 1)).toBe('half');
    expect(stepSheetState('half', 1)).toBe('full');
    expect(stepSheetState('full', 1)).toBe('full');
    expect(stepSheetState('peek', -1)).toBe('closed');
    expect(stepSheetState('closed', -1)).toBe('closed');
  });
});
