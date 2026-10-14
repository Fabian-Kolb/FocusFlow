import React, { useCallback, useEffect, useRef, useState } from 'react';
import FioCompanion from '../fio/FioCompanion';
import LandingHero from './LandingHero';
import LandingVideo from './LandingVideo';
import LandingSteps from './LandingSteps';
import LandingFio, { FIO_GREETING } from './LandingFio';
import LandingFeatures from './LandingFeatures';
import LandingClosing from './LandingClosing';

/**
 * Startseite (ohne Login): erster Bildschirm mit den 3D-Wörtern, Video, drei Schritte, Fio zum Ausfragen,
 * Funktions-Karten, Abschluss mit Footer. Die 3D-Wörter selbst und das Anmelden liegen in Login.jsx.
 *
 * Fios Platz: oben (Seite ganz oben) neben den Knöpfen, im Fio-Abschnitt in seinem Bereich, sonst in der Ecke.
 * Er begrüßt einmal oben und einmal in seinem Bereich.
 */
function Landing({ focusSlotRef, flowSlotRef, onGuest, onSignIn, onShowTerms, isDark, onToggleTheme, leaving }) {
  const heroAnchorRef = useRef(null);
  const homeRef = useRef(null);
  const fioSectionRef = useRef(null);
  const fioCtlRef = useRef(null);
  const footerRef = useRef(null);
  const [atTop, setAtTop] = useState(() => window.scrollY < 40);
  const [fioActive, setFioActive] = useState(false);
  const greeted = useRef({ hero: false, home: false });

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = fioSectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setFioActive(entry.isIntersecting), { rootMargin: '-35% 0px -35% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const place = fioActive ? 'home' : atTop ? 'hero' : 'corner';

  const onArrive = useCallback((p) => {
    const ctl = fioCtlRef.current;
    if (!ctl || (p !== 'hero' && p !== 'home') || greeted.current[p]) return;
    greeted.current[p] = true;
    ctl.boop();
    ctl.say(p === 'hero' ? 'Hallo, ich bin Fio!' : FIO_GREETING, { big: p === 'home' });
  }, []);

  return (
    <>
      <LandingHero focusSlotRef={focusSlotRef} flowSlotRef={flowSlotRef} fioAnchorRef={heroAnchorRef} onGuest={onGuest} onSignIn={onSignIn} guestDisabled={leaving} />
      <LandingVideo />
      <LandingSteps />
      <LandingFio sectionRef={fioSectionRef} homeRef={homeRef} fioCtlRef={fioCtlRef} onGuest={onGuest} />
      <LandingFeatures />
      <LandingClosing onGuest={onGuest} onSignIn={onSignIn} onShowTerms={onShowTerms} isDark={isDark} onToggleTheme={onToggleTheme} footerRef={footerRef} guestDisabled={leaving} />
      <FioCompanion place={place} anchors={{ hero: heroAnchorRef, home: homeRef, footer: footerRef }} hidden={leaving} controlRef={fioCtlRef} onArrive={onArrive} />
    </>
  );
}

export default Landing;
