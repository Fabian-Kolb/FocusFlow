import React from 'react';
import { WORDMARK, WORDMARK_FRAME } from './focusFlowWordmarkData';

// Punkte [x0, y0, x1, y1, ...] als geschlossener SVG-Pfad (SVG-Y zeigt nach unten)
function toPath(flat) {
  let d = '';
  for (let i = 0; i < flat.length; i += 2) {
    d += `${i === 0 ? 'M' : 'L'}${flat[i]} ${-flat[i + 1]}`;
  }
  return `${d}Z`;
}

/**
 * Flache 2D-Version eines Wortes der Wortmarke (FOCUS oder FLOW).
 * Dient als Platzhalter, solange Three.js lädt, und als Ersatz ohne WebGL.
 * Färbt sich über `currentColor`.
 */
function WordmarkSvg({ word, className = '' }) {
  const { letters } = WORDMARK[word];
  const w = WORDMARK_FRAME.width;
  const h = WORDMARK_FRAME.height;

  return (
    <svg
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      className={`w-full h-full ${className}`}
      fill="currentColor"
      aria-hidden="true"
    >
      {letters.map((letter, i) => (
        <path
          key={`${letter.char}-${i}`}
          fillRule="evenodd"
          d={letter.shapes.map((s) => [toPath(s.outer), ...s.holes.map(toPath)].join(' ')).join(' ')}
        />
      ))}
    </svg>
  );
}

export default WordmarkSvg;
