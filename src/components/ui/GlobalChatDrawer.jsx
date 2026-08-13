import React, { useEffect } from 'react';
import ProjectAiChat from './ProjectAiChat';

const GlobalChatDrawer = ({
  isOpen,
  onClose,
  projectData,
  isSecondaryPanel = false
}) => {
  // Prevent body scroll on mobile when open
  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // We use a CSS variable for the exact right offset on desktop to be 100% responsive and robust.
  // Main drawer is 420px wide with mr-3 (12px). So the right offset should be 420 + 12 + gap(12) = 444px.
  
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 drawer-backdrop-fade"
          onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <div 
        style={{ '--chat-offset': isSecondaryPanel ? '444px' : '12px' }}
        className={`
          fixed z-50 flex flex-col bg-white border border-outline-variant shadow-2xl overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-3xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:rounded-2xl
          sm:right-0 sm:[margin-right:var(--chat-offset)]
          ${isOpen ? 'drawer-slide-in' : 'translate-y-full sm:translate-y-0 sm:translate-x-[calc(110%+var(--chat-offset))]'}
          transition-transform duration-300
        `}
      >
        {/* Header */}
        <div className="shrink-0 h-14 bg-white border-b border-outline-variant flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span>
            <span className="font-bold font-mono text-sm uppercase text-primary tracking-wide">KI-Coach</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Chat Component */}
        <ProjectAiChat 
          projectData={projectData}
          contextScope="project"
          contextData={null}
        />
      </div>
    </>
  );
};

export default GlobalChatDrawer;
