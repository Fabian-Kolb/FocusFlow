import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useCardTouchDrag – Safe card drag hook with Mobile Long-Press gesture.
 *
 * Desktop: HTML5 drag-and-drop with edge auto-scrolling & manual mouse wheel scrolling.
 * Touch (tablet/phone): 400ms Long-press → Haptic feedback → Drag mode with above-thumb ghost badge.
 *
 * Safety guarantees:
 * - Listeners added during drag are cleanly removed via stored refs.
 * - Long press cancels immediately if finger moves > 8px (enables natural scrolling).
 * - Component unmount triggers complete cleanup.
 */
export function useCardTouchDrag({ onMoveItemToCategory, categoryPrefix = 'cat-sec-' }) {
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [cardDropTargetId, setCardDropTargetId] = useState(null);

  // Stable refs
  const draggedCardIdRef = useRef(null);
  const cardDropTargetIdRef = useRef(null);
  const ghostRef = useRef(null);
  const onMoveRef = useRef(onMoveItemToCategory);
  const isTouchDraggingRef = useRef(false);

  // Touch long press refs
  const longPressTimerRef = useRef(null);
  const earlyTouchListenersRef = useRef(null);

  // HTML5 drag scroll refs
  const isHtml5DraggingRef = useRef(false);
  const currentDragYRef = useRef(null);
  const animFrameRef = useRef(null);
  const html5WheelHandlerRef = useRef(null);
  const html5DragOverHandlerRef = useRef(null);

  // Touch handler refs for guaranteed cleanup
  const touchMoveHandlerRef = useRef(null);
  const touchEndHandlerRef = useRef(null);

  useEffect(() => {
    onMoveRef.current = onMoveItemToCategory;
  }, [onMoveItemToCategory]);

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
    const posX = isTouch ? Math.max(10, x - 70) : x + 12;
    const posY = isTouch ? Math.max(10, y - 60) : y - 12;

    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      transform: `translate(${posX}px, ${posY}px)`,
      pointerEvents: 'none',
      zIndex: '999999',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      color: '#F8FAFC',
      border: '1.5px solid rgba(96, 165, 250, 0.7)',
      padding: '8px 16px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: '700',
      fontFamily: 'inherit',
      boxShadow: '0 20px 35px -5px rgba(0,0,0,0.5), 0 0 15px rgba(59, 130, 246, 0.3)',
      whiteSpace: 'nowrap',
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      opacity: '0.95',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.fontSize = '16px';
    icon.style.color = '#60A5FA';
    icon.textContent = 'drag_pan';
    el.appendChild(icon);

    const textNode = document.createElement('span');
    textNode.textContent = title || 'Element';
    el.appendChild(textNode);

    document.body.appendChild(el);
    ghostRef.current = el;
  }, [destroyGhost]);

  // ── Drop target detection ─────────────────────────────────────────────────

  const findDropCategory = useCallback((x, y) => {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (categoryPrefix.startsWith('kanban-col-')) {
        const colAttr = el.getAttribute('data-kanban-column');
        if (colAttr) return colAttr;
      }
      const secId = el.id;
      if (secId && secId.startsWith(categoryPrefix)) {
        return secId.replace(categoryPrefix, '');
      }
    }
    return null;
  }, [categoryPrefix]);

  // ── Long press cleanup ──────────────────────────────────────────────────

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

  // ── HTML5 Drag Scroll & Auto-scroll ───────────────────────────────────────

  const stopHtml5DragScroll = useCallback(() => {
    isHtml5DraggingRef.current = false;
    currentDragYRef.current = null;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (html5WheelHandlerRef.current) {
      window.removeEventListener('wheel', html5WheelHandlerRef.current);
      html5WheelHandlerRef.current = null;
    }
    if (html5DragOverHandlerRef.current) {
      window.removeEventListener('dragover', html5DragOverHandlerRef.current);
      html5DragOverHandlerRef.current = null;
    }
  }, []);

  const startHtml5DragScroll = useCallback((initialY) => {
    stopHtml5DragScroll();
    isHtml5DraggingRef.current = true;
    currentDragYRef.current = initialY;

    const wheelHandler = (we) => {
      if (isHtml5DraggingRef.current) {
        const main = document.querySelector('main');
        if (main) main.scrollBy(0, we.deltaY);
        else window.scrollBy(0, we.deltaY);
      }
    };

    const dragOverHandler = (de) => {
      if (de.clientY != null) {
        currentDragYRef.current = de.clientY;
      }
    };

    html5WheelHandlerRef.current = wheelHandler;
    html5DragOverHandlerRef.current = dragOverHandler;

    window.addEventListener('wheel', wheelHandler, { passive: true });
    window.addEventListener('dragover', dragOverHandler, { passive: true });

    const autoScrollLoop = () => {
      if (!isHtml5DraggingRef.current) return;

      const y = currentDragYRef.current;
      if (y != null) {
        const edgeThreshold = 120;
        const viewportHeight = window.innerHeight;

        const main = document.querySelector('main');
        
        if (y < edgeThreshold) {
          const intensity = (edgeThreshold - Math.max(0, y)) / edgeThreshold;
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, -speed);
          else window.scrollBy(0, -speed);
        } else if (y > viewportHeight - edgeThreshold) {
          const intensity = (Math.min(viewportHeight, y) - (viewportHeight - edgeThreshold)) / edgeThreshold;
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, speed);
          else window.scrollBy(0, speed);
        }
      }

      animFrameRef.current = requestAnimationFrame(autoScrollLoop);
    };

    animFrameRef.current = requestAnimationFrame(autoScrollLoop);
  }, [stopHtml5DragScroll]);

  // ── Touch cleanup ──────────────────────────────────────────────────────────

  const cleanupTouch = useCallback(() => {
    cancelLongPress();
    isTouchDraggingRef.current = false;
    destroyGhost();

    if (touchMoveHandlerRef.current) {
      window.removeEventListener('touchmove', touchMoveHandlerRef.current);
      touchMoveHandlerRef.current = null;
    }
    if (touchEndHandlerRef.current) {
      window.removeEventListener('touchend', touchEndHandlerRef.current);
      window.removeEventListener('touchcancel', touchEndHandlerRef.current);
      touchEndHandlerRef.current = null;
    }

    draggedCardIdRef.current = null;
    cardDropTargetIdRef.current = null;
    setDraggedCardId(null);
    setCardDropTargetId(null);

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [destroyGhost, cancelLongPress]);

  // ── Touch drag (tablets / phones) with 400ms Long-Press ────────────────────

  const startCardTouchDrag = useCallback((e, itemId, itemTitle) => {
    if (!e.touches || e.touches.length === 0) return;

    const target = e.target;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea')) return;

    cleanupTouch();

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

      isTouchDraggingRef.current = true;
      draggedCardIdRef.current = itemId;
      setDraggedCardId(itemId);

      createGhost(itemTitle, startX, startY, true);

      document.body.style.userSelect = 'none';

      const moveHandler = (te) => {
        if (!isTouchDraggingRef.current) return;
        const touch = te.touches[0];
        if (!touch) return;

        const tx = touch.clientX;
        const ty = touch.clientY;

        if (ghostRef.current) {
          const posX = Math.max(10, tx - 70);
          const posY = Math.max(10, ty - 60);
          ghostRef.current.style.transform = `translate(${posX}px, ${posY}px)`;
        }

        const edgeThreshold = 120;
        const viewportHeight = window.innerHeight;
        const main = document.querySelector('main');
        
        if (ty < edgeThreshold) {
          const intensity = (edgeThreshold - Math.max(0, ty)) / edgeThreshold;
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, -speed);
          else window.scrollBy(0, -speed);
        } else if (ty > viewportHeight - edgeThreshold) {
          const intensity = (Math.min(viewportHeight, ty) - (viewportHeight - edgeThreshold)) / edgeThreshold;
          const speed = Math.max(3, Math.round(intensity * 22));
          if (main) main.scrollBy(0, speed);
          else window.scrollBy(0, speed);
        }

        const kanbanContainer = document.querySelector('[data-kanban-container="true"]');
        if (kanbanContainer) {
          const horizThreshold = 90;
          const viewportWidth = window.innerWidth;
          if (tx < horizThreshold) {
            const intensity = (horizThreshold - Math.max(0, tx)) / horizThreshold;
            const speed = Math.max(8, Math.round(intensity * 32));
            kanbanContainer.scrollBy({ left: -speed, behavior: 'auto' });
          } else if (tx > viewportWidth - horizThreshold) {
            const intensity = (Math.min(viewportWidth, tx) - (viewportWidth - horizThreshold)) / horizThreshold;
            const speed = Math.max(8, Math.round(intensity * 32));
            kanbanContainer.scrollBy({ left: speed, behavior: 'auto' });
          }
        }

        const catId = findDropCategory(tx, ty);
        cardDropTargetIdRef.current = catId;
        setCardDropTargetId(catId);
      };

      const endHandler = () => {
        const droppedItemId = draggedCardIdRef.current;
        const targetCatId = cardDropTargetIdRef.current;

        if (droppedItemId && targetCatId) {
          onMoveRef.current?.(droppedItemId, targetCatId);
        }

        cleanupTouch();
      };

      touchMoveHandlerRef.current = moveHandler;
      touchEndHandlerRef.current = endHandler;

      window.addEventListener('touchmove', moveHandler, { passive: true });
      window.addEventListener('touchend', endHandler);
      window.addEventListener('touchcancel', endHandler);
    }, 400);
  }, [cleanupTouch, cancelLongPress, createGhost, findDropCategory]);

  // ── Desktop HTML5 drag ────────────────────────────────────────────────────

  const handleHtml5DragStart = useCallback((e, itemId) => {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);

    startHtml5DragScroll(e.clientY);
  }, [startHtml5DragScroll]);

  const handleHtml5DragOver = useCallback((e, categoryId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.clientY != null) {
      currentDragYRef.current = e.clientY;
    }
    cardDropTargetIdRef.current = categoryId;
    setCardDropTargetId(categoryId);
  }, []);

  const handleHtml5DragEnd = useCallback(() => {
    stopHtml5DragScroll();
    draggedCardIdRef.current = null;
    cardDropTargetIdRef.current = null;
    setDraggedCardId(null);
    setCardDropTargetId(null);
  }, [stopHtml5DragScroll]);

  // ── Safety net: cleanup on unmount ────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopHtml5DragScroll();
      cleanupTouch();
    };
  }, [stopHtml5DragScroll, cleanupTouch]);

  return {
    draggedCardId,
    cardDropTargetId,
    startCardTouchDrag,
    handleHtml5DragStart,
    handleHtml5DragOver,
    handleHtml5DragEnd
  };
}
