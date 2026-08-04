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
      {/* Logo / Header at the Top */}
      <div className="flex items-center h-20 flex-shrink-0 px-4 overflow-hidden">
        {collapsed ? (
          <div className="w-full flex items-center justify-center">
            <span className="text-xl font-black tracking-tighter text-primary">FF</span>
          </div>
        ) : (
          <div className="flex items-center px-2">
            <span className="text-2xl font-black tracking-tighter text-primary block leading-tight">FocusFlow</span>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 flex-grow py-2 px-2">
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

      {/* User Badge & Collapse Toggle at Bottom */}
      <div className="mt-auto p-3 flex flex-col gap-1">
        {/* Profile */}
        <div
          className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
            collapsed 
              ? 'border-transparent bg-transparent shadow-none p-1 flex justify-center' 
              : 'border-outline-variant bg-surface-low shadow-sm hover:shadow-md p-2'
          }`}
        >
          <button
            onClick={() => openModal('profile')}
            className={`flex items-center text-left w-full overflow-hidden ${collapsed ? 'justify-center' : ''}`}
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

        {/* Collapse Button below Profile */}
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
  );
};

export default Sidebar;
