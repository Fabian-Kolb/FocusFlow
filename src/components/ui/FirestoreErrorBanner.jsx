import React, { useState } from 'react';
import { Alert, Button } from '../ds';

export default function FirestoreErrorBanner({ error, onDismiss }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  const isPermissionDenied = error.code === 'permission-denied';

  return (
    <Alert
      tone="warning"
      icon="warning"
      className="mb-6"
      title={isPermissionDenied
        ? 'Zugriff auf die Datenbank verweigert'
        : `Datenbankfehler (${error.code || 'unbekannt'})`}
      onDismiss={onDismiss}
      action={isPermissionDenied && (
        <Button variant="secondary" size="sm" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Technische Details verbergen' : 'Technische Details anzeigen'}
        </Button>
      )}
    >
      {isPermissionDenied ? (
        <>
          <strong className="text-primary">Deine Daten sind nicht gelöscht.</strong> Alle Projekte, Erinnerungen und Notizen liegen sicher in Firestore. Die Sicherheitsregeln verweigern aktuell den Lesezugriff, weil dein Account per E-Mail und Passwort angemeldet ist und die E-Mail noch nicht als verifiziert markiert ist (<code className="font-code">emailVerified = false</code>).
          <span className="mt-2 block">
            <strong className="text-primary">Schnelle Lösung:</strong> Melde dich ab und wähle „Mit Google anmelden“. Dein Google-Konto ist mit derselben Nutzer-ID verknüpft.
          </span>
        </>
      ) : (
        <>Beim Laden der Kollektion <code className="font-code">{error.collection}</code> ist ein Fehler aufgetreten: {error.message}</>
      )}

      {showDetails && (
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-subtle p-2 font-code text-micro text-secondary">
          {JSON.stringify(error, null, 2)}
        </pre>
      )}
    </Alert>
  );
}
