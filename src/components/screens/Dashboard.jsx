import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModalContext } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { buildThought } from '../../lib/thoughts';
import { getProjectStats } from '../../lib/projectProgress';
import { buildAgenda, getNextTimed, formatMinutes } from '../../lib/dashboardAgenda';
import { areaOf, tileAreaOf } from '../../lib/areas';
import {
  Alert, Badge, Button, Card, EmptyState, FioMark, FOCUS, Icon, IconButton, IconTile, PageHeader, ProgressBar, Skeleton, cx,
} from '../ds';
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
      className="flex items-center gap-2 rounded-lg border border-subtle bg-surface py-2 pl-4 pr-2 shadow-sm transition-shadow duration-fast focus-within:border-accent focus-within:ring-2 focus-within:ring-focus"
      aria-label="Gedanken festhalten"
    >
      <Icon name="lightbulb" size="lg" className={cx('shrink-0', areaOf('inbox').activeText)} aria-hidden="true" />
      <label htmlFor="dashboard-thought" className="sr-only">Was geht dir durch den Kopf?</label>
      <input
        id="dashboard-thought"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        placeholder="Was geht dir durch den Kopf?"
        enterKeyHint="send"
        className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-body-lg placeholder:text-tertiary focus:outline-none focus:ring-0 disabled:opacity-60"
      />
      <IconButton type="submit" variant="primary" icon="arrow_upward" label="Gedanke speichern" loading={busy} className="shrink-0" />
    </form>
  );
}

/** Eine Zeile in Heute / Überfällig / Tagesdetail */
function AgendaRow({ item, onToggle, onOpen, now, highlight }) {
  const meta = KIND_META[item.kind];
  const canToggle = item.kind !== 'event';
  const past = item.startAt && item.startAt < now && !item.completed && item.kind === 'event';

  return (
    <li className={cx('flex items-center gap-3 py-2', highlight && '-mx-3 rounded-md bg-subtle px-3')}>
      <span className={cx('w-14 shrink-0 text-right text-caption-strong tabular-nums', item.dueLabel ? 'text-danger' : 'text-secondary')}>
        {item.allDay ? 'Ganztägig' : item.timeLabel || item.dueLabel || ''}
      </span>
      {canToggle ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.completed}
          aria-label={`${item.title} abhaken`}
          onClick={() => onToggle(item)}
          className={cx(
            'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-fast',
            "after:absolute after:-inset-2 after:content-['']",
            FOCUS,
            item.completed ? 'border-success bg-success text-on-accent' : 'border-control bg-surface text-transparent hover:border-strong',
          )}
        >
          <Icon name="check" size="sm" aria-hidden="true" />
        </button>
      ) : (
        <IconTile area={tileAreaOf(meta.area)} icon={meta.icon} size="sm" className="!h-6 !w-6" />
      )}
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cx('min-w-0 flex-1 rounded-md text-left', FOCUS)}
      >
        <span className={cx('block truncate text-body-strong', item.completed ? 'text-secondary line-through' : past ? 'text-secondary' : 'text-primary')}>
          {item.title}
        </span>
        {item.subtitle && <span className="block truncate text-caption text-secondary">{item.subtitle}</span>}
      </button>
      {highlight && <Badge tone="neutral" className="shrink-0">{highlight}</Badge>}
    </li>
  );
}

function SectionCard({ title, icon, areaId, count, children, className = '', tone = 'default', action }) {
  return (
    <Card padding="none" className={cx(tone === 'danger' && 'border-danger', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-subheading text-primary">
          <IconTile area={tone === 'danger' ? 'neutral' : tileAreaOf(areaId)} icon={icon} size="sm" className={tone === 'danger' ? '!bg-danger-subtle !text-danger' : ''} />
          {title}
          {count != null && <span className="text-label text-secondary">{count}</span>}
        </h2>
        {action}
      </div>
      <div className="px-4 pb-4 pt-1 sm:px-5">{children}</div>
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
  const openProject = () => {
    setSelectedProjectId(activeProject.id);
    setCurrentScreen('project-detail');
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <PageHeader
        title={`${greetingFor(now.getHours())}${userName ? `, ${userName}` : ''}`}
        description={formattedDate}
        actions={(
          <Button variant="secondary" size="sm" onClick={() => setCurrentScreen('coach')} aria-label="Fio KI-Coach öffnen" className="shrink-0">
            <FioMark size={16} />
            <span className="hidden sm:inline">Fio fragen</span>
          </Button>
        )}
        className="md:items-center"
      />

      <QuickThought onOpenThoughts={() => setCurrentScreen('inbox')} />

      <div className="flex flex-col gap-5 md:gap-6 lg:grid lg:grid-cols-12 lg:items-start">
        {/* Linke Spalte (Desktop): Überfällig + Heute */}
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
          {agenda.overdue.length > 0 && (
            <SectionCard
              title="Überfällig"
              icon="error"
              areaId="reminders"
              tone="danger"
              count={agenda.overdue.length}
              className="order-1 lg:order-none"
            >
              <ul className="divide-y divide-subtle">
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
                  <Badge key={item.key} tone="neutral" className="max-w-full">
                    <Icon name="event" size="sm" aria-hidden="true" />
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
              <ul className="divide-y divide-subtle">
                {timedToday.map((item) => {
                  const isNext = next && next.item.key === item.key;
                  const label = isNext ? (next.state === 'running' ? 'läuft' : next.minutes <= 180 ? formatMinutes(next.minutes) : null) : null;
                  return <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} highlight={label} />;
                })}
              </ul>
            )}

            {untimedToday.length > 0 && (
              <div className={timedToday.length > 0 ? 'mt-3 border-t border-subtle pt-3' : ''}>
                {timedToday.length > 0 && <h3 className="mb-1 text-caption-strong text-secondary">Ohne Uhrzeit</h3>}
                <ul className="divide-y divide-subtle">
                  {untimedToday.map((item) => (
                    <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} />
                  ))}
                </ul>
              </div>
            )}

            {todayItems.length === 0 && !eventsLoading && (
              <EmptyState
                compact
                bordered={false}
                icon="event_available"
                title="Heute ist nichts geplant"
                description="Zeit für Fokus oder die nächste Idee."
                action={<Button size="sm" onClick={() => openModal('reminder')}>Erinnerung hinzufügen</Button>}
              />
            )}
          </SectionCard>
        </div>

        {/* Rechte Spalte (Desktop): Woche, Projekt, Gedanken */}
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          <SectionCard
            title="Nächste 7 Tage"
            icon="date_range"
            areaId="calendar"
            className="order-2 lg:order-none"
            action={<Button variant="ghost" size="sm" onClick={() => setCurrentScreen('calendar')}>Kalender</Button>}
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
                    className={cx(
                      'flex flex-col items-center gap-1 rounded-md border py-2 transition-colors duration-fast',
                      FOCUS,
                      isSelected
                        ? 'border-control bg-subtle'
                        : day.isToday
                        ? 'border-subtle bg-surface'
                        : 'border-transparent hover:bg-hover',
                    )}
                  >
                    <span className="text-caption text-secondary">{day.isToday ? 'Heute' : WEEKDAY_SHORT[day.date.getDay()]}</span>
                    <span className={cx('flex h-8 w-8 items-center justify-center rounded-md text-body-strong', day.isToday ? 'bg-accent text-on-accent' : 'text-primary')}>
                      {day.date.getDate()}
                    </span>
                    <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                      {kinds.slice(0, 3).map((k) => (
                        <span key={k} className={cx('h-1.5 w-1.5 rounded-full', areaOf(KIND_META[k].area).dot)} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="mt-3 border-t border-subtle pt-3">
                <h3 className="mb-1 text-caption-strong text-secondary">
                  {selectedDay.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {selectedDay.items.length === 0 ? (
                  <p className="py-2 text-body text-secondary">Nichts geplant.</p>
                ) : (
                  <ul className="divide-y divide-subtle">
                    {selectedDay.items.slice(0, 4).map((item) => (
                      <AgendaRow key={item.key} item={item} onToggle={handleToggle} onOpen={handleOpen} now={now} />
                    ))}
                  </ul>
                )}
                {selectedDay.items.length > 4 && (
                  <Button variant="ghost" size="sm" className="mt-1" onClick={() => setCurrentScreen('calendar')}>
                    Alle {selectedDay.items.length} im Kalender anzeigen
                  </Button>
                )}
              </div>
            )}

            {showCalendarHint && (
              <Alert
                tone="info"
                icon="calendar_month"
                onDismiss={dismissHint}
                className="mt-3"
                action={<Button variant="secondary" size="sm" onClick={() => setCurrentScreen('calendar')}>Kalender verbinden</Button>}
              >
                Mit Google Kalender siehst du hier auch deine Termine.
              </Alert>
            )}
          </SectionCard>

          {activeProject && (
            <Card
              as="button"
              interactive
              padding="md"
              className="order-4 lg:order-none"
              onClick={openProject}
              aria-label={`Projekt ${activeProject.title} öffnen`}
            >
              <span className="mb-3 flex items-center gap-2">
                <IconTile area="projects" icon="folder" size="sm" />
                <span className="text-subheading text-primary">Aktives Projekt</span>
              </span>
              <span className="block truncate text-subheading text-primary">{activeProject.title}</span>
              <span className="mb-3 mt-0.5 block truncate text-body text-secondary">
                {activeProjectStats.nextTask ? `Als Nächstes: ${activeProjectStats.nextTask.task.title}` : 'Projektübersicht öffnen'}
              </span>
              <ProgressBar value={activeProjectStats.progress} label="Fortschritt" showValue />
            </Card>
          )}

          {recentThoughts.length > 0 && (
            <SectionCard
              title="Letzte Gedanken"
              icon="lightbulb"
              areaId="inbox"
              className="order-5 lg:order-none"
              action={<Button variant="ghost" size="sm" onClick={() => setCurrentScreen('inbox')}>Alle ansehen</Button>}
            >
              <ul className="divide-y divide-subtle">
                {recentThoughts.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('inbox')}
                      className={cx('w-full truncate rounded-md py-2 text-left text-label hover:text-accent', FOCUS)}
                    >
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
