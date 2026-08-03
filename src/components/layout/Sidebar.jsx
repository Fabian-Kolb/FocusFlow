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
    { id: 'projects', label: 'Projekte', icon: 'folder' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
    { id: 'coach', label: 'AI Coach', icon: 'smart_toy' },
    { id: 'review', label: 'Wochenrückblick', icon: 'analytics' },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col h-full flex-shrink-0 border-r border-outline-variant bg-surface sticky top-0 z-30 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[60px]' : 'w-[256px]'
      }`}
    >
      {/* Logo / Collapse Toggle Row */}
      <div className={`flex items-center border-b border-outline-variant h-16 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-base font-bold tracking-tight text-primary mono block leading-tight">FocusFlow</span>
            <span className="text-[10px] text-on-surface-variant mono">v1.0 • MINIMALIST</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center border border-outline-variant bg-surface-low hover:border-primary text-primary transition-colors flex-shrink-0"
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
              className={`flex items-center gap-3 px-2 py-2.5 text-sm font-medium transition-all hover:bg-surface-low w-full ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'text-primary border-r-2 border-primary font-bold bg-surface-low'
                  : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User Badge */}
      <button
        onClick={() => openModal('profile')}
        className={`w-full text-left transition-colors hover:bg-surface-variant/30 border-t border-outline-variant ${
          collapsed ? 'py-4 flex justify-center' : 'px-4 py-4'
        }`}
        title="Profil Einstellungen"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center border border-outline-variant font-mono text-xs font-bold flex-shrink-0 overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              userInitial
            )}
          </div>
          {!collapsed && (
            <div className="text-xs min-w-0 flex-1">
              <p className="font-medium truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
              <p className="text-on-surface-variant text-[10px] mono truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </button>
    </aside>
  );
};

export default Sidebar;
