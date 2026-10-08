import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useModalContext } from '../../context/ModalContext';
import CategoryChips from './CategoryChips';

/**
 * Mobile Variante des ⋮-Menüs einer Projekt- oder Erinnerungskarte (Bottom Sheet, < md).
 * Große Touch-Ziele, und die Kategorie wird direkt hier per Chip gewechselt – ohne zweiten Dialog.
 * Wird per Portal an <body> gehängt, damit `fixed` nicht von transformierten Eltern abhängt (Regel 04).
 */
function CardActionSheet({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemTitle,
  currentCategoryId,
  isPaused,
  inKanban,
  onTogglePause,
  onToggleKanban,
  onOpenStatus,
  onDelete,
}) {
  const {
    projectCategories,
    reminderCategories,
    moveProjectToCategory,
    moveReminderToCategory,
    addProjectCategory,
    addReminderCategory,
  } = useModalContext();

  const isProject = itemType === 'project';
  const categories = isProject ? projectCategories : reminderCategories;
  const moveToCategory = isProject ? moveProjectToCategory : moveReminderToCategory;
  const addCategory = isProject ? addProjectCategory : addReminderCategory;

  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return undefined;
    }
    if (!shouldRender) return undefined;
    setIsClosing(true);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, shouldRender]);

  const { translateY, isDragging, entryAnimActive, wasSwipedClosed } = useSwipeToClose({
    isOpen: shouldRender && !isClosing,
    onClose,
    drawerRef: panelRef,
    scrollContainerRef: scrollRef,
    threshold: 150,
  });

  useEffect(() => {
    if (!shouldRender) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shouldRender, onClose]);

  if (!shouldRender) return null;

  const panelStyle = translateY > 0 ? {
    transform: `translateY(${translateY}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
  } : undefined;

  const run = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
    onClose();
  };

  const rowClass = 'w-full h-12 px-4 flex items-center gap-3 rounded-xl text-sm font-semibold text-left transition-colors active:bg-surface-low';

  return createPortal(
    // React-Events aus Portalen laufen weiter durch den Komponentenbaum: ohne Stopp würden Klick und
    // Long-Press-Drag der Karte darunter auslösen
    <div
      className="md:hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Optionen für ${itemTitle || (isProject ? 'Projekt' : 'Erinnerung')}`}
        style={panelStyle}
        className={`fixed z-50 inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-surface rounded-t-3xl border-t border-outline-variant shadow-2xl pb-safe
          ${isClosing ? (wasSwipedClosed ? '' : 'drawer-slide-out-bottom') : entryAnimActive ? 'drawer-slide-in-bottom' : ''}`}
      >
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant rounded-full" />
        </div>

        <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
          <h2 className="flex-1 min-w-0 text-base font-bold truncate">{itemTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="touch-target -mr-2 flex items-center justify-center rounded-full text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2 space-y-3">
          <div className="px-2">
            <CategoryChips
              categories={categories}
              value={currentCategoryId || 'allgemein'}
              onChange={(catId) => {
                if (catId !== (currentCategoryId || 'allgemein')) moveToCategory(itemId, catId);
                onClose();
              }}
              onCreate={addCategory}
            />
          </div>

          <div className="border-t border-outline-variant pt-2">
            <button type="button" onClick={run(onTogglePause)} className={`${rowClass} text-primary`}>
              <span className="material-symbols-outlined text-[20px]">{isPaused ? 'play_arrow' : 'pause'}</span>
              {isPaused ? 'Fortsetzen' : 'Pausieren'}
            </button>
            <button type="button" onClick={run(onToggleKanban)} className={`${rowClass} text-primary`}>
              <span className="material-symbols-outlined text-[20px]">view_kanban</span>
              <span className="flex-1">Im Kanban-Board zeigen</span>
              <span
                aria-hidden="true"
                className={`w-10 h-6 rounded-full p-0.5 transition-colors ${inKanban !== false ? 'bg-primary' : 'bg-outline-variant'}`}
              >
                <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${inKanban !== false ? 'translate-x-4' : ''}`} />
              </span>
            </button>
            <button type="button" onClick={run(onOpenStatus)} className={`${rowClass} text-primary`}>
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              Status / Spalte wählen…
            </button>
          </div>

          <div className="border-t border-outline-variant pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('In den Papierkorb verschieben?')) {
                  onDelete?.();
                  onClose();
                }
              }}
              className={`${rowClass} text-red-600`}
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
              In den Papierkorb
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CardActionSheet;
