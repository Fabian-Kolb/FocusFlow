import React from 'react';
import { Badge, CheckButton, FOCUS, cx } from '../ds';

/**
 * Eine Aufgaben-Zeile: Haken, Titel (öffnet die Erinnerung), optional Untertitel, Frist-Badge und eigene Aktion.
 * Gehört in eine `<ul className="divide-y divide-subtle">`.
 */
export default function TaskRow({ reminder, subtitle, badge, trailing, onToggle, onOpen }) {
  const done = reminder.status === 'ABGESCHLOSSEN';
  return (
    <li className="flex items-center gap-3 py-2">
      <CheckButton checked={done} tone="success" label={`${reminder.title} abhaken`} onClick={() => onToggle(reminder)} />
      <button
        type="button"
        onClick={() => onOpen(reminder)}
        className={cx('relative min-w-0 flex-1 rounded-md text-left', "after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']", FOCUS)}
      >
        <span className={cx('block truncate text-body-strong', done ? 'text-secondary line-through' : 'text-primary')}>
          {reminder.title}
        </span>
        {subtitle && <span className="block truncate text-caption text-secondary">{subtitle}</span>}
      </button>
      {badge && <Badge tone={badge.tone} size="sm" className="shrink-0">{badge.text}</Badge>}
      {trailing}
    </li>
  );
}
