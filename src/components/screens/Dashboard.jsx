import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import FioIcon from '../ui/FioIcon';

const FIO_PROMPTS = [
  'Wie kann ich dir helfen?',
  'Kann ich dir irgendwie helfen?',
  'Brauchst du Fokus-Tipps für heute?',
  'Sollen wir deinen Tag strukturieren?',
  'Bereit für dein Haupt-Ziel heute?'
];

const Dashboard = ({ setCurrentScreen }) => {
  const { user } = useAuth();
  const {
    projects,
    reminders,
    toggleReminderStatus,
    setSelectedReminderId,
    toggleTask,
    setSelectedProjectId,
    openModal
  } = useModalContext();

  // Fio Speech Bubble Animation & Cycling Prompts
  const [promptIndex, setPromptIndex] = useState(0);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Weich ausblenden & zum Icon zusammenziehen (500ms)
      setIsBubbleVisible(false);

      // 2. Text wechseln und danach wieder weich aus dem Icon heraus expandieren
      setTimeout(() => {
        setPromptIndex((prev) => (prev + 1) % FIO_PROMPTS.length);
        setIsBubbleVisible(true);
      }, 500);
    }, 5500);

    return () => clearInterval(interval);
  }, []);

  // Time & Greeting
  const now = new Date();
  const currentHour = now.getHours();
  let greeting = 'Guten Tag';
  if (currentHour >= 5 && currentHour < 12) {
    greeting = 'Guten Morgen';
  } else if (currentHour >= 12 && currentHour < 18) {
    greeting = 'Guten Tag';
  } else if (currentHour >= 18 && currentHour < 23) {
    greeting = 'Guten Abend';
  } else {
    greeting = 'Gute Nacht';
  }

  const userName = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
    ? user.email.split('@')[0]
    : 'Fabian';

  const formattedDate = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const todayIso = now.toISOString().split('T')[0];
  const todayDe = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const todayDeShort = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  // Date Check Helpers
  const isDateToday = (dateStr) => {
    if (!dateStr || dateStr === 'Demnächst') return false;
    if (dateStr === todayIso || dateStr === todayDe || dateStr.startsWith(todayDeShort)) return true;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    return false;
  };

  const isDateOverdue = (dateStr, isCompleted) => {
    if (isCompleted || !dateStr || dateStr === 'Demnächst') return false;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return d.getTime() < startOfToday;
    }
    return false;
  };

  // Aggregated "Today" Items from Reminders and Projects
  const todayItems = useMemo(() => {
    const items = [];

    // 1. Reminders
    reminders.forEach((rem) => {
      const isToday = isDateToday(rem.date);
      const isOver = isDateOverdue(rem.date, rem.status === 'ABGESCHLOSSEN');
      
      if (isToday || isOver || (rem.status !== 'ABGESCHLOSSEN' && rem.priority === 'hoch')) {
        items.push({
          id: rem.id,
          sourceType: 'reminder',
          title: rem.title,
          subtitle: rem.description || 'Erinnerung',
          parentTitle: 'Erinnerung',
          time: rem.time ? `${rem.time} Uhr` : rem.date !== 'Demnächst' ? rem.date : 'Heute',
          priority: rem.priority || 'mittel',
          completed: rem.status === 'ABGESCHLOSSEN',
          isOverdue: isOver,
          rawItem: rem
        });
      }
    });

    // 2. Project Tasks
    projects.forEach((proj) => {
      if (proj.status === 'ABGESCHLOSSEN' || proj.isPaused) return;
      if (proj.phases && proj.phases.length > 0) {
        proj.phases.forEach((phase) => {
          if (phase.tasks && phase.tasks.length > 0) {
            phase.tasks.forEach((task) => {
              const isToday = isDateToday(task.date);
              const isOver = isDateOverdue(task.date, task.completed);
              if (isToday || isOver) {
                items.push({
                  id: task.id,
                  sourceType: 'project-task',
                  projectId: proj.id,
                  phaseId: phase.id,
                  title: task.title,
                  subtitle: task.note || phase.title,
                  parentTitle: proj.title,
                  time: task.date || 'Heute',
                  priority: 'mittel',
                  completed: !!task.completed,
                  isOverdue: isOver,
                  rawItem: task
                });
              }
            });
          }
        });
      }
    });

    // Fallback: If no items match specifically "today", show the first active reminders/tasks
    if (items.length === 0) {
      reminders
        .filter((r) => r.status !== 'ABGESCHLOSSEN')
        .slice(0, 4)
        .forEach((rem) => {
          items.push({
            id: rem.id,
            sourceType: 'reminder',
            title: rem.title,
            subtitle: rem.description || 'Erinnerung',
            parentTitle: 'Erinnerung',
            time: rem.time ? `${rem.time} Uhr` : 'Demnächst',
            priority: rem.priority || 'mittel',
            completed: false,
            isOverdue: false,
            rawItem: rem
          });
        });
    }

    return items;
  }, [reminders, projects]);

  const completedCount = todayItems.filter((i) => i.completed).length;
  const totalCount = todayItems.length;

  // Must-Win Task: Priority 1 item or top incomplete item
  const mustWinItem = useMemo(() => {
    const highPrio = todayItems.find((i) => !i.completed && i.priority === 'hoch');
    if (highPrio) return highPrio;
    const firstIncomplete = todayItems.find((i) => !i.completed);
    if (firstIncomplete) return firstIncomplete;
    if (todayItems.length > 0) return todayItems[0];
    return null;
  }, [todayItems]);

  // Active Project for the Widget
  const activeProject = useMemo(() => {
    return (
      projects.find((p) => !p.isPaused && (p.status === 'IN ARBEIT' || p.status === 'AKTIV')) ||
      projects.find((p) => !p.isPaused && p.status !== 'ABGESCHLOSSEN') ||
      projects[0] ||
      null
    );
  }, [projects]);

  // Focus Score Calculation
  const focusScore = useMemo(() => {
    if (totalCount === 0 && projects.length === 0) return 84; // Fallback score
    const completionRate = totalCount > 0 ? completedCount / totalCount : 0.5;
    const activeProjectsCount = projects.filter((p) => !p.isPaused && p.status !== 'ABGESCHLOSSEN').length;
    const base = 50;
    const score = Math.min(100, Math.max(20, Math.round(base + completionRate * 40 + Math.min(activeProjectsCount * 5, 10))));
    return score;
  }, [totalCount, completedCount, projects]);

  // Handlers
  const handleToggleItem = (item) => {
    if (item.sourceType === 'reminder') {
      toggleReminderStatus(item.id);
    } else if (item.sourceType === 'project-task') {
      toggleTask(item.projectId, item.phaseId, item.id);
    }
  };

  const handleItemClick = (item) => {
    if (item.sourceType === 'reminder') {
      setSelectedReminderId(item.id);
      setCurrentScreen('reminder-detail');
    } else if (item.sourceType === 'project-task') {
      setSelectedProjectId(item.projectId);
      setCurrentScreen('project-detail');
    }
  };

  return (
    <div className="screen-transition">
      {/* Header mit 2-Zeilen-Hierarchie */}
      <header className="mb-6 sm:mb-8 border-b border-outline-variant pb-5 sm:pb-6">
        {/* Zeile 1: Datum & Begrüßung */}
        <div>
          <span className="text-xs text-on-surface-variant mb-1 block mono uppercase">
            {formattedDate} • Fokus-Modus
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
            {greeting}, {userName}
          </h1>
        </div>

        {/* Zeile 2: Fio Assistant Teaser als primäre Fio-Aktion auf Mobile */}
        <div className="mt-3.5 sm:mt-4">
          <button
            onClick={() => setCurrentScreen('coach')}
            type="button"
            aria-label={`Fio KI-Coach öffnen: ${FIO_PROMPTS[promptIndex]}`}
            className="w-full sm:w-auto flex items-center gap-3 p-3 px-4 rounded-2xl bg-white border border-outline-variant hover:border-primary transition-all shadow-sm group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FioIcon className="w-4 h-4 text-white" color="currentColor" />
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold font-mono text-primary uppercase tracking-wider">Fio KI-Coach</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-primary group-hover:text-accent-blue transition-colors truncate">
                {FIO_PROMPTS[promptIndex]}
              </p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0 group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
          </button>
        </div>
      </header>

      {/* Haupt-Ergebnis heute (The Main Outcome / Must-Win) */}
      <Card className="border-2 border-primary mb-6 sm:mb-8 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] sm:text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-[16px] sm:text-[18px] flex-shrink-0 text-amber-500">stars</span>
            <span className="truncate">HAUPT-ERGEBNIS HEUTE (MUST-WIN)</span>
          </span>
          <Badge variant={mustWinItem?.completed ? 'outline' : 'default'}>
            {mustWinItem?.completed ? 'ERLEDIGT 🎉' : 'PRIO 1'}
          </Badge>
        </div>

        {mustWinItem ? (
          <div className="flex items-start gap-2 sm:gap-3 mt-2">
            {/* 44x44px Touch Target Container for Checkbox */}
            <label className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={mustWinItem.completed}
                onChange={() => handleToggleItem(mustWinItem)}
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded focus:ring-primary cursor-pointer"
                aria-label="Must-Win abhaken"
              />
            </label>
            <div className="flex-grow min-w-0 pt-2 pb-1">
              <p className={`text-base sm:text-lg font-bold leading-snug line-clamp-2 sm:line-clamp-none ${mustWinItem.completed ? 'line-through opacity-60' : ''}`}>
                {mustWinItem.title}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                {mustWinItem.subtitle || 'Dieses eine konkrete Ergebnis macht deinen heutigen Tag zum vollen Erfolg.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-3">
            <p className="text-sm font-medium text-on-surface-variant">
              Noch kein Haupt-Ergebnis für heute definiert. Füge eine wichtige Aufgabe hinzu!
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Hauptliste "Heute" */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <h2 className="text-lg sm:text-xl font-bold">Heute</h2>
              <span title="Optimales Tageslimit für maximale Fokus-Qualität">
                <Badge variant="outline">
                  KAPAZITÄT: {totalCount} / MAX 5 ({totalCount <= 5 ? 'OPTIMAL' : 'HOCH'})
                </Badge>
              </span>
            </div>
            <span className="text-xs text-on-surface-variant mono whitespace-nowrap">
              {completedCount}/{totalCount} Erledigt
            </span>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {todayItems.length > 0 ? (
              todayItems.map((item) => (
                <Card
                  key={`${item.sourceType}-${item.id}`}
                  interactive
                  padding="small"
                  className={`flex items-start gap-1 sm:gap-2 transition-all rounded-2xl ${
                    item.completed ? 'opacity-60 bg-surface-low/50' : ''
                  }`}
                >
                  {/* 44x44px Touch Target for Task Checkbox */}
                  <label 
                    onClick={(e) => e.stopPropagation()} 
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1 shrink-0 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleItem(item)}
                      className="w-5 h-5 border-2 border-outline-variant text-primary rounded focus:ring-primary cursor-pointer"
                      aria-label={`Aufgabe ${item.title} abhaken`}
                    />
                  </label>

                  <div
                    className="flex-grow min-w-0 cursor-pointer pt-2 pb-1"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-on-surface-variant mb-1 flex-wrap">
                      <span className="font-bold text-primary">
                        {item.parentTitle}
                      </span>
                      <span>›</span>
                      <span>{item.subtitle}</span>
                    </div>

                    <p
                      className={`text-sm sm:text-base font-semibold leading-snug line-clamp-2 sm:line-clamp-none ${
                        item.completed ? 'line-through text-on-surface-variant' : 'text-primary'
                      }`}
                    >
                      {item.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 pt-2.5 pr-1">
                    {item.isOverdue && !item.completed && (
                      <span className="text-[10px] text-rose-600 font-mono font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Überfällig
                      </span>
                    )}
                    <span className="text-[11px] sm:text-xs text-on-surface-variant mono whitespace-nowrap">
                      {item.time}
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 border border-dashed border-outline-variant rounded-2xl p-6 bg-surface-low/30">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2 block">
                  task_alt
                </span>
                <p className="text-sm font-bold mb-1">Alles erledigt für heute!</p>
                <p className="text-xs text-on-surface-variant mb-4">
                  Keine offenen Aufgaben für heute. Gönn dir eine Pause oder plane deinen nächsten Tag.
                </p>
                <button
                  onClick={() => openModal('reminder')}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  + Neue Erinnerung erstellen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Fokus Score Widget */}
          <Card padding="normal" className="bg-surface-low border border-outline-variant/60">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-3">
              <h3 className="text-xs font-mono text-on-surface-variant uppercase tracking-wider">
                FOKUS SCORE
              </h3>
              <span className="text-[11px] font-mono text-on-surface-variant">
                {completedCount}/{totalCount} Erledigt
              </span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl sm:text-4xl font-bold leading-none">{focusScore || 84}</span>
              <span className="text-xs text-on-surface-variant mb-1 mono">/100</span>
            </div>
            <div className="w-full bg-outline-variant h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${focusScore || 84}%` }}
              ></div>
            </div>
            {/* 84% Benchmark */}
            <p className="text-[11px] text-on-surface-variant mt-3 mono">
              {focusScore >= 80
                ? '🔥 Exzellente Tages-Fokussierung!'
                : focusScore >= 50
                ? '⚡ Solider Fortschritt, bleib dran.'
                : '🎯 Starte mit deinem Must-Win Ziel.'}
            </p>
          </Card>

          {/* Nächstes Projekt Widget */}
          {activeProject ? (
            <Card
              interactive
              padding="normal"
              onClick={() => {
                setSelectedProjectId(activeProject.id);
                setCurrentScreen('project-detail');
              }}
            >
              <h3 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-2 uppercase tracking-wider">
                NÄCHSTES PROJEKT
              </h3>
              <p className="text-base font-bold mb-1 truncate">{activeProject.title}</p>
              <p className="text-xs text-on-surface-variant mb-3 truncate">
                {activeProject.nextStep || 'Projektübersicht öffnen'}
              </p>
              <div className="flex justify-between text-xs mono mb-1.5 font-bold">
                <span>Fortschritt</span>
                <span>{activeProject.progress || 0}%</span>
              </div>
              <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${activeProject.progress || 0}%` }}
                ></div>
              </div>
            </Card>
          ) : (
            <Card
              interactive
              padding="normal"
              onClick={() => openModal('project')}
            >
              <h3 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-2 uppercase tracking-wider">
                NÄCHSTES PROJEKT
              </h3>
              <p className="text-sm font-bold mb-1">Kein aktives Projekt</p>
              <p className="text-xs text-on-surface-variant mb-3">
                Erstelle dein erstes Projekt, um Meilensteine strukturiert umzusetzen.
              </p>
              <span className="text-xs font-bold text-primary flex items-center gap-1">
                + Neues Projekt anlegen
              </span>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
