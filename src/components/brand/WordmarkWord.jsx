import React, { Suspense, lazy } from 'react';
import WordmarkSvg from './WordmarkSvg';

// Three.js nur auf dem Login-Screen nachladen, nicht im Haupt-Bundle der App
const Wordmark3D = lazy(() => import('./Wordmark3D'));

/**
 * Ein Wort der FOCUS FLOW Wortmarke (FOCUS oder FLOW) als eigenständiges Objekt.
 * Beide Wörter sind exakt gleich breit (V4-A "Spoiler") und teilen sich denselben Bildausschnitt,
 * daher haben zwei Instanzen bei gleicher Breite auch die gleiche Schriftgröße.
 */
function WordmarkWord({ word, theme = 'light', className = '' }) {
  return (
    <div className={`relative aspect-[400/165] text-primary dark:text-white ${className}`} aria-hidden="true">
      <Suspense fallback={<WordmarkSvg word={word} />}>
        <Wordmark3D word={word} theme={theme} />
      </Suspense>
    </div>
  );
}

export default WordmarkWord;
