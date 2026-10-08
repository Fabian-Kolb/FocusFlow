import React, { useState, useEffect } from 'react';
import { useCategoryDrag } from '../ui/useCategoryDrag';
import { useCardTouchDrag } from '../ui/useCardTouchDrag';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import { ProjectCardContent } from '../ui/ItemCardContent';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import CardContextMenu from '../ui/CardContextMenu';
import { ListToolbar, CategoryToolbar, ViewToggle, PROJECT_VIEW_OPTIONS } from '../ui/ListToolbar';

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
    updateProjectCategory,
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
    startCardDrag: startProjectCardDrag,
    startCardTouchDrag: startProjectCardTouchDrag,
    handleHtml5DragStart: handleProjectHtml5DragStart,
    handleHtml5DragOver: handleProjectHtml5DragOver,
    handleHtml5DragEnd: handleProjectHtml5DragEnd
  } = useCardTouchDrag({
    onMoveItemToCategory: handleMoveProjectToCategory,
    categoryPrefix: 'cat-sec-',
    onHoverExpandCategory: (catId) => {
      const cat = projectCategories.find(c => c.id === catId);
      if (cat && !cat.isExpanded) {
        toggleProjectCategory(catId);
      }
    }
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

  const { draggedCatId, orderedCategories, startDrag } = useCategoryDrag({
    categories: projectCategories,
    reorderCategories: reorderProjectCategories,
    collapseAll: collapseAllProjectCategories,
    // In edit mode: stay collapsed after drag. Only "Bearbeiten beenden" restores states.
    onDragEnd: isEditMode ? collapseAllProjectCategories : restoreProjectCategoryExpandStates,
    sectionIdPrefix: 'cat-sec-',
  });

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
    e.stopPropagation();
    setCardDragOverCatId(null);
    handleProjectHtml5DragEnd();
    const projectId = e.dataTransfer.getData('text/plain') || touchDraggedProjectId;
    if (projectId) {
      handleMoveProjectToCategory(projectId, categoryId);
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

  const renderCard = (project) => {
    const isDragged = touchDraggedProjectId === project.id;
    return (
      <div
        key={project.id}
        data-card-id={project.id}
        onMouseDown={(e) => startProjectCardDrag(e, project.id, project.title)}
        onTouchStart={(e) => startProjectCardTouchDrag(e, project.id, project.title)}
        onDragStart={(e) => handleProjectHtml5DragStart(e, project.id)}
        onDragEnd={handleProjectHtml5DragEnd}
        onDragOver={(e) => handleCategoryDragOver(e, project.categoryId || 'allgemein')}
        onDrop={(e) => handleDrop(e, project.categoryId || 'allgemein')}
        className={`cursor-grab active:cursor-grabbing [-webkit-touch-callout:none] select-none transition-all duration-150 ${
          isDragged ? 'opacity-30 scale-[0.98] ring-2 ring-primary/40 rounded-xl' : 'opacity-100'
        }`}
      >
      <Card
        interactive
        padding="small"
        className={`flex flex-col h-full transition-all ${
          project.isPaused
            ? '!bg-blue-100 !border-blue-300 ring-1 ring-blue-300/40'
            : ''
        }`}
        onClick={() => handleProjectClick(project.id)}
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
};

  return (
    <div className="screen-transition pb-20">
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Projekte durchsuchen"
        onOpenTrash={() => setCurrentScreen('trash')}
        onCreate={() => openModal('project')}
        createLabel="Neues Projekt"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewToggle={
          <ViewToggle
            value="list"
            onChange={(v) => v === 'board' && setCurrentScreen('board')}
            options={PROJECT_VIEW_OPTIONS}
          />
        }
      />

      {pinnedProjects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">push_pin</span> Angepinnt
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {pinnedProjects.map(renderCard)}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-6">
        <CategoryToolbar
          count={projectCategories.length}
          isEditMode={isEditMode}
          onToggleEdit={toggleEditMode}
          anyExpanded={projectCategories.some((c) => c.isExpanded)}
          onCollapseAll={collapseAllProjectCategories}
          onExpandAll={expandAllProjectCategories}
        />

        {(orderedCategories || projectCategories)?.map((cat) => {
          const catProjects = otherProjects.filter(p => (p.categoryId || 'allgemein') === cat.id);
          if (cat.id === 'allgemein' && catProjects.length === 0 && projectCategories.length > 1 && !touchDraggedProjectId) {
            return null;
          }

          const isBeingDragged = draggedCatId === cat.id;
          const isCardHoveringThisCat = (cardDragOverCatId === cat.id || touchCardDropTargetCatId === cat.id) && !isBeingDragged;

          return (
            <div 
              key={cat.id}
              id={`cat-sec-${cat.id}`}
              data-category-id={cat.id}
              onDragOver={(e) => handleCategoryDragOver(e, cat.id)}
              onDragLeave={(e) => handleCategoryDragLeave(e, cat.id)}
              onDrop={(e) => handleDrop(e, cat.id)}
              className={`rounded-xl transition-all duration-150 border scroll-mt-6 ${
                isBeingDragged
                  ? 'opacity-0 pointer-events-none h-11 my-1 p-0 border-transparent overflow-hidden'
                  : isCardHoveringThisCat
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-lg p-2.5 -m-1'
                  : 'border-transparent p-2 -m-1'
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
                    onMouseDown={(e) => startDrag(e, cat.id, catProjects.length)}
                    onTouchStart={(e) => startDrag(e, cat.id, catProjects.length)}
                    onClick={(e) => e.stopPropagation()}
                    className={`material-symbols-outlined text-[18px] hover:text-primary cursor-grab active:cursor-grabbing p-1 -m-1 transition-opacity touch-none select-none ${
                      isEditMode ? 'opacity-100 text-primary' : 'hidden md:inline-block opacity-50 group-hover:opacity-100'
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
                          onBlur={() => saveEditCategory(cat.id)}
                          className="px-2 py-1 text-xs font-bold uppercase bg-surface-low border border-primary rounded-lg focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditCategory(cat.id);
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                        />
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveEditCategory(cat.id);
                          }}
                          className="p-1 bg-primary text-white rounded-lg hover:bg-primary/90"
                          title="Speichern"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditingCatId(null);
                          }}
                          className="p-1 bg-surface-low text-on-surface-variant rounded-lg hover:bg-surface-variant"
                          title="Abbrechen"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
                          {cat.name} <span className="text-on-surface-variant font-normal text-xs">({catProjects.length})</span>
                        </h2>
                        {isCardHoveringThisCat && (
                          <span className="text-[11px] font-bold text-primary bg-primary/15 border border-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                            Hier ablegen
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-outline-variant flex-grow opacity-50 group-hover:bg-primary/50 transition-colors" />
                  
                  {/* Action Buttons – always visible in edit mode, hover-only otherwise */}
                  <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                    isEditMode ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'
                  }`}>
                    {!isEditMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal('project', { categoryId: cat.id });
                        }}
                        className="p-2 md:p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors"
                        title="Neu in dieser Kategorie"
                        aria-label={`Neu in Kategorie ${cat.name}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                      }}
                      className={`p-2 md:p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors ${isEditMode ? '' : 'hidden md:inline-flex'}`}
                      title="Kategorie umbenennen"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProjectCategoryOrder(cat.id, 'up');
                      }}
                      className={`p-2 md:p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors ${isEditMode ? '' : 'hidden md:inline-flex'}`}
                      title="Kategorie nach oben verschieben"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProjectCategoryOrder(cat.id, 'down');
                      }}
                      className={`p-2 md:p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors ${isEditMode ? '' : 'hidden md:inline-flex'}`}
                      title="Kategorie nach unten verschieben"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                    </button>
                    {cat.id !== 'allgemein' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteProjectCategory(cat.id); }}
                        className={`p-2 md:p-1 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-1 ${isEditMode ? '' : 'hidden md:inline-flex'}`}
                        title="Kategorie löschen"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content grid – hidden in edit mode regardless of isExpanded state */}
                {cat.isExpanded && !draggedCatId && !isEditMode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {catProjects.length > 0 ? (
                      catProjects.map(renderCard)
                    ) : (
                      <div className={`col-span-full py-8 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors ${
                        isCardHoveringThisCat
                          ? 'border-primary bg-primary/15 text-primary font-bold shadow-inner'
                          : 'border-outline-variant text-on-surface-variant'
                      }`}>
                        <span className="material-symbols-outlined mr-2 text-[18px]">
                          {isCardHoveringThisCat ? 'arrow_downward' : 'drag_indicator'}
                        </span>
                        {isCardHoveringThisCat ? 'Hier loslassen' : 'Projekte hier ablegen'}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
