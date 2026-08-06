import React, { useState, useEffect } from 'react';
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
    expandAllProjectCategories
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
  const [draggedCatId, setDraggedCatId] = useState(null);
  const [savedExpandStates, setSavedExpandStates] = useState(null);

  const handleCategoryPointerDown = (e, catId) => {
    e.stopPropagation();
    const states = {};
    projectCategories.forEach(c => {
      states[c.id] = c.isExpanded;
    });
    setSavedExpandStates(states);
    setDraggedCatId(catId);
    collapseAllProjectCategories();
  };

  const handleCategoryPointerEnter = (targetCatId) => {
    if (draggedCatId && draggedCatId !== targetCatId) {
      const fromIndex = projectCategories.findIndex(c => c.id === draggedCatId);
      const toIndex = projectCategories.findIndex(c => c.id === targetCatId);
      if (fromIndex !== -1 && toIndex !== -1) {
        const newCats = [...projectCategories];
        const [moved] = newCats.splice(fromIndex, 1);
        newCats.splice(toIndex, 0, moved);
        reorderProjectCategories(newCats);
      }
    }
  };

  const handleCategoryPointerUp = () => {
    if (draggedCatId) {
      const restoredStates = savedExpandStates;
      setDraggedCatId(null);
      setSavedExpandStates(null);

      if (restoredStates) {
        setProjectCategories(prev => prev.map(c => ({
          ...c,
          isExpanded: restoredStates[c.id] !== undefined ? restoredStates[c.id] : c.isExpanded
        })));
      }
    }
  };

  useEffect(() => {
    if (draggedCatId) {
      const onUp = () => handleCategoryPointerUp();
      window.addEventListener('pointerup', onUp);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
      return () => {
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchend', onUp);
      };
    }
  }, [draggedCatId, savedExpandStates, projectCategories]);

  const handleDragStart = (e, projectId) => {
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, categoryId) => {
    e.preventDefault();
    setDraggedCatId(null);
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId) {
      moveProjectToCategory(projectId, categoryId);
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
      onDragStart={(e) => handleDragStart(e, project.id)}
      className="cursor-grab active:cursor-grabbing"
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
          <div className="flex items-center gap-2">
            <button
              onClick={collapseAllProjectCategories}
              className="text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant hover:border-primary/50 cursor-pointer"
              title="Alle Kategorien einklappen um einfacher zu sortieren"
            >
              <span className="material-symbols-outlined text-[14px]">unfold_less</span>
              Alle einklappen
            </button>
            <button
              onClick={expandAllProjectCategories}
              className="text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant hover:border-primary/50 cursor-pointer"
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

          return (
            <div 
              key={cat.id} 
              id={`cat-sec-${cat.id}`}
              onPointerEnter={() => handleCategoryPointerEnter(cat.id)}
              onMouseEnter={() => handleCategoryPointerEnter(cat.id)}
              onDragOver={(e) => {
                e.preventDefault();
                handleCategoryPointerEnter(cat.id);
              }}
              onDrop={(e) => handleDrop(e, cat.id)}
              className={`rounded-xl transition-all duration-150 border p-2 -m-1 scroll-mt-6 ${
                draggedCatId === cat.id 
                  ? 'border-primary ring-2 ring-primary/40 bg-surface shadow-xl scale-[1.01] z-30' 
                  : 'border-transparent'
              }`}
            >
              {/* Steam-Like Header */}
              <div 
                className="flex items-center gap-3 cursor-pointer group mb-2 select-none py-1"
                onClick={() => toggleProjectCategory(cat.id)}
              >
                <div className="flex items-center gap-1.5 text-on-surface hover:text-primary transition-colors shrink-0">
                  {/* Drag Handle Isolated */}
                  <span 
                    onPointerDown={(e) => handleCategoryPointerDown(e, cat.id)}
                    onMouseDown={(e) => handleCategoryPointerDown(e, cat.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="material-symbols-outlined text-[18px] opacity-50 group-hover:opacity-100 hover:text-primary cursor-grab active:cursor-grabbing p-1 -m-1 transition-opacity touch-none select-none" 
                    title="Halten & Ziehen zum Sortieren"
                  >
                    drag_indicator
                  </span>
                  <span className={`material-symbols-outlined text-[20px] transition-transform ${cat.isExpanded ? 'rotate-90' : ''}`}>
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
                
                {/* Mobile / Quick Action Buttons (Edit, Up, Down, Delete) */}
                <div className="flex items-center gap-0.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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

              {/* Grid */}
              {cat.isExpanded && !draggedCatId && (
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
