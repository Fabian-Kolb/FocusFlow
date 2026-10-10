import React, { useEffect, useRef, useState } from 'react';
import { Button, FOCUS, Icon, IconButton, Menu, MenuItem, cx } from '../ds';
import { VIEW_OPTIONS } from './viewOptions';

const iconFor = (view) => VIEW_OPTIONS.find((o) => o.value === view)?.icon || 'calendar_view_month';

/** Ansicht am Handy: ein Knopf, der ein kleines Menü öffnet */
const ViewMenu = ({ view, onViewChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <IconButton icon={iconFor(view)} label="Ansicht wählen" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <Menu label="Ansicht" className="absolute right-0 top-full z-dropdown mt-1">
          {VIEW_OPTIONS.map((opt) => (
            <MenuItem
              key={opt.value}
              icon={opt.icon}
              selected={view === opt.value}
              onClick={() => {
                onViewChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  );
};

/** Ansicht am PC: Umschalter mit Wörtern */
const ViewSwitch = ({ view, onViewChange }) => (
  <div role="group" aria-label="Ansicht" className="flex items-center rounded-md bg-muted p-0.5">
    {VIEW_OPTIONS.map((opt) => {
      const active = view === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onViewChange(opt.value)}
          aria-pressed={active}
          className={cx(
            'h-8 rounded-sm px-3 text-label-sm transition-colors duration-fast',
            active ? 'bg-surface text-primary shadow-xs' : 'text-secondary hover:text-primary',
            FOCUS,
          )}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

/**
 * Kopfzeile des Kalenders. Handy (Samsung-Stil): Titel mit Monatsauswahl, Suche, Heute, Ansicht, „+“.
 * PC (Google-Stil): Heute, vor/zurück, Titel, Ansicht-Umschalter, Suche, Tagesleiste, „+ Termin“.
 */
const CalendarHeader = ({
  isDesktop,
  view,
  onViewChange,
  title,
  todayNumber,
  onPrev,
  onNext,
  onToday,
  onPickMonth,
  onSearch,
  onAddEvent,
  canToggleSidebar,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const titleButton = (
    <button
      type="button"
      onClick={onPickMonth}
      title="Monat auswählen"
      className={cx('flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-heading text-primary transition-colors duration-fast hover:bg-hover', FOCUS)}
    >
      <span className="truncate">{title}</span>
      <Icon name="expand_more" size="md" className="shrink-0 text-secondary" />
    </button>
  );

  if (!isDesktop) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-subtle bg-surface px-2 py-2">
        {titleButton}
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon="search" label="Termine suchen" onClick={onSearch} />
          <Button variant="ghost" size="sm" onClick={onToday} title="Zurück zu Heute" aria-label="Zurück zu Heute" className="tabular-nums">
            {todayNumber}
          </Button>
          <ViewMenu view={view} onViewChange={onViewChange} />
          <IconButton icon="add" label="Termin erstellen" variant="primary" onClick={onAddEvent} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-subtle bg-surface px-6 py-3">
      <Button variant="secondary" onClick={onToday} aria-label="Zurück zu Heute">
        Heute
      </Button>
      <div className="flex items-center gap-1">
        <IconButton icon="chevron_left" label="Zurück" onClick={onPrev} />
        <IconButton icon="chevron_right" label="Weiter" onClick={onNext} />
      </div>
      {titleButton}

      <div className="ml-auto flex items-center gap-2">
        <ViewSwitch view={view} onViewChange={onViewChange} />
        <IconButton icon="search" label="Termine suchen" onClick={onSearch} />
        {canToggleSidebar && (
          <IconButton
            icon={sidebarOpen ? 'right_panel_close' : 'right_panel_open'}
            label={sidebarOpen ? 'Tagesleiste ausblenden' : 'Tagesleiste einblenden'}
            variant={sidebarOpen ? 'secondary' : 'ghost'}
            aria-pressed={sidebarOpen}
            onClick={onToggleSidebar}
          />
        )}
        <Button leadingIcon="add" onClick={onAddEvent}>Termin</Button>
      </div>
    </div>
  );
};

export default CalendarHeader;
