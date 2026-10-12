import React, { useEffect, useRef, useState } from 'react';
import WordmarkSvg from './WordmarkSvg';
import { WORDMARK } from './focusFlowWordmarkData';
import { STAGE_PAD_X, STAGE_PAD_Y } from './wordmarkStage';
import { peekBrandHandoff, clearBrandHandoff } from '../../lib/brandTransition';
import { readRevealSpeed, revealFactor } from '../../lib/revealSpeed';

// Ablauf nach dem Login, Zeiten in ms ab Start bei Stufe „Mittel“. Die Stufe aus den Einstellungen streckt alles
// (`revealFactor`). Alles hier ist Feinabstimmung der Choreografie.
const BASE = {
  lineAt: 40, // Strich erscheint in der Mitte …
  lineGrow: 240, // … und wächst ein Stück
  trainAt: 120, // erster Buchstabe wird in den Strich gezogen
  trainAccel: 0.0113, // px pro ms²: jeder Buchstabe fährt an und wird bis zum Strich immer schneller
  trainStagger: 26, // Versatz von Buchstabe zu Buchstabe: wie Waggons, die nacheinander anziehen
  centerMin: 220, // Wörter gleiten in die Bildschirmmitte (nur wenn sie nicht schon dort stehen) …
  centerPerPx: 0.4, // … je weiter, desto länger
  centerMax: 420,
  extend: 140, // Strich zieht sich über die ganze Fläche, endet genau wenn der Zug durch ist
  open: 480, // Hälften öffnen sich nach außen, ohne Pause nach dem Zug
  featherRatio: 0.11, // weicher Rand am Strich, Anteil der Wörterhöhe (kein ganz harter Schnitt)
  glowRamp: 160, // Buchstaben leuchten beim Anfahren blau auf
  tail: 60,
  enterFrom: 0.45, // Seitenleiste schiebt sich ein, sobald die Hälfte sie freigibt (Anteil der Öffnungszeit)
  enterFromMobile: 0.6,
  enter: 520,
  enterStagger: 45,
};
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.76, 0, 0.24, 1)';
const EASE_EXTEND = 'cubic-bezier(0.4, 0, 0.9, 0.6)'; // schließt sich dem Tempo des Zuges an
const EASE_OPEN = 'cubic-bezier(0.25, 0.45, 0.1, 1)'; // startet mit Schwung, landet weich
const EASE_GLOW = 'cubic-bezier(0.2, 0, 0.3, 1)';
const EASE_TRAIN = 'cubic-bezier(0.11, 0, 0.5, 0)'; // gleichmäßige Beschleunigung (easeInQuad)
const LINE_PX = 2;
const WORDS = ['FOCUS', 'FLOW'];

const center = (s) => ({ x: s.left + s.width / 2, y: s.top + s.height / 2 });

/** Seitenleiste: Logo und Einträge schieben sich vom linken Bildschirmrand herein. Handy: untere Navigation von unten. */
function enterNavigation(t) {
  const anims = [];
  const visible = (el) => el && el.getClientRects().length > 0;
  const from = (el, dx, dy, delay, duration) => {
    anims.push(el.animate(
      [{ transform: `translate(${dx}, ${dy})`, opacity: 0 }, { transform: 'translate(0, 0)', opacity: 1 }],
      { duration, delay, easing: EASE_OUT, fill: 'backwards' },
    ));
  };
  const aside = document.getElementById('sidebar-navigation');
  if (visible(aside)) {
    const head = aside.firstElementChild; // enthält das Logo FOCUS FLOW
    if (head) from(head, '-110%', '0px', 0, t.enter);
    aside.querySelectorAll('nav button').forEach((btn, i) => from(btn, '-110%', '0px', t.enterStagger * (i + 1), t.enter));
    const foot = aside.querySelector(':scope > div.mt-auto');
    if (foot) from(foot, '-110%', '0px', t.enterStagger * 9, t.enter);
  }
  const bottom = document.querySelector('nav[aria-label="Mobile Navigation"]');
  if (visible(bottom)) from(bottom, '0px', '100%', 0, t.enter);
  return anims;
}

/** Ein Bildausschnitt (Canvas) an der Stelle des Buchstabens im Wort */
function Shot({ source, shot, glow = false }) {
  const { fx, fy, fw, fh } = shot;
  return (
    <canvas
      data-glow={glow ? '' : undefined}
      width={source.width}
      height={source.height}
      ref={(el) => { if (el) el.getContext('2d').drawImage(source, 0, 0); }}
      className="absolute"
      style={{
        left: `${(-STAGE_PAD_X + fx * (1 + 2 * STAGE_PAD_X)) * 100}%`,
        top: `${(-STAGE_PAD_Y + fy * (1 + 2 * STAGE_PAD_Y)) * 100}%`,
        width: `${fw * (1 + 2 * STAGE_PAD_X) * 100}%`,
        height: `${fh * (1 + 2 * STAGE_PAD_Y) * 100}%`,
        opacity: glow ? 0 : undefined,
      }}
    />
  );
}

/** Ein Buchstabe als 3D-Bild (Ausschnitt aus dem Login, auf Wunsch zusätzlich leuchtend) oder, falls keiner festgehalten werden konnte, flach */
function Letter({ word, index, shot }) {
  if (!shot) return <WordmarkSvg word={word} only={index} />;
  return (
    <>
      <Shot source={shot.canvas} shot={shot} />
      {shot.glowCanvas && <Shot source={shot.glowCanvas} shot={shot} glow />}
    </>
  );
}

/**
 * Nach dem Login: Karte und Band blenden aus (Login), der Bildschirm ist nur noch eine Farbe mit den beiden 3D-Wörtern.
 * In der Mitte öffnet sich ein Strich, die Buchstaben werden einzeln wie ein Zug hineingezogen (der Strich schneidet sie ab),
 * dann zieht sich der Strich über die Fläche und die beiden Hälften öffnen sich nach außen und zeigen die App (Home).
 * Danach schiebt sich die Navigation vom linken Rand herein.
 * Die Achse folgt dem Layout des Logins: stehen die Wörter nebeneinander (Desktop), ist der Strich senkrecht und die
 * Hälften öffnen sich links und rechts. Stehen sie untereinander (Handy), ist er waagerecht und sie öffnen sich oben und unten.
 * Ein Tipp überspringt. Läuft nur direkt nach einem Login, sonst passiert nichts.
 */
function LoginReveal() {
  // Übergabe und Geometrie einmal beim Start festhalten (Fenstergröße und Wortpositionen vom Login)
  const [start] = useState(() => {
    const handoff = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? null : peekBrandHandoff();
    if (!handoff) return null;
    const W = document.documentElement.clientWidth || window.innerWidth;
    const H = window.innerHeight;
    const a = center(handoff.FOCUS);
    const b = center(handoff.FLOW);
    const horizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y); // Wörter nebeneinander: Strich senkrecht
    // Alles läuft um die Mitte des Bildschirms: Die Wörter gleiten (falls nötig) dorthin, der Strich entsteht dort
    const dx = W / 2 - (a.x + b.x) / 2;
    const dy = H / 2 - (a.y + b.y) / 2;
    const shift = Math.hypot(dx, dy);
    const extent = Math.max(...WORDS.map((w) => (horizontal ? handoff[w].height : handoff[w].width)));
    const length = Math.min(horizontal ? H : W, Math.max(96, extent * (horizontal ? 1.5 : 1.1)));
    return {
      handoff, W, H, factor: revealFactor(readRevealSpeed()),
      geo: { horizontal, mid: horizontal ? W / 2 : H / 2, length, dx, dy, centerMs: shift < 6 ? 0 : Math.min(BASE.centerMax, BASE.centerMin + shift * BASE.centerPerPx) },
    };
  });
  const [done, setDone] = useState(false);
  const rootRef = useRef(null);
  const skipRef = useRef(null);

  useEffect(() => {
    if (!start) {
      clearBrandHandoff();
      return undefined;
    }
    const { handoff, W, H, geo, factor } = start;
    const { horizontal, mid, length, dx, dy, centerMs } = geo;
    const root = rootRef.current;
    const q = (sel) => root.querySelector(sel);
    const ms = (v) => v * factor;
    const axisScale = horizontal ? 'scaleY' : 'scaleX';
    const all = [];
    const run = (el, keyframes, opts) => {
      const a = el.animate(keyframes, { fill: 'both', ...opts });
      all.push(a);
      return a;
    };

    // Stehen die Wörter nicht in der Bildschirmmitte (Handy, aufgeklappte Tastatur, gescrollt), gleiten sie zuerst dorthin
    const t0 = ms(centerMs);
    if (centerMs > 0) {
      WORDS.forEach((word) => {
        run(q(`[data-word="${word}"]`), [{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }], { duration: t0, easing: EASE_IN_OUT });
      });
    }
    const moved = horizontal ? dx : dy; // Verschiebung entlang der Zugrichtung

    // Strich öffnet sich in der Mitte und wird ein Stück größer
    const line = q('[data-line]');
    run(line, [{ transform: `${axisScale}(0)` }, { transform: `${axisScale}(1)` }], { duration: ms(BASE.lineGrow), delay: t0 + ms(BASE.lineAt), easing: EASE_OUT });

    // Buchstaben werden einzeln hineingezogen: der Buchstabe am Strich zuerst, die anderen ziehen nacheinander an
    let trainEnd = t0 + ms(BASE.trainAt);
    WORDS.forEach((word, wi) => {
      const s = handoff[word];
      const count = WORDMARK[word].letters.length;
      const dir = wi === 0 ? 1 : -1;
      for (let i = 0; i < count; i++) {
        const el = q(`[data-letter="${word}-${i}"]`);
        const shot = s.letters?.[i];
        // Ausdehnung des Buchstabens entlang der Zugrichtung (ohne Bild: das ganze Wort)
        const fa = horizontal ? 'fx' : 'fy';
        const fb = horizontal ? 'fw' : 'fh';
        const pad = horizontal ? STAGE_PAD_X : STAGE_PAD_Y;
        const origin = horizontal ? s.left : s.top;
        const size = horizontal ? s.width : s.height;
        const lo = (shot ? origin + (-pad + shot[fa] * (1 + 2 * pad)) * size : origin) + moved;
        const hi = shot ? lo + shot[fb] * (1 + 2 * pad) * size : origin + size + moved;
        const gap = (wi === 0 ? mid - lo : hi - mid) + 4;
        // Rang im Zug: waagerecht zuerst der Buchstabe am Strich, senkrecht (Handy) von vorn nach hinten
        const rank = horizontal ? (wi === 0 ? count - 1 - i : i) : (wi === 0 ? i : count - 1 - i);
        const delay = t0 + ms(BASE.trainAt + rank * BASE.trainStagger);
        const duration = ms(Math.sqrt((2 * gap) / BASE.trainAccel)); // Weg = ½·a·t²
        const d = gap * dir;
        run(el, [
          { transform: 'translate(0, 0)' },
          { transform: horizontal ? `translate(${d}px, 0)` : `translate(0, ${d}px)` },
        ], { duration, delay, easing: EASE_TRAIN });
        // Beim Anfahren leuchtet der Buchstabe blau auf, wie beim Darüberfahren mit dem Zeiger
        const glowEl = el.querySelector('[data-glow]');
        if (glowEl) run(glowEl, [{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(ms(BASE.glowRamp), duration * 0.7), delay, easing: EASE_GLOW });
        trainEnd = Math.max(trainEnd, delay + duration);
      }
    });

    // Strich zieht sich über die ganze Fläche, dann öffnen sich die Hälften nach außen. Die inneren Kanten übernehmen den Strich.
    const openAt = trainEnd;
    const extendAt = openAt - ms(BASE.extend);
    const full = (horizontal ? H : W) / length;
    run(line, [{ transform: `${axisScale}(1)` }, { transform: `${axisScale}(${full})` }], { duration: ms(BASE.extend), delay: extendAt, easing: EASE_EXTEND });
    const slide = (pct) => `translate(${horizontal ? pct : 0}%, ${horizontal ? 0 : pct}%)`;
    ['first', 'second'].forEach((key, i) => {
      const half = q(`[data-half="${key}"]`);
      run(half.firstElementChild, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: openAt, easing: 'linear' });
      run(half, [{ transform: slide(0) }, { transform: slide(i === 0 ? -100 : 100) }], { duration: ms(BASE.open), delay: openAt, easing: EASE_OPEN });
    });
    run(line, [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: openAt, easing: 'linear' });

    const nav = [];
    const timing = { enter: ms(BASE.enter), enterStagger: ms(BASE.enterStagger) };
    const enterDelay = openAt + ms(BASE.open) * (horizontal ? BASE.enterFrom : BASE.enterFromMobile);
    const navTimer = setTimeout(() => nav.push(...enterNavigation(timing)), enterDelay);
    const end = openAt + ms(BASE.open) + ms(BASE.tail);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearBrandHandoff();
      setDone(true);
    };
    skipRef.current = finish;
    const timer = setTimeout(finish, end);
    // Sicherheitsnetz, falls der Tab im Hintergrund steht
    const guard = setTimeout(finish, end + 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(guard);
      clearTimeout(navTimer);
      all.forEach((a) => a.cancel());
      nav.forEach((a) => a.cancel());
    };
  }, [start]);

  if (!start || done) return null;
  const { handoff, geo: { horizontal, length } } = start;
  // Strich und Hälften in Prozent der Fläche: bleibt richtig, wenn sich die Fenstergröße ändert (Tastatur schließt)
  const lineStyle = horizontal
    ? { left: `calc(50% - ${LINE_PX / 2}px)`, top: `calc(50% - ${length / 2}px)`, width: LINE_PX, height: length }
    : { top: `calc(50% - ${LINE_PX / 2}px)`, left: `calc(50% - ${length / 2}px)`, height: LINE_PX, width: length };
  const halves = horizontal
    ? [
      { key: 'first', style: { left: 0, top: 0, bottom: 0, width: '50%' }, edge: 'right-0 top-0 bottom-0 w-px' },
      { key: 'second', style: { right: 0, top: 0, bottom: 0, width: '50%' }, edge: 'left-0 top-0 bottom-0 w-px' },
    ]
    : [
      { key: 'first', style: { top: 0, left: 0, right: 0, height: '50%' }, edge: 'bottom-0 left-0 right-0 h-px' },
      { key: 'second', style: { bottom: 0, left: 0, right: 0, height: '50%' }, edge: 'top-0 left-0 right-0 h-px' },
    ];
  // Jedes Wort wird an der Strichposition auf seine Seite beschnitten, mit schmalem weichem Rand statt ganz hartem Schnitt
  const edgeMask = (i, wordHeight) => {
    const feather = Math.round(wordHeight * BASE.featherRatio);
    const to = horizontal ? (i === 0 ? 'right' : 'left') : (i === 0 ? 'bottom' : 'top');
    const image = `linear-gradient(to ${to}, #000 calc(50% - ${feather}px), transparent 50%)`;
    return { maskImage: image, WebkitMaskImage: image };
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
      {WORDS.map((word, wi) => {
        const s = handoff[word];
        return (
          <div key={word} className="absolute inset-0" style={edgeMask(wi, s.height)}>
            <div data-word={word} className="absolute" style={{ left: s.left, top: s.top, width: s.width, height: s.height }}>
              {WORDMARK[word].letters.map((_, i) => (
                <div key={i} data-letter={`${word}-${i}`} className="absolute inset-0 will-change-transform">
                  <Letter word={word} index={i} shot={s.letters?.[i]} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <span data-line className="absolute bg-current" style={{ ...lineStyle, transform: horizontal ? 'scaleY(0)' : 'scaleX(0)' }} />
    </div>
  );
}

export default LoginReveal;
