import React from 'react';
import { useModalContext } from '../../context/ModalContext';

const MoveStatusModal = () => {
  const { 
    activeModal, 
    modalPayload, 
    closeModal,
    setProjectStatus,
    setReminderStatus
  } = useModalContext();

  const isOpen = activeModal === 'moveStatus';

  if (!isOpen) return null;

  const { type, itemId, currentStatus } = modalPayload || {};
  const isProject = type === 'project';

  const statuses = [
    { 
      id: 'GEPLANT', 
      label: 'Geplant', 
      sublabel: 'Spalte: Geplant / Noch nicht gestartet',
      icon: 'schedule',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
    },
    { 
      id: 'AKTIV', 
      label: 'In Bearbeitung', 
      sublabel: 'Spalte: Aktiv am Arbeiten',
      icon: 'play_circle',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    },
    { 
      id: 'ABGESCHLOSSEN', 
      label: 'Erledigt', 
      sublabel: 'Spalte: Abgeschlossen & Fertig',
      icon: 'check_circle',
      badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300'
    }
  ];

  const handleSelectStatus = (statusId) => {
    if (isProject) {
      setProjectStatus(itemId, statusId);
    } else {
      setReminderStatus(itemId, statusId);
    }
    closeModal();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 screen-transition">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-outline-variant shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">view_kanban</span>
            <h3 className="text-lg font-bold text-on-surface">Status / Spalte ändern</h3>
          </div>
          <button
            onClick={closeModal}
            className="w-8 h-8 rounded-full hover:bg-surface-low flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Status List */}
        <div className="space-y-3">
          {statuses.map((st) => {
            const isSelected = (currentStatus?.toUpperCase() === st.id) || (currentStatus?.toUpperCase() === 'LAUFEND' && st.id === 'AKTIV');
            return (
              <button
                key={st.id}
                onClick={() => handleSelectStatus(st.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-sm'
                    : 'bg-surface-low border-outline-variant hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-[22px] ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {st.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-on-surface">{st.label}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${st.badgeClass}`}>
                        {st.id}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">{st.sublabel}</p>
                  </div>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-primary text-[22px]">check_circle</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MoveStatusModal;
