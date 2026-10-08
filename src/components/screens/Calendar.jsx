import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { fetchCalendarEvents, deleteCalendarEvent, createCalendarEvent, updateCalendarEvent } from '../../lib/calendarAPI';
import EventEditForm from './EventEditForm';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const MONTH_NAMES_SHORT = [
  'Jan.', 'Feb.', 'Mär.', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'
];

const MONTH_NAMES_HEADER = [
  'JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN',
  'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'
];

const WEEKDAY_NAMES = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'
];

const WEEKDAYS = [
  { short: 'MO.', isSunday: false },
  { short: 'DI.', isSunday: false },
  { short: 'MI.', isSunday: false },
  { short: 'DO.', isSunday: false },
  { short: 'FR.', isSunday: false },
  { short: 'SA.', isSunday: false },
  { short: 'SO.', isSunday: true },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MOBILE_PX_PER_MIN = 0.75; // 45px pro Stunde auf Mobile

// Harmonisierte Farbpalette für Termine nach den Screenshot-Vorgaben (Pastell-Hintergrund + solider linker Akzent)
const EVENT_COLOR_MAP = {
  // 1: Lavender
  '1': { bg: '#ede9fe', border: '#8b5cf6', text: '#1e1b4b', accent: '#7c3aed' },
  // 2: Sage / Minzgrün (Screenshot 1 & 2)
  '2': { bg: '#dcfce7', border: '#10b981', text: '#064e3b', accent: '#059669' },
  // 3: Grape / Violett
  '3': { bg: '#f3e8ff', border: '#a855f7', text: '#3b0764', accent: '#9333ea' },
  // 4: Flamingo / Koralle
  '4': { bg: '#ffe4e6', border: '#f43f5e', text: '#4c0519', accent: '#e11d48' },
  // 5: Banana / Gelb
  '5': { bg: '#fef9c3', border: '#eab308', text: '#422006', accent: '#ca8a04' },
  // 6: Tangerine / Orange
  '6': { bg: '#ffedd5', border: '#f97316', text: '#431407', accent: '#ea580c' },
  // 7: Peacock / Eisblau (Screenshot 1 & 2)
  '7': { bg: '#e0f2fe', border: '#06b6d4', text: '#082f49', accent: '#0284c7' },
  // 8: Graphite / Grau
  '8': { bg: '#f1f5f9', border: '#64748b', text: '#0f172a', accent: '#475569' },
  // 9: Blueberry / Hellblau Standard (Screenshot 1 & 2)
  '9': { bg: '#e0f2fe', border: '#0284c7', text: '#0f172a', accent: '#0284c7' },
  // 10: Basil / Dunkelgrün
  '10': { bg: '#dcfce7', border: '#16a34a', text: '#052e16', accent: '#15803d' },
  // 11: Tomato / Rot
  '11': { bg: '#fee2e2', border: '#ef4444', text: '#450a0a', accent: '#dc2626' },
};

function getEventColors(colorId) {
  if (colorId && EVENT_COLOR_MAP[colorId]) {
    return EVENT_COLOR_MAP[colorId];
  }
  // Standard-Himmelblau aus Screenshot 1 & 2
  return {
    bg: '#e0f2fe',
    border: '#0284c7',
    text: '#0f172a',
    accent: '#0284c7',
  };
}

// Hilfsfunktion: Berechnet Layout bei Überlappungen
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

// Hilfsfunktion: Berechnet alle Kalendertage für das 7-Spalten-Raster inkl. Padding
function getCalendarDays(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  // In JS: 0 = Sonntag, 1 = Montag... Für Montag-basierten Wochenstart:
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const cells = [];

  // 1. Tage des Vormonats
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

  // 3. Tage des Folgemonats
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

function parseEventDate(dateStr, isEnd) {
  if (!dateStr) return new Date();
  if (dateStr.includes('T')) return new Date(dateStr);
  const [y, m, d] = dateStr.split('-');
  const localDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  if (isEnd) return new Date(localDate.getTime() - 1);
  return localDate;
}

function isEventOnDate(evt, dateObj) {
  if (!evt.start || (!evt.start.dateTime && !evt.start.date)) return false;
  const isAllDay = !!evt.start.date;
  const eventStart = parseEventDate(evt.start.dateTime || evt.start.date, false);
  const eventEnd = evt.end ? parseEventDate(evt.end.dateTime || evt.end.date, isAllDay) : eventStart;

  const checkStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const checkEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
  return eventStart <= checkEnd && eventEnd >= checkStart;
}

function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const isAllDayA = !a.start?.dateTime && !!a.start?.date;
    const isAllDayB = !b.start?.dateTime && !!b.start?.date;
    if (isAllDayA && !isAllDayB) return -1;
    if (!isAllDayA && isAllDayB) return 1;
    const timeA = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0;
    const timeB = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0;
    return timeA - timeB;
  });
}

const Calendar = () => {
  const { user, isCalendarConnected, linkGoogleCalendar } = useAuth();
  const { openModal } = useModal();

  const today = useMemo(() => new Date(), []);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  // Zentraler Cache für geladene Monate (z. B. '2026-9': [...])
  const [eventsCache, setEventsCache] = useState({});
  const eventsCacheRef = useRef({});
  eventsCacheRef.current = eventsCache;
  const fetchingKeysRef = useRef(new Set());
  const [error, setError] = useState(null);

  const [selectedEvent, setSelectedEvent] = useState(null); // Für Detail-Modal
  const [editingEvent, setEditingEvent] = useState(null); // Für Formular
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile Day Drawer (Screenshot 2)
  const [isMobileDayModalOpen, setIsMobileDayModalOpen] = useState(false);
  const [mobileDayDrawerRendered, setMobileDayDrawerRendered] = useState(false);
  const [mobileDayDrawerClosing, setMobileDayDrawerClosing] = useState(false);
  const mobileDayDrawerRef = useRef(null);
  const mobileDayScrollRef = useRef(null);
  const lastClosedAtRef = useRef(0);

  // Mobile Day Ansicht: Standardmodus ist 'list' (Listenansicht nach Screenshot 2 Vorgabe!)
  const [mobileDayViewMode, setMobileDayViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('focusflow_calendar_mobile_day_view');
        if (saved === 'timeline' || saved === 'list') return saved;
      } catch {
        // pass
      }
    }
    return 'list'; // Standard ist Liste!
  });

  const handleMobileDayViewChange = (mode) => {
    setMobileDayViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('focusflow_calendar_mobile_day_view', mode);
      } catch {
        // pass
      }
    }
  };

  useEffect(() => {
    if (isMobileDayModalOpen) {
      setMobileDayDrawerRendered(true);
      setMobileDayDrawerClosing(false);
    } else {
      setMobileDayDrawerClosing(true);
      const t = setTimeout(() => {
        setMobileDayDrawerRendered(false);
        setMobileDayDrawerClosing(false);
      }, 280);
      return () => clearTimeout(t);
    }
  }, [isMobileDayModalOpen]);

  const handleCloseMobileDayDrawer = () => {
    lastClosedAtRef.current = Date.now();
    setIsMobileDayModalOpen(false);
  };

  const {
    drawerStyle: mobileDayDrawerStyle,
    entryAnimActive: mobileDayEntryAnim,
    wasSwipedClosed: mobileDayWasSwipedClosed
  } = useSwipeToClose({
    isOpen: isMobileDayModalOpen && mobileDayDrawerRendered,
    onClose: handleCloseMobileDayDrawer,
    drawerRef: mobileDayDrawerRef,
    scrollContainerRef: mobileDayScrollRef,
    threshold: 120,
  });

  // Geste im Day Drawer: Nach rechts wischen öffnet Zeitstrahl, nach links Liste
  const sheetTouchStartX = useRef(0);
  const sheetTouchStartY = useRef(0);
  const sheetIsHorizontal = useRef(false);

  const onSheetTouchStart = (e) => {
    sheetTouchStartX.current = e.targetTouches[0].clientX;
    sheetTouchStartY.current = e.targetTouches[0].clientY;
    sheetIsHorizontal.current = false;
  };

  const onSheetTouchMove = (e) => {
    const dx = e.targetTouches[0].clientX - sheetTouchStartX.current;
    const dy = e.targetTouches[0].clientY - sheetTouchStartY.current;
    if (!sheetIsHorizontal.current && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      sheetIsHorizontal.current = true;
    }
  };

  const onSheetTouchEnd = (e) => {
    if (sheetIsHorizontal.current) {
      const dx = e.changedTouches[0].clientX - sheetTouchStartX.current;
      // Nach rechts wischen öffnet Zeitstrahl
      if (dx > 50 && mobileDayViewMode === 'list') {
        handleMobileDayViewChange('timeline');
      } else if (dx < -50 && mobileDayViewMode === 'timeline') {
        handleMobileDayViewChange('list');
      }
    }
    sheetIsHorizontal.current = false;
  };

  // Desktop/Tablet Layout: 'stacked' oder 'side-by-side'
  const [desktopLayout, setDesktopLayout] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('focusflow_calendar_desktop_layout');
        if (saved === 'stacked' || saved === 'side-by-side') return saved;
        return window.innerWidth >= 1280 ? 'side-by-side' : 'stacked';
      } catch {
        // pass
      }
    }
    return 'stacked';
  });

  const handleLayoutChange = (mode) => {
    setDesktopLayout(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('focusflow_calendar_desktop_layout', mode);
      } catch {
        // pass
      }
    }
  };

  // Nachbarmonate für unterbrechungsfreies Vorladen & 3-Slide Carousel
  const prevMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
  const prevYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear;

  const nextMonthIndex = currentMonthIndex === 11 ? 0 : currentMonthIndex + 1;
  const nextYear = currentMonthIndex === 11 ? currentYear + 1 : currentYear;

  const daysPrev = useMemo(() => getCalendarDays(prevYear, prevMonthIndex), [prevYear, prevMonthIndex]);
  const daysCurr = useMemo(() => getCalendarDays(currentYear, currentMonthIndex), [currentYear, currentMonthIndex]);
  const daysNext = useMemo(() => getCalendarDays(nextYear, nextMonthIndex), [nextYear, nextMonthIndex]);

  // Automatisches paralleles Vorladen des aktuellen, vorherigen und nächsten Monats!
  useEffect(() => {
    if (!isCalendarConnected) return;

    const targets = [
      { year: currentYear, month: currentMonthIndex },
      { year: prevYear, month: prevMonthIndex },
      { year: nextYear, month: nextMonthIndex },
    ];

    targets.forEach(({ year, month }) => {
      const key = `${year}-${month}`;
      if (!eventsCacheRef.current[key] && !fetchingKeysRef.current.has(key)) {
        fetchingKeysRef.current.add(key);
        fetchCalendarEvents(year, month)
          .then((fetched) => {
            setEventsCache((prev) => ({ ...prev, [key]: fetched || [] }));
          })
          .catch((err) => {
            console.warn(`[Calendar] Fehler beim Vorladen von ${key}:`, err);
            if (year === currentYear && month === currentMonthIndex) {
              setError('Die Kalenderdaten konnten nicht geladen werden.');
            }
          })
          .finally(() => {
            fetchingKeysRef.current.delete(key);
          });
      }
    });
  }, [isCalendarConnected, currentYear, currentMonthIndex, prevYear, prevMonthIndex, nextYear, nextMonthIndex]);

  const currCacheKey = `${currentYear}-${currentMonthIndex}`;
  const currentMonthEvents = useMemo(() => eventsCache[currCacheKey] || [], [eventsCache, currCacheKey]);

  // Holt alle Termine für ein beliebiges Kalenderdatum aus dem übergreifenden Cache
  const getEventsForCell = useCallback((dateObj) => {
    const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
    const list = eventsCache[key] || [];
    return list.filter((evt) => isEventOnDate(evt, dateObj));
  }, [eventsCache]);

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = useCallback(() => {
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
    setSelectedDay((prev) => Math.min(prev, maxDays));
  }, [currentMonthIndex, currentYear]);

  const handleNextMonth = useCallback(() => {
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
    setSelectedDay((prev) => Math.min(prev, maxDays));
  }, [currentMonthIndex, currentYear]);

  // Touch & Drag Swipe Steuerung für das Monats-Karussell (Butterweich & mit vorgerendertem Content)
  const carouselContainerRef = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchDeltaXRef = useRef(0);
  const touchStartTimeRef = useRef(0);
  const isSwipingHorizontalRef = useRef(false);

  const startCarouselDrag = (clientX, clientY) => {
    if (isAnimatingRef.current) return;
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;
    touchDeltaXRef.current = 0;
    touchStartTimeRef.current = Date.now();
    isSwipingHorizontalRef.current = false;
    setIsDragging(true);
  };

  const moveCarouselDrag = (clientX, clientY, e) => {
    if (!isDragging || isAnimatingRef.current) return;
    const dx = clientX - touchStartXRef.current;
    const dy = clientY - touchStartYRef.current;
    touchDeltaXRef.current = dx;

    if (!isSwipingHorizontalRef.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (Math.abs(dx) > Math.abs(dy)) {
          isSwipingHorizontalRef.current = true;
        } else {
          setIsDragging(false);
          return;
        }
      }
    }

    if (isSwipingHorizontalRef.current) {
      if (e && e.cancelable) e.preventDefault();
      setSwipeOffset(dx);
    }
  };

  const endCarouselDrag = () => {
    if (!isDragging || isAnimatingRef.current) return;
    setIsDragging(false);

    const dx = touchDeltaXRef.current;
    const elapsed = Math.max(Date.now() - touchStartTimeRef.current, 1);
    const velocity = Math.abs(dx) / elapsed;
    const width = carouselContainerRef.current?.offsetWidth || window.innerWidth;
    const threshold = Math.min(width * 0.18, 70);

    const isSwipe = isSwipingHorizontalRef.current && (Math.abs(dx) > threshold || (Math.abs(dx) > 30 && velocity > 0.35));

    if (isSwipe) {
      isAnimatingRef.current = true;
      setIsAnimating(true);
      if (dx < 0) {
        // Nächster Monat: Hineingleiten, dann nahtlos ohne Rückanimation resetten
        setSwipeOffset(-width);
        setTimeout(() => {
          isAnimatingRef.current = false;
          setIsAnimating(false);
          setSwipeOffset(0);
          handleNextMonth();
        }, 260);
      } else {
        // Vorheriger Monat
        setSwipeOffset(width);
        setTimeout(() => {
          isAnimatingRef.current = false;
          setIsAnimating(false);
          setSwipeOffset(0);
          handlePrevMonth();
        }, 260);
      }
    } else {
      // Zurückfedern
      isAnimatingRef.current = true;
      setIsAnimating(true);
      setSwipeOffset(0);
      setTimeout(() => {
        isAnimatingRef.current = false;
        setIsAnimating(false);
      }, 260);
    }
    isSwipingHorizontalRef.current = false;
  };

  const onTouchStart = (e) => {
    const touch = e.targetTouches[0];
    startCarouselDrag(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e) => {
    const touch = e.targetTouches[0];
    moveCarouselDrag(touch.clientX, touch.clientY, e);
  };

  const onTouchEnd = () => {
    endCarouselDrag();
  };

  // Button oben rechts in Screenshot 1: Führt zurück auf den heutigen Tag im Kalenderraster!
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
    try {
      if (eventId) {
        await updateCalendarEvent(eventId, eventData);
      } else {
        await createCalendarEvent(eventData);
      }
      // Cache für aktuellen Monat neu abrufen
      const fetched = await fetchCalendarEvents(currentYear, currentMonthIndex);
      setEventsCache((prev) => ({ ...prev, [currCacheKey]: fetched || [] }));
      setEditingEvent(null);
    } catch (err) {
      console.error('Fehler beim Speichern', err);
      alert('Fehler beim Speichern des Termins: ' + (err.message || err));
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Diesen Termin wirklich löschen?')) return;
    try {
      await deleteCalendarEvent(eventId);
      const fetched = await fetchCalendarEvents(currentYear, currentMonthIndex);
      setEventsCache((prev) => ({ ...prev, [currCacheKey]: fetched || [] }));
      setSelectedEvent(null);
    } catch (err) {
      console.error('Fehler beim Löschen', err);
      alert('Fehler beim Löschen des Termins: ' + (err.message || err));
    }
  };

  const isDateToday = (dateObj) => {
    const n = new Date();
    return (
      dateObj.getDate() === n.getDate() &&
      dateObj.getMonth() === n.getMonth() &&
      dateObj.getFullYear() === n.getFullYear()
    );
  };

  // Klick auf Tag ODER Termin im Kalender (UX-Vorgabe: Auf Mobile kein Unterschied!)
  const handleCellClick = (cell) => {
    if (Date.now() - lastClosedAtRef.current < 400) return;

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

  // Termine des ausgewählten Tages filtern
  const selectedDateObj = useMemo(() => new Date(currentYear, currentMonthIndex, selectedDay), [currentYear, currentMonthIndex, selectedDay]);
  const dayEvents = useMemo(() => currentMonthEvents.filter(evt => isEventOnDate(evt, selectedDateObj)), [currentMonthEvents, selectedDateObj]);
  const allDayEvents = useMemo(() => dayEvents.filter(evt => !!evt.start?.date), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter(evt => !evt.start?.date && !!evt.start?.dateTime), [dayEvents]);
  const layoutedTimedEvents = useMemo(() => getLayoutedEvents(timedEvents, selectedDateObj), [timedEvents, selectedDateObj]);
  const weekdayName = WEEKDAY_NAMES[selectedDateObj.getDay()];

  const isSelectedToday =
    today.getDate() === selectedDay &&
    today.getMonth() === currentMonthIndex &&
    today.getFullYear() === currentYear;

  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });


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

  // Such-Filter über alle vorgeladenen Termine
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const all = Object.values(eventsCache).flat();
    const unique = [];
    const seen = new Set();
    for (const evt of all) {
      if (!evt.id || seen.has(evt.id)) continue;
      seen.add(evt.id);
      const matchesSum = evt.summary && evt.summary.toLowerCase().includes(q);
      const matchesDesc = evt.description && evt.description.toLowerCase().includes(q);
      const matchesLoc = evt.location && evt.location.toLowerCase().includes(q);
      if (matchesSum || matchesDesc || matchesLoc) {
        unique.push(evt);
      }
    }
    return unique;
  }, [searchQuery, eventsCache]);

  // Renderer für eine Monatsseite im 3-Slide Karussell
  const renderMonthSlide = (daysList, isCenter) => {
    const rowCount = Math.ceil(daysList.length / 7);

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

        {/* Monatsraster (Gleichmäßige Zeilenhöhe) */}
        <div
          className="grid grid-cols-7 flex-1 h-full bg-white divide-y divide-neutral-100"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {daysList.map((cell, cellIdx) => {
            const isToday = isDateToday(cell.dateObj);
            const isSelected = isCenter && cell.isCurrentMonth && cell.day === selectedDay;
            const isSunday = (cellIdx % 7) === 6;

            const cellEvents = getEventsForCell(cell.dateObj);
            const sorted = sortEvents(cellEvents);
            const count = sorted.length;

            return (
              <div
                key={cell.key}
                onClick={() => handleCellClick(cell)}
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
                {/* Tageszahl Header (Zentriert nach Screenshot 1) */}
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

                {/* Termineinträge im Kalendertag */}
                {count > 0 && (
                  <div className={`w-full flex-1 flex flex-col gap-1 overflow-hidden ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}>
                    {/*
                      Kompakte Terminanzeige nach Referenz (Screenshot 1):
                      - Termine nehmen nur den für bis zu 2 Textzeilen nötigen Platz ein (h-auto), kein vertikales Strecken
                      - Maximal 2 Zeilen Text (line-clamp-2 break-all), darüber hinaus abgeschnitten
                      - Zeitgebundene Termine (timed): keine vollflächige Farbhinterlegung, nur Akzentlinie vorne (border-l-[3px])
                      - Ganztägige Termine (all-day): dezente Pastell-Pille (backgroundColor: colors.bg, rounded-[4px])
                      - Bis zu 4 Termine pro Tag sichtbar, bei mehr Terminen +X Indikator
                    */}
                    {sorted.slice(0, 4).map((evt) => {
                      const colors = getEventColors(evt.colorId);
                      const isFewEvents = count <= 2;
                      const isAllDay = !evt.start?.dateTime && !!evt.start?.date;

                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              // Mobile: Kein Unterschied zwischen Tag und Termin! Immer das Detailmenü öffnen!
                              e.stopPropagation();
                              handleCellClick(cell);
                            } else {
                              // Desktop: Tag auswählen und Termin anzeigen
                              e.stopPropagation();
                              handleCellClick(cell);
                              setSelectedEvent(evt);
                            }
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

  // Render State 3: Bearbeitungs-Modus
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

  return (
    <div className="screen-transition flex flex-col flex-1 h-full min-h-0 bg-white">
      {/* 
        Kopfzeile (Orientiert an Screenshot 1):
        - Links: Menü / Sidebar-Toggle
        - Mitte: Monatsname in Großbuchstaben (z. B. "OKT"), Klick öffnet Monatsauswahl
        - Rechts: Suche-Icon und der "Heute"-Button (abgerundetes Quadrat mit Tageszahl)
      */}
      <div className="px-3 py-2 md:px-6 md:py-3 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white">
        {/* Links: Menü / Hamburger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModal('settings')}
            className="p-1.5 rounded-lg text-neutral-800 hover:bg-neutral-100 transition-colors flex items-center justify-center"
            title="Menü öffnen"
            aria-label="Menü öffnen"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          {/* Desktop-Chevrons zur schnellen Maus-Navigation */}
          <div className="hidden md:flex items-center gap-1 ml-2">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              title="Vorheriger Monat"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              title="Nächster Monat"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Mitte: Monatsname in fetter serifenloser Schrift (Screenshot 1: "OKT") */}
        <button
          type="button"
          onClick={() => {
            setPickerYear(currentYear);
            setShowMonthPicker(true);
          }}
          className="text-xl md:text-2xl font-black tracking-tight text-neutral-900 hover:opacity-75 transition-opacity px-2 py-1 rounded-lg flex items-center gap-1"
          title="Monat auswählen"
        >
          <span>{MONTH_NAMES_HEADER[currentMonthIndex]}</span>
          <span className="text-sm font-medium text-neutral-400 hidden sm:inline ml-1">
            {currentYear}
          </span>
        </button>

        {/* Rechts: Suche & Zurück zu Heute (Screenshot 1) */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Suche-Icon Button */}
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            className="p-1.5 rounded-lg text-neutral-800 hover:bg-neutral-100 transition-colors flex items-center justify-center"
            title="Termine suchen"
            aria-label="Termine suchen"
          >
            <span className="material-symbols-outlined text-[22px]">search</span>
          </button>

          {/* 
            Heute-Button (Screenshot 1):
            Abgerundetes Quadrat mit Rahmen und der heutigen Tageszahl inside!
          */}
          <button
            type="button"
            onClick={handleResetToday}
            className="w-7 h-7 md:w-8 md:h-8 rounded-lg border-[1.5px] border-neutral-800 hover:bg-neutral-100 active:scale-95 transition-all flex items-center justify-center font-bold text-xs md:text-sm text-neutral-900 shadow-2xs"
            title="Zurück zu Heute"
            aria-label="Zurück zu Heute"
          >
            {today.getDate()}
          </button>

          {/* Desktop-Zusatz: Neuer Termin & Layout-Umschalter */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-neutral-200">
            <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleLayoutChange('stacked')}
                className={`p-1 rounded-md transition-all ${
                  desktopLayout === 'stacked' ? 'bg-white shadow-2xs text-neutral-900' : 'text-neutral-500'
                }`}
                title="Unterienander"
              >
                <span className="material-symbols-outlined text-[18px]">view_agenda</span>
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange('side-by-side')}
                className={`p-1 rounded-md transition-all ${
                  desktopLayout === 'side-by-side' ? 'bg-white shadow-2xs text-neutral-900' : 'text-neutral-500'
                }`}
                title="Nebeneinander"
              >
                <span className="material-symbols-outlined text-[18px]">vertical_split</span>
              </button>
            </div>

            <button
              onClick={() => {
                const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                setEditingEvent({
                  start: { dateTime: startD.toISOString() },
                  end: { dateTime: endD.toISOString() }
                });
              }}
              className="bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-black transition-all flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Termin
            </button>
          </div>
        </div>
      </div>

      {/* Fehler-Banner bei Verbindungsproblemen */}
      {error && (
        <div className="mx-3 my-2 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-xs">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0">warning</span>
          <span className="flex-1">{error}</span>
          <button
            onClick={() => {
              setError(null);
              setEventsCache({});
            }}
            className="font-bold underline hover:opacity-75"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Hauptbereich mit Kalender-Karussell */}
      <div className={`flex flex-1 h-full min-h-0 overflow-hidden ${
        desktopLayout === 'side-by-side'
          ? 'flex-col md:flex-row md:items-stretch'
          : 'flex-col'
      }`}>
        {/* 
          3-Slide Monats-Karussell:
          Der Vormonat und Folgemonat sind bereits vollständig vorgeladen und gerendert.
          Wischen ist butterweich und zeigt zu jedem Zeitpunkt echten Content!
        */}
        <div
          ref={carouselContainerRef}
          className="w-full flex-1 h-full min-h-0 overflow-hidden relative select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={(e) => {
            if (e.button === 0 && !e.target.closest('button') && !e.target.closest('[role="dialog"]')) {
              startCarouselDrag(e.clientX, e.clientY);
            }
          }}
          onMouseMove={(e) => {
            moveCarouselDrag(e.clientX, e.clientY, e);
          }}
          onMouseUp={endCarouselDrag}
          onMouseLeave={endCarouselDrag}
        >
          <div
            className="flex w-full h-full"
            style={{
              transform: `translateX(calc(-100% + ${swipeOffset}px))`,
              transition: isAnimating ? 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
              willChange: isDragging || isAnimating ? 'transform' : 'auto',
            }}
          >
            {/* Slide 0: Vormonat (Vorgeladen) */}
            <div className="w-full h-full flex-shrink-0 flex flex-col">
              {renderMonthSlide(daysPrev, false)}
            </div>

            {/* Slide 1: Aktueller Monat */}
            <div className="w-full h-full flex-shrink-0 flex flex-col">
              {renderMonthSlide(daysCurr, true)}
            </div>

            {/* Slide 2: Folgemonat (Vorgeladen) */}
            <div className="w-full h-full flex-shrink-0 flex flex-col">
              {renderMonthSlide(daysNext, false)}
            </div>
          </div>
        </div>

        {/* Desktop-Tagesansicht (nur ab 768px sichtbar) */}
        <div className={`hidden md:block border-l border-neutral-100 bg-neutral-50/50 ${
          desktopLayout === 'side-by-side'
            ? 'w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col h-full'
            : 'w-full h-[320px] border-t border-neutral-100 flex flex-col'
        }`}>
          <div className="p-4 border-b border-neutral-200/60 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
                {selectedDay}
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                  {weekdayName}, {selectedDay}. {MONTH_NAMES_SHORT[currentMonthIndex]}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {dayEvents.length === 0 ? 'Keine Termine' : `${dayEvents.length} Termine`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                setEditingEvent({
                  start: { dateTime: startD.toISOString() },
                  end: { dateTime: endD.toISOString() }
                });
              }}
              className="p-1.5 bg-neutral-900 text-white rounded-lg hover:bg-black transition-colors"
              title="Termin erstellen"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {dayEvents.length === 0 ? (
              <p className="text-center py-8 text-neutral-400 text-xs">Keine Termine für diesen Tag.</p>
            ) : (
              dayEvents.map((evt) => {
                const colors = getEventColors(evt.colorId);
                const isAllDay = !!evt.start?.date;
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="p-3 rounded-xl border border-neutral-200/70 hover:shadow-2xs cursor-pointer transition-all"
                    style={{ backgroundColor: colors.bg, borderLeftColor: colors.border, borderLeftWidth: '3px' }}
                  >
                    <h4 className="text-xs font-bold text-neutral-900 truncate">{evt.summary || '(Ohne Titel)'}</h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {isAllDay ? 'Ganztägig' : `${new Date(evt.start.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${evt.end?.dateTime ? new Date(evt.end.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}`}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        MOBILE DAY DETAIL SHEET (Exakt nach Screenshot 2!)
        - Öffnet sich bei Klick auf Tag ODER Termin auf mobilen Geräten
        - Standardmodus ist 'list'
        - Zeitstrahl wird über Wischen nach rechts oder Icon-Button geöffnet
        - Unten angedockter Button: "Am 8. Okt. hinzufüg... +"
        ========================================================================
      */}
      {mobileDayDrawerRendered && (
        <div
          className={`md:hidden fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            mobileDayDrawerClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          onClick={handleCloseMobileDayDrawer}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={mobileDayDrawerRef}
            className={`bg-white border-t border-neutral-200/80 rounded-t-[32px] w-full max-h-[90vh] h-[86vh] shadow-2xl flex flex-col overflow-hidden text-neutral-900 ${
              mobileDayDrawerClosing
                ? (mobileDayWasSwipedClosed ? '' : 'drawer-slide-out-bottom')
                : mobileDayEntryAnim
                ? 'drawer-slide-in-bottom'
                : ''
            }`}
            style={{
              ...mobileDayDrawerStyle,
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="pt-3 pb-1 flex justify-center flex-shrink-0 cursor-grab">
              <div className="w-12 h-1.5 bg-neutral-300/80 rounded-full" />
            </div>

            {/* Header (Screenshot 2: Schwarzer Tag-Badge, Wochentag & Zeitstrahl-Umschaltbutton) */}
            <div className="px-5 py-3 flex items-center justify-between flex-shrink-0 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {selectedDay}
                </div>
                <h2 className="text-xl font-bold text-neutral-900">
                  {weekdayName}
                </h2>
              </div>

              {/* Umschalter für Zeitstrahl vs. Liste (Icon aus Screenshot 2 oben rechts) */}
              <button
                type="button"
                onClick={() => handleMobileDayViewChange(mobileDayViewMode === 'list' ? 'timeline' : 'list')}
                className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                  mobileDayViewMode === 'timeline'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title={mobileDayViewMode === 'list' ? 'Zu Zeitstrahl wechseln (oder nach rechts wischen)' : 'Zu Liste wechseln'}
                aria-label="Ansicht umschalten"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
                  <circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth={2} fill="none" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 11v1.5l1 0.5" />
                </svg>
              </button>
            </div>

            {/* Sub-Header (Screenshot 2: "8. Okt." und Smiley-Icon) */}
            <div className="px-5 py-2 flex items-center justify-between flex-shrink-0 text-sm">
              <span className="text-neutral-500 font-medium">
                {selectedDay}. {MONTH_NAMES_SHORT[currentMonthIndex]}
              </span>
              <button
                type="button"
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg transition-colors"
                title="Stimmung"
              >
                <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
              </button>
            </div>

            {/* Hauptinhalt: Wischbar zwischen Liste und Zeitstrahl */}
            <div
              ref={mobileDayScrollRef}
              onTouchStart={onSheetTouchStart}
              onTouchMove={onSheetTouchMove}
              onTouchEnd={onSheetTouchEnd}
              className="flex-1 overflow-y-auto overscroll-contain px-5 py-2 space-y-3 pb-8 no-scrollbar"
            >
              {mobileDayViewMode === 'list' ? (
                /* LISTEN-ANSICHT (Standard nach Screenshot 2) */
                <>
                  {dayEvents.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-2.5 text-neutral-400">
                        <span className="material-symbols-outlined text-2xl">event_available</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-700">Keine Termine</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Keine Ereignisse an diesem Tag</p>
                    </div>
                  ) : (
                    <>
                      {/* Ganztägige Termine als große Pastell-Karten (Screenshot 2) */}
                      {allDayEvents.map((evt) => {
                        const colors = getEventColors(evt.colorId);
                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className="rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-xs active:scale-[0.99] flex flex-col gap-1 shadow-2xs"
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: `${colors.border}40`,
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="material-symbols-outlined text-[20px]"
                                style={{ color: colors.border }}
                              >
                                event
                              </span>
                              <h3 className="font-bold text-neutral-900 text-sm md:text-base truncate">
                                {evt.summary || '(Ohne Titel)'}
                              </h3>
                            </div>
                            <p className="text-xs text-neutral-500 pl-7 font-medium">
                              Ganztägig
                            </p>
                          </div>
                        );
                      })}

                      {/* Zeitgebundene Termine (Screenshot 2: Startzeit, Akzentbalken, Titel, Zeitspanne) */}
                      <div className="divide-y divide-neutral-100">
                        {layoutedTimedEvents.map((evt, idx) => {
                          const colors = getEventColors(evt.colorId);
                          const prevEvt = idx > 0 ? layoutedTimedEvents[idx - 1] : null;
                          const isFirstAtThisTime = !prevEvt || prevEvt.startFormatted !== evt.startFormatted;

                          return (
                            <div
                              key={evt.id}
                              onClick={() => setSelectedEvent(evt)}
                              className="py-3.5 flex items-center gap-3 cursor-pointer hover:bg-neutral-50/60 rounded-xl px-1.5 transition-colors group"
                            >
                              {/* Startzeit in fetter Schrift (nur beim ersten Termin dieses Zeitpunkts wie in Screenshot 2) */}
                              <div className="w-12 shrink-0 text-sm font-bold text-neutral-900 font-mono">
                                {isFirstAtThisTime ? evt.startFormatted : ''}
                              </div>

                              {/* Vertikaler Farb-Akzentbalken */}
                              <div
                                className="w-1 h-5 rounded-full shrink-0"
                                style={{ backgroundColor: colors.border }}
                              />

                              {/* Titel & Zeitbereich */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-neutral-900 truncate">
                                  {evt.summary || '(Ohne Titel)'}
                                </h4>
                                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                                  {evt.startFormatted} - {evt.endFormatted}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* ZEITSTRAHL-ANSICHT (24h Raster) */
                <div className="relative flex w-full select-none" style={{ height: `${24 * 60 * MOBILE_PX_PER_MIN}px` }}>
                  {/* Zeitspalte */}
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

                  {/* Rasterfläche */}
                  <div className="relative flex-1 bg-white">
                    {HOURS.map((h) => (
                      <div
                        key={`mslot-${h}`}
                        className="absolute left-0 right-0 border-t border-neutral-100/60"
                        style={{ top: `${h * 60 * MOBILE_PX_PER_MIN}px` }}
                      />
                    ))}

                    {/* Jetzt-Linie */}
                    {isSelectedToday && (
                      <div
                        className="absolute left-0 right-0 h-[1.5px] bg-red-500 z-20 pointer-events-none flex items-center"
                        style={{ top: `${nowMinutes * MOBILE_PX_PER_MIN}px` }}
                      >
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm" />
                      </div>
                    )}

                    {/* Platzierte Termine */}
                    {layoutedTimedEvents.map((evt) => {
                      const colors = getEventColors(evt.colorId);
                      const topPx = evt.startMinutes * MOBILE_PX_PER_MIN;
                      const heightPx = Math.max(evt.duration * MOBILE_PX_PER_MIN, 26);

                      return (
                        <div
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            left: `calc(${(evt.col / evt.totalCols) * 100}% + 2px)`,
                            width: `calc(${(1 / evt.totalCols) * 100}% - 4px)`,
                            backgroundColor: colors.bg,
                            borderLeftColor: colors.border,
                            color: colors.text,
                          }}
                          className="absolute z-10 border-l-[3.5px] rounded-r-lg px-2 overflow-hidden cursor-pointer hover:brightness-95 active:scale-[0.98] transition-all shadow-2xs select-none"
                        >
                          <div className="text-[10px] font-mono font-bold opacity-80 whitespace-nowrap">
                            {evt.startFormatted}
                          </div>
                          <div className="font-bold text-[11px] truncate leading-tight">
                            {evt.summary || '(Ohne Titel)'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Unten angedockter Pill-Button (Screenshot 2: "Am 8. Okt. hinzufüg... +") */}
            <div className="p-4 pt-2 border-t border-neutral-100 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={() => {
                  handleCloseMobileDayDrawer();
                  const startD = new Date(currentYear, currentMonthIndex, selectedDay, 9, 0);
                  const endD = new Date(currentYear, currentMonthIndex, selectedDay, 10, 0);
                  setEditingEvent({
                    start: { dateTime: startD.toISOString() },
                    end: { dateTime: endD.toISOString() }
                  });
                }}
                className="w-full rounded-full bg-neutral-100/90 hover:bg-neutral-200/90 active:scale-[0.99] border border-neutral-200/80 px-5 py-3 flex items-center justify-between text-neutral-500 text-sm shadow-sm transition-all"
              >
                <span>Am {selectedDay}. {MONTH_NAMES_SHORT[currentMonthIndex]} hinzufüg...</span>
                <span className="material-symbols-outlined text-[22px] text-neutral-800">add</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suche Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center pt-16 md:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="bg-white border border-neutral-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-4 md:p-6 text-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-3">
              <span className="material-symbols-outlined text-neutral-400">search</span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Termine suchen (Titel, Ort)..."
                className="w-full text-base font-medium outline-none bg-transparent placeholder:text-neutral-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto no-scrollbar space-y-2">
              {searchQuery.trim() === '' ? (
                <p className="text-center py-6 text-xs text-neutral-400">
                  Gib einen Suchbegriff ein, um Termine zu finden.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-center py-6 text-xs text-neutral-400">
                  Keine Termine für "{searchQuery}" gefunden.
                </p>
              ) : (
                searchResults.map((evt) => {
                  const colors = getEventColors(evt.colorId);
                  const dateObj = evt.start?.dateTime ? new Date(evt.start.dateTime) : (evt.start?.date ? new Date(evt.start.date) : new Date());
                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        setCurrentYear(dateObj.getFullYear());
                        setCurrentMonthIndex(dateObj.getMonth());
                        setSelectedDay(dateObj.getDate());
                        setSelectedEvent(evt);
                        setShowSearchModal(false);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setIsMobileDayModalOpen(true);
                        }
                      }}
                      className="p-3 rounded-2xl border border-neutral-100 hover:bg-neutral-50 cursor-pointer flex items-center gap-3 transition-colors"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: colors.border }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-neutral-900 truncate">
                          {evt.summary || '(Ohne Titel)'}
                        </h4>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          {evt.start?.dateTime && ` • ${new Date(evt.start.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-neutral-300 text-[18px]">
                        chevron_right
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monat & Jahr Picker Modal */}
      {showMonthPicker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            className="bg-white border border-neutral-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setPickerYear((y) => y - 1)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <h3 className="text-xl font-bold">{pickerYear}</h3>
              <button
                onClick={() => setPickerYear((y) => y + 1)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
              >
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
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
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
                className="text-neutral-900 font-bold text-sm hover:underline"
              >
                Zurück zu Heute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Termin-Detail Modal */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden text-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-3 overflow-hidden">
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getEventColors(selectedEvent.colorId).border }}
                />
                <h2 className="text-lg font-bold truncate pr-4 text-neutral-900">
                  {selectedEvent.summary || '(Ohne Titel)'}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const evt = selectedEvent;
                    setSelectedEvent(null);
                    setEditingEvent(evt);
                  }}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors p-2 rounded-lg hover:bg-neutral-100"
                  title="Bearbeiten"
                  aria-label="Bearbeiten"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="text-neutral-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                  title="Löschen"
                  aria-label="Löschen"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
                <div className="w-px h-6 bg-neutral-200 mx-1" />
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors p-2 rounded-lg hover:bg-neutral-100"
                  title="Schließen"
                  aria-label="Schließen"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-neutral-500 mt-0.5">event</span>
                <div>
                  <p className="text-xs font-semibold text-neutral-500">Zeitraum</p>
                  <p className="text-sm text-neutral-900 mt-0.5">
                    {selectedEvent.start.date
                      ? 'Ganztägig'
                      : new Date(selectedEvent.start.dateTime).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })}
                    {selectedEvent.end && !selectedEvent.end.date && ` - ${new Date(selectedEvent.end.dateTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}`}
                  </p>
                </div>
              </div>

              {selectedEvent.description && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-neutral-500 mt-0.5">notes</span>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">Beschreibung</p>
                    <p className="text-sm text-neutral-900 mt-0.5 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                </div>
              )}

              {selectedEvent.location && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-neutral-500 mt-0.5">location_on</span>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">Ort</p>
                    <p className="text-sm text-neutral-900 mt-0.5">{selectedEvent.location}</p>
                  </div>
                </div>
              )}

              {selectedEvent.htmlLink && (
                <div className="flex justify-end pt-3 border-t border-neutral-100">
                  <a
                    href={selectedEvent.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
                  >
                    In Google Kalender öffnen
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
