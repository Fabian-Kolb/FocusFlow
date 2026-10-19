import React, { useMemo, useState } from 'react';
import { useGym } from '../../context/GymContext';
import {
  bestWeight, describeSets, exerciseSeries, exercisesWithData, formatWeight, recordSetIds, relativeDay, setsOf, thisWeekCount, workoutsPerWeek,
} from '../../lib/gym';
import { parseIsoDay } from '../../lib/projectProgress';
import { Badge, Button, Card, EmptyState, Field, PageHeader, SectionHeader, Select, Stat, cx } from '../ds';
import LineChart from '../gym/LineChart';

const shortDate = (iso) => parseIsoDay(iso)?.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) || iso;
const CHART_POINTS = 24;

/** Fortschritt: Verlauf und Bestwert je Übung, Trainings pro Woche mit Wochenziel. */
const GymProgress = ({ setCurrentScreen }) => {
  const { exercises, workouts, weeklyGoal, setWeeklyGoal } = useGym();
  const withData = useMemo(() => exercisesWithData(workouts, exercises), [workouts, exercises]);
  const [picked, setPicked] = useState(null);
  const exercise = withData.find((e) => e.id === picked) || withData[0] || null;

  const series = useMemo(() => (exercise ? exerciseSeries(workouts, exercise.id) : []), [workouts, exercise]);
  const shown = series.slice(-CHART_POINTS);
  const best = exercise ? bestWeight(workouts, exercise.id) : 0;
  const weeks = useMemo(() => workoutsPerWeek(workouts, new Date(), 8), [workouts]);
  const maxCount = Math.max(weeklyGoal, ...weeks.map((w) => w.count), 1);

  // Letzte Trainings dieser Übung mit Bestwert-Markierung (als Tabelle für alle, die das Diagramm nicht sehen)
  const recent = useMemo(() => {
    if (!exercise) return [];
    return workouts.filter((w) => setsOf(w, exercise.id).length > 0).slice(0, 8).map((w) => {
      const sets = setsOf(w, exercise.id);
      const records = recordSetIds(workouts, w);
      return { workout: w, sets, record: sets.some((s) => records.has(s.id)) };
    });
  }, [workouts, exercise]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fortschritt" description="Wie sich Gewichte und Häufigkeit entwickeln." />

      {withData.length === 0 ? (
        <EmptyState
          icon="show_chart"
          title="Noch keine Daten"
          description="Trage im Training Sätze ein, dann siehst du hier den Verlauf deiner Gewichte."
          action={<Button onClick={() => setCurrentScreen('gym-log')}>Zum Training</Button>}
        />
      ) : (
        <>
          <Card padding="md" className="space-y-4">
            <Field label="Übung">
              <Select value={exercise.id} onChange={(e) => setPicked(e.target.value)}>
                {withData.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Bestwert" value={formatWeight(best)} />
              <Stat label="Trainings" value={series.length} />
              <Stat label="Zuletzt" value={relativeDay(series[series.length - 1].date)} />
            </div>
          </Card>

          <Card padding="md" className="space-y-3">
            <SectionHeader title="Höchstes Gewicht pro Training" />
            {shown.length < 2 && <p className="text-body text-secondary">Ab dem zweiten Training zeigt sich der Verlauf als Linie.</p>}
            <LineChart
              points={shown.map((p) => ({ key: p.workoutId, label: shortDate(p.date), value: p.top, valueText: formatWeight(p.top) }))}
              formatY={(n) => `${Math.round(n * 2) / 2}`}
              ariaLabel={`${exercise.name}: höchstes Gewicht pro Training. Zuletzt ${formatWeight(series[series.length - 1].top)}, Bestwert ${formatWeight(best)}.`}
            />
            <ul className="divide-y divide-subtle" aria-label={`Letzte Trainings mit ${exercise.name}`}>
              {recent.map(({ workout, sets, record }) => (
                <li key={workout.id} className="flex items-center gap-3 py-2">
                  <span className="w-20 shrink-0 text-caption text-secondary">{shortDate(workout.date)}</span>
                  <span className="min-w-0 flex-1 text-body tabular-nums text-primary">{describeSets(sets)}</span>
                  {record && <Badge tone="success" size="sm" icon="emoji_events">Bestwert</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card padding="md" className="space-y-4">
        <SectionHeader title="Trainings pro Woche" />
        <div className="flex items-end gap-2" role="img" aria-label={`Trainings pro Woche der letzten 8 Wochen: ${weeks.map((w) => w.count).join(', ')}. Wochenziel ${weeklyGoal}.`}>
          {weeks.map((week, i) => (
            <div key={week.start.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-caption tabular-nums text-secondary">{week.count}</span>
              <div className="flex h-24 w-full items-end">
                <div
                  className={cx('w-full rounded-sm', week.count >= weeklyGoal ? 'bg-success' : week.count > 0 ? 'bg-accent' : 'bg-muted')}
                  style={{ height: `${Math.max(week.count === 0 ? 4 : 8, (week.count / maxCount) * 100)}%` }}
                />
              </div>
              <span className={cx('text-micro', i === weeks.length - 1 ? 'text-primary' : 'text-tertiary')}>{week.start.getDate()}.{week.start.getMonth() + 1}.</span>
            </div>
          ))}
        </div>
        <p className="text-caption text-secondary">Diese Woche {thisWeekCount(workouts)} von {weeklyGoal}. Grün heißt Ziel erreicht.</p>
        <Field label="Wochenziel">
          <Select value={String(weeklyGoal)} onChange={(e) => setWeeklyGoal(e.target.value)} className="max-w-48">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Training' : 'Trainings'} pro Woche</option>)}
          </Select>
        </Field>
      </Card>
    </div>
  );
};

export default GymProgress;
