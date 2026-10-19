import { act, render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const guestUser = { uid: 'guest_preview_user', isGuest: true, email: 'guest@example.com' };
vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: guestUser })
}));
vi.mock('../src/lib/firebase.js', () => ({
  db: {}
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((...parts) => parts.join('/')),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve())
}));

import { GymProvider, useGym } from '../src/context/GymContext.jsx';

function Probe({ onContext }) {
  onContext(useGym());
  return null;
}

function renderGym() {
  let value;
  const utils = render(
    <GymProvider>
      <Probe onContext={(context) => { value = context; }} />
    </GymProvider>
  );
  return {
    utils,
    get value() {
      return value;
    }
  };
}

const stored = () => JSON.parse(localStorage.getItem('focusflow_guest_gym'));

describe('Gym-Logbuch im Gastmodus', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('startet leer', async () => {
    const gym = renderGym();
    await waitFor(() => expect(gym.value).toBeDefined());
    expect(gym.value.exercises).toEqual([]);
    expect(gym.value.plans).toEqual([]);
    expect(gym.value.workouts).toEqual([]);
    expect(gym.value.body).toEqual([]);
  });

  it('legt Übungen an, ohne Doppelte, und benennt sie um', async () => {
    const gym = renderGym();
    let bank;
    await act(async () => { bank = await gym.value.addExercise('  Bankdrücken '); });
    expect(bank.name).toBe('Bankdrücken');
    let again;
    await act(async () => { again = await gym.value.addExercise('bankdrücken'); });
    expect(again.id).toBe(bank.id);
    expect(gym.value.exercises).toHaveLength(1);
    expect(await gym.value.addExercise('   ')).toBeNull();

    await act(async () => { gym.value.renameExercise(bank.id, 'Flachbankdrücken'); });
    expect(gym.value.exercises[0].name).toBe('Flachbankdrücken');
    expect(stored().exercises[0].name).toBe('Flachbankdrücken');
  });

  it('speichert Trainingstage mit fortlaufender Reihenfolge und ohne doppelte Übungen', async () => {
    const gym = renderGym();
    let push; let pull;
    await act(async () => { push = gym.value.savePlan({ name: 'Push', exerciseIds: ['a', 'b', 'a'] }); });
    await act(async () => { pull = gym.value.savePlan({ name: 'Pull', exerciseIds: ['c'] }); });
    expect(push.exerciseIds).toEqual(['a', 'b']);
    expect(push.order).toBe(0);
    expect(pull.order).toBe(1);
    expect(gym.value.plans.map((p) => p.name)).toEqual(['Push', 'Pull']);

    await act(async () => { gym.value.savePlan({ id: push.id, name: 'Push A', exerciseIds: ['a'] }); });
    expect(gym.value.plans[0]).toMatchObject({ name: 'Push A', order: 0, exerciseIds: ['a'] });
    expect(gym.value.savePlan({ name: '   ' })).toBeNull();

    await act(async () => { gym.value.deletePlan(pull.id); });
    expect(gym.value.plans).toHaveLength(1);
  });

  it('ein Training mit Sätzen: starten, Sätze speichern, beenden', async () => {
    const gym = renderGym();
    let exercise; let plan;
    await act(async () => { exercise = await gym.value.addExercise('Bankdrücken'); });
    await act(async () => { plan = gym.value.savePlan({ name: 'Push', exerciseIds: [exercise.id] }); });

    let workout;
    await act(async () => { workout = gym.value.startWorkout(plan); });
    expect(workout).toMatchObject({ planId: plan.id, exerciseIds: [exercise.id], sets: [] });

    let set1; let set2; let bad;
    await act(async () => { set1 = gym.value.addSetToWorkout(workout.id, { exerciseId: exercise.id, weight: '60', reps: '8' }); });
    await act(async () => { set2 = gym.value.addSetToWorkout(workout.id, { exerciseId: exercise.id, weight: '62,5', reps: '' }); });
    await act(async () => { bad = gym.value.addSetToWorkout(workout.id, { exerciseId: exercise.id, weight: 'abc' }); });
    expect(set1).toMatchObject({ weight: 60, reps: 8 });
    expect('reps' in set2).toBe(false);
    expect(bad).toBeNull();
    expect(gym.value.workouts[0].sets.map((s) => s.weight)).toEqual([60, 62.5]);

    await act(async () => { gym.value.removeSetFromWorkout(workout.id, set1.id); });
    expect(gym.value.workouts[0].sets.map((s) => s.id)).toEqual([set2.id]);

    let result;
    await act(async () => { result = gym.value.finishWorkout(workout.id); });
    expect(result).toEqual({ discarded: false });
    expect(gym.value.workouts[0].endedAt).toBeGreaterThan(0);
    expect(stored().workouts[0].endedAt).toBeGreaterThan(0);
  });

  it('ein Training ohne Sätze wird beim Beenden verworfen', async () => {
    const gym = renderGym();
    let workout;
    await act(async () => { workout = gym.value.startWorkout(null); });
    expect(gym.value.workouts).toHaveLength(1);
    let result;
    await act(async () => { result = gym.value.finishWorkout(workout.id); });
    expect(result).toEqual({ discarded: true });
    expect(gym.value.workouts).toHaveLength(0);
    expect(gym.value.finishWorkout('gibtsnicht')).toBeNull();
    expect(gym.value.addSetToWorkout('gibtsnicht', { exerciseId: 'a', weight: 1 })).toBeNull();
  });

  it('eine Übung mit Sätzen lässt sich nicht löschen, eine ungenutzte schon (und verschwindet aus den Trainingstagen)', async () => {
    const gym = renderGym();
    let used; let free; let workout;
    await act(async () => { used = await gym.value.addExercise('Rudern'); });
    await act(async () => { free = await gym.value.addExercise('Curls'); });
    await act(async () => { gym.value.savePlan({ name: 'Pull', exerciseIds: [used.id, free.id] }); });
    await act(async () => { workout = gym.value.startWorkout(null); });
    await act(async () => { gym.value.addSetToWorkout(workout.id, { exerciseId: used.id, weight: 50 }); });

    let ok;
    await act(async () => { ok = gym.value.deleteExercise(used.id); });
    expect(ok).toBe(false);
    expect(gym.value.exercises).toHaveLength(2);

    await act(async () => { ok = gym.value.deleteExercise(free.id); });
    expect(ok).toBe(true);
    expect(gym.value.exercises.map((e) => e.id)).toEqual([used.id]);
    expect(gym.value.plans[0].exerciseIds).toEqual([used.id]);
  });

  it('Körperwerte hinzufügen und löschen', async () => {
    const gym = renderGym();
    await act(async () => { gym.value.addBodyEntry({ id: 'b1', date: '2026-10-19', weight: 81.2, createdAt: 1 }); });
    await act(async () => { gym.value.addBodyEntry({ id: 'b2', date: '2026-10-12', weight: 81.9, createdAt: 2 }); });
    expect(gym.value.body.map((b) => b.id)).toEqual(['b1', 'b2']);
    await act(async () => { gym.value.deleteBodyEntry('b1'); });
    expect(gym.value.body.map((b) => b.id)).toEqual(['b2']);
  });

  it('alles bleibt nach dem Neuladen erhalten und kaputte Daten werden abgefangen', async () => {
    const first = renderGym();
    await act(async () => { await first.value.addExercise('Kniebeugen'); });
    await act(async () => { first.value.addBodyEntry({ id: 'b1', date: '2026-10-19', weight: 80, createdAt: 1 }); });
    first.utils.unmount();

    const second = renderGym();
    await waitFor(() => expect(second.value.exercises).toHaveLength(1));
    expect(second.value.exercises[0].name).toBe('Kniebeugen');
    expect(second.value.body).toHaveLength(1);
    second.utils.unmount();

    localStorage.setItem('focusflow_guest_gym', '{kaputt');
    const broken = renderGym();
    await waitFor(() => expect(broken.value).toBeDefined());
    expect(broken.value.exercises).toEqual([]);
  });
});
