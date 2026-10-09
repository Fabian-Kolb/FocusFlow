import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import CategoryChips from './CategoryChips';
import { Button, Sheet, Switch } from '../ds';

/**
 * Mobile Variante des ⋮-Menüs einer Projekt- oder Erinnerungskarte (Bottom Sheet, < md).
 * Große Touch-Ziele, und die Kategorie wird direkt hier per Chip gewechselt – ohne zweiten Dialog.
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

  const run = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
    onClose();
  };

  const rowClass = '!h-12 w-full !justify-start px-3';

  return (
    // React-Events aus Portalen laufen weiter durch den Komponentenbaum: ohne Stopp würden Klick und
    // Long-Press-Drag der Karte darunter auslösen
    <div
      className="contents md:hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <Sheet
        open={isOpen}
        onClose={onClose}
        side="bottom"
        title={itemTitle || (isProject ? 'Projekt' : 'Erinnerung')}
        ariaLabel={`Optionen für ${itemTitle || (isProject ? 'Projekt' : 'Erinnerung')}`}
        bodyClassName="space-y-3 pb-safe"
      >
        <CategoryChips
          categories={categories}
          value={currentCategoryId || 'allgemein'}
          onChange={(catId) => {
            if (catId !== (currentCategoryId || 'allgemein')) moveToCategory(itemId, catId);
            onClose();
          }}
          onCreate={addCategory}
        />

        <div className="space-y-0.5 border-t border-subtle pt-2">
          <Button variant="ghost" className={rowClass} leadingIcon={isPaused ? 'play_arrow' : 'pause'} onClick={run(onTogglePause)}>
            {isPaused ? 'Fortsetzen' : 'Pausieren'}
          </Button>
          <div className="flex h-12 items-center rounded-md px-3 hover:bg-hover">
            <Switch
              checked={inKanban !== false}
              onChange={() => { onToggleKanban?.(); }}
              label="Im Kanban-Board zeigen"
              className="w-full flex-row-reverse justify-between"
            />
          </div>
          <Button variant="ghost" className={rowClass} leadingIcon="swap_horiz" onClick={run(onOpenStatus)}>
            Status / Spalte wählen …
          </Button>
        </div>

        <div className="border-t border-subtle pt-2">
          {/* Keine Rückfrage: Löschen lässt sich per „Rückgängig“-Toast zurücknehmen */}
          <Button variant="danger-ghost" className={rowClass} leadingIcon="delete" onClick={run(onDelete)}>
            In den Papierkorb
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export default CardActionSheet;
