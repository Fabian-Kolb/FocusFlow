import React, { useState } from 'react';
import { Alert, Button, Card, Icon, IconTile, SectionHeader } from '../../ds';

// Bewährte Prompt-Vorlagen
const PROMPT_TEMPLATES = [
  {
    id: 'plan_project',
    title: 'Neues Projekt strukturiert planen',
    desc: 'Erstellt ein komplettes Projekt inklusive sinnvoller Phasen und erster Aufgaben.',
    prompt: 'Erstelle bitte ein neues Projekt namens „Website Relaunch“ mit den drei Abschnitten: Konzeption, Design und Entwicklung. Füge in jeden Abschnitt passende Start-Aufgaben ein.'
  },
  {
    id: 'add_task',
    title: 'Aufgabe zu bestehendem Projekt hinzufügen',
    desc: 'Hängt eine neue Aufgabe gezielt an das passende Projekt an.',
    prompt: 'Füge bitte zum Projekt „Website Relaunch“ im Abschnitt „Design“ die Aufgabe „Farbpalette und Typografie festlegen“ mit Fälligkeit nächste Woche hinzu.'
  },
  {
    id: 'toggle_task',
    title: 'Erledigte Aufgabe abhaken',
    desc: 'Markiert Aufgaben als erledigt und aktualisiert den Projektfortschritt.',
    prompt: 'Ich habe die Aufgabe „Farbpalette festlegen“ fertiggestellt. Bitte hake sie als erledigt ab!'
  },
  {
    id: 'calendar_event',
    title: 'Termin oder Erinnerung planen',
    desc: 'Fio fragt dich, ob der Termin nur lokal oder im Google Kalender synchronisiert werden soll.',
    prompt: 'Erinnere mich bitte am kommenden Montag um 10:00 Uhr an das „Team-Kickoff“.'
  },
  {
    id: 'create_note',
    title: 'Projektnotiz oder Meeting-Zusammenfassung',
    desc: 'Hängt ein Notizprotokoll direkt an ein Projekt oder eine Erinnerung.',
    prompt: 'Erstelle bitte eine Notiz zum Projekt „Website Relaunch“ mit dem Titel „Ergebnisse Kickoff-Meeting“ und halte fest, dass wir auf Mobile-First setzen.'
  },
  {
    id: 'weekly_review',
    title: 'Fokus und Wochenreflexion',
    desc: 'Analysiert deine offenen Baustellen und gibt dir eine klare Prioritätenempfehlung.',
    prompt: 'Schau dir bitte meine aktuellen Projekte und Erinnerungen an. Was sind meine wichtigsten 3 Prioritäten für diese Woche und wo gibt es Überfälligkeiten?'
  }
];

// Fähigkeiten, abgebildet auf die echten aiActionEngine-Aktionen
const CAPABILITIES = [
  {
    icon: 'folder_open',
    title: 'Projekte und Abschnitte anlegen',
    desc: 'Fio kann komplette Projekte anlegen und neue Etappen (Abschnitte) zu bestehenden Projekten hinzufügen.',
    actionType: 'CREATE_PROJECT / ADD_PHASE',
    params: 'Titel, Beschreibung, Zeitplan, Phasen und Aufgaben'
  },
  {
    icon: 'add_task',
    title: 'Aufgaben anlegen und terminieren',
    desc: 'Füge neue Aufgaben gezielt zu Projekten oder spezifischen Abschnitten hinzu – inklusive Fälligkeitsdatum und Notizen.',
    actionType: 'ADD_TASK',
    params: 'Projekt-ID, Abschnitt-ID, Titel, Datum, Notiz'
  },
  {
    icon: 'check_circle',
    title: 'Aufgaben als erledigt abhaken',
    desc: 'Wenn du eine Aufgabe erledigt hast, hakt Fio sie ab und berechnet den Fortschrittsbalken deines Projekts neu.',
    actionType: 'TOGGLE_TASK',
    params: 'Projekt-ID, Task-ID / Task-Titel'
  },
  {
    icon: 'notifications_active',
    title: 'Smarte Erinnerungen erstellen',
    desc: 'Erstelle Erinnerungen mit Uhrzeit und Priorität. Auf Wunsch synchronisiert mit Google Kalender.',
    actionType: 'CREATE_REMINDER',
    params: 'Titel, Datum, Uhrzeit, Priorität, Kalender-Sync'
  },
  {
    icon: 'calendar_month',
    title: 'Termine im Google Kalender eintragen',
    desc: 'Fio kann Kalendertermine direkt in deinen verknüpften Google Kalender schreiben (nach deiner Bestätigung).',
    actionType: 'CREATE_CALENDAR_EVENT',
    params: 'Titel, Datum, Startzeit, Endzeit'
  },
  {
    icon: 'note_add',
    title: 'Notizen und Recherchen verknüpfen',
    desc: 'Lass Fio strukturierte Protokolle, Checklisten oder Notizen an Projekte und Erinnerungen heften.',
    actionType: 'CREATE_NOTE',
    params: 'Zieltyp (Projekt/Erinnerung), Titel, HTML-Inhalt'
  },
  {
    icon: 'attach_file',
    title: 'Materialien und Links ablegen',
    desc: 'Verlinke Dokumente, Figma-Dateien oder Links direkt mit der relevanten Etappe eines Projekts.',
    actionType: 'ADD_MATERIAL',
    params: 'Projekt-ID, Phase-ID, Name, URL, Typ'
  },
  {
    icon: 'tune',
    title: 'Details und Status aktualisieren',
    desc: 'Ändere Projektzeiträume, Beschreibungen oder verschiebe Projekte auf Aktiv, Geplant oder Abgeschlossen.',
    actionType: 'UPDATE_PROJECT / SET_PROJECT_STATUS',
    params: 'Projekt-/Reminder-ID, Statuswerte'
  }
];

export default function FioGuideSection({ onSelectPrompt }) {
  const [copiedId, setCopiedId] = useState(null);
  const [copyError, setCopyError] = useState(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const handleCopyPrompt = async (id, promptText) => {
    setCopyError(null);

    let success = false;
    // 1. Try modern clipboard API if available
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(promptText);
        success = true;
      } catch (err) {
        console.warn('Clipboard writeText failed, falling back:', err);
      }
    }

    // 2. Fallback to execCommand if clipboard writeText was not available or failed
    if (!success && typeof document !== 'undefined' && typeof document.execCommand === 'function') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = promptText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('execCommand copy failed:', err);
      }
    }

    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } else {
      setCopyError('Kopieren nicht erlaubt. Bitte markiere den Text manuell.');
      setTimeout(() => setCopyError(null), 4000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Screenreader Live Region */}
      <div aria-live="polite" className="sr-only">
        {copiedId ? 'Prompt erfolgreich in die Zwischenablage kopiert.' : ''}
        {copyError || ''}
      </div>

      <Card variant="filled" padding="md" className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <IconTile area="coach" size="lg" />
      <div className="min-w-0">
        <h3 className="text-subheading text-primary">Fio ist mehr als ein Chatbot</h3>
        <p className="mt-0.5 text-body text-secondary">
          Fio versteht deine Projekte und Aufgaben und führt echte Aktionen direkt in FocusFlow aus. Du sagst, was du brauchst – Fio erledigt die Fleißarbeit.
        </p>
      </div>
      </Card>

      {/* Safety & Confirmation Principle */}
      <Alert tone="info" icon="verified_user" title="Sicherheit und Bestätigung">
      <strong className="text-primary">Transparenz zuerst:</strong> Jede Änderung von Fio erscheint im Chat als Karte und wird im Projekt-Verlauf protokolliert. Bei Kalendereinträgen fragt Fio vorab, ob der Termin nur lokal oder im Google Kalender angelegt werden soll. Fio löscht keine Daten selbstständig.
      </Alert>

      {/* Copy Error Notice */}
      {copyError && (
        <Alert tone="danger">{copyError}</Alert>
      )}

      {/* Prompt Templates */}
      <div className="space-y-3">
        <SectionHeader title="Prompt-Vorlagen" action={<span className="text-caption text-tertiary">Mit einem Klick kopieren</span>} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMPT_TEMPLATES.map((tpl) => {
            const isCopied = copiedId === tpl.id;
            return (
              <Card key={tpl.id} variant="outlined" padding="md" className="flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <h4 className="text-body-strong text-primary">{tpl.title}</h4>
                <p className="text-caption text-secondary">{tpl.desc}</p>
                <p className="rounded-md border border-subtle bg-subtle p-2.5 text-caption text-primary">
                  „{tpl.prompt}“
                </p>
              </div>
              <div className="flex items-center justify-end border-t border-subtle pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={isCopied ? 'check' : 'content_copy'}
                  onClick={() => handleCopyPrompt(tpl.id, tpl.prompt)}
                  title="Prompt in Zwischenablage kopieren"
                  className={isCopied ? '!border-success !text-success' : ''}
                >
                  {isCopied ? 'Kopiert' : 'Kopieren'}
                </Button>
              </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Capability Matrix */}
      <div className="space-y-3 pt-2">
        <SectionHeader
        title="Fähigkeiten im Überblick"
        action={(
          <Button variant="ghost" size="sm" leadingIcon={showTechDetails ? 'visibility_off' : 'code'} onClick={() => setShowTechDetails(!showTechDetails)}>
            {showTechDetails ? 'Details ausblenden' : 'Technische Details'}
          </Button>
        )}
        />

        <div className="space-y-2">
          {CAPABILITIES.map((cap, idx) => (
            <div key={cap.actionType} className="flex items-start gap-3 rounded-lg border border-subtle bg-subtle p-3">
            <Icon name={cap.icon} size="md" className="mt-0.5 shrink-0 text-secondary" />
            <div className="min-w-0 flex-1">
              <p className="text-body-strong text-primary">{cap.title}</p>
              <p className="mt-0.5 text-caption text-secondary">{cap.desc}</p>
              {showTechDetails && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-subtle pt-2 font-code text-micro text-secondary">
                  <span><strong className="text-primary">Action:</strong> {cap.actionType}</span>
                  <span><strong className="text-primary">Parameter:</strong> {cap.params}</span>
                </div>
              )}
            </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
