import React from 'react';
import { cx, Icon } from './core.jsx';
import { IconButton } from './actions.jsx';

const ALERT = {
  info: ['border-info bg-info-subtle', 'text-info', 'info'],
  success: ['border-success bg-success-subtle', 'text-success', 'check_circle'],
  warning: ['border-warning bg-warning-subtle', 'text-warning', 'warning'],
  danger: ['border-danger bg-danger-subtle', 'text-danger', 'error'],
  neutral: ['border-default bg-subtle', 'text-secondary', 'info'],
};

/** Inline message about the page or a section. Replaces every emoji-led hint (💡, ⚠️, 🔒). */
export function Alert({ tone = 'info', title, icon, action, onDismiss, className = '', children }) {
  const [box, fg, def] = ALERT[tone] || ALERT.info;
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-lg border p-4', box, className)}>
      <Icon name={icon || def} size="md" className={fg} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-body-strong text-primary">{title}</p>}
        {children && <div className={cx('text-body text-secondary', title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && <IconButton icon="close" label="Schließen" size="sm" onClick={onDismiss} className="-my-1 -mr-1" />}
    </div>
  );
}

const TOAST_ICON = { neutral: null, success: 'check_circle', danger: 'error', info: 'info' };
/** Short confirmation after an action, bottom centre on mobile, bottom left on desktop. One at a time; offer Rückgängig instead of a confirm dialog. */
export function Toast({ tone = 'neutral', icon, action, onClose, className = '', children }) {
  const i = icon || TOAST_ICON[tone];
  return (
    <div role="status" className={cx('flex min-h-12 w-full max-w-sm items-center gap-3 rounded-lg bg-inverse py-2 pl-4 pr-2 text-inverse shadow-lg', className)}>
      {i && <Icon name={i} size="md" />}
      <p className="min-w-0 flex-1 text-body">{children}</p>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Schließen"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-inverse opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
}
/** Text action inside a Toast. */
export function ToastAction({ className = '', children, ...rest }) {
  return <button type="button" className={cx('h-8 shrink-0 rounded-md px-2.5 text-label text-inverse underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus', className)} {...rest}>{children}</button>;
}

/** Hover/focus hint for icon-only controls and truncated text. Never put essential information only in a tooltip. */
export function Tooltip({ content, side = 'top', open, className = '', children }) {
  const pos = side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2';
  return (
    <span className={cx('group/tt relative inline-flex', className)}>
      {children}
      <span role="tooltip" className={cx('pointer-events-none absolute left-1/2 z-tooltip -translate-x-1/2 whitespace-nowrap rounded-sm bg-inverse px-2 py-1 text-caption text-inverse shadow-md transition-opacity duration-base', pos,
        open ? 'opacity-100' : 'opacity-0 group-hover/tt:opacity-100 group-hover/tt:delay-300 group-focus-within/tt:opacity-100')}>{content}</span>
    </span>
  );
}

const BAR = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };
/** Determinate progress (project completion, upload). */
export function ProgressBar({ value = 0, max = 100, tone = 'accent', size = 'md', label, showValue = false, className = '' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cx('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-caption">
          <span className="text-secondary">{label}</span>
          {showValue && <span className="font-label text-caption-strong tabular-nums text-primary">{Math.round(pct)} %</span>}
        </div>
      )}
      <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}
        className={cx('w-full overflow-hidden rounded-full bg-muted', size === 'sm' ? 'h-1' : 'h-1.5')}>
        <div className={cx('h-full rounded-full transition-[width] duration-slow ease-standard', BAR[tone] || BAR.accent)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Loading placeholder shaped like the content. For content only — actions use Button loading. */
export function Skeleton({ className = '' }) {
  return <div className={cx('animate-pulse rounded-xs bg-muted motion-reduce:animate-none', className)} aria-hidden="true" />;
}
/** Placeholder for a list of cards; announces "Wird geladen". */
export function SkeletonList({ count = 3, lines = 2, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-3', className)} role="status" aria-label="Wird geladen">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
          <Skeleton className="h-4 w-2/3" />
          {Array.from({ length: lines }).map((__, j) => <Skeleton key={j} className={cx('h-3', j === lines - 1 ? 'w-1/2' : 'w-full')} />)}
        </div>
      ))}
    </div>
  );
}

/** Empty list as an invitation: icon tile, title, one sentence, one primary action. */
export function EmptyState({ icon = 'inbox', title, description, action, secondaryAction, bordered = true, compact = false, className = '' }) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-12', bordered && 'rounded-lg border border-dashed border-default bg-surface', className)}>
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-subtle text-tertiary"><Icon name={icon} size="lg" /></span>
      <p className={cx('text-primary', compact ? 'text-body-strong' : 'text-subheading')}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-body text-secondary">{description}</p>}
      {(action || secondaryAction) && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}{secondaryAction}</div>}
    </div>
  );
}
