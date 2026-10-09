import React, { forwardRef, useId, useState, cloneElement, isValidElement } from 'react';
import { cx, FOCUS, Icon } from './core.jsx';

const CONTROL = 'w-full rounded-md border bg-surface text-primary placeholder:text-tertiary transition-[border-color,box-shadow] duration-fast ease-standard focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-disabled disabled:border-subtle';
const STATE = (invalid) => invalid
  ? 'border-danger-strong focus:border-transparent focus:ring-danger'
  : 'border-control hover:border-strong focus:border-transparent focus:ring-focus';
const H = { sm: 'h-8 text-body', md: 'h-10 text-body', lg: 'h-12 text-body-lg' };

/** Single-line text input. Same heights as Button: sm 32 · md 40 · lg 48. */
export const Input = forwardRef(function Input({ size = 'md', invalid = false, leadingIcon, trailing, className = '', ...rest }, ref) {
  return (
    <div className={cx('relative flex w-full items-center', className)}>
      {leadingIcon && <Icon name={leadingIcon} size={size === 'sm' ? 'sm' : 'md'} className="pointer-events-none absolute left-3 text-tertiary" />}
      <input ref={ref} aria-invalid={invalid || undefined}
        className={cx(CONTROL, STATE(invalid), H[size] || H.md, leadingIcon ? (size === 'sm' ? 'pl-8' : 'pl-10') : 'pl-3', trailing ? 'pr-10' : 'pr-3')} {...rest} />
      {trailing && <div className="absolute right-1 flex items-center">{trailing}</div>}
    </div>
  );
});

/** Multi-line text input; grows by dragging, min 96px. */
export const Textarea = forwardRef(function Textarea({ invalid = false, rows = 4, className = '', ...rest }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined}
    className={cx(CONTROL, STATE(invalid), 'min-h-24 resize-y px-3 py-2.5 text-body', className)} {...rest} />;
});

/** Native select, styled like Input. Pass <option> children. */
export const Select = forwardRef(function Select({ size = 'md', invalid = false, className = '', children, ...rest }, ref) {
  return (
    <div className={cx('relative flex w-full items-center', className)}>
      <select ref={ref} aria-invalid={invalid || undefined}
        className={cx(CONTROL, STATE(invalid), H[size] || H.md, 'cursor-pointer appearance-none pl-3 pr-10')} {...rest}>{children}</select>
      <Icon name="expand_more" size="md" className="pointer-events-none absolute right-2.5 text-secondary" />
    </div>
  );
});

/**
 * Label + control + hint/error. Wires id, aria-describedby and aria-invalid into its single child.
 * Mark the exception: optional fields say "(optional)"; required is the default.
 */
export function Field({ label, hint, error, optional = false, children, className = '' }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const child = isValidElement(children)
    ? cloneElement(children, { id: children.props.id || id, invalid: !!error || children.props.invalid, 'aria-describedby': hint || error ? hintId : undefined })
    : children;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={children?.props?.id || id} className="text-label text-primary">
          {label}{optional && <span className="ml-1 font-normal text-tertiary">(optional)</span>}
        </label>
      )}
      {child}
      {error ? (
        <p id={hintId} className="flex items-center gap-1 text-caption text-danger"><Icon name="error" size="sm" />{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

function ChoiceLabel({ label, description }) {
  if (!label) return null;
  return (
    <span className="flex flex-col">
      <span className="text-body text-primary group-has-[:disabled]:text-disabled">{label}</span>
      {description && <span className="text-caption text-secondary group-has-[:disabled]:text-disabled">{description}</span>}
    </span>
  );
}

/** Checkbox with label. 18px box, radius-xs; checked = bg-accent. */
export const Checkbox = forwardRef(function Checkbox({ label, description, className = '', ...rest }, ref) {
  return (
    <label className={cx('group inline-flex cursor-pointer items-start gap-2.5 has-[:disabled]:cursor-not-allowed', className)}>
      <span className="relative mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input ref={ref} type="checkbox" className="peer absolute inset-0 m-0 cursor-[inherit] appearance-none rounded-xs border border-control bg-surface transition-colors duration-instant checked:border-transparent checked:bg-accent hover:border-strong checked:hover:bg-accent-hover disabled:border-subtle disabled:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface" {...rest} />
        <svg className="pointer-events-none relative h-3 w-3 text-on-accent opacity-0 peer-checked:opacity-100" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <ChoiceLabel label={label} description={description} />
    </label>
  );
});

/** Radio with label. Group radios with the same `name` inside a fieldset with a legend. */
export const Radio = forwardRef(function Radio({ label, description, className = '', ...rest }, ref) {
  return (
    <label className={cx('group inline-flex cursor-pointer items-start gap-2.5 has-[:disabled]:cursor-not-allowed', className)}>
      <span className="relative mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input ref={ref} type="radio" className="peer absolute inset-0 m-0 cursor-[inherit] appearance-none rounded-full border border-control bg-surface transition-colors duration-instant checked:border-[5px] checked:border-[color:var(--bg-accent)] hover:border-strong checked:hover:border-[color:var(--bg-accent-hover)] disabled:border-subtle disabled:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface" {...rest} />
      </span>
      <ChoiceLabel label={label} description={description} />
    </label>
  );
});

/** On/off for settings that apply immediately. For choices in a form that is saved later, use Checkbox. */
export function Switch({ checked, defaultChecked = false, onChange, label, description, disabled = false, className = '' }) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  const toggle = () => { if (disabled) return; if (checked === undefined) setInner(!on); onChange?.(!on); };
  return (
    <label className={cx('group inline-flex items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)}>
      <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={toggle}
        className={cx('relative mt-px inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-instant ease-standard disabled:opacity-50', on ? 'bg-accent' : 'bg-control', FOCUS)}>
        <span className={cx('h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-instant ease-standard', on ? 'translate-x-4' : 'translate-x-0')} />
      </button>
      {label && (
        <span className="flex flex-col">
          <span className={cx('text-body', disabled ? 'text-disabled' : 'text-primary')}>{label}</span>
          {description && <span className="text-caption text-secondary">{description}</span>}
        </span>
      )}
    </label>
  );
}

/** Toggleable filter chip (categories, tags). Not for actions — use Button. */
export function Chip({ selected = false, leadingIcon, count, className = '', children, ...rest }) {
  return (
    <button type="button" aria-pressed={selected}
      className={cx('relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-label-sm transition-colors duration-fast', FOCUS,
        "after:absolute after:-inset-1.5 after:content-['']",
        selected ? 'border-accent bg-accent-subtle text-accent' : 'border-default bg-surface text-secondary hover:border-strong hover:text-primary', className)} {...rest}>
      {leadingIcon && <Icon name={leadingIcon} size="sm" filled={selected} />}
      {children}
      {count != null && <span className={cx('text-caption-strong tabular-nums', selected ? 'text-accent' : 'text-tertiary')}>{count}</span>}
    </button>
  );
}
