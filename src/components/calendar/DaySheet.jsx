import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES,
  formatEventTimeRange,
  getEventColors,
  getEventMeta,
  isSameDay,
  splitDayEvents,
} from '../../lib/calendarUtils';
import { getSnapHeights, resolveSnap, stepSheetState } from '../../lib/sheetSnap';
import { EmptyState, FOCUS, Icon, IconButton, cx } from '../ds';
import { useTimeGridScroll } from '../../hooks/useTimeGridScroll';
import TimeGrid from './TimeGrid';

const VIEW_MODE_KEY = 'focusflow_calendar_mobile_day_view';
const AXIS_THRESHOLD = 8;
const DAY_SWIPE_PX = 48;

/**
 * Tagessheet am Handy (Samsung-Stil): sitzt unten im Kalender und hat drei Haltepunkte.
 *  - Vorschau: Kopf und erster Termin, das Monatsraster rückt nach oben, alle Tage bleiben antippbar
 *  - halb / voll: legt sich über das Raster
 * Ziehen am Kopf ändert die Höhe (nach unten über die Vorschau hinaus schließt), Wischen nach links oder
 * rechts wechselt den Tag. Das Sheet ist nicht modal: das Raster bleibt bedienbar.
 * Ausnahme von Regel 07 §2 (kein `useSwipeToClose`), weil es Haltepunkte statt nur „schließen“ hat.
 */
const DaySheet = ({
  state,
  onStateChange,
  date,
  events,
  onPrevDay,
  onNextDay,
  onSelectEvent,
  onAddEvent,
  onSlotClick,
}) => {
  const rootRef = useRef(null);
  const contentRef = useRef(null);
  const gesture = useRef(null);
  const [containerHeight, setContainerHeight] = useState(640);
  const [dragHeight, setDragHeight] = useState(null);
  const [visible, setVisible] = useState(state !== 'closed');

  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'timeline' || saved === 'list') return saved;
    } catch {
      // Storage gesperrt: Standardansicht
    }
    return 'list';
  });
  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // gilt dann nur für diese Sitzung
    }
  };

  // Inhalt nach dem Schließen noch kurz stehen lassen, damit das Absenken nicht leer wirkt
  useEffect(() => {
    if (state !== 'closed') {
      setVisible(true);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(false), 280);
    return () => clearTimeout(timer);
  }, [state]);

  // Höhe des Bereichs, in dem das Sheet sitzt
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return undefined;
    const measure = () => setContainerHeight(parent.clientHeight || 640);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const heights = useMemo(() => getSnapHeights(containerHeight), [containerHeight]);
  const height = dragHeight ?? heights[state];

  const { allDay, timed } = useMemo(() => splitDayEvents(events, date), [events, date]);
  const getEventsForDate = useMemo(() => () => events, [events]);
  const total = events.length;
  const canScroll = state === 'half' || state === 'full';
  const singleDay = useMemo(() => [date], [date]);

  // Zeitstrahl beim Öffnen und bei Tageswechsel sinnvoll scrollen (wie im Raster am PC)
  useTimeGridScroll(contentRef, {
    enabled: viewMode === 'timeline' && visible,
    days: singleDay,
    getEventsForDate,
    pxPerHour: 48,
    resetKey: `${date.toDateString()}-${viewMode}`,
    ready: canScroll,
  });

  // --- Gesten: senkrecht = Höhe ändern, waagerecht = Tag wechseln ---
  const gestureHandlers = (allowVertical) => ({
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture.current = {
        id: e.pointerId,
        el: e.currentTarget,
        x: e.clientX,
        y: e.clientY,
        axis: null,
        startHeight: heights[state],
        height: heights[state],
        lastY: e.clientY,
        lastT: performance.now(),
        velocity: 0,
        allowVertical,
      };
    },
    onPointerMove: (e) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.axis) {
        if (Math.abs(dx) < AXIS_THRESHOLD && Math.abs(dy) < AXIS_THRESHOLD) return;
        g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
        if (g.axis === 'y' && !g.allowVertical) {
          gesture.current = null; // der Browser scrollt den Inhalt
          return;
        }
        g.el.setPointerCapture?.(e.pointerId);
      }
      if (g.axis === 'y') {
        const now = performance.now();
        g.velocity = (g.lastY - e.clientY) / Math.max(now - g.lastT, 1);
        g.lastY = e.clientY;
        g.lastT = now;
        g.height = Math.max(0, Math.min(containerHeight, g.startHeight - dy));
        setDragHeight(g.height);
      }
    },
    onPointerUp: (e) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || !g.axis) return;
      if (g.axis === 'y') {
        setDragHeight(null);
        onStateChange(resolveSnap(g.height, g.velocity, heights));
      } else {
        const dx = e.clientX - g.x;
        if (dx > DAY_SWIPE_PX) onPrevDay();
        else if (dx < -DAY_SWIPE_PX) onNextDay();
      }
    },
    onPointerCancel: () => {
      gesture.current = null;
      setDragHeight(null);
    },
  });

  const label = `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()]}`;
  const heading = isSameDay(date) ? 'Heute' : WEEKDAY_NAMES[date.getDay()];

  return (
    <section
      ref={rootRef}
      role="region"
      aria-label={`Termine am ${label}`}
      aria-hidden={state === 'closed' ? true : undefined}
      inert={state === 'closed'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onStateChange('closed');
      }}
      className={cx(
        'absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-subtle bg-surface shadow-sheet',
        'transition-[height] duration-slow ease-enter motion-reduce:transition-none',
        dragHeight !== null && '!transition-none',
        state === 'closed' && 'pointer-events-none',
      )}
      style={{ height: `${height}px` }}
    >
      {/* Kopf: Griff, Tag wechseln, Ansicht, Hinzufügen, Schließen */}
      <div {...gestureHandlers(true)} className="shrink-0 select-none" style={{ touchAction: 'none' }}>
        <button
          type="button"
          onClick={() => onStateChange(state === 'full' ? 'peek' : stepSheetState(state, 1))}
          aria-label={state === 'full' ? 'Tagesansicht verkleinern' : 'Tagesansicht vergrößern'}
          className={cx('flex w-full justify-center pb-1 pt-2', FOCUS)}
        >
          <span className="h-1 w-9 rounded-full bg-control" aria-hidden="true" />
        </button>
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center">
            <IconButton icon="chevron_left" size="sm" label="Vorheriger Tag" onClick={onPrevDay} />
            <div className="min-w-0 px-1">
              <h2 className="truncate text-subheading text-primary">{heading}</h2>
              <p className="truncate text-caption text-secondary">
                {date.getDate()}. {MONTH_NAMES_SHORT[date.getMonth()]} · {total === 0 ? 'Keine Termine' : total === 1 ? '1 Termin' : `${total} Termine`}
              </p>
            </div>
            <IconButton icon="chevron_right" size="sm" label="Nächster Tag" onClick={onNextDay} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              icon={viewMode === 'list' ? 'schedule' : 'view_list'}
              size="sm"
              label={viewMode === 'list' ? 'Zeitstrahl anzeigen' : 'Liste anzeigen'}
              onClick={() => changeViewMode(viewMode === 'list' ? 'timeline' : 'list')}
            />
            <IconButton icon="add" size="sm" variant="secondary" label="Termin an diesem Tag erstellen" onClick={onAddEvent} />
            <IconButton icon="close" size="sm" label="Tagesansicht schließen" onClick={() => onStateChange('closed')} />
          </div>
        </div>
      </div>

      {/* Inhalt: in der Vorschau fest, sonst scrollbar; Wischen wechselt den Tag */}
      {visible && (
        <div
          ref={contentRef}
          {...gestureHandlers(state === 'peek')}
          className={cx('min-h-0 flex-1 border-t border-subtle', canScroll ? 'no-scrollbar overflow-y-auto' : 'overflow-hidden')}
          style={{ touchAction: canScroll ? 'pan-y' : 'none' }}
        >
          {viewMode === 'list' ? (
            total === 0 ? (
              <EmptyState compact bordered={false} icon="event_available" title="Keine Termine" description="An diesem Tag steht nichts an." />
            ) : (
              <ul className="divide-y divide-subtle">
                {[...allDay, ...timed].map((evt) => {
                  const colors = getEventColors(evt.colorId);
                  const { hasMeet, location } = getEventMeta(evt);
                  return (
                    <li key={evt.id}>
                      <button
                        type="button"
                        onClick={() => onSelectEvent(evt)}
                        className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-hover', FOCUS)}
                      >
                        <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: colors.border }} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-strong text-primary">{evt.summary || '(Ohne Titel)'}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-caption tabular-nums text-secondary">
                            {formatEventTimeRange(evt)}
                            {hasMeet && <Icon name="videocam" size="sm" />}
                            {!hasMeet && location && <span className="flex items-center gap-1 truncate"><Icon name="location_on" size="sm" /><span className="truncate">{location}</span></span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <TimeGrid
              days={singleDay}
              getEventsForDate={getEventsForDate}
              showHeader={false}
              pxPerHour={48}
              onSlotClick={onSlotClick}
              onSelectEvent={onSelectEvent}
            />
          )}
        </div>
      )}
    </section>
  );
};

export default DaySheet;
