import React, { useState } from 'react';
import { useModal } from '../../context/ModalContext';
import { BREAKPOINTS } from '../../lib/breakpoints';
import CardActionSheet from './CardActionSheet';
import { IconButton, Menu, MenuItem, MenuLabel, MenuSeparator } from '../ds';

const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth <= BREAKPOINTS.MOBILE_MAX;

const CardContextMenu = ({
  isPaused,
  onTogglePause,
  inKanban,
  onToggleKanban,
  onDelete,
  isKanbanView = false,
  itemType,
  itemId,
  itemTitle,
  currentCategoryId,
  itemStatus
}) => {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { openModal } = useModal();

  const isActiveInKanban = inKanban !== false;
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="relative -mr-1.5 -mt-1.5 shrink-0">
      <IconButton
        icon="more_vert"
        label="Optionen"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          // Handy: großes Bottom Sheet statt kleinem Dropdown
          if (isMobileWidth()) setSheetOpen(true);
          else setOpen(!open);
        }}
      />

      <CardActionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        itemType={itemType}
        itemId={itemId}
        itemTitle={itemTitle}
        currentCategoryId={currentCategoryId}
        isPaused={isPaused}
        inKanban={inKanban}
        onTogglePause={onTogglePause}
        onToggleKanban={onToggleKanban}
        onOpenStatus={() => openModal('moveStatus', { type: itemType, itemId, currentStatus: itemStatus })}
        onDelete={onDelete}
      />

      {open && (
        <>
          {/* Unsichtbare Fläche: Klick daneben schließt das Menü */}
          <div
            className="fixed inset-0 z-dropdown"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <Menu label="Optionen" className="absolute right-0 top-8 z-dropdown" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={isPaused ? 'play_arrow' : 'pause'} onClick={stop(onTogglePause)}>
              {isPaused ? 'Fortsetzen' : 'Pausieren'}
            </MenuItem>

            <MenuLabel>Kanban-Board</MenuLabel>
            <MenuItem
              icon="view_kanban"
              selected={isActiveInKanban}
              title={isKanbanView ? 'Kanban entfernen' : isActiveInKanban ? 'Vom Kanban ausblenden' : 'Auf Kanban einblenden'}
              onClick={stop(onToggleKanban)}
            >
              {isActiveInKanban ? 'Im Kanban sichtbar' : 'Im Kanban ausgeblendet'}
            </MenuItem>
            {itemType && itemId && (
              <MenuItem
                icon="swap_horiz"
                onClick={stop(() => {
                  setOpen(false);
                  openModal('moveStatus', { type: itemType, itemId, currentStatus: itemStatus });
                })}
              >
                Spalte wählen …
              </MenuItem>
            )}

            {itemType && itemId && (
              <>
                <MenuLabel>Organisation</MenuLabel>
                <MenuItem
                  icon="folder_open"
                  onClick={stop(() => {
                    setOpen(false);
                    openModal('moveCategory', { type: itemType, itemId, currentCategoryId });
                  })}
                >
                  Kategorie wählen …
                </MenuItem>
              </>
            )}

            <MenuSeparator />
            {/* Keine Rückfrage: Löschen lässt sich per „Rückgängig“-Toast zurücknehmen */}
            <MenuItem icon="delete" danger onClick={stop(onDelete)}>
              In den Papierkorb
            </MenuItem>
          </Menu>
        </>
      )}
    </div>
  );
};

export default CardContextMenu;
