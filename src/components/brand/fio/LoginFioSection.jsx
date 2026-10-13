import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, FOCUS, Icon } from '../../ds';
import FioCharacter from './FioCharacter';
import useScrollReveal from '../useScrollReveal';

/**
 * Startseite: Fio lebt frei über der ganzen Seite (fixierte Ebene) und hat im Abschnitt „Das ist Fio“ seinen Bereich.
 *
 * - Außerhalb seines Abschnitts steht Fio klein in einer Ecke (Desktop von Anfang an, Handy erst nach dem Login-Bereich).
 * - Kommt der Abschnitt ins Bild, springt Fio in seinen Bereich (Desktop: rechte Spalte, die beim Scrollen stehen bleibt;
 *   Handy: unten rechts, größer) und begrüßt einmal. Die Fragen-Knöpfe geben je eine feste Antwort (keine KI-Anbindung).
 * - Antippen: Fio freut sich. Ziehen: überall hin, Fio hat Angst und strampelt. Loslassen: fällt auf den unteren Rand.
 * - Fio steht immer an festen Bildschirmkoordinaten (nie an der Seite „festgeklebt“), dadurch ruckelt beim Scrollen nichts.
 * Bei reduzierter Bewegung: Fio springt und fällt nicht, sondern steht sofort am Ziel.
 */

const GREETING = 'Hallo, ich bin Fio! Ich helfe dir, Gedanken, Termine und Projekte zu ordnen. Frag mich einfach etwas.';
const QUESTIONS = [
  { q: 'Wer bist du?', a: 'Ich bin Fio, der KI-Assistent von FocusFlow. Ich helfe dir, den Überblick zu behalten.' },
  { q: 'Was kannst du?', a: 'Ich mache aus deinen Gedanken Erinnerungen, Termine oder Projekte und plane mit dir deinen Tag.' },
  { q: 'Wie plane ich meinen Tag?', a: 'Frag mich, was heute dran ist. Ich schaue auf Termine, Erinnerungen und Projekte und nenne dir die zwei, drei wichtigsten Schritte.' },
  { q: 'Wie wird aus einer Idee ein Projekt?', a: 'Halte die Idee als Gedanken fest und lass sie mich ausarbeiten. Ich schlage Phasen und Aufgaben vor, du entscheidest.' },
  { q: 'Bist du eine KI?', a: 'Ja. In der App beantworte ich alles, was du mich fragst. Hier auf der Startseite stelle ich mich nur kurz vor.' },
];
const POKE = 'Hallo! Frag mich ruhig etwas.';
const LIFTED = 'Huch! Lass mich bitte runter.';
const LANDED = 'Danke, so ist es besser.';

const FEATURES = [
  { icon: 'lightbulb', title: 'Gedanken ordnen', text: 'Schreib einfach drauflos. Fio macht daraus Erinnerungen, Termine oder Projekte.' },
  { icon: 'today', title: 'Den Tag planen', text: 'Fio schaut auf Termine, Erinnerungen und Projekte und schlägt dir die nächsten zwei, drei Schritte vor.' },
  { icon: 'account_tree', title: 'Projekte aufbauen', text: 'Aus einer groben Idee werden Phasen und Aufgaben, mit einer ersten Zeitschätzung.' },
  { icon: 'route', title: 'Weiterkommen', text: 'Hängst du fest, zerlegt Fio die Aufgabe mit dir in kleine Schritte, bis der nächste klar ist.' },
];

const GRAVITY = 2600; // px/s²
const WALK_SPEED = 90; // px/s
const SLEEP_AFTER = 60000;
const MARGIN = 16;
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => window.matchMedia?.('(min-width: 1024px)').matches;
const easeInOut = (v) => (v < 0.5 ? 2 * v * v : 1 - ((-2 * v + 2) ** 2) / 2);

function LoginFioSection({ hidden = false }) {
  const [mood, setMood] = useState('idle');
  const [bubble, setBubble] = useState({ text: '', shown: false, big: false });
  const [active, setActive] = useState(false);
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const scalerRef = useRef(null);
  const bubbleRef = useRef(null);
  const ctlRef = useRef(null);
  const st = useRef({ cx: 0, foot: 0, scale: 0.55, scaleT: 0.55, mode: 'hidden', place: 'none', target: 0, vy: 0, bounced: false, jump: null, onLanded: null });
  const drag = useRef(null);
  const speechId = useRef(0);
  const busy = useRef(false);
  const sleeping = useRef(false);
  const greeted = useRef(false);
  const activeRef = useRef(false);
  const lastActive = useRef(Date.now());
  const nextWander = useRef(Date.now() + 10000);
  const mounted = useRef(true);
  const [headRef, headStyle] = useScrollReveal();
  const [askRef, askStyle] = useScrollReveal({ delay: 120 });
  const [featRef, featStyle] = useScrollReveal({ delay: 200 });

  // StrictMode (nur Entwicklung) baut Effekte einmal ab und wieder auf: deshalb beim Aufbau wieder auf true setzen
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; speechId.current += 1; };
  }, []);

  const boxSize = () => (isDesktop() ? 200 : 150);
  const scaleFor = (place) => {
    if (place === 'home') return isDesktop() ? 1 : 0.8;
    return isDesktop() ? 0.55 : 0.6;
  };
  // Zielpunkt (Mitte unten der Figur, in Fensterkoordinaten) für Ecke oder Fios Bereich
  const spotFor = (place) => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const S = boxSize();
    const sc = scaleFor(place);
    if (place === 'home' && isDesktop() && stageRef.current) {
      const r = stageRef.current.getBoundingClientRect();
      return { cx: r.left + r.width / 2, foot: Math.min(r.bottom - 24, vh - MARGIN) };
    }
    if (place === 'home' || !isDesktop()) return { cx: vw - MARGIN - (S * sc) / 2, foot: vh - MARGIN };
    return { cx: MARGIN + 8 + (S * sc) / 2, foot: vh - MARGIN };
  };

  // Sprechen: ein Satz, Wort für Wort, danach blendet die Blase aus
  const say = useCallback(async (text, { think = 0, end = null, big = false } = {}) => {
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
      setBubble({ text, shown: true, big });
    } else {
      const words = text.split(' ');
      for (let i = 0; i < words.length; i += 1) {
        setBubble({ text: words.slice(0, i + 1).join(' '), shown: true, big });
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
    await wait(Math.max(3500, text.length * 55));
    if (alive()) setBubble((b) => ({ ...b, shown: false }));
  }, []);

  const touch = useCallback(() => {
    lastActive.current = Date.now();
    nextWander.current = Date.now() + 9000 + Math.random() * 6000;
    if (!sleeping.current) return;
    sleeping.current = false;
    setMood('surprised');
    setTimeout(() => { if (mounted.current && !busy.current) setMood('idle'); }, 600);
  }, []);

  // Sprung zu Ecke oder Bereich (Bogen), Ziel wird jedes Bild neu bestimmt
  const goTo = useCallback((place, onDone) => {
    const s = st.current;
    if (s.mode === 'drag' || s.mode === 'fall') return;
    const ctl = ctlRef.current;
    if (ctl) ctl.walkDir = 0;
    s.scaleT = scaleFor(place);
    if (reducedMotion()) {
      const p = spotFor(place);
      Object.assign(s, { cx: p.cx, foot: p.foot, scale: s.scaleT, mode: 'idle', place });
      onDone?.();
      return;
    }
    const vh = window.innerHeight;
    const fromHidden = s.mode === 'hidden';
    const start = fromHidden ? { cx: spotFor(place).cx, foot: vh + boxSize() } : { cx: s.cx, foot: s.foot };
    s.jump = { from: start, t0: performance.now(), dur: fromHidden ? 650 : 750, place, onDone };
    s.mode = 'jump';
  }, []);

  const hide = useCallback(() => {
    const s = st.current;
    if (s.mode === 'hidden' || s.mode === 'drag') return;
    s.jump = { from: { cx: s.cx, foot: s.foot }, t0: performance.now(), dur: 500, place: 'hidden' };
    s.mode = 'jump';
  }, []);

  const ask = (item) => {
    touch();
    if (activeRef.current && st.current.place !== 'home') goTo('home');
    say(item.a, { think: 500, big: true });
  };

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
        const to = j.place === 'hidden' ? { cx: s.cx, foot: vh + S } : spotFor(j.place);
        const e = easeInOut(t);
        const arc = j.place === 'hidden' ? 0 : (isDesktop() ? 140 : 90) * 4 * t * (1 - t);
        s.cx = j.from.cx + (to.cx - j.from.cx) * e;
        s.foot = j.from.foot + (to.foot - j.from.foot) * e - arc;
        if (t >= 1) {
          s.jump = null;
          s.mode = j.place === 'hidden' ? 'hidden' : 'idle';
          s.place = j.place;
          if (j.place !== 'hidden') ctl?.land();
          j.onDone?.();
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
        // Ruhend an Ecke oder Bereich: Fensterwechsel (Größe, Drehen) mitgehen
        const p = spotFor(s.place);
        if (s.place !== 'home' || !isDesktop()) s.cx = p.cx;
        s.foot = p.foot;
      }

      s.scale += (s.scaleT - s.scale) * Math.min(1, dt * 7);
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
        const left = Math.max(MARGIN - (s.cx - bw / 2), Math.min(0, vw - MARGIN - (s.cx + bw / 2)));
        b.style.bottom = `${(S * s.scale * 0.9 + 6).toFixed(1)}px`;
        b.style.transform = `translateX(calc(-50% + ${left.toFixed(1)}px))`;
        b.style.setProperty('--tail-x', `${(bw / 2 - left).toFixed(1)}px`);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Abschnitt im Bild: Fio springt in seinen Bereich und begrüßt einmal
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { activeRef.current = e.isIntersecting; setActive(e.isIntersecting); });
    }, { rootMargin: '-35% 0px -35% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (active) {
      touch();
      goTo('home', () => {
        if (greeted.current) return;
        greeted.current = true;
        ctlRef.current?.boop();
        say(GREETING, { big: true });
      });
    } else if (st.current.place === 'home') {
      goTo('corner');
    }
  }, [active, goTo, say, touch]);

  // Auftritt: Desktop sofort in der Ecke, Handy erst nach dem Login-Bereich (verschwindet oben wieder)
  useEffect(() => {
    const check = () => {
      const s = st.current;
      if (activeRef.current || s.mode === 'drag' || s.mode === 'fall') return;
      const show = isDesktop() || window.scrollY > window.innerHeight * 0.9;
      if (show && s.mode === 'hidden') goTo('corner', () => ctlRef.current?.boop());
      if (!show && s.mode !== 'hidden' && s.mode !== 'jump') hide();
    };
    const timer = setTimeout(check, 700);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [goTo, hide]);

  // Eigenleben: im eigenen Bereich ab und zu ein Stück laufen, nach längerer Ruhe einschlafen
  useEffect(() => {
    const timer = setInterval(() => {
      const s = st.current;
      if (s.mode !== 'idle' || busy.current || sleeping.current) return;
      const now = Date.now();
      if (now - lastActive.current > SLEEP_AFTER) {
        sleeping.current = true;
        setBubble((b) => ({ ...b, shown: false }));
        setMood('sleepy');
        return;
      }
      if (s.place === 'home' && isDesktop() && !reducedMotion() && now > nextWander.current && stageRef.current) {
        nextWander.current = now + 8000 + Math.random() * 7000;
        const r = stageRef.current.getBoundingClientRect();
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
    const vh = window.innerHeight;
    s.cx = d.cx0 + dx;
    s.foot = Math.max(boxSize() * s.scale * 0.95, Math.min(vh - MARGIN, d.foot0 + dy));
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
    <div ref={hostRef} className={`pointer-events-none fixed left-0 top-0 z-10 transition-opacity duration-base ease-standard ${hidden ? 'opacity-0' : ''}`} style={{ visibility: 'hidden', width: 200, height: 200 }}>
      <div
        ref={bubbleRef}
        aria-live="polite"
        className={`absolute left-1/2 w-max rounded-lg border border-subtle bg-surface px-3 py-2 text-primary shadow-md transition-opacity duration-base ease-standard motion-reduce:transition-none ${bubble.big ? 'max-w-[20rem] text-body-lg' : 'max-w-[15rem] text-body'} ${bubble.shown ? 'opacity-100' : 'opacity-0'}`}
      >
        {bubble.text}
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

  return (
    <>
      <section ref={sectionRef} aria-labelledby="fio-intro-title" className="mx-auto w-full max-w-content px-4 pb-32 pt-16 md:px-6 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="min-w-0">
            <div ref={headRef} style={headStyle}>
              <p className="text-eyebrow text-secondary">Dein Begleiter</p>
              <h2 id="fio-intro-title" className="mt-3 text-display text-primary">Das ist Fio</h2>
              <p className="mt-4 max-w-reading text-body-lg text-secondary">
                Fio ist der KI-Assistent in FocusFlow. Fio hilft dir, Aufgaben besser zu verstehen und schneller zum Ergebnis zu kommen, ohne dass du alles selbst sortieren musst.
              </p>
            </div>

            <div ref={askRef} style={askStyle} className="mt-10">
              <p className="text-eyebrow text-secondary">Frag Fio</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUESTIONS.map((item) => (
                  <Button key={item.q} variant="secondary" onClick={() => ask(item)}>{item.q}</Button>
                ))}
              </div>
              <p className="mt-3 text-caption text-tertiary">Du kannst Fio auch antippen oder irgendwohin ziehen.</p>
            </div>

            <ul ref={featRef} style={featStyle} className="mt-14 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted text-primary" aria-hidden="true">
                    <Icon name={f.icon} />
                  </span>
                  <p className="mt-3 text-heading text-primary">{f.title}</p>
                  <p className="mt-1 text-body text-secondary">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Fios Bereich am Desktop: bleibt beim Scrollen durch den Abschnitt stehen, Fio selbst liegt in der fixierten Ebene */}
          <div className="hidden lg:block" aria-hidden="true">
            <div ref={stageRef} className="sticky top-[12vh] h-[70vh]" />
          </div>
        </div>
      </section>
      {typeof document !== 'undefined' && createPortal(fio, document.body)}
    </>
  );
}

export default LoginFioSection;
