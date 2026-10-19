import React, { useEffect, useRef, useState } from 'react';
import { FOCUS, IconButton, cx } from '../ds';
import FioCharacter from '../brand/fio/FioCharacter';

const MOOD_EVENT = 'focusflow:fio-mood';
const MOOD_MS = 2200;
const HELLO_KEY = 'focusflow_fio_hello';
const HELLO_DELAY = 1200;
const HELLO_MS = 8000;
const SWIPE_PX = 40;

const readSeen = () => {
  try { return sessionStorage.getItem(HELLO_KEY) === '1'; } catch { return false; }
};
const writeSeen = () => {
  try { sessionStorage.setItem(HELLO_KEY, '1'); } catch { /* ohne Speicher: Hinweis erscheint beim nächsten Besuch wieder */ }
};

/** Lässt Fio kurz ein Gefühl zeigen („happy“, „confused“, „thinking“ …). Wirkt nur, solange der Kopf im Bild ist. */
export function fioFeel(mood, ms = MOOD_MS) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MOOD_EVENT, { detail: { mood, ms } }));
}

/**
 * Fio in der Ecke der Startseite (nur sein Kopf, ohne Kachel): zeigt Gefühle zu Ereignissen (erledigt = freut sich,
 * Fehler = verwirrt) und öffnet Fio. Beim ersten Besuch pro Sitzung blendet eine kleine Sprechblase kurz ein, dass er da ist;
 * sie verschwindet von selbst und lässt sich antippen, schließen oder wegwischen.
 * Sitzt absolut in seinem Container (kein `fixed`), der Container endet über der Navigation.
 */
function FioLauncher({ onOpen, className }) {
  const [mood, setMood] = useState('idle');
  const [hello, setHello] = useState(false);
  const timer = useRef(null);
  const swipe = useRef(null);

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

  // Begrüßung: einmal pro Sitzung, nach kurzer Pause, verschwindet von selbst
  useEffect(() => {
    if (readSeen()) return undefined;
    let hide;
    const show = setTimeout(() => {
      writeSeen();
      setHello(true);
      hide = setTimeout(() => setHello(false), HELLO_MS);
    }, HELLO_DELAY);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);

  const onDown = (e) => { swipe.current = e.clientX; };
  const onUp = (e) => {
    if (swipe.current !== null && Math.abs(e.clientX - swipe.current) > SWIPE_PX) setHello(false);
    swipe.current = null;
  };

  return (
    <>
      {hello && (
        <div
          role="status"
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => { swipe.current = null; }}
          style={{ touchAction: 'pan-y' }}
          className="absolute bottom-[5.5rem] right-3 z-nav flex max-w-[16rem] items-start gap-2 rounded-lg border border-subtle bg-surface py-2 pl-3 pr-1 shadow-md toast-enter"
        >
          <button type="button" onClick={onOpen} className={cx('min-w-0 flex-1 rounded-sm py-1 text-left text-body text-primary', FOCUS)}>
            Hallo, ich bin Fio. Frag mich ruhig etwas.
          </button>
          <IconButton icon="close" label="Schließen" size="sm" variant="ghost" onClick={() => setHello(false)} />
        </div>
      )}
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
        <FioCharacter mood={mood} className="h-full w-full" label="" />
      </button>
    </>
  );
}

export default FioLauncher;
