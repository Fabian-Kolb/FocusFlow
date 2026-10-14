import React from 'react';
import { Button } from '../../ds';
import useScrollReveal from '../useScrollReveal';
import { LEAD_TYPE, SECTION_TYPE } from './landingType';

/**
 * „Frag Fio“: Fragen-Knöpfe mit je einer festen Antwort (keine KI-Anbindung). Fio selbst ist die freie Figur
 * (FioCompanion); in diesem Abschnitt steht Fio in seinem Bereich (`homeRef`: Desktop rechte Spalte, sticky).
 * „Kann ich dich ausprobieren?“ antwortet mit einem Knopf für den Gast-Zugang in der Sprechblase.
 */

export const FIO_GREETING = 'Hallo, ich bin Fio! Ich helfe dir, Gedanken, Termine und Projekte zu ordnen. Frag mich einfach etwas.';

const QUESTIONS = [
  { q: 'Wer bist du?', a: 'Ich bin Fio, der KI-Assistent von FocusFlow. Ich helfe dir, den Überblick zu behalten.' },
  { q: 'Was kannst du?', a: 'Ich mache aus deinen Gedanken Erinnerungen, Termine oder Projekte und plane mit dir deinen Tag.' },
  { q: 'Wie plane ich meinen Tag?', a: 'Frag mich, was heute dran ist. Ich schaue auf Termine, Erinnerungen und Projekte und nenne dir die zwei, drei wichtigsten Schritte.' },
  { q: 'Wie wird aus einer Idee ein Projekt?', a: 'Halte die Idee als Gedanken fest und lass sie mich ausarbeiten. Ich schlage Phasen und Aufgaben vor, du entscheidest.' },
  { q: 'Bist du eine KI?', a: 'Ja. In der App beantworte ich alles, was du mich fragst. Hier auf der Startseite stelle ich mich nur kurz vor.' },
  { q: 'Kann ich dich ausprobieren?', a: 'Klar! Als Gast kannst du sofort loslegen, ganz ohne Konto.', guest: true },
];

function LandingFio({ sectionRef, homeRef, fioCtlRef, onGuest }) {
  const [headRef, headStyle] = useScrollReveal();
  const [askRef, askStyle] = useScrollReveal({ delay: 120 });

  const ask = (item) => {
    fioCtlRef.current?.say(item.a, {
      think: 500,
      big: true,
      action: item.guest ? { label: 'Als Gast ausprobieren', onClick: onGuest } : null,
    });
  };

  return (
    <section ref={sectionRef} aria-labelledby="landing-fio-title" className="bg-subtle">
      <div className="mx-auto grid w-full max-w-content gap-12 px-4 py-24 md:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:py-32">
        <div className="min-w-0 lg:flex lg:min-h-[70vh] lg:flex-col lg:justify-center">
          <div ref={headRef} style={headStyle}>
            <p className="text-eyebrow text-secondary">Dein Begleiter</p>
            <h2 id="landing-fio-title" className="mt-3 text-display text-primary" style={SECTION_TYPE}>Frag Fio.</h2>
            <p className="mt-4 max-w-md text-secondary" style={LEAD_TYPE}>
              Fio ist der KI-Assistent in FocusFlow. Er hilft dir, Aufgaben zu verstehen und schneller ans Ziel zu kommen. Probier ein paar Fragen aus.
            </p>
          </div>
          <div ref={askRef} style={askStyle} className="mt-10">
            <div className="flex flex-wrap gap-2">
              {QUESTIONS.map((item) => (
                <Button key={item.q} variant="secondary" onClick={() => ask(item)}>{item.q}</Button>
              ))}
            </div>
            <p className="mt-4 text-caption text-tertiary">Du kannst Fio auch antippen oder irgendwohin ziehen.</p>
          </div>
        </div>

        {/* Fios Bereich am Desktop (rechte Spalte). Fio selbst liegt in der fixierten Ebene und steht dort still */}
        <div ref={homeRef} className="hidden lg:block" aria-hidden="true" />
      </div>
    </section>
  );
}

export default LandingFio;
