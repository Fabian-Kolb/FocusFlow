import React from 'react';
import { WEEKDAY_NAMES, MONTH_NAMES_SHORT, getEventColors, isAllDayEvent, formatClock } from '../../lib/calendarUtils';

import { EmptyState, FOCUS, IconButton, cx } from '../ds';
/** Tagesansicht für Desktop/Tablet (ab 768 px): Termine des gewählten Tages als Liste */
const DesktopDayPanel = ({ selectedDateObj, dayEvents, sideBySide, onSelectEvent, onAddEvent }) => {
  const day = selectedDateObj.getDate();

  return (
    <div className={`hidden border-l border-subtle bg-subtle md:block ${
      sideBySide
        ? 'w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col h-full'
        : 'w-full h-[320px] border-t border-subtle flex flex-col'
    }`}>
      <div className="flex items-center justify-between border-b border-subtle bg-surface p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-inverse text-caption-strong text-inverse">
          {day}
          </div>
          <div>
            <h3 className="text-body-strong text-primary">
              {WEEKDAY_NAMES[selectedDateObj.getDay()]}, {day}. {MONTH_NAMES_SHORT[selectedDateObj.getMonth()]}
            </h3>
            <p className="text-caption text-tertiary">
              {dayEvents.length === 0 ? 'Keine Termine' : `${dayEvents.length} Termine`}
            </p>
          </div>
        </div>
        <IconButton icon="add" label="Termin erstellen" variant="primary" size="sm" onClick={onAddEvent} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        {dayEvents.length === 0 ? (
          <EmptyState compact bordered={false} icon="event_available" title="Keine Termine" description="Für diesen Tag steht nichts an." />
        ) : (
          dayEvents.map((evt) => {
            const colors = getEventColors(evt.colorId);
            const allDay = isAllDayEvent(evt);
            return (
              <button
              key={evt.id}
              type="button"
              onClick={() => onSelectEvent(evt)}
              className={cx('block w-full rounded-md border border-subtle p-3 text-left shadow-xs transition-shadow duration-fast hover:shadow-sm', FOCUS)}
              style={{ backgroundColor: colors.bg, borderLeftColor: colors.border, borderLeftWidth: '3px', color: colors.text }}
              >
              <span className="block truncate text-body-strong">{evt.summary || '(Ohne Titel)'}</span>
              <span className="mt-0.5 block text-caption tabular-nums opacity-80">
              {allDay
                ? 'Ganztägig'
                : `${formatClock(new Date(evt.start.dateTime))} – ${evt.end?.dateTime ? formatClock(new Date(evt.end.dateTime)) : ''}`}
              </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DesktopDayPanel;
