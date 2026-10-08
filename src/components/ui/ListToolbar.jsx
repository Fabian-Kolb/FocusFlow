import React from 'react';

// Gemeinsame, kompakte Werkzeugleisten für die Übersichten "Projekte" und "Erinnerungen" (Regel 02: Parität).

const STATUS_FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Aktiv' },
  { value: 'planned', label: 'Geplant' },
  { value: 'paused', label: 'Pausiert' },
  { value: 'completed', label: 'Erledigt' },
];

const iconButton = 'shrink-0 w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-lg border transition-colors cursor-pointer';

/**
 * Zeile 1: Suche, Papierkorb, Neu.  Zeile 2: optionaler Ansichts-Umschalter + Statusfilter.
 */
export function ListToolbar({
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
    <div className="space-y-2 mb-5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0 md:max-w-md">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full h-10 md:h-9 pl-9 pr-3 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-on-surface-variant"
          />
        </div>
        <div className="flex-1 hidden md:block" />
        <button
          type="button"
          onClick={onOpenTrash}
          title="Papierkorb öffnen"
          aria-label="Papierkorb öffnen"
          className={`${iconButton} border-outline-variant bg-white text-on-surface-variant hover:text-red-600 hover:border-red-200 hover:bg-red-50`}
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </button>
        <button
          type="button"
          onClick={onCreate}
          title={createLabel}
          aria-label={createLabel}
          className="shrink-0 h-10 md:h-9 w-10 sm:w-auto sm:px-3.5 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-on-primary text-sm font-bold hover:bg-black transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span className="hidden sm:inline">{createLabel}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {viewToggle}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-wrap-scroll -my-1 py-1">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onStatusFilterChange(f.value)}
                aria-pressed={active}
                className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-surface-low text-on-surface-variant border border-outline-variant hover:border-primary hover:text-primary'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Umschalter zwischen zwei Ansichten, nur Icons + Tooltip, damit er auch am Handy in die Filterzeile passt */
export function ViewToggle({ value, onChange, options }) {
  return (
    <div role="radiogroup" aria-label="Ansicht" className="shrink-0 flex items-center p-0.5 rounded-lg bg-surface-low border border-outline-variant">
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
            className={`h-8 md:h-7 px-2.5 md:px-2 flex items-center gap-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              active ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{o.icon}</span>
            <span className="hidden lg:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Kopfzeile über den Kategorien: Anzahl links, rechts Ein-/Ausklappen und Bearbeiten als Icons */
export function CategoryToolbar({ count, isEditMode, onToggleEdit, anyExpanded, onCollapseAll, onExpandAll }) {
  return (
    <div className="flex items-center gap-1 pb-1.5 border-b border-outline-variant/40">
      <span className="flex-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
        Kategorien ({count})
      </span>
      {!isEditMode && (
        <button
          type="button"
          onClick={anyExpanded ? onCollapseAll : onExpandAll}
          title={anyExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
          aria-label={anyExpanded ? 'Alle Kategorien einklappen' : 'Alle Kategorien ausklappen'}
          className={`${iconButton} border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-low`}
        >
          <span className="material-symbols-outlined text-[20px]">{anyExpanded ? 'unfold_less' : 'unfold_more'}</span>
        </button>
      )}
      {isEditMode ? (
        <button
          type="button"
          onClick={onToggleEdit}
          className="h-9 px-3 flex items-center gap-1 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">check</span>
          Fertig
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleEdit}
          title="Kategorien bearbeiten und sortieren"
          aria-label="Kategorien bearbeiten und sortieren"
          className={`${iconButton} border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-low`}
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
      )}
    </div>
  );
}
