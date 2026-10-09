import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Button, Dialog, FOCUS, Icon, Input, cx } from '../ds';

const MoveCategoryModal = () => {
  const {
    activeModal,
    modalPayload,
    closeModal,
    projectCategories,
    reminderCategories,
    moveProjectToCategory,
    moveReminderToCategory,
    addProjectCategory,
    addReminderCategory
  } = useModalContext();

  const isOpen = activeModal === 'moveCategory';
  const [newCatName, setNewCatName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { type, itemId, currentCategoryId } = modalPayload || {};
  const isProject = type === 'project';
  const categories = isProject ? projectCategories : reminderCategories;

  const handleSelectCategory = (catId) => {
    if (isProject) {
      moveProjectToCategory(itemId, catId);
    } else {
      moveReminderToCategory(itemId, catId);
    }
    closeModal();
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    let createdCatId = null;
    if (isProject) {
      createdCatId = await addProjectCategory(newCatName.trim());
    } else {
      createdCatId = await addReminderCategory(newCatName.trim());
    }
    setNewCatName('');
    setShowAdd(false);

    if (createdCatId && itemId) {
      handleSelectCategory(createdCatId);
    }
  };

  return (
    <Dialog open={isOpen} onClose={closeModal} title="Kategorie wählen" size="sm">
      <div className="space-y-4 text-primary">
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {categories && categories.map((cat) => {
            const isSelected = cat.id === (currentCategoryId || 'allgemein');
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                aria-pressed={isSelected}
                className={cx(
                  'flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-label transition-colors duration-fast',
                  FOCUS,
                  isSelected ? 'border-accent bg-accent-subtle text-accent' : 'border-default bg-surface hover:border-strong',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon name={cat.id === 'allgemein' ? 'grid_view' : 'folder'} size="md" filled={isSelected} />
                  <span className="truncate">{cat.name}</span>
                </span>
                {isSelected && <Icon name="check" size="md" />}
              </button>
            );
          })}
        </div>

        {showAdd ? (
          <form onSubmit={handleCreateCategory} className="flex gap-2 border-t border-subtle pt-4">
            <Input
              placeholder="Name der neuen Kategorie"
              aria-label="Name der neuen Kategorie"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              autoFocus
            />
            <Button type="submit">Speichern</Button>
          </form>
        ) : (
          <Button variant="ghost" fullWidth leadingIcon="add" onClick={() => setShowAdd(true)}>
            Kategorie hinzufügen
          </Button>
        )}
      </div>
    </Dialog>
  );
};

export default MoveCategoryModal;
