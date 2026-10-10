import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast, ToastAction } from '../components/ds';

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

  // Meldungen aus Code ohne React-Kontext (lib/notify.js)
  useEffect(() => {
    const onNotify = (e) => showToast({ message: e.detail?.message, icon: e.detail?.icon });
    window.addEventListener('focusflow:notify', onNotify);
    return () => window.removeEventListener('focusflow:notify', onNotify);
  }, [showToast]);

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
      className="fixed inset-x-0 z-toast flex justify-center px-3 pointer-events-none bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] md:bottom-6"
    >
      {toast && (
        <Toast
          key={toast.id}
          icon={toast.icon}
          onClose={onDismiss}
          className="toast-enter pointer-events-auto"
          action={toast.actionLabel && (
            <ToastAction
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
            >
              {toast.actionLabel}
            </ToastAction>
          )}
        >
          {toast.message}
        </Toast>
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
