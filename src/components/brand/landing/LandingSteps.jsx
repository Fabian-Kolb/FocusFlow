import React, { useEffect, useRef, useState } from 'react';
import { FioMark, Icon, IconTile, ProgressBar } from '../../ds';
import useScrollReveal from '../useScrollReveal';
import { LEAD_TYPE, SECTION_TYPE, STEP_TYPE } from './landingType';

/**
 * „So funktioniert es“: drei Schritte. Desktop: links scrollen die Schritte, rechts bleibt ein nachgebauter App-Ausschnitt
 * stehen und wechselt mit dem aktiven Schritt. Handy: unter jedem Schritt sein eigener Ausschnitt.
 * Die Ausschnitte sind Nachbauten aus den Bausteinen des Design Systems, keine Screenshots, damit sie in Hell und Dunkel
 * stimmen. Inhalte sind Beispiele.
 */

const STEPS = [
  { title: 'Festhalten.', text: 'Ein Gedanke, ein Satz. Tippen oder sprechen, ganz egal wann er kommt.' },
  { title: 'Fio ordnet.', text: 'Fio macht daraus eine Erinnerung, einen Termin oder ein Projekt. Du entscheidest, was bleibt.' },
  { title: 'Erledigen.', text: 'Frag Fio, was heute dran ist. Du bekommst zwei, drei Schritte statt einer endlosen Liste.' },
];
const WINDOWS = [
  { area: 'thoughts', icon: 'lightbulb', title: 'Gedanken' },
  { area: 'coach', icon: null, title: 'Fio' },
  { area: 'accent', icon: 'today', title: 'Heute' },
];
const THOUGHT = 'Exposé bis Freitag an Lena schicken';
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Einblenden eines Elements im Ausschnitt, gestaffelt nach Index
const enter = (active, i) => ({
  opacity: active ? 1 : 0,
  transform: active ? 'none' : 'translateY(10px)',
  transition: `opacity 400ms var(--easing-enter) ${active ? 150 + i * 120 : 0}ms, transform 500ms var(--easing-enter) ${active ? 150 + i * 120 : 0}ms`,
});

function Row({ area, icon, title, meta, style }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-subtle bg-surface px-3 py-2.5" style={style}>
      <IconTile area={area} icon={icon} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-body-strong text-primary">{title}</p>
        <p className="text-caption text-secondary">{meta}</p>
      </div>
    </div>
  );
}

function CaptureLayer({ active }) {
  const [typed, setTyped] = useState(THOUGHT);
  useEffect(() => {
    if (!active || reducedMotion()) { setTyped(THOUGHT); return undefined; }
    setTyped('');
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTyped(THOUGHT.slice(0, i));
      if (i >= THOUGHT.length) clearInterval(timer);
    }, 45);
    return () => clearInterval(timer);
  }, [active]);
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-caption-strong text-secondary">Was geht dir durch den Kopf?</p>
        <div className="flex items-center gap-2 rounded-md border border-default bg-surface px-3 py-2.5">
          <span className="min-w-0 flex-1 text-body text-primary">
            {typed}<span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-primary" aria-hidden="true" />
          </span>
          <Icon name="mic" size="sm" className="text-tertiary" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-eyebrow text-tertiary">Zuletzt</p>
        {['Zahnarzttermin ausmachen', 'Idee: sonntags kurz auf die Woche schauen'].map((t, i) => (
          <div key={t} className="flex items-center gap-2 text-body text-secondary" style={enter(active, i + 1)}>
            <Icon name="lightbulb" size="sm" className="text-tertiary" />{t}
          </div>
        ))}
      </div>
    </div>
  );
}

function SortLayer({ active }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-caption-strong text-secondary" style={enter(active, 0)}>
        <FioMark size={16} />Fio hat sortiert
      </div>
      <p className="rounded-md bg-subtle px-3 py-2 text-body text-secondary" style={enter(active, 0)}>{THOUGHT}</p>
      <Row area="reminders" icon="notifications" title="Exposé an Lena schicken" meta="Erinnerung · Fr, 10:00" style={enter(active, 1)} />
      <Row area="projects" icon="account_tree" title="Exposé" meta="Projekt · 3 Aufgaben" style={enter(active, 2)} />
      <Row area="calendar" icon="event" title="Schreibzeit fürs Exposé" meta="Termin · Do, 14:00" style={enter(active, 3)} />
    </div>
  );
}

function TodayLayer({ active }) {
  const items = [
    { t: 'Exposé gliedern', m: 'Erledigt', done: true },
    { t: 'Einleitung schreiben', m: '14:00, Schreibzeit', done: false },
    { t: 'Exposé an Lena schicken', m: 'Fr, 10:00', done: false },
  ];
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.t} className="flex items-center gap-3 rounded-md border border-subtle bg-surface px-3 py-2.5" style={enter(active, i)}>
          <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-xs border ${it.done ? 'border-success bg-success text-on-accent' : 'border-control'}`} aria-hidden="true">
            {it.done && <Icon name="check" size="sm" />}
          </span>
          <div className="min-w-0">
            <p className={`truncate text-body-strong ${it.done ? 'text-tertiary line-through' : 'text-primary'}`}>{it.t}</p>
            <p className="text-caption text-secondary">{it.m}</p>
          </div>
        </div>
      ))}
      <div style={enter(active, 3)}>
        <ProgressBar value={1} max={3} tone="success" label="1 von 3 erledigt" />
      </div>
      <div className="flex items-start gap-2 text-caption text-secondary" style={enter(active, 4)}>
        <FioMark size={16} className="mt-px text-primary" />
        Fang mit der Einleitung an. Um 14 Uhr hast du Zeit dafür.
      </div>
    </div>
  );
}

const LAYERS = [CaptureLayer, SortLayer, TodayLayer];

/** Nachgebautes App-Fenster. `stack`: alle drei Ebenen übereinander, die aktive ist sichtbar (Desktop). */
function StepWindow({ step, stack = false }) {
  const w = WINDOWS[step];
  return (
    <div className="w-full max-w-[26rem] overflow-hidden rounded-lg border border-subtle bg-surface shadow-lg">
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
        <IconTile area={w.area} icon={w.icon || undefined} size="sm" />
        <span className="text-subheading text-primary">{w.title}</span>
      </div>
      <div className="relative p-4" style={{ minHeight: '19rem' }}>
        {stack
          ? LAYERS.map((Layer, i) => (
            <div key={i} className="absolute inset-0 p-4" style={{ opacity: i === step ? 1 : 0, transition: 'opacity 350ms var(--easing-standard)' }} aria-hidden={i !== step}>
              <Layer active={i === step} />
            </div>
          ))
          : React.createElement(LAYERS[step], { active: true })}
      </div>
    </div>
  );
}

function LandingSteps() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);
  const [headRef, headStyle] = useScrollReveal();

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="landing-steps-title">
      <div className="mx-auto w-full max-w-content px-4 py-24 md:px-6 lg:py-32">
        <div ref={headRef} style={headStyle} className="mx-auto max-w-reading text-center">
          <p className="text-eyebrow text-secondary">So funktioniert es</p>
          <h2 id="landing-steps-title" className="mt-3 text-display text-primary" style={SECTION_TYPE}>Drei Schritte.<br />Mehr nicht.</h2>
        </div>

        <div className="mt-12 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-16">
          <ol>
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                ref={(el) => { stepRefs.current[i] = el; }}
                data-step={i}
                className="flex flex-col justify-center py-10 transition-opacity duration-slow ease-standard lg:min-h-[75vh] lg:py-0"
                style={{ opacity: typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches && i !== active ? 0.3 : 1 }}
              >
                <p className="text-eyebrow text-tertiary tabular-nums">0{i + 1}</p>
                <h3 className="mt-3 text-display text-primary" style={STEP_TYPE}>{s.title}</h3>
                <p className="mt-4 max-w-md text-secondary" style={LEAD_TYPE}>{s.text}</p>
                <div className="mt-8 lg:hidden"><StepWindow step={i} /></div>
              </li>
            ))}
          </ol>
          <div className="hidden lg:block" aria-hidden="true">
            <div className="sticky top-0 flex h-screen items-center justify-center">
              <StepWindow step={active} stack />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingSteps;
