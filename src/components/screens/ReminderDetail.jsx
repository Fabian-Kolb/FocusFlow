import React from 'react';
import { useModalContext } from '../../context/ModalContext';

const ReminderDetail = ({ setCurrentScreen }) => {
  const { reminders, selectedReminderId, toggleReminderStatus, setReminderStatus, setActiveCoachScope } = useModalContext();

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
    if (status === 'PAUSIERT') return "bg-blue-100 text-blue-900 border-blue-400 ring-1 ring-blue-400 opacity-100";
    if (status === 'ABGESCHLOSSEN') return "bg-neutral-200 text-neutral-800 border-neutral-400 ring-1 ring-neutral-400 opacity-100";
    return "";
  };

  const getStatusDotClass = (status) => {
    if (status === 'GEPLANT') return "bg-amber-600";
    if (status === 'AKTIV') return "bg-emerald-600 animate-pulse";
    if (status === 'PAUSIERT') return "bg-blue-600";
    if (status === 'ABGESCHLOSSEN') return "bg-neutral-600";
  };

  return (
    <div className="screen-transition">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <button
            className="inline-flex items-center gap-2 text-xs font-mono text-on-surface-variant hover:text-primary mb-3 transition-colors cursor-pointer"
            onClick={() => setCurrentScreen && setCurrentScreen('reminders')}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Zurück zur Übersicht
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{reminder.title}</h1>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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

          {/* BOX 1: Zeitspanne & Balken */}
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-3 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase whitespace-nowrap">
                ZEITSPANNE
              </span>
              <div className="no-wrap-scroll text-[11px] sm:text-xs mono font-bold text-primary">
                <span>{reminder.dateRange} ({reminder.daysRemaining})</span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] sm:text-[11px] mono text-on-surface-variant mb-1 flex-wrap gap-1">
                  <span>VERSTRICHENE ZEIT: {reminder.timeElapsed}%</span>
                </div>
                <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${reminder.timeElapsed}%` }}></div>
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
                {['GEPLANT', 'AKTIV', 'PAUSIERT', 'ABGESCHLOSSEN'].map((s) => {
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
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-3 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase whitespace-nowrap">
                NOTIZEN & DETAILS
              </span>
            </div>
            
            <div className="pt-2 text-sm text-primary leading-relaxed whitespace-pre-wrap">
              {reminder.note || <span className="text-on-surface-variant italic">Keine Notizen hinterlegt.</span>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReminderDetail;
