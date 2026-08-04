import React, { useState } from 'react';
import { calendarTimeline, calendarEvents } from '../../data/mockData';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const Calendar = () => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(4);
  const [currentYear, setCurrentYear] = useState(2024);
  const [selectedDay, setSelectedDay] = useState(8);

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleResetToday = () => {
    setCurrentMonthIndex(4);
    setCurrentYear(2024);
    setSelectedDay(8);
  };

  const prevMonthDays = [29, 30];
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const nextMonthDays = [1, 2];

  return (
    <div className="screen-transition">
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">
            {MONTH_NAMES[currentMonthIndex]} {currentYear}
          </h2>
          <Badge className="hidden sm:inline-flex">READ-ONLY</Badge>
        </div>
        <div className="flex border border-outline-variant bg-white rounded-lg overflow-hidden">
          <button
            className="px-2.5 sm:px-3 py-1.5 hover:bg-surface-low transition-colors border-r border-outline-variant cursor-pointer"
            onClick={handlePrevMonth}
            title="Vorheriger Monat"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            className="px-3 sm:px-4 py-1.5 font-mono text-xs font-bold bg-surface-low cursor-pointer hover:bg-surface transition-colors"
            onClick={handleResetToday}
          >
            HEUTE
          </button>
          <button
            className="px-2.5 sm:px-3 py-1.5 hover:bg-surface-low transition-colors border-l border-outline-variant cursor-pointer"
            onClick={handleNextMonth}
            title="Nächster Monat"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 overflow-x-auto">
          <Card padding="none" className="min-w-[500px] grid grid-cols-7 bg-outline-variant gap-px overflow-hidden">
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">MO</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">DI</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">MI</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">DO</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">FR</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">SA</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">SO</div>

            {prevMonthDays.map((dayNum) => (
              <div key={`prev-${dayNum}`} className="bg-white/40 h-24 p-2 text-xs mono opacity-40">
                {dayNum}
              </div>
            ))}

            {daysInMonth.map((dayNum) => {
              const isSelected = dayNum === selectedDay && currentMonthIndex === 4 && currentYear === 2024;
              const dayEvents = (currentMonthIndex === 4 && currentYear === 2024) ? calendarEvents[dayNum] : null;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-24 p-2 text-xs mono cursor-pointer border transition-colors rounded-md ${
                    isSelected
                      ? 'bg-surface-low border-2 border-primary rounded-md z-10'
                      : 'bg-white hover:border-primary border-transparent'
                  }`}
                  onClick={() => setSelectedDay(dayNum)}
                >
                  <div className="flex justify-between items-center">
                    <span className={isSelected ? 'font-bold' : ''}>{dayNum}</span>
                    {isSelected && <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>}
                  </div>
                  {dayEvents && dayEvents.map((evt) => (
                    <div key={evt.id} className="mt-2 p-1 bg-primary rounded-sm text-white text-[10px] leading-tight">
                      {evt.time} {evt.title}
                    </div>
                  ))}
                </div>
              );
            })}

            {nextMonthDays.map((dayNum) => (
              <div key={`next-${dayNum}`} className="bg-white/40 h-24 p-2 text-xs mono opacity-40">
                {dayNum}
              </div>
            ))}
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card padding="normal" className="space-y-4">
            <h3 className="text-xs font-mono text-on-surface-variant border-b border-outline-variant pb-2 uppercase tracking-wider">
              TAGES-TIMELINE ({selectedDay}. {MONTH_NAMES[currentMonthIndex].toUpperCase()} {currentYear})
            </h3>

            <div className="space-y-3 pt-2">
              {calendarTimeline.map((item) => (
                <div key={item.id} className="flex gap-4 items-start">
                  <span className="text-xs font-mono text-on-surface-variant w-12 pt-1">{item.time}</span>
                  <div
                    className={`flex-grow p-3 bg-surface-low text-xs rounded-lg ${
                      item.type === 'primary' ? 'border-l-2 border-primary' : 'border-l-2 border-outline-variant'
                    }`}
                  >
                    <p className="font-bold">{item.title}</p>
                    <p className="text-on-surface-variant">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
