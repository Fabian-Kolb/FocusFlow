import React, { useState } from 'react';

export default function FirestoreErrorBanner({ error, onDismiss }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  const isPermissionDenied = error.code === 'permission-denied';

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 shadow-sm transition-all"
    >
      <div className="flex items-start gap-3.5">
        <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5">
          warning
        </span>
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-amber-950">
              {isPermissionDenied
                ? 'Firestore-Zugriff verweigert (Permission Denied)'
                : `Firestore-Fehler (${error.code || 'Unbekannt'})`}
            </h3>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-amber-700 hover:text-amber-950 underline cursor-pointer p-1"
                aria-label="Hinweis schließen"
              >
                Schließen
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm text-amber-900 mt-1.5 leading-relaxed">
            {isPermissionDenied ? (
              <>
                <strong>Wichtig:</strong> Deine Daten sind <strong>nicht gelöscht</strong> – alle Projekte, Erinnerungen und Notizen liegen sicher in Firestore! Die Sicherheitsregeln verweigern jedoch aktuell den Lesezugriff, weil dein Account per E-Mail/Passwort angemeldet ist und die E-Mail noch nicht als verifiziert markiert ist (<code>emailVerified = false</code>).
              </>
            ) : (
              <>Beim Laden der Kollektion <code>{error.collection}</code> ist ein Fehler aufgetreten: {error.message}</>
            )}
          </p>

          {isPermissionDenied && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-100/70 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 flex-wrap">
              <span>
                💡 <strong>Schnelle Lösung:</strong> Melde dich ab und wähle <strong>&quot;Mit Google anmelden&quot;</strong>. Dein Google-Konto ist mit derselben UID verknüpft und wird durch den Provider direkt autorisiert.
              </span>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                {showDetails ? 'Technische Details verbergen' : 'Technische Details anzeigen'}
              </button>
            </div>
          )}

          {showDetails && (
            <pre className="mt-2.5 p-2 rounded-lg bg-black/5 text-[11px] font-mono text-amber-950 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(error, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
