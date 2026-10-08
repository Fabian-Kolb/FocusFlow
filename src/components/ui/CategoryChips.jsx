import React, { useId, useState } from 'react';

/**
 * Kategorie-Auswahl als antippbare Chips (eine Zeile, auf dem Handy seitlich wischbar).
 * Der letzte Chip legt direkt eine neue Kategorie an und wählt sie aus.
 */
function CategoryChips({ categories = [], value, onChange, onCreate, label = 'Kategorie' }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const labelId = useId();

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      setIsAdding(false);
      return;
    }
    const id = await onCreate?.(name);
    if (id) onChange(id);
    setNewName('');
    setIsAdding(false);
  };

  const chipBase = 'shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-bold whitespace-nowrap transition-colors cursor-pointer';

  return (
    <div>
      <span className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide" id={labelId}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex items-center gap-2 overflow-x-auto no-wrap-scroll sm:flex-wrap -mx-1 px-1 py-0.5"
      >
        {categories.map((cat) => {
          const selected = cat.id === value;
          return (
            <button
              key={cat.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(cat.id)}
              className={`${chipBase} ${
                selected
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-low text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary'
              }`}
            >
              {selected && <span className="material-symbols-outlined text-[14px]">check</span>}
              {cat.name}
            </button>
          );
        })}

        {onCreate && (isAdding ? (
          <span className="shrink-0 inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full border border-primary bg-white">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  create();
                }
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setIsAdding(false);
                }
              }}
              placeholder="Name"
              aria-label="Name der neuen Kategorie"
              className="w-28 text-xs font-bold bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
            />
            <button
              type="button"
              onClick={create}
              aria-label="Kategorie anlegen"
              className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={`${chipBase} border-dashed border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary`}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Neu
          </button>
        ))}
      </div>
    </div>
  );
}

export default CategoryChips;
