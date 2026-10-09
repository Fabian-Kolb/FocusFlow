import React from 'react';
import { NAV_COMMANDS, ACTION_COMMANDS, PALETTE_KEYS } from '../../lib/appCommands';
import { KeyHint } from './CommandPalette';
import { Dialog, SectionHeader } from '../ds';

function Row({ label, keys }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-body text-primary">
      <span>{label}</span>
      <KeyHint keys={keys} />
    </li>
  );
}

/** Übersicht aller Tastenkürzel (Taste „?“) */
export default function ShortcutsHelp({ open, onClose }) {
  const general = [
    { label: 'Befehlsleiste öffnen', keys: PALETTE_KEYS },
    { label: 'Befehlsleiste öffnen', keys: '/' },
    { label: 'Letzte Änderung rückgängig', keys: 'Strg Z' },
    ...ACTION_COMMANDS.filter((c) => c.action !== 'shortcuts').map((c) => ({ label: c.label, keys: c.keys })),
    { label: 'Diese Übersicht', keys: '?' },
  ];

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Tastenkürzel">
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <section>
            <SectionHeader title="Allgemein" />
            <ul>{general.map((r, i) => <Row key={i} {...r} />)}</ul>
          </section>
          <section>
            <SectionHeader title="Gehe zu" />
            <ul>{NAV_COMMANDS.map((c) => <Row key={c.screen} label={c.label} keys={c.keys} />)}</ul>
          </section>
        </div>
        <p className="text-caption text-tertiary">
          Einzeltasten funktionieren nicht, während du in ein Feld tippst. „g h“ heißt: erst <strong className="text-secondary">g</strong>, dann <strong className="text-secondary">h</strong>.
        </p>
      </div>
    </Dialog>
  );
}
