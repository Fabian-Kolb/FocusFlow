import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, FOCUS, Icon } from '../../ds';
import FioCharacter from './FioCharacter';

/**
 * Startseite (Login), unter dem Erklär-Video: Fio stellt sich vor.
 * Fio läuft herein, winkt und redet vorgefertigte Sätze (keine KI-Anbindung). Antippen = anstupsen,
 * Hochziehen = Fio hat Angst und strampelt, Loslassen = fällt zurück auf den Boden.
 * Ohne Interaktion läuft Fio ab und zu ein Stück und schläft nach einer Weile ein.
 * Bei reduzierter Bewegung: kein Laufen und Fallen, Fio steht und spricht ohne Tipp-Effekt.
 */

const INTRO = ['Hallo, ich bin Fio.', 'Ich helfe dir, aus Gedanken Pläne zu machen.'];
const TOPICS = [
  { label: 'Wer bist du?', lines: ['Ich bin Fio, dein Begleiter in FocusFlow.', 'Mein Name steht für Focus, Input, Output. Und für die zwei F im Logo.'] },
  { label: 'Was kannst du?', lines: ['Ich ordne deine Gedanken und mache daraus Erinnerungen, Termine oder Projekte.', 'Aus einer groben Idee baue ich dir Phasen und Aufgaben.'] },
  { label: 'Wie hilfst du beim Planen?', lines: ['Frag mich, was heute dran ist.', 'Ich schaue auf Termine, Erinnerungen und Projekte und nenne dir zwei, drei Schritte. Nicht zwanzig.'] },
  { label: 'Ich stecke fest', lines: ['Dann zerlegen wir die Aufgabe zusammen in kleine Schritte.', 'Der erste ist meistens kleiner, als er sich anfühlt.'] },
];
const POKES = ['Hey, das kitzelt.', 'Ja? Ich bin da.', 'Frag mich ruhig etwas.', 'Noch mal, und ich fange an zu hüpfen.'];
const LIFTED = ['Huch! Nicht so hoch!', 'Bitte wieder runter!', 'Ich hab doch keine Flügel!'];
const LANDED = ['Puh. Lieber mit beiden Füßen am Boden.', 'Danke. Boden ist gut.', 'Geschafft. Wo waren wir?'];

const FEATURES = [
  { icon: 'lightbulb', title: 'Gedanken ordnen', text: 'Schreib einfach drauflos. Fio macht daraus Erinnerungen, Termine oder Projekte.' },
  { icon: 'today', title: 'Den Tag planen', text: 'Fio schaut auf Termine, Erinnerungen und Projekte und schlägt dir die nächsten zwei, drei Schritte vor.' },
  { icon: 'account_tree', title: 'Projekte aufbauen', text: 'Aus einer groben Idee werden Phasen und Aufgaben, mit einer ersten Zeitschätzung.' },
  { icon: 'route', title: 'Weiterkommen', text: 'Hängst du fest, zerlegt Fio die Aufgabe mit dir in kleine Schritte, bis der nächste klar ist.' },
];

const GRAVITY = 2400; // px/s²
const WALK_SPEED = 80; // px/s
const SLEEP_AFTER = 45000;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function LoginFioSection() {
  const [mood, setMood] = useState('idle');
  const [bubble, setBubble] = useState({ text: '', shown: false });
  const stageRef = useRef(null);
  const fioRef = useRef(null);
  const bubbleRef = useRef(null);
  const ctlRef = useRef(null);
  const pos = useRef({ x: -200, h: 0, vy: 0, target: 0, mode: 'off', bounced: false, onArrive: null, onLanded: null });
  const drag = useRef(null);
  const speechId = useRef(0);
  const busy = useRef(false);
  const sleeping = useRef(false);
  const lastActive = useRef(Date.now());
  const nextWander = useRef(Date.now() + 12000);
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; speechId.current += 1; }, []);

  const speak = useCallback(async (lines, { think = 0, end = 'happy' } = {}) => {
    const myId = ++speechId.current;
    const alive = () => mounted.current && speechId.current === myId;
    busy.current = true;
    if (think) {
      setMood('thinking');
      await wait(think);
      if (!alive()) return;
    }
    for (const line of lines) {
      setMood('talking');
      if (reducedMotion()) {
        setBubble({ text: line, shown: true });
      } else {
        const words = line.split(' ');
        for (let i = 0; i < words.length; i += 1) {
          setBubble({ text: words.slice(0, i + 1).join(' '), shown: true });
          await wait(65);
          if (!alive()) return;
        }
      }
      setMood('idle');
      await wait(Math.max(1300, line.length * 38));
      if (!alive()) return;
    }
    if (end) {
      setMood(end);
      await wait(900);
      if (!alive()) return;
    }
    setMood('idle');
    busy.current = false;
    await wait(2500);
    if (alive()) setBubble((b) => ({ ...b, shown: false }));
  }, []);

  const walkTo = useCallback((x, onArrive) => {
    const p = pos.current;
    p.target = x;
    p.onArrive = onArrive || null;
    if (reducedMotion()) {
      p.x = x;
      p.mode = 'idle';
      onArrive?.();
      return;
    }
    p.mode = 'walk';
  }, []);

  // Aktivität merken, Fio aufwecken, falls er schläft
  const wake = useCallback(() => {
    lastActive.current = Date.now();
    nextWander.current = Date.now() + 10000 + Math.random() * 6000;
    if (!sleeping.current) return;
    sleeping.current = false;
    setMood('surprised');
    setTimeout(() => { if (mounted.current && !busy.current) setMood('idle'); }, 600);
  }, []);

  const stopWalking = () => {
    const p = pos.current;
    if (p.mode === 'walk') { p.mode = 'idle'; p.onArrive = null; }
    if (ctlRef.current) ctlRef.current.walkDir = 0;
  };

  const poke = () => {
    wake();
    stopWalking();
    ctlRef.current?.boop();
    speak([pick(POKES)], { end: null });
  };

  const ask = (topic) => {
    wake();
    stopWalking();
    speak(topic.lines, { think: 700 });
  };

  // Bewegung: Laufen, Hochheben, Fallen, Sprechblase folgt Fio
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pos.current;
      const stage = stageRef.current;
      const fio = fioRef.current;
      const ctl = ctlRef.current;
      if (stage && fio) {
        const fw = fio.offsetWidth;
        // Bühne kann schmaler werden (Drehen, Fenstergröße): Fio und Laufziel bleiben drin
        const maxX = Math.max(0, stage.clientWidth - fw);
        p.target = Math.min(p.target, maxX);
        if (p.mode === 'idle' || p.mode === 'fall') p.x = Math.min(p.x, maxX);
        if (p.mode === 'walk') {
          const d = p.target - p.x;
          if (Math.abs(d) > 2) {
            const dir = Math.sign(d);
            p.x += dir * Math.min(Math.abs(d), WALK_SPEED * dt);
            if (ctl) ctl.walkDir = dir;
          } else {
            p.mode = 'idle';
            if (ctl) ctl.walkDir = 0;
            const cb = p.onArrive;
            p.onArrive = null;
            cb?.();
          }
        } else if (p.mode === 'fall') {
          p.vy += GRAVITY * dt;
          p.h -= p.vy * dt;
          if (p.h <= 0) {
            p.h = 0;
            ctl?.land();
            if (p.vy > 650 && !p.bounced) {
              p.vy = -p.vy * 0.25;
              p.bounced = true;
            } else {
              p.mode = 'idle';
              p.vy = 0;
              const cb = p.onLanded;
              p.onLanded = null;
              cb?.();
            }
          }
        }
        fio.style.transform = `translate(${p.x.toFixed(1)}px, ${(-p.h).toFixed(1)}px)`;
        const b = bubbleRef.current;
        if (b) {
          const bw = b.offsetWidth;
          const left = Math.max(8, Math.min(stage.clientWidth - bw - 8, p.x + fw / 2 - bw / 2));
          b.style.transform = `translate(${left.toFixed(1)}px, ${(-(p.h + fw * 0.86)).toFixed(1)}px)`;
          b.style.setProperty('--tail-x', `${Math.max(14, Math.min(bw - 14, p.x + fw / 2 - left)).toFixed(1)}px`);
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Auftritt, sobald der Abschnitt sichtbar wird
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const enter = () => {
      if (started.current) return;
      started.current = true;
      const fw = fioRef.current?.offsetWidth || 150;
      const p = pos.current;
      p.x = -fw - 20;
      p.mode = 'idle';
      walkTo(stage.clientWidth / 2 - fw / 2, () => {
        ctlRef.current?.boop();
        speak(INTRO);
      });
    };
    if (typeof IntersectionObserver === 'undefined') { enter(); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) enter(); }, { threshold: 0.35 });
    io.observe(stage);
    return () => io.disconnect();
  }, [speak, walkTo]);

  // Eigenleben: ab und zu ein Stück laufen, nach längerer Ruhe einschlafen
  useEffect(() => {
    const timer = setInterval(() => {
      const p = pos.current;
      const stage = stageRef.current;
      const fw = fioRef.current?.offsetWidth || 150;
      if (!started.current || !stage || busy.current || sleeping.current || p.mode !== 'idle') return;
      const now = Date.now();
      if (now - lastActive.current > SLEEP_AFTER) {
        sleeping.current = true;
        setBubble((b) => ({ ...b, shown: false }));
        setMood('sleepy');
        return;
      }
      if (!reducedMotion() && now > nextWander.current) {
        nextWander.current = now + 9000 + Math.random() * 7000;
        const max = stage.clientWidth - fw;
        let x = Math.random() * max;
        if (Math.abs(x - p.x) < 60) x = Math.max(0, Math.min(max, p.x + (p.x > max / 2 ? -1 : 1) * 120));
        walkTo(x);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [walkTo]);

  // Ziehen und Anstupsen
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = pos.current;
    if (p.mode === 'fall') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, x0: p.x, h0: p.h, moved: false, lx: e.clientX, lt: performance.now() };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = pos.current;
    const ctl = ctlRef.current;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      wake();
      stopWalking();
      p.mode = 'drag';
      if (ctl) ctl.held = true;
      speak([pick(LIFTED)], { end: null });
    }
    const stage = stageRef.current;
    const fw = fioRef.current.offsetWidth;
    p.x = Math.max(0, Math.min(stage.clientWidth - fw, d.x0 + dx));
    p.h = Math.max(0, Math.min(stage.clientHeight - fw - 8, d.h0 - dy));
    const now = performance.now();
    const vx = (e.clientX - d.lx) / Math.max(1, now - d.lt) * 1000;
    d.lx = e.clientX;
    d.lt = now;
    if (ctl) ctl.swing = Math.max(-24, Math.min(24, -vx * 0.03));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { poke(); return; }
    const p = pos.current;
    const ctl = ctlRef.current;
    if (ctl) { ctl.held = false; ctl.swing = 0; }
    p.vy = 0;
    p.bounced = false;
    p.onLanded = () => speak([pick(LANDED)], { end: 'happy' });
    if (reducedMotion()) { p.h = 0; p.mode = 'idle'; p.onLanded(); p.onLanded = null; return; }
    setMood('surprised');
    p.mode = 'fall';
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); }
  };

  return (
    <section aria-labelledby="fio-intro-title" className="mx-auto w-full max-w-content px-4 pb-16 md:px-6">
      <Card padding="md" className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0 space-y-3">
          <div ref={stageRef} className="relative h-[22rem] overflow-hidden rounded-lg border border-subtle bg-subtle">
            <p className="absolute left-3 top-3 text-caption text-tertiary">Tippe Fio an oder heb ihn hoch.</p>

            <div
              ref={bubbleRef}
              aria-live="polite"
              className={`pointer-events-none absolute bottom-3 left-0 max-w-[16rem] rounded-lg border border-subtle bg-surface px-3 py-2 text-body text-primary shadow-sm transition-opacity duration-base ease-standard motion-reduce:transition-none ${bubble.shown ? 'opacity-100' : 'opacity-0'}`}
            >
              {bubble.text}
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-subtle bg-surface"
                style={{ left: 'var(--tail-x, 50%)' }}
              />
            </div>

            <div
              ref={fioRef}
              role="button"
              tabIndex={0}
              aria-label="Fio anstupsen"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className={`absolute bottom-3 left-0 h-36 w-36 cursor-grab touch-none select-none rounded-lg active:cursor-grabbing sm:h-40 sm:w-40 ${FOCUS}`}
              style={{ transform: 'translate(-200px, 0)' }}
            >
              <FioCharacter mood={mood} hands feet brows="emotion" gap="var(--bg-subtle)" controlRef={ctlRef} className="h-full w-full" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <Button key={t.label} variant="secondary" size="sm" onClick={() => ask(t)}>{t.label}</Button>
            ))}
          </div>
        </div>

        <div className="max-w-prose">
          <p className="text-eyebrow text-secondary">Dein Begleiter</p>
          <h2 id="fio-intro-title" className="mt-2 text-title text-primary">Das ist Fio</h2>
          <p className="mt-3 text-body-lg text-secondary">
            Fio steckt mitten in FocusFlow. Fio hilft dir, Aufgaben besser zu verstehen und schneller zum Ergebnis zu kommen, ohne dass du alles selbst sortieren musst.
          </p>
          <ul className="mt-6 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-secondary" aria-hidden="true">
                  <Icon name={f.icon} size="sm" />
                </span>
                <div className="min-w-0">
                  <p className="text-body-strong text-primary">{f.title}</p>
                  <p className="text-body text-secondary">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

export default LoginFioSection;
