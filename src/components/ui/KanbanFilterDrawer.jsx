import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

const AVAILABLE_ICONS = [
  { id: 'view_kanban', label: 'Kanban' },
  { id: 'star', label: 'Stern' },
  { id: 'work', label: 'Arbeit' },
  { id: 'code', label: 'Code' },
  { id: 'laptop', label: 'Tech' },
  { id: 'rocket_launch', label: 'Projekt' },
  { id: 'lightbulb', label: 'Ideen' },
  { id: 'home', label: 'Privat' },
  { id: 'fitness_center', label: 'Sport' },
  { id: 'favorite', label: 'Herz' },
];

const AVAILABLE_COLORS = [
  { id: 'primary', bg: 'bg-primary', border: 'border-primary', text: 'text-primary', label: 'FocusFlow Blau' },
  { id: 'emerald', bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-600', label: 'Smaragd' },
  { id: 'amber', bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-600', label: 'Bernstein' },
  { id: 'purple', bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-600', label: 'Violett' },
  { id: 'rose', bg: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-600', label: 'Rose' },
  { id: 'indigo', bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-600', label: 'Indigo' },
];

const KanbanFilterDrawer = ({
  isOpen,
  onClose,
  kanbanViews = [],
  activeKanbanViewId = 'system_all',
  onSelectView,
  activeCategoryFilter = null,
  onSelectCategoryFilter,
  projectCategories = [],
  reminderCategories = [],
  onAddView,
  onUpdateView,
  onDeleteView
}) => {
  const drawerPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  // Drawer Modes: 'list' | 'form'
  const [mode, setMode] = useState('list');
  const [editingView, setEditingView] = useState(null);

  // Form State for creating / editing
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('star');
  const [formColor, setFormColor] = useState('primary');
  const [formShowProjects, setFormShowProjects] = useState(true);
  const [formShowReminders, setFormShowReminders] = useState(false);
  const [formProjectCategoryIds, setFormProjectCategoryIds] = useState([]);
  const [formReminderCategoryIds, setFormReminderCategoryIds] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Handle open / close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setDeleteConfirmId(null);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setMode('list');
        setEditingView(null);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Swipe-to-Close gesture exclusively on the mobile drawer panel
  const { translateY, isDragging, wasSwipedClosed } = useSwipeToClose({
    isOpen: shouldRender && !isClosing,
    onClose: () => handleClose(),
    drawerRef: drawerPanelRef,
    scrollContainerRef: scrollContainerRef,
    threshold: 120
  });

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && shouldRender) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender]);

  const handleClose = () => {
    if (onClose) onClose();
  };

  // Open Edit Mode
  const handleOpenEdit = (view, e) => {
    e.stopPropagation();
    setEditingView(view);
    setFormName(view.name || '');
    setFormIcon(view.icon || 'star');
    setFormColor(view.color || 'primary');
    setFormShowProjects(view.showProjects ?? true);
    setFormShowReminders(view.showReminders ?? true);
    setFormProjectCategoryIds(
      view.projectCategoryIds === 'all'
        ? projectCategories.map(c => c.id)
        : (Array.isArray(view.projectCategoryIds) ? view.projectCategoryIds : [])
    );
    setFormReminderCategoryIds(
      view.reminderCategoryIds === 'all'
        ? reminderCategories.map(c => c.id)
        : (Array.isArray(view.reminderCategoryIds) ? view.reminderCategoryIds : [])
    );
    setMode('form');
  };

  // Open Create Mode
  const handleOpenCreate = () => {
    setEditingView(null);
    setFormName('');
    setFormIcon('star');
    setFormColor('primary');
    setFormShowProjects(true);
    setFormShowReminders(false);
    // Pre-select all project categories by default for high UX comfort
    setFormProjectCategoryIds(projectCategories.map(c => c.id));
    setFormReminderCategoryIds([]);
    setMode('form');
  };

  // Save Form
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const payload = {
      name: formName.trim(),
      icon: formIcon,
      color: formColor,
      showProjects: formShowProjects,
      showReminders: formShowReminders,
      projectCategoryIds: formShowProjects ? formProjectCategoryIds : [],
      reminderCategoryIds: formShowReminders ? formReminderCategoryIds : [],
    };

    if (editingView) {
      if (onUpdateView) {
        await onUpdateView(editingView.id, payload);
      }
    } else {
      if (onAddView) {
        const newId = await onAddView(payload);
        if (onSelectView && newId) {
          onSelectView(newId);
        }
      }
    }

    setMode('list');
    setEditingView(null);
  };

  // Toggle helpers for categories in form
  const toggleProjectCategorySelection = (catId) => {
    setFormProjectCategoryIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const toggleReminderCategorySelection = (catId) => {
    setFormReminderCategoryIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const selectAllProjectCategories = () => {
    setFormProjectCategoryIds(projectCategories.map(c => c.id));
  };

  const deselectAllProjectCategories = () => {
    setFormProjectCategoryIds([]);
  };

  const selectAllReminderCategories = () => {
    setFormReminderCategoryIds(reminderCategories.map(c => c.id));
  };

  const deselectAllReminderCategories = () => {
    setFormReminderCategoryIds([]);
  };

  // System vs Custom Views
  const systemViews = kanbanViews.filter(v => v.isSystem || v.type === 'system');
  const customViews = kanbanViews.filter(v => !v.isSystem && v.type === 'custom');

  const drawerStyle = translateY > 0 ? {
    transform: `translateY(${translateY}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
  } : undefined;

  if (!shouldRender && !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerPanelRef}
        style={drawerStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Kanban-Ansichten und Filter"
        className={`fixed z-50 flex flex-col bg-surface border border-outline-variant shadow-2xl overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-3xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:mr-3 sm:rounded-2xl
          ${isClosing ? (wasSwipedClosed ? '' : 'drawer-slide-out') : 'drawer-slide-in'}
        `}
      >
        {/* Mobile Swipe Handle Notch */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant shrink-0 bg-surface">
          {mode === 'form' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Zurück zur Liste"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <h2 className="font-bold text-base text-on-surface">
                {editingView ? 'Ansicht bearbeiten' : 'Neue Ansicht'}
              </h2>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">dashboard_customize</span>
              </div>
              <div>
                <h2 className="font-bold text-base text-on-surface leading-tight">Ansichten & Filter</h2>
                <p className="text-[11px] text-on-surface-variant font-mono">Kanban-Board steuern</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Schließen"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Drawer Body Scroll Container */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 text-on-surface min-h-0 no-scrollbar"
        >
          {mode === 'list' ? (
            <>
              {/* SECTION 1: System Presets */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-amber-500">bolt</span>
                    Standard-Ansichten
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {systemViews.map((view) => {
                    const isCurrent = activeCategoryFilter === null && activeKanbanViewId === view.id;
                    return (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => {
                          if (onSelectCategoryFilter) onSelectCategoryFilter(null);
                          if (onSelectView) onSelectView(view.id);
                          handleClose();
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40 font-semibold'
                            : 'bg-surface-low border-outline-variant hover:border-outline hover:bg-surface-variant/40 text-on-surface'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`material-symbols-outlined text-[20px] shrink-0 ${isCurrent ? 'text-primary' : 'text-on-surface-variant'}`}>
                            {view.icon || 'view_kanban'}
                          </span>
                          <div className="truncate">
                            <div className="text-sm leading-tight truncate">{view.name}</div>
                            <div className="text-[10px] text-on-surface-variant font-mono truncate">
                              {view.id === 'system_all' && 'Alle Projekte & Erinnerungen'}
                              {view.id === 'system_projects' && 'Ausschließlich Projekte'}
                              {view.id === 'system_reminders' && 'Ausschließlich Erinnerungen'}
                            </div>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 ml-2">
                            check_circle
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: Filter by single category (1-click) */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">category</span>
                    Nach Kategorie filtern
                  </span>
                  {activeCategoryFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectCategoryFilter) onSelectCategoryFilter(null);
                      }}
                      className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      Filter zurücksetzen
                    </button>
                  )}
                </div>

                {/* Project Categories */}
                <div className="mb-3">
                  <span className="block text-[11px] text-on-surface-variant font-medium mb-1.5 px-1">
                    Projekt-Kategorien
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {projectCategories.map((cat) => {
                      const isActive = activeCategoryFilter?.type === 'project' && activeCategoryFilter?.id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              if (onSelectCategoryFilter) onSelectCategoryFilter(null);
                            } else {
                              if (onSelectCategoryFilter) {
                                onSelectCategoryFilter({ type: 'project', id: cat.id, name: cat.name });
                              }
                              handleClose();
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                            isActive
                              ? 'bg-primary text-white border-primary shadow-xs font-semibold'
                              : 'bg-surface-low border-outline-variant text-on-surface hover:border-primary/50 hover:bg-primary/5'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">folder</span>
                          <span className="truncate max-w-[140px]">{cat.name}</span>
                          {isActive && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reminder Categories */}
                {reminderCategories.length > 0 && (
                  <div>
                    <span className="block text-[11px] text-on-surface-variant font-medium mb-1.5 px-1">
                      Erinnerungs-Kategorien
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {reminderCategories.map((cat) => {
                        const isActive = activeCategoryFilter?.type === 'reminder' && activeCategoryFilter?.id === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                if (onSelectCategoryFilter) onSelectCategoryFilter(null);
                              } else {
                                if (onSelectCategoryFilter) {
                                  onSelectCategoryFilter({ type: 'reminder', id: cat.id, name: cat.name });
                                }
                                handleClose();
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                              isActive
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-semibold'
                                : 'bg-surface-low border-outline-variant text-on-surface hover:border-amber-500/50 hover:bg-amber-500/5'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">notifications</span>
                            <span className="truncate max-w-[140px]">{cat.name}</span>
                            {isActive && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Custom Saved Views */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">bookmark</span>
                    Eigene Ansichten ({customViews.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    Neu
                  </button>
                </div>

                <div className="space-y-2">
                  {customViews.map((view) => {
                    const isCurrent = activeCategoryFilter === null && activeKanbanViewId === view.id;
                    const isDeleting = deleteConfirmId === view.id;

                    const pCount = Array.isArray(view.projectCategoryIds) ? view.projectCategoryIds.length : 0;
                    const rCount = Array.isArray(view.reminderCategoryIds) ? view.reminderCategoryIds.length : 0;

                    let summaryText = [];
                    if (view.showProjects) summaryText.push(`${pCount} Projekt-Kat.`);
                    if (view.showReminders) summaryText.push(`${rCount} Erinnerungs-Kat.`);
                    if (!view.showReminders) summaryText.push('Ohne Erinnerungen');
                    if (!view.showProjects) summaryText.push('Nur Erinnerungen');

                    return (
                      <div
                        key={view.id}
                        onClick={() => {
                          if (onSelectCategoryFilter) onSelectCategoryFilter(null);
                          if (onSelectView) onSelectView(view.id);
                          handleClose();
                        }}
                        className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-surface-low border-outline-variant hover:border-outline hover:bg-surface-variant/40 text-on-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isCurrent ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant'
                            }`}>
                              <span className="material-symbols-outlined text-[18px]">
                                {view.icon || 'star'}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-sm leading-tight truncate text-on-surface">
                                {view.name}
                              </h3>
                              <p className="text-[11px] text-on-surface-variant font-mono mt-0.5 truncate">
                                {summaryText.join(' • ')}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isDeleting ? (
                              <div className="flex items-center gap-1 bg-surface border border-red-300 p-1 rounded-lg shadow-sm">
                                <span className="text-[10px] text-red-600 font-bold px-1">Löschen?</span>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (onDeleteView) await onDeleteView(view.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="w-6 h-6 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                                  title="Bestätigen"
                                >
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(null);
                                  }}
                                  className="w-6 h-6 rounded bg-surface-variant text-on-surface flex items-center justify-center hover:bg-outline-variant transition-colors"
                                  title="Abbrechen"
                                >
                                  <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEdit(view, e)}
                                  className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-variant flex items-center justify-center transition-colors"
                                  title="Bearbeiten"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(view.id);
                                  }}
                                  className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                  title="Löschen"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </>
                            )}

                            {isCurrent && !isDeleting && (
                              <span className="material-symbols-outlined text-[18px] text-primary ml-1 shrink-0">
                                check_circle
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {customViews.length === 0 && (
                    <div className="p-4 border border-dashed border-outline-variant rounded-xl text-center bg-surface-low/50">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50 mb-1">
                        tune
                      </span>
                      <p className="text-xs text-on-surface-variant">
                        Noch keine eigenen Ansichten vorhanden.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="mt-2 text-xs text-primary font-bold hover:underline cursor-pointer"
                      >
                        Jetzt erste Ansicht anlegen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* MODE 2: FORM (CREATE / EDIT) */
            <form onSubmit={handleSaveForm} className="space-y-5">
              {/* View Name */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Name der Ansicht *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z. B. Deep Work Sprint, Privat, Finanzen..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-low text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Symbol
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_ICONS.map((iconItem) => (
                    <button
                      key={iconItem.id}
                      type="button"
                      onClick={() => setFormIcon(iconItem.id)}
                      className={`h-10 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        formIcon === iconItem.id
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40 font-bold'
                          : 'border-outline-variant bg-surface-low text-on-surface-variant hover:border-outline hover:bg-surface-variant'
                      }`}
                      title={iconItem.label}
                    >
                      <span className="material-symbols-outlined text-[20px]">{iconItem.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Akzentfarbe
                </label>
                <div className="flex items-center gap-2.5">
                  {AVAILABLE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all flex items-center justify-center cursor-pointer ${
                        formColor === c.id ? 'ring-2 ring-offset-2 ring-primary scale-110 shadow-sm' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={c.label}
                    >
                      {formColor === c.id && (
                        <span className="material-symbols-outlined text-white text-[14px]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-outline-variant pt-4 space-y-4">
                {/* Projects Switch & Categories */}
                <div className="p-3 bg-surface-low border border-outline-variant rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formShowProjects}
                        onChange={(e) => setFormShowProjects(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                      />
                      <span className="font-bold text-sm text-on-surface">Projekte einbeziehen</span>
                    </label>

                    {formShowProjects && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={selectAllProjectCategories}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          Alle
                        </button>
                        <span className="text-on-surface-variant">/</span>
                        <button
                          type="button"
                          onClick={deselectAllProjectCategories}
                          className="text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer"
                        >
                          Keine
                        </button>
                      </div>
                    )}
                  </div>

                  {formShowProjects && (
                    <div className="pl-6 space-y-1.5 pt-1 border-t border-outline-variant/60">
                      <span className="block text-[11px] text-on-surface-variant font-medium">
                        Wähle die Projekt-Kategorien:
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar pr-1">
                        {projectCategories.map((cat) => {
                          const isChecked = formProjectCategoryIds.includes(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-variant/40 cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleProjectCategorySelection(cat.id)}
                                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
                              />
                              <span className="truncate">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reminders Switch & Categories */}
                <div className="p-3 bg-surface-low border border-outline-variant rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formShowReminders}
                        onChange={(e) => setFormShowReminders(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                      />
                      <span className="font-bold text-sm text-on-surface">Erinnerungen einbeziehen</span>
                    </label>

                    {formShowReminders && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={selectAllReminderCategories}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          Alle
                        </button>
                        <span className="text-on-surface-variant">/</span>
                        <button
                          type="button"
                          onClick={deselectAllReminderCategories}
                          className="text-on-surface-variant hover:text-on-surface hover:underline cursor-pointer"
                        >
                          Keine
                        </button>
                      </div>
                    )}
                  </div>

                  {formShowReminders && (
                    <div className="pl-6 space-y-1.5 pt-1 border-t border-outline-variant/60">
                      <span className="block text-[11px] text-on-surface-variant font-medium">
                        Wähle die Erinnerungs-Kategorien:
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar pr-1">
                        {reminderCategories.map((cat) => {
                          const isChecked = formReminderCategoryIds.includes(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-variant/40 cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleReminderCategorySelection(cat.id)}
                                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
                              />
                              <span className="truncate">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Notice if no categories selected */}
              {((formShowProjects && formProjectCategoryIds.length === 0 && !formShowReminders) ||
                (formShowReminders && formReminderCategoryIds.length === 0 && !formShowProjects) ||
                (!formShowProjects && !formShowReminders) ||
                (formShowProjects && formProjectCategoryIds.length === 0 && formShowReminders && formReminderCategoryIds.length === 0)) && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 flex items-start gap-2 text-xs">
                  <span className="material-symbols-outlined text-[16px] shrink-0 text-amber-600 mt-0.5">info</span>
                  <span>Hinweis: Ohne ausgewählte Kategorien wird das Board in dieser Ansicht leer sein.</span>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!formName.trim()}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingView ? 'Änderungen speichern' : 'Ansicht anlegen'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="py-2.5 px-4 border border-outline-variant rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default KanbanFilterDrawer;
