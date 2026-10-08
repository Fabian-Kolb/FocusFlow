import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 5000;

/**
 * Kurze Rückmeldung am unteren Rand („Snackbar“), optional mit Aktion wie „Rückgängig“.
 * Es ist immer nur ein Toast sichtbar; ein neuer ersetzt den alten.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const dismissToast = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback(({ message, actionLabel, onAction, icon, duration = DEFAULT_DURATION }) => {
    clearTimeout(timerRef.current);
    setToast({ id: Date.now(), message, actionLabel, onAction, icon });
    timerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  // Komfort: Rückgängig-Toast für eine gerade ausgeführte Änderung
  const showUndoToast = useCallback((message, undoFn, icon = 'check_circle') => {
    showToast({ message, icon, actionLabel: 'Rückgängig', onAction: undoFn });
  }, [showToast]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <ToastContext.Provider value={{ showToast, showUndoToast, dismissToast }}>
      {children}
      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toast, onDismiss }) {
  // Strg+Z löst die Toast-Aktion aus, solange der Toast sichtbar ist (außer beim Tippen in Feldern)
  useEffect(() => {
    if (!toast?.onAction) return;
    const handleKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const el = document.activeElement;
      const isTyping = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (isTyping) return;
      e.preventDefault();
      toast.onAction();
      onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toast, onDismiss]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed inset-x-0 z-[90] flex justify-center px-3 pointer-events-none bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] md:bottom-6"
    >
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="toast-enter pointer-events-auto flex items-center gap-3 max-w-md w-full sm:w-auto pl-4 pr-1.5 py-1.5 rounded-xl bg-primary text-on-primary shadow-2xl"
        >
          {toast.icon && (
            <span className="material-symbols-outlined text-[18px] opacity-80 shrink-0">{toast.icon}</span>
          )}
          <span className="flex-1 min-w-0 text-sm leading-snug line-clamp-2 py-2">{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
              className="shrink-0 min-h-[40px] px-3 rounded-lg text-sm font-bold text-[#7FB3FF] hover:bg-white/10 transition-colors cursor-pointer"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Meldung schließen"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

const NOOP_TOAST = { showToast: () => {}, showUndoToast: () => {}, dismissToast: () => {} };

export function useToast() {
  // Ohne Provider (z. B. in isolierten Tests) still nichts tun
  return useContext(ToastContext) || NOOP_TOAST;
}
