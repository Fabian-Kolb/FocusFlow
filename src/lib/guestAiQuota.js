// Anzeige des Gast-Kontingents für KI-Funktionen. Nur Anzeige: Der Server zählt und entscheidet.
// Werte kommen aus den Antwort-Headern X-Guest-Ai-Remaining / X-Guest-Ai-Limit.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'focusflow_guest_ai_quota';
export const GUEST_AI_DEFAULT_LIMIT = 10;

const today = () => new Date().toDateString();
const listeners = new Set();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.day === today() && Number.isInteger(saved.remaining) && Number.isInteger(saved.limit)) {
      return saved;
    }
  } catch {
    // ignorieren
  }
  return null;
}

let state = load();

export function getGuestAiQuota() {
  if (state && state.day !== today()) state = null;
  return state;
}

export function recordGuestAiQuota(response) {
  const remaining = Number.parseInt(response?.headers?.get?.('X-Guest-Ai-Remaining'), 10);
  const limit = Number.parseInt(response?.headers?.get?.('X-Guest-Ai-Limit'), 10);
  if (!Number.isInteger(remaining) || !Number.isInteger(limit)) return;
  state = { day: today(), remaining, limit };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignorieren
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** { remaining, limit } für heute oder null, solange noch nichts bekannt ist */
export function useGuestAiQuota() {
  return useSyncExternalStore(subscribe, getGuestAiQuota, () => null);
}
