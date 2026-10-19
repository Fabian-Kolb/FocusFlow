import React from 'react';
import FioCharacter from '../brand/fio/FioCharacter';

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
 * Fio, the AI coach — his face. The mark for every AI feature instead of sparkles or emoji: just the head
 * (eyes follow the pointer, blink, show feelings), optionally with hands and feet for bigger appearances.
 * The size is the square the figure fills; colours come from the inverse tokens, so it works in both themes.
 * mood: idle | listening | thinking | talking | happy | surprised | scared | sleepy | confused
 */
export function FioMark({ size = 20, label, className = '', mood = 'idle', hands = false, feet = false }) {
  return (
    <FioCharacter
      mood={mood}
      hands={hands}
      feet={feet}
      label={label || ''}
      className={cx('inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}
