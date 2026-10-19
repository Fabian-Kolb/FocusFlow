import React, { useId, useState } from 'react';
import { MAX_SETTINGS, SETTING_SUGGESTIONS } from '../../lib/gym';
import { Button, Chip, FOCUS, Icon, IconButton, Input, cx } from '../ds';

/**
 * Einstellungen einer Übung, frei wählbar: eine Bezeichnung und ein Wert, zum Beispiel „Sitzhöhe“ und „4“ oder
 * „Loch“ und „7“. Sie gelten für die Übung und bleiben, bis du sie änderst (beim nächsten Training stehen sie wieder da).
 * Vorschläge kommen aus deinen bisherigen Bezeichnungen und ein paar üblichen; du kannst alles selbst schreiben.
 */
export default function ExerciseSetup({ exercise, knownLabels = [], onSave }) {
  const settings = exercise.settings || [];
  const [draft, setDraft] = useState(null); // null = Ansicht, sonst Liste im Bearbeiten
  const listId = useId();

  const startEdit = () => setDraft(settings.length ? settings.map((s) => ({ ...s })) : [{ label: '', value: '' }]);
  const update = (index, patch) => setDraft(draft.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addRow = (label = '') => {
    if (draft.length < MAX_SETTINGS) setDraft([...draft, { label, value: '' }]);
  };
  const save = (e) => {
    e.preventDefault();
    onSave(draft);
    setDraft(null);
  };

  if (draft === null) {
    if (settings.length === 0) {
      return (
        <div>
          <Button variant="ghost" size="sm" leadingIcon="tune" onClick={startEdit}>Einstellung merken, z. B. Sitzhöhe</Button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={startEdit}
        aria-label={`Einstellungen von ${exercise.name} ändern`}
        className={cx('flex w-full items-center gap-2 rounded-md border border-subtle bg-subtle px-3 py-2 text-left hover:border-default', FOCUS)}
      >
        <Icon name="tune" size="sm" className="shrink-0 text-secondary" />
        <span className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-0.5">
          {settings.map((s) => (
            <span key={s.label} className="text-body">
              <span className="text-secondary">{s.label} </span>
              <span className="text-body-strong text-primary">{s.value}</span>
            </span>
          ))}
        </span>
        <Icon name="edit" size="sm" className="shrink-0 text-tertiary" />
      </button>
    );
  }

  const used = new Set(draft.map((r) => r.label.trim().toLowerCase()));
  const suggestions = [...new Set([...knownLabels, ...SETTING_SUGGESTIONS])].filter((l) => !used.has(l.toLowerCase())).slice(0, 6);

  return (
    <form onSubmit={save} className="space-y-3 rounded-md border border-default bg-subtle p-3" aria-label={`Einstellungen von ${exercise.name}`}>
      <datalist id={listId}>
        {[...new Set([...knownLabels, ...SETTING_SUGGESTIONS])].map((l) => <option key={l} value={l} />)}
      </datalist>
      <ul className="space-y-2">
        {draft.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              size="sm"
              list={listId}
              aria-label={`Bezeichnung ${index + 1}`}
              placeholder="Bezeichnung, z. B. Sitzhöhe"
              value={row.label}
              maxLength={40}
              onChange={(e) => update(index, { label: e.target.value })}
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Input
              size="sm"
              aria-label={`Wert ${index + 1}`}
              placeholder="Wert, z. B. 4"
              value={row.value}
              maxLength={60}
              onChange={(e) => update(index, { value: e.target.value })}
              autoComplete="off"
              className="w-28 shrink-0"
            />
            <IconButton type="button" icon="close" size="sm" label={`Einstellung ${index + 1} entfernen`} onClick={() => setDraft(draft.filter((_, i) => i !== index))} />
          </li>
        ))}
      </ul>
      {suggestions.length > 0 && draft.length < MAX_SETTINGS && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vorschläge">
          {suggestions.map((label) => (
            <Chip key={label} leadingIcon="add" onClick={() => addRow(label)}>{label}</Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" leadingIcon="add" disabled={draft.length >= MAX_SETTINGS} onClick={() => addRow()}>Weitere Einstellung</Button>
        <span className="flex-1" />
        <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(null)}>Abbrechen</Button>
        <Button type="submit" size="sm">Fertig</Button>
      </div>
    </form>
  );
}
