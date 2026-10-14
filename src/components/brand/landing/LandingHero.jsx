import React from 'react';
import { Button } from '../../ds';
import useScrollReveal from '../useScrollReveal';
import { HERO_TYPE, LEAD_TYPE } from './landingType';

/**
 * Erster Bildschirm der Startseite: die 3D-Wörter als Blickfang (Platzhalter, die Wörter selbst liegen in der fixierten
 * Ebene von Login.jsx), darunter Aussage und Knöpfe. Hauptknopf ist „Als Gast ausprobieren“ (blau, startet etwas).
 * `fioAnchorRef`: Platz, an dem Fio im ersten Bildschirm steht und winkt (Höhe = Fios Größe).
 */
function LandingHero({ focusSlotRef, flowSlotRef, fioAnchorRef, onGuest, onSignIn, guestDisabled }) {
  const [textRef, textStyle] = useScrollReveal({ delay: 250 });
  return (
    <section aria-labelledby="landing-title" className="relative flex min-h-screen flex-col items-center justify-center px-4 pb-10 pt-16 md:px-6 md:pb-16 md:pt-20">
      {/* Handy: FOCUS über FLOW, ab md nebeneinander */}
      <div className="flex w-full max-w-content flex-col items-center md:flex-row md:justify-center md:gap-2">
        <div ref={focusSlotRef} aria-hidden="true" className="-mb-5 aspect-[400/165] w-full max-w-[18rem] sm:max-w-[24rem] md:mb-0 md:max-w-[30rem] md:flex-1" />
        <div ref={flowSlotRef} aria-hidden="true" className="aspect-[400/165] w-full max-w-[18rem] sm:max-w-[24rem] md:max-w-[30rem] md:flex-1" />
      </div>

      <div ref={textRef} style={textStyle} className="mt-6 flex max-w-reading flex-col items-center text-center md:mt-10">
        <h1 id="landing-title" className="text-display text-primary" style={HERO_TYPE}>
          Kopf frei.<br />Fio macht den Rest.
        </h1>
        <p className="mt-5 text-secondary" style={LEAD_TYPE}>
          Halte Gedanken fest, wie sie kommen. Fio macht daraus Erinnerungen, Termine und Projekte.
        </p>
        {/* Fio steht ab md rechts neben den Knöpfen, auf dem Handy darunter */}
        <div className="relative mt-6 flex w-full flex-col items-center sm:w-auto md:mt-8">
          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" leadingIcon="explore" onClick={onGuest} disabled={guestDisabled} className="w-full sm:w-auto">
              Als Gast ausprobieren
            </Button>
            <Button size="lg" variant="secondary" onClick={onSignIn} className="w-full sm:w-auto">
              Anmelden
            </Button>
          </div>
          <p className="mt-3 text-caption text-tertiary">Ohne Konto, sofort im Browser.</p>
          <div ref={fioAnchorRef} aria-hidden="true" className="mt-4 h-24 w-24 md:absolute md:bottom-0 md:left-full md:ml-6 md:mt-0 md:h-32 md:w-32" />
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
