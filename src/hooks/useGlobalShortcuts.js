import { useEffect, useRef } from 'react';
import { NAV_COMMANDS, ACTION_COMMANDS, isTypingTarget } from '../lib/appCommands';

const SEQUENCE_TIMEOUT_MS = 1200;

/**
 * Globale Tastenkürzel (PC):
 *  - Strg/⌘ + K  → Befehlsleiste (funktioniert auch beim Tippen)
 *  - /           → Befehlsleiste
 *  - g, dann h/i/e/p/b/k/f/r/t → Navigation
 *  - n / e / p / , / ? → Aktionen (siehe ACTION_COMMANDS)
 *  - 1 bis 9   → Umgebung wechseln (in der Reihenfolge der Umschalter-Liste)
 * Einzeltasten greifen nicht beim Tippen und nicht, solange ein Dialog offen ist.
 */
export function useGlobalShortcuts({ enabled, isBlocked, onOpenPalette, onNavigate, onAction, onEnvironment }) {
  const pendingG = useRef(null);
  const handlers = useRef({ isBlocked, onOpenPalette, onNavigate, onAction, onEnvironment });
  handlers.current = { isBlocked, onOpenPalette, onNavigate, onAction, onEnvironment };

  useEffect(() => {
    if (!enabled) return undefined;

    const clearPending = () => {
      clearTimeout(pendingG.current);
      pendingG.current = null;
    };

    const onKeyDown = (e) => {
      const h = handlers.current;
      if (e.defaultPrevented || e.isComposing) return;

      // Strg/⌘ + K: überall, außer ein anderer Dialog ist offen
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        if (h.isBlocked()) return;
        e.preventDefault();
        h.onOpenPalette();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || h.isBlocked()) {
        clearPending();
        return;
      }

      const key = e.key;

      if (pendingG.current) {
        clearPending();
        const nav = NAV_COMMANDS.find((c) => c.key === key.toLowerCase());
        if (nav) {
          e.preventDefault();
          h.onNavigate(nav.screen);
        }
        return;
      }

      if (key === 'g' || key === 'G') {
        pendingG.current = setTimeout(clearPending, SEQUENCE_TIMEOUT_MS);
        return;
      }

      if (/^[1-9]$/.test(key) && h.onEnvironment) {
        if (h.onEnvironment(Number(key))) e.preventDefault();
        return;
      }

      if (key === '/') {
        e.preventDefault();
        h.onOpenPalette();
        return;
      }

      const action = ACTION_COMMANDS.find((c) => c.key === key || (key.length === 1 && c.key === key.toLowerCase()));
      if (action) {
        e.preventDefault();
        h.onAction(action.action);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearPending();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
