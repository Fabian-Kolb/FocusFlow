import React, { createContext, useContext, useState } from 'react';
import { projects as initialProjects, inboxItems as initialInboxItems } from '../data/mockData';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalPayload, setModalPayload] = useState({});
  const [projects, setProjects] = useState(initialProjects);
  const [inboxItems, setInboxItems] = useState(initialInboxItems);
  const [selectedProjectId, setSelectedProjectId] = useState('p1');

  const openModal = (modalType, payload = {}) => {
    setActiveModal(modalType);
    setModalPayload(payload);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalPayload({});
  };

  const addProject = (projectData) => {
    const newId = `p_${Date.now()}`;
    const startStr = projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '01.08.24';
    const endStr = projectData.endDate ? new Date(projectData.endDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '31.12.24';
    
    const newPhases = [];
    if (projectData.firstPhase && projectData.firstPhase.trim() !== '') {
      newPhases.push({
        id: `ph_${Date.now()}`,
        title: projectData.firstPhase.trim().toUpperCase(),
        dateInfo: 'Startphase',
        completed: false,
        tasks: [],
        materials: []
      });
    }

    const newProject = {
      id: newId,
      title: projectData.title,
      status: projectData.status === 'Pausiert' ? 'PAUSIERT' : 'LAUFEND',
      nextStep: newPhases.length > 0 ? `Nächste Etappe: ${newPhases[0].title}` : 'Erste Schritte planen',
      dateRange: `${startStr} – ${endStr}`,
      daysRemaining: 'NEU GESTARTET',
      progress: 0,
      timeElapsed: 0,
      phasesCompleted: 0,
      phasesTotal: newPhases.length,
      tasksCompleted: 0,
      tasksTotal: 0,
      warning: null,
      phases: newPhases,
      history: [
        {
          id: `h_${Date.now()}`,
          date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
          title: `Projekt '${projectData.title}' erfolgreich angelegt`,
          category: 'Gesamtdauer: Neu angelegt',
          icon: 'rocket_launch',
          badgeBg: 'bg-primary text-white'
        }
      ]
    };

    setProjects(prev => [newProject, ...prev]);
    setSelectedProjectId(newId);

    // If converted from inbox item, delete from inbox
    if (projectData.inboxItemId) {
      deleteInboxItem(projectData.inboxItemId);
    }

    return newId;
  };

  const addPhase = (projectId, phaseData) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;
      
      const newPhaseCount = proj.phases.length + 1;
      const formattedTitle = phaseData.title.trim().toUpperCase();
      const phaseNumStr = newPhaseCount < 10 ? `0${newPhaseCount}` : `${newPhaseCount}`;
      const fullTitle = formattedTitle.startsWith('PHASE') ? formattedTitle : `PHASE ${phaseNumStr}: ${formattedTitle}`;

      const newPhase = {
        id: `ph_${Date.now()}`,
        title: fullTitle,
        dateInfo: phaseData.dateInfo || 'Demnächst',
        completed: false,
        description: phaseData.description || '',
        tasks: [],
        materials: []
      };

      const updatedPhases = [...proj.phases, newPhase];
      const historyEntry = {
        id: `h_${Date.now()}`,
        date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
        title: `Phase gestartet: '${fullTitle}'`,
        category: 'Neue Phase',
        icon: 'flag',
        badgeBg: 'bg-surface-low border border-outline-variant text-primary'
      };

      return {
        ...proj,
        phasesTotal: updatedPhases.length,
        phases: updatedPhases,
        history: [historyEntry, ...(proj.history || [])]
      };
    }));
  };

  const addTask = (projectId, phaseId, taskData) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;

      let targetPhaseTitle = '';
      const updatedPhases = proj.phases.map(phase => {
        if (phase.id !== phaseId) return phase;
        targetPhaseTitle = phase.title;

        const newTask = {
          id: `t_${Date.now()}`,
          title: taskData.title.trim(),
          date: taskData.date ? taskData.date.trim() : 'Demnächst',
          completed: false,
          note: taskData.note ? taskData.note.trim() : ''
        };

        return {
          ...phase,
          tasks: [...phase.tasks, newTask]
        };
      });

      const totalTasks = updatedPhases.reduce((acc, p) => acc + p.tasks.length, 0);
      const historyEntry = {
        id: `h_${Date.now()}`,
        date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
        title: `Unterpunkt hinzugefügt: '${taskData.title.trim()}'`,
        category: targetPhaseTitle || 'Aufgabe',
        icon: 'add_task',
        badgeBg: 'bg-surface-low border border-outline-variant text-primary'
      };

      return {
        ...proj,
        tasksTotal: totalTasks,
        phases: updatedPhases,
        history: [historyEntry, ...(proj.history || [])]
      };
    }));
  };

  const addMaterial = (projectId, phaseId, materialData) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;

      let targetPhaseTitle = '';
      const updatedPhases = proj.phases.map(phase => {
        if (phase.id !== phaseId) return phase;
        targetPhaseTitle = phase.title;

        const newMaterial = {
          id: `m_${Date.now()}`,
          name: materialData.name.trim(),
          type: materialData.name.startsWith('http') ? 'link' : 'document'
        };

        return {
          ...phase,
          materials: [...(phase.materials || []), newMaterial]
        };
      });

      const historyEntry = {
        id: `h_${Date.now()}`,
        date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
        title: `Neues Phasenmaterial hinzugefügt: '${materialData.name.trim()}'`,
        category: targetPhaseTitle || 'Material',
        icon: 'attach_file',
        badgeBg: 'bg-surface-low border border-outline-variant text-primary'
      };

      return {
        ...proj,
        phases: updatedPhases,
        history: [historyEntry, ...(proj.history || [])]
      };
    }));
  };

  const toggleTask = (projectId, phaseId, taskId) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;

      let taskTitle = '';
      let isNowCompleted = false;
      let phaseName = '';

      const updatedPhases = proj.phases.map(phase => {
        if (phase.id !== phaseId) return phase;
        phaseName = phase.title;

        const updatedTasks = phase.tasks.map(t => {
          if (t.id !== taskId) return t;
          taskTitle = t.title;
          isNowCompleted = !t.completed;
          return { ...t, completed: isNowCompleted };
        });

        const allPhaseTasksCompleted = updatedTasks.length > 0 && updatedTasks.every(t => t.completed);

        return {
          ...phase,
          completed: allPhaseTasksCompleted,
          tasks: updatedTasks
        };
      });

      const totalTasks = updatedPhases.reduce((acc, p) => acc + p.tasks.length, 0);
      const completedTasks = updatedPhases.reduce((acc, p) => acc + p.tasks.filter(t => t.completed).length, 0);
      const completedPhases = updatedPhases.filter(p => p.completed).length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : proj.progress;

      let historyEntry = null;
      if (isNowCompleted) {
        historyEntry = {
          id: `h_${Date.now()}`,
          date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
          title: `Unterpunkt erledigt: '${taskTitle}'`,
          category: phaseName,
          icon: 'check',
          badgeBg: 'bg-emerald-100 border border-emerald-300 text-emerald-800'
        };
      }

      return {
        ...proj,
        progress: progressPercent,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
        phasesCompleted: completedPhases,
        phases: updatedPhases,
        history: historyEntry ? [historyEntry, ...(proj.history || [])] : (proj.history || [])
      };
    }));
  };

  const toggleProjectStatus = (projectId) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;
      const newStatus = proj.status === 'PAUSIERT' ? 'LAUFEND' : 'PAUSIERT';
      return { ...proj, status: newStatus };
    }));
  };

  const addInboxItem = (title) => {
    if (!title.trim()) return;
    const newItem = {
      id: `i_${Date.now()}`,
      title: title.trim(),
      completed: false
    };
    setInboxItems(prev => ({
      ...prev,
      today: [newItem, ...prev.today]
    }));
  };

  const deleteInboxItem = (id) => {
    setInboxItems(prev => ({
      today: prev.today.filter(item => item.id !== id),
      yesterday: prev.yesterday.filter(item => item.id !== id)
    }));
  };

  return (
    <ModalContext.Provider value={{
      activeModal,
      modalPayload,
      openModal,
      closeModal,
      projects,
      inboxItems,
      selectedProjectId,
      setSelectedProjectId,
      addProject,
      addPhase,
      addTask,
      addMaterial,
      toggleTask,
      toggleProjectStatus,
      addInboxItem,
      deleteInboxItem
    }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
};

export default ModalContext;
