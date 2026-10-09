import React from 'react';
import { MONTH_NAMES_HEADER } from '../../lib/calendarUtils';

import { Button, Icon, IconButton } from '../ds';
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
  <div className="px-3 py-2 md:px-6 md:py-3 border-b border-subtle flex items-center justify-between flex-shrink-0 bg-surface">
    <div className="flex items-center gap-2">
      <IconButton icon="menu" label="Menü öffnen" size="sm" onClick={onMenu} />

      <div className="hidden md:flex items-center gap-1 ml-2">
        <IconButton icon="chevron_left" label="Vorheriger Monat" size="sm" onClick={onPrev} />
        <IconButton icon="chevron_right" label="Nächster Monat" size="sm" onClick={onNext} />
      </div>
    </div>

    <button
      type="button"
      onClick={onPickMonth}
      className="text-heading md:text-title tracking-tight text-primary hover:opacity-75 transition-opacity px-2 py-1 rounded-md flex items-center gap-1"
      title="Monat auswählen"
    >
      <span>{MONTH_NAMES_HEADER[monthIndex]}</span>
      <span className="text-label text-tertiary hidden sm:inline ml-1">{year}</span>
    </button>

    <div className="flex items-center gap-2 md:gap-3">
      <IconButton icon="search" label="Termine suchen" size="sm" onClick={onSearch} />

      {/* Heute-Button: abgerundetes Quadrat mit der heutigen Tageszahl */}
      <Button variant="ghost" size="sm" onClick={onToday} title="Zurück zu Heute" aria-label="Zurück zu Heute">
        {todayNumber}
      </Button>

      <div className="hidden md:flex items-center gap-2 pl-2 border-l border-default">
        <div className="flex items-center bg-muted p-0.5 rounded-md">
          <button
            type="button"
            onClick={() => onLayoutChange('stacked')}
            className={`p-1 rounded-md transition-all ${desktopLayout === 'stacked' ? 'bg-surface shadow-xs text-primary' : 'text-tertiary'}`}
            title="Untereinander"
            aria-label="Untereinander"
          >
            <Icon name="view_agenda" size="md" />
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange('side-by-side')}
            className={`p-1 rounded-md transition-all ${desktopLayout === 'side-by-side' ? 'bg-surface shadow-xs text-primary' : 'text-tertiary'}`}
            title="Nebeneinander"
            aria-label="Nebeneinander"
          >
            <Icon name="vertical_split" size="md" />
          </button>
        </div>

        <Button size="sm" onClick={onAddEvent}>
          <Icon name="add" size="sm" />
          Termin
        </Button>
      </div>
    </div>
  </div>
);

export default CalendarHeader;
