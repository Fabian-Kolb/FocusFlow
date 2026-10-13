import React, { useEffect, useRef } from 'react';
import useScrollReveal from './useScrollReveal';

/**
 * Startseite, erster Abschnitt unter dem Login: großes Erklär-Video über die ganze Inhaltsbreite.
 * Überschrift blendet beim Scrollen ein, das Video wächst beim Hereinscrollen leicht auf volle Größe.
 * Kein Autoplay mit Ton: das Video lädt erst beim Abspielen (preload none) und zeigt bis dahin das Vorschaubild.
 */
function LoginIntroVideo() {
  const [headRef, headStyle] = useScrollReveal();
  const frameRef = useRef(null);

  // Video wächst von 92 % auf 100 %, solange es ins Bild scrollt (nur Skalierung, kein Mitlaufen)
  useEffect(() => {
    const el = frameRef.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.7)));
      el.style.transform = `scale(${(0.92 + 0.08 * p).toFixed(4)})`;
      el.style.opacity = (0.35 + 0.65 * p).toFixed(3);
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
  }, []);

  return (
    <section aria-labelledby="intro-video-title" className="mx-auto w-full max-w-content px-4 pb-24 pt-16 md:px-6 lg:pt-24">
      <div ref={headRef} style={headStyle} className="mx-auto max-w-reading text-center">
        <p className="text-eyebrow text-secondary">So funktioniert FocusFlow</p>
        <h2 id="intro-video-title" className="mt-3 text-display text-primary">FocusFlow in 30 Sekunden</h2>
        <p className="mt-4 text-body-lg text-secondary">
          Gedanken festhalten, Fio ordnet sie, und aus ihnen werden Erinnerungen, Termine und Projekte. Probier es direkt im Browser aus.
        </p>
      </div>
      <div ref={frameRef} className="mt-10 origin-center lg:mt-14">
        <video
          className="block w-full rounded-lg border border-subtle bg-muted shadow-lg"
          src="/focusflow-intro.mp4"
          poster="/focusflow-intro-poster.jpg"
          controls
          playsInline
          preload="none"
        >
          Dein Browser kann dieses Video nicht abspielen.
        </video>
      </div>
    </section>
  );
}

export default LoginIntroVideo;
