import React, { useState, useRef } from 'react';
import { useBoardSort, LIFT_CLASS } from '../ui/useBoardSort';
import { groupByCategory, sortItems, REMINDER_SORT_OPTIONS } from '../../lib/itemOrder';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { useModalContext } from '../../context/ModalContext';
import { Button, Card, EmptyState, FOCUS, Icon, IconButton, Input, SectionHeader, cx } from '../ds';
import { ReminderCardContent } from '../ui/ItemCardContent';
import CardContextMenu from '../ui/CardContextMenu';
import { ListToolbar, ViewToggle, CategoryToolbar } from '../ui/ListToolbar';
import { groupRemindersByTime, compareReminderDue } from '../../lib/reminderDates';
import SwipeableCard from '../ui/SwipeableCard';

const VIEW_STORAGE_KEY = 'focusflow_reminders_view';
const VIEW_OPTIONS = [
  { value: 'time', label: 'Nach Zeit', icon: 'schedule' },
  { value: 'category', label: 'Nach Kategorie', icon: 'folder' },
];

function readStoredView() {
  try {
    const value = localStorage.getItem(VIEW_STORAGE_KEY);
    if (value === 'time' || value === 'category') return value;
  } catch {
    // Storage gesperrt – Standardansicht
  }
  return 'time';
}

const Reminders = ({ setCurrentScreen }) => {
  const {
    reminders,
    openModal,
    setSelectedReminderId,
    toggleReminderStatus,
    setReminderStatus,
    toggleReminderPause,
    deleteReminder,
    toggleReminderKanban,
    reminderCategories,
    addReminderCategory,
    toggleReminderCategory,
    deleteReminderCategory,
    updateReminderCategory,
    placeReminderInCategory,
    reorderReminderCategories,
    moveReminderCategoryOrder,
    collapseAllReminderCategories,
    expandAllReminderCategories,
    restoreReminderCategoryExpandStates,
  } = useModalContext();

  const handleReminderClick = (reminderId) => {
    setSelectedReminderId(reminderId);
    setCurrentScreen('reminder-detail');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState(readStoredView);
  // Eingeklappte Zeit-Gruppen; "Erledigt" startet eingeklappt
  const [collapsedTimeGroups, setCollapsedTimeGroups] = useState({ done: true });

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // Ansicht gilt dann nur für diese Sitzung
    }
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
      // Enter edit mode: save current states, collapse all
      const states = {};
      reminderCategories.forEach(c => { states[c.id] = c.isExpanded; });
      setEditModeSavedStates(states);
      collapseAllReminderCategories();
      setIsEditMode(true);
    } else {
      // Leave edit mode: restore saved states
      if (editModeSavedStates) {
        restoreReminderCategoryExpandStates(editModeSavedStates);
      }
      setEditModeSavedStates(null);
      setIsEditMode(false);
    }
  };

  const saveEditCategory = (catId) => {
    if (editingCatName.trim()) {
      updateReminderCategory(catId, editingCatName.trim());
    }
    setEditingCatId(null);
  };

  let activeReminders = reminders.filter(r => !r.deletedAt);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    activeReminders = activeReminders.filter(r =>
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.tags && r.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }

  if (statusFilter !== 'all') {
    activeReminders = activeReminders.filter(r => {
      if (statusFilter === 'paused') return r.isPaused;
      if (r.isPaused) return false;
      if (statusFilter === 'active') return r.status === 'AKTIV';
      if (statusFilter === 'planned') return r.status === 'GEPLANT';
      if (statusFilter === 'completed') return r.status === 'ABGESCHLOSSEN';
      return true;
    });
  }

  const pinnedReminders = activeReminders.filter(r => r.isPinned);
  const otherReminders = activeReminders.filter(r => !r.isPinned);

  // Kategorien und Karten per Drag & Drop (gleiche Mechanik wie im Fio-Entwurfs-Editor)
  const boardRef = useRef(null);
  // Erledigte rutschen ans Ende, damit Offenes oben bleibt
  const [sortMode, setSortMode] = usePersistedChoice('focusflow_reminders_sort', REMINDER_SORT_OPTIONS.map((o) => o.value), 'custom');
  const itemsByCategory = groupByCategory(otherReminders, reminderCategories, {
    sortWithin: (list) => sortItems(list, sortMode, { compareDue: compareReminderDue })
      .sort((a, b) => (a.status === 'ABGESCHLOSSEN') - (b.status === 'ABGESCHLOSSEN')),
  });
  // Erste manuelle Änderung in einer automatischen Sortierung: aktuelle Reihenfolge einfrieren und auf "Benutzerdefiniert" wechseln
  const switchToCustom = () => {
    if (sortMode === 'custom') return;
    Object.entries(itemsByCategory).forEach(([catId, list]) => {
      if (list.length) placeReminderInCategory(list[0].id, catId, list.map((i) => i.id));
    });
    setSortMode('custom');
  };
  const { drag, view, startCategoryDrag, startItemPress } = useBoardSort({
    rootRef: boardRef,
    categories: reminderCategories,
    itemsByCategory,
    onReorderCategories: reorderReminderCategories,
    onMoveItem: (reminderId, categoryId, orderedIds) => {
      switchToCustom();
      placeReminderInCategory(reminderId, categoryId, orderedIds);
      const cat = reminderCategories.find((c) => c.id === categoryId);
      if (cat && !cat.isExpanded) toggleReminderCategory(categoryId);
    },
    onCategoryDragStart: collapseAllReminderCategories,
    // Im Bearbeiten-Modus bleiben die Kategorien eingeklappt, sonst Zustand wiederherstellen
    onCategoryDragEnd: (saved) => (isEditMode ? collapseAllReminderCategories() : restoreReminderCategoryExpandStates(saved)),
    onExpandCategory: (catId) => {
      const cat = reminderCategories.find((c) => c.id === catId);
      if (cat && !cat.isExpanded) toggleReminderCategory(catId);
    },
  });





  const createCategory = async () => {
    if (newCategoryName.trim()) {
      await addReminderCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  // sortable = Karte lässt sich ziehen (nur in der Kategorie-Ansicht; angepinnte Karten und die Zeit-Ansicht stehen fest)
  const renderCard = (reminder, sortable = false) => {
    const isDragged = drag?.kind === 'item' && drag.id === reminder.id;
    return (
      <div
        key={reminder.id}
        {...(sortable ? {
          'data-card-id': reminder.id,
          onMouseDown: (e) => startItemPress(e, reminder.id),
          onTouchStart: (e) => startItemPress(e, reminder.id),
          onDragStart: (e) => e.preventDefault(),
        } : {})}
        className={`${sortable ? 'cursor-grab [-webkit-touch-callout:none] select-none' : ''} ${isDragged ? LIFT_CLASS : ''}`}
      >
      <SwipeableCard
        disabled={Boolean(drag)}
        className="h-full"
        right={{
          label: reminder.status === 'ABGESCHLOSSEN' ? 'Wieder öffnen' : 'Erledigt',
          icon: reminder.status === 'ABGESCHLOSSEN' ? 'undo' : 'check_circle',
          className: 'bg-success',
          onCommit: () => setReminderStatus(reminder.id, reminder.status === 'ABGESCHLOSSEN' ? 'AKTIV' : 'ABGESCHLOSSEN')
        }}
        left={{
          label: 'Papierkorb',
          icon: 'delete',
          className: 'bg-danger',
          dismiss: true,
          onCommit: () => deleteReminder(reminder.id)
        }}
      >
      <Card
        interactive
        padding="sm"
        className={`flex flex-col h-full transition-all ${reminder.status === 'ABGESCHLOSSEN' ? 'opacity-60' : ''} ${
          reminder.isPaused
            ? '!border-dashed !border-control !bg-subtle'
            : ''
        }`}
        onClick={() => handleReminderClick(reminder.id)}
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
      </SwipeableCard>
    </div>
  );
};

  const timeGroups = groupRemindersByTime(otherReminders).filter((g) => g.items.length > 0);

  return (
    <div className="pb-20">
      <ListToolbar
      title="Erinnerungen"
      description={`${reminders.filter((x) => !x.deletedAt && x.status !== 'ABGESCHLOSSEN').length} offen`}
      searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Erinnerungen durchsuchen"
        onOpenTrash={() => setCurrentScreen('trash')}
        onCreate={() => openModal('reminder')}
        createLabel="Neue Erinnerung"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewToggle={<ViewToggle value={viewMode} onChange={changeViewMode} options={VIEW_OPTIONS} />}
      />

      {pinnedReminders.length > 0 && (
        <div className="mb-6">
          <SectionHeader title="Angepinnt" count={pinnedReminders.length} className="mb-3" />
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pinnedReminders.map((r) => renderCard(r))}
          </div>
        </div>
      )}

      {viewMode === 'time' ? (
        <div className="space-y-5">
          {timeGroups.length === 0 && (
            <EmptyState
              icon="notifications"
              title={searchQuery || statusFilter !== 'all' ? 'Keine Treffer für diesen Filter' : 'Noch keine Erinnerungen'}
              description={searchQuery || statusFilter !== 'all' ? 'Ändere die Suche oder den Filter.' : 'Lege eine Erinnerung an, damit nichts untergeht.'}
              action={!(searchQuery || statusFilter !== 'all') && <Button onClick={() => openModal('reminder')}>Erinnerung hinzufügen</Button>}
            />
          )}
          {timeGroups.map((group) => {
            const collapsed = Boolean(collapsedTimeGroups[group.id]);
            const isOverdue = group.id === 'overdue';
            return (
              <section key={group.id} aria-labelledby={`tgroup-${group.id}`}>
                <button
                  type="button"
                  onClick={() => setCollapsedTimeGroups((prev) => ({ ...prev, [group.id]: !collapsed }))}
                  aria-expanded={!collapsed}
                  className={cx('group mb-2 flex w-full items-center gap-2 rounded-md py-1 text-left', FOCUS)}
                >
                  <Icon name="chevron_right" size="md" className={cx('text-secondary transition-transform duration-fast', !collapsed && 'rotate-90')} />
                  <Icon name={group.icon} size="md" className={isOverdue ? 'text-danger' : 'text-secondary'} />
                  <h2 id={`tgroup-${group.id}`} className={cx('font-label text-eyebrow uppercase', isOverdue ? 'text-danger' : 'text-secondary')}>
                    {group.label} <span className="text-caption-strong normal-case tracking-normal text-tertiary">{group.items.length}</span>
                  </h2>
                  <span className="h-px flex-grow bg-muted transition-colors duration-fast group-hover:bg-control" />
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {group.items.map((r) => renderCard(r))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
      <>
      {/* Categories */}
      <div ref={boardRef} className="space-y-6">
        <CategoryToolbar
          count={reminderCategories.length}
          isEditMode={isEditMode}
          onToggleEdit={toggleEditMode}
          anyExpanded={reminderCategories.some((c) => c.isExpanded)}
          onCollapseAll={collapseAllReminderCategories}
          onExpandAll={expandAllReminderCategories}
          sortValue={sortMode}
          sortOptions={REMINDER_SORT_OPTIONS}
          onSortChange={(mode) => (mode === 'custom' ? switchToCustom() : setSortMode(mode))}
        />

        {view.categories.map((cat) => {
          const catReminders = view.itemsByCategory[cat.id] || [];
          if (cat.id === 'allgemein' && catReminders.length === 0 && reminderCategories.length > 1 && !drag) {
            return null;
          }

          const isBeingDragged = drag?.kind === 'cat' && drag.id === cat.id;
          const isDraggingItem = drag?.kind === 'item';
          // Karte schwebt über dieser Kategorie (und stammt nicht aus ihr): Ablage-Hinweis
          const isCardHoveringThisCat = isDraggingItem && drag.catId === cat.id && drag.originCatId !== cat.id;

          return (
            <div
              key={cat.id}
              id={`rcat-sec-${cat.id}`}
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
                onClick={() => !isEditMode && toggleReminderCategory(cat.id)}
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
                          {cat.name} <span className="text-secondary text-caption">({catReminders.length})</span>
                        </h2>
                        {isCardHoveringThisCat && (
                          <span className="text-micro font-semibold text-primary bg-pressed border border-default px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                            <Icon name="arrow_downward" size="sm" />
                            Hier ablegen
                          </span>
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
                        openModal('reminder', { categoryId: cat.id });
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
                      moveReminderCategoryOrder(cat.id, 'up');
                    }}
                    className={isEditMode ? '' : 'hidden md:inline-flex'}
                  />
                  <IconButton
                    icon="keyboard_arrow_down"
                    label="Kategorie nach unten verschieben"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveReminderCategoryOrder(cat.id, 'down');
                    }}
                    className={isEditMode ? '' : 'hidden md:inline-flex'}
                  />
                  {cat.id !== 'allgemein' && (
                    <IconButton
                      icon="close"
                      label="Kategorie löschen"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); deleteReminderCategory(cat.id); }}
                      className={isEditMode ? 'hover:!bg-danger-subtle hover:!text-danger' : 'hidden hover:!bg-danger-subtle hover:!text-danger md:inline-flex'}
                    />
                  )}
                </div>
              </div>

              {/* Content grid – hidden in edit mode regardless of isExpanded state */}
              {cat.isExpanded && drag?.kind !== 'cat' && !isEditMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {catReminders.length > 0 ? (
                    catReminders.map((r) => renderCard(r, true))
                  ) : (
                    <div className={`col-span-full py-8 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
                      isCardHoveringThisCat
                        ? 'border-strong bg-pressed text-primary font-semibold'
                        : 'border-subtle text-secondary'
                    }`}>
                      <Icon name={isCardHoveringThisCat ? 'arrow_downward' : 'drag_indicator'} size="md" className="mr-2" />
                      {isCardHoveringThisCat ? 'Hier loslassen' : 'Erinnerungen hier ablegen'}
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
              placeholder="Name der Kategorie, z. B. Privat oder Einkaufen"
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
      </>
      )}
    </div>
  );
};

export default Reminders;
