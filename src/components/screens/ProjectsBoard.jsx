import React, { useState, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useCardTouchDrag } from '../ui/useCardTouchDrag';
import { Alert, Badge, Button, Card, Chip, Icon, PageHeader, Tabs } from '../ds';
import { ViewToggle, PROJECT_VIEW_OPTIONS } from '../ui/ListToolbar';
import { ProjectCardContent, ReminderCardContent } from '../ui/ItemCardContent';
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
    setReminderStatus,
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
    e.currentTarget.classList.add('bg-hover');
  };
  
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-hover');
  };

  const handleDrop = (e, column) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-hover');
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
          className="mb-3 cursor-grab active:cursor-grabbing [-webkit-touch-callout:none]"
        >
          <Card
            interactive
            padding="sm"
            className={`flex flex-col h-full transition-all ${
              project.isPaused
                ? '!border-dashed !border-control !bg-subtle'
                : ''
            }`}
            onClick={() => handleItemClick(project)}
          >
            <ProjectCardContent
              project={project}
              onToggleStatus={() => toggleProjectStatus(project.id)}
              menu={
                <CardContextMenu
                  isPaused={project.isPaused}
                  onTogglePause={() => toggleProjectPause(project.id)}
                  inKanban={project.inKanban}
                  onToggleKanban={() => toggleProjectKanban(project.id)}
                  onDelete={() => deleteProject(project.id)}
                  itemType="project"
                  itemId={project.id}
                  itemTitle={project.title}
                  currentCategoryId={project.categoryId}
                  itemStatus={project.status}
                />
              }
            />
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
          className="mb-3 cursor-grab active:cursor-grabbing [-webkit-touch-callout:none]"
        >
          <Card
            interactive
            padding="sm"
            className={`flex flex-col h-full transition-all ${reminder.status === 'ABGESCHLOSSEN' ? 'opacity-60' : ''} ${
              reminder.isPaused
                ? '!border-dashed !border-control !bg-subtle'
                : ''
            }`}
            onClick={() => handleItemClick(reminder)}
          >
            <ReminderCardContent
              reminder={reminder}
              onToggleStatus={() => toggleReminderStatus(reminder.id)}
              onToggleDone={() => setReminderStatus(reminder.id, reminder.status === 'ABGESCHLOSSEN' ? 'AKTIV' : 'ABGESCHLOSSEN')}
              menu={
                <CardContextMenu
                  isPaused={reminder.isPaused}
                  onTogglePause={() => toggleReminderPause(reminder.id)}
                  inKanban={reminder.inKanban}
                  onToggleKanban={() => toggleReminderKanban(reminder.id)}
                  onDelete={() => deleteReminder(reminder.id)}
                  itemType="reminder"
                  itemId={reminder.id}
                  itemTitle={reminder.title}
                  currentCategoryId={reminder.categoryId}
                  itemStatus={reminder.status}
                />
              }
            />
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

  // Spalten: Farbe nur als Statuspunkt (Regel 01): geplant = Stahlblau, in Arbeit = Grün, erledigt = Grau
  const columns = [
    { id: 'TODO', label: 'Geplant', dot: 'bg-info', items: todoItems, empty: 'Keine geplanten Elemente' },
    { id: 'IN_PROGRESS', label: 'In Arbeit', dot: 'bg-success', items: inProgressItems, empty: 'Keine Elemente in Arbeit' },
    { id: 'DONE', label: 'Abgeschlossen', dot: 'bg-control', items: doneItems, empty: 'Keine abgeschlossenen Elemente' },
  ];

  const resetFilter = () => {
    setIsCustomFilter(false);
    setActiveKanbanViewId('system_all');
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PageHeader
        title="Projekte"
        description="Kanban-Board"
        className="mb-4 shrink-0 md:items-center"
        actions={(
          <ViewToggle
            value="board"
            onChange={(v) => v === 'list' && setCurrentScreen('projects')}
            options={PROJECT_VIEW_OPTIONS}
          />
        )}
      />

      {/* Ansichten: schnelle Auswahl + Filter-Drawer */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="no-wrap-scroll -my-1.5 flex min-w-0 flex-1 items-center gap-2 py-1.5">
          <Chip
            selected={!isCustomFilter && activeKanbanViewId === 'system_all'}
            leadingIcon="view_kanban"
            onClick={resetFilter}
          >
            Alle
          </Chip>
          <Chip
            selected={!isCustomFilter && activeKanbanViewId === 'system_projects'}
            leadingIcon="folder"
            onClick={() => {
              setIsCustomFilter(false);
              setActiveKanbanViewId('system_projects');
            }}
          >
            Nur Projekte
          </Chip>
          {activeCustomView && (
            <Chip
              selected={!isCustomFilter && activeKanbanViewId === activeCustomView.id}
              leadingIcon={activeCustomView.icon || 'star'}
              className="max-w-[10rem]"
              title={activeCustomView.name}
              onClick={() => {
                setIsCustomFilter(false);
                setActiveKanbanViewId(activeCustomView.id);
              }}
            >
              <span className="truncate">{activeCustomView.name}</span>
            </Chip>
          )}
          {isCustomFilter && (
            <Chip selected leadingIcon="tune" onClick={resetFilter} title="Filter zurücksetzen">
              Filter: {Array.isArray(selectedProjectCategoryIds) ? selectedProjectCategoryIds.length : projectCategories.length} Projekte, {Array.isArray(selectedReminderCategoryIds) ? selectedReminderCategoryIds.length : reminderCategories.length} Erinnerungen
              <Icon name="close" size="sm" />
            </Chip>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          leadingIcon="tune"
          trailingIcon="expand_more"
          className={isFilterActive ? '!border-strong' : ''}
          onClick={() => setIsFilterDrawerOpen(true)}
          title="Ansichten und Filter verwalten"
        >
          <span className="hidden sm:inline">Ansichten</span>
          <span className="max-w-[7.5rem] truncate text-secondary">{activeViewLabel}</span>
        </Button>
      </div>

      {/* Mobile Column Navigation Tabs */}
      <Tabs
        className="mb-3 shrink-0 lg:hidden"
        value={activeTab}
        onChange={scrollToColumn}
        tabs={columns.map((c) => ({ value: c.id, label: c.label, count: c.items.length }))}
      />

      {/* Empty State Banner if 0 items across the board */}
      {kanbanItems.length === 0 && (
        <Alert
          tone="neutral"
          icon="filter_alt_off"
          title="Keine Elemente in dieser Ansicht"
          className="mb-3 shrink-0"
          action={(
            <>
              <Button size="sm" onClick={resetFilter}>Alle anzeigen</Button>
              <Button variant="ghost" size="sm" onClick={() => setIsFilterDrawerOpen(true)}>Filter öffnen</Button>
            </>
          )}
        >
          {isCustomFilter
            ? 'Mit der gewählten Kategorie-Kombination wurden keine aktiven Kanban-Elemente gefunden.'
            : `In der Ansicht „${currentView.name}“ wurden keine passenden Kategorien oder Elemente gefunden.`}
        </Alert>
      )}

      {/* Main Kanban Board Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-2 sm:gap-4 lg:snap-none"
      >
        {columns.map((col) => (
          <div
            key={col.id}
            id={`kanban-col-${col.id}`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className="flex min-w-[85vw] flex-1 snap-center flex-col rounded-lg border border-subtle bg-subtle p-3 transition-colors duration-fast sm:min-w-[320px] lg:min-w-0"
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} aria-hidden="true" />
              <h2 className="text-body-strong text-primary">{col.label}</h2>
              <Badge tone="neutral" size="sm" className="ml-auto">{col.items.length}</Badge>
            </div>
            <div
              className={`min-h-0 flex-1 overflow-y-auto rounded-md border border-dashed p-2 transition-colors duration-fast ${
                touchKanbanColTarget === col.id ? 'border-strong bg-hover ring-2 ring-focus' : 'border-transparent'
              }`}
            >
              {col.items.map(renderCard)}
              {col.items.length === 0 && (
                <div className="flex h-28 items-center justify-center text-caption text-tertiary lg:h-full">
                  {col.empty}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ansichten und Filter (Regel 01: Overlay über Sheet) */}
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
