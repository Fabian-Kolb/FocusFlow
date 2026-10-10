import React from 'react';
import { MONTH_NAMES_HEADER } from '../../lib/calendarUtils';
import { Button, FOCUS, Icon, IconButton, cx } from '../ds';

const LAYOUT_OPTIONS = [
  { value: 'stacked', label: 'Untereinander', icon: 'view_agenda' },
  { value: 'side-by-side', label: 'Nebeneinander', icon: 'vertical_split' },
];

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
  <div className="flex shrink-0 items-center justify-between border-b border-subtle bg-surface px-3 py-2 md:px-6 md:py-3">
    <div className="flex items-center gap-2">
      <IconButton icon="menu" label="Menü öffnen" size="sm" onClick={onMenu} />

      <div className="ml-2 hidden items-center gap-1 md:flex">
        <IconButton icon="chevron_left" label="Vorheriger Monat" size="sm" onClick={onPrev} />
        <IconButton icon="chevron_right" label="Nächster Monat" size="sm" onClick={onNext} />
      </div>
    </div>

    <button
      type="button"
      onClick={onPickMonth}
      className={cx('flex items-center gap-1 rounded-md px-2 py-1 text-heading text-primary transition-colors duration-fast hover:bg-hover md:text-title', FOCUS)}
      title="Monat auswählen"
    >
      <span>{MONTH_NAMES_HEADER[monthIndex]}</span>
      <span className="ml-1 hidden text-label text-tertiary sm:inline">{year}</span>
      <Icon name="expand_more" size="md" className="text-secondary" />
    </button>

    <div className="flex items-center gap-2 md:gap-3">
      <IconButton icon="search" label="Termine suchen" size="sm" onClick={onSearch} />

      {/* Heute-Button: zeigt die heutige Tageszahl */}
      <Button variant="ghost" size="sm" onClick={onToday} title="Zurück zu Heute" aria-label="Zurück zu Heute">
        {todayNumber}
      </Button>

      <div className="hidden items-center gap-2 border-l border-default pl-2 md:flex">
        <div role="group" aria-label="Layout" className="flex items-center rounded-md bg-muted p-0.5">
          {LAYOUT_OPTIONS.map((opt) => {
            const active = desktopLayout === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onLayoutChange(opt.value)}
                aria-pressed={active}
                title={opt.label}
                aria-label={opt.label}
                className={cx(
                  'flex h-7 w-8 items-center justify-center rounded-sm transition-colors duration-fast',
                  active ? 'bg-surface text-primary shadow-xs' : 'text-tertiary hover:text-primary',
                  FOCUS
                )}
              >
                <Icon name={opt.icon} size="md" />
              </button>
            );
          })}
        </div>

        <Button size="sm" leadingIcon="add" onClick={onAddEvent}>
          Termin
        </Button>
      </div>
    </div>
  </div>
);

export default CalendarHeader;
