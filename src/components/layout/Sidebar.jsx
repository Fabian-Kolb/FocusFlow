import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModalContext } from '../../context/ModalContext';

const Sidebar = ({ currentScreen, setCurrentScreen, collapsed, setCollapsed }) => {
  const { user } = useAuth();
  const { openModal } = useModalContext();

  const userInitial = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'reminders', label: 'Erinnerungen', icon: 'notifications' },
    { id: 'projects', label: 'Projekte', icon: 'folder' },
    { id: 'board', label: 'Kanban Board', icon: 'view_kanban' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
    { id: 'coach', label: 'AI Coach', icon: 'smart_toy' },
    { id: 'review', label: 'Wochenrückblick', icon: 'analytics' },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col h-full flex-shrink-0 border-r border-outline-variant bg-surface sticky top-0 z-30 transition-all duration-300 ease-in-out rounded-r-[24px] ${
        collapsed ? 'w-[72px]' : 'w-[256px]'
      }`}
    >
      {/* Logo / Collapse Toggle Row */}
      <div className="flex items-center justify-between h-20 flex-shrink-0 px-4 overflow-hidden">
        <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'w-0 opacity-0' : 'w-32 opacity-100'}`}>
          <span className="text-2xl font-black tracking-tighter text-primary block leading-tight">FocusFlow</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-low hover:border-primary text-primary transition-colors flex-shrink-0 shadow-sm"
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          <span className="material-symbols-outlined text-[18px]">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 flex-grow py-4 px-2">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id || (item.id === 'projects' && currentScreen === 'project-detail');
          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center px-3 py-2.5 mx-2 mb-1 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-surface-low overflow-hidden ${
                isActive
                  ? 'text-primary bg-primary/10 font-bold'
                  : 'text-on-surface-variant'
              }`}
            >
              <div className="flex items-center justify-center flex-shrink-0 w-[20px]">
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
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

      {/* User Badge */}
      <div className="mt-auto p-3">
        <div className="flex items-center bg-surface-low rounded-2xl p-2 transition-all duration-300 border border-outline-variant shadow-sm hover:shadow-md overflow-hidden">
          <button
            onClick={() => openModal('profile')}
            className="flex items-center text-left w-full overflow-hidden"
            title="Profil Einstellungen"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 font-mono text-xs font-bold text-primary flex-shrink-0 overflow-hidden shadow-sm">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'w-0 opacity-0 ml-0' : 'w-[150px] opacity-100 ml-3'}`}>
              <p className="font-semibold text-sm truncate text-on-surface leading-tight">{user?.displayName || user?.email?.split('@')[0]}</p>
              <p className="text-on-surface-variant text-xs truncate mt-0.5">{user?.email}</p>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
