import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import CardContextMenu from '../ui/CardContextMenu';

const Reminders = ({ setCurrentScreen }) => {
  const { 
    reminders, 
    setSelectedReminderId, 
    toggleReminderStatus, 
    toggleReminderPause,
    deleteReminder,
    toggleReminderKanban
  } = useModalContext();

  const handleReminderClick = (reminderId) => {
    setSelectedReminderId(reminderId);
    setCurrentScreen('reminder-detail');
  };

  const getStatusStyle = (status) => {
    if (status === 'GEPLANT') {
      return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
    }
    if (status === 'ABGESCHLOSSEN') {
      return 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
  };

  return (
    <div className="screen-transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="relative flex-grow max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <Input
            type="text"
            className="pl-10"
            placeholder="Erinnerungen durchsuchen..."
          />
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {reminders.map((reminder) => (
          <Card
            key={reminder.id}
            interactive
            className={`flex flex-col justify-between transition-all ${
              reminder.isPaused 
                ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-300/40' 
                : reminder.inKanban === false
                ? 'bg-purple-50/50 border-purple-300 ring-1 ring-purple-300/40'
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
                />
              </div>
              <div className="mb-2 sm:mb-3">
                <p className="text-[10px] sm:text-xs text-on-surface-variant font-mono truncate">
                  {reminder.dateRange} <span className="font-bold text-primary">({reminder.daysRemaining})</span>
                </p>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3 border-t border-outline-variant pt-2 sm:pt-3 mt-1">
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
        ))}
      </div>
    </div>
  );
};

export default Reminders;
