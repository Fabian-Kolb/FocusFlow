import React, { useRef } from 'react';
import { IconButton, IconTile } from '../../ds';
import useScrollReveal from '../useScrollReveal';
import { LEAD_TYPE, SECTION_TYPE, STEP_TYPE } from './landingType';

/**
 * „Alles an einem Ort“: große Karten pro Bereich, waagrecht zum Wischen (Snap), am Desktop mit Pfeilen.
 * Bereichsfarbe nur im kleinen Icon-Chip (Regel 01). Aussagen entsprechen den echten Funktionen.
 */

const FEATURES = [
  { area: 'thoughts', icon: 'lightbulb', name: 'Gedanken', title: 'Erst festhalten. Später sortieren.', text: 'Alles, was dir einfällt, landet ohne Umweg an einem Ort. Per Text oder Sprache.' },
  { area: 'reminders', icon: 'notifications', name: 'Erinnerungen', title: 'Nichts mehr vergessen.', text: 'Mit Datum, Wiederholung und Kategorie. Fio liest das Datum direkt aus deinem Satz.' },
  { area: 'projects', icon: 'account_tree', name: 'Projekte', title: 'Große Ziele, kleine Schritte.', text: 'Phasen, Aufgaben und Abschnitte. Den ersten Entwurf baut Fio mit dir.' },
  { area: 'calendar', icon: 'calendar_month', name: 'Kalender', title: 'Dein Tag auf einen Blick.', text: 'Dein Google Kalender ist eingebunden, Termine stehen direkt neben deinen Aufgaben.' },
  { area: 'review', icon: 'insights', name: 'Wochenrückblick', title: 'Jede Woche ein kurzer Blick zurück.', text: 'Was lief gut, was ist offen, was kommt als Nächstes.' },
];

function LandingFeatures() {
  const [headRef, headStyle] = useScrollReveal();
  const [rowRef, rowStyle] = useScrollReveal({ delay: 120, distance: 48 });
  const scrollerRef = useRef(null);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <section aria-labelledby="landing-features-title" className="overflow-hidden">
      <div className="mx-auto w-full max-w-content px-4 pb-8 pt-24 md:px-6 lg:pt-32">
        <div ref={headRef} style={headStyle} className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-reading">
            <p className="text-eyebrow text-secondary">Alles an einem Ort</p>
            <h2 id="landing-features-title" className="mt-3 text-display text-primary" style={SECTION_TYPE}>Lern FocusFlow kennen.</h2>
          </div>
          <div className="hidden gap-2 md:flex">
            <IconButton icon="chevron_left" label="Vorherige Karte" variant="secondary" onClick={() => scrollBy(-1)} />
            <IconButton icon="chevron_right" label="Nächste Karte" variant="secondary" onClick={() => scrollBy(1)} />
          </div>
        </div>
      </div>

      <div ref={rowRef} style={rowStyle}>
        {/* Linker Rand fluchtet mit dem Inhalt, rechts laufen die Karten aus dem Bild (zeigt: hier geht es weiter) */}
        <ul
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-24 [--gutter:1rem] md:[--gutter:1.5rem] lg:pb-32"
          style={{ paddingLeft: 'max(var(--gutter), calc((100vw - 1120px) / 2 + var(--gutter)))', paddingRight: 'var(--gutter)', scrollPaddingLeft: 'max(var(--gutter), calc((100vw - 1120px) / 2 + var(--gutter)))' }}
        >
          {FEATURES.map((f) => (
            <li key={f.name} className="flex w-[17.5rem] shrink-0 snap-start flex-col justify-between rounded-lg border border-subtle bg-surface p-6 shadow-sm sm:w-[21rem]" style={{ minHeight: '24rem' }}>
              <div>
                <p className="text-eyebrow text-secondary">{f.name}</p>
                <h3 className="mt-3 text-display text-primary" style={{ ...STEP_TYPE, fontSize: 'clamp(1.5rem, 2.4vw, 2rem)' }}>{f.title}</h3>
                <p className="mt-3 text-secondary" style={LEAD_TYPE}>{f.text}</p>
              </div>
              <IconTile area={f.area} icon={f.icon} size="lg" className="mt-8" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default LandingFeatures;
