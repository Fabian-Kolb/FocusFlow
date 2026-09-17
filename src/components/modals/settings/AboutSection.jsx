import React from 'react';

export default function AboutSection() {
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '2026';
  const envMode = import.meta?.env?.MODE || 'production';

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-variant/20 border border-border">
        <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-black text-xl tracking-tight shadow-sm shrink-0">
          FF
        </div>
        <div>
          <h3 className="text-base font-bold text-on-surface">FocusFlow</h3>
          <p className="text-xs text-on-surface-variant">
            Dein intelligenter Begleiter für strukturierte Projekte, smarte Aufgaben und fokussierte Routinen.
          </p>
        </div>
      </div>

      {/* Build & Version Information */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          System- & Versionsinformationen
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-border bg-surface">
            <span className="text-[11px] text-on-surface-variant block">Version</span>
            <span className="text-sm font-mono font-bold text-on-surface">v{appVersion}</span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-surface">
            <span className="text-[11px] text-on-surface-variant block">Build-Datum</span>
            <span className="text-sm font-mono font-bold text-on-surface">{buildDate}</span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-surface col-span-2 sm:col-span-1">
            <span className="text-[11px] text-on-surface-variant block">Umgebung</span>
            <span className="text-sm font-mono font-bold text-primary uppercase">{envMode}</span>
          </div>
        </div>
      </div>

      {/* Architecture, Privacy & Cloud Transparency */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Datenschutz & Datenfluss
        </h4>
        <div className="p-4 rounded-xl border border-border bg-surface-variant/15 space-y-2.5 text-xs text-on-surface-variant leading-relaxed">
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
        <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Feedback & Kontakt
        </h4>
        <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Hast du Wünsche, Vorschläge oder ein Problem gefunden? Wir freuen uns über jedes Feedback!
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="mailto:support@focusflow.app?subject=FocusFlow%20Feedback"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              E-Mail an Support
            </a>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 leading-relaxed">
            ⚠️ <strong>Sicherheitshinweis:</strong> Bitte sende niemals Passwörter, private Zugangsdaten oder vertrauliche Kalenderinhalte per E-Mail oder in öffentlichen Feedback-Foren.
          </div>
        </div>
      </div>
    </div>
  );
}
