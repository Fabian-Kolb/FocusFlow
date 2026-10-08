// App-Kurzbefehle aus dem Manifest (`shortcuts`) öffnen FocusFlow mit `?action=…`.
export const LAUNCH_ACTIONS = ['voice-thought', 'new-reminder'];

/**
 * Liest die Startaktion aus der URL und entfernt den Parameter,
 * damit ein Neuladen die Aktion nicht erneut auslöst.
 */
export function consumeLaunchAction() {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const action = url.searchParams.get('action');
    if (!action) return null;
    url.searchParams.delete('action');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    return LAUNCH_ACTIONS.includes(action) ? action : null;
  } catch {
    return null;
  }
}
