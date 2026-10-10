import React, { useRef, useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { countThoughts } from '../../lib/thoughts';
import { areaOf } from '../../lib/areas';
import { Avatar, FioMark, FOCUS, Icon, IconButton, Sheet, cx } from '../ds';

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
 * Mobile Bottom-Bar (< md): vier Hauptziele + mittlerer Knopf, der alle weiteren Bereiche öffnet:
 * oben "Frag Fio …", darunter Gedanken, Board, Wochenrückblick, Papierkorb, Account.
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
      className="md:hidden flex-shrink-0 w-full z-nav bg-canvas border-t border-subtle"
      style={{
        minHeight: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
                  className={cx(
                    'w-12 h-12 -mt-3 rounded-lg shadow-md flex items-center justify-center transition-colors duration-fast active:scale-95 motion-reduce:transform-none',
                    FOCUS,
                    isHubActive ? 'bg-inverse text-inverse' : 'bg-accent text-on-accent hover:bg-accent-hover',
                  )}
                >
                  <Icon name={isHubOpen ? 'close' : 'apps'} size="lg" />
                </button>
              </div>
            );
          }

          const isActive = item.screens.includes(currentScreen);
          const area = areaOf(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentScreen(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cx(
                'relative flex flex-col items-center justify-center flex-1 h-full min-h-12 py-1.5 min-w-0 rounded-md transition-colors duration-fast',
                FOCUS,
                isActive ? area.activeText : 'text-secondary hover:text-primary',
              )}
            >
              <span className="relative">
                <Icon name={item.icon} size="lg" filled={isActive} />
                {isActive && (
                  <span className={cx('absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full', area.dot)} aria-hidden="true" />
                )}
              </span>
              <span className={cx('text-micro mt-1 truncate max-w-[72px]', isActive && 'text-primary')}>
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

function HubTile({ icon, label, active, badge, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative h-20 flex flex-col items-center justify-center gap-1.5 rounded-lg border text-label-sm transition-colors duration-fast',
        FOCUS,
        active ? 'bg-accent-subtle text-accent border-accent' : 'bg-surface text-primary border-subtle hover:border-default active:bg-pressed',
      )}
    >
      {children || <Icon name={icon} size="lg" filled={active} />}
      {label}
      {badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-sm bg-accent text-on-accent text-micro flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function HubSheet({ isOpen, onClose, currentScreen, onNavigate }) {
  const { inboxItems, openModal } = useModalContext();
  const { user } = useAuth();
  const { queuePrompt } = useChat();
  const [fioText, setFioText] = useState('');

  // Ohne Text einfach Fio öffnen, mit Text direkt als erste Nachricht in einem neuen Gespräch senden
  const askFio = () => {
    const text = fioText.trim();
    if (text) queuePrompt(text);
    setFioText('');
    onNavigate('coach');
  };

  const thoughtCount = countThoughts(inboxItems);
  const tiles = [
    { id: 'inbox', label: 'Gedanken', icon: 'lightbulb', badge: thoughtCount },
    { id: 'board', label: 'Board', icon: 'view_kanban' },
    { id: 'review', label: 'Wochenrückblick', icon: 'analytics' },
    { id: 'trash', label: 'Papierkorb', icon: 'delete' },
  ];
  const isPlainGuest = Boolean(user?.isGuest && !user?.isDevAccount);
  const accountName = user?.displayName || user?.email || 'Konto';

  return (
    <Sheet open={isOpen} onClose={onClose} hideHeader side="bottom" ariaLabel="Weitere Bereiche" bodyClassName="pt-1 pb-safe">
      {/* Frag Fio: schnellster Weg zum Coach, direkt mit Text */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          askFio();
        }}
        className="mb-3 flex items-center gap-2 h-12 pl-3 pr-1.5 rounded-md border border-control bg-surface focus-within:border-strong transition-colors duration-fast"
      >
        <FioMark size={20} className="shrink-0 text-secondary" />
        <input
          type="text"
          value={fioText}
          onChange={(e) => setFioText(e.target.value)}
          placeholder="Frag Fio …"
          aria-label="Frage an Fio"
          enterKeyHint="send"
          className="flex-1 min-w-0 h-full bg-transparent border-0 p-0 text-body-lg focus:ring-0 focus:outline-none placeholder:text-tertiary"
        />
        <IconButton
          type="submit"
          variant="primary"
          size="sm"
          icon={fioText.trim() ? 'arrow_upward' : 'arrow_forward'}
          label={fioText.trim() ? 'An Fio senden' : 'Fio öffnen'}
        />
      </form>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <HubTile
            key={tile.id}
            icon={tile.icon}
            label={tile.label}
            badge={tile.badge}
            active={currentScreen === tile.id}
            onClick={() => onNavigate(tile.id)}
          />
        ))}

        {/* Account & Einstellungen */}
        <HubTile
          label="Account"
          onClick={() => {
            onClose();
            openModal('settings', { initialTab: 'account' });
          }}
        >
          {isPlainGuest && !user?.photoURL
            ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-warning-subtle text-warning"><Icon name="person" size="md" /></span>
            : <Avatar name={accountName} src={user?.photoURL} size="md" />}
        </HubTile>
      </div>
    </Sheet>
  );
}

export default BottomNav;
