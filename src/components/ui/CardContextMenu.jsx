import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';

const CardContextMenu = ({ 
  isPaused, 
  onTogglePause, 
  inKanban, 
  onToggleKanban, 
  onDelete, 
  isKanbanView = false,
  itemType, 
  itemId,
  currentCategoryId,
  itemStatus
}) => {
  const [open, setOpen] = useState(false);
  const { openModal } = useModalContext();

  const isActiveInKanban = inKanban !== false;

  return (
    <div className="relative shrink-0 -mt-1.5 -mr-1.5">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="w-7 h-7 rounded-lg hover:bg-surface-variant/40 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        title="Optionen"
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>

      {open && (
        <>
          {/* Backdrop overlay to close when clicking outside */}
          <div
            className="fixed inset-0 z-20"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          {/* Vertical Stacked Menu */}
          <div className="absolute right-0 top-7 z-30 bg-white border border-outline-variant rounded-xl p-2 shadow-xl flex flex-col gap-1.5 min-w-[160px] text-left">
            
            {/* Pause / Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause();
              }}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer w-full flex items-center gap-2 px-2 text-xs font-medium ${
                isPaused
                  ? 'bg-blue-100 border-blue-300 text-blue-900'
                  : 'hover:bg-surface-low border-transparent text-primary'
              }`}
              title={isPaused ? 'Fortsetzen' : 'Pausieren'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
              <span>{isPaused ? 'Fortsetzen' : 'Pausieren'}</span>
            </button>

            {/* KANBAN BOARD SECTION */}
            <div className="pt-1">
              <div className="px-2 py-0.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                Kanban-Board
              </div>
              <div className="space-y-1 mt-0.5">
                {/* Kanban Toggle Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleKanban();
                  }}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer w-full flex items-center gap-2 px-2 text-xs font-medium ${
                    isActiveInKanban
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'
                  }`}
                  title={isKanbanView ? 'Kanban entfernen' : isActiveInKanban ? 'Vom Kanban ausblenden' : 'Auf Kanban einblenden'}
                >
                  <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                  <span>{isActiveInKanban ? 'Kanban aktiv' : 'Kanban aus'}</span>
                </button>

                {/* Move Status / Column Button */}
                {itemType && itemId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      openModal('moveStatus', { type: itemType, itemId, currentStatus: itemStatus });
                    }}
                    className="p-1.5 rounded-lg border border-transparent hover:bg-surface-low text-on-surface hover:text-primary transition-colors cursor-pointer w-full flex items-center gap-2 px-2 text-xs font-medium"
                    title="Status / Spalte ändern"
                  >
                    <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                    <span>Spalte wählen...</span>
                  </button>
                )}
              </div>
            </div>

            {/* ORGANISATION SECTION */}
            {itemType && itemId && (
              <div className="pt-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Organisation
                </div>
                <div className="space-y-1 mt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      openModal('moveCategory', { type: itemType, itemId, currentCategoryId });
                    }}
                    className="p-1.5 rounded-lg border border-transparent hover:bg-surface-low text-on-surface hover:text-primary transition-colors cursor-pointer w-full flex items-center gap-2 px-2 text-xs font-medium"
                    title="Kategorie ändern"
                  >
                    <span className="material-symbols-outlined text-[18px]">folder_open</span>
                    <span>Kategorie...</span>
                  </button>
                </div>
              </div>
            )}

            {/* DIVIDER FOR DANGER / DELETE SECTION */}
            <div className="w-full h-px bg-outline-variant/60 my-0.5" />

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('In den Papierkorb verschieben?')) {
                  onDelete();
                }
              }}
              className="p-1.5 rounded-lg border border-transparent hover:bg-red-50 text-red-600 hover:border-red-200 transition-colors cursor-pointer w-full flex items-center gap-2 px-2 text-xs font-medium"
              title="Löschen"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              <span>Löschen</span>
            </button>

          </div>
        </>
      )}
    </div>
  );
};

export default CardContextMenu;
