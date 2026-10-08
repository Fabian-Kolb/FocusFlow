import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModalContext } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { buildThought } from '../../lib/thoughts';
import { getProjectStats } from '../../lib/projectProgress';
import { buildAgenda, getNextTimed, formatMinutes } from '../../lib/dashboardAgenda';
import { areaOf } from '../../lib/areas';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import FioIcon from '../ui/FioIcon';
import { Skeleton } from '../ui/Skeleton';
import { AI_MODELS } from '../ui/ModelSelectorDropdown';
import { SUMMARY_LENGTH_OPTIONS } from '../ui/SummaryLengthDropdown';

// Dashboard = Tagesübersicht: Was steht heute an, was kommt die nächsten Tage, was ist überfällig.
// Aufbau (Desktop): links Überfällig + Heute, rechts die nächsten 7 Tage, Projekt, letzte Gedanken.
// Am Handy ein Stapel in fester Wichtigkeitsreihenfolge (Eingabe, Überfällig, Woche, Heute, Rest).

const KIND_META = {
  event: { icon: 'event', area: 'calendar', label: 'Termin' },
  reminder: { icon: 'notifications', area: 'reminders', label: 'Erinnerung' },
  task: { icon: 'task_alt', area: 'projects', label: 'Aufgabe' },
};

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HINT_KEY = 'focusflow_dashboard_calendar_hint_dismissed';

const readHintDismissed = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Guten Morgen';
  if (hour >= 12 && hour < 18) return 'Guten Tag';
  if (hour >= 18 && hour < 23) return 'Guten Abend';
  return 'Gute Nacht';
}

/** Eingabezeile: Gedanke direkt vom Dashboard festhalten (nutzt die KI-Einstellungen der Gedanken-Ansicht) */
function QuickThought({ onOpenThoughts }) {
  const { addInboxItem } = useModalContext();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiFlag] = usePersistedChoice('focusflow_thought_ai', ['on', 'off'], 'on');
  const [length] = usePersistedChoice('focusflow_thought_length', SUMMARY_LENGTH_OPTIONS.map((o) => o.id), 'normal');
  const [model] = usePersistedChoice('focusflow_thought_model', AI_MODELS.map((m) => m.id), 'eco');

  const save = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const thought = await buildThought(value, { summarize: aiFlag === 'on' && !user?.isGuest, model, length });
      await addInboxItem(thought);
      setText('');
      showToast({ message: 'Gedanke gespeichert', icon: 'lightbulb', actionLabel: 'Ansehen', onAction: onOpenThoughts });
    } catch (err) {
      console.error('Gedanke konnte nicht gespeichert werden:', err);
      showToast({ message: 'Gedanke konnte nicht gespeichert werden. Dein Text ist noch da.', icon: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      className="flex items-center gap-2 bg-white rounded-xl border border-outline-variant shadow-card pl-4 pr-2 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-shadow"
      aria-label="Gedanken festhalten"
    >
      <span className={`material-symbols-outlined text-[22px] shrink-0 ${areaOf('inbox').chip.split(' ')[1]}`} aria-hidden="true">lightbulb</span>
      <label htmlFor="dashboard-thought" className="sr-only">Was geht dir durch den Kopf?</label>
      <input
        id="dashboard-thought"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        placeholder="Was geht dir durch den Kopf?"
        enterKeyHint="send"
        className="flex-1 min-w-0 border-0 bg-transparent px-0 py-2 text-base placeholder:text-on-surface-variant focus:ring-0 focus:outline-none disabled:opacity-60"
      />
      <Button type="submit" size="icon" loading={busy} className="shrink-0" aria-label="Gedanke speichern">
        {!busy && <span className="material-symbols-outlined text-[22px]">arrow_upward</span>}
      </Button>
    </form>
  );
}

/** Eine Zeile in Heute / Überfällig / Tagesdetail */
function AgendaRow({ item, onToggle, onOpen, now, highlight }) {
  const meta = KIND_META[item.kind];
  const chip = areaOf(meta.area).chip;
  const canToggle = item.kind !== 'event';
  const past = item.startAt && item.startAt < now && !item.completed && item.kind === 'event';

  return (
    <li className={`flex items-center gap-3 py-2 ${highlight ? 'bg-surface-low -mx-3 px-3 rounded-lg' : ''}`}>
      <span className={`w-14 shrink-0 text-xs font-semibold tabular-nums text-right ${item.dueLabel ? 'text-danger' : 'text-on-surface-variant'}`}>
        {item.allDay ? 'Ganztägig' : item.timeLabel || item.dueLabel || ''}
      </span>
      {canToggle ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.completed}
          aria-label={`${item.title} abhaken`}
          onClick={() => onToggle(item)}
          className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
            item.completed ? 'bg-success border-success text-white' : 'border-outline-variant bg-white text-transparent hover:border-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check</span>
        </button>
      ) : (
        <span className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center ${chip}`} aria-hidden="true">
          <span className="material-symbols-outlined text-[15px]">{meta.icon}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex-1 min-w-0 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className={`block text-sm font-semibold leading-snug truncate ${item.completed ? 'line-through text-on-surface-variant' : past ? 'text-on-surface-variant' : 'text-primary'}`}>
          {item.title}
        </span>
        {item.subtitle && <span className="block text-xs text-on-surface-variant truncate">{item.subtitle}</span>}
      </button>
      {highlight && <Badge variant="default" className="shrink-0">{highlight}</Badge>}
    </li>
  );
}

function SectionCard({ title, icon, areaId, count, children, className = '', tone = 'default', action }) {
  const area = areaOf(areaId);
  const border = tone === 'danger' ? 'border-danger-border' : '';
  return (
    <Card padding="none" className={`${border} ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-1">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone === 'danger' ? 'bg-danger-soft text-danger' : area.chip}`} aria-hidden="true">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </span>
          {title}
          {count != null && <span className="text-sm font-medium text-on-surface-variant">{count}</span>}
        </h2>
        {action}
      </div>
      <div className="px-4 sm:px-5 pb-4 pt-1">{children}</div>
    </Card>
  );
}

const Dashboard = ({ setCurrentScreen }) => {
  const { user, isCalendarConnected } = useAuth();
  const {
    projects,
    reminders,
    inboxItems,
    setReminderStatus,
    setSelectedReminderId,
    toggleTask,
    setSelectedProjectId,
    openModal
  } = useModalContext();

  // Jede Minute neu rechnen: „in 25 Min“, Tageswechsel
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed);

  const month = now.getMonth();
  const year = now.getFullYear();
  const { eventsCache, isLoading: eventsLoading } = useCalendarEvents({
    enabled: Boolean(isCalendarConnected),
    year,
    month,
    prevYear: month === 0 ? year - 1 : year,
    prevMonth: month === 0 ? 11 : month - 1,
    nextYear: month === 11 ? year + 1 : year,
    nextMonth: month === 11 ? 0 : month + 1,
  });

  const agenda = useMemo(
    () => buildAgenda({ reminders, projects, eventsByMonth: eventsCache, now, days: 7 }),
    [reminders, projects, eventsCache, now]
  );

  const todayItems = agenda.days[0].items;
  const allDayToday = todayItems.filter((i) => i.allDay);
  const timedToday = todayItems.filter((i) => !i.allDay && i.startAt);
  const untimedToday = todayItems.filter((i) => !i.allDay && !i.startAt);
  const openToday = todayItems.filter((i) => !i.completed).length;
  const next = getNextTimed(timedToday, now);

  const selectedDay = selectedDayKey ? agenda.days.find((d) => d.key === selectedDayKey) : null;

  const activeProject = useMemo(() => (
    projects.find((p) => !p.deletedAt && !p.isPaused && (p.status === 'IN ARBEIT' || p.status === 'AKTIV')) ||
    projects.find((p) => !p.deletedAt && !p.isPaused && p.status !== 'ABGESCHLOSSEN') ||
    null
  ), [projects]);
  const activeProjectStats = activeProject ? getProjectStats(activeProject) : null;

  const recentThoughts = useMemo(() => {
    const all = Object.values(inboxItems || {}).flat().filter((i) => !i.deletedAt);
    const timeOf = (i) => i.createdAt || (i.id && i.id.includes('_') ? parseInt(i.id.split('_')[1]) : 0);
    return all.sort((a, b) => timeOf(b) - timeOf(a)).slice(0, 3);
  }, [inboxItems]);

  const userName = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
    ? user.email.split('@')[0]
    : '';

  const formattedDate = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleToggle = (item) => {
    if (item.kind === 'reminder') {
      // Direkt erledigen bzw. wieder öffnen; Wiederholungen springen weiter
      setReminderStatus(item.id, item.completed ? 'AKTIV' : 'ABGESCHLOSSEN');
    } else if (item.kind === 'task') {
      toggleTask(item.projectId, item.phaseId, item.id);
    }
  };

  const handleOpen = (item) => {
    if (item.kind === 'reminder') {
      setSelectedReminderId(item.id);
      setCurrentScreen('reminder-detail');
    } else if (item.kind === 'task') {
      setSelectedProjectId(item.projectId);
      setCurrentScreen('project-detail');
    } else {
      setCurrentScreen('calendar');
    }
  };

  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // gilt dann nur für diese Sitzung
    }
  };

  const showCalendarHint = !isCalendarConnected && !user?.isGuest && !hintDismissed;

  return (
    <div className="screen-transition flex flex-col gap-5 sm:gap-6">
      {/* Begrüßung + Fio */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-on-surface-variant capitalize">{formattedDate}</p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight truncate">
            {greetingFor(now.getHours())}{userName ? `, ${userName}` : ''}
          </h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => setCurrentScreen('coach')}
          aria-label="Fio KI-Coach öffnen"
          className="shrink-0 min-w-0"
        >
          <FioIcon className="w-4 h-4" color="currentColor" />
          <span className="hidden sm:inline">Fio fragen</span>
        </Button>
      </header>

      <QuickThought onOpenThoughts={() => setCurrentScreen('inbox')} />

      <div className="flex flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-12 lg:items-start">
        {/* Linke Spalte (Desktop): Überfällig + Heute */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:col-span-7">
          {agenda.overdue.length > 0 && (
            <SectionCard
              title="Überfällig"
              icon="error"
              areaId="reminders"
              tone="danger"
              count={agenda.overdue.length}
              className="order-1 lg:order-none"
            >
              <ul className="divide-y divide-outline-variant/60">
                {agenda.overdue.map((item) => (
                  <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} />
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard
            title="Heute"
            icon="today"
            areaId="dashboard"
            count={openToday > 0 ? `${openToday} offen` : null}
            className="order-3 lg:order-none"
          >
            {allDayToday.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2" aria-label="Ganztägige Termine">
                {allDayToday.map((item) => (
                  <Badge key={item.key} variant="default" className="max-w-full">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">event</span>
                    <span className="truncate">{item.title}</span>
                  </Badge>
                ))}
              </div>
            )}

            {eventsLoading && timedToday.length === 0 && (
              <div className="space-y-3 py-2" role="status" aria-label="Termine werden geladen">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}

            {timedToday.length > 0 && (
              <ul className="divide-y divide-outline-variant/60">
                {timedToday.map((item) => {
                  const isNext = next && next.item.key === item.key;
                  const label = isNext ? (next.state === 'running' ? 'läuft' : next.minutes <= 180 ? formatMinutes(next.minutes) : null) : null;
                  return <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} highlight={label} />;
                })}
              </ul>
            )}

            {untimedToday.length > 0 && (
              <div className={timedToday.length > 0 ? 'mt-3 pt-3 border-t border-outline-variant' : ''}>
                {timedToday.length > 0 && <h3 className="text-xs font-semibold text-on-surface-variant mb-1">Ohne Uhrzeit</h3>}
                <ul className="divide-y divide-outline-variant/60">
                  {untimedToday.map((item) => (
                    <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} />
                  ))}
                </ul>
              </div>
            )}

            {todayItems.length === 0 && !eventsLoading && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/60" aria-hidden="true">event_available</span>
                <p className="text-sm font-semibold mt-1">Heute ist nichts geplant</p>
                <p className="text-sm text-on-surface-variant mt-0.5">Zeit für Fokus oder die nächste Idee.</p>
                <Button size="sm" className="mt-3" onClick={() => openModal('reminder')}>
                  Erinnerung erstellen
                </Button>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Rechte Spalte (Desktop): Woche, Projekt, Gedanken */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:col-span-5">
          <SectionCard
            title="Nächste 7 Tage"
            icon="date_range"
            areaId="calendar"
            className="order-2 lg:order-none"
            action={(
              <button
                type="button"
                onClick={() => setCurrentScreen('calendar')}
                className="text-xs font-semibold text-on-surface-variant hover:text-primary hover:underline cursor-pointer"
              >
                Kalender
              </button>
            )}
          >
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Wochenübersicht">
              {agenda.days.map((day) => {
                const kinds = [...new Set(day.items.map((i) => i.kind))];
                const open = day.items.filter((i) => !i.completed).length;
                const isSelected = selectedDayKey === day.key;
                return (
                  <button
                    key={day.key}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${WEEKDAY_SHORT[day.date.getDay()]} ${day.date.getDate()}., ${open} offene Einträge`}
                    onClick={() => setSelectedDayKey(isSelected ? null : day.key)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isSelected
                        ? 'bg-surface-low border-primary/40'
                        : day.isToday
                        ? 'border-outline-variant bg-white'
                        : 'border-transparent hover:bg-surface-low'
                    }`}
                  >
                    <span className="text-xs text-on-surface-variant">{day.isToday ? 'Heute' : WEEKDAY_SHORT[day.date.getDay()]}</span>
                    <span className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold ${day.isToday ? 'bg-primary text-white' : 'text-primary'}`}>
                      {day.date.getDate()}
                    </span>
                    <span className="flex gap-0.5 h-1.5" aria-hidden="true">
                      {kinds.slice(0, 3).map((k) => (
                        <span key={k} className={`w-1.5 h-1.5 rounded-full ${areaOf(KIND_META[k].area).dot}`} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="mt-3 pt-3 border-t border-outline-variant">
                <h3 className="text-xs font-semibold text-on-surface-variant mb-1">
                  {selectedDay.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {selectedDay.items.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-2">Nichts geplant.</p>
                ) : (
                  <ul className="divide-y divide-outline-variant/60">
                    {selectedDay.items.slice(0, 4).map((item) => (
                      <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} />
                    ))}
                  </ul>
                )}
                {selectedDay.items.length > 4 && (
                  <button type="button" onClick={() => setCurrentScreen('calendar')} className="mt-1 text-xs font-semibold text-on-surface-variant hover:text-primary hover:underline cursor-pointer">
                    Alle {selectedDay.items.length} im Kalender anzeigen
                  </button>
                )}
              </div>
            )}

            {showCalendarHint && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 text-xs text-on-surface-variant">
                <span className="flex-1">Mit Google Kalender siehst du hier auch deine Termine.</span>
                <button type="button" onClick={() => setCurrentScreen('calendar')} className="font-semibold text-primary hover:underline cursor-pointer">Verbinden</button>
                <button type="button" onClick={dismissHint} aria-label="Hinweis ausblenden" className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white cursor-pointer">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}
          </SectionCard>

          {activeProject && (
            <Card
              interactive
              padding="normal"
              className="order-4 lg:order-none"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedProjectId(activeProject.id);
                setCurrentScreen('project-detail');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedProjectId(activeProject.id);
                  setCurrentScreen('project-detail');
                }
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${areaOf('projects').chip}`} aria-hidden="true">
                  <span className="material-symbols-outlined text-[18px]">folder</span>
                </span>
                <h2 className="text-base font-bold">Aktives Projekt</h2>
              </div>
              <p className="text-base font-semibold truncate">{activeProject.title}</p>
              <p className="text-sm text-on-surface-variant mt-0.5 mb-3 truncate">
                {activeProjectStats.nextTask ? `Als Nächstes: ${activeProjectStats.nextTask.task.title}` : 'Projektübersicht öffnen'}
              </p>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-on-surface-variant">Fortschritt</span>
                <span>{activeProjectStats.progress}%</span>
              </div>
              <div className="w-full bg-surface-low h-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={activeProjectStats.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="bg-primary h-full rounded-full transition-all duration-panel" style={{ width: `${activeProjectStats.progress}%` }} />
              </div>
            </Card>
          )}

          {recentThoughts.length > 0 && (
            <SectionCard
              title="Letzte Gedanken"
              icon="lightbulb"
              areaId="inbox"
              className="order-5 lg:order-none"
              action={(
                <button type="button" onClick={() => setCurrentScreen('inbox')} className="text-xs font-semibold text-on-surface-variant hover:text-primary hover:underline cursor-pointer">
                  Alle ansehen
                </button>
              )}
            >
              <ul className="divide-y divide-outline-variant/60">
                {recentThoughts.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setCurrentScreen('inbox')} className="w-full text-left py-2 text-sm font-medium truncate hover:underline cursor-pointer">
                      {t.title || t.summary}
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
