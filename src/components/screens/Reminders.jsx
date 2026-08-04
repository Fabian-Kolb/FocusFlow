import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';

const Reminders = ({ setCurrentScreen }) => {
  const { reminders, setSelectedReminderId, toggleReminderStatus } = useModalContext();

  const handleReminderClick = (reminderId) => {
    setSelectedReminderId(reminderId);
    setCurrentScreen('reminder-detail');
  };

  const handleToggleStatus = (e, reminderId) => {
    e.stopPropagation();
    toggleReminderStatus(reminderId);
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
        <Button>
          Neue Erinnerung
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {reminders.map((reminder) => (
          <Card
            key={reminder.id}
            interactive
            className={`flex flex-col justify-between h-[160px] ${reminder.status === 'inactive' ? 'opacity-60' : ''}`}
            onClick={() => handleReminderClick(reminder.id)}
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className={`text-base font-bold leading-snug ${reminder.status === 'inactive' ? 'line-through text-on-surface-variant' : ''}`}>
                  {reminder.title}
                </h3>
                <button
                  onClick={(e) => handleToggleStatus(e, reminder.id)}
                  className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-colors ${
                    reminder.status === 'inactive' 
                      ? 'bg-primary border-primary text-on-primary' 
                      : 'border-outline-variant hover:border-primary text-transparent hover:text-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    check
                  </span>
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[14px] text-primary">
                  event
                </span>
                <span className="text-xs font-mono font-bold text-primary">
                  {reminder.date}
                </span>
              </div>
            </div>

            <div className="border-t border-outline-variant pt-2 mt-auto">
              <p className="text-xs text-on-surface-variant truncate">
                {reminder.note || "Keine Notiz"}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reminders;
