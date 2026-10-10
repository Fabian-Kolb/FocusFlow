import React, { useState } from 'react';
import { Badge, Card, FOCUS, Icon, IconTile, SectionHeader, cx } from '../../ds';

const WORKFLOWS = [
  {
    icon: 'lightbulb',
    badge: 'Schritt 1',
    title: 'Gedanken sofort festhalten',
    desc: 'Halte jeden Gedanken, neue Aufgaben und spontane Ideen sofort bei den Gedanken fest – ohne dir gleich Gedanken über Kategorien oder Deadlines zu machen. Einmal täglich sichtest du alles und verschiebst Einträge in Projekte oder Erinnerungen.'
  },
  {
    icon: 'folder',
    badge: 'Schritt 2',
    title: 'Projekte, Abschnitte und Kanban',
    desc: 'Große Ziele wirken oft überwältigend. Teile deine Projekte in klare Abschnitte (z. B. Konzeption, Entwurf, Umsetzung). Im Kanban-Board schiebst du Projekte von „Geplant“ über „Aktiv“ bis „Abgeschlossen“.'
  },
  {
    icon: 'notifications',
    badge: 'Schritt 3',
    title: 'Erinnerungen und Fälligkeiten',
    desc: 'Nicht jede Aufgabe gehört in ein Projekt. Für zeitkritische Todos nutzt du Erinnerungen mit Datum, Uhrzeit und Priorität. Verknüpfst du den Google Kalender, landen sie direkt in deinem Kalender.'
  },
  {
    icon: 'insights',
    badge: 'Schritt 4',
    title: 'Wöchentlicher Rückblick',
    desc: 'Nimm dir am Ende der Woche 5 Minuten Zeit. Sieh dir an, wie viele Aufgaben du abgeschlossen hast, finde offene Blocker und starte fokussiert in die neue Woche.'
  }
];

const FAQS = [
  {
    id: 'guest_data',
    q: 'Bleiben meine Daten im Gast-Modus gespeichert?',
    a: 'Ja. Im Gast-Modus werden alle Projekte, Aufgaben, Erinnerungen und Chatverläufe lokal in deinem Browser gespeichert. Du kannst die Seite jederzeit neu laden oder schließen. Möchtest du deine Daten geräteübergreifend synchronisieren, registriere dich mit E-Mail oder Google.'
  },
  {
    id: 'calendar_sync',
    q: 'Wie funktioniert die Google-Kalender-Synchronisation?',
    a: 'Sobald du deinen Google Kalender unter „Mein Account“ verbunden hast, kannst du Erinnerungen mit Kalender-Sync versehen. Fio legt auf Wunsch Termine direkt an oder ruft deine anstehenden Tagestermine ab.'
  },
  {
    id: 'trash_recovery',
    q: 'Was passiert, wenn ich versehentlich etwas lösche?',
    a: 'Gelöschte Elemente landen zuerst im Papierkorb (in der Seitenleiste). Von dort kannst du sie jederzeit mit einem Klick wiederherstellen oder endgültig löschen.'
  },
  {
    id: 'fio_context',
    q: 'Woher weiß Fio, an welchen Aufgaben ich arbeite?',
    a: 'Im Coach wählst du über das Kontext-Menü oben aus, welche Projekte und Erinnerungen Fio als Kontext erhält. Standardmäßig berücksichtigt Fio deine aktuellen Projekte, um passgenau zu antworten.'
  }
];

export default function TutorialsSection() {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (idx) => {
    setOpenFaqIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <SectionHeader title="Kern-Workflows" />
          <p className="text-caption text-secondary">
            So holst du das Meiste aus FocusFlow für deinen Arbeitsalltag heraus.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WORKFLOWS.map((wf) => (
            <Card key={wf.title} variant="outlined" padding="md" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <IconTile area="neutral" icon={wf.icon} size="sm" />
                <Badge tone="neutral" size="sm">{wf.badge}</Badge>
              </div>
              <h4 className="mt-1 text-body-strong text-primary">{wf.title}</h4>
              <p className="text-caption text-secondary">{wf.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <SectionHeader title="Häufige Fragen" />
          <p className="text-caption text-secondary">
            Antworten zu Funktionen, Speicherorten und Synchronisation.
          </p>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={faq.id} className="overflow-hidden rounded-lg border border-subtle bg-surface">
                <button
                  type="button"
                  id={`faq-btn-${idx}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  onClick={() => toggleFaq(idx)}
                  className={cx('flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-body text-primary transition-colors duration-fast hover:bg-hover', FOCUS)}
                >
                  <span className="min-w-0 flex-1">{faq.q}</span>
                  <Icon name="expand_more" size="md" className={cx('shrink-0 text-secondary transition-transform duration-fast motion-reduce:transition-none', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-btn-${idx}`}
                    className="border-t border-subtle px-4 py-3 text-body text-secondary"
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
