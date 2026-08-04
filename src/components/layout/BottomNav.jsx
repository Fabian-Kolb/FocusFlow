import React from 'react';

const BottomNav = ({ currentScreen, setCurrentScreen }) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'reminders', label: 'Erinnerungen', icon: 'notifications' },
    { id: 'projects', label: 'Projekte', icon: 'folder' },
    { id: 'board', label: 'Board', icon: 'view_kanban' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
    { id: 'coach', label: 'Coach', icon: 'smart_toy' },
    { id: 'review', label: 'Review', icon: 'analytics' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-between items-center h-16 bg-surface border-t border-outline-variant px-2 sm:px-4 z-50">
      {navItems.map((item) => {
        const isActive =
          currentScreen === item.id || 
          (item.id === 'projects' && currentScreen === 'project-detail') ||
          (item.id === 'reminders' && currentScreen === 'reminder-detail');

        return (
          <button
            key={item.id}
            onClick={() => setCurrentScreen(item.id)}
            title={item.label}
            className={`group relative flex flex-col items-center justify-center flex-1 h-full min-w-0 ${
              isActive ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
            } transition-colors`}
          >
            <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
            {isActive && <div className="absolute bottom-2 w-1 h-1 bg-primary rounded-full"></div>}
            
            {/* Tooltip */}
            <span className="absolute -top-10 bg-neutral-800 text-white text-[10px] font-mono px-2 py-1 rounded opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
