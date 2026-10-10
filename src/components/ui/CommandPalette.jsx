import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { searchCommands } from '../../lib/commandSearch';
import { NAV_COMMANDS, ACTION_COMMANDS } from '../../lib/appCommands';
import { FioMark, Icon, Kbd, cx } from '../ds';

const GROUP_LABELS = {
  action: 'Aktionen',
  nav: 'Gehe zu',
  project: 'Projekte',
  reminder: 'Erinnerungen',
  thought: 'Gedanken',
};
const GROUP_ORDER = ['action', 'nav', 'project', 'reminder', 'thought'];

export function KeyHint({ keys }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      {keys.split(' ').map((k, i) => <Kbd key={i}>{k}</Kbd>)}
    </span>
  );
}

function ItemIcon({ icon }) {
  if (icon === 'fio') return <FioMark size={20} />;
  return <Icon name={icon} size="md" />;
}

/**
 * Befehlsleiste (Strg+K): Suche über Aktionen, Navigation, Projekte, Erinnerungen und Gedanken.
 * Bedienung: Pfeiltasten, Enter, Esc.
 */
export default function CommandPalette({ open, onClose, onNavigate, onAction, onOpenProject, onOpenReminder }) {
  const { projects = [], reminders = [], inboxItems = {} } = useData();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    setQuery('');
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      previousFocus.current?.focus?.();
    };
  }, [open]);

  const allItems = useMemo(() => {
    const thoughts = Object.values(inboxItems || {}).flat().filter((i) => i && !i.deletedAt);
    return [
      ...ACTION_COMMANDS.map((c) => ({ id: `a:${c.action}`, group: 'action', label: c.label, icon: c.icon, keys: c.keys, keywords: c.keywords, run: () => onAction(c.action) })),
      ...NAV_COMMANDS.map((c) => ({ id: `n:${c.screen}`, group: 'nav', label: c.label, icon: c.icon, keys: c.keys, keywords: c.keywords, run: () => onNavigate(c.screen) })),
      ...projects.filter((p) => !p.deletedAt).map((p) => ({
        id: `p:${p.id}`, group: 'project', label: p.title, icon: 'folder', sub: p.status === 'ABGESCHLOSSEN' ? 'Abgeschlossen' : '',
        keywords: p.description, run: () => onOpenProject(p.id),
      })),
      ...reminders.filter((r) => !r.deletedAt).map((r) => ({
        id: `r:${r.id}`, group: 'reminder', label: r.title, icon: r.status === 'ABGESCHLOSSEN' ? 'task_alt' : 'notifications',
        sub: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? new Date(`${r.date}T00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '',
        keywords: r.description, run: () => onOpenReminder(r.id),
      })),
      ...thoughts.map((t) => ({
        id: `t:${t.id}`, group: 'thought', label: t.title || t.summary || 'Gedanke', icon: 'lightbulb',
        keywords: [t.summary, t.originalText].filter(Boolean).join(' ').slice(0, 500), run: () => onNavigate('inbox'),
      })),
    ];
  }, [projects, reminders, inboxItems, onAction, onNavigate, onOpenProject, onOpenReminder]);

  const results = useMemo(() => {
    const q = query.trim();
    // Ohne Suchbegriff: nur Aktionen und Navigation
    const pool = q ? allItems : allItems.filter((i) => i.group === 'action' || i.group === 'nav');
    const found = searchCommands(q, pool, { limitPerGroup: q ? 6 : 20 });
    return GROUP_ORDER.flatMap((g) => found.filter((i) => i.group === g));
  }, [allItems, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const runItem = (item) => {
    onClose();
    // Nach dem Schließen ausführen, damit Fokus-Rückgabe die Zielansicht nicht stört
    setTimeout(() => item.run(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) runItem(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = null;

  return (
    <div
      className="fixed inset-0 z-palette flex items-start justify-center bg-scrim px-3 pt-[10vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Befehlsleiste"
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-subtle bg-raised shadow-lg"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-subtle px-4">
          <Icon name="search" size="md" className="text-secondary" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
            placeholder="Suchen oder Befehl eingeben …"
            className="h-14 flex-1 border-0 bg-transparent px-0 text-body-lg text-primary outline-none placeholder:text-tertiary focus:ring-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul id="command-palette-list" ref={listRef} role="listbox" aria-label="Ergebnisse" className="overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-8 text-center text-body text-secondary">Nichts gefunden für „{query}“</li>
          )}
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? GROUP_LABELS[item.group] : null;
            lastGroup = item.group;
            const active = index === activeIndex;
            return (
              <React.Fragment key={item.id}>
                {header && (
                  <li role="presentation" className="px-4 pb-1 pt-3 font-label text-eyebrow uppercase text-tertiary">
                    {header}
                  </li>
                )}
                <li
                  id={`cmd-${item.id}`}
                  role="option"
                  aria-selected={active}
                  data-index={index}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                  className={cx('mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-body', active ? 'bg-selected text-primary' : 'text-primary')}
                  >
                  <span className={cx('flex w-5 shrink-0 items-center justify-center', active ? 'text-accent' : 'text-secondary')}>
                  <ItemIcon icon={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.sub && <span className="shrink-0 text-caption text-secondary">{item.sub}</span>}
                  {item.keys && !active && <KeyHint keys={item.keys} />}
                  {active && <Icon name="keyboard_return" size="sm" className="text-accent" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
