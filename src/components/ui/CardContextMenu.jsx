import React, { useState } from 'react';

const CardContextMenu = ({ isPaused, onTogglePause, inKanban, onToggleKanban, onDelete, isKanbanView = false }) => {
  const [open, setOpen] = useState(false);

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
          <div className="absolute right-0 top-7 z-30 bg-white border border-outline-variant rounded-xl p-1 shadow-lg flex flex-col items-center gap-1">
            {/* Pause / Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause();
              }}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer w-full flex justify-center ${
                isPaused
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'hover:bg-surface-low border-transparent text-primary'
              }`}
              title={isPaused ? 'Fortsetzen' : 'Pausieren'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
            </button>

            {/* Kanban Toggle Button with Strikethrough visual when disabled */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleKanban();
              }}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer w-full flex justify-center ${
                isActiveInKanban
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'
              }`}
              title={isKanbanView ? 'Kanban entfernen' : isActiveInKanban ? 'Vom Kanban ausblenden' : 'Auf Kanban einblenden'}
            >
              <div className="relative inline-flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                {!isActiveInKanban && (
                  <span className="absolute text-slate-600 font-bold text-xs select-none pointer-events-none transform rotate-45">
                    —
                  </span>
                )}
              </div>
            </button>

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-lg border border-transparent hover:bg-red-50 text-red-600 transition-colors cursor-pointer w-full flex justify-center"
              title="Löschen"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CardContextMenu;
