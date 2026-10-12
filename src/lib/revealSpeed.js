import { useCallback, useState } from 'react';

// Geschwindigkeit der Animation nach dem Login (LoginReveal). Gilt je Gerät, weil der Login vor dem Konto läuft.
export const REVEAL_SPEED_KEY = 'focusflow_reveal_speed';
export const DEFAULT_REVEAL_SPEED = 'medium';

// `factor` streckt alle Zeiten der Animation (kleiner = schneller). `typicalMs`: Gesamtdauer am Desktop, nur zur Anzeige.
export const REVEAL_TYPICAL_MS = 1300;
export const REVEAL_SPEEDS = [
  { value: 'fast', label: 'Schnell', icon: 'fast_forward', factor: 0.7 },
  { value: 'medium', label: 'Mittel', icon: 'play_arrow', factor: 1 },
  { value: 'slow', label: 'Langsam', icon: 'slow_motion_video', factor: 1.5 },
];

const isValid = (value) => REVEAL_SPEEDS.some((s) => s.value === value);

export function readRevealSpeed() {
  try {
    const stored = localStorage.getItem(REVEAL_SPEED_KEY);
    return isValid(stored) ? stored : DEFAULT_REVEAL_SPEED;
  } catch {
    return DEFAULT_REVEAL_SPEED;
  }
}

export function writeRevealSpeed(speed) {
  try {
    if (speed === DEFAULT_REVEAL_SPEED || !isValid(speed)) localStorage.removeItem(REVEAL_SPEED_KEY);
    else localStorage.setItem(REVEAL_SPEED_KEY, speed);
  } catch {
    // Privater Modus oder Speicher voll: die Wahl gilt dann nur für diese Sitzung
  }
}

export function revealFactor(speed = readRevealSpeed()) {
  return (REVEAL_SPEEDS.find((s) => s.value === speed) || REVEAL_SPEEDS[1]).factor;
}

/** Anzeige der ungefähren Dauer, z. B. „ca. 1,3 s“ */
export function revealDurationLabel(speed) {
  const seconds = (REVEAL_TYPICAL_MS * revealFactor(speed)) / 1000;
  return `ca. ${seconds.toFixed(1).replace('.', ',')} s`;
}

/** Auswahl lesen/ändern (Einstellungen) */
export function useRevealSpeed() {
  const [speed, setSpeed] = useState(readRevealSpeed);
  const choose = useCallback((next) => {
    writeRevealSpeed(next);
    setSpeed(isValid(next) ? next : DEFAULT_REVEAL_SPEED);
  }, []);
  return [speed, choose];
}
