import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCalendarEvents } from '../lib/calendarAPI';
import { MONTH_NAMES } from '../lib/calendarUtils';

const monthKey = (year, month) => `${year}-${month}`;

/** Lesbare Fehlermeldung für den Banner (HTTP-Status, Auth, Netzwerk) */
export function describeCalendarError(err) {
  const msg = String(err?.message || err || '');
  if (/401|403|unauthor|auth|token|permission/i.test(msg)) {
    return 'Die Verbindung zu Google Kalender ist abgelaufen. Bitte verbinde den Kalender neu.';
  }
  if (/failed to fetch|network|load failed|timeout/i.test(msg)) {
    return 'Der Server ist gerade nicht erreichbar.';
  }
  return 'Die Kalenderdaten konnten nicht geladen werden.';
}

/**
 * Lädt und cached Termine pro Monat (aktueller, vorheriger, nächster Monat parallel).
 *
 * Zustände:
 * - `isLoading`: aktueller Monat ist noch nicht geladen und es läuft ein Abruf
 * - `isOffline`: Gerät meldet keine Verbindung; bereits geladene Termine bleiben sichtbar
 * - `error`: Abruf des aktuellen Monats ist fehlgeschlagen (Text für den Banner)
 * - `retry()`: verwirft Fehler und lädt fehlgeschlagene Monate erneut (auch automatisch beim Zurückkehren online)
 * - `reloadMonth(year, month)`: erneuter Abruf nach Speichern/Löschen
 */
export function useCalendarEvents({ enabled, year, month, prevYear, prevMonth, nextYear, nextMonth }) {
  const [cache, setCache] = useState({});
  const [failed, setFailed] = useState({}); // { [key]: Fehlertext }
  const [loadingKeys, setLoadingKeys] = useState({});
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [retryTick, setRetryTick] = useState(0);

  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const failedRef = useRef(failed);
  failedRef.current = failed;
  const fetching = useRef(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const setLoading = useCallback((key, value) => {
    setLoadingKeys((prev) => {
      if (value) return { ...prev, [key]: true };
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const load = useCallback(async (y, m) => {
    const key = monthKey(y, m);
    if (fetching.current.has(key)) return;
    fetching.current.add(key);
    setLoading(key, true);
    try {
      const events = await fetchCalendarEvents(y, m);
      if (!mounted.current) return;
      setCache((prev) => ({ ...prev, [key]: events || [] }));
      setFailed((prev) => {
        if (!(key in prev)) return prev;
        const { [key]: _removed, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.warn(`[Calendar] Fehler beim Laden von ${key}:`, err);
      if (mounted.current) setFailed((prev) => ({ ...prev, [key]: describeCalendarError(err) }));
    } finally {
      fetching.current.delete(key);
      if (mounted.current) setLoading(key, false);
    }
  }, [setLoading]);

  // Aktuellen, vorherigen und nächsten Monat laden (fehlgeschlagene erst wieder nach retry())
  useEffect(() => {
    if (!enabled) return;
    [[year, month], [prevYear, prevMonth], [nextYear, nextMonth]].forEach(([y, m]) => {
      const key = monthKey(y, m);
      if (!cacheRef.current[key] && !failedRef.current[key]) load(y, m);
    });
  }, [enabled, year, month, prevYear, prevMonth, nextYear, nextMonth, retryTick, load]);

  const retry = useCallback(() => {
    setFailed({});
    setRetryTick((t) => t + 1);
  }, []);

  // Online/Offline mitverfolgen; beim Zurückkehren online automatisch neu versuchen
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      retry();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [retry]);

  const reloadMonth = useCallback(async (y, m) => {
    const key = monthKey(y, m);
    const events = await fetchCalendarEvents(y, m);
    setCache((prev) => ({ ...prev, [key]: events || [] }));
    setFailed((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const currentKey = monthKey(year, month);
  const error = failed[currentKey] || null;
  const hasCurrent = Boolean(cache[currentKey]);

  return {
    eventsCache: cache,
    error: error ? `${error} (${MONTH_NAMES[month]} ${year})` : null,
    isOffline,
    isLoading: !hasCurrent && !error && Boolean(loadingKeys[currentKey]),
    retry,
    reloadMonth,
  };
}
