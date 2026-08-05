import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';

const ReminderDetail = ({ setCurrentScreen }) => {
  const { reminders, selectedReminderId, toggleReminderStatus, setReminderStatus, setActiveCoachScope, toggleReminderPause } = useModalContext();
  const [isStructuring, setIsStructuring] = useState(false);

  const reminder = reminders.find(r => r.id === selectedReminderId);

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

  const handleStructureNotes = () => {
    setIsStructuring(true);
    // Dummy simulate AI delay for now
    setTimeout(() => {
      setIsStructuring(false);
      alert('Diese Funktion wird in Kürze mit dem Google Gemini Backend verknüpft!');
    }, 1500);
  };

  // Date parsing and calculation
  let dateText = reminder.date || 'Demnächst';
  let daysRemainingText = '';
  let isOverdue = false;
  let isToday = false;
  let isCompleted = reminder.status === 'ABGESCHLOSSEN';

  if (reminder.date && reminder.date !== 'Demnächst' && reminder.date !== 'Heute' && reminder.date !== 'Morgen') {
    // Attempt to parse YYYY-MM-DD
    const targetDate = new Date(`${reminder.date}T${reminder.time || '00:00'}`);
    if (!isNaN(targetDate)) {
      const now = new Date();
      // Set hours to 0 to only compare days if time isn't strict, but here time matters
      const diffMs = targetDate - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
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
      <div className="w-full mx-auto space-y-4 sm:space-y-6">
        <div>
          <button
            className="inline-flex items-center gap-2 text-xs font-mono text-on-surface-variant hover:text-primary mb-3 transition-colors cursor-pointer"
            onClick={() => setCurrentScreen && setCurrentScreen('reminders')}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Zurück zur Übersicht
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{reminder.title}</h1>
                {reminder.isPaused && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-400 ring-1 ring-blue-400 rounded-lg text-[10px] font-mono font-bold tracking-wider">
                    PAUSIERT
                  </span>
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

          {/* BOX 1: Fälligkeit */}
          <div className={`p-3.5 sm:p-5 border rounded-xl space-y-3 shadow-sm mb-4 transition-colors duration-300 ${isOverdue ? 'bg-red-50 border-red-200' : isToday ? 'bg-amber-50 border-amber-200' : isCompleted ? 'bg-surface-low border-outline-variant opacity-80' : 'bg-white border-outline-variant'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <div className="flex items-center gap-2">
                 <span className={`material-symbols-outlined text-[18px] ${isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-primary'}`}>
                    {isCompleted ? 'check_circle' : isOverdue ? 'error' : 'event'}
                 </span>
                 <span className={`text-xs font-mono font-bold uppercase whitespace-nowrap ${isOverdue ? 'text-red-700' : isToday ? 'text-amber-700' : 'text-primary'}`}>
                   FÄLLIGKEIT
                 </span>
              </div>
              <div className={`text-[12px] sm:text-sm mono font-bold ${isOverdue ? 'text-red-700' : isToday ? 'text-amber-700' : 'text-primary'}`}>
                <span>{dateText} {daysRemainingText && `(${daysRemainingText})`}</span>
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
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl shadow-sm mb-4 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-3 mb-3">
              <span className="text-xs font-mono font-bold text-primary uppercase whitespace-nowrap">
                NOTIZEN & DETAILS
              </span>
              
              {(reminder.description || reminder.note) && (
                <button
                  onClick={handleStructureNotes}
                  disabled={isStructuring}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 text-primary font-mono text-[10px] font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50"
                  title="Strukturiert den Text mithilfe von KI in Aufgaben, Kontext und Links"
                >
                  {isStructuring ? (
                    <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  )}
                  <span>MIT KI STRUKTURIEREN</span>
                </button>
              )}
            </div>
            
            <div className="pt-1 flex-1">
              {reminder.structuredNotes ? (
                 <div className="space-y-4">
                    {/* Placeholder for future structured notes render */}
                    <div className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                      {reminder.structuredNotes}
                    </div>
                 </div>
              ) : reminder.description || reminder.note ? (
                 <div className="text-sm text-primary leading-relaxed whitespace-pre-wrap bg-surface-low/30 p-3 rounded-lg border border-outline-variant/30">
                   {reminder.description || reminder.note}
                 </div>
              ) : (
                 <div className="flex flex-col items-center justify-center py-6 text-on-surface-variant opacity-60">
                   <span className="material-symbols-outlined text-3xl mb-2">description</span>
                   <span className="italic text-sm">Keine Notizen oder Beschreibung hinterlegt.</span>
                 </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReminderDetail;

