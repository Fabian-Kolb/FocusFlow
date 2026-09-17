import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import FioIcon from '../ui/FioIcon';
import { BREAKPOINTS } from '../../lib/breakpoints';

const Sidebar = ({ currentScreen, setCurrentScreen, collapsed, setCollapsed }) => {
  const { user } = useAuth();
  const { openModal } = useModal();
  const closeButtonRef = useRef(null);

  // Close tablet drawer on Escape key and manage focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !collapsed && typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.DESKTOP) {
        setCollapsed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, setCollapsed]);

  // Focus management: when opening tablet drawer, shift focus to close button
  useEffect(() => {
    if (!collapsed && typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.DESKTOP) {
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [collapsed]);

  const handleNavClick = (itemId) => {
    setCurrentScreen(itemId);
    // On tablet, automatically collapse overlay after choosing screen
    if (typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.DESKTOP && !collapsed) {
      setCollapsed(true);
    }
  };

  const handleProfileClick = () => {
    openModal('profile');
    if (typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.DESKTOP && !collapsed) {
      setCollapsed(true);
    }
  };

  const userInitial = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  // Navigation targets with required icons (including smart_toy / auto_awesome AI coach compatibility)
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'reminders', label: 'Erinnerungen', icon: 'notifications' },
    { id: 'projects', label: 'Projekte', icon: 'folder' },
    { id: 'board', label: 'Kanban Board', icon: 'view_kanban' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
    { id: 'coach', label: 'Fio', icon: 'fio' }, // Fio AI Coach (maps to smart_toy)
    { id: 'review', label: 'Wochenrückblick', icon: 'analytics' },
    { id: 'trash', label: 'Papierkorb', icon: 'delete' },
  ];

  return (
    <>
      {/* Dimmed backdrop overlay when expanded on tablet (< 1024px) */}
      <div
        onClick={() => setCollapsed(true)}
        className={`hidden md:block lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
          !collapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* 
        Layout Spacer Wrapper in flex row:
        - On Tablet (< 1024px): ALWAYS maintains 72px width in the flex flow. 
          Result: The main content next to it NEVER moves or shifts a single pixel!
        - On Desktop (>= 1024px): Expands/contracts smoothly (72px <-> 256px) pushing content naturally.
      */}
      <div
        className={`hidden md:flex flex-col flex-shrink-0 h-full relative transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${
          collapsed ? 'w-[72px] z-30' : 'w-[72px] lg:w-[256px] z-40'
        }`}
      >
        {/* 
          Single Unified Sidebar Aside:
          - Always the exact same DOM node: scroll position is NEVER lost!
          - On Tablet: position is absolute top-0 bottom-0 left-0, smoothly expanding from 72px to 256px over the content.
          - On Desktop: position is lg:relative, filling the wrapper.
          - Top and Bottom right corners are symmetrically rounded with rounded-r-[24px] overflow-hidden.
        */}
        <aside
          id="sidebar-navigation"
          role={typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.DESKTOP && !collapsed ? 'dialog' : 'navigation'}
          aria-modal={typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.DESKTOP && !collapsed ? 'true' : undefined}
          aria-label="Hauptnavigation"
          className={`flex flex-col h-full border-r border-outline-variant bg-surface transition-[width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none rounded-r-[24px] overflow-hidden absolute lg:relative top-0 bottom-0 left-0 ${
            collapsed
              ? 'w-[72px] shadow-none'
              : 'w-[256px] shadow-2xl lg:shadow-none'
          }`}
        >
          {/* Logo / Header - Deterministic 48px slot with center at X=36px */}
          <div className="flex items-center h-16 sm:h-20 flex-shrink-0 px-3 overflow-hidden relative">
            {/* Collapsed Monogram (FF) - centered at exactly 36px (12px px-3 + 24px half of w-12 = 36px) */}
            <div
              className={`w-12 h-12 flex items-center justify-center flex-shrink-0 transition-opacity duration-200 motion-reduce:transition-none ${
                collapsed
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-95 absolute pointer-events-none'
              }`}
              aria-hidden={!collapsed}
            >
              <span className="text-xl font-black tracking-tighter text-primary select-none">FF</span>
            </div>

            {/* Expanded Brand + Tablet Close Button */}
            <div
              className={`flex items-center justify-between flex-1 min-w-0 pl-1 pr-1 transition-all ease-in-out motion-reduce:transition-none ${
                collapsed
                  ? 'opacity-0 pointer-events-none -translate-x-2 duration-150'
                  : 'opacity-100 translate-x-0 duration-200 delay-100'
              }`}
              aria-hidden={collapsed}
            >
              <span className="text-2xl font-black tracking-tighter text-primary block leading-tight truncate select-none">
                FocusFlow
              </span>
              {/* Close Button on Tablet when expanded */}
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setCollapsed(true)}
                className="hidden md:flex lg:hidden p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-low transition-colors flex-shrink-0 cursor-pointer"
                title="Sidebar schließen"
                aria-label="Sidebar schließen"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Scrollable Navigation - Identical single instance, scroll position never resets */}
          <nav
            className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 px-3 sidebar-scrollbar overscroll-contain"
            aria-label="Seitenmenü"
          >
            {navItems.map((item) => {
              const isActive = currentScreen === item.id || (item.id === 'projects' && currentScreen === 'project-detail');
              return (
                <button
                  key={item.id}
                  data-nav={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`group w-full h-11 flex items-center rounded-xl transition-[background-color,color] duration-150 motion-reduce:transition-none relative select-none flex-shrink-0 cursor-pointer p-0 text-left ${
                    isActive
                      ? 'text-primary bg-primary/10 font-bold'
                      : 'text-on-surface-variant hover:bg-surface-low hover:text-primary'
                  }`}
                >
                  {/* Fixed 48px Icon Slot: center is at 12px (nav px-3) + 24px = 36px from aside outer edge */}
                  <div className="w-12 h-11 flex items-center justify-center flex-shrink-0">
                    {item.id === 'coach' ? (
                      <FioIcon className="w-[18px] h-[18px]" color="currentColor" />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] select-none pointer-events-none">
                        {item.icon}
                      </span>
                    )}
                  </div>

                  {/* Label container: transitions smoothly, zero impact on icon position */}
                  <div className="flex-1 min-w-0 overflow-hidden pr-3 text-left">
                    <span
                      className={`block truncate whitespace-nowrap text-sm font-medium transition-all ease-in-out motion-reduce:transition-none ${
                        collapsed
                          ? 'opacity-0 -translate-x-3 pointer-events-none duration-150'
                          : 'opacity-100 translate-x-0 duration-200 delay-100'
                      }`}
                      aria-hidden={collapsed}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* User Badge & Collapse Toggle at Bottom - Guaranteed Sticky, Rounded Corner Protected */}
          <div className="mt-auto p-3 flex flex-col gap-2 flex-shrink-0 rounded-br-[24px]">
            {/* Profile */}
            <div
              className={`w-full rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none overflow-hidden ${
                collapsed
                  ? 'border-transparent bg-transparent shadow-none hover:bg-surface-low'
                  : 'border-outline-variant bg-surface-low shadow-sm hover:shadow-md'
              }`}
            >
              <button
                type="button"
                onClick={handleProfileClick}
                className="w-full h-11 flex items-center p-0 rounded-2xl overflow-hidden cursor-pointer text-left"
                title={user?.isGuest ? 'Gast-Modus (Einstellungen & Abmelden)' : 'Profil Einstellungen'}
                aria-label={user?.isGuest ? 'Gast-Modus' : 'Profil Einstellungen'}
              >
                {/* Fixed 48px Avatar Slot: center is at 12px (p-3) + 24px = 36px from aside outer edge */}
                <div className="w-12 h-11 flex items-center justify-center flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border font-mono text-xs font-bold flex-shrink-0 overflow-hidden shadow-sm ${
                      user?.isGuest
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}
                  >
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : user?.isGuest ? (
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    ) : (
                      userInitial
                    )}
                  </div>
                </div>

                {/* Profile Details */}
                <div
                  className={`flex-1 min-w-0 pr-3 transition-all ease-in-out motion-reduce:transition-none ${
                    collapsed
                      ? 'opacity-0 -translate-x-3 pointer-events-none duration-150'
                      : 'opacity-100 translate-x-0 duration-200 delay-100'
                  }`}
                  aria-hidden={collapsed}
                >
                  <p className="font-semibold text-sm truncate text-on-surface leading-tight">
                    {user?.isGuest ? 'Gast-Benutzer' : (user?.displayName || user?.email?.split('@')[0])}
                  </p>
                  <p className="text-on-surface-variant text-xs truncate mt-0.5">
                    {user?.isGuest ? 'Vorschau-Modus' : user?.email}
                  </p>
                </div>
              </button>
            </div>

            {/* Collapse / Expand Toggle Button - Constant chevron icon rotating via GPU transform */}
            <div className="w-full">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="w-full h-10 flex items-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-low transition-colors duration-150 motion-reduce:transition-none cursor-pointer group select-none p-0 text-left"
                title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
                aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
                aria-expanded={!collapsed}
                aria-controls="sidebar-navigation"
              >
                {/* Fixed 48px Toggle Icon Slot: center is at 12px (p-3) + 24px = 36px from aside outer edge */}
                <div className="w-12 h-10 flex items-center justify-center flex-shrink-0">
                  <span
                    className={`material-symbols-outlined text-[22px] transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                      collapsed ? 'rotate-180' : 'rotate-0'
                    }`}
                  >
                    chevron_left
                  </span>
                </div>
                <span
                  className={`flex-1 min-w-0 text-xs font-medium truncate text-left transition-all ease-in-out motion-reduce:transition-none ${
                    collapsed
                      ? 'opacity-0 -translate-x-2 pointer-events-none duration-150'
                      : 'opacity-100 translate-x-0 duration-200 delay-100'
                  }`}
                  aria-hidden={collapsed}
                >
                  Sidebar einklappen
                </span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
