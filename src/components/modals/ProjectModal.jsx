import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';

const ProjectModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, addProject } = useModalContext();
  const isOpen = activeModal === 'project';

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [firstPhase, setFirstPhase] = useState('');
  const [status, setStatus] = useState('Aktiv');
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(modalPayload.prefillTitle || modalPayload.prefilledTitle || '');
      setStartDate(modalPayload.startDate || '');
      setEndDate(modalPayload.endDate || '');
      setFirstPhase(modalPayload.firstPhase || '');
      setStatus(modalPayload.status || 'Aktiv');

      // Auto-focus input after modal opens
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, modalPayload]);

  if (!isOpen) {
    return (
      <div id="project-modal" className="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"></div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProjectId = addProject({
      title: name.trim(),
      startDate,
      endDate,
      firstPhase,
      status,
      inboxItemId: modalPayload.inboxItemId
    });

    closeModal();
    if (setCurrentScreen) {
      setCurrentScreen('projects');
    }
  };

  const isConversion = Boolean(modalPayload.inboxItemId);

  return (
    <div
      id="project-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white border-2 border-primary w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[22px] text-primary">create_new_folder</span>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate" id="project-modal-title">
              {isConversion ? 'INBOX-GEDANKE ZU PROJEKT UMWANDELN' : 'PROJEKT ERSTELLEN'}
            </h2>
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
              PROJEKT-TITEL / NAME *
            </label>
            <input
              type="text"
              id="project-name-input"
              ref={nameInputRef}
              required
              className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
              placeholder="z.B. Re-Branding 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
                STARTDATUM
              </label>
              <input
                type="date"
                id="project-start-date"
                className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none bg-white"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
                ENDDATUM / DEADLINE
              </label>
              <input
                type="date"
                id="project-end-date"
                className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none bg-white"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              ERSTE PHASE / HAUPTZIEL (OPTIONAL)
            </label>
            <input
              type="text"
              id="project-first-phase"
              className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
              placeholder="z.B. Phase 01: Vorbereitung & Analyse"
              value={firstPhase}
              onChange={(e) => setFirstPhase(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              INITIALER STATUS
            </label>
            <select
              id="project-status-select"
              className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none bg-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Aktiv">🟢 STATUS: AKTIV</option>
              <option value="Pausiert">⚠️ STATUS: PAUSIERT</option>
            </select>
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
              PROJEKT ANLEGEN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
