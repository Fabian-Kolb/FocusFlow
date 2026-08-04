import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Button from '../ui/Button';

const ReminderDetail = ({ setCurrentScreen }) => {
  const { reminders, selectedReminderId, toggleReminderStatus } = useModalContext();

  const reminder = reminders.find(r => r.id === selectedReminderId);

  if (!reminder) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="mb-4">Erinnerung nicht gefunden.</p>
        <Button onClick={() => setCurrentScreen('reminders')}>Zurück zur Übersicht</Button>
      </div>
    );
  }

  const isCompleted = reminder.status === 'inactive';

  return (
    <div className="screen-transition max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setCurrentScreen('reminders')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-low border border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-2xl font-bold font-mono tracking-tight">Erinnerung Details</h2>
      </div>

      <Card className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b border-outline-variant">
          <div>
            <h1 className={`text-2xl font-bold leading-tight mb-2 ${isCompleted ? 'line-through text-on-surface-variant' : ''}`}>
              {reminder.title}
            </h1>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">
                event
              </span>
              <span className="text-sm font-mono font-bold text-primary">
                Fällig am: {reminder.date}
              </span>
            </div>
          </div>

          <Button
            variant={isCompleted ? 'outline' : 'primary'}
            onClick={() => toggleReminderStatus(reminder.id)}
            className="shrink-0"
          >
            {isCompleted ? 'Reaktivieren' : 'Erledigen'}
          </Button>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-2">Notizen</h3>
          <div className="bg-surface-low p-4 rounded-xl border border-outline-variant min-h-[120px]">
            {reminder.note ? (
              <p className="whitespace-pre-wrap">{reminder.note}</p>
            ) : (
              <p className="text-on-surface-variant italic">Keine Notizen hinterlegt.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReminderDetail;
