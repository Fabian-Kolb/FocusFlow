import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';

const Reminders = ({ setCurrentScreen }) => {
  const { reminders, setSelectedReminderId } = useModalContext();

  const handleReminderClick = (reminderId) => {
    setSelectedReminderId(reminderId);
    setCurrentScreen('reminder-detail');
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
            className="flex flex-col justify-between h-[180px]"
            onClick={() => handleReminderClick(reminder.id)}
          >
            <div>
              <div className="marquee-wrapper mb-1">
                <h3 className="text-lg font-bold hover:underline leading-snug marquee-content">
                  {reminder.title}
                </h3>
              </div>
              <div className="flex justify-between items-center gap-2 mb-2">
                <p className="text-xs text-on-surface-variant font-mono truncate">
                  {reminder.dateRange} <span className="font-bold text-primary">({reminder.daysRemaining})</span>
                </p>
                {reminder.status && (
                  <Badge className={reminder.status === 'PAUSIERT' ? 'bg-amber-100 text-amber-900 border-amber-300' : reminder.status === 'ABGESCHLOSSEN' ? 'bg-neutral-100 text-neutral-800 border-neutral-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'}>
                    {reminder.status}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-outline-variant pt-3 mt-auto">
              <div>
                <div className="flex justify-between items-center text-[10px] mono text-on-surface-variant mb-1">
                  <span>VERSTRICHENE ZEIT</span>
                  <span>{reminder.timeElapsed}%</span>
                </div>
                <div className="w-full bg-surface-low h-1.5 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-neutral-400 h-full rounded-full" style={{ width: `${reminder.timeElapsed}%` }}></div>
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
