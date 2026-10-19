import React, { useEffect, useId, useRef, useState } from 'react';
import { MAX_SETTINGS, SETTING_SUGGESTIONS } from '../../lib/gym';
import { Button, Chip, FOCUS, Field, Icon, IconButton, Input, Sheet, cx } from '../ds';

/**
 * Einstellungen einer Übung (Sitzhöhe, Loch, Position …), frei wählbar als Bezeichnung und Wert.
 * In der Karte stehen sie als kurze Zeile; Tippen öffnet ein Panel, in dem jede Änderung sofort gespeichert wird:
 * Werte direkt ändern, Einträge entfernen, unten neue hinzufügen (Vorschläge oder eigene Bezeichnung).
 * Sie gehören zur Übung und stehen beim nächsten Training wieder da.
 */
export default function ExerciseSetup({ exercise, knownLabels = [], onSave }) {
  const [open, setOpen] = useState(false);
  const settings = exercise.settings || [];

  return (
    <>
      {settings.length === 0 ? (
        <div>
          <Button variant="ghost" size="sm" leadingIcon="tune" onClick={() => setOpen(true)}>Einstellung hinzufügen</Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Einstellungen von ${exercise.name}: ${settings.map((s) => `${s.label} ${s.value}`).join(', ')}. Ändern`}
          className={cx('-mx-1 flex w-full flex-wrap items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-hover', FOCUS)}
        >
          {settings.map((s) => (
            <span key={s.label} className="inline-flex h-7 items-center gap-1 rounded-sm bg-subtle px-2 text-label-sm">
              <span className="text-secondary">{s.label}</span>
              <span className="text-primary">{s.value || '–'}</span>
            </span>
          ))}
          <Icon name="edit" size="sm" className="ml-1 text-tertiary" />
        </button>
      )}
      <SetupSheet open={open} onClose={() => setOpen(false)} exercise={exercise} knownLabels={knownLabels} onSave={onSave} />
    </>
  );
}

function SetupSheet({ open, onClose, exercise, knownLabels, onSave }) {
  const settings = exercise.settings || [];
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const labelRef = useRef(null);
  const valueRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (open) { setLabel(''); setValue(''); }
  }, [open]);

  const full = settings.length >= MAX_SETTINGS;
  const taken = new Set(settings.map((s) => s.label.toLowerCase()));
  const options = [...new Set([...knownLabels, ...SETTING_SUGGESTIONS])].filter((l) => !taken.has(l.toLowerCase()));
  const duplicate = taken.has(label.trim().toLowerCase());

  const add = (e) => {
    e?.preventDefault();
    const clean = label.trim();
    if (!clean || duplicate || full) return;
    onSave([...settings, { label: clean, value: value.trim() }]);
    setLabel('');
    setValue('');
    labelRef.current?.focus();
  };

  const changeValue = (index, next) => {
    if ((settings[index].value || '') === next.trim()) return;
    onSave(settings.map((s, i) => (i === index ? { ...s, value: next.trim() } : s)));
  };

  const pick = (suggestion) => {
    setLabel(suggestion);
    requestAnimationFrame(() => valueRef.current?.focus());
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Einstellungen · ${exercise.name}`}
      description="Wird sofort gespeichert und steht beim nächsten Training wieder da."
      footer={<Button onClick={onClose}>Fertig</Button>}
    >
      <div className="space-y-6">
        {settings.length > 0 && (
          <ul className="divide-y divide-subtle rounded-lg border border-subtle" aria-label="Gespeicherte Einstellungen">
            {settings.map((s, index) => (
              <li key={s.label} className="flex items-center gap-2 py-1.5 pl-3 pr-1">
                <span className="min-w-0 flex-1 truncate text-body-strong text-primary">{s.label}</span>
                <div className="w-28 shrink-0">
                  <Input
                    size="sm"
                    aria-label={`Wert für ${s.label}`}
                    defaultValue={s.value}
                    maxLength={60}
                    placeholder="Wert"
                    autoComplete="off"
                    onBlur={(e) => changeValue(index, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                  />
                </div>
                <IconButton icon="delete" size="sm" variant="danger-ghost" label={`${s.label} entfernen`} onClick={() => onSave(settings.filter((_, i) => i !== index))} />
              </li>
            ))}
          </ul>
        )}

        {full ? (
          <p className="text-body text-secondary">Mehr als {MAX_SETTINGS} Einstellungen gehen pro Übung nicht.</p>
        ) : (
          <form onSubmit={add} className="space-y-3" aria-label="Neue Einstellung">
            <p className="text-label text-primary">{settings.length ? 'Weitere Einstellung' : 'Neue Einstellung'}</p>
            {options.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Vorschläge">
                {options.slice(0, 8).map((o) => (
                  <Chip key={o} selected={label === o} onClick={() => pick(o)}>{o}</Chip>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <Field label="Bezeichnung" error={duplicate ? 'Gibt es schon' : undefined}>
                <Input
                  ref={labelRef}
                  list={listId}
                  placeholder="z. B. Sitzhöhe"
                  value={label}
                  maxLength={40}
                  autoComplete="off"
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && label.trim() && !value) { e.preventDefault(); valueRef.current?.focus(); } }}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Field label="Wert" className="min-w-0 flex-1">
                  <Input ref={valueRef} placeholder="z. B. 4 oder Loch 7" value={value} maxLength={60} autoComplete="off" onChange={(e) => setValue(e.target.value)} />
                </Field>
                <Button type="submit" leadingIcon="add" disabled={!label.trim() || duplicate}>Hinzufügen</Button>
              </div>
            </div>
            <datalist id={listId}>
              {options.map((o) => <option key={o} value={o} />)}
            </datalist>
          </form>
        )}
      </div>
    </Sheet>
  );
}
