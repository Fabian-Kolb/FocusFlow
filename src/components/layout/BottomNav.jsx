import React from 'react';

const BottomNav = ({ currentScreen, setCurrentScreen }) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'projects', label: 'Projekte', icon: 'folder' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_today' },
    { id: 'coach', label: 'Coach', icon: 'smart_toy' },
    { id: 'review', label: 'Review', icon: 'analytics' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-16 bg-surface border-t border-outline-variant px-4 z-50">
      {navItems.map((item) => {
        const isActive =
          currentScreen === item.id || (item.id === 'projects' && currentScreen === 'project-detail');

        return (
          <button
            key={item.id}
            onClick={() => setCurrentScreen(item.id)}
            className={`flex flex-col items-center justify-center ${
              isActive ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className="text-[10px] mono">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
