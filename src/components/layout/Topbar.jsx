import React from 'react';

const Topbar = ({ title = 'FocusFlow' }) => {
  return (
    <header className="w-full py-2.5 px-4 border-b border-outline-variant bg-white flex items-center justify-between">
      <h1 className="text-sm sm:text-base font-bold font-mono text-primary uppercase tracking-wider">{title}</h1>
    </header>
  );
};

export default Topbar;
