import React, { useState, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import NotesSection from '../ui/NotesSection';
import GlobalChatDrawer from '../ui/GlobalChatDrawer';
import FioIcon from '../ui/FioIcon';
import CalendarDesyncModal from '../modals/CalendarDesyncModal';

const ReminderDetail = ({ setCurrentScreen }) => {
  const {
    reminders,
    trashItems,
    selectedReminderId,
    openModal,
    toggleReminderStatus,
    setReminderStatus,
    setActiveCoachScope,
    toggleReminderPause,
    toggleReminderKanban,
    mutateReminder,
    reminderCategories,
    // Calendar Sync
    user,
    isCalendarConnected,
    isEntitySyncing,
    syncErrors,
    clearEntitySyncError,
    syncReminderToCalendar,
    desyncReminderFromCalendar
  } = useModalContext();
  const [isStructuring, setIsStructuring] = useState(false);
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [isDesyncModalOpen, setIsDesyncModalOpen] = useState(false);

  const reminder = reminders.find(r => r.id === selectedReminderId) || (trashItems && trashItems.find(r => r.id === selectedReminderId));
  const isTrashed = !!reminder?.deletedAt;
  const categoryObj = (reminderCategories || []).find(c => c.id === (reminder?.categoryId || 'allgemein')) || { id: 'allgemein', name: 'Allgemein' };

  // States for Editing Dates
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editDate, setEditDate] = useState(reminder?.date || '');
  const [editTime, setEditTime] = useState(reminder?.time || '');

  // States for Editing Title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(reminder?.title || '');

  // Reset local state if another reminder is selected
  useEffect(() => {
    if (reminder) {
      setEditDate(reminder.date || '');
      setEditTime(reminder.time || '');
      setEditTitle(reminder.title || '');
    }
  }, [reminder]);

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== reminder.title && mutateReminder && reminder) {
      mutateReminder(reminder.id, (rem) => ({
        ...rem,
        title: editTitle.trim()
      }));
    }
    setIsEditingTitle(false);
  };

  const handleSaveDates = () => {
    if (mutateReminder && reminder) {
      mutateReminder(reminder.id, (rem) => ({
        ...rem,
        date: editDate,
        time: editTime
      }));
    }
    setIsEditingDates(false);
  };

  const isSyncing = Boolean(reminder && isEntitySyncing && isEntitySyncing(reminder.id));

  const handleSyncToCalendar = async () => {
    if (!reminder || isSyncing || user?.isGuest || !isCalendarConnected) return;
    try {
      await syncReminderToCalendar(reminder.id);
    } catch (err) {
      console.error('Fehler beim Kalender-Sync:', err);
    }
  };

  const handleDesyncConfirm = async ({ deleteInGoogle }) => {
    if (!reminder) return;
    try {
      await desyncReminderFromCalendar(reminder.id, { deleteInGoogle });
      setIsDesyncModalOpen(false);
    } catch (err) {
      console.error('Fehler beim De-Synchronisieren:', err);
    }
  };

  if (!reminder) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="mb-4">Erinnerung nicht gefunden.</p>
        <button className="px-4 py-2 border rounded" onClick={() => setCurrentScreen('reminders')}>Zurück</button>
      </div>
    );
  }

  // Status style helper
  const getStatusButtonClass = (status, isActive) => {
    if (!isActive) {
      return "bg-surface-low text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary opacity-60 hover:opacity-100";
    }
    if (status === 'GEPLANT') return "bg-amber-100 text-amber-900 border-amber-400 ring-1 ring-amber-400 opacity-100";
    if (status === 'AKTIV') return "bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-400 opacity-100";
    if (status === 'ABGESCHLOSSEN') return "bg-neutral-200 text-neutral-800 border-neutral-400 ring-1 ring-neutral-400 opacity-100";
    return "";
  };

  const getStatusDotClass = (status) => {
    if (status === 'GEPLANT') return "bg-amber-600";
    if (status === 'AKTIV') return "bg-emerald-600 animate-pulse";
    if (status === 'ABGESCHLOSSEN') return "bg-neutral-600";
  };

  const handleStructureNotes = async () => {
    if (isStructuring) return;
    setIsStructuring(true);
    // Simulate AI processing
    setTimeout(() => {
      setIsStructuring(false);
    }, 2000);
  };

  const handleAddNote = (note) => {
    mutateReminder(reminder.id, (r) => ({
      ...r,
      notes: [...(r.notes || []), note]
    }));
  };

  const handleUpdateNote = (noteId, updatedData) => {
    mutateReminder(reminder.id, (r) => ({
      ...r,
      notes: (r.notes || []).map(n => n.id === noteId ? { ...n, ...updatedData } : n)
    }));
  };

  const handleDeleteNote = (noteId) => {
    mutateReminder(reminder.id, (r) => ({
      ...r,
      notes: (r.notes || []).filter(n => n.id !== noteId)
    }));
  };

  // Date parsing and calculation
  let dateText = reminder.date || 'Demnächst';
  let daysRemainingText = '';
  let isOverdue = false;
  let isToday = false;
  let isCompleted = reminder.status === 'ABGESCHLOSSEN';
  let timeElapsed = 50;

  if (reminder.date && reminder.date !== 'Demnächst' && reminder.date !== 'Heute' && reminder.date !== 'Morgen') {
    // Attempt to parse YYYY-MM-DD
    const targetDate = new Date(`${reminder.date}T${reminder.time || '00:00'}`);
    if (!isNaN(targetDate)) {
      const now = new Date();
      // Set hours to 0 to only compare days if time isn't strict, but here time matters
      const diffMs = targetDate - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      if (reminder.createdAt) {
          const start = reminder.createdAt;
          const end = targetDate.getTime();
          const nowTime = Date.now();
          if (nowTime >= end) timeElapsed = 100;
          else if (nowTime <= start) timeElapsed = 0;
          else timeElapsed = Math.round(((nowTime - start) / (end - start)) * 100);
      }
      if (!isCompleted) {
        if (diffDays < 0) {
          daysRemainingText = `${Math.abs(diffDays)} Tage überfällig`;
          isOverdue = true;
        } else if (diffDays === 0) {
          daysRemainingText = 'Heute fällig';
          isToday = true;
        } else if (diffDays === 1) {
          daysRemainingText = 'Morgen fällig';
        } else {
          daysRemainingText = `In ${diffDays} Tagen`;
        }
      }
      
      dateText = targetDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (reminder.time) {
        dateText += ` • ${reminder.time} Uhr`;
      }
    }
  } else if (reminder.date === 'Heute') {
      dateText = `Heute${reminder.time ? ` • ${reminder.time} Uhr` : ''}`;
      daysRemainingText = 'Heute fällig';
      if (!isCompleted) isToday = true;
  } else if (reminder.date === 'Morgen') {
      dateText = `Morgen${reminder.time ? ` • ${reminder.time} Uhr` : ''}`;
      daysRemainingText = 'Morgen fällig';
  }

  return (
    <div className="screen-transition">
      {reminder.isPaused && (
        <div className="fixed top-0 left-0 right-0 h-64 sm:h-80 bg-gradient-to-b from-blue-200/70 via-blue-100/25 to-transparent pointer-events-none z-0" />
      )}
      <div className="w-full mx-auto space-y-4 sm:space-y-6 relative z-10">
        <div>
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1.5 text-xs font-mono text-on-surface-variant mb-4 flex-wrap bg-surface-low/60 p-2.5 rounded-xl border border-outline-variant/60">
            <button
              onClick={() => setCurrentScreen && setCurrentScreen('reminders')}
              className="hover:text-primary transition-colors flex items-center gap-1 font-bold text-on-surface-variant hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Übersicht
            </button>
            <span className="text-outline-variant font-bold">/</span>
            <div className="inline-flex items-center gap-1">
              <button
                onClick={() => {
                  if (setCurrentScreen) {
                    setCurrentScreen('reminders');
                    setTimeout(() => {
                      const el = document.getElementById(`rcat-sec-${categoryObj.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }
                }}
                className="hover:text-primary transition-colors text-on-surface-variant hover:underline font-medium cursor-pointer"
              >
                {categoryObj.name}
              </button>
              <button
                onClick={() => openModal('moveCategory', { type: 'reminder', itemId: reminder.id, currentCategoryId: reminder.categoryId })}
                className="p-1 hover:bg-surface-low text-on-surface-variant hover:text-primary rounded-lg transition-colors cursor-pointer flex items-center"
                title="Kategorie ändern"
              >
                <span className="material-symbols-outlined text-[15px]">folder_open</span>
              </button>
            </div>
            <span className="text-outline-variant font-bold">/</span>
            <span className="font-bold text-primary truncate max-w-[200px] sm:max-w-xs">
              {reminder.title}
            </span>
          </nav>

          {isTrashed && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 mt-0.5">delete</span>
              <div>
                <p className="font-bold text-sm">Erinnerung im Papierkorb</p>
                <p className="text-xs mt-1">Diese Erinnerung wurde gelöscht. Um sie wieder richtig zu bearbeiten, stelle sie im Papierkorb wieder her.</p>
              </div>
            </div>
          )}

          {/* Read-Only Wrapper for Trashed Items */}
          <div className={isTrashed ? 'pointer-events-none opacity-60 grayscale-[0.2]' : ''}>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 flex-1 max-w-xl">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') {
                          setEditTitle(reminder.title || '');
                          setIsEditingTitle(false);
                        }
                      }}
                      className="text-2xl sm:text-3xl font-bold leading-tight px-2 py-1 border border-primary rounded-xl bg-surface-low focus:bg-white focus:outline-none w-full"
                    />
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSaveTitle();
                      }}
                      className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                      title="Speichern"
                    >
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEditTitle(reminder.title || '');
                        setIsEditingTitle(false);
                      }}
                      className="p-1.5 bg-surface-low text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Abbrechen"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-2 flex-wrap">
                    <h1 
                      onClick={() => !isTrashed && setIsEditingTitle(true)}
                      className={`text-2xl sm:text-3xl font-bold leading-tight cursor-pointer hover:underline decoration-primary/40 underline-offset-4 ${isTrashed ? 'cursor-default hover:no-underline' : ''}`}
                      title={isTrashed ? '' : 'Klicken zum Umbenennen'}
                    >
                      {reminder.title}
                    </h1>
                    {!isTrashed && (
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-on-surface-variant hover:text-primary hover:bg-surface-low rounded-lg cursor-pointer"
                        title="Erinnerung umbenennen"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all shadow-sm cursor-pointer ${
                  reminder.isPaused
                    ? 'bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200'
                    : 'bg-white border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary'
                }`}
                onClick={() => toggleReminderPause(reminder.id)}
                title={reminder.isPaused ? 'Fortsetzen' : 'Pausieren'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {reminder.isPaused ? 'play_arrow' : 'pause'}
                </span>
              </button>
              
              {/* Kanban Toggle Button */}
              <button
                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all shadow-sm cursor-pointer ${
                  reminder.inKanban !== false
                    ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20'
                    : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'
                }`}
                onClick={() => toggleReminderKanban(reminder.id)}
                title={reminder.inKanban !== false ? 'Vom Kanban-Board ausblenden' : 'Auf Kanban-Board einblenden'}
              >
                <div className="relative inline-flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                  {reminder.inKanban === false && (
                    <span className="absolute text-slate-600 font-bold text-xs select-none pointer-events-none transform rotate-45">
                      —
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* BOX 1: Zeitspanne & Balken-System */}
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-3 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase whitespace-nowrap">
                ZEITSPANNE & BALKEN-SYSTEM
              </span>
              <div className="flex items-center gap-2">
                {isEditingDates ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      className="text-[10px] sm:text-[11px] border border-outline-variant rounded px-1 py-0.5 outline-none focus:border-primary" 
                      value={editDate} 
                      onChange={(e) => setEditDate(e.target.value)} 
                    />
                    <input 
                      type="time" 
                      className="text-[10px] sm:text-[11px] border border-outline-variant rounded px-1 py-0.5 outline-none focus:border-primary" 
                      value={editTime} 
                      onChange={(e) => setEditTime(e.target.value)} 
                    />
                    <button onClick={handleSaveDates} className="text-primary hover:bg-surface-low rounded p-0.5 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                    <button onClick={() => setIsEditingDates(false)} className="text-red-500 hover:bg-red-50 rounded p-0.5 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="no-wrap-scroll text-[11px] sm:text-xs mono font-bold text-primary">
                      <span>{dateText} {daysRemainingText && `(${daysRemainingText})`}</span>
                    </div>
                    <button onClick={() => setIsEditingDates(true)} className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-0.5" title="Datum bearbeiten">
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] sm:text-[11px] mono text-on-surface-variant mb-1 flex-wrap gap-1">
                  <span>VERSTRICHENE ZEIT: {timeElapsed}%</span>
                  <span>{daysRemainingText || 'Demnächst'}</span>
                </div>
                <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${timeElapsed}%` }}></div>
                </div>
              </div>
            </div>

            {/* Kalender-Synchronisation Leiste */}
            <div className="pt-3 border-t border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                <span className="text-xs font-mono font-bold text-on-surface">
                  GOOGLE KALENDER:
                </span>
                {reminder.isCalendarSynced ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Synchronisiert
                  </span>
                ) : (
                  <span className="text-[11px] text-on-surface-variant">
                    Nicht synchronisiert
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {reminder.isCalendarSynced ? (
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => setIsDesyncModalOpen(true)}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold text-on-surface-variant hover:text-red-600 hover:bg-red-50 border border-outline-variant hover:border-red-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Synchronisation trennen"
                  >
                    <span className="material-symbols-outlined text-[14px]">sync_disabled</span>
                    <span>Trennen</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSyncing || user?.isGuest || !isCalendarConnected}
                    onClick={handleSyncToCalendar}
                    title={
                      user?.isGuest
                        ? 'Im Gastmodus nicht verfügbar'
                        : !isCalendarConnected
                        ? 'Google Kalender ist nicht verbunden'
                        : 'Mit Google Kalender synchronisieren'
                    }
                    className="px-3 py-1.5 text-xs font-mono font-bold text-white bg-primary hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? (
                      <>
                        <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                        <span>Synchronisiere...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[14px]">sync</span>
                        <span>Mit Kalender synchronisieren</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Error & Retry Banner */}
            {syncErrors && syncErrors[reminder.id] && (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-700">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-red-600 shrink-0">error</span>
                  <span className="truncate">{syncErrors[reminder.id].message}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSyncToCalendar}
                    className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-md transition-colors cursor-pointer"
                  >
                    Wiederholen
                  </button>
                  <button
                    type="button"
                    onClick={() => clearEntitySyncError && clearEntitySyncError(reminder.id)}
                    className="p-0.5 hover:bg-red-100 rounded text-red-600"
                    title="Fehlermeldung schließen"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* BOX 1.5: TRACKING & STATUS */}
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-4 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase">
                TRACKING & STATUS
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full h-full">
                {['GEPLANT', 'AKTIV', 'ABGESCHLOSSEN'].map((s) => {
                  const isActive = reminder.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (setReminderStatus) setReminderStatus(reminder.id, s);
                      }}
                      className={`flex-1 h-full inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 border rounded-xl font-mono text-[10px] sm:text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap ${getStatusButtonClass(s, isActive)}`}
                    >
                      <span>{s === 'ABGESCHLOSSEN' ? 'ERLEDIGT' : s}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BOX 2: Notizen */}
          <NotesSection 
            notes={reminder.notes || []}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />

        </div>
        
        {/* End of Read-Only Wrapper */}
        </div>
      </div>

      {/* Global Fio AI Chat Drawer for Reminder */}
      <GlobalChatDrawer 
        isOpen={isGlobalChatOpen}
        onClose={() => setIsGlobalChatOpen(false)}
        projectData={null}
        contextScope="reminder"
        contextData={reminder}
      />

      {/* Floating Action Speech Bubble (FAB) for Fio */}
      {!isGlobalChatOpen && (
        <button
          onClick={() => setIsGlobalChatOpen(true)}
          title="Fio (KI-Coach) für diese Erinnerung öffnen"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-13 sm:h-13 flex items-center justify-center bg-neutral-900 text-white rounded-2xl rounded-br-[3px] shadow-2xl hover:shadow-primary/30 border border-neutral-700/60 hover:bg-black hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer p-3"
        >
          <FioIcon className="w-full h-full text-white group-hover:scale-110 transition-transform" color="currentColor" />
        </button>
      )}

      {/* Calendar De-Sync Confirmation Modal */}
      <CalendarDesyncModal
        isOpen={isDesyncModalOpen}
        title={reminder.title}
        type="Erinnerung"
        isLoading={isSyncing}
        onClose={() => setIsDesyncModalOpen(false)}
        onConfirm={handleDesyncConfirm}
      />
    </div>
  );
};

export default ReminderDetail;

