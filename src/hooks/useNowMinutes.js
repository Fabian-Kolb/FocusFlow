import { useEffect, useState } from 'react';

const minutesNow = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

/** Minuten seit Mitternacht, jede Minute aktualisiert (für die „Jetzt“-Linie); läuft nur, wenn `active` */
export function useNowMinutes(active = true) {
  const [minutes, setMinutes] = useState(minutesNow);

  useEffect(() => {
    if (!active) return undefined;
    setMinutes(minutesNow());
    const interval = setInterval(() => setMinutes(minutesNow()), 60000);
    return () => clearInterval(interval);
  }, [active]);

  return minutes;
}
