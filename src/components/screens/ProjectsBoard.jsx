import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

const ProjectsBoard = ({ setCurrentScreen }) => {
  const { projects, setSelectedProjectId, updateProjectForKanban } = useModalContext();
  const [draggedProjectId, setDraggedProjectId] = useState(null);

  // Group projects
  const todoProjects = projects.filter(p => p.progress === 0 && p.status !== 'ABGESCHLOSSEN');
  const inProgressProjects = projects.filter(p => p.progress > 0 && p.status !== 'ABGESCHLOSSEN');
  const doneProjects = projects.filter(p => p.status === 'ABGESCHLOSSEN');

  const handleDragStart = (e, projectId) => {
    setDraggedProjectId(projectId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedProjectId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-surface-variant/30');
  };
  
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-surface-variant/30');
  };

  const handleDrop = (e, column) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-surface-variant/30');
    if (draggedProjectId) {
      updateProjectForKanban(draggedProjectId, column);
    }
  };

  const handleProjectClick = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentScreen('project-detail');
  };

  const renderCard = (project) => (
    <div
      key={project.id}
      draggable
      onDragStart={(e) => handleDragStart(e, project.id)}
      onDragEnd={handleDragEnd}
      className="mb-4 cursor-grab active:cursor-grabbing"
    >
      <Card
        interactive
        className="flex flex-col justify-between"
        onClick={() => handleProjectClick(project.id)}
      >
        <div>
          <div className="marquee-wrapper mb-1">
            <h3 className="text-sm sm:text-base font-bold hover:underline leading-snug marquee-content">
              {project.title}
            </h3>
          </div>
          <div className="flex justify-between items-center gap-2 mb-2">
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
              {project.dateRange} <span className="font-bold text-primary">({project.daysRemaining})</span>
            </p>
            {project.status && (
              <Badge className={project.status === 'PAUSIERT' ? 'bg-amber-100 text-amber-900 border-amber-300 text-[9px] px-1.5' : project.status === 'ABGESCHLOSSEN' ? 'bg-neutral-100 text-neutral-800 border-neutral-300 text-[9px] px-1.5' : 'bg-emerald-100 text-emerald-900 border-emerald-300 text-[9px] px-1.5'}>
                {project.status}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 my-1 p-2 bg-surface-low border border-outline-variant rounded-lg text-[10px] font-mono">
          <div>
            <span className="text-on-surface-variant block text-[9px] uppercase">Phasen</span>
            <span className="font-bold text-primary">{project.phasesCompleted} / {project.phasesTotal}</span>
          </div>
          <div>
            <span className="text-on-surface-variant block text-[9px] uppercase">Tasks</span>
            <span className="font-bold text-primary">{project.tasksCompleted} / {project.tasksTotal}</span>
          </div>
        </div>

        <div className="space-y-2 border-t border-outline-variant pt-2 mt-auto">
          {project.warning && (
            <div className="flex items-center justify-between mb-1">
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px]">
                {project.warning}
              </Badge>
            </div>
          )}
          <div>
            <div className="flex justify-between items-center text-[10px] mono font-bold mb-1">
              <span>FORTSCHRITT</span>
              <span>{project.progress}%</span>
            </div>
            <div className="w-full bg-surface-low h-1.5 border border-outline-variant rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${project.progress}%` }}></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="screen-transition h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 shrink-0">
        <h2 className="text-2xl font-bold font-mono tracking-tight">Kanban Board</h2>
        <div className="text-sm text-on-surface-variant mono">
          Projekte per Drag & Drop verschieben
        </div>
      </div>

      {/* Board Columns Container */}
      <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 h-full flex-grow items-start snap-x">
        
        {/* TO DO Column */}
        <div 
          className="flex-shrink-0 w-[280px] sm:w-[320px] bg-surface-low border border-outline-variant rounded-xl flex flex-col h-full snap-center transition-colors"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'TODO')}
        >
          <div className="p-4 border-b border-outline-variant shrink-0 flex items-center justify-between sticky top-0 bg-surface-low rounded-t-xl z-10">
            <h3 className="font-bold text-sm">Geplant / To Do</h3>
            <Badge className="bg-neutral-200 text-neutral-800">{todoProjects.length}</Badge>
          </div>
          <div className="p-3 overflow-y-auto flex-grow kanban-column">
            {todoProjects.map(renderCard)}
            {todoProjects.length === 0 && (
              <div className="h-24 border-2 border-dashed border-outline-variant rounded-lg flex items-center justify-center text-on-surface-variant text-sm font-mono opacity-50">
                Leer
              </div>
            )}
          </div>
        </div>

        {/* IN PROGRESS Column */}
        <div 
          className="flex-shrink-0 w-[280px] sm:w-[320px] bg-surface-low border border-outline-variant rounded-xl flex flex-col h-full snap-center transition-colors"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'IN_PROGRESS')}
        >
          <div className="p-4 border-b border-outline-variant shrink-0 flex items-center justify-between sticky top-0 bg-surface-low rounded-t-xl z-10">
            <h3 className="font-bold text-sm text-primary">In Arbeit</h3>
            <Badge className="bg-primary/20 text-primary">{inProgressProjects.length}</Badge>
          </div>
          <div className="p-3 overflow-y-auto flex-grow kanban-column">
            {inProgressProjects.map(renderCard)}
            {inProgressProjects.length === 0 && (
              <div className="h-24 border-2 border-dashed border-outline-variant rounded-lg flex items-center justify-center text-on-surface-variant text-sm font-mono opacity-50">
                Leer
              </div>
            )}
          </div>
        </div>

        {/* DONE Column */}
        <div 
          className="flex-shrink-0 w-[280px] sm:w-[320px] bg-surface-low border border-outline-variant rounded-xl flex flex-col h-full snap-center transition-colors"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'DONE')}
        >
          <div className="p-4 border-b border-outline-variant shrink-0 flex items-center justify-between sticky top-0 bg-surface-low rounded-t-xl z-10">
            <h3 className="font-bold text-sm text-emerald-800">Abgeschlossen</h3>
            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">{doneProjects.length}</Badge>
          </div>
          <div className="p-3 overflow-y-auto flex-grow kanban-column">
            {doneProjects.map(renderCard)}
            {doneProjects.length === 0 && (
              <div className="h-24 border-2 border-dashed border-outline-variant rounded-lg flex items-center justify-center text-on-surface-variant text-sm font-mono opacity-50">
                Leer
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProjectsBoard;
