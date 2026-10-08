import React, { useEffect, useId, useRef, useState } from 'react';
import { AI_MODELS } from './ModelSelectorDropdown';
import { SUMMARY_LENGTH_OPTIONS } from './SummaryLengthDropdown';

/**
 * KI-Einstellungen für Gedanken an einer festen Stelle statt Checkbox + zwei Dropdowns, die plötzlich erscheinen.
 * - variant="chip":  Beschriftung „KI-Zusammenfassung · Präzise“ (Desktop, Popover öffnet nach unten)
 * - variant="icon":  nur das Icon (Handy, schwebende Eingabe am unteren Rand, Popover öffnet nach oben)
 * Ein Klick öffnet ein Popover mit allen Einstellungen (an/aus, Länge, Modell).
 */
export default function ThoughtAiChip({
  enabled,
  onEnabledChange,
  length,
  onLengthChange,
  model,
  onModelChange,
  variant = 'chip',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const modelId = useId();
  const isIcon = variant === 'icon';

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const lengthName = (SUMMARY_LENGTH_OPTIONS.find((o) => o.id === length) || SUMMARY_LENGTH_OPTIONS[1]).name;

  return (
    <div ref={rootRef} className="relative shrink-0">
      {isIcon ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={enabled ? `KI-Zusammenfassung an, ${lengthName}` : 'KI-Zusammenfassung aus'}
          className={`w-11 h-11 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            enabled ? 'border-outline-variant text-primary hover:border-primary' : 'border-outline-variant text-on-surface-variant/60 hover:border-primary'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] ${enabled ? '' : 'opacity-40'}`} aria-hidden="true">auto_awesome</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-md border border-outline-variant bg-surface-low text-xs font-semibold text-primary hover:border-primary transition-colors cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[16px] ${enabled ? '' : 'opacity-40'}`} aria-hidden="true">auto_awesome</span>
          <span>{enabled ? `KI-Zusammenfassung · ${lengthName}` : 'KI-Zusammenfassung aus'}</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="KI-Einstellungen für Gedanken"
          className={`absolute z-30 w-[min(20rem,calc(100vw-2rem))] bg-white border border-outline-variant rounded-xl shadow-raised p-4 space-y-4 ${
            isIcon ? '-right-[3.25rem] bottom-full mb-2' : 'left-0 top-full mt-2'
          }`}
        >
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span>
              <span className="block text-sm font-semibold">KI-Zusammenfassung</span>
              <span className="block text-xs text-on-surface-variant">Fasst zusammen und erkennt Termine.</span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input
                type="checkbox"
                role="switch"
                checked={enabled}
                onChange={(e) => onEnabledChange(e.target.checked)}
                className="peer sr-only"
              />
              <span className="w-11 h-6 rounded-full bg-outline-variant peer-checked:bg-accent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
              <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>

          <fieldset className={enabled ? '' : 'opacity-50 pointer-events-none'} disabled={!enabled}>
            <legend className="text-xs font-semibold text-on-surface-variant mb-1.5">Länge</legend>
            <div className="grid grid-cols-3 gap-1 p-1 bg-surface-low rounded-lg" role="radiogroup" aria-label="Länge der Zusammenfassung">
              {SUMMARY_LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={length === opt.id}
                  onClick={() => onLengthChange(opt.id)}
                  className={`h-8 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    length === opt.id ? 'bg-white text-primary shadow-sm border border-outline-variant' : 'border border-transparent text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
            <label htmlFor={modelId} className="block text-xs font-semibold text-on-surface-variant mb-1.5">Modell</label>
            <select
              id={modelId}
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={!enabled}
              className="w-full h-10 rounded-lg border border-outline-variant bg-white text-sm px-3 focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.id === 'eco' ? 'Eco (Standard)' : m.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
