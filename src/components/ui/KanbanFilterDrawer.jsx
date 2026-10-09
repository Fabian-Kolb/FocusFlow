import React, { useState, useEffect, useRef } from 'react';
import {
  Badge, Button, Checkbox, Chip, Field, FOCUS, Icon, IconButton, IconTile, Input, SectionHeader, Sheet, Switch, cx,
} from '../ds';

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

/**
 * Kategorien eines Typs (Projekte oder Erinnerungen) mit Mehrfachauswahl.
 * `onToggleEnabled` blendet zusätzlich einen Schalter ein (Formular einer Vorlage).
 */
function CategoryGroup({
  icon, title, enabledText, categories, selectedIds, onToggleCategory, onAll, onNone, open, onToggleOpen,
  enabled = true, onToggleEnabled, summaryText,
}) {
  const count = enabled ? selectedIds.length : 0;
  return (
    <div className={cx('overflow-hidden rounded-lg border border-subtle bg-surface', !enabled && 'opacity-75')}>
      <div className="flex items-center justify-between gap-2 p-3">
        {onToggleEnabled ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <IconTile area={enabled ? 'projects' : 'neutral'} icon={icon} size="sm" />
            <div className="min-w-0">
              <span className={cx('flex items-center gap-1.5 text-body-strong', enabled ? 'text-primary' : 'text-secondary')}>
                {enabledText}
                <Badge tone="neutral" size="sm">{count}/{categories.length}</Badge>
              </span>
              <span className="block truncate text-caption text-secondary">{summaryText}</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            className={cx('flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left', FOCUS)}
          >
            <IconTile area="neutral" icon={icon} size="sm" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-body-strong text-primary">
                {title}
                <Badge tone="neutral" size="sm">{count}/{categories.length}</Badge>
              </span>
              <span className="block truncate text-caption text-secondary">{summaryText}</span>
            </span>
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {enabled && (
            <>
              <Button variant="ghost" size="sm" onClick={onAll} title="Alle auswählen">Alle</Button>
              <Button variant="ghost" size="sm" onClick={onNone} title="Keine auswählen">Keine</Button>
            </>
          )}
          {onToggleEnabled ? (
            <Switch checked={enabled} onChange={onToggleEnabled} label={<span className="sr-only">{enabledText}</span>} />
          ) : (
            <IconButton icon={open ? 'expand_less' : 'expand_more'} label={open ? 'Einklappen' : 'Ausklappen'} size="sm" onClick={onToggleOpen} />
          )}
        </div>
      </div>

      {enabled && (onToggleEnabled || open) && (
        <div className="no-scrollbar max-h-56 space-y-0.5 overflow-y-auto border-t border-subtle bg-subtle p-2">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-md px-2 py-1.5 hover:bg-hover">
              <Checkbox
                checked={selectedIds.includes(cat.id)}
                onChange={() => onToggleCategory(cat.id)}
                label={cat.name}
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  // Drawer Modes: 'list' | 'form'
  const [mode, setMode] = useState('list');
  const [editingView, setEditingView] = useState(null);

  // Staged multi-select selections (UND-Verknüpfung)
  const [stagedProjectCategoryIds, setStagedProjectCategoryIds] = useState([]);
  const [stagedReminderCategoryIds, setStagedReminderCategoryIds] = useState([]);
  const [stagedViewId, setStagedViewId] = useState(activeKanbanViewId);

  // Aufklappbare Kategorielisten (standardmäßig zu)
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

  // Beim Öffnen immer mit der Liste starten
  useEffect(() => {
    if (isOpen) {
      setMode('list');
      setEditingView(null);
    }
  }, [isOpen]);

  // Synchronize staged selection when drawer opens
  useEffect(() => {
    if (isOpen) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeKanbanViewId, selectedProjectCategoryIds, selectedReminderCategoryIds, projectCategories, reminderCategories]);

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
    // Wenn diese Vorlage gerade hervorgehoben wird, bricht ein Klick die Animation ab und lässt sie ausgewählt
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

  // Quick Select All / None Helpers
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

  const customViews = kanbanViews.filter(v => !v.isSystem && v.type === 'custom');

  // Duplicate detection for form mode
  const activeFormProjectIds = formShowProjects ? formProjectCategoryIds : [];
  const activeFormReminderIds = formShowReminders ? formReminderCategoryIds : [];
  const formMatchingView = findMatchingView(activeFormProjectIds, activeFormReminderIds);
  const isFormDuplicate = !!(formMatchingView && (!editingView || formMatchingView.id !== editingView.id));

  const summaryFor = (selected, total, allText, noneText) => (
    selected === total ? allText : selected === 0 ? noneText : `${selected} ausgewählt`
  );

  const presets = [
    { id: 'system_all', icon: 'view_kanban', label: 'Alle', active: isAllPresetActive, hint: isAllPresetActive ? 'Klicken, um Alle abzuwählen' : 'Alle auswählen' },
    { id: 'system_projects', icon: 'folder', label: 'Nur Projekte', active: isProjectsOnlyPresetActive, hint: isProjectsOnlyPresetActive ? 'Klicken, um Projekte abzuwählen' : 'Nur Projekte auswählen' },
    { id: 'system_reminders', icon: 'notifications', label: 'Nur Erinnerungen', active: isRemindersOnlyPresetActive, hint: isRemindersOnlyPresetActive ? 'Klicken, um Erinnerungen abzuwählen' : 'Nur Erinnerungen auswählen' },
  ];

  return (
    <Sheet
      open={isOpen}
      onClose={handleClose}
      ariaLabel="Kanban-Ansichten und Filter"
      title={mode === 'form' ? (editingView ? 'Vorlage bearbeiten' : 'Neue Vorlage') : 'Ansichten und Filter'}
      description={mode === 'form' ? undefined : 'Projekte und Erinnerungen kombinieren'}
      headerAction={mode === 'form' ? (
        <IconButton icon="arrow_back" label="Zurück zur Liste" onClick={() => setMode('list')} />
      ) : undefined}
      footer={mode === 'list' ? (
        <Button fullWidth leadingIcon="check" onClick={handleApply}>
          {stagedProjectCategoryIds.length === 0 && stagedReminderCategoryIds.length === 0
            ? 'Speichern (keine Kategorien gewählt)'
            : `Auswahl speichern (${stagedProjectCategoryIds.length} Projekte, ${stagedReminderCategoryIds.length} Erinnerungen)`}
        </Button>
      ) : undefined}
    >
      {mode === 'list' ? (
        <div className="space-y-6">
          {/* Schnellauswahl */}
          <section className="space-y-2">
            <SectionHeader title="Schnellauswahl" />
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Chip
                  key={p.id}
                  id={`preset-view-${p.id}`}
                  selected={p.active}
                  leadingIcon={p.icon}
                  title={p.hint}
                  className={highlightedViewId === p.id ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface' : ''}
                  onClick={() => handleSelectPreset(p.id)}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </section>

          {/* Kategorien */}
          <section className="space-y-3">
            <SectionHeader title="Kategorien" />
            <CategoryGroup
              icon="folder"
              title="Projekt-Kategorien"
              categories={projectCategories}
              selectedIds={stagedProjectCategoryIds}
              onToggleCategory={toggleStagedProjectCategory}
              onAll={selectAllStagedProjects}
              onNone={deselectAllStagedProjects}
              open={isProjectCategoriesOpen}
              onToggleOpen={() => setIsProjectCategoriesOpen(!isProjectCategoriesOpen)}
              summaryText={summaryFor(stagedProjectCategoryIds.length, projectCategories.length, 'Alle Projekte aktiv', 'Keine Projekte aktiv')}
            />
            {reminderCategories.length > 0 && (
              <CategoryGroup
                icon="notifications"
                title="Erinnerungs-Kategorien"
                categories={reminderCategories}
                selectedIds={stagedReminderCategoryIds}
                onToggleCategory={toggleStagedReminderCategory}
                onAll={selectAllStagedReminders}
                onNone={deselectAllStagedReminders}
                open={isReminderCategoriesOpen}
                onToggleOpen={() => setIsReminderCategoriesOpen(!isReminderCategoriesOpen)}
                summaryText={summaryFor(stagedReminderCategoryIds.length, reminderCategories.length, 'Alle Erinnerungen aktiv', 'Keine Erinnerungen aktiv')}
              />
            )}
          </section>

          {/* Gespeicherte Vorlagen */}
          <section className="space-y-2">
            <SectionHeader
              title="Gespeicherte Vorlagen"
              count={customViews.length}
              action={isCustomSelection ? (
                <Button size="sm" leadingIcon="bookmark_add" onClick={handleOpenCreateFromSelection} title="Aktuelle Kategorie-Auswahl als neue Vorlage speichern">
                  Auswahl als Vorlage
                </Button>
              ) : (
                <Button variant="secondary" size="sm" leadingIcon="bookmark_add" onClick={handleOpenCreate} title="Neue Vorlage anlegen">
                  Neu
                </Button>
              )}
            />

            <div className="space-y-2">
              {customViews.map((view) => {
                const isSelected = stagedViewId === view.id;
                const isDeleting = deleteConfirmId === view.id;

                const pCount = Array.isArray(view.projectCategoryIds) ? view.projectCategoryIds.length : (view.projectCategoryIds === 'all' ? projectCategories.length : 0);
                const rCount = Array.isArray(view.reminderCategoryIds) ? view.reminderCategoryIds.length : (view.reminderCategoryIds === 'all' ? reminderCategories.length : 0);

                const summary = [];
                if (view.showProjects !== false) summary.push(`${pCount} Projektkategorien`);
                if (view.showReminders !== false) summary.push(`${rCount} Erinnerungskategorien`);
                if (view.showReminders === false) summary.push('ohne Erinnerungen');
                if (view.showProjects === false) summary.push('nur Erinnerungen');

                return (
                  <div
                    key={view.id}
                    id={`custom-view-${view.id}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectCustomView(view)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectCustomView(view);
                      }
                    }}
                    className={cx(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 transition-colors duration-fast',
                      FOCUS,
                      highlightedViewId === view.id
                        ? 'border-accent bg-accent-subtle ring-2 ring-focus ring-offset-2 ring-offset-surface'
                        : isSelected
                        ? 'border-accent bg-accent-subtle'
                        : 'border-default bg-surface hover:border-strong',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <IconTile area={isSelected || highlightedViewId === view.id ? 'accent' : 'neutral'} icon={view.icon || 'star'} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-body-strong text-primary">{view.name}</h3>
                          {highlightedViewId === view.id && <Badge tone="accent" icon="check_circle" size="sm">Bereits hinterlegt</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-caption text-secondary">{summary.join(' · ')}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {isDeleting ? (
                        <div className="flex items-center gap-1 rounded-md border border-danger bg-surface p-1">
                          <span className="px-1 text-caption-strong text-danger">Löschen?</span>
                          <IconButton
                            icon="check"
                            label="Löschen bestätigen"
                            variant="danger"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onDeleteView) await onDeleteView(view.id);
                              if (stagedViewId === view.id) {
                                setStagedViewId('system_all');
                              }
                              setDeleteConfirmId(null);
                            }}
                          />
                          <IconButton
                            icon="close"
                            label="Abbrechen"
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <IconButton icon="edit" label="Vorlage bearbeiten" size="sm" onClick={(e) => handleOpenEdit(view, e)} />
                          <IconButton
                            icon="delete"
                            label="Vorlage löschen"
                            size="sm"
                            className="hover:!bg-danger-subtle hover:!text-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(view.id);
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {customViews.length === 0 && (
                <div className="rounded-lg border border-dashed border-default bg-subtle p-4 text-center">
                  <Icon name="bookmarks" size="lg" className="mb-1 text-tertiary" />
                  <p className="text-caption text-secondary">Noch keine gespeicherten Vorlagen.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={isCustomSelection ? handleOpenCreateFromSelection : handleOpenCreate}
                  >
                    {isCustomSelection ? 'Aktuelle Auswahl als Vorlage speichern' : 'Erste Vorlage anlegen'}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        /* Vorlage anlegen oder bearbeiten */
        <form onSubmit={handleSaveForm} className="space-y-5">
          {/* Hinweis: Diese Kombination gibt es schon als Vorlage */}
          {isFormDuplicate && (
            <div className="rounded-lg border border-default bg-subtle p-3">
              <p className="flex items-start gap-2 text-body-strong text-primary">
                <Icon name="verified" size="md" className="mt-0.5 shrink-0 text-secondary" />
                Diese Kombination gibt es schon: „{formMatchingView.name}“
              </p>
              <p className="mt-1 pl-7 text-caption text-secondary">Du musst keine neue Vorlage anlegen.</p>
              <Button
                size="sm"
                variant="secondary"
                leadingIcon="arrow_back"
                className="ml-7 mt-2"
                onClick={() => {
                  setMode('list');
                  setEditingView(null);
                  updateStagedCategories(activeFormProjectIds, activeFormReminderIds, true);
                }}
              >
                Bestehende Vorlage verwenden
              </Button>
            </div>
          )}

          <Field label="Name der Vorlage">
            <Input
              required
              autoFocus
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="z. B. Deep-Work-Sprint, Privat, Finanzen"
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-label text-primary">Symbol</legend>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Symbol">
              {AVAILABLE_ICONS.map((iconItem) => (
                <button
                  key={iconItem.id}
                  type="button"
                  role="radio"
                  aria-checked={formIcon === iconItem.id}
                  onClick={() => setFormIcon(iconItem.id)}
                  className={cx(
                    'flex h-10 items-center justify-center rounded-md border transition-colors duration-fast',
                    FOCUS,
                    formIcon === iconItem.id ? 'border-accent bg-accent-subtle text-accent' : 'border-default bg-surface text-secondary hover:border-strong hover:text-primary',
                  )}
                  title={iconItem.label}
                >
                  <Icon name={iconItem.id} size="md" filled={formIcon === iconItem.id} />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3 border-t border-subtle pt-4">
            <CategoryGroup
              icon="folder"
              enabledText="Projekte einbeziehen"
              categories={projectCategories}
              selectedIds={formProjectCategoryIds}
              enabled={formShowProjects}
              onToggleEnabled={() => setFormShowProjects(!formShowProjects)}
              onToggleCategory={(catId) => {
                setFormShowProjects(true);
                setFormProjectCategoryIds(prev => (prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]));
              }}
              onAll={() => {
                setFormShowProjects(true);
                setFormProjectCategoryIds(projectCategories.map(c => c.id));
              }}
              onNone={() => setFormProjectCategoryIds([])}
              summaryText={!formShowProjects ? 'Ausgeschaltet (keine Projekte)' : summaryFor(formProjectCategoryIds.length, projectCategories.length, 'Alle Projekte aktiv', 'Keine Kategorien gewählt')}
            />

            {reminderCategories.length > 0 && (
              <CategoryGroup
                icon="notifications"
                enabledText="Erinnerungen einbeziehen"
                categories={reminderCategories}
                selectedIds={formReminderCategoryIds}
                enabled={formShowReminders}
                onToggleEnabled={() => setFormShowReminders(!formShowReminders)}
                onToggleCategory={(catId) => {
                  setFormShowReminders(true);
                  setFormReminderCategoryIds(prev => (prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]));
                }}
                onAll={() => {
                  setFormShowReminders(true);
                  setFormReminderCategoryIds(reminderCategories.map(c => c.id));
                }}
                onNone={() => setFormReminderCategoryIds([])}
                summaryText={!formShowReminders ? 'Ausgeschaltet (keine Erinnerungen)' : summaryFor(formReminderCategoryIds.length, reminderCategories.length, 'Alle Erinnerungen aktiv', 'Keine Kategorien gewählt')}
              />
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={!formName.trim()} className="flex-1">
              {editingView ? 'Vorlage speichern' : (isFormDuplicate ? 'Bestehende Vorlage auswählen' : 'Vorlage anlegen')}
            </Button>
            <Button variant="secondary" onClick={() => setMode('list')}>Abbrechen</Button>
          </div>
        </form>
      )}
    </Sheet>
  );
};

export default KanbanFilterDrawer;
