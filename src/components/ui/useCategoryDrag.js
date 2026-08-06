import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCategoryDrag – Precise slot-based drag-and-drop for category lists.
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
  const [draggedCatId, setDraggedCatId] = useState(null);
  const [dropTarget, setDropTarget]     = useState(null); // { targetCatId: string, position: 'before'|'after' }

  // Stable refs to avoid stale closures in event listeners
  const draggedCatIdRef = useRef(null);
  const slotIndexRef    = useRef(null);
  const savedStatesRef  = useRef(null);
  const categoriesRef   = useRef(categories);
  const reorderRef      = useRef(reorderCategories);
  const onDragEndRef    = useRef(onDragEnd);
  const ghostRef        = useRef(null);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { reorderRef.current = reorderCategories; }, [reorderCategories]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

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

  // ── Slot & Drop Target Calculation ─────────────────────────────────────────

  const calcDropSlot = useCallback((cursorY) => {
    const cats = categoriesRef.current;
    const draggedId = draggedCatIdRef.current;

    // Collect visible category DOM elements excluding the dragged category
    const visibleOtherItems = [];
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      if (cat.id === draggedId) continue;
      const el = document.getElementById(`${sectionIdPrefix}${cat.id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      visibleOtherItems.push({
        catId: cat.id,
        indexInFullList: i,
        midY: rect.top + rect.height / 2,
      });
    }

    if (visibleOtherItems.length === 0) {
      return { slotIndex: 0, dropTarget: null };
    }

    // Determine insertion slot relative to visibleOtherItems
    let slotIndex = visibleOtherItems.length;
    for (let k = 0; k < visibleOtherItems.length; k++) {
      if (cursorY < visibleOtherItems[k].midY) {
        slotIndex = k;
        break;
      }
    }

    // Determine visual dropTarget descriptor
    let dropTarget = null;
    if (slotIndex < visibleOtherItems.length) {
      dropTarget = {
        targetCatId: visibleOtherItems[slotIndex].catId,
        position: 'before',
      };
    } else {
      dropTarget = {
        targetCatId: visibleOtherItems[visibleOtherItems.length - 1].catId,
        position: 'after',
      };
    }

    return { slotIndex, dropTarget };
  }, [sectionIdPrefix]);

  const updateDropTarget = useCallback((cursorY) => {
    const { slotIndex, dropTarget } = calcDropSlot(cursorY);
    slotIndexRef.current = slotIndex;
    setDropTarget(dropTarget);
  }, [calcDropSlot]);

  // ── Event Handlers ─────────────────────────────────────────────────────────

  const onPointerMove = useCallback((e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null || y == null) return;

    moveGhost(x, y);
    updateDropTarget(y);
  }, [moveGhost, updateDropTarget]);

  const onPointerUpRef = useRef(null);

  const onPointerUp = useCallback(() => {
    const dragged = draggedCatIdRef.current;
    const slotIdx = slotIndexRef.current;
    const cats    = categoriesRef.current;

    if (dragged !== null && slotIdx !== null) {
      const fromIndex = cats.findIndex(c => c.id === dragged);
      if (fromIndex !== -1) {
        const draggedCat = cats[fromIndex];
        const newCats = cats.filter(c => c.id !== dragged);
        const safeSlot = Math.max(0, Math.min(slotIdx, newCats.length));
        newCats.splice(safeSlot, 0, draggedCat);

        const hasOrderChanged = newCats.some((c, idx) => c.id !== cats[idx]?.id);
        if (hasOrderChanged) {
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
    slotIndexRef.current    = null;
    setDraggedCatId(null);
    setDropTarget(null);

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

  // ── Public API ─────────────────────────────────────────────────────────────

  const startDrag = useCallback((e, catId) => {
    e.preventDefault();
    e.stopPropagation();

    // Snapshot expand states BEFORE collapsing
    const states = {};
    categoriesRef.current.forEach(c => { states[c.id] = c.isExpanded; });
    savedStatesRef.current = states;

    draggedCatIdRef.current = catId;
    setDraggedCatId(catId);

    collapseAll();

    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    requestAnimationFrame(() => {
      updateDropTarget(y);
    });

    const cat = categoriesRef.current.find(c => c.id === catId);
    createGhost(cat?.name ?? catId, x, y);

    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'grabbing';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup',   onPointerUp);
    window.addEventListener('touchmove',   onPointerMove, { passive: true });
    window.addEventListener('touchend',    onPointerUp);
  }, [collapseAll, createGhost, updateDropTarget, onPointerMove, onPointerUp]);

  useEffect(() => {
    return () => {
      destroyGhost();
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    };
  }, [destroyGhost]);

  return { draggedCatId, dropTarget, startDrag };
}
