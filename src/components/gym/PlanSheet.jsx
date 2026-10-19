import React from 'react';
import { useGym } from '../../context/GymContext';
import { bestWeight, describeSets, formatWeight, lastSession, relativeDay } from '../../lib/gym';
import { Button, Sheet } from '../ds';

/**
 * Vorschau eines Trainingstags vor dem Start: die Übungen in Reihenfolge mit „Letztes Mal“ und Bestwert.
 * Hier startet nichts von selbst; „Training starten“ und „Bearbeiten“ sind eigene Knöpfe.
 */
export default function PlanSheet({ plan, onClose, onStart, onEdit }) {
  const { exercises, workouts } = useGym();
  if (!plan) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={plan.name}
      description={`${(plan.exerciseIds || []).length} Übungen`}
      footer={(
        <>
          <Button variant="secondary" leadingIcon="edit" onClick={() => onEdit(plan)}>Bearbeiten</Button>
          <Button leadingIcon="play_arrow" onClick={() => onStart(plan)}>Training starten</Button>
        </>
      )}
    >
      {(plan.exerciseIds || []).length === 0 ? (
        <p className="text-body text-secondary">Noch keine Übungen in diesem Trainingstag. Füge sie über „Bearbeiten“ hinzu.</p>
      ) : (
        <ol className="divide-y divide-subtle">
          {plan.exerciseIds.map((id) => {
            const exercise = exercises.find((e) => e.id === id);
            if (!exercise) return null;
            const last = lastSession(workouts, id);
            const best = bestWeight(workouts, id);
            return (
              <li key={id} className="py-3">
                <p className="text-body-strong text-primary">{exercise.name}</p>
                <p className="mt-0.5 text-body tabular-nums text-secondary">
                  {last ? `${describeSets(last.sets)} · ${relativeDay(last.workout.date)}` : 'Noch nicht trainiert'}
                </p>
                {best > 0 && <p className="mt-0.5 text-caption text-tertiary">Bestwert {formatWeight(best)}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Sheet>
  );
}
