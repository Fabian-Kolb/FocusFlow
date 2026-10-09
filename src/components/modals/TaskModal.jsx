import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useToast } from '../../context/ToastContext';
import { Button, Field, Input, Select, Sheet, Textarea } from '../ds';

const TaskModal = () => {
  const { activeModal, modalPayload, closeModal, addTask, projects, selectedProjectId } = useModalContext();
  const { showToast } = useToast();
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const phaseIdToUse = targetPhaseId || (currentProject?.phases[0]?.id);
    if (!phaseIdToUse) {
      showToast({ message: 'Lege zuerst einen Abschnitt für dieses Projekt an.', icon: 'info' });
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
    <Sheet
      open={isOpen}
      onClose={closeModal}
      title="Aufgabe hinzufügen"
      footer={(
        <>
          <Button variant="secondary" onClick={closeModal}>Abbrechen</Button>
          <Button type="submit" form="task-form">Aufgabe hinzufügen</Button>
        </>
      )}
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
        {currentProject?.phases && currentProject.phases.length > 1 && (
          <Field label="Abschnitt">
            <Select id="task-phase-select" value={targetPhaseId} onChange={(e) => setTargetPhaseId(e.target.value)}>
              {currentProject.phases.map((ph) => (
                <option key={ph.id} value={ph.id}>{ph.title}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Titel">
          <Input
            id="task-title-input"
            ref={titleInputRef}
            data-autofocus
            required
            placeholder="z. B. Stakeholder-Interviews führen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Geplantes Datum oder Zeitraum" optional>
          <Input
            id="task-date-input"
            placeholder="z. B. Freitag, 17. Mai"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Notiz" optional>
          <Textarea
            id="task-note-input"
            rows={3}
            placeholder="Wichtige Hinweise zur Durchführung"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </form>
    </Sheet>
  );
};

export default TaskModal;
