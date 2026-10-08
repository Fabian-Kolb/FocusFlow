import React from 'react';
import { MONTH_NAMES_HEADER } from '../../lib/calendarUtils';

/**
 * Kopfzeile: links Menü (+ Monats-Chevrons am Desktop), Mitte Monatsname (öffnet Monatsauswahl),
 * rechts Suche, Heute-Button (mit Tageszahl) und am Desktop Layout-Umschalter + "Termin".
 */
const CalendarHeader = ({
  monthIndex,
  year,
  todayNumber,
  desktopLayout,
  onLayoutChange,
  onMenu,
  onPrev,
  onNext,
  onPickMonth,
  onSearch,
  onToday,
  onAddEvent,
}) => (
  <div className="px-3 py-2 md:px-6 md:py-3 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMenu}
        className="p-1.5 rounded-lg text-neutral-800 hover:bg-neutral-100 transition-colors flex items-center justify-center"
        title="Menü öffnen"
        aria-label="Menü öffnen"
      >
        <span className="material-symbols-outlined text-[24px]">menu</span>
      </button>

      <div className="hidden md:flex items-center gap-1 ml-2">
        <button type="button" onClick={onPrev} className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors" title="Vorheriger Monat" aria-label="Vorheriger Monat">
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <button type="button" onClick={onNext} className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors" title="Nächster Monat" aria-label="Nächster Monat">
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    </div>

    <button
      type="button"
      onClick={onPickMonth}
      className="text-xl md:text-2xl font-black tracking-tight text-neutral-900 hover:opacity-75 transition-opacity px-2 py-1 rounded-lg flex items-center gap-1"
      title="Monat auswählen"
    >
      <span>{MONTH_NAMES_HEADER[monthIndex]}</span>
      <span className="text-sm font-medium text-neutral-400 hidden sm:inline ml-1">{year}</span>
    </button>

    <div className="flex items-center gap-2 md:gap-3">
      <button
        type="button"
        onClick={onSearch}
        className="p-1.5 rounded-lg text-neutral-800 hover:bg-neutral-100 transition-colors flex items-center justify-center"
        title="Termine suchen"
        aria-label="Termine suchen"
      >
        <span className="material-symbols-outlined text-[22px]">search</span>
      </button>

      {/* Heute-Button: abgerundetes Quadrat mit der heutigen Tageszahl */}
      <button
        type="button"
        onClick={onToday}
        className="w-7 h-7 md:w-8 md:h-8 rounded-lg border-[1.5px] border-neutral-800 hover:bg-neutral-100 active:scale-95 transition-all flex items-center justify-center font-bold text-xs md:text-sm text-neutral-900 shadow-2xs"
        title="Zurück zu Heute"
        aria-label="Zurück zu Heute"
      >
        {todayNumber}
      </button>

      <div className="hidden md:flex items-center gap-2 pl-2 border-l border-neutral-200">
        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => onLayoutChange('stacked')}
            className={`p-1 rounded-md transition-all ${desktopLayout === 'stacked' ? 'bg-white shadow-2xs text-neutral-900' : 'text-neutral-500'}`}
            title="Untereinander"
            aria-label="Untereinander"
          >
            <span className="material-symbols-outlined text-[18px]">view_agenda</span>
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange('side-by-side')}
            className={`p-1 rounded-md transition-all ${desktopLayout === 'side-by-side' ? 'bg-white shadow-2xs text-neutral-900' : 'text-neutral-500'}`}
            title="Nebeneinander"
            aria-label="Nebeneinander"
          >
            <span className="material-symbols-outlined text-[18px]">vertical_split</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onAddEvent}
          className="bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-black transition-all flex items-center gap-1 active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Termin
        </button>
      </div>
    </div>
  </div>
);

export default CalendarHeader;
