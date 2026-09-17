import React, { useEffect } from 'react';

/**
 * CalendarDesyncModal
 * Dialog zur Bestätigung der De-Synchronisierung:
 * Erlaubt die Wahl, ob das Event in Google Calendar gelöscht oder als eigenständiger Termin behalten werden soll.
 */
const CalendarDesyncModal = ({
  isOpen,
  title = '',
  type = 'Erinnerung',
  onConfirm,
  onClose,
  isLoading = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="desync-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-surface rounded-2xl border border-outline-variant shadow-2xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header mit Icon */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">sync_disabled</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="desync-modal-title" className="text-base font-bold text-on-surface">
              Kalender-Synchronisierung trennen
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Für {type}: <span className="font-semibold text-on-surface break-words">„{title}“</span>
            </p>
          </div>
        </div>

        {/* Beschreibung */}
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed bg-surface-low p-3.5 rounded-xl border border-outline-variant/60">
          Möchtest du den zugehörigen Termin auch aus deinem Google Kalender entfernen oder soll er dort als eigenständiger Eintrag bestehen bleiben?
        </p>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Option 1: Aus Google Kalender löschen */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onConfirm({ deleteInGoogle: true })}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100/80 text-red-700 transition-colors text-left group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-red-600 group-hover:scale-110 transition-transform">
                delete
              </span>
              <div>
                <div className="text-xs sm:text-sm font-bold">Aus Google Kalender löschen</div>
                <div className="text-[11px] text-red-600/80">Entfernt den Termin vollständig aus deinem Kalender</div>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-red-400 group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </button>

          {/* Option 2: Im Kalender behalten */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onConfirm({ deleteInGoogle: false })}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-outline-variant bg-white hover:bg-surface-low text-on-surface transition-colors text-left group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-primary group-hover:scale-110 transition-transform">
                event_available
              </span>
              <div>
                <div className="text-xs sm:text-sm font-bold">Im Kalender behalten</div>
                <div className="text-[11px] text-on-surface-variant">Trennt nur die Verknüpfung; Termin bleibt bei Google</div>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>

        {/* Footer / Abbrechen */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-low rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarDesyncModal;
