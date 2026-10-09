import { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react';

/**
 * useBoardSort – Drag & Drop für Kategorien UND Karten (Projekte / Erinnerungen).
 *
 * Gleiche Mechanik wie der Fio-Entwurfs-Editor:
 * - Das echte Element wird angehoben (Schatten, scale 1.02) und folgt dem Finger per DOM-Transform.
 * - Die übrigen Elemente weichen per FLIP-Animation (Web Animations API) zur Seite.
 * - Die Vorschau-Reihenfolge lebt nur im lokalen State; erst beim Loslassen wird gespeichert.
 * - Beim Loslassen rastet das Element sanft ein. Escape bricht ab.
 *
 * Eingabe:
 * - Kategorien: Griff in der Kopfzeile, sofort (Maus und Touch). Beim Ziehen klappen alle Kategorien ein.
 * - Karten: Maus ab 5 px Bewegung (Klick bleibt Klick), Touch per 400-ms-Long-Press mit Vibration.
 *   Karten lassen sich innerhalb der Kategorie umsortieren und in andere Kategorien ziehen
 *   (eingeklappte Kategorien öffnen sich nach kurzem Verweilen).
 *
 * DOM-Vertrag: Kategorie-Abschnitt `data-cat-section={id}`, Karte `data-card-id={id}`.
 */

export const LIFT_CLASS = 'relative z-10 bg-surface shadow-lg ring-1 ring-focus rounded-lg cursor-grabbing';

const LONG_PRESS_MS = 400;
const MOUSE_THRESHOLD = 5;
const TOUCH_SLOP = 8;
const EXPAND_DELAY_MS = 500;
// Nach einem Platzwechsel muss der Zeiger sich mindestens so weit bewegen, bevor der nächste greift (verhindert Zittern)
const SWITCH_DEADZONE = 28;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const sectionSel = (id) => `[data-cat-section="${id}"]`;
const cardSel = (id) => `[data-card-id="${id}"]`;
const isInteractive = (el) =>
  !!el?.closest?.('button, a, input, textarea, select, [data-no-drag]');

const matrixOf = (el) => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(t);
  return { x: m.m41, y: m.m42 };
};

/** Rechteck an der endgültigen Layout-Position (ohne FLIP-Animation von Element und Abschnitt) */
const layoutRect = (el) => {
  const r = el.getBoundingClientRect();
  const t = matrixOf(el);
  const sec = el.closest('[data-cat-section]');
  const st = sec && sec !== el ? matrixOf(sec) : { x: 0, y: 0 };
  const dx = t.x + st.x;
  const dy = t.y + st.y;
  return { left: r.left - dx, right: r.right - dx, top: r.top - dy, bottom: r.bottom - dy, width: r.width, height: r.height };
};

const getScroller = (el) => {
  let node = el?.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const pointOf = (e) => {
  const t = e.touches?.[0] || e.changedTouches?.[0];
  return t ? { x: t.clientX, y: t.clientY } : { x: e.clientX, y: e.clientY };
};

/** Layout-Positionen (ohne laufende Animation) für FLIP: Abschnitte relativ zur Wurzel, Karten relativ zu ihrem Abschnitt */
function takeSnapshot(root, kind, draggedId) {
  const snap = new Map();
  const rootRect = root.getBoundingClientRect();
  root.querySelectorAll('[data-cat-section]').forEach((el) => {
    const id = el.dataset.catSection;
    if (kind === 'cat' && id === draggedId) return;
    const t = matrixOf(el);
    const r = el.getBoundingClientRect();
    snap.set(`s:${id}`, { el, parent: null, x: r.left - rootRect.left - t.x, y: r.top - rootRect.top - t.y, tx: t.x, ty: t.y });
  });
  if (kind === 'item') {
    root.querySelectorAll('[data-card-id]').forEach((el) => {
      const id = el.dataset.cardId;
      if (id === draggedId) return;
      const sec = el.closest('[data-cat-section]');
      if (!sec) return;
      const sr = sec.getBoundingClientRect();
      const t = matrixOf(el);
      const r = el.getBoundingClientRect();
      snap.set(`c:${id}`, { el, parent: sec.dataset.catSection, x: r.left - sr.left - t.x, y: r.top - sr.top - t.y, tx: t.x, ty: t.y });
    });
  }
  return snap;
}

export function useBoardSort({
  rootRef,
  categories, // geordnete Kategorien [{ id, isExpanded, … }]
  itemsByCategory, // { [categoryId]: [{ id, … }] } in Anzeigereihenfolge
  onReorderCategories, // (neueKategorien[]) => void
  onMoveItem, // (itemId, categoryId, orderedIds[]) => void  (orderedIds = Ziel-Kategorie inkl. Element)
  onCategoryDragStart, // () => void   (z. B. alle einklappen)
  onCategoryDragEnd, // (gespeicherteExpandStates) => void
  onExpandCategory, // (categoryId) => void
}) {
  const [drag, setDrag] = useState(null); // { kind, id, catId, index, originCatId, originIndex }
  const meta = useRef(null);
  const pressRef = useRef(null);
  const abortRef = useRef(null);
  const prevSnap = useRef(new Map());

  const latest = useRef({});
  latest.current = {
    categories, itemsByCategory, onReorderCategories, onMoveItem,
    onCategoryDragStart, onCategoryDragEnd, onExpandCategory,
  };

  // Vorschau: Reihenfolge mit dem gezogenen Element an der aktuellen Zielposition
  const view = useMemo(() => {
    if (!drag) return { categories, itemsByCategory };
    if (drag.kind === 'cat') {
      const dragged = categories.find((c) => c.id === drag.id);
      if (!dragged) return { categories, itemsByCategory };
      const next = categories.filter((c) => c.id !== drag.id);
      next.splice(Math.min(drag.index, next.length), 0, dragged);
      return { categories: next, itemsByCategory };
    }
    const map = {};
    let item = null;
    Object.entries(itemsByCategory).forEach(([cid, list]) => {
      map[cid] = list.filter((i) => {
        if (i.id === drag.id) {
          item = i;
          return false;
        }
        return true;
      });
    });
    if (item && drag.catId && map[drag.catId]) {
      const next = [...map[drag.catId]];
      next.splice(Math.min(drag.index, next.length), 0, item);
      map[drag.catId] = next;
    }
    return { categories, itemsByCategory: map };
  }, [drag, categories, itemsByCategory]);

  // ── Gezogenes Element dem Zeiger nachführen ────────────────────────────────
  const positionDragged = useCallback(() => {
    const m = meta.current;
    const root = rootRef.current;
    if (!m || !root) return;
    const el = root.querySelector(m.kind === 'cat' ? sectionSel(m.id) : cardSel(m.id));
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = 'none';
    const r = el.getBoundingClientRect();
    m.h = r.height;
    const dx = m.kind === 'cat' ? 0 : m.x - m.offX - r.left;
    const dy = m.y - m.offY - r.top;
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.02)`;
    m.visualLeft = r.left + dx;
    m.visualTop = r.top + dy;
  }, [rootRef]);

  // ── Zielposition bestimmen ─────────────────────────────────────────────────
  const computeTarget = useCallback(() => {
    const m = meta.current;
    const root = rootRef.current;
    const L = latest.current;
    if (!m || !root) return null;

    if (m.kind === 'cat') {
      const cy = m.y - m.offY + m.h / 2;
      const rest = L.categories.filter((c) => c.id !== m.id);
      let index = rest.length;
      for (let i = 0; i < rest.length; i += 1) {
        const el = root.querySelector(sectionSel(rest[i].id));
        if (!el) continue;
        const r = layoutRect(el);
        if (r.height === 0) continue;
        if (cy < r.top + r.height / 2) {
          index = i;
          break;
        }
      }
      return { catId: null, index };
    }

    // Karte: Kategorie unter dem Zeiger (sonst die nächstgelegene)
    let best = null;
    let bestD = Infinity;
    L.categories.forEach((c) => {
      const el = root.querySelector(sectionSel(c.id));
      if (!el) return;
      const r = layoutRect(el);
      if (!r.height) return;
      const d = m.y < r.top ? r.top - m.y : m.y > r.bottom ? m.y - r.bottom : 0;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    });
    if (!best) return null;

    const base = (L.itemsByCategory[best.id] || []).filter((i) => i.id !== m.id);
    if (!best.isExpanded) return { catId: best.id, index: base.length, collapsed: true };

    const secEl = root.querySelector(sectionSel(best.id));
    const cards = base.map((i) => secEl?.querySelector(cardSel(i.id))).filter(Boolean);
    if (cards.length === 0) return { catId: best.id, index: 0 };

    // Raster: erst die Zeile unter dem Zeiger bestimmen, dann innerhalb der Zeile nach x einsortieren.
    // (DOM-Reihenfolge = zeilenweise; Grenze zwischen zwei Zeilen = Mitte der Lücke.)
    const rects = cards.map(layoutRect);
    const rows = [];
    rects.forEach((r, i) => {
      const row = rows.find((rw) => Math.abs(rw.top - r.top) < r.height * 0.5);
      if (row) {
        row.items.push(i);
        row.bottom = Math.max(row.bottom, r.bottom);
      } else {
        rows.push({ top: r.top, bottom: r.bottom, items: [i] });
      }
    });
    rows.sort((p, q) => p.top - q.top);
    let rowIdx = rows.length - 1;
    for (let k = 0; k < rows.length; k += 1) {
      const next = rows[k + 1];
      if (!next || m.y < (rows[k].bottom + next.top) / 2) {
        rowIdx = k;
        break;
      }
    }
    const row = rows[rowIdx];
    let pos = row.items.length;
    for (let j = 0; j < row.items.length; j += 1) {
      const r = rects[row.items[j]];
      if (m.x < r.left + r.width / 2) {
        pos = j;
        break;
      }
    }
    return { catId: best.id, index: row.items[0] + pos };
  }, [rootRef]);

  // ── FLIP + Nachführen nach jedem Render während des Ziehens ────────────────
  useLayoutEffect(() => {
    const m = meta.current;
    const root = rootRef.current;
    if (!m || !root) return;
    const next = takeSnapshot(root, m.kind, m.id);
    next.forEach((cur, key) => {
      const prev = prevSnap.current.get(key);
      if (!prev || prev.parent !== cur.parent) return;
      const dx = prev.x - cur.x;
      const dy = prev.y - cur.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      cur.el.getAnimations().forEach((a) => a.cancel());
      cur.el.animate(
        [{ transform: `translate(${cur.tx + dx}px, ${cur.ty + dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 220, easing: EASE }
      );
    });
    prevSnap.current = next;
    positionDragged();
  });

  // ── Ziehen starten ─────────────────────────────────────────────────────────
  const activate = useCallback((kind, id, pt, anchor, source) => {
    const root = rootRef.current;
    const L = latest.current;
    if (!root || meta.current) return;
    const el = root.querySelector(kind === 'cat' ? sectionSel(id) : cardSel(id));
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    const r = el.getBoundingClientRect();

    let origin;
    if (kind === 'cat') {
      origin = { catId: null, index: Math.max(0, L.categories.findIndex((c) => c.id === id)) };
    } else {
      origin = { catId: null, index: 0 };
      Object.entries(L.itemsByCategory).forEach(([cid, list]) => {
        const idx = list.findIndex((i) => i.id === id);
        if (idx !== -1) origin = { catId: cid, index: idx };
      });
    }

    const m = {
      kind, id, source,
      x: pt.x, y: pt.y,
      offX: anchor.x - r.left,
      offY: kind === 'cat' ? Math.min(anchor.y - r.top, 40) : anchor.y - r.top,
      h: r.height,
      origin,
      target: { catId: origin.catId, index: origin.index },
      lastKey: `${origin.catId}:${origin.index}`,
      switchX: pt.x - SWITCH_DEADZONE * 2, // erster Wechsel sofort erlaubt
      switchY: pt.y - SWITCH_DEADZONE * 2,
      savedStates: null,
      hoverCat: null,
      hoverTimer: null,
    };
    meta.current = m;
    prevSnap.current = takeSnapshot(root, kind, id);

    if (kind === 'cat') {
      const states = {};
      L.categories.forEach((c) => { states[c.id] = c.isExpanded; });
      m.savedStates = states;
      L.onCategoryDragStart?.();
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    setDrag({ kind, id, catId: origin.catId, index: origin.index, originCatId: origin.catId, originIndex: origin.index });
    positionDragged();

    const scroller = getScroller(root);

    const tick = () => {
      const cur = meta.current;
      if (!cur) return;
      positionDragged();
      const t = computeTarget();
      if (!t) return;

      // Eingeklappte Kategorie: nach kurzem Verweilen öffnen
      if (t.collapsed) {
        if (cur.hoverCat !== t.catId) {
          clearTimeout(cur.hoverTimer);
          cur.hoverCat = t.catId;
          cur.hoverTimer = setTimeout(() => latest.current.onExpandCategory?.(t.catId), EXPAND_DELAY_MS);
        }
      } else if (cur.hoverCat) {
        clearTimeout(cur.hoverTimer);
        cur.hoverCat = null;
      }

      const key = `${t.catId}:${t.index}`;
      if (key !== cur.lastKey) {
        // Zittern vermeiden: nach einem Wechsel erst nach genug Zeigerbewegung wieder wechseln
        if (Math.hypot(cur.x - cur.switchX, cur.y - cur.switchY) < SWITCH_DEADZONE) return;
        cur.switchX = cur.x;
        cur.switchY = cur.y;
        cur.lastKey = key;
        cur.target = { catId: t.catId, index: t.index };
        setDrag((d) => (d ? { ...d, catId: t.catId, index: t.index } : d));
        if (navigator.vibrate) {
          try { navigator.vibrate(12); } catch (_) { /* nicht unterstützt */ }
        }
      }
    };

    const onMove = (ev) => {
      if (!meta.current) return;
      if (ev.cancelable && ev.type === 'touchmove') ev.preventDefault();
      const p = pointOf(ev);
      meta.current.x = p.x;
      meta.current.y = p.y;
      tick();
    };

    const timer = setInterval(() => {
      const cur = meta.current;
      if (!cur) return;
      const sr = scroller === document.scrollingElement || scroller === document.documentElement
        ? { top: 0, bottom: window.innerHeight }
        : scroller.getBoundingClientRect();
      const edge = 90;
      let speed = 0;
      if (cur.y < sr.top + edge) speed = -Math.max(4, Math.round(((sr.top + edge - cur.y) / edge) * 22));
      else if (cur.y > sr.bottom - edge) speed = Math.max(4, Math.round(((cur.y - (sr.bottom - edge)) / edge) * 22));
      if (speed) scroller.scrollTop += speed; // löst das Scroll-Ereignis aus, das tick() aufruft
    }, 16);

    const onScroll = () => tick();

    const cleanupListeners = () => {
      clearInterval(timer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onCancel);
      window.removeEventListener('keydown', onKey);
      (scroller === document.documentElement || scroller === document.scrollingElement ? window : scroller)
        .removeEventListener('scroll', onScroll);
    };

    const finish = (commit) => {
      const cur = meta.current;
      if (!cur) return;
      cleanupListeners();
      clearTimeout(cur.hoverTimer);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const node = root.querySelector(cur.kind === 'cat' ? sectionSel(cur.id) : cardSel(cur.id));
      if (node) {
        node.style.transform = '';
        node.style.transition = '';
      }
      const from = { left: cur.visualLeft, top: cur.visualTop };
      const { kind: k, id: dragId, origin: o, target: tg, savedStates } = cur;
      const Lc = latest.current;
      meta.current = null;
      abortRef.current = null;
      prevSnap.current = new Map();
      setDrag(null);

      if (k === 'cat') {
        if (commit && tg.index !== o.index) {
          const dragged = Lc.categories.find((c) => c.id === dragId);
          const rest = Lc.categories.filter((c) => c.id !== dragId);
          rest.splice(Math.min(tg.index, rest.length), 0, dragged);
          Lc.onReorderCategories?.(rest);
        }
        Lc.onCategoryDragEnd?.(savedStates);
      } else if (commit && tg.catId && (tg.catId !== o.catId || tg.index !== o.index)) {
        const rest = (Lc.itemsByCategory[tg.catId] || []).filter((i) => i.id !== dragId).map((i) => i.id);
        rest.splice(Math.min(tg.index, rest.length), 0, dragId);
        Lc.onMoveItem?.(dragId, tg.catId, rest);
      }

      // Klick direkt nach dem Loslassen nicht als Öffnen werten
      const swallow = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.removeEventListener('click', swallow, true);
      };
      window.addEventListener('click', swallow, true);
      setTimeout(() => window.removeEventListener('click', swallow, true), 200);

      // Sanft einrasten: vom Loslass-Punkt zum endgültigen Platz
      requestAnimationFrame(() => {
        const settled = root.querySelector(k === 'cat' ? sectionSel(dragId) : cardSel(dragId));
        if (!settled || from.top == null) return;
        const r = settled.getBoundingClientRect();
        settled.animate(
          [
            { transform: `translate(${from.left - r.left}px, ${from.top - r.top}px) scale(1.02)` },
            { transform: 'translate(0, 0) scale(1)' },
          ],
          { duration: 220, easing: EASE }
        );
      });
    };

    function onUp() { finish(true); }
    function onCancel() { finish(false); }
    function onKey(ev) { if (ev.key === 'Escape') finish(false); }

    abortRef.current = () => finish(false);

    if (source === 'touch') {
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
      window.addEventListener('touchcancel', onCancel);
    } else {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    window.addEventListener('keydown', onKey);
    (scroller === document.documentElement || scroller === document.scrollingElement ? window : scroller)
      .addEventListener('scroll', onScroll, { passive: true });
  }, [rootRef, positionDragged, computeTarget]);

  // ── Eingabe: Kategorie-Griff (sofort) ──────────────────────────────────────
  const startCategoryDrag = useCallback((e, id) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (meta.current) return;
    const isTouch = e.type === 'touchstart';
    if (!isTouch) {
      e.preventDefault();
      e.stopPropagation();
    }
    const pt = pointOf(e);
    activate('cat', id, pt, pt, isTouch ? 'touch' : 'mouse');
  }, [activate]);

  // ── Eingabe: Karte (Maus-Schwelle bzw. Touch-Long-Press) ───────────────────
  const cancelPress = useCallback(() => {
    if (pressRef.current) {
      pressRef.current();
      pressRef.current = null;
    }
  }, []);

  const startItemPress = useCallback((e, id) => {
    if (meta.current || isInteractive(e.target)) return;
    cancelPress();
    const isTouch = e.type === 'touchstart';
    if (!isTouch && e.button !== 0) return;
    const start = pointOf(e);

    if (isTouch) {
      const onMove = (te) => {
        const t = te.touches[0];
        if (t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > TOUCH_SLOP) cancelPress();
      };
      const onEnd = () => cancelPress();
      const block = (ce) => ce.preventDefault(); // Android öffnet beim Halten sonst das Kontextmenü
      const timer = setTimeout(() => {
        cancelPress();
        if (navigator.vibrate) {
          try { navigator.vibrate(45); } catch (_) { /* nicht unterstützt */ }
        }
        activate('item', id, start, start, 'touch');
      }, LONG_PRESS_MS);
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
      window.addEventListener('contextmenu', block);
      pressRef.current = () => {
        clearTimeout(timer);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
        setTimeout(() => window.removeEventListener('contextmenu', block), 1500);
      };
    } else {
      const onMove = (me) => {
        if (Math.hypot(me.clientX - start.x, me.clientY - start.y) > MOUSE_THRESHOLD) {
          cancelPress();
          activate('item', id, { x: me.clientX, y: me.clientY }, start, 'mouse');
        }
      };
      const onUp = () => cancelPress();
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      pressRef.current = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }
  }, [activate, cancelPress]);

  // Aufräumen beim Verlassen des Screens
  useEffect(() => () => {
    cancelPress();
    abortRef.current?.();
  }, [cancelPress]);

  return { drag, view, startCategoryDrag, startItemPress };
}
