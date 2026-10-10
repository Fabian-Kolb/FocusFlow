import React, { useState, useEffect, useRef } from 'react';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';

// Subsections
import AccountSection from './settings/AccountSection';
import FioGuideSection from './settings/FioGuideSection';
import TutorialsSection from './settings/TutorialsSection';
import AboutSection from './settings/AboutSection';
import { Button, FioMark, Icon, IconButton } from '../ds';

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
  { id: 'tutorials', label: 'Hilfe und Guides', icon: 'school' },
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
      className="fixed inset-0 z-dialog flex items-center justify-center bg-scrim"
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
        className="flex h-[100dvh] w-full flex-col overflow-hidden border border-subtle bg-surface pb-[env(safe-area-inset-bottom,16px)] pt-[env(safe-area-inset-top,0px)] shadow-lg sm:h-[640px] sm:max-h-[85vh] sm:max-w-4xl sm:rounded-xl sm:pb-0 sm:pt-0"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-subtle px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Icon name="settings" size="lg" className="text-secondary" />
          <h2 id="settings-dialog-title" className="text-heading text-primary">
            Einstellungen und Hilfe
          </h2>
        </div>
        <IconButton icon="close" label="Einstellungen schließen" size="sm" onClick={handleClose} />
        </div>

        {/* Modal Body: Tabs + Panel */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Tablist Navigation */}
          <div
            role="tablist"
            aria-orientation={isMdScreen ? 'vertical' : 'horizontal'}
            aria-label="Einstellungen und Hilfe Reiterauswahl"
            onKeyDown={handleTablistKeyDown}
            className="no-scrollbar flex w-full shrink-0 gap-1 overflow-x-auto border-b border-subtle bg-subtle p-2 md:w-60 md:flex-col md:overflow-x-visible md:border-b-0 md:border-r md:p-3"
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
                  className={`flex h-10 shrink-0 items-center gap-2.5 rounded-md px-3 text-label transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  isSelected
                    ? 'bg-accent-subtle text-accent'
                    : 'text-secondary hover:bg-hover hover:text-primary'
                  }`}
                  >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {tab.id === 'fio' ? (
                    <FioMark size={20} />
                  ) : (
                    <Icon name={tab.icon} size="md" filled={isSelected} />
                  )}
                  </span>
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
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus:outline-none sm:p-6"
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
        <div className="flex shrink-0 items-center justify-between border-t border-subtle bg-subtle px-5 py-3">
        <Button variant="danger-ghost" size="sm" leadingIcon="logout" onClick={handleLogout}>
          {user?.isGuest ? 'Gast-Modus beenden' : 'Abmelden'}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleClose}>
          Schließen
        </Button>
        </div>
      </div>
    </div>
  );
}
