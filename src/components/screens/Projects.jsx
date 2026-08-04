import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';

const Projects = ({ setCurrentScreen }) => {
  const { projects, openModal, setSelectedProjectId } = useModalContext();

  const handleProjectClick = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentScreen('project-detail');
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
            className="flex flex-col justify-between h-[280px]"
            onClick={() => handleProjectClick(project.id)}
          >
            <div>
              <div className="marquee-wrapper mb-1">
                <h3 className="text-lg font-bold hover:underline leading-snug marquee-content">
                  {project.title}
                </h3>
              </div>
              <div className="flex justify-between items-center gap-2 mb-2">
                <p className="text-xs text-on-surface-variant font-mono truncate">
                  {project.dateRange} <span className="font-bold text-primary">({project.daysRemaining})</span>
                </p>
                {project.status && (
                  <Badge className={project.status === 'PAUSIERT' ? 'bg-amber-100 text-amber-900 border-amber-300' : project.status === 'ABGESCHLOSSEN' ? 'bg-neutral-100 text-neutral-800 border-neutral-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'}>
                    {project.status}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 my-1 p-2 bg-surface-low border border-outline-variant rounded-lg text-[11px] font-mono">
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase">Phasen</span>
                <span className="font-bold text-primary">{project.phasesCompleted} / {project.phasesTotal} Erledigt</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase">Unterpunkte</span>
                <span className="font-bold text-primary">{project.tasksCompleted} / {project.tasksTotal} Tasks</span>
              </div>
            </div>

            <div className="space-y-3 border-t border-outline-variant pt-3 mt-auto">
              {project.warning && (
                <div className="flex items-center justify-between mb-1">
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300">
                    {project.warning}
                  </Badge>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center text-[11px] mono font-bold mb-1">
                  <span>FORTSCHRITT</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] mono text-on-surface-variant mb-1">
                  <span>VERSTRICHENE ZEIT</span>
                  <span>{project.timeElapsed}%</span>
                </div>
                <div className="w-full bg-surface-low h-1.5 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-neutral-400 h-full rounded-full" style={{ width: `${project.timeElapsed}%` }}></div>
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
