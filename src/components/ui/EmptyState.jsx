import React from 'react';

// Leerer Zustand als Einladung mit einer Aktion, nicht als Entschuldigung.
export default function EmptyState({ icon = 'inbox', title, children, action, className = '' }) {
  return (
    <div className={`text-center py-10 px-4 bg-white border border-dashed border-outline-variant rounded-xl ${className}`}>
      <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60 block mb-2" aria-hidden="true">{icon}</span>
      <p className="text-sm font-semibold text-primary">{title}</p>
      {children && <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
