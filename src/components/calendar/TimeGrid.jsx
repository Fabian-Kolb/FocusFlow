import React, { useMemo } from 'react';
import {
  HOURS,
  WEEKDAYS,
  getEventColors,
  getEventMeta,
  isSameDay,
  snapMinutes,
  splitDayEvents,
} from '../../lib/calendarUtils';
import { useNowMinutes } from '../../hooks/useNowMinutes';
import { FOCUS, Icon, cx } from '../ds';

// Zeitraster für einen oder mehrere Tage (Woche, Tag, Tagesleiste, Tagessheet).
// Das Raster selbst scrollt nicht: Der Aufrufer stellt den Scroll-Container (siehe useTimeGridScroll).
// Ein Klick auf eine freie Stelle meldet Tag und Minute (auf 30 Minuten gerundet) für einen neuen Termin.

const GUTTER = '3rem';
const MAX_ALL_DAY_CHIPS = 3;

const columnsStyle = (count) => ({ gridTemplateColumns: `${GUTTER} repeat(${count}, minmax(0, 1fr))` });
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const AllDayChip = ({ evt, onSelectEvent }) => {
  const colors = getEventColors(evt.colorId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelectEvent?.(evt);
      }}
      className={cx('block w-full truncate rounded-xs px-1.5 py-0.5 text-left text-micro transition-[filter] duration-fast hover:brightness-95', FOCUS)}
      style={{ backgroundColor: colors.bg, color: colors.text }}
      title={evt.summary || '(Ohne Titel)'}
    >
      {evt.summary || '(Ohne Titel)'}
    </button>
  );
};

const TimedEvent = ({ evt, pxPerMin, roomy, onSelectEvent }) => {
  const colors = getEventColors(evt.colorId);
  const { hasMeet, location } = getEventMeta(evt);
  const height = Math.max(evt.duration * pxPerMin, 22);
  const oneLine = height < 40;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelectEvent?.(evt);
      }}
      title={`${evt.startFormatted} – ${evt.endFormatted} ${evt.summary || '(Ohne Titel)'}`}
      className={cx('absolute z-0 overflow-hidden rounded-r-md border-l-[3px] px-1.5 text-left transition-[filter] duration-fast hover:brightness-95', FOCUS)}
      style={{
        top: `${evt.startMinutes * pxPerMin}px`,
        height: `${height}px`,
        left: `calc(${(evt.col / evt.totalCols) * 100}% + 1px)`,
        width: `calc(${100 / evt.totalCols}% - 3px)`,
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
        color: colors.text,
      }}
    >
      {oneLine ? (
        <span className={cx('block truncate leading-tight', roomy ? 'text-caption' : 'text-micro')}>
          <span className="tabular-nums opacity-80">{evt.startFormatted}</span> {evt.summary || '(Ohne Titel)'}
        </span>
      ) : (
        <>
          <span className={cx('block break-words leading-tight', roomy ? 'text-caption-strong' : 'text-micro', height < 60 ? 'line-clamp-1' : 'line-clamp-2')}>
            {evt.summary || '(Ohne Titel)'}
          </span>
          <span className="block truncate text-micro tabular-nums opacity-80">
            {evt.startFormatted} – {evt.endFormatted}
          </span>
          {roomy && height >= 64 && (hasMeet || location) && (
            <span className="mt-0.5 flex items-center gap-1 truncate text-micro opacity-80">
              <Icon name={hasMeet ? 'videocam' : 'location_on'} size="sm" />
              <span className="truncate">{hasMeet ? 'Google Meet' : location}</span>
            </span>
          )}
        </>
      )}
    </button>
  );
};

/**
 * @param days            anzuzeigende Tage (1 bis 7)
 * @param getEventsForDate (Date) => Termine des Tages
 * @param showHeader      Wochentag und Datum je Spalte
 * @param pxPerHour       Höhe einer Stunde in Pixel
 * @param onSlotClick     (Date, minutes) => neuer Termin an dieser Stelle
 * @param onDayClick      Klick auf den Spaltenkopf (z. B. zur Tagesansicht)
 */
const TimeGrid = ({
  days,
  getEventsForDate,
  showHeader = true,
  pxPerHour = 48,
  roomy = false,
  onSlotClick,
  onSelectEvent,
  onDayClick,
}) => {
  const pxPerMin = pxPerHour / 60;
  const hasToday = days.some((d) => isSameDay(d));
  const nowMinutes = useNowMinutes(hasToday);

  const perDay = useMemo(
    () => days.map((date) => ({ date, ...splitDayEvents(getEventsForDate(date), date) })),
    [days, getEventsForDate],
  );
  const maxAllDay = Math.max(0, ...perDay.map((d) => d.allDay.length));
  const count = days.length;

  return (
    <div className="flex w-full flex-col">
      {(showHeader || maxAllDay > 0) && (
        <div className="sticky top-0 z-10 border-b border-subtle bg-surface">
          {showHeader && (
            <div className="grid" style={columnsStyle(count)}>
              <div />
              {perDay.map(({ date }) => {
                const today = isSameDay(date);
                const weekday = WEEKDAYS[(date.getDay() + 6) % 7];
                return (
                  <button
                    key={dayKey(date)}
                    type="button"
                    onClick={() => onDayClick?.(date)}
                    aria-label={`${date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} öffnen`}
                    className={cx('flex flex-col items-center gap-0.5 py-2 transition-colors duration-fast hover:bg-hover', FOCUS)}
                  >
                    <span className={cx('text-micro', weekday.isSunday ? 'text-danger' : 'text-tertiary')}>{weekday.short}</span>
                    <span
                      className={cx(
                        'flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-body-strong',
                        today ? 'bg-inverse text-inverse' : weekday.isSunday ? 'text-danger' : 'text-primary',
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {maxAllDay > 0 && (
            <div className="grid border-t border-subtle py-1" style={columnsStyle(count)}>
              <div className="pr-1.5 pt-0.5 text-right text-micro text-tertiary">ganztägig</div>
              {perDay.map(({ date, allDay }) => (
                <div key={dayKey(date)} className="min-w-0 space-y-0.5 border-l border-subtle px-0.5">
                  {allDay.slice(0, MAX_ALL_DAY_CHIPS).map((evt) => (
                    <AllDayChip key={evt.id} evt={evt} onSelectEvent={onSelectEvent} />
                  ))}
                  {allDay.length > MAX_ALL_DAY_CHIPS && (
                    <button
                      type="button"
                      onClick={() => onDayClick?.(date)}
                      className={cx('block w-full rounded-xs px-1 text-left text-micro text-secondary hover:text-primary', FOCUS)}
                    >
                      +{allDay.length - MAX_ALL_DAY_CHIPS} weitere
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative grid select-none" style={{ ...columnsStyle(count), height: `${24 * pxPerHour}px` }}>
        <div className="relative">
          {HOURS.slice(1).map((h) => (
            <div
              key={h}
              className="absolute right-0 pr-1.5 text-micro leading-none tabular-nums text-tertiary"
              style={{ top: `${h * pxPerHour - 5}px` }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {perDay.map(({ date, timed }) => {
          const today = isSameDay(date);
          return (
            <div
              key={dayKey(date)}
              data-day-column={dayKey(date)}
              className={cx('relative min-w-0 border-l border-subtle', onSlotClick && 'cursor-pointer')}
              onClick={(e) => {
                if (!onSlotClick || e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                onSlotClick(date, snapMinutes((e.clientY - rect.top) / pxPerMin));
              }}
            >
              {HOURS.slice(1).map((h) => (
                <div
                  key={h}
                  className="pointer-events-none absolute left-0 right-0 border-t border-subtle"
                  style={{ top: `${h * pxPerHour}px` }}
                />
              ))}

              {timed.map((evt) => (
                <TimedEvent key={evt.id} evt={evt} pxPerMin={pxPerMin} roomy={roomy || count === 1} onSelectEvent={onSelectEvent} />
              ))}

              {today && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-0 flex h-[1.5px] items-center bg-danger"
                  style={{ top: `${nowMinutes * pxPerMin}px` }}
                  aria-hidden="true"
                >
                  <div className="-ml-1.5 h-2.5 w-2.5 rounded-full bg-danger" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimeGrid;
