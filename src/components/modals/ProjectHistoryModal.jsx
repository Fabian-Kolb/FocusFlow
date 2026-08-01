import React from 'react';
import { useModalContext } from '../../context/ModalContext';

const defaultHistoryItems = [
  {
    id: 'h1',
    date: '14. MAI 2024 • 16:30 Uhr',
    title: "Unterpunkt erledigt: 'Moodboard & Designinspo erstellen'",
    category: 'Phase 1: Vorbereitung & Analyse',
    icon: 'check',
    badgeBg: 'bg-emerald-100 border border-emerald-300 text-emerald-800'
  },
  {
    id: 'h2',
    date: '12. MAI 2024 • 11:15 Uhr',
    title: "Neues Phasenmaterial hinzugefügt: 'Briefing-Dokument.pdf'",
    category: 'Phase 1: Vorbereitung & Analyse',
    icon: 'attach_file',
    badgeBg: 'bg-surface-low border border-outline-variant text-primary'
  },
  {
    id: 'h3',
    date: '10. MAI 2024 • 09:00 Uhr',
    title: "Phase 1 gestartet: 'Vorbereitung & Analyse'",
    category: 'Projekt-Startschuss',
    icon: 'flag',
    badgeBg: 'bg-surface-low border border-outline-variant text-primary'
  },
  {
    id: 'h4',
    date: '12. APRIL 2024 • 10:00 Uhr',
    title: "Projekt 'Re-Branding 2024' erfolgreich angelegt",
    category: 'Gesamtdauer: 70 Tage (Deadline: 30. Juni)',
    icon: 'rocket_launch',
    badgeBg: 'bg-primary text-white'
  }
];

const ProjectHistoryModal = () => {
  const { activeModal, modalPayload, closeModal, projects, selectedProjectId } = useModalContext();
  const isOpen = activeModal === 'history';

  const currentProject = projects.find(p => p.id === (modalPayload.projectId || selectedProjectId)) || projects[0];
  const historyList = (currentProject?.history && currentProject.history.length > 0)
    ? currentProject.history
    : (modalPayload.history || defaultHistoryItems);

  if (!isOpen) {
    return (
      <div id="project-history-modal" className="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"></div>
    );
  }

  const projectTitle = modalPayload.projectTitle || currentProject?.title || 'Re-Branding 2024';

  return (
    <div
      id="project-history-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white border-2 border-primary w-full max-w-xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary flex-shrink-0">history</span>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">
              HISTORIE: {projectTitle}
            </h2>
          </div>
          <button
            type="button"
            className="p-1 hover:bg-surface-low border border-outline-variant transition-colors flex-shrink-0"
            onClick={closeModal}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Timeline der vergangenen Aktivitäten */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 sm:pr-2">
          {historyList.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.badgeBg}`}>
                <span className="material-symbols-outlined text-[14px]">{item.icon || 'history'}</span>
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-mono font-bold text-primary block">
                  {item.date}
                </span>
                <p className="text-xs sm:text-sm font-medium">{item.title}</p>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-outline-variant pt-3 flex justify-end">
          <button
            type="button"
            className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors"
            onClick={closeModal}
          >
            SCHLIESSEN
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectHistoryModal;
