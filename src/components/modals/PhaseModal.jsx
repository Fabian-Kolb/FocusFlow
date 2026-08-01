import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';

const PhaseModal = () => {
  const { activeModal, modalPayload, closeModal, addPhase, selectedProjectId } = useModalContext();
  const isOpen = activeModal === 'phase';

  const [title, setTitle] = useState('');
  const [dateInfo, setDateInfo] = useState('');
  const [description, setDescription] = useState('');
  const titleInputRef = useRef(null);

  const targetProjectId = modalPayload.projectId || selectedProjectId;

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDateInfo('');
      setDescription('');

      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <div id="phase-modal" className="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"></div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    addPhase(targetProjectId, {
      title: title.trim(),
      dateInfo: dateInfo.trim(),
      description: description.trim()
    });

    closeModal();
  };

  return (
    <div
      id="phase-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white border-2 border-primary w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[22px] text-primary">layers</span>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">NEUE PHASE ANLEGEN</h2>
          </div>
          <button
            type="button"
            className="p-1 hover:bg-surface-low border border-outline-variant transition-colors"
            onClick={closeModal}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              PHASEN-TITEL *
            </label>
            <input
              type="text"
              id="phase-title-input"
              ref={titleInputRef}
              required
              className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
              placeholder="z.B. Phase 03: Testing & Launch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              ZIELDATUM / ZEITRAUM (OPTIONAL)
            </label>
            <input
              type="text"
              id="phase-date-input"
              className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none"
              placeholder="z.B. 01. - 15. Mai"
              value={dateInfo}
              onChange={(e) => setDateInfo(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              ZIEL / BESCHREIBUNG (OPTIONAL)
            </label>
            <textarea
              id="phase-desc-input"
              rows={2}
              className="w-full border border-outline-variant p-2 text-xs focus:border-primary outline-none"
              placeholder="Was soll in dieser Phase erreicht werden?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>

          <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 border border-outline-variant text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors"
              onClick={closeModal}
            >
              ABBRECHEN
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-sm"
            >
              PHASE ANLEGEN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PhaseModal;
