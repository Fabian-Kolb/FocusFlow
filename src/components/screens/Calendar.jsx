import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchCalendarEvents, deleteCalendarEvent, createCalendarEvent, updateCalendarEvent } from '../../lib/calendarAPI';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import EventEditForm from './EventEditForm';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

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

const Calendar = () => {
  const { user, googleCalendarToken, linkGoogleCalendar } = useAuth();
  
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
  const [slideDirection, setSlideDirection] = useState(''); // Tracking swipe direction for animation
  const [isScrollingDown, setIsScrollingDown] = useState(false);

  // Swipe Gesten für Mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    setSwipeOffset(0);
  };

  const onTouchMove = (e) => {
    if (touchStart === null) return;
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);
    setSwipeOffset(currentX - touchStart);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (touchStart === null || touchEnd === null) {
      setSwipeOffset(0);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 80;
    const isRightSwipe = distance < -80;
    
    if (isLeftSwipe) {
      handleNextMonth();
    } else if (isRightSwipe) {
      handlePrevMonth();
    }
    
    setSwipeOffset(0);
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

  // Hole Events, wenn ein Token vorhanden ist ODER sich der Monat ändert
  useEffect(() => {
    async function loadEvents() {
      if (!googleCalendarToken) return;
      
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
        const fetchedEvents = await fetchCalendarEvents(googleCalendarToken, currentYear, currentMonthIndex);
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
  }, [googleCalendarToken, currentMonthIndex, currentYear]);

  const handleConnectCalendar = async () => {
    try {
      await linkGoogleCalendar();
    } catch (err) {
      console.error("Verbindung fehlgeschlagen", err);
      alert("Fehler bei der Verbindung mit Google Kalender.");
    }
  };

  const handlePrevMonth = () => {
    setSlideDirection('right');
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSlideDirection('left');
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
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
        await updateCalendarEvent(googleCalendarToken, eventId, eventData);
      } else {
        await createCalendarEvent(googleCalendarToken, eventData);
      }
      // Reload current month to reflect changes
      const cacheKey = `${currentYear}-${currentMonthIndex}`;
      const fetchedEvents = await fetchCalendarEvents(googleCalendarToken, currentYear, currentMonthIndex);
      setEventsCache(prev => ({ ...prev, [cacheKey]: fetchedEvents }));
      setEvents(fetchedEvents);
      setEditingEvent(null);
    } catch (err) {
      console.error("Fehler beim Speichern", err);
      alert("Fehler beim Speichern des Termins.");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Diesen Termin wirklich löschen?")) return;
    try {
      await deleteCalendarEvent(googleCalendarToken, eventId);
      // Reload
      const cacheKey = `${currentYear}-${currentMonthIndex}`;
      const fetchedEvents = await fetchCalendarEvents(googleCalendarToken, currentYear, currentMonthIndex);
      setEventsCache(prev => ({ ...prev, [cacheKey]: fetchedEvents }));
      setEvents(fetchedEvents);
      setSelectedEvent(null);
    } catch (err) {
      console.error("Fehler beim Löschen", err);
      alert("Fehler beim Löschen des Termins.");
    }
  };

  // Hilfsfunktion: Berechne, wie viele Tage der aktuelle Monat hat
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const daysInCurrentMonth = Array.from({ length: getDaysInMonth(currentMonthIndex, currentYear) }, (_, i) => i + 1);
  
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

  const handleDayClick = (dayNum) => {
    setSelectedDay(dayNum);
  };

  const handleAddEventOnDay = (e, dayNum) => {
    e.stopPropagation();
    setSelectedDay(dayNum);
    const d = new Date(currentYear, currentMonthIndex, dayNum);
    setEditingEvent({}); // Öffnet Maske (useEffect in EventEditForm nutzt selectedDateObj, was wir gerade indirekt setzen, aber wir können auch initialEvent={} nehmen)
  };

  // Render State 1: Nicht verbunden
  if (!googleCalendarToken) {
    return (
      <div className="screen-transition flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-surface-low rounded-full flex items-center justify-center mb-6 text-primary">
          <span className="material-symbols-outlined text-4xl">calendar_month</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Kalender verbinden</h2>
        <p className="text-on-surface-variant max-w-md mb-8">
          Verbinde deinen Google Kalender, um deine Projekte, Deadlines und Fokus-Zeiten direkt hier zu sehen und zu verwalten.
        </p>
        <button 
          onClick={handleConnectCalendar}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors flex items-center gap-2"
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
    <div className="screen-transition">
      
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
        
        {/* Mobile: Swipe Hint (nur sichtbar auf ganz kleinen Screens, optional) */}
        <div className="sm:hidden text-[10px] text-on-surface-variant w-full text-center uppercase tracking-widest font-bold opacity-50 mb-[-10px]">
          Wischen für nächsten Monat
        </div>

        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <button onClick={handlePrevMonth} className="hidden sm:flex p-2 hover:bg-surface-low rounded-full transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>

          <h2 
            className="text-xl sm:text-3xl font-bold cursor-pointer hover:text-primary transition-colors flex items-center gap-1 select-none whitespace-nowrap"
            onClick={() => {
              setPickerYear(currentYear);
              setShowMonthPicker(true);
            }}
          >
            {MONTH_NAMES[currentMonthIndex]} {currentYear}
            <span className="material-symbols-outlined text-[20px] sm:text-[24px]">arrow_drop_down</span>
          </h2>

          <button onClick={handleNextMonth} className="hidden sm:flex p-2 hover:bg-surface-low rounded-full transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <button 
           onClick={() => setEditingEvent({})}
           className="hidden sm:flex w-auto bg-primary text-white text-sm sm:text-base px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold hover:bg-primary-hover transition-transform active:scale-95 items-center justify-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap flex-shrink-0"
        >
           <span className="material-symbols-outlined text-[18px] sm:text-[20px]">add</span>
           Neuer Termin
        </button>
      </div>

      <div className="flex flex-col gap-8 overflow-x-hidden">
        {/* Kalender Raster (Volle Breite) */}
        <div 
          key={`${currentYear}-${currentMonthIndex}`}
          className={`w-full ${!isDragging && slideDirection === 'left' ? 'animate-swipe-left' : !isDragging && slideDirection === 'right' ? 'animate-swipe-right' : ''}`}
          style={{
            transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Card padding="none" className="w-full grid grid-cols-7 bg-outline-variant gap-px overflow-hidden border border-outline-variant select-none">
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">MO</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">DI</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">MI</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">DO</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">FR</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">SA</div>
            <div className="bg-surface py-2 text-center text-xs font-mono font-bold">SO</div>

            {/* Hier könnte man noch Padding für die Wochentage berechnen, für den MVP reicht die Grid-Ansicht */}
            
            {daysInCurrentMonth.map((dayNum) => {
              const isSelected = dayNum === selectedDay;
              
              // Finde Events für diese spezifische Zelle
              const cellDateObj = new Date(currentYear, currentMonthIndex, dayNum);
              const cellEvents = currentMonthEvents.filter(evt => isEventOnDate(evt, cellDateObj));

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-[120px] p-2 text-xs mono cursor-pointer border transition-colors ${
                    isSelected
                      ? 'bg-surface-low border-2 border-primary z-10'
                      : 'bg-white hover:bg-surface/50 border-transparent border-b border-r border-outline-variant/30'
                  }`}
                  onClick={() => handleDayClick(dayNum)}
                  onDoubleClick={(e) => handleAddEventOnDay(e, dayNum)}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between items-center sm:items-start">
                    <span className={isSelected ? 'font-bold' : ''}>{dayNum}</span>
                    {isSelected && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-primary rounded-full mt-1"></span>}
                  </div>
                  {isDataLoading ? (
                    <div className="mt-1.5 space-y-1 opacity-50">
                      <div className="h-2.5 bg-outline-variant/60 rounded w-full animate-pulse"></div>
                      <div className="h-2.5 bg-outline-variant/60 rounded w-2/3 animate-pulse"></div>
                    </div>
                  ) : (
                    cellEvents.slice(0, 2).map((evt) => {
                      const isAllDay = !!evt.start.date;
                      let timeStr = "";
                      if (!isAllDay) {
                         timeStr = new Date(evt.start.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' ';
                      }
                      
                      const customColor = evt.colorId ? GOOGLE_COLORS[evt.colorId] : null;
                      const style = customColor 
                        ? (isAllDay ? { backgroundColor: customColor.bg, color: customColor.text } : { backgroundColor: `${customColor.bg}40`, color: customColor.text })
                        : {};
                      const fallbackClasses = customColor ? '' : (isAllDay ? 'bg-primary text-white' : 'bg-primary/10 text-primary');

                      return (
                        <div 
                          key={evt.id} 
                          className={`mt-1 p-1.5 font-medium rounded-md text-[10.5px] leading-tight truncate cursor-pointer hover:brightness-95 transition-all ${fallbackClasses}`} 
                          style={style}
                          title={evt.summary}
                          onClick={(e) => {
                            e.stopPropagation(); // Verhindert, dass der Tag (Zelle) ausgewählt wird
                            setSelectedEvent(evt);
                          }}
                        >
                          {timeStr}{evt.summary}
                        </div>
                      );
                    })
                  )}
                  {!isDataLoading && cellEvents.length > 2 && (
                    <div className="text-[9px] text-center text-on-surface-variant mt-0.5">
                      +{cellEvents.length - 2} weitere
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>

        {/* Tages-Timeline (Unter dem Kalender) */}
        <div className="w-full">
          <Card padding="normal" className="space-y-4 border border-outline-variant">
            <h3 className="text-sm font-bold text-primary border-b border-outline-variant pb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined">schedule</span>
              Tages-Timeline: {selectedDay}. {MONTH_NAMES[currentMonthIndex]} {currentYear}
            </h3>

            <div 
              key={`timeline-${currentYear}-${currentMonthIndex}-${selectedDay}`}
              className="relative pt-4 sm:pt-6 pb-2 pl-0 pr-0 overflow-hidden animate-fadeIn"
            >
              {(isDataLoading || dayEvents.length > 0) && (
                <div className="absolute left-[15px] sm:left-[23px] top-4 sm:top-6 bottom-0 w-[2px] bg-outline-variant/60 rounded-full"></div>
              )}

              {isDataLoading && (
                <div className="space-y-4 pt-1">
                  {[1, 2].map(i => (
                    <div key={i} className="relative pl-8 sm:pl-12 pr-2 sm:pr-4 mb-4 sm:mb-5 group animate-pulse">
                      <div className="absolute left-[11px] sm:left-[18px] top-3.5 sm:top-4 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full z-10 bg-outline-variant"></div>
                      <div className="w-full p-3 sm:p-4 rounded-xl border-l-4 border-outline-variant bg-surface-low flex flex-col gap-2">
                        <div className="h-4 bg-outline-variant/50 rounded w-1/2"></div>
                        <div className="h-3 bg-outline-variant/30 rounded w-1/4 mt-1"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isDataLoading && dayEvents.length === 0 && (
                <p className="text-sm text-on-surface-variant italic px-2">Keine Termine für diesen Tag.</p>
              )}

              {!isDataLoading && dayEvents.map((evt) => {
                const isAllDay = !!evt.start.date;
                let timeDisplay = "Ganztägig";
                
                if (!isAllDay) {
                  const startT = new Date(evt.start.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                  const endT = new Date(evt.end.dateTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                  timeDisplay = `${startT} - ${endT} Uhr`;
                } else if (evt.end && evt.end.date) {
                  // Bei ganztägigen Events, die über mehrere Tage gehen
                  const [y1, m1, d1] = evt.end.date.split('-');
                  const endDate = new Date(parseInt(y1), parseInt(m1) - 1, parseInt(d1));
                  endDate.setDate(endDate.getDate() - 1); // Google setzt das Ende auf den Tag danach
                  
                  const [y2, m2, d2] = evt.start.date.split('-');
                  const startDate = new Date(parseInt(y2), parseInt(m2) - 1, parseInt(d2));
                  
                  if (startDate.toDateString() !== endDate.toDateString()) {
                     timeDisplay = `Bis ${endDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
                  }
                }
                
                const evtColor = evt.colorId && GOOGLE_COLORS[evt.colorId] ? GOOGLE_COLORS[evt.colorId] : { bg: 'var(--primary)', text: 'white' };
                
                return (
                  <div key={evt.id} className="relative pl-8 sm:pl-12 pr-2 sm:pr-4 mb-4 sm:mb-5 group">
                    {/* Timeline Dot */}
                    <div 
                      className="absolute left-[11px] sm:left-[18px] top-3.5 sm:top-4 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full z-10 border-2 border-surface shadow-sm transition-transform group-hover:scale-125"
                      style={{ backgroundColor: evtColor.bg }}
                    ></div>

                    <div 
                      className="w-full p-3 sm:p-4 rounded-xl border-l-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all shadow-sm bg-white flex flex-col gap-1"
                      style={{
                        borderColor: evtColor.bg,
                        backgroundColor: evt.colorId ? `${evtColor.bg}10` : 'var(--surface-low)'
                      }}
                      onClick={() => setSelectedEvent(evt)}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
                        <p className="font-bold text-[13px] sm:text-base leading-snug break-words" style={{ color: evt.colorId ? evtColor.text : 'inherit' }}>
                          {evt.summary}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 sm:mt-0 mb-1 sm:mb-0">
                          <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/60 text-on-surface-variant border border-black/5 shadow-sm flex items-center gap-1 whitespace-nowrap w-fit">
                            <span className="material-symbols-outlined text-[12px] sm:text-[14px]">schedule</span>
                            {timeDisplay}
                          </span>
                        </div>
                      </div>
                      
                      {evt.description && (
                        <p className="text-on-surface-variant mt-1 text-[11px] sm:text-[13px] line-clamp-2">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

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
        className={`sm:hidden fixed bottom-24 right-6 w-12 h-12 bg-primary text-white rounded-xl shadow-xl flex items-center justify-center z-40 transition-all duration-300 ease-in-out active:scale-90 ${
          isScrollingDown ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
      </button>

    </div>
  );
};

export default Calendar;
