import React from 'react';
import { WEEKDAYS, getEventColors, sortEvents, isSameDay, isAllDayEvent } from '../../lib/calendarUtils';
import { FOCUS, IconButton, cx } from '../ds';

/** Tageszahl; am PC ein Knopf, der die Tagesansicht öffnet */
const DayNumber = ({ onClick, label, children }) => (onClick ? (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
    className={cx('rounded-md px-1 hover:underline', FOCUS)}
  >
    {children}
  </button>
) : children);

/**
 * Eine Monatsseite des 3-Slide-Karussells (Wochentags-Kopf + Raster mit kompakten Terminen).
 * - `getEventsForCell(date)` liefert die Termine eines Tages
 * - `onCellClick(cell)` Klick auf Tag, `onEventClick(evt, cell)` Klick auf einen Termin
 * - PC: `onAddOnCell(cell)` (Plus beim Überfahren, Doppelklick) legt einen Termin an, `onDayNumberClick(cell)` öffnet den Tag
 */
const MonthSlide = ({ days, isCenter, selectedDay, getEventsForCell, onCellClick, onEventClick, onAddOnCell, onDayNumberClick }) => {
  const rowCount = Math.ceil(days.length / 7);

  return (
    <div className="w-full h-full flex flex-col bg-surface">
      {/* Wochentags-Header (MO. bis SO., Sonntag rot) */}
      <div className="grid grid-cols-7 border-b border-subtle bg-surface flex-shrink-0">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd.short}
            className={`py-2 text-center text-micro md:text-caption ${
              wd.isSunday ? 'text-danger' : 'text-tertiary'
            }`}
          >
            {wd.short}
          </div>
        ))}
      </div>

      {/* Monatsraster (gleichmäßige Zeilenhöhe) */}
      <div
        className="grid grid-cols-7 flex-1 h-full bg-surface divide-y divide-subtle"
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
              onDoubleClick={onAddOnCell ? () => onAddOnCell(cell) : undefined}
              className={`group relative p-1 md:p-1.5 flex flex-col justify-start overflow-hidden cursor-pointer transition-colors border-r border-subtle last:border-r-0 ${
                isToday
                  ? 'z-10 rounded-md border-[1.5px] border-strong bg-surface'
                  : isSelected && !isToday
                  ? 'bg-subtle'
                  : cell.isCurrentMonth
                  ? 'bg-surface hover:bg-hover'
                  : 'bg-subtle hover:bg-hover'
              }`}
            >
              {/* Tageszahl, zentriert */}
              <div className="flex justify-center items-center pt-0.5 pb-1 flex-shrink-0 select-none">
                <DayNumber onClick={onDayNumberClick ? () => onDayNumberClick(cell) : undefined} label={`${cell.day}. ${cell.dateObj.toLocaleDateString('de-DE', { month: 'long' })} öffnen`}>
                {isToday ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-inverse text-caption-strong text-inverse">
                    {cell.day}
                  </span>
                ) : (
                  <span
                    className={`text-caption-strong md:text-body leading-none ${
                      isSunday
                        ? cell.isCurrentMonth ? 'text-danger' : 'text-danger'
                        : cell.isCurrentMonth ? 'text-primary' : 'text-disabled'
                    }`}
                  >
                    {cell.day}
                  </span>
                )}
                </DayNumber>
              </div>

              {onAddOnCell && (
                <div className="absolute right-1 top-1 z-10 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    icon="add"
                    size="sm"
                    label={`Termin am ${cell.day}. ${cell.dateObj.toLocaleDateString('de-DE', { month: 'long' })} erstellen`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddOnCell(cell);
                    }}
                  />
                </div>
              )}

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
                            ? 'rounded-xs hover:brightness-95'
                            : 'border-l-[3px] rounded-r-xs hover:bg-hover'
                        } ${
                          isFewEvents
                            ? (isAllDay ? 'px-1.5 py-0.5 md:py-1' : 'pl-1.5 pr-0.5 py-0.5 md:py-1') + ' text-micro md:text-micro leading-tight'
                            : (isAllDay ? 'px-1 py-0.5' : 'pl-1 pr-0.5 py-0.5') + ' text-micro md:text-micro leading-tight'
                        }`}
                        style={{
                          ...(isAllDay ? { backgroundColor: colors.bg } : {}),
                          ...(!isAllDay ? { borderLeftColor: colors.border } : {}),
                          color: isAllDay ? colors.text : 'var(--text-primary)',
                        }}
                        title={evt.summary || '(Ohne Titel)'}
                      >
                        <div className="w-full truncate md:whitespace-normal md:break-words md:line-clamp-2">
                          {evt.summary || '(Ohne Titel)'}
                        </div>
                      </div>
                    );
                  })}

                  {count > 4 && (
                    <div className="text-micro text-tertiary text-center leading-none pt-0.5">
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
