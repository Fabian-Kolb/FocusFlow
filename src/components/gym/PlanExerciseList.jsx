import React, { useEffect, useRef } from 'react';
import { useReorderList } from '../../hooks/useReorderList';
import { settingsText } from '../../lib/gym';
import { FOCUS, Icon, IconButton, cx } from '../ds';

/**
 * Übungen eines Trainingstags in Trainingsreihenfolge: am Griff ziehen ändert die Reihenfolge (Maus und Finger),
 * Pfeiltasten auf dem Griff ebenso. Die Nummer zeigt die Position im Training, darunter stehen die Einstellungen.
 */
export default function PlanExerciseList({ ids, exercises, onChange, onAdd, canAdd = true }) {
  const rootRef = useRef(null);
  const { view, draggingId, handleProps } = useReorderList({ ids, onReorder: onChange, rootRef });
  const exerciseOf = (id) => exercises.find((e) => e.id === id);

  return (
    <div className="overflow-hidden rounded-lg border border-subtle">
      {view.length > 0 && (
        <ol ref={rootRef} className="divide-y divide-subtle" aria-label="Übungen in Reihenfolge">
          {view.map((id, index) => {
            const exercise = exerciseOf(id);
            const name = exercise?.name || 'Gelöschte Übung';
            const dragging = draggingId === id;
            return (
              <li
                key={id}
                data-reorder-id={id}
                className={cx(
                  'relative flex min-h-14 items-center gap-2 bg-surface py-2 pl-1 pr-1',
                  dragging && 'z-10 rounded-md bg-raised shadow-lg ring-1 ring-focus',
                )}
              >
                <DragHandle label={`${name} verschieben (ziehen oder Pfeiltasten)`} {...handleProps(id)} />
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-subtle text-caption-strong tabular-nums text-secondary" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-strong text-primary">{name}</span>
                  {exercise?.settings?.length > 0 && <span className="block truncate text-caption text-secondary">{settingsText(exercise.settings)}</span>}
                </span>
                <IconButton type="button" icon="close" size="sm" label={`${name} entfernen`} onClick={() => onChange(ids.filter((x) => x !== id))} />
              </li>
            );
          })}
        </ol>
      )}
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={cx('flex min-h-12 w-full items-center gap-2 px-3 text-left text-label text-accent hover:bg-hover', view.length > 0 && 'border-t border-subtle', FOCUS)}
        >
          <Icon name="add" size="md" />
          Übung hinzufügen
        </button>
      )}
    </div>
  );
}

/** Griff zum Ziehen. Hält Touch-Gesten vom Sheet fern, damit Ziehen nicht das Sheet nach unten wegwischt. */
function DragHandle({ label, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('touchstart', stop, { passive: true });
    return () => el.removeEventListener('touchstart', stop);
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title="Ziehen zum Verschieben"
      className={cx('flex h-11 w-8 shrink-0 cursor-grab select-none items-center justify-center rounded-sm text-tertiary hover:text-primary active:cursor-grabbing', FOCUS)}
      {...rest}
    >
      <Icon name="drag_indicator" size="md" />
    </button>
  );
}
