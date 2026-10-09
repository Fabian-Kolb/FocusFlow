import React from 'react';
import { SectionIcon, TaskIcon } from './ItemIcons';
import { getReminderDateInfo } from '../../lib/reminderDates';
import { formatRecurrence } from '../../lib/recurrence';
import { Badge, FOCUS, Icon, cx } from '../ds';

// Gemeinsamer Karteninhalt für Projekte und Erinnerungen.
// Wird in der Projekt-/Erinnerungsübersicht und im Kanban-Board genutzt, damit alle drei Stellen
// gleich aussehen. Drag-Handler, Klick und Pausiert-Styling bleiben beim jeweiligen Screen.

// Status = Bedeutung (Regel 01): aktiv grün, geplant Stahlblau, erledigt neutral mit Haken
const STATUS_META = {
  LAUFEND: { label: 'Aktiv', tone: 'success' },
  'IN ARBEIT': { label: 'Aktiv', tone: 'success' },
  AKTIV: { label: 'Aktiv', tone: 'success' },
  GEPLANT: { label: 'Geplant', tone: 'info' },
  ABGESCHLOSSEN: { label: 'Erledigt', tone: 'neutral', icon: 'check' },
};

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

function StatusChip({ status, onToggle }) {
  if (!status) return null;
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cx('shrink-0 rounded-sm', FOCUS)}
      title="Klicken, um den Status zu wechseln"
    >
      <Badge tone={meta.tone} icon={meta.icon} size="sm">{meta.label}</Badge>
    </button>
  );
}

// Abhaken (nur Erinnerungen): Quadrat wie alle Auswahlfelder, erledigt = grün
function DoneCheckbox({ done, title, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `„${title}“ wieder öffnen` : `„${title}“ als erledigt abhaken`}
      title={done ? 'Wieder öffnen' : 'Als erledigt abhaken'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cx('relative -m-1.5 shrink-0 rounded-md p-1.5 text-secondary hover:text-success', FOCUS)}
    >
      <span
        className={cx(
          'flex h-5 w-5 items-center justify-center rounded-xs border-2 transition-colors duration-instant',
          done ? 'border-success bg-success text-on-accent' : 'border-control bg-surface',
        )}
      >
        {done && <Icon name="check" size="sm" />}
      </span>
    </button>
  );
}

const URGENCY_TONES = {
  overdue: 'danger',
  today: 'warning',
  soon: 'neutral',
  later: 'neutral',
};

function CardHeader({ item, menu, leading, done = false, dateContent }) {
  return (
    <>
      {item.inKanban === false && (
        <div
          className="absolute right-2 top-2 z-10 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-focus"
          title="Nicht im Kanban-Board"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        {leading}
        <div className="marquee-wrapper min-w-0 flex-1">
          <h3 className={cx('marquee-content text-body-strong hover:underline sm:text-subheading', done && 'text-secondary line-through')}>
            {item.title}
          </h3>
        </div>
        {menu}
      </div>
      <p className={cx('mt-0.5 flex min-h-4 items-center gap-1.5 truncate text-caption text-secondary', leading && 'pl-7')}>
        {dateContent}
        {item.isCalendarSynced && (
          <Icon name="calendar_month" size="sm" className="shrink-0 text-success" title="Mit Google Kalender synchronisiert" />
        )}
      </p>
    </>
  );
}

/**
 * Fortschrittsbalken. Ohne `marker` zeigt er nur einen Wert;
 * mit `marker` markiert ein senkrechter Strich zusätzlich die verstrichene Zeit (Soll-Position).
 */
function ElapsedProgress({ value, marker, label }) {
  const fill = clampPercent(value);
  return (
    <div
      className="relative h-1.5 flex-1 rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={fill}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-slow ease-standard" style={{ width: `${fill}%` }} />
      {marker !== undefined && (
        <div
          className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-warning"
          style={{ left: `calc(${clampPercent(marker)}% - 1px)` }}
          title={`Verstrichene Zeit: ${clampPercent(marker)} %`}
        />
      )}
    </div>
  );
}

function Count({ icon, done, total, label }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${done} von ${total} erledigt`}>
      {icon}
      <span className="sr-only">{label}:</span>
      <span className="text-caption-strong tabular-nums text-primary">{done ?? 0}/{total ?? 0}</span>
    </span>
  );
}

export function ProjectCardContent({ project, menu, onToggleStatus }) {
  return (
    <>
      <CardHeader
        item={project}
        menu={menu}
        dateContent={
          <span className="truncate">
            {project.dateRange || 'Kein Datum'}
            {project.daysRemaining && <span className="text-caption-strong text-primary"> ({project.daysRemaining})</span>}
          </span>
        }
      />

      <div className="mt-2 flex items-center gap-3 text-caption text-secondary">
        <Count icon={<SectionIcon />} done={project.phasesCompleted} total={project.phasesTotal} label="Abschnitte" />
        <Count icon={<TaskIcon />} done={project.tasksCompleted} total={project.tasksTotal} label="Aufgaben" />
      </div>

      <div className="mt-2.5 space-y-2 border-t border-subtle pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip status={project.status} onToggle={onToggleStatus} />
          {project.warning && <Badge tone="warning" size="sm">{project.warning}</Badge>}
        </div>
        <div className="flex items-center gap-2 text-caption-strong tabular-nums">
          <ElapsedProgress
            value={project.progress}
            marker={project.timeElapsed}
            label={`Fortschritt ${clampPercent(project.progress)} %, verstrichene Zeit ${clampPercent(project.timeElapsed)} %`}
          />
          <span className="w-10 text-right" title="Fortschritt">{clampPercent(project.progress)} %</span>
        </div>
      </div>
    </>
  );
}

export function ReminderCardContent({ reminder, menu, onToggleStatus, onToggleDone }) {
  const done = reminder.status === 'ABGESCHLOSSEN';
  const info = getReminderDateInfo(reminder);
  const elapsed = info.timeElapsed ?? 0;
  const recurrenceLabel = formatRecurrence(reminder.recurrence);
  return (
    <>
      <CardHeader
        item={reminder}
        menu={menu}
        done={done}
        dateContent={
          <>
            {recurrenceLabel && (
              <Icon name="event_repeat" size="sm" className="shrink-0" title={`Wiederholt sich: ${recurrenceLabel}`} aria-label={`Wiederholt sich: ${recurrenceLabel}`} />
            )}
            <span className="truncate">{info.dateLabel}</span>
            {info.relativeLabel && !done && (
              <Badge tone={URGENCY_TONES[info.urgency] || 'neutral'} size="sm" className="shrink-0">{info.relativeLabel}</Badge>
            )}
          </>
        }
        leading={onToggleDone && <DoneCheckbox done={done} title={reminder.title} onToggle={onToggleDone} />}
      />

      <div className="mt-2.5 flex items-center gap-2 border-t border-subtle pt-2.5 text-caption text-secondary">
        <StatusChip status={reminder.status} onToggle={onToggleStatus} />
        <Icon name="schedule" size="sm" className="shrink-0" title="Verstrichene Zeit" aria-hidden="true" />
        <ElapsedProgress value={elapsed} label={`Verstrichene Zeit ${elapsed} %`} />
        <span className="w-10 text-right tabular-nums">{info.hasDate ? `${elapsed} %` : '–'}</span>
      </div>
    </>
  );
}
