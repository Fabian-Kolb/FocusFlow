import React from 'react';
import { weeklyReport } from '../../data/mockData';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

const Review = () => {
  const { projects = [], inboxItems = { today: [], yesterday: [] } } = useModalContext();

  const {
    weekLabel = 'BERICHT KW 19',
    subtitle = 'Zusammenfassung deiner produktiven Einheiten',
    dailyStats = [],
    topAchievements = []
  } = weeklyReport || {};

  // Safe normalization of projects context state
  const safeProjects = Array.isArray(projects) ? projects : [];

  // 1. Calculate Total Completed Tasks (Projects + Inbox)
  const projectCompletedTasks = safeProjects.reduce(
    (acc, p) => acc + (p?.tasksCompleted ?? 0),
    0
  );
  const inboxCompletedTasks = [
    ...(inboxItems?.today || []),
    ...(inboxItems?.yesterday || [])
  ].filter(item => item?.completed).length;
  const totalCompletedTasks = projectCompletedTasks + inboxCompletedTasks;

  // 2. Calculate Total Completed Phases / Milestones across all projects
  const totalMilestones = safeProjects.reduce(
    (acc, p) => acc + (p?.phasesCompleted ?? (p?.phases ? p.phases.filter(ph => ph?.completed).length : 0)),
    0
  );

  // 3. Calculate Overall Project Progress % across active projects ('AKTIV' or 'LAUFEND')
  const activeProjects = safeProjects.filter(
    p => p && (p.status === 'AKTIV' || p.status === 'LAUFEND')
  );
  const targetProjects = activeProjects.length > 0 ? activeProjects : safeProjects;
  const rawSuccessRate = targetProjects.length > 0
    ? Math.round(targetProjects.reduce((acc, p) => acc + (p?.progress ?? 0), 0) / targetProjects.length)
    : 0;
  const successRatePct = Math.min(100, Math.max(0, rawSuccessRate));

  // 4. SVG Progress Gauge calculation
  const circumference = 264;
  const strokeDashoffset = Math.round(circumference * (1 - successRatePct / 100));

  // 5. Open Inbox Items calculation
  const openInboxItems = [
    ...(inboxItems?.today || []),
    ...(inboxItems?.yesterday || [])
  ].filter(item => item && !item.completed);
  const openInboxCount = openInboxItems.length;

  // 6. Flagged / Delayed Projects calculation
  const flaggedProjects = safeProjects.filter(p => {
    if (!p) return false;
    const hasWarning = Boolean(p.warning);
    const isPaused = Boolean(p.isPaused);
    const isBehindSchedule = (p.timeElapsed || 0) > (p.progress || 0);
    return hasWarning || isPaused || isBehindSchedule;
  });

  return (
    <div className="screen-transition p-4 sm:p-6">
      <div className="mb-8 text-left flex items-center gap-3">
        <span className="material-symbols-outlined text-3xl text-primary">analytics</span>
        <div>
          <span className="text-xs text-on-surface-variant mb-1 block font-mono uppercase">
            {weekLabel}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Wochenrückblick</h1>
          <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <Card padding="normal">
            <h3 className="text-xs font-mono text-on-surface-variant mb-6 border-b border-outline-variant pb-2 uppercase tracking-wider">
              ABGESCHLOSSENE AUFGABEN PRO TAG
            </h3>

            <div className="h-52 flex items-end justify-between gap-2 sm:gap-3 mb-4 pt-4 px-2 border-b border-outline-variant pb-4">
              {dailyStats.map((stat, idx) => (
                <div key={idx} className="flex flex-col items-center flex-grow gap-2 h-full justify-end">
                  <div
                    className={`w-full transition-all duration-500 rounded-t-sm ${
                      stat.isWeekend ? 'bg-outline-variant' : 'bg-primary'
                    }`}
                    style={{ height: `${stat.heightPct}%` }}
                  ></div>
                  <span className="text-[10px] sm:text-xs font-mono text-on-surface-variant">
                    {stat.day}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <Card padding="small" className="bg-surface-low border-transparent">
                <span className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant block tracking-wider uppercase">
                  GESAMT ERLEDIGT
                </span>
                <span className="text-xl sm:text-2xl font-bold text-primary">{totalCompletedTasks} Aufgaben</span>
              </Card>
              <Card padding="small" className="bg-surface-low border-transparent">
                <span className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant block tracking-wider uppercase">
                  MEILENSTEINE
                </span>
                <span className="text-xl sm:text-2xl font-bold text-primary">{totalMilestones} Phasen</span>
              </Card>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card padding="normal" className="flex flex-col justify-between">
            <h3 className="text-xs font-mono text-on-surface-variant mb-4 border-b border-outline-variant pb-2 uppercase tracking-wider">
              OUTPUT & ERFOLGS-RATE
            </h3>
            <div className="flex items-center justify-center py-6 relative">
              <svg className="w-36 h-36 sm:w-40 sm:h-40" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E5E5" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#1A1A1A"
                  strokeWidth="10"
                  strokeDasharray="264"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold text-primary">{successRatePct}%</span>
                <span className="text-[10px] font-mono text-on-surface-variant mt-1 tracking-wider uppercase">Ziel-Erfüllung</span>
              </div>
            </div>
          </Card>

          <Card padding="normal" className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-primary uppercase border-b border-outline-variant pb-2 tracking-wider">
              TOP-ERFOLGE DIESER WOCHE
            </h4>
            <div className="space-y-3 text-xs pt-1">
              {topAchievements.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <span className="w-4 h-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                    ✓
                  </span>
                  <span className="font-medium text-primary truncate">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 2: SYSTEM HEALTH ÜBERSICHT */}
      <div className="mt-8 space-y-6 border-t border-outline-variant/60 pt-8">
        <div className="flex items-center gap-2 pb-2">
          <span className="material-symbols-outlined text-amber-600 text-2xl">health_and_safety</span>
          <h2 className="text-lg font-bold text-primary tracking-wide">
            System Health & Handlungsbedarf
          </h2>
          <Badge variant="default" className="ml-2 font-mono">
            {openInboxCount + flaggedProjects.length} HINWEISE
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Open Inbox Items Card */}
          <div className="lg:col-span-6">
            <Card padding="normal" className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">inbox</span>
                    <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                      OFFENE INBOX ITEMS
                    </h3>
                  </div>
                  <Badge variant="outline" className={openInboxCount > 0 ? "text-amber-700 bg-amber-50 border-amber-300" : "text-emerald-700 bg-emerald-50 border-emerald-300"}>
                    {openInboxCount} OFFEN
                  </Badge>
                </div>

                {openInboxItems.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant text-xs">
                    <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2 block">check_circle</span>
                    <p className="font-medium text-emerald-700">Inbox ist vollständig aufgeräumt!</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {openInboxItems.map(item => (
                      <li key={item.id} className="flex items-start justify-between gap-3 p-3 bg-surface-low rounded-lg border border-outline-variant text-xs">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="material-symbols-outlined text-base text-amber-600 shrink-0 mt-0.5">check_box_outline_blank</span>
                          <span className="font-medium text-primary leading-tight line-clamp-2">
                            {item.title || item.summary}
                          </span>
                        </div>
                        <Badge variant="default" className="shrink-0 text-[10px]">
                          OFFEN
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Flagged / Delayed Projects Card */}
          <div className="lg:col-span-6">
            <Card padding="normal" className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-xl">warning</span>
                    <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                      PROJEKTE MIT RÜCKSTAND / WARNUNGEN
                    </h3>
                  </div>
                  <Badge variant="outline" className={flaggedProjects.length > 0 ? "text-red-700 bg-red-50 border-red-300" : "text-emerald-700 bg-emerald-50 border-emerald-300"}>
                    {flaggedProjects.length} BETROFFEN
                  </Badge>
                </div>

                {flaggedProjects.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant text-xs">
                    <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2 block">verified</span>
                    <p className="font-medium text-emerald-700">Alle aktiven Projekte sind im Zeitplan!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flaggedProjects.map(project => {
                      const delay = (project.timeElapsed || 0) - (project.progress || 0);
                      return (
                        <div key={project.id} className="p-3 bg-surface-low rounded-lg border border-outline-variant text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-primary truncate">{project.title}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {project.isPaused && (
                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                                  PAUSIERT
                                </Badge>
                              )}
                              {project.warning && (
                                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                                  {project.warning}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                            <span>Fortschritt: {project.progress || 0}%</span>
                            <span>Zeit: {project.timeElapsed || 0}%</span>
                            {delay > 0 && !project.warning && (
                              <span className="text-amber-700 font-bold">Rückstand: +{delay}%</span>
                            )}
                          </div>

                          {/* Progress vs Time Bar */}
                          <div className="w-full bg-outline-variant/30 h-1.5 rounded-full overflow-hidden flex">
                            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${Math.min(100, project.progress || 0)}%` }} />
                            {delay > 0 && (
                              <div className="bg-amber-500/60 h-full transition-all duration-300" style={{ width: `${Math.min(100 - (project.progress || 0), delay)}%` }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* SECTION 3: AUSBLICK & FOKUS (NÄCHSTE SCHRITTE) */}
      <div className="mt-8 space-y-6 border-t border-outline-variant/60 pt-8">
        <div className="flex items-center gap-2 pb-2">
          <span className="material-symbols-outlined text-primary text-2xl">arrow_forward</span>
          <h2 className="text-lg font-bold text-primary tracking-wide">
            Ausblick & Fokus (Nächste Schritte)
          </h2>
          <Badge variant="default" className="ml-2 font-mono">
            {activeProjects.length} PROJEKTE
          </Badge>
        </div>

        <Card padding="normal">
          <h3 className="text-xs font-mono font-bold text-primary uppercase border-b border-outline-variant pb-3 tracking-wider mb-4">
            NÄCHSTE SCHRITTE DER AKTIVEN PROJEKTE
          </h3>

          {activeProjects.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant text-xs">
              <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2 block">task_alt</span>
              <p className="font-bold text-primary text-sm mb-1">Keine aktiven Nächsten Schritte</p>
              <p className="text-on-surface-variant">Alle aktiven Projekte sind abgeschlossen oder in der Planungsphase.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeProjects.map(project => {
                const nextStepText = project?.nextStep && typeof project.nextStep === 'string' && project.nextStep.trim() !== ''
                  ? project.nextStep
                  : 'Kein nächster Schritt hinterlegt';

                return (
                  <div key={project?.id || project?.title} className="p-3.5 bg-surface-low rounded-lg border border-outline-variant space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-primary text-xs sm:text-sm truncate">{project?.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {project?.isPaused && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                            PAUSIERT
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {project?.status}
                        </Badge>
                        <span className="text-[11px] font-mono text-on-surface-variant">
                          {project?.progress || 0}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-xs text-primary bg-white/60 p-2.5 rounded border border-outline-variant/40">
                      <span className="material-symbols-outlined text-primary text-base shrink-0">play_arrow</span>
                      <span className="font-semibold text-primary leading-tight">
                        {nextStepText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Review;

