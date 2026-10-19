import React, { useEffect, useState } from 'react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import { MAX_EXERCISES_PER_PLAN } from '../../lib/gym';
import { Button, Field, Icon, IconButton, Input, SectionHeader, Sheet, Switch } from '../ds';
import ExercisePicker from './ExercisePicker';

/**
 * Trainingstage, Übungen und Einstellungen. Zwei Ansichten im selben Sheet: Übersicht und Trainingstag bearbeiten.
 * Übungen lassen sich umbenennen; löschen geht nur, wenn sie in keinem Training vorkommen.
 */
export default function GymManageSheet({ open, onClose, initialPlanId = null, onPlanSaved }) {
  const {
    exercises, plans, workouts, repsEnabled, setRepsEnabled,
    addExercise, renameExercise, deleteExercise, savePlan, deletePlan,
  } = useGym();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null); // null = Übersicht, sonst { id?, name, exerciseIds }
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [newExercise, setNewExercise] = useState('');

  useEffect(() => {
    if (!open) return;
    const plan = initialPlanId ? plans.find((p) => p.id === initialPlanId) : null;
    setEditing(plan ? { id: plan.id, name: plan.name, exerciseIds: plan.exerciseIds || [] } : null);
    setRenaming(null);
    setNewExercise('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPlanId]);

  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || 'Gelöschte Übung';
  const usedInWorkout = (id) => workouts.some((w) => (w.sets || []).some((s) => s.exerciseId === id));

  const startNewPlan = () => setEditing({ name: '', exerciseIds: [] });
  const move = (index, delta) => {
    const ids = [...editing.exerciseIds];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setEditing({ ...editing, exerciseIds: ids });
  };
  const addToPlan = (exercise) => {
    if (!exercise) return;
    setPicking(false);
    if (editing.exerciseIds.includes(exercise.id) || editing.exerciseIds.length >= MAX_EXERCISES_PER_PLAN) return;
    setEditing({ ...editing, exerciseIds: [...editing.exerciseIds, exercise.id] });
  };
  const createAndAdd = async (name) => addToPlan(await addExercise(name));

  const submitPlan = (e) => {
    e.preventDefault();
    if (!editing.name.trim()) return;
    const saved = savePlan(editing);
    if (saved && onPlanSaved) onPlanSaved(saved);
    if (initialPlanId) onClose();
    else setEditing(null);
  };

  const submitExercise = async (e) => {
    e.preventDefault();
    if (!newExercise.trim()) return;
    await addExercise(newExercise);
    setNewExercise('');
  };

  const removeExercise = (exercise) => {
    if (!deleteExercise(exercise.id)) {
      showToast({ message: 'Die Übung kommt in Trainings vor und bleibt, damit der Verlauf stimmt.', icon: 'info' });
    }
  };

  const saveRename = (e) => {
    e.preventDefault();
    renameExercise(renaming.id, renaming.name);
    setRenaming(null);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        width="lg"
        title={editing ? (editing.id ? 'Trainingstag bearbeiten' : 'Neuer Trainingstag') : 'Trainingstage und Übungen'}
        footer={editing && (
          <>
            <Button variant="secondary" onClick={() => (initialPlanId ? onClose() : setEditing(null))}>Abbrechen</Button>
            <Button type="submit" form="gym-plan-form" disabled={!editing.name.trim()}>Speichern</Button>
          </>
        )}
      >
        {editing ? (
          <form id="gym-plan-form" onSubmit={submitPlan} className="space-y-5">
            <Field label="Name">
              <Input data-autofocus placeholder="z. B. Push" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <div className="space-y-2">
              <SectionHeader title="Übungen" count={editing.exerciseIds.length} />
              {editing.exerciseIds.length === 0 && <p className="text-body text-secondary">Noch keine Übungen. Die Reihenfolge hier ist die im Training.</p>}
              <ol className="divide-y divide-subtle rounded-lg border border-subtle">
                {editing.exerciseIds.map((id, index) => (
                  <li key={id} className="flex items-center gap-1 py-1 pl-3 pr-1">
                    <span className="min-w-0 flex-1 truncate text-body text-primary">{nameOf(id)}</span>
                    <IconButton type="button" icon="arrow_upward" size="sm" label={`${nameOf(id)} nach oben`} disabled={index === 0} onClick={() => move(index, -1)} />
                    <IconButton type="button" icon="arrow_downward" size="sm" label={`${nameOf(id)} nach unten`} disabled={index === editing.exerciseIds.length - 1} onClick={() => move(index, 1)} />
                    <IconButton type="button" icon="close" size="sm" label={`${nameOf(id)} entfernen`} onClick={() => setEditing({ ...editing, exerciseIds: editing.exerciseIds.filter((x) => x !== id) })} />
                  </li>
                ))}
              </ol>
              <Button type="button" variant="secondary" size="sm" leadingIcon="add" onClick={() => setPicking(true)}>Übung hinzufügen</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2" aria-label="Trainingstage">
              <SectionHeader title="Trainingstage" count={plans.length} action={<Button variant="ghost" size="sm" leadingIcon="add" onClick={startNewPlan}>Trainingstag</Button>} />
              {plans.length === 0 && <p className="text-body text-secondary">Noch kein Trainingstag. Lege zum Beispiel Push, Pull und Beine an, dann ist beim Start alles vorbereitet.</p>}
              <ul className="divide-y divide-subtle rounded-lg border border-subtle">
                {plans.map((plan) => (
                  <li key={plan.id} className="flex items-center gap-1 py-1 pl-3 pr-1">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-strong text-primary">{plan.name}</span>
                      <span className="block truncate text-caption text-secondary">{(plan.exerciseIds || []).length} Übungen</span>
                    </span>
                    <IconButton icon="edit" size="sm" label={`${plan.name} bearbeiten`} onClick={() => setEditing({ id: plan.id, name: plan.name, exerciseIds: plan.exerciseIds || [] })} />
                    <IconButton icon="delete" size="sm" variant="danger-ghost" label={`${plan.name} löschen`} onClick={() => deletePlan(plan.id)} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2" aria-label="Übungen">
              <SectionHeader title="Übungen" count={exercises.length} />
              <form onSubmit={submitExercise} className="flex gap-2">
                <Input aria-label="Neue Übung" placeholder="Neue Übung, z. B. Kniebeugen" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} autoComplete="off" />
                <Button type="submit" variant="secondary" disabled={!newExercise.trim()}>Hinzufügen</Button>
              </form>
              <ul className="divide-y divide-subtle rounded-lg border border-subtle">
                {exercises.map((exercise) => (
                  <li key={exercise.id} className="flex items-center gap-1 py-1 pl-3 pr-1">
                    {renaming?.id === exercise.id ? (
                      <form onSubmit={saveRename} className="flex min-w-0 flex-1 items-center gap-1">
                        <Input size="sm" data-autofocus aria-label="Neuer Name" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                        <IconButton type="submit" icon="check" size="sm" variant="primary" label="Umbenennen speichern" />
                        <IconButton type="button" icon="close" size="sm" label="Abbrechen" onClick={() => setRenaming(null)} />
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-body text-primary">{exercise.name}</span>
                        {usedInWorkout(exercise.id) && <Icon name="history" size="sm" className="text-tertiary" title="Kommt in Trainings vor" />}
                        <IconButton icon="edit" size="sm" label={`${exercise.name} umbenennen`} onClick={() => setRenaming({ id: exercise.id, name: exercise.name })} />
                        <IconButton icon="delete" size="sm" variant="danger-ghost" label={`${exercise.name} löschen`} onClick={() => removeExercise(exercise)} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2" aria-label="Einstellungen">
              <SectionHeader title="Einstellungen" />
              <Switch
                checked={repsEnabled}
                onChange={setRepsEnabled}
                label="Wiederholungen erfassen"
                description="Aus: Du trägst nur das Gewicht ein. Das gilt für dieses Gerät."
              />
            </section>
          </div>
        )}
      </Sheet>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        exercises={exercises}
        excludeIds={editing?.exerciseIds || []}
        onPick={addToPlan}
        onCreate={createAndAdd}
      />
    </>
  );
}
