import React from 'react';
import EnvironmentSwitcher from './EnvironmentSwitcher';

/**
 * Schmale Leiste oben am Handy (unter md) mit dem Umgebungs-Umschalter. Am Desktop sitzt er in der Seitenleiste.
 * Berücksichtigt die Statusleiste im installierten Zustand (`viewport-fit=cover`).
 */
export default function EnvironmentBar({ onSwitched }) {
  return (
    <div
      className="flex flex-shrink-0 items-center border-b border-subtle bg-canvas px-2 md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <EnvironmentSwitcher variant="bar" onSwitched={onSwitched} />
    </div>
  );
}
