import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import NotesSection from '../ui/NotesSection';
import TaskDetailDrawer from '../ui/TaskDetailDrawer';
import SectionDetailDrawer from '../ui/SectionDetailDrawer';
import GlobalChatDrawer from '../ui/GlobalChatDrawer';
import { canFitDrawersSideBySide } from '../../lib/breakpoints';
import {
  getProjectStats,
  getProjectTimeline,
  getPhaseStats,
  normalizeProjectStatus,
  formatTaskDate
} from '../../lib/projectProgress';

import {
  Alert, Badge, Button, Card, Checkbox, Chip, FOCUS, Field, FioMark, Icon, IconButton, IconTile, Input, Kbd, ListGroup, ListItem,
  ProgressBar, SectionHeader, Sheet, Stat, Textarea, cx,
} from '../ds';
import { HISTORY_MARK_CLASS, historyTone } from '../../lib/historyStyle';
const HISTORY_LIMIT = 100;

/** Zeitstempel im selben Format wie die Verlaufs-Einträge aus dem DataContext */
const historyTimestamp = () => {
  const now = new Date();
  const day = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} • ${time} Uhr`;
};

const withHistory = (prev, entry) =>
  [{ id: `h_${Date.now()}`, timestamp: historyTimestamp(), ...entry }, ...(prev.history || [])].slice(0, HISTORY_LIMIT);

const ProjectDetail = ({ setCurrentScreen }) => {
  const { 
    projects: contextProjects, 
    trashItems,
    selectedProjectId, 
    openModal,
    toggleTask: contextToggleTask, 
    toggleProjectStatus: contextToggleProjectStatus,
    setActiveCoachScope,
    mutateProject,
    toggleProjectPause,
    toggleProjectKanban,
    projectCategories,
    user,
    isCalendarConnected,
    batchSyncPhaseTasks
  } = useModalContext();
  // Kein Rückfall auf ein anderes Projekt: Ohne Treffer zeigt der Screen "Projekt nicht gefunden"
  const selectedProject = contextProjects.find(p => p.id === selectedProjectId) || (trashItems && trashItems.find(p => p.id === selectedProjectId));

  const projectData = selectedProject || {};
  const projectPhases = projectData.phases || [];
  const isTrashed = !!projectData.deletedAt;
  const stats = getProjectStats(projectData);
  const { timeline } = stats;

  const categoryObj = (projectCategories || []).find(c => c.id === (projectData.categoryId || 'allgemein')) || { id: 'allgemein', name: 'Allgemein' };

  const setProjectData = (mutateFn) => {
    const targetId = projectData.id || selectedProjectId;
    if (!targetId) return;
    if (typeof mutateFn === 'function') {
      mutateProject(targetId, mutateFn);
    } else {
      mutateProject(targetId, () => mutateFn);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
    } catch {
      return dateStr;
    }
  };

  const [filterType, setFilterType] = useState('all'); // 'all' | 'open' | 'completed'
  const [collapsedPhases, setCollapsedPhases] = useState({});
  const [selectedTask, setSelectedTask] = useState(null); // { task, phase }
  const [selectedPhase, setSelectedPhase] = useState(null); // the phase object for the SectionDetailDrawer
  const [activeNoteModal, setActiveNoteModal] = useState(null); // note to view/edit in full modal
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [isTransitioningDrawer, setIsTransitioningDrawer] = useState(false);
  const rootRef = useRef(null);
  const [canFitSideBySide, setCanFitSideBySide] = useState(() => {
    if (typeof window !== 'undefined') {
      return canFitDrawersSideBySide(window.innerWidth - 256);
    }
    return false;
  });

  useEffect(() => {
    const updateAvailableWidth = () => {
      if (rootRef.current) {
        const width = rootRef.current.clientWidth;
        setCanFitSideBySide(canFitDrawersSideBySide(width));
      } else if (typeof window !== 'undefined') {
        setCanFitSideBySide(canFitDrawersSideBySide(window.innerWidth - 256));
      }
    };

    updateAvailableWidth();

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && rootRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect?.width || rootRef.current?.clientWidth;
          if (typeof width === 'number') {
            setCanFitSideBySide(canFitDrawersSideBySide(width));
          }
        }
      });
      resizeObserver.observe(rootRef.current);
    }

    window.addEventListener('resize', updateAvailableWidth);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateAvailableWidth);
    };
  }, []);
  
  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [activePhaseIdForTask, setActivePhaseIdForTask] = useState(null);
  const [activeTargetForMaterial, setActiveTargetForMaterial] = useState(null); // { type: 'phase'|'task', id: string }
  const [syncingPhaseId, setSyncingPhaseId] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null); // { message, type: 'success' | 'error' }

  // Form Inputs
  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [newPhaseDesc, setNewPhaseDesc] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskNote, setNewTaskNote] = useState('');

  const [newMaterialName, setNewMaterialName] = useState('');
  const localFileInputRef = React.useRef(null);

  // States for Editing Dates & Notes Inline
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState(selectedProject?.startDate || '');
  const [editEndDate, setEditEndDate] = useState(selectedProject?.endDate || '');

  // States for Editing Title Inline
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(projectData.title || '');

  useEffect(() => {
    setEditTitle(projectData.title || '');
  }, [projectData.title]);

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== projectData.title) {
      setProjectData(prev => ({ ...prev, title: editTitle.trim() }));
    }
    setIsEditingTitle(false);
  };

  // Removed unneeded inline edit functions

  const handleSaveDates = () => {
    // Die Anzeige rechnet live; die gespeicherten Textfelder bleiben nur für ältere Karten-Ansichten
    const saved = getProjectTimeline({ ...projectData, startDate: editStartDate, endDate: editEndDate });
    setProjectData(prev => ({
      ...prev,
      startDate: editStartDate,
      endDate: editEndDate,
      dateRange: saved.dateRange,
      daysRemaining: saved.deadlineLabel,
      timeElapsed: saved.timeElapsed ?? 0
    }));
    setIsEditingDates(false);
  };

  // Reset local state if another project is selected
  useEffect(() => {
    if (selectedProject) {
      setEditStartDate(selectedProject.startDate || '');
      setEditEndDate(selectedProject.endDate || '');
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedTask && selectedProject) {
      const phase = selectedProject.phases?.find(p => p.id === selectedTask.phase.id);
      const task = phase?.tasks?.find(t => t.id === selectedTask.task.id);
      if (task && phase) {
        setSelectedTask({ task, phase });
      } else {
        setSelectedTask(null);
      }
    }
    
    if (selectedPhase && selectedProject) {
      const phase = selectedProject.phases?.find(p => p.id === selectedPhase.id);
      if (phase) {
        setSelectedPhase(phase);
      } else {
        setSelectedPhase(null);
      }
    }
  }, [selectedProject]);

  // Status Selector
  const handleStatusSet = (newStatus) => {
    setProjectData((prev) => ({ ...prev, status: newStatus }));
  };

  const handleAddNote = (note) => {
    mutateProject(projectData.id, (p) => ({
      ...p,
      notes: [...(p.notes || []), note]
    }));
  };

  const handleUpdateNote = (noteId, updatedData) => {
    mutateProject(projectData.id, (p) => ({
      ...p,
      notes: (p.notes || []).map(n => n.id === noteId ? { ...n, ...updatedData } : n)
    }));
  };

  const handleDeleteNote = (noteId) => {
    mutateProject(projectData.id, (p) => ({
      ...p,
      notes: (p.notes || []).filter(n => n.id !== noteId)
    }));
  };

  const cleanNoteReferences = (phases, noteId) => {
    return (phases || []).map(phase => {
      const updatedMaterials = (phase.materials || []).filter(m => m.noteId !== noteId && m.url !== `#note-${noteId}`);
      const updatedTasks = (phase.tasks || []).map(task => {
        const updatedLinks = (task.links || []).filter(l => l.noteId !== noteId && l.url !== `#note-${noteId}`);
        return { ...task, links: updatedLinks };
      });
      return { ...phase, materials: updatedMaterials, tasks: updatedTasks };
    });
  };

  const handleConvertNoteToPhase = (note) => {
    setProjectData((prev) => {
      const cleanedPhases = cleanNoteReferences(prev.phases || [], note.id);
      const newPhaseId = `ph_${Date.now()}`;
      const newPhase = {
        id: newPhaseId,
        phaseNum: '',
        title: note.title || 'Aus Notiz erstellt',
        description: note.content || '',
        badgeText: '0/0 ERLEDIGT',
        completed: false,
        materials: [],
        tasks: []
      };
      const updatedPhases = [...cleanedPhases, newPhase];
      const updatedNotes = (prev.notes || []).filter(n => n.id !== note.id);

      return {
        ...prev,
        phasesTotal: updatedPhases.length,
        phases: updatedPhases,
        notes: updatedNotes,
        history: withHistory(prev, {
          text: `Neuer Abschnitt aus Notiz erstellt: '${newPhase.title}'`,
          phase: 'Projekt-Fortschritt',
          icon: 'note_add',
          iconStyle: 'bg-hover text-primary border border-default'
        })
      };
    });
  };

  const handleConvertNoteToTask = (note, phaseId) => {
    setProjectData((prev) => {
      const cleanedPhases = cleanNoteReferences(prev.phases || [], note.id);
      const updatedPhases = cleanedPhases.map((phase) => {
        if (phase.id !== phaseId) return phase;
        
        const newTask = {
          id: `t_${Date.now()}`,
          title: note.title || 'Aus Notiz erstellt',
          note: note.content || '',
          completed: false,
          date: '',
          links: []
        };
        const updatedTasks = [...(phase.tasks || []), newTask];
        const completed = updatedTasks.filter((t) => t.completed).length;
        const total = updatedTasks.length;
        
        return {
          ...phase,
          badgeText: `${completed}/${total} ERLEDIGT`,
          tasks: updatedTasks
        };
      });

      const updatedNotes = (prev.notes || []).filter(n => n.id !== note.id);
      
      const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
      const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter((t) => t.completed).length : 0), 0);
      const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...prev,
        phases: updatedPhases,
        notes: updatedNotes,
        tasksTotal: totalTasks,
        tasksCompleted: completedTasks,
        progress: progressPct,
        tasksCountText: `(${completedTasks} / ${totalTasks} Tasks)`,
        history: withHistory(prev, {
          text: `Neue Aufgabe aus Notiz erstellt: '${note.title}'`,
          phase: 'Projekt-Fortschritt',
          icon: 'add_task',
          iconStyle: 'bg-hover text-primary border border-default'
        })
      };
    });
  };

  const handleLinkNote = (note, targetType, targetId, phaseId = null) => {
    setProjectData((prev) => {
      const cleanedPhases = cleanNoteReferences(prev.phases || [], note.id);

      const updatedPhases = cleanedPhases.map((phase) => {
        if (targetType === 'phase' && phase.id === targetId) {
          const newMaterial = {
            id: `pm_${Date.now()}`,
            name: note.title || 'Verknüpfte Notiz',
            url: `#note-${note.id}`,
            noteId: note.id,
            type: 'note'
          };
          return {
            ...phase,
            materials: [...(phase.materials || []), newMaterial]
          };
        }
        
        if (targetType === 'task' && phase.id === phaseId) {
          const updatedTasks = (phase.tasks || []).map(task => {
            if (task.id === targetId) {
              const newLink = {
                id: `tl_${Date.now()}`,
                name: note.title || 'Verknüpfte Notiz',
                url: `#note-${note.id}`,
                noteId: note.id,
                type: 'note'
              };
              return {
                ...task,
                links: [...(task.links || []), newLink]
              };
            }
            return task;
          });
          return { ...phase, tasks: updatedTasks };
        }
        
        return phase;
      });

      return {
        ...prev,
        phases: updatedPhases,
        history: withHistory(prev, {
          text: `Notiz '${note.title}' verknüpft`,
          phase: 'Wissensmanagement',
          icon: 'link',
          iconStyle: 'bg-subtle text-primary border border-subtle'
        })
      };
    });
  };

  // Collapse / Expand All Phases
  const isAllCollapsed = projectPhases.length > 0 &&
    projectPhases.every((p) => collapsedPhases[p.id]);

  const toggleAllPhases = () => {
    if (isAllCollapsed) {
      setCollapsedPhases({});
    } else {
      const newCollapsed = {};
      projectPhases.forEach((p) => {
        newCollapsed[p.id] = true;
      });
      setCollapsedPhases(newCollapsed);
    }
  };

  const togglePhaseCollapse = (phaseId) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };



  const toggleTaskCompletion = (phaseId, taskId) => {
    setProjectData((prev) => {
      let updatedCompletedCount = 0;
      let toggledTitle = '';
      let toggledPhaseTitle = '';
      let isNowCompleted = false;
      const updatedPhases = (prev.phases || []).map((phase) => {
        if (phase.id !== phaseId) {
          const cInPhase = phase.tasks ? phase.tasks.filter((t) => t.completed).length : 0;
          const tInPhase = phase.tasks ? phase.tasks.length : 0;
          const pCompleted = tInPhase > 0 && cInPhase === tInPhase;
          updatedCompletedCount += cInPhase;
          return {
            ...phase,
            completed: pCompleted,
            badgeText: pCompleted ? 'ERLEDIGT' : `${cInPhase}/${tInPhase} ERLEDIGT`
          };
        }

        toggledPhaseTitle = phase.title;
        const updatedTasks = (phase.tasks || []).map((task) => {
          if (task.id !== taskId) return task;
          toggledTitle = task.title;
          isNowCompleted = !task.completed;
          return { ...task, completed: isNowCompleted };
        });

        const completedInPhase = updatedTasks.filter((t) => t.completed).length;
        const totalInPhase = updatedTasks.length;
        const phaseCompleted = totalInPhase > 0 && completedInPhase === totalInPhase;
        updatedCompletedCount += completedInPhase;

        return {
          ...phase,
          completed: phaseCompleted,
          badgeText: phaseCompleted ? 'ERLEDIGT' : `${completedInPhase}/${totalInPhase} ERLEDIGT`,
          tasks: updatedTasks
        };
      });

      const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
      const completedPhasesCount = updatedPhases.filter((p) => p.completed).length;
      const progressPct = totalTasks > 0 ? Math.round((updatedCompletedCount / totalTasks) * 100) : prev.progress;

      let newStatus = prev.status;
      if (totalTasks > 0 && updatedCompletedCount === totalTasks) {
        newStatus = 'ABGESCHLOSSEN';
      } else if (updatedCompletedCount < totalTasks && prev.status === 'ABGESCHLOSSEN') {
        newStatus = 'AKTIV';
      }

      return {
        ...prev,
        status: newStatus,
        tasksCompleted: updatedCompletedCount,
        tasksTotal: totalTasks,
        phasesCompleted: completedPhasesCount,
        phasesTotal: updatedPhases.length,
        progress: progressPct,
        tasksCountText: `(${updatedCompletedCount} / ${totalTasks} Tasks)`,
        // Nur Erledigtes landet im Verlauf, sonst füllt jedes Hin- und Herklicken die Liste
        history: isNowCompleted
          ? withHistory(prev, {
              text: `Aufgabe erledigt: '${toggledTitle}'`,
              phase: toggledPhaseTitle,
              icon: 'check',
              iconStyle: 'bg-success-subtle border border-success text-success'
            })
          : prev.history || [],
        phases: updatedPhases
      };
    });
  };



  // Handle Add Phase
  const handlePhaseSubmit = (e) => {
    e.preventDefault();
    if (!newPhaseTitle.trim()) return;

    const newPhaseId = `ph_${Date.now()}`;
    const newPhase = {
      id: newPhaseId,
      phaseNum: '',
      title: newPhaseTitle.trim(),
      description: newPhaseDesc.trim(),
      completed: false,
      materials: [],
      tasks: []
    };

    setProjectData((prev) => {
      const updatedPhases = [...(prev.phases || []), newPhase];
      const completedPhasesCount = updatedPhases.filter((p) => p.completed).length;

      return {
        ...prev,
        phasesTotal: updatedPhases.length,
        phasesCompleted: completedPhasesCount,
        history: withHistory(prev, {
          text: `Neuer Abschnitt angelegt: '${newPhaseTitle.trim()}'`,
          phase: 'Projekt-Fortschritt',
          icon: 'flag',
          iconStyle: 'bg-subtle border border-subtle rounded-md text-primary'
        }),
        phases: updatedPhases
      };
    });

    setNewPhaseTitle('');
    setNewPhaseDesc('');
    setShowPhaseModal(false);
  };

  // Handle Add Task
  const handleTaskSubmit = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activePhaseIdForTask) return;

    const newTaskId = `t_${Date.now()}`;
    const newTask = {
      id: newTaskId,
      title: newTaskTitle.trim(),
      date: newTaskDate, // YYYY-MM-DD aus dem Datumsfeld oder leer
      completed: false,
      note: newTaskNote.trim(),
      links: []
    };

    setProjectData((prev) => {
      const updatedPhases = (prev.phases || []).map((phase) => {
        if (phase.id !== activePhaseIdForTask) return phase;
        const updatedTasks = [...(phase.tasks || []), newTask];
        const completedInPhase = updatedTasks.filter((t) => t.completed).length;
        const totalInPhase = updatedTasks.length;
        const phaseCompleted = totalInPhase > 0 && completedInPhase === totalInPhase;
        return {
          ...phase,
          completed: phaseCompleted,
          badgeText: phaseCompleted ? 'ERLEDIGT' : `${completedInPhase}/${totalInPhase} ERLEDIGT`,
          tasks: updatedTasks
        };
      });

      const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
      const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter((t) => t.completed).length : 0), 0);
      const completedPhasesCount = updatedPhases.filter((p) => p.completed).length;
      const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : prev.progress;

      let newStatus = prev.status;
      if (completedTasks < totalTasks && prev.status === 'ABGESCHLOSSEN') {
        newStatus = 'AKTIV';
      }

      return {
        ...prev,
        status: newStatus,
        tasksTotal: totalTasks,
        tasksCompleted: completedTasks,
        phasesCompleted: completedPhasesCount,
        phasesTotal: updatedPhases.length,
        progress: progressPct,
        tasksCountText: `(${completedTasks} / ${totalTasks} Tasks)`,
        phases: updatedPhases
      };
    });

    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskNote('');
    setShowTaskModal(false);
    setActivePhaseIdForTask(null);
  };

  const handleBatchSyncPhase = async (phaseId) => {
    if (!projectData?.id || !phaseId) return;
    if (user?.isGuest || !isCalendarConnected || syncingPhaseId === phaseId) return;
    setSyncingPhaseId(phaseId);
    try {
      const res = await batchSyncPhaseTasks(projectData.id, phaseId);
      const syncedCount = res?.synced?.length || 0;
      const skippedCount = res?.skipped?.length || 0;
      const failedCount = res?.failed?.length || 0;
      if (failedCount > 0) {
        setSyncFeedback({
          message: `${syncedCount} Aufgaben synchronisiert, ${failedCount} fehlgeschlagen.`,
          type: 'error'
        });
      } else {
        setSyncFeedback({
          message: `${syncedCount} Aufgaben synchronisiert (${skippedCount} unverändert).`,
          type: 'success'
        });
      }
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      setSyncFeedback({
        message: err.message || 'Fehler beim Synchronisieren des Abschnitts.',
        type: 'error'
      });
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setSyncingPhaseId(null);
    }
  };

  // Handle Add Material / Link
  const handleMaterialSubmit = (e) => {
    e.preventDefault();
    if (!newMaterialName.trim() || !activeTargetForMaterial) return;

    const name = newMaterialName.trim();
    if (activeTargetForMaterial.type === 'phase') {
      const phaseId = activeTargetForMaterial.id;
      setProjectData((prev) => {
        const updatedPhases = prev.phases.map((phase) => {
          if (phase.id !== phaseId) return phase;
          const updatedMaterials = [
            ...(phase.materials || []),
            { id: `pm_${Date.now()}`, name, url: '#' }
          ];
          return { ...phase, materials: updatedMaterials };
        });
        return {
          ...prev,
          history: withHistory(prev, {
            text: `Neues Material hinzugefügt: '${name}'`,
            phase: 'Abschnitt-Material',
            icon: 'attach_file',
            iconStyle: 'bg-subtle border border-subtle rounded-md text-primary'
          }),
          phases: updatedPhases
        };
      });
    } else if (activeTargetForMaterial.type === 'task') {
      const { phaseId, taskId } = activeTargetForMaterial;
      setProjectData((prev) => {
        const updatedPhases = prev.phases.map((phase) => {
          if (phase.id !== phaseId) return phase;
          const updatedTasks = phase.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const updatedLinks = [
              ...(t.links || []),
              { id: `l_${Date.now()}`, name, url: '#' }
            ];
            return { ...t, links: updatedLinks };
          });
          return { ...phase, tasks: updatedTasks };
        });
        return { ...prev, phases: updatedPhases };
      });
    }

    setNewMaterialName('');
    setShowMaterialModal(false);
    setActiveTargetForMaterial(null);
  };

  const handleDeleteMaterial = (target) => {
    if (target.type === 'phase') {
      const { phaseId, materialId } = target;
      setProjectData((prev) => {
        const updatedPhases = prev.phases.map((phase) => {
          if (phase.id !== phaseId) return phase;
          const updatedMaterials = (phase.materials || []).filter(
            m => m.id !== materialId && m.noteId !== materialId && m.url !== materialId && `#note-${m.noteId}` !== materialId
          );
          return { ...phase, materials: updatedMaterials };
        });
        return { ...prev, phases: updatedPhases };
      });
    } else if (target.type === 'task') {
      const { phaseId, taskId, linkId } = target;
      setProjectData((prev) => {
        const updatedPhases = prev.phases.map((phase) => {
          if (phase.id !== phaseId) return phase;
          const updatedTasks = phase.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const updatedLinks = (t.links || []).filter(
              l => l.id !== linkId && l.noteId !== linkId && l.url !== linkId && `#note-${l.noteId}` !== linkId
            );
            return { ...t, links: updatedLinks };
          });
          return { ...phase, tasks: updatedTasks };
        });
        return { ...prev, phases: updatedPhases };
      });
    }
  };

  const handleDrawerUpdateTask = (phaseId, taskId, updatedFields) => {
    setProjectData((prev) => {
      const updatedPhases = (prev.phases || []).map((phase) => {
        if (phase.id !== phaseId) return phase;
        const updatedTasks = (phase.tasks || []).map((t) =>
          t.id === taskId ? { ...t, ...updatedFields } : t
        );
        return { ...phase, tasks: updatedTasks };
      });
      return { ...prev, phases: updatedPhases };
    });
    // Also update the selected task in the drawer so it reflects changes
    setSelectedTask(prev => {
      if (!prev || prev.task.id !== taskId) return prev;
      return { ...prev, task: { ...prev.task, ...updatedFields } };
    });
  };

  const handleDrawerUpdatePhase = (phaseId, updatedFields) => {
    setProjectData((prev) => {
      const updatedPhases = (prev.phases || []).map((phase) =>
        phase.id === phaseId ? { ...phase, ...updatedFields } : phase
      );
      return { ...prev, phases: updatedPhases };
    });
  };

  const handleDeletePhase = (phaseId) => {
    setProjectData((prev) => {
      const phaseToDelete = prev.phases.find(p => p.id === phaseId);
      const updatedPhases = prev.phases.filter(p => p.id !== phaseId);
      
      const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
      const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter((t) => t.completed).length : 0), 0);
      const completedPhasesCount = updatedPhases.filter((p) => p.completed).length;
      const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      return {
        ...prev,
        tasksTotal: totalTasks,
        tasksCompleted: completedTasks,
        phasesCompleted: completedPhasesCount,
        phasesTotal: updatedPhases.length,
        progress: progressPct,
        tasksCountText: `(${completedTasks} / ${totalTasks} Tasks)`,
        history: withHistory(prev, {
          text: `Abschnitt gelöscht: '${phaseToDelete?.title}'`,
          phase: 'Projekt-Fortschritt',
          icon: 'delete',
          iconStyle: 'bg-danger-subtle text-danger border border-danger'
        }),
        phases: updatedPhases
      };
    });
    setSelectedPhase(null);
  };

  const handleDeleteTask = (phaseId, taskId) => {
    setProjectData((prev) => {
      const updatedPhases = (prev.phases || []).map((phase) => {
        if (phase.id !== phaseId) return phase;
        const updatedTasks = (phase.tasks || []).filter((t) => t.id !== taskId);
        const completedInPhase = updatedTasks.filter((t) => t.completed).length;
        const totalInPhase = updatedTasks.length;
        const phaseCompleted = totalInPhase > 0 && completedInPhase === totalInPhase;
        return {
          ...phase,
          completed: phaseCompleted,
          badgeText: phaseCompleted ? 'ERLEDIGT' : `${completedInPhase}/${totalInPhase} ERLEDIGT`,
          tasks: updatedTasks
        };
      });
      const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
      const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter((t) => t.completed).length : 0), 0);
      const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...prev,
        tasksTotal: totalTasks,
        tasksCompleted: completedTasks,
        progress: progressPct,
        tasksCountText: `(${completedTasks} / ${totalTasks} Tasks)`,
        phases: updatedPhases
      };
    });
    setSelectedTask(null);
  };

  if (!projectData.id) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center text-secondary">
        <Icon name="folder_off" size="xl" className="mb-4 opacity-50" />
        <h2 className="text-heading mb-2">Projekt nicht gefunden</h2>
        <p className="mb-6">Das Projekt wurde möglicherweise gelöscht.</p>
        <Button onClick={() => setCurrentScreen && setCurrentScreen('projects')}>Zurück zur Übersicht</Button>
      </div>
    );
  }

  // Filter phases logic
  const filteredPhases = projectPhases.filter((phase) => {
    if (filterType === 'open') return !getPhaseStats(phase).isDone;
    if (filterType === 'completed') return getPhaseStats(phase).isDone;
    return true;
  });

  const detailDrawerOpen = !!selectedTask || !!selectedPhase || isTransitioningDrawer;
  const isBothSideBySide = detailDrawerOpen && isGlobalChatOpen && canFitSideBySide;
  const isAnyDrawerOpen = detailDrawerOpen || isGlobalChatOpen;
  const rightMarginClass = isBothSideBySide 
    ? 'lg:mr-[864px]' 
    : isAnyDrawerOpen 
      ? 'lg:mr-[420px]' 
      : '';

  const handleCloseDetailDrawer = () => {
    if (isGlobalChatOpen) {
      // 1. First slide out the Fio KI-Coach drawer (behind)
      setIsGlobalChatOpen(false);
      // 2. Snappy cascading delay (100ms): Then slide out the detail drawer (in front)
      setTimeout(() => {
        setSelectedTask(null);
        setSelectedPhase(null);
      }, 100);
    } else {
      setSelectedTask(null);
      setSelectedPhase(null);
    }
  };

  const handleSelectPhase = (phase) => {
    if (selectedPhase?.id === phase.id && !selectedTask) {
      handleCloseDetailDrawer();
    } else if (selectedTask) {
      setIsTransitioningDrawer(true);
      setSelectedTask(null);
      setTimeout(() => {
        setSelectedPhase(phase);
        setIsTransitioningDrawer(false);
      }, 190);
    } else {
      setSelectedPhase(phase);
    }
  };

  const handleSelectTask = (task, phase) => {
    if (selectedTask?.task.id === task.id) {
      handleCloseDetailDrawer();
    } else if (selectedPhase) {
      setIsTransitioningDrawer(true);
      setSelectedPhase(null);
      setTimeout(() => {
        setSelectedTask({ task, phase });
        setIsTransitioningDrawer(false);
      }, 190);
    } else {
      setSelectedTask({ task, phase });
    }
  };

  const statusOptions = [
    { id: 'GEPLANT', label: 'Geplant', icon: 'schedule' },
    { id: 'AKTIV', label: 'Aktiv', icon: 'play_circle' },
    { id: 'ABGESCHLOSSEN', label: 'Erledigt', icon: 'check_circle' },
  ];
  const filterOptions = [
    { id: 'all', label: 'Alle' },
    { id: 'open', label: 'Offen' },
    { id: 'completed', label: 'Erledigt' },
  ];

  return (
    <div ref={rootRef}>
      <div className={cx('relative mx-auto w-full space-y-4 transition-[margin] duration-slow sm:space-y-6', rightMarginClass)}>
        {syncFeedback && (
          <Alert tone={syncFeedback.type === 'error' ? 'danger' : 'success'} onDismiss={() => setSyncFeedback(null)}>
            {syncFeedback.message}
          </Alert>
        )}

        {/* Brotkrumen */}
        <nav aria-label="Pfad" className="flex flex-wrap items-center gap-1 text-caption text-secondary">
          <Button variant="ghost" size="sm" leadingIcon="arrow_back" onClick={() => setCurrentScreen && setCurrentScreen('projects')}>
            Projekte
          </Button>
          <span className="text-disabled" aria-hidden="true">/</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (setCurrentScreen) {
                setCurrentScreen('projects');
                setTimeout(() => {
                  const el = document.getElementById(`cat-sec-${categoryObj.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }
            }}
          >
            {categoryObj.name}
          </Button>
          <IconButton
            icon="folder_open"
            label="Kategorie ändern"
            size="sm"
            onClick={() => openModal('moveCategory', { type: 'project', itemId: projectData.id, currentCategoryId: projectData.categoryId })}
          />
        </nav>

        {isTrashed && (
          <Alert tone="danger" icon="delete" title="Projekt im Papierkorb">
            Dieses Projekt wurde gelöscht. Stelle es im Papierkorb wieder her, um es zu bearbeiten.
          </Alert>
        )}

        {/* Schreibgeschützt, solange das Projekt im Papierkorb liegt */}
        <div className={cx('space-y-4 sm:space-y-6', isTrashed && 'pointer-events-none opacity-60')}>
          {/* Titel mit Pause und Kanban */}
          <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div className="flex max-w-xl items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    autoFocus
                    aria-label="Projekttitel"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setEditTitle(projectData.title || '');
                        setIsEditingTitle(false);
                      }
                    }}
                    className="w-full rounded-md border border-strong bg-surface px-2 py-1 text-title focus:outline-none sm:text-title-lg"
                  />
                  <IconButton
                    icon="check"
                    label="Speichern"
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSaveTitle();
                    }}
                  />
                  <IconButton
                    icon="close"
                    label="Abbrechen"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEditTitle(projectData.title || '');
                      setIsEditingTitle(false);
                    }}
                  />
                </div>
              ) : (
                <div className="group flex flex-wrap items-center gap-2">
                  <h1
                    onClick={() => !isTrashed && setIsEditingTitle(true)}
                    className={cx('text-title text-primary sm:text-title-lg', isTrashed ? 'cursor-default' : 'cursor-pointer hover:underline hover:underline-offset-4')}
                    title={isTrashed ? '' : 'Klicken zum Umbenennen'}
                  >
                    {projectData.title}
                  </h1>
                  {!isTrashed && (
                    <IconButton icon="edit" label="Projekt umbenennen" size="sm" className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => setIsEditingTitle(true)} />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <IconButton
                icon={projectData.isPaused ? 'play_arrow' : 'pause'}
                label={projectData.isPaused ? 'Fortsetzen' : 'Pausieren'}
                variant="secondary"
                className={projectData.isPaused ? '!border-accent !bg-accent-subtle !text-accent' : ''}
                onClick={() => toggleProjectPause(projectData.id)}
              />
              <IconButton
                icon={projectData.inKanban !== false ? 'view_kanban' : 'visibility_off'}
                label={projectData.inKanban !== false ? 'Vom Kanban-Board ausblenden' : 'Auf Kanban-Board einblenden'}
                variant="secondary"
                filled={projectData.inKanban !== false}
                onClick={() => toggleProjectKanban(projectData.id)}
              />
            </div>
          </header>

          {/* Zeitspanne und Fortschritt */}
          <Card padding="md" className="space-y-4">
            <SectionHeader
              title="Zeitspanne"
              action={isEditingDates ? (
                <div className="flex items-center gap-2">
                  <Input type="date" size="sm" aria-label="Startdatum" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-36" />
                  <span className="text-caption text-secondary" aria-hidden="true">–</span>
                  <Input type="date" size="sm" aria-label="Enddatum" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-36" />
                  <IconButton icon="check" label="Datum speichern" variant="primary" size="sm" onClick={handleSaveDates} />
                  <IconButton icon="close" label="Abbrechen" variant="secondary" size="sm" onClick={() => setIsEditingDates(false)} />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-caption-strong text-primary">
                    {timeline.dateRange || 'Kein Zeitraum'}
                    {timeline.deadlineLabel && (
                      <span className={timeline.isOverdue ? 'text-danger' : 'text-secondary'}> ({timeline.deadlineLabel})</span>
                    )}
                  </span>
                  <IconButton icon="edit" label="Datum bearbeiten" size="sm" onClick={() => setIsEditingDates(true)} />
                </div>
              )}
            />
            <ProgressBar value={stats.progress} label={`Aufgaben-Fortschritt · ${stats.tasksCompleted} von ${stats.tasksTotal}`} showValue />
            {timeline.timeElapsed !== null ? (
              <ProgressBar
                value={timeline.timeElapsed}
                tone={timeline.isOverdue ? 'danger' : 'accent'}
                label={`Verstrichene Zeit · ${timeline.dayLabel || ''}`}
                showValue
              />
            ) : (
              <p className="text-caption text-secondary">Lege Start- und Enddatum fest, um die verstrichene Zeit zu sehen.</p>
            )}
          </Card>

          {/* Status und Verlauf */}
          <Card padding="md" className="space-y-4">
            <SectionHeader title="Status und Verlauf" />
            <div className="flex flex-wrap items-center gap-2">
              {statusOptions.map((s) => (
                <Chip
                  key={s.id}
                  selected={normalizeProjectStatus(projectData.status) === s.id}
                  leadingIcon={s.icon}
                  onClick={() => handleStatusSet(s.id)}
                >
                  {s.label}
                </Chip>
              ))}
              <Button variant="secondary" size="sm" leadingIcon="history" className="sm:ml-auto" onClick={() => setShowHistoryModal(true)}>
                Verlauf
              </Button>
            </div>
          </Card>

          {/* Tempo und empfohlene Schritte */}
          <Card padding="md" className="space-y-4">
            <SectionHeader
              title="Tempo und Ziel"
              action={projectData.warning ? <Badge tone="warning">{projectData.warning}</Badge> : null}
            />
            <div className="grid grid-cols-2 gap-3 rounded-md border border-subtle bg-subtle p-3">
              <Stat icon="auto_stories" label="Abschnitte" value={`${stats.phasesCompleted}/${stats.phasesTotal}`} area="projects" />
              <Stat icon="check_box" label="Aufgaben" value={`${stats.tasksCompleted}/${stats.tasksTotal}`} area="projects" />
            </div>

            {projectData.recommendedSteps && projectData.recommendedSteps.length > 0 && (
              <div className="space-y-2">
                <SectionHeader title="Empfohlene Schritte für heute" />
                <ListGroup>
                  {projectData.recommendedSteps.map((step) => (
                    <ListItem
                      key={step.id}
                      leading={<Badge tone="accent" size="sm">{step.num}</Badge>}
                      title={step.title}
                      description={step.date}
                      trailing={<Icon name="arrow_forward" size="sm" className="text-secondary" />}
                    />
                  ))}
                </ListGroup>
              </div>
            )}
          </Card>

          <NotesSection
            notes={projectData.notes || []}
            phases={projectData.phases || []}
            activeNote={activeNoteModal}
            onCloseActiveNote={() => setActiveNoteModal(null)}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onConvertNoteToPhase={handleConvertNoteToPhase}
            onConvertNoteToTask={handleConvertNoteToTask}
            onLinkNote={handleLinkNote}
          />

          {/* Abschnitte und Filter */}
          <div className="flex flex-col justify-between gap-3 border-b border-subtle pb-3 pt-2 sm:flex-row sm:items-center">
            <SectionHeader title="Abschnitte" count={projectPhases.length} />
            <div className="no-wrap-scroll -my-1.5 flex items-center gap-2 py-1.5">
              {filterOptions.map((f) => (
                <Chip key={f.id} selected={filterType === f.id} onClick={() => setFilterType(f.id)}>{f.label}</Chip>
              ))}
              <Button variant="ghost" size="sm" leadingIcon={isAllCollapsed ? 'unfold_more' : 'unfold_less'} onClick={toggleAllPhases}>
                {isAllCollapsed ? 'Alle ausklappen' : 'Alle einklappen'}
              </Button>
            </div>
          </div>

          {/* Abschnitte */}
          <div className="space-y-4">
            {filteredPhases.map((phase) => {
              const isCollapsed = collapsedPhases[phase.id];
              const phaseStats = getPhaseStats(phase);

              return (
                <Card key={phase.id} padding="md" className="phase-card space-y-3">
                  <div className="flex select-none items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <IconButton
                        icon={isCollapsed ? 'chevron_right' : 'expand_more'}
                        label={isCollapsed ? 'Abschnitt ausklappen' : 'Abschnitt einklappen'}
                        size="sm"
                        onClick={() => togglePhaseCollapse(phase.id)}
                      />
                      <div
                        className="section-header group min-w-0 cursor-pointer"
                        data-drawer-trigger="true"
                        onClick={() => handleSelectPhase(phase)}
                      >
                        {phase.dateInfo && (
                          <Badge tone="neutral" size="sm" icon="calendar_today">{formatDate(phase.dateInfo)}</Badge>
                        )}
                        <h3 className="mt-0.5 truncate text-subheading text-primary group-hover:underline sm:text-heading">
                          {phase.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={phaseStats.isDone ? 'success' : 'neutral'} className="hidden sm:inline-flex">{phaseStats.label}</Badge>
                      <IconButton
                        icon={syncingPhaseId === phase.id ? 'sync' : 'calendar_month'}
                        label={
                          user?.isGuest
                            ? 'Im Gastmodus nicht verfügbar'
                            : !isCalendarConnected
                            ? 'Google Kalender ist nicht verbunden'
                            : 'Alle Aufgaben dieses Abschnitts mit Fälligkeitsdatum mit Google Kalender synchronisieren'
                        }
                        size="sm"
                        disabled={user?.isGuest || !isCalendarConnected || syncingPhaseId === phase.id}
                        className={syncingPhaseId === phase.id ? '[&_.material-symbols-outlined]:animate-spin' : ''}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBatchSyncPhase(phase.id);
                        }}
                      />
                      <IconButton icon="edit" label="Abschnitt bearbeiten" size="sm" onClick={() => handleSelectPhase(phase)} />
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-1 border-t border-subtle pt-3">
                      {(phase.tasks || []).map((task) => (
                        <div
                          key={task.id}
                          id={`task-${task.id}`}
                          data-drawer-trigger="true"
                          className={cx(
                            'task-item group flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors duration-fast',
                            selectedTask?.task.id === task.id ? 'border-default bg-hover' : 'border-transparent hover:bg-hover',
                          )}
                          onClick={() => handleSelectTask(task, phase)}
                        >
                          <span onClick={(e) => e.stopPropagation()} className="flex">
                            <Checkbox
                              aria-label={`${task.title} abhaken`}
                              checked={task.completed}
                              onChange={() => toggleTaskCompletion(phase.id, task.id)}
                            />
                          </span>
                          <span className={cx('flex-1 truncate text-label', task.completed ? 'text-secondary line-through' : 'text-primary')}>
                            {task.title}
                          </span>
                          {task.isCalendarSynced && (
                            <Icon name="calendar_month" size="sm" className="shrink-0 text-success" title="Mit Google Kalender synchronisiert" />
                          )}
                          {task.date && task.date !== 'Geplant: Demnächst' && (
                            <Badge tone="neutral" size="sm" icon="event" className="hidden sm:inline-flex">{formatTaskDate(task.date)}</Badge>
                          )}
                          {((task.note) || (task.links && task.links.length > 0)) && (
                            <Icon name="attachment" size="sm" className="shrink-0 text-tertiary" />
                          )}
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon="add"
                        className="mt-1"
                        onClick={() => {
                          setActivePhaseIdForTask(phase.id);
                          setShowTaskModal(true);
                        }}
                      >
                        Aufgabe hinzufügen
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <Button variant="secondary" size="lg" fullWidth leadingIcon="add" className="border-dashed" onClick={() => setShowPhaseModal(true)}>
            Neuer Abschnitt
          </Button>
        </div>
      </div>

      {/* Verlauf */}
      <Sheet
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Verlauf"
        description={projectData.title}
        footer={<Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Schließen</Button>}
      >
        {projectData.history && projectData.history.length > 0 ? (
          <ol className="space-y-4">
            {projectData.history.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                {/* Einträge aus dem DataContext heißen date/title/category/badgeBg, eigene timestamp/text/phase/iconStyle */}
                <span
                  className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', HISTORY_MARK_CLASS[historyTone(item)])}
                  aria-hidden="true"
                >
                  <Icon name={item.icon || 'history'} size="sm" />
                </span>
                <div className="min-w-0">
                  <span className="block text-caption text-tertiary">{item.timestamp || item.date}</span>
                  <p className="text-body-strong text-primary">{item.text || item.title}</p>
                  <span className="text-caption text-secondary">{item.phase || item.category}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-secondary">Keine bisherigen Aktivitäten vorhanden.</p>
        )}
      </Sheet>

      {/* Neuer Abschnitt */}
      <Sheet
        open={showPhaseModal}
        onClose={() => setShowPhaseModal(false)}
        title="Neuer Abschnitt"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowPhaseModal(false)}>Abbrechen</Button>
            <Button type="submit" form="pd-phase-form">Abschnitt hinzufügen</Button>
          </>
        )}
      >
        <form id="pd-phase-form" onSubmit={handlePhaseSubmit} className="space-y-4">
          <Field label="Titel">
            <Input
              data-autofocus
              required
              value={newPhaseTitle}
              onChange={(e) => setNewPhaseTitle(e.target.value)}
              placeholder="z. B. Marketing, Design, Recherche"
            />
          </Field>
          <Field label="Ziel" optional>
            <Textarea
              rows={3}
              value={newPhaseDesc}
              onChange={(e) => setNewPhaseDesc(e.target.value)}
              placeholder="Was soll in diesem Abschnitt erreicht werden?"
            />
          </Field>
        </form>
      </Sheet>

      {/* Neue Aufgabe */}
      <Sheet
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Aufgabe hinzufügen"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowTaskModal(false)}>Abbrechen</Button>
            <Button type="submit" form="pd-task-form">Aufgabe hinzufügen</Button>
          </>
        )}
      >
        <form id="pd-task-form" onSubmit={handleTaskSubmit} className="space-y-4">
          <Field label="Titel">
            <Input
              data-autofocus
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="z. B. Stakeholder-Interviews führen"
            />
          </Field>
          {/* Echtes Datum (YYYY-MM-DD): nur so erscheint die Aufgabe auf Home und lässt sich mit dem Kalender abgleichen */}
          <Field label="Fällig am" optional>
            <Input id="new-task-date" type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} />
          </Field>
          <Field label="Notiz" optional>
            <Textarea
              rows={3}
              value={newTaskNote}
              onChange={(e) => setNewTaskNote(e.target.value)}
              placeholder="Wichtige Hinweise zur Durchführung"
            />
          </Field>
        </form>
      </Sheet>

      {/* Material oder Link anhängen */}
      <Sheet
        open={showMaterialModal}
        onClose={() => setShowMaterialModal(false)}
        title="Material anhängen"
        description="Dateien, Dokumente oder Web-Links zum Projekt hinzufügen."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowMaterialModal(false)}>Abbrechen</Button>
            <Button type="submit" form="pd-material-form" leadingIcon="add_link">Anhängen</Button>
          </>
        )}
      >
        <form id="pd-material-form" onSubmit={handleMaterialSubmit} className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer space-y-3 rounded-lg border-2 border-dashed border-default bg-subtle p-6 text-center transition-colors duration-fast hover:border-strong hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => localFileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                localFileInputRef.current?.click();
              }
            }}
          >
            <input
              type="file"
              ref={localFileInputRef}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setNewMaterialName(e.target.files[0].name);
                }
              }}
            />
            <IconTile area="accent" icon="cloud_upload" size="lg" className="mx-auto" />
            <div>
              <p className="text-body-strong text-primary">Datei auswählen oder hierher ziehen</p>
              <p className="mt-1 text-caption text-secondary">Dokumente, Bilder, PDFs und Markdown (max. 25 MB)</p>
            </div>
            <p className="inline-flex flex-wrap items-center justify-center gap-1.5 text-caption text-secondary">
              Tipp: <Kbd>Strg</Kbd> + <Kbd>V</Kbd> fügt ein Bild ein.
            </p>
          </div>
          <Field label="Web-Link oder Dokumentname">
            <Input
              required
              value={newMaterialName}
              onChange={(e) => setNewMaterialName(e.target.value)}
              placeholder="z. B. Briefing.pdf oder https://…"
            />
          </Field>
        </form>
      </Sheet>

      {/* Detail Drawers */}
      <TaskDetailDrawer
        projectData={projectData}
        task={selectedTask?.task}
        phase={selectedTask?.phase}
        allNotes={projectData.notes || []}
        isOpen={!!selectedTask}
        isGlobalChatOpen={isGlobalChatOpen}
        isChatReplacing={detailDrawerOpen && !canFitSideBySide && isGlobalChatOpen}
        onClose={handleCloseDetailDrawer}
        onOpenGlobalChat={() => setIsGlobalChatOpen(true)}
        onUpdateTask={handleDrawerUpdateTask}
        onDeleteTask={handleDeleteTask}
        onToggleTask={toggleTaskCompletion}
        onAddMaterial={(target) => {
          setActiveTargetForMaterial(target);
          setShowMaterialModal(true);
        }}
        onDeleteMaterial={handleDeleteMaterial}
        onOpenNote={(note) => setActiveNoteModal(note)}
      />

      <SectionDetailDrawer
        projectData={projectData}
        phase={selectedPhase}
        allNotes={projectData.notes || []}
        isOpen={!!selectedPhase}
        isGlobalChatOpen={isGlobalChatOpen}
        isChatReplacing={detailDrawerOpen && !canFitSideBySide && isGlobalChatOpen}
        onClose={handleCloseDetailDrawer}
        onOpenGlobalChat={() => setIsGlobalChatOpen(true)}
        onUpdatePhase={handleDrawerUpdatePhase}
        onDeletePhase={handleDeletePhase}
        onAddMaterial={(target) => {
          setActiveTargetForMaterial(target);
          setShowMaterialModal(true);
        }}
        onDeleteMaterial={handleDeleteMaterial}
        onOpenNote={(note) => setActiveNoteModal(note)}
      />

      {/* Global AI Chat Drawer */}
      <GlobalChatDrawer
        isOpen={isGlobalChatOpen}
        onClose={() => setIsGlobalChatOpen(false)}
        projectData={projectData}
        isSecondaryPanel={detailDrawerOpen && canFitSideBySide}
        isReplacingDetail={detailDrawerOpen && !canFitSideBySide}
        contextScope={selectedTask ? 'task' : selectedPhase ? 'section' : 'project'}
        contextData={selectedTask ? selectedTask : selectedPhase ? selectedPhase : null}
      />

      {/* Fio-Schnellzugriff (schwebender Knopf) */}
      {!isGlobalChatOpen && (
        <button
          type="button"
          onClick={() => setIsGlobalChatOpen(true)}
          title="Fio öffnen"
          aria-label="Fio öffnen"
          style={{ '--fab-offset': detailDrawerOpen ? '444px' : '24px' }}
          className={cx(
            'group fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-dropdown sm:bottom-6 sm:right-auto sm:[right:var(--fab-offset)]',
            'h-12 w-12 items-center justify-center rounded-lg bg-inverse text-inverse shadow-lg transition-[right,transform] duration-slow ease-standard hover:scale-105 active:scale-95 motion-reduce:transform-none',
            FOCUS,
            detailDrawerOpen ? 'hidden sm:flex' : 'flex',
          )}
        >
          <FioMark size={20} />
        </button>
      )}
    </div>
  );
};

export default ProjectDetail;
