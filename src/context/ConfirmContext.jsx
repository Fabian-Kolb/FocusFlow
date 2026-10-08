import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Dialog } from '../components/ui/Overlay';
import Button from '../components/ui/Button';

const ConfirmContext = createContext(null);

/**
 * Ersetzt window.confirm(): `const ok = await confirm({ title, message, confirmLabel, destructive })`.
 * Nur für Aktionen, die sich nicht per Rückgängig-Toast abfangen lassen.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setState(options);
  }), []);

  const settle = (value) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => settle(false)}
        title={state?.title}
        footer={(
          <>
            <Button variant="secondary" onClick={() => settle(false)}>{state?.cancelLabel || 'Abbrechen'}</Button>
            <Button
              data-autofocus
              variant={state?.destructive ? 'destructive' : 'primary'}
              onClick={() => settle(true)}
            >
              {state?.confirmLabel || 'Bestätigen'}
            </Button>
          </>
        )}
      >
        {state?.message}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  // Ohne Provider (isolierte Tests) auf den Browser-Dialog zurückfallen
  return confirm || (async ({ message, title }) => (typeof window !== 'undefined' ? window.confirm(message || title) : false));
}
