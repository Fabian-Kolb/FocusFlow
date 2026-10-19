import React, { useEffect, useState } from 'react';
import { Icon, Input, Sheet, FOCUS, cx } from '../ds';

/**
 * Übung wählen oder neu anlegen. Tippen filtert die Bibliothek; passt kein Name genau, erscheint
 * „… als neue Übung anlegen“. `excludeIds` blendet schon gewählte Übungen aus.
 */
export default function ExercisePicker({ open, onClose, exercises, excludeIds = [], onPick, onCreate, title = 'Übung hinzufügen' }) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const q = query.trim();
  const available = exercises.filter((e) => !excludeIds.includes(e.id));
  const shown = q ? available.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())) : available;
  const exact = exercises.some((e) => e.name.toLowerCase() === q.toLowerCase());

  const row = 'flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-label text-primary hover:bg-hover active:bg-pressed';

  const submit = (e) => {
    e.preventDefault();
    if (!q) return;
    if (shown.length === 1 && !exact) onPick(shown[0]);
    else if (exact) onPick(exercises.find((x) => x.name.toLowerCase() === q.toLowerCase()));
    else onCreate(q);
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} side="bottom" bodyClassName="space-y-3 pb-safe">
      <form onSubmit={submit}>
        <Input data-autofocus leadingIcon="search" aria-label="Übung suchen oder neu anlegen" placeholder="Name der Übung" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </form>
      <ul className="max-h-[50vh] overflow-y-auto">
        {shown.map((exercise) => (
          <li key={exercise.id}>
            <button type="button" className={cx(row, FOCUS)} onClick={() => onPick(exercise)}>
              <Icon name="fitness_center" size="md" className="text-secondary" />
              <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
            </button>
          </li>
        ))}
        {q && !exact && (
          <li>
            <button type="button" className={cx(row, FOCUS)} onClick={() => onCreate(q)}>
              <Icon name="add" size="md" className="text-accent" />
              <span className="min-w-0 flex-1 truncate">„{q}“ als neue Übung anlegen</span>
            </button>
          </li>
        )}
        {shown.length === 0 && !q && <li className="px-3 py-2 text-body text-secondary">Noch keine Übungen. Tippe einen Namen ein, um die erste anzulegen.</li>}
      </ul>
    </Sheet>
  );
}
