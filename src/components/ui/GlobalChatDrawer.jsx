import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useChat } from '../../context/ChatContext';
import ProjectAiChat from './ProjectAiChat';
import ModelSelectorDropdown from './ModelSelectorDropdown';

import { IconButton, IconTile } from '../ds';
const GlobalChatDrawer = ({
  isOpen,
  onClose,
  projectData,
  isSecondaryPanel = false,
  isReplacingDetail = false,
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
          className="sm:hidden fixed inset-0 bg-scrim z-nav drawer-backdrop-fade"
          onClick={handleCloseAnimated}
        />
      )}

      {/* Mobile Backdrop to cover BottomNav and dim background */}
      <div
        className="sm:hidden fixed inset-0 bg-scrim z-sheet transition-opacity duration-200"
        onClick={handleCloseAnimated}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerPanelRef}
        style={{
          ...drawerStyle,
          '--chat-offset': isSecondaryPanel ? '444px' : '12px'
        }}
        className={`
          fixed z-sheet ${isSecondaryPanel ? 'sm:z-nav' : 'sm:z-dropdown'} flex flex-col bg-surface border border-subtle shadow-lg overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:rounded-xl
          sm:right-0 sm:[margin-right:var(--chat-offset)]
          ${
            isClosing
              ? (wasSwipedClosed ? '' : isReplacingDetail ? 'drawer-replace-out' : 'drawer-slide-out')
              : (isReplacingDetail ? 'drawer-replace-in' : ((entryAnimActive || slideInTrigger) ? 'drawer-slide-in' : ''))
          }
        `}
      >
        {/* Notch / Drag Handle for Mobile */}
        <div className="w-full flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-9 rounded-full bg-control" />
        </div>

        {/* Top Header Toolbar */}
        <div className="shrink-0 h-12 bg-surface border-b border-subtle flex items-center justify-between px-3 sm:px-4 gap-2">
          {/* Left: Logo & Model Selector */}
          <div className="flex items-center gap-2 min-w-0">
            <IconTile area="coach" size="sm" />

            {/* Model Selector Dropdown */}
            <ModelSelectorDropdown
              activeModel={activeModel}
              onSelectModel={setActiveModel}
            />
          </div>

          {/* Right: Actions (New Chat, History, Close) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* New Chat Button */}
            <IconButton icon="edit_square" label="Neues Gespräch beginnen" size="sm" onClick={() => setNewChatCounter((c) => c + 1)} />

            {/* History Toggle Button */}
            <IconButton
            icon="history"
            label={isHistoryOpen ? 'Chat anzeigen' : 'Chatverlauf anzeigen'}
            size="sm"
            variant={isHistoryOpen ? 'primary' : 'ghost'}
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            />

            {/* Close Button */}
            <IconButton icon="close" label="Schließen" size="sm" className="ml-0.5" onClick={handleCloseAnimated} />
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
