import { useRef, useCallback, useEffect } from 'react';

/**
 * useAutoScroll – Utility for edge auto-scrolling and manual mouse wheel / trackpad scrolling during drag operations.
 */
export function useAutoScroll() {
  const scrollAnimFrameRef = useRef(null);
  const pointerYRef = useRef(null);
  const isDraggingRef = useRef(false);

  const startAutoScroll = useCallback(() => {
    const edgeThreshold = 120; // px from top/bottom edge
    const maxSpeed = 22;       // max scroll speed per frame

    const loop = () => {
      if (!isDraggingRef.current || pointerYRef.current == null) {
        scrollAnimFrameRef.current = null;
        return;
      }

      const y = pointerYRef.current;
      const viewportHeight = window.innerHeight;

      if (y < edgeThreshold) {
        // Near top -> scroll up
        const intensity = (edgeThreshold - Math.max(0, y)) / edgeThreshold;
        const speed = Math.max(3, Math.round(intensity * maxSpeed));
        window.scrollBy(0, -speed);
      } else if (y > viewportHeight - edgeThreshold) {
        // Near bottom -> scroll down
        const intensity = (Math.min(viewportHeight, y) - (viewportHeight - edgeThreshold)) / edgeThreshold;
        const speed = Math.max(3, Math.round(intensity * maxSpeed));
        window.scrollBy(0, speed);
      }

      scrollAnimFrameRef.current = requestAnimationFrame(loop);
    };

    if (!scrollAnimFrameRef.current) {
      scrollAnimFrameRef.current = requestAnimationFrame(loop);
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    isDraggingRef.current = false;
    pointerYRef.current = null;
    if (scrollAnimFrameRef.current) {
      cancelAnimationFrame(scrollAnimFrameRef.current);
      scrollAnimFrameRef.current = null;
    }
  }, []);

  const handleWheel = useCallback((e) => {
    if (isDraggingRef.current) {
      // Smooth manual scroll when mouse wheel or trackpad scroll occurs during drag
      window.scrollBy(0, e.deltaY);
    }
  }, []);

  const onDragMove = useCallback((y) => {
    pointerYRef.current = y;
    if (isDraggingRef.current && !scrollAnimFrameRef.current) {
      startAutoScroll();
    }
  }, [startAutoScroll]);

  const startDragScroll = useCallback((initialY) => {
    isDraggingRef.current = true;
    pointerYRef.current = initialY;
    window.addEventListener('wheel', handleWheel, { passive: true });
    startAutoScroll();
  }, [handleWheel, startAutoScroll]);

  const stopDragScroll = useCallback(() => {
    stopAutoScroll();
    window.removeEventListener('wheel', handleWheel);
  }, [stopAutoScroll, handleWheel]);

  useEffect(() => {
    return () => {
      stopDragScroll();
    };
  }, [stopDragScroll]);

  return {
    startDragScroll,
    onDragMove,
    stopDragScroll
  };
}
