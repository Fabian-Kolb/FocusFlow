import { useEffect, useRef, useState } from 'react';

/**
 * Startseite: Inhalt blendet ein, sobald er ins Bild kommt (einmalig). Rückgabe: [ref, style].
 * Bei reduzierter Bewegung nur Einblenden ohne Verschieben (Regel 01).
 */
export default function useScrollReveal({ delay = 0, distance = 32 } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const [reduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const style = {
    opacity: shown ? 1 : 0,
    transform: shown || reduced ? 'none' : `translateY(${distance}px)`,
    transition: `opacity 700ms var(--easing-enter, ease-out) ${delay}ms, transform 900ms var(--easing-enter, ease-out) ${delay}ms`,
  };
  return [ref, style];
}
