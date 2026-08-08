import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 screen-transition">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-outline-variant shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">folder_open</span>
            <h3 className="text-lg font-bold text-on-surface">Kategorie wählen</h3>
          </div>
          <button
            onClick={closeModal}
            className="w-8 h-8 rounded-full hover:bg-surface-low flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {categories && categories.map((cat) => {
            const isSelected = cat.id === (currentCategoryId || 'allgemein');
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                    : 'bg-surface-low border-outline-variant text-on-surface hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">
                    {cat.id === 'allgemein' ? 'grid_view' : 'folder'}
                  </span>
                  <span>{cat.name}</span>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Create New Category inline toggle */}
        {showAdd ? (
          <form onSubmit={handleCreateCategory} className="flex gap-2 pt-2 border-t border-outline-variant">
            <input
              type="text"
              placeholder="Neue Kategorie..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-grow px-3 py-2 text-sm bg-surface-low border border-outline-variant rounded-xl focus:outline-none focus:border-primary"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Speichern
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full py-2.5 text-xs font-bold text-primary hover:bg-primary/5 rounded-xl border border-dashed border-primary/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Neue Kategorie erstellen
          </button>
        )}
      </div>
    </div>
  );
};

export default MoveCategoryModal;
