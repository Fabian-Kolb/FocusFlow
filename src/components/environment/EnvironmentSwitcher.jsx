import React, { useMemo, useState } from 'react';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useModalContext } from '../../context/ModalContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { summarizeEnvironment } from '../../lib/environments';
import { Badge, Dialog, FOCUS, Icon, IconTile, Sheet, cx } from '../ds';

/**
 * Umgebung wechseln: Knopf mit dem Namen der aktuellen Umgebung, darunter eine Auswahl mit der Lage je Umgebung
 * („1 überfällig“, „2 heute“). Am Handy ein Bottom Sheet, ab md ein Dialog. Nach dem Wechsel landet man auf Home,
 * denn der Bildschirm von vorher gehört vielleicht zu einer anderen Umgebung.
 *
 *  - `variant="bar"`: Handy-Leiste oben. `variant="sidebar"`: Zeile in der Seitenleiste (48-px-Icon-Slot, Regel 06).
 */
export default function EnvironmentSwitcher({ variant = 'bar', collapsed = false, onSwitched }) {
  const { activeEnvironment, enabledEnvironments, setActiveEnvironment } = useEnvironment();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const choose = (id) => {
    setOpen(false);
    if (id === activeEnvironment.id) return;
    setActiveEnvironment(id);
    onSwitched?.(id);
  };

  const label = `Umgebung wechseln, aktuell ${activeEnvironment.label}`;
  const trigger = variant === 'sidebar' ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={collapsed ? activeEnvironment.label : undefined}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cx(
        'group relative flex h-11 w-full flex-shrink-0 cursor-pointer select-none items-center rounded-md border border-subtle bg-subtle p-0 text-left',
        'transition-[background-color,border-color] duration-fast hover:border-default motion-reduce:transition-none',
        FOCUS,
      )}
    >
      <span className="flex h-11 w-12 flex-shrink-0 items-center justify-center text-accent">
        <Icon name={activeEnvironment.icon} size="md" />
      </span>
      <span
        className={cx(
          'flex min-w-0 flex-1 items-center gap-1 pr-3 transition-all ease-in-out motion-reduce:transition-none',
          collapsed ? 'pointer-events-none -translate-x-3 opacity-0 duration-150' : 'translate-x-0 opacity-100 delay-100 duration-200',
        )}
        aria-hidden={collapsed}
      >
        <span className="min-w-0 flex-1 truncate text-label text-primary">{activeEnvironment.label}</span>
        <Icon name="unfold_more" size="md" className="text-tertiary" />
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cx(
        'relative flex h-11 items-center gap-2 rounded-md pl-2 pr-3 text-label text-primary transition-colors duration-fast hover:bg-hover active:bg-pressed',
        FOCUS,
      )}
    >
      <Icon name={activeEnvironment.icon} size="md" className="text-accent" />
      {activeEnvironment.label}
      <Icon name="expand_more" size="md" className="text-tertiary" />
    </button>
  );

  const list = <EnvironmentList open={open} activeId={activeEnvironment.id} environments={enabledEnvironments} onChoose={choose} />;

  return (
    <>
      {trigger}
      {isDesktop ? (
        <Dialog open={open} onClose={() => setOpen(false)} title="Umgebung wechseln" description="In jeder Umgebung zeigt die App nur das, was dazugehört." size="sm">
          {list}
        </Dialog>
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} title="Umgebung wechseln" description="In jeder Umgebung zeigt die App nur das, was dazugehört." side="bottom" bodyClassName="pb-safe">
          {list}
        </Sheet>
      )}
    </>
  );
}

function EnvironmentList({ open, activeId, environments, onChoose }) {
  const { allReminders, allProjects } = useModalContext();
  // Lage nur rechnen, solange die Auswahl offen ist
  const stats = useMemo(() => {
    if (!open) return {};
    const now = new Date();
    return Object.fromEntries(environments.map((env) => [env.id, summarizeEnvironment(env.id, { reminders: allReminders, projects: allProjects, now })]));
  }, [open, environments, allReminders, allProjects]);

  return (
    <div role="radiogroup" aria-label="Umgebung" className="flex flex-col gap-2">
      {environments.map((env) => {
        const selected = env.id === activeId;
        const lage = stats[env.id];
        return (
          <button
            key={env.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(env.id)}
            data-autofocus={selected ? true : undefined}
            className={cx(
              'flex min-h-16 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-fast',
              FOCUS,
              selected ? 'border-accent bg-accent-subtle' : 'border-subtle bg-surface hover:border-default active:bg-pressed',
            )}
          >
            <IconTile area={selected ? 'accent' : 'neutral'} icon={env.icon} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block text-body-strong text-primary">{env.label}</span>
              <span className="block truncate text-caption text-secondary">{env.description}</span>
            </span>
            {lage?.overdue > 0 && <Badge tone="danger" size="sm" className="shrink-0">{lage.overdue} überfällig</Badge>}
            {lage && lage.overdue === 0 && lage.due > 0 && <Badge tone="warning" size="sm" className="shrink-0">{lage.due} heute</Badge>}
            {selected && <Icon name="check" size="md" className="shrink-0 text-accent" />}
          </button>
        );
      })}
    </div>
  );
}
