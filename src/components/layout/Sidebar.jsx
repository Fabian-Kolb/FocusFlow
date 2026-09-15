import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import FioIcon from '../ui/FioIcon';

const Sidebar = ({ currentScreen, setCurrentScreen, collapsed, setCollapsed }) => {
  const { user } = useAuth();
  const { openModal } = useModal();

  // Close tablet drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !collapsed && window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, setCollapsed]);

  const handleNavClick = (itemId) => {
    setCurrentScreen(itemId);
    // On tablet, automatically collapse after choosing screen
    if (window.innerWidth < 1024 && !collapsed) {
      setCollapsed(true);
    }
  };

  const handleProfileClick = () => {
    openModal('profile');
    if (window.innerWidth < 1024 && !collapsed) {
      setCollapsed(true);
    }
  };

  const userInitial = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'reminders', label: 'Erinnerungen', icon: 'notifications' },
    { id: 'projects', label: 'Projekte', icon: 'folder' },
    { id: 'board', label: 'Kanban Board', icon: 'view_kanban' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
    { id: 'coach', label: 'Fio', icon: 'fio' },
    { id: 'review', label: 'Wochenrückblick', icon: 'analytics' },
    { id: 'trash', label: 'Papierkorb', icon: 'delete' },
  ];

  return (
    <>
      {/* Dimmed backdrop overlay when expanded on tablet (< 1024px) */}
      <div
        onClick={() => setCollapsed(true)}
        className={`hidden md:block lg:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30 transition-opacity duration-300 ease-in-out ${
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
        className={`hidden md:flex flex-col flex-shrink-0 h-full relative transition-[width] duration-300 ease-in-out ${
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
          className={`flex flex-col h-full border-r border-outline-variant bg-surface transition-[width,box-shadow] duration-300 ease-in-out rounded-r-[24px] overflow-hidden absolute lg:relative top-0 bottom-0 left-0 ${
            collapsed
              ? 'w-[72px] shadow-none'
              : 'w-[256px] shadow-2xl lg:shadow-none'
          }`}
        >
          {/* Logo / Header */}
          <div className="flex items-center h-16 sm:h-20 flex-shrink-0 px-4 overflow-hidden">
            {collapsed ? (
              <div className="w-full flex items-center justify-center">
                <span className="text-xl font-black tracking-tighter text-primary">FF</span>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-2">
                <span className="text-2xl font-black tracking-tighter text-primary block leading-tight">FocusFlow</span>
                {/* Close Button on Tablet when expanded */}
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="hidden md:flex lg:hidden p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-low transition-colors"
                  title="Sidebar schließen"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Navigation - Identical single instance, scroll position never resets */}
          <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto py-2 px-2 sidebar-scrollbar">
            {navItems.map((item) => {
              const isActive = currentScreen === item.id || (item.id === 'projects' && currentScreen === 'project-detail');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all duration-300 hover:bg-surface-low overflow-hidden flex-shrink-0 mb-1 ${
                    collapsed
                      ? 'w-10 h-10 mx-auto justify-center p-0'
                      : 'w-auto mx-2 px-3 py-2.5 justify-start'
                  } ${
                    isActive
                      ? 'text-primary bg-primary/10 font-bold'
                      : 'text-on-surface-variant'
                  }`}
                >
                  <div className="flex items-center justify-center flex-shrink-0 w-[20px] h-[20px]">
                    {item.id === 'coach' ? (
                      <FioIcon className="w-[18px] h-[18px]" color="currentColor" />
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    )}
                  </div>
                  <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                    collapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-3'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* User Badge & Collapse Toggle at Bottom - Guaranteed Sticky, Rounded Corner Protected */}
          <div className="mt-auto p-3 flex flex-col gap-1 flex-shrink-0 rounded-br-[24px]">
            {/* Profile */}
            <div
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                collapsed 
                  ? 'border-transparent bg-transparent shadow-none p-1 flex justify-center' 
                  : 'border-outline-variant bg-surface-low shadow-sm hover:shadow-md p-2'
              }`}
            >
              <button
                onClick={handleProfileClick}
                className={`flex items-center text-left w-full overflow-hidden ${collapsed ? 'justify-center' : ''}`}
                title={user?.isGuest ? 'Gast-Modus (Einstellungen & Abmelden)' : 'Profil Einstellungen'}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-mono text-xs font-bold flex-shrink-0 overflow-hidden shadow-sm ${
                  user?.isGuest
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : 'bg-primary/10 border-primary/20 text-primary'
                }`}>
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : user?.isGuest ? (
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  ) : (
                    userInitial
                  )}
                </div>
                <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'w-0 opacity-0 ml-0' : 'w-[150px] opacity-100 ml-3'}`}>
                  <p className="font-semibold text-sm truncate text-on-surface leading-tight">
                    {user?.isGuest ? 'Gast-Benutzer' : (user?.displayName || user?.email?.split('@')[0])}
                  </p>
                  <p className="text-on-surface-variant text-xs truncate mt-0.5">
                    {user?.isGuest ? 'Vorschau-Modus' : user?.email}
                  </p>
                </div>
              </button>
            </div>

            {/* Collapse / Expand Toggle Button */}
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-end pr-1'} mt-1`}>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center cursor-pointer rounded-lg hover:bg-surface-low"
                title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {collapsed ? 'chevron_right' : 'chevron_left'}
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
