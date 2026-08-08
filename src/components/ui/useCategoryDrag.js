import { useState, useEffect, useRef, useCallback } from 'react';
import { useAutoScroll } from './useAutoScroll';

/**
 * useCategoryDrag – Precise slot-based drag-and-drop for category lists.
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

  const { startDragScroll, onDragMove: triggerAutoScrollMove, stopDragScroll } = useAutoScroll();

  // Stable refs to avoid stale closures in event listeners
  const draggedCatIdRef = useRef(null);
  const dropTargetRef   = useRef(null);
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

  const moveGhost = useCallback((x, y) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${x + 16}px, ${y - 16}px)`;
    }
  }, []);

  // ── Slot & Drop Target Calculation ─────────────────────────────────────────

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
      return { slotIndex: 0, dropTarget: null };
    }

    let slotIndex = visibleOtherItems.length;
    for (let k = 0; k < visibleOtherItems.length; k++) {
      if (cursorY < visibleOtherItems[k].midY) {
        slotIndex = k;
        break;
      }
    }

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

    return { dropTarget };
  }, [sectionIdPrefix]);

  const updateDropTarget = useCallback((cursorY) => {
    const { dropTarget } = calcDropSlot(cursorY);
    dropTargetRef.current = dropTarget;
    setDropTarget(dropTarget);
  }, [calcDropSlot]);

  // ── Event Handlers ─────────────────────────────────────────────────────────

  const onPointerMove = useCallback((e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null || y == null) return;

    moveGhost(x, y);
    updateDropTarget(y);
    triggerAutoScrollMove(y);
  }, [moveGhost, updateDropTarget, triggerAutoScrollMove]);

  const onPointerUpRef = useRef(null);

  const onPointerUp = useCallback(() => {
    stopDragScroll();
    const dragged = draggedCatIdRef.current;
    const target = dropTargetRef.current;
    const cats    = categoriesRef.current;

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

    // Cleanup state
    destroyGhost();
    draggedCatIdRef.current = null;
    dropTargetRef.current   = null;
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
  }, [destroyGhost, onPointerMove, stopDragScroll]);

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

    startDragScroll(y);

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
  }, [collapseAll, createGhost, updateDropTarget, onPointerMove, onPointerUp, startDragScroll]);

  useEffect(() => {
    return () => {
      destroyGhost();
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    };
  }, [destroyGhost]);

  return { draggedCatId, dropTarget, startDrag };
}
