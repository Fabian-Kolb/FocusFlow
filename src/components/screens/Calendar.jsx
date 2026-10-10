import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { deleteCalendarEvent, createCalendarEvent, updateCalendarEvent } from '../../lib/calendarAPI';
import {
  CALENDAR_VIEWS,
  addDays,
  addMonthsClamped,
  defaultNewEvent,
  defaultNewEventAt,
  formatViewTitle,
  getCalendarDays,
  getWeekDays,
  isEventOnDate,
  shiftByView,
  startOfDay,
} from '../../lib/calendarUtils';
import { isTypingTarget } from '../../lib/appCommands';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTimeGridScroll } from '../../hooks/useTimeGridScroll';
import EventEditForm from './EventEditForm';
import CalendarHeader from '../calendar/CalendarHeader';
import CalendarStatusBanner from '../calendar/CalendarStatusBanner';
import MonthSlide from '../calendar/MonthSlide';
import TimeGrid from '../calendar/TimeGrid';
import PeriodCarousel from '../calendar/PeriodCarousel';
import AgendaView from '../calendar/AgendaView';
import DaySidebar from '../calendar/DaySidebar';
import DaySheet from '../calendar/DaySheet';
import { SearchModal, MonthPickerModal, EventDetailModal } from '../calendar/CalendarModals';
import { Button, EmptyState } from '../ds';

// Orchestrierung des Kalenders: Ansicht (Monat, Woche, Tag, Agenda), gewählter Tag, Dialoge, Laden über useCalendarEvents.
// Darstellung liegt in src/components/calendar/*, reine Logik in src/lib/calendarUtils.js.
//
// Handy (Samsung-Stil): Das Raster füllt den Bildschirm, ein Tagessheet mit drei Haltepunkten sitzt unten, Wischen wechselt
// Monat, Woche, Tag. PC (Google-Stil): volle Breite, Umschalter in der Kopfzeile, Tagesleiste ein- und ausblendbar.

const VIEW_KEY = 'focusflow_calendar_view';
const SIDEBAR_KEY = 'focusflow_calendar_day_sidebar';
const PEEK_PADDING = 148; // Platz, den das Monatsraster dem Sheet in der Vorschau überlässt (siehe sheetSnap.js)
const SEQUENCE_GUARD_MS = 1200; // nach „g“ gehört die nächste Taste der Navigation (g, dann k …)

const readView = () => {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (CALENDAR_VIEWS.includes(saved)) return saved;
  } catch {
    // Storage gesperrt: Standardansicht
  }
  return 'month';
};
const readSidebar = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
};
const persist = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // gilt dann nur für diese Sitzung
  }
};

const Calendar = () => {
  const { user, isCalendarConnected, linkGoogleCalendar } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  // Das Dev-Konto hat keinen Google-Token; `calendarAPI` liefert dort lokale Beispieltermine
  const connected = isCalendarConnected || Boolean(user?.isDevAccount);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(readView);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [sheetState, setSheetState] = useState('closed');
  const [sidebarOpen, setSidebarOpen] = useState(readSidebar);

  const [selectedEvent, setSelectedEvent] = useState(null); // Detail-Dialog
  const [editingEvent, setEditingEvent] = useState(null); // Formular
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const lastClosedAtRef = useRef(0); // verhindert, dass der Schließ-Klick des Sheets sofort wieder öffnet
  const gridScrollRef = useRef(null);
  const lastGRef = useRef(0);

  const currentYear = selectedDate.getFullYear();
  const currentMonthIndex = selectedDate.getMonth();
  const selectedDay = selectedDate.getDate();

  // Nachbarmonate fürs unterbrechungsfreie Vorladen (Wischen zeigt immer echten Inhalt)
  const prev = addMonthsClamped(new Date(currentYear, currentMonthIndex, 1), -1);
  const next = addMonthsClamped(new Date(currentYear, currentMonthIndex, 1), 1);
  const prevYear = prev.getFullYear();
  const prevMonthIndex = prev.getMonth();
  const nextYear = next.getFullYear();
  const nextMonthIndex = next.getMonth();

  const { eventsCache, error, isOffline, isLoading, retry, reloadMonth, loadMonth } = useCalendarEvents({
    enabled: connected,
    year: currentYear,
    month: currentMonthIndex,
    prevYear,
    prevMonth: prevMonthIndex,
    nextYear,
    nextMonth: nextMonthIndex,
  });

  // Termine eines beliebigen Kalendertags aus dem übergreifenden Cache
  const getEventsForDate = useCallback((dateObj) => {
    const list = eventsCache[`${dateObj.getFullYear()}-${dateObj.getMonth()}`] || [];
    return list.filter((evt) => isEventOnDate(evt, dateObj));
  }, [eventsCache]);

  const monthDays = useMemo(
    () => [-1, 0, 1].map((delta) => {
      const first = new Date(currentYear, currentMonthIndex + delta, 1);
      return getCalendarDays(first.getFullYear(), first.getMonth());
    }),
    [currentYear, currentMonthIndex],
  );

  // Zeitraum je Karussell-Seite für Woche und Tag
  const slideDays = useMemo(() => {
    if (view === 'week') return [-1, 0, 1].map((delta) => getWeekDays(addDays(selectedDate, delta * 7)));
    return [-1, 0, 1].map((delta) => [addDays(selectedDate, delta)]);
  }, [view, selectedDate]);

  const dayEvents = useMemo(() => getEventsForDate(selectedDate), [getEventsForDate, selectedDate]);
  const monthLoaded = Boolean(eventsCache[`${currentYear}-${currentMonthIndex}`]);
  const pxPerHour = isDesktop ? 56 : 48;

  useTimeGridScroll(gridScrollRef, {
    enabled: view === 'week' || view === 'day',
    days: slideDays[1],
    getEventsForDate,
    pxPerHour,
    resetKey: view,
    ready: monthLoaded,
  });

  const goTo = useCallback((date) => setSelectedDate(startOfDay(date)), []);
  const step = useCallback((direction) => setSelectedDate((d) => shiftByView(view, d, direction)), [view]);
  const handlePrev = useCallback(() => step(-1), [step]);
  const handleNext = useCallback(() => step(1), [step]);
  const handleToday = useCallback(() => goTo(new Date()), [goTo]);

  const changeView = useCallback((next) => {
    setView(next);
    persist(VIEW_KEY, next);
    setSheetState('closed');
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      persist(SIDEBAR_KEY, open ? '0' : '1');
      return !open;
    });
  }, []);

  const handleSheetState = useCallback((nextState) => {
    if (nextState === 'closed') lastClosedAtRef.current = Date.now();
    setSheetState(nextState);
  }, []);

  const handleConnectCalendar = async () => {
    if (user?.isGuest) {
      showToast({ message: 'Google Kalender ist für Gastkonten nicht verfügbar.', icon: 'info' });
      return;
    }
    try {
      await linkGoogleCalendar();
    } catch (err) {
      console.error('Verbindung fehlgeschlagen', err);
      showToast({ message: 'Die Verbindung zu Google Kalender hat nicht geklappt. Versuch es noch einmal.', icon: 'error' });
    }
  };

  // Gepolsterte Termine erscheinen in zwei Monatslisten: nach dem Ändern alle drei sichtbaren Monate neu laden
  const reloadAround = () => Promise.all([
    reloadMonth(currentYear, currentMonthIndex),
    reloadMonth(prevYear, prevMonthIndex),
    reloadMonth(nextYear, nextMonthIndex),
  ]);

  const handleSaveEvent = async (eventData, eventId) => {
    if (isOffline) {
      showToast({ message: 'Du bist offline. Speichern geht erst mit Internetverbindung.', icon: 'cloud_off' });
      return;
    }
    try {
      if (eventId) await updateCalendarEvent(eventId, eventData);
      else await createCalendarEvent(eventData);
      await reloadAround();
      setEditingEvent(null);
    } catch (err) {
      console.error('Fehler beim Speichern', err);
      showToast({ message: 'Der Termin konnte nicht gespeichert werden. Versuch es noch einmal.', icon: 'error' });
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (isOffline) {
      showToast({ message: 'Du bist offline. Löschen geht erst mit Internetverbindung.', icon: 'cloud_off' });
      return;
    }
    const ok = await confirm({
      title: 'Termin löschen?',
      message: 'Der Termin wird auch in Google Kalender entfernt.',
      confirmLabel: 'Löschen',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCalendarEvent(eventId);
      await reloadAround();
      setSelectedEvent(null);
    } catch (err) {
      console.error('Fehler beim Löschen', err);
      showToast({ message: 'Der Termin konnte nicht gelöscht werden. Versuch es noch einmal.', icon: 'error' });
    }
  };

  const startNewEvent = () => setEditingEvent(defaultNewEvent(currentYear, currentMonthIndex, selectedDay));
  const handleSlotClick = (date, minutes) => setEditingEvent(defaultNewEventAt(date, minutes));

  // Klick auf Tag ODER Termin im Monatsraster: Handy öffnet das Tagessheet, PC wählt den Tag (Termin: Detail)
  const handleCellClick = (cell) => {
    if (Date.now() - lastClosedAtRef.current < 400) return;
    const same = cell.dateObj.toDateString() === selectedDate.toDateString();
    goTo(cell.dateObj);
    if (!isDesktop) setSheetState((s) => (s === 'closed' ? 'peek' : same ? 'closed' : s));
  };
  const handleEventClick = (evt, cell) => {
    if (isDesktop) {
      goTo(cell.dateObj);
      setSelectedEvent(evt);
    } else {
      handleCellClick(cell);
    }
  };
  const handleAddOnCell = (cell) => {
    goTo(cell.dateObj);
    setEditingEvent(defaultNewEventAt(cell.dateObj, 10 * 60));
  };
  const handleDayNumberClick = (cell) => {
    goTo(cell.dateObj);
    changeView('day');
  };
  const handleHeaderDayClick = (date) => {
    goTo(date);
    if (view !== 'day') changeView('day');
  };

  // Suche über alle vorgeladenen Termine
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const seen = new Set();
    const unique = [];
    for (const evt of Object.values(eventsCache).flat()) {
      if (!evt.id || seen.has(evt.id)) continue;
      seen.add(evt.id);
      if ([evt.summary, evt.description, evt.location].some((v) => v && v.toLowerCase().includes(q))) unique.push(evt);
    }
    return unique;
  }, [searchQuery, eventsCache]);

  // Tastatur am PC: ←/→ vor und zurück, T heute, M/W/D/A Ansicht, S Tagesleiste, C neuer Termin
  useEffect(() => {
    if (!connected || editingEvent || !isDesktop) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || document.querySelector('[data-overlay]')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'g') {
        lastGRef.current = Date.now();
        return;
      }
      if (Date.now() - lastGRef.current < SEQUENCE_GUARD_MS) return;
      const actions = {
        ArrowLeft: handlePrev,
        ArrowRight: handleNext,
        t: handleToday,
        m: () => changeView('month'),
        w: () => changeView('week'),
        d: () => changeView('day'),
        a: () => changeView('agenda'),
        s: () => view === 'month' && toggleSidebar(),
        c: startNewEvent,
      };
      const action = actions[key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // startNewEvent liest Datum aus dem State und ändert sich mit selectedDate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, editingEvent, isDesktop, view, selectedDate, handlePrev, handleNext, handleToday, changeView, toggleSidebar]);

  // Zustand 1: nicht verbunden
  if (!connected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <EmptyState
          bordered={false}
          icon="calendar_month"
          title="Kalender verbinden"
          description="Verbinde deinen Google Kalender einmalig, um deine Projekte, Deadlines und Fokus-Zeiten dauerhaft zu synchronisieren."
          action={(
            <Button size="lg" onClick={handleConnectCalendar}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-5 w-5 rounded-xs bg-white p-0.5" />
              Mit Google Kalender verbinden
            </Button>
          )}
        />
      </div>
    );
  }

  // Zustand 2: Bearbeitungs-Formular
  if (editingEvent) {
    return (
      <EventEditForm
        initialEvent={Object.keys(editingEvent).length > 0 ? editingEvent : null}
        selectedDateObj={selectedDate}
        onSave={handleSaveEvent}
        onCancel={() => setEditingEvent(null)}
      />
    );
  }

  const showSheet = !isDesktop && view === 'month';
  const showSidebar = isDesktop && view === 'month' && sidebarOpen;

  const gridProps = {
    getEventsForDate,
    pxPerHour,
    onSlotClick: handleSlotClick,
    onSelectEvent: setSelectedEvent,
    onDayClick: handleHeaderDayClick,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-surface md:overflow-hidden md:rounded-lg md:border md:border-subtle">
      <CalendarHeader
        isDesktop={isDesktop}
        view={view}
        onViewChange={changeView}
        title={formatViewTitle(view, selectedDate, { compact: !isDesktop })}
        todayNumber={today.getDate()}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onPickMonth={() => {
          setPickerYear(currentYear);
          setShowMonthPicker(true);
        }}
        onSearch={() => setShowSearchModal(true)}
        onAddEvent={startNewEvent}
        canToggleSidebar={isDesktop && view === 'month'}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />

      <CalendarStatusBanner error={error} isOffline={isOffline} isLoading={isLoading} onRetry={retry} />

      <div className="relative flex min-h-0 flex-1">
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-slow ease-enter motion-reduce:transition-none"
          style={showSheet && sheetState === 'peek' ? { paddingBottom: PEEK_PADDING } : undefined}
        >
          {view === 'month' && (
            <PeriodCarousel
              onPrev={handlePrev}
              onNext={handleNext}
              renderSlide={(delta) => (
                <MonthSlide
                  days={monthDays[delta + 1]}
                  isCenter={delta === 0}
                  selectedDay={selectedDay}
                  getEventsForCell={getEventsForDate}
                  onCellClick={handleCellClick}
                  onEventClick={handleEventClick}
                  onAddOnCell={isDesktop ? handleAddOnCell : undefined}
                  onDayNumberClick={isDesktop ? handleDayNumberClick : undefined}
                />
              )}
            />
          )}

          {(view === 'week' || view === 'day') && (
            <PeriodCarousel
              scrollable
              scrollRef={gridScrollRef}
              onPrev={handlePrev}
              onNext={handleNext}
              renderSlide={(delta) => <TimeGrid days={slideDays[delta + 1]} {...gridProps} />}
            />
          )}

          {view === 'agenda' && (
            <AgendaView
              startDate={selectedDate}
              today={today}
              getEventsForDate={getEventsForDate}
              loadMonth={loadMonth}
              isLoading={isLoading}
              onSelectEvent={setSelectedEvent}
              onAddEvent={startNewEvent}
            />
          )}
        </div>

        {showSidebar && (
          <DaySidebar
            date={selectedDate}
            getEventsForDate={getEventsForDate}
            ready={monthLoaded}
            onPrevDay={() => goTo(addDays(selectedDate, -1))}
            onNextDay={() => goTo(addDays(selectedDate, 1))}
            onClose={toggleSidebar}
            onSelectEvent={setSelectedEvent}
            onAddEvent={startNewEvent}
            onSlotClick={handleSlotClick}
          />
        )}

        {showSheet && (
          <DaySheet
            state={sheetState}
            onStateChange={handleSheetState}
            date={selectedDate}
            events={dayEvents}
            onPrevDay={() => goTo(addDays(selectedDate, -1))}
            onNextDay={() => goTo(addDays(selectedDate, 1))}
            onSelectEvent={setSelectedEvent}
            onAddEvent={startNewEvent}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>

      {showSearchModal && (
        <SearchModal
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          onClose={() => setShowSearchModal(false)}
          onSelect={(evt, dateObj) => {
            goTo(dateObj);
            setSelectedEvent(evt);
            setShowSearchModal(false);
          }}
        />
      )}

      {showMonthPicker && (
        <MonthPickerModal
          pickerYear={pickerYear}
          onPickerYearChange={setPickerYear}
          currentMonthIndex={currentMonthIndex}
          currentYear={currentYear}
          onPick={(idx, year) => {
            const lastDay = new Date(year, idx + 1, 0).getDate();
            goTo(new Date(year, idx, Math.min(selectedDay, lastDay)));
            setShowMonthPicker(false);
          }}
          onToday={() => {
            handleToday();
            setShowMonthPicker(false);
          }}
          onClose={() => setShowMonthPicker(false)}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onEdit={() => {
            const evt = selectedEvent;
            setSelectedEvent(null);
            setEditingEvent(evt);
          }}
          onDelete={() => handleDeleteEvent(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

export default Calendar;
