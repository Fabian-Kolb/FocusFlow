import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Alert, Button, Dialog, Icon, SectionHeader } from '../ds';

// Was im Gast-Modus eingeschränkt ist (Warnung) und was frei ausprobiert werden kann
const LIMITS = [
  {
    icon: 'cloud_off',
    title: 'Keine Cloud-Speicherung',
    text: 'Projekte, Phasen und Notizen bleiben in diesem Browser auch nach dem Neuladen erhalten, es gibt aber kein Cloud-Backup. „Gast-Modus beenden“ meldet dich sofort ab.',
  },
  {
    icon: 'event_busy',
    title: 'Google Kalender Live-Sync',
    text: 'Die Synchronisation mit echten Google-Konten ist in der Vorschau deaktiviert und braucht ein freigeschaltetes Benutzerkonto.',
  },
  {
    icon: 'timer',
    title: 'Fio-Limit und Profil',
    text: 'Fio ist für Gäste auf 15 Anfragen pro 10 Minuten begrenzt. Profilbilder und Passwortänderungen sind deaktiviert.',
  },
];

const AVAILABLE = [
  'Interaktives Kanban-Board',
  'Phasen- und Aufgabenverwaltung',
  'Notizen, Gedanken und Wochenrückblick',
  'Fio mit Live-Antworten (mit Limit)',
];

function GuestWelcomeModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user?.isGuest && !user?.isDevAccount) {
      const acknowledged = sessionStorage.getItem('ff_guest_welcome_shown');
      if (!acknowledged) {
        setIsOpen(true);
      }
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleClose = () => {
    sessionStorage.setItem('ff_guest_welcome_shown', 'true');
    setIsOpen(false);
  };

  const visible = isOpen && Boolean(user?.isGuest) && !user?.isDevAccount;

  return (
    <Dialog
      open={visible}
      onClose={handleClose}
      size="lg"
      title="Gast-Modus aktiviert"
      description="Das ist die Vorschauversion von FocusFlow. Alle Kernfunktionen der Oberfläche kannst du ausprobieren."
      footer={<Button size="lg" onClick={handleClose}>Verstanden, FocusFlow ausprobieren</Button>}
    >
      <div className="max-h-[55vh] space-y-5 overflow-y-auto">
        <section className="space-y-3">
          <SectionHeader title="Eingeschränkt im Gast-Modus" />
          <ul className="space-y-2">
            {LIMITS.map((item) => (
              <li key={item.title}>
                <Alert tone="warning" icon={item.icon} title={item.title}>{item.text}</Alert>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Uneingeschränkt testbar" />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AVAILABLE.map((label) => (
              <li key={label} className="flex items-center gap-2 text-body text-primary">
                <Icon name="check_circle" size="md" className="shrink-0 text-success" />
                {label}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

export default GuestWelcomeModal;
