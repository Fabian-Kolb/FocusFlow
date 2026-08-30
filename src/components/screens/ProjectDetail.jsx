import React, { useState, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import NotesSection from '../ui/NotesSection';
import TaskDetailDrawer from '../ui/TaskDetailDrawer';
import SectionDetailDrawer from '../ui/SectionDetailDrawer';
import GlobalChatDrawer from '../ui/GlobalChatDrawer';
import FioIcon from '../ui/FioIcon';

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
    projectCategories
  } = useModalContext();
  const selectedProject = contextProjects.find(p => p.id === selectedProjectId) || (trashItems && trashItems.find(p => p.id === selectedProjectId)) || contextProjects[0];
  
  const projectData = selectedProject || {};
  const isTrashed = !!projectData.deletedAt;

  const categoryObj = (projectCategories || []).find(c => c.id === (projectData.categoryId || 'allgemein')) || { id: 'allgemein', name: 'Allgemein' };

  const setProjectData = (mutateFn) => {
    if (typeof mutateFn === 'function') {
      mutateProject(selectedProjectId, mutateFn);
    } else {
      mutateProject(selectedProjectId, () => mutateFn);
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
  
  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [activePhaseIdForTask, setActivePhaseIdForTask] = useState(null);
  const [activeTargetForMaterial, setActiveTargetForMaterial] = useState(null); // { type: 'phase'|'task', id: string }

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

  // Removed unneeded inline edit functions

  const handleSaveDates = () => {
    const startStr = editStartDate ? new Date(editStartDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '01.08.24';
    const endStr = editEndDate ? new Date(editEndDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '31.12.24';
    
    let timeElapsed = 0;
    if (editStartDate && editEndDate) {
      const start = new Date(editStartDate).getTime();
      const end = new Date(editEndDate).getTime();
      const now = Date.now();
      if (now >= end) timeElapsed = 100;
      else if (now <= start) timeElapsed = 0;
      else timeElapsed = Math.round(((now - start) / (end - start)) * 100);
    }
    
    setProjectData(prev => ({
      ...prev,
      startDate: editStartDate,
      endDate: editEndDate,
      dateRange: `${startStr} – ${endStr}`,
      timeElapsed
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
        history: [
          {
            id: `h_${Date.now()}`,
            timestamp: 'HEUTE • gerade eben',
            text: `Neuer Abschnitt aus Notiz erstellt: '${newPhase.title}'`,
            phase: 'Projekt-Fortschritt',
            icon: 'note_add',
            iconStyle: 'bg-primary/10 text-primary border border-primary/20'
          },
          ...(prev.history || [])
        ]
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
          date: 'Geplant: Demnächst',
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
        history: [
          {
            id: `h_${Date.now()}`,
            timestamp: 'HEUTE • gerade eben',
            text: `Neue Aufgabe aus Notiz erstellt: '${note.title}'`,
            phase: 'Projekt-Fortschritt',
            icon: 'add_task',
            iconStyle: 'bg-primary/10 text-primary border border-primary/20'
          },
          ...(prev.history || [])
        ]
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
        history: [
          {
            id: `h_${Date.now()}`,
            timestamp: 'HEUTE • gerade eben',
            text: `Notiz '${note.title}' verknüpft`,
            phase: 'Wissensmanagement',
            icon: 'link',
            iconStyle: 'bg-surface-low text-primary border border-outline-variant'
          },
          ...(prev.history || [])
        ]
      };
    });
  };

  const getStatusButtonClass = (status, isActive) => {
    if (!isActive) {
      return "bg-surface-low text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary opacity-60 hover:opacity-100";
    }
    if (status === 'GEPLANT') return "bg-amber-100 text-amber-900 border-amber-400 ring-1 ring-amber-400 opacity-100";
    if (status === 'AKTIV') return "bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-400 opacity-100";
    if (status === 'PAUSIERT') return "bg-blue-100 text-blue-900 border-blue-400 ring-1 ring-blue-400 opacity-100";
    if (status === 'ABGESCHLOSSEN') return "bg-neutral-200 text-neutral-800 border-neutral-400 ring-1 ring-neutral-400 opacity-100";
    return "";
  };

  const getStatusDotClass = (status) => {
    if (status === 'GEPLANT') return "bg-amber-600";
    if (status === 'AKTIV') return "bg-emerald-600 animate-pulse";
    if (status === 'PAUSIERT') return "bg-blue-600";
    if (status === 'ABGESCHLOSSEN') return "bg-neutral-600";
  };

  // Collapse / Expand All Phases
  const isAllCollapsed = projectData.phases.length > 0 && 
    projectData.phases.every((p) => collapsedPhases[p.id]);

  const toggleAllPhases = () => {
    if (isAllCollapsed) {
      setCollapsedPhases({});
    } else {
      const newCollapsed = {};
      projectData.phases.forEach((p) => {
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

        const updatedTasks = (phase.tasks || []).map((task) => {
          if (task.id !== taskId) return task;
          const nextCompleted = !task.completed;
          return { ...task, completed: nextCompleted };
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

      // Add to history
      const newHistoryItem = {
        id: `h_${Date.now()}`,
        timestamp: 'HEUTE • gerade eben',
        text: `Task Status geändert`,
        phase: `Phase ID: ${phaseId}`,
        icon: 'check',
        iconStyle: 'bg-emerald-100 border border-emerald-300 text-emerald-800'
      };

      return {
        ...prev,
        status: newStatus,
        tasksCompleted: updatedCompletedCount,
        tasksTotal: totalTasks,
        phasesCompleted: completedPhasesCount,
        phasesTotal: updatedPhases.length,
        progress: progressPct,
        tasksCountText: `(${updatedCompletedCount} / ${totalTasks} Tasks)`,
        history: [newHistoryItem, ...(prev.history || [])],
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
      badgeText: '0/0 ERLEDIGT',
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
        history: [
          {
            id: `h_${Date.now()}`,
            timestamp: 'HEUTE • gerade eben',
            text: `Neuer Abschnitt angelegt: '${newPhaseTitle.trim()}'`,
            phase: 'Projekt-Fortschritt',
            icon: 'flag',
            iconStyle: 'bg-surface-low border border-outline-variant rounded-lg text-primary'
          },
          ...(prev.history || [])
        ],
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
      date: newTaskDate.trim() || 'Geplant: Demnächst',
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
          history: [
            {
              id: `h_${Date.now()}`,
              timestamp: 'HEUTE • gerade eben',
              text: `Neues Material hinzugefügt: '${name}'`,
              phase: `Abschnitt Material`,
              icon: 'attach_file',
              iconStyle: 'bg-surface-low border border-outline-variant rounded-lg text-primary'
            },
            ...(prev.history || [])
          ],
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
        history: [
          {
            id: `h_${Date.now()}`,
            timestamp: 'HEUTE • gerade eben',
            text: `Abschnitt gelöscht: '${phaseToDelete?.title}'`,
            phase: 'Projekt-Fortschritt',
            icon: 'delete',
            iconStyle: 'bg-red-50 text-red-600 border border-red-200'
          },
          ...(prev.history || [])
        ],
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
      <div className="flex flex-col items-center justify-center h-full p-12 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">folder_off</span>
        <h2 className="text-xl font-bold mb-2">Projekt nicht gefunden</h2>
        <p className="mb-6">Das Projekt wurde möglicherweise gelöscht.</p>
        <button onClick={() => setCurrentScreen && setCurrentScreen('projects')} className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold">Zurück zur Übersicht</button>
      </div>
    );
  }

  // Filter phases logic
  const filteredPhases = (projectData.phases || []).filter((phase) => {
    if (filterType === 'open') return !phase.completed;
    if (filterType === 'completed') return phase.completed;
    return true;
  });

  const [isTransitioningDrawer, setIsTransitioningDrawer] = useState(false);
  const detailDrawerOpen = !!selectedTask || !!selectedPhase || isTransitioningDrawer;
  const rightMarginClass = (detailDrawerOpen && isGlobalChatOpen) ? 'lg:mr-[840px]' : (detailDrawerOpen || isGlobalChatOpen) ? 'lg:mr-[420px]' : '';

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

  return (
    <div className="screen-transition">
      {projectData.isPaused && (
        <div className="fixed top-0 left-0 right-0 h-64 sm:h-80 bg-gradient-to-b from-blue-200/70 via-blue-100/25 to-transparent pointer-events-none z-0" />
      )}
      <div className={`w-full mx-auto space-y-4 sm:space-y-6 relative z-10 transition-all duration-300 ${rightMarginClass}`}>
        <div>
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1.5 text-xs font-mono text-on-surface-variant mb-4 flex-wrap bg-surface-low/60 p-2.5 rounded-xl border border-outline-variant/60">
            <button
              onClick={() => setCurrentScreen && setCurrentScreen('projects')}
              className="hover:text-primary transition-colors flex items-center gap-1 font-bold text-on-surface-variant hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Übersicht
            </button>
            <span className="text-outline-variant font-bold">/</span>
            <div className="inline-flex items-center gap-1">
              <button
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
                className="hover:text-primary transition-colors text-on-surface-variant hover:underline font-medium cursor-pointer"
              >
                {categoryObj.name}
              </button>
              <button
                onClick={() => openModal('moveCategory', { type: 'project', itemId: projectData.id, currentCategoryId: projectData.categoryId })}
                className="p-1 hover:bg-surface-low text-on-surface-variant hover:text-primary rounded-lg transition-colors cursor-pointer flex items-center"
                title="Kategorie ändern"
              >
                <span className="material-symbols-outlined text-[15px]">folder_open</span>
              </button>
            </div>
            <span className="text-outline-variant font-bold">/</span>
            <span className="font-bold text-primary truncate max-w-[200px] sm:max-w-xs">
              {projectData.title}
            </span>
          </nav>

          {isTrashed && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 mt-0.5">delete</span>
              <div>
                <p className="font-bold text-sm">Projekt im Papierkorb</p>
                <p className="text-xs mt-1">Dieses Projekt wurde gelöscht. Um es wieder richtig zu bearbeiten, stelle es im Papierkorb wieder her.</p>
              </div>
            </div>
          )}

          {/* Read-Only Wrapper for Trashed Items */}
          <div className={isTrashed ? 'pointer-events-none opacity-60 grayscale-[0.2]' : ''}>

          {/* Header Title with Interactive Status Toggle & History Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{projectData.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all shadow-sm cursor-pointer ${
                  projectData.isPaused
                    ? 'bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200'
                    : 'bg-white border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary'
                }`}
                onClick={() => toggleProjectPause(projectData.id)}
                title={projectData.isPaused ? 'Fortsetzen' : 'Pausieren'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {projectData.isPaused ? 'play_arrow' : 'pause'}
                </span>
              </button>
              
              {/* Kanban Toggle Button */}
              <button
                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all shadow-sm cursor-pointer ${
                  projectData.inKanban !== false
                    ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20'
                    : 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200'
                }`}
                onClick={() => toggleProjectKanban(projectData.id)}
                title={projectData.inKanban !== false ? 'Vom Kanban-Board ausblenden' : 'Auf Kanban-Board einblenden'}
              >
                <div className="relative inline-flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                  {projectData.inKanban === false && (
                    <span className="absolute text-slate-600 font-bold text-xs select-none pointer-events-none transform rotate-45">
                      —
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* BOX 1: Zeitspanne & Doppelbalken */}
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-3 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase whitespace-nowrap">
                ZEITSPANNE & BALKEN-SYSTEM
              </span>
              <div className="flex items-center gap-2">
                {isEditingDates ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      className="text-[10px] sm:text-[11px] border border-outline-variant rounded px-1 py-0.5 outline-none focus:border-primary" 
                      value={editStartDate} 
                      onChange={(e) => setEditStartDate(e.target.value)} 
                    />
                    <span className="text-[10px] text-on-surface-variant">-</span>
                    <input 
                      type="date" 
                      className="text-[10px] sm:text-[11px] border border-outline-variant rounded px-1 py-0.5 outline-none focus:border-primary" 
                      value={editEndDate} 
                      onChange={(e) => setEditEndDate(e.target.value)} 
                    />
                    <button onClick={handleSaveDates} className="text-primary hover:bg-surface-low rounded p-0.5 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                    <button onClick={() => setIsEditingDates(false)} className="text-red-500 hover:bg-red-50 rounded p-0.5 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="no-wrap-scroll text-[11px] sm:text-xs mono font-bold text-primary">
                      <span>{projectData.dateRange} ({projectData.daysRemaining})</span>
                    </div>
                    <button onClick={() => setIsEditingDates(true)} className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-0.5" title="Datum bearbeiten">
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] sm:text-xs mono font-bold mb-1 flex-wrap gap-1">
                  <span>AUFGABEN-FORTSCHRITT: {projectData.progress}%</span>
                  <span className="text-on-surface-variant font-normal">{projectData.tasksCountText}</span>
                </div>
                <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${projectData.progress}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] sm:text-[11px] mono text-on-surface-variant mb-1 flex-wrap gap-1">
                  <span>VERSTRICHENE ZEIT: {projectData.timeElapsed}%</span>
                  <span>{projectData.daysCountText}</span>
                </div>
                <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${projectData.timeElapsed}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 1.5: STATUS & VERLAUF */}
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-4 shadow-sm mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase">
                STATUS & VERLAUF
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              {/* Segmented Control for Status */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full h-full">
                {['GEPLANT', 'AKTIV', 'ABGESCHLOSSEN'].map((s) => {
                  const isActive = projectData.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusSet(s)}
                      className={`flex-1 h-full inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 border rounded-xl font-mono text-[10px] sm:text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap ${getStatusButtonClass(s, isActive)}`}
                    >
                      <span>{s === 'ABGESCHLOSSEN' ? 'ERLEDIGT' : s}</span>
                    </button>
                  );
                })}
              </div>

              <button
                className="w-full h-full inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-outline-variant rounded-xl hover:border-primary text-primary font-mono text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                onClick={() => setShowHistoryModal(true)}
                title="Projekt-Historie & erledigte Tasks anzeigen"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span>HISTORIE</span>
              </button>
            </div>
          </div>

          {/* BOX 2: TEMPO-STATUS & TAGES-EMPFOHLENES ZIEL */}
          <div className="p-3.5 sm:p-5 bg-white border border-outline-variant rounded-xl space-y-4 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-2.5">
              <span className="text-xs font-mono font-bold text-primary uppercase">
                TEMPO-STATUS & ZIEL
              </span>
              {projectData.warning && (
                <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 self-start sm:self-auto whitespace-nowrap">
                  {projectData.warning}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 p-2.5 sm:p-3 bg-surface-low border border-outline-variant rounded-lg text-[11px] sm:text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-primary flex-shrink-0">
                  auto_stories
                </span>
                <div className="min-w-0">
                  <span className="text-on-surface-variant text-[9px] sm:text-[10px] uppercase block truncate">ABSCHNITTE</span>
                  <span className="font-bold text-primary truncate block">
                    {projectData.phasesCompleted} / {projectData.phasesTotal} Erledigt
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-l border-outline-variant pl-2 sm:pl-3">
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-primary flex-shrink-0">
                  check_box
                </span>
                <div className="min-w-0">
                  <span className="text-on-surface-variant text-[9px] sm:text-[10px] uppercase block truncate">AUFGABEN</span>
                  <span className="font-bold text-primary truncate block">
                    {projectData.tasksCompleted} / {projectData.tasksTotal} Tasks
                  </span>
                </div>
              </div>
            </div>

            {projectData.recommendedSteps && projectData.recommendedSteps.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-primary uppercase truncate">
                    EMPFOHLENE SCHRITTE FÜR HEUTE:
                  </span>
                  <span className="text-[9px] sm:text-[10px] mono text-on-surface-variant whitespace-nowrap">
                    FOKUSSIEREN
                  </span>
                </div>

                <div className="space-y-2">
                  {projectData.recommendedSteps.map((step) => (
                    <div
                      key={step.id}
                      className="p-3 bg-surface-low border border-outline-variant rounded-lg hover:border-primary transition-all cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 h-5 bg-primary text-white text-[10px] font-mono flex items-center justify-center font-bold flex-shrink-0">
                          {step.num}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-primary group-hover:underline block truncate">
                            {step.title}
                          </span>
                          <span className="text-[10px] font-mono text-on-surface-variant block truncate">
                            {step.date}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant group-hover:text-primary flex-shrink-0">
                        arrow_forward
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

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

        {/* BEREICHS-HEADER: PROJEKT-PHASEN & PHASEN-FILTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-primary pb-3 pt-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">layers</span>
            <h2 className="text-sm font-mono font-bold text-primary uppercase tracking-wider">
              ABSCHNITTE
            </h2>
          </div>

          <div className="no-wrap-scroll flex items-center gap-2 font-mono text-xs pb-1">
            <div className="flex items-center border border-outline-variant rounded-lg bg-white p-0.5 flex-shrink-0 overflow-hidden">
              <button
                className={`px-2.5 py-1 font-bold transition-all shadow-sm rounded-md ${
                  filterType === 'all' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => setFilterType('all')}
              >
                ALLE
              </button>
              <button
                className={`px-2.5 py-1 transition-all font-medium rounded-md ${
                  filterType === 'open' ? 'bg-primary text-white font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => setFilterType('open')}
              >
                OFFEN
              </button>
              <button
                className={`px-2.5 py-1 transition-all font-medium rounded-md ${
                  filterType === 'completed' ? 'bg-primary text-white font-bold' : 'text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => setFilterType('completed')}
              >
                ERLEDIGT
              </button>
            </div>

            <button
              className="px-2.5 py-1 bg-surface-low border border-outline-variant rounded-lg hover:border-primary text-primary font-bold flex items-center gap-1 transition-all whitespace-nowrap flex-shrink-0 cursor-pointer"
              onClick={toggleAllPhases}
            >
              <span className="material-symbols-outlined text-[14px]">unfold_less</span>
              <span>{isAllCollapsed ? 'ALLE AUSKLAPPEN' : 'ALLE EINKLAPPEN'}</span>
            </button>
          </div>
        </div>

        {/* Phasen Container */}
        <div className="space-y-6">
          {filteredPhases.map((phase) => {
            const isCollapsed = collapsedPhases[phase.id];

            return (
              <div
                key={phase.id}
                className="border border-outline-variant bg-white rounded-xl p-3.5 sm:p-6 space-y-4 transition-all phase-card"
              >
                {/* Collapsible Header */}
                <div className="flex items-center justify-between gap-2 border-b border-outline-variant pb-3 select-none">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => togglePhaseCollapse(phase.id)}
                      className="p-1 rounded-lg hover:bg-surface-low text-primary transition-colors flex-shrink-0 cursor-pointer"
                      title={isCollapsed ? 'Abschnitt ausklappen' : 'Abschnitt einklappen'}
                    >
                      <span className="material-symbols-outlined text-[20px] transition-transform duration-200">
                        {isCollapsed ? 'chevron_right' : 'expand_more'}
                      </span>
                    </button>
                    
                    <div 
                      className="min-w-0 cursor-pointer group section-header"
                      data-drawer-trigger="true"
                      onClick={() => handleSelectPhase(phase)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {phase.dateInfo && (
                          <span className="text-[10px] font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                            <span>{formatDate(phase.dateInfo)}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold group-hover:underline truncate mt-0.5">
                        {phase.title}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-on-surface-variant bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant">
                      {phase.badgeText || '0/0 ERLEDIGT'}
                    </span>
                    <button
                      onClick={() => handleSelectPhase(phase)}
                      className="p-1 rounded-lg hover:bg-surface-low text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      title="Abschnitt bearbeiten"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                </div>

                {/* Phase Body */}
                {!isCollapsed && (
                  <div className="space-y-4 pt-1">
                    {/* Task List - Slim */}
                    <div className="space-y-1">
                      {(phase.tasks || []).map((task) => (
                        <div
                          key={task.id}
                          id={`task-${task.id}`}
                          data-drawer-trigger="true"
                          className={`task-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
                            selectedTask?.task.id === task.id
                              ? 'bg-primary/5 border border-primary/20'
                              : 'hover:bg-surface-low border border-transparent'
                          }`}
                          onClick={() => handleSelectTask(task, phase)}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleTaskCompletion(phase.id, task.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-primary rounded-none border-outline-variant focus:ring-0 flex-shrink-0 cursor-pointer"
                          />
                          <span
                            className={`flex-1 text-sm font-medium truncate ${
                              task.completed ? 'line-through text-on-surface-variant' : 'text-primary'
                            }`}
                          >
                            {task.title}
                          </span>
                          {task.date && task.date !== 'Geplant: Demnächst' && (
                            <span className="text-[10px] font-mono text-on-surface-variant bg-surface-low px-2 py-0.5 rounded-lg border border-outline-variant flex-shrink-0 hidden sm:inline">
                              📅 {task.date}
                            </span>
                          )}
                          {((task.note) || (task.links && task.links.length > 0)) && (
                            <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 flex-shrink-0">attachment</span>
                          )}
                        </div>
                      ))}

                      {/* Add Task Button */}
                      <button
                        className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-low transition-all cursor-pointer group"
                        onClick={() => {
                          setActivePhaseIdForTask(phase.id);
                          setShowTaskModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px] group-hover:text-primary">add</span>
                        <span className="text-xs font-mono font-bold uppercase">+ Aufgabe hinzufügen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add New Phase Action Box */}
        <div
          className="p-4 border-2 border-dashed border-outline-variant rounded-xl hover:border-primary bg-white hover:bg-surface-low cursor-pointer transition-all flex items-center justify-between group shadow-sm mt-6"
          onClick={() => setShowPhaseModal(true)}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border border-dashed border-primary flex items-center justify-center font-mono text-xs font-bold text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              +
            </div>
            <span className="text-xs font-mono font-bold text-primary group-hover:underline uppercase">
              + NEUER ABSCHNITT
            </span>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 bg-surface-low border border-outline-variant rounded-lg text-primary font-bold">
            ORGANISIEREN
          </span>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. PROJECT HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary w-full max-w-xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[20px] text-primary flex-shrink-0">history</span>
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">
                  HISTORIE: {projectData.title}
                </h2>
              </div>
              <button
                className="p-1 hover:bg-surface-low border border-outline-variant rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                onClick={() => setShowHistoryModal(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 sm:pr-2">
              {projectData.history && projectData.history.length > 0 ? (
                projectData.history.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.iconStyle}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-primary block">
                        {item.timestamp}
                      </span>
                      <p className="text-xs sm:text-sm font-medium">{item.text}</p>
                      <span className="text-[10px] font-mono text-on-surface-variant">{item.phase}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs font-mono text-on-surface-variant">Keine bisherigen Aktivitäten vorhanden.</p>
              )}
            </div>

            <div className="border-t border-outline-variant pt-3 flex justify-end">
              <button
                className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors cursor-pointer"
                onClick={() => setShowHistoryModal(false)}
              >
                SCHLIESSEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ADD PHASE MODAL */}
      {showPhaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[22px] text-primary">layers</span>
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">NEUER ABSCHNITT</h2>
              </div>
              <button
                className="p-1 hover:bg-surface-low border border-outline-variant rounded-lg transition-colors cursor-pointer"
                onClick={() => setShowPhaseModal(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handlePhaseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">ABSCHNITT-TITEL *</label>
                <input
                  type="text"
                  required
                  value={newPhaseTitle}
                  onChange={(e) => setNewPhaseTitle(e.target.value)}
                  className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
                  placeholder="z.B. Marketing, Design, Recherche"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
                  ZIEL / BESCHREIBUNG (OPTIONAL)
                </label>
                <textarea
                  rows="2"
                  value={newPhaseDesc}
                  onChange={(e) => setNewPhaseDesc(e.target.value)}
                  className="w-full border border-outline-variant p-2 text-xs focus:border-primary outline-none"
                  placeholder="Was soll in dieser Phase erreicht werden?"
                ></textarea>
              </div>

              <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-outline-variant text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowPhaseModal(false)}
                >
                  ABBRECHEN
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                >
                  ABSCHNITT ANLEGEN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD TASK MODAL */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[22px] text-primary">add_task</span>
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">AUFGABE HINZUFÜGEN</h2>
              </div>
              <button
                className="p-1 hover:bg-surface-low border border-outline-variant rounded-lg transition-colors cursor-pointer"
                onClick={() => setShowTaskModal(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">AUFGABEN-TITEL *</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
                  placeholder="z.B. Stakeholder Interviews führen"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
                  GEPLANTES DATUM / ZEITRAUM
                </label>
                <input
                  type="text"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="w-full border border-outline-variant px-3 py-2 text-xs font-mono focus:border-primary outline-none"
                  placeholder="z.B. Freitag, 17. Mai"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">
                  ANMERKUNG / NOTIZ (OPTIONAL)
                </label>
                <textarea
                  rows="2"
                  value={newTaskNote}
                  onChange={(e) => setNewTaskNote(e.target.value)}
                  className="w-full border border-outline-variant p-2 text-xs focus:border-primary outline-none"
                  placeholder="Wichtige Hinweise zur Durchführung..."
                ></textarea>
              </div>

              <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-outline-variant text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowTaskModal(false)}
                >
                  ABBRECHEN
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                >
                  AUFGABE SPEICHERN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MATERIAL / LINK MODAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-primary/20 w-full max-w-lg p-6 space-y-5 shadow-2xl rounded-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold font-mono text-primary uppercase tracking-wider">
                    MATERIAL / DOKUMENT ANHÄNGEN
                  </h2>
                  <p className="text-[11px] text-on-surface-variant font-normal">Dateien, Dokumente oder Web-Links zum Projekt hinzufügen</p>
                </div>
              </div>
              <button
                className="p-1.5 hover:bg-surface-low rounded-xl text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                onClick={() => setShowMaterialModal(false)}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              <div
                className="border-2 border-dashed border-outline-variant hover:border-primary bg-surface-low/50 hover:bg-surface-low rounded-xl p-6 text-center space-y-3 transition-all cursor-pointer relative"
                onClick={() => {
                  if (localFileInputRef.current) {
                    localFileInputRef.current.click();
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
                <div className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center mx-auto shadow-md">
                  <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-primary">DATEI AUSWÄHLEN ODER HIERHER ZIEHEN</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Unterstützt Dokumente, Bilder, PDFs, Markdown (max. 25 MB)</p>
                </div>
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-outline-variant rounded-lg text-[10px] font-mono text-primary font-bold shadow-sm">
                  <span>💡 TIPP:</span>
                  <kbd className="px-1 py-0.5 bg-surface-low border border-outline-variant rounded text-[9px]">Strg</kbd>
                  <span>+</span>
                  <kbd className="px-1 py-0.5 bg-surface-low border border-outline-variant rounded text-[9px]">V</kbd>
                  <span>Bild einfügen</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold text-primary uppercase">
                  WEB-LINK ODER DOKUMENTEN-NAME *
                </label>
                <input
                  type="text"
                  required
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  className="w-full border border-outline-variant px-3 py-2 text-xs rounded-lg focus:border-primary outline-none bg-white font-sans"
                  placeholder="z.B. Briefing-Dokument.pdf oder https://..."
                />
              </div>

              <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowMaterialModal(false)}
                >
                  ABBRECHEN
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_link</span>
                  <span>ANHÄNGEN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* End of Read-Only Wrapper */}
      </div>

      {/* Detail Drawers */}
      <TaskDetailDrawer
        projectData={projectData}
        task={selectedTask?.task}
        phase={selectedTask?.phase}
        allNotes={projectData.notes || []}
        isOpen={!!selectedTask}
        isGlobalChatOpen={isGlobalChatOpen}
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
        isSecondaryPanel={detailDrawerOpen}
      />

      {/* Floating Action Speech Bubble (FAB) for Fio */}
      {!isGlobalChatOpen && (
        <button
          onClick={() => setIsGlobalChatOpen(true)}
          title="Fio (KI-Coach) öffnen"
          style={{ '--fab-offset': detailDrawerOpen ? '444px' : '24px' }}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-auto sm:[right:var(--fab-offset)] z-30 w-12 h-12 sm:w-13 sm:h-13 flex items-center justify-center bg-neutral-900 text-white rounded-2xl rounded-br-[3px] shadow-2xl hover:shadow-primary/30 border border-neutral-700/60 hover:bg-black hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer p-3"
        >
          <FioIcon className="w-full h-full text-white group-hover:scale-110 transition-transform" color="currentColor" />
        </button>
      )}
    </div>
  );
};

export default ProjectDetail;
