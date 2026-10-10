import { useEffect } from 'react';
import { getInitialScrollMinutes } from '../lib/calendarUtils';

/** Scrollt ein Zeitraster beim Öffnen sinnvoll: heute eine Stunde vor jetzt, sonst vor den ersten Termin, sonst 08:00 */
export function useTimeGridScroll(scrollRef, { enabled = true, days, getEventsForDate, pxPerHour, resetKey, ready = true }) {
  useEffect(() => {
    if (!enabled || !ready || !scrollRef.current) return;
    const n = new Date();
    const minutes = getInitialScrollMinutes(days, getEventsForDate, n.getHours() * 60 + n.getMinutes());
    scrollRef.current.scrollTop = (minutes / 60) * pxPerHour;
    // Nur beim Wechsel von Ansicht/Zeitraum neu positionieren, nicht bei jedem Neuladen der Termine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, resetKey, pxPerHour]);
}
