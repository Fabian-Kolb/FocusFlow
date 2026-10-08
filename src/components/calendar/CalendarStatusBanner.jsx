import React from 'react';

/**
 * Status unter der Kopfzeile: Offline-Hinweis, Ladefehler (mit "Erneut versuchen") und Ladeanzeige.
 * Bereits geladene Termine bleiben bei Fehlern/Offline sichtbar.
 */
const CalendarStatusBanner = ({ error, isOffline, isLoading, onRetry }) => {
  if (!error && !isOffline && !isLoading) return null;

  return (
    <div className="flex-shrink-0">
      {isOffline && (
        <div role="status" className="mx-3 my-2 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-xs">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0">cloud_off</span>
          <span className="flex-1">Du bist offline. Angezeigt werden die zuletzt geladenen Termine; neue Termine lassen sich erst wieder mit Verbindung laden oder speichern.</span>
        </div>
      )}

      {error && !isOffline && (
        <div role="alert" className="mx-3 my-2 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-xs">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0">warning</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={onRetry} className="font-bold underline hover:opacity-75 cursor-pointer">
            Erneut versuchen
          </button>
        </div>
      )}

      {isLoading && !error && (
        <div role="status" aria-live="polite" className="h-0.5 w-full bg-neutral-100 overflow-hidden">
          <div className="h-full w-1/3 bg-neutral-800 animate-pulse" />
          <span className="sr-only">Termine werden geladen …</span>
        </div>
      )}
    </div>
  );
};

export default CalendarStatusBanner;
