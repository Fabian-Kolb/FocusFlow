import { useCallback, useEffect, useState } from 'react';

// Hell/Dunkel (Regel 01): <html data-theme="light|dark"> schaltet die Tokens um.
// Gespeichert wird nur eine ausdrückliche Wahl; ohne Wahl folgt die App der Systemeinstellung.
export const THEME_STORAGE_KEY = 'focusflow_theme';
export const THEME_CHOICES = [
  { value: 'system', label: 'System', icon: 'brightness_auto' },
  { value: 'light', label: 'Hell', icon: 'light_mode' },
  { value: 'dark', label: 'Dunkel', icon: 'dark_mode' },
];

const META_COLORS = { light: '#FBF9F9', dark: '#111010' };

export function readThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function systemPrefersDark() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark() ? 'dark' : 'light';
}

export function applyTheme(preference) {
  if (typeof document === 'undefined') return 'light';
  const theme = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
  return theme;
}

export function writeThemePreference(preference) {
  try {
    if (preference === 'light' || preference === 'dark') localStorage.setItem(THEME_STORAGE_KEY, preference);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Privater Modus oder Speicher voll: die Wahl gilt dann nur für diese Sitzung
  }
}

/** Auswahl lesen/ändern. Systemwechsel behandelt main.jsx, solange keine ausdrückliche Wahl gespeichert ist. */
export function useThemePreference() {
  const [preference, setPreference] = useState(readThemePreference);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const choose = useCallback((next) => {
    writeThemePreference(next);
    setPreference(next === 'light' || next === 'dark' ? next : 'system');
  }, []);

  return [preference, choose];
}
