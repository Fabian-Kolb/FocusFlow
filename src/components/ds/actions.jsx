import React, { forwardRef } from 'react';
import { cx, FOCUS, Icon, Spinner } from './core.jsx';

const BASE = 'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md border font-sans transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard disabled:cursor-not-allowed ' + FOCUS;

const VARIANTS = {
  primary: 'border-transparent bg-accent text-on-accent shadow-xs hover:bg-accent-hover active:bg-accent-pressed disabled:bg-muted disabled:text-disabled disabled:shadow-none',
  secondary: 'border-default bg-surface text-primary shadow-xs hover:border-strong active:bg-pressed disabled:border-subtle disabled:bg-surface disabled:text-disabled disabled:shadow-none',
  ghost: 'border-transparent bg-transparent text-secondary hover:bg-hover hover:text-primary active:bg-pressed disabled:bg-transparent disabled:text-disabled',
  danger: 'border-transparent bg-danger text-on-accent shadow-xs hover:bg-danger-hover disabled:bg-muted disabled:text-disabled disabled:shadow-none',
  'danger-ghost': 'border-transparent bg-transparent text-danger hover:bg-danger-subtle disabled:bg-transparent disabled:text-disabled',
};

const SIZES = {
  sm: { box: "h-8 gap-1.5 px-3 text-label-sm after:absolute after:-inset-1.5 after:content-['']", icon: 'sm', square: "h-8 w-8 after:absolute after:-inset-1.5 after:content-['']" },
  md: { box: 'h-10 gap-2 px-4 text-label', icon: 'md', square: 'h-10 w-10' },
  lg: { box: 'h-12 gap-2 px-5 text-label-lg', icon: 'md', square: 'h-12 w-12' },
};

/**
 * The only button. Colour = meaning: primary (add/save/send/confirm — once per area), secondary
 * (everything else), ghost (quiet, dense areas), danger / danger-ghost (delete).
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', leadingIcon, trailingIcon, loading = false, fullWidth = false, disabled, type = 'button', className = '', children, ...rest },
  ref,
) {
  const s = SIZES[size] || SIZES.md;
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cx(BASE, VARIANTS[variant] || VARIANTS.primary, s.box, fullWidth && 'w-full', className)} {...rest}>
      {loading ? <Spinner size={s.icon} label="" /> : leadingIcon && <Icon name={leadingIcon} size={s.icon} />}
      {children}
      {trailingIcon && !loading && <Icon name={trailingIcon} size={s.icon} />}
    </button>
  );
});

/** Square icon-only button. `label` is required: it becomes the accessible name and the native tooltip. */
export const IconButton = forwardRef(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', filled = false, loading = false, disabled, type = 'button', className = '', ...rest }, ref,
) {
  const s = SIZES[size] || SIZES.md;
  return (
    <button ref={ref} type={type} aria-label={label} title={label} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cx(BASE, VARIANTS[variant] || VARIANTS.ghost, s.square, 'p-0', className)} {...rest}>
      {loading ? <Spinner size={s.icon} label="" /> : <Icon name={icon} size={size === 'lg' ? 'lg' : s.icon} filled={filled} />}
    </button>
  );
});
