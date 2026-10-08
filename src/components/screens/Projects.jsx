import React, { useState, useRef } from 'react';
import { useBoardSort, LIFT_CLASS } from '../ui/useBoardSort';
import { groupByCategory } from '../../lib/itemOrder';
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
    placeProjectInCategory,
    reorderProjectCategories,
    moveProjectCategoryOrder,
    collapseAllProjectCategories,
    expandAllProjectCategories,
    restoreProjectCategoryExpandStates,
  } = useModalContext();

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

  // Kategorien und Karten per Drag & Drop (gleiche Mechanik wie im Fio-Entwurfs-Editor)
  const boardRef = useRef(null);
  const itemsByCategory = groupByCategory(otherProjects, projectCategories);
  const { drag, view, startCategoryDrag, startItemPress } = useBoardSort({
    rootRef: boardRef,
    categories: projectCategories,
    itemsByCategory,
    onReorderCategories: reorderProjectCategories,
    onMoveItem: (projectId, categoryId, orderedIds) => {
      placeProjectInCategory(projectId, categoryId, orderedIds);
      const cat = projectCategories.find((c) => c.id === categoryId);
      if (cat && !cat.isExpanded) toggleProjectCategory(categoryId);
    },
    onCategoryDragStart: collapseAllProjectCategories,
    // Im Bearbeiten-Modus bleiben die Kategorien eingeklappt, sonst Zustand wiederherstellen
    onCategoryDragEnd: (saved) => (isEditMode ? collapseAllProjectCategories() : restoreProjectCategoryExpandStates(saved)),
    onExpandCategory: (catId) => {
      const cat = projectCategories.find((c) => c.id === catId);
      if (cat && !cat.isExpanded) toggleProjectCategory(catId);
    },
  });

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

  // sortable = Karte lässt sich ziehen (nur in Kategorien; angepinnte Karten stehen fest)
  const renderCard = (project, sortable = true) => {
    const isDragged = drag?.kind === 'item' && drag.id === project.id;
    return (
      <div
        key={project.id}
        {...(sortable ? {
          'data-card-id': project.id,
          onMouseDown: (e) => startItemPress(e, project.id),
          onTouchStart: (e) => startItemPress(e, project.id),
          onDragStart: (e) => e.preventDefault(),
        } : {})}
        className={`${sortable ? 'cursor-grab [-webkit-touch-callout:none] select-none' : ''} ${isDragged ? LIFT_CLASS : ''}`}
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
            {pinnedProjects.map((p) => renderCard(p, false))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div ref={boardRef} className="space-y-6">
        <CategoryToolbar
          count={projectCategories.length}
          isEditMode={isEditMode}
          onToggleEdit={toggleEditMode}
          anyExpanded={projectCategories.some((c) => c.isExpanded)}
          onCollapseAll={collapseAllProjectCategories}
          onExpandAll={expandAllProjectCategories}
        />

        {view.categories.map((cat) => {
          const catProjects = view.itemsByCategory[cat.id] || [];
          if (cat.id === 'allgemein' && catProjects.length === 0 && projectCategories.length > 1 && !drag) {
            return null;
          }

          const isBeingDragged = drag?.kind === 'cat' && drag.id === cat.id;
          const isDraggingItem = drag?.kind === 'item';
          // Karte schwebt über dieser Kategorie (und stammt nicht aus ihr): Ablage-Hinweis
          const isCardHoveringThisCat = isDraggingItem && drag.catId === cat.id && drag.originCatId !== cat.id;

          return (
            <div 
              key={cat.id}
              id={`cat-sec-${cat.id}`}
              data-category-id={cat.id}
              data-cat-section={cat.id}
              className={`rounded-xl border scroll-mt-6 p-2 -m-1 transition-colors duration-150 ${
                isBeingDragged
                  ? `${LIFT_CLASS} z-30 border-transparent`
                  : isCardHoveringThisCat
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                  : 'border-transparent'
              } ${isDraggingItem && drag.catId === cat.id ? 'relative z-30' : ''}`}
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
                    onMouseDown={(e) => startCategoryDrag(e, cat.id)}
                    onTouchStart={(e) => startCategoryDrag(e, cat.id)}
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
                {cat.isExpanded && drag?.kind !== 'cat' && !isEditMode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {catProjects.length > 0 ? (
                      catProjects.map((p) => renderCard(p))
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
