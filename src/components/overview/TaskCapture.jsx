import React, { useMemo, useState } from 'react';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useModalContext } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { getCaptureTarget, isOpenFach, pickFachPhase } from '../../lib/hochschule';
import { TASK_KINDS, describeDay, entryToReminder, matchByName, parseQuickEntry } from '../../lib/taskOverview';
import { Badge, Button, Input } from '../ds';

const parseIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Schnelleingabe für Aufgaben: ein Feld, ein Satz. Kategorie, Frist, Uhrzeit, „schnell“ und die Art (Klausur,
 * Abgabe) erkennt `parseQuickEntry` aus dem Text und zeigt das als Badges, bevor gespeichert wird. Die Aufgabe
 * landet in der aktiven Umgebung (das macht `addReminder`).
 *
 * In Hochschule gilt zusätzlich: Nennt der Text ein Fach („Mathe Blatt 5 bis Freitag“), wird daraus eine Aufgabe in
 * diesem Fach; „Klausur Mathe 2 am 2.11.“ setzt den Prüfungstermin des Fachs (siehe `getCaptureTarget`).
 *
 *  - `secondary`: zweite Aktion mit demselben Text, z. B. „Als Gedanke“ ({ label, icon, run(text) }).
 */
export default function TaskCapture({ placeholder, ariaLabel, secondary = null }) {
  const { addReminder, addTask, mutateProject, projects, reminderCategories } = useModalContext();
  const { activeEnvironmentId } = useEnvironment();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null); // 'task' | 'secondary' | null

  const entry = useMemo(
    () => parseQuickEntry(text, { categories: reminderCategories }),
    [text, reminderCategories],
  );
  const faecher = useMemo(
    () => (activeEnvironmentId === 'hochschule' ? projects.filter(isOpenFach) : []),
    [activeEnvironmentId, projects],
  );
  const fach = useMemo(() => matchByName(text, faecher, (p) => p.title), [text, faecher]);
  const target = getCaptureTarget(entry, fach);

  const hasText = text.trim().length > 0;
  const showCategory = target === 'reminder' && reminderCategories.length > 1;
  const dateDay = entry.date ? parseIso(entry.date) : null;
  const dateText = dateDay ? `${describeDay(dateDay)}${entry.time ? ` · ${entry.time}` : ''}` : '';
  const isToday = dateText.startsWith('Heute');

  const saveTask = async (e) => {
    e?.preventDefault();
    if (!hasText || busy) return;
    setBusy('task');
    try {
      if (target === 'exam') {
        mutateProject(fach.id, (p) => ({ ...p, exam: { date: entry.date } }));
        showToast({ message: `Prüfung in „${fach.title}“ eingetragen: ${describeDay(dateDay)}`, icon: 'check_circle' });
      } else if (target === 'fachTask') {
        addTask(fach.id, pickFachPhase(fach).id, { title: entry.title, date: entry.date });
        showToast({ message: `Aufgabe zu „${fach.title}“ hinzugefügt: ${entry.title}`, icon: 'check_circle' });
      } else {
        await addReminder(entryToReminder(entry));
        showToast({ message: `Aufgabe hinzugefügt: ${entry.title}`, icon: 'check_circle' });
      }
      setText('');
    } catch (err) {
      console.error('Aufgabe konnte nicht gespeichert werden:', err);
      showToast({ message: 'Aufgabe konnte nicht gespeichert werden. Dein Text ist noch da.', icon: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const runSecondary = async () => {
    if (!hasText || busy || !secondary) return;
    setBusy('secondary');
    try {
      await secondary.run(text.trim());
      setText('');
    } catch (err) {
      console.error('Eingabe konnte nicht gespeichert werden:', err);
      showToast({ message: 'Konnte nicht gespeichert werden. Dein Text ist noch da.', icon: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={saveTask} className="flex flex-col gap-2" aria-label={ariaLabel}>
      <Input
        leadingIcon="add"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy !== null}
        enterKeyHint="done"
        autoComplete="off"
      />
      {hasText && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2" aria-live="polite">
            <span className="text-caption text-tertiary">Erkannt:</span>
            {fach && target !== 'reminder' && <Badge size="sm" icon="school">{fach.title}</Badge>}
            {showCategory && <Badge size="sm" icon="label">{entry.categoryName}</Badge>}
            {target === 'exam' ? (
              <Badge size="sm" icon={TASK_KINDS.pruefung.icon} tone="warning">Prüfungstermin {dateText}</Badge>
            ) : (
              <>
                {dateText
                  ? <Badge size="sm" icon="event" tone={isToday ? 'warning' : 'neutral'}>{dateText}</Badge>
                  : !entry.quick && <Badge size="sm" icon="event_busy">Ohne Frist</Badge>}
                {entry.quick && target === 'reminder' && <Badge size="sm" icon="bolt">Schnell</Badge>}
                {entry.kind && target === 'reminder' && <Badge size="sm" icon={TASK_KINDS[entry.kind].icon}>{TASK_KINDS[entry.kind].label}</Badge>}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            {secondary && (
              <Button variant="ghost" size="sm" leadingIcon={secondary.icon} loading={busy === 'secondary'} disabled={busy !== null} onClick={runSecondary}>
                {secondary.label}
              </Button>
            )}
            <Button type="submit" size="sm" loading={busy === 'task'} disabled={busy !== null}>Hinzufügen</Button>
          </div>
        </div>
      )}
    </form>
  );
}
