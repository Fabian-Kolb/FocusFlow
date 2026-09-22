import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useCardTouchDrag – High-performance, robust card drag-and-drop hook.
 *
 * Supports:
 * - Desktop: Mouse drag with 5px threshold (clicks remain instant clicks, drags lift item smoothly).
 * - Mouse Wheel / Trackpad: Full manual scrolling while holding an item with the mouse button!
 * - Edge Auto-Scroll: Continuous requestAnimationFrame loop scrolling up/down near screen/container edges.
 * - Mobile / Touch: 400ms Long-press with 45ms haptic pulse and above-thumb ghost preview badge.
 * - Auto-Expand on Hover: Hovering over a collapsed category for 550ms automatically unfolds it.
 * - Click Suppression: Cleanly prevents accidental navigation clicks when dropping.
 * - Interoperability: Backward compatible with HTML5 drag events if invoked.
 */
export function useCardTouchDrag({
  onMoveItemToCategory,
  categoryPrefix = 'cat-sec-',
  onHoverExpandCategory = null,
}) {
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [cardDropTargetId, setCardDropTargetId] = useState(null);

  // Stable refs
  const draggedCardIdRef = useRef(null);
  const cardDropTargetIdRef = useRef(null);
  const ghostRef = useRef(null);
  const onMoveRef = useRef(onMoveItemToCategory);
  const onHoverExpandRef = useRef(onHoverExpandCategory);
  const isDraggingRef = useRef(false);

  // Positions for continuous tracking & auto-scroll
  const currentPointerXRef = useRef(null);
  const currentPointerYRef = useRef(null);
  const scrollAnimFrameRef = useRef(null);

  // Hover-expand timer ref
  const hoverExpandTimerRef = useRef(null);

  // Touch long press refs
  const longPressTimerRef = useRef(null);
  const earlyTouchListenersRef = useRef(null);

  // Mouse early drag threshold refs
  const earlyMouseListenersRef = useRef(null);

  // Active drag listeners refs
  const activeMouseMoveHandlerRef = useRef(null);
  const activeMouseUpHandlerRef = useRef(null);
  const activeTouchMoveHandlerRef = useRef(null);
  const activeTouchEndHandlerRef = useRef(null);
  const wheelHandlerRef = useRef(null);

  // HTML5 drag scroll refs (backwards compatibility)
  const isHtml5DraggingRef = useRef(false);
  const currentDragYRef = useRef(null);
  const animFrameRef = useRef(null);
  const html5WheelHandlerRef = useRef(null);
  const html5DragOverHandlerRef = useRef(null);

  useEffect(() => {
    onMoveRef.current = onMoveItemToCategory;
  }, [onMoveItemToCategory]);

  useEffect(() => {
    onHoverExpandRef.current = onHoverExpandCategory;
  }, [onHoverExpandCategory]);

  // ── Ghost element ─────────────────────────────────────────────────────────

  const destroyGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
  }, []);

  const createGhost = useCallback((title, x, y, isTouch = false) => {
    destroyGhost();
    const el = document.createElement('div');
    el.id = '__card-drag-ghost__';

    // On touch, position 60px above finger so thumb does not obscure the preview
    // On desktop mouse, position directly near cursor
    const posX = isTouch ? Math.max(10, x - 70) : x + 14;
    const posY = isTouch ? Math.max(10, y - 60) : y + 14;

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      transform: `translate(${posX}px, ${posY}px)`,
      pointerEvents: 'none',
      zIndex: '999999',
      background: isDark ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' : '#FFFFFF',
      color: isDark ? '#F8FAFC' : '#0F172A',
      border: isDark ? '1.5px solid rgba(96, 165, 250, 0.8)' : '1.5px solid rgba(59, 130, 246, 0.9)',
      padding: '8px 16px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: '700',
      fontFamily: 'inherit',
      boxShadow: isDark
        ? '0 20px 35px -5px rgba(0,0,0,0.6), 0 0 20px rgba(59, 130, 246, 0.35)'
        : '0 20px 35px -5px rgba(0,0,0,0.18), 0 0 15px rgba(59, 130, 246, 0.25)',
      whiteSpace: 'nowrap',
      maxWidth: '280px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      opacity: '0.98',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'none',
    });

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.fontSize = '18px';
    icon.style.color = '#3B82F6';
    icon.style.flexShrink = '0';
    icon.textContent = 'drag_pan';
    el.appendChild(icon);

    const textNode = document.createElement('span');
    textNode.textContent = title || 'Element';
    textNode.style.overflow = 'hidden';
    textNode.style.textOverflow = 'ellipsis';
    el.appendChild(textNode);

    document.body.appendChild(el);
    ghostRef.current = el;
  }, [destroyGhost]);

  // ── Drop target detection ─────────────────────────────────────────────────

  const findDropCategory = useCallback((x, y) => {
    if (x == null || y == null) return null;
    const elements = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(x, y)
      : (typeof document.elementFromPoint === 'function' ? [document.elementFromPoint(x, y)].filter(Boolean) : []);
    if (!elements || elements.length === 0) return null;

    for (const el of elements) {
      if (categoryPrefix.startsWith('kanban-col-')) {
        const colEl = el.closest('[data-kanban-column]') || el.closest('[id^="kanban-col-"]');
        if (colEl) {
          const colAttr = colEl.getAttribute('data-kanban-column');
          if (colAttr) return colAttr;
          return colEl.id.replace('kanban-col-', '');
        }
      }

      const secEl = el.closest(`[id^="${categoryPrefix}"]`);
      if (secEl) {
        return secEl.id.replace(categoryPrefix, '');
      }

      const dataCatEl = el.closest('[data-category-id]');
      if (dataCatEl) {
        return dataCatEl.getAttribute('data-category-id');
      }
    }
    return null;
  }, [categoryPrefix]);

  // ── Hover-to-expand collapsed category timer ──────────────────────────────

  const handleHoverExpand = useCallback((catId) => {
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    if (catId && onHoverExpandRef.current) {
      hoverExpandTimerRef.current = setTimeout(() => {
        if (isDraggingRef.current && cardDropTargetIdRef.current === catId) {
          onHoverExpandRef.current(catId);
        }
      }, 550);
    }
  }, []);

  // ── Click suppression after dragging ──────────────────────────────────────

  const suppressNextClick = useCallback(() => {
    const captureHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      window.removeEventListener('click', captureHandler, true);
    };
    window.addEventListener('click', captureHandler, true);
    setTimeout(() => {
      window.removeEventListener('click', captureHandler, true);
    }, 150);
  }, []);

  // ── Continuous Auto-Scroll & Wheel Scrolling ──────────────────────────────

  const stopAutoScroll = useCallback(() => {
    if (scrollAnimFrameRef.current) {
      cancelAnimationFrame(scrollAnimFrameRef.current);
      scrollAnimFrameRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();

    const scrollLoop = () => {
      if (!isDraggingRef.current) return;

      const y = currentPointerYRef.current;
      const x = currentPointerXRef.current;

      if (y != null) {
        const edgeThreshold = 120; // px zone from top/bottom
        const maxSpeed = 26;

        const main = document.querySelector('main');
        const rect = main ? main.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };

        // Scroll UP near top
        if (y < rect.top + edgeThreshold) {
          const dist = Math.max(0, (rect.top + edgeThreshold) - y);
          const intensity = Math.min(1, dist / edgeThreshold);
          const speed = Math.max(4, Math.round(intensity * maxSpeed));
          if (main) main.scrollBy(0, -speed);
          else window.scrollBy(0, -speed);
        }
        // Scroll DOWN near bottom
        else if (y > rect.bottom - edgeThreshold) {
          const dist = Math.max(0, y - (rect.bottom - edgeThreshold));
          const intensity = Math.min(1, dist / edgeThreshold);
          const speed = Math.max(4, Math.round(intensity * maxSpeed));
          if (main) main.scrollBy(0, speed);
          else window.scrollBy(0, speed);
        }

        // Horizontal auto-scrolling for Kanban board if present
        const kanbanContainer = document.querySelector('[data-kanban-container="true"]') || document.querySelector('.snap-x');
        if (kanbanContainer && x != null) {
          const kRect = kanbanContainer.getBoundingClientRect();
          const horizThreshold = 90;
          if (x < kRect.left + horizThreshold) {
            const dist = Math.max(0, (kRect.left + horizThreshold) - x);
            const intensity = Math.min(1, dist / horizThreshold);
            const speed = Math.max(6, Math.round(intensity * 32));
            kanbanContainer.scrollBy({ left: -speed, behavior: 'auto' });
          } else if (x > kRect.right - horizThreshold) {
            const dist = Math.max(0, x - (kRect.right - horizThreshold));
            const intensity = Math.min(1, dist / horizThreshold);
            const speed = Math.max(6, Math.round(intensity * 32));
            kanbanContainer.scrollBy({ left: speed, behavior: 'auto' });
          }
        }

        // Recalculate drop category dynamically as items scroll under pointer
        if (x != null) {
          const catId = findDropCategory(x, y);
          if (catId !== cardDropTargetIdRef.current) {
            cardDropTargetIdRef.current = catId;
            setCardDropTargetId(catId);
            handleHoverExpand(catId);
          }
        }
      }

      scrollAnimFrameRef.current = requestAnimationFrame(scrollLoop);
    };

    scrollAnimFrameRef.current = requestAnimationFrame(scrollLoop);
  }, [stopAutoScroll, findDropCategory, handleHoverExpand]);

  // ── Long press cleanup (Touch) ────────────────────────────────────────────

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

  // ── Early mouse cleanup (Desktop) ─────────────────────────────────────────

  const cancelEarlyMouse = useCallback(() => {
    if (earlyMouseListenersRef.current) {
      const { move, up } = earlyMouseListenersRef.current;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      earlyMouseListenersRef.current = null;
    }
  }, []);

  // ── Comprehensive Cleanup ─────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    cancelLongPress();
    cancelEarlyMouse();
    stopAutoScroll();

    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }

    isDraggingRef.current = false;
    destroyGhost();

    if (activeMouseMoveHandlerRef.current) {
      window.removeEventListener('mousemove', activeMouseMoveHandlerRef.current);
      activeMouseMoveHandlerRef.current = null;
    }
    if (activeMouseUpHandlerRef.current) {
      window.removeEventListener('mouseup', activeMouseUpHandlerRef.current);
      activeMouseUpHandlerRef.current = null;
    }
    if (activeTouchMoveHandlerRef.current) {
      window.removeEventListener('touchmove', activeTouchMoveHandlerRef.current);
      activeTouchMoveHandlerRef.current = null;
    }
    if (activeTouchEndHandlerRef.current) {
      window.removeEventListener('touchend', activeTouchEndHandlerRef.current);
      window.removeEventListener('touchcancel', activeTouchEndHandlerRef.current);
      activeTouchEndHandlerRef.current = null;
    }
    if (wheelHandlerRef.current) {
      window.removeEventListener('wheel', wheelHandlerRef.current);
      window.removeEventListener('wheel', wheelHandlerRef.current, { capture: true });
      wheelHandlerRef.current = null;
    }

    currentPointerXRef.current = null;
    currentPointerYRef.current = null;
    draggedCardIdRef.current = null;
    cardDropTargetIdRef.current = null;
    setDraggedCardId(null);
    setCardDropTargetId(null);

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [cancelLongPress, cancelEarlyMouse, stopAutoScroll, destroyGhost]);

  // ── Desktop Mouse Drag (Threshold-based) ───────────────────────────────────

  const startCardDrag = useCallback((e, itemId, itemTitle) => {
    if (e.button !== 0) return; // Left mouse button only

    // Ignore clicks on buttons, links, inputs, context menus, or explicit no-drag elements
    const target = e.target;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }

    cleanup();

    const startX = e.clientX;
    const startY = e.clientY;

    const onEarlyMouseMove = (me) => {
      const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
      if (dist > 5) {
        // Threshold reached -> Activate Drag Mode!
        cancelEarlyMouse();
        executeMouseDrag(itemId, itemTitle, me.clientX, me.clientY);
      }
    };

    const onEarlyMouseUp = () => {
      // User clicked without dragging -> Let normal onClick proceed!
      cancelEarlyMouse();
    };

    earlyMouseListenersRef.current = { move: onEarlyMouseMove, up: onEarlyMouseUp };
    window.addEventListener('mousemove', onEarlyMouseMove);
    window.addEventListener('mouseup', onEarlyMouseUp);
  }, [cleanup, cancelEarlyMouse]);

  const executeMouseDrag = useCallback((itemId, itemTitle, initialX, initialY) => {
    isDraggingRef.current = true;
    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);

    currentPointerXRef.current = initialX;
    currentPointerYRef.current = initialY;

    createGhost(itemTitle, initialX, initialY, false);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const initialCat = findDropCategory(initialX, initialY);
    cardDropTargetIdRef.current = initialCat;
    setCardDropTargetId(initialCat);
    handleHoverExpand(initialCat);

    startAutoScroll();

    const moveHandler = (me) => {
      if (!isDraggingRef.current) return;
      currentPointerXRef.current = me.clientX;
      currentPointerYRef.current = me.clientY;

      if (ghostRef.current) {
        const posX = me.clientX + 14;
        const posY = me.clientY + 14;
        ghostRef.current.style.transform = `translate(${posX}px, ${posY}px)`;
      }

      const catId = findDropCategory(me.clientX, me.clientY);
      if (catId !== cardDropTargetIdRef.current) {
        cardDropTargetIdRef.current = catId;
        setCardDropTargetId(catId);
        handleHoverExpand(catId);
      }
    };

    const wheelHandler = (we) => {
      if (!isDraggingRef.current) return;
      const main = document.querySelector('main');
      if (main) main.scrollBy(0, we.deltaY);
      else window.scrollBy(0, we.deltaY);

      // Re-evaluate drop target after manual wheel/trackpad scroll
      const x = currentPointerXRef.current;
      const y = currentPointerYRef.current;
      if (x != null && y != null) {
        const catId = findDropCategory(x, y);
        if (catId !== cardDropTargetIdRef.current) {
          cardDropTargetIdRef.current = catId;
          setCardDropTargetId(catId);
          handleHoverExpand(catId);
        }
      }
    };

    const upHandler = (me) => {
      const droppedItemId = draggedCardIdRef.current;
      const targetCatId = cardDropTargetIdRef.current || findDropCategory(me.clientX, me.clientY);

      if (droppedItemId && targetCatId) {
        onMoveRef.current?.(droppedItemId, targetCatId);
      }

      suppressNextClick();
      cleanup();
    };

    activeMouseMoveHandlerRef.current = moveHandler;
    activeMouseUpHandlerRef.current = upHandler;
    wheelHandlerRef.current = wheelHandler;

    window.addEventListener('mousemove', moveHandler, { passive: true });
    window.addEventListener('wheel', wheelHandler, { passive: true, capture: true });
    window.addEventListener('mouseup', upHandler);
  }, [createGhost, findDropCategory, handleHoverExpand, startAutoScroll, suppressNextClick, cleanup]);

  // ── Touch Drag (Tablets / Phones with 400ms Long-Press) ────────────────────

  const startCardTouchDrag = useCallback((e, itemId, itemTitle) => {
    if (!e.touches || e.touches.length === 0) return;

    const target = e.target;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }

    cleanup();

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

      isDraggingRef.current = true;
      draggedCardIdRef.current = itemId;
      setDraggedCardId(itemId);

      currentPointerXRef.current = startX;
      currentPointerYRef.current = startY;

      createGhost(itemTitle, startX, startY, true);

      document.body.style.userSelect = 'none';

      const initialCat = findDropCategory(startX, startY);
      cardDropTargetIdRef.current = initialCat;
      setCardDropTargetId(initialCat);
      handleHoverExpand(initialCat);

      startAutoScroll();

      const moveHandler = (te) => {
        if (!isDraggingRef.current) return;
        const touch = te.touches[0];
        if (!touch) return;

        const tx = touch.clientX;
        const ty = touch.clientY;
        currentPointerXRef.current = tx;
        currentPointerYRef.current = ty;

        if (ghostRef.current) {
          const posX = Math.max(10, tx - 70);
          const posY = Math.max(10, ty - 60);
          ghostRef.current.style.transform = `translate(${posX}px, ${posY}px)`;
        }

        const catId = findDropCategory(tx, ty);
        if (catId !== cardDropTargetIdRef.current) {
          cardDropTargetIdRef.current = catId;
          setCardDropTargetId(catId);
          handleHoverExpand(catId);
        }
      };

      const endHandler = () => {
        const droppedItemId = draggedCardIdRef.current;
        const targetCatId = cardDropTargetIdRef.current;

        if (droppedItemId && targetCatId) {
          onMoveRef.current?.(droppedItemId, targetCatId);
        }

        suppressNextClick();
        cleanup();
      };

      activeTouchMoveHandlerRef.current = moveHandler;
      activeTouchEndHandlerRef.current = endHandler;

      window.addEventListener('touchmove', moveHandler, { passive: true });
      window.addEventListener('touchend', endHandler);
      window.addEventListener('touchcancel', endHandler);
    }, 400);
  }, [cleanup, cancelLongPress, createGhost, findDropCategory, handleHoverExpand, startAutoScroll, suppressNextClick]);

  // ── Backwards Compatibility: HTML5 drag stubs ─────────────────────────────

  const handleHtml5DragStart = useCallback((e, itemId) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', itemId);
      e.dataTransfer.effectAllowed = 'move';
    }
    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);
  }, []);

  const handleHtml5DragOver = useCallback((e, categoryId) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    cardDropTargetIdRef.current = categoryId;
    setCardDropTargetId(categoryId);
  }, []);

  const handleHtml5DragEnd = useCallback(() => {
    draggedCardIdRef.current = null;
    cardDropTargetIdRef.current = null;
    setDraggedCardId(null);
    setCardDropTargetId(null);
  }, []);

  // ── Safety net: cleanup on unmount ────────────────────────────────────────

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    draggedCardId,
    cardDropTargetId,
    startCardDrag,
    startCardMouseDrag: startCardDrag,
    startCardTouchDrag,
    handleHtml5DragStart,
    handleHtml5DragOver,
    handleHtml5DragEnd
  };
}
