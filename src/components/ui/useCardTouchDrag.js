import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useCardTouchDrag – Safe card drag hook.
 *
 * Desktop: pure HTML5 drag-and-drop (draggable + onDragStart/onDragOver/onDrop/onDragEnd).
 *   NO pointer events, NO touch events, NO window listeners for desktop mouse.
 *
 * Touch (tablet/phone): touchstart → touchmove → touchend with a custom ghost element.
 *   NO pointer events used at all, only native Touch API.
 *
 * The key safety principle: we NEVER add window-level mouse/pointer listeners.
 * All desktop drag state is managed purely through the HTML5 drag events which the
 * browser guarantees will fire (dragstart → drag → dragend).
 */
export function useCardTouchDrag({ onMoveItemToCategory, categoryPrefix = 'cat-sec-' }) {
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [cardDropTargetId, setCardDropTargetId] = useState(null);

  // Use refs for everything to avoid stale closures in event handlers
  const draggedCardIdRef = useRef(null);
  const cardDropTargetIdRef = useRef(null);
  const ghostRef = useRef(null);
  const onMoveRef = useRef(onMoveItemToCategory);
  const isTouchDraggingRef = useRef(false);

  // Stable refs for event handler functions (prevents stale closures)
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

  const createGhost = useCallback((title, x, y) => {
    destroyGhost();
    const el = document.createElement('div');
    el.id = '__card-drag-ghost__';
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      transform: `translate(${x + 12}px, ${y - 12}px)`,
      pointerEvents: 'none',
      zIndex: '999999',
      background: '#0F172A',
      color: '#F8FAFC',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      padding: '8px 16px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: '700',
      fontFamily: 'inherit',
      boxShadow: '0 20px 30px -10px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.1)',
      whiteSpace: 'nowrap',
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      opacity: '0.92',
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

  // ── Touch cleanup (bulletproof) ───────────────────────────────────────────

  const cleanupTouch = useCallback(() => {
    isTouchDraggingRef.current = false;
    destroyGhost();

    // Remove listeners using the SAME function references
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
  }, [destroyGhost]);

  // ── Touch drag (tablets / phones only) ────────────────────────────────────

  const startCardTouchDrag = useCallback((e, itemId, itemTitle) => {
    // ONLY real touch events. Mouse never enters here.
    if (!e.touches || e.touches.length === 0) return;

    const target = e.target;
    if (target.closest('button') || target.closest('a') || target.closest('input')) return;

    // Clean up any previous drag that didn't end properly
    cleanupTouch();

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    isTouchDraggingRef.current = true;
    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);
    createGhost(itemTitle, x, y);

    document.body.style.userSelect = 'none';

    // Create handler functions and store references for safe removal
    const moveHandler = (te) => {
      if (!isTouchDraggingRef.current) return;
      const touch = te.touches[0];
      if (!touch) return;

      const tx = touch.clientX;
      const ty = touch.clientY;

      // Move ghost
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${tx + 12}px, ${ty - 12}px)`;
      }

      // Auto-scroll at edges
      const edgeThreshold = 100;
      const viewportHeight = window.innerHeight;
      if (ty < edgeThreshold) {
        window.scrollBy(0, -8);
      } else if (ty > viewportHeight - edgeThreshold) {
        window.scrollBy(0, 8);
      }

      // Find drop target
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

    // Store refs for cleanup
    touchMoveHandlerRef.current = moveHandler;
    touchEndHandlerRef.current = endHandler;

    window.addEventListener('touchmove', moveHandler, { passive: true });
    window.addEventListener('touchend', endHandler);
    window.addEventListener('touchcancel', endHandler);
  }, [cleanupTouch, createGhost, findDropCategory]);

  // ── Desktop HTML5 drag (pure, no custom listeners) ────────────────────────

  const handleHtml5DragStart = useCallback((e, itemId) => {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);
  }, []);

  const handleHtml5DragOver = useCallback((e, categoryId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
      cleanupTouch();
    };
  }, [cleanupTouch]);

  return {
    draggedCardId,
    cardDropTargetId,
    startCardTouchDrag,
    handleHtml5DragStart,
    handleHtml5DragOver,
    handleHtml5DragEnd
  };
}
