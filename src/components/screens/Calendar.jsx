import React, { useState } from 'react';
import { calendarTimeline, calendarEvents } from '../../data/mockData';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const Calendar = () => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(4); // 4 = Mai (0-indexed)
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
    setCurrentMonthIndex(4); // Mai
    setCurrentYear(2024);
    setSelectedDay(8);
  };

  // Generate 35 cells for 7-column month view
  // Prototype shows: 2 previous month days (29, 30), 1..31 for current month, 2 next month days (1, 2)
  const prevMonthDays = [29, 30];
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const nextMonthDays = [1, 2];

  return (
    <div className="screen-transition">
      {/* Month Navigation Bar */}
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">
            {MONTH_NAMES[currentMonthIndex]} {currentYear}
          </h2>
          <span className="text-[10px] sm:text-xs mono px-2 py-0.5 border border-outline-variant bg-surface-low hidden sm:inline">
            READ-ONLY
          </span>
        </div>
        <div className="flex border border-outline-variant bg-white">
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

      {/* 12-Column Responsive Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 7-Column Month Grid (8 Cols) */}
        <div className="lg:col-span-8 overflow-x-auto">
          <div className="min-w-[500px] grid grid-cols-7 border-t border-l border-outline-variant bg-outline-variant gap-px">
            {/* Day Header Row */}
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">MO</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">DI</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">MI</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">DO</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">FR</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">SA</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">SO</div>

            {/* Inactive Neighboring Prev Month Days */}
            {prevMonthDays.map((dayNum) => (
              <div key={`prev-${dayNum}`} className="bg-white/40 h-24 p-2 text-xs mono opacity-40">
                {dayNum}
              </div>
            ))}

            {/* Current Month Days (1 to 31) */}
            {daysInMonth.map((dayNum) => {
              const isSelected = dayNum === selectedDay && currentMonthIndex === 4 && currentYear === 2024;
              const dayEvents = (currentMonthIndex === 4 && currentYear === 2024) ? calendarEvents[dayNum] : null;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-24 p-2 text-xs mono cursor-pointer border transition-colors ${
                    isSelected
                      ? 'bg-surface-low border-2 border-primary'
                      : 'bg-white hover:border-primary border-transparent'
                  }`}
                  onClick={() => setSelectedDay(dayNum)}
                >
                  <div className="flex justify-between items-center">
                    <span className={isSelected ? 'font-bold' : ''}>{dayNum}</span>
                    {isSelected && <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>}
                  </div>
                  {dayEvents && dayEvents.map((evt) => (
                    <div key={evt.id} className="mt-2 p-1 bg-primary text-white text-[10px] leading-tight">
                      {evt.time} {evt.title}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Inactive Neighboring Next Month Days */}
            {nextMonthDays.map((dayNum) => (
              <div key={`next-${dayNum}`} className="bg-white/40 h-24 p-2 text-xs mono opacity-40">
                {dayNum}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Tages-Timeline Drawer (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-outline-variant p-6 space-y-4">
          <h3 className="text-xs font-mono text-on-surface-variant border-b border-outline-variant pb-2 uppercase">
            TAGES-TIMELINE ({selectedDay}. {MONTH_NAMES[currentMonthIndex].toUpperCase()} {currentYear})
          </h3>

          <div className="space-y-4 pt-2">
            {calendarTimeline.map((item) => (
              <div key={item.id} className="flex gap-4 items-start">
                <span className="text-xs font-mono text-on-surface-variant w-12">{item.time}</span>
                <div
                  className={`flex-grow p-3 bg-surface-low text-xs ${
                    item.type === 'primary' ? 'border-l-2 border-primary' : 'border-l-2 border-outline-variant'
                  }`}
                >
                  <p className="font-bold">{item.title}</p>
                  <p className="text-on-surface-variant">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
