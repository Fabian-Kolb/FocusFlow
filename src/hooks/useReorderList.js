import { useLayoutEffect, useRef, useState } from 'react';

/** `id` an die Stelle `index` (gezählt ohne `id` selbst) schieben */
export function moveId(ids, id, index) {
  const rest = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

const getScroller = (el) => {
  let node = el?.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
};

/**
 * Senkrechte Liste per Ziehen umsortieren (Maus und Finger, nur über den Griff). Das gezogene Element folgt dem Zeiger,
 * die übrigen rutschen animiert zur Seite; erst beim Loslassen kommt `onReorder(neueIds)`. Esc bricht ab.
 * Tastatur: Pfeil hoch/runter auf dem Griff verschiebt um eine Stelle.
 *
 * Die Einträge brauchen `data-reorder-id={id}` und liegen in `rootRef`. Rückgabe: `view` (Reihenfolge inkl. Vorschau),
 * `draggingId`, `handleProps(id)` für den Griff.
 */
export function useReorderList({ ids, onReorder, rootRef }) {
  const [drag, setDrag] = useState(null); // { id, index }
  const meta = useRef(null);
  const prevTops = useRef(new Map());
  const view = drag && drag.index !== null ? moveId(ids, drag.id, drag.index) : ids;

  const nodeOf = (id) => rootRef.current?.querySelector(`[data-reorder-id="${CSS.escape(id)}"]`);
  const translateOf = (el) => {
    const t = getComputedStyle(el).transform;
    return !t || t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42;
  };

  const placeDragged = () => {
    const m = meta.current;
    const el = m && nodeOf(m.id);
    if (!el) return;
    el.style.transform = 'none';
    m.dy = m.y - m.offY - el.getBoundingClientRect().top;
    el.style.transform = `translate3d(0, ${m.dy}px, 0)`;
  };

  // Während des Ziehens: Nachbarn gleiten an den neuen Platz (FLIP), das Gezogene bleibt am Zeiger
  useLayoutEffect(() => {
    const root = rootRef.current;
    const m = meta.current;
    if (!root || !m) return;
    const next = new Map();
    root.querySelectorAll('[data-reorder-id]').forEach((el) => {
      const id = el.dataset.reorderId;
      if (id === m.id) return;
      const cur = translateOf(el);
      const top = el.getBoundingClientRect().top - cur;
      next.set(id, top);
      const prev = prevTops.current.get(id);
      if (prev !== undefined && Math.abs(prev - top) > 1) {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ transform: `translateY(${cur + prev - top}px)` }, { transform: 'translateY(0)' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
    });
    prevTops.current = next;
    placeDragged();
  });

  const start = (e, id) => {
    if (meta.current || (e.button !== undefined && e.button !== 0)) return;
    const root = rootRef.current;
    const el = nodeOf(id);
    if (!root || !el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    meta.current = { id, offY: e.clientY - rect.top, height: rect.height, y: e.clientY, dy: 0, index: null };
    prevTops.current = new Map();
    root.querySelectorAll('[data-reorder-id]').forEach((n) => {
      if (n.dataset.reorderId !== id) prevTops.current.set(n.dataset.reorderId, n.getBoundingClientRect().top);
    });
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    if (navigator.vibrate) navigator.vibrate(8);
    setDrag({ id, index: null });

    const scroller = getScroller(root);
    const update = () => {
      const m = meta.current;
      if (!m) return;
      placeDragged();
      const center = m.y - m.offY + m.height / 2;
      const others = [...root.querySelectorAll('[data-reorder-id]')].filter((n) => n.dataset.reorderId !== id);
      const index = others.filter((n) => {
        const r = n.getBoundingClientRect();
        return r.top + r.height / 2 - translateOf(n) < center;
      }).length;
      if (index !== m.index) {
        m.index = index;
        setDrag({ id, index });
      }
    };
    const onMove = (ev) => { if (meta.current) { meta.current.y = ev.clientY; update(); } };
    const timer = setInterval(() => {
      if (!scroller || !meta.current) return;
      const r = scroller.getBoundingClientRect();
      const y = meta.current.y;
      if (y < r.top + 48) scroller.scrollTop -= 10;
      else if (y > r.bottom - 48) scroller.scrollTop += 10;
      else return;
      update();
    }, 16);

    const finish = (commit) => {
      const m = meta.current;
      if (!m) return;
      clearInterval(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      const dy = m.dy || 0;
      const node = nodeOf(id);
      if (node) node.style.transform = '';
      meta.current = null;
      prevTops.current = new Map();
      setDrag(null);
      if (commit && m.index !== null) {
        const next = moveId(ids, id, m.index);
        if (next.join() !== ids.join()) onReorder(next);
      }
      requestAnimationFrame(() => {
        nodeOf(id)?.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      });
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === 'Escape') finish(false); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  };

  const handleProps = (id) => ({
    onPointerDown: (e) => start(e, id),
    onKeyDown: (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const index = ids.indexOf(id) + (e.key === 'ArrowUp' ? -1 : 1);
      if (index < 0 || index >= ids.length) return;
      onReorder(moveId(ids, id, index));
      requestAnimationFrame(() => nodeOf(id)?.querySelector('[data-reorder-handle]')?.focus());
    },
    'data-reorder-handle': true,
    style: { touchAction: 'none' },
  });

  return { view, draggingId: drag?.id || null, handleProps };
}
