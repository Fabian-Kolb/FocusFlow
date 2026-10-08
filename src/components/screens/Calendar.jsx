import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { deleteCalendarEvent, createCalendarEvent, updateCalendarEvent } from '../../lib/calendarAPI';
import {
  WEEKDAY_NAMES,
  getCalendarDays,
  isEventOnDate,
  getLayoutedEvents,
  isAllDayEvent,
  defaultNewEvent,
  isSameDay,
} from '../../lib/calendarUtils';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { useMonthCarousel } from '../../hooks/useMonthCarousel';
import EventEditForm from './EventEditForm';
import CalendarHeader from '../calendar/CalendarHeader';
import CalendarStatusBanner from '../calendar/CalendarStatusBanner';
import MonthSlide from '../calendar/MonthSlide';
import DesktopDayPanel from '../calendar/DesktopDayPanel';
import MobileDaySheet from '../calendar/MobileDaySheet';
import { SearchModal, MonthPickerModal, EventDetailModal } from '../calendar/CalendarModals';

// Orchestrierung des Kalenders: Zustand (Monat/Tag/Dialoge), Laden über useCalendarEvents, Karussell über useMonthCarousel.
// Darstellung liegt in src/components/calendar/*, reine Logik in src/lib/calendarUtils.js.

const LAYOUT_KEY = 'focusflow_calendar_desktop_layout';
const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < 768;

const Calendar = () => {
  const { user, isCalendarConnected, linkGoogleCalendar } = useAuth();
  const { openModal } = useModal();

  const today = useMemo(() => new Date(), []);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const [selectedEvent, setSelectedEvent] = useState(null); // Detail-Dialog
  const [editingEvent, setEditingEvent] = useState(null); // Formular
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mobiles Tages-Sheet; lastClosedAt verhindert, dass der Schließ-Klick sofort wieder öffnet
  const [isMobileDayModalOpen, setIsMobileDayModalOpen] = useState(false);
  const lastClosedAtRef = useRef(0);
  const closeMobileDaySheet = useCallback(() => {
    lastClosedAtRef.current = Date.now();
    setIsMobileDayModalOpen(false);
  }, []);

  // Desktop/Tablet-Layout: 'stacked' oder 'side-by-side'
  const [desktopLayout, setDesktopLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved === 'stacked' || saved === 'side-by-side') return saved;
      return window.innerWidth >= 1280 ? 'side-by-side' : 'stacked';
    } catch {
      return 'stacked';
    }
  });
  const handleLayoutChange = (mode) => {
    setDesktopLayout(mode);
    try {
      localStorage.setItem(LAYOUT_KEY, mode);
    } catch {
      // gilt dann nur für diese Sitzung
    }
  };

  // Nachbarmonate für unterbrechungsfreies Vorladen & 3-Slide-Karussell
  const prevMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
  const prevYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear;
  const nextMonthIndex = currentMonthIndex === 11 ? 0 : currentMonthIndex + 1;
  const nextYear = currentMonthIndex === 11 ? currentYear + 1 : currentYear;

  const daysPrev = useMemo(() => getCalendarDays(prevYear, prevMonthIndex), [prevYear, prevMonthIndex]);
  const daysCurr = useMemo(() => getCalendarDays(currentYear, currentMonthIndex), [currentYear, currentMonthIndex]);
  const daysNext = useMemo(() => getCalendarDays(nextYear, nextMonthIndex), [nextYear, nextMonthIndex]);

  // Termine laden/cachen inkl. Fehler- und Offline-Zustand
  const { eventsCache, error, isOffline, isLoading, retry, reloadMonth } = useCalendarEvents({
    enabled: isCalendarConnected,
    year: currentYear,
    month: currentMonthIndex,
    prevYear,
    prevMonth: prevMonthIndex,
    nextYear,
    nextMonth: nextMonthIndex,
  });

  const currentMonthEvents = useMemo(
    () => eventsCache[`${currentYear}-${currentMonthIndex}`] || [],
    [eventsCache, currentYear, currentMonthIndex]
  );

  // Termine eines beliebigen Kalendertags aus dem übergreifenden Cache
  const getEventsForCell = useCallback((dateObj) => {
    const list = eventsCache[`${dateObj.getFullYear()}-${dateObj.getMonth()}`] || [];
    return list.filter((evt) => isEventOnDate(evt, dateObj));
  }, [eventsCache]);

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const goToMonth = useCallback((month, year) => {
    setCurrentMonthIndex(month);
    setCurrentYear(year);
    setSelectedDay((prev) => Math.min(prev, getDaysInMonth(month, year)));
  }, []);

  const handlePrevMonth = useCallback(() => {
    if (currentMonthIndex === 0) goToMonth(11, currentYear - 1);
    else goToMonth(currentMonthIndex - 1, currentYear);
  }, [currentMonthIndex, currentYear, goToMonth]);

  const handleNextMonth = useCallback(() => {
    if (currentMonthIndex === 11) goToMonth(0, currentYear + 1);
    else goToMonth(currentMonthIndex + 1, currentYear);
  }, [currentMonthIndex, currentYear, goToMonth]);

  const carousel = useMonthCarousel({ onNext: handleNextMonth, onPrev: handlePrevMonth });

  const handleResetToday = () => {
    const d = new Date();
    setCurrentMonthIndex(d.getMonth());
    setCurrentYear(d.getFullYear());
    setSelectedDay(d.getDate());
  };

  const handleConnectCalendar = async () => {
    if (user?.isGuest) {
      alert('Hinweis: Google Kalender ist für Gastkonten nicht verfügbar.');
      return;
    }
    try {
      await linkGoogleCalendar();
    } catch (err) {
      console.error('Verbindung fehlgeschlagen', err);
      alert('Fehler bei der Verbindung mit Google Kalender: ' + (err.message || err));
    }
  };

  const handleSaveEvent = async (eventData, eventId) => {
    if (isOffline) {
      alert('Du bist offline. Der Termin kann erst mit Internetverbindung gespeichert werden.');
      return;
    }
    try {
      if (eventId) await updateCalendarEvent(eventId, eventData);
      else await createCalendarEvent(eventData);
      await reloadMonth(currentYear, currentMonthIndex);
      setEditingEvent(null);
    } catch (err) {
      console.error('Fehler beim Speichern', err);
      alert('Fehler beim Speichern des Termins: ' + (err.message || err));
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (isOffline) {
      alert('Du bist offline. Der Termin kann erst mit Internetverbindung gelöscht werden.');
      return;
    }
    if (!window.confirm('Diesen Termin wirklich löschen?')) return;
    try {
      await deleteCalendarEvent(eventId);
      await reloadMonth(currentYear, currentMonthIndex);
      setSelectedEvent(null);
    } catch (err) {
      console.error('Fehler beim Löschen', err);
      alert('Fehler beim Löschen des Termins: ' + (err.message || err));
    }
  };

  // Klick auf Tag ODER Termin im Raster (UX-Vorgabe: auf Mobile kein Unterschied)
  const handleCellClick = (cell) => {
    if (Date.now() - lastClosedAtRef.current < 400) return;
    if (cell.isPrevMonth) handlePrevMonth();
    else if (cell.isNextMonth) handleNextMonth();
    setSelectedDay(cell.day);
    if (isMobileViewport()) setIsMobileDayModalOpen(true);
  };

  const handleEventClick = (evt, cell) => {
    handleCellClick(cell);
    if (!isMobileViewport()) setSelectedEvent(evt);
  };

  // Termine des ausgewählten Tages
  const selectedDateObj = useMemo(
    () => new Date(currentYear, currentMonthIndex, selectedDay),
    [currentYear, currentMonthIndex, selectedDay]
  );
  const dayEvents = useMemo(() => currentMonthEvents.filter((evt) => isEventOnDate(evt, selectedDateObj)), [currentMonthEvents, selectedDateObj]);
  const allDayEvents = useMemo(() => dayEvents.filter(isAllDayEvent), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter((evt) => !evt.start?.date && !!evt.start?.dateTime), [dayEvents]);
  const layoutedTimedEvents = useMemo(() => getLayoutedEvents(timedEvents, selectedDateObj), [timedEvents, selectedDateObj]);
  const weekdayName = WEEKDAY_NAMES[selectedDateObj.getDay()];
  const isSelectedToday = isSameDay(selectedDateObj, today);

  // "Jetzt"-Linie im Zeitstrahl
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    if (!isSelectedToday) return undefined;
    const update = () => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [isSelectedToday]);

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

  const startNewEvent = () => setEditingEvent(defaultNewEvent(currentYear, currentMonthIndex, selectedDay));

  // Zustand 1: nicht verbunden
  if (!isCalendarConnected) {
    return (
      <div className="screen-transition flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-surface-low rounded-full flex items-center justify-center mb-6 text-primary">
          <span className="material-symbols-outlined text-4xl">calendar_month</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Kalender verbinden</h2>
        <p className="text-on-surface-variant max-w-md mb-8">
          Verbinde deinen Google Kalender einmalig, um deine Projekte, Deadlines und Fokus-Zeiten dauerhaft zu synchronisieren.
        </p>
        <button
          type="button"
          onClick={handleConnectCalendar}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors flex items-center gap-2"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
          Mit Google Kalender verbinden
        </button>
      </div>
    );
  }

  // Zustand 2: Bearbeitungs-Formular
  if (editingEvent) {
    return (
      <EventEditForm
        initialEvent={Object.keys(editingEvent).length > 0 ? editingEvent : null}
        selectedDateObj={selectedDateObj}
        onSave={handleSaveEvent}
        onCancel={() => setEditingEvent(null)}
      />
    );
  }

  const monthSlideProps = { selectedDay, getEventsForCell, onCellClick: handleCellClick, onEventClick: handleEventClick };

  return (
    <div className="screen-transition flex flex-col flex-1 h-full min-h-0 bg-white">
      <CalendarHeader
        monthIndex={currentMonthIndex}
        year={currentYear}
        todayNumber={today.getDate()}
        desktopLayout={desktopLayout}
        onLayoutChange={handleLayoutChange}
        onMenu={() => openModal('settings')}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        onPickMonth={() => {
          setPickerYear(currentYear);
          setShowMonthPicker(true);
        }}
        onSearch={() => setShowSearchModal(true)}
        onToday={handleResetToday}
        onAddEvent={startNewEvent}
      />

      <CalendarStatusBanner error={error} isOffline={isOffline} isLoading={isLoading} onRetry={retry} />

      <div className={`flex flex-1 h-full min-h-0 overflow-hidden ${
        desktopLayout === 'side-by-side' ? 'flex-col md:flex-row md:items-stretch' : 'flex-col'
      }`}>
        {/* 3-Slide-Monats-Karussell: Vor- und Folgemonat sind vorgeladen und gerendert, Wischen zeigt immer echten Inhalt */}
        <div
          ref={carousel.containerRef}
          className="w-full flex-1 h-full min-h-0 overflow-hidden relative select-none"
          {...carousel.handlers}
        >
          <div
            className="flex w-full h-full"
            style={{
              transform: `translateX(calc(-100% + ${carousel.swipeOffset}px))`,
              transition: carousel.isAnimating ? 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
              willChange: carousel.isDragging || carousel.isAnimating ? 'transform' : 'auto',
            }}
          >
            <div className="w-full h-full flex-shrink-0 flex flex-col">
              <MonthSlide days={daysPrev} isCenter={false} {...monthSlideProps} />
            </div>
            <div className="w-full h-full flex-shrink-0 flex flex-col">
              <MonthSlide days={daysCurr} isCenter {...monthSlideProps} />
            </div>
            <div className="w-full h-full flex-shrink-0 flex flex-col">
              <MonthSlide days={daysNext} isCenter={false} {...monthSlideProps} />
            </div>
          </div>
        </div>

        <DesktopDayPanel
          selectedDateObj={selectedDateObj}
          dayEvents={dayEvents}
          sideBySide={desktopLayout === 'side-by-side'}
          onSelectEvent={setSelectedEvent}
          onAddEvent={startNewEvent}
        />
      </div>

      <MobileDaySheet
        open={isMobileDayModalOpen}
        onClose={closeMobileDaySheet}
        selectedDateObj={selectedDateObj}
        weekdayName={weekdayName}
        dayEvents={dayEvents}
        allDayEvents={allDayEvents}
        layoutedTimedEvents={layoutedTimedEvents}
        isSelectedToday={isSelectedToday}
        nowMinutes={nowMinutes}
        onSelectEvent={setSelectedEvent}
        onAddEvent={() => {
          closeMobileDaySheet();
          startNewEvent();
        }}
      />

      {showSearchModal && (
        <SearchModal
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          onClose={() => setShowSearchModal(false)}
          onSelect={(evt, dateObj) => {
            setCurrentYear(dateObj.getFullYear());
            setCurrentMonthIndex(dateObj.getMonth());
            setSelectedDay(dateObj.getDate());
            setSelectedEvent(evt);
            setShowSearchModal(false);
            if (isMobileViewport()) setIsMobileDayModalOpen(true);
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
            setCurrentMonthIndex(idx);
            setCurrentYear(year);
            setShowMonthPicker(false);
          }}
          onToday={() => {
            handleResetToday();
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
