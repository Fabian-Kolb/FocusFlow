import React, { Suspense, lazy } from 'react';

// Three.js nur auf dem Login-Screen nachladen, nicht im Haupt-Bundle der App
const Wordmark3D = lazy(() => import('./Wordmark3D'));

/**
 * Ein Wort der FOCUS FLOW Wortmarke (FOCUS oder FLOW) als eigenständiges Objekt.
 * Beide Wörter sind exakt gleich breit (V4-A "Spoiler") und teilen sich denselben Bildausschnitt,
 * daher haben zwei Instanzen bei gleicher Breite auch die gleiche Schriftgröße.
 * `effects` (attention, attentionTargetRef, burst, pulse) gehen an die 3D-Szene.
 */
function WordmarkWord({ word, theme = 'light', className = '', ref, ...effects }) {
  return (
    <div ref={ref} className={`relative aspect-[400/165] text-primary dark:text-white ${className}`} aria-hidden="true">
      {/* Beim Laden bewusst leer (kein flaches Vorbild), damit der Einflug der 3D-Buchstaben nicht verpufft */}
      <Suspense fallback={null}>
        <Wordmark3D word={word} theme={theme} {...effects} />
      </Suspense>
    </div>
  );
}

export default WordmarkWord;
