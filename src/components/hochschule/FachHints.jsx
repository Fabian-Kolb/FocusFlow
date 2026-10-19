import React, { useRef, useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { addHint, removeHint, toggleHintExam } from '../../lib/hochschule';
import { parseIsoDay } from '../../lib/projectProgress';
import { Badge, Button, Card, Chip, IconButton, Input, SectionHeader } from '../ds';

/**
 * „Hinweise aus der Stunde“ eines Fachs: kurze Einträge, was der Professor als wichtig gesagt hat und was zu tun ist
 * (keine Mitschrift). Je Hinweis: prüfungsrelevant markieren, als Aufgabe ins Fach übernehmen, löschen (mit Rückgängig).
 */
export default function FachHints({ project }) {
  const { mutateProject, addTask, addReminder } = useModalContext();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [exam, setExam] = useState(false);
  const hints = project.hints || [];

  // Der Rückgängig-Toast läuft später: Er muss mit dem aktuellen Stand arbeiten, nicht mit dem von damals
  const mutateRef = useRef(mutateProject);
  mutateRef.current = mutateProject;
  const update = (fn) => mutateRef.current(project.id, (p) => ({ ...p, hints: fn(p.hints || []) }));

  const save = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    update((list) => addHint(list, text, { exam }));
    setText('');
    setExam(false);
  };

  const remove = (hint, index) => {
    update((list) => removeHint(list, hint.id));
    showToast({
      message: 'Hinweis gelöscht',
      icon: 'delete',
      actionLabel: 'Rückgängig',
      onAction: () => update((list) => {
        // Erst entfernen, dann an die alte Stelle setzen: so entsteht nie ein doppelter Eintrag
        const restored = removeHint(list, hint.id);
        restored.splice(Math.min(index, restored.length), 0, hint);
        return restored;
      }),
    });
  };

  // „Was zu tun ist“ wird eine Aufgabe im ersten offenen Abschnitt des Fachs; ohne Abschnitt in die Merkliste
  const toTask = (hint) => {
    const title = hint.text.slice(0, 200);
    const phase = (project.phases || []).find((p) => !p.completed) || project.phases?.[0];
    if (phase) {
      addTask(project.id, phase.id, { title, date: '' });
      showToast({ message: `Als Aufgabe zu „${project.title}“ hinzugefügt`, icon: 'check_circle' });
    } else {
      addReminder({ title, status: 'AKTIV' });
      showToast({ message: 'Als Eintrag in die Merkliste gelegt', icon: 'check_circle' });
    }
  };

  return (
    <Card padding="md" className="space-y-4">
      <SectionHeader title="Hinweise aus der Stunde" count={hints.length} />
      <form onSubmit={save} className="flex flex-col gap-2" aria-label="Hinweis hinzufügen">
        <Input
          aria-label="Neuer Hinweis"
          placeholder="z. B. Kapitel 3 kommt dran"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
          autoComplete="off"
        />
        <div className="flex items-center justify-between gap-2">
          <Chip selected={exam} leadingIcon="star" onClick={() => setExam((v) => !v)} aria-pressed={exam}>Prüfungsrelevant</Chip>
          <Button type="submit" size="sm" disabled={!text.trim()}>Hinzufügen</Button>
        </div>
      </form>

      {hints.length === 0 ? (
        <p className="text-body text-secondary">Noch keine Hinweise. Schreib auf, was der Professor als wichtig genannt hat oder was du bis zur nächsten Stunde tun sollst.</p>
      ) : (
        <ul className="divide-y divide-subtle">
          {hints.map((hint, index) => {
            const day = hint.date ? parseIsoDay(hint.date) : null;
            return (
              <li key={hint.id} className="flex items-start gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body text-primary">{hint.text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-secondary">
                    {day && <span>{day.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>}
                    {hint.exam && <Badge tone="warning" size="sm" icon="star">Prüfungsrelevant</Badge>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconButton
                    icon="star"
                    filled={Boolean(hint.exam)}
                    size="sm"
                    label={hint.exam ? 'Nicht mehr als prüfungsrelevant markieren' : 'Als prüfungsrelevant markieren'}
                    aria-pressed={Boolean(hint.exam)}
                    onClick={() => update((list) => toggleHintExam(list, hint.id))}
                  />
                  <IconButton icon="add_task" size="sm" label="Als Aufgabe übernehmen" onClick={() => toTask(hint)} />
                  <IconButton icon="delete" size="sm" variant="danger-ghost" label="Hinweis löschen" onClick={() => remove(hint, index)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
