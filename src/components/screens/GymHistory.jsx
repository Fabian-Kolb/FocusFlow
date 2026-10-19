import React, { useMemo, useState } from 'react';
import { useGym } from '../../context/GymContext';
import {
  buildTimeline, formatWeight, relativeDay, satzText,
} from '../../lib/gym';
import { parseIsoDay } from '../../lib/projectProgress';
import { Badge, Button, Card, Chip, EmptyState, FOCUS, Icon, IconTile, PageHeader, cx } from '../ds';
import WorkoutDetailSheet from '../gym/WorkoutDetailSheet';

const FILTERS = [
  { id: 'all', label: 'Alles' },
  { id: 'workout', label: 'Trainings' },
  { id: 'body', label: 'Körper' },
];

const monthOf = (iso) => parseIsoDay(iso)?.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) || iso;
const gapText = (days) => (days === 1 ? 'Ein Tag davor' : `${days} Tage davor`);

/**
 * Verlauf: alles, was du gemacht hast, als Zeitleiste von neu nach alt, Trainings und Körperwerte gemischt.
 * Zwischen den Einträgen steht, wie viele Tage dazwischen lagen; Trainings zeigen Bestwerte und die Veränderung
 * gegenüber dem letzten Mal am selben Trainingstag, Körperwerte die Veränderung zum Wert davor.
 */
const GymHistory = ({ setCurrentScreen }) => {
  const { workouts, body, plans, exercises } = useGym();
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const timeline = useMemo(() => buildTimeline({ workouts, body, plans, exercises }), [workouts, body, plans, exercises]);
  const shown = filter === 'all' ? timeline : timeline.filter((i) => i.kind === filter);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Verlauf" description="Alles, was du gemacht hast, in zeitlicher Reihenfolge." />

      {timeline.length === 0 ? (
        <EmptyState
          icon="history"
          title="Noch nichts im Verlauf"
          description="Sobald du ein Training beendest oder dein Gewicht einträgst, erscheint es hier."
          action={<Button onClick={() => setCurrentScreen('gym-log')}>Zum Training</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
            ))}
          </div>

          <ol className="flex flex-col">
            {shown.map((item, index) => {
              const month = monthOf(item.date);
              const newMonth = index === 0 || monthOf(shown[index - 1].date) !== month;
              const older = shown[index + 1];
              const gap = older && filter === 'all' ? item.gapDays : older ? Math.max(0, Math.round((parseIsoDay(item.date) - parseIsoDay(older.date)) / 86400000)) : null;
              return (
                <li key={item.key}>
                  {newMonth && <h2 className={cx('text-eyebrow text-secondary', index === 0 ? 'pb-3' : 'pb-3 pt-4')}>{month}</h2>}
                  <div className="flex gap-3">
                    <div className="flex w-10 shrink-0 flex-col items-center">
                      <IconTile icon={item.kind === 'workout' ? 'fitness_center' : 'monitor_weight'} size="sm" />
                      {older && <span className="w-px flex-1 bg-muted" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1 pb-2">
                      {item.kind === 'workout' ? (
                        <WorkoutEntry item={item} onOpen={() => setDetail(item.workout)} />
                      ) : (
                        <BodyEntry item={item} />
                      )}
                      {gap !== null && gap >= 2 && (
                        <p className="py-3 text-caption text-tertiary">{gapText(gap)}</p>
                      )}
                      {gap !== null && gap < 2 && <div className="h-3" />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <WorkoutDetailSheet workout={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

function WorkoutEntry({ item, onOpen }) {
  return (
    <Card as="button" type="button" interactive padding="md" onClick={onOpen} aria-label={`${item.title}, ${relativeDay(item.date)}, Details`}>
      <span className="flex flex-col gap-1.5 text-left">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-heading text-primary">{item.title}</span>
          <span className="shrink-0 text-caption text-secondary">{relativeDay(item.date)}</span>
        </span>
        <span className="text-caption text-secondary">{item.names.join(', ')}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge size="sm">{satzText(item.setCount)}</Badge>
          {item.volume > 0 && <Badge size="sm">{Math.round(item.volume).toLocaleString('de-DE')} kg Volumen</Badge>}
          {item.minutes ? <Badge size="sm">{item.minutes} Min</Badge> : null}
          {item.records > 0 && <Badge tone="success" size="sm" icon="emoji_events">{item.records === 1 ? '1 Bestwert' : `${item.records} Bestwerte`}</Badge>}
          {item.volumeChange !== null && item.volumeChange !== 0 && (
            <Badge tone={item.volumeChange > 0 ? 'success' : 'neutral'} size="sm" icon={item.volumeChange > 0 ? 'trending_up' : 'trending_down'}>
              {item.volumeChange > 0 ? '+' : ''}{item.volumeChange} % zum letzten Mal
            </Badge>
          )}
        </span>
      </span>
    </Card>
  );
}

function BodyEntry({ item }) {
  const { entry, delta } = item;
  return (
    <Card padding="md">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-heading text-primary">Körpergewicht {formatWeight(entry.weight)}</span>
          <span className="shrink-0 text-caption text-secondary">{relativeDay(entry.date)}</span>
        </div>
        {entry.note && <p className="text-caption text-secondary">{entry.note}</p>}
        {delta !== null && delta !== 0 && (
          <div>
            <Badge size="sm" icon={delta > 0 ? 'arrow_upward' : 'arrow_downward'}>{delta > 0 ? '+' : ''}{delta.toLocaleString('de-DE')} kg zum Wert davor</Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

export default GymHistory;
