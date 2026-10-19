import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  DEFAULT_WEEKLY_GOAL, MAX_EXERCISES_PER_PLAN, cleanSettings, clampGoal, makeSet, newGymId, newWorkout, sortBody, sortPlans, sortWorkouts, withSet, withoutSet,
  workoutExerciseIds,
} from '../lib/gym';

/**
 * Gym-Logbuch: Übungen, Trainingstage (Pläne), Trainings und Körperwerte.
 *
 * Speicher:
 *  - Gäste und das Dev-Konto: ein JSON im Browser (`focusflow_guest_gym`), jede Änderung wird sofort geschrieben.
 *  - Angemeldete Nutzer: Firestore-Sammlungen unter users/{uid}/ (gymExercises, gymPlans, gymWorkouts, gymBody).
 *    Geschrieben wird OHNE zu warten: Mit dem Offline-Cache nimmt Firestore die Änderung sofort an und schickt sie
 *    nach, sobald Netz da ist (im Studio oft schlecht). Die Snapshot-Listener liefern die eigenen Schreibvorgänge
 *    sofort zurück, die Anzeige aktualisiert sich also auch offline; schlägt ein Schreiben fehl, verschwindet es wieder.
 */

const GUEST_KEY = 'focusflow_guest_gym';
const REPS_KEY = 'focusflow_gym_reps'; // Geräte-Einstellung: Wiederholungen erfassen ('off' blendet sie aus)
const GOAL_KEY = 'focusflow_gym_goal'; // Geräte-Einstellung: Wochenziel 1 bis 7
const COLLECTIONS = { exercises: 'gymExercises', plans: 'gymPlans', workouts: 'gymWorkouts', body: 'gymBody' };
const EMPTY = { exercises: [], plans: [], workouts: [], body: [] };

function readGuest() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    return Object.fromEntries(Object.keys(EMPTY).map((key) => [key, Array.isArray(parsed[key]) ? parsed[key] : []]));
  } catch {
    return EMPTY;
  }
}

const readSetting = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeSetting = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // gilt dann nur für diese Sitzung
  }
};

const NOOP_ASYNC = async () => null;
const FALLBACK = {
  ...EMPTY,
  repsEnabled: true, setRepsEnabled: () => {}, weeklyGoal: DEFAULT_WEEKLY_GOAL, setWeeklyGoal: () => {},
  addExercise: NOOP_ASYNC, renameExercise: () => {}, deleteExercise: () => false, setExerciseSettings: () => {},
  savePlan: () => null, deletePlan: () => {},
  startWorkout: () => null, saveWorkout: () => {}, deleteWorkout: () => {},
  addSetToWorkout: () => null, removeSetFromWorkout: () => {}, finishWorkout: () => null,
  addBodyEntry: () => {}, deleteBodyEntry: () => {},
};

const GymContext = createContext(null);

export function GymProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(EMPTY);
  const dataRef = useRef(EMPTY);
  dataRef.current = data;

  // Einstellungen je Gerät, für alle Gym-Bildschirme gemeinsam
  const [repsEnabled, setRepsEnabledState] = useState(() => readSetting(REPS_KEY) !== 'off');
  const [weeklyGoal, setWeeklyGoalState] = useState(() => clampGoal(readSetting(GOAL_KEY) ?? DEFAULT_WEEKLY_GOAL));
  const setRepsEnabled = useCallback((enabled) => {
    setRepsEnabledState(Boolean(enabled));
    writeSetting(REPS_KEY, enabled ? 'on' : 'off');
  }, []);
  const setWeeklyGoal = useCallback((goal) => {
    const clamped = clampGoal(goal);
    setWeeklyGoalState(clamped);
    writeSetting(GOAL_KEY, String(clamped));
  }, []);

  const isGuest = Boolean(user?.isGuest);
  const uid = user?.uid;

  // Laden: Gast aus dem Browser, sonst Listener (erst nach bestätigter E-Mail, die Regeln würden sonst abweisen)
  useEffect(() => {
    if (!user) {
      setData(EMPTY);
      return undefined;
    }
    if (isGuest) {
      setData(readGuest());
      return undefined;
    }
    if (!user.emailVerified) {
      setData(EMPTY);
      return undefined;
    }
    const unsubscribes = Object.entries(COLLECTIONS).map(([key, name]) => onSnapshot(
      collection(db, 'users', user.uid, name),
      (snapshot) => {
        const items = [];
        snapshot.forEach((d) => items.push(d.data()));
        setData((prev) => ({ ...prev, [key]: items }));
      },
      (err) => console.error(`[Gym] ${name} konnte nicht geladen werden:`, err),
    ));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [user]);

  const reportError = useCallback((err) => {
    console.error('[Gym] Speichern fehlgeschlagen:', err);
    showToast({ message: 'Konnte nicht gespeichert werden.', icon: 'error' });
  }, [showToast]);

  // Gast: sofort lokal ändern und im Browser speichern; sonst an Firestore schicken (ohne zu warten)
  const upsert = useCallback((kind, item) => {
    const stamped = { ...item, updatedAt: Date.now() };
    if (isGuest) {
      const current = dataRef.current;
      const list = current[kind];
      const next = { ...current, [kind]: list.some((i) => i.id === stamped.id) ? list.map((i) => (i.id === stamped.id ? stamped : i)) : [...list, stamped] };
      dataRef.current = next;
      setData(next);
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(next)); } catch { /* gilt dann bis zum Neuladen */ }
      return stamped;
    }
    if (uid) setDoc(doc(db, 'users', uid, COLLECTIONS[kind], stamped.id), stamped).catch(reportError);
    return stamped;
  }, [isGuest, uid, reportError]);

  const remove = useCallback((kind, id) => {
    if (isGuest) {
      const current = dataRef.current;
      const next = { ...current, [kind]: current[kind].filter((i) => i.id !== id) };
      dataRef.current = next;
      setData(next);
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(next)); } catch { /* gilt dann bis zum Neuladen */ }
      return;
    }
    if (uid) deleteDoc(doc(db, 'users', uid, COLLECTIONS[kind], id)).catch(reportError);
  }, [isGuest, uid, reportError]);

  const find = (kind, id) => dataRef.current[kind].find((i) => i.id === id);

  /* ---------------------------------------------------------------- Übungen */

  /** Übung mit diesem Namen anlegen; gibt es sie schon (Groß-/Kleinschreibung egal), kommt die vorhandene zurück */
  const addExercise = useCallback(async (name) => {
    const clean = String(name || '').trim().slice(0, 100);
    if (!clean) return null;
    const existing = dataRef.current.exercises.find((e) => e.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    return upsert('exercises', { id: newGymId('e'), name: clean, createdAt: Date.now() });
  }, [upsert]);

  const renameExercise = useCallback((id, name) => {
    const clean = String(name || '').trim().slice(0, 100);
    const exercise = find('exercises', id);
    if (!exercise || !clean || clean === exercise.name) return;
    upsert('exercises', { ...exercise, name: clean });
  }, [upsert]);

  /** Einstellungen einer Übung setzen (Liste { label, value }); leer entfernt das Feld */
  const setExerciseSettings = useCallback((id, settings) => {
    const exercise = find('exercises', id);
    if (!exercise) return;
    const { settings: _old, ...rest } = exercise;
    const clean = cleanSettings(settings);
    upsert('exercises', clean.length ? { ...rest, settings: clean } : rest);
  }, [upsert]);

  /** Löschen geht nur, wenn die Übung in keinem Training vorkommt (sonst fehlt ihr Name im Verlauf). Aus Trainingstagen wird sie entfernt. */
  const deleteExercise = useCallback((id) => {
    const used = dataRef.current.workouts.some((w) => (w.sets || []).some((s) => s.exerciseId === id));
    if (used) return false;
    dataRef.current.plans.filter((p) => (p.exerciseIds || []).includes(id)).forEach((p) => {
      upsert('plans', { ...p, exerciseIds: p.exerciseIds.filter((x) => x !== id) });
    });
    remove('exercises', id);
    return true;
  }, [upsert, remove]);

  /* ---------------------------------------------------------------- Trainingstage */

  /** Trainingstag anlegen oder ändern; neue bekommen die nächste Position */
  const savePlan = useCallback((plan) => {
    const name = String(plan.name || '').trim().slice(0, 100);
    if (!name) return null;
    const existing = plan.id ? find('plans', plan.id) : null;
    const order = existing?.order ?? plan.order ?? dataRef.current.plans.reduce((max, p) => Math.max(max, (p.order ?? 0) + 1), 0);
    return upsert('plans', {
      ...(existing || {}),
      id: existing?.id || newGymId('p'),
      name,
      exerciseIds: [...new Set(plan.exerciseIds || [])].slice(0, MAX_EXERCISES_PER_PLAN),
      order,
      createdAt: existing?.createdAt || Date.now(),
    });
  }, [upsert]);

  const deletePlan = useCallback((id) => remove('plans', id), [remove]);

  /* ---------------------------------------------------------------- Trainings */

  const saveWorkout = useCallback((workout) => upsert('workouts', workout), [upsert]);
  const deleteWorkout = useCallback((id) => remove('workouts', id), [remove]);

  /** Training starten (mit Trainingstag oder frei) */
  const startWorkout = useCallback((plan = null) => upsert('workouts', newWorkout({ plan })), [upsert]);

  /** Satz speichern; ungültige Eingaben ergeben null */
  const addSetToWorkout = useCallback((workoutId, input) => {
    const workout = find('workouts', workoutId);
    const set = makeSet(input);
    if (!workout || !set) return null;
    upsert('workouts', withSet(workout, set));
    return set;
  }, [upsert]);

  const removeSetFromWorkout = useCallback((workoutId, setId) => {
    const workout = find('workouts', workoutId);
    if (workout) upsert('workouts', withoutSet(workout, setId));
  }, [upsert]);

  /** Training beenden; ohne einen Satz wird es verworfen. Gibt { discarded } zurück. */
  const finishWorkout = useCallback((workoutId) => {
    const workout = find('workouts', workoutId);
    if (!workout) return null;
    if ((workout.sets || []).length === 0) {
      remove('workouts', workoutId);
      return { discarded: true };
    }
    // Einstellungen von heute festhalten, damit der Verlauf zeigt, wie die Geräte damals standen
    const setups = {};
    workoutExerciseIds(workout).forEach((exerciseId) => {
      const settings = find('exercises', exerciseId)?.settings;
      if ((workout.sets || []).some((s) => s.exerciseId === exerciseId) && settings?.length) setups[exerciseId] = settings;
    });
    upsert('workouts', { ...workout, ...(Object.keys(setups).length ? { setups } : {}), endedAt: Date.now() });
    return { discarded: false };
  }, [upsert, remove]);

  /* ---------------------------------------------------------------- Körperwerte */

  const addBodyEntry = useCallback((entry) => upsert('body', entry), [upsert]);
  const deleteBodyEntry = useCallback((id) => remove('body', id), [remove]);

  const value = useMemo(() => ({
    exercises: [...data.exercises].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    plans: sortPlans(data.plans),
    workouts: sortWorkouts(data.workouts),
    body: sortBody(data.body),
    repsEnabled, setRepsEnabled, weeklyGoal, setWeeklyGoal,
    addExercise, renameExercise, deleteExercise, setExerciseSettings,
    savePlan, deletePlan,
    startWorkout, saveWorkout, deleteWorkout, addSetToWorkout, removeSetFromWorkout, finishWorkout,
    addBodyEntry, deleteBodyEntry,
  }), [data, repsEnabled, setRepsEnabled, weeklyGoal, setWeeklyGoal, addExercise, renameExercise, deleteExercise, setExerciseSettings, savePlan, deletePlan, startWorkout, saveWorkout, deleteWorkout, addSetToWorkout, removeSetFromWorkout, finishWorkout, addBodyEntry, deleteBodyEntry]);

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGym() {
  // Ohne Provider (isolierte Tests) bleibt das Logbuch leer
  return useContext(GymContext) || FALLBACK;
}
