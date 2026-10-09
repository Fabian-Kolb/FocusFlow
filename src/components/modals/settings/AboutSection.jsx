import React from 'react';

import { Icon } from '../../ds';
export default function AboutSection() {
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '2026';
  const envMode = import.meta?.env?.MODE || 'production';

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-subtle border border-subtle">
        <div className="w-12 h-12 rounded-lg bg-accent text-on-accent flex items-center justify-center text-heading tracking-tight shadow-sm shrink-0">
          FF
        </div>
        <div>
          <h3 className="text-subheading">FocusFlow</h3>
          <p className="text-caption text-secondary">
            Dein intelligenter Begleiter für strukturierte Projekte, smarte Aufgaben und fokussierte Routinen.
          </p>
        </div>
      </div>

      {/* Build & Version Information */}
      <div className="space-y-3">
        <h4 className="font-label text-eyebrow text-secondary uppercase">
          System- & Versionsinformationen
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-subtle bg-canvas">
            <span className="text-micro text-secondary block">Version</span>
            <span className="text-body-strong font-label">v{appVersion}</span>
          </div>
          <div className="p-3 rounded-lg border border-subtle bg-canvas">
            <span className="text-micro text-secondary block">Build-Datum</span>
            <span className="text-body-strong font-label">{buildDate}</span>
          </div>
          <div className="p-3 rounded-lg border border-subtle bg-canvas col-span-2 sm:col-span-1">
            <span className="text-micro text-secondary block">Umgebung</span>
            <span className="font-label text-eyebrow text-primary uppercase">{envMode}</span>
          </div>
        </div>
      </div>

      {/* Architecture, Privacy & Cloud Transparency */}
      <div className="space-y-3">
        <h4 className="font-label text-eyebrow text-secondary uppercase">
          Datenschutz & Datenfluss
        </h4>
        <div className="p-4 rounded-lg border border-subtle bg-subtle space-y-2.5 text-caption text-secondary leading-relaxed">
          <p>
            <strong>Gast-Modus:</strong> Deine Daten verbleiben ausschließlich lokal im Speicher deines Webbrowsers (LocalStorage). Es findet keine Cloud-Synchronisation statt.
          </p>
          <p>
            <strong>Registrierte Konten:</strong> Deine Projekte, Notizen und Erinnerungen werden verschlüsselt in Google Cloud Firestore gespeichert und sind nur über dein authentifiziertes Nutzerkonto abrufbar.
          </p>
          <p>
            <strong>KI-Agent Fio:</strong> Anfragen an Fio werden über einen abgesicherten Server-Proxy an die Google Gemini API übertragen. Es werden ausschließlich die Daten mitgesendet, die du im Coach-Kontext aktiv auswählst.
          </p>
          <p>
            <strong>Google Kalender:</strong> Nur Termine, bei denen du explizit eine Kalendersynchronisation aktivierst, werden über die offizielle Google Calendar API synchronisiert.
          </p>
        </div>
      </div>

      {/* Feedback & Support */}
      <div className="space-y-3 pt-2">
        <h4 className="font-label text-eyebrow text-secondary uppercase">
          Feedback & Kontakt
        </h4>
        <div className="p-4 rounded-lg border border-subtle bg-canvas space-y-3">
          <p className="text-caption text-secondary leading-relaxed">
            Hast du Wünsche, Vorschläge oder ein Problem gefunden? Wir freuen uns über jedes Feedback!
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="mailto:support@focusflow.app?subject=FocusFlow%20Feedback"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-on-accent text-caption-strong hover:bg-accent-hover transition-colors"
            >
              <Icon name="mail" size="sm" />
              E-Mail an Support
            </a>
          </div>
          <div className="p-3 rounded-md bg-warning-subtle border border-warning text-micro text-warning leading-relaxed">
            ⚠️ <strong>Sicherheitshinweis:</strong> Bitte sende niemals Passwörter, private Zugangsdaten oder vertrauliche Kalenderinhalte per E-Mail oder in öffentlichen Feedback-Foren.
          </div>
        </div>
      </div>
    </div>
  );
}
