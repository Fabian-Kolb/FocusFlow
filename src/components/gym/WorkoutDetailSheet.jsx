import React from 'react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import { describeSets, formatWeight, recordSetIds, relativeDay, satzText, setsOf, volumeOf, workoutExerciseIds, workoutMinutes } from '../../lib/gym';
import { Badge, Button, Sheet } from '../ds';

/** Ein vergangenes Training ansehen (Übungen, Sätze, Bestwerte) und löschen (mit Rückgängig). */
export default function WorkoutDetailSheet({ workout, onClose }) {
  const { exercises, plans, workouts, saveWorkout, deleteWorkout } = useGym();
  const { showToast } = useToast();
  const open = Boolean(workout);
  if (!workout && !open) return null;

  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || 'Gelöschte Übung';
  const plan = plans.find((p) => p.id === workout?.planId);
  const records = workout ? recordSetIds(workouts, workout) : new Set();
  const minutes = workout ? workoutMinutes(workout) : null;
  const volume = workout ? volumeOf(workout.sets || []) : null;

  const remove = () => {
    const before = workout;
    deleteWorkout(before.id);
    onClose();
    showToast({ message: 'Training gelöscht', icon: 'delete', actionLabel: 'Rückgängig', onAction: () => saveWorkout(before) });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={workout ? `${plan?.name || 'Freies Training'} · ${relativeDay(workout.date)}` : ''}
      description={workout ? [minutes ? `${minutes} Min` : null, satzText((workout.sets || []).length), volume ? `${Math.round(volume).toLocaleString('de-DE')} kg Volumen` : null].filter(Boolean).join(' · ') : ''}
      footer={<Button variant="danger-ghost" leadingIcon="delete" onClick={remove}>Training löschen</Button>}
    >
      {workout && (
        <ul className="divide-y divide-subtle">
          {workoutExerciseIds(workout).filter((id) => setsOf(workout, id).length).map((id) => {
            const sets = setsOf(workout, id);
            const hasRecord = sets.some((s) => records.has(s.id));
            return (
              <li key={id} className="py-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-body-strong text-primary">{nameOf(id)}</span>
                  {hasRecord && <Badge tone="success" size="sm" icon="emoji_events">Bestwert</Badge>}
                </div>
                <p className="mt-0.5 text-body tabular-nums text-secondary">{describeSets(sets)}</p>
                <p className="mt-0.5 text-caption text-tertiary">{satzText(sets.length)}, höchstes Gewicht {formatWeight(Math.max(...sets.map((s) => s.weight)))}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
