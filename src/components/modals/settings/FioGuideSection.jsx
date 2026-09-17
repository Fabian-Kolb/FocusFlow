import React, { useState } from 'react';
import FioIcon from '../../ui/FioIcon';

// High impact, user-tested prompts
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
    title: 'Fokus & Wochenreflexion',
    desc: 'Analysiert deine offenen Baustellen und gibt dir eine klare Prioritätenempfehlung.',
    prompt: 'Schau dir bitte meine aktuellen Projekte und Erinnerungen an. Was sind meine wichtigsten 3 Prioritäten für diese Woche und wo gibt es Überfälligkeiten?'
  }
];

// Validated capabilities mapped to real aiActionEngine actions
const CAPABILITIES = [
  {
    icon: 'folder_open',
    title: 'Projekte & Abschnitte initialisieren',
    desc: 'Fio kann komplette Projekte anlegen und neue Etappen (Abschnitte) zu bestehenden Projekten hinzufügen.',
    actionType: 'CREATE_PROJECT / ADD_PHASE',
    params: 'Titel, Beschreibung, Zeitplan, Phasen & Aufgaben'
  },
  {
    icon: 'add_task',
    title: 'Aufgaben anlegen & terminieren',
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
    title: 'Google Kalender Termine eintragen',
    desc: 'Fio kann Kalendertermine direkt in deinen verknüpften Google Kalender schreiben (nach deiner Bestätigung).',
    actionType: 'CREATE_CALENDAR_EVENT',
    params: 'Titel, Datum, Startzeit, Endzeit'
  },
  {
    icon: 'note_add',
    title: 'Notizen & Recherchen verknüpfen',
    desc: 'Lass Fio strukturierte Protokolle, Checklisten oder Notizen an Projekte und Erinnerungen heften.',
    actionType: 'CREATE_NOTE',
    params: 'Zieltyp (Projekt/Erinnerung), Titel, HTML-Inhalt'
  },
  {
    icon: 'attach_file',
    title: 'Materialien & Links ablegen',
    desc: 'Verlinke Dokumente, Figma-Dateien oder Links direkt mit der relevanten Etappe eines Projekts.',
    actionType: 'ADD_MATERIAL',
    params: 'Projekt-ID, Phase-ID, Name, URL, Typ'
  },
  {
    icon: 'tune',
    title: 'Details & Status aktualisieren',
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

      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center p-2.5 shadow-sm shrink-0">
          <FioIcon className="w-full h-full text-white" color="currentColor" />
        </div>
        <div>
          <h3 className="text-base font-bold text-on-surface">Fio ist mehr als nur ein Chatbot</h3>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
            Fio versteht deine Projekte und Aufgaben und kann echte Aktionen direkt in deiner FocusFlow-App ausführen. Du sagst einfach, was du brauchst – Fio erledigt die Fleißarbeit.
          </p>
        </div>
      </div>

      {/* Safety & Confirmation Principle */}
      <div className="p-4 rounded-xl bg-surface-variant/20 border border-border space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          Sicherheit & Bestätigung
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          <strong>Transparenz zuerst:</strong> Jede von Fio durchgeführte Änderung wird im Chat mit einer interaktiven Karte visualisiert und im Projekt-Verlauf protokolliert. Bei Kalendereinträgen fragt Fio dich vorab, ob der Termin nur lokal oder im Google Kalender synchronisiert werden soll. Fio löscht keine Daten selbstständig.
        </p>
      </div>

      {/* Copy Error Notice */}
      {copyError && (
        <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {copyError}
        </div>
      )}

      {/* Prompt Templates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Inspirierende Prompt-Vorlagen
          </h3>
          <span className="text-[11px] text-on-surface-variant">1-Klick kopieren</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMPT_TEMPLATES.map((tpl) => {
            const isCopied = copiedId === tpl.id;
            return (
              <div 
                key={tpl.id}
                className="p-3.5 rounded-xl border border-border bg-surface hover:border-primary/40 transition-all flex flex-col justify-between gap-3 shadow-xs hover:shadow-sm"
              >
                <div>
                  <h4 className="text-xs font-bold text-on-surface">{tpl.title}</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{tpl.desc}</p>
                  <p className="text-xs font-mono bg-surface-variant/30 text-on-surface border border-border/50 rounded-lg p-2 mt-2 leading-relaxed italic">
                    „{tpl.prompt}“
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(tpl.id, tpl.prompt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCopied 
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' 
                        : 'bg-surface-variant hover:bg-surface-variant/80 text-on-surface border border-border'
                    }`}
                    title="Prompt in Zwischenablage kopieren"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isCopied ? 'check' : 'content_copy'}
                    </span>
                    {isCopied ? 'Kopiert!' : 'Kopieren'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Capability Matrix */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Fähigkeiten im Überblick
          </h3>
          <button
            type="button"
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="text-[11px] text-primary hover:underline cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              {showTechDetails ? 'visibility_off' : 'code'}
            </span>
            {showTechDetails ? 'Details ausblenden' : 'Technische Details'}
          </button>
        </div>

        <div className="space-y-2">
          {CAPABILITIES.map((cap, idx) => (
            <div 
              key={idx}
              className="p-3 rounded-xl border border-border bg-surface-variant/15 flex items-start gap-3"
            >
              <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">
                {cap.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-on-surface">{cap.title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{cap.desc}</p>
                {showTechDetails && (
                  <div className="mt-2 pt-2 border-t border-border/40 text-[10px] font-mono text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong className="text-primary">Action:</strong> {cap.actionType}</span>
                    <span><strong className="text-on-surface">Parameter:</strong> {cap.params}</span>
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
