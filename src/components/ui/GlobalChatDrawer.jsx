import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useChat } from '../../context/ChatContext';
import ProjectAiChat from './ProjectAiChat';
import FioIcon from './FioIcon';
import ModelSelectorDropdown from './ModelSelectorDropdown';

const GlobalChatDrawer = ({
  isOpen,
  onClose,
  projectData,
  isSecondaryPanel = false,
  contextScope = 'project',
  contextData = null
}) => {
  const { activeModel, setActiveModel } = useChat();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [slideInTrigger, setSlideInTrigger] = useState(true);
  const drawerPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // History & New Chat States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [newChatCounter, setNewChatCounter] = useState(0);

  // Prevent body scroll on mobile when open
  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setIsHistoryOpen(false);
      }, 220);
      return () => clearTimeout(timer);
    }

    // When isOpen is true
    setShouldRender(true);
    setIsClosing(false);
    setSlideInTrigger(true);
  }, [isOpen]);

  // Reset slide-in class after animation finishes
  useEffect(() => {
    if (slideInTrigger) {
      const timer = setTimeout(() => {
        setSlideInTrigger(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [slideInTrigger]);

  const handleCloseAnimated = () => {
    onClose();
  };

  // Mobile swipe-to-close gesture
  const { drawerStyle, entryAnimActive, wasSwipedClosed } = useSwipeToClose({
    isOpen: isOpen && shouldRender,
    onClose: handleCloseAnimated,
    drawerRef: drawerPanelRef,
    scrollContainerRef: scrollContainerRef,
    threshold: 120
  });

  // Desktop click outside to close (ins Leere drücken)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e) => {
      // If click is on desktop outside the drawer panel
      if (drawerPanelRef.current && !drawerPanelRef.current.contains(e.target)) {
        // Ignore clicks inside note modals, rich-text toolbars, or drawer triggers
        if (
          e.target.closest && (
            e.target.closest('[role="dialog"]') ||
            e.target.closest('.ql-container') ||
            e.target.closest('.ql-toolbar') ||
            e.target.closest('button[title*="Fio"]') ||
            e.target.closest('[data-drawer-trigger]') ||
            e.target.closest('.task-item') ||
            e.target.closest('.section-header') ||
            e.target.closest('[id^="task-"]')
          )
        ) {
          return;
        }
        handleCloseAnimated();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDownOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen]);

  if (!shouldRender && !isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 drawer-backdrop-fade"
          onClick={handleCloseAnimated}
        />
      )}

      {/* Drawer Panel */}
      <div 
        ref={drawerPanelRef}
        style={{
          ...drawerStyle,
          '--chat-offset': isSecondaryPanel ? '444px' : '12px'
        }}
        className={`
          fixed z-50 sm:z-40 flex flex-col bg-white border border-outline-variant shadow-2xl overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-3xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:rounded-2xl
          sm:right-0 sm:[margin-right:var(--chat-offset)]
          ${isClosing ? (wasSwipedClosed ? '' : 'drawer-slide-out') : ((entryAnimActive || slideInTrigger) ? 'drawer-slide-in' : '')}
        `}
      >
        {/* Notch / Drag Handle for Mobile */}
        <div className="w-full flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full" />
        </div>

        {/* Top Header Toolbar */}
        <div className="shrink-0 h-13 bg-white border-b border-outline-variant flex items-center justify-between px-3 sm:px-4 gap-2">
          {/* Left: Logo & Model Selector */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 shrink-0 flex items-center justify-center bg-primary/10 rounded-lg p-1 text-primary">
              <FioIcon className="w-full h-full text-primary" color="currentColor" />
            </div>

            {/* Model Selector Dropdown */}
            <ModelSelectorDropdown
              activeModel={activeModel}
              onSelectModel={setActiveModel}
            />
          </div>

          {/* Right: Actions (New Chat, History, Close) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* New Chat Button */}
            <button
              onClick={() => setNewChatCounter((c) => c + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-low text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              title="Neues Gespräch beginnen"
            >
              <span className="material-symbols-outlined text-[19px]">edit_square</span>
            </button>

            {/* History Toggle Button */}
            <button
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                isHistoryOpen
                  ? 'bg-primary text-white shadow-xs'
                  : 'hover:bg-surface-low text-on-surface-variant hover:text-primary'
              }`}
              title={isHistoryOpen ? 'Chat anzeigen' : 'Chatverlauf anzeigen'}
            >
              <span className="material-symbols-outlined text-[19px]">history</span>
            </button>

            {/* Close Button */}
            <button 
              onClick={handleCloseAnimated}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-surface-variant transition-colors cursor-pointer ml-0.5"
              title="Schließen"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Chat Component */}
        <ProjectAiChat 
          projectData={projectData}
          contextScope={contextScope}
          contextData={contextData}
          scrollContainerRef={scrollContainerRef}
          activeModel={activeModel}
          isHistoryOpen={isHistoryOpen}
          setIsHistoryOpen={setIsHistoryOpen}
          newChatTrigger={newChatCounter}
        />
      </div>
    </>
  );
};

export default GlobalChatDrawer;
