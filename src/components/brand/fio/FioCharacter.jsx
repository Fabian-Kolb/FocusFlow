import React, { useEffect, useRef } from 'react';
import { createFioRig } from './fioRig';

/**
 * Fio als lebendige Figur (Augen folgen dem Zeiger, blinzeln, Gefühle über Lider und Brauen).
 * `FioMark` (ds) zeigt denselben Kopf als Zeichen für KI-Stellen (Knöpfe, Menüs, Zeilen).
 *
 * - `mood`: idle | listening | thinking | talking | happy | surprised | scared | sleepy | confused
 * - `hands`, `feet`: schwebende Hände und Füße (für große Auftritte)
 * - `brows`: 'emotion' (nur bei Gefühlen, Standard) | 'always' | 'off'
 * - `gap`: Farbe des Hintergrunds hinter Fio (Aussparung um die Hände), z. B. 'var(--bg-subtle)'
 * - `controlRef`: bekommt die Steuerung (boop, land, walkDir, held, swing), siehe fioRig.js
 * Die Größe kommt vom Container (`className`), die Figur füllt ihn quadratisch.
 */
function FioCharacter({ mood = 'idle', hands = false, feet = false, brows = 'emotion', gap = 'var(--bg-surface)', label = 'Fio', className = '', style, controlRef }) {
  const hostRef = useRef(null);
  const rigRef = useRef(null);

  useEffect(() => {
    const rig = createFioRig(hostRef.current, { hands, feet, brows, gap });
    rigRef.current = rig;
    if (controlRef) controlRef.current = rig;
    return () => {
      rig.destroy();
      rigRef.current = null;
      if (controlRef) controlRef.current = null;
    };
  }, [hands, feet, brows, gap, controlRef]);

  useEffect(() => {
    rigRef.current?.setMood(mood);
  }, [mood, hands, feet, brows, gap]);

  return <div ref={hostRef} className={className} style={style} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} />;
}

export default FioCharacter;
