import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../ds';
import useScrollReveal from '../useScrollReveal';
import { LEAD_TYPE, SECTION_TYPE } from './landingType';

/**
 * Produkt in Aktion: großes Video über die ganze Inhaltsbreite. Läuft stumm in Schleife, sobald es im Bild ist (lädt erst
 * dann), ohne Steuerleiste. „Mit Ton ansehen“ startet von vorn mit Ton und Steuerleiste. Beim Hereinscrollen wächst es von
 * 92 % auf volle Größe. Bei reduzierter Bewegung kein automatisches Abspielen und kein Wachsen, nur der Knopf.
 */
function LandingVideo() {
  const [headRef, headStyle] = useScrollReveal();
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const [withSound, setWithSound] = useState(false);
  const [reduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // Stumm abspielen, solange das Video sichtbar ist
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced || withSound || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [reduced, withSound]);

  // Wachsen beim Hereinscrollen (nur Skalierung, kein Mitlaufen)
  useEffect(() => {
    const el = frameRef.current;
    if (!el || reduced) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
      el.style.transform = `scale(${(0.92 + 0.08 * p).toFixed(4)})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [reduced]);

  const playWithSound = () => {
    const v = videoRef.current;
    if (!v) return;
    setWithSound(true);
    v.muted = false;
    v.loop = false;
    v.controls = true;
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  return (
    <section aria-labelledby="landing-video-title" className="bg-subtle">
      <div className="mx-auto w-full max-w-content px-4 py-24 md:px-6 lg:py-32">
        <div ref={headRef} style={headStyle} className="mx-auto max-w-reading text-center">
          <p className="text-eyebrow text-secondary">In Aktion</p>
          <h2 id="landing-video-title" className="mt-3 text-display text-primary" style={SECTION_TYPE}>Einmal ansehen.<br />Alles verstanden.</h2>
          <p className="mt-4 text-secondary" style={LEAD_TYPE}>FocusFlow in 30 Sekunden: vom ersten Gedanken bis zum erledigten Tag.</p>
        </div>
        <div ref={frameRef} className="relative mt-12 origin-center lg:mt-16">
          <video
            ref={videoRef}
            className="block w-full rounded-lg border border-subtle bg-muted shadow-lg"
            src="/focusflow-intro.mp4"
            poster="/focusflow-intro-poster.jpg"
            muted
            loop
            playsInline
            preload="none"
            aria-label="Kurzvorstellung von FocusFlow"
          >
            Dein Browser kann dieses Video nicht abspielen.
          </video>
          {!withSound && (
            <div className="absolute bottom-4 right-4">
              <Button variant="secondary" size="sm" leadingIcon={reduced ? 'play_arrow' : 'volume_up'} onClick={playWithSound}>
                {reduced ? 'Video abspielen' : 'Mit Ton ansehen'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default LandingVideo;
