import { useState, useRef, useCallback, useEffect } from 'react';
import { useAutoScroll } from './useAutoScroll';

/**
 * useCardTouchDrag – Universal card drag hook for Tablets, Smartphones, and Desktop.
 * Provides separate, safe paths for Desktop HTML5 drag & Touchscreen Pointer drag.
 *
 * @param {Function} onMoveItemToCategory - (itemId, categoryIdOrColumn) => void
 * @param {string}   categoryPrefix       - 'cat-sec-' | 'rcat-sec-' | 'kanban-col-'
 */
export function useCardTouchDrag({ onMoveItemToCategory, categoryPrefix = 'cat-sec-' }) {
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [cardDropTargetId, setCardDropTargetId] = useState(null);

  const { startDragScroll, onDragMove: triggerScrollMove, stopDragScroll } = useAutoScroll();

  const draggedCardIdRef = useRef(null);
  const cardDropTargetIdRef = useRef(null);
  const ghostRef = useRef(null);
  const onMoveRef = useRef(onMoveItemToCategory);

  useEffect(() => {
    onMoveRef.current = onMoveItemToCategory;
  }, [onMoveItemToCategory]);

  const destroyGhost = useCallback(() => {
    ghostRef.current?.remove();
    ghostRef.current = null;
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

  const moveGhost = useCallback((x, y) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${x + 12}px, ${y - 12}px)`;
    }
  }, []);

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

  const onPointerMove = useCallback((e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null || y == null) return;

    moveGhost(x, y);
    triggerScrollMove(y);

    const catId = findDropCategory(x, y);
    cardDropTargetIdRef.current = catId;
    setCardDropTargetId(catId);
  }, [moveGhost, triggerScrollMove, findDropCategory]);

  const onPointerUp = useCallback(() => {
    stopDragScroll();
    const itemId = draggedCardIdRef.current;
    const targetCatId = cardDropTargetIdRef.current;

    if (itemId && targetCatId) {
      onMoveRef.current?.(itemId, targetCatId);
    }

    destroyGhost();
    draggedCardIdRef.current = null;
    cardDropTargetIdRef.current = null;
    setDraggedCardId(null);
    setCardDropTargetId(null);

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('touchend', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [destroyGhost, onPointerMove, stopDragScroll]);

  // Touch Pointer start (for touchscreens / tablets only)
  const startCardTouchDrag = useCallback((e, itemId, itemTitle) => {
    // Desktop mouse uses native HTML5 Drag, do not intercept mouse down!
    if (e.pointerType === 'mouse') {
      return;
    }

    const target = e.target;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }

    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);

    startDragScroll(y);
    createGhost(itemTitle, x, y);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [createGhost, onPointerMove, onPointerUp, startDragScroll]);

  // Desktop HTML5 drag helpers
  const handleHtml5DragStart = useCallback((e, itemId) => {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
    draggedCardIdRef.current = itemId;
    setDraggedCardId(itemId);
    startDragScroll(e.clientY);
  }, [startDragScroll]);

  const handleHtml5DragOver = useCallback((e, categoryId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    triggerScrollMove(e.clientY);
    cardDropTargetIdRef.current = categoryId;
    setCardDropTargetId(categoryId);
  }, [triggerScrollMove]);

  const handleHtml5DragEnd = useCallback(() => {
    stopDragScroll();
    destroyGhost();
    draggedCardIdRef.current = null;
    cardDropTargetIdRef.current = null;
    setDraggedCardId(null);
    setCardDropTargetId(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [destroyGhost, stopDragScroll]);

  useEffect(() => {
    return () => {
      stopDragScroll();
      destroyGhost();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [destroyGhost, stopDragScroll]);

  return {
    draggedCardId,
    cardDropTargetId,
    startCardTouchDrag,
    handleHtml5DragStart,
    handleHtml5DragOver,
    handleHtml5DragEnd
  };
}
