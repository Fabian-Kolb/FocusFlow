import React from 'react';
import { tileAreaOf } from '../../lib/areas';
import { Card, IconTile, cx } from '../ds';

/**
 * Abschnitt auf Home: Karte mit Titel, Icon-Chip (Bereichsfarbe nur dort), Zähler und optionaler Aktion.
 * `tone="danger"` rahmt die Karte rot (Überfälliges).
 */
export default function SectionCard({ title, icon, areaId, count, children, className = '', tone = 'default', action }) {
  return (
    <Card padding="none" className={cx(tone === 'danger' && 'border-danger', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-subheading text-primary">
          <IconTile area={tone === 'danger' ? 'neutral' : tileAreaOf(areaId)} icon={icon} size="sm" className={tone === 'danger' ? '!bg-danger-subtle !text-danger' : ''} />
          {title}
          {count != null && <span className="text-label text-secondary">{count}</span>}
        </h2>
        {action}
      </div>
      <div className="px-4 pb-4 pt-1 sm:px-5">{children}</div>
    </Card>
  );
}
