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
  selectedProjectCategoryIds = 'all',
  selectedReminderCategoryIds = 'all',
  onApplyFilter,
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

  // Staged multi-select selections (UND-Verknüpfung)
  const [stagedProjectCategoryIds, setStagedProjectCategoryIds] = useState([]);
  const [stagedReminderCategoryIds, setStagedReminderCategoryIds] = useState([]);
  const [stagedViewId, setStagedViewId] = useState(activeKanbanViewId);

  // Expandable accordions for categories (default collapsed in side & bottom drawer)
  const [isProjectCategoriesOpen, setIsProjectCategoriesOpen] = useState(false);
  const [isReminderCategoriesOpen, setIsReminderCategoriesOpen] = useState(false);

  // Form State for creating / editing
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('star');
  const [formColor, setFormColor] = useState('primary');
  const [formShowProjects, setFormShowProjects] = useState(true);
  const [formShowReminders, setFormShowReminders] = useState(false);
  const [formProjectCategoryIds, setFormProjectCategoryIds] = useState([]);
  const [formReminderCategoryIds, setFormReminderCategoryIds] = useState([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [highlightedViewId, setHighlightedViewId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  // Helper to cancel any ongoing highlight animation immediately
  const cancelHighlight = () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedViewId(null);
  };

  // Synchronize staged selection when drawer opens
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setDeleteConfirmId(null);
      cancelHighlight();
      setStagedViewId(activeKanbanViewId);
      setIsProjectCategoriesOpen(false);
      setIsReminderCategoriesOpen(false);

      const pIds = selectedProjectCategoryIds === 'all' 
        ? projectCategories.map(c => c.id) 
        : (Array.isArray(selectedProjectCategoryIds) ? selectedProjectCategoryIds : []);
      const rIds = selectedReminderCategoryIds === 'all' 
        ? reminderCategories.map(c => c.id) 
        : (Array.isArray(selectedReminderCategoryIds) ? selectedReminderCategoryIds : []);

      setStagedProjectCategoryIds(pIds);
      setStagedReminderCategoryIds(rIds);
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
  }, [isOpen, activeKanbanViewId, selectedProjectCategoryIds, selectedReminderCategoryIds, projectCategories, reminderCategories]);

  // Swipe-to-Close gesture exclusively on the mobile drawer panel (acts as cancel/close)
  const { translateY, isDragging, wasSwipedClosed } = useSwipeToClose({
    isOpen: shouldRender && !isClosing,
    onClose: () => handleClose(),
    drawerRef: drawerPanelRef,
    scrollContainerRef: scrollContainerRef,
    threshold: 120
  });

  // Close with Escape key (acts as cancel)
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
    cancelHighlight();
    if (onClose) onClose();
  };

  // Commit staged selection and close drawer
  const handleApply = () => {
    cancelHighlight();
    if (onApplyFilter) {
      onApplyFilter({
        projectCategoryIds: stagedProjectCategoryIds,
        reminderCategoryIds: stagedReminderCategoryIds,
        viewId: stagedViewId
      });
    }
    handleClose();
  };

  // Helper: check if a view matches given project and reminder category IDs
  const doesViewMatchCategories = (view, projIds, remIds) => {
    // 1. Projects check:
    const vProj = view.showProjects === false ? [] : (
      view.projectCategoryIds === 'all' 
        ? projectCategories.map(c => c.id) 
        : (Array.isArray(view.projectCategoryIds) ? view.projectCategoryIds : [])
    );
    const projSorted = [...projIds].sort();
    const vProjSorted = [...vProj].sort();
    if (projSorted.length !== vProjSorted.length) return false;
    for (let i = 0; i < projSorted.length; i++) {
      if (projSorted[i] !== vProjSorted[i]) return false;
    }

    // 2. Reminders check:
    const vRem = view.showReminders === false ? [] : (
      view.reminderCategoryIds === 'all' 
        ? reminderCategories.map(c => c.id) 
        : (Array.isArray(view.reminderCategoryIds) ? view.reminderCategoryIds : [])
    );
    const remSorted = [...remIds].sort();
    const vRemSorted = [...vRem].sort();
    if (remSorted.length !== vRemSorted.length) return false;
    for (let i = 0; i < remSorted.length; i++) {
      if (remSorted[i] !== vRemSorted[i]) return false;
    }

    return true;
  };

  const findMatchingView = (projIds, remIds) => {
    if (projIds.length === 0 && remIds.length === 0) return null;
    return kanbanViews.find(v => doesViewMatchCategories(v, projIds, remIds)) || null;
  };

  const triggerHighlight = (viewId) => {
    cancelHighlight();
    setHighlightedViewId(viewId);
    setTimeout(() => {
      const el = document.getElementById(`custom-view-${viewId}`) || document.getElementById(`preset-view-${viewId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedViewId(null);
    }, 2800);
  };

  // Active status check for system presets (Haken-Zustand steuert Buttons)
  const allProjectsSelected = projectCategories.length > 0 && stagedProjectCategoryIds.length === projectCategories.length;
  const noProjectsSelected = stagedProjectCategoryIds.length === 0;
  const allRemindersSelected = reminderCategories.length > 0 && stagedReminderCategoryIds.length === reminderCategories.length;
  const noRemindersSelected = stagedReminderCategoryIds.length === 0;

  const isAllPresetActive = (allProjectsSelected && allRemindersSelected) ||
    (projectCategories.length > 0 && reminderCategories.length === 0 && allProjectsSelected && stagedViewId === 'system_all');
  const isProjectsOnlyPresetActive = allProjectsSelected && noRemindersSelected;
  const isRemindersOnlyPresetActive = allRemindersSelected && noProjectsSelected;

  // Matching view against current staged categories
  const currentMatchingView = findMatchingView(stagedProjectCategoryIds, stagedReminderCategoryIds);

  // Dynamic check: Has the user selected an individual/custom mix of categories that does not exist yet?
  const isCustomSelection = !currentMatchingView &&
    (stagedProjectCategoryIds.length > 0 || stagedReminderCategoryIds.length > 0);

  // Centralized updater for staged categories with automatic view matching and scroll-to-highlight
  const updateStagedCategories = (nextP, nextR, shouldScroll = true) => {
    setStagedProjectCategoryIds(nextP);
    setStagedReminderCategoryIds(nextR);
    const match = findMatchingView(nextP, nextR);
    if (match) {
      setStagedViewId(match.id);
      if (shouldScroll) {
        triggerHighlight(match.id);
      }
    } else {
      setStagedViewId(null);
      cancelHighlight();
    }
  };

  // Preset Handlers with Toggle On/Off capability (an- und abwählbar, Haken setzen/entfernen)
  const handleSelectPreset = (viewId) => {
    // Wenn dieses Preset gerade pulsiert, bricht ein Klick die Animation ab und lässt es aktiv
    if (highlightedViewId === viewId) {
      cancelHighlight();
      return;
    }

    cancelHighlight();

    if (viewId === 'system_all') {
      if (isAllPresetActive) {
        updateStagedCategories([], [], false);
      } else {
        updateStagedCategories(projectCategories.map(c => c.id), reminderCategories.map(c => c.id), false);
      }
    } else if (viewId === 'system_projects') {
      if (isProjectsOnlyPresetActive) {
        updateStagedCategories([], [], false);
      } else {
        updateStagedCategories(projectCategories.map(c => c.id), [], false);
      }
    } else if (viewId === 'system_reminders') {
      if (isRemindersOnlyPresetActive) {
        updateStagedCategories([], [], false);
      } else {
        updateStagedCategories([], reminderCategories.map(c => c.id), false);
      }
    }
  };

  // Custom View Selection Handler with Toggle On/Off capability
  const handleSelectCustomView = (view) => {
    // Abbruchbedingung: Wenn diese Vorlage gerade hervorgehoben wird (pulsierende Animation),
    // bricht ein Klick darauf die Animation sofort ab, lässt die Vorlage aber ausgewählt!
    if (highlightedViewId === view.id) {
      cancelHighlight();
      setStagedViewId(view.id);
      return;
    }

    // Wenn etwas anderes geklickt wird oder eine andere Animation lief: abbrechen
    cancelHighlight();

    // Bereits ausgewählt (und nicht im Pulsieren): Nochmaliges Klicken wählt die Vorlage ab
    if (stagedViewId === view.id) {
      updateStagedCategories([], [], false);
      return;
    }

    const pIds = view.showProjects === false ? [] : (
      view.projectCategoryIds === 'all'
        ? projectCategories.map(c => c.id)
        : (Array.isArray(view.projectCategoryIds) ? view.projectCategoryIds : [])
    );
    const rIds = view.showReminders === false ? [] : (
      view.reminderCategoryIds === 'all'
        ? reminderCategories.map(c => c.id)
        : (Array.isArray(view.reminderCategoryIds) ? view.reminderCategoryIds : [])
    );
    updateStagedCategories(pIds, rIds, false);
    setStagedViewId(view.id);
  };

  // Toggle individual category in staged multi-selection
  const toggleStagedProjectCategory = (catId) => {
    cancelHighlight();
    const next = stagedProjectCategoryIds.includes(catId)
      ? stagedProjectCategoryIds.filter(id => id !== catId)
      : [...stagedProjectCategoryIds, catId];
    updateStagedCategories(next, stagedReminderCategoryIds, true);
  };

  const toggleStagedReminderCategory = (catId) => {
    cancelHighlight();
    const next = stagedReminderCategoryIds.includes(catId)
      ? stagedReminderCategoryIds.filter(id => id !== catId)
      : [...stagedReminderCategoryIds, catId];
    updateStagedCategories(stagedProjectCategoryIds, next, true);
  };

  // Quick Select All / None Helpers for Accordions
  const selectAllStagedProjects = () => {
    cancelHighlight();
    updateStagedCategories(projectCategories.map(c => c.id), stagedReminderCategoryIds, true);
  };

  const deselectAllStagedProjects = () => {
    cancelHighlight();
    updateStagedCategories([], stagedReminderCategoryIds, true);
  };

  const selectAllStagedReminders = () => {
    cancelHighlight();
    updateStagedCategories(stagedProjectCategoryIds, reminderCategories.map(c => c.id), true);
  };

  const deselectAllStagedReminders = () => {
    cancelHighlight();
    updateStagedCategories(stagedProjectCategoryIds, [], true);
  };

  // Open Edit Mode
  const handleOpenEdit = (view, e) => {
    e.stopPropagation();
    cancelHighlight();
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

  // Open Create Mode (start with clean slate: nothing pre-selected)
  const handleOpenCreate = () => {
    cancelHighlight();
    setEditingView(null);
    setFormName('');
    setFormIcon('star');
    setFormColor('primary');
    setFormShowProjects(true);
    setFormShowReminders(false);
    setFormProjectCategoryIds([]);
    setFormReminderCategoryIds([]);
    setMode('form');
  };

  // Open Create Mode prefilled from current custom selection
  const handleOpenCreateFromSelection = () => {
    cancelHighlight();
    setEditingView(null);
    setFormName('');
    setFormIcon('star');
    setFormColor('primary');
    setFormShowProjects(stagedProjectCategoryIds.length > 0);
    setFormShowReminders(stagedReminderCategoryIds.length > 0);
    setFormProjectCategoryIds([...stagedProjectCategoryIds]);
    setFormReminderCategoryIds([...stagedReminderCategoryIds]);
    setMode('form');
  };

  // Save Form
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const activeProjectIds = formShowProjects ? formProjectCategoryIds : [];
    const activeReminderIds = formShowReminders ? formReminderCategoryIds : [];

    // Duplicate check: If an identical combination already exists in the system or custom views
    const match = findMatchingView(activeProjectIds, activeReminderIds);
    if (match && (!editingView || match.id !== editingView.id)) {
      setMode('list');
      setEditingView(null);
      updateStagedCategories(activeProjectIds, activeReminderIds, true);
      return;
    }

    const payload = {
      name: formName.trim(),
      icon: formIcon,
      color: formColor,
      showProjects: formShowProjects,
      showReminders: formShowReminders,
      projectCategoryIds: activeProjectIds,
      reminderCategoryIds: activeReminderIds,
    };

    if (editingView) {
      if (onUpdateView) {
        await onUpdateView(editingView.id, payload);
      }
      setStagedViewId(editingView.id);
      setStagedProjectCategoryIds(activeProjectIds);
      setStagedReminderCategoryIds(activeReminderIds);
    } else {
      if (onAddView) {
        const newId = await onAddView(payload);
        if (newId) {
          setStagedViewId(newId);
          setStagedProjectCategoryIds(activeProjectIds);
          setStagedReminderCategoryIds(activeReminderIds);
        }
      }
    }

    setMode('list');
    setEditingView(null);
  };

  const systemViews = kanbanViews.filter(v => v.isSystem || v.type === 'system');
  const customViews = kanbanViews.filter(v => !v.isSystem && v.type === 'custom');

  // Duplicate detection for form mode
  const activeFormProjectIds = formShowProjects ? formProjectCategoryIds : [];
  const activeFormReminderIds = formShowReminders ? formReminderCategoryIds : [];
  const formMatchingView = findMatchingView(activeFormProjectIds, activeFormReminderIds);
  const isFormDuplicate = !!(formMatchingView && (!editingView || formMatchingView.id !== editingView.id));

  const drawerStyle = translateY > 0 ? {
    transform: `translateY(${translateY}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
  } : undefined;

  if (!shouldRender && !isOpen) return null;

  return (
    <>
      {/* Backdrop (Clicking cancels/closes without applying) */}
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
                {editingView ? 'Vorlage bearbeiten' : 'Gespeicherte Vorlagen'}
              </h2>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <div>
                <h2 className="font-bold text-base text-on-surface leading-tight">Ansichten & Filter</h2>
                <p className="text-[11px] text-on-surface-variant font-mono">Gemeinsame Mehrfachauswahl (UND)</p>
              </div>
            </div>
          )}

          {/* Abbrechen-Kreuz (Schließt ohne anzuwenden) */}
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Schließen"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          {mode === 'list' ? (
            /* MODE 1: LIST / SELECTION */
            <>
              {/* SECTION 1: Standard Presets */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">bolt</span>
                    Schnell-Auswahl
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="preset-view-system_all"
                    onClick={() => handleSelectPreset('system_all')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      highlightedViewId === 'system_all'
                        ? 'ring-2 ring-primary ring-offset-2 border-primary bg-primary/15 scale-[1.02] shadow-md font-bold'
                        : isAllPresetActive
                        ? 'bg-primary/10 border-primary text-primary font-bold ring-1 ring-primary/40 shadow-xs'
                        : 'bg-surface-low border-outline-variant hover:border-outline text-on-surface hover:bg-surface-variant/40'
                    }`}
                    title={isAllPresetActive ? 'Klicken um Alle abzuwählen' : 'Alle auswählen'}
                  >
                    <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                    <span className="text-xs leading-tight">Alle</span>
                  </button>

                  <button
                    type="button"
                    id="preset-view-system_projects"
                    onClick={() => handleSelectPreset('system_projects')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      highlightedViewId === 'system_projects'
                        ? 'ring-2 ring-primary ring-offset-2 border-primary bg-primary/15 scale-[1.02] shadow-md font-bold'
                        : isProjectsOnlyPresetActive
                        ? 'bg-primary/10 border-primary text-primary font-bold ring-1 ring-primary/40 shadow-xs'
                        : 'bg-surface-low border-outline-variant hover:border-outline text-on-surface hover:bg-surface-variant/40'
                    }`}
                    title={isProjectsOnlyPresetActive ? 'Klicken um Projekte abzuwählen' : 'Nur Projekte auswählen'}
                  >
                    <span className="material-symbols-outlined text-[18px]">folder</span>
                    <span className="text-xs leading-tight">Nur Projekte</span>
                  </button>

                  <button
                    type="button"
                    id="preset-view-system_reminders"
                    onClick={() => handleSelectPreset('system_reminders')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      highlightedViewId === 'system_reminders'
                        ? 'ring-2 ring-primary ring-offset-2 border-primary bg-primary/15 scale-[1.02] shadow-md font-bold'
                        : isRemindersOnlyPresetActive
                        ? 'bg-primary/10 border-primary text-primary font-bold ring-1 ring-primary/40 shadow-xs'
                        : 'bg-surface-low border-outline-variant hover:border-outline text-on-surface hover:bg-surface-variant/40'
                    }`}
                    title={isRemindersOnlyPresetActive ? 'Klicken um Erinnerungen abzuwählen' : 'Nur Erinnerungen auswählen'}
                  >
                    <span className="material-symbols-outlined text-[18px]">notifications</span>
                    <span className="text-xs leading-tight">Nur Erinner.</span>
                  </button>
                </div>
              </div>

              {/* SECTION 2: Multi-Select Accordions for Categories */}
              <div className="space-y-3">
                {/* ACCORDION 1: Projekt-Kategorien */}
                <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-low transition-all">
                  <div className="flex items-center justify-between p-3 bg-surface-low hover:bg-surface-variant/30 transition-colors">
                    <button
                      type="button"
                      onClick={() => setIsProjectCategoriesOpen(!isProjectCategoriesOpen)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">folder</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-on-surface">Projekt-Kategorien</span>
                          <span className="text-[10px] font-mono text-on-surface-variant px-1.5 py-0.5 bg-surface rounded-full border border-outline-variant">
                            {stagedProjectCategoryIds.length}/{projectCategories.length}
                          </span>
                        </div>
                        <span className="text-[11px] text-on-surface-variant font-mono truncate block">
                          {stagedProjectCategoryIds.length === projectCategories.length
                            ? 'Alle Projekte aktiv'
                            : stagedProjectCategoryIds.length === 0
                            ? 'Keine Projekte aktiv'
                            : `${stagedProjectCategoryIds.length} ausgewählt`}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <div className="flex items-center gap-1 bg-surface border border-outline-variant px-1.5 py-0.5 rounded-lg text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={selectAllStagedProjects}
                          className="hover:text-primary transition-colors cursor-pointer font-medium"
                          title="Alle Projekte auswählen"
                        >
                          Alle
                        </button>
                        <span className="text-outline">/</span>
                        <button
                          type="button"
                          onClick={deselectAllStagedProjects}
                          className="hover:text-primary transition-colors cursor-pointer font-medium text-on-surface-variant"
                          title="Keine auswählen"
                        >
                          Keine
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsProjectCategoriesOpen(!isProjectCategoriesOpen)}
                        className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      >
                        <span className={`material-symbols-outlined text-[20px] transition-transform duration-200 block ${
                          isProjectCategoriesOpen ? 'rotate-180 text-primary' : ''
                        }`}>
                          expand_more
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Project Categories Content (Multi-Select Checkboxes) */}
                  {isProjectCategoriesOpen && (
                    <div className="p-2 border-t border-outline-variant/60 bg-surface/70 max-h-56 overflow-y-auto no-scrollbar space-y-1">
                      {projectCategories.map((cat) => {
                        const isChecked = stagedProjectCategoryIds.includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => toggleStagedProjectCategory(cat.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-primary/10 text-primary font-bold border border-primary/30'
                                : 'hover:bg-surface-variant text-on-surface border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`material-symbols-outlined text-[16px] ${isChecked ? 'text-primary' : 'text-on-surface-variant'}`}>
                                folder
                              </span>
                              <span className="truncate">{cat.name}</span>
                            </div>

                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                              isChecked ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-surface'
                            }`}>
                              {isChecked && <span className="material-symbols-outlined text-[13px]">check</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ACCORDION 2: Erinnerungs-Kategorien */}
                {reminderCategories.length > 0 && (
                  <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-low transition-all">
                    <div className="flex items-center justify-between p-3 bg-surface-low hover:bg-surface-variant/30 transition-colors">
                      <button
                        type="button"
                        onClick={() => setIsReminderCategoriesOpen(!isReminderCategoriesOpen)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">notifications</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-on-surface">Erinnerungs-Kategorien</span>
                            <span className="text-[10px] font-mono text-on-surface-variant px-1.5 py-0.5 bg-surface rounded-full border border-outline-variant">
                              {stagedReminderCategoryIds.length}/{reminderCategories.length}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant font-mono truncate block">
                            {stagedReminderCategoryIds.length === reminderCategories.length
                              ? 'Alle Erinnerungen aktiv'
                              : stagedReminderCategoryIds.length === 0
                              ? 'Keine Erinnerungen aktiv'
                              : `${stagedReminderCategoryIds.length} ausgewählt`}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <div className="flex items-center gap-1 bg-surface border border-outline-variant px-1.5 py-0.5 rounded-lg text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={selectAllStagedReminders}
                            className="hover:text-primary transition-colors cursor-pointer font-medium"
                            title="Alle Erinnerungen auswählen"
                          >
                            Alle
                          </button>
                          <span className="text-outline">/</span>
                          <button
                            type="button"
                            onClick={deselectAllStagedReminders}
                            className="hover:text-primary transition-colors cursor-pointer font-medium text-on-surface-variant"
                            title="Keine auswählen"
                          >
                            Keine
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsReminderCategoriesOpen(!isReminderCategoriesOpen)}
                          className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        >
                          <span className={`material-symbols-outlined text-[20px] transition-transform duration-200 block ${
                            isReminderCategoriesOpen ? 'rotate-180 text-primary' : ''
                          }`}>
                            expand_more
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Reminder Categories Content (Multi-Select Checkboxes) */}
                    {isReminderCategoriesOpen && (
                      <div className="p-2 border-t border-outline-variant/60 bg-surface/70 max-h-56 overflow-y-auto no-scrollbar space-y-1">
                        {reminderCategories.map((cat) => {
                          const isChecked = stagedReminderCategoryIds.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              onClick={() => toggleStagedReminderCategory(cat.id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-primary/10 text-primary font-bold border border-primary/30'
                                  : 'hover:bg-surface-variant text-on-surface border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`material-symbols-outlined text-[16px] ${isChecked ? 'text-primary' : 'text-on-surface-variant'}`}>
                                  notifications
                                </span>
                                <span className="truncate">{cat.name}</span>
                              </div>

                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                isChecked ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-surface'
                              }`}>
                                {isChecked && <span className="material-symbols-outlined text-[13px]">check</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 3: Custom Saved Views */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 px-1 min-w-0 h-7">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5 min-w-0 truncate">
                    <span className="material-symbols-outlined text-[15px] text-primary shrink-0">bookmark</span>
                    <span className="truncate">
                      <span className="hidden sm:inline">Gespeicherte </span>Vorlagen ({customViews.length})
                    </span>
                  </span>

                  {isCustomSelection ? (
                    <button
                      type="button"
                      onClick={handleOpenCreateFromSelection}
                      className="shrink-0 h-7 box-border flex items-center gap-1.5 px-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 text-xs font-bold border border-primary shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 leading-none"
                      title="Aktuelle Kategorie-Auswahl als neue Vorlage speichern"
                    >
                      <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                      <span>Auswahl als Vorlage</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="shrink-0 h-7 box-border flex items-center gap-1.5 px-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold border border-primary/20 transition-all cursor-pointer whitespace-nowrap active:scale-95 leading-none"
                      title="Neue Vorlage anlegen"
                    >
                      <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                      <span>Neu</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {customViews.map((view) => {
                    const isSelected = stagedViewId === view.id;
                    const isDeleting = deleteConfirmId === view.id;

                    const pCount = Array.isArray(view.projectCategoryIds) ? view.projectCategoryIds.length : (view.projectCategoryIds === 'all' ? projectCategories.length : 0);
                    const rCount = Array.isArray(view.reminderCategoryIds) ? view.reminderCategoryIds.length : (view.reminderCategoryIds === 'all' ? reminderCategories.length : 0);

                    let summaryText = [];
                    if (view.showProjects !== false) summaryText.push(`${pCount} Projekt-Kat.`);
                    if (view.showReminders !== false) summaryText.push(`${rCount} Erinnerungs-Kat.`);
                    if (view.showReminders === false) summaryText.push('Ohne Erinnerungen');
                    if (view.showProjects === false) summaryText.push('Nur Erinnerungen');

                    return (
                      <div
                        key={view.id}
                        id={`custom-view-${view.id}`}
                        onClick={() => handleSelectCustomView(view)}
                        className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                          highlightedViewId === view.id
                            ? 'ring-2 ring-primary ring-offset-2 border-primary bg-primary/15 shadow-md scale-[1.01]'
                            : isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-surface-low border-outline-variant hover:border-outline hover:bg-surface-variant/40 text-on-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              highlightedViewId === view.id || isSelected ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant'
                            }`}>
                              <span className="material-symbols-outlined text-[18px]">
                                {view.icon || 'star'}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm leading-tight truncate text-on-surface">
                                  {view.name}
                                </h3>
                                {highlightedViewId === view.id && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold shadow-xs animate-pulse shrink-0">
                                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                    Bereits hinterlegt
                                  </span>
                                )}
                              </div>
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
                                    if (stagedViewId === view.id) {
                                      setStagedViewId('system_all');
                                    }
                                    setDeleteConfirmId(null);
                                  }}
                                  className="w-6 h-6 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors cursor-pointer"
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
                                  className="w-6 h-6 rounded bg-surface-variant text-on-surface flex items-center justify-center hover:bg-outline-variant transition-colors cursor-pointer"
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
                                  className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-variant flex items-center justify-center transition-colors cursor-pointer"
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
                                  className="w-7 h-7 rounded-lg text-on-surface-variant hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Löschen"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </>
                            )}

                            {isSelected && !isDeleting && (
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
                        Noch keine gespeicherten Vorlagen vorhanden.
                      </p>
                      <button
                        type="button"
                        onClick={isCustomSelection ? handleOpenCreateFromSelection : handleOpenCreate}
                        className="mt-2 text-xs text-primary font-bold hover:underline cursor-pointer"
                      >
                        {isCustomSelection ? 'Aktuelle Auswahl als Vorlage anlegen' : 'Jetzt erste Vorlage anlegen'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* MODE 2: FORM (CREATE / EDIT) */
            <form onSubmit={handleSaveForm} className="space-y-5">
              {/* Duplicate Banner: Informs user if this category combination is already a template */}
              {isFormDuplicate && (
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-start gap-2.5 text-xs text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
                    verified
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary">
                      Kategorie-Kombination existiert bereits: „{formMatchingView.name}“
                    </p>
                    <p className="text-on-surface-variant text-[11px] mt-0.5">
                      Diese Vorlage ist bereits hinterlegt. Du musst keine neue anlegen.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('list');
                        setEditingView(null);
                        updateStagedCategories(activeFormProjectIds, activeFormReminderIds, true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                      Bestehende Vorlage verwenden
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Name der Vorlage *
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
                {/* SECTION: Projekte einbeziehen */}
                <div className={`border rounded-xl overflow-hidden transition-all ${
                  formShowProjects 
                    ? 'border-outline-variant bg-surface-low shadow-xs' 
                    : 'border-outline-variant/60 bg-surface-low/40 opacity-75'
                }`}>
                  <div className="flex items-center justify-between p-3 bg-surface-low">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        formShowProjects ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'
                      }`}>
                        <span className="material-symbols-outlined text-[18px]">folder</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${formShowProjects ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                            Projekte einbeziehen
                          </span>
                          <span className="text-[10px] font-mono text-on-surface-variant px-1.5 py-0.5 bg-surface rounded-full border border-outline-variant">
                            {formShowProjects ? `${formProjectCategoryIds.length}/${projectCategories.length}` : `0/${projectCategories.length}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-on-surface-variant font-mono truncate block">
                          {!formShowProjects
                            ? 'Ausgeschaltet (Keine Projekte)'
                            : formProjectCategoryIds.length === projectCategories.length
                            ? 'Alle Projekte aktiv'
                            : formProjectCategoryIds.length === 0
                            ? 'Keine Kategorien gewählt'
                            : `${formProjectCategoryIds.length} ausgewählt`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {formShowProjects && (
                        <div className="flex items-center gap-1 bg-surface border border-outline-variant px-1.5 py-0.5 rounded-lg text-[11px] font-mono">
                          <button
                            type="button"
                            onClick={() => {
                              setFormShowProjects(true);
                              setFormProjectCategoryIds(projectCategories.map(c => c.id));
                            }}
                            className="hover:text-primary transition-colors cursor-pointer font-medium"
                            title="Alle auswählen"
                          >
                            Alle
                          </button>
                          <span className="text-outline">/</span>
                          <button
                            type="button"
                            onClick={() => setFormProjectCategoryIds([])}
                            className="hover:text-primary transition-colors cursor-pointer font-medium text-on-surface-variant"
                            title="Keine auswählen"
                          >
                            Keine
                          </button>
                        </div>
                      )}

                      {/* Switch Toggle */}
                      <button
                        type="button"
                        onClick={() => setFormShowProjects(!formShowProjects)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          formShowProjects ? 'bg-primary' : 'bg-outline-variant'
                        }`}
                        role="switch"
                        aria-checked={formShowProjects}
                        title={formShowProjects ? 'Projekte ausschalten' : 'Projekte einschalten'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            formShowProjects ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Project Categories Content in Form */}
                  {formShowProjects && (
                    <div className="p-2 border-t border-outline-variant/60 bg-surface/70 max-h-52 overflow-y-auto no-scrollbar space-y-1">
                      {projectCategories.map((cat) => {
                        const isChecked = formProjectCategoryIds.includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setFormShowProjects(true);
                              setFormProjectCategoryIds(prev => 
                                prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                              );
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-primary/10 text-primary font-bold border border-primary/30'
                                : 'hover:bg-surface-variant text-on-surface border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`material-symbols-outlined text-[16px] ${isChecked ? 'text-primary' : 'text-on-surface-variant'}`}>
                                folder
                              </span>
                              <span className="truncate">{cat.name}</span>
                            </div>

                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                              isChecked ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-surface'
                            }`}>
                              {isChecked && <span className="material-symbols-outlined text-[13px]">check</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SECTION: Erinnerungen einbeziehen */}
                {reminderCategories.length > 0 && (
                  <div className={`border rounded-xl overflow-hidden transition-all ${
                    formShowReminders 
                      ? 'border-outline-variant bg-surface-low shadow-xs' 
                      : 'border-outline-variant/60 bg-surface-low/40 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between p-3 bg-surface-low">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          formShowReminders ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">notifications</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold ${formShowReminders ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                              Erinnerungen einbeziehen
                            </span>
                            <span className="text-[10px] font-mono text-on-surface-variant px-1.5 py-0.5 bg-surface rounded-full border border-outline-variant">
                              {formShowReminders ? `${formReminderCategoryIds.length}/${reminderCategories.length}` : `0/${reminderCategories.length}`}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant font-mono truncate block">
                            {!formShowReminders
                              ? 'Ausgeschaltet (Keine Erinnerungen)'
                              : formReminderCategoryIds.length === reminderCategories.length
                              ? 'Alle Erinnerungen aktiv'
                              : formReminderCategoryIds.length === 0
                              ? 'Keine Kategorien gewählt'
                              : `${formReminderCategoryIds.length} ausgewählt`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {formShowReminders && (
                          <div className="flex items-center gap-1 bg-surface border border-outline-variant px-1.5 py-0.5 rounded-lg text-[11px] font-mono">
                            <button
                              type="button"
                              onClick={() => {
                                setFormShowReminders(true);
                                setFormReminderCategoryIds(reminderCategories.map(c => c.id));
                              }}
                              className="hover:text-primary transition-colors cursor-pointer font-medium"
                              title="Alle auswählen"
                            >
                              Alle
                            </button>
                            <span className="text-outline">/</span>
                            <button
                              type="button"
                              onClick={() => setFormReminderCategoryIds([])}
                              className="hover:text-primary transition-colors cursor-pointer font-medium text-on-surface-variant"
                              title="Keine auswählen"
                            >
                              Keine
                            </button>
                          </div>
                        )}

                        {/* Switch Toggle */}
                        <button
                          type="button"
                          onClick={() => setFormShowReminders(!formShowReminders)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            formShowReminders ? 'bg-primary' : 'bg-outline-variant'
                          }`}
                          role="switch"
                          aria-checked={formShowReminders}
                          title={formShowReminders ? 'Erinnerungen ausschalten' : 'Erinnerungen einschalten'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              formShowReminders ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Reminder Categories Content in Form */}
                    {formShowReminders && (
                      <div className="p-2 border-t border-outline-variant/60 bg-surface/70 max-h-52 overflow-y-auto no-scrollbar space-y-1">
                        {reminderCategories.map((cat) => {
                          const isChecked = formReminderCategoryIds.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              onClick={() => {
                                setFormShowReminders(true);
                                setFormReminderCategoryIds(prev => 
                                  prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                );
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-primary/10 text-primary font-bold border border-primary/30'
                                  : 'hover:bg-surface-variant text-on-surface border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`material-symbols-outlined text-[16px] ${isChecked ? 'text-primary' : 'text-on-surface-variant'}`}>
                                  notifications
                                </span>
                                <span className="truncate">{cat.name}</span>
                              </div>

                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                isChecked ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-surface'
                              }`}>
                                {isChecked && <span className="material-symbols-outlined text-[13px]">check</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!formName.trim()}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingView ? 'Vorlage speichern' : (isFormDuplicate ? 'Bestehende Vorlage auswählen' : 'Vorlage anlegen')}
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

        {/* Drawer Sticky Footer: "Speichern" Button */}
        {mode === 'list' && (
          <div className="p-3 sm:p-4 border-t border-outline-variant bg-surface shrink-0 shadow-lg">
            <button
              type="button"
              onClick={handleApply}
              className="w-full py-2.5 sm:py-3 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              <span>
                {stagedProjectCategoryIds.length === 0 && stagedReminderCategoryIds.length === 0
                  ? 'Speichern (Keine Kategorien gewählt)'
                  : `Auswahl speichern (${stagedProjectCategoryIds.length} Proj. + ${stagedReminderCategoryIds.length} Erinn.)`}
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default KanbanFilterDrawer;
