import React from 'react';
import { useModalContext } from '../../context/ModalContext';

const ReminderDetail = ({ setCurrentScreen }) => {
  const { reminders, selectedReminderId, toggleReminderStatus } = useModalContext();

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
  const getStatusBadgeStyle = (status) => {
    if (status === 'PAUSIERT') {
      return {
        btnClass: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100',
        dotClass: 'bg-amber-600',
        text: 'STATUS: PAUSIERT',
        iconClass: 'text-amber-800'
      };
    }
    if (status === 'ABGESCHLOSSEN') {
      return {
        btnClass: 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200',
        dotClass: 'bg-neutral-500',
        text: 'STATUS: ABGESCHLOSSEN',
        iconClass: 'text-neutral-700'
      };
    }
    return {
      btnClass: 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100',
      dotClass: 'bg-emerald-600 animate-pulse',
      text: 'STATUS: AKTIV',
      iconClass: 'text-emerald-800'
    };
  };

  const statusStyle = getStatusBadgeStyle(reminder.status);

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
                className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 border rounded-xl font-mono text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap ${statusStyle.btnClass}`}
                onClick={() => toggleReminderStatus(reminder.id)}
                title="Klicken um Status zu wechseln"
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusStyle.dotClass}`}></span>
                <span>{statusStyle.text}</span>
                <span className={`material-symbols-outlined text-[14px] flex-shrink-0 ${statusStyle.iconClass}`}>
                  unfold_more
                </span>
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
                <div className="w-full bg-surface-low h-1.5 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-neutral-400 h-full transition-all duration-300" style={{ width: `${reminder.timeElapsed}%` }}></div>
                </div>
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
