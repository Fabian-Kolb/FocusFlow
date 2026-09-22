import React, { useState, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useCardTouchDrag } from '../ui/useCardTouchDrag';
import Card from '../ui/Card';
import CardContextMenu from '../ui/CardContextMenu';
import KanbanFilterDrawer from '../ui/KanbanFilterDrawer';

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
    toggleReminderStatus,
    // Kanban Views & Categories
    kanbanViews = [],
    activeKanbanViewId = 'system_all',
    setActiveKanbanViewId,
    addKanbanView,
    updateKanbanView,
    deleteKanbanView,
    projectCategories = [],
    reminderCategories = []
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

  // Drawer and Category Filter State (UND-Verknüpfung: beliebige Kombination aus Projekten & Erinnerungen)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isCustomFilter, setIsCustomFilter] = useState(false);
  const [selectedProjectCategoryIds, setSelectedProjectCategoryIds] = useState(() => {
    if (activeKanbanViewId === 'system_projects') return 'all';
    if (activeKanbanViewId === 'system_reminders') return [];
    const view = kanbanViews.find(v => v.id === activeKanbanViewId);
    if (view) {
      return view.showProjects === false ? [] : (view.projectCategoryIds || 'all');
    }
    return 'all';
  });
  const [selectedReminderCategoryIds, setSelectedReminderCategoryIds] = useState(() => {
    if (activeKanbanViewId === 'system_projects') return [];
    if (activeKanbanViewId === 'system_reminders') return 'all';
    const view = kanbanViews.find(v => v.id === activeKanbanViewId);
    if (view) {
      return view.showReminders === false ? [] : (view.reminderCategoryIds || 'all');
    }
    return 'all';
  });

  // Synchronize category selection when preset view changes (unless user made custom category selection)
  React.useEffect(() => {
    if (!isCustomFilter) {
      if (activeKanbanViewId === 'system_all') {
        setSelectedProjectCategoryIds('all');
        setSelectedReminderCategoryIds('all');
      } else if (activeKanbanViewId === 'system_projects') {
        setSelectedProjectCategoryIds('all');
        setSelectedReminderCategoryIds([]);
      } else if (activeKanbanViewId === 'system_reminders') {
        setSelectedProjectCategoryIds([]);
        setSelectedReminderCategoryIds('all');
      } else {
        const view = kanbanViews.find(v => v.id === activeKanbanViewId);
        if (view) {
          setSelectedProjectCategoryIds(
            view.showProjects === false ? [] : (view.projectCategoryIds || 'all')
          );
          setSelectedReminderCategoryIds(
            view.showReminders === false ? [] : (view.reminderCategoryIds || 'all')
          );
        }
      }
    }
  }, [activeKanbanViewId, kanbanViews, isCustomFilter]);

  // Mobile horizontal column tab navigation & scroll detection
  const [activeTab, setActiveTab] = useState('TODO');
  const scrollContainerRef = useRef(null);

  const scrollToColumn = (colId) => {
    setActiveTab(colId);
    const container = scrollContainerRef.current;
    const colEl = document.getElementById(`kanban-col-${colId}`);
    if (container && colEl) {
      const targetLeft = colEl.offsetLeft - container.offsetLeft;
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    if (width > 0) {
      const index = Math.round(scrollLeft / width);
      const cols = ['TODO', 'IN_PROGRESS', 'DONE'];
      if (cols[index] && cols[index] !== activeTab) {
        setActiveTab(cols[index]);
      }
    }
  };

  // Find active view or fallback to 'system_all'
  const currentView = kanbanViews.find(v => v.id === activeKanbanViewId) || kanbanViews[0] || {
    id: 'system_all',
    name: 'Alle',
    icon: 'view_kanban',
    type: 'system',
    showProjects: true,
    showReminders: true,
    projectCategoryIds: 'all',
    reminderCategoryIds: 'all'
  };

  // Multi-Select Category Filtering (UND-Verknüpfung)
  let filteredProjects = [];
  if (selectedProjectCategoryIds === 'all') {
    filteredProjects = projects;
  } else if (Array.isArray(selectedProjectCategoryIds)) {
    filteredProjects = projects.filter(p => selectedProjectCategoryIds.includes(p.categoryId || 'allgemein'));
  }

  let filteredReminders = [];
  if (selectedReminderCategoryIds === 'all') {
    filteredReminders = reminders;
  } else if (Array.isArray(selectedReminderCategoryIds)) {
    filteredReminders = reminders.filter(r => selectedReminderCategoryIds.includes(r.categoryId || 'allgemein'));
  }

  // Combine items and apply inKanban flag
  const allItems = [
    ...filteredProjects.map(p => ({ ...p, itemType: 'project' })),
    ...filteredReminders.map(r => ({ ...r, itemType: 'reminder' }))
  ];
  
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
          className="mb-3 cursor-grab active:cursor-grabbing touch-action-none"
        >
          <Card
            interactive
            padding="small"
            className={`flex flex-col justify-between min-h-0 transition-all ${
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

            <div className="space-y-2 sm:space-y-2.5 border-t border-outline-variant pt-2 mt-auto">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {project.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectStatus(project.id);
                    }}
                    className={`px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-lg border text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${getStatusStyle(project.status)}`}
                    title="Klicken um Status zu wechseln"
                  >
                    {project.status === 'LAUFEND' ? 'AKTIV' : project.status}
                  </button>
                )}

                {project.warning && (
                  <span className="px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-lg border bg-amber-100 text-amber-900 border-amber-300 text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider">
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
          className="mb-3 cursor-grab active:cursor-grabbing touch-action-none"
        >
          <Card
            interactive
            padding="small"
            className={`flex flex-col justify-between min-h-0 transition-all ${
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
              <div className="mb-2">
                <p className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
                  {reminder.dateRange} <span className="font-bold text-primary">({reminder.daysRemaining})</span>
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-outline-variant pt-2 mt-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {reminder.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReminderStatus(reminder.id);
                    }}
                    className={`px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-lg border text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${getStatusStyle(reminder.status)}`}
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

  // Custom view for 3rd Quick Tab (either currently active custom view or first available)
  const activeCustomView = kanbanViews.find(v => !v.isSystem && v.type === 'custom' && v.id === activeKanbanViewId)
    || kanbanViews.find(v => !v.isSystem && v.type === 'custom');

  const isFilterActive = isCustomFilter || activeKanbanViewId !== 'system_all';

  let activeViewLabel = currentView.name;
  if (isCustomFilter) {
    const pCount = Array.isArray(selectedProjectCategoryIds) ? selectedProjectCategoryIds.length : projectCategories.length;
    const rCount = Array.isArray(selectedReminderCategoryIds) ? selectedReminderCategoryIds.length : reminderCategories.length;
    activeViewLabel = `${pCount} Proj. + ${rCount} Erinn.`;
  }

  return (
    <div className="h-full flex flex-col w-full min-h-0">
      {/* Top Header Bar: Quick Tabs & Drawer Trigger */}
      <div className="flex items-center justify-between gap-2 mb-3 bg-surface-low border border-outline-variant p-1.5 rounded-2xl shadow-xs shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {/* Quick Tab 1: Alle */}
          <button
            type="button"
            onClick={() => {
              setIsCustomFilter(false);
              setActiveKanbanViewId('system_all');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              !isCustomFilter && activeKanbanViewId === 'system_all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_kanban</span>
            <span>Alle</span>
          </button>

          {/* Quick Tab 2: Nur Projekte */}
          <button
            type="button"
            onClick={() => {
              setIsCustomFilter(false);
              setActiveKanbanViewId('system_projects');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              !isCustomFilter && activeKanbanViewId === 'system_projects'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder</span>
            <span>Nur Projekte</span>
          </button>

          {/* Quick Tab 3: Custom View (if available) */}
          {activeCustomView && (
            <button
              type="button"
              onClick={() => {
                setIsCustomFilter(false);
                setActiveKanbanViewId(activeCustomView.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer max-w-[160px] truncate ${
                !isCustomFilter && activeKanbanViewId === activeCustomView.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
              title={activeCustomView.name}
            >
              <span className="material-symbols-outlined text-[16px]">{activeCustomView.icon || 'star'}</span>
              <span className="truncate">{activeCustomView.name}</span>
            </button>
          )}

          {/* If a custom multi-select filter is active, show filter chip */}
          {isCustomFilter && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/30 text-xs font-bold shrink-0">
              <span className="material-symbols-outlined text-[14px]">tune</span>
              <span className="truncate max-w-[180px]">
                Filter: {Array.isArray(selectedProjectCategoryIds) ? selectedProjectCategoryIds.length : projectCategories.length}P + {Array.isArray(selectedReminderCategoryIds) ? selectedReminderCategoryIds.length : reminderCategories.length}E
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCustomFilter(false);
                  setActiveKanbanViewId('system_all');
                }}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors cursor-pointer"
                title="Filter zurücksetzen"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Section: Drawer Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isFilterActive
                ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40'
                : 'bg-surface border-outline-variant text-on-surface hover:bg-surface-variant'
            }`}
            title="Ansichten und Filter verwalten"
          >
            <span className="material-symbols-outlined text-[17px]">tune</span>
            <span className="hidden sm:inline">Ansichten</span>
            <span className="max-w-[120px] truncate text-[11px] font-normal opacity-80">
              ({activeViewLabel})
            </span>
            <span className="material-symbols-outlined text-[15px]">expand_more</span>
          </button>
        </div>
      </div>

      {/* Mobile Column Navigation Tabs */}
      <div className="flex lg:hidden items-center justify-between gap-1.5 mb-3 bg-surface-low border border-outline-variant p-1.5 rounded-2xl shadow-xs shrink-0">
        <button
          type="button"
          onClick={() => scrollToColumn('TODO')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all truncate ${
            activeTab === 'TODO'
              ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-400/50'
              : 'text-on-surface-variant hover:bg-on-surface/5'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'TODO' ? 'bg-white' : 'bg-amber-400'}`}></span>
          <span className="truncate">Geplant</span>
          <span className={`text-[10px] font-mono shrink-0 ${activeTab === 'TODO' ? 'text-amber-100' : 'opacity-70'}`}>
            ({todoItems.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => scrollToColumn('IN_PROGRESS')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all truncate ${
            activeTab === 'IN_PROGRESS'
              ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400/50'
              : 'text-on-surface-variant hover:bg-on-surface/5'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'IN_PROGRESS' ? 'bg-white' : 'bg-emerald-400'}`}></span>
          <span className="truncate">In Arbeit</span>
          <span className={`text-[10px] font-mono shrink-0 ${activeTab === 'IN_PROGRESS' ? 'text-emerald-100' : 'opacity-70'}`}>
            ({inProgressItems.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => scrollToColumn('DONE')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all truncate ${
            activeTab === 'DONE'
              ? 'bg-neutral-700 text-white shadow-xs ring-1 ring-neutral-400/50'
              : 'text-on-surface-variant hover:bg-on-surface/5'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === 'DONE' ? 'bg-white' : 'bg-neutral-400'}`}></span>
          <span className="truncate">Erledigt</span>
          <span className={`text-[10px] font-mono shrink-0 ${activeTab === 'DONE' ? 'text-neutral-200' : 'opacity-70'}`}>
            ({doneItems.length})
          </span>
        </button>
      </div>

      {/* Empty State Banner if 0 items across the board */}
      {kanbanItems.length === 0 && (
        <div className="mb-3 p-3 sm:p-4 rounded-2xl border border-dashed border-outline-variant bg-surface-low flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px] text-on-surface-variant">filter_alt_off</span>
            </div>
            <div>
              <p className="font-bold text-sm text-on-surface">Keine Elemente in dieser Ansicht</p>
              <p className="text-xs text-on-surface-variant">
                {isCustomFilter
                  ? 'Mit der gewählten Kategorie-Kombination wurden keine aktiven Kanban-Elemente gefunden.'
                  : `In der Ansicht "${currentView.name}" wurden keine passenden Kategorien oder Elemente gefunden.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsCustomFilter(false);
                setActiveKanbanViewId('system_all');
              }}
              className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Alle anzeigen
            </button>
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-outline-variant text-on-surface text-xs font-semibold hover:bg-surface-variant transition-colors cursor-pointer"
            >
              Filter öffnen
            </button>
          </div>
        </div>
      )}

      {/* Main Kanban Board Container */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory lg:snap-none pb-2 no-scrollbar min-h-0"
      >
        {/* Column 1: Geplant (TODO) */}
        <div
          id="kanban-col-TODO"
          onDragOver={(e) => handleDragOver(e, 'TODO')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'TODO')}
          className="flex-1 min-w-[85vw] sm:min-w-[320px] lg:min-w-0 flex flex-col bg-surface border border-outline-variant rounded-2xl p-2.5 sm:p-3 snap-center shadow-xs transition-colors"
        >
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            <h3 className="font-bold text-sm">Geplant</h3>
            <span className="ml-auto bg-surface-low border border-outline-variant text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-full">
              {todoItems.length}
            </span>
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl p-2 sm:p-3 border border-dashed transition-all ${
            touchKanbanColTarget === 'TODO' 
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40' 
              : 'border-outline-variant/60 bg-surface-low/30'
          }`}>
            {todoItems.map(renderCard)}
            {todoItems.length === 0 && (
              <div className="h-28 lg:h-full flex items-center justify-center text-on-surface-variant/50 text-xs italic font-mono border-2 border-dashed border-transparent">
                Keine geplanten Elemente
              </div>
            )}
          </div>
        </div>

        {/* Column 2: In Arbeit (IN_PROGRESS) */}
        <div
          id="kanban-col-IN_PROGRESS"
          onDragOver={(e) => handleDragOver(e, 'IN_PROGRESS')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'IN_PROGRESS')}
          className="flex-1 min-w-[85vw] sm:min-w-[320px] lg:min-w-0 flex flex-col bg-surface border border-outline-variant rounded-2xl p-2.5 sm:p-3 snap-center shadow-xs transition-colors"
        >
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <h3 className="font-bold text-sm">In Arbeit</h3>
            <span className="ml-auto bg-surface-low border border-outline-variant text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-full">
              {inProgressItems.length}
            </span>
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl p-2 sm:p-3 border border-dashed transition-all ${
            touchKanbanColTarget === 'IN_PROGRESS'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-outline-variant/60 bg-surface-low/30'
          }`}>
            {inProgressItems.map(renderCard)}
            {inProgressItems.length === 0 && (
              <div className="h-28 lg:h-full flex items-center justify-center text-on-surface-variant/50 text-xs italic font-mono border-2 border-dashed border-transparent">
                Keine Elemente in Arbeit
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Abgeschlossen (DONE) */}
        <div
          id="kanban-col-DONE"
          onDragOver={(e) => handleDragOver(e, 'DONE')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'DONE')}
          className="flex-1 min-w-[85vw] sm:min-w-[320px] lg:min-w-0 flex flex-col bg-surface border border-outline-variant rounded-2xl p-2.5 sm:p-3 snap-center shadow-xs transition-colors"
        >
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-400"></div>
            <h3 className="font-bold text-sm">Abgeschlossen</h3>
            <span className="ml-auto bg-surface-low border border-outline-variant text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-full">
              {doneItems.length}
            </span>
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl p-2 sm:p-3 border border-dashed transition-all ${
            touchKanbanColTarget === 'DONE'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-outline-variant/60 bg-surface-low/30'
          }`}>
            {doneItems.map(renderCard)}
            {doneItems.length === 0 && (
              <div className="h-28 lg:h-full flex items-center justify-center text-on-surface-variant/50 text-xs italic font-mono border-2 border-dashed border-transparent">
                Keine abgeschlossenen Elemente
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Responsive Kanban Filter Drawer (Rule 04 Root Level Placement) */}
      <KanbanFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        kanbanViews={kanbanViews}
        activeKanbanViewId={isCustomFilter ? null : activeKanbanViewId}
        selectedProjectCategoryIds={selectedProjectCategoryIds}
        selectedReminderCategoryIds={selectedReminderCategoryIds}
        onApplyFilter={({ projectCategoryIds, reminderCategoryIds, viewId }) => {
          setSelectedProjectCategoryIds(projectCategoryIds);
          setSelectedReminderCategoryIds(reminderCategoryIds);
          if (viewId) {
            setIsCustomFilter(false);
            setActiveKanbanViewId(viewId);
          } else {
            setIsCustomFilter(true);
          }
        }}
        projectCategories={projectCategories}
        reminderCategories={reminderCategories}
        onAddView={addKanbanView}
        onUpdateView={updateKanbanView}
        onDeleteView={deleteKanbanView}
      />
    </div>
  );
};

export default ProjectsBoard;
