import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

// Gemeinsame Hülle für alle Overlays (Regel 09): Portal in den body, Esc, Fokus-Falle, Scroll-Sperre,
// role="dialog" + aria-modal. Ebenen laufen über die Tokens z-sheet / z-dialog.
//  - Sheet:  Inhalt zeigen oder bearbeiten. Desktop = Seitenpanel rechts, Handy = Bottom Sheet mit Swipe.
//  - Dialog: kurze Entscheidung (Bestätigen, Konflikt), zentriert.

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

/** Esc schließt, Tab bleibt im Panel, Fokus kehrt beim Schließen zurück, Hintergrund scrollt nicht */
function useOverlayBehavior({ active, panelRef, onClose }) {
  useEffect(() => {
    if (!active) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector('[data-autofocus]') || panel;
    first?.focus?.({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
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
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus?.({ preventScroll: true });
    };
  }, [active]);
}

const SHEET_WIDTHS = { sm: 'sm:w-[24rem]', md: 'sm:w-[30rem]', lg: 'sm:w-[38rem]' };

export function Sheet({ open, onClose, title, description, width = 'md', children, footer, hideHeader = false }) {
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

  const anim = closing ? (wasSwipedClosed ? '' : 'drawer-slide-out') : 'drawer-slide-in';

  return createPortal(
    <div className="fixed inset-0 z-sheet" data-overlay="sheet">
      <div
        className={`absolute inset-0 bg-black/40 ${closing ? 'opacity-0 transition-opacity duration-panel' : 'drawer-backdrop-fade'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        style={drawerStyle}
        className={`absolute bottom-0 inset-x-0 max-h-[92dvh] flex flex-col bg-white rounded-t-2xl shadow-sheet outline-none
          sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:max-h-none ${SHEET_WIDTHS[width] || SHEET_WIDTHS.md} sm:rounded-2xl ${anim}`}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-outline-variant" />
        </div>
        {!hideHeader && (
          <header className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-3 shrink-0">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="text-lg font-bold leading-snug">{title}</h2>}
              {description && <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="shrink-0 w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-low transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </header>
        )}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          {children}
        </div>
        {footer && <footer className="shrink-0 px-5 py-3 border-t border-outline-variant pb-safe">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function Dialog({ open, onClose, title, children, footer, size = 'sm' }) {
  const { mounted, closing } = useMounted(open, 150);
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayBehavior({ active: open && mounted, panelRef, onClose });

  if (!mounted || typeof document === 'undefined') return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

  return createPortal(
    <div className="fixed inset-0 z-dialog flex items-center justify-center p-4" data-overlay="dialog">
      <div
        className={`absolute inset-0 bg-black/45 ${closing ? 'opacity-0 transition-opacity duration-fast' : 'drawer-backdrop-fade'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative w-full ${widths[size] || widths.sm} bg-white rounded-xl shadow-raised p-5 outline-none ${closing ? 'opacity-0 transition-opacity duration-fast' : 'toast-enter'}`}
      >
        {title && <h2 id={titleId} className="text-lg font-bold leading-snug">{title}</h2>}
        <div className={title ? 'mt-2 text-sm text-on-surface-variant' : 'text-sm'}>{children}</div>
        {footer && <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
