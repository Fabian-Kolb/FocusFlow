import React, { useEffect, useMemo, useState } from 'react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import {
  activeWorkout, formatWeight, isRecord, lastDoneDate, nextPlan, recordSetIds, relativeDay, satzText, withExercise, withSet,
  workoutExerciseIds, workoutSummary,
} from '../../lib/gym';
import { Badge, Button, Card, EmptyState, FOCUS, Icon, PageHeader, SectionHeader, cx } from '../ds';
import ExerciseLogCard from '../gym/ExerciseLogCard';
import ExercisePicker from '../gym/ExercisePicker';
import GymManageSheet from '../gym/GymManageSheet';
import WorkoutDetailSheet from '../gym/WorkoutDetailSheet';

/**
 * Training: Ohne laufendes Training startet man einen Trainingstag oder ein freies Training und sieht den Verlauf.
 * Mit laufendem Training trägt man Sätze ein (Gewicht mit Plus/Minus, Wiederholungen optional) und sieht je Übung
 * „Letztes Mal“. Beenden speichert, ein Training ohne Satz wird verworfen.
 */
const GymLog = () => {
  const {
    exercises, plans, workouts, repsEnabled, startWorkout, saveWorkout, deleteWorkout,
    addExercise, addSetToWorkout, removeSetFromWorkout, finishWorkout,
  } = useGym();
  const { showToast } = useToast();
  const active = activeWorkout(workouts);
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);
  const [detail, setDetail] = useState(null);

  // Laufzeit des Trainings, jede halbe Minute neu
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [active]);

  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || null;
  const records = useMemo(() => (active ? recordSetIds(workouts, active) : new Set()), [active, workouts]);
  const upcoming = nextPlan(plans, workouts);
  const history = workouts.filter((w) => w.endedAt && (w.sets || []).length > 0);

  const addSet = (input) => {
    const set = addSetToWorkout(active.id, input);
    if (!set) return false;
    if (isRecord(workouts, withSet(active, set), set)) {
      showToast({ message: `Neuer Bestwert: ${nameOf(set.exerciseId)} mit ${formatWeight(set.weight)}`, icon: 'emoji_events' });
    }
    return true;
  };

  const finish = () => {
    const sets = (active.sets || []).length;
    const bestCount = records.size;
    const result = finishWorkout(active.id);
    if (result?.discarded) showToast({ message: 'Training ohne Sätze verworfen', icon: 'info' });
    else showToast({ message: `Training beendet: ${sets} ${sets === 1 ? 'Satz' : 'Sätze'}${bestCount ? `, ${bestCount} ${bestCount === 1 ? 'Bestwert' : 'Bestwerte'}` : ''}`, icon: 'check_circle' });
  };

  const discard = () => {
    const before = active;
    deleteWorkout(before.id);
    showToast({ message: 'Training verworfen', icon: 'delete', actionLabel: 'Rückgängig', onAction: () => saveWorkout(before) });
  };

  const pickExercise = (exercise) => {
    setPicking(false);
    if (exercise) saveWorkout(withExercise(active, exercise.id));
  };
  const createExercise = async (name) => pickExercise(await addExercise(name));

  if (active) {
    const minutes = Math.max(0, Math.floor((now - active.startedAt) / 60000));
    const plan = plans.find((p) => p.id === active.planId);
    const ids = workoutExerciseIds(active).filter((id) => exercises.some((e) => e.id === id));
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={plan?.name || 'Freies Training'} description={`Läuft seit ${minutes} Min · ${satzText((active.sets || []).length)}`} />
        {ids.length === 0 && (
          <EmptyState icon="fitness_center" title="Noch keine Übung" description="Füge die erste Übung hinzu und trage dann deine Sätze ein." />
        )}
        {ids.map((id) => (
          <ExerciseLogCard
            key={id}
            exercise={exercises.find((e) => e.id === id)}
            workout={active}
            workouts={workouts}
            repsEnabled={repsEnabled}
            recordIds={records}
            onAddSet={addSet}
            onRemoveSet={(setId) => removeSetFromWorkout(active.id, setId)}
            onRemoveExercise={() => saveWorkout({ ...active, exerciseIds: (active.exerciseIds || []).filter((x) => x !== id) })}
          />
        ))}
        <Button variant="secondary" leadingIcon="add" onClick={() => setPicking(true)}>Übung hinzufügen</Button>
        <div className="flex flex-col gap-2 border-t border-subtle pt-4 sm:flex-row-reverse sm:justify-start">
          <Button leadingIcon="check" onClick={finish}>Training beenden</Button>
          <Button variant="danger-ghost" leadingIcon="delete" onClick={discard}>Training verwerfen</Button>
        </div>
        <ExercisePicker
          open={picking}
          onClose={() => setPicking(false)}
          exercises={exercises}
          excludeIds={active.exerciseIds || []}
          onPick={pickExercise}
          onCreate={createExercise}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Training"
        description="Wähle einen Trainingstag oder starte frei."
        actions={<Button variant="secondary" size="sm" leadingIcon="tune" onClick={() => setManaging(true)}>Trainingstage verwalten</Button>}
      />

      <section className="flex flex-col gap-3" aria-label="Training starten">
        {plans.map((plan) => {
          const done = lastDoneDate(workouts, plan.id);
          return (
            <Card key={plan.id} as="button" type="button" interactive padding="md" onClick={() => startWorkout(plan)} aria-label={`${plan.name} starten`}>
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-heading text-primary">{plan.name}</span>
                    {upcoming?.id === plan.id && <Badge tone="accent" size="sm">Als Nächstes</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-secondary">
                    {(plan.exerciseIds || []).map(nameOf).filter(Boolean).join(', ') || 'Noch keine Übungen'}
                  </span>
                  <span className="mt-0.5 block text-caption text-tertiary">{done ? `Zuletzt ${relativeDay(done).toLowerCase()}` : 'Noch nicht trainiert'}</span>
                </span>
                <Icon name="play_arrow" size="lg" className="shrink-0 text-accent" />
              </span>
            </Card>
          );
        })}
        {plans.length === 0 && (
          <EmptyState
            icon="fitness_center"
            title="Noch kein Trainingstag"
            description="Lege Trainingstage wie Push, Pull und Beine an, dann ist beim Start alles vorbereitet. Oder starte frei."
            action={<Button onClick={() => setManaging(true)}>Trainingstag anlegen</Button>}
          />
        )}
        <Button variant="secondary" leadingIcon="add" onClick={() => startWorkout(null)}>Freies Training starten</Button>
      </section>

      {history.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Verlauf">
          <SectionHeader title="Verlauf" count={history.length} />
          <Card padding="none">
            <ul className="divide-y divide-subtle">
              {history.slice(0, 20).map((workout) => {
                const summary = workoutSummary(workout, nameOf);
                const plan = plans.find((p) => p.id === workout.planId);
                return (
                  <li key={workout.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(workout)}
                      className={cx('relative flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover active:bg-pressed sm:px-5', FOCUS)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-strong text-primary">{plan?.name || 'Freies Training'}</span>
                        <span className="block truncate text-caption text-secondary">{summary.names.join(', ')}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-caption text-primary">{relativeDay(workout.date)}</span>
                        <span className="block text-caption text-tertiary">{satzText(summary.setCount)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <GymManageSheet open={managing} onClose={() => setManaging(false)} />
      <WorkoutDetailSheet workout={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default GymLog;
