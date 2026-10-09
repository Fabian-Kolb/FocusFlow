import React from 'react';

import { Button, Icon } from './ds';
// Nach einem Deploy fehlen alte Lazy-Chunks; ein Reload lädt die neue Version.
function isChunkLoadError(error) {
  const msg = String(error?.message || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

const CHUNK_RELOAD_FLAG = 'focusflow_chunk_reload';

/**
 * Fängt Render-Fehler ab, damit statt eines weißen Bildschirms eine Fehlerseite erscheint.
 * `variant="screen"` rendert innerhalb des Layouts (Navigation bleibt nutzbar),
 * `variant="app"` als Vollbild-Fallback für die gesamte App.
 * `resetKey`: Ändert sich der Wert (z. B. der aktive Screen), wird der Fehler zurückgesetzt.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  // Wechsel des resetKey (z. B. anderer Screen) setzt den Fehler zurück
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);

    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
          sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        // sessionStorage nicht verfügbar: Fallback-UI bleibt sichtbar
      }
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    try { sessionStorage.removeItem(CHUNK_RELOAD_FLAG); } catch {}
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isApp = this.props.variant === 'app';
    const isUpdate = isChunkLoadError(error);

    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center gap-4 px-6 py-12 text-center ${
          isApp ? 'min-h-[100dvh] bg-canvas text-primary' : 'min-h-[50vh] flex-1'
        }`}
      >
        <Icon name={isUpdate ? 'system_update' : 'sentiment_dissatisfied'} size="xl" className="text-secondary" />
        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-heading text-primary">
            {isUpdate ? 'Neue Version verfügbar' : 'Hier ist etwas schiefgelaufen'}
          </h2>
          <p className="text-body text-secondary leading-relaxed">
            {isUpdate
              ? 'FocusFlow wurde aktualisiert. Lade die Seite neu, um weiterzumachen.'
              : 'Deine Daten sind sicher gespeichert. Lade die Seite neu oder versuche es noch einmal.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button leadingIcon="refresh" onClick={this.handleReload}>
          Neu laden
          </Button>
          {!isApp && !isUpdate && (
          <Button variant="secondary" onClick={this.handleRetry}>
            Erneut versuchen
          </Button>
          )}
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-w-full overflow-x-auto text-left text-micro text-danger bg-danger-subtle border border-danger rounded-md p-3 whitespace-pre-wrap">
            {String(error?.stack || error)}
          </pre>
        )}
      </div>
    );
  }
}
