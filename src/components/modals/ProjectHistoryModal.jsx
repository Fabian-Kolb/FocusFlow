import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Button, Icon, Sheet, cx } from '../ds';
import { HISTORY_MARK_CLASS, historyTone } from '../../lib/historyStyle';

const defaultHistoryItems = [
  {
    id: 'h1',
    date: '14. Mai 2024 • 16:30 Uhr',
    title: "Unterpunkt erledigt: 'Moodboard & Designinspo erstellen'",
    category: 'Phase 1: Vorbereitung und Analyse',
    icon: 'check',
    tone: 'success',
  },
  {
    id: 'h2',
    date: '12. Mai 2024 • 11:15 Uhr',
    title: "Neues Phasenmaterial hinzugefügt: 'Briefing-Dokument.pdf'",
    category: 'Phase 1: Vorbereitung und Analyse',
    icon: 'attach_file',
  },
  {
    id: 'h3',
    date: '10. Mai 2024 • 09:00 Uhr',
    title: "Phase 1 gestartet: 'Vorbereitung und Analyse'",
    category: 'Projekt-Startschuss',
    icon: 'flag',
  },
  {
    id: 'h4',
    date: '12. April 2024 • 10:00 Uhr',
    title: "Projekt 'Re-Branding 2024' erfolgreich angelegt",
    category: 'Gesamtdauer: 70 Tage (Deadline: 30. Juni)',
    icon: 'rocket_launch',
  },
];

const ProjectHistoryModal = () => {
  const { activeModal, modalPayload, closeModal, projects, selectedProjectId } = useModalContext();
  const isOpen = activeModal === 'history';

  const currentProject = projects.find(p => p.id === (modalPayload.projectId || selectedProjectId)) || projects[0];
  const historyList = (currentProject?.history && currentProject.history.length > 0)
    ? currentProject.history
    : (modalPayload.history || defaultHistoryItems);

  const projectTitle = modalPayload.projectTitle || currentProject?.title || 'Projekt';

  return (
    <Sheet
      open={isOpen}
      onClose={closeModal}
      title="Verlauf"
      description={projectTitle}
      footer={<Button variant="secondary" onClick={closeModal}>Schließen</Button>}
    >
      <ol className="space-y-4">
        {historyList.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className={cx(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                HISTORY_MARK_CLASS[historyTone(item)],
              )}
              aria-hidden="true"
            >
              <Icon name={item.icon || 'history'} size="sm" />
            </span>
            <div className="min-w-0">
              <span className="block text-caption text-tertiary">{item.date}</span>
              <p className="text-body-strong text-primary">{item.title}</p>
              {item.category && <span className="text-caption text-secondary">{item.category}</span>}
            </div>
          </li>
        ))}
      </ol>
    </Sheet>
  );
};

export default ProjectHistoryModal;
