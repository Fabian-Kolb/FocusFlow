import { useState, useCallback } from 'react';

/** Auswahl (z. B. Sortier-Modus), die im localStorage gemerkt wird; nur erlaubte Werte werden übernommen */
export function usePersistedChoice(storageKey, allowedValues, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (allowedValues.includes(stored)) return stored;
    } catch {
      // Storage gesperrt – Standardwert
    }
    return fallback;
  });

  const update = useCallback((next) => {
    setValue(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // gilt dann nur für diese Sitzung
    }
  }, [storageKey]);

  return [value, update];
}
