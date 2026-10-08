import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import {
  MONTH_NAMES_SHORT,
  HOURS,
  MOBILE_PX_PER_MIN,
  getEventColors,
} from '../../lib/calendarUtils';

const VIEW_MODE_KEY = 'focusflow_calendar_mobile_day_view';

/**
 * Mobiles Tages-Sheet (Bottom-Drawer, Regel 07): Liste (Standard) oder 24-h-Zeitstrahl.
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

  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);
  const drawerRef = useRef(null);
  const scrollRef = useRef(null);

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

  // Sanftes Ein-/Ausblenden: erst nach der Ausblend-Animation entfernen
  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return undefined;
    }
    setClosing(true);
    const t = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 280);
    return () => clearTimeout(t);
  }, [open]);

  const { drawerStyle, entryAnimActive, wasSwipedClosed } = useSwipeToClose({
    isOpen: open && rendered,
    onClose,
    drawerRef,
    scrollContainerRef: scrollRef,
    threshold: 120,
  });

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

  if (!rendered) return null;

  return (
    <div
      className={`md:hidden fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        closing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={drawerRef}
        className={`bg-white border-t border-neutral-200/80 rounded-t-[32px] w-full max-h-[90vh] h-[86vh] shadow-2xl flex flex-col overflow-hidden text-neutral-900 ${
          closing ? (wasSwipedClosed ? '' : 'drawer-slide-out-bottom') : entryAnimActive ? 'drawer-slide-in-bottom' : ''
        }`}
        style={{ ...drawerStyle, paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="pt-3 pb-1 flex justify-center flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-neutral-300/80 rounded-full" />
        </div>

        {/* Header: Tag-Badge, Wochentag, Umschalter Liste/Zeitstrahl */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {day}
            </div>
            <h2 className="text-xl font-bold text-neutral-900">{weekdayName}</h2>
          </div>

          <button
            type="button"
            onClick={() => changeViewMode(viewMode === 'list' ? 'timeline' : 'list')}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${
              viewMode === 'timeline' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
            title={viewMode === 'list' ? 'Zu Zeitstrahl wechseln (oder nach rechts wischen)' : 'Zu Liste wechseln'}
            aria-label="Ansicht umschalten"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
              <circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth={2} fill="none" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 11v1.5l1 0.5" />
            </svg>
          </button>
        </div>

        {/* Sub-Header */}
        <div className="px-5 py-2 flex items-center justify-between flex-shrink-0 text-sm">
          <span className="text-neutral-500 font-medium">{day}. {monthShort}</span>
          <button type="button" className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg transition-colors" title="Stimmung">
            <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
          </button>
        </div>

        {/* Inhalt: wischbar zwischen Liste und Zeitstrahl */}
        <div
          ref={scrollRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-2 space-y-3 pb-8 no-scrollbar"
        >
          {viewMode === 'list' ? (
            dayEvents.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-2.5 text-neutral-400">
                  <span className="material-symbols-outlined text-2xl">event_available</span>
                </div>
                <p className="text-sm font-semibold text-neutral-700">Keine Termine</p>
                <p className="text-xs text-neutral-400 mt-0.5">Keine Ereignisse an diesem Tag</p>
              </div>
            ) : (
              <>
                {/* Ganztägige Termine als große Pastell-Karten */}
                {allDayEvents.map((evt) => {
                  const colors = getEventColors(evt.colorId);
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onSelectEvent(evt)}
                      className="rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-xs active:scale-[0.99] flex flex-col gap-1 shadow-2xs"
                      style={{ backgroundColor: colors.bg, borderColor: `${colors.border}40` }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px]" style={{ color: colors.border }}>event</span>
                        <h3 className="font-bold text-neutral-900 text-sm md:text-base truncate">{evt.summary || '(Ohne Titel)'}</h3>
                      </div>
                      <p className="text-xs text-neutral-500 pl-7 font-medium">Ganztägig</p>
                    </div>
                  );
                })}

                {/* Zeitgebundene Termine: Startzeit nur beim ersten Termin eines Zeitpunkts */}
                <div className="divide-y divide-neutral-100">
                  {layoutedTimedEvents.map((evt, idx) => {
                    const colors = getEventColors(evt.colorId);
                    const prev = idx > 0 ? layoutedTimedEvents[idx - 1] : null;
                    const isFirstAtThisTime = !prev || prev.startFormatted !== evt.startFormatted;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => onSelectEvent(evt)}
                        className="py-3.5 flex items-center gap-3 cursor-pointer hover:bg-neutral-50/60 rounded-xl px-1.5 transition-colors group"
                      >
                        <div className="w-12 shrink-0 text-sm font-bold text-neutral-900 font-mono">
                          {isFirstAtThisTime ? evt.startFormatted : ''}
                        </div>
                        <div className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: colors.border }} />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-neutral-900 truncate">{evt.summary || '(Ohne Titel)'}</h4>
                          <p className="text-xs text-neutral-400 mt-0.5 font-mono">{evt.startFormatted} - {evt.endFormatted}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            /* ZEITSTRAHL (24-h-Raster) */
            <div className="relative flex w-full select-none" style={{ height: `${24 * 60 * MOBILE_PX_PER_MIN}px` }}>
              <div className="w-12 flex-shrink-0 relative border-r border-neutral-100">
                {HOURS.map((h) => (
                  <div
                    key={`mtime-${h}`}
                    className="absolute right-0 pr-1.5 text-[10px] font-mono font-medium text-neutral-400 leading-none"
                    style={{ top: `${h * 60 * MOBILE_PX_PER_MIN - 5}px` }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              <div className="relative flex-1 bg-white">
                {HOURS.map((h) => (
                  <div
                    key={`mslot-${h}`}
                    className="absolute left-0 right-0 border-t border-neutral-100/60"
                    style={{ top: `${h * 60 * MOBILE_PX_PER_MIN}px` }}
                  />
                ))}

                {isSelectedToday && (
                  <div
                    className="absolute left-0 right-0 h-[1.5px] bg-red-500 z-20 pointer-events-none flex items-center"
                    style={{ top: `${nowMinutes * MOBILE_PX_PER_MIN}px` }}
                  >
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm" />
                  </div>
                )}

                {layoutedTimedEvents.map((evt) => {
                  const colors = getEventColors(evt.colorId);
                  return (
                    <div
                      key={evt.id}
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
                      className="absolute z-10 border-l-[3.5px] rounded-r-lg px-2 overflow-hidden cursor-pointer hover:brightness-95 active:scale-[0.98] transition-all shadow-2xs select-none"
                    >
                      <div className="text-[10px] font-mono font-bold opacity-80 whitespace-nowrap">{evt.startFormatted}</div>
                      <div className="font-bold text-[11px] truncate leading-tight">{evt.summary || '(Ohne Titel)'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Unten angedockter Pill-Button */}
        <div className="p-4 pt-2 border-t border-neutral-100 flex-shrink-0 bg-white">
          <button
            type="button"
            onClick={onAddEvent}
            className="w-full rounded-full bg-neutral-100/90 hover:bg-neutral-200/90 active:scale-[0.99] border border-neutral-200/80 px-5 py-3 flex items-center justify-between text-neutral-500 text-sm shadow-sm transition-all"
          >
            <span>Am {day}. {monthShort} hinzufüg...</span>
            <span className="material-symbols-outlined text-[22px] text-neutral-800">add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileDaySheet;
