import React, { useState } from 'react';
import { cx, FOCUS, Icon, FioMark } from './core.jsx';

const ACTIVE = {
  dashboard: 'bg-accent-subtle text-accent',
  thoughts: 'bg-area-thoughts-subtle text-area-thoughts',
  reminders: 'bg-area-reminders-subtle text-area-reminders',
  projects: 'bg-area-projects-subtle text-area-projects',
  calendar: 'bg-area-calendar-subtle text-area-calendar',
  review: 'bg-area-review-subtle text-area-review',
  coach: 'bg-subtle text-primary',
  neutral: 'bg-subtle text-primary',
};

/** Sidebar / navigation entry. Active = the area's tint + filled icon; everything else stays neutral. */
export function NavItem({ icon, label, area = 'neutral', active = false, count, collapsed = false, href, onClick, className = '' }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag href={href} onClick={onClick} type={Tag === 'button' ? 'button' : undefined} aria-current={active ? 'page' : undefined} title={collapsed ? label : undefined}
      className={cx('flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-label transition-colors duration-fast', FOCUS, collapsed && 'justify-center px-0',
        active ? ACTIVE[area] || ACTIVE.neutral : 'text-secondary hover:bg-hover hover:text-primary', className)}>
      {area === 'coach' && !icon ? <FioMark size={20} /> : <Icon name={icon} size="md" filled={active} />}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && count != null && <span className="text-caption-strong tabular-nums text-tertiary">{count}</span>}
    </Tag>
  );
}

/** Switch between sibling views on one screen. Underline style. */
export function Tabs({ tabs, value, defaultValue, onChange, className = '' }) {
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.value);
  const current = value ?? inner;
  return (
    <div role="tablist" className={cx('flex gap-6 overflow-x-auto border-b border-subtle', className)}>
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <button key={t.value} role="tab" type="button" aria-selected={active}
            onClick={() => { if (value === undefined) setInner(t.value); onChange?.(t.value); }}
            className={cx('relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 text-label transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
              active ? 'border-[color:var(--bg-accent)] text-primary' : 'border-transparent text-secondary hover:text-primary')}>
            {t.icon && <Icon name={t.icon} size="sm" filled={active} />}
            {t.label}
            {t.count != null && <span className={cx('rounded-sm px-1.5 text-caption-strong tabular-nums', active ? 'bg-accent-subtle text-accent' : 'bg-subtle text-tertiary')}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
