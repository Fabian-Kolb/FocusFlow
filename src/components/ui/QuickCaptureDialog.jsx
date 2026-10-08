import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { buildThought } from '../../lib/thoughts';

/**
 * Schnellerfassung (Taste „n“): Gedanken von jedem Screen aus notieren, ohne die Ansicht zu wechseln.
 * Enter speichert, Shift+Enter macht eine neue Zeile, Esc schließt.
 * Die KI-Zusammenfassung läuft im Hintergrund – der Dialog ist sofort wieder zu.
 */
export default function QuickCaptureDialog({ open, onClose, onOpenThoughts }) {
  const { addInboxItem } = useData();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    setText('');
    const t = setTimeout(() => textareaRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      previousFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  if (!open) return null;

  const save = () => {
    const value = text.trim();
    if (!value) return;
    onClose();
    (async () => {
      try {
        const thought = await buildThought(value, { summarize: !user?.isGuest });
        await addInboxItem(thought);
        showToast({ message: 'Gedanke gespeichert', icon: 'lightbulb', actionLabel: 'Ansehen', onAction: onOpenThoughts });
      } catch (err) {
        console.error('Schnellerfassung fehlgeschlagen:', err);
        showToast({ message: 'Gedanke konnte nicht gespeichert werden', icon: 'error' });
      }
    })();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-[2px] px-3 pt-[14vh] animate-fadeIn"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-outline-variant p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[20px]">lightbulb</span>
          <h2 id="quick-capture-title" className="text-sm font-bold">Gedanken festhalten</h2>
        </div>
        <textarea
          ref={textareaRef}
          rows={2}
          placeholder="Was geht dir durch den Kopf?"
          className="w-full resize-none rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-on-surface-variant"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="flex items-center justify-between gap-3 text-[11px] text-on-surface-variant">
          <span>
            <kbd className="font-sans font-semibold">Enter</kbd> speichern · <kbd className="font-sans font-semibold">Shift+Enter</kbd> neue Zeile
          </span>
          <button
            type="button"
            onClick={save}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
