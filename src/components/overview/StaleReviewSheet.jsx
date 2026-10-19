import React, { useEffect, useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { ageLabel, getStaleTasks } from '../../lib/taskOverview';
import { toIsoDate } from '../../lib/recurrence';
import { Button, Card, EmptyState, IconTile, ProgressBar, Sheet } from '../ds';

/**
 * „Noch wichtig?“: Fio geht nacheinander durch Aufgaben, die seit über einer Woche ohne Frist liegen.
 * Pro Aufgabe drei Antworten: heute erledigen (Frist = heute), auf später schieben („Irgendwann“ im Bereich)
 * oder löschen (Papierkorb, mit Rückgängig). Die Warteschlange wird beim Öffnen festgehalten.
 */
export default function StaleReviewSheet({ open, onClose, reminders }) {
  const { patchReminder, deleteReminder, reminderCategories } = useModalContext();
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQueue(getStaleTasks(reminders, new Date()).map((r) => r.id));
    setIndex(0);
    // Nur beim Öffnen festhalten, sonst springt die Karte, sobald eine Antwort die Liste ändert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Gelöschte oder inzwischen erledigte Aufgaben überspringen
  let position = index;
  let current = null;
  while (position < queue.length) {
    const found = reminders.find((r) => r.id === queue[position] && !r.deletedAt && r.status !== 'ABGESCHLOSSEN');
    if (found) { current = found; break; }
    position += 1;
  }
  const total = queue.length;
  const categoryName = current
    ? reminderCategories.find((c) => c.id === (current.categoryId || 'allgemein'))?.name || 'Allgemein'
    : '';

  const answer = (run) => () => {
    if (!current) return;
    run(current);
    setIndex(position + 1);
  };
  const today = answer((r) => patchReminder(r.id, { date: toIsoDate(new Date()), status: 'AKTIV' }, `Für heute eingeplant: ${r.title}`, 'today'));
  const later = answer((r) => patchReminder(r.id, { parked: true }, `Auf später geschoben: ${r.title}`, 'schedule'));
  const remove = answer((r) => deleteReminder(r.id));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Noch wichtig?"
      description={current ? `${position + 1} von ${total}` : 'Fertig'}
      bodyClassName="pb-40 sm:pb-0" // Platz für den Rückgängig-Toast, der am Handy über dem Sheet steht
    >
      {current ? (
        <div className="flex flex-col gap-4">
          <ProgressBar value={position} max={Math.max(1, total)} size="sm" label="Fortschritt" />
          <Card variant="filled" padding="md">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <IconTile area="coach" size="sm" />
                <span className="text-caption-strong text-secondary">Fio fragt nach</span>
              </div>
              <div>
                <p className="text-caption text-secondary">{categoryName}</p>
                <h3 className="mt-1 text-heading text-primary">{current.title}</h3>
                <p className="mt-2 text-body text-secondary">{ageLabel(current)} · ohne Frist</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button fullWidth leadingIcon="today" onClick={today} data-autofocus>Heute erledigen</Button>
                <Button fullWidth variant="secondary" leadingIcon="schedule" onClick={later}>Auf später schieben</Button>
                <Button fullWidth variant="danger-ghost" leadingIcon="delete" onClick={remove}>Löschen</Button>
              </div>
            </div>
          </Card>
          <p className="text-caption text-secondary">
            „Später“ legt die Aufgabe im Bereich unter „Irgendwann“ ab. Auf Heute taucht sie dann nicht mehr auf.
          </p>
        </div>
      ) : (
        <EmptyState
          icon="check_circle"
          title={total === 0 ? 'Nichts liegt zu lange' : 'Alles sortiert'}
          description="Fio fragt wieder nach, wenn etwas länger als eine Woche ohne Frist liegt."
          action={<Button variant="secondary" onClick={onClose} data-autofocus>Schließen</Button>}
        />
      )}
    </Sheet>
  );
}
