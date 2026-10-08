import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FioIcon from '../ui/FioIcon';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { countThoughts } from '../../lib/thoughts';

// Hauptziele am Handy. Projekte umfasst auch Detailansicht und Kanban-Board (Umschalter "Liste | Board").
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: 'home', screens: ['dashboard'] },
  { id: 'projects', label: 'Projekte', icon: 'folder', screens: ['projects', 'project-detail'] },
  { id: 'hub' },
  { id: 'reminders', label: 'Erinnerungen', icon: 'notifications', screens: ['reminders', 'reminder-detail'] },
  { id: 'calendar', label: 'Kalender', icon: 'calendar_today', screens: ['calendar'] },
];

// Ziele hinter dem mittleren Knopf
const HUB_SCREENS = ['inbox', 'coach', 'board', 'review', 'trash'];

/**
 * Mobile Bottom-Bar (< md): vier Hauptziele + mittlerer Knopf, der alle weiteren Bereiche öffnet
 * (Gedanken, Fio, Board, Wochenrückblick, Papierkorb, Einstellungen & Account).
 */
const BottomNav = ({ currentScreen, setCurrentScreen }) => {
  const [isHubOpen, setIsHubOpen] = useState(false);
  const hubButtonRef = useRef(null);
  const isHubActive = HUB_SCREENS.includes(currentScreen);

  const closeHub = () => {
    setIsHubOpen(false);
    hubButtonRef.current?.focus();
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden flex-shrink-0 w-full z-40 bg-surface/95 backdrop-blur-md border-t border-outline-variant"
      style={{
        minHeight: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="w-full h-16 px-2 flex justify-around items-center">
        {NAV_ITEMS.map((item) => {
          if (item.id === 'hub') {
            return (
              <div key="hub" className="flex-1 flex justify-center">
                <button
                  ref={hubButtonRef}
                  type="button"
                  onClick={() => setIsHubOpen((o) => !o)}
                  aria-label="Weitere Bereiche"
                  aria-haspopup="dialog"
                  aria-expanded={isHubOpen}
                  className={`w-12 h-12 -mt-3 rounded-full text-white shadow-lg shadow-primary/25 flex items-center justify-center active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary cursor-pointer ${
                    isHubActive ? 'bg-black ring-2 ring-offset-2 ring-primary/30' : 'bg-primary'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[28px] transition-transform ${isHubOpen ? 'rotate-45' : ''}`}>add</span>
                </button>
              </div>
            );
          }

          const isActive = item.screens.includes(currentScreen);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentScreen(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex flex-col items-center justify-center flex-1 h-full min-h-[48px] py-1.5 min-w-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl cursor-pointer ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <div className="relative">
                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'scale-105' : ''} transition-transform`}>
                  {item.icon}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </div>
              <span className={`text-[10px] sm:text-[11px] font-sans mt-0.5 tracking-tight truncate max-w-[72px] ${
                isActive ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <HubSheet
        isOpen={isHubOpen}
        onClose={closeHub}
        currentScreen={currentScreen}
        onNavigate={(screen) => {
          setIsHubOpen(false);
          setCurrentScreen(screen);
        }}
      />
    </nav>
  );
};

function HubSheet({ isOpen, onClose, currentScreen, onNavigate }) {
  const { inboxItems, openModal } = useModalContext();
  const { user } = useAuth();
  const panelRef = useRef(null);
  const { translateY, isDragging, entryAnimActive } = useSwipeToClose({
    isOpen,
    onClose,
    drawerRef: panelRef,
    threshold: 120,
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const thoughtCount = countThoughts(inboxItems);
  const tiles = [
    { id: 'inbox', label: 'Gedanken', icon: 'lightbulb', badge: thoughtCount },
    { id: 'coach', label: 'Fio', icon: 'fio' },
    { id: 'board', label: 'Board', icon: 'view_kanban' },
    { id: 'review', label: 'Wochenrückblick', icon: 'analytics' },
    { id: 'trash', label: 'Papierkorb', icon: 'delete' },
  ];
  const initials = (user?.displayName || user?.email || 'U').substring(0, 2).toUpperCase();
  const panelStyle = translateY > 0 ? {
    transform: `translateY(${translateY}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
  } : undefined;

  // Portal: die Bottom-Bar hat backdrop-blur und wäre sonst Bezugsrahmen für `fixed` (Regel 04)
  return createPortal(
    <div className="md:hidden fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Weitere Bereiche"
        style={panelStyle}
        className={`relative w-full bg-surface rounded-t-3xl border-t border-outline-variant shadow-2xl pb-safe ${entryAnimActive ? 'drawer-slide-in-bottom' : ''}`}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-12 h-1.5 bg-outline-variant rounded-full" />
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          {tiles.map((tile) => {
            const active = currentScreen === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onNavigate(tile.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative h-20 flex flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition-colors cursor-pointer ${
                  active ? 'bg-primary text-white border-primary' : 'bg-surface-low text-primary border-outline-variant active:border-primary'
                }`}
              >
                {tile.icon === 'fio' ? (
                  <FioIcon className="w-6 h-6" color="currentColor" />
                ) : (
                  <span className="material-symbols-outlined text-[24px]">{tile.icon}</span>
                )}
                {tile.label}
                {tile.badge > 0 && (
                  <span className={`absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    active ? 'bg-white text-primary' : 'bg-primary text-white'
                  }`}>
                    {tile.badge > 99 ? '99+' : tile.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Account & Einstellungen */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openModal('settings', { initialTab: 'account' });
            }}
            className="h-20 flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-outline-variant bg-surface-low text-xs font-bold text-primary active:border-primary transition-colors cursor-pointer"
          >
            <span className="w-7 h-7 rounded-full overflow-hidden bg-white border border-outline-variant flex items-center justify-center text-[10px]">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              ) : user?.isGuest ? (
                <span className="material-symbols-outlined text-amber-500 text-[18px]">person</span>
              ) : (
                initials
              )}
            </span>
            Account
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default BottomNav;
