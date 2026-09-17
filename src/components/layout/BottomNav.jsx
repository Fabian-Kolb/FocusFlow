import React, { useState, useEffect, useRef } from 'react';
import FioIcon from '../ui/FioIcon';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';

const BottomNav = ({ currentScreen, setCurrentScreen }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef(null);
  const sheetRef = useRef(null);
  const { openModal } = useModal();
  const { user } = useAuth();

  // 4 Primary Navigation Items
  const primaryNavItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'reminders', label: 'Erinnerungen', icon: 'notifications' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
  ];

  // Secondary Items inside "Mehr" Sheet
  const moreNavItems = [
    { id: 'projects', label: 'Projekte', icon: 'folder', desc: 'Etappen & Aufgaben strukturieren' },
    { id: 'board', label: 'Board', icon: 'view_kanban', desc: 'Kanban-Übersicht & Workflow' },
    { id: 'coach', label: 'Coach', icon: 'fio', desc: 'KI-Assistent & Tages-Sparring' },
    { id: 'review', label: 'Review', icon: 'analytics', desc: 'Wöchentlicher Leistungs-Rückblick' },
    { id: 'trash', label: 'Papierkorb', icon: 'delete', desc: 'Gelöschte Elemente & Wiederherstellung' },
    {
      id: 'settings',
      label: 'Einstellungen & Hilfe',
      icon: 'settings',
      desc: user?.isGuest ? 'Gast-Modus, Fio-Guide & Hilfe' : 'Account, Fio KI-Guide & Hilfe'
    },
  ];

  const isMoreActive = [
    'projects',
    'project-detail',
    'board',
    'coach',
    'review',
    'trash'
  ].includes(currentScreen);

  // Focus Trap & Accessibility inside More Sheet
  useEffect(() => {
    if (!isMoreOpen) return;

    // 1. Body Scroll Lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 2. Focus first interactive element inside sheet
    const focusableElements = sheetRef.current?.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // 3. Escape key & Tab trapping
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMoreOpen(false);
        moreButtonRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && focusableElements && focusableElements.length > 0) {
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
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

  const handleSelectMoreItem = (id) => {
    if (id === 'profile' || id === 'settings') {
      setIsMoreOpen(false);
      openModal('settings', { initialTab: 'account' });
      return;
    }
    setCurrentScreen(id);
    setIsMoreOpen(false);
    moreButtonRef.current?.focus();
  };

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 w-full z-50 pointer-events-none"
    >
      {/* Backdrop for "Mehr" Bottom Sheet */}
      {isMoreOpen && (
        <div 
          onClick={() => {
            setIsMoreOpen(false);
            moreButtonRef.current?.focus();
          }}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* "Mehr" Bottom Sheet */}
      <div
        id="more-nav-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Weitere Navigationsziele"
        ref={sheetRef}
        className={`fixed left-0 right-0 z-50 mx-auto max-w-lg w-full bg-surface border-t border-outline-variant rounded-t-3xl shadow-2xl p-4 sm:p-6 pointer-events-auto transition-all duration-300 ease-out max-h-[85vh] flex flex-col ${
          isMoreOpen 
            ? 'bottom-0 translate-y-0 opacity-100' 
            : 'bottom-0 translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Drag Notch / Header */}
        <div className="flex flex-col items-center mb-4 shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant rounded-full mb-3" />
          <div className="flex items-center justify-between w-full px-1">
            <h2 className="text-base font-bold text-primary">Weitere Bereiche</h2>
            <button
              onClick={() => {
                setIsMoreOpen(false);
                moreButtonRef.current?.focus();
              }}
              aria-label="Menü schließen"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-low text-on-surface-variant hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Grid of secondary items */}
        <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-0.5">
          {moreNavItems.map((item) => {
            const isItemActive = 
              currentScreen === item.id ||
              (item.id === 'projects' && currentScreen === 'project-detail');

            return (
              <button
                key={item.id}
                onClick={() => handleSelectMoreItem(item.id)}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isItemActive
                    ? 'bg-surface-low border-primary text-primary font-bold shadow-sm'
                    : 'bg-white border-outline-variant text-primary hover:border-primary/50'
                }`}
              >
                <div className={`w-10 h-10 ${(item.id === 'profile' || item.id === 'settings') ? 'rounded-full' : 'rounded-xl'} flex items-center justify-center shrink-0 overflow-hidden ${
                  isItemActive ? 'bg-primary text-white' : 'bg-surface-low text-primary'
                }`}>
                  {item.id === 'coach' ? (
                    <FioIcon className="w-5 h-5" color="currentColor" />
                  ) : (item.id === 'profile' || item.id === 'settings') && user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (item.id === 'profile' || item.id === 'settings') && user?.isGuest ? (
                    <span className="material-symbols-outlined text-amber-500 text-[22px]">person</span>
                  ) : (item.id === 'profile' || item.id === 'settings') && !user?.isGuest ? (
                    <span className="text-xs font-bold font-mono text-primary">
                      {(user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase()}
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{item.label}</span>
                    {isItemActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">{item.desc}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 4+1 Fixed Bottom Navigation Bar */}
      <div 
        className="w-full bg-surface/95 backdrop-blur-md border-t border-outline-variant px-2 sm:px-4 pointer-events-auto flex justify-around items-center transition-all"
        style={{
          minHeight: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* 4 Primary Tabs */}
        {primaryNavItems.map((item) => {
          const isActive = 
            currentScreen === item.id ||
            (item.id === 'reminders' && currentScreen === 'reminder-detail');

          return (
            <button
              key={item.id}
              onClick={() => {
                if (isMoreOpen) setIsMoreOpen(false);
                setCurrentScreen(item.id);
              }}
              className={`group relative flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1.5 min-w-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <div className="relative">
                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'scale-105' : ''} transition-transform`}>
                  {item.icon}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </div>
              <span className={`text-[10px] sm:text-[11px] font-sans mt-0.5 tracking-tight truncate max-w-[64px] ${
                isActive ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Tab: "Mehr" Trigger */}
        <button
          ref={moreButtonRef}
          onClick={() => setIsMoreOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          aria-controls="more-nav-sheet"
          className={`group relative flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1.5 min-w-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl ${
            isMoreActive || isMoreOpen
              ? 'text-primary font-bold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <div className="relative">
            <span className={`material-symbols-outlined text-[24px] ${isMoreActive || isMoreOpen ? 'scale-105' : ''} transition-transform`}>
              {isMoreOpen ? 'expand_more' : 'more_horiz'}
            </span>
            {isMoreActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
            )}
          </div>
          <span className={`text-[10px] sm:text-[11px] font-sans mt-0.5 tracking-tight truncate max-w-[64px] ${
            isMoreActive || isMoreOpen ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'
          }`}>
            Mehr
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
