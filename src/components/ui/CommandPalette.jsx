import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { searchCommands } from '../../lib/commandSearch';
import { NAV_COMMANDS, ACTION_COMMANDS } from '../../lib/appCommands';
import FioIcon from './FioIcon';

const GROUP_LABELS = {
  action: 'Aktionen',
  nav: 'Gehe zu',
  project: 'Projekte',
  reminder: 'Erinnerungen',
  thought: 'Gedanken',
};
const GROUP_ORDER = ['action', 'nav', 'project', 'reminder', 'thought'];

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-outline-variant bg-surface-low text-[10px] font-sans font-semibold text-on-surface-variant">
      {children}
    </kbd>
  );
}

export function KeyHint({ keys }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      {keys.split(' ').map((k, i) => <Kbd key={i}>{k}</Kbd>)}
    </span>
  );
}

function ItemIcon({ icon }) {
  if (icon === 'fio') return <FioIcon className="w-[18px] h-[18px]" color="currentColor" />;
  return <span className="material-symbols-outlined text-[18px]">{icon}</span>;
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
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-[2px] px-3 pt-[10vh] animate-fadeIn"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Befehlsleiste"
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[70vh]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 border-b border-outline-variant">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">search</span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
            placeholder="Suchen oder Befehl eingeben …"
            className="flex-1 h-14 bg-transparent text-base text-primary placeholder:text-on-surface-variant outline-none border-0 focus:ring-0 px-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul id="command-palette-list" ref={listRef} role="listbox" className="overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-on-surface-variant">Nichts gefunden für „{query}“</li>
          )}
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? GROUP_LABELS[item.group] : null;
            lastGroup = item.group;
            const active = index === activeIndex;
            return (
              <React.Fragment key={item.id}>
                {header && (
                  <li role="presentation" className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
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
                  className={`mx-2 px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer text-sm ${
                    active ? 'bg-primary text-on-primary' : 'text-primary'
                  }`}
                >
                  <span className={`flex items-center justify-center w-5 shrink-0 ${active ? '' : 'text-on-surface-variant'}`}>
                    <ItemIcon icon={item.icon} />
                  </span>
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                  {item.sub && (
                    <span className={`text-xs shrink-0 ${active ? 'opacity-80' : 'text-on-surface-variant'}`}>{item.sub}</span>
                  )}
                  {item.keys && !active && <KeyHint keys={item.keys} />}
                  {active && <span className="material-symbols-outlined text-[16px] opacity-80">keyboard_return</span>}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
