import React, { useState } from 'react';

import { Icon } from '../../ds';
const WORKFLOWS = [
  {
    icon: 'inbox',
    badge: 'Schritt 1',
    title: 'Inbox Zero & Schnellerfassung',
    desc: 'Halte jeden Gedanken, neue Aufgaben und spontane Ideen sofort in deiner Inbox fest – ohne dir sofort Gedanken über Kategorien oder Deadlines machen zu müssen. Einmal täglich sichtest du die Inbox und verschiebst Elemente in Projekte oder Erinnerungen.'
  },
  {
    icon: 'folder',
    badge: 'Schritt 2',
    title: 'Projekte, Abschnitte & Kanban',
    desc: 'Große Ziele wirken oft überwältigend. Teile deine Projekte in klare Abschnitte (z. B. Konzeption, Entwurf, Umsetzung) ein. Nutze das Kanban Board, um deine aktuellen Aufgaben visuell von „Zu erledigen“ über „In Arbeit“ bis „Fertig“ zu bewegen.'
  },
  {
    icon: 'notifications',
    badge: 'Schritt 3',
    title: 'Smarte Erinnerungen & Fälligkeiten',
    desc: 'Nicht jede Aufgabe gehört in ein Projekt. Für zeitkritische Todos nutzt du Erinnerungen mit Datum, Uhrzeit und Prioritätsstufen. Verknüpfst du Google Kalender, werden Erinnerungen nahtlos in deinen Kalender eingetragen.'
  },
  {
    icon: 'analytics',
    badge: 'Schritt 4',
    title: 'Wöchentlicher Review & Reflexion',
    desc: 'Nimm dir am Ende der Woche 5 Minuten Zeit für den Wochenrückblick. Sieh dir an, wie viele Aufgaben du abgeschlossen hast, reflektiere offene Blocker und starte fokussiert in die neue Woche.'
  }
];

const FAQS = [
  {
    id: 'guest_data',
    q: 'Bleiben meine Daten im Gast-Modus gespeichert?',
    a: 'Ja! Im Gast-Modus werden alle erstellten Projekte, Aufgaben, Erinnerungen und Chatverläufe lokal in deinem Browser gespeichert. Du kannst die Seite jederzeit neu laden oder den schließen. Möchtest du jedoch deine Daten geräteübergreifend synchronisieren, registriere dich einfach mit E-Mail Google.'
  },
  {
    id: 'calendar_sync',
    q: 'Wie funktioniert die Google Kalender Synchronisation?',
    a: 'Sobald du deinen Google Kalender im Reiter „Mein Account“ verbunden hast, kannst Erinnerungen mit Kalender-Sync versehen. Fio kann auf Wunsch Termine direkt anlegen oder deine anstehenden Tagestermine abrufen.'
  },
  {
    id: 'trash_recovery',
    q: 'Was passiert, wenn ich versehentlich ein Projekt oder eine Erinnerung lösche?',
    a: 'Gelöschte Elemente landen zuerst im Papierkorb (zu finden in der linken Sidebar). Von dort kannst du sie jederzeit mit einem Klick vollständig wiederherstellen oder unwiderruflich löschen.'
  },
  {
    id: 'fio_context',
    q: 'Woher weiß Fio, an welchen Aufgaben ich arbeite?',
    a: 'Im Coach-Screen kannst du über das Filter- und Kontext-Menü oben genau auswählen, welche Projekte Erinnerungen Fio als Kontext übergeben werden. Standardmäßig berücksichtigt deine aktuellen Projekte, um dir passgenaue Antworten zu geben.'
  }
];

export default function TutorialsSection() {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (idx) => {
    setOpenFaqIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="space-y-8">
      {/* Workflow Guides */}
      <div className="space-y-4">
        <div>
          <h3 className="font-label text-eyebrow text-secondary uppercase">
            FocusFlow Kern-Workflows
          </h3>
          <p className="text-caption text-secondary mt-1">
            So holst du das Maximum aus FocusFlow für deinen fokussierten Arbeitsalltag heraus.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORKFLOWS.map((wf, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-lg border border-subtle bg-canvas hover:border-control transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-md bg-hover text-primary flex items-center justify-center">
                  <Icon name={wf.icon} size="md" />
                </div>
                <span className="text-micro font-label font-semibold px-2 py-0.5 rounded-md bg-subtle text-secondary border border-subtle">
                  {wf.badge}
                </span>
              </div>
              <h4 className="text-caption-strong sm:text-body mt-1">{wf.title}</h4>
              <p className="text-caption text-secondary leading-relaxed">{wf.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Accordions */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="font-label text-eyebrow text-secondary uppercase">
            Häufig gestellte Fragen (FAQ)
          </h3>
          <p className="text-caption text-secondary mt-1">
            Wichtige Antworten zu Funktionen, Speicherorten und Synchronisation.
          </p>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={faq.id}
                className="border border-subtle rounded-lg overflow-hidden bg-canvas transition-colors"
              >
                <button
                  type="button"
                  id={`faq-btn-${idx}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-caption-strong sm:text-body hover:bg-hover transition-colors cursor-pointer"
                >
                  <span className="flex-1">{faq.q}</span>
                  <Icon name="expand_more" size="md" className={`text-secondary transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* Content only accessible when expanded */}
                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                    className="px-3.5 pb-3.5 pt-1 text-caption text-secondary leading-relaxed border-t border-subtle"
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
