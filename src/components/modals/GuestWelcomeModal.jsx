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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-surface border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              🎮
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">Gast-Modus aktiviert</h3>
              <p className="text-xs text-on-surface-variant">Übersicht der Funktionen & Einschränkungen</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-on-surface-variant hover:text-primary p-1 rounded-lg"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Du nutzt FocusFlow aktuell als <strong>Gast</strong>. Folgende Funktionen stehen dir zum Testen zur Verfügung bzw. weisen Besonderheiten auf:
        </p>

        <div className="space-y-2.5">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-low border border-outline-variant/60">
            <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">save</span>
            <div className="text-xs leading-relaxed">
              <strong className="text-primary block">Lokale Sitzung (Keine Cloud-Speicherung)</strong>
              <span className="text-on-surface-variant">Neu angelegte Projekte, Phasen und Notizen werden nur in diesem Browserfenster gehalten und nicht auf Servern gespeichert.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-low border border-outline-variant/60">
            <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">calendar_month</span>
            <div className="text-xs leading-relaxed">
              <strong className="text-primary block">Google Kalender Synchronisation</strong>
              <span className="text-on-surface-variant">Die Live-Anbindung an Google Kalender ist in der Gast-Vorschau deaktiviert und nur für freigeschaltete Benutzerkonten verfügbar.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-low border border-outline-variant/60">
            <span className="material-symbols-outlined text-indigo-500 text-[20px] mt-0.5">smart_toy</span>
            <div className="text-xs leading-relaxed">
              <strong className="text-primary block">KI-Coach Rate-Limiting</strong>
              <span className="text-on-surface-variant">Aus Sicherheitsgründen ist der KI-Coach für Gäste auf 15 Anfragen pro 10 Minuten begrenzt.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-low border border-outline-variant/60">
            <span className="material-symbols-outlined text-emerald-500 text-[20px] mt-0.5">check_circle</span>
            <div className="text-xs leading-relaxed">
              <strong className="text-primary block">Vollständig testbare UI</strong>
              <span className="text-on-surface-variant">Kanban-Board, Aufgabenverwaltung, Filter, Notizen und Projekt-Phasen können uneingeschränkt ausprobiert werden.</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-outline-variant flex justify-end">
          <Button
            variant="primary"
            fullWidth
            onClick={handleClose}
            className="font-semibold shadow-md"
          >
            Verstanden & Vorschau starten
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GuestWelcomeModal;
