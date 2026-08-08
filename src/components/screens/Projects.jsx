import React, { useState, useEffect } from 'react';
import { useCategoryDrag } from '../ui/useCategoryDrag';
import { useCardTouchDrag } from '../ui/useCardTouchDrag';
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
    toggleProjectKanban,
    projectCategories,
    addProjectCategory,
    toggleProjectCategory,
    deleteProjectCategory,
    moveProjectToCategory,
    reorderProjectCategories,
    moveProjectCategoryOrder,
    collapseAllProjectCategories,
    expandAllProjectCategories,
    restoreProjectCategoryExpandStates,
  } = useModalContext();

  const handleMoveProjectToCategory = (projectId, categoryId) => {
    moveProjectToCategory(projectId, categoryId);
    const cat = projectCategories.find(c => c.id === categoryId);
    if (cat && !cat.isExpanded) {
      toggleProjectCategory(categoryId);
    }
  };

  const {
    draggedCardId: touchDraggedProjectId,
    cardDropTargetId: touchCardDropTargetCatId,
    startCardTouchDrag: startProjectCardDrag,
    handleHtml5DragStart: handleProjectHtml5DragStart,
    handleHtml5DragOver: handleProjectHtml5DragOver,
    handleHtml5DragEnd: handleProjectHtml5DragEnd
  } = useCardTouchDrag({
    onMoveItemToCategory: handleMoveProjectToCategory,
    categoryPrefix: 'cat-sec-'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  let activeProjects = projects.filter(p => !p.deletedAt);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    activeProjects = activeProjects.filter(p => 
      (p.title && p.title.toLowerCase().includes(q)) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.tags && p.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }

  if (statusFilter !== 'all') {
    activeProjects = activeProjects.filter(p => {
      if (statusFilter === 'paused') return p.isPaused;
      if (p.isPaused) return false;
      if (statusFilter === 'active') return p.status === 'AKTIV';
      if (statusFilter === 'planned') return p.status === 'GEPLANT';
      if (statusFilter === 'completed') return p.status === 'ABGESCHLOSSEN';
      return true;
    });
  }

  const pinnedProjects = activeProjects.filter(p => p.isPinned);
  const otherProjects = activeProjects.filter(p => !p.isPinned);

  const handleProjectClick = (projectId) => {
    setSelectedProjectId(projectId);
    setCurrentScreen('project-detail');
  };

  const FilterButton = ({ label, value }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
        statusFilter === value 
          ? 'bg-primary text-white' 
          : 'bg-surface-low text-on-surface-variant border border-outline-variant hover:border-primary hover:text-primary'
      }`}
    >
      {label}
    </button>
  );

  const getStatusStyle = (status) => {
    if (status === 'GEPLANT') {
      return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
    }
    if (status === 'ABGESCHLOSSEN') {
      return 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
  };

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [cardDragOverCatId, setCardDragOverCatId] = useState(null);

  // Edit-Mode: saves expand states, collapses all → easy sorting
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModeSavedStates, setEditModeSavedStates] = useState(null);

  const toggleEditMode = () => {
    if (!isEditMode) {
      const states = {};
      projectCategories.forEach(c => { states[c.id] = c.isExpanded; });
      setEditModeSavedStates(states);
      collapseAllProjectCategories();
      setIsEditMode(true);
    } else {
      if (editModeSavedStates) {
        restoreProjectCategoryExpandStates(editModeSavedStates);
      }
      setEditModeSavedStates(null);
      setIsEditMode(false);
    }
  };

  const { draggedCatId, dropTarget, startDrag } = useCategoryDrag({
    categories: projectCategories,
    reorderCategories: reorderProjectCategories,
    collapseAll: collapseAllProjectCategories,
    // In edit mode: stay collapsed after drag. Only "Bearbeiten beenden" restores states.
    onDragEnd: isEditMode ? collapseAllProjectCategories : restoreProjectCategoryExpandStates,
    sectionIdPrefix: 'cat-sec-',
  });

  // Visual drop indicator line
  const DropIndicator = () => (
    <div className="h-9 my-1 flex items-center gap-2 px-1 transition-all duration-150 animate-in fade-in zoom-in-95">
      <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/30 shrink-0" />
      <div className="flex-1 h-[2px] bg-primary rounded-full" />
      <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/30 shrink-0" />
    </div>
  );

  const handleCategoryDragOver = (e, categoryId) => {
    handleProjectHtml5DragOver(e, categoryId);
    if (!draggedCatId && cardDragOverCatId !== categoryId) {
      setCardDragOverCatId(categoryId);
    }
  };

  const handleCategoryDragLeave = (e, categoryId) => {
    if (cardDragOverCatId === categoryId && !e.currentTarget.contains(e.relatedTarget)) {
      setCardDragOverCatId(null);
    }
  };

  const handleDrop = (e, categoryId) => {
    e.preventDefault();
    setCardDragOverCatId(null);
    handleProjectHtml5DragEnd();
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId) {
      setTimeout(() => {
        handleMoveProjectToCategory(projectId, categoryId);
      }, 50);
    }
  };

  const saveEditCategory = (catId) => {
    if (editingCatName.trim()) {
      updateProjectCategory(catId, editingCatName.trim());
    }
    setEditingCatId(null);
  };

  const createCategory = async () => {
    if (newCategoryName.trim()) {
      await addProjectCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const renderCard = (project) => (
    <div
      key={project.id}
      draggable
      onDragStart={(e) => handleProjectHtml5DragStart(e, project.id)}
      onDragEnd={handleProjectHtml5DragEnd}
      onTouchStart={(e) => startProjectCardDrag(e, project.id, project.title)}
      className="cursor-grab active:cursor-grabbing touch-action-none"
    >
      <Card
        interactive
        className={`flex flex-col justify-between min-h-[250px] sm:min-h-[300px] transition-all h-full ${
          project.isPaused 
            ? '!bg-blue-100 !border-blue-300 ring-1 ring-blue-300/40' 
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
                {project.status === 'LAUFEND' ? 'AKTIV' : project.status === 'ABGESCHLOSSEN' ? 'ERLEDIGT' : project.status}
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

  return (
    <div className="screen-transition pb-20">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-grow max-w-md w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <Input
              type="text"
              className="pl-10 w-full"
              placeholder="Projekte durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              onClick={() => setCurrentScreen('trash')}
              className="flex items-center justify-center p-2 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
              title="Papierkorb öffnen"
            >
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </button>
            <Button onClick={() => openModal('project')}>
              Neues Projekt
            </Button>
          </div>
        </div>
        
        {/* Filter Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-wrap-scroll pb-2">
          <FilterButton label="Alle" value="all" />
          <FilterButton label="Aktiv" value="active" />
          <FilterButton label="Geplant" value="planned" />
          <FilterButton label="Pausiert" value="paused" />
          <FilterButton label="Abgeschlossen" value="completed" />
        </div>
      </div>

      {pinnedProjects.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">push_pin</span> Angepinnt
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {pinnedProjects.map(renderCard)}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Kategorien ({projectCategories.length})
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleEditMode}
              className={`text-[11px] font-bold transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer ${
                isEditMode
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary bg-surface-low border-outline-variant hover:border-primary/50'
              }`}
              title={isEditMode ? 'Bearbeiten beenden – Kategorien zurückklappen' : 'Kategorien bearbeiten – alle einklappen zum Sortieren'}
            >
              <span className="material-symbols-outlined text-[14px]">
                {isEditMode ? 'edit_off' : 'edit'}
              </span>
              {isEditMode ? 'Bearbeiten beenden' : 'Kategorien bearbeiten'}
            </button>
            <button
              onClick={collapseAllProjectCategories}
              disabled={isEditMode}
              className={`text-[11px] font-bold transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                isEditMode
                  ? 'opacity-30 cursor-not-allowed text-on-surface-variant bg-surface-low border-outline-variant'
                  : 'text-on-surface-variant hover:text-primary bg-surface-low border-outline-variant hover:border-primary/50 cursor-pointer'
              }`}
              title="Alle Kategorien einklappen"
            >
              <span className="material-symbols-outlined text-[14px]">unfold_less</span>
              Alle einklappen
            </button>
            <button
              onClick={expandAllProjectCategories}
              disabled={isEditMode}
              className={`text-[11px] font-bold transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                isEditMode
                  ? 'opacity-30 cursor-not-allowed text-on-surface-variant bg-surface-low border-outline-variant'
                  : 'text-on-surface-variant hover:text-primary bg-surface-low border-outline-variant hover:border-primary/50 cursor-pointer'
              }`}
              title={isEditMode ? 'Im Bearbeitungsmodus nicht verfügbar' : 'Alle Kategorien ausklappen'}
            >
              <span className="material-symbols-outlined text-[14px]">unfold_more</span>
              Alle ausklappen
            </button>
          </div>
        </div>

        {projectCategories && projectCategories.map((cat) => {
          const catProjects = otherProjects.filter(p => (p.categoryId || 'allgemein') === cat.id);
          if (cat.id === 'allgemein' && catProjects.length === 0 && projectCategories.length > 1) {
            return null;
          }

          const showIndicatorBefore = dropTarget?.targetCatId === cat.id && dropTarget?.position === 'before';
          const showIndicatorAfter  = dropTarget?.targetCatId === cat.id && dropTarget?.position === 'after';

          return (
            <React.Fragment key={cat.id}>
              {showIndicatorBefore && <DropIndicator />}

              <div 
                id={`cat-sec-${cat.id}`}
                onDragOver={(e) => handleCategoryDragOver(e, cat.id)}
                onDragLeave={(e) => handleCategoryDragLeave(e, cat.id)}
                onDrop={(e) => handleDrop(e, cat.id)}
                className={`rounded-xl transition-all duration-150 border p-2 -m-1 scroll-mt-6 ${
                  draggedCatId === cat.id
                    ? 'border-outline-variant/60 opacity-30 scale-[0.98]'
                    : (cardDragOverCatId === cat.id || touchCardDropTargetCatId === cat.id)
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-lg scale-[1.01]'
                    : 'border-transparent'
                }`}
              >
                {/* Steam-Like Header */}
                <div 
                  className={`flex items-center gap-3 mb-2 select-none py-1 group ${
                    isEditMode
                      ? 'cursor-default'
                      : 'cursor-pointer'
                  }`}
                  onClick={() => !isEditMode && toggleProjectCategory(cat.id)}
                >
                  <div className={`flex items-center gap-1.5 shrink-0 transition-colors text-on-surface ${
                    isEditMode ? '' : 'hover:text-primary'
                  }`}>
                    {/* Drag Handle – always visible in edit mode */}
                    <span 
                      onMouseDown={(e) => startDrag(e, cat.id)}
                      onTouchStart={(e) => startDrag(e, cat.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`material-symbols-outlined text-[18px] hover:text-primary cursor-grab active:cursor-grabbing p-1 -m-1 transition-opacity touch-none select-none ${
                        isEditMode ? 'opacity-100 text-primary' : 'opacity-50 group-hover:opacity-100'
                      }`}
                      title="Halten & Ziehen zum Sortieren"
                    >
                      drag_indicator
                    </span>
                    {/* Chevron – grayed out and non-interactive in edit mode */}
                    <span className={`material-symbols-outlined text-[20px] transition-all ${
                      isEditMode
                        ? 'opacity-25 text-on-surface-variant'
                        : `${cat.isExpanded ? 'rotate-90' : ''}`
                    }`}>
                      chevron_right
                    </span>
                    
                    {editingCatId === cat.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="px-2 py-1 text-xs font-bold uppercase bg-surface-low border border-primary rounded-lg focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveEditCategory(cat.id)}
                        />
                        <button
                          onClick={() => saveEditCategory(cat.id)}
                          className="p-1 bg-primary text-white rounded-lg hover:bg-primary/90"
                          title="Speichern"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                        <button
                          onClick={() => setEditingCatId(null)}
                          className="p-1 bg-surface-low text-on-surface-variant rounded-lg hover:bg-surface-variant"
                          title="Abbrechen"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <h2 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
                        {cat.name} <span className="text-on-surface-variant font-normal text-xs">({catProjects.length})</span>
                      </h2>
                    )}
                  </div>

                  <div className="h-px bg-outline-variant flex-grow opacity-50 group-hover:bg-primary/50 transition-colors" />
                  
                  {/* Action Buttons – always visible in edit mode, hover-only otherwise */}
                  <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                    isEditMode ? 'opacity-100' : 'opacity-90 sm:opacity-0 group-hover:opacity-100'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                      }}
                      className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors"
                      title="Kategorie umbenennen"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProjectCategoryOrder(cat.id, 'up');
                      }}
                      className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors"
                      title="Kategorie nach oben verschieben"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProjectCategoryOrder(cat.id, 'down');
                      }}
                      className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors"
                      title="Kategorie nach unten verschieben"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                    </button>
                    {cat.id !== 'allgemein' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteProjectCategory(cat.id); }}
                        className="p-1 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-1"
                        title="Kategorie löschen"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content grid – hidden in edit mode regardless of isExpanded state */}
                {cat.isExpanded && !draggedCatId && !isEditMode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {catProjects.length > 0 ? (
                      catProjects.map(renderCard)
                    ) : (
                      <div className="col-span-full py-8 border-2 border-dashed border-outline-variant rounded-xl flex items-center justify-center text-on-surface-variant">
                        Projekte hier ablegen
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showIndicatorAfter && <DropIndicator />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Subtle Steam-style Add Category Row at bottom */}
      <div className="mt-8">
        {isAddingCategory ? (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              createCategory();
            }} 
            className="flex items-center gap-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2 text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="font-bold text-sm tracking-wider uppercase">Neue Kategorie:</span>
            </div>
            <Input 
              type="text" 
              placeholder="Name eingeben (z. B. Vibe Coding)..." 
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-grow py-1 text-sm bg-surface-low border border-outline-variant rounded-xl"
              autoFocus
            />
            <Button type="submit" className="py-1.5 px-3 text-xs">Speichern</Button>
            <Button variant="secondary" type="button" onClick={() => setIsAddingCategory(false)} className="py-1.5 px-3 text-xs">Abbrechen</Button>
            <div className="h-px bg-outline-variant flex-grow opacity-50 hidden md:block" />
          </form>
        ) : (
          <div 
            onClick={() => setIsAddingCategory(true)}
            className="flex items-center gap-3 cursor-pointer group py-2"
          >
            <div className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">add</span>
              <h2 className="text-sm font-bold tracking-wider uppercase opacity-75 group-hover:opacity-100">
                Kategorie hinzufügen
              </h2>
            </div>
            <div className="h-px bg-outline-variant flex-grow opacity-40 group-hover:opacity-100 group-hover:bg-primary/50 transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
