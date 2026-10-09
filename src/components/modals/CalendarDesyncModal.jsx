import React from 'react';
import { Button, Dialog, FOCUS, Icon, cx } from '../ds';

/**
 * CalendarDesyncModal
 * Dialog zur Bestätigung der De-Synchronisierung:
 * Erlaubt die Wahl, ob das Event in Google Calendar gelöscht oder als eigenständiger Termin behalten werden soll.
 */
const CalendarDesyncModal = ({
  isOpen,
  title = '',
  type = 'Erinnerung',
  onConfirm,
  onClose,
  isLoading = false
}) => {
  const optionClass = 'group flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Dialog
      open={isOpen}
      onClose={isLoading ? undefined : onClose}
      size="md"
      title="Kalender-Synchronisierung trennen"
      description={`Für ${type}: „${title}“`}
      footer={<Button variant="secondary" disabled={isLoading} onClick={onClose}>Abbrechen</Button>}
    >
      <div className="space-y-3">
        <p className="text-body text-secondary">
          Möchtest du den zugehörigen Termin auch aus deinem Google Kalender entfernen oder soll er dort als eigenständiger Eintrag bestehen bleiben?
        </p>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => onConfirm({ deleteInGoogle: true })}
          className={cx(optionClass, 'border-danger bg-danger-subtle text-danger', FOCUS)}
        >
          <span className="flex items-center gap-3">
            <Icon name="delete" size="md" />
            <span>
              <span className="block text-body-strong">Aus Google Kalender löschen</span>
              <span className="block text-caption">Entfernt den Termin vollständig aus deinem Kalender</span>
            </span>
          </span>
          <Icon name="arrow_forward" size="md" className="transition-transform duration-fast group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => onConfirm({ deleteInGoogle: false })}
          className={cx(optionClass, 'border-default bg-surface text-primary hover:border-strong', FOCUS)}
        >
          <span className="flex items-center gap-3">
            <Icon name="event_available" size="md" />
            <span>
              <span className="block text-body-strong">Im Kalender behalten</span>
              <span className="block text-caption text-secondary">Trennt nur die Verknüpfung, der Termin bleibt bei Google</span>
            </span>
          </span>
          <Icon name="arrow_forward" size="md" className="text-secondary transition-transform duration-fast group-hover:translate-x-0.5" />
        </button>
      </div>
    </Dialog>
  );
};

export default CalendarDesyncModal;
