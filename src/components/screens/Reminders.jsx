import React, { useState, useEffect } from 'react';
import { useCategoryDrag } from '../ui/useCategoryDrag';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import CardContextMenu from '../ui/CardContextMenu';

const Reminders = ({ setCurrentScreen }) => {
  const { 
    reminders, 
    openModal,
    setSelectedReminderId, 
    toggleReminderStatus, 
    toggleReminderPause,
    deleteReminder,
    toggleReminderKanban,
    reminderCategories,
    addReminderCategory,
    toggleReminderCategory,
    deleteReminderCategory,
    updateReminderCategory,
    moveReminderToCategory,
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

  const { draggedCatId, startDrag } = useCategoryDrag({
    categories: reminderCategories,
    reorderCategories: reorderReminderCategories,
    collapseAll: collapseAllReminderCategories,
    onDragEnd: restoreReminderCategoryExpandStates,
    sectionIdPrefix: 'rcat-sec-',
  });

  const handleDragStart = (e, reminderId) => {
    e.dataTransfer.setData('text/plain', reminderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, categoryId) => {
    e.preventDefault();
    const reminderId = e.dataTransfer.getData('text/plain');
    if (reminderId) {
      moveReminderToCategory(reminderId, categoryId);
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



  const createCategory = async () => {
    if (newCategoryName.trim()) {
      await addReminderCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const renderCard = (reminder) => (
    <div
      key={reminder.id}
      draggable
      onDragStart={(e) => handleDragStart(e, reminder.id)}
      className="cursor-grab active:cursor-grabbing"
    >
      <Card
        interactive
        className={`flex flex-col justify-between transition-all h-full ${
          reminder.isPaused 
            ? '!bg-blue-100 !border-blue-300 ring-1 ring-blue-300/40' 
            : ''
        }`}
        onClick={() => handleReminderClick(reminder.id)}
      >
        {reminder.inKanban === false && (
          <div 
            className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-white z-10 shadow-sm"
            title="Nicht im Kanban-Board"
          />
        )}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="marquee-wrapper flex-1">
              <h3 className="text-base sm:text-lg font-bold hover:underline leading-snug marquee-content">
                {reminder.title}
              </h3>
            </div>
            <CardContextMenu
              isPaused={reminder.isPaused}
              onTogglePause={() => toggleReminderPause(reminder.id)}
              inKanban={reminder.inKanban}
              onToggleKanban={() => toggleReminderKanban(reminder.id)}
              onDelete={() => deleteReminder(reminder.id)}
              itemType="reminder"
              itemId={reminder.id}
              currentCategoryId={reminder.categoryId}
              itemStatus={reminder.status}
            />
          </div>
          <div className="mb-2 sm:mb-3">
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
              {reminder.dateRange} <span className="font-bold text-primary">({reminder.daysRemaining})</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 border-t border-outline-variant pt-2 sm:pt-3 mt-auto">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {reminder.status && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleReminderStatus(reminder.id);
                }}
                className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg border text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${getStatusStyle(reminder.status)}`}
                title="Klicken um Status zu wechseln"
              >
                {reminder.status === 'LAUFEND' ? 'AKTIV' : reminder.status === 'ABGESCHLOSSEN' ? 'ERLEDIGT' : reminder.status}
              </button>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center text-[8px] sm:text-[10px] mono text-on-surface-variant mb-1">
              <span>VERSTRICHENE ZEIT</span>
              <span>{reminder.timeElapsed}%</span>
            </div>
            <div className="w-full bg-surface-low h-1.5 sm:h-2 border border-outline-variant rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: `${reminder.timeElapsed}%` }}></div>
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
              placeholder="Erinnerungen durchsuchen..."
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
            <Button onClick={() => openModal('reminder')}>
              Neue Erinnerung
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

      {pinnedReminders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">push_pin</span> Angepinnt
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {pinnedReminders.map(renderCard)}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Kategorien ({reminderCategories.length})
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
              onClick={collapseAllReminderCategories}
              className="text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant hover:border-primary/50 cursor-pointer"
              title="Alle Kategorien einklappen"
            >
              <span className="material-symbols-outlined text-[14px]">unfold_less</span>
              Alle einklappen
            </button>
            <button
              onClick={expandAllReminderCategories}
              className="text-[11px] font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant hover:border-primary/50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">unfold_more</span>
              Alle ausklappen
            </button>
          </div>
        </div>

        {reminderCategories && reminderCategories.map((cat) => {
          const catReminders = otherReminders.filter(r => (r.categoryId || 'allgemein') === cat.id);
          if (cat.id === 'allgemein' && catReminders.length === 0 && reminderCategories.length > 1) {
            return null;
          }

          return (
            <div 
              key={cat.id} 
              id={`rcat-sec-${cat.id}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, cat.id)}
              className={`rounded-xl transition-all duration-150 border p-2 -m-1 scroll-mt-6 ${
                draggedCatId === cat.id 
                  ? 'border-primary ring-2 ring-primary/40 bg-surface shadow-md opacity-60 scale-[0.99]' 
                  : 'border-transparent'
              }`}
            >
              {/* Steam-Like Header */}
              <div 
                className="flex items-center gap-3 cursor-pointer group mb-2 select-none py-1"
                onClick={() => toggleReminderCategory(cat.id)}
              >
                <div className="flex items-center gap-1.5 text-on-surface hover:text-primary transition-colors shrink-0">
                  {/* Drag Handle */}
                  <span 
                    onPointerDown={(e) => startDrag(e, cat.id)}
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
                      {cat.name} <span className="text-on-surface-variant font-normal text-xs">({catReminders.length})</span>
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
                      moveReminderCategoryOrder(cat.id, 'up');
                    }}
                    className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors"
                    title="Kategorie nach oben verschieben"
                  >
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveReminderCategoryOrder(cat.id, 'down');
                    }}
                    className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded transition-colors"
                    title="Kategorie nach unten verschieben"
                  >
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                  </button>
                  {cat.id !== 'allgemein' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteReminderCategory(cat.id); }}
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
                  {catReminders.length > 0 ? (
                    catReminders.map(renderCard)
                  ) : (
                    <div className="col-span-full py-8 border-2 border-dashed border-outline-variant rounded-xl flex items-center justify-center text-on-surface-variant">
                      Erinnerungen hier ablegen
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
    </div>
  );
};

export default Reminders;
