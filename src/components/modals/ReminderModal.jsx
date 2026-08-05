import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { generateReminderStructure } from '../../lib/gemini';

const ReminderModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, addReminder } = useModalContext();
  const isOpen = activeModal === 'reminder';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('GEPLANT');
  const [isGenerating, setIsGenerating] = useState(false);
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(modalPayload.prefillTitle || modalPayload.prefilledTitle || '');
      setDescription(modalPayload.prefillDescription || '');
      setDate(modalPayload.date || '');
      setTime(modalPayload.time || '');
      setStatus(modalPayload.status || 'GEPLANT');

      // Auto-focus input after modal opens
      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, modalPayload]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    addReminder({
      title: title.trim(),
      description: description.trim(),
      date,
      time,
      status,
      inboxItemId: modalPayload.inboxItemId
    });

    closeModal();
    if (setCurrentScreen) {
      setCurrentScreen('reminders');
    }
  };

  const isConversion = Boolean(modalPayload.inboxItemId);

  return (
    <div
      id="reminder-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant p-5 sm:px-6 sm:py-5 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold font-mono uppercase truncate text-on-surface" id="reminder-modal-title">
              {isConversion ? 'Inbox-Gedanke umwandeln' : 'Neue Erinnerung erstellen'}
            </h2>
          </div>
          <button
            type="button"
            className="p-2 hover:bg-surface-low rounded-full text-on-surface-variant transition-colors"
            onClick={closeModal}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-grow">
          <form id="reminder-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Title */}
            <div>
              <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                Erinnerungs-Titel / Name *
              </label>
              <input
                type="text"
                ref={titleInputRef}
                required
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-colors"
                placeholder="z.B. Zahnarzt anrufen"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* AI Generation Button */}
            {isConversion && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-on-surface-variant max-w-sm leading-relaxed">
                  Lass die KI aus deiner Notiz automatisch einen strukturierten Erinnerungstitel und eine Beschreibung erstellen.
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const textToStructure = description || title;
                    if (!textToStructure.trim()) return;
                    setIsGenerating(true);
                    const result = await generateReminderStructure(textToStructure);
                    if (result) {
                      if (result.title) setTitle(result.title);
                      if (result.description) setDescription(result.description);
                    }
                    setIsGenerating(false);
                  }}
                  disabled={isGenerating}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">{isGenerating ? 'sync' : 'auto_awesome'}</span>
                  {isGenerating ? 'Strukturiere...' : 'KI: Erinnerung strukturieren'}
                </button>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                Beschreibung / Notiz (Optional)
              </label>
              <textarea
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-3 text-sm focus:border-primary outline-none min-h-[120px] resize-y transition-colors leading-relaxed"
                placeholder="Zusätzliche Details, Kontext oder Fließtext..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                  Fälligkeitsdatum (Optional)
                </label>
                <input
                  type="date"
                  className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-colors bg-white cursor-pointer"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                  Uhrzeit (Optional)
                </label>
                <input
                  type="time"
                  className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-colors bg-white cursor-pointer"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant p-5 sm:px-6 flex items-center justify-end gap-3 flex-shrink-0 bg-surface-low rounded-b-2xl">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
            onClick={closeModal}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form="reminder-form"
            className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm"
          >
            Erinnerung anlegen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderModal;
