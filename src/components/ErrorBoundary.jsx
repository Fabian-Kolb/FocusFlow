import React from 'react';

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
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
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

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
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
        className={`flex flex-col items-center justify-center text-center px-6 py-12 gap-4 ${
          isApp ? 'min-h-[100dvh] bg-surface text-primary' : 'flex-1 min-h-[50vh]'
        }`}
      >
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">
          {isUpdate ? 'system_update' : 'sentiment_dissatisfied'}
        </span>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-lg font-bold text-primary">
            {isUpdate ? 'Neue Version verfügbar' : 'Hier ist etwas schiefgelaufen'}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {isUpdate
              ? 'FocusFlow wurde aktualisiert. Lade die Seite neu, um weiterzumachen.'
              : 'Deine Daten sind sicher gespeichert. Lade die Seite neu oder versuche es noch einmal.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={this.handleReload}
            className="min-h-[44px] px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Neu laden
          </button>
          {!isApp && !isUpdate && (
            <button
              type="button"
              onClick={this.handleRetry}
              className="min-h-[44px] px-4 py-2.5 border border-outline-variant text-primary rounded-xl text-sm font-semibold hover:bg-surface-low transition-colors cursor-pointer"
            >
              Erneut versuchen
            </button>
          )}
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-w-full overflow-x-auto text-left text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 whitespace-pre-wrap">
            {String(error?.stack || error)}
          </pre>
        )}
      </div>
    );
  }
}
