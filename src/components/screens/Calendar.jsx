import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchCalendarEvents, deleteCalendarEvent, createCalendarEvent, updateCalendarEvent } from '../../lib/calendarAPI';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import EventEditForm from './EventEditForm';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const WEEKDAY_NAMES = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Offizielle Google Calendar Event Farben (IDs 1-11)
const GOOGLE_COLORS = {
  "1": { bg: "#a4bdfc", text: "#1d3573" }, // Lavender
  "2": { bg: "#7ae7bf", text: "#1c4a38" }, // Sage
  "3": { bg: "#dbadff", text: "#4c266b" }, // Grape
  "4": { bg: "#ff887c", text: "#661b14" }, // Flamingo
  "5": { bg: "#fbd75b", text: "#665315" }, // Banana
  "6": { bg: "#ffb878", text: "#663b15" }, // Tangerine
  "7": { bg: "#46d6db", text: "#164d4f" }, // Peacock
  "8": { bg: "#e1e1e1", text: "#454545" }, // Graphite
  "9": { bg: "#5484ed", text: "#172d5c" }, // Blueberry
  "10": { bg: "#51b749", text: "#194215" }, // Basil
  "11": { bg: "#dc2127", text: "#590d10" }, // Tomato
};

// Hilfsfunktion: Berechnet Position (top, height) und Spaltenaufteilung bei Überlappungen
function getLayoutedEvents(timedEvents, selectedDate) {
  if (!timedEvents || timedEvents.length === 0) return [];

  const parsed = timedEvents.map((evt) => {
    const startD = new Date(evt.start.dateTime);
    const endD = new Date(evt.end?.dateTime || evt.start.dateTime);

    const dateStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const dateEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

    let startMinutes = startD.getHours() * 60 + startD.getMinutes();
    if (startD < dateStart) startMinutes = 0;

    let endMinutes = endD.getHours() * 60 + endD.getMinutes();
    if (endD > dateEnd || endD.getDate() !== selectedDate.getDate()) {
      endMinutes = 24 * 60;
    }
    if (endMinutes <= startMinutes) {
      endMinutes = Math.min(24 * 60, startMinutes + 30);
    }

    const duration = endMinutes - startMinutes;

    return {
      ...evt,
      startMinutes,
      endMinutes,
      duration,
      startFormatted: startD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      endFormatted: endD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  parsed.sort((a, b) => a.startMinutes - b.startMinutes || b.duration - a.duration);

  // Cluster bilden für überlappende Intervalle
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -1;

  for (const evt of parsed) {
    if (currentCluster.length === 0) {
      currentCluster.push(evt);
      clusterEnd = evt.endMinutes;
    } else if (evt.startMinutes < clusterEnd) {
      currentCluster.push(evt);
      clusterEnd = Math.max(clusterEnd, evt.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [evt];
      clusterEnd = evt.endMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Spalten innerhalb jedes Clusters zuweisen
  const result = [];
  for (const cluster of clusters) {
    const colEndTimes = [];
    for (const evt of cluster) {
      let placedCol = -1;
      for (let i = 0; i < colEndTimes.length; i++) {
        if (colEndTimes[i] <= evt.startMinutes) {
          colEndTimes[i] = evt.endMinutes;
          placedCol = i;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEndTimes.length;
        colEndTimes.push(evt.endMinutes);
      }
      evt.col = placedCol;
    }
    const totalCols = colEndTimes.length;
    for (const evt of cluster) {
      evt.totalCols = totalCols;
      result.push(evt);
    }
  }

  return result;
}

const SkeletonCalendarGrid = () => (
  <Card padding="none" className="w-full h-full flex-1 flex flex-col overflow-hidden border border-outline-variant rounded-2xl shadow-sm bg-white select-none opacity-60">
    <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-low/50 flex-shrink-0">
      {['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'].map((d, idx) => (
        <div key={d} className={`py-2 text-center text-xs font-mono font-bold tracking-wider ${idx >= 5 ? 'text-on-surface-variant/70' : 'text-on-surface'}`}>{d}</div>
      ))}
    </div>
    <div className="grid grid-cols-7 grid-rows-5 md:grid-rows-none bg-outline-variant/60 gap-px flex-1 h-full">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="min-h-0 md:min-h-[100px] lg:min-h-[115px] h-full p-1.5 md:p-2.5 bg-white flex flex-col justify-between">
          <div className="flex justify-between items-start opacity-40">
            <span className="w-6 h-6 rounded-full bg-surface-low text-xs font-mono flex items-center justify-center">{(i % 31) + 1}</span>
          </div>
          <div className="mt-1 space-y-1">
             <div className="h-2 bg-outline-variant/40 rounded w-full"></div>
             <div className="h-2 bg-outline-variant/40 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

// Hilfsfunktion: Berechnet alle Kalendertage für das 7-Spalten-Raster inkl. Vormonat- & Folgemonat-Padding
// Startet immer mit Montag (0 = MO, ..., 6 = SO)
function getCalendarDays(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  // In JS: 0 = Sonntag, 1 = Montag, ..., 6 = Samstag.
  // Für Montag-basierten Wochenstart: 0 = Mo, 1 = Di, ..., 6 = So
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const cells = [];

  // 1. Tage des Vormonats als führendes Padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dateObj = new Date(year, monthIndex - 1, day);
    cells.push({
      day,
      dateObj,
      year: dateObj.getFullYear(),
      monthIndex: dateObj.getMonth(),
      isCurrentMonth: false,
      isPrevMonth: true,
      key: `prev-${dateObj.getFullYear()}-${dateObj.getMonth()}-${day}`
    });
  }

  // 2. Tage des aktuellen Monats
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, monthIndex, day);
    cells.push({
      day,
      dateObj,
      year,
      monthIndex,
      isCurrentMonth: true,
      key: `curr-${year}-${monthIndex}-${day}`
    });
  }

  // 3. Tage des Folgemonats, um volle Zeilen (35 oder 42 Zellen) aufzufüllen
  const totalSlots = Math.ceil(cells.length / 7) * 7;
  const nextMonthDaysCount = totalSlots - cells.length;

  for (let day = 1; day <= nextMonthDaysCount; day++) {
    const dateObj = new Date(year, monthIndex + 1, day);
    cells.push({
      day,
      dateObj,
      year: dateObj.getFullYear(),
      monthIndex: dateObj.getMonth(),
      isCurrentMonth: false,
      isNextMonth: true,
      key: `next-${dateObj.getFullYear()}-${dateObj.getMonth()}-${day}`
    });
  }

  return cells;
}

const Calendar = () => {
  const { user, isCalendarConnected, linkGoogleCalendar, disconnectGoogleCalendar } = useAuth();
  
  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  
  const [events, setEvents] = useState([]);
  const [eventsCache, setEventsCache] = useState({}); // Cache-Speicher für jeden geladenen Monat (Format: 'YYYY-MM')
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null); // Für das Event-Detail Modal
  const [editingEvent, setEditingEvent] = useState(null); // Für die Vollbild-Bearbeitungsmaske (null = inaktiv, {} = neu, {...} = bearbeiten)
  
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [isMobileDayModalOpen, setIsMobileDayModalOpen] = useState(false);

  // Desktop/Tablet Layout-Präferenz: 'stacked' (untereinander) oder 'side-by-side' (nebeneinander)
  const [desktopLayout, setDesktopLayout] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('focusflow_calendar_desktop_layout');
      if (saved === 'stacked' || saved === 'side-by-side') return saved;
      return window.innerWidth >= 1280 ? 'side-by-side' : 'stacked';
    }
    return 'stacked';
  });

  const handleLayoutChange = (mode) => {
    setDesktopLayout(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('focusflow_calendar_desktop_layout', mode);
    }
  };

  // Swipe Gesten für Mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const onTouchStart = (e) => {
    if (isAnimating) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    setIsSwapping(false);
    setSwipeOffset(0);
  };

  const onTouchMove = (e) => {
    if (touchStart === null || isAnimating) return;
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);
    setSwipeOffset(currentX - touchStart);
  };

  const onTouchEnd = () => {
    if (isAnimating || !isDragging) return;
    setIsDragging(false);
    if (touchStart === null || touchEnd === null) {
      setSwipeOffset(0);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 80;
    const isRightSwipe = distance < -80;
    
    if (isLeftSwipe) {
      setIsAnimating(true);
      setSwipeOffset(-window.innerWidth);
      setTimeout(() => {
        setIsSwapping(true);
        handleNextMonth();
        setSwipeOffset(0);
        setTimeout(() => {
          setIsSwapping(false);
          setIsAnimating(false);
        }, 50);
      }, 300);
    } else if (isRightSwipe) {
      setIsAnimating(true);
      setSwipeOffset(window.innerWidth);
      setTimeout(() => {
        setIsSwapping(true);
        handlePrevMonth();
        setSwipeOffset(0);
        setTimeout(() => {
          setIsSwapping(false);
          setIsAnimating(false);
        }, 50);
      }, 300);
    } else {
      setIsAnimating(true);
      setSwipeOffset(0);
      setTimeout(() => setIsAnimating(false), 300);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Scroll Listener for mobile FAB
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsScrollingDown(true);
      } else if (currentScrollY < lastScrollY) {
        setIsScrollingDown(false);
      }
      lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hole Events, wenn verbunden ODER sich der Monat ändert
  useEffect(() => {
    async function loadEvents() {
      if (!isCalendarConnected) return;
      
      const cacheKey = `${currentYear}-${currentMonthIndex}`;
      
      // 1. Prüfen, ob wir diesen Monat schon geladen haben (Caching)
      if (eventsCache[cacheKey]) {
        setEvents(eventsCache[cacheKey]);
        return;
      }
      
      // 2. Falls nicht, laden wir dynamisch für diesen spezifischen Monat
      setIsLoading(true);
      setError(null);
      try {
        const fetchedEvents = await fetchCalendarEvents(currentYear, currentMonthIndex);
        setEventsCache(prev => ({ ...prev, [cacheKey]: fetchedEvents }));
        setEvents(fetchedEvents);
      } catch (err) {
        console.error("Fehler beim Laden der Kalenderdaten", err);
        setError("Die Kalenderdaten konnten nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }
    
    loadEvents();
  }, [isCalendarConnected, currentMonthIndex, currentYear]);

  const handleConnectCalendar = async () => {
    if (user?.isGuest) {
      alert("Hinweis: Die Google Kalender-Synchronisation ist in dieser Vorschauversion nur für freigeschaltete Benutzerkonten verfügbar.");
      return;
    }
    try {
      await linkGoogleCalendar();
    } catch (err) {
      console.error("Verbindung fehlgeschlagen", err);
      alert("Fehler bei der Verbindung mit Google Kalender: " + (err.message || err));
    }
  };

  // Hilfsfunktion: Berechne, wie viele Tage ein Monat hat
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    let newMonth, newYear;
    if (currentMonthIndex === 0) {
      newMonth = 11;
      newYear = currentYear - 1;
    } else {
      newMonth = currentMonthIndex - 1;
      newYear = currentYear;
    }
    const maxDays = getDaysInMonth(newMonth, newYear);
    setCurrentMonthIndex(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(prev => Math.min(prev, maxDays));
  };

  const handleNextMonth = () => {
    let newMonth, newYear;
    if (currentMonthIndex === 11) {
      newMonth = 0;
      newYear = currentYear + 1;
    } else {
      newMonth = currentMonthIndex + 1;
      newYear = currentYear;
    }
    const maxDays = getDaysInMonth(newMonth, newYear);
    setCurrentMonthIndex(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(prev => Math.min(prev, maxDays));
  };

  const triggerSwipe = (direction) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsDragging(false);
    setIsSwapping(false);
    
    setSwipeOffset(direction === 'left' ? -window.innerWidth : window.innerWidth);
    
    setTimeout(() => {
      setIsSwapping(true);
      if (direction === 'left') handleNextMonth();
      else handlePrevMonth();
      setSwipeOffset(0);
      
      setTimeout(() => {
        setIsSwapping(false);
        setIsAnimating(false);
      }, 50);
    }, 300);
  };

  const handleResetToday = () => {
    const d = new Date();
    setCurrentMonthIndex(d.getMonth());
    setCurrentYear(d.getFullYear());
    setSelectedDay(d.getDate());
  };

  const handleSaveEvent = async (eventData, eventId) => {
    try {
      if (eventId) {
        await updateCalendarEvent(eventId, eventData);
      } else {
        await createCalendarEvent(eventData);
      }
      const cacheKey = `${currentYear}-${currentMonthIndex}`;
      const fetchedEvents = await fetchCalendarEvents(currentYear, currentMonthIndex);
      setEventsCache(prev => ({ ...prev, [cacheKey]: fetchedEvents }));
      setEvents(fetchedEvents);
      setEditingEvent(null);
    } catch (err) {
      console.error("Fehler beim Speichern", err);
      alert("Fehler beim Speichern des Termins: " + (err.message || err));
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Diesen Termin wirklich löschen?")) return;
    try {
      await deleteCalendarEvent(eventId);
      const cacheKey = `${currentYear}-${currentMonthIndex}`;
      const fetchedEvents = await fetchCalendarEvents(currentYear, currentMonthIndex);
      setEventsCache(prev => ({ ...prev, [cacheKey]: fetchedEvents }));
      setEvents(fetchedEvents);
      setSelectedEvent(null);
    } catch (err) {
      console.error("Fehler beim Löschen", err);
      alert("Fehler beim Löschen des Termins: " + (err.message || err));
    }
  };

  // Berechne das 7-Spalten-Raster für den aktuellen Monat (inkl. Vormonat- & Folgemonat-Padding)
  const calendarDays = useMemo(() => {
    return getCalendarDays(currentYear, currentMonthIndex);
  }, [currentYear, currentMonthIndex]);

  const rowCount = Math.ceil(calendarDays.length / 7);
  const gridRowsClass = rowCount === 5 ? 'grid-rows-5 md:grid-rows-none' : 'grid-rows-6 md:grid-rows-none';

  const isDateToday = (dateObj) => {
    const n = new Date();
    return (
      dateObj.getDate() === n.getDate() &&
      dateObj.getMonth() === n.getMonth() &&
      dateObj.getFullYear() === n.getFullYear()
    );
  };

  const handleCellClick = (cell) => {
    if (cell.isPrevMonth) {
      handlePrevMonth();
      setSelectedDay(cell.day);
    } else if (cell.isNextMonth) {
      handleNextMonth();
      setSelectedDay(cell.day);
    } else {
      setSelectedDay(cell.day);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileDayModalOpen(true);
    }
  };

  const handleAddEventOnCell = (e, cell) => {
    e.stopPropagation();
    handleCellClick(cell);
    const startD = new Date(cell.year, cell.monthIndex, cell.day, 10, 0);
    const endD = new Date(cell.year, cell.monthIndex, cell.day, 11, 0);
    setEditingEvent({
      start: { dateTime: startD.toISOString() },
      end: { dateTime: endD.toISOString() }
    });
  };
  
  // Hilfsfunktion: Überprüft, ob ein Event an einem bestimmten Datum stattfindet (auch mehrtägig/ganztägig)
  const isEventOnDate = (evt, dateObj) => {
    if (!evt.start || (!evt.start.dateTime && !evt.start.date)) return false;
    const isAllDay = !!evt.start.date;
    
    // Parse date correctly avoiding UTC timezone shifting for YYYY-MM-DD
    const parseDate = (dateStr, isEnd) => {
      if (dateStr.includes('T')) return new Date(dateStr);
      const [y, m, d] = dateStr.split('-');
      const localDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      if (isEnd) return new Date(localDate.getTime() - 1);
      return localDate;
    };

    const eventStart = parseDate(evt.start.dateTime || evt.start.date, false);
    const eventEnd = evt.end ? parseDate(evt.end.dateTime || evt.end.date, isAllDay) : eventStart;

    const checkStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const checkEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
    return eventStart <= checkEnd && eventEnd >= checkStart;
  };

  // Filter Events für den ausgewählten Tag
  const selectedDateObj = new Date(currentYear, currentMonthIndex, selectedDay);
  
  // Synchronous check if data is loading to avoid 1-frame empty flash during animation
  const currentCacheKey = `${currentYear}-${currentMonthIndex}`;
  const isDataLoading = isLoading || !eventsCache[currentCacheKey];
  
  // If we are currently loading and don't have cached events for this month, fallback to empty array temporarily
  // to avoid rendering previous month's events in the new month's grid
  const currentMonthEvents = eventsCache[currentCacheKey] ? events : [];
  const dayEvents = currentMonthEvents.filter(evt => isEventOnDate(evt, selectedDateObj));

  const allDayEvents = dayEvents.filter(evt => !!evt.start?.date);
  const timedEvents = dayEvents.filter(evt => !evt.start?.date && !!evt.start?.dateTime);
  const layoutedTimedEvents = getLayoutedEvents(timedEvents, selectedDateObj);
  const weekdayName = WEEKDAY_NAMES[selectedDateObj.getDay()];

  const isSelectedToday = 
    today.getDate() === selectedDay &&
    today.getMonth() === currentMonthIndex &&
    today.getFullYear() === currentYear;

  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  const timeGridScrollRef = useRef(null);

  useEffect(() => {
    if (!isSelectedToday) return;
    const updateNow = () => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    };
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [isSelectedToday]);

  // Automatischer Scroll im Stundenraster zum passenden Startzeitpunkt
  useEffect(() => {
    if (!timeGridScrollRef.current) return;
    let targetMinutes = 8 * 60; // 08:00 morgens als Standard
    if (isSelectedToday) {
      const now = new Date();
      targetMinutes = Math.max(0, (now.getHours() - 1) * 60);
    } else if (timedEvents.length > 0) {
      const earliestHour = Math.min(...timedEvents.map(evt => new Date(evt.start.dateTime).getHours()));
      targetMinutes = Math.max(0, (earliestHour - 1) * 60);
    }
    timeGridScrollRef.current.scrollTop = targetMinutes;
  }, [selectedDay, currentMonthIndex, currentYear, isSelectedToday, timedEvents.length]);

  const handlePrevDay = () => {
    if (selectedDay > 1) {
      setSelectedDay(selectedDay - 1);
    } else {
      if (currentMonthIndex === 0) {
        setCurrentMonthIndex(11);
        setCurrentYear(y => y - 1);
        setSelectedDay(31);
      } else {
        const prevMonthLastDay = new Date(currentYear, currentMonthIndex, 0).getDate();
        setCurrentMonthIndex(m => m - 1);
        setSelectedDay(prevMonthLastDay);
      }
    }
  };

  const handleNextDay = () => {
    const daysInMonth = getDaysInMonth(currentMonthIndex, currentYear);
    if (selectedDay < daysInMonth) {
      setSelectedDay(selectedDay + 1);
    } else {
      if (currentMonthIndex === 11) {
        setCurrentMonthIndex(0);
        setCurrentYear(y => y + 1);
        setSelectedDay(1);
      } else {
        setCurrentMonthIndex(m => m + 1);
        setSelectedDay(1);
      }
    }
  };

  const handleSlotClick = (hour) => {
    const slotStart = new Date(currentYear, currentMonthIndex, selectedDay, hour, 0, 0);
    const slotEnd = new Date(currentYear, currentMonthIndex, selectedDay, hour + 1, 0, 0);
    setEditingEvent({
      start: { dateTime: slotStart.toISOString() },
      end: { dateTime: slotEnd.toISOString() }
    });
  };

  const handleDayClick = (dayNum) => {
    setSelectedDay(dayNum);
  };

  const handleAddEventOnDay = (e, dayNum) => {
    e.stopPropagation();
    setSelectedDay(dayNum);
    setEditingEvent({});
  };

  // Render State 1: Nicht verbunden
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
          onClick={handleConnectCalendar}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors flex items-center gap-2"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
          Mit Google Kalender verbinden
        </button>
      </div>
    );
  }

  // Render State 3: Bearbeitungs-Modus (Neu oder Edit)
  if (editingEvent) {
    const selectedDateObj = new Date(currentYear, currentMonthIndex, selectedDay);
    return (
      <EventEditForm 
        initialEvent={Object.keys(editingEvent).length > 0 ? editingEvent : null}
        selectedDateObj={selectedDateObj}
        onSave={handleSaveEvent}
        onCancel={() => setEditingEvent(null)}
      />
    );
  }

  // Render State 2: Verbunden
  return (
    <div className="screen-transition flex flex-col flex-1 h-full min-h-0">
      
      <div className="mb-2 md:mb-6 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4 flex-wrap flex-shrink-0">
        
        {/* Mobile: Swipe Hint */}
        <div className="md:hidden text-[10px] text-on-surface-variant w-full text-center uppercase tracking-widest font-bold opacity-50 mb-0.5">
          Wischen für nächsten Monat
        </div>

        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-between md:justify-start">
          {/* Navigations-Steuerung: < Heute > */}
          <div className="flex items-center gap-1 bg-surface-low border border-outline-variant rounded-xl p-1 shadow-xs">
            <button
              onClick={() => triggerSwipe('right')}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-on-surface-variant hover:text-primary active:scale-95 flex items-center justify-center"
              title="Vorheriger Monat"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              onClick={handleResetToday}
              className="px-2.5 py-1 hover:bg-white text-xs font-bold rounded-lg transition-colors text-primary active:scale-95 border border-transparent hover:border-outline-variant shadow-xs"
              title="Zum heutigen Tag springen"
            >
              Heute
            </button>
            <button
              onClick={() => triggerSwipe('left')}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-on-surface-variant hover:text-primary active:scale-95 flex items-center justify-center"
              title="Nächster Monat"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          {/* Monats- & Jahresauswahl Header */}
          <h2 
            className="text-xl md:text-2xl font-bold cursor-pointer hover:text-primary transition-colors flex items-center gap-1 select-none whitespace-nowrap pl-1"
            onClick={() => {
              setPickerYear(currentYear);
              setShowMonthPicker(true);
            }}
            title="Monat & Jahr wählen"
          >
            <span>{MONTH_NAMES[currentMonthIndex]} {currentYear}</span>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_drop_down</span>
          </h2>
        </div>

        {/* Rechte Steuerung: Layout-Umschalter & Neuer Termin (Desktop/Tablet ab 768px) */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Layout-Umschalter: Untereinander vs. Nebeneinander */}
          <div 
            className="flex items-center bg-surface-low border border-outline-variant rounded-xl p-1 shadow-xs"
            role="group"
            aria-label="Kalender-Layout auswählen"
          >
            <button
              type="button"
              onClick={() => handleLayoutChange('stacked')}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                desktopLayout === 'stacked'
                  ? 'bg-white text-primary font-bold shadow-xs border border-outline-variant/60'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
              title="Layout: Monatsraster und Tages-Timeline untereinander"
              aria-label="Layout: Untereinander"
            >
              <span className="material-symbols-outlined text-[18px]">view_agenda</span>
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange('side-by-side')}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                desktopLayout === 'side-by-side'
                  ? 'bg-white text-primary font-bold shadow-xs border border-outline-variant/60'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
              title="Layout: Monatsraster und Tages-Timeline nebeneinander"
              aria-label="Layout: Nebeneinander"
            >
              <span className="material-symbols-outlined text-[18px]">vertical_split</span>
            </button>
          </div>

          {/* Neuer Termin Button */}
          <button 
            onClick={() => {
              const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
              const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
              setEditingEvent({
                start: { dateTime: startD.toISOString() },
                end: { dateTime: endD.toISOString() }
              });
            }}
            className="w-auto bg-primary text-white text-sm px-4 py-2 rounded-xl font-bold hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xs whitespace-nowrap flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Neuer Termin
          </button>
        </div>
      </div>

      {/* Token-Ablauf / Fehler-Banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-error/10 border border-error/30 text-error rounded-xl px-4 py-3 text-sm">
          <span className="material-symbols-outlined text-[20px] flex-shrink-0">warning</span>
          <span className="flex-1">{error}</span>
          <button
            onClick={async () => {
              setError(null);
              setEventsCache({});
              await handleConnectCalendar();
            }}
            className="ml-2 font-bold underline whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            Neu verbinden
          </button>
        </div>
      )}

      <div className={`flex flex-1 h-full overflow-x-hidden pb-0 md:pb-6 ${
        desktopLayout === 'side-by-side'
          ? 'flex-col md:flex-row md:items-stretch gap-4 md:gap-5'
          : 'flex-col gap-4 md:gap-8'
      }`}>
        {/* Kalender Raster (Auf Mobile immer volle Höhe flex-1 h-full, am Desktop je nach Modus) */}
        <div 
          className={`w-full flex-1 h-full flex flex-col relative ${
            desktopLayout === 'side-by-side' ? 'md:min-w-0' : ''
          }`}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isDragging || isSwapping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Previous Month Mockup (visible when dragging right) */}
          {(isDragging || isAnimating) && swipeOffset > 0 && (
            <div className="absolute top-0 w-full h-full pointer-events-none" style={{ left: 'calc(-100% - 24px)' }}>
              <SkeletonCalendarGrid />
            </div>
          )}

          {/* Next Month Mockup (visible when dragging left) */}
          {(isDragging || isAnimating) && swipeOffset < 0 && (
            <div className="absolute top-0 w-full h-full pointer-events-none" style={{ left: 'calc(100% + 24px)' }}>
              <SkeletonCalendarGrid />
            </div>
          )}

          <Card padding="none" className="w-full h-full flex-1 flex flex-col overflow-hidden border border-outline-variant rounded-2xl shadow-sm bg-white select-none relative z-10">
            {/* Wochentags-Kopfzeile */}
            <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-low/50 flex-shrink-0">
              {['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'].map((d, idx) => {
                const isWeekend = idx >= 5;
                return (
                  <div
                    key={d}
                    className={`py-2.5 text-center text-xs font-mono font-bold tracking-wider ${
                      isWeekend ? 'text-on-surface-variant/70' : 'text-on-surface'
                    }`}
                  >
                    {d}
                  </div>
                );
              })}
            </div>

            {/* 7-Spalten Monats-Raster (volles 35- bzw. 42-Tage-Grid) */}
            <div className={`grid grid-cols-7 bg-outline-variant/60 gap-px flex-1 h-full ${gridRowsClass}`}>
              {calendarDays.map((cell, cellIdx) => {
                const isToday = isDateToday(cell.dateObj);
                const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
                const isWeekend = (cellIdx % 7) >= 5;

                // Finde Events für diese Zelle und sortiere sie chronologisch (Ganztägig zuerst, dann nach Startzeit)
                const cellEvents = currentMonthEvents.filter(evt => isEventOnDate(evt, cell.dateObj));
                const sortedCellEvents = cellEvents.slice().sort((a, b) => {
                  const isAllDayA = !a.start?.dateTime && !!a.start?.date;
                  const isAllDayB = !b.start?.dateTime && !!b.start?.date;
                  if (isAllDayA && !isAllDayB) return -1;
                  if (!isAllDayA && isAllDayB) return 1;
                  const timeA = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0;
                  const timeB = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0;
                  return timeA - timeB;
                });

                let bgClass = "bg-white hover:bg-surface-low/50";
                if (isSelected) {
                  bgClass = "bg-surface-low/90 ring-2 ring-inset ring-primary z-10";
                } else if (isToday) {
                  bgClass = "bg-primary/[0.03] hover:bg-primary/[0.06]";
                } else if (!cell.isCurrentMonth) {
                  bgClass = "bg-surface/50 hover:bg-surface-low/60";
                } else if (isWeekend) {
                  bgClass = "bg-[#FCFAFA] hover:bg-surface-low/50";
                }

                return (
                  <div
                    key={cell.key}
                    className={`min-h-0 md:min-h-[100px] lg:min-h-[115px] h-full p-1.5 md:p-2.5 cursor-pointer flex flex-col justify-between transition-colors group ${bgClass}`}
                    onClick={() => handleCellClick(cell)}
                    onDoubleClick={(e) => handleAddEventOnCell(e, cell)}
                  >
                    {/* Zellen-Header: Tageszahl & 'Heute'-Badge */}
                    <div className="flex items-center justify-between">
                      {isToday ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs md:text-sm shadow-xs ring-2 ring-primary/20">
                            {cell.day}
                          </span>
                          <span className="hidden lg:inline-block text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            Heute
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs md:text-sm font-mono ${
                            isSelected
                              ? 'font-bold text-primary bg-surface-low border border-outline-variant shadow-xs'
                              : cell.isCurrentMonth
                              ? 'text-on-surface font-semibold'
                              : 'text-on-surface-variant/40 font-normal'
                          }`}
                        >
                          {cell.day}
                        </span>
                      )}

                      {/* Desktop Hover-Plus zum schnellen Erstellen */}
                      {cell.isCurrentMonth && (
                        <button
                          onClick={(e) => handleAddEventOnCell(e, cell)}
                          className="hidden md:group-hover:flex w-5 h-5 items-center justify-center rounded-md hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                          title="Termin an diesem Tag erstellen"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      )}
                    </div>

                    {/* Ladezustand */}
                    {isDataLoading ? (
                      <div className="mt-1 space-y-1 opacity-40">
                        <div className="h-2 bg-outline-variant/60 rounded w-full animate-pulse"></div>
                        <div className="h-2 bg-outline-variant/60 rounded w-2/3 animate-pulse"></div>
                      </div>
                    ) : sortedCellEvents.length > 0 ? (
                      /* Termineinträge im Kalender-Raster (Mobile & Desktop, ohne Uhrzeit, klar lesbar mit Umbruch) */
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {sortedCellEvents.slice(0, 2).map((evt) => {
                          const isAllDay = !evt.start?.dateTime && !!evt.start?.date;
                          const customColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : null;
                          const bg = customColor
                            ? (isAllDay ? customColor.bg : `${customColor.bg}25`)
                            : (isAllDay ? '#1A1A1A' : 'rgba(26, 26, 26, 0.08)');
                          const text = customColor ? customColor.text : (isAllDay ? '#FFFFFF' : '#1A1A1A');
                          const border = customColor ? customColor.bg : '#1A1A1A';

                          return (
                            <div
                              key={evt.id}
                              className="px-1.5 py-0.5 md:py-1 rounded-md text-[9.5px] md:text-[11px] font-semibold leading-snug line-clamp-2 break-words cursor-pointer hover:brightness-95 hover:shadow-xs transition-all border border-black/10 flex items-start select-none shadow-2xs"
                              style={{ backgroundColor: bg, color: text, borderLeftColor: border, borderLeftWidth: '3px' }}
                              title={evt.summary || '(Ohne Titel)'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(evt);
                              }}
                            >
                              <span className="line-clamp-2 break-words w-full">
                                {evt.summary || '(Ohne Titel)'}
                              </span>
                            </div>
                          );
                        })}
                        {sortedCellEvents.length > 2 && (
                          <div className="text-[8.5px] md:text-[9.5px] font-mono font-bold text-on-surface-variant text-center pt-0.5">
                            +{sortedCellEvents.length - 2} weitere
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Tages-Timeline (Unter oder neben dem Kalender, ab Tablet / 768px sichtbar) */}
        <div className={`w-full hidden md:block ${
          desktopLayout === 'side-by-side'
            ? 'md:w-[290px] lg:w-[325px] xl:w-[350px] md:flex-shrink-0 md:flex md:flex-col'
            : ''
        }`}>
          <Card 
            padding="none" 
            className={`w-full border border-outline-variant rounded-2xl shadow-sm bg-white overflow-hidden ${
              desktopLayout === 'side-by-side' 
                ? 'h-full flex-1 flex flex-col' 
                : 'p-4 sm:p-6 space-y-4'
            }`}
          >
            {/* Header mit Tag, Datum, Navigation und Aktionsbutton */}
            {desktopLayout === 'side-by-side' ? (
              <div className="p-3 lg:p-3.5 border-b border-outline-variant bg-surface-low/50 flex-shrink-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/5 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs lg:text-sm font-bold text-on-surface truncate">
                        {weekdayName}, {selectedDay}. {MONTH_NAMES[currentMonthIndex]}
                      </h3>
                      {isSelectedToday && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-white flex-shrink-0">
                          Heute
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {dayEvents.length === 0
                        ? 'Keine Termine'
                        : `${dayEvents.length} ${dayEvents.length === 1 ? 'Termin' : 'Termine'}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={handlePrevDay}
                    className="p-1 hover:bg-white rounded-lg transition-colors text-on-surface-variant hover:text-on-surface border border-outline-variant/60 shadow-2xs active:scale-95"
                    title="Vorheriger Tag"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                  </button>
                  {!isSelectedToday && (
                    <button
                      onClick={handleResetToday}
                      className="px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-white rounded-lg transition-colors border border-outline-variant/60 shadow-2xs active:scale-95"
                    >
                      Heute
                    </button>
                  )}
                  <button
                    onClick={handleNextDay}
                    className="p-1 hover:bg-white rounded-lg transition-colors text-on-surface-variant hover:text-on-surface border border-outline-variant/60 shadow-2xs active:scale-95"
                    title="Nächster Tag"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>
                  <button
                    onClick={() => {
                      const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                      const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                      setEditingEvent({
                        start: { dateTime: startD.toISOString() },
                        end: { dateTime: endD.toISOString() }
                      });
                    }}
                    className="p-1 bg-primary text-white rounded-lg hover:bg-black active:scale-95 transition-all shadow-2xs ml-0.5 flex items-center justify-center"
                    title="Termin an diesem Tag erstellen"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[22px]">schedule</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base md:text-lg font-bold text-on-surface">
                        {weekdayName}, {selectedDay}. {MONTH_NAMES[currentMonthIndex]} {currentYear}
                      </h3>
                      {isSelectedToday && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-white">
                          Heute
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {dayEvents.length === 0
                        ? 'Keine Termine für diesen Tag'
                        : `${dayEvents.length} ${dayEvents.length === 1 ? 'Termin' : 'Termine'} (${allDayEvents.length} ganztägig, ${timedEvents.length} mit Uhrzeit)`}
                    </p>
                  </div>
                </div>

                {/* Navigation & Neuer Termin Button */}
                <div className="flex items-center gap-1.5 self-end md:self-auto">
                  <button
                    onClick={handlePrevDay}
                    className="p-1.5 hover:bg-surface-low rounded-lg transition-colors text-on-surface-variant hover:text-on-surface border border-outline-variant/60 shadow-xs active:scale-95"
                    title="Vorheriger Tag"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  {!isSelectedToday && (
                    <button
                      onClick={handleResetToday}
                      className="px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors border border-outline-variant/60 shadow-xs active:scale-95"
                    >
                      Heute
                    </button>
                  )}
                  <button
                    onClick={handleNextDay}
                    className="p-1.5 hover:bg-surface-low rounded-lg transition-colors text-on-surface-variant hover:text-on-surface border border-outline-variant/60 shadow-xs active:scale-95"
                    title="Nächster Tag"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                  <div className="w-px h-5 bg-outline-variant mx-1"></div>
                  <button
                    onClick={() => {
                      const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                      const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                      setEditingEvent({
                        start: { dateTime: startD.toISOString() },
                        end: { dateTime: endD.toISOString() }
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-black active:scale-95 transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Termin
                  </button>
                </div>
              </div>
            )}

            {/* Ganztägige Termine (falls vorhanden) */}
            {allDayEvents.length > 0 && (
              desktopLayout === 'side-by-side' ? (
                <div className="px-3 py-2 bg-surface-low/30 border-b border-outline-variant flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1 flex-shrink-0 select-none">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                    Ganztägig:
                  </span>
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    {allDayEvents.map((evt) => {
                      const customColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : null;
                      const bg = customColor ? customColor.bg : 'var(--primary)';
                      const text = customColor ? customColor.text : '#1A1A1A';
                      return (
                        <button
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold flex items-center gap-1 hover:brightness-95 transition-all border shadow-2xs flex-shrink-0"
                          style={{ backgroundColor: `${bg}25`, borderColor: bg, color: text }}
                          title={evt.summary}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: bg }}></span>
                          <span className="truncate max-w-[130px]">{evt.summary || '(Ohne Titel)'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-surface-low/70 rounded-xl border border-outline-variant/60 flex-wrap">
                  <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1 mt-0.5 select-none">
                    <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                    Ganztägig:
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {allDayEvents.map((evt) => {
                      const customColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : null;
                      const bg = customColor ? customColor.bg : 'var(--primary)';
                      const text = customColor ? customColor.text : '#1A1A1A';
                      return (
                        <button
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:brightness-95 hover:shadow-xs transition-all border shadow-xs"
                          style={{ backgroundColor: `${bg}25`, borderColor: bg, color: text }}
                          title={evt.summary}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bg }}></span>
                          <span className="truncate max-w-[240px]">{evt.summary || '(Ohne Titel)'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Festes Stunden-Raster (Time Grid) */}
            <div
              ref={timeGridScrollRef}
              className={`relative overflow-y-auto no-scrollbar overflow-x-hidden select-none ${
                desktopLayout === 'side-by-side'
                  ? 'flex-1 min-h-0 bg-surface/10'
                  : 'h-[420px] md:h-[560px] border border-outline-variant/60 rounded-xl bg-surface/30'
              }`}
            >
              {isDataLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-30 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant font-medium animate-pulse">
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    Termine werden geladen...
                  </div>
                </div>
              )}

              {/* 24-Stunden Raster Container (1440px Höhe = 60px pro Stunde = 1px pro Minute) */}
              <div className="relative flex w-full" style={{ height: 1440 }}>
                {/* Linke Zeit-Spalte (Time Gutter) */}
                <div className="w-14 md:w-16 flex-shrink-0 relative border-r border-outline-variant/50 bg-surface/80">
                  {HOURS.map((h) => (
                    <div
                      key={`time-${h}`}
                      className="absolute right-0 pr-2 md:pr-3 text-[11px] font-mono font-medium text-on-surface-variant/80 select-none"
                      style={{ top: `${h * 60 - 7}px` }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}

                  {/* Jetzt-Badge auf der Zeitachse */}
                  {isSelectedToday && (
                    <span
                      className="absolute right-1 text-[9px] font-mono font-bold text-white bg-red-500 px-1 py-0.5 rounded shadow-sm z-30 pointer-events-none"
                      style={{ top: `${nowMinutes - 8}px` }}
                    >
                      {String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:{String(nowMinutes % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>

                {/* Rechtes Raster mit Stunden-Zeilen & platzierten Terminen */}
                <div className="relative flex-1 bg-white">
                  {/* Stunden-Rasterlinien & Klick-Slots */}
                  {HOURS.map((h) => (
                    <div
                      key={`slot-${h}`}
                      onClick={() => handleSlotClick(h)}
                      className="absolute left-0 right-0 border-t border-outline-variant/30 hover:bg-primary/[0.02] cursor-pointer transition-colors group"
                      style={{ top: `${h * 60}px`, height: '60px' }}
                      title={`Klicken für neuen Termin um ${String(h).padStart(2, '0')}:00 Uhr`}
                    >
                      {/* Feine Halbstunden-Hilfslinie (:30) */}
                      <div className="absolute left-0 right-0 border-t border-dashed border-outline-variant/20 top-[30px] pointer-events-none" />
                      
                      {/* Dezentes Plus-Symbol beim Hovern über freien Slot */}
                      <span className="hidden group-hover:flex items-center gap-1 text-[10px] text-on-surface-variant/60 font-mono font-medium pl-2 pt-1 pointer-events-none">
                        <span className="material-symbols-outlined text-[12px]">add</span>
                        {String(h).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}

                  {/* "Jetzt"-Linie (Current Time Indicator) */}
                  {isSelectedToday && (
                    <div
                      className="absolute left-0 right-0 h-[2px] bg-red-500 z-20 pointer-events-none flex items-center"
                      style={{ top: `${nowMinutes}px` }}
                    >
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm" />
                    </div>
                  )}

                  {/* Platzierte Termine im Stunden-Raster */}
                  {!isDataLoading && layoutedTimedEvents.map((evt) => {
                    const customColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : null;
                    const accentColor = customColor ? customColor.bg : 'var(--primary)';
                    const textColor = customColor ? customColor.text : 'inherit';
                    const isShort = evt.duration < 40;

                    return (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                        }}
                        style={{
                          top: `${evt.startMinutes}px`,
                          height: `${Math.max(evt.duration, 26)}px`,
                          left: `calc(${(evt.col / evt.totalCols) * 100}% + 2px)`,
                          width: `calc(${(1 / evt.totalCols) * 100}% - 4px)`,
                          borderLeftColor: accentColor,
                          backgroundColor: customColor ? `${accentColor}25` : 'rgba(26, 26, 26, 0.08)',
                        }}
                        className="absolute z-10 border-l-[3.5px] rounded-r-lg px-2 py-1 cursor-pointer overflow-hidden transition-all duration-150 hover:brightness-95 hover:shadow-md hover:z-30 group select-none shadow-xs"
                        title={`${evt.summary || '(Ohne Titel)'} (${evt.startFormatted} - ${evt.endFormatted})`}
                      >
                        {isShort ? (
                          <div className="flex items-center gap-1.5 h-full text-[11px] leading-none">
                            <span className="font-mono font-bold text-[10px] opacity-80 whitespace-nowrap" style={{ color: textColor }}>
                              {evt.startFormatted}
                            </span>
                            <span className="font-semibold truncate" style={{ color: textColor }}>
                              {evt.summary || '(Ohne Titel)'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col h-full justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold opacity-80 mb-0.5 leading-tight" style={{ color: textColor }}>
                                <span>{evt.startFormatted} – {evt.endFormatted}</span>
                                {evt.hangoutLink && (
                                  <span className="material-symbols-outlined text-[13px]">videocam</span>
                                )}
                                {evt.location && !evt.hangoutLink && (
                                  <span className="material-symbols-outlined text-[13px]">location_on</span>
                                )}
                              </div>
                              <div className="font-bold text-xs leading-snug line-clamp-2" style={{ color: textColor }}>
                                {evt.summary || '(Ohne Titel)'}
                              </div>
                            </div>
                            {evt.duration >= 90 && evt.location && (
                              <div className="text-[10px] text-on-surface-variant truncate flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[11px]">pin_drop</span>
                                <span className="truncate">{evt.location}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile Day Bottom Sheet / Drawer Modal */}
      {isMobileDayModalOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsMobileDayModalOpen(false)}
        >
          <div 
            className="bg-surface border-t border-border rounded-t-3xl w-full max-h-[85vh] h-[82vh] shadow-2xl flex flex-col overflow-hidden text-primary drawer-slide-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag Handle Indicator */}
            <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
              <div className="w-12 h-1.5 bg-outline-variant rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-4 py-3 border-b border-outline-variant/70 flex items-center justify-between flex-shrink-0 bg-surface-low/70">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-on-surface truncate">
                      {weekdayName}, {selectedDay}. {MONTH_NAMES[currentMonthIndex]}
                    </h3>
                    {isSelectedToday && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-white shrink-0">
                        Heute
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {dayEvents.length === 0
                      ? 'Keine Termine'
                      : `${dayEvents.length} ${dayEvents.length === 1 ? 'Termin' : 'Termine'}`}
                  </p>
                </div>
              </div>

              {/* Day Nav & Action */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handlePrevDay}
                  className="p-1.5 hover:bg-surface-low rounded-lg transition-colors text-on-surface-variant"
                  title="Vorheriger Tag"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button
                  onClick={handleNextDay}
                  className="p-1.5 hover:bg-surface-low rounded-lg transition-colors text-on-surface-variant"
                  title="Nächster Tag"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileDayModalOpen(false);
                    const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                    const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                    setEditingEvent({
                      start: { dateTime: startD.toISOString() },
                      end: { dateTime: endD.toISOString() }
                    });
                  }}
                  className="p-1.5 bg-primary text-white rounded-lg flex items-center justify-center shadow-xs ml-1 active:scale-95"
                  title="Neuer Termin"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <button
                  onClick={() => setIsMobileDayModalOpen(false)}
                  className="p-1.5 hover:bg-surface-low text-on-surface-variant hover:text-primary rounded-lg transition-colors ml-1"
                  title="Schließen"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {/* Ganztägige Termine */}
              {allDayEvents.length > 0 && (
                <div className="p-2.5 bg-surface-low/80 rounded-xl border border-outline-variant/60 space-y-1.5">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">event</span>
                    Ganztägig ({allDayEvents.length})
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {allDayEvents.map((evt) => {
                      const customColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : null;
                      const bg = customColor ? customColor.bg : 'var(--primary)';
                      const text = customColor ? customColor.text : '#1A1A1A';
                      return (
                        <div
                          key={evt.id}
                          onClick={() => {
                            setSelectedEvent(evt);
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 hover:brightness-95 transition-all border shadow-xs cursor-pointer"
                          style={{ backgroundColor: `${bg}20`, borderColor: `${bg}50`, color: text }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: bg }}></span>
                            <span className="truncate font-bold">{evt.summary || '(Ohne Titel)'}</span>
                          </div>
                          <span className="material-symbols-outlined text-[16px] opacity-60">chevron_right</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Termine mit Uhrzeit (Kompakte Liste / Timeline) */}
              {timedEvents.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">
                    Termine mit Uhrzeit ({timedEvents.length})
                  </div>
                  {layoutedTimedEvents.map((evt) => {
                    const customColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : null;
                    const accentColor = customColor ? customColor.bg : 'var(--primary)';
                    const textColor = customColor ? customColor.text : 'inherit';

                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          setSelectedEvent(evt);
                        }}
                        className="p-3 rounded-xl border border-outline-variant/70 bg-white hover:bg-surface-low transition-all shadow-xs cursor-pointer border-l-4"
                        style={{ borderLeftColor: accentColor }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 truncate">
                            <span className="text-[11px] font-mono font-bold text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              {evt.startFormatted} – {evt.endFormatted} Uhr
                            </span>
                            <h4 className="font-bold text-sm text-on-surface truncate" style={{ color: textColor }}>
                              {evt.summary || '(Ohne Titel)'}
                            </h4>
                            {evt.location && (
                              <p className="text-[11px] text-on-surface-variant flex items-center gap-1 truncate mt-0.5">
                                <span className="material-symbols-outlined text-[12px]">location_on</span>
                                {evt.location}
                              </p>
                            )}
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60 shrink-0 mt-1">
                            chevron_right
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : allDayEvents.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-14 h-14 bg-surface-low rounded-full flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-2xl">event_available</span>
                  </div>
                  <h4 className="font-bold text-base text-on-surface">Keine Termine</h4>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto">
                    Für diesen Tag sind keine Ereignisse in deinem Google Kalender eingetragen.
                  </p>
                  <button
                    onClick={() => {
                      setIsMobileDayModalOpen(false);
                      const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                      const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                      setEditingEvent({
                        start: { dateTime: startD.toISOString() },
                        end: { dateTime: endD.toISOString() }
                      });
                    }}
                    className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-black transition-colors shadow-xs inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Termin anlegen
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedEvent(null)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden text-primary" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-low">
              <div className="flex items-center gap-3 overflow-hidden">
                {selectedEvent.colorId && GOOGLE_COLORS[selectedEvent.colorId] ? (
                   <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: GOOGLE_COLORS[selectedEvent.colorId].bg }}></span>
                ) : (
                   <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-primary"></span>
                )}
                <h2 className="text-xl font-bold truncate pr-4 text-primary">{selectedEvent.summary}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setSelectedEvent(null); setEditingEvent(selectedEvent); }} className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-lg hover:bg-surface-variant/50" title="Bearbeiten">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="text-on-surface-variant hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50" title="Löschen">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
                <div className="w-px h-6 bg-outline-variant mx-1"></div>
                <button onClick={() => setSelectedEvent(null)} className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-lg hover:bg-surface-variant/50" title="Schließen">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              
              {/* Zeit/Datum */}
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5">event</span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Zeitraum</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {!!selectedEvent.start.date ? 'Ganztägig' : new Date(selectedEvent.start.dateTime).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })}
                    {selectedEvent.end && !selectedEvent.end.date && ` - ${new Date(selectedEvent.end.dateTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}`}
                  </p>
                </div>
              </div>

              {/* Beschreibung */}
              {selectedEvent.description && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-0.5">notes</span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Beschreibung</p>
                    <p className="text-sm text-on-surface-variant mt-0.5 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                </div>
              )}

              {/* Kalender-Link */}
              {selectedEvent.htmlLink && (
                 <div className="flex justify-end pt-4 border-t border-outline-variant">
                   <a 
                     href={selectedEvent.htmlLink} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-colors flex items-center gap-2"
                   >
                     In Google Kalender öffnen
                     <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                   </a>
                 </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setShowMonthPicker(false)}>
          <div className="bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setPickerYear(y => y - 1)} className="p-2 hover:bg-surface-low rounded-full transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <h3 className="text-xl font-bold">{pickerYear}</h3>
              <button onClick={() => setPickerYear(y => y + 1)} className="p-2 hover:bg-surface-low rounded-full transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MONTH_NAMES.map((mName, idx) => (
                <button
                  key={mName}
                  onClick={() => {
                    setCurrentMonthIndex(idx);
                    setCurrentYear(pickerYear);
                    setShowMonthPicker(false);
                  }}
                  className={`py-3 px-2 rounded-xl text-sm font-bold transition-colors ${
                    currentMonthIndex === idx && currentYear === pickerYear
                      ? 'bg-primary text-white'
                      : 'bg-surface-low hover:bg-primary/10 text-on-surface hover:text-primary'
                  }`}
                >
                  {mName.substring(0, 3)}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => {
                  handleResetToday();
                  setShowMonthPicker(false);
                }}
                className="text-primary font-bold text-sm hover:underline"
              >
                Zurück zu Heute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB for New Event */}
      <button
        onClick={() => setEditingEvent({})}
        className={`md:hidden fixed bottom-20 right-5 w-12 h-12 bg-primary text-white rounded-xl shadow-xl flex items-center justify-center z-40 transition-all duration-300 ease-in-out active:scale-90 ${
          isScrollingDown || isMobileDayModalOpen ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
        title="Neuer Termin"
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
      </button>

    </div>
  );
};

export default Calendar;
