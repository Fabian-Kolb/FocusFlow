import { useCallback, useEffect, useRef } from 'react';

/**
 * Bedienung wie im Terminal für Chat-Eingaben:
 * - Pfeil hoch / runter blättert durch die eigenen früheren Nachrichten (nur in der ersten bzw. letzten Zeile),
 *   ganz unten kommt der angefangene Text zurück
 * - Strg+U löscht die Eingabe, Esc ebenfalls
 * (Strg+A markiert alles, Pos1/Ende und Strg+Pfeile machen die Textfelder von selbst.)
 *
 * `entries`: frühere Nachrichten, neueste zuerst. Gibt `onKeyDown` zurück, der true liefert, wenn er die Taste behandelt hat.
 */
export function useInputHistory(entries, value, setValue) {
  const index = useRef(-1); // -1 = der aktuelle Entwurf
  const draft = useRef('');

  // Nach dem Senden (neue Nachricht) wieder beim Entwurf anfangen
  useEffect(() => { index.current = -1; }, [entries.length]);

  const show = useCallback((el, text) => {
    setValue(text);
    requestAnimationFrame(() => {
      el.setSelectionRange(text.length, text.length);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
    });
  }, [setValue]);

  const onKeyDown = useCallback((e) => {
    if (e.nativeEvent?.isComposing || e.altKey || e.metaKey) return false;
    const el = e.target;
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      index.current = -1;
      show(el, '');
      return true;
    }
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      index.current = -1;
      show(el, '');
      return true;
    }
    if (e.ctrlKey || e.shiftKey) return false;

    if (e.key === 'ArrowUp') {
      if (el.value.slice(0, el.selectionStart).includes('\n') || entries.length === 0) return false;
      if (index.current === -1) draft.current = value;
      const next = Math.min(index.current + 1, entries.length - 1);
      if (next === index.current) { e.preventDefault(); return true; }
      e.preventDefault();
      index.current = next;
      show(el, entries[next]);
      return true;
    }
    if (e.key === 'ArrowDown') {
      if (index.current === -1 || el.value.slice(el.selectionEnd).includes('\n')) return false;
      e.preventDefault();
      index.current -= 1;
      show(el, index.current === -1 ? draft.current : entries[index.current]);
      return true;
    }
    return false;
  }, [entries, value, show]);

  return onKeyDown;
}
