import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const { user } = useAuth();
  
  const [activeModal, setActiveModal] = useState(null);
  const [modalPayload, setModalPayload] = useState({});
  
  const [projects, setProjects] = useState([]);
  const [inboxItems, setInboxItems] = useState({ today: [], yesterday: [] });
  const [reminders, setReminders] = useState([]);
  
  // Trash States
  const [trashedProjects, setTrashedProjects] = useState([]);
  const [trashedReminders, setTrashedReminders] = useState([]);
  const [trashedInboxItems, setTrashedInboxItems] = useState([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [activeCoachScope, setActiveCoachScope] = useState('all');

  const [projectCategories, setProjectCategories] = useState([
    { id: 'allgemein', name: 'Allgemein', isExpanded: true, createdAt: 0 }
  ]);
  const [reminderCategories, setReminderCategories] = useState([
    { id: 'allgemein', name: 'Allgemein', isExpanded: true, createdAt: 0 }
  ]);

  // Helper for auto-delete
  const checkAutoDelete = async (data, colName) => {
    if (data.deletedAt) {
      const deletedTime = new Date(data.deletedAt).getTime();
      const now = Date.now();
      const diffDays = (now - deletedTime) / (1000 * 60 * 60 * 24);
      if (diffDays >= 30) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, colName, data.id));
          return true; // was deleted
        } catch(e) {
          console.error('Auto-delete failed', e);
        }
      }
    }
    return false;
  };

  // Firestore Sync
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setReminders([]);
      setInboxItems({ today: [], yesterday: [] });
      setTrashedProjects([]);
      setTrashedReminders([]);
      setTrashedInboxItems([]);
      return;
    }

    const unsubProjects = onSnapshot(collection(db, 'users', user.uid, 'projects'), (snapshot) => {
      const projs = [];
      const trashed = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.deletedAt) {
          checkAutoDelete(data, 'projects');
          trashed.push({ ...data, _type: 'project' });
        } else {
          projs.push(data);
        }
      });
      projs.sort((a, b) => b.id.localeCompare(a.id));
      trashed.sort((a, b) => b.id.localeCompare(a.id));
      setProjects(projs);
      setTrashedProjects(trashed);
    });

    const unsubReminders = onSnapshot(collection(db, 'users', user.uid, 'reminders'), (snapshot) => {
      const rems = [];
      const trashed = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.deletedAt) {
          checkAutoDelete(data, 'reminders');
          trashed.push({ ...data, _type: 'reminder' });
        } else {
          rems.push(data);
        }
      });
      rems.sort((a, b) => b.id.localeCompare(a.id));
      trashed.sort((a, b) => b.id.localeCompare(a.id));
      setReminders(rems);
      setTrashedReminders(trashed);
    });

    const unsubInbox = onSnapshot(collection(db, 'users', user.uid, 'inboxItems'), (snapshot) => {
      const items = [];
      const trashed = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.deletedAt) {
          checkAutoDelete(data, 'inboxItems');
          trashed.push({ ...data, _type: 'inbox' });
        } else {
          items.push(data);
        }
      });
      items.sort((a, b) => b.id.localeCompare(a.id));
      trashed.sort((a, b) => b.id.localeCompare(a.id));
      
      const today = [];
      const yesterday = [];
      const now = Date.now();
      items.forEach(item => {
        const timestampParts = item.id.split('_');
        const timestamp = timestampParts.length > 1 ? parseInt(timestampParts[1]) : now;
        if (now - timestamp > 24 * 60 * 60 * 1000) {
          yesterday.push(item);
        } else {
          today.push(item);
        }
      });
      setInboxItems({ today, yesterday });
      setTrashedInboxItems(trashed);
    });

    const unsubCategories = onSnapshot(collection(db, 'users', user.uid, 'categories'), (snapshot) => {
      const cats = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id === 'allgemein') {
          cats.push({ id: 'allgemein', name: 'Allgemein', isExpanded: true, createdAt: 0, ...data });
        } else {
          cats.push({ id: doc.id, ...data });
        }
      });
      if (!cats.some(c => c.id === 'allgemein')) {
        cats.unshift({ id: 'allgemein', name: 'Allgemein', isExpanded: true, createdAt: 0, order: -1 });
      }
      cats.sort((a, b) => (a.order !== undefined ? a.order : a.createdAt || 0) - (b.order !== undefined ? b.order : b.createdAt || 0));

      setProjectCategories(prev => {
        const prevExpandMap = {};
        prev.forEach(c => { prevExpandMap[c.id] = c.isExpanded; });
        return cats.map(c => ({
          ...c,
          isExpanded: prevExpandMap[c.id] !== undefined ? prevExpandMap[c.id] : (c.isExpanded ?? true)
        }));
      });
    });

    const unsubReminderCategories = onSnapshot(collection(db, 'users', user.uid, 'reminderCategories'), (snapshot) => {
      const cats = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id === 'allgemein') {
          cats.push({ id: 'allgemein', name: 'Allgemein', isExpanded: true, createdAt: 0, ...data });
        } else {
          cats.push({ id: doc.id, ...data });
        }
      });
      if (!cats.some(c => c.id === 'allgemein')) {
        cats.unshift({ id: 'allgemein', name: 'Allgemein', isExpanded: true, createdAt: 0, order: -1 });
      }
      cats.sort((a, b) => (a.order !== undefined ? a.order : a.createdAt || 0) - (b.order !== undefined ? b.order : b.createdAt || 0));

      setReminderCategories(prev => {
        const prevExpandMap = {};
        prev.forEach(c => { prevExpandMap[c.id] = c.isExpanded; });
        return cats.map(c => ({
          ...c,
          isExpanded: prevExpandMap[c.id] !== undefined ? prevExpandMap[c.id] : (c.isExpanded ?? true)
        }));
      });
    });

    return () => {
      unsubProjects();
      unsubReminders();
      unsubInbox();
      unsubCategories();
      unsubReminderCategories();
    };
  }, [user]);

  const openModal = (modalType, payload = {}) => {
    setActiveModal(modalType);
    setModalPayload(payload);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalPayload({});
  };

  // Helper to save a project directly to Firestore
  const saveProject = async (project) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'projects', project.id), project);
  };

  // Helper to mutate an existing project based on local state, then save
  const mutateProject = (projectId, mutateFn) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const updatedProj = mutateFn({ ...proj });
    saveProject(updatedProj);
  };

  const addProject = async (projectData) => {
    if (!user) return null;
    const newId = `p_${Date.now()}`;
    const startStr = projectData.startDate ? new Date(projectData.startDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '01.08.24';
    const endStr = projectData.endDate ? new Date(projectData.endDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '31.12.24';
    
    const newPhases = [];
    if (projectData.phases && projectData.phases.length > 0) {
      projectData.phases.forEach((p, idx) => {
        if (!p.title || !p.title.trim()) return;
        
        const newTasks = [];
        if (p.tasks && p.tasks.length > 0) {
          p.tasks.forEach((t, tIdx) => {
            if (!t.title || !t.title.trim()) return;
            newTasks.push({
              id: `t_${Date.now()}_${idx}_${tIdx}`,
              title: t.title.trim(),
              date: t.date || 'Demnächst',
              completed: false,
              note: t.note || ''
            });
          });
        }
        
        let dateInfo = idx === 0 ? 'Startphase' : 'Geplant';
        if (p.date) {
            const parsedDate = new Date(p.date);
            if (!isNaN(parsedDate)) {
                dateInfo = parsedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
            }
        }

        newPhases.push({
          id: `ph_${Date.now()}_${idx}`,
          title: p.title.trim().toUpperCase(),
          dateInfo: dateInfo,
          completed: false,
          tasks: newTasks,
          materials: p.note ? [{ id: `m_${Date.now()}`, name: p.note, url: '#', type: 'link' }] : []
        });
      });
    } else if (projectData.firstPhase && projectData.firstPhase.trim() !== '') {
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
      description: projectData.description || '',
      status: projectData.status || 'GEPLANT',
      isPaused: false,
      inKanban: true,
      nextStep: newPhases.length > 0 ? `Nächste Etappe: ${newPhases[0].title}` : 'Erste Schritte planen',
      startDate: projectData.startDate || '',
      endDate: projectData.endDate || '',
      categoryId: projectData.categoryId || 'allgemein',
      dateRange: `${startStr} – ${endStr}`,
      daysRemaining: 'NEU GESTARTET',
      progress: 0,
      timeElapsed: 0,
      phasesCompleted: 0,
      phasesTotal: newPhases.length,
      tasksCompleted: 0,
      tasksTotal: newPhases.reduce((acc, ph) => acc + ph.tasks.length, 0),
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

    await saveProject(newProject);
    setSelectedProjectId(newId);

    if (projectData.inboxItemId) {
      deleteInboxItem(projectData.inboxItemId);
    }
    return newId;
  };

  const addPhase = (projectId, phaseData) => {
    mutateProject(projectId, (proj) => {
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
    });
  };

  const addTask = (projectId, phaseId, taskData) => {
    mutateProject(projectId, (proj) => {
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

        const updatedTasks = [...(phase.tasks || []), newTask];
        const completedInPhase = updatedTasks.filter(t => t.completed).length;
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
      const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter(t => t.completed).length : 0), 0);
      const completedPhases = updatedPhases.filter(p => p.completed).length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : proj.progress;

      let newStatus = proj.status;
      if (completedTasks < totalTasks && proj.status === 'ABGESCHLOSSEN') {
        newStatus = 'AKTIV';
      }

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
        status: newStatus,
        tasksTotal: totalTasks,
        tasksCompleted: completedTasks,
        phasesCompleted: completedPhases,
        phasesTotal: updatedPhases.length,
        progress: progressPercent,
        phases: updatedPhases,
        history: [historyEntry, ...(proj.history || [])]
      };
    });
  };

  const addMaterial = (projectId, phaseId, materialData) => {
    mutateProject(projectId, (proj) => {
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

        return { ...phase, materials: [...(phase.materials || []), newMaterial] };
      });

      const historyEntry = {
        id: `h_${Date.now()}`,
        date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
        title: `Neues Phasenmaterial hinzugefügt: '${materialData.name.trim()}'`,
        category: targetPhaseTitle || 'Material',
        icon: 'attach_file',
        badgeBg: 'bg-surface-low border border-outline-variant text-primary'
      };

      return { ...proj, phases: updatedPhases, history: [historyEntry, ...(proj.history || [])] };
    });
  };

  const toggleTask = (projectId, phaseId, taskId) => {
    mutateProject(projectId, (proj) => {
      let taskTitle = '';
      let isNowCompleted = false;
      let phaseName = '';

      const updatedPhases = proj.phases.map(phase => {
        if (phase.id !== phaseId) return phase;
        phaseName = phase.title;

        const updatedTasks = (phase.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          taskTitle = t.title;
          isNowCompleted = !t.completed;
          return { ...t, completed: isNowCompleted };
        });

        const completedInPhase = updatedTasks.filter(t => t.completed).length;
        const totalInPhase = updatedTasks.length;
        const allPhaseTasksCompleted = totalInPhase > 0 && completedInPhase === totalInPhase;

        return {
          ...phase,
          completed: allPhaseTasksCompleted,
          badgeText: allPhaseTasksCompleted ? 'ERLEDIGT' : `${completedInPhase}/${totalInPhase} ERLEDIGT`,
          tasks: updatedTasks
        };
      });

      const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
      const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter(t => t.completed).length : 0), 0);
      const completedPhases = updatedPhases.filter(p => p.completed).length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : proj.progress;

      let newStatus = proj.status;
      if (totalTasks > 0 && completedTasks === totalTasks) {
        newStatus = 'ABGESCHLOSSEN';
      } else if (completedTasks < totalTasks && proj.status === 'ABGESCHLOSSEN') {
        newStatus = 'AKTIV';
      }

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
        status: newStatus,
        progress: progressPercent,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
        phasesCompleted: completedPhases,
        phasesTotal: updatedPhases.length,
        phases: updatedPhases,
        history: historyEntry ? [historyEntry, ...(proj.history || [])] : (proj.history || [])
      };
    });
  };

  const toggleProjectStatus = (projectId) => {
    mutateProject(projectId, (proj) => {
      let newStatus = 'GEPLANT';
      if (proj.status === 'GEPLANT') newStatus = 'AKTIV';
      else if (proj.status === 'AKTIV' || proj.status === 'LAUFEND') newStatus = 'ABGESCHLOSSEN';
      return { ...proj, status: newStatus };
    });
  };

  const toggleProjectPause = (projectId) => {
    mutateProject(projectId, (proj) => ({ ...proj, isPaused: !proj.isPaused }));
  };

  const setProjectStatus = (projectId, newStatus) => {
    mutateProject(projectId, (proj) => ({ ...proj, status: newStatus }));
  };

  const updateProjectForKanban = (projectId, column) => {
    mutateProject(projectId, (proj) => {
      if (column === 'TODO') return { ...proj, status: 'GEPLANT', progress: 0 };
      if (column === 'IN_PROGRESS') return { ...proj, status: 'AKTIV', progress: proj.progress === 0 ? 10 : proj.progress };
      if (column === 'DONE') return { ...proj, status: 'ABGESCHLOSSEN', progress: 100 };
      return proj;
    });
  };

  const toggleProjectKanban = (projectId) => {
    mutateProject(projectId, (p) => {
      p.inKanban = p.inKanban === false ? true : false;
      return p;
    });
  };

  const moveProjectToCategory = (projectId, categoryId) => {
    mutateProject(projectId, (p) => {
      p.categoryId = categoryId;
      return p;
    });
  };

  const moveReminderToCategory = (reminderId, categoryId) => {
    mutateReminder(reminderId, (r) => {
      r.categoryId = categoryId;
      return r;
    });
  };

  const addReminderCategory = async (name) => {
    if (!user) return;
    const id = `rcat_${Date.now()}`;
    const newCat = { id, name, isExpanded: true, createdAt: Date.now() };
    setReminderCategories(prev => [...prev.filter(c => c.id !== id), newCat]);
    try {
      await setDoc(doc(db, 'users', user.uid, 'reminderCategories', id), newCat);
    } catch (e) {
      console.error('Error adding reminder category:', e);
    }
  };

  const toggleReminderCategory = async (categoryId) => {
    if (!user) return;
    const cat = reminderCategories.find(c => c.id === categoryId);
    if (!cat) return;
    setReminderCategories(prev => prev.map(c => c.id === categoryId ? { ...c, isExpanded: !c.isExpanded } : c));
    await setDoc(doc(db, 'users', user.uid, 'reminderCategories', categoryId), { ...cat, isExpanded: !cat.isExpanded }, { merge: true });
  };

  const deleteReminderCategory = async (categoryId) => {
    if (!user || categoryId === 'allgemein') return;
    setReminderCategories(prev => prev.filter(c => c.id !== categoryId));
    
    const remsToMove = reminders.filter(r => r.categoryId === categoryId);
    for (const r of remsToMove) {
      await setDoc(doc(db, 'users', user.uid, 'reminders', r.id), { ...r, categoryId: 'allgemein' }, { merge: true });
    }
    
    await deleteDoc(doc(db, 'users', user.uid, 'reminderCategories', categoryId));
  };

  const addProjectCategory = async (name) => {
    if (!user) return;
    const id = `cat_${Date.now()}`;
    const newCat = { id, name, isExpanded: true, createdAt: Date.now() };
    setProjectCategories(prev => [...prev.filter(c => c.id !== id), newCat]);
    try {
      await setDoc(doc(db, 'users', user.uid, 'categories', id), newCat);
    } catch (e) {
      console.error('Error adding project category:', e);
    }
  };

  const toggleProjectCategory = async (categoryId) => {
    if (!user) return;
    const cat = projectCategories.find(c => c.id === categoryId);
    if (!cat) return;
    await setDoc(doc(db, 'users', user.uid, 'categories', categoryId), { ...cat, isExpanded: !cat.isExpanded }, { merge: true });
  };

  const collapseAllProjectCategories = () => {
    setProjectCategories(prev => prev.map(c => ({ ...c, isExpanded: false })));
  };

  const expandAllProjectCategories = () => {
    setProjectCategories(prev => prev.map(c => ({ ...c, isExpanded: true })));
  };

  // Restore exact expand states from a saved {catId: boolean} map
  const restoreProjectCategoryExpandStates = (statesMap) => {
    setProjectCategories(prev => prev.map(c => ({
      ...c,
      isExpanded: statesMap[c.id] !== undefined ? statesMap[c.id] : c.isExpanded,
    })));
  };

  const collapseAllReminderCategories = () => {
    setReminderCategories(prev => prev.map(c => ({ ...c, isExpanded: false })));
  };

  const expandAllReminderCategories = () => {
    setReminderCategories(prev => prev.map(c => ({ ...c, isExpanded: true })));
  };

  // Restore exact expand states from a saved {catId: boolean} map
  const restoreReminderCategoryExpandStates = (statesMap) => {
    setReminderCategories(prev => prev.map(c => ({
      ...c,
      isExpanded: statesMap[c.id] !== undefined ? statesMap[c.id] : c.isExpanded,
    })));
  };

  const reorderProjectCategories = async (newCategories) => {
    const updated = newCategories.map((c, index) => ({ ...c, order: index }));
    setProjectCategories(updated);
    if (!user) return;
    try {
      const batch = writeBatch(db);
      for (const cat of updated) {
        const ref = doc(db, 'users', user.uid, 'categories', cat.id);
        batch.set(ref, { order: cat.order }, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      console.error('Error batch reordering project categories:', e);
    }
  };

  const moveProjectCategoryOrder = (catId, direction) => {
    const index = projectCategories.findIndex(c => c.id === catId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= projectCategories.length) return;
    
    const newCats = [...projectCategories];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(targetIndex, 0, moved);
    reorderProjectCategories(newCats);
  };

  const reorderReminderCategories = async (newCategories) => {
    const updated = newCategories.map((c, index) => ({ ...c, order: index }));
    setReminderCategories(updated);
    if (!user) return;
    try {
      const batch = writeBatch(db);
      for (const cat of updated) {
        const ref = doc(db, 'users', user.uid, 'reminderCategories', cat.id);
        batch.set(ref, { order: cat.order }, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      console.error('Error batch reordering reminder categories:', e);
    }
  };

  const moveReminderCategoryOrder = (catId, direction) => {
    const index = reminderCategories.findIndex(c => c.id === catId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reminderCategories.length) return;
    
    const newCats = [...reminderCategories];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(targetIndex, 0, moved);
    reorderReminderCategories(newCats);
  };

  const updateProjectCategory = async (catId, newName) => {
    if (!newName.trim()) return;
    const name = newName.trim();
    setProjectCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c));
    if (!user || catId === 'allgemein') return;
    await setDoc(doc(db, 'users', user.uid, 'categories', catId), { name }, { merge: true });
  };

  const updateReminderCategory = async (catId, newName) => {
    if (!newName.trim()) return;
    const name = newName.trim();
    setReminderCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c));
    if (!user || catId === 'allgemein') return;
    await setDoc(doc(db, 'users', user.uid, 'reminderCategories', catId), { name }, { merge: true });
  };

  const deleteProjectCategory = async (categoryId) => {
    if (!user || categoryId === 'allgemein') return;
    
    // Move all projects in this category to allgemein
    const projsToMove = projects.filter(p => p.categoryId === categoryId);
    for (const p of projsToMove) {
      await setDoc(doc(db, 'users', user.uid, 'projects', p.id), { ...p, categoryId: 'allgemein' }, { merge: true });
    }
    
    await deleteDoc(doc(db, 'users', user.uid, 'categories', categoryId));
  };

  const deleteProject = async (projectId) => {
    mutateProject(projectId, (proj) => ({ ...proj, deletedAt: new Date().toISOString() }));
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }
  };

  // Reminders Helpers
  const saveReminder = async (rem) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'reminders', rem.id), rem);
  };

  const mutateReminder = (reminderId, mutateFn) => {
    const rem = reminders.find(r => r.id === reminderId);
    if (!rem) return;
    saveReminder(mutateFn({ ...rem }));
  };

  const addReminder = async (reminderData) => {
    if (!user) return null;
    const newId = `r_${Date.now()}`;
    const newReminder = {
      id: newId,
      title: reminderData.title,
      description: reminderData.description || '',
      date: reminderData.date || 'Demnächst',
      time: reminderData.time || '',
      status: reminderData.status || 'GEPLANT',
      categoryId: reminderData.categoryId || 'allgemein',
      isPaused: false,
      inKanban: true,
      createdAt: Date.now(),
      history: [
        {
          id: `h_${Date.now()}`,
          date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
          title: `Erinnerung '${reminderData.title}' erfolgreich angelegt`,
          category: 'Neu angelegt',
          icon: 'rocket_launch',
          badgeBg: 'bg-primary text-white'
        }
      ]
    };
    await saveReminder(newReminder);
    setSelectedReminderId(newId);

    if (reminderData.inboxItemId) {
      deleteInboxItem(reminderData.inboxItemId);
    }
    return newId;
  };

  const updateReminderForKanban = (reminderId, column) => {
    mutateReminder(reminderId, (rem) => {
      if (column === 'TODO') return { ...rem, status: 'GEPLANT' };
      if (column === 'IN_PROGRESS') return { ...rem, status: 'AKTIV' };
      if (column === 'DONE') return { ...rem, status: 'ABGESCHLOSSEN' };
      return rem;
    });
  };

  const toggleReminderStatus = (reminderId) => {
    mutateReminder(reminderId, (rem) => {
      let nextStatus = 'GEPLANT';
      if (rem.status === 'GEPLANT') nextStatus = 'AKTIV';
      else if (rem.status === 'AKTIV') nextStatus = 'ABGESCHLOSSEN';
      return { ...rem, status: nextStatus };
    });
  };

  const setReminderStatus = (reminderId, newStatus) => {
    mutateReminder(reminderId, (rem) => ({ ...rem, status: newStatus }));
  };

  const toggleReminderPause = (reminderId) => {
    mutateReminder(reminderId, (rem) => ({ ...rem, isPaused: !rem.isPaused }));
  };

  const toggleReminderKanban = (reminderId) => {
    mutateReminder(reminderId, (rem) => ({ ...rem, inKanban: rem.inKanban === false }));
  };

  const deleteReminder = async (reminderId) => {
    mutateReminder(reminderId, (rem) => ({ ...rem, deletedAt: new Date().toISOString() }));
    if (selectedReminderId === reminderId) {
      setSelectedReminderId(null);
    }
  };

  // Inbox Helpers
  const addInboxItem = async (itemData) => {
    if (!user) return;
    let newItem;
    if (typeof itemData === 'object' && itemData !== null) {
      newItem = {
        id: `i_${Date.now()}`,
        title: itemData.title || itemData.summary,
        summary: itemData.summary,
        originalText: itemData.originalText,
        type: itemData.type || 'unclassified',
        completed: false
      };
    } else {
      if (!itemData || !itemData.trim()) return;
      newItem = {
        id: `i_${Date.now()}`,
        title: itemData.trim(),
        type: 'unclassified',
        completed: false
      };
    }
    await setDoc(doc(db, 'users', user.uid, 'inboxItems', newItem.id), newItem);
  };

  const updateInboxItem = async (id, updates) => {
    if (!user) return;
    let itemToUpdate = inboxItems.today.find(i => i.id === id) || inboxItems.yesterday.find(i => i.id === id);
    if (!itemToUpdate) return;
    
    const updated = { ...itemToUpdate, ...updates };
    await setDoc(doc(db, 'users', user.uid, 'inboxItems', id), updated);
  };

  const deleteInboxItem = async (id) => {
    if (!user) return;
    let itemToUpdate = inboxItems.today.find(i => i.id === id) || inboxItems.yesterday.find(i => i.id === id);
    if (!itemToUpdate) return;
    const updated = { ...itemToUpdate, deletedAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', user.uid, 'inboxItems', id), updated);
  };

  const trashItems = [...trashedProjects, ...trashedReminders, ...trashedInboxItems];

  const permanentlyDeleteItem = async (id, type) => {
    if (!user) return;
    const colName = type === 'project' ? 'projects' : type === 'reminder' ? 'reminders' : 'inboxItems';
    await deleteDoc(doc(db, 'users', user.uid, colName, id));
    if (type === 'project' && selectedProjectId === id) setSelectedProjectId(null);
    if (type === 'reminder' && selectedReminderId === id) setSelectedReminderId(null);
  };

  const restoreItem = async (id, type) => {
    if (!user) return;
    const colName = type === 'project' ? 'projects' : type === 'reminder' ? 'reminders' : 'inboxItems';
    const item = trashItems.find(i => i.id === id);
    if (item) {
      const restored = { ...item };
      delete restored.deletedAt;
      delete restored._type;
      await setDoc(doc(db, 'users', user.uid, colName, id), restored);
    }
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
      projectCategories,
      addProjectCategory,
      toggleProjectCategory,
      deleteProjectCategory,
      updateProjectCategory,
      updateReminderCategory,
      reorderProjectCategories,
      moveProjectCategoryOrder,
      collapseAllProjectCategories,
      expandAllProjectCategories,
      restoreProjectCategoryExpandStates,
      reminderCategories,
      addReminderCategory,
      toggleReminderCategory,
      deleteReminderCategory,
      updateReminderCategory,
      reorderReminderCategories,
      moveReminderCategoryOrder,
      collapseAllReminderCategories,
      expandAllReminderCategories,
      restoreReminderCategoryExpandStates,
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
      updateInboxItem,
      deleteInboxItem,
      addReminder,
      mutateProject,
      mutateReminder,
      trashItems,
      restoreItem,
      permanentlyDeleteItem
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
