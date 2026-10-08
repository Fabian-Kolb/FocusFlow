import React, { useEffect } from 'react';
import { LEGAL_OPERATOR, LEGAL_LAST_UPDATED, LEGAL_PATHS, hasLegalPlaceholders } from '../../lib/legal';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      <div className="space-y-2 text-sm text-on-surface-variant leading-relaxed">{children}</div>
    </section>
  );
}

function OperatorAddress() {
  const op = LEGAL_OPERATOR;
  return (
    <p>
      {op.name}<br />
      {op.street}<br />
      {op.city}<br />
      {op.country}<br />
      E-Mail: {op.email}
      {op.phone && (<><br />Telefon: {op.phone}</>)}
    </p>
  );
}

function Impressum() {
  return (
    <>
      <Section title="Angaben gemäß § 5 DDG">
        <OperatorAddress />
      </Section>
      <Section title="Verantwortlich für den Inhalt">
        <p>{LEGAL_OPERATOR.name}, Anschrift wie oben.</p>
      </Section>
      <Section title="Haftung für Inhalte und Links">
        <p>
          Die Inhalte dieser Anwendung wurden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität
          kann jedoch keine Gewähr übernommen werden. Für Inhalte externer Links sind ausschließlich deren Betreiber verantwortlich.
        </p>
        <p>
          Antworten des KI-Assistenten Fio werden automatisch erzeugt und können fehlerhaft sein.
        </p>
      </Section>
      <Section title="Verbraucherstreitbeilegung">
        <p>
          Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Section>
    </>
  );
}

function Datenschutz() {
  return (
    <>
      <Section title="1. Verantwortlicher">
        <OperatorAddress />
      </Section>

      <Section title="2. Überblick">
        <p>
          FocusFlow ist eine Web-App zur Organisation von Projekten, Erinnerungen und Gedanken. Es werden nur die Daten verarbeitet,
          die für den Betrieb der App nötig sind. Es gibt kein Tracking, keine Werbung und keine Analyse-Tools.
        </p>
      </Section>

      <Section title="3. Hosting und Server-Logs">
        <p>
          Die App wird über Firebase Hosting (Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland) und Vercel
          (Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA) bereitgestellt. Beim Aufruf werden technisch notwendige
          Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browser-Kennung verarbeitet, um die App auszuliefern und
          Missbrauch abzuwehren. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </Section>

      <Section title="4. Konto und Anmeldung">
        <p>
          Für die Anmeldung nutzt FocusFlow Firebase Authentication (Google). Verarbeitet werden E-Mail-Adresse, ein Passwort-Hash
          bzw. bei „Mit Google anmelden“ Name, E-Mail-Adresse und Profilbild deines Google-Kontos sowie eine Nutzer-ID.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Dienstes).
        </p>
      </Section>

      <Section title="5. Deine Inhalte">
        <p>
          Projekte, Erinnerungen, Notizen, Gedanken, Kategorien und Chatverläufe werden in Google Cloud Firestore gespeichert und
          sind nur über dein Konto abrufbar. Im Gast-Modus bleiben alle Daten ausschließlich im Speicher deines Browsers.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
        </p>
      </Section>

      <Section title="6. KI-Assistent Fio (Google Gemini)">
        <p>
          Wenn du Fio nutzt oder Inhalte per KI zusammenfassen bzw. strukturieren lässt, werden deine Eingabe und der dafür
          ausgewählte Kontext (z. B. Projekte oder Notizen) über einen Server von FocusFlow an die Google Gemini API übermittelt
          und die Antwort zurückgegeben. Die Übermittlung erfolgt nur, wenn du eine KI-Funktion aktiv nutzt.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Gib in KI-Anfragen bitte keine besonders sensiblen Daten ein.
        </p>
      </Section>

      <Section title="7. Google Kalender (optional)">
        <p>
          Verbindest du deinen Google Kalender, speichert FocusFlow ein Zugriffs-Token serverseitig, um Termine zu lesen und
          von dir freigegebene Termine anzulegen, zu ändern oder zu löschen. Die Verbindung kannst du jederzeit in den
          Einstellungen trennen. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
        </p>
      </Section>

      <Section title="8. Schriftarten und Symbole">
        <p>
          Schriftarten und Symbole werden von Google Fonts (Google Ireland Ltd.) geladen. Dabei wird deine IP-Adresse an Google
          übertragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (einheitliche Darstellung).
        </p>
      </Section>

      <Section title="9. Lokaler Speicher im Browser">
        <p>
          FocusFlow speichert Einstellungen wie Ansichten, Sortierung und den Anmeldestatus im lokalen Speicher deines Browsers.
          Das ist für die Funktion der App unbedingt erforderlich (§ 25 Abs. 2 TDDDG). Cookies zu Werbe- oder Analysezwecken
          werden nicht verwendet.
        </p>
      </Section>

      <Section title="10. Übermittlung in Drittländer">
        <p>
          Google und Vercel können Daten auch in den USA verarbeiten. Beide sind unter dem EU-US Data Privacy Framework
          zertifiziert; ergänzend gelten Standardvertragsklauseln der EU-Kommission.
        </p>
      </Section>

      <Section title="11. Speicherdauer und Löschung">
        <p>
          Deine Daten werden gespeichert, solange dein Konto besteht. Gelöschte Inhalte liegen bis zu 30 Tage im Papierkorb.
          Unter Einstellungen → Mein Account → „Konto löschen“ kannst du dein Konto und alle Inhalte jederzeit selbst
          endgültig löschen.
        </p>
      </Section>

      <Section title="12. Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung
          (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Eine erteilte Einwilligung kannst du
          jederzeit widerrufen. Wende dich dazu an die oben genannte E-Mail-Adresse.
        </p>
        <p>
          Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa bei der Behörde deines Wohnorts.
        </p>
      </Section>
    </>
  );
}

const PAGES = {
  impressum: { title: 'Impressum', Component: Impressum, other: 'datenschutz', otherLabel: 'Datenschutz' },
  datenschutz: { title: 'Datenschutzerklärung', Component: Datenschutz, other: 'impressum', otherLabel: 'Impressum' }
};

export default function LegalPage({ page }) {
  const config = PAGES[page] || PAGES.impressum;
  const { Component } = config;

  useEffect(() => {
    document.title = `${config.title} | FocusFlow`;
  }, [config.title]);

  return (
    <div className="min-h-[100dvh] bg-surface text-primary antialiased font-sans">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] space-y-6">
        <a
          href="/"
          className="inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Zurück zu FocusFlow
        </a>

        <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>

        {hasLegalPlaceholders() && (
          <div role="note" className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-500 leading-relaxed">
            Entwurf: Die Angaben zum Betreiber sind noch nicht ausgefüllt (<code>src/lib/legal.js</code>).
          </div>
        )}

        <div className="space-y-6">
          <Component />
        </div>

        <footer className="pt-4 border-t border-outline-variant flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span>Stand: {LEGAL_LAST_UPDATED}</span>
          <a href={LEGAL_PATHS[config.other]} className="underline hover:text-primary">
            {config.otherLabel}
          </a>
        </footer>
      </div>
    </div>
  );
}
