import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCategoryDrag – Safe slot-based drag-and-drop for category lists.
 *
 * Uses mousedown/mousemove/mouseup for desktop mouse (NOT pointer events).
 * Uses touchstart/touchmove/touchend for touch devices.
 *
 * The key safety principle: event handler functions are stored in refs so
 * removeEventListener always uses the exact same reference as addEventListener.
 * No pointer events are used anywhere.
 */
export function useCategoryDrag({
  categories,
  reorderCategories,
  collapseAll,
  onDragEnd,
  sectionIdPrefix,
}) {
  const [draggedCatId, setDraggedCatId] = useState(null);
  const [dropTarget, setDropTarget]     = useState(null);

  // Stable refs
  const draggedCatIdRef = useRef(null);
  const dropTargetRef   = useRef(null);
  const savedStatesRef  = useRef(null);
  const categoriesRef   = useRef(categories);
  const reorderRef      = useRef(reorderCategories);
  const onDragEndRef    = useRef(onDragEnd);
  const ghostRef        = useRef(null);
  const isDraggingRef   = useRef(false);

  // Handler refs for guaranteed cleanup
  const moveHandlerRef  = useRef(null);
  const endHandlerRef   = useRef(null);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { reorderRef.current = reorderCategories; }, [reorderCategories]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

  // ── Ghost ──────────────────────────────────────────────────────────────────

  const destroyGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
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
      background: '#1A1A1A',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      padding: '6px 14px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: 'inherit',
      letterSpacing: '0.03em',
      boxShadow: '0 10px 25px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.05)',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      opacity: '0.95',
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

  // ── Drop Target Calculation ────────────────────────────────────────────────

  const calcDropSlot = useCallback((cursorY) => {
    const cats = categoriesRef.current;
    const draggedId = draggedCatIdRef.current;

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
      return null;
    }

    let slotIndex = visibleOtherItems.length;
    for (let k = 0; k < visibleOtherItems.length; k++) {
      if (cursorY < visibleOtherItems[k].midY) {
        slotIndex = k;
        break;
      }
    }

    if (slotIndex < visibleOtherItems.length) {
      return {
        targetCatId: visibleOtherItems[slotIndex].catId,
        position: 'before',
      };
    } else {
      return {
        targetCatId: visibleOtherItems[visibleOtherItems.length - 1].catId,
        position: 'after',
      };
    }
  }, [sectionIdPrefix]);

  // ── Cleanup (bulletproof) ──────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    isDraggingRef.current = false;
    destroyGhost();

    // Remove listeners using the exact same function references
    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current);
      window.removeEventListener('touchmove', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (endHandlerRef.current) {
      window.removeEventListener('mouseup', endHandlerRef.current);
      window.removeEventListener('touchend', endHandlerRef.current);
      window.removeEventListener('touchcancel', endHandlerRef.current);
      endHandlerRef.current = null;
    }

    draggedCatIdRef.current = null;
    dropTargetRef.current = null;
    setDraggedCatId(null);
    setDropTarget(null);

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [destroyGhost]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startDrag = useCallback((e, catId) => {
    // Only respond to left mouse button or touch
    if (e.type === 'mousedown' && e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Clean up any previous drag
    cleanup();

    // Snapshot expand states BEFORE collapsing
    const states = {};
    categoriesRef.current.forEach(c => { states[c.id] = c.isExpanded; });
    savedStatesRef.current = states;

    isDraggingRef.current = true;
    draggedCatIdRef.current = catId;
    setDraggedCatId(catId);

    collapseAll();

    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    const cat = categoriesRef.current.find(c => c.id === catId);
    createGhost(cat?.name ?? catId, x, y);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    requestAnimationFrame(() => {
      const dt = calcDropSlot(y);
      dropTargetRef.current = dt;
      setDropTarget(dt);
    });

    // Create handler functions and store references for safe removal
    const moveHandler = (me) => {
      if (!isDraggingRef.current) return;
      const mx = me.clientX ?? me.touches?.[0]?.clientX;
      const my = me.clientY ?? me.touches?.[0]?.clientY;
      if (mx == null || my == null) return;

      // Move ghost
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${mx + 16}px, ${my - 16}px)`;
      }

      // Update drop target
      const dt = calcDropSlot(my);
      dropTargetRef.current = dt;
      setDropTarget(dt);

      // Auto-scroll at edges
      const edgeThreshold = 120;
      const viewportHeight = window.innerHeight;
      if (my < edgeThreshold) {
        const intensity = (edgeThreshold - Math.max(0, my)) / edgeThreshold;
        window.scrollBy(0, -Math.max(3, Math.round(intensity * 22)));
      } else if (my > viewportHeight - edgeThreshold) {
        const intensity = (Math.min(viewportHeight, my) - (viewportHeight - edgeThreshold)) / edgeThreshold;
        window.scrollBy(0, Math.max(3, Math.round(intensity * 22)));
      }
    };

    const endHandler = () => {
      const dragged = draggedCatIdRef.current;
      const target = dropTargetRef.current;
      const cats = categoriesRef.current;

      if (dragged !== null && target !== null) {
        const fromIndex = cats.findIndex(c => c.id === dragged);
        if (fromIndex !== -1) {
          const draggedCat = cats[fromIndex];
          const newCats = cats.filter(c => c.id !== dragged);
          const targetIndex = newCats.findIndex(c => c.id === target.targetCatId);

          if (targetIndex !== -1) {
            const insertIndex = target.position === 'before' ? targetIndex : targetIndex + 1;
            newCats.splice(insertIndex, 0, draggedCat);

            const hasOrderChanged = newCats.some((c, idx) => c.id !== cats[idx]?.id);
            if (hasOrderChanged) {
              reorderRef.current(newCats);
            }
          }
        }
      }

      // Restore expand states
      const saved = savedStatesRef.current;
      savedStatesRef.current = null;
      if (saved) onDragEndRef.current?.(saved);

      cleanup();
    };

    // Store refs for cleanup
    moveHandlerRef.current = moveHandler;
    endHandlerRef.current = endHandler;

    // Use mouse events for mouse, touch events for touch
    if (e.type === 'mousedown') {
      window.addEventListener('mousemove', moveHandler, { passive: true });
      window.addEventListener('mouseup', endHandler);
    } else {
      window.addEventListener('touchmove', moveHandler, { passive: true });
      window.addEventListener('touchend', endHandler);
      window.addEventListener('touchcancel', endHandler);
    }
  }, [cleanup, collapseAll, createGhost, calcDropSlot]);

  // ── Safety net: cleanup on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { draggedCatId, dropTarget, startDrag };
}
