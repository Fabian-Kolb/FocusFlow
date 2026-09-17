import React, { useState, useEffect, useRef } from 'react';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import FioIcon from '../ui/FioIcon';

// Subsections
import AccountSection from './settings/AccountSection';
import FioGuideSection from './settings/FioGuideSection';
import TutorialsSection from './settings/TutorialsSection';
import AboutSection from './settings/AboutSection';

export const VALID_TABS = ['account', 'fio', 'tutorials', 'about'];
export const DEFAULT_TAB = 'account';

export function resolveSettingsTab(activeModal, payload) {
  if (activeModal === 'profile') return 'account';
  if (activeModal === 'settings' && VALID_TABS.includes(payload?.initialTab)) {
    return payload.initialTab;
  }
  return DEFAULT_TAB;
}

const TABS = [
  { id: 'account', label: 'Mein Account', icon: 'account_circle' },
  { id: 'fio', label: 'Fio KI-Guide', icon: 'fio' },
  { id: 'tutorials', label: 'Hilfe & Guides', icon: 'school' },
  { id: 'about', label: 'Über FocusFlow', icon: 'info' }
];

export default function SettingsModal() {
  const { activeModal, modalPayload, closeModal } = useModal();
  const { user, logout } = useAuth();

  const isOpen = activeModal === 'settings' || activeModal === 'profile';

  // Responsive Breakpoint (768px / Tailwind md:) for dynamic ARIA orientation
  const [isMdScreen, setIsMdScreen] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsMdScreen(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Active Tab State
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);

  // Unsaved Form State for AccountSection - preserved during intra-modal tab switching
  const [accountFormState, setAccountFormState] = useState({
    displayName: '',
    photoURL: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Focus trap & return refs
  const dialogRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const tabButtonRefs = useRef({});

  // Sync tab and reset form state when modal opens or payload changes
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      const resolvedTab = resolveSettingsTab(activeModal, modalPayload);
      setActiveTab(resolvedTab);

      setAccountFormState({
        displayName: user?.displayName || '',
        photoURL: user?.photoURL || '',
        newPassword: '',
        confirmPassword: ''
      });

      // Body scroll lock
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen, activeModal, modalPayload?.initialTab, user]);

  // Initial focus on active tab button
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const btn = tabButtonRefs.current[activeTab];
        if (btn && typeof btn.focus === 'function') {
          btn.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation & Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // 1. Escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // 2. Focus Trap (Tab & Shift+Tab)
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const firstElem = focusableElements[0];
          const lastElem = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElem) {
              e.preventDefault();
              lastElem.focus();
            }
          } else {
            if (document.activeElement === lastElem) {
              e.preventDefault();
              firstElem.focus();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    closeModal();
    // Return focus safely
    if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
      if (typeof document !== 'undefined' && document.body.contains(previousActiveElementRef.current)) {
        previousActiveElementRef.current.focus();
      }
    }
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
  };

  // Keyboard navigation within Tablist (Arrow keys, Home, End)
  const handleTablistKeyDown = (e) => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    const nextTab = TABS[nextIndex];
    if (nextTab) {
      setActiveTab(nextTab.id);
      tabButtonRefs.current[nextTab.id]?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="bg-surface border border-border sm:rounded-2xl w-full h-[100dvh] sm:h-[640px] sm:max-h-[85vh] sm:max-w-4xl shadow-2xl flex flex-col overflow-hidden text-on-surface pb-[env(safe-area-inset-bottom,16px)] sm:pb-0 pt-[env(safe-area-inset-top,0px)] sm:pt-0"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl sm:text-2xl text-primary">
              settings
            </span>
            <h2 id="settings-dialog-title" className="text-base sm:text-lg font-bold tracking-tight text-on-surface">
              Einstellungen & Hilfe
            </h2>
          </div>
          <button 
            type="button"
            onClick={handleClose}
            aria-label="Einstellungen schließen"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1.5 rounded-lg hover:bg-surface-variant/40 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body: Tabs + Panel */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Tablist Navigation */}
          <div 
            role="tablist"
            aria-orientation={isMdScreen ? 'vertical' : 'horizontal'}
            aria-label="Einstellungen und Hilfe Reiterauswahl"
            onKeyDown={handleTablistKeyDown}
            className="w-full md:w-60 bg-surface-variant/15 border-b md:border-b-0 md:border-r border-border p-2 md:p-3 flex md:flex-col gap-1 shrink-0 overflow-x-auto md:overflow-x-visible no-scrollbar"
          >
            {TABS.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={el => tabButtonRefs.current[tab.id] = el}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected 
                      ? 'bg-primary text-neutral-900 shadow-sm' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {tab.id === 'fio' ? (
                      <FioIcon className="w-4 h-4" color="currentColor" />
                    ) : (
                      <span className="material-symbols-outlined text-[18px] sm:text-[20px]">{tab.icon}</span>
                    )}
                  </div>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div 
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 focus:outline-none overscroll-contain"
          >
            {activeTab === 'account' && (
              <AccountSection 
                formState={accountFormState}
                setFormState={setAccountFormState}
                onLogout={handleLogout}
                onClose={handleClose}
              />
            )}
            {activeTab === 'fio' && (
              <FioGuideSection onSelectPrompt={() => handleClose()} />
            )}
            {activeTab === 'tutorials' && (
              <TutorialsSection />
            )}
            {activeTab === 'about' && (
              <AboutSection />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-surface-variant/10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">logout</span>
            {user?.isGuest ? 'Gast-Modus beenden' : 'Abmelden'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 sm:py-2 border border-border rounded-xl text-xs sm:text-sm font-semibold text-on-surface hover:bg-surface-variant/40 transition-colors cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
