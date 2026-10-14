import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, FOCUS } from '../../ds';
import FioCharacter from './FioCharacter';

/**
 * Fio als freie Figur über der ganzen Startseite (Portal in document.body, fixiert).
 *
 * `place` bestimmt, wo Fio hingehört; ändert er sich, springt Fio im Bogen dorthin:
 * - 'hero':   neben den Knöpfen im ersten Bildschirm (Anker `anchors.hero`, dessen Höhe = Fios Größe)
 * - 'home':   sein Bereich im Fio-Abschnitt (Desktop: `anchors.home`, eine sticky Fläche; Handy: unten rechts, größer)
 * - 'corner': klein in der Ecke (Desktop unten links, Handy unten rechts); ist der Footer (`anchors.footer`) im Bild, steht Fio darauf
 * Antippen: Fio freut sich. Ziehen: überallhin, Fio hat Angst und strampelt. Loslassen: fällt auf den unteren Rand
 * und bleibt dort, bis sich `place` ändert.
 *
 * `controlRef` bekommt { say(text, { think, end, big, action }), boop() }. `onArrive(place)` meldet die Ankunft.
 * Fio steht immer an festen Bildschirmkoordinaten, dadurch ruckelt beim Scrollen nichts.
 * Bei reduzierter Bewegung springt und fällt Fio nicht, sondern steht sofort am Ziel.
 */

const POKE = 'Hallo! Frag mich ruhig etwas.';
const LIFTED = 'Huch! Lass mich bitte runter.';
const LANDED = 'Danke, so ist es besser.';

const GRAVITY = 2600; // px/s²
const WALK_SPEED = 90; // px/s
const SLEEP_AFTER = 60000;
const MARGIN = 16;
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => window.matchMedia?.('(min-width: 1024px)').matches;
const easeInOut = (v) => (v < 0.5 ? 2 * v * v : 1 - ((-2 * v + 2) ** 2) / 2);
const boxSize = () => (isDesktop() ? 200 : 150);

function FioCompanion({ place = 'corner', anchors = {}, hidden = false, controlRef, onArrive }) {
  const [mood, setMood] = useState('idle');
  const [bubble, setBubble] = useState({ text: '', shown: false, big: false, action: null });
  const hostRef = useRef(null);
  const scalerRef = useRef(null);
  const bubbleRef = useRef(null);
  const ctlRef = useRef(null);
  const st = useRef({ cx: 0, foot: 0, scale: 0.55, scaleT: 0.55, mode: 'hidden', place: 'none', target: 0, vy: 0, bounced: false, jump: null, onLanded: null });
  const drag = useRef(null);
  const speechId = useRef(0);
  const busy = useRef(false);
  const sleeping = useRef(false);
  const lastActive = useRef(Date.now());
  const nextWander = useRef(Date.now() + 10000);
  const mounted = useRef(true);
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;

  // StrictMode (nur Entwicklung) baut Effekte einmal ab und wieder auf: deshalb beim Aufbau wieder auf true setzen
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; speechId.current += 1; };
  }, []);

  // Zielpunkt (Mitte unten der Figur, Fensterkoordinaten) und Größe für einen Platz
  const spotFor = useCallback((p) => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const S = boxSize();
    const a = anchorsRef.current;
    if (p === 'hero' && a.hero?.current) {
      const r = a.hero.current.getBoundingClientRect();
      if (r.height > 0) return { cx: r.left + r.width / 2, foot: r.bottom, scale: r.height / S };
    }
    if (p === 'home') {
      if (isDesktop() && a.home?.current) {
        // Nur die waagrechte Lage kommt von der Spalte (ändert sich beim Scrollen nicht), die Höhe ist fest im Fenster:
        // so steht Fio still, während der Abschnitt vorbeiscrollt
        const r = a.home.current.getBoundingClientRect();
        return { cx: r.left + r.width / 2, foot: Math.min(vh - MARGIN, vh * 0.8), scale: 1 };
      }
      return { cx: vw - MARGIN - (S * 0.8) / 2, foot: vh - MARGIN, scale: 0.8 };
    }
    const scale = isDesktop() ? 0.55 : 0.6;
    const cx = isDesktop() ? MARGIN + 8 + (S * scale) / 2 : vw - MARGIN - (S * scale) / 2;
    // Ist der Footer im Bild, steht Fio auf seiner Oberkante statt auf den Links
    const footerTop = a.footer?.current ? a.footer.current.getBoundingClientRect().top : Infinity;
    return { cx, foot: Math.min(vh - MARGIN, footerTop), scale };
  }, []);

  // Sprechen: ein Satz, Wort für Wort, danach blendet die Blase aus (mit Knopf bleibt sie länger)
  const say = useCallback(async (text, { think = 0, end = null, big = false, action = null } = {}) => {
    const myId = ++speechId.current;
    const alive = () => mounted.current && speechId.current === myId;
    busy.current = true;
    if (think) {
      setMood('thinking');
      await wait(think);
      if (!alive()) return;
    }
    setMood('talking');
    if (reducedMotion()) {
      setBubble({ text, shown: true, big, action });
    } else {
      const words = text.split(' ');
      for (let i = 0; i < words.length; i += 1) {
        setBubble({ text: words.slice(0, i + 1).join(' '), shown: true, big, action: i === words.length - 1 ? action : null });
        await wait(45);
        if (!alive()) return;
      }
    }
    setMood(end || 'idle');
    if (end) {
      await wait(900);
      if (!alive()) return;
      setMood('idle');
    }
    busy.current = false;
    await wait(Math.max(action ? 9000 : 3500, text.length * 55));
    if (alive()) setBubble((b) => ({ ...b, shown: false, action: null }));
  }, []);

  const touch = useCallback(() => {
    lastActive.current = Date.now();
    nextWander.current = Date.now() + 9000 + Math.random() * 6000;
    if (!sleeping.current) return;
    sleeping.current = false;
    setMood('surprised');
    setTimeout(() => { if (mounted.current && !busy.current) setMood('idle'); }, 600);
  }, []);

  const boop = useCallback(() => { ctlRef.current?.boop(); }, []);

  useEffect(() => {
    if (!controlRef) return undefined;
    controlRef.current = { say: (...args) => { touch(); return say(...args); }, boop };
    return () => { controlRef.current = null; };
  }, [controlRef, say, boop, touch]);

  // Sprung zu einem Platz (Bogen), das Ziel wird jedes Bild neu bestimmt
  const goTo = useCallback((p) => {
    const s = st.current;
    if (s.mode === 'drag' || s.mode === 'fall') return;
    if (ctlRef.current) ctlRef.current.walkDir = 0;
    if (reducedMotion()) {
      const spot = spotFor(p);
      Object.assign(s, { cx: spot.cx, foot: spot.foot, scale: spot.scale, scaleT: spot.scale, mode: 'idle', place: p });
      onArriveRef.current?.(p);
      return;
    }
    const vh = window.innerHeight;
    const fromHidden = s.mode === 'hidden';
    const start = fromHidden ? { cx: spotFor(p).cx, foot: vh + boxSize() } : { cx: s.cx, foot: s.foot };
    s.jump = { from: start, fromScale: fromHidden ? spotFor(p).scale : s.scale, t0: performance.now(), dur: fromHidden ? 650 : 750, place: p };
    s.mode = 'jump';
  }, [spotFor]);

  useEffect(() => {
    const timer = setTimeout(() => goTo(place), st.current.mode === 'hidden' ? 600 : 0);
    return () => clearTimeout(timer);
  }, [place, goTo]);

  // Bewegungsschleife: Springen, Laufen, Ziehen, Fallen; Figur, Größe und Sprechblase setzen
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      const host = hostRef.current;
      const ctl = ctlRef.current;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const S = boxSize();
      const floor = vh - MARGIN;

      if (s.mode === 'jump' && s.jump) {
        const j = s.jump;
        const t = Math.min(1, (now - j.t0) / j.dur);
        const to = spotFor(j.place);
        const e = easeInOut(t);
        const arc = (isDesktop() ? 140 : 90) * 4 * t * (1 - t);
        s.cx = j.from.cx + (to.cx - j.from.cx) * e;
        s.foot = j.from.foot + (to.foot - j.from.foot) * e - arc;
        s.scale = j.fromScale + (to.scale - j.fromScale) * e;
        s.scaleT = to.scale;
        if (t >= 1) {
          s.jump = null;
          s.mode = 'idle';
          s.place = j.place;
          ctl?.land();
          onArriveRef.current?.(j.place);
        }
      } else if (s.mode === 'walk') {
        const d = s.target - s.cx;
        if (Math.abs(d) > 2) {
          const dir = Math.sign(d);
          s.cx += dir * Math.min(Math.abs(d), WALK_SPEED * dt);
          if (ctl) ctl.walkDir = dir;
        } else {
          s.mode = 'idle';
          if (ctl) ctl.walkDir = 0;
        }
      } else if (s.mode === 'fall') {
        s.vy += GRAVITY * dt;
        s.foot += s.vy * dt;
        if (s.foot >= floor) {
          s.foot = floor;
          ctl?.land();
          if (s.vy > 700 && !s.bounced) {
            s.vy = -s.vy * 0.25;
            s.bounced = true;
          } else {
            s.vy = 0;
            s.mode = 'idle';
            s.place = 'free';
            const cb = s.onLanded;
            s.onLanded = null;
            cb?.();
          }
        }
      } else if (s.mode === 'idle' && s.place !== 'free' && s.place !== 'none') {
        // Ruhend an seinem Platz: Fenstergröße, Drehen und Anker mitgehen (im eigenen Bereich am Desktop läuft Fio selbst)
        const p = spotFor(s.place);
        if (!(s.place === 'home' && isDesktop())) s.cx = p.cx;
        s.foot = p.foot;
        s.scaleT = p.scale;
      }

      if (s.mode !== 'jump') s.scale += (s.scaleT - s.scale) * Math.min(1, dt * 7);
      const half = (S * s.scale) / 2;
      if (s.mode !== 'jump' && s.mode !== 'hidden') s.cx = Math.max(half, Math.min(vw - half, s.cx));

      if (host) {
        host.style.transform = `translate(${(s.cx - S / 2).toFixed(1)}px, ${(s.foot - S).toFixed(1)}px)`;
        host.style.width = `${S}px`;
        host.style.height = `${S}px`;
        host.style.visibility = s.mode === 'hidden' ? 'hidden' : 'visible';
      }
      if (scalerRef.current) scalerRef.current.style.transform = `scale(${s.scale.toFixed(3)})`;
      const b = bubbleRef.current;
      if (b) {
        const bw = b.offsetWidth;
        const shift = Math.max(MARGIN - (s.cx - bw / 2), Math.min(0, vw - MARGIN - (s.cx + bw / 2)));
        b.style.bottom = `${(S * s.scale * 0.9 + 6).toFixed(1)}px`;
        b.style.transform = `translateX(calc(-50% + ${shift.toFixed(1)}px))`;
        b.style.setProperty('--tail-x', `${(bw / 2 - shift).toFixed(1)}px`);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [spotFor]);

  // Eigenleben: im eigenen Bereich am Desktop ab und zu ein Stück laufen, nach längerer Ruhe einschlafen
  useEffect(() => {
    const timer = setInterval(() => {
      const s = st.current;
      if (s.mode !== 'idle' || busy.current || sleeping.current) return;
      const now = Date.now();
      if (now - lastActive.current > SLEEP_AFTER) {
        sleeping.current = true;
        setBubble((b) => ({ ...b, shown: false, action: null }));
        setMood('sleepy');
        return;
      }
      const home = anchorsRef.current.home?.current;
      if (s.place === 'home' && isDesktop() && !reducedMotion() && now > nextWander.current && home) {
        nextWander.current = now + 8000 + Math.random() * 7000;
        const r = home.getBoundingClientRect();
        const half = (boxSize() * s.scale) / 2;
        s.target = r.left + half + Math.random() * Math.max(0, r.width - 2 * half);
        s.mode = 'walk';
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ziehen und Antippen
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const s = st.current;
    if (s.mode === 'fall' || s.mode === 'hidden') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, cx0: s.cx, foot0: s.foot, moved: false, lx: e.clientX, lt: performance.now() };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const s = st.current;
    const ctl = ctlRef.current;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      touch();
      s.jump = null;
      s.mode = 'drag';
      if (ctl) { ctl.held = true; ctl.walkDir = 0; }
      say(LIFTED);
    }
    s.cx = d.cx0 + dx;
    s.foot = Math.max(boxSize() * s.scale * 0.95, Math.min(window.innerHeight - MARGIN, d.foot0 + dy));
    const now = performance.now();
    const vx = ((e.clientX - d.lx) / Math.max(1, now - d.lt)) * 1000;
    d.lx = e.clientX;
    d.lt = now;
    if (ctl) ctl.swing = Math.max(-24, Math.min(24, -vx * 0.03));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const ctl = ctlRef.current;
    if (!d.moved) {
      touch();
      ctl?.boop();
      say(POKE);
      return;
    }
    const s = st.current;
    if (ctl) { ctl.held = false; ctl.swing = 0; }
    s.vy = 0;
    s.bounced = false;
    s.onLanded = () => say(LANDED, { end: 'happy' });
    if (reducedMotion()) {
      s.foot = window.innerHeight - MARGIN;
      s.mode = 'idle';
      s.place = 'free';
      s.onLanded();
      s.onLanded = null;
      return;
    }
    setMood('surprised');
    s.mode = 'fall';
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      touch();
      ctlRef.current?.boop();
      say(POKE);
    }
  };

  const fio = (
    <div
      ref={hostRef}
      className={`pointer-events-none fixed left-0 top-0 z-10 transition-opacity duration-base ease-standard ${hidden ? 'opacity-0' : ''}`}
      style={{ visibility: 'hidden', width: 200, height: 200 }}
    >
      <div
        ref={bubbleRef}
        aria-live="polite"
        className={`absolute left-1/2 w-max rounded-lg border border-subtle bg-surface px-3 py-2 text-primary shadow-md transition-opacity duration-base ease-standard motion-reduce:transition-none ${bubble.big ? 'max-w-[20rem] text-body-lg' : 'max-w-[15rem] text-body'} ${bubble.shown ? 'opacity-100' : 'opacity-0'} ${bubble.shown && bubble.action ? 'pointer-events-auto' : ''}`}
      >
        {bubble.text}
        {bubble.action && (
          <div className="mt-2">
            <Button size="sm" onClick={bubble.action.onClick}>{bubble.action.label}</Button>
          </div>
        )}
        <span aria-hidden="true" className="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-subtle bg-surface" style={{ left: 'var(--tail-x, 50%)' }} />
      </div>
      <div
        ref={scalerRef}
        role="button"
        tabIndex={0}
        aria-label="Fio anstupsen"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`pointer-events-auto absolute inset-0 origin-bottom cursor-grab touch-none select-none rounded-lg active:cursor-grabbing ${FOCUS}`}
      >
        <FioCharacter mood={mood} hands feet brows="emotion" gap="var(--bg-canvas)" controlRef={ctlRef} className="h-full w-full" />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(fio, document.body) : null;
}

export default FioCompanion;
