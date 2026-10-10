import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  WEEKDAY_NAMES,
  MONTH_NAMES_SHORT,
  addDays,
  buildAgenda,
  formatClock,
  getEventColors,
  getEventMeta,
  isAllDayEvent,
  isSameDay,
  monthsCovering,
} from '../../lib/calendarUtils';
import { Button, EmptyState, FOCUS, Icon, SkeletonList, cx } from '../ds';

// Agenda: alle Termine ab dem gewählten Tag als endlos scrollbare Liste, nach Tagen gruppiert.
// Beim Scrollen nach unten werden weitere Tage und die dafür nötigen Monate nachgeladen.

const INITIAL_DAYS = 45;
const STEP_DAYS = 30;
const MAX_DAYS = 400;

const dayLabel = (date, today) => {
  if (isSameDay(date, today)) return 'Heute';
  if (isSameDay(date, addDays(today, 1))) return 'Morgen';
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()]}`;
};

const AgendaView = ({ startDate, today, getEventsForDate, loadMonth, isLoading, onSelectEvent, onAddEvent }) => {
  const [dayCount, setDayCount] = useState(INITIAL_DAYS);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);

  // Wechselt der Startpunkt, beginnt die Liste wieder oben mit der Grundmenge
  useEffect(() => {
    setDayCount(INITIAL_DAYS);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [startDate]);

  // Für den sichtbaren Zeitraum nötige Monate laden
  useEffect(() => {
    monthsCovering(startDate, dayCount).forEach(([y, m]) => loadMonth(y, m));
  }, [startDate, dayCount, loadMonth]);

  const groups = useMemo(
    () => buildAgenda(startDate, dayCount, getEventsForDate),
    [startDate, dayCount, getEventsForDate],
  );

  // Automatisch weiterladen, sobald das Ende in Sicht kommt
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setDayCount((n) => Math.min(MAX_DAYS, n + STEP_DAYS));
    }, { root: scrollRef.current, rootMargin: '240px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [groups.length]);

  const atLimit = dayCount >= MAX_DAYS;

  return (
    <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto" aria-label="Agenda">
      {groups.length === 0 ? (
        isLoading ? (
          <div className="p-4"><SkeletonList count={4} lines={2} /></div>
        ) : (
          <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
            <EmptyState
              bordered={false}
              icon="event_available"
              title="Keine Termine in diesem Zeitraum"
              description="Ab diesem Tag steht nichts an."
              action={<Button leadingIcon="add" onClick={onAddEvent}>Termin hinzufügen</Button>}
            />
          </div>
        )
      ) : (
        <ol className="mx-auto w-full max-w-reading">
          {groups.map(({ date, events }) => {
            const isToday = isSameDay(date, today);
            return (
              <li key={date.toISOString()}>
                <h3
                  className={cx(
                    'sticky top-0 z-10 border-b border-subtle bg-surface px-4 py-2 text-label',
                    isToday ? 'text-accent' : 'text-secondary',
                  )}
                >
                  {dayLabel(date, today)}
                  {isToday && <span className="ml-2 text-caption text-tertiary">{WEEKDAY_NAMES[date.getDay()]}, {date.getDate()}. {MONTH_NAMES_SHORT[date.getMonth()]}</span>}
                </h3>
                <ul className="divide-y divide-subtle">
                  {events.map((evt) => {
                    const colors = getEventColors(evt.colorId);
                    const { hasMeet, location } = getEventMeta(evt);
                    const allDay = isAllDayEvent(evt);
                    return (
                      <li key={`${evt.id}-${date.getDate()}`}>
                        <button
                          type="button"
                          onClick={() => onSelectEvent(evt)}
                          className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-hover', FOCUS)}
                        >
                          <span className="w-14 shrink-0 text-caption tabular-nums text-secondary">
                            {allDay ? 'Ganztägig' : formatClock(new Date(evt.start.dateTime))}
                          </span>
                          <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: colors.border }} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-strong text-primary">{evt.summary || '(Ohne Titel)'}</span>
                            {(hasMeet || location || (!allDay && evt.end?.dateTime)) && (
                              <span className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-tertiary">
                                {!allDay && evt.end?.dateTime && <span className="tabular-nums">bis {formatClock(new Date(evt.end.dateTime))}</span>}
                                {hasMeet && <Icon name="videocam" size="sm" />}
                                {!hasMeet && location && <Icon name="location_on" size="sm" />}
                                {(hasMeet || location) && <span className="truncate">{hasMeet ? 'Google Meet' : location}</span>}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}

      <div ref={sentinelRef} className="flex justify-center p-4">
        {!atLimit && (
          <Button variant="ghost" size="sm" onClick={() => setDayCount((n) => Math.min(MAX_DAYS, n + STEP_DAYS))}>
            Weitere Tage laden
          </Button>
        )}
      </div>
    </div>
  );
};

export default AgendaView;
