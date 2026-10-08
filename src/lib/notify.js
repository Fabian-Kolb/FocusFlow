// Kurze Rückmeldung aus Code ohne React-Kontext (Hooks, lib/*): wird vom ToastProvider als Toast angezeigt.
export function notify(message, icon = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('focusflow:notify', { detail: { message, icon } }));
}
