import { WORDMARK } from './focusFlowWordmarkData';

// Punkte [x0, y0, x1, y1, ...] als geschlossener SVG-Pfad (SVG-Y zeigt nach unten)
export function toPath(flat) {
  let d = '';
  for (let i = 0; i < flat.length; i += 2) {
    d += `${i === 0 ? 'M' : 'L'}${flat[i]} ${-flat[i + 1]}`;
  }
  return `${d}Z`;
}

/**
 * Pfad-Daten eines Wortes (FOCUS oder FLOW), pro Buchstabe ein `d`-String.
 * Gemeinsam genutzt von der Wortmarke (WordmarkSvg) und dem Login-Hintergrundband (LoginMarquee).
 */
export function wordmarkPathData(word) {
  const { letters } = WORDMARK[word];
  return letters.map((letter, i) => ({
    key: `${letter.char}-${i}`,
    d: letter.shapes.map((s) => [toPath(s.outer), ...s.holes.map(toPath)].join(' ')).join(' '),
  }));
}

// Das F des Wortes FOCUS als eigenständiges Zeichen: Baustein der FF-Bildmarke (Sidebar, App-Icon)
const FOCUS_F = WORDMARK.FOCUS.letters[0];
const fPoints = FOCUS_F.shapes.flatMap((s) => s.outer);
const fxs = fPoints.filter((_, i) => i % 2 === 0);
const fys = fPoints.filter((_, i) => i % 2 === 1);
export const F_GLYPH = {
  d: wordmarkPathData('FOCUS')[0].d,
  // SVG-Koordinaten (Y nach unten), gleiche Mitte wie die Wortmarke
  x0: Math.min(...fxs),
  x1: Math.max(...fxs),
  y0: -Math.max(...fys),
  y1: -Math.min(...fys),
};
// Das zweite F sitzt so weit rechts, dass sich die Balken des ersten und der Stamm des zweiten berühren (Ligatur)
export const FF_OFFSET = 62;
