import React from 'react';
import {
  MONTH_NAMES,
  getEventColors,
  getEventMeta,
  getEventStartDate,
  isAllDayEvent,
  formatClock,
} from '../../lib/calendarUtils';
import { Button, Dialog, FOCUS, Icon, IconButton, Input, cx } from '../ds';

/** Farbpunkt des Termins (Farbe kommt aus Google Kalender und ist Datenfarbe, keine Oberflächenfarbe) */
const EventDot = ({ color, className = 'h-2.5 w-2.5' }) => (
  <span className={cx('shrink-0 rounded-full', className)} style={{ backgroundColor: color }} aria-hidden="true" />
);

/** Suche über alle bereits geladenen Termine */
export const SearchModal = ({ query, onQueryChange, results, onSelect, onClose }) => (
  <Dialog open onClose={onClose} size="md" title="Termine suchen" hideClose>
    <div className="space-y-3 text-primary">
      <Input
        type="search"
        autoFocus
        leadingIcon="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Titel, Beschreibung oder Ort"
        aria-label="Termine suchen"
        trailing={query ? <IconButton icon="close" label="Suche leeren" size="sm" onClick={() => onQueryChange('')} /> : null}
      />

      <div className="no-scrollbar max-h-80 space-y-1 overflow-y-auto">
        {query.trim() === '' ? (
          <p className="py-6 text-center text-caption text-tertiary">Gib einen Suchbegriff ein, um Termine zu finden.</p>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-caption text-tertiary">Keine Termine für „{query}“ gefunden.</p>
        ) : (
          results.map((evt) => {
            const colors = getEventColors(evt.colorId);
            // Datums-Termine lokal lesen (kein UTC-Versatz, sonst falscher Tag in Zeitzonen westlich von UTC)
            const dateObj = getEventStartDate(evt);
            return (
              <button
                key={evt.id}
                type="button"
                onClick={() => onSelect(evt, dateObj)}
                className={cx('flex w-full items-center gap-3 rounded-md border border-subtle p-3 text-left transition-colors duration-fast hover:bg-hover', FOCUS)}
              >
                <EventDot color={colors.border} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-strong text-primary">{evt.summary || '(Ohne Titel)'}</span>
                  <span className="mt-0.5 block text-caption text-tertiary">
                    {dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {evt.start?.dateTime && ` • ${formatClock(new Date(evt.start.dateTime))}`}
                  </span>
                </span>
                <Icon name="chevron_right" size="md" className="text-disabled" />
              </button>
            );
          })
        )}
      </div>
    </div>
  </Dialog>
);

/** Monat und Jahr wählen */
export const MonthPickerModal = ({ pickerYear, onPickerYearChange, currentMonthIndex, currentYear, onPick, onToday, onClose }) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title="Monat wählen"
    footer={<Button variant="secondary" onClick={onToday}>Zurück zu Heute</Button>}
  >
    <div className="space-y-4 text-primary">
      <div className="flex items-center justify-between">
        <IconButton icon="chevron_left" label="Vorheriges Jahr" onClick={() => onPickerYearChange(pickerYear - 1)} />
        <h3 className="text-heading">{pickerYear}</h3>
        <IconButton icon="chevron_right" label="Nächstes Jahr" onClick={() => onPickerYearChange(pickerYear + 1)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTH_NAMES.map((name, idx) => {
          const selected = currentMonthIndex === idx && currentYear === pickerYear;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onPick(idx, pickerYear)}
              aria-pressed={selected}
              className={cx(
                'h-11 rounded-md border px-2 text-label transition-colors duration-fast',
                FOCUS,
                selected ? 'border-accent bg-accent-subtle text-accent' : 'border-default bg-surface hover:border-strong',
              )}
            >
              {name.substring(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  </Dialog>
);

/** Termin-Detail (Dialog liegt über dem Tages-Sheet) */
export const EventDetailModal = ({ event, onEdit, onDelete, onClose }) => {
  const colors = getEventColors(event.colorId);
  const { meetLink } = getEventMeta(event);
  const rows = [
    {
      icon: 'event',
      label: 'Zeitraum',
      text: (
        <>
          {isAllDayEvent(event)
            ? 'Ganztägig'
            : new Date(event.start.dateTime).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })}
          {event.end && !event.end.date && ` – ${new Date(event.end.dateTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}`}
        </>
      ),
    },
    event.description && { icon: 'notes', label: 'Beschreibung', text: <span className="whitespace-pre-wrap">{event.description}</span> },
    event.location && { icon: 'location_on', label: 'Ort', text: event.location },
    meetLink && {
      icon: 'videocam',
      label: 'Videokonferenz',
      text: (
        <a
          href={meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cx('rounded-xs text-accent underline underline-offset-2', FOCUS)}
        >
          Mit Google Meet beitreten
        </a>
      ),
    },
  ].filter(Boolean);

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={(
        <span className="flex items-center gap-3">
          <EventDot color={colors.border} className="h-3 w-3" />
          <span className="min-w-0 truncate">{event.summary || '(Ohne Titel)'}</span>
        </span>
      )}
      footer={event.htmlLink ? (
        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cx('inline-flex h-10 items-center justify-center gap-2 rounded-md border border-default bg-surface px-4 text-label text-primary shadow-xs transition-colors duration-fast hover:border-strong', FOCUS)}
        >
          In Google Kalender öffnen
          <Icon name="open_in_new" size="md" />
        </a>
      ) : undefined}
    >
      <div className="space-y-4 text-primary">
        <div className="-mt-1 flex items-center gap-1">
          <Button variant="secondary" size="sm" leadingIcon="edit" onClick={onEdit}>Bearbeiten</Button>
          <Button variant="danger-ghost" size="sm" leadingIcon="delete" onClick={onDelete}>Löschen</Button>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <Icon name={row.icon} size="lg" className="mt-0.5 text-tertiary" />
            <div>
              <p className="text-caption-strong text-tertiary">{row.label}</p>
              <p className="mt-0.5 text-body text-primary">{row.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
};
