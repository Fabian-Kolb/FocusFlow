// Haltepunkte für angedockte Sheets (Kalender-Tagessheet): zu, Vorschau, halb, voll.
// Reine Logik ohne React, damit sie getestet werden kann. Die Gesten selbst stehen in DaySheet.jsx.

export const SHEET_STATES = ['closed', 'peek', 'half', 'full'];

/** Pixelhöhen der Haltepunkte für einen Container der Höhe `containerHeight` */
export function getSnapHeights(containerHeight, { peek = 148, half = 0.55 } = {}) {
  const full = Math.max(0, Math.round(containerHeight));
  return {
    closed: 0,
    peek: Math.min(peek, Math.round(full * 0.4)),
    half: Math.round(full * half),
    full,
  };
}

/**
 * Wohin rastet das Sheet nach dem Loslassen ein?
 * `velocity` in Pixel pro Millisekunde, positiv = Sheet wird größer (nach oben gezogen).
 * Ein schneller Wisch zählt mit: Die Zielhöhe wird um den Schwung (ca. 180 ms) verlängert.
 */
export function resolveSnap(height, velocity, heights) {
  const projected = height + velocity * 180;
  let best = 'closed';
  let bestDistance = Infinity;
  for (const state of SHEET_STATES) {
    const distance = Math.abs(heights[state] - projected);
    if (distance < bestDistance) {
      best = state;
      bestDistance = distance;
    }
  }
  return best;
}

/** Nächst größerer bzw. kleinerer Haltepunkt (z. B. für Tastatur und Antippen des Griffs) */
export function stepSheetState(state, direction) {
  const i = SHEET_STATES.indexOf(state);
  const next = Math.max(0, Math.min(SHEET_STATES.length - 1, i + direction));
  return SHEET_STATES[next];
}
