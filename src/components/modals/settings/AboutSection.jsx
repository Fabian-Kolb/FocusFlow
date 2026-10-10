import React from 'react';
import { Alert, Button, Card, IconTile, SectionHeader } from '../../ds';

function InfoTile({ label, value, className = '' }) {
  return (
    <div className={`rounded-lg border border-subtle bg-subtle p-3 ${className}`}>
      <span className="block text-caption text-secondary">{label}</span>
      <span className="block text-body-strong text-primary">{value}</span>
    </div>
  );
}

export default function AboutSection() {
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '2026';
  const envMode = import.meta?.env?.MODE || 'production';

  return (
    <div className="space-y-6">
      <Card variant="filled" padding="md" className="flex items-center gap-4">
        <IconTile area="neutral" icon="center_focus_strong" size="lg" />
        <div className="min-w-0">
          <h3 className="text-subheading text-primary">FocusFlow</h3>
          <p className="text-caption text-secondary">
            Dein Begleiter für strukturierte Projekte, klare Aufgaben und fokussierte Routinen.
          </p>
        </div>
      </Card>

      <section className="space-y-3">
        <SectionHeader title="System und Version" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <InfoTile label="Version" value={`v${appVersion}`} />
          <InfoTile label="Build-Datum" value={buildDate} />
          <InfoTile label="Umgebung" value={envMode} className="col-span-2 sm:col-span-1" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Datenschutz und Datenfluss" />
        <Card variant="filled" padding="md" className="space-y-3 text-caption text-secondary">
          <p>
            <strong className="text-primary">Gast-Modus:</strong> Deine Daten bleiben ausschließlich lokal im Speicher deines Browsers (LocalStorage). Es findet keine Cloud-Synchronisation statt.
          </p>
          <p>
            <strong className="text-primary">Registrierte Konten:</strong> Deine Projekte, Notizen und Erinnerungen werden in Google Cloud Firestore gespeichert und sind nur über dein angemeldetes Nutzerkonto abrufbar.
          </p>
          <p>
            <strong className="text-primary">KI-Agent Fio:</strong> Anfragen an Fio laufen über einen abgesicherten Server-Proxy zur Google Gemini API. Gesendet wird nur, was du im Coach-Kontext aktiv auswählst.
          </p>
          <p>
            <strong className="text-primary">Google Kalender:</strong> Nur Termine, bei denen du die Kalendersynchronisation aktivierst, werden über die offizielle Google Calendar API abgeglichen.
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Feedback und Kontakt" />
        <Card variant="outlined" padding="md" className="space-y-4">
          <p className="text-body text-secondary">
            Hast du Wünsche, Vorschläge oder ein Problem gefunden? Wir freuen uns über jedes Feedback.
          </p>
          <Button
            variant="secondary"
            leadingIcon="mail"
            onClick={() => { window.location.href = 'mailto:support@focusflow.app?subject=FocusFlow%20Feedback'; }}
          >
            E-Mail an den Support
          </Button>
          <Alert tone="warning" title="Sicherheitshinweis">
            Sende niemals Passwörter, private Zugangsdaten oder vertrauliche Kalenderinhalte per E-Mail oder in öffentlichen Feedback-Foren.
          </Alert>
        </Card>
      </section>
    </div>
  );
}
