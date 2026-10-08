import React from 'react';
import { SectionIcon, TaskIcon } from './ItemIcons';

// Gemeinsamer Karteninhalt für Projekte und Erinnerungen.
// Wird in der Projekt-/Erinnerungsübersicht und im Kanban-Board genutzt, damit alle drei Stellen
// gleich aussehen. Drag-Handler, Klick und Pausiert-Styling bleiben beim jeweiligen Screen.

const STATUS_LABELS = { LAUFEND: 'AKTIV', ABGESCHLOSSEN: 'ERLEDIGT' };

function statusStyle(status) {
  if (status === 'GEPLANT') return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
  if (status === 'ABGESCHLOSSEN') return 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200';
  return 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
}

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

function StatusChip({ status, onToggle }) {
  if (!status) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${statusStyle(status)}`}
      title="Klicken um Status zu wechseln"
    >
      {STATUS_LABELS[status] || status}
    </button>
  );
}

// Runde Checkbox zum direkten Abhaken (nur Erinnerungen)
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
      className="shrink-0 -m-1.5 p-1.5 rounded-full text-on-surface-variant hover:text-emerald-600 transition-colors"
    >
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors ${
          done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-current'
        }`}
      >
        {done && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
      </span>
    </button>
  );
}

function CardHeader({ item, menu, leading, done = false }) {
  return (
    <>
      {item.inKanban === false && (
        <div
          className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-white z-10 shadow-sm"
          title="Nicht im Kanban-Board"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        {leading}
        <div className="marquee-wrapper flex-1 min-w-0">
          <h3 className={`text-sm sm:text-base font-bold hover:underline leading-snug marquee-content ${done ? 'line-through text-on-surface-variant' : ''}`}>
            {item.title}
          </h3>
        </div>
        {menu}
      </div>
      <p className={`mt-0.5 min-h-[1rem] ${leading ? 'pl-7' : ''} text-[10px] sm:text-xs text-on-surface-variant font-mono truncate flex items-center gap-1.5`}>
        <span className="truncate">
          {item.dateRange || 'Kein Datum'}
          {item.daysRemaining && <span className="font-bold text-primary"> ({item.daysRemaining})</span>}
        </span>
        {item.isCalendarSynced && (
          <span
            className="material-symbols-outlined text-[14px] text-emerald-600 shrink-0"
            title="Mit Google Kalender synchronisiert"
          >
            calendar_month
          </span>
        )}
      </p>
    </>
  );
}

/**
 * Fortschrittsbalken. Ohne `marker` zeigt er nur einen Wert;
 * mit `marker` markiert ein senkrechter Strich zusätzlich die verstrichene Zeit (Soll-Position).
 */
function ProgressBar({ value, marker, label }) {
  const fill = clampPercent(value);
  return (
    <div
      className="relative flex-1 h-1.5 bg-surface-low border border-outline-variant rounded-full"
      role="progressbar"
      aria-valuenow={fill}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="bg-primary h-full rounded-full" style={{ width: `${fill}%` }} />
      {marker !== undefined && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-amber-500"
          style={{ left: `calc(${clampPercent(marker)}% - 1px)` }}
          title={`Verstrichene Zeit: ${clampPercent(marker)}%`}
        />
      )}
    </div>
  );
}

function Stat({ icon, done, total, label }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${done} von ${total} erledigt`}>
      {icon}
      <span className="sr-only">{label}:</span>
      <span className="font-bold text-primary">{done ?? 0}/{total ?? 0}</span>
    </span>
  );
}

export function ProjectCardContent({ project, menu, onToggleStatus }) {
  return (
    <>
      <CardHeader item={project} menu={menu} />

      <div className="mt-2 flex items-center gap-3 text-[11px] sm:text-xs font-mono text-on-surface-variant">
        <Stat icon={<SectionIcon />} done={project.phasesCompleted} total={project.phasesTotal} label="Abschnitte" />
        <Stat icon={<TaskIcon />} done={project.tasksCompleted} total={project.tasksTotal} label="Aufgaben" />
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-outline-variant space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusChip status={project.status} onToggle={onToggleStatus} />
          {project.warning && (
            <span className="px-2 py-0.5 rounded-md border bg-amber-100 text-amber-900 border-amber-300 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">
              {project.warning}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold">
          <ProgressBar
            value={project.progress}
            marker={project.timeElapsed}
            label={`Fortschritt ${clampPercent(project.progress)}%, verstrichene Zeit ${clampPercent(project.timeElapsed)}%`}
          />
          <span className="w-9 text-right" title="Fortschritt">{clampPercent(project.progress)}%</span>
        </div>
      </div>
    </>
  );
}

export function ReminderCardContent({ reminder, menu, onToggleStatus, onToggleDone }) {
  const done = reminder.status === 'ABGESCHLOSSEN';
  return (
    <>
      <CardHeader
        item={reminder}
        menu={menu}
        done={done}
        leading={onToggleDone && <DoneCheckbox done={done} title={reminder.title} onToggle={onToggleDone} />}
      />

      <div className="mt-2.5 pt-2.5 border-t border-outline-variant flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-on-surface-variant">
        <StatusChip status={reminder.status} onToggle={onToggleStatus} />
        <span className="material-symbols-outlined text-[14px] shrink-0" title="Verstrichene Zeit" aria-hidden="true">
          schedule
        </span>
        <ProgressBar value={reminder.timeElapsed} label={`Verstrichene Zeit ${clampPercent(reminder.timeElapsed)}%`} />
        <span className="w-9 text-right">{clampPercent(reminder.timeElapsed)}%</span>
      </div>
    </>
  );
}
