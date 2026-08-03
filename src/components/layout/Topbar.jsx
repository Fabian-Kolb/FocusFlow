import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModalContext } from '../../context/ModalContext';

const Topbar = ({ title }) => {
  const { user, logout } = useAuth();
  const { openModal } = useModalContext();

  const userInitial = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  return (
    <header className="w-full sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex items-center justify-between px-3 sm:px-6 h-16">
      <div className="flex items-center min-w-0">
        {typeof title === 'string' ? (
          <span className="text-base sm:text-lg font-semibold tracking-tight truncate">{title}</span>
        ) : (
          title
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Profile Button */}
        <button
          onClick={() => openModal('profile')}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-surface-variant/40 transition-colors text-left"
          title="Mein Profil verwalten"
        >
          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary overflow-hidden flex-shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              userInitial
            )}
          </div>
          <span className="text-xs font-medium text-primary hidden sm:inline-block max-w-[120px] truncate">
            {user?.displayName || user?.email}
          </span>
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="p-2 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center"
          title="Abmelden"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
