import React from 'react';
import { cx, FOCUS, Icon, FioMark } from './core.jsx';

const TONES = {
  neutral: 'border-default bg-subtle text-primary',
  accent: 'border-accent bg-accent-subtle text-accent',
  success: 'border-success bg-success-subtle text-success',
  info: 'border-info bg-info-subtle text-info',
  warning: 'border-warning bg-warning-subtle text-warning',
  danger: 'border-danger bg-danger-subtle text-danger',
  inverse: 'border-transparent bg-inverse text-inverse',
};
const DOTS = { neutral: 'bg-control', accent: 'bg-accent', success: 'bg-success', info: 'bg-info', warning: 'bg-warning', danger: 'bg-danger', inverse: 'bg-surface' };

/** Status mark: one or two words, sentence case, colour only with meaning. Always a word, never colour alone. */
export function Badge({ tone = 'neutral', size = 'md', icon, dot = false, className = '', children, ...rest }) {
  return (
    <span className={cx('inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-sm border',
      size === 'sm' ? 'h-5 gap-1 px-1.5 text-micro' : 'h-6 gap-1 px-2 text-caption-strong', TONES[tone] || TONES.neutral, className)} {...rest}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[tone])} aria-hidden="true" />}
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </span>
  );
}

const CARD = {
  elevated: 'border border-subtle bg-surface shadow-sm',
  outlined: 'border border-default bg-surface',
  filled: 'border border-transparent bg-subtle',
  highlight: 'border border-accent bg-surface shadow-md',
};
const PAD = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-6 sm:p-8' };

/**
 * The container. elevated (default) · outlined · filled · highlight (the ONE key tile of a screen).
 * Corners are always radius-lg. `interactive` adds hover elevation; pass `as="button"` or `as="a"` for real interaction.
 */
export function Card({ as: Tag = 'div', variant = 'elevated', padding = 'md', interactive = false, className = '', children, ...rest }) {
  return (
    <Tag className={cx('relative rounded-lg text-left', Tag === 'button' ? 'flex w-full flex-col items-stretch justify-start' : 'block', CARD[variant] || CARD.elevated, PAD[padding] ?? PAD.md,
      interactive && 'cursor-pointer transition-[box-shadow,border-color] duration-fast ease-standard hover:border-default hover:shadow-md ' + FOCUS, className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Title row of a Card: heading, optional description, one trailing action. */
export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={cx('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="text-heading text-primary">{title}</h3>
        {description && <p className="mt-0.5 text-body text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const AREA_TILE = {
  neutral: 'bg-subtle text-secondary',
  accent: 'bg-accent-subtle text-accent',
  thoughts: 'bg-area-thoughts-subtle text-area-thoughts',
  reminders: 'bg-area-reminders-subtle text-area-reminders',
  projects: 'bg-area-projects-subtle text-area-projects',
  calendar: 'bg-area-calendar-subtle text-area-calendar',
  review: 'bg-area-review-subtle text-area-review',
  coach: 'bg-inverse text-inverse',
};
const TILE_SIZE = { sm: ['h-8 w-8', 'sm', 16], md: ['h-10 w-10', 'md', 20], lg: ['h-12 w-12', 'lg', 24] };

/** Icon in a tinted square — the only place area colours fill something. area="coach" shows the Fio mark. */
export function IconTile({ area = 'neutral', icon, size = 'md', className = '' }) {
  const [box, is, px] = TILE_SIZE[size] || TILE_SIZE.md;
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-md', box, AREA_TILE[area] || AREA_TILE.neutral, className)} aria-hidden="true">
      {area === 'coach' && !icon ? <FioMark size={px} /> : <Icon name={icon} size={is} />}
    </span>
  );
}

const AV = { sm: 'h-6 w-6 text-micro', md: 'h-8 w-8 text-caption-strong', lg: 'h-10 w-10 text-body-strong' };
/** Person: photo or initials. Always round. */
export function Avatar({ name = '', src, size = 'md', className = '' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-secondary', AV[size] || AV.md, className)} title={name}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : <span aria-label={name}>{initials || <Icon name="person" size="sm" />}</span>}
    </span>
  );
}

/** Rows inside one bordered container. Put ListItems inside. */
export function ListGroup({ className = '', children, ...rest }) {
  return <div className={cx('divide-y divide-subtle overflow-hidden rounded-lg border border-subtle bg-surface', className)} role="list" {...rest}>{children}</div>;
}

/** A row: leading visual, title, description, meta, trailing control. Clickable when given onClick or href. */
export function ListItem({ leading, title, description, meta, trailing, onClick, href, selected = false, className = '' }) {
  const Tag = href ? 'a' : onClick ? 'button' : 'div';
  return (
    <Tag href={href} onClick={onClick} type={Tag === 'button' ? 'button' : undefined} role="listitem"
      className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left', selected && 'bg-selected',
        Tag !== 'div' && 'cursor-pointer transition-colors duration-fast hover:bg-hover active:bg-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus', className)}>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-strong text-primary">{title}</span>
        {description && <span className="mt-0.5 block truncate text-caption text-secondary">{description}</span>}
      </span>
      {meta && <span className="shrink-0 text-caption text-tertiary">{meta}</span>}
      {trailing}
    </Tag>
  );
}

/** Keyboard key. Show shortcuts as Strg/⌘ + K with one Kbd per key. */
export function Kbd({ className = '', children }) {
  return <kbd className={cx('inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-default bg-subtle px-1 font-code text-micro text-secondary', className)}>{children}</kbd>;
}

/** Horizontal rule, optionally with a centred label ("oder"). */
export function Divider({ label, className = '' }) {
  if (!label) return <hr className={cx('border-0 border-t border-subtle', className)} />;
  return (
    <div className={cx('flex items-center gap-3 text-caption text-tertiary', className)} role="separator">
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />{label}<span className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}

/** Uppercase label above a group, with optional count and one quiet action. */
export function SectionHeader({ title, count, action, className = '' }) {
  return (
    <div className={cx('flex min-h-8 items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 font-label text-eyebrow uppercase text-secondary">
        {title}{count != null && <span className="font-sans text-caption-strong normal-case tracking-normal text-tertiary tabular-nums">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/** Screen title block: title, one-line description, actions on the right (stacked below on mobile). */
export function PageHeader({ title, description, actions, className = '' }) {
  return (
    <header className={cx('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-title text-primary md:text-title-lg">{title}</h1>
        {description && <p className="mt-1 text-body text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Key figure with label and optional trend. */
export function Stat({ label, value, delta, trend, icon, area = 'neutral', className = '' }) {
  const up = trend === 'up';
  return (
    <div className={cx('flex items-start gap-3', className)}>
      {icon && <IconTile area={area} icon={icon} size="md" />}
      <div className="min-w-0">
        <p className="text-caption text-secondary">{label}</p>
        <p className="mt-1 font-label text-stat tabular-nums text-primary">{value}</p>
        {delta && (
          <p className={cx('mt-1 inline-flex items-center gap-0.5 text-caption-strong', trend ? (up ? 'text-success' : 'text-danger') : 'text-tertiary')}>
            {trend && <Icon name={up ? 'trending_up' : 'trending_down'} size="sm" />}{delta}
          </p>
        )}
      </div>
    </div>
  );
}
