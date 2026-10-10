// Neigung des Handys für den Login-Schriftzug freigeben.
// Browser liefern Bewegungsdaten erst nach einer Berührung der Seite (iOS verlangt eine Erlaubnis,
// Samsung-Browser und Chrome liefern sonst nichts). Darum gibt es einen Knopf im Login, der dasselbe auslöst.

export const TILT_ENABLE_EVENT = 'focusflow:tilt-enable';
// Kommt der erste gültige Sensorwert an, meldet der Schriftzug das: dann braucht es keinen Knopf mehr.
export const TILT_ACTIVE_EVENT = 'focusflow:tilt-active';

/** Nur Touch-Geräte mit Bewegungssensor. Am Desktop gibt es keinen Knopf. */
export function canUseTilt() {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/** Löst die Freigabe im Schriftzug aus (siehe Wordmark3D). */
export function requestTilt() {
  window.dispatchEvent(new Event(TILT_ENABLE_EVENT));
}
