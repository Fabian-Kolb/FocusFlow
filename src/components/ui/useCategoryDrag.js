import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCategoryDrag – Safe slot-based drag-and-drop for category lists with Mobile Long-Press gesture.
 *
 * Uses mousedown/mousemove/mouseup for desktop mouse (instant).
 * Uses 400ms long-press for touch devices (allows normal page scrolling unless held).
 * Supports manual wheel scrolling and edge auto-scrolling during category reordering.
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

  // Touch long press refs
  const longPressTimerRef = useRef(null);
  const earlyTouchListenersRef = useRef(null);

  // Handler refs for guaranteed cleanup
  const moveHandlerRef  = useRef(null);
  const wheelHandlerRef = useRef(null);
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

  const createGhost = useCallback((label, x, y, isTouch = false) => {
    destroyGhost();
    const el = document.createElement('div');
    el.id = '__cat-drag-ghost__';

    // On touch, position 60px above finger so thumb does not obscure the preview
    const posX = isTouch ? Math.max(10, x - 70) : x + 16;
    const posY = isTouch ? Math.max(10, y - 60) : y - 16;

    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      transform: `translate(${posX}px, ${posY}px)`,
      pointerEvents: 'none',
      zIndex: '99999',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      color: '#EEF2FF',
      border: '1.5px solid rgba(129, 140, 248, 0.7)',
      padding: '8px 16px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '700',
      fontFamily: 'inherit',
      letterSpacing: '0.02em',
      boxShadow: '0 20px 30px -5px rgba(0,0,0,0.5), 0 0 15px rgba(99, 102, 241, 0.3)',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      opacity: '0.95',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.fontSize = '16px';
    icon.style.color = '#818CF8';
    icon.textContent = 'folder_open';
    el.appendChild(icon);

    const textNode = document.createElement('span');
    textNode.textContent = label.startsWith('Kategorie') ? label : `Kategorie: ${label}`;
    el.appendChild(textNode);

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

  // ── Long press cleanup ─────────────────────────────────────────────────────

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (earlyTouchListenersRef.current) {
      const { move, end } = earlyTouchListenersRef.current;
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
      earlyTouchListenersRef.current = null;
    }
  }, []);

  // ── Cleanup (bulletproof) ──────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    cancelLongPress();
    isDraggingRef.current = false;
    destroyGhost();

    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current);
      window.removeEventListener('touchmove', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (wheelHandlerRef.current) {
      window.removeEventListener('wheel', wheelHandlerRef.current);
      wheelHandlerRef.current = null;
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
  }, [destroyGhost, cancelLongPress]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startDrag = useCallback((e, catId) => {
    if (e.type === 'mousedown' && e.button !== 0) return;

    cleanup();

    const isTouch = e.type === 'touchstart';

    const executeDragStart = (startX, startY) => {
      const states = {};
      categoriesRef.current.forEach(c => { states[c.id] = c.isExpanded; });
      savedStatesRef.current = states;

      isDraggingRef.current = true;
      draggedCatIdRef.current = catId;
      setDraggedCatId(catId);

      collapseAll();

      const cat = categoriesRef.current.find(c => c.id === catId);
      const catLabel = cat?.name ?? catId;
      createGhost(catLabel, startX, startY, isTouch);

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      requestAnimationFrame(() => {
        const dt = calcDropSlot(startY);
        dropTargetRef.current = dt;
        setDropTarget(dt);
      });

      const moveHandler = (me) => {
        if (!isDraggingRef.current) return;
        const mx = me.clientX ?? me.touches?.[0]?.clientX;
        const my = me.clientY ?? me.touches?.[0]?.clientY;
        if (mx == null || my == null) return;

        if (ghostRef.current) {
          const posX = isTouch ? Math.max(10, mx - 70) : mx + 16;
          const posY = isTouch ? Math.max(10, my - 60) : my - 16;
          ghostRef.current.style.transform = `translate(${posX}px, ${posY}px)`;
        }

        const dt = calcDropSlot(my);
        dropTargetRef.current = dt;
        setDropTarget(dt);

        // Auto-scroll at edges
        const edgeThreshold = 120;
        const viewportHeight = window.innerHeight;
        const main = document.querySelector('main');
        
        if (my < edgeThreshold) {
          const intensity = (edgeThreshold - Math.max(0, my)) / edgeThreshold;
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, -speed);
          else window.scrollBy(0, -speed);
        } else if (my > viewportHeight - edgeThreshold) {
          const intensity = (Math.min(viewportHeight, my) - (viewportHeight - edgeThreshold)) / edgeThreshold;
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, speed);
          else window.scrollBy(0, speed);
        }
      };

      const wheelHandler = (we) => {
        if (isDraggingRef.current) {
          const main = document.querySelector('main');
          if (main) main.scrollBy(0, we.deltaY);
          else window.scrollBy(0, we.deltaY);
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

        const saved = savedStatesRef.current;
        savedStatesRef.current = null;
        if (saved) onDragEndRef.current?.(saved);

        cleanup();
      };

      moveHandlerRef.current = moveHandler;
      wheelHandlerRef.current = wheelHandler;
      endHandlerRef.current = endHandler;

      if (!isTouch) {
        window.addEventListener('mousemove', moveHandler, { passive: true });
        window.addEventListener('wheel', wheelHandler, { passive: true });
        window.addEventListener('mouseup', endHandler);
      } else {
        window.addEventListener('touchmove', moveHandler, { passive: true });
        window.addEventListener('touchend', endHandler);
        window.addEventListener('touchcancel', endHandler);
      }
    };

    if (!isTouch) {
      e.preventDefault();
      e.stopPropagation();
      const x = e.clientX ?? 0;
      const y = e.clientY ?? 0;
      executeDragStart(x, y);
    } else {
      // Touch event: apply 400ms long press delay before activating category drag
      const startX = e.touches[0].clientX;
      const startY = e.touches[0].clientY;

      const earlyMoveHandler = (te) => {
        const touch = te.touches[0];
        if (!touch) return;
        const dist = Math.hypot(touch.clientX - startX, touch.clientY - startY);
        if (dist > 8) {
          cancelLongPress();
        }
      };

      const earlyEndHandler = () => {
        cancelLongPress();
      };

      earlyTouchListenersRef.current = { move: earlyMoveHandler, end: earlyEndHandler };

      window.addEventListener('touchmove', earlyMoveHandler, { passive: true });
      window.addEventListener('touchend', earlyEndHandler);
      window.addEventListener('touchcancel', earlyEndHandler);

      longPressTimerRef.current = setTimeout(() => {
        if (earlyTouchListenersRef.current) {
          window.removeEventListener('touchmove', earlyMoveHandler);
          window.removeEventListener('touchend', earlyEndHandler);
          window.removeEventListener('touchcancel', earlyEndHandler);
          earlyTouchListenersRef.current = null;
        }

        if (typeof window !== 'undefined' && window.navigator && navigator.vibrate) {
          try { navigator.vibrate(45); } catch (_) {}
        }

        executeDragStart(startX, startY);
      }, 400);
    }
  }, [cleanup, cancelLongPress, collapseAll, createGhost, calcDropSlot]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { draggedCatId, dropTarget, startDrag };
}
