import React from 'react';
import { ageLabel } from '../../lib/taskOverview';
import { Badge, FOCUS, IconTile, cx } from '../ds';
import SectionCard from '../overview/SectionCard';

/** Arbeit auf Home: Worauf wartest du? Einträge mit gesetztem Feld „Wartet auf“, am längsten wartend zuerst. */
export function WaitingSection({ items, now, onOpen, className }) {
  if (items.length === 0) return null;
  return (
    <SectionCard title="Wartet auf" icon="hourglass_top" areaId="reminders" count={items.length} className={className}>
      <ul className="divide-y divide-subtle">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className={cx('relative flex w-full items-center gap-3 rounded-md py-2 text-left', "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']", FOCUS)}
            >
              <IconTile icon="hourglass_top" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-strong text-primary">{item.title}</span>
                <span className="block truncate text-caption text-secondary">{item.waitingFor}</span>
              </span>
              <Badge tone="neutral" size="sm" className="shrink-0">{ageLabel(item, now).replace('Seit ', '').replace(' offen', '')}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
