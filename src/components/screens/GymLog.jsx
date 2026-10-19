import React, { useEffect, useMemo, useState } from 'react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import {
  activeWorkout, formatWeight, isRecord, knownSettingLabels, lastDoneDate, nextPlan, recordSetIds, relativeDay, satzText, withExercise, withSet,
  workoutExerciseIds,
} from '../../lib/gym';
import { Badge, Button, Card, EmptyState, FOCUS, Icon, IconButton, PageHeader, cx } from '../ds';
import ExerciseLogCard from '../gym/ExerciseLogCard';
import ExercisePicker from '../gym/ExercisePicker';
import GymManageSheet from '../gym/GymManageSheet';
import PlanSheet from '../gym/PlanSheet';

/**
 * Training: Ohne laufendes Training wählt man einen Trainingstag (Tippen zeigt die Übungen, „Starten“ beginnt)
 * oder startet frei. Mit laufendem Training trägt man Sätze ein (Gewicht mit Plus/Minus, Wiederholungen optional)
 * und sieht je Übung „Letztes Mal“. Trainingstage und Übungen lassen sich auch währenddessen ändern.
 * Beenden speichert, ein Training ohne Satz wird verworfen. Der Verlauf steht auf dem Bildschirm „Verlauf“.
 */
const GymLog = () => {
  const {
    exercises, plans, workouts, repsEnabled, startWorkout, saveWorkout, deleteWorkout,
    addExercise, setExerciseSettings, addSetToWorkout, removeSetFromWorkout, finishWorkout,
  } = useGym();
  const { showToast } = useToast();
  const active = activeWorkout(workouts);
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(null); // null | { planId?: string }
  const [preview, setPreview] = useState(null);

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
  const knownLabels = useMemo(() => knownSettingLabels(exercises), [exercises]);

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
    else showToast({ message: `Training beendet: ${satzText(sets)}${bestCount ? `, ${bestCount} ${bestCount === 1 ? 'Bestwert' : 'Bestwerte'}` : ''}`, icon: 'check_circle' });
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

  // Wurde der Trainingstag während des Trainings geändert, kommen neue Übungen ins laufende Training
  const onPlanSaved = (plan) => {
    if (!active || !plan || plan.id !== active.planId) return;
    const have = active.exerciseIds || [];
    const added = (plan.exerciseIds || []).filter((id) => !have.includes(id));
    if (added.length) saveWorkout({ ...active, exerciseIds: [...have, ...added] });
  };

  const start = (plan) => {
    setPreview(null);
    startWorkout(plan);
  };

  const manageSheet = (
    <GymManageSheet
      open={Boolean(managing)}
      initialPlanId={managing?.planId}
      onPlanSaved={onPlanSaved}
      onClose={() => setManaging(null)}
    />
  );

  if (active) {
    const minutes = Math.max(0, Math.floor((now - active.startedAt) / 60000));
    const plan = plans.find((p) => p.id === active.planId);
    const ids = workoutExerciseIds(active).filter((id) => exercises.some((e) => e.id === id));
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={plan?.name || 'Freies Training'}
          description={`Läuft seit ${minutes} Min · ${satzText((active.sets || []).length)}`}
          actions={(
            <Button variant="secondary" size="sm" leadingIcon="tune" onClick={() => setManaging(plan ? { planId: plan.id } : {})}>
              {plan ? 'Trainingstag bearbeiten' : 'Übungen verwalten'}
            </Button>
          )}
        />
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
            knownLabels={knownLabels}
            onSaveSettings={setExerciseSettings}
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
        {manageSheet}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Training"
        description="Tippe einen Trainingstag an, um seine Übungen zu sehen, oder starte direkt."
        actions={<Button variant="secondary" size="sm" leadingIcon="tune" onClick={() => setManaging({})}>Verwalten</Button>}
      />

      <section className="flex flex-col gap-3" aria-label="Trainingstage">
        {plans.map((plan) => {
          const done = lastDoneDate(workouts, plan.id);
          return (
            <Card key={plan.id} padding="none" className="flex items-center gap-1 pr-3">
              <button
                type="button"
                onClick={() => setPreview(plan)}
                aria-label={`${plan.name}, Übungen ansehen`}
                className={cx('relative min-w-0 flex-1 rounded-lg p-4 text-left', FOCUS)}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-heading text-primary">{plan.name}</span>
                  {upcoming?.id === plan.id && <Badge tone="accent" size="sm">Als Nächstes</Badge>}
                </span>
                <span className="mt-0.5 block truncate text-caption text-secondary">
                  {(plan.exerciseIds || []).map(nameOf).filter(Boolean).join(', ') || 'Noch keine Übungen'}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-caption text-tertiary">
                  {done ? `Zuletzt ${relativeDay(done).toLowerCase()}` : 'Noch nicht trainiert'}
                  <Icon name="chevron_right" size="sm" />
                </span>
              </button>
              <IconButton icon="play_arrow" variant="primary" label={`${plan.name} starten`} onClick={() => start(plan)} />
            </Card>
          );
        })}
        {plans.length === 0 && (
          <EmptyState
            icon="fitness_center"
            title="Noch kein Trainingstag"
            description="Lege Trainingstage wie Push, Pull und Beine an, dann ist beim Start alles vorbereitet. Oder starte frei."
            action={<Button onClick={() => setManaging({})}>Trainingstag anlegen</Button>}
          />
        )}
        <Button variant="secondary" leadingIcon="add" onClick={() => startWorkout(null)}>Freies Training starten</Button>
      </section>

      <PlanSheet
        plan={preview}
        onClose={() => setPreview(null)}
        onStart={start}
        onEdit={(plan) => { setPreview(null); setManaging({ planId: plan.id }); }}
      />
      {manageSheet}
    </div>
  );
};

export default GymLog;
