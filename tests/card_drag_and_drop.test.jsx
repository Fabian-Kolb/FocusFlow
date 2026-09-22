import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardTouchDrag } from '../src/components/ui/useCardTouchDrag';

describe('useCardTouchDrag – Drag-and-Drop & Scroll Mechanics', () => {
  let mainContainer;

  beforeEach(() => {
    // Setup simulated <main> container in document
    mainContainer = document.createElement('main');
    Object.assign(mainContainer.style, {
      height: '600px',
      overflowY: 'auto',
    });
    mainContainer.scrollBy = vi.fn();
    mainContainer.getBoundingClientRect = () => ({
      top: 0,
      bottom: 600,
      left: 0,
      right: 800,
      width: 800,
      height: 600
    });
    document.elementsFromPoint = (x, y) => [];
    document.body.appendChild(mainContainer);
  });

  afterEach(() => {
    if (mainContainer && mainContainer.parentNode) {
      mainContainer.parentNode.removeChild(mainContainer);
    }
    vi.restoreAllMocks();
  });

  it('does not initiate drag if mouse moves <= 5px (treated as normal click)', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useCardTouchDrag({ onMoveItemToCategory: onMove, categoryPrefix: 'cat-sec-' })
    );

    // MouseDown
    act(() => {
      result.current.startCardDrag(
        { button: 0, clientX: 100, clientY: 100, target: document.createElement('div') },
        'proj_1',
        'Test Project'
      );
    });

    // Move only 3px (below 5px threshold)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 103, clientY: 100 }));
    });

    expect(result.current.draggedCardId).toBe(null);

    // MouseUp
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 103, clientY: 100 }));
    });

    expect(result.current.draggedCardId).toBe(null);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('activates drag mode when mouse moves > 5px and creates ghost element', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useCardTouchDrag({ onMoveItemToCategory: onMove, categoryPrefix: 'cat-sec-' })
    );

    act(() => {
      result.current.startCardDrag(
        { button: 0, clientX: 100, clientY: 100, target: document.createElement('div') },
        'proj_1',
        'Test Project'
      );
    });

    // Move 15px (above 5px threshold)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 115, clientY: 100 }));
    });

    expect(result.current.draggedCardId).toBe('proj_1');
    const ghost = document.getElementById('__card-drag-ghost__');
    expect(ghost).not.toBeNull();
    expect(ghost.textContent).toContain('Test Project');

    // Clean up
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 115, clientY: 100 }));
    });
    expect(result.current.draggedCardId).toBe(null);
  });

  it('allows manual mouse wheel scrolling on <main> while holding an item in drag mode', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useCardTouchDrag({ onMoveItemToCategory: onMove, categoryPrefix: 'cat-sec-' })
    );

    // Start drag
    act(() => {
      result.current.startCardDrag(
        { button: 0, clientX: 100, clientY: 100, target: document.createElement('div') },
        'proj_1',
        'Test Project'
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 120 }));
    });
    expect(result.current.draggedCardId).toBe('proj_1');

    // Dispatch wheel event
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 80 }));
    });

    expect(mainContainer.scrollBy).toHaveBeenCalledWith(0, 80);

    // Clean up
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 120, clientY: 120 }));
    });
  });

  it('detects drop category via category section ID and executes onMoveItemToCategory', () => {
    const onMove = vi.fn();

    // Create category section element
    const categorySec = document.createElement('div');
    categorySec.id = 'cat-sec-arbeit';
    mainContainer.appendChild(categorySec);

    // Mock elementsFromPoint
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([categorySec, mainContainer]);

    const { result } = renderHook(() =>
      useCardTouchDrag({ onMoveItemToCategory: onMove, categoryPrefix: 'cat-sec-' })
    );

    // Start drag
    act(() => {
      result.current.startCardDrag(
        { button: 0, clientX: 100, clientY: 100, target: document.createElement('div') },
        'proj_42',
        'Deploy Server'
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 300 }));
    });

    expect(result.current.cardDropTargetId).toBe('arbeit');

    // Drop mouseup
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 300 }));
    });

    expect(onMove).toHaveBeenCalledWith('proj_42', 'arbeit');
    expect(result.current.draggedCardId).toBe(null);
    expect(result.current.cardDropTargetId).toBe(null);
  });

  it('works symmetrically with reminder prefix rcat-sec-', () => {
    const onMove = vi.fn();

    const reminderCatSec = document.createElement('div');
    reminderCatSec.id = 'rcat-sec-privat';
    mainContainer.appendChild(reminderCatSec);

    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([reminderCatSec, mainContainer]);

    const { result } = renderHook(() =>
      useCardTouchDrag({ onMoveItemToCategory: onMove, categoryPrefix: 'rcat-sec-' })
    );

    act(() => {
      result.current.startCardDrag(
        { button: 0, clientX: 100, clientY: 100, target: document.createElement('div') },
        'rem_99',
        'Einkaufen'
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 350 }));
    });

    expect(result.current.cardDropTargetId).toBe('privat');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 250, clientY: 350 }));
    });

    expect(onMove).toHaveBeenCalledWith('rem_99', 'privat');
  });

  it('suppresses accidental click event immediately after completing a drag', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useCardTouchDrag({ onMoveItemToCategory: onMove, categoryPrefix: 'cat-sec-' })
    );

    act(() => {
      result.current.startCardDrag(
        { button: 0, clientX: 100, clientY: 100, target: document.createElement('div') },
        'proj_1',
        'Test Project'
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 150 }));
    });

    // The subsequent click event should be intercepted and preventDefault called
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    window.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });
});
