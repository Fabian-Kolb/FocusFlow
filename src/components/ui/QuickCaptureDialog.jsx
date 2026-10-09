import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { buildThought } from '../../lib/thoughts';
import { Button, Dialog, Kbd } from '../ds';

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

  useEffect(() => {
    if (!open) return undefined;
    setText('');
    const t = setTimeout(() => textareaRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text, open]);

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
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Gedanken festhalten"
      footer={<Button onClick={save} disabled={!text.trim()}>Speichern</Button>}
    >
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          rows={2}
          aria-label="Was geht dir durch den Kopf?"
          placeholder="Was geht dir durch den Kopf?"
          className="w-full resize-none rounded-md border border-control bg-surface px-3 py-2.5 text-body text-primary placeholder:text-tertiary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <p className="flex flex-wrap items-center gap-1.5 text-caption text-tertiary">
          <Kbd>Enter</Kbd> speichert · <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> neue Zeile
        </p>
      </div>
    </Dialog>
  );
}
