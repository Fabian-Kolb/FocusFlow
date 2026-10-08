import React from 'react';

// Eigene Icons für Projekt-Kennzahlen. 24er-Raster, Linienstärke und Rundungen wie Material Symbols (outlined),
// damit sie neben den übrigen Icons der App nicht auffallen. Färben sich über `currentColor`.

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

/** Abschnitt: Kopfzeile mit zwei eingerückten, untergeordneten Einträgen */
export function SectionIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg {...baseProps} className={`inline-block shrink-0 ${className}`}>
      <rect x="3" y="3.5" width="18" height="5.5" rx="1.5" />
      <path d="M6.5 9v9.5h3.5" />
      <path d="M6.5 14h3.5" />
      <path d="M13.5 14h7" />
      <path d="M13.5 18.5h7" />
    </svg>
  );
}

/** Aufgabe: abgehakte Checkbox */
export function TaskIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg {...baseProps} className={`inline-block shrink-0 ${className}`}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l2.75 2.75L16 9.75" />
    </svg>
  );
}
