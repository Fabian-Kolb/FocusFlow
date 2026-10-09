import React from 'react';

/** Join class names, skipping falsy values. */
export const cx = (...c) => c.filter(Boolean).join(' ');

/** The one focus treatment: 2px focus-ring with a 2px gap, keyboard only. */
export const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const ICON_PX = { sm: 16, md: 20, lg: 24, xl: 40 };

/**
 * Material Symbols Outlined icon. The only icon source besides the brand marks — never emoji.
 * size: sm 16 · md 20 (default) · lg 24 · xl 40. filled: active/selected state only.
 */
export function Icon({ name, size = 'md', filled = false, weight = 400, label, className = '', style, ...rest }) {
  const px = typeof size === 'number' ? size : ICON_PX[size] || 20;
  return (
    <span
      className={cx('material-symbols-outlined inline-flex shrink-0 select-none items-center justify-center overflow-hidden leading-none', className)}
      style={{ fontSize: px, width: px, height: px, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, px))}`, ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...rest}
    >
      {name}
    </span>
  );
}

/** Indeterminate loading indicator. Inherits colour from text. */
export function Spinner({ size = 'md', label = 'Wird geladen', className = '' }) {
  const px = ICON_PX[size] || 20;
  return (
    <svg className={cx('animate-spin shrink-0', className)} width={px} height={px} viewBox="0 0 24 24" fill="none" role="status" aria-label={label}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Fio, the AI coach — a speech bubble holding a bold, flowing F. Drawn on the Material Symbols grid
 * (24px, 2px outline, round joins) so it sits with the other icons; the heavier F is what sets it apart.
 * Marks every AI feature instead of sparkles or emoji. Inherits currentColor.
 */
export function FioMark({ size = 20, label, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
      className={cx('inline-block shrink-0', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M3 6.5A3.5 3.5 0 0 1 6.5 3h11A3.5 3.5 0 0 1 21 6.5v8a3.5 3.5 0 0 1-3.5 3.5H9.5L3 22z" strokeWidth="1.75" />
      <path d="M9.5 15V10.4C9.5 8.5 10.7 7.3 12.6 7.3H15.5M9.5 11.4H13.5" strokeWidth="2.4" />
    </svg>
  );
}
