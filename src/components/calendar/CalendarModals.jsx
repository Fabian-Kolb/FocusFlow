import React from 'react';
import {
  MONTH_NAMES,
  getEventColors,
  getEventStartDate,
  isAllDayEvent,
  formatClock,
} from '../../lib/calendarUtils';

/** Suche über alle bereits geladenen Termine */
export const SearchModal = ({ query, onQueryChange, results, onSelect, onClose }) => (
  <div
    className="fixed inset-0 z-[80] flex items-start justify-center pt-16 md:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    onClick={onClose}
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
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Termine suchen (Titel, Ort)..."
          className="w-full text-base font-medium outline-none bg-transparent placeholder:text-neutral-400"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange('')} className="text-neutral-400 hover:text-neutral-700 p-1" aria-label="Suche leeren">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      <div className="mt-3 max-h-80 overflow-y-auto no-scrollbar space-y-2">
        {query.trim() === '' ? (
          <p className="text-center py-6 text-xs text-neutral-400">Gib einen Suchbegriff ein, um Termine zu finden.</p>
        ) : results.length === 0 ? (
          <p className="text-center py-6 text-xs text-neutral-400">Keine Termine für "{query}" gefunden.</p>
        ) : (
          results.map((evt) => {
            const colors = getEventColors(evt.colorId);
            // Datums-Termine lokal lesen (kein UTC-Versatz, sonst falscher Tag in Zeitzonen westlich von UTC)
            const dateObj = getEventStartDate(evt);
            return (
              <div
                key={evt.id}
                onClick={() => onSelect(evt, dateObj)}
                className="p-3 rounded-2xl border border-neutral-100 hover:bg-neutral-50 cursor-pointer flex items-center gap-3 transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors.border }} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-neutral-900 truncate">{evt.summary || '(Ohne Titel)'}</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {evt.start?.dateTime && ` • ${formatClock(new Date(evt.start.dateTime))}`}
                  </p>
                </div>
                <span className="material-symbols-outlined text-neutral-300 text-[18px]">chevron_right</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
);

/** Monat & Jahr wählen */
export const MonthPickerModal = ({ pickerYear, onPickerYearChange, currentMonthIndex, currentYear, onPick, onToday, onClose }) => (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    onClick={onClose}
  >
    <div
      className="bg-white border border-neutral-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-neutral-900"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-6">
        <button type="button" onClick={() => onPickerYearChange(pickerYear - 1)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600" aria-label="Vorheriges Jahr">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h3 className="text-xl font-bold">{pickerYear}</h3>
        <button type="button" onClick={() => onPickerYearChange(pickerYear + 1)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600" aria-label="Nächstes Jahr">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MONTH_NAMES.map((name, idx) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(idx, pickerYear)}
            className={`py-3 px-2 rounded-xl text-sm font-bold transition-colors ${
              currentMonthIndex === idx && currentYear === pickerYear
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
            }`}
          >
            {name.substring(0, 3)}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onToday} className="text-neutral-900 font-bold text-sm hover:underline">
          Zurück zu Heute
        </button>
      </div>
    </div>
  </div>
);

/** Termin-Detail (z-[80] über dem Tages-Sheet bei z-[60]) */
export const EventDetailModal = ({ event, onEdit, onDelete, onClose }) => {
  const colors = getEventColors(event.colorId);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors.border }} />
            <h2 className="text-lg font-bold truncate pr-4 text-neutral-900">{event.summary || '(Ohne Titel)'}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} className="text-neutral-500 hover:text-neutral-900 transition-colors p-2 rounded-lg hover:bg-neutral-100" title="Bearbeiten" aria-label="Bearbeiten">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
            <button type="button" onClick={onDelete} className="text-neutral-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50" title="Löschen" aria-label="Löschen">
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
            <div className="w-px h-6 bg-neutral-200 mx-1" />
            <button type="button" onClick={onClose} className="text-neutral-500 hover:text-neutral-900 transition-colors p-2 rounded-lg hover:bg-neutral-100" title="Schließen" aria-label="Schließen">
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
                {isAllDayEvent(event)
                  ? 'Ganztägig'
                  : new Date(event.start.dateTime).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })}
                {event.end && !event.end.date && ` - ${new Date(event.end.dateTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}`}
              </p>
            </div>
          </div>

          {event.description && (
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-neutral-500 mt-0.5">notes</span>
              <div>
                <p className="text-xs font-semibold text-neutral-500">Beschreibung</p>
                <p className="text-sm text-neutral-900 mt-0.5 whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}

          {event.location && (
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-neutral-500 mt-0.5">location_on</span>
              <div>
                <p className="text-xs font-semibold text-neutral-500">Ort</p>
                <p className="text-sm text-neutral-900 mt-0.5">{event.location}</p>
              </div>
            </div>
          )}

          {event.htmlLink && (
            <div className="flex justify-end pt-3 border-t border-neutral-100">
              <a
                href={event.htmlLink}
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
  );
};
