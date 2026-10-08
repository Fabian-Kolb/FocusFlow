import React from 'react';
import { WEEKDAY_NAMES, MONTH_NAMES_SHORT, getEventColors, isAllDayEvent, formatClock } from '../../lib/calendarUtils';

/** Tagesansicht für Desktop/Tablet (ab 768 px): Termine des gewählten Tages als Liste */
const DesktopDayPanel = ({ selectedDateObj, dayEvents, sideBySide, onSelectEvent, onAddEvent }) => {
  const day = selectedDateObj.getDate();

  return (
    <div className={`hidden md:block border-l border-neutral-100 bg-neutral-50/50 ${
      sideBySide
        ? 'w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col h-full'
        : 'w-full h-[320px] border-t border-neutral-100 flex flex-col'
    }`}>
      <div className="p-4 border-b border-neutral-200/60 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
            {day}
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 leading-tight">
              {WEEKDAY_NAMES[selectedDateObj.getDay()]}, {day}. {MONTH_NAMES_SHORT[selectedDateObj.getMonth()]}
            </h3>
            <p className="text-[11px] text-neutral-500">
              {dayEvents.length === 0 ? 'Keine Termine' : `${dayEvents.length} Termine`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddEvent}
          className="p-1.5 bg-neutral-900 text-white rounded-lg hover:bg-black transition-colors"
          title="Termin erstellen"
          aria-label="Termin erstellen"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        {dayEvents.length === 0 ? (
          <p className="text-center py-8 text-neutral-400 text-xs">Keine Termine für diesen Tag.</p>
        ) : (
          dayEvents.map((evt) => {
            const colors = getEventColors(evt.colorId);
            const allDay = isAllDayEvent(evt);
            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="p-3 rounded-xl border border-neutral-200/70 hover:shadow-2xs cursor-pointer transition-all"
                style={{ backgroundColor: colors.bg, borderLeftColor: colors.border, borderLeftWidth: '3px' }}
              >
                <h4 className="text-xs font-bold text-neutral-900 truncate">{evt.summary || '(Ohne Titel)'}</h4>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {allDay
                    ? 'Ganztägig'
                    : `${formatClock(new Date(evt.start.dateTime))} - ${evt.end?.dateTime ? formatClock(new Date(evt.end.dateTime)) : ''}`}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DesktopDayPanel;
