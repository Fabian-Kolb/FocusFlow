import React from 'react';

const Topbar = ({ title }) => {
  return (
    <header className="w-full sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex items-center px-3 sm:px-6 h-16">
      <div className="flex items-center min-w-0">
        {typeof title === 'string' ? (
          <span className="text-base sm:text-lg font-semibold tracking-tight truncate">{title}</span>
        ) : (
          title
        )}
      </div>
    </header>
  );
};

export default Topbar;
