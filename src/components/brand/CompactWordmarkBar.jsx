import React from 'react';
import WordmarkSvg from './WordmarkSvg';
import { flatFade } from './useFloatingWordmark';

const RATIO = 400 / 165;

/**
 * Flacher Schriftzug oben in der Mitte der Startseite, ohne Leiste, nur die Wörter (gleiche Stelle und Größe wie die
 * kompakten 3D-Wörter aus useFloatingWordmark).
 * - Normal: übernimmt am Ende der Scroll-Bewegung von den 3D-Wörtern (die blenden aus), damit die kleinen Wörter scharf sind.
 * - Reduzierte Bewegung: Die 3D-Wörter scrollen mit, sobald sie aus dem Bild sind, blendet der flache Schriftzug ein.
 */
function CompactWordmarkBar({ progress = 0, reduced = false, th = 30, hidden = false }) {
  const tw = th * RATIO;
  const opacity = hidden ? 0 : reduced ? (progress >= 1 ? 1 : 0) : flatFade(progress);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-10 flex justify-center text-primary ${reduced ? 'transition-opacity duration-base ease-standard' : ''}`}
      style={{ paddingTop: 12, opacity, visibility: opacity > 0 ? 'visible' : 'hidden' }}
    >
      <div className="flex" style={{ height: th }}>
        <div style={{ height: th, width: tw }}><WordmarkSvg word="FOCUS" /></div>
        <div style={{ height: th, width: tw, marginLeft: -tw * 0.08 }}><WordmarkSvg word="FLOW" /></div>
      </div>
    </div>
  );
}

export default CompactWordmarkBar;
