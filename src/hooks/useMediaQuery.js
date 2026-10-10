import { useEffect, useState } from 'react';

const read = (query, fallback) => {
  if (typeof window === 'undefined') return fallback;
  if (typeof window.matchMedia === 'function') return window.matchMedia(query).matches;
  // Umgebungen ohne matchMedia (Tests): Mindestbreite aus der Abfrage mit der Fensterbreite vergleichen
  const min = /min-width:\s*(\d+)px/.exec(query);
  return min ? window.innerWidth >= Number(min[1]) : fallback;
};

/** Gilt die Media Query (z. B. `(min-width: 768px)`)? Aktualisiert sich beim Drehen und Skalieren. */
export function useMediaQuery(query, fallback = false) {
  const [matches, setMatches] = useState(() => read(query, fallback));

  useEffect(() => {
    setMatches(read(query, fallback));
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      const onResize = () => setMatches(read(query, fallback));
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query, fallback]);

  return matches;
}
