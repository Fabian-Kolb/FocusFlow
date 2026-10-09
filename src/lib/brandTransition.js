// Übergabe der Wortmarke vom Login in die App: Der Login hält vor dem Login Position und Standbild
// der beiden 3D-Wörter fest, die App fliegt sie von dort ins Logo (BrandFlight). Nur kurz gültig.
const MAX_AGE_MS = 15000;
let pending = null;

/** `words`: { FOCUS: { el, image }, FLOW: { el, image } }, `image` ist ein PNG-Standbild des 3D-Wortes oder null. */
export function captureBrandHandoff(words, theme) {
  const entry = (w) => {
    if (!w?.el) return null;
    const r = w.el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, image: w.image || null };
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
  pending = null;
}
