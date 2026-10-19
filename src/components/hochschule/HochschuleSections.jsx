import React from 'react';
import { getExam, nextFachDeadline } from '../../lib/hochschule';
import { Badge, Button, EmptyState, FOCUS, IconTile, cx } from '../ds';
import SectionCard from '../overview/SectionCard';

const TONE_TEXT = { danger: 'text-danger', warning: 'text-warning', neutral: 'text-secondary' };

/** Fächer auf Home: Name, nächste Aufgabe mit Frist und Prüfungs-Countdown. Tippen öffnet das Fach. */
export function FaecherSection({ faecher, now, onOpen, onCreate, className }) {
  return (
    <SectionCard
      title="Fächer"
      icon="school"
      areaId="projects"
      count={faecher.length > 0 ? faecher.length : null}
      className={className}
      action={faecher.length > 0 && <Button variant="ghost" size="sm" leadingIcon="add" onClick={onCreate}>Fach</Button>}
    >
      {faecher.length === 0 ? (
        <EmptyState
          compact
          bordered={false}
          icon="school"
          title="Noch keine Fächer"
          description="Lege dein erstes Fach an. Dort sammelst du Aufgaben, Hinweise aus der Stunde und den Prüfungstermin."
          action={<Button size="sm" onClick={onCreate}>Fach hinzufügen</Button>}
        />
      ) : (
        <ul className="divide-y divide-subtle">
          {faecher.map((project) => {
            const next = nextFachDeadline(project, now, { includeExam: false });
            const exam = getExam(project, now);
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onOpen(project)}
                  className={cx('relative flex w-full items-center gap-3 rounded-md py-2 text-left', "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']", FOCUS)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-strong text-primary">{project.title}</span>
                    <span className={cx('line-clamp-2 text-caption', next ? TONE_TEXT[next.tone] : 'text-secondary')}>
                      {next ? `${next.countdown}: ${next.title}` : 'Keine Aufgabe mit Frist'}
                    </span>
                  </span>
                  {exam && exam.dayDiff >= 0 && (
                    <Badge tone={exam.tone} size="sm" icon="school" className="shrink-0">Prüfung {exam.countdown === 'Heute' || exam.countdown === 'Morgen' ? exam.countdown.toLowerCase() : exam.countdown}</Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/** Abgaben und Prüfungen auf Home: Prüfungstermine der Fächer und Einträge mit Art Abgabe oder Prüfung, früheste zuerst */
export function DeadlinesSection({ items, onOpen, className }) {
  if (items.length === 0) return null;
  return (
    <SectionCard title="Abgaben und Prüfungen" icon="assignment" areaId="reminders" count={items.length} className={className}>
      <ul className="divide-y divide-subtle">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className={cx('relative flex w-full items-center gap-3 rounded-md py-2 text-left', "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']", FOCUS)}
            >
              <IconTile icon={item.icon} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-strong text-primary">{item.title}</span>
                <span className="block truncate text-caption text-secondary">{item.subtitle}</span>
              </span>
              <Badge tone={item.tone} size="sm" className="shrink-0">{item.countdown}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
