import React from 'react';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useModalContext } from '../../context/ModalContext';
import { environmentOf } from '../../lib/environments';
import { Dialog, FOCUS, Icon, IconTile, cx } from '../ds';

/**
 * Ein Projekt, einen Merklisten-Eintrag oder einen Gedanken in eine andere Umgebung verschieben.
 * Aufruf: openModal('moveEnvironment', { type: 'project' | 'reminder' | 'thought', itemId, returnTo? }).
 * `returnTo`: Bildschirm, auf den man nach dem Verschieben geht (Detailseiten: das Ding ist dann nicht mehr
 * in der aktiven Umgebung zu finden).
 */
const MoveEnvironmentModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, moveToEnvironment, allProjects, allReminders, allInboxItems } = useModalContext();
  const { enabledEnvironments } = useEnvironment();
  const isOpen = activeModal === 'moveEnvironment';
  const { type, itemId, returnTo } = modalPayload || {};

  const item = !isOpen ? null
    : type === 'project' ? allProjects.find((p) => p.id === itemId)
    : type === 'reminder' ? allReminders.find((r) => r.id === itemId)
    : Object.values(allInboxItems || {}).flat().find((i) => i.id === itemId);
  const currentId = environmentOf(item);

  const choose = (envId) => {
    closeModal();
    if (envId === currentId) return;
    moveToEnvironment(type, itemId, envId);
    if (returnTo && setCurrentScreen) setCurrentScreen(returnTo);
  };

  return (
    <Dialog open={isOpen} onClose={closeModal} title="Umgebung wählen" description="In welche Umgebung gehört das?" size="sm">
      <div role="radiogroup" aria-label="Umgebung" className="flex flex-col gap-2">
        {enabledEnvironments.map((env) => {
          const selected = env.id === currentId;
          return (
            <button
              key={env.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(env.id)}
              data-autofocus={selected ? true : undefined}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-fast',
                FOCUS,
                selected ? 'border-accent bg-accent-subtle' : 'border-subtle bg-surface hover:border-default active:bg-pressed',
              )}
            >
              <IconTile area={selected ? 'accent' : 'neutral'} icon={env.icon} size="sm" />
              <span className="min-w-0 flex-1 truncate text-label text-primary">{env.label}</span>
              {selected && <Icon name="check" size="md" className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
};

export default MoveEnvironmentModal;
