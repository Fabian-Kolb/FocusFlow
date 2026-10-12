import React, { useEffect, useRef, useState } from 'react';
import WordmarkSvg from './WordmarkSvg';
import { STAGE_PAD_X, STAGE_PAD_Y } from './wordmarkStage';
import { peekBrandHandoff, clearBrandHandoff } from '../../lib/brandTransition';

// Ablauf nach dem Login, Zeiten in ms ab Start. Alles hier ist Feinabstimmung der Choreografie.
const T = {
  flatten: 180, // Standbild (3D) blendet in die flache Fassung (2D) über
  lineAt: 40, // Strich erscheint in der Mitte …
  lineGrow: 260, // … und wächst ein Stück
  swallowAt: 220, // Wörter schieben sich in den Strich
  swallow: 340,
  extendAt: 520, // Strich zieht sich über die ganze Fläche
  extend: 160,
  openAt: 660, // Hälften öffnen sich nach außen
  open: 520,
  enterAt: 820, // Seitenleiste (Desktop) bzw. Navigation (Handy) schiebt sich ein
};
const END = T.openAt + T.open + 60;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.76, 0, 0.24, 1)';
const EASE_SWALLOW = 'cubic-bezier(0.65, 0, 0.35, 1)';
const LINE_PX = 2;
const WORDS = ['FOCUS', 'FLOW'];

const center = (s) => ({ x: s.left + s.width / 2, y: s.top + s.height / 2 });

/** Seitenleiste: Logo, Einträge und Fußbereich schieben sich von links ein. Handy: untere Navigation von unten. */
function enterNavigation() {
  const anims = [];
  const visible = (el) => el && el.getClientRects().length > 0;
  const from = (el, dx, dy, delay) => {
    anims.push(el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }, { transform: 'translate(0, 0)', opacity: 1 }],
      { duration: 420, delay, easing: EASE_OUT, fill: 'backwards' },
    ));
  };
  const aside = document.getElementById('sidebar-navigation');
  if (visible(aside)) {
    const head = aside.firstElementChild;
    if (head) from(head, -28, 0, 0);
    aside.querySelectorAll('nav button').forEach((btn, i) => from(btn, -28, 0, 50 + i * 35));
    const foot = aside.querySelector(':scope > div.mt-auto');
    if (foot) from(foot, -28, 0, 50 + 7 * 35);
  }
  const bottom = document.querySelector('nav[aria-label="Mobile Navigation"]');
  if (visible(bottom)) from(bottom, 0, 24, 0);
  return anims;
}

/**
 * Nach dem Login: Die beiden 3D-Wörter (als Standbild, vorher gerade ausgerichtet) werden flach, der Bildschirm ist nur noch
 * eine Farbe. In der Mitte öffnet sich ein Strich, die Wörter schieben sich hinein und verschwinden. Dann zieht sich der
 * Strich über die Fläche und die beiden Hälften öffnen sich nach außen, darunter steht die App (Home). Danach schiebt sich
 * die Navigation ein.
 * Die Achse folgt dem Layout des Logins: stehen die Wörter nebeneinander (Desktop), ist der Strich senkrecht und die
 * Hälften öffnen sich links und rechts. Stehen sie untereinander (Handy), ist er waagerecht und sie öffnen sich oben und unten.
 * Ein Tipp überspringt. Läuft nur direkt nach einem Login, sonst passiert nichts.
 */
function LoginReveal() {
  // Übergabe und Geometrie einmal beim Start festhalten (Fenstergröße und Wortpositionen vom Login)
  const [start] = useState(() => {
    const handoff = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? null : peekBrandHandoff();
    if (!handoff) return null;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const a = center(handoff.FOCUS);
    const b = center(handoff.FLOW);
    const horizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y); // Wörter nebeneinander: Strich senkrecht
    const mid = horizontal ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
    const cross = horizontal ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    const extent = Math.max(...WORDS.map((w) => (horizontal ? handoff[w].height : handoff[w].width)));
    const length = Math.min(horizontal ? H : W, Math.max(96, extent * (horizontal ? 1.5 : 1.1)));
    return { handoff, W, H, geo: { horizontal, mid, cross, length } };
  });
  const [done, setDone] = useState(false);
  const rootRef = useRef(null);
  const skipRef = useRef(null);

  useEffect(() => {
    if (!start) {
      clearBrandHandoff();
      return undefined;
    }
    const { handoff, W, H, geo } = start;
    const root = rootRef.current;
    const q = (sel) => root.querySelector(sel);
    const { horizontal, mid, length } = geo;
    const axisScale = horizontal ? 'scaleY' : 'scaleX';
    const all = [];
    const run = (el, keyframes, opts) => {
      const a = el.animate(keyframes, { fill: 'both', ...opts });
      all.push(a);
      return a;
    };

    // 3D → 2D
    WORDS.forEach((word) => {
      const box = q(`[data-word="${word}"]`);
      const still = box.querySelector('[data-still]');
      const flat = box.querySelector('[data-flat]');
      if (still) {
        run(still, [{ opacity: 1 }, { opacity: 0 }], { duration: T.flatten, easing: 'linear' });
        run(flat, [{ opacity: 0 }, { opacity: 1 }], { duration: T.flatten, easing: 'linear' });
      }
    });

    // Strich öffnet sich in der Mitte und wird ein Stück größer, später über die ganze Fläche
    const line = q('[data-line]');
    run(line, [{ transform: `${axisScale}(0)` }, { transform: `${axisScale}(1)` }], { duration: T.lineGrow, delay: T.lineAt, easing: EASE_OUT });
    const full = (horizontal ? H : W) / length;
    run(line, [{ transform: `${axisScale}(1)` }, { transform: `${axisScale}(${full})` }], { duration: T.extend, delay: T.extendAt, easing: EASE_IN_OUT });

    // Wörter schieben sich in den Strich (der Strich schneidet sie ab)
    WORDS.forEach((word, i) => {
      const box = q(`[data-word="${word}"]`);
      const s = handoff[word];
      const dir = i === 0 ? 1 : -1;
      const gap = horizontal
        ? (i === 0 ? mid - s.left : s.left + s.width - mid)
        : (i === 0 ? mid - s.top : s.top + s.height - mid);
      const d = (gap + 2) * dir;
      run(box, [
        { transform: 'translate(0, 0)' },
        { transform: horizontal ? `translate(${d}px, 0)` : `translate(0, ${d}px)` },
      ], { duration: T.swallow, delay: T.swallowAt, easing: EASE_SWALLOW });
    });

    // Hälften öffnen sich nach außen. Die inneren Kanten übernehmen den Strich.
    const slide = (pct) => `translate(${horizontal ? pct : 0}%, ${horizontal ? 0 : pct}%)`;
    ['first', 'second'].forEach((key, i) => {
      const half = q(`[data-half="${key}"]`);
      run(half.firstElementChild, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: T.openAt, easing: 'linear' });
      run(half, [{ transform: slide(0) }, { transform: slide(i === 0 ? -100 : 100) }], { duration: T.open, delay: T.openAt, easing: EASE_IN_OUT });
    });
    run(line, [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: T.openAt, easing: 'linear' });

    const nav = [];
    const navTimer = setTimeout(() => nav.push(...enterNavigation()), T.enterAt);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearBrandHandoff();
      setDone(true);
    };
    skipRef.current = finish;
    const timer = setTimeout(finish, END);
    // Sicherheitsnetz, falls der Tab im Hintergrund steht
    const guard = setTimeout(finish, END + 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(guard);
      clearTimeout(navTimer);
      all.forEach((a) => a.cancel());
      nav.forEach((a) => a.cancel());
    };
  }, [start]);

  if (!start || done) return null;
  const { handoff, W, H, geo: { horizontal, mid, cross, length } } = start;
  const lineStyle = horizontal
    ? { left: mid - LINE_PX / 2, top: cross - length / 2, width: LINE_PX, height: length }
    : { top: mid - LINE_PX / 2, left: cross - length / 2, height: LINE_PX, width: length };
  // Hälften teilen die Fläche an der Strichposition
  const halves = horizontal
    ? [
      { key: 'first', style: { left: 0, top: 0, bottom: 0, width: mid }, edge: 'right-0 top-0 bottom-0 w-px' },
      { key: 'second', style: { right: 0, top: 0, bottom: 0, width: W - mid }, edge: 'left-0 top-0 bottom-0 w-px' },
    ]
    : [
      { key: 'first', style: { top: 0, left: 0, right: 0, height: mid }, edge: 'bottom-0 left-0 right-0 h-px' },
      { key: 'second', style: { bottom: 0, left: 0, right: 0, height: H - mid }, edge: 'top-0 left-0 right-0 h-px' },
    ];
  // Jedes Wort wird an der Strichposition auf seine Seite beschnitten
  const clip = (i) => {
    if (horizontal) return i === 0 ? `inset(0 ${W - mid}px 0 0)` : `inset(0 0 0 ${mid}px)`;
    return i === 0 ? `inset(0 0 ${H - mid}px 0)` : `inset(${mid}px 0 0 0)`;
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={() => skipRef.current?.()}
      className="fixed inset-0 z-palette overflow-hidden text-primary"
      aria-hidden="true"
    >
      {halves.map((h) => (
        <div key={h.key} data-half={h.key} className="absolute bg-canvas will-change-transform" style={h.style}>
          <span data-edge className={`absolute bg-current opacity-0 ${h.edge}`} />
        </div>
      ))}
      {WORDS.map((word, i) => {
        const s = handoff[word];
        return (
          <div key={word} className="absolute inset-0" style={{ clipPath: clip(i) }}>
            <div
              data-word={word}
              className="absolute will-change-transform"
              style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
            >
              <div data-flat className="absolute inset-0" style={{ opacity: s.image ? 0 : 1 }}>
                <WordmarkSvg word={word} />
              </div>
              {s.image && (
                <img
                  data-still
                  src={s.image}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none"
                  style={{
                    left: `${-STAGE_PAD_X * 100}%`,
                    top: `${-STAGE_PAD_Y * 100}%`,
                    width: `${(1 + 2 * STAGE_PAD_X) * 100}%`,
                    height: `${(1 + 2 * STAGE_PAD_Y) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
      <span data-line className="absolute bg-current" style={{ ...lineStyle, transform: horizontal ? 'scaleY(0)' : 'scaleX(0)' }} />
    </div>
  );
}

export default LoginReveal;
