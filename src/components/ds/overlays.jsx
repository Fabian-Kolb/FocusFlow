import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { cx, Icon } from './core.jsx';
import { IconButton } from './actions.jsx';

// Overlays (Regel 01 §12): Portal in den body, Esc, Fokus-Falle, Fokus-Rückgabe, Scroll-Sperre,
// role="dialog" + aria-modal. Ebenen laufen über die Tokens z-sheet / z-dialog.
//  - Sheet:  Inhalt zeigen oder bearbeiten. Ab sm Seitenpanel rechts, darunter Bottom Sheet mit Swipe (Regel 07).
//  - Dialog: kurze Entscheidung oder kleines Formular, zentriert (am Handy unten).
//  - Menu:   schwebende Aktionsliste (Kontextmenü, ⋯).

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Hält das Element nach `open=false` für die Ausblend-Animation noch kurz im DOM */
function useMounted(open, exitMs) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitMs);
    return () => clearTimeout(t);
  }, [open]);
  return { mounted: open || mounted, closing };
}

// Offene Overlays als Stapel: Esc und Tab gelten nur für das oberste (z. B. Dialog über Sheet)
const overlayStack = [];

/** Esc schließt, Tab bleibt im Panel, Fokus kehrt beim Schließen zurück, Hintergrund scrollt nicht */
function useOverlayBehavior({ active, panelRef, onClose }) {
useEffect(() => {
  if (!active) return undefined;
  const token = {};
  overlayStack.push(token);
  const previouslyFocused = document.activeElement;
  const panel = panelRef.current;
  const first = panel?.querySelector('[data-autofocus]') || panel;
  first?.focus?.({ preventScroll: true });

  const onKey = (e) => {
    if (overlayStack[overlayStack.length - 1] !== token) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose?.();
      return;
    }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === firstNode || document.activeElement === panel)) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = overlayStack.indexOf(token);
      if (at >= 0) overlayStack.splice(at, 1);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus?.({ preventScroll: true });
    };
  }, [active]);
}

const SHEET_WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-drawer', lg: 'sm:max-w-[560px]' };

/**
 * Detail- oder Bearbeitungsfläche. Handy: Bottom Sheet mit Griff und Swipe zum Schließen (Regel 07);
 * ab sm schwebt es 12 px vom Rand als Seitenpanel (420 px). `side="bottom"` hält es auch am Desktop unten.
 */
export function Sheet({
  open, onClose, title, description, width = 'md', side = 'auto', children, footer,
  hideHeader = false, headerAction, ariaLabel, className = '', bodyClassName = '',
}) {
  const { mounted, closing } = useMounted(open, 230);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const titleId = useId();
  const { drawerStyle, wasSwipedClosed } = useSwipeToClose({
    isOpen: open && mounted,
    onClose,
    drawerRef: panelRef,
    scrollContainerRef: scrollRef,
    threshold: 120,
  });
  useOverlayBehavior({ active: open && mounted, panelRef, onClose });

  if (!mounted || typeof document === 'undefined') return null;

  const bottomOnly = side === 'bottom';
  const anim = closing
    ? (wasSwipedClosed ? '' : (bottomOnly ? 'drawer-slide-out-bottom' : 'drawer-slide-out'))
    : (bottomOnly ? 'drawer-slide-in-bottom' : 'drawer-slide-in');

  return createPortal(
    <div className="fixed inset-0 z-sheet" data-overlay="sheet">
      <div
        className={cx('absolute inset-0 bg-scrim', closing ? 'opacity-0 transition-opacity duration-slow' : 'drawer-backdrop-fade')}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : (ariaLabel || 'Dialog')}
        tabIndex={-1}
        style={drawerStyle}
        className={cx(
          'absolute flex flex-col border border-subtle bg-surface outline-none',
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl border-b-0 shadow-sheet',
          bottomOnly
            ? 'mx-auto w-full sm:max-w-xl'
            : cx('sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:max-h-none sm:w-[calc(100%-1.5rem)] sm:rounded-xl sm:border-b sm:shadow-lg', SHEET_WIDTHS[width] || SHEET_WIDTHS.md),
          anim,
          className,
        )}
      >
        <div className={cx('flex shrink-0 justify-center pb-1 pt-2', !bottomOnly && 'sm:hidden')} aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-control" />
        </div>
        {!hideHeader && (
          <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-2 sm:pt-5">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="text-heading text-primary">{title}</h2>}
              {description && <p className="mt-0.5 text-body text-secondary">{description}</p>}
            </div>
            <div className="-mr-2 -mt-1 flex shrink-0 items-center gap-1">
              {headerAction}
              <IconButton icon="close" label="Schließen" onClick={onClose} />
            </div>
          </header>
        )}
        <div ref={scrollRef} className={cx('min-h-0 flex-1 overflow-y-auto px-5 pb-5', bodyClassName)}>
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 gap-2 border-t border-subtle px-5 py-4 pb-safe [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

const DIALOG_WIDTHS = { sm: 'max-w-[400px]', md: 'max-w-[520px]', lg: 'max-w-[640px]' };

/**
 * Kurze Entscheidung oder kleines Formular. Der Titel sagt, was passiert; Fußzeile: sekundär links vom primären Knopf
 * (am Handy untereinander, die Hauptaktion oben).
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'sm', className = '', hideClose = false }) {
  const { mounted, closing } = useMounted(open, 150);
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  useOverlayBehavior({ active: open && mounted, panelRef, onClose });

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-dialog flex items-end justify-center p-4 sm:items-center" data-overlay="dialog">
      <div
        className={cx('absolute inset-0 bg-scrim', closing ? 'opacity-0 transition-opacity duration-fast' : 'drawer-backdrop-fade')}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full rounded-xl border border-subtle bg-surface shadow-lg outline-none',
          DIALOG_WIDTHS[size] || DIALOG_WIDTHS.sm,
          closing ? 'opacity-0 transition-opacity duration-fast' : 'toast-enter',
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start gap-3 px-6 pt-6">
            <div className="min-w-0 flex-1">
              {title && <h2 id={titleId} className="text-heading text-primary">{title}</h2>}
              {description && <p id={descId} className="mt-1 text-body text-secondary">{description}</p>}
            </div>
            {onClose && !hideClose && <IconButton icon="close" label="Schließen" size="sm" onClick={onClose} className="-mr-2 -mt-1" />}
          </div>
        )}
        {children != null && children !== false && (
          <div className={cx('px-6 text-body text-secondary', title || description ? 'pt-3' : 'pt-6')}>{children}</div>
        )}
        {footer
          ? <div className="flex flex-col-reverse gap-2 px-6 pb-6 pt-6 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">{footer}</div>
          : <div className="pb-6" />}
      </div>
    </div>,
    document.body,
  );
}

/** Schwebende Aktionsliste (Kontextmenü, ⋯). Panel radius-lg mit 4 px Einzug, die Einträge sind radius-md. */
export function Menu({ className = '', children, label, ...rest }) {
  return <div role="menu" aria-label={label} className={cx('min-w-[220px] rounded-lg border border-subtle bg-raised p-1 shadow-md', className)} {...rest}>{children}</div>;
}

export function MenuItem({ icon, shortcut, danger = false, selected = false, disabled = false, onClick, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-label transition-colors duration-fast focus-visible:outline-none disabled:cursor-not-allowed disabled:text-disabled',
        danger ? 'text-danger hover:bg-danger-subtle focus-visible:bg-danger-subtle' : 'text-primary hover:bg-hover focus-visible:bg-hover',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size="md" className={danger ? '' : 'text-secondary'} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && <Icon name="check" size="md" className="text-accent" />}
      {shortcut && <span className="font-code text-micro text-tertiary">{shortcut}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 border-t border-subtle" />;
}

export function MenuLabel({ children }) {
  return <div className="px-2.5 pb-1 pt-2 font-label text-eyebrow uppercase text-tertiary">{children}</div>;
}
