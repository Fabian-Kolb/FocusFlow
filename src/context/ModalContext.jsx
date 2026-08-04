import React, { createContext, useContext, useState } from 'react';
import { projects as initialProjects, inboxItems as initialInboxItems, reminders as initialReminders } from '../data/mockData';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalPayload, setModalPayload] = useState({});
  const [projects, setProjects] = useState(initialProjects);
  const [inboxItems, setInboxItems] = useState(initialInboxItems);
  const [reminders, setReminders] = useState(initialReminders);
  const [selectedProjectId, setSelectedProjectId] = useState('p1');
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [activeCoachScope, setActiveCoachScope] = useState('all');

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
      status: 'GEPLANT',
      isPaused: false,
      inKanban: true,
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
          type: materialData.content ? 'note' : (materialData.name.startsWith('http') ? 'link' : 'document'),
          content: materialData.content || null
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
      let newStatus = 'GEPLANT';
      if (proj.status === 'GEPLANT') newStatus = 'AKTIV';
      else if (proj.status === 'AKTIV' || proj.status === 'LAUFEND') newStatus = 'ABGESCHLOSSEN';
      else newStatus = 'GEPLANT';
      return { ...proj, status: newStatus };
    }));
  };

  const toggleProjectPause = (projectId) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;
      return { ...proj, isPaused: !proj.isPaused };
    }));
  };

  const setProjectStatus = (projectId, newStatus) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;
      return { ...proj, status: newStatus };
    }));
  };

  const updateProjectForKanban = (projectId, column) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;
      if (column === 'TODO') {
        return { ...proj, status: 'GEPLANT', progress: 0 };
      }
      if (column === 'IN_PROGRESS') {
        return { ...proj, status: 'AKTIV', progress: proj.progress === 0 ? 10 : proj.progress };
      }
      if (column === 'DONE') {
        return { ...proj, status: 'ABGESCHLOSSEN', progress: 100 };
      }
      return proj;
    }));
  };

  const updateReminderForKanban = (reminderId, column) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id !== reminderId) return rem;
      if (column === 'TODO') {
        return { ...rem, status: 'GEPLANT' };
      }
      if (column === 'IN_PROGRESS') {
        return { ...rem, status: 'AKTIV' };
      }
      if (column === 'DONE') {
        return { ...rem, status: 'ABGESCHLOSSEN' };
      }
      return rem;
    }));
  };

  const toggleReminderStatus = (reminderId) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id !== reminderId) return rem;
      let nextStatus = 'GEPLANT';
      if (rem.status === 'GEPLANT') nextStatus = 'AKTIV';
      else if (rem.status === 'AKTIV') nextStatus = 'ABGESCHLOSSEN';
      else nextStatus = 'GEPLANT';
      return { ...rem, status: nextStatus };
    }));
  };

  const setReminderStatus = (reminderId, newStatus) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id !== reminderId) return rem;
      return { ...rem, status: newStatus };
    }));
  };

  const toggleReminderPause = (reminderId) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id !== reminderId) return rem;
      return { ...rem, isPaused: !rem.isPaused };
    }));
  };

  const deleteProject = (projectId) => {
    setProjects(prev => prev.filter(proj => proj.id !== projectId));
  };

  const deleteReminder = (reminderId) => {
    setReminders(prev => prev.filter(rem => rem.id !== reminderId));
  };

  const toggleProjectKanban = (projectId) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== projectId) return proj;
      const currentInKanban = proj.inKanban !== false;
      return { ...proj, inKanban: !currentInKanban };
    }));
  };

  const toggleReminderKanban = (reminderId) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id !== reminderId) return rem;
      const currentInKanban = rem.inKanban !== false;
      return { ...rem, inKanban: !currentInKanban };
    }));
  };

  const addInboxItem = (itemData) => {
    let newItem;
    if (typeof itemData === 'object' && itemData !== null) {
      newItem = {
        id: `i_${Date.now()}`,
        title: itemData.title || itemData.summary,
        summary: itemData.summary,
        originalText: itemData.originalText,
        completed: false
      };
    } else {
      if (!itemData || !itemData.trim()) return;
      newItem = {
        id: `i_${Date.now()}`,
        title: itemData.trim(),
        completed: false
      };
    }
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
      reminders,
      selectedProjectId,
      setSelectedProjectId,
      selectedReminderId,
      setSelectedReminderId,
      activeCoachScope,
      setActiveCoachScope,
      addProject,
      addPhase,
      addTask,
      addMaterial,
      toggleTask,
      toggleProjectStatus,
      toggleProjectPause,
      deleteProject,
      toggleProjectKanban,
      setProjectStatus,
      updateProjectForKanban,
      updateReminderForKanban,
      toggleReminderStatus,
      setReminderStatus,
      toggleReminderPause,
      deleteReminder,
      toggleReminderKanban,
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
