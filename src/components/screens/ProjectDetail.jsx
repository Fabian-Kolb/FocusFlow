import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';

const ProjectDetail = ({ setCurrentScreen }) => {
  const { 
    projects: contextProjects, 
    selectedProjectId, 
    toggleTask: contextToggleTask, 
    toggleProjectStatus: contextToggleProjectStatus,
    setActiveCoachScope,
    mutateProject,
    toggleProjectPause
  } = useModalContext();
  const selectedProject = contextProjects.find(p => p.id === selectedProjectId) || contextProjects[0];
  
  const projectData = selectedProject || {};
  const setProjectData = (mutateFn) => {
    if (typeof mutateFn === 'function') {
      mutateProject(selectedProjectId, mutateFn);
    } else {
      mutateProject(selectedProjectId, () => mutateFn);
    }
  };

  const [filterType, setFilterType] = useState('all'); // 'all' | 'open' | 'completed'
  const [collapsedPhases, setCollapsedPhases] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({ t1: true, t2: true });
  
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

  // States for Editing Dates
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState(selectedProject?.startDate || '');
  const [editEndDate, setEditEndDate] = useState(selectedProject?.endDate || '');

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

  // Status Selector
  const handleStatusSet = (newStatus) => {
    setProjectData((prev) => ({ ...prev, status: newStatus }));
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

  const toggleTaskDetails = (taskId) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleTaskCompletion = (phaseId, taskId) => {
    setProjectData((prev) => {
      let updatedCompletedCount = prev.tasksCompleted;
      const updatedPhases = prev.phases.map((phase) => {
        if (phase.id !== phaseId) return phase;

        const updatedTasks = phase.tasks.map((task) => {
          if (task.id !== taskId) return task;
          const nextCompleted = !task.completed;
          if (nextCompleted) updatedCompletedCount++;
          else updatedCompletedCount--;
          return { ...task, completed: nextCompleted };
        });

        const completedInPhase = updatedTasks.filter((t) => t.completed).length;
        const totalInPhase = updatedTasks.length;
        const phaseCompleted = totalInPhase > 0 && completedInPhase === totalInPhase;

        return {
          ...phase,
          completed: phaseCompleted,
          badgeText: `${completedInPhase}/${totalInPhase} ERLEDIGT`,
          tasks: updatedTasks
        };
      });

      const totalTasks = prev.tasksTotal;
      const progressPct = Math.round((updatedCompletedCount / totalTasks) * 100);

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
        tasksCompleted: updatedCompletedCount,
        progress: progressPct,
        tasksCountText: `(${updatedCompletedCount} / ${totalTasks} Tasks)`,
        history: [newHistoryItem, ...(prev.history || [])],
        phases: updatedPhases
      };
    });
  };

  // Add Note to Task
  const handleAddNoteToTask = (phaseId, taskId) => {
    const noteText = window.prompt('Anmerkung / Notiz eingeben:');
    if (!noteText || !noteText.trim()) return;

    setProjectData((prev) => {
      const updatedPhases = prev.phases.map((phase) => {
        if (phase.id !== phaseId) return phase;
        const updatedTasks = phase.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return { ...t, note: noteText.trim() };
        });
        return { ...phase, tasks: updatedTasks };
      });
      return { ...prev, phases: updatedPhases };
    });

    setExpandedTasks((prev) => ({ ...prev, [taskId]: true }));
  };

  // Handle Add Phase
  const handlePhaseSubmit = (e) => {
    e.preventDefault();
    if (!newPhaseTitle.trim()) return;

    const newPhaseId = `ph_${Date.now()}`;
    const newPhase = {
      id: newPhaseId,
      phaseNum: `Phase 0${projectData.phases.length + 1}`,
      title: newPhaseTitle.trim(),
      badgeText: '0/0 ERLEDIGT',
      completed: false,
      materials: [],
      tasks: []
    };

    setProjectData((prev) => ({
      ...prev,
      phasesTotal: prev.phasesTotal + 1,
      history: [
        {
          id: `h_${Date.now()}`,
          timestamp: 'HEUTE • gerade eben',
          text: `Neue Phase angelegt: '${newPhaseTitle.trim()}'`,
          phase: 'Projekt-Fortschritt',
          icon: 'flag',
          iconStyle: 'bg-surface-low border border-outline-variant rounded-lg text-primary'
        },
        ...(prev.history || [])
      ],
      phases: [...prev.phases, newPhase]
    }));

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
      const updatedTasksTotal = prev.tasksTotal + 1;
      const updatedPhases = prev.phases.map((phase) => {
        if (phase.id !== activePhaseIdForTask) return phase;
        const updatedTasks = [...phase.tasks, newTask];
        const completedInPhase = updatedTasks.filter((t) => t.completed).length;
        return {
          ...phase,
          badgeText: `${completedInPhase}/${updatedTasks.length} ERLEDIGT`,
          tasks: updatedTasks
        };
      });

      return {
        ...prev,
        tasksTotal: updatedTasksTotal,
        tasksCountText: `(${prev.tasksCompleted} / ${updatedTasksTotal} Tasks)`,
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
              text: `Neues Phasenmaterial hinzugefügt: '${name}'`,
              phase: `Phase Material`,
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
      setExpandedTasks((prev) => ({ ...prev, [taskId]: true }));
    }

    setNewMaterialName('');
    setShowMaterialModal(false);
    setActiveTargetForMaterial(null);
  };

  // Filter phases logic
  const filteredPhases = projectData.phases.filter((phase) => {
    if (filterType === 'open') return !phase.completed;
    if (filterType === 'completed') return phase.completed;
    return true;
  });

  return (
    <div className="screen-transition">
      <div className="w-full mx-auto space-y-4 sm:space-y-6">
        <div>
          {/* Back Button */}
          <button
            className="inline-flex items-center gap-2 text-xs font-mono text-on-surface-variant hover:text-primary mb-3 transition-colors cursor-pointer"
            onClick={() => setCurrentScreen && setCurrentScreen('projects')}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Zurück zur Übersicht
          </button>

          {/* Header Title with Interactive Status Toggle & History Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{projectData.title}</h1>
                {projectData.isPaused && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-400 ring-1 ring-blue-400 rounded-lg text-[10px] font-mono font-bold tracking-wider">
                    PAUSIERT
                  </span>
                )}
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
              
              <button
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-xl hover:bg-primary/20 text-primary font-mono text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                onClick={() => {
                  setActiveCoachScope(projectData.id);
                  if (setCurrentScreen) setCurrentScreen('coach');
                }}
                title="AI Coach für dieses Projekt befragen"
              >
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                <span>AI COACH</span>
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
                  <span className="text-on-surface-variant text-[9px] sm:text-[10px] uppercase block truncate">PHASEN</span>
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
                  <span className="text-on-surface-variant text-[9px] sm:text-[10px] uppercase block truncate">UNTERPUNKTE</span>
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
                      onClick={() => {
                        if (step.targetTaskId) {
                          setExpandedTasks((prev) => ({ ...prev, [step.targetTaskId]: true }));
                        }
                      }}
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

        {/* BEREICHS-HEADER: PROJEKT-PHASEN & PHASEN-FILTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-primary pb-3 pt-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">layers</span>
            <h2 className="text-sm font-mono font-bold text-primary uppercase tracking-wider">
              PROJEKT-PHASEN
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
                ALLE PHASEN
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
                <div
                  className="flex items-center justify-between gap-2 border-b border-outline-variant pb-3 cursor-pointer select-none group"
                  onClick={() => togglePhaseCollapse(phase.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] text-primary transition-transform duration-200 flex-shrink-0">
                      {isCollapsed ? 'chevron_right' : 'expand_more'}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase font-bold block">
                        {phase.phaseNum}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold group-hover:underline truncate">
                        {phase.title}
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs mono font-bold text-primary bg-surface-low px-2 py-1 border border-outline-variant rounded-lg whitespace-nowrap flex-shrink-0">
                    {phase.badgeText}
                  </span>
                </div>

                {/* Phase Body */}
                {!isCollapsed && (
                  <div className="space-y-4 pt-1">
                    {/* Phase Materials Box */}
                    <div className="p-3 bg-surface-low border border-outline-variant rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-primary uppercase">MATERIAL:</span>
                        <div className="flex flex-wrap gap-2">
                          {phase.materials && phase.materials.length > 0 ? (
                            phase.materials.map((mat) => (
                              <a
                                key={mat.id}
                                href={mat.url || '#'}
                                onClick={(e) => {
                                  e.preventDefault();
                                  alert(`${mat.name} geöffnet!`);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-outline-variant rounded-xl text-xs hover:border-primary font-medium transition-all shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                <span>{mat.name}</span>
                              </a>
                            ))
                          ) : (
                            <span className="text-xs text-on-surface-variant font-mono">Keine Materialien</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="text-[11px] font-mono text-primary flex items-center gap-1 hover:underline font-bold whitespace-nowrap self-start sm:self-auto cursor-pointer"
                        onClick={() => {
                          setActiveTargetForMaterial({ type: 'phase', id: phase.id });
                          setShowMaterialModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Link hinzufügen</span>
                      </button>
                    </div>

                    <div className="border-t border-outline-variant my-4"></div>

                    {/* Task List */}
                    <div className="space-y-3">
                      {phase.tasks.map((task) => {
                        const isTaskExpanded = expandedTasks[task.id];

                        return (
                          <div
                            key={task.id}
                            id={`task-${task.id}`}
                            className="p-3 bg-surface-low border border-outline-variant rounded-lg space-y-2 task-item"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => toggleTaskCompletion(phase.id, task.id)}
                                  className="w-4 h-4 text-primary rounded-none border-outline-variant focus:ring-0 flex-shrink-0 mt-0.5 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <span
                                    className={`text-xs sm:text-sm font-medium leading-snug block ${
                                      task.completed ? 'line-through text-on-surface-variant' : 'text-primary'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                  <span className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant block mt-0.5 font-normal">
                                    {task.date}
                                  </span>
                                </div>
                              </div>
                              <button
                                className="p-0.5 text-on-surface-variant hover:text-primary hover:bg-white border border-transparent hover:border-outline-variant transition-all rounded flex-shrink-0 mt-0.5 cursor-pointer"
                                onClick={() => toggleTaskDetails(task.id)}
                                title="Quellen & Notizen ein-/ausklappen"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {isTaskExpanded ? 'expand_less' : 'expand_more'}
                                </span>
                              </button>
                            </div>

                            {/* Task Details Accordion Body */}
                            {isTaskExpanded && (
                              <div className="task-details-body pt-1.5 space-y-2 border-t border-outline-variant/60 mt-2">
                                {task.note && (
                                  <div className="p-2 bg-white border border-outline-variant rounded-xl text-xs space-y-1 shadow-sm">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant font-bold border-b border-outline-variant/60 pb-1">
                                      <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[13px] text-primary">
                                          sticky_note_2
                                        </span>
                                        <span>ANMERKUNG / NOTIZ:</span>
                                      </span>
                                      <span className="text-[9px]">HEUTE</span>
                                    </div>
                                    <p className="text-primary text-[11px] leading-tight">{task.note}</p>
                                  </div>
                                )}

                                {task.links && task.links.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-mono text-on-surface-variant block">Task-Links:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {task.links.map((link) => (
                                        <a
                                          key={link.id}
                                          href={link.url || '#'}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            alert(`${link.name} geöffnet!`);
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-outline-variant rounded-xl text-[11px] hover:border-primary"
                                        >
                                          <span className="material-symbols-outlined text-[12px]">link</span>
                                          <span>{link.name}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                                  <button
                                    className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                    onClick={() => handleAddNoteToTask(phase.id, task.id)}
                                  >
                                    <span className="material-symbols-outlined text-[13px]">add_comment</span>
                                    <span>Notiz hinzufügen</span>
                                  </button>
                                  <span className="text-outline-variant hidden sm:inline">•</span>
                                  <button
                                    className="text-[11px] font-mono text-on-surface-variant hover:text-primary flex items-center gap-1 cursor-pointer"
                                    onClick={() => {
                                      setActiveTargetForMaterial({ type: 'task', phaseId: phase.id, taskId: task.id });
                                      setShowMaterialModal(true);
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-[13px]">link</span>
                                    <span>Link hinzufügen</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add Subtask Button */}
                      <div
                        className="p-3 border border-dashed border-outline-variant rounded-xl hover:border-primary bg-white hover:bg-surface-low cursor-pointer transition-all flex items-center justify-between group"
                        onClick={() => {
                          setActivePhaseIdForTask(phase.id);
                          setShowTaskModal(true);
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 border border-dashed border-primary flex items-center justify-center font-mono text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            +
                          </div>
                          <span className="text-xs font-mono font-bold text-primary group-hover:underline uppercase">
                            + UNTERPUNKT HINZUFÜGEN
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-low border border-outline-variant rounded-lg text-on-surface-variant font-medium">
                          TASK
                        </span>
                      </div>
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
              + NEUE PHASE ANLEGEN
            </span>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 bg-surface-low border border-outline-variant rounded-lg text-primary font-bold">
            MEILENSTEINE
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
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">NEUE PHASE ANLEGEN</h2>
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
                <label className="block text-xs font-mono font-bold text-primary mb-1 uppercase">PHASEN-TITEL *</label>
                <input
                  type="text"
                  required
                  value={newPhaseTitle}
                  onChange={(e) => setNewPhaseTitle(e.target.value)}
                  className="w-full border border-outline-variant px-3 py-2 text-sm focus:border-primary outline-none"
                  placeholder="z.B. Phase 03: Testing & Launch"
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
                  PHASE ANLEGEN
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
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">UNTERPUNKT HINZUFÜGEN</h2>
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
                  TASK SPEICHERN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MATERIAL / LINK MODAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[22px] text-primary">upload_file</span>
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">
                  MATERIAL / DOKUMENT ANHÄNGEN
                </h2>
              </div>
              <button
                className="p-1 hover:bg-surface-low border border-outline-variant rounded-lg transition-colors cursor-pointer"
                onClick={() => setShowMaterialModal(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              <div
                className="border-2 border-dashed border-primary/50 bg-surface-low p-6 text-center space-y-2 hover:border-primary transition-colors cursor-pointer relative"
                onClick={() => {
                  const name = window.prompt('Dateiname oder Link eingeben:');
                  if (name) setNewMaterialName(name);
                }}
              >
                <div className="w-10 h-10 bg-white border border-outline-variant rounded-xl rounded-full flex items-center justify-center mx-auto text-primary">
                  <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-primary">DATEI HIERHER ZIEHEN ODER KLICKEN</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Unterstützt Dokumente, Bilder, PDFs (max. 25 MB)</p>
                </div>
                <div className="inline-block px-2.5 py-1 bg-white border border-outline-variant rounded-xl text-[10px] font-mono text-primary font-bold">
                  💡 TIPP: <kbd className="px-1 bg-surface-low border rounded">Strg</kbd> + <kbd className="px-1 bg-surface-low border rounded">V</kbd> um Bild aus Zwischenablage einzufügen
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-primary uppercase">
                  ODER WEB-LINK / DOKUMENTEN-NAME *
                </label>
                <input
                  type="text"
                  required
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  className="w-full border border-outline-variant px-3 py-2 text-xs focus:border-primary outline-none"
                  placeholder="z.B. Briefing-Dokument.pdf oder https://..."
                />
              </div>

              <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-outline-variant text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowMaterialModal(false)}
                >
                  ABBRECHEN
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                >
                  ANHÄNGEN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
