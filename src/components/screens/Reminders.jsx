import React, { useState, useRef } from 'react';
import { useBoardSort, LIFT_CLASS } from '../ui/useBoardSort';
import { groupByCategory, sortItems, REMINDER_SORT_OPTIONS } from '../../lib/itemOrder';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import { ReminderCardContent } from '../ui/ItemCardContent';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
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
          className: 'bg-emerald-600',
          onCommit: () => setReminderStatus(reminder.id, reminder.status === 'ABGESCHLOSSEN' ? 'AKTIV' : 'ABGESCHLOSSEN')
        }}
        left={{
          label: 'Papierkorb',
          icon: 'delete',
          className: 'bg-red-600',
          dismiss: true,
          onCommit: () => deleteReminder(reminder.id)
        }}
      >
      <Card
        interactive
        padding="small"
        className={`flex flex-col h-full transition-all ${reminder.status === 'ABGESCHLOSSEN' ? 'opacity-60' : ''} ${
          reminder.isPaused
            ? '!bg-blue-100 !border-blue-300 ring-1 ring-blue-300/40'
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
    <div className="screen-transition pb-20">
      <ListToolbar
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
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">push_pin</span> Angepinnt
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {pinnedReminders.map((r) => renderCard(r))}
          </div>
        </div>
      )}

      {viewMode === 'time' ? (
        <div className="space-y-5">
          {timeGroups.length === 0 && (
            <div className="py-10 border-2 border-dashed border-outline-variant rounded-xl text-center text-sm text-on-surface-variant">
              Keine Erinnerungen{searchQuery || statusFilter !== 'all' ? ' für diesen Filter' : ''}.
            </div>
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
                  className="w-full flex items-center gap-2 mb-2 py-1 text-left group cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${collapsed ? '' : 'rotate-90'}`}>
                    chevron_right
                  </span>
                  <span className={`material-symbols-outlined text-[18px] ${isOverdue ? 'text-red-600' : 'text-on-surface-variant'}`}>
                    {group.icon}
                  </span>
                  <h2 id={`tgroup-${group.id}`} className={`text-sm font-bold tracking-wider uppercase ${isOverdue ? 'text-red-700' : ''}`}>
                    {group.label} <span className="text-on-surface-variant font-normal text-xs">({group.items.length})</span>
                  </h2>
                  <span className="h-px bg-outline-variant flex-grow opacity-50 group-hover:bg-primary/50 transition-colors" />
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
                onClick={() => !isEditMode && toggleReminderCategory(cat.id)}
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
                          {cat.name} <span className="text-on-surface-variant font-normal text-xs">({catReminders.length})</span>
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
                        openModal('reminder', { categoryId: cat.id });
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
                      moveReminderCategoryOrder(cat.id, 'up');
                    }}
                    className={`p-2 md:p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors ${isEditMode ? '' : 'hidden md:inline-flex'}`}
                    title="Kategorie nach oben verschieben"
                  >
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveReminderCategoryOrder(cat.id, 'down');
                    }}
                    className={`p-2 md:p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors ${isEditMode ? '' : 'hidden md:inline-flex'}`}
                    title="Kategorie nach unten verschieben"
                  >
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                  </button>
                  {cat.id !== 'allgemein' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteReminderCategory(cat.id); }}
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
                  {catReminders.length > 0 ? (
                    catReminders.map((r) => renderCard(r, true))
                  ) : (
                    <div className={`col-span-full py-8 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors ${
                      isCardHoveringThisCat
                        ? 'border-primary bg-primary/15 text-primary font-bold shadow-inner'
                        : 'border-outline-variant text-on-surface-variant'
                    }`}>
                      <span className="material-symbols-outlined mr-2 text-[18px]">
                        {isCardHoveringThisCat ? 'arrow_downward' : 'drag_indicator'}
                      </span>
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
            className="flex items-center gap-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2 text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="font-bold text-sm tracking-wider uppercase">Neue Kategorie:</span>
            </div>
            <Input 
              type="text" 
              placeholder="Name eingeben (z. B. Privat, Einkaufen)..." 
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
      </>
      )}
    </div>
  );
};

export default Reminders;
