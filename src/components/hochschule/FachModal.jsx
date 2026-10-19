import React, { useEffect, useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Button, Field, Input, Sheet, Textarea } from '../ds';

/**
 * Neues Fach (Hochschule). Ein Fach ist ein Projekt vom Typ „fach“ mit einem Abschnitt „Aufgaben“ für
 * Übungsblätter und Abgaben, Prüfungstermin und „Hinweisen aus der Stunde“.
 * Aufruf: openModal('fach', { prefillTitle? }).
 */
const FachModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, addProject } = useModalContext();
  const isOpen = activeModal === 'fach';
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(modalPayload?.prefillTitle || '');
    setExamDate('');
    setDescription('');
  }, [isOpen, modalPayload]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    addProject({
      title: name.trim(),
      description: description.trim(),
      type: 'fach',
      exam: examDate ? { date: examDate } : undefined,
      status: 'AKTIV',
      phases: [{ title: 'Aufgaben', tasks: [] }],
    });
    closeModal();
    if (setCurrentScreen) setCurrentScreen('projects');
  };

  return (
    <Sheet
      open={isOpen}
      onClose={closeModal}
      width="lg"
      title="Neues Fach"
      description="Ein Fach bündelt Aufgaben, Hinweise aus der Stunde und den Prüfungstermin."
      footer={(
        <>
          <Button variant="secondary" onClick={closeModal}>Abbrechen</Button>
          <Button type="submit" form="fach-form">Fach hinzufügen</Button>
        </>
      )}
    >
      <form id="fach-form" onSubmit={handleSubmit} className="space-y-5">
        <Field label="Name">
          <Input data-autofocus required placeholder="z. B. Mathe 2" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Prüfungstermin" optional hint="Zeigt auf Home einen Countdown. Du kannst ihn später ändern.">
          <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </Field>
        <Field label="Beschreibung" optional>
          <Textarea placeholder="z. B. Analysis und lineare Algebra, 2. Semester" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Sheet>
  );
};

export default FachModal;
