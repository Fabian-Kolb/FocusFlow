import React, { useEffect, useRef } from 'react';
import { WORDMARK } from './focusFlowWordmarkData';
import { wordmarkPathData } from './wordmarkPaths';

// Alle Maße in Einheiten der Wortmarke, damit das Band genauso aussieht wie das Logo.
const WORD_W = WORDMARK.FOCUS.width;
const WORD_H = WORDMARK.FOCUS.height;

// Breite entsteht über Schriftgröße und Wiederholungen, nicht über Buchstabenabstand.
// Die Liste ist doppelt, damit die Schleife nahtlos ist und auch breite Bildschirme füllt.
const WORDS_PER_HALF = 7;

const PATHS = { FOCUS: wordmarkPathData('FOCUS'), FLOW: wordmarkPathData('FLOW') };

function Word({ word }) {
  return (
    <svg
      viewBox={`${-WORD_W / 2} ${-WORD_H / 2} ${WORD_W} ${WORD_H}`}
      style={{ aspectRatio: `${WORD_W} / ${WORD_H}` }}
      className="shrink-0 h-16 sm:h-24 xl:h-28 mr-10 sm:mr-14"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[word].map(({ key, d }) => (
        <path key={key} fillRule="evenodd" d={d} />
      ))}
    </svg>
  );
}

/**
 * Dekorativer Hintergrund der Login-Seite: oben eine Zeile FOCUS, unten eine Zeile FLOW,
 * flach und sehr leise, in gegenläufiger Richtung endlos bewegt. Beim Scrollen blendet das Band aus.
 * Rein dekorativ (aria-hidden), Farben über Tokens (`text-primary` + `opacity`), damit Light und Dark funktionieren.
 */
function LoginMarquee() {
  const ref = useRef(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      // Die Login-Seite ist kurz: Schon nach gut einem Drittel der Bildschirmhöhe ist das Band weg
      const limit = window.innerHeight * 0.35 || 1;
      const visible = 1 - Math.min(Math.max(window.scrollY / limit, 0), 1);
      el.style.opacity = visible;
      // Ausgeblendetes Band nicht weiter rendern
      el.style.display = visible < 0.01 ? 'none' : '';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const renderRow = (word, dir, duration, delay) => (
    <div className="overflow-hidden">
      <div
        className={`flex w-max will-change-transform motion-reduce:animate-none ${dir === 'ltr' ? 'animate-band-ltr' : 'animate-band-rtl'}`}
        style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
      >
        {Array.from({ length: WORDS_PER_HALF * 2 }, (_, i) => (
          <Word key={i} word={word} />
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none select-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Die Tokenfarben sind CSS-Variablen ohne Alpha-Kanal: Die Leisheit kommt deshalb über `opacity`, nicht über `text-…/[0.05]` */}
      <div className="absolute inset-0 text-primary opacity-[0.055] dark:opacity-[0.07]">
        <div className="absolute inset-x-0 top-0 pt-4">{renderRow('FOCUS', 'ltr', 90, 0)}</div>
        {/* Auf dem Handy liegt das untere Band hinter der Karte und wäre nicht zu sehen */}
        <div className="absolute inset-x-0 bottom-0 pb-4 max-sm:hidden">{renderRow('FLOW', 'rtl', 90, -30)}</div>
      </div>
    </div>
  );
}

export default LoginMarquee;
