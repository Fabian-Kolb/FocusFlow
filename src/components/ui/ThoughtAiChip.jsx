import React, { useEffect, useRef, useState } from 'react';
import { AI_MODELS } from './ModelSelectorDropdown';
import { SUMMARY_LENGTH_OPTIONS } from './SummaryLengthDropdown';
import { Button, Chip, Field, FioMark, IconButton, Select, Switch, cx } from '../ds';

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
        <IconButton
          variant="secondary"
          size="lg"
          icon="tune"
          label={enabled ? `KI-Zusammenfassung an, ${lengthName}` : 'KI-Zusammenfassung aus'}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cx(!enabled && 'text-tertiary')}
        />
      ) : (
        <Button
          variant="secondary"
          size="sm"
          trailingIcon={open ? 'expand_less' : 'expand_more'}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <FioMark size={16} className={cx(!enabled && 'opacity-40')} />
          {enabled ? `KI-Zusammenfassung · ${lengthName}` : 'KI-Zusammenfassung aus'}
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="KI-Einstellungen für Gedanken"
          className={cx(
            'absolute z-dropdown w-[min(20rem,calc(100vw-2rem))] space-y-4 rounded-lg border border-subtle bg-raised p-4 shadow-md',
            isIcon ? '-right-[3.25rem] bottom-full mb-2' : 'left-0 top-full mt-2',
          )}
        >
          <Switch
            checked={enabled}
            onChange={onEnabledChange}
            label="KI-Zusammenfassung"
            description="Fasst zusammen und erkennt Termine."
            className="w-full justify-between flex-row-reverse"
          />

          <fieldset className={cx('space-y-1.5', !enabled && 'pointer-events-none opacity-50')} disabled={!enabled}>
            <legend className="mb-1.5 text-label text-primary">Länge</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Länge der Zusammenfassung">
              {SUMMARY_LENGTH_OPTIONS.map((opt) => (
                <Chip key={opt.id} selected={length === opt.id} role="radio" aria-checked={length === opt.id} onClick={() => onLengthChange(opt.id)}>
                  {opt.name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <Field label="Modell" className={cx(!enabled && 'pointer-events-none opacity-50')}>
            <Select size="sm" value={model} onChange={(e) => onModelChange(e.target.value)} disabled={!enabled}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.id === 'eco' ? 'Eco (Standard)' : m.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}
