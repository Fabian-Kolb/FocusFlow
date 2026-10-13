import React from 'react';
import WordmarkSvg from './WordmarkSvg';

/**
 * Nur bei reduzierter Bewegung: Die 3D-Wörter gleiten dann nicht nach oben, sondern scrollen mit. Sobald sie aus dem
 * Bild sind, blendet oben in der Mitte der flache Schriftzug ein (ohne Leiste, nur die Wörter).
 */
function CompactWordmarkBar({ progress = 0, reduced = false, hidden = false }) {
  if (!reduced) return null;
  const opacity = hidden ? 0 : progress >= 1 ? 1 : 0;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-10 flex justify-center text-primary transition-opacity duration-base ease-standard"
      style={{ paddingTop: 12, opacity }}
    >
      <div className="flex" style={{ height: 30 }}>
        <div style={{ height: 30, width: 30 * (400 / 165) }}><WordmarkSvg word="FOCUS" /></div>
        <div style={{ height: 30, width: 30 * (400 / 165), marginLeft: -6 }}><WordmarkSvg word="FLOW" /></div>
      </div>
    </div>
  );
}

export default CompactWordmarkBar;
