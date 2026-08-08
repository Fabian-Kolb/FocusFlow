import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useCardTouchDrag } from '../ui/useCardTouchDrag';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import CardContextMenu from '../ui/CardContextMenu';

const ProjectsBoard = ({ setCurrentScreen }) => {
  const { 
    projects,
    reminders,
    setSelectedProjectId,
    setSelectedReminderId, 
    updateProjectForKanban,
    updateReminderForKanban,
    toggleProjectPause,
    toggleReminderPause,
    deleteProject,
    deleteReminder,
    toggleProjectKanban,
    toggleReminderKanban,
    toggleProjectStatus,
    toggleReminderStatus
  } = useModalContext();

  const handleMoveKanbanItem = (itemId, column) => {
    const proj = projects.find(p => p.id === itemId);
    if (proj) {
      updateProjectForKanban(itemId, column);
    } else {
      updateReminderForKanban(itemId, column);
    }
  };

  const {
    cardDropTargetId: touchKanbanColTarget,
    startCardTouchDrag: startKanbanCardDrag,
    handleHtml5DragStart: handleKanbanHtml5DragStart,
    handleHtml5DragOver: handleKanbanHtml5DragOver,
    handleHtml5DragEnd: handleKanbanHtml5DragEnd
  } = useCardTouchDrag({
    onMoveItemToCategory: handleMoveKanbanItem,
    categoryPrefix: 'kanban-col-'
  });

  const [draggedItem, setDraggedItem] = useState(null);
  const [showProjects, setShowProjects] = useState(true);
  const [showReminders, setShowReminders] = useState(true);

  // Combine arrays based on filters
  const allItems = [];
  if (showProjects) {
    allItems.push(...projects.map(p => ({ ...p, itemType: 'project' })));
  }
  if (showReminders) {
    allItems.push(...reminders.map(r => ({ ...r, itemType: 'reminder' })));
  }
  
  const kanbanItems = allItems.filter(item => item.inKanban !== false);

  const todoItems = kanbanItems.filter(i => i.status?.toUpperCase() === 'GEPLANT');
  const inProgressItems = kanbanItems.filter(i => {
    const s = i.status?.toUpperCase();
    return s === 'AKTIV' || s === 'LAUFEND' || s === 'PAUSIERT';
  });
  const doneItems = kanbanItems.filter(i => i.status?.toUpperCase() === 'ABGESCHLOSSEN');

  const handleDragStart = (e, item) => {
    setDraggedItem({ id: item.id, itemType: item.itemType });
    handleKanbanHtml5DragStart(e, item.id);
    if (e.target) {
      setTimeout(() => {
        if (e.target) e.target.style.opacity = '0.5';
      }, 0);
    }
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDraggedItem(null);
    handleKanbanHtml5DragEnd();
  };

  const handleDragOver = (e, column) => {
    e.preventDefault();
    handleKanbanHtml5DragOver(e, column);
    e.currentTarget.classList.add('bg-surface-variant/30');
  };
  
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-surface-variant/30');
  };

  const handleDrop = (e, column) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-surface-variant/30');
    handleKanbanHtml5DragEnd();
    if (draggedItem) {
      setTimeout(() => {
        if (draggedItem.itemType === 'project') {
          updateProjectForKanban(draggedItem.id, column);
        } else {
          updateReminderForKanban(draggedItem.id, column);
        }
      }, 50);
    }
  };

  const handleItemClick = (item) => {
    if (item.itemType === 'project') {
      setSelectedProjectId(item.id);
      setCurrentScreen('project-detail');
    } else {
      setSelectedReminderId(item.id);
      setCurrentScreen('reminder-detail');
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'GEPLANT': return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
      case 'ABGESCHLOSSEN': return 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200';
      case 'AKTIV':
      case 'LAUFEND':
      default: return 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
    }
  };

  const renderCard = (item) => {
    if (item.itemType === 'project') {
      const project = item;
      return (
        <div
          key={project.id}
          draggable
          onDragStart={(e) => handleDragStart(e, project)}
          onDragEnd={handleDragEnd}
          onTouchStart={(e) => startKanbanCardDrag(e, project.id, project.title)}
          className="mb-4 cursor-grab active:cursor-grabbing touch-action-none"
        >
          <Card
            interactive
            className={`flex flex-col justify-between min-h-[250px] sm:min-h-[300px] transition-all ${
              project.isPaused 
                ? '!bg-blue-100 !border-blue-300 ring-1 ring-blue-300/40' 
                : ''
            }`}
            onClick={() => handleItemClick(project)}
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
                  itemType="project"
                  itemId={project.id}
                  currentCategoryId={project.categoryId}
                  itemStatus={project.status}
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
        </div>
      );
    } else {
      const reminder = item;
      return (
        <div
          key={reminder.id}
          draggable
          onDragStart={(e) => handleDragStart(e, reminder)}
          onDragEnd={handleDragEnd}
          onTouchStart={(e) => startKanbanCardDrag(e, reminder.id, reminder.title)}
          className="mb-4 cursor-grab active:cursor-grabbing touch-action-none"
        >
          <Card
            interactive
            className={`flex flex-col justify-between transition-all ${
              reminder.isPaused 
                ? '!bg-blue-100 !border-blue-300 ring-1 ring-blue-300/40' 
                : ''
            }`}
            onClick={() => handleItemClick(reminder)}
          >
            {reminder.inKanban === false && (
              <div 
                className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-white z-10 shadow-sm"
                title="Nicht im Kanban-Board"
              />
            )}
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="marquee-wrapper flex-1">
                  <h3 className="text-base sm:text-lg font-bold hover:underline leading-snug marquee-content">
                    {reminder.title}
                  </h3>
                </div>
                <CardContextMenu
                  isPaused={reminder.isPaused}
                  onTogglePause={() => toggleReminderPause(reminder.id)}
                  inKanban={reminder.inKanban}
                  onToggleKanban={() => toggleReminderKanban(reminder.id)}
                  onDelete={() => deleteReminder(reminder.id)}
                  itemType="reminder"
                  itemId={reminder.id}
                  currentCategoryId={reminder.categoryId}
                  itemStatus={reminder.status}
                />
              </div>
              <div className="mb-2 sm:mb-3">
                <p className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
                  {reminder.dateRange} <span className="font-bold text-primary">({reminder.daysRemaining})</span>
                </p>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3 border-t border-outline-variant pt-2 sm:pt-3 mt-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {reminder.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReminderStatus(reminder.id);
                    }}
                    className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg border text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${getStatusStyle(reminder.status)}`}
                    title="Klicken um Status zu wechseln"
                  >
                    {reminder.status}
                  </button>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center text-[8px] sm:text-[10px] mono text-on-surface-variant mb-1">
                  <span>VERSTRICHENE ZEIT</span>
                  <span>{reminder.timeElapsed}%</span>
                </div>
                <div className="w-full bg-surface-low h-1.5 sm:h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${reminder.timeElapsed}%` }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      );
    }
  };

  const renderFilter = (className) => (
    <div className={`flex bg-surface-low p-1 rounded-xl border border-outline-variant shadow-sm gap-1 ${className}`}>
      <button
        onClick={() => setShowProjects(!showProjects)}
        title="Projekte anzeigen/ausblenden"
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
          showProjects 
            ? 'bg-primary text-white shadow-sm' 
            : 'text-on-surface-variant hover:bg-on-surface/5 hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">folder</span>
      </button>
      <button
        onClick={() => setShowReminders(!showReminders)}
        title="Erinnerungen anzeigen/ausblenden"
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
          showReminders 
            ? 'bg-primary text-white shadow-sm' 
            : 'text-on-surface-variant hover:bg-on-surface/5 hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">notifications</span>
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col w-full">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 pb-4 pt-2 overflow-y-auto lg:overflow-hidden">
        {/* Geplant Column */}
        <div 
          id="kanban-col-TODO"
          data-kanban-column="TODO"
          className="flex flex-col min-h-0 lg:h-full"
          onDragOver={(e) => handleDragOver(e, 'TODO')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'TODO')}
        >
          <div className="relative flex items-center gap-2 mb-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
            <h3 className="font-bold text-sm">Geplant</h3>
            
            {/* Mobile Filter */}
            {renderFilter("lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2")}

            <span className="ml-auto bg-surface-low border border-outline-variant text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-full">
              {todoItems.length}
            </span>
          </div>
          <div className={`flex-1 lg:overflow-y-auto rounded-xl p-2 sm:p-3 border border-dashed transition-all ${
            touchKanbanColTarget === 'TODO'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-outline-variant/60 bg-surface-low/30'
          }`}>
            {todoItems.map(renderCard)}
            {todoItems.length === 0 && (
              <div className="h-32 lg:h-full flex items-center justify-center text-on-surface-variant/50 text-sm italic font-mono border-2 border-dashed border-transparent">
                Keine geplanten Elemente
              </div>
            )}
          </div>
        </div>

        {/* In Arbeit Column */}
        <div 
          id="kanban-col-IN_PROGRESS"
          data-kanban-column="IN_PROGRESS"
          className="flex flex-col min-h-0 lg:h-full"
          onDragOver={(e) => handleDragOver(e, 'IN_PROGRESS')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'IN_PROGRESS')}
        >
          <div className="relative flex items-center gap-2 mb-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <h3 className="font-bold text-sm">In Arbeit</h3>
            
            {renderFilter("hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2")}

            <span className="ml-auto bg-surface-low border border-outline-variant text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-full">
              {inProgressItems.length}
            </span>
          </div>
          <div className={`flex-1 lg:overflow-y-auto rounded-xl p-2 sm:p-3 border border-dashed transition-all ${
            touchKanbanColTarget === 'IN_PROGRESS'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-outline-variant/60 bg-surface-low/30'
          }`}>
            {inProgressItems.map(renderCard)}
            {inProgressItems.length === 0 && (
              <div className="h-32 lg:h-full flex items-center justify-center text-on-surface-variant/50 text-sm italic font-mono border-2 border-dashed border-transparent">
                Keine aktiven Elemente
              </div>
            )}
          </div>
        </div>

        {/* Abgeschlossen Column */}
        <div 
          id="kanban-col-DONE"
          data-kanban-column="DONE"
          className="flex flex-col min-h-0 lg:h-full"
          onDragOver={(e) => handleDragOver(e, 'DONE')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'DONE')}
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-400"></div>
            <h3 className="font-bold text-sm">Abgeschlossen</h3>
            <span className="ml-auto bg-surface-low border border-outline-variant text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-full">
              {doneItems.length}
            </span>
          </div>
          <div className={`flex-1 lg:overflow-y-auto rounded-xl p-2 sm:p-3 border border-dashed transition-all ${
            touchKanbanColTarget === 'DONE'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-outline-variant/60 bg-surface-low/30'
          }`}>
            {doneItems.map(renderCard)}
            {doneItems.length === 0 && (
              <div className="h-32 lg:h-full flex items-center justify-center text-on-surface-variant/50 text-sm italic font-mono border-2 border-dashed border-transparent">
                Keine abgeschlossenen Elemente
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsBoard;
