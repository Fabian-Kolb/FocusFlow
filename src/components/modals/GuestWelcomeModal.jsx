import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

function GuestWelcomeModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user?.isGuest) {
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

  if (!isOpen || !user?.isGuest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn">
      <div className="bg-surface border border-outline-variant rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-outline-variant pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary text-2xl shadow-sm">
              🎮
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary tracking-tight">Gast-Modus aktiviert</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Funktionsübersicht & Einschränkungen der Vorschauversion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-surface-low transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Du erkundest FocusFlow aktuell im <strong>Gast-Modus</strong>. Alle Kernfunktionen der Benutzeroberfläche sind interaktiv freigeschaltet. Bitte beachte die folgenden Details zu den aktiven und eingeschränkten Funktionen:
        </p>

        {/* 2 Spalten bzw. 2 Sektionen: Eingeschränkt vs. Verfügbar */}
        <div className="space-y-4">
          {/* Sektion 1: Eingeschränkte Funktionen */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Was im Gast-Modus eingeschränkt ist:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">cloud_off</span>
                  Keine Cloud-Speicherung
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Deine erstellten Projekte, Phasen und Notizen existieren rein temporär in deinem Browser. Beim Schließen des Fensters oder Neuladen wird der Stand zurückgesetzt.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">event_busy</span>
                  Google Kalender Live-Sync
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Die Live-Synchronisation mit echten Google-Konten ist in der Vorschau deaktiviert und erfordert ein registriertes, freigeschaltetes Benutzerkonto.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5 sm:col-span-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">timer</span>
                  KI-Coach Rate-Limiting & Profil
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Aus Sicherheitsgründen ist die Nutzung des KI-Assistenten für Gäste auf 15 Anfragen pro 10 Minuten limitiert. Eigene Profilbilder und Passwortänderungen sind deaktiviert.
                </p>
              </div>
            </div>
          </div>

          {/* Sektion 2: Was du ausprobieren kannst */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Was du uneingeschränkt testen kannst:
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Interaktives Kanban-Board</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Phasen- & Aufgabenverwaltung</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Notizen-, Inbox- & Review-System</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Live KI-Coach Streaming (mit Limit)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-outline-variant flex justify-end">
          <Button
            variant="primary"
            fullWidth
            onClick={handleClose}
            className="font-semibold py-3 text-sm shadow-md"
          >
            Verstanden & FocusFlow ausprobieren
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GuestWelcomeModal;
