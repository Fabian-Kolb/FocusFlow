import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import CardContextMenu from '../ui/CardContextMenu';

const Projects = ({ setCurrentScreen }) => {
  const { 
    projects, 
    openModal, 
    setSelectedProjectId, 
    toggleProjectStatus, 
    toggleProjectPause,
    deleteProject,
    toggleProjectKanban
  } = useModalContext();

  const handleProjectClick = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentScreen('project-detail');
  };

  const getStatusStyle = (status) => {
    if (status === 'GEPLANT') {
      return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
    }
    if (status === 'ABGESCHLOSSEN') {
      return 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
  };

  return (
    <div className="screen-transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="relative flex-grow max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <Input
            type="text"
            className="pl-10"
            placeholder="Projekte durchsuchen..."
          />
        </div>
        <Button onClick={() => openModal('project')}>
          Neues Projekt
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {projects.map((project) => (
          <Card
            key={project.id}
            interactive
            className={`flex flex-col justify-between min-h-[250px] sm:min-h-[300px] transition-all ${
              project.isPaused 
                ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/40' 
                : project.inKanban === false
                ? 'bg-purple-50/50 border-purple-300 ring-1 ring-purple-300/40'
                : ''
            }`}
            onClick={() => handleProjectClick(project.id)}
          >
            {project.inKanban === false && (
              <div 
                className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-white z-10 shadow-sm"
                title="Nicht im Kanban-Board"
              />
            )}
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="marquee-wrapper flex-1">
                  <h3 className="text-base sm:text-lg font-bold hover:underline leading-snug marquee-content">
                    {project.title}
                  </h3>
                </div>
                <CardContextMenu
                  isPaused={project.isPaused}
                  onTogglePause={() => toggleProjectPause(project.id)}
                  inKanban={project.inKanban}
                  onToggleKanban={() => toggleProjectKanban(project.id)}
                  onDelete={() => deleteProject(project.id)}
                />
              </div>
              <div className="flex justify-between items-center gap-2 mb-2">
                <p className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
                  {project.dateRange} <span className="font-bold text-primary">({project.daysRemaining})</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 sm:gap-2 my-1 p-1.5 sm:p-2 bg-surface-low border border-outline-variant rounded-lg text-[9px] sm:text-[11px] font-mono">
              <div>
                <span className="text-on-surface-variant block text-[8px] sm:text-[10px] uppercase">Phasen</span>
                <span className="font-bold text-primary">{project.phasesCompleted} / {project.phasesTotal} Erledigt</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[8px] sm:text-[10px] uppercase">Unterpunkte</span>
                <span className="font-bold text-primary">{project.tasksCompleted} / {project.tasksTotal} Tasks</span>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3 border-t border-outline-variant pt-2 sm:pt-3 mt-auto">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {project.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectStatus(project.id);
                    }}
                    className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg border text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${getStatusStyle(project.status)}`}
                    title="Klicken um Status zu wechseln"
                  >
                    {project.status === 'LAUFEND' ? 'AKTIV' : project.status}
                  </button>
                )}

                {project.warning && (
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg border bg-amber-100 text-amber-900 border-amber-300 text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider">
                    {project.warning}
                  </span>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center text-[9px] sm:text-[11px] mono font-bold mb-1">
                  <span>FORTSCHRITT</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-surface-low h-1.5 sm:h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[8px] sm:text-[10px] mono text-on-surface-variant mb-1">
                  <span>VERSTRICHENE ZEIT</span>
                  <span>{project.timeElapsed}%</span>
                </div>
                <div className="w-full bg-surface-low h-1.5 sm:h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${project.timeElapsed}%` }}></div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Projects;
