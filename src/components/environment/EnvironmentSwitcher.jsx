import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEnvironment } from '../../context/EnvironmentContext';
import { useModalContext } from '../../context/ModalContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { summarizeEnvironment } from '../../lib/environments';
import { Badge, FOCUS, Icon, IconTile, Menu, MenuItem, MenuLabel, Sheet, cx } from '../ds';

const MENU_GAP = 6;

/**
 * Umgebung wechseln: Knopf mit dem Namen der aktuellen Umgebung.
 *  - Am Desktop (ab md) ein Dropdown direkt am Knopf (eingeklappte Seitenleiste: rechts daneben), mit Pfeiltasten
 *    bedienbar; die Tasten 1 bis 4 wechseln überall direkt (siehe useGlobalShortcuts).
 *  - Am Handy ein Bottom Sheet mit der Lage je Umgebung („1 überfällig“, „2 heute“).
 * Nach dem Wechsel landet man auf Home, denn der Bildschirm von vorher gehört vielleicht zu einer anderen Umgebung.
 *
 *  - `variant="bar"`: Handy-Leiste oben. `variant="sidebar"`: Zeile in der Seitenleiste (48-px-Icon-Slot, Regel 06).
 */
export default function EnvironmentSwitcher({ variant = 'bar', collapsed = false, onSwitched }) {
  const { activeEnvironment, enabledEnvironments, setActiveEnvironment } = useEnvironment();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const triggerRef = useRef(null);

  const choose = (id) => {
    setOpen(false);
    if (id === activeEnvironment.id) return;
    setActiveEnvironment(id);
    onSwitched?.(id);
  };

  const label = `Umgebung wechseln, aktuell ${activeEnvironment.label}`;
  const popup = isDesktop ? 'menu' : 'dialog';
  const trigger = variant === 'sidebar' ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      title={collapsed ? activeEnvironment.label : undefined}
      aria-label={label}
      aria-haspopup={popup}
      aria-expanded={open}
      className={cx(
        'group relative flex h-11 w-full flex-shrink-0 cursor-pointer select-none items-center rounded-md border p-0 text-left',
        'transition-[background-color,border-color] duration-fast hover:border-default motion-reduce:transition-none',
        open ? 'border-default bg-hover' : 'border-subtle bg-subtle',
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
        <Icon name={open ? 'expand_less' : 'expand_more'} size="md" className="text-tertiary" />
      </span>
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label={label}
      aria-haspopup={popup}
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

  return (
    <>
      {trigger}
      {isDesktop ? (
        open && (
          <EnvironmentMenu
            anchorRef={triggerRef}
            side={variant === 'sidebar' && collapsed ? 'right' : 'below'}
            activeId={activeEnvironment.id}
            environments={enabledEnvironments}
            onChoose={choose}
            onClose={() => setOpen(false)}
          />
        )
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} title="Umgebung wechseln" description="In jeder Umgebung zeigt die App nur das, was dazugehört." side="bottom" bodyClassName="pb-safe">
          <EnvironmentList open={open} activeId={activeEnvironment.id} environments={enabledEnvironments} onChoose={choose} />
        </Sheet>
      )}
    </>
  );
}

/** Lage je Umgebung (überfällig, heute fällig), nur solange die Auswahl offen ist */
function useEnvironmentStats(open, environments) {
  const { allReminders, allProjects } = useModalContext();
  return useMemo(() => {
    if (!open) return {};
    const now = new Date();
    return Object.fromEntries(environments.map((env) => [env.id, summarizeEnvironment(env.id, { reminders: allReminders, projects: allProjects, now })]));
  }, [open, environments, allReminders, allProjects]);
}

function LageBadge({ lage }) {
  if (lage?.overdue > 0) return <Badge tone="danger" size="sm" className="shrink-0">{lage.overdue} überfällig</Badge>;
  if (lage?.due > 0) return <Badge tone="warning" size="sm" className="shrink-0">{lage.due} heute</Badge>;
  return null;
}

/**
 * Dropdown am Desktop. Liegt per Portal im body und wird am Knopf ausgerichtet, weil die Seitenleiste
 * `overflow-hidden` hat (eingeklappt würde das Menü sonst abgeschnitten). Schließt bei Klick daneben, Esc, Tab,
 * Scrollen und Größenänderung; Pfeiltasten, Pos1 und Ende bewegen den Fokus, Esc gibt ihn an den Knopf zurück.
 */
function EnvironmentMenu({ anchorRef, side, activeId, environments, onChoose, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);
  const stats = useEnvironmentStats(true, environments);

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Eingeklappt rechts neben der Seitenleiste (der Knopf selbst kann während des Einklappens noch breiter sein)
    const edge = anchorRef.current.closest('aside')?.getBoundingClientRect().right ?? rect.right;
    setPos(side === 'right'
      ? { top: rect.top, left: edge + MENU_GAP }
      : { top: rect.bottom + MENU_GAP, left: rect.left, width: rect.width });
  }, [anchorRef, side]);

  // Fokus aufs gewählte Element, sobald das Menü steht
  useEffect(() => {
    if (!pos) return;
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitemradio"]') || [])];
    (items.find((el) => el.getAttribute('aria-checked') === 'true') || items[0])?.focus();
  }, [pos]);

  useEffect(() => {
    const close = (refocus) => {
      onClose();
      if (refocus) anchorRef.current?.focus();
    };
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      close(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'Tab') { close(false); return; }
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitemradio"]') || [])];
      const index = items.indexOf(document.activeElement);
      const go = (i) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
      if (e.key === 'ArrowDown') go(index + 1);
      else if (e.key === 'ArrowUp') go(index < 0 ? items.length - 1 : index - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(items.length - 1);
    };
    const onViewport = () => close(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [anchorRef, onClose]);

  if (!pos || typeof document === 'undefined') return null;

  return createPortal(
    <Menu
      ref={menuRef}
      label="Umgebung"
      className="fixed z-dropdown w-72"
      style={{ top: pos.top, left: pos.left, ...(pos.width ? { width: Math.max(pos.width, 256) } : {}) }}
    >
      <MenuLabel>Umgebung</MenuLabel>
      {environments.map((env, index) => {
        const selected = env.id === activeId;
        return (
          <MenuItem
            key={env.id}
            role="menuitemradio"
            aria-checked={selected}
            icon={env.icon}
            shortcut={index < 9 ? String(index + 1) : undefined}
            onClick={() => onChoose(env.id)}
            selected={selected}
            className={cx(selected && 'bg-selected')}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{env.label}</span>
              <LageBadge lage={stats[env.id]} />
            </span>
          </MenuItem>
        );
      })}
    </Menu>,
    document.body,
  );
}

/** Auswahl am Handy: große Zeilen mit Beschreibung und Lage */
function EnvironmentList({ open, activeId, environments, onChoose }) {
  const stats = useEnvironmentStats(open, environments);

  return (
    <div role="radiogroup" aria-label="Umgebung" className="flex flex-col gap-2">
      {environments.map((env) => {
        const selected = env.id === activeId;
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
            <LageBadge lage={stats[env.id]} />
            {selected && <Icon name="check" size="md" className="shrink-0 text-accent" />}
          </button>
        );
      })}
    </div>
  );
}
