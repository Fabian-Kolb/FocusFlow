import React from 'react';

const Topbar = ({ title = 'FocusFlow' }) => (
  <header className="flex w-full items-center justify-between border-b border-subtle bg-surface px-4 py-2.5">
    <h1 className="text-subheading text-primary">{title}</h1>
  </header>
);

export default Topbar;
