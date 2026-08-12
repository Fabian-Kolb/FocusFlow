import { useEffect, useRef, useState } from 'react';

export const useSwipeToClose = ({
  isOpen,
  onClose,
  drawerRef, // Ref to the entire drawer panel
  scrollContainerRef, // Ref to the scrollable content area (if applicable)
  threshold = 150 // pixels to swipe before closing
}) => {
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const startYRef = useRef(null);
  const currentYRef = useRef(null);
  const isEligibleToDragRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const drawer = drawerRef.current;
    
    const handleTouchStart = (e) => {
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      
      // Determine if we are allowed to start dragging.
      // 1. If clicking inside the scroll container, we can only drag if we are at the very top (scrollTop <= 0)
      if (scrollContainerRef && scrollContainerRef.current && scrollContainerRef.current.contains(e.target)) {
        if (scrollContainerRef.current.scrollTop <= 0) {
          isEligibleToDragRef.current = true;
        } else {
          isEligibleToDragRef.current = false;
        }
      } else {
        // 2. If clicking on the header/drag handle (outside scroll container), always eligible
        isEligibleToDragRef.current = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isEligibleToDragRef.current || startYRef.current === null) return;
      
      currentYRef.current = e.touches[0].clientY;
      const deltaY = currentYRef.current - startYRef.current;

      // Only allow dragging downwards (deltaY > 0)
      if (deltaY > 0) {
        setIsDragging(true);
        setTranslateY(deltaY);
        
        // Prevent default scrolling and pull-to-refresh when actively dragging the drawer
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging) {
        // Reset state
        startYRef.current = null;
        currentYRef.current = null;
        isEligibleToDragRef.current = false;
        return;
      }

      const deltaY = currentYRef.current - startYRef.current;

      if (deltaY > threshold) {
        // Close drawer
        onClose();
        // Keep it down visually while it unmounts
        setTranslateY(window.innerHeight); 
      } else {
        // Snap back
        setTranslateY(0);
      }

      setIsDragging(false);
      startYRef.current = null;
      currentYRef.current = null;
      isEligibleToDragRef.current = false;
    };

    // Use passive: false for touchmove to allow preventDefault
    drawer.addEventListener('touchstart', handleTouchStart, { passive: true });
    drawer.addEventListener('touchmove', handleTouchMove, { passive: false });
    drawer.addEventListener('touchend', handleTouchEnd);
    drawer.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart);
      drawer.removeEventListener('touchmove', handleTouchMove);
      drawer.removeEventListener('touchend', handleTouchEnd);
      drawer.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isOpen, onClose, threshold]);

  // Reset translateY when drawer closes normally
  useEffect(() => {
    if (!isOpen) {
      setTranslateY(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  return {
    translateY,
    isDragging,
    // Add inline styles for the drawer panel
    drawerStyle: {
      transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
      transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      // Note: we let CSS classes handle the entry/exit animations, 
      // but override with inline transform when dragging.
    }
  };
};
