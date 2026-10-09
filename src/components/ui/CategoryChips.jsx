import React, { useId, useState } from 'react';
import { Chip, FOCUS, IconButton, cx } from '../ds';

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

  return (
    <div>
      <span className="mb-1.5 block text-label text-primary" id={labelId}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="no-wrap-scroll -mx-1 flex items-center gap-2 px-1 py-1 sm:flex-wrap"
      >
        {categories.map((cat) => {
          const selected = cat.id === value;
          return (
            <Chip
              key={cat.id}
              role="radio"
              aria-checked={selected}
              selected={selected}
              leadingIcon={selected ? 'check' : undefined}
              onClick={() => onChange(cat.id)}
            >
              {cat.name}
            </Chip>
          );
        })}

        {onCreate && (isAdding ? (
          <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-strong bg-surface pl-3 pr-1">
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
              className="w-28 border-0 bg-transparent p-0 text-label-sm placeholder:text-tertiary focus:outline-none focus:ring-0"
            />
            <IconButton icon="check" label="Kategorie anlegen" variant="primary" size="sm" onClick={create} className="!h-6 !w-6" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={cx(
              'relative inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-control px-3 text-label-sm text-secondary transition-colors duration-fast hover:border-strong hover:text-primary',
              FOCUS,
            )}
          >
            + Neu
          </button>
        ))}
      </div>
    </div>
  );
}

export default CategoryChips;
