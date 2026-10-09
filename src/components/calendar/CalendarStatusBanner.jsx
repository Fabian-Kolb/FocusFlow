import React from 'react';

import { Alert, Button } from '../ds';
/**
 * Status unter der Kopfzeile: Offline-Hinweis, Ladefehler (mit "Erneut versuchen") und Ladeanzeige.
 * Bereits geladene Termine bleiben bei Fehlern/Offline sichtbar.
 */
const CalendarStatusBanner = ({ error, isOffline, isLoading, onRetry }) => {
  if (!error && !isOffline && !isLoading) return null;

  return (
    <div className="flex-shrink-0">
      {isOffline && (
        <Alert tone="warning" icon="cloud_off" className="mx-3 my-2">
        Du bist offline. Angezeigt werden die zuletzt geladenen Termine; neue Termine lassen sich erst wieder mit Verbindung laden oder speichern.
        </Alert>
      )}

      {error && !isOffline && (
        <Alert
        tone="danger"
        icon="warning"
        className="mx-3 my-2"
        action={<Button variant="secondary" size="sm" onClick={onRetry}>Erneut versuchen</Button>}
        >
        {error}
        </Alert>
      )}

      {isLoading && !error && (
        <div role="status" aria-live="polite" className="h-0.5 w-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 bg-accent animate-pulse" />
          <span className="sr-only">Termine werden geladen …</span>
        </div>
      )}
    </div>
  );
};

export default CalendarStatusBanner;
