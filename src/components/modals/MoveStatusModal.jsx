import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Badge, Dialog, FOCUS, Icon, cx } from '../ds';

// Status = Bedeutung (Regel 01): geplant Stahlblau, aktiv Grün, erledigt neutral
const STATUSES = [
  { id: 'GEPLANT', label: 'Geplant', sublabel: 'Noch nicht gestartet', icon: 'schedule', tone: 'info' },
  { id: 'AKTIV', label: 'In Arbeit', sublabel: 'Daran wird gerade gearbeitet', icon: 'play_circle', tone: 'success' },
  { id: 'ABGESCHLOSSEN', label: 'Erledigt', sublabel: 'Abgeschlossen und fertig', icon: 'check_circle', tone: 'neutral' },
];

const MoveStatusModal = () => {
  const {
    activeModal,
    modalPayload,
    closeModal,
    setProjectStatus,
    setReminderStatus
  } = useModalContext();

  const isOpen = activeModal === 'moveStatus';

  const { type, itemId, currentStatus } = modalPayload || {};
  const isProject = type === 'project';

  const handleSelectStatus = (statusId) => {
    if (isProject) {
      setProjectStatus(itemId, statusId);
    } else {
      setReminderStatus(itemId, statusId);
    }
    closeModal();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={closeModal}
      title="Status ändern"
      description="Der Status bestimmt auch die Spalte im Kanban-Board."
      size="sm"
    >
      <div className="space-y-2">
        {STATUSES.map((st) => {
          const isSelected = (currentStatus?.toUpperCase() === st.id) || (currentStatus?.toUpperCase() === 'LAUFEND' && st.id === 'AKTIV');
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => handleSelectStatus(st.id)}
              aria-pressed={isSelected}
              className={cx(
                'flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors duration-fast',
                FOCUS,
                isSelected ? 'border-accent bg-accent-subtle' : 'border-default bg-surface hover:border-strong',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon name={st.icon} size="lg" className={isSelected ? 'text-accent' : 'text-secondary'} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-body-strong text-primary">{st.label}</span>
                    <Badge tone={st.tone} size="sm">{st.label}</Badge>
                  </span>
                  <span className="mt-0.5 block text-caption text-secondary">{st.sublabel}</span>
                </span>
              </span>
              {isSelected && <Icon name="check" size="md" className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
};

export default MoveStatusModal;
