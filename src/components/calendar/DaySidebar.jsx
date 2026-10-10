import React, { useMemo, useRef } from 'react';
import { MONTH_NAMES_SHORT, WEEKDAY_NAMES, isSameDay } from '../../lib/calendarUtils';
import { IconButton } from '../ds';
import { useTimeGridScroll } from '../../hooks/useTimeGridScroll';
import TimeGrid from './TimeGrid';

const PX_PER_HOUR = 52;

/** Tagesleiste am PC (ein-/ausblendbar): der gewählte Tag mit Zeitraster neben dem Monatsraster */
const DaySidebar = ({ date, getEventsForDate, ready, onPrevDay, onNextDay, onClose, onSelectEvent, onAddEvent, onSlotClick }) => {
  const scrollRef = useRef(null);
  const days = useMemo(() => [date], [date]);
  const count = getEventsForDate(date).length;

  useTimeGridScroll(scrollRef, {
    days,
    getEventsForDate,
    pxPerHour: PX_PER_HOUR,
    resetKey: date.toDateString(),
    ready,
  });

  return (
    <aside aria-label="Tagesleiste" className="flex w-[340px] shrink-0 flex-col border-l border-subtle bg-surface lg:w-[380px]">
      <header className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-heading text-primary">
            {isSameDay(date) ? 'Heute' : WEEKDAY_NAMES[date.getDay()]}
          </h2>
          <p className="text-caption text-secondary">
            {date.getDate()}. {MONTH_NAMES_SHORT[date.getMonth()]} · {count === 0 ? 'Keine Termine' : count === 1 ? '1 Termin' : `${count} Termine`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon="chevron_left" size="sm" label="Vorheriger Tag" onClick={onPrevDay} />
          <IconButton icon="chevron_right" size="sm" label="Nächster Tag" onClick={onNextDay} />
          <IconButton icon="add" size="sm" variant="secondary" label="Termin an diesem Tag erstellen" onClick={onAddEvent} />
          <IconButton icon="close" size="sm" label="Tagesleiste ausblenden" onClick={onClose} />
        </div>
      </header>

      <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <TimeGrid
          days={days}
          getEventsForDate={getEventsForDate}
          showHeader={false}
          pxPerHour={PX_PER_HOUR}
          roomy
          onSlotClick={onSlotClick}
          onSelectEvent={onSelectEvent}
        />
      </div>
    </aside>
  );
};

export default DaySidebar;
