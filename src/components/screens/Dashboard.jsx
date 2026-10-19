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
import { summarizeElsewhere, getEnvironment } from '../../lib/environments';
import { ageLabel, getQuickTasks, getStaleTasks, getUndatedTasks } from '../../lib/taskOverview';
import { buildDeadlineList, isFach, isOpenFach } from '../../lib/hochschule';
import { DeadlinesSection, FaecherSection } from '../hochschule/HochschuleSections';
import {
  Alert, Badge, Button, Card, CheckButton, EmptyState, FioMark, FOCUS, Icon, IconTile, PageHeader, ProgressBar, Skeleton, cx,
} from '../ds';
import { AI_MODELS } from '../ui/ModelSelectorDropdown';
import { SUMMARY_LENGTH_OPTIONS } from '../ui/SummaryLengthDropdown';
import StaleReviewSheet from '../overview/StaleReviewSheet';
import TaskCapture from '../overview/TaskCapture';
import TaskRow from '../overview/TaskRow';
import SectionCard from '../overview/SectionCard';
import { useEnvironment } from '../../context/EnvironmentContext';

// Dashboard = Tagesübersicht der aktiven Umgebung: Was steht heute an, was ist überfällig, was liegt zu lange.
// Alle Listen kommen schon gefiltert aus dem DataContext (nur Dinge der aktiven Umgebung). Darüber steht eine
// schmale Zeile „Anderswo heute“ mit dem, was in den anderen Umgebungen fällig ist.
// Aufbau (Desktop): links Überfällig, Heute, Schnell erledigt, Ohne Frist; rechts Fio fragt nach, die nächsten
// 7 Tage, Projekt, letzte Gedanken. Am Handy ein Stapel in fester Wichtigkeitsreihenfolge
// (Eingabe, Überfällig, Fio, Heute, Schnell, Ohne Frist, Woche, Rest).

const KIND_META = {
  event: { icon: 'event', area: 'calendar', label: 'Termin' },
  reminder: { icon: 'checklist', area: 'reminders', label: 'Merkliste' },
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

const UNDATED_LIMIT = 5;

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Guten Morgen';
  if (hour >= 12 && hour < 18) return 'Guten Tag';
  if (hour >= 18 && hour < 23) return 'Guten Abend';
  return 'Gute Nacht';
}

/**
 * „Als Gedanke“: derselbe Text landet statt als Aufgabe im Gedanken-Speicher
 * (nutzt die KI-Einstellungen der Gedanken-Ansicht). Wirft bei Fehlern, die Eingabe zeigt dann den Hinweis.
 */
function useThoughtAction(onOpenThoughts) {
  const { addInboxItem } = useModalContext();
  const { showToast } = useToast();
  const [aiFlag] = usePersistedChoice('focusflow_thought_ai', ['on', 'off'], 'on');
  const [length] = usePersistedChoice('focusflow_thought_length', SUMMARY_LENGTH_OPTIONS.map((o) => o.id), 'normal');
  const [model] = usePersistedChoice('focusflow_thought_model', AI_MODELS.map((m) => m.id), 'eco');

  return {
    label: 'Als Gedanke',
    icon: 'lightbulb',
    run: async (value) => {
      const thought = await buildThought(value, { summarize: aiFlag === 'on', model, length });
      await addInboxItem(thought);
      showToast({ message: 'Gedanke gespeichert', icon: 'lightbulb', actionLabel: 'Ansehen', onAction: onOpenThoughts });
    },
  };
}

/** Eine Zeile in Heute / Überfällig / Tagesdetail */
function AgendaRow({ item, onToggle, onOpen, now, highlight }) {
  const meta = KIND_META[item.kind];
  const canToggle = item.kind !== 'event';
  const past = item.startAt && item.startAt < now && !item.completed && item.kind === 'event';

  return (
    <li className={cx('flex items-center gap-3 py-2', highlight && '-mx-3 rounded-md bg-subtle px-3')}>
      <span className={cx('w-14 shrink-0 text-right text-caption-strong tabular-nums', item.dueLabel || item.late ? 'text-danger' : 'text-secondary')}>
        {item.allDay ? 'Ganztägig' : item.timeLabel || item.dueLabel || ''}
      </span>
      {canToggle ? (
        <CheckButton checked={item.completed} tone="success" label={`${item.title} abhaken`} onClick={() => onToggle(item)} />
      ) : (
        <IconTile area={tileAreaOf(meta.area)} icon={meta.icon} size="sm" className="!h-6 !w-6" />
      )}
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cx('relative min-w-0 flex-1 rounded-md text-left', "after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']", FOCUS)}
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
    reminderCategories,
    allReminders,
    allProjects,
    openModal
  } = useModalContext();
  const { activeEnvironmentId, activeEnvironment, enabledIds, setActiveEnvironment } = useEnvironment();

  // Jede Minute neu rechnen: „in 25 Min“, Tageswechsel
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed);
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const quickTasks = useMemo(() => getQuickTasks(reminders, now), [reminders, now]);
  const undatedTasks = useMemo(() => getUndatedTasks(reminders, now), [reminders, now]);
  const staleTasks = useMemo(() => getStaleTasks(reminders, now), [reminders, now]);

  // Hochschule: Fächer und Abgaben/Prüfungen
  const isHochschule = activeEnvironmentId === 'hochschule';
  const faecher = useMemo(() => (isHochschule ? projects.filter(isOpenFach) : []), [isHochschule, projects]);
  const deadlines = useMemo(
    () => (isHochschule ? buildDeadlineList({ projects, reminders, now }) : []),
    [isHochschule, projects, reminders, now]
  );

  // „Anderswo heute“: was in den anderen Umgebungen fällig ist (aus den ungefilterten Listen)
  const elsewhere = useMemo(
    () => summarizeElsewhere(activeEnvironmentId, enabledIds, { reminders: allReminders, projects: allProjects, now }),
    [activeEnvironmentId, enabledIds, allReminders, allProjects, now]
  );

  const todayItems = agenda.days[0].items;
  const allDayToday = todayItems.filter((i) => i.allDay);
  const timedToday = todayItems.filter((i) => !i.allDay && i.startAt);
  const untimedToday = todayItems.filter((i) => !i.allDay && !i.startAt);
  const openToday = todayItems.filter((i) => !i.completed).length;
  const next = getNextTimed(timedToday, now);

  const selectedDay = selectedDayKey ? agenda.days.find((d) => d.key === selectedDayKey) : null;

  // Fächer haben ihren eigenen Abschnitt und zählen hier nicht als „aktives Projekt“
  const activeProject = useMemo(() => {
    const candidates = projects.filter((p) => !isFach(p));
    return (
      candidates.find((p) => !p.deletedAt && !p.isPaused && (p.status === 'IN ARBEIT' || p.status === 'AKTIV')) ||
      candidates.find((p) => !p.deletedAt && !p.isPaused && p.status !== 'ABGESCHLOSSEN') ||
      null
    );
  }, [projects]);
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

  const thoughtAction = useThoughtAction(() => setCurrentScreen('inbox'));

  const toggleReminderDone = (rem) => setReminderStatus(rem.id, rem.status === 'ABGESCHLOSSEN' ? 'AKTIV' : 'ABGESCHLOSSEN');
  const openReminder = (rem) => {
    setSelectedReminderId(rem.id);
    setCurrentScreen('reminder-detail');
  };
  // Untertitel: Kategorie (nur wenn es mehrere gibt), bei Aufgaben ohne Frist dazu das Alter
  const categoryNameOf = (rem) => (reminderCategories.length > 1
    ? reminderCategories.find((c) => c.id === (rem.categoryId || 'allgemein'))?.name || null
    : null);
  const taskSubtitle = (rem, withAge) => [categoryNameOf(rem), withAge ? ageLabel(rem, now) : null].filter(Boolean).join(' · ');

  // „Anderswo heute“ tippen = dorthin wechseln (Home der anderen Umgebung)
  const switchTo = (id) => setActiveEnvironment(id);

  const openFach = (project) => {
    setSelectedProjectId(project.id);
    setCurrentScreen('project-detail');
  };
  const openDeadline = (item) => {
    if (item.source === 'exam') {
      setSelectedProjectId(item.id);
      setCurrentScreen('project-detail');
    } else {
      setSelectedReminderId(item.id);
      setCurrentScreen('reminder-detail');
    }
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <PageHeader
        title={`${greetingFor(now.getHours())}${userName ? `, ${userName}` : ''}`}
        description={activeEnvironmentId === 'allgemein' ? formattedDate : `${formattedDate} · ${activeEnvironment.label}`}
        actions={(
          <Button variant="secondary" size="sm" onClick={() => setCurrentScreen('coach')} aria-label="Fio KI-Coach öffnen" className="shrink-0">
            <FioMark size={16} />
            <span className="hidden sm:inline">Fio fragen</span>
          </Button>
        )}
        className="md:items-center"
      />

      {/* Anderswo heute: eine schmale Zeile, kein Ersatz für „Alle“ */}
      {elsewhere.length > 0 && (
        <nav aria-label="Anderswo heute" className="-mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-caption text-secondary">
          <span className="mr-1">Anderswo heute:</span>
          {elsewhere.map((env) => (
            <button
              key={env.id}
              type="button"
              onClick={() => switchTo(env.id)}
              className={cx('relative inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-hover', "after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-['']", FOCUS)}
            >
              <Icon name={getEnvironment(env.id).icon} size="sm" aria-hidden="true" />
              <span className="text-primary">{getEnvironment(env.id).label}</span>
              <span className={env.overdue > 0 ? 'text-danger' : undefined}>
                {env.overdue > 0 ? `${env.overdue} überfällig` : `${env.due} heute`}
              </span>
            </button>
          ))}
        </nav>
      )}

      <TaskCapture
        ariaLabel="Aufgabe festhalten"
        placeholder="z. B. Mathe Blatt 5 bis Freitag"
        secondary={thoughtAction}
      />

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
                action={<Button size="sm" onClick={() => openModal('reminder')}>Eintrag hinzufügen</Button>}
              />
            )}
          </SectionCard>

          {quickTasks.length > 0 && (
            <SectionCard
              title="Schnell erledigt"
              icon="bolt"
              areaId="reminders"
              count={quickTasks.length}
              className="order-6 lg:order-none"
            >
              <p className="pb-1 text-caption text-secondary">Unter fünf Minuten, gut für zwischendurch</p>
              <ul className="divide-y divide-subtle">
                {quickTasks.map((rem) => (
                  <TaskRow key={rem.id} reminder={rem} subtitle={taskSubtitle(rem)} onToggle={toggleReminderDone} onOpen={openReminder} />
                ))}
              </ul>
            </SectionCard>
          )}

          {undatedTasks.length > 0 && (
            <SectionCard
              title="Ohne Frist"
              icon="event_busy"
              areaId="reminders"
              count={undatedTasks.length}
              className="order-7 lg:order-none"
            >
              <ul className="divide-y divide-subtle">
                {undatedTasks.slice(0, UNDATED_LIMIT).map((rem) => (
                  <TaskRow key={rem.id} reminder={rem} subtitle={taskSubtitle(rem, true)} onToggle={toggleReminderDone} onOpen={openReminder} />
                ))}
              </ul>
              {undatedTasks.length > UNDATED_LIMIT && (
                <p className="pt-2 text-caption text-secondary">
                  {undatedTasks.length - UNDATED_LIMIT} weitere findest du in der Merkliste.
                </p>
              )}
            </SectionCard>
          )}
        </div>

        {/* Rechte Spalte (Desktop): Fio fragt nach, (Hochschule: Fächer, Abgaben), Woche, Projekt, Gedanken */}
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          {staleTasks.length > 0 && (
            <Card variant="filled" padding="md" className="order-2 lg:order-none">
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-2">
                  <IconTile area="coach" size="sm" />
                  <span className="text-caption-strong text-secondary">Fio fragt nach</span>
                </div>
                <div>
                  <p className="text-body-strong text-primary">
                    {staleTasks.length === 1
                      ? '1 Aufgabe liegt seit über einer Woche'
                      : `${staleTasks.length} Aufgaben liegen seit über einer Woche`}
                  </p>
                  <p className="mt-1 text-caption text-secondary">Noch wichtig? In einer halben Minute sortiert.</p>
                </div>
                <Button variant="secondary" size="sm" trailingIcon="arrow_forward" onClick={() => setReviewOpen(true)}>
                  Durchgehen
                </Button>
              </div>
            </Card>
          )}

          {isHochschule && (
            <>
              <FaecherSection
                faecher={faecher}
                now={now}
                onOpen={openFach}
                onCreate={() => openModal('fach')}
                className="order-4 lg:order-none"
              />
              <DeadlinesSection items={deadlines} onOpen={openDeadline} className="order-5 lg:order-none" />
            </>
          )}

          <SectionCard
            title="Nächste 7 Tage"
            icon="date_range"
            areaId="calendar"
            className="order-8 lg:order-none"
            action={<Button variant="ghost" size="sm" onClick={() => setCurrentScreen('calendar')}>Kalender</Button>}
          >
            <div className="grid grid-cols-7 gap-0 sm:gap-1" role="group" aria-label="Wochenübersicht">
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

            {/* Legende: die Punkte unter den Tagen sind nur Farbe, hier stehen die Wörter dazu */}
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-micro text-tertiary" aria-hidden="true">
              {Object.entries(KIND_META).map(([kind, meta]) => (
                <li key={kind} className="flex items-center gap-1.5">
                  <span className={cx('h-1.5 w-1.5 rounded-full', areaOf(meta.area).dot)} />
                  {meta.label}
                </li>
              ))}
            </ul>

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
              className="order-9 lg:order-none"
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
              className="order-10 lg:order-none"
              action={<Button variant="ghost" size="sm" onClick={() => setCurrentScreen('inbox')}>Alle ansehen</Button>}
            >
              <ul className="divide-y divide-subtle">
                {recentThoughts.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('inbox')}
                      className={cx('relative w-full truncate rounded-md py-2 text-left text-label hover:text-accent', "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']", FOCUS)}
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

      <StaleReviewSheet open={reviewOpen} onClose={() => setReviewOpen(false)} reminders={reminders} />
    </div>
  );
};

export default Dashboard;
