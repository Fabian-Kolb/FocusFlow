import { useRef, useState } from 'react';

/**
 * Wisch-/Drag-Steuerung für das Monats-Karussell (Vormonat | aktuell | Folgemonat).
 * Gibt Offset/Statusflags und die Event-Handler für den Container zurück.
 * `isAnimatingRef` verhindert Race Conditions bei schnellen Wischgesten.
 */
export function useMonthCarousel({ onNext, onPrev }) {
  const containerRef = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const startTime = useRef(0);
  const isHorizontal = useRef(false);

  const startDrag = (clientX, clientY) => {
    if (isAnimatingRef.current) return;
    startX.current = clientX;
    startY.current = clientY;
    deltaX.current = 0;
    startTime.current = Date.now();
    isHorizontal.current = false;
    setIsDragging(true);
  };

  const moveDrag = (clientX, clientY, e) => {
    if (!isDragging || isAnimatingRef.current) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;
    deltaX.current = dx;

    if (!isHorizontal.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      if (Math.abs(dx) > Math.abs(dy)) {
        isHorizontal.current = true;
      } else {
        setIsDragging(false);
        return;
      }
    }

    if (isHorizontal.current) {
      if (e && e.cancelable) e.preventDefault();
      setSwipeOffset(dx);
    }
  };

  const finishAnimation = (offset, after) => {
    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeOffset(offset);
    setTimeout(() => {
      isAnimatingRef.current = false;
      setIsAnimating(false);
      setSwipeOffset(0);
      if (after) after();
    }, 260);
  };

  const endDrag = () => {
    if (!isDragging || isAnimatingRef.current) return;
    setIsDragging(false);

    const dx = deltaX.current;
    const elapsed = Math.max(Date.now() - startTime.current, 1);
    const velocity = Math.abs(dx) / elapsed;
    const width = containerRef.current?.offsetWidth || window.innerWidth;
    const threshold = Math.min(width * 0.18, 70);
    const isSwipe = isHorizontal.current && (Math.abs(dx) > threshold || (Math.abs(dx) > 30 && velocity > 0.35));

    if (isSwipe) {
      // Hineingleiten, dann nahtlos ohne Rückanimation zurücksetzen
      if (dx < 0) finishAnimation(-width, onNext);
      else finishAnimation(width, onPrev);
    } else {
      finishAnimation(0, null); // Zurückfedern
    }
    isHorizontal.current = false;
  };

  const handlers = {
    onTouchStart: (e) => startDrag(e.targetTouches[0].clientX, e.targetTouches[0].clientY),
    onTouchMove: (e) => moveDrag(e.targetTouches[0].clientX, e.targetTouches[0].clientY, e),
    onTouchEnd: endDrag,
    onMouseDown: (e) => {
      if (e.button === 0 && !e.target.closest('button') && !e.target.closest('[role="dialog"]')) {
        startDrag(e.clientX, e.clientY);
      }
    },
    onMouseMove: (e) => moveDrag(e.clientX, e.clientY, e),
    onMouseUp: endDrag,
    onMouseLeave: endDrag,
  };

  return { containerRef, swipeOffset, isDragging, isAnimating, handlers };
}
