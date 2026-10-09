import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Button, Field, Input, Sheet, Textarea } from '../ds';

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
    <Sheet
      open={isOpen}
      onClose={closeModal}
      title="Neue Phase"
      footer={(
        <>
          <Button variant="secondary" onClick={closeModal}>Abbrechen</Button>
          <Button type="submit" form="phase-form">Phase hinzufügen</Button>
        </>
      )}
    >
      <form id="phase-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Titel">
          <Input
            id="phase-title-input"
            ref={titleInputRef}
            data-autofocus
            required
            placeholder="z. B. Testing und Launch"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Zeitraum" optional>
          <Input
            id="phase-date-input"
            placeholder="z. B. 1.–15. Mai"
            value={dateInfo}
            onChange={(e) => setDateInfo(e.target.value)}
          />
        </Field>

        <Field label="Ziel" optional>
          <Textarea
            id="phase-desc-input"
            rows={3}
            placeholder="Was soll in dieser Phase erreicht werden?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </form>
    </Sheet>
  );
};

export default PhaseModal;
