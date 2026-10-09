import React, { useState, useRef, useEffect } from 'react';
import { Button, Chip, FOCUS, Icon, IconButton, Input, Menu, MenuItem, MenuLabel, PageHeader, cx } from '../ds';

// Gemeinsame, kompakte Werkzeugleisten für die Übersichten "Projekte" und "Erinnerungen" (Regel 02: Parität).

const STATUS_FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Aktiv' },
  { value: 'planned', label: 'Geplant' },
  { value: 'paused', label: 'Pausiert' },
  { value: 'completed', label: 'Erledigt' },
];

// Projekte-Tab: Liste und Kanban-Board sind zwei Ansichten desselben Ziels
export const PROJECT_VIEW_OPTIONS = [
  { value: 'list', label: 'Liste', icon: 'view_agenda' },
  { value: 'board', label: 'Board', icon: 'view_kanban' },
];

/**
 * Zeile 1: Suche, Papierkorb, Neu.  Zeile 2: optionaler Ansichts-Umschalter + Statusfilter.
 */
export function ListToolbar({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  onOpenTrash,
  onCreate,
  createLabel,
  statusFilter,
  onStatusFilterChange,
  viewToggle = null,
}) {
  return (
    <div className="mb-5 space-y-4">
    {title && (
      <PageHeader
        title={title}
        description={description}
        className="md:items-center"
        actions={(
          <>
            <IconButton
              icon="delete"
              label="Papierkorb öffnen"
              variant="secondary"
              onClick={onOpenTrash}
              className="hover:!border-danger hover:!bg-danger-subtle hover:!text-danger"
            />
            <IconButton icon="add" label={createLabel} variant="primary" onClick={onCreate} className="sm:hidden" />
            <Button leadingIcon="add" onClick={onCreate} className="hidden sm:inline-flex">{createLabel}</Button>
          </>
        )}
      />
    )}
    <div className="min-w-0 md:max-w-md">
      <Input
        type="search"
        leadingIcon="search"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
    </div>

      <div className="flex items-center gap-2">
        {viewToggle}
        <div className="no-wrap-scroll -my-1.5 flex min-w-0 flex-1 items-center gap-2 py-1.5">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} selected={statusFilter === f.value} onClick={() => onStatusFilterChange(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Umschalter zwischen zwei Ansichten, nur Icons + Tooltip, damit er auch am Handy in die Filterzeile passt */
export function ViewToggle({ value, onChange, options }) {
  return (
    <div role="radiogroup" aria-label="Ansicht" className="flex shrink-0 items-center gap-0.5 rounded-md border border-default bg-subtle p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex h-8 items-center gap-1 rounded-sm px-2.5 text-label-sm transition-colors duration-fast',
              FOCUS,
              active ? 'bg-surface text-primary shadow-xs' : 'text-secondary hover:text-primary',
            )}
          >
            <Icon name={o.icon} size="md" filled={active} />
            <span className="hidden lg:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Sortier-Menü für die Elemente innerhalb der Kategorien (inkl. "Benutzerdefiniert" für manuelles Ziehen) */
export function SortMenu({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        leadingIcon="swap_vert"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sortierung: ${active.label}`}
        title={`Sortierung: ${active.label}`}
      >
        <span className="hidden sm:inline">{active.label}</span>
      </Button>
      {open && (
        <Menu label="Sortierung in Kategorien" className="absolute right-0 top-full z-dropdown mt-1 w-60">
          <MenuLabel>Sortierung in Kategorien</MenuLabel>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              icon={o.icon}
              selected={o.value === value}
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </MenuItem>
          ))}
          {value !== 'custom' && (
            <p className="px-2.5 pb-1 pt-1.5 text-micro text-tertiary">
              Beim Ziehen einer Karte wechselt die Sortierung auf „Benutzerdefiniert“.
            </p>
          )}
        </Menu>
      )}
    </div>
  );
}

/** Kopfzeile über den Kategorien: Anzahl links, rechts Sortierung, Ein-/Ausklappen und Bearbeiten als Icons */
export function CategoryToolbar({ count, isEditMode, onToggleEdit, anyExpanded, onCollapseAll, onExpandAll, sortValue, sortOptions, onSortChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-subtle pb-1.5">
      <h2 className="flex-1 font-label text-eyebrow uppercase text-secondary">
        Kategorien <span className="text-caption-strong normal-case tracking-normal text-tertiary">{count}</span>
      </h2>
      {!isEditMode && sortOptions && <SortMenu value={sortValue} options={sortOptions} onChange={onSortChange} />}
      {!isEditMode && (
        <IconButton
          icon={anyExpanded ? 'unfold_less' : 'unfold_more'}
          label={anyExpanded ? 'Alle Kategorien einklappen' : 'Alle Kategorien ausklappen'}
          size="sm"
          onClick={anyExpanded ? onCollapseAll : onExpandAll}
        />
      )}
      {isEditMode ? (
        <Button size="sm" leadingIcon="check" onClick={onToggleEdit}>Fertig</Button>
      ) : (
        <IconButton icon="edit" label="Kategorien bearbeiten und sortieren" size="sm" onClick={onToggleEdit} />
      )}
    </div>
  );
}
