import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';

const TaskModal = () => {
  const { activeModal, modalPayload, closeModal, addTask, projects, selectedProjectId } = useModalContext();
  const isOpen = activeModal === 'task';

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [targetPhaseId, setTargetPhaseId] = useState('');
  const titleInputRef = useRef(null);

  const targetProjectId = modalPayload.projectId || selectedProjectId;
  const currentProject = projects.find(p => p.id === targetProjectId) || projects[0];

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDate('');
      setNote('');

      const defaultPhaseId = modalPayload.phaseId || (currentProject?.phases[0]?.id || '');
      setTargetPhaseId(defaultPhaseId);

      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, modalPayload, currentProject]);

  if (!isOpen) {
    return (
      <div id="task-modal" className="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"></div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const phaseIdToUse = targetPhaseId || (currentProject?.phases[0]?.id);
    if (!phaseIdToUse) {
      alert('Bitte erst eine Phase für dieses Projekt anlegen.');
      return;
    }

    addTask(targetProjectId, phaseIdToUse, {
      title: title.trim(),
      date: date.trim() || 'Demnächst',
      note: note.trim()
    });

    closeModal();
  };

  return (
    <div
      id="task-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white border-2 border-primary w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[22px] text-primary">add_task</span>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">UNTERPUNKT HINZUFÜGEN</h2>
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
          {currentProject?.phases && currentProject.phases.length > 1 && (
            <div>
              <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
                PHASE AUSWÄHLEN
              </label>
              <select
                id="task-phase-select"
                className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none bg-white"
                value={targetPhaseId}
                onChange={(e) => setTargetPhaseId(e.target.value)}
              >
                {currentProject.phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              AUFGABEN-TITEL *
            </label>
            <input
              type="text"
              id="task-title-input"
              ref={titleInputRef}
              required
              className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
              placeholder="z.B. Stakeholder Interviews führen"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              GEPLANTES DATUM / ZEITRAUM
            </label>
            <input
              type="text"
              id="task-date-input"
              className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none"
              placeholder="z.B. Freitag, 17. Mai"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
              ANMERKUNG / NOTIZ (OPTIONAL)
            </label>
            <textarea
              id="task-note-input"
              rows={2}
              className="w-full border border-outline-variant p-2 text-xs focus:border-primary outline-none"
              placeholder="Wichtige Hinweise zur Durchführung..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
              TASK SPEICHERN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
