import React, { useEffect, useRef, useState } from 'react';
import { FOCUS, cx } from '../ds';
import FioCharacter from '../brand/fio/FioCharacter';

const MOOD_EVENT = 'focusflow:fio-mood';
const MOOD_MS = 2200;

/** Lässt Fio kurz ein Gefühl zeigen („happy“, „confused“, „thinking“ …). Wirkt nur, solange der Kopf im Bild ist. */
export function fioFeel(mood, ms = MOOD_MS) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MOOD_EVENT, { detail: { mood, ms } }));
}

/**
 * Fio in der Ecke (nur sein Kopf, ohne Kachel) über der unteren Leiste: erinnert an den Assistenten, zeigt Gefühle zu Ereignissen
 * (erledigt = freut sich, Fehler = verwirrt) und öffnet Fio mit dem Kontext der aktiven Umgebung.
 * Sitzt absolut in seinem Container (kein `fixed`), der Container endet über der Navigation.
 */
function FioLauncher({ onOpen, className }) {
  const [mood, setMood] = useState('idle');
  const timer = useRef(null);

  useEffect(() => {
    const onMood = (e) => {
      clearTimeout(timer.current);
      setMood(e.detail?.mood || 'idle');
      timer.current = setTimeout(() => setMood('idle'), e.detail?.ms || MOOD_MS);
    };
    window.addEventListener(MOOD_EVENT, onMood);
    return () => {
      window.removeEventListener(MOOD_EVENT, onMood);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Fio öffnen"
      title="Frag Fio"
      className={cx(
        'absolute bottom-3 right-3 z-nav h-16 w-16 rounded-lg',
        'transition-transform duration-fast hover:scale-105 active:scale-95 motion-reduce:transform-none',
        FOCUS,
        className,
      )}
    >
      <FioCharacter mood={mood} className="h-full w-full drop-shadow-md" label="" />
    </button>
  );
}

export default FioLauncher;
