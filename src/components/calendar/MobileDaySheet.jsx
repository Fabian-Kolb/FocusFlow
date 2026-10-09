import React, { useState, useRef } from 'react';
import {
  MONTH_NAMES_SHORT,
  HOURS,
  MOBILE_PX_PER_MIN,
  getEventColors,
} from '../../lib/calendarUtils';
import { Button, EmptyState, FOCUS, Icon, IconButton, Sheet, cx } from '../ds';

const VIEW_MODE_KEY = 'focusflow_calendar_mobile_day_view';

/**
 * Mobiles Tages-Sheet (Bottom Sheet, Regel 07): Liste (Standard) oder 24-h-Zeitstrahl.
 * Nach rechts wischen öffnet den Zeitstrahl, nach links die Liste.
 */
const MobileDaySheet = ({
  open,
  onClose,
  selectedDateObj,
  weekdayName,
  dayEvents,
  allDayEvents,
  layoutedTimedEvents,
  isSelectedToday,
  nowMinutes,
  onSelectEvent,
  onAddEvent,
}) => {
  const day = selectedDateObj.getDate();
  const monthShort = MONTH_NAMES_SHORT[selectedDateObj.getMonth()];

  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'timeline' || saved === 'list') return saved;
    } catch {
      // Storage gesperrt – Standardansicht
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

  // Horizontale Wischgeste zwischen Liste und Zeitstrahl
  const startX = useRef(0);
  const startY = useRef(0);
  const horizontal = useRef(false);

  const onTouchStart = (e) => {
    startX.current = e.targetTouches[0].clientX;
    startY.current = e.targetTouches[0].clientY;
    horizontal.current = false;
  };
  const onTouchMove = (e) => {
    const dx = e.targetTouches[0].clientX - startX.current;
    const dy = e.targetTouches[0].clientY - startY.current;
    if (!horizontal.current && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.3) horizontal.current = true;
  };
  const onTouchEnd = (e) => {
    if (horizontal.current) {
      const dx = e.changedTouches[0].clientX - startX.current;
      if (dx > 50 && viewMode === 'list') changeViewMode('timeline');
      else if (dx < -50 && viewMode === 'timeline') changeViewMode('list');
    }
    horizontal.current = false;
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      hideHeader
      ariaLabel={`Termine am ${weekdayName}, ${day}. ${monthShort}`}
      className="h-[86dvh] md:hidden"
      bodyClassName="relative px-0 pb-0"
      footer={(
        <Button variant="secondary" size="lg" fullWidth trailingIcon="add" onClick={onAddEvent} className="!justify-between text-secondary">
          <span>Am {day}. {monthShort} hinzufügen</span>
        </Button>
      )}
    >
      {/* Kopf bleibt beim Scrollen stehen: Tageszahl, Wochentag, Umschalter Liste/Zeitstrahl */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-subtle bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-inverse text-heading text-inverse">{day}</span>
          <div>
            <h2 className="text-heading text-primary">{weekdayName}</h2>
            <p className="text-caption text-tertiary">{day}. {monthShort}</p>
          </div>
        </div>
        <IconButton
          icon={viewMode === 'list' ? 'schedule' : 'view_list'}
          label={viewMode === 'list' ? 'Zeitstrahl anzeigen (oder nach rechts wischen)' : 'Liste anzeigen'}
          variant={viewMode === 'timeline' ? 'primary' : 'ghost'}
          onClick={() => changeViewMode(viewMode === 'list' ? 'timeline' : 'list')}
        />
      </div>

      {/* Inhalt: wischbar zwischen Liste und Zeitstrahl */}
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="space-y-3 px-5 py-3">
        {viewMode === 'list' ? (
          dayEvents.length === 0 ? (
            <EmptyState compact bordered={false} icon="event_available" title="Keine Termine" description="An diesem Tag steht nichts an." />
          ) : (
            <>
              {/* Ganztägige Termine als Karten in der Terminfarbe */}
              {allDayEvents.map((evt) => {
                const colors = getEventColors(evt.colorId);
                return (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => onSelectEvent(evt)}
                    className={cx('flex w-full flex-col gap-1 rounded-lg border p-4 text-left shadow-xs transition-shadow duration-fast hover:shadow-sm', FOCUS)}
                    style={{ backgroundColor: colors.bg, borderColor: `${colors.border}40`, color: colors.text }}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon name="event" size="md" style={{ color: colors.border }} />
                      <span className="truncate text-body-strong">{evt.summary || '(Ohne Titel)'}</span>
                    </span>
                    <span className="pl-7 text-caption-strong opacity-80">Ganztägig</span>
                  </button>
                );
              })}

              {/* Zeitgebundene Termine: Startzeit nur beim ersten Termin eines Zeitpunkts */}
              <div className="divide-y divide-subtle">
                {layoutedTimedEvents.map((evt, idx) => {
                  const colors = getEventColors(evt.colorId);
                  const prev = idx > 0 ? layoutedTimedEvents[idx - 1] : null;
                  const isFirstAtThisTime = !prev || prev.startFormatted !== evt.startFormatted;
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => onSelectEvent(evt)}
                      className={cx('flex w-full items-center gap-3 rounded-md px-1.5 py-3.5 text-left transition-colors duration-fast hover:bg-hover', FOCUS)}
                    >
                      <span className="w-12 shrink-0 text-body-strong tabular-nums text-primary">
                        {isFirstAtThisTime ? evt.startFormatted : ''}
                      </span>
                      <span className="h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: colors.border }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label text-primary">{evt.summary || '(Ohne Titel)'}</span>
                        <span className="mt-0.5 block text-caption tabular-nums text-tertiary">{evt.startFormatted} – {evt.endFormatted}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )
        ) : (
          /* Zeitstrahl (24-h-Raster) */
          <div className="relative flex w-full select-none" style={{ height: `${24 * 60 * MOBILE_PX_PER_MIN}px` }}>
            <div className="relative w-12 shrink-0 border-r border-subtle">
              {HOURS.map((h) => (
                <div
                  key={`mtime-${h}`}
                  className="absolute right-0 pr-1.5 text-micro leading-none tabular-nums text-tertiary"
                  style={{ top: `${h * 60 * MOBILE_PX_PER_MIN - 5}px` }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            <div className="relative flex-1 bg-surface">
              {HOURS.map((h) => (
                <div
                  key={`mslot-${h}`}
                  className="absolute left-0 right-0 border-t border-subtle"
                  style={{ top: `${h * 60 * MOBILE_PX_PER_MIN}px` }}
                />
              ))}

              {isSelectedToday && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-10 flex h-[1.5px] items-center bg-danger"
                  style={{ top: `${nowMinutes * MOBILE_PX_PER_MIN}px` }}
                >
                  <div className="-ml-1.5 h-2.5 w-2.5 rounded-full bg-danger" />
                </div>
              )}

              {layoutedTimedEvents.map((evt) => {
                const colors = getEventColors(evt.colorId);
                return (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => onSelectEvent(evt)}
                    style={{
                      top: `${evt.startMinutes * MOBILE_PX_PER_MIN}px`,
                      height: `${Math.max(evt.duration * MOBILE_PX_PER_MIN, 26)}px`,
                      left: `calc(${(evt.col / evt.totalCols) * 100}% + 2px)`,
                      width: `calc(${(1 / evt.totalCols) * 100}% - 4px)`,
                      backgroundColor: colors.bg,
                      borderLeftColor: colors.border,
                      color: colors.text,
                    }}
                    className="absolute z-10 select-none overflow-hidden rounded-r-md border-l-[3px] px-2 text-left shadow-xs transition-[filter] duration-fast hover:brightness-95"
                  >
                    <span className="block whitespace-nowrap text-micro tabular-nums opacity-80">{evt.startFormatted}</span>
                    <span className="block truncate text-micro font-semibold leading-tight">{evt.summary || '(Ohne Titel)'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};

export default MobileDaySheet;
