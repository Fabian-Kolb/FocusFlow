import React, { useEffect } from 'react';
import { NAV_COMMANDS, ACTION_COMMANDS, PALETTE_KEYS } from '../../lib/appCommands';
import { KeyHint } from './CommandPalette';

function Row({ label, keys }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm text-primary">
      <span>{label}</span>
      <KeyHint keys={keys} />
    </li>
  );
}

/** Übersicht aller Tastenkürzel (Taste „?“) */
export default function ShortcutsHelp({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const general = [
    { label: 'Befehlsleiste öffnen', keys: PALETTE_KEYS },
    { label: 'Befehlsleiste öffnen', keys: '/' },
    { label: 'Letzte Änderung rückgängig', keys: 'Strg Z' },
    ...ACTION_COMMANDS.filter((c) => c.action !== 'shortcuts').map((c) => ({ label: c.label, keys: c.keys })),
    { label: 'Diese Übersicht', keys: '?' },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fadeIn"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-outline-variant max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h2 id="shortcuts-title" className="text-base font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">keyboard</span>
            Tastenkürzel
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-low cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 px-5 py-4">
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Allgemein</h3>
            <ul>{general.map((r, i) => <Row key={i} {...r} />)}</ul>
          </section>
          <section className="mt-4 sm:mt-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Gehe zu</h3>
            <ul>{NAV_COMMANDS.map((c) => <Row key={c.screen} label={c.label} keys={c.keys} />)}</ul>
          </section>
        </div>
        <p className="px-5 pb-4 text-[11px] text-on-surface-variant">
          Einzeltasten funktionieren nicht, während du in ein Feld tippst. „g h“ heißt: erst <strong>g</strong>, dann <strong>h</strong>.
        </p>
      </div>
    </div>
  );
}
