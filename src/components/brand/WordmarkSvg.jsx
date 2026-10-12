import React from 'react';
import { WORDMARK_FRAME } from './focusFlowWordmarkData';
import { wordmarkPathData } from './wordmarkPaths';

/**
 * Flache 2D-Version eines Wortes der Wortmarke (FOCUS oder FLOW).
 * Dient als Platzhalter, solange Three.js lädt, und als Ersatz ohne WebGL.
 * Färbt sich über `currentColor`. `onlyFirst`: nur der erste Buchstabe (das F), `only`: nur der Buchstabe mit diesem Index, jeweils im Rahmen des ganzen Wortes.
 */
function WordmarkSvg({ word, className = '', onlyFirst = false, only = null }) {
  const w = WORDMARK_FRAME.width;
  const h = WORDMARK_FRAME.height;

  return (
    <svg
      viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
      className={`w-full h-full ${className}`}
      fill="currentColor"
      aria-hidden="true"
    >
      {wordmarkPathData(word).filter((_, i) => (only !== null ? i === only : !onlyFirst || i === 0)).map(({ key, d }) => (
        <path key={key} fillRule="evenodd" d={d} />
      ))}
    </svg>
  );
}

export default WordmarkSvg;
