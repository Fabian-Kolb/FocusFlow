// Übergabe der Wortmarke vom Login in die App: Der Login hält vor dem Login Position und Standbild
// der beiden 3D-Wörter fest, die App führt von dort den Übergang aus (LoginReveal). Nur kurz gültig.
const MAX_AGE_MS = 15000;
/** Wird gesendet, sobald der Übergang vorbei ist (oder entfällt). Dialoge der App warten darauf. */
export const REVEAL_DONE_EVENT = 'focusflow:reveal-done';
let pending = null;

/** `words`: { FOCUS: { el, letters, rect? }, FLOW: { el, letters, rect? } }, `rect`: Zielposition, falls das Wort gerade gleitet (sonst die aktuelle). `letters`: je Buchstabe ein 3D-Bildausschnitt `{ canvas, fx, fy, fw, fh }` (Anteile der Zeichenfläche) oder null. */
export function captureBrandHandoff(words, theme) {
  const entry = (w) => {
    if (!w?.el) return null;
    const r = w.rect || w.el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, letters: w.letters || null };
  };
  const focus = entry(words.FOCUS);
  const flow = entry(words.FLOW);
  if (!focus || !flow) return;
  pending = { FOCUS: focus, FLOW: flow, theme, at: Date.now() };
}

export function peekBrandHandoff() {
  if (!pending) return null;
  if (Date.now() - pending.at > MAX_AGE_MS) {
    pending = null;
    return null;
  }
  return pending;
}

export function clearBrandHandoff() {
  const wasPending = pending !== null;
  pending = null;
  if (wasPending && typeof window !== 'undefined') window.dispatchEvent(new Event(REVEAL_DONE_EVENT));
}
