import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCategoryDrag – Modern Live-Shuffling (In-Place Reordering) drag-and-drop
 * for category lists with Mobile Long-Press gesture, FLIP Animation, and Lifted Preview.
 *
 * Pattern:
 * - Desktop: Instant mousedown on drag handle lifts category into elevated card preview (straight, no tilt).
 * - Mobile: 400ms long-press + 45ms haptic pulse activates drag above thumb.
 * - Live Shuffling: Categories smoothly slide out of the way via FLIP animation (Spotify/Apple style).
 * - Continuous Auto-Scroll: RequestAnimationFrame loop keeps scrolling while holding near top/bottom edges.
 * - Haptics: 15ms subtle pulse on each slot transition on supported devices.
 * - Cleanup & Safety: Bulletproof window listeners, auto-scroll at screen edges.
 */
export function useCategoryDrag({
  categories,
  reorderCategories,
  collapseAll,
  onDragEnd,
  sectionIdPrefix,
}) {
  const [draggedCatId, setDraggedCatId]           = useState(null);
  const [orderedCategories, setOrderedCategories] = useState(categories);

  // Stable refs
  const draggedCatIdRef      = useRef(null);
  const orderedCategoriesRef = useRef(categories);
  const savedStatesRef       = useRef(null);
  const categoriesRef        = useRef(categories);
  const reorderRef           = useRef(reorderCategories);
  const onDragEndRef         = useRef(onDragEnd);
  const ghostRef             = useRef(null);
  const isDraggingRef        = useRef(false);

  // Auto-scroll loop refs
  const scrollAnimFrameRef = useRef(null);
  const currentPointerYRef = useRef(null);

  // Touch long press refs
  const longPressTimerRef      = useRef(null);
  const earlyTouchListenersRef = useRef(null);

  // Handler refs for guaranteed cleanup
  const moveHandlerRef  = useRef(null);
  const wheelHandlerRef = useRef(null);
  const endHandlerRef   = useRef(null);

  useEffect(() => {
    categoriesRef.current = categories;
    if (!isDraggingRef.current) {
      setOrderedCategories(categories);
      orderedCategoriesRef.current = categories;
    }
  }, [categories]);

  useEffect(() => { reorderRef.current = reorderCategories; }, [reorderCategories]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

  // ── High-Fidelity Lifted Preview (Ghost) ───────────────────────────────────

  const destroyGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
  }, []);

  const createGhost = useCallback((cat, itemCount, x, y, isTouch = false) => {
    destroyGhost();
    const el = document.createElement('div');
    el.id = '__cat-drag-ghost__';

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    // On touch, position 55px above finger so thumb does not obscure the preview
    const posX = isTouch ? Math.max(12, x - 90) : x + 12;
    const posY = isTouch ? Math.max(12, y - 55) : y - 22;

    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      transform: `translate(${posX}px, ${posY}px) scale(1.02)`,
      transformOrigin: 'top left',
      pointerEvents: 'none',
      zIndex: '999999',
      width: 'max-content',
      minWidth: '220px',
      maxWidth: '380px',
      height: '42px',
      padding: '0 16px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: isDark ? '#1E1E1E' : '#FFFFFF',
      color: isDark ? '#F3F4F6' : '#1A1A1A',
      border: isDark ? '1.5px solid rgba(255, 255, 255, 0.2)' : '1.5px solid rgba(26, 26, 26, 0.15)',
      boxShadow: isDark
        ? '0 20px 35px -5px rgba(0,0,0,0.7), 0 0 20px rgba(99, 102, 241, 0.25)'
        : '0 20px 35px -5px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
      userSelect: 'none',
      fontFamily: "'Outfit', sans-serif",
      letterSpacing: '0.05em',
      transition: 'none',
    });

    // Drag Handle icon
    const grip = document.createElement('span');
    grip.className = 'material-symbols-outlined';
    grip.style.fontSize = '18px';
    grip.style.color = isDark ? '#818CF8' : '#1A1A1A';
    grip.style.flexShrink = '0';
    grip.textContent = 'drag_indicator';
    el.appendChild(grip);

    // Chevron icon
    const chevron = document.createElement('span');
    chevron.className = 'material-symbols-outlined';
    chevron.style.fontSize = '18px';
    chevron.style.color = isDark ? '#6B7280' : '#A3A3A3';
    chevron.style.flexShrink = '0';
    chevron.textContent = 'chevron_right';
    el.appendChild(chevron);

    // Title & count wrapper
    const textWrap = document.createElement('div');
    textWrap.style.display = 'flex';
    textWrap.style.alignItems = 'center';
    textWrap.style.gap = '6px';
    textWrap.style.flex = '1';
    textWrap.style.overflow = 'hidden';

    // Category name
    const title = document.createElement('span');
    title.textContent = (cat?.name || 'KATEGORIE').toUpperCase();
    title.style.fontSize = '12px';
    title.style.fontWeight = '700';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    textWrap.appendChild(title);

    // Count badge
    if (typeof itemCount === 'number') {
      const count = document.createElement('span');
      count.textContent = `(${itemCount})`;
      count.style.fontSize = '11px';
      count.style.fontWeight = '400';
      count.style.color = isDark ? '#9CA3AF' : '#737373';
      count.style.flexShrink = '0';
      textWrap.appendChild(count);
    }
    el.appendChild(textWrap);

    document.body.appendChild(el);
    ghostRef.current = el;
  }, [destroyGhost]);

  // ── Live Reordering Calculation with FLIP Animation ────────────────────────

  const updateLiveOrder = useCallback((cursorY) => {
    const currentCats = orderedCategoriesRef.current || categoriesRef.current;
    const draggedId = draggedCatIdRef.current;
    if (!draggedId || !currentCats) return;

    const currentIndex = currentCats.findIndex(c => c.id === draggedId);
    if (currentIndex === -1) return;

    const draggedItem = currentCats[currentIndex];
    const withoutDragged = currentCats.filter(c => c.id !== draggedId);

    // Find vertical midpoints of all other visible categories in DOM
    const otherItemsWithPos = [];
    for (let i = 0; i < withoutDragged.length; i++) {
      const cat = withoutDragged[i];
      const el = document.getElementById(`${sectionIdPrefix}${cat.id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) continue;
      otherItemsWithPos.push({
        cat,
        midY: rect.top + rect.height / 2,
      });
    }

    if (otherItemsWithPos.length === 0) return;

    // Determine target slot among visible items
    let targetSlot = otherItemsWithPos.length;
    for (let k = 0; k < otherItemsWithPos.length; k++) {
      if (cursorY < otherItemsWithPos[k].midY) {
        targetSlot = k;
        break;
      }
    }

    let insertIndexInWithoutDragged;
    if (targetSlot < otherItemsWithPos.length) {
      const targetCat = otherItemsWithPos[targetSlot].cat;
      insertIndexInWithoutDragged = withoutDragged.findIndex(c => c.id === targetCat.id);
    } else {
      insertIndexInWithoutDragged = withoutDragged.length;
    }

    if (insertIndexInWithoutDragged === -1) {
      insertIndexInWithoutDragged = withoutDragged.length;
    }

    const nextOrder = [...withoutDragged];
    nextOrder.splice(insertIndexInWithoutDragged, 0, draggedItem);

    // Only update if the order genuinely changed
    const hasChanged = nextOrder.some((c, idx) => c.id !== currentCats[idx]?.id);
    if (hasChanged) {
      // FLIP: 1. Record current positions before state update
      const prevTops = {};
      currentCats.forEach(c => {
        const el = document.getElementById(`${sectionIdPrefix}${c.id}`);
        if (el) prevTops[c.id] = el.getBoundingClientRect().top;
      });

      orderedCategoriesRef.current = nextOrder;
      setOrderedCategories(nextOrder);

      // FLIP: 2. Animate elements from previous position to new position
      requestAnimationFrame(() => {
        nextOrder.forEach(c => {
          if (c.id === draggedId) return; // Dragged item is the gap
          const el = document.getElementById(`${sectionIdPrefix}${c.id}`);
          if (el && prevTops[c.id] != null) {
            const newTop = el.getBoundingClientRect().top;
            const deltaY = prevTops[c.id] - newTop;
            if (Math.abs(deltaY) > 0.5) {
              el.style.transform = `translateY(${deltaY}px)`;
              el.style.transition = 'none';
              requestAnimationFrame(() => {
                el.style.transition = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';
                el.style.transform = '';
              });
            }
          }
        });
      });

      // Subtle haptic tick for mechanical notch feeling on mobile
      if (typeof window !== 'undefined' && window.navigator && navigator.vibrate) {
        try { navigator.vibrate(15); } catch (_) {}
      }
    }
  }, [sectionIdPrefix]);

  // ── Continuous Auto-Scroll Loop ───────────────────────────────────────────

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimFrameRef.current) {
      cancelAnimationFrame(scrollAnimFrameRef.current);
      scrollAnimFrameRef.current = null;
    }
    currentPointerYRef.current = null;
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();

    const scrollLoop = () => {
      if (!isDraggingRef.current) return;

      const y = currentPointerYRef.current;
      if (y != null) {
        const edgeThreshold = 120;
        const main = document.querySelector('main');
        const rect = main ? main.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };

        if (y < rect.top + edgeThreshold) {
          const dist = Math.max(0, (rect.top + edgeThreshold) - y);
          const intensity = Math.min(1, dist / edgeThreshold);
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, -speed);
          else window.scrollBy(0, -speed);
          // Recalculate live order while auto-scrolling
          updateLiveOrder(y);
        } else if (y > rect.bottom - edgeThreshold) {
          const dist = Math.max(0, y - (rect.bottom - edgeThreshold));
          const intensity = Math.min(1, dist / edgeThreshold);
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, speed);
          else window.scrollBy(0, speed);
          // Recalculate live order while auto-scrolling
          updateLiveOrder(y);
        }
      }

      scrollAnimFrameRef.current = requestAnimationFrame(scrollLoop);
    };

    scrollAnimFrameRef.current = requestAnimationFrame(scrollLoop);
  }, [stopAutoScroll, updateLiveOrder]);

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
    stopAutoScroll();
    isDraggingRef.current = false;
    destroyGhost();

    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current);
      window.removeEventListener('touchmove', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (wheelHandlerRef.current) {
      window.removeEventListener('wheel', wheelHandlerRef.current);
      window.removeEventListener('wheel', wheelHandlerRef.current, { capture: true });
      wheelHandlerRef.current = null;
    }
    if (endHandlerRef.current) {
      window.removeEventListener('mouseup', endHandlerRef.current);
      window.removeEventListener('touchend', endHandlerRef.current);
      window.removeEventListener('touchcancel', endHandlerRef.current);
      endHandlerRef.current = null;
    }

    // Clean up any lingering transforms on categories
    categoriesRef.current.forEach(c => {
      const el = document.getElementById(`${sectionIdPrefix}${c.id}`);
      if (el) {
        el.style.transform = '';
        el.style.transition = '';
      }
    });

    draggedCatIdRef.current = null;
    setDraggedCatId(null);

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [destroyGhost, cancelLongPress, stopAutoScroll, sectionIdPrefix]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startDrag = useCallback((e, catId, itemCount = 0) => {
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

      const initialOrder = [...categoriesRef.current];
      orderedCategoriesRef.current = initialOrder;
      setOrderedCategories(initialOrder);

      collapseAll();

      const cat = categoriesRef.current.find(c => c.id === catId);
      createGhost(cat, itemCount, startX, startY, isTouch);

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      currentPointerYRef.current = startY;
      startAutoScroll();

      const moveHandler = (me) => {
        if (!isDraggingRef.current) return;
        const mx = me.clientX ?? me.touches?.[0]?.clientX;
        const my = me.clientY ?? me.touches?.[0]?.clientY;
        if (mx == null || my == null) return;

        currentPointerYRef.current = my;

        if (ghostRef.current) {
          const posX = isTouch ? Math.max(12, mx - 90) : mx + 12;
          const posY = isTouch ? Math.max(12, my - 55) : my - 22;
          ghostRef.current.style.transform = `translate(${posX}px, ${posY}px) scale(1.02)`;
        }

        updateLiveOrder(my);
      };

      const wheelHandler = (we) => {
        if (isDraggingRef.current) {
          const main = document.querySelector('main');
          if (main) main.scrollBy(0, we.deltaY);
          else window.scrollBy(0, we.deltaY);
          if (currentPointerYRef.current != null) {
            updateLiveOrder(currentPointerYRef.current);
          }
        }
      };

      const endHandler = () => {
        stopAutoScroll();
        const dragged = draggedCatIdRef.current;
        const finalOrder = orderedCategoriesRef.current;
        const initialCats = categoriesRef.current;

        if (dragged !== null && finalOrder) {
          const hasOrderChanged = finalOrder.some((c, idx) => c.id !== initialCats[idx]?.id);
          if (hasOrderChanged) {
            reorderRef.current(finalOrder);
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
        window.addEventListener('wheel', wheelHandler, { passive: true, capture: true });
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
      // Touch event: 400ms long press delay before activating category drag
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
  }, [cleanup, cancelLongPress, collapseAll, createGhost, updateLiveOrder, startAutoScroll, stopAutoScroll]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    draggedCatId,
    orderedCategories,
    dropTarget: null, // Kept for backwards compatibility
    startDrag,
  };
}
