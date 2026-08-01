import React from 'react';
import { useModalContext } from '../../context/ModalContext';

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
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-outline-variant bg-white focus:border-primary transition-colors outline-none text-sm"
            placeholder="Projekte durchsuchen..."
          />
        </div>
        <button
          className="px-6 py-2.5 bg-primary text-on-primary text-sm font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap"
          onClick={() => openModal('project')}
        >
          Neues Projekt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="text-left p-4 sm:p-6 bg-white border border-outline-variant hover:border-primary transition-all flex flex-col justify-between h-[280px] cursor-pointer"
            onClick={() => handleProjectClick(project.id)}
          >
            <div>
              <div className="marquee-wrapper mb-1">
                <h3 className="text-lg font-bold hover:underline leading-snug marquee-content">
                  {project.title}
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant font-mono mb-2 truncate">
                {project.dateRange} <span className="font-bold text-primary">({project.daysRemaining})</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 my-1 p-2 bg-surface-low border border-outline-variant text-[11px] font-mono">
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase">Phasen</span>
                <span className="font-bold text-primary">{project.phasesCompleted} / {project.phasesTotal} Erledigt</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px] uppercase">Unterpunkte</span>
                <span className="font-bold text-primary">{project.tasksCompleted} / {project.tasksTotal} Tasks</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-outline-variant pt-2.5">
              {project.warning && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                    {project.warning}
                  </span>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center text-[11px] mono font-bold mb-0.5">
                  <span>FORTSCHRITT</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-surface-low h-2 border border-outline-variant">
                  <div className="bg-primary h-full" style={{ width: `${project.progress}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] mono text-on-surface-variant mb-0.5">
                  <span>VERSTRICHENE ZEIT</span>
                  <span>{project.timeElapsed}%</span>
                </div>
                <div className="w-full bg-surface-low h-1.5 border border-outline-variant">
                  <div className="bg-neutral-400 h-full" style={{ width: `${project.timeElapsed}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Projects;
