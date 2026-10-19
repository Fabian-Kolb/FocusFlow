import React, { useEffect, useState } from 'react';
import { useGym } from '../../context/GymContext';
import {
  activeWorkout, nextPlan, relativeDay, satzText, thisWeekCount, weekDays, workoutSummary,
} from '../../lib/gym';
import { Badge, Button, Card, EmptyState, FOCUS, PageHeader, ProgressBar, SectionHeader, cx } from '../ds';
import GymManageSheet from '../gym/GymManageSheet';
import PlanSheet from '../gym/PlanSheet';
import WorkoutDetailSheet from '../gym/WorkoutDetailSheet';

const DAY_LETTERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Home der Umgebung Gym: Was ist heute dran, wie läuft die Woche, die letzten Trainings. */
const GymHome = ({ setCurrentScreen }) => {
  const { exercises, plans, workouts, weeklyGoal, startWorkout } = useGym();
  const [managing, setManaging] = useState(false);
  const [detail, setDetail] = useState(null);
  const [preview, setPreview] = useState(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const active = activeWorkout(workouts);
  const upcoming = nextPlan(plans, workouts);
  const count = thisWeekCount(workouts, now);
  const days = weekDays(workouts, now);
  const todayIndex = (now.getDay() + 6) % 7;
  const recent = workouts.filter((w) => w.endedAt && (w.sets || []).length > 0).slice(0, 5);
  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || null;

  const start = (plan) => {
    setPreview(null);
    startWorkout(plan);
    setCurrentScreen('gym-log');
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <PageHeader title="Gym" description={now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} />

      {active ? (
        <Card variant="highlight" padding="md">
          <div className="flex flex-col items-start gap-3">
            <Badge tone="success" dot>Training läuft</Badge>
            <p className="text-body text-secondary">
              {satzText((active.sets || []).length)} seit {new Date(active.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </p>
            <Button leadingIcon="play_arrow" onClick={() => setCurrentScreen('gym-log')}>Training fortsetzen</Button>
          </div>
        </Card>
      ) : upcoming ? (
        <Card variant="highlight" padding="md">
          <div className="flex flex-col items-start gap-3">
            <div>
              <p className="text-caption text-secondary">Heute dran</p>
              <h2 className="text-title text-primary">{upcoming.name}</h2>
              <p className="mt-1 text-body text-secondary">{(upcoming.exerciseIds || []).map(nameOf).filter(Boolean).join(', ') || 'Noch keine Übungen'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button leadingIcon="play_arrow" onClick={() => start(upcoming)}>Training starten</Button>
              <Button variant="secondary" onClick={() => setPreview(upcoming)}>Übungen ansehen</Button>
              <Button variant="ghost" onClick={() => start(null)}>Freies Training</Button>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon="fitness_center"
          title="Los geht es mit deinem ersten Training"
          description="Lege Trainingstage wie Push, Pull und Beine an oder starte frei und trage direkt Gewichte ein."
          action={<Button onClick={() => setManaging(true)}>Trainingstag anlegen</Button>}
          secondaryAction={<Button variant="secondary" onClick={() => start(null)}>Freies Training</Button>}
        />
      )}

      <Card padding="md" className="space-y-3">
        <SectionHeader title="Diese Woche" />
        <p className="text-body text-primary">
          <span className="font-label text-stat tabular-nums">{count}</span>
          <span className="text-secondary"> von {weeklyGoal} Trainings</span>
        </p>
        <ProgressBar value={Math.min(count, weeklyGoal)} max={weeklyGoal} tone={count >= weeklyGoal ? 'success' : 'accent'} label="Wochenziel" />
        <div className="grid grid-cols-7 gap-1" role="list" aria-label="Trainingstage dieser Woche">
          {DAY_LETTERS.map((letter, i) => (
            <div key={letter} role="listitem" className="flex flex-col items-center gap-1" aria-label={`${letter}: ${days[i] ? 'trainiert' : 'kein Training'}`}>
              <span className={cx('text-caption', i === todayIndex ? 'text-primary' : 'text-tertiary')}>{letter}</span>
              <span className={cx('h-2 w-full max-w-8 rounded-full', days[i] ? 'bg-success' : 'bg-muted')} />
            </div>
          ))}
        </div>
      </Card>

      {recent.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Letzte Trainings">
          <SectionHeader title="Letzte Trainings" action={<Button variant="ghost" size="sm" onClick={() => setCurrentScreen('gym-history')}>Verlauf</Button>} />
          <Card padding="none">
            <ul className="divide-y divide-subtle">
              {recent.map((workout) => {
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
      <PlanSheet plan={preview} onClose={() => setPreview(null)} onStart={start} onEdit={() => { setPreview(null); setManaging(true); }} />
      <WorkoutDetailSheet workout={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default GymHome;
