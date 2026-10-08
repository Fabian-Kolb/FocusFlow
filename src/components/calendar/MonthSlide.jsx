import React from 'react';
import { WEEKDAYS, getEventColors, sortEvents, isSameDay, isAllDayEvent } from '../../lib/calendarUtils';

/**
 * Eine Monatsseite des 3-Slide-Karussells (Wochentags-Kopf + Raster mit kompakten Terminen).
 * - `getEventsForCell(date)` liefert die Termine eines Tages
 * - `onCellClick(cell)` Klick auf Tag, `onEventClick(evt, cell)` Klick auf einen Termin
 */
const MonthSlide = ({ days, isCenter, selectedDay, getEventsForCell, onCellClick, onEventClick }) => {
  const rowCount = Math.ceil(days.length / 7);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Wochentags-Header (MO. bis SO., Sonntag rot) */}
      <div className="grid grid-cols-7 border-b border-neutral-100 bg-white flex-shrink-0">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd.short}
            className={`py-2 text-center text-[11px] md:text-xs font-bold tracking-wider ${
              wd.isSunday ? 'text-red-500' : 'text-neutral-500'
            }`}
          >
            {wd.short}
          </div>
        ))}
      </div>

      {/* Monatsraster (gleichmäßige Zeilenhöhe) */}
      <div
        className="grid grid-cols-7 flex-1 h-full bg-white divide-y divide-neutral-100"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {days.map((cell, cellIdx) => {
          const isToday = isSameDay(cell.dateObj);
          const isSelected = isCenter && cell.isCurrentMonth && cell.day === selectedDay;
          const isSunday = (cellIdx % 7) === 6;

          const sorted = sortEvents(getEventsForCell(cell.dateObj));
          const count = sorted.length;

          return (
            <div
              key={cell.key}
              onClick={() => onCellClick(cell)}
              className={`relative p-1 md:p-1.5 flex flex-col justify-start overflow-hidden cursor-pointer transition-colors border-r border-neutral-100 last:border-r-0 ${
                isToday
                  ? 'border-[1.5px] border-neutral-800 rounded-xl z-10 bg-white shadow-2xs'
                  : isSelected && !isToday
                  ? 'bg-neutral-50/80'
                  : cell.isCurrentMonth
                  ? 'bg-white hover:bg-neutral-50/50'
                  : 'bg-neutral-50/30 hover:bg-neutral-50/50'
              }`}
            >
              {/* Tageszahl, zentriert */}
              <div className="flex justify-center items-center pt-0.5 pb-1 flex-shrink-0 select-none">
                {isToday ? (
                  <span className="w-[22px] h-[22px] rounded-[6px] bg-black text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {cell.day}
                  </span>
                ) : (
                  <span
                    className={`text-xs md:text-sm font-semibold leading-none ${
                      isSunday
                        ? cell.isCurrentMonth ? 'text-red-500' : 'text-red-300'
                        : cell.isCurrentMonth ? 'text-neutral-900' : 'text-neutral-300 font-normal'
                    }`}
                  >
                    {cell.day}
                  </span>
                )}
              </div>

              {/*
                Kompakte Terminanzeige: nur der Platz für bis zu 2 Textzeilen (h-auto, line-clamp-2 break-all),
                zeitgebundene Termine mit Akzentlinie vorne, ganztägige als Pastell-Pille, max. 4 sichtbar (+X).
              */}
              {count > 0 && (
                <div className={`w-full flex-1 flex flex-col gap-1 overflow-hidden ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}>
                  {sorted.slice(0, 4).map((evt) => {
                    const colors = getEventColors(evt.colorId);
                    const isFewEvents = count <= 2;
                    const isAllDay = isAllDayEvent(evt);

                    return (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(evt, cell);
                        }}
                        className={`w-full h-auto text-left transition-all active:scale-[0.98] select-none flex flex-col justify-start ${
                          isAllDay
                            ? 'rounded-[4px] hover:brightness-95'
                            : 'border-l-[3px] rounded-r-[4px] hover:bg-neutral-100/60'
                        } ${
                          isFewEvents
                            ? (isAllDay ? 'px-1.5 py-0.5 md:py-1' : 'pl-1.5 pr-0.5 py-0.5 md:py-1') + ' text-[10px] md:text-[11px] leading-tight'
                            : (isAllDay ? 'px-1 py-0.5' : 'pl-1 pr-0.5 py-0.5') + ' text-[9px] md:text-[10px] leading-tight'
                        }`}
                        style={{
                          ...(isAllDay ? { backgroundColor: colors.bg } : {}),
                          ...(!isAllDay ? { borderLeftColor: colors.border } : {}),
                          color: isAllDay ? colors.text : '#171717',
                        }}
                        title={evt.summary || '(Ohne Titel)'}
                      >
                        <div className="w-full font-medium break-all line-clamp-2">
                          {evt.summary || '(Ohne Titel)'}
                        </div>
                      </div>
                    );
                  })}

                  {count > 4 && (
                    <div className="text-[8.5px] font-bold text-neutral-400 text-center leading-none pt-0.5">
                      +{count - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthSlide;
