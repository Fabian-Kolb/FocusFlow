import React, { useState, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import NotesSection from '../ui/NotesSection';

const ReminderDetail = ({ setCurrentScreen }) => {
  const { reminders, trashItems, selectedReminderId, openModal, toggleReminderStatus, setReminderStatus, setActiveCoachScope, toggleReminderPause, toggleReminderKanban, mutateReminder, reminderCategories } = useModalContext();
  const [isStructuring, setIsStructuring] = useState(false);

  const reminder = reminders.find(r => r.id === selectedReminderId) || (trashItems && trashItems.find(r => r.id === selectedReminderId));
  const isTrashed = !!reminder?.deletedAt;
  const categoryObj = (reminderCategories || []).find(c => c.id === (reminder?.categoryId || 'allgemein')) || { id: 'allgemein', name: 'Allgemein' };

  if (!reminder) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">notifications_off</span>
        <h2 className="text-xl font-bold mb-2">Erinnerung nicht gefunden</h2>
        <p className="mb-6">Die Erinnerung wurde möglicherweise gelöscht.</p>
        <button onClick={() => setCurrentScreen('reminders')} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold">Zurück zur Übersicht</button>
      </div>
    );
  }

  // States for Editing Dates
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editDate, setEditDate] = useState(reminder?.date || '');
  const [editTime, setEditTime] = useState(reminder?.time || '');

  // Reset local state if another reminder is selected
  useEffect(() => {
    if (reminder) {
      setEditDate(reminder.date || '');
      setEditTime(reminder.time || '');
    }
  }, [reminder]);

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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{reminder.title}</h1>
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
              
              <button
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl hover:bg-primary/20 text-primary font-mono text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                onClick={() => {
                  setActiveCoachScope(reminder.id);
                  if (setCurrentScreen) setCurrentScreen('coach');
                }}
                title="AI Coach für diese Erinnerung befragen"
              >
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                <span>AI COACH</span>
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
    </div>
  );
};

export default ReminderDetail;

