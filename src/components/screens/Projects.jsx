import React, { useState, useRef } from 'react';
import { useBoardSort, LIFT_CLASS } from '../ui/useBoardSort';
import { groupByCategory, sortItems, PROJECT_SORT_OPTIONS } from '../../lib/itemOrder';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { useModalContext } from '../../context/ModalContext';
import { ProjectCardContent } from '../ui/ItemCardContent';
import CardContextMenu from '../ui/CardContextMenu';
import { ListToolbar, CategoryToolbar, ViewToggle, PROJECT_VIEW_OPTIONS } from '../ui/ListToolbar';
import SwipeableCard from '../ui/SwipeableCard';
import { Badge, Button, Card, Icon, IconButton, Input, SectionHeader } from '../ds';

const Projects = ({ setCurrentScreen }) => {
  const {
    projects,
    openModal,
    setSelectedProjectId,
    toggleProjectStatus,
    setProjectStatus,
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
  const [sortMode, setSortMode] = usePersistedChoice('focusflow_projects_sort', PROJECT_SORT_OPTIONS.map((o) => o.value), 'custom');
  const itemsByCategory = groupByCategory(otherProjects, projectCategories, { sortWithin: (list) => sortItems(list, sortMode) });
  // Erste manuelle Änderung in einer automatischen Sortierung: aktuelle Reihenfolge einfrieren und auf "Benutzerdefiniert" wechseln
  const switchToCustom = () => {
    if (sortMode === 'custom') return;
    Object.entries(itemsByCategory).forEach(([catId, list]) => {
      if (list.length) placeProjectInCategory(list[0].id, catId, list.map((i) => i.id));
    });
    setSortMode('custom');
  };
  const { drag, view, startCategoryDrag, startItemPress } = useBoardSort({
    rootRef: boardRef,
    categories: projectCategories,
    itemsByCategory,
    onReorderCategories: reorderProjectCategories,
    onMoveItem: (projectId, categoryId, orderedIds) => {
      switchToCustom();
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
      <SwipeableCard
        disabled={Boolean(drag)}
        className="h-full"
        right={{
          label: project.status === 'ABGESCHLOSSEN' ? 'Wieder öffnen' : 'Abschließen',
          icon: project.status === 'ABGESCHLOSSEN' ? 'undo' : 'check_circle',
          className: 'bg-success',
          onCommit: () => setProjectStatus(project.id, project.status === 'ABGESCHLOSSEN' ? 'AKTIV' : 'ABGESCHLOSSEN')
        }}
        left={{
          label: 'Papierkorb',
          icon: 'delete',
          className: 'bg-danger',
          dismiss: true,
          onCommit: () => deleteProject(project.id)
        }}
      >
      <Card
        interactive
        padding="sm"
        className={`flex flex-col h-full transition-all ${
          project.isPaused
            ? '!border-dashed !border-control !bg-subtle'
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
      </SwipeableCard>
    </div>
  );
};

  return (
    <div className="pb-20">
      <ListToolbar
      title="Projekte"
      description={`${projects.filter((x) => !x.deletedAt && x.status !== 'ABGESCHLOSSEN').length} aktiv`}
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
          <SectionHeader title="Angepinnt" count={pinnedProjects.length} className="mb-3" />
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          sortValue={sortMode}
          sortOptions={PROJECT_SORT_OPTIONS}
          onSortChange={(mode) => (mode === 'custom' ? switchToCustom() : setSortMode(mode))}
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
              className={`rounded-lg border scroll-mt-6 p-2 -m-1 transition-colors duration-150 ${
                isBeingDragged
                  ? `${LIFT_CLASS} z-10 border-transparent`
                  : isCardHoveringThisCat
                  ? 'border-strong bg-hover ring-2 ring-focus'
                  : 'border-transparent'
              } ${isDraggingItem && drag.catId === cat.id ? 'relative z-10' : ''}`}
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
                <div className={`flex items-center gap-1.5 shrink-0 transition-colors ${
                  isEditMode ? '' : 'hover:text-primary'
                }`}>
                  {/* Drag Handle – always visible in edit mode */}
                  <Icon name="drag_indicator" size="md" className={`hover:text-primary cursor-grab active:cursor-grabbing p-1 -m-1 transition-opacity touch-none select-none ${isEditMode ? 'opacity-100 text-primary' : 'hidden md:inline-block opacity-50 group-hover:opacity-100'}`} onMouseDown={(e) => startCategoryDrag(e, cat.id)} onTouchStart={(e) => startCategoryDrag(e, cat.id)} onClick={(e) => e.stopPropagation()} title="Halten & Ziehen zum Sortieren" />
                    {/* Chevron – grayed out and non-interactive in edit mode */}
                    <Icon name="chevron_right" size="md" className={`transition-all ${isEditMode
 ? 'opacity-25 text-secondary'
 : `${cat.isExpanded ? 'rotate-90' : ''}`}`} />

                    {editingCatId === cat.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          onBlur={() => saveEditCategory(cat.id)}
                          className="px-2 py-1 font-label text-eyebrow uppercase bg-subtle border border-strong rounded-md focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditCategory(cat.id);
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                        />
                        <IconButton icon="check" label="Speichern" variant="primary" size="sm" onMouseDown={(e) => {
                            e.preventDefault();
                            saveEditCategory(cat.id);
                          }} />
                        <IconButton
                          icon="close"
                          label="Abbrechen"
                          variant="secondary"
                          size="sm"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditingCatId(null);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-label text-eyebrow uppercase flex items-center gap-2">
                          {cat.name} <span className="text-secondary text-caption">({catProjects.length})</span>
                        </h2>
                        {isCardHoveringThisCat && (
                          <Badge tone="accent" size="sm" icon="arrow_downward" className="animate-pulse">Hier ablegen</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-muted flex-grow opacity-50 group-hover:bg-control transition-colors" />

                  {/* Action Buttons – always visible in edit mode, hover-only otherwise */}
                  <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                    isEditMode ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'
                  }`}>
                    {!isEditMode && (
                      <IconButton icon="add" label={`Neu in Kategorie ${cat.name}`} onClick={(e) => {
                          e.stopPropagation();
                          openModal('project', { categoryId: cat.id });
                        }} />
                    )}
                    <IconButton
                      icon="edit"
                      label="Kategorie umbenennen"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                      }}
                      className={isEditMode ? '' : 'hidden md:inline-flex'}
                    />

                    <IconButton
                      icon="keyboard_arrow_up"
                      label="Kategorie nach oben verschieben"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProjectCategoryOrder(cat.id, 'up');
                      }}
                      className={isEditMode ? '' : 'hidden md:inline-flex'}
                    />

                    <IconButton
                      icon="keyboard_arrow_down"
                      label="Kategorie nach unten verschieben"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveProjectCategoryOrder(cat.id, 'down');
                      }}
                      className={isEditMode ? '' : 'hidden md:inline-flex'}
                    />
                    {cat.id !== 'allgemein' && (
                      <IconButton
                        icon="close"
                        label="Kategorie löschen"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteProjectCategory(cat.id); }}
                        className={isEditMode ? 'hover:!bg-danger-subtle hover:!text-danger' : 'hidden hover:!bg-danger-subtle hover:!text-danger md:inline-flex'}
                      />
                    )}
                  </div>
                </div>

                {/* Content grid – hidden in edit mode regardless of isExpanded state */}
                {cat.isExpanded && drag?.kind !== 'cat' && !isEditMode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {catProjects.length > 0 ? (
                      catProjects.map((p) => renderCard(p))
                    ) : (
                      <div className={`col-span-full py-8 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
                        isCardHoveringThisCat
                          ? 'border-accent bg-selected text-primary'
                          : 'border-subtle text-secondary'
                      }`}>
                        <Icon name={isCardHoveringThisCat ? 'arrow_downward' : 'drag_indicator'} size="md" className="mr-2" />
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
            className="flex flex-wrap items-center gap-3"
            >
            <Input
              type="text"
              size="sm"
              placeholder="Name der Kategorie, z. B. Vibe Coding"
              aria-label="Name der neuen Kategorie"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="min-w-[14rem] flex-1"
              autoFocus
            />
            <Button type="submit" size="sm">Speichern</Button>
            <Button variant="secondary" size="sm" onClick={() => setIsAddingCategory(false)}>Abbrechen</Button>
            </form>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" leadingIcon="add" onClick={() => setIsAddingCategory(true)}>
              Kategorie hinzufügen
            </Button>
            <div className="h-px flex-grow bg-muted" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
