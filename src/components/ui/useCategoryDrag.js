import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCategoryDrag – Stable insert-indicator drag-and-drop for category lists.
 *
 * Strategy (no oscillation):
 *   - The list stays in its ORIGINAL ORDER the entire time while dragging.
 *   - A "dropIndex" tracks WHERE the item will land (0 = before first, N = after last).
 *   - The dropIndex is derived from cursor Y vs. the midpoints of each category row.
 *   - Only on pointerup is the list actually reordered.
 *   - A floating ghost pill follows the cursor.
 *
 * What the component renders:
 *   - The dragged category row: slightly faded (opacity-40) but still in place.
 *   - A <DropIndicator> line between the correct rows based on `dropIndex`.
 *
 * @param {Array}    categories        - ordered array of category objects {id, name, isExpanded, ...}
 * @param {Function} reorderCategories - (newOrderedArray) => void — called once on drop
 * @param {Function} collapseAll       - () => void — called on drag start
 * @param {Function} onDragEnd         - ({id: boolean}) => void — called with pre-drag expand snapshot
 * @param {string}   sectionIdPrefix   - DOM id prefix: e.g. "cat-sec-" or "rcat-sec-"
 */
export function useCategoryDrag({
  categories,
  reorderCategories,
  collapseAll,
  onDragEnd,
  sectionIdPrefix,
}) {
  const [draggedCatId, setDraggedCatId]   = useState(null);
  const [dropIndex, setDropIndex]         = useState(null);

  // Stable refs to avoid stale closures in event listeners
  const draggedCatIdRef  = useRef(null);
  const dropIndexRef     = useRef(null);
  const savedStatesRef   = useRef(null);
  const categoriesRef    = useRef(categories);
  const reorderRef       = useRef(reorderCategories);
  const onDragEndRef     = useRef(onDragEnd);
  const ghostRef         = useRef(null);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { reorderRef.current = reorderCategories; }, [reorderCategories]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

  // Keep dropIndex ref in sync
  const setDropIndexBoth = useCallback((idx) => {
    dropIndexRef.current = idx;
    setDropIndex(idx);
  }, []);

  // ── Ghost ────────────────────────────────────────────────────────────────────

  const destroyGhost = useCallback(() => {
    ghostRef.current?.remove();
    ghostRef.current = null;
  }, []);

  const createGhost = useCallback((label, x, y) => {
    destroyGhost();
    const el = document.createElement('div');
    el.id = '__cat-drag-ghost__';
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      transform: `translate(${x + 16}px, ${y - 16}px)`,
      pointerEvents: 'none',
      zIndex: '99999',
      background: 'var(--color-primary, #6366f1)',
      color: '#fff',
      padding: '5px 16px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '700',
      fontFamily: 'inherit',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      opacity: '0.96',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.fontSize = '14px';
    icon.textContent = 'drag_indicator';
    el.appendChild(icon);
    el.appendChild(document.createTextNode(label));
    document.body.appendChild(el);
    ghostRef.current = el;
  }, [destroyGhost]);

  const moveGhost = useCallback((x, y) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${x + 16}px, ${y - 16}px)`;
    }
  }, []);

  // ── Drop-index calculation ───────────────────────────────────────────────────
  // Divides the vertical space using midpoints between adjacent category rows.
  // This gives generous, stable hit zones — no tiny sliver issues.

  const calcDropIndex = useCallback((cursorY) => {
    const cats = categoriesRef.current;
    let result = cats.length; // default: after last

    for (let i = 0; i < cats.length; i++) {
      const el = document.getElementById(`${sectionIdPrefix}${cats[i].id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      // Use the midpoint of each row as the threshold
      const midY = rect.top + rect.height / 2;
      if (cursorY < midY) {
        result = i;
        break;
      }
    }
    return result;
  }, [sectionIdPrefix]);

  // ── Event handlers ───────────────────────────────────────────────────────────

  const onPointerMove = useCallback((e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null || y == null) return;

    moveGhost(x, y);
    const di = calcDropIndex(y);
    setDropIndexBoth(di);
  }, [moveGhost, calcDropIndex, setDropIndexBoth]);

  // Ref so cleanup can always call the current version
  const onPointerUpRef = useRef(null);

  const onPointerUp = useCallback(() => {
    const dragged  = draggedCatIdRef.current;
    const di       = dropIndexRef.current;
    const cats     = categoriesRef.current;

    // Apply reorder only if item actually moved
    if (dragged !== null && di !== null) {
      const fromIndex = cats.findIndex(c => c.id === dragged);
      if (fromIndex !== -1) {
        // Adjust insertion index for the removal of the dragged item
        const adjustedTo = di > fromIndex ? di - 1 : di;

        if (fromIndex !== adjustedTo) {
          const newCats = [...cats];
          const [moved] = newCats.splice(fromIndex, 1);
          newCats.splice(adjustedTo, 0, moved);
          reorderRef.current(newCats);
        }
      }
    }

    // Restore expand states
    const saved = savedStatesRef.current;
    savedStatesRef.current = null;
    if (saved) onDragEndRef.current?.(saved);

    // Cleanup state
    destroyGhost();
    draggedCatIdRef.current = null;
    dropIndexRef.current    = null;
    setDraggedCatId(null);
    setDropIndex(null);

    // Remove listeners
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchmove',   onPointerMove);
    if (onPointerUpRef.current) {
      window.removeEventListener('pointerup',  onPointerUpRef.current);
      window.removeEventListener('touchend',   onPointerUpRef.current);
    }
    document.body.style.userSelect = '';
    document.body.style.cursor     = '';
  }, [destroyGhost, onPointerMove]);

  onPointerUpRef.current = onPointerUp;

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Attach to onPointerDown of each category's drag handle. */
  const startDrag = useCallback((e, catId) => {
    e.preventDefault();
    e.stopPropagation();

    // Snapshot expand states BEFORE collapsing
    const states = {};
    categoriesRef.current.forEach(c => { states[c.id] = c.isExpanded; });
    savedStatesRef.current = states;

    draggedCatIdRef.current = catId;
    setDraggedCatId(catId);

    // Initial drop index from current pointer Y
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    collapseAll();

    // Small delay so collapsed state takes effect before we read rects
    requestAnimationFrame(() => {
      const di = calcDropIndex(y);
      setDropIndexBoth(di);
    });

    const cat = categoriesRef.current.find(c => c.id === catId);
    createGhost(cat?.name ?? catId, x, y);

    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'grabbing';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup',   onPointerUp);
    window.addEventListener('touchmove',   onPointerMove, { passive: true });
    window.addEventListener('touchend',    onPointerUp);
  }, [collapseAll, createGhost, calcDropIndex, setDropIndexBoth, onPointerMove, onPointerUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyGhost();
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    };
  }, [destroyGhost]);

  return { draggedCatId, dropIndex, startDrag };
}
