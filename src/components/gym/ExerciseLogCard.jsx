import React, { useState } from 'react';
import { WEIGHT_STEP, describeSets, formatWeight, lastSession, relativeDay, setsOf, stepWeight, toInput } from '../../lib/gym';
import { Badge, Button, Card, IconButton, Input } from '../ds';

/**
 * Eine Übung im laufenden Training: oben „Letztes Mal“, darunter die Sätze von heute und die Eingabe für den nächsten
 * Satz (vorbelegt mit dem letzten Satz oder dem vom letzten Mal). Wiederholungen sind optional und lassen sich
 * ganz ausblenden (`repsEnabled`).
 */
export default function ExerciseLogCard({ exercise, workout, workouts, repsEnabled, recordIds, onAddSet, onRemoveSet, onRemoveExercise }) {
  const sets = setsOf(workout, exercise.id);
  const last = lastSession(workouts, exercise.id, { excludeId: workout.id });
  const seed = sets[sets.length - 1] || last?.sets[0];
  const [weight, setWeight] = useState(seed ? toInput(seed.weight) : '');
  const [reps, setReps] = useState(seed?.reps ? String(seed.reps) : '');
  const [error, setError] = useState('');

  const save = (e) => {
    e.preventDefault();
    const ok = onAddSet({ exerciseId: exercise.id, weight, reps: repsEnabled ? reps : '' });
    setError(ok ? '' : 'Gib ein Gewicht ein, zum Beispiel 60 oder 62,5.');
  };

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-heading text-primary">{exercise.name}</h3>
          <p className="mt-0.5 text-caption text-secondary">
            {last ? `Letztes Mal: ${describeSets(last.sets)} · ${relativeDay(last.workout.date)}` : 'Noch nie gemacht'}
          </p>
        </div>
        {sets.length === 0 && onRemoveExercise && (
          <IconButton icon="close" size="sm" label={`${exercise.name} aus dem Training entfernen`} onClick={onRemoveExercise} />
        )}
      </div>

      {sets.length > 0 && (
        <ol className="divide-y divide-subtle rounded-md border border-subtle">
          {sets.map((set, index) => (
            <li key={set.id} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
              <span className="w-12 shrink-0 text-caption text-secondary">Satz {index + 1}</span>
              <span className="min-w-0 flex-1 text-body-strong tabular-nums text-primary">
                {formatWeight(set.weight)}{set.reps ? ` × ${set.reps}` : ''}
              </span>
              {recordIds.has(set.id) && <Badge tone="success" size="sm" icon="emoji_events">Bestwert</Badge>}
              <IconButton icon="delete" size="sm" variant="danger-ghost" label={`Satz ${index + 1} von ${exercise.name} löschen`} onClick={() => onRemoveSet(set.id)} />
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={save} className="space-y-2" aria-label={`Satz zu ${exercise.name} speichern`}>
        <div className="flex items-center gap-2">
          <IconButton type="button" icon="remove" variant="secondary" label="Gewicht verringern" onClick={() => setWeight(toInput(stepWeight(weight, -WEIGHT_STEP)))} />
          <Input
            aria-label={`Gewicht für ${exercise.name} in Kilogramm`}
            inputMode="decimal"
            placeholder="kg"
            value={weight}
            onChange={(e) => { setWeight(e.target.value); setError(''); }}
            invalid={Boolean(error)}
            className="min-w-0 flex-1"
          />
          <IconButton type="button" icon="add" variant="secondary" label="Gewicht erhöhen" onClick={() => setWeight(toInput(stepWeight(weight, WEIGHT_STEP)))} />
          {repsEnabled && (
            <Input
              aria-label={`Wiederholungen für ${exercise.name}, optional`}
              inputMode="numeric"
              placeholder="Wdh."
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-20 shrink-0"
            />
          )}
        </div>
        {error && <p role="alert" className="text-caption text-danger">{error}</p>}
        <Button type="submit" fullWidth leadingIcon="add">Satz speichern</Button>
      </form>
    </Card>
  );
}
