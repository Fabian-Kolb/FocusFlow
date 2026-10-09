import React from 'react';
import { weeklyReport } from '../../data/mockData';
import { useModalContext } from '../../context/ModalContext';
import { Badge, Card, EmptyState, Icon, IconTile, PageHeader, ProgressBar, SectionHeader, Stat, cx } from '../ds';

const Review = () => {
  const { projects = [], inboxItems = { today: [], yesterday: [] } } = useModalContext();

  const {
    weekLabel = 'Bericht KW 19',
    subtitle = 'Zusammenfassung deiner produktiven Einheiten',
    dailyStats = [],
    topAchievements = []
  } = weeklyReport || {};

  // Safe normalization of projects context state
  const safeProjects = Array.isArray(projects) ? projects : [];

  // 1. Calculate Total Completed Tasks (Projects + Inbox)
  const allInboxItems = typeof inboxItems === 'object' && inboxItems ? Object.values(inboxItems).flat() : [];
  const projectCompletedTasks = safeProjects.reduce(
    (acc, p) => acc + (p?.tasksCompleted ?? 0),
    0
  );
  const inboxCompletedTasks = allInboxItems.filter(item => item?.completed).length;
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
  const openInboxItems = allInboxItems.filter(item => item && !item.completed);
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
    <div className="space-y-8">
      <PageHeader title="Wochenrückblick" description={`${weekLabel} · ${subtitle}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card padding="md" className="space-y-5">
            <SectionHeader title="Abgeschlossene Aufgaben pro Tag" />

            <div className="flex h-52 items-end justify-between gap-2 border-b border-subtle px-2 pb-4 pt-4 sm:gap-3">
              {dailyStats.map((stat, idx) => (
                <div key={idx} className="flex h-full flex-grow flex-col items-center justify-end gap-2">
                  <div
                    className={cx('w-full rounded-t-xs transition-[height] duration-slow ease-standard', stat.isWeekend ? 'bg-muted' : 'bg-accent')}
                    style={{ height: `${stat.heightPct}%` }}
                  />
                  <span className="text-caption text-secondary">{stat.day}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card variant="filled" padding="sm">
                <Stat label="Gesamt erledigt" value={`${totalCompletedTasks}`} delta="Aufgaben" />
              </Card>
              <Card variant="filled" padding="sm">
                <Stat label="Meilensteine" value={`${totalMilestones}`} delta="Phasen" />
              </Card>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card padding="md" className="space-y-2">
            <SectionHeader title="Output und Erfolgsrate" />
            <div className="relative flex items-center justify-center py-4">
              <svg className="h-36 w-36 sm:h-40 sm:w-40" viewBox="0 0 100 100" role="img" aria-label={`Ziel-Erfüllung ${successRatePct} Prozent`}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-muted)" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--bg-accent)"
                  strokeWidth="10"
                  strokeDasharray="264"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  className="transition-[stroke-dashoffset] duration-700 ease-standard"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-title text-primary sm:text-title-lg">{successRatePct} %</span>
                <span className="mt-1 text-caption text-secondary">Ziel-Erfüllung</span>
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-3">
            <SectionHeader title="Top-Erfolge dieser Woche" />
            <ul className="space-y-3">
              {topAchievements.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2.5 text-body text-primary">
                  <Icon name="check_circle" size="md" className="shrink-0 text-success" />
                  <span className="truncate">{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Hinweise und Handlungsbedarf */}
      <section className="space-y-4 border-t border-subtle pt-8">
        <div className="flex items-center gap-2">
          <IconTile area="neutral" icon="health_and_safety" size="sm" />
          <h2 className="text-heading text-primary">Handlungsbedarf</h2>
          <Badge tone={openInboxCount + flaggedProjects.length > 0 ? 'warning' : 'success'}>
            {openInboxCount + flaggedProjects.length} Hinweise
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card padding="md" className="space-y-4">
            <SectionHeader
              title="Offene Gedanken"
              action={<Badge tone={openInboxCount > 0 ? 'warning' : 'success'}>{openInboxCount} offen</Badge>}
            />
            {openInboxItems.length === 0 ? (
              <EmptyState compact bordered={false} icon="check_circle" title="Alles aufgeräumt" description="Es gibt keine offenen Gedanken." />
            ) : (
              <ul className="space-y-2">
                {openInboxItems.map(item => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-subtle bg-subtle p-3">
                    <span className="line-clamp-2 text-body text-primary">{item.title || item.summary}</span>
                    <Badge tone="neutral" size="sm" className="shrink-0">Offen</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="md" className="space-y-4">
            <SectionHeader
              title="Projekte mit Rückstand"
              action={<Badge tone={flaggedProjects.length > 0 ? 'danger' : 'success'}>{flaggedProjects.length} betroffen</Badge>}
            />
            {flaggedProjects.length === 0 ? (
              <EmptyState compact bordered={false} icon="verified" title="Alles im Zeitplan" description="Alle aktiven Projekte liegen im Plan." />
            ) : (
              <div className="space-y-3">
                {flaggedProjects.map(project => {
                  const delay = (project.timeElapsed || 0) - (project.progress || 0);
                  return (
                    <div key={project.id} className="space-y-2 rounded-md border border-subtle bg-subtle p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-body-strong text-primary">{project.title}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {project.isPaused && <Badge tone="warning" size="sm">Pausiert</Badge>}
                          {project.warning && <Badge tone="danger" size="sm">{project.warning}</Badge>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-caption text-secondary">
                        <span>Fortschritt {project.progress || 0} %</span>
                        <span>Zeit {project.timeElapsed || 0} %</span>
                        {delay > 0 && !project.warning && (
                          <span className="text-caption-strong text-warning">Rückstand +{delay} %</span>
                        )}
                      </div>

                      <ProgressBar value={project.progress || 0} size="sm" label={`Fortschritt ${project.title}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Ausblick: nächste Schritte */}
      <section className="space-y-4 border-t border-subtle pt-8">
        <div className="flex items-center gap-2">
          <IconTile area="neutral" icon="arrow_forward" size="sm" />
          <h2 className="text-heading text-primary">Ausblick und Fokus</h2>
          <Badge tone="neutral">{activeProjects.length} Projekte</Badge>
        </div>

        <Card padding="md" className="space-y-4">
          <SectionHeader title="Nächste Schritte der aktiven Projekte" />

          {activeProjects.length === 0 ? (
            <EmptyState compact bordered={false} icon="task_alt" title="Keine aktiven nächsten Schritte" description="Alle aktiven Projekte sind abgeschlossen oder in der Planung." />
          ) : (
            <div className="space-y-3">
              {activeProjects.map(project => {
                const nextStepText = project?.nextStep && typeof project.nextStep === 'string' && project.nextStep.trim() !== ''
                  ? project.nextStep
                  : 'Kein nächster Schritt hinterlegt';

                return (
                  <div key={project?.id || project?.title} className="space-y-2 rounded-md border border-subtle bg-subtle p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-strong text-primary">{project?.title}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {project?.isPaused && <Badge tone="warning" size="sm">Pausiert</Badge>}
                        <Badge tone="neutral" size="sm">{project?.status}</Badge>
                        <span className="text-caption tabular-nums text-secondary">{project?.progress || 0} %</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface p-2.5 text-body text-primary">
                      <Icon name="play_arrow" size="sm" className="shrink-0 text-secondary" />
                      <span className="text-body-strong">{nextStepText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
};

export default Review;
