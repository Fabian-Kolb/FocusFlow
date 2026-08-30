// src/lib/aiActionEngine.js
// Fio AI Action Engine: Tool Calling & Real-Time App Actions
// Allows Fio to create & mutate projects, phases, tasks, reminders, and statuses directly in the app state.

/**
 * System prompt guidelines instructing Gemini on how to format actions.
 */
export const ACTION_ENGINE_SYSTEM_PROMPT = `
AKTIONEN IN DER APP AUSFÜHREN (TOOL CAPABILITIES):
Du hast die Fähigkeit, echte Aktionen in der FocusFlow-App des Nutzers auszuführen!
Wenn der Nutzer dich darum bittet (z. B. "erstelle einen Abschnitt", "füge Aufgabe X hinzu", "erinnere mich an...", "lege ein Projekt an", "hake Aufgabe Y ab"), antworte zuerst freundlich im Text und hänge AM ENDE deiner Antwort zwingend einen JSON-Aktionsblock im folgenden Format an:

\`\`\`focusflow-action
{
  "actions": [
    // Wähle eine oder mehrere passende Aktionen:
    
    // 1. Neuen Abschnitt (Phase) zu bestehendem Projekt hinzufügen:
    {
      "type": "ADD_PHASE",
      "projectId": "id_des_projekts",
      "phaseTitle": "Titel des Abschnitts",
      "dateInfo": "Zeitraum (z. B. '15.09. – 30.09.' oder 'Demnächst')",
      "description": "Optionale Beschreibung",
      "tasks": [
        { "title": "Aufgabe 1", "date": "18.09.26", "note": "Optionale Notiz" },
        { "title": "Aufgabe 2", "date": "22.09.26" }
      ]
    },

    // 2. Neue Aufgabe zu bestehender Phase / Projekt hinzufügen:
    {
      "type": "ADD_TASK",
      "projectId": "id_des_projekts",
      "phaseId": "optionale_phase_id",
      "title": "Titel der Aufgabe",
      "date": "Fälligkeitsdatum (z. B. '05.09.26' oder 'Demnächst')",
      "note": "Optionale Notiz"
    },

    // 3. Neue Erinnerung erstellen:
    {
      "type": "CREATE_REMINDER",
      "title": "Titel der Erinnerung",
      "description": "Optionale Beschreibung / Notizen",
      "date": "YYYY-MM-DD (oder 'Demnächst')",
      "time": "HH:MM (oder leer)",
      "priority": "hoch" | "mittel" | "niedrig"
    },

    // 4. Neues Projekt mit Phasen erstellen:
    {
      "type": "CREATE_PROJECT",
      "title": "Projektname",
      "description": "Projektbeschreibung",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "phases": [
        {
          "title": "Phase 1: Vorbereitung",
          "dateInfo": "Aktuell",
          "tasks": [
            { "title": "Erste Aufgabe", "date": "01.09.26" }
          ]
        }
      ]
    },

    // 5. Notiz zu Projekt oder Erinnerung hinzufügen:
    {
      "type": "CREATE_NOTE",
      "targetType": "project" | "reminder",
      "targetId": "id_des_projekts_oder_der_erinnerung",
      "title": "Titel der Notiz",
      "content": "<p>Inhalt der Notiz (HTML / strukturierter Text)</p>"
    },

    // 6. Material oder Link zu Projekt-Abschnitt hinzufügen:
    {
      "type": "ADD_MATERIAL",
      "projectId": "id_des_projekts",
      "phaseId": "optionale_phase_id",
      "name": "Name des Materials oder Links",
      "url": "https://... (oder Link-Ziel)",
      "type": "link" | "document" | "note"
    },

    // 7. Projektdetails & Zeitplan anpassen (Start-/Enddatum, Beschreibung, Titel):
    {
      "type": "UPDATE_PROJECT",
      "projectId": "id_des_projekts",
      "title": "Neuer Projektname (optional)",
      "description": "Neue Beschreibung (optional)",
      "startDate": "YYYY-MM-DD (optional)",
      "endDate": "YYYY-MM-DD (optional)"
    },

    // 8. Erinnerungsdetails anpassen (Datum, Uhrzeit, Beschreibung, Priorität):
    {
      "type": "UPDATE_REMINDER",
      "reminderId": "id_der_erinnerung",
      "title": "Neuer Titel (optional)",
      "description": "Neue Beschreibung (optional)",
      "date": "YYYY-MM-DD (optional)",
      "time": "HH:MM (optional)",
      "priority": "hoch" | "mittel" | "niedrig" (optional)
    },

    // 9. Aufgabe als erledigt markieren:
    {
      "type": "TOGGLE_TASK",
      "projectId": "id_des_projekts",
      "taskId": "id_der_aufgabe"
    },

    // 10. Projekt- oder Erinnerungs-Status ändern:
    {
      "type": "SET_PROJECT_STATUS",
      "projectId": "id_des_projekts",
      "status": "GEPLANT" | "AKTIV" | "ABGESCHLOSSEN"
    },
    {
      "type": "SET_REMINDER_STATUS",
      "reminderId": "id_der_erinnerung",
      "status": "GEPLANT" | "AKTIV" | "ABGESCHLOSSEN"
    }
  ]
}
\`\`\`

WICHTIG:
- Verwende für 'projectId', 'phaseId' oder 'taskId' immer die echten IDs aus dem oben übergebenen Kontext.
- Falls der Nutzer sich auf ein Projekt bezieht, nimm dessen ID aus dem Datenbestand.
- Verwende für 'phaseTitle' (Abschnitt) EXAKT die vom Nutzer gewünschte Bezeichnung (z. B. 'Neu', 'Konzept', 'Design'), OHNE künstlich Präfixe wie 'Phase 04:' davorzuschreiben!
- Verwende in deinen deutschen Antworten immer den Begriff 'Abschnitt' (oder 'Etappe') anstelle von 'Phase'.
- Formuliere deine Textantwort positiv und bestätigend (z. B. "Ich habe den Abschnitt '...' mit X Aufgaben zum Projekt '...' hinzugefügt!"), da der Aktionsblock direkt nach deiner Antwort ausgeführt wird.
`;

/**
 * Parses any ```focusflow-action ``` block from the AI's response text.
 * Returns the cleaned text (without raw JSON block) and the parsed actions array.
 */
export function parseAiActions(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: rawText || '', actions: [] };
  }

  const actionBlockRegex = /```focusflow-action\s*([\s\S]*?)\s*```/;
  const match = rawText.match(actionBlockRegex);

  if (!match) {
    // Also support fallback ```json action
    const fallbackRegex = /```json\s*(\{\s*"actions"\s*:\s*\[[\s\S]*?\]\s*\})\s*```/;
    const fallbackMatch = rawText.match(fallbackRegex);
    if (!fallbackMatch) {
      return { cleanText: rawText, actions: [] };
    }
    try {
      const parsed = JSON.parse(fallbackMatch[1]);
      const cleanText = rawText.replace(fallbackRegex, '').trim();
      return {
        cleanText,
        actions: Array.isArray(parsed?.actions) ? parsed.actions : []
      };
    } catch (e) {
      return { cleanText: rawText, actions: [] };
    }
  }

  try {
    const jsonStr = match[1].trim();
    const parsed = JSON.parse(jsonStr);
    const cleanText = rawText.replace(actionBlockRegex, '').trim();
    return {
      cleanText,
      actions: Array.isArray(parsed?.actions) ? parsed.actions : []
    };
  } catch (err) {
    console.warn('[ActionEngine] Fehler beim Parsen des Aktionsblocks:', err);
    return { cleanText: rawText, actions: [] };
  }
}

/**
 * Executes an array of actions against the application state via ModalContext handlers.
 * Returns an array of execution results for interactive UI rendering.
 */
export async function executeAiActions(actions, modalContext, projects = [], reminders = []) {
  if (!Array.isArray(actions) || actions.length === 0 || !modalContext) {
    return [];
  }

  const {
    mutateProject,
    addProject,
    addReminder,
    setProjectStatus,
    setReminderStatus
  } = modalContext;

  const results = [];

  for (const act of actions) {
    try {
      if (act.type === 'ADD_PHASE') {
        const targetProj = projects.find(p => p.id === act.projectId) || projects[0];
        if (!targetProj || !mutateProject) continue;

        const phaseTitle = (act.phaseTitle || act.title || 'Neuer Abschnitt').trim();
        const dateInfo = act.dateInfo || 'Demnächst';
        const description = act.description || '';
        const taskList = Array.isArray(act.tasks) ? act.tasks : [];

        mutateProject(targetProj.id, (proj) => {
          const newPhaseId = `ph_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

          const createdTasks = taskList.map((t, idx) => ({
            id: `t_${Date.now()}_${idx}`,
            title: (typeof t === 'string' ? t : t.title || '').trim(),
            date: (typeof t === 'object' && t.date) ? t.date.trim() : 'Demnächst',
            completed: false,
            note: (typeof t === 'object' && t.note) ? t.note.trim() : ''
          })).filter(t => t.title);

          const newPhase = {
            id: newPhaseId,
            title: phaseTitle,
            dateInfo,
            completed: false,
            description,
            tasks: createdTasks,
            materials: []
          };

          const updatedPhases = [...(proj.phases || []), newPhase];
          const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
          const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter(tk => tk.completed).length : 0), 0);

          const historyEntry = {
            id: `h_${Date.now()}`,
            date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
            title: `Abschnitt durch Fio angelegt: '${phaseTitle}'`,
            category: 'Neuer Abschnitt (Fio KI)',
            icon: 'auto_awesome',
            badgeBg: 'bg-primary text-white'
          };

          return {
            ...proj,
            phasesTotal: updatedPhases.length,
            tasksTotal: totalTasks,
            tasksCompleted: completedTasks,
            phases: updatedPhases,
            history: [historyEntry, ...(proj.history || [])]
          };
        });

        results.push({
          type: 'ADD_PHASE',
          success: true,
          title: `Abschnitt „${phaseTitle}“ erstellt`,
          subtitle: `${taskList.length} Aufgabe(n) zu „${targetProj.title}“ hinzugefügt`,
          targetType: 'project',
          targetId: targetProj.id,
          targetTitle: targetProj.title
        });
      }

      else if (act.type === 'ADD_TASK') {
        const targetProj = projects.find(p => p.id === act.projectId) || projects[0];
        if (!targetProj || !mutateProject) continue;

        const taskTitle = act.title ? act.title.trim() : 'Neue Aufgabe';
        const taskDate = act.date ? act.date.trim() : 'Demnächst';
        const taskNote = act.note ? act.note.trim() : '';

        mutateProject(targetProj.id, (proj) => {
          let targetPhaseId = act.phaseId;
          if (!targetPhaseId && proj.phases?.length > 0) {
            const uncompleted = proj.phases.find(p => !p.completed);
            targetPhaseId = uncompleted ? uncompleted.id : proj.phases[proj.phases.length - 1].id;
          }
          if (!targetPhaseId) return proj;

          const newTask = {
            id: `t_${Date.now()}`,
            title: taskTitle,
            date: taskDate,
            completed: false,
            note: taskNote
          };

          let phaseName = '';
          const updatedPhases = (proj.phases || []).map(ph => {
            if (ph.id !== targetPhaseId) return ph;
            phaseName = ph.title;
            return { ...ph, tasks: [...(ph.tasks || []), newTask] };
          });

          const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
          const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter(tk => tk.completed).length : 0), 0);

          const historyEntry = {
            id: `h_${Date.now()}`,
            date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
            title: `Aufgabe durch Fio hinzugefügt: '${taskTitle}'`,
            category: phaseName || 'Aufgabe (Fio KI)',
            icon: 'auto_awesome',
            badgeBg: 'bg-primary text-white'
          };

          return {
            ...proj,
            tasksTotal: totalTasks,
            tasksCompleted: completedTasks,
            phases: updatedPhases,
            history: [historyEntry, ...(proj.history || [])]
          };
        });

        results.push({
          type: 'ADD_TASK',
          success: true,
          title: `Aufgabe „${taskTitle}“ angelegt`,
          subtitle: `Zu „${targetProj.title}“ (${taskDate}) hinzugefügt`,
          targetType: 'project',
          targetId: targetProj.id,
          targetTitle: targetProj.title
        });
      }

      else if (act.type === 'CREATE_REMINDER') {
        if (!addReminder) continue;
        const newRemId = await addReminder({
          title: act.title || 'Neue Erinnerung',
          description: act.description || '',
          date: act.date || 'Demnächst',
          time: act.time || '',
          priority: act.priority || 'mittel',
          categoryId: act.categoryId || 'allgemein'
        });

        results.push({
          type: 'CREATE_REMINDER',
          success: true,
          title: `Erinnerung „${act.title}“ erstellt`,
          subtitle: `${act.date || 'Demnächst'}${act.time ? ` um ${act.time} Uhr` : ''}`,
          targetType: 'reminder',
          targetId: newRemId,
          targetTitle: act.title
        });
      }

      else if (act.type === 'CREATE_PROJECT') {
        if (!addProject) continue;
        const phases = Array.isArray(act.phases) ? act.phases.map((ph, idx) => {
          const pTitle = (ph.title || `Abschnitt ${idx + 1}`).trim();
          const tasks = Array.isArray(ph.tasks) ? ph.tasks.map((tk, tIdx) => ({
            id: `t_${Date.now()}_${idx}_${tIdx}`,
            title: (typeof tk === 'string' ? tk : tk.title || '').trim(),
            date: (typeof tk === 'object' && tk.date) ? tk.date.trim() : 'Demnächst',
            completed: false,
            note: (typeof tk === 'object' && tk.note) ? tk.note.trim() : ''
          })).filter(t => t.title) : [];

          return {
            id: `ph_${Date.now()}_${idx}`,
            title: pTitle,
            dateInfo: ph.dateInfo || (idx === 0 ? 'Aktuell' : 'Geplant'),
            completed: false,
            description: ph.description || '',
            tasks,
            materials: []
          };
        }) : [];

        const newProjId = await addProject({
          title: act.title || 'Neues Projekt',
          description: act.description || '',
          startDate: act.startDate || new Date().toISOString().split('T')[0],
          endDate: act.endDate || '',
          categoryId: act.categoryId || 'allgemein',
          phases
        });

        results.push({
          type: 'CREATE_PROJECT',
          success: true,
          title: `Projekt „${act.title}“ erfolgreich erstellt`,
          subtitle: `${phases.length} Phase(n) initialisiert`,
          targetType: 'project',
          targetId: newProjId,
          targetTitle: act.title
        });
      }

      else if (act.type === 'CREATE_NOTE') {
        const targetType = act.targetType || (act.reminderId ? 'reminder' : 'project');
        const targetId = act.targetId || act.projectId || act.reminderId;
        const noteTitle = (act.title || 'Neue Notiz').trim();
        const noteContent = act.content ? (act.content.startsWith('<') ? act.content : `<p>${act.content}</p>`) : '<p>Kein Inhalt</p>';

        const newNote = {
          id: `n_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: noteTitle,
          content: noteContent,
          source: 'ai_coach',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (targetType === 'reminder' || (!act.projectId && reminders.some(r => r.id === targetId))) {
          const targetRem = reminders.find(r => r.id === targetId) || reminders[0];
          if (targetRem && mutateReminder) {
            mutateReminder(targetRem.id, (rem) => {
              const updatedNotes = [...(rem.notes || []), newNote];
              const historyEntry = {
                id: `h_${Date.now()}`,
                date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
                title: `Notiz durch Fio angelegt: '${noteTitle}'`,
                category: 'Notiz (Fio KI)',
                icon: 'note_add',
                badgeBg: 'bg-primary text-white'
              };
              return {
                ...rem,
                notes: updatedNotes,
                history: [historyEntry, ...(rem.history || [])]
              };
            });

            results.push({
              type: 'CREATE_NOTE',
              success: true,
              title: `Notiz „${noteTitle}“ erstellt`,
              subtitle: `Zur Erinnerung „${targetRem.title}“ hinzugefügt`,
              targetType: 'reminder',
              targetId: targetRem.id,
              targetTitle: targetRem.title
            });
          }
        } else {
          const targetProj = projects.find(p => p.id === targetId) || projects[0];
          if (targetProj && mutateProject) {
            mutateProject(targetProj.id, (proj) => {
              const updatedNotes = [...(proj.notes || []), newNote];
              const historyEntry = {
                id: `h_${Date.now()}`,
                date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
                title: `Notiz durch Fio angelegt: '${noteTitle}'`,
                category: 'Notiz (Fio KI)',
                icon: 'note_add',
                badgeBg: 'bg-primary text-white'
              };
              return {
                ...proj,
                notes: updatedNotes,
                history: [historyEntry, ...(proj.history || [])]
              };
            });

            results.push({
              type: 'CREATE_NOTE',
              success: true,
              title: `Notiz „${noteTitle}“ erstellt`,
              subtitle: `Zum Projekt „${targetProj.title}“ hinzugefügt`,
              targetType: 'project',
              targetId: targetProj.id,
              targetTitle: targetProj.title
            });
          }
        }
      }

      else if (act.type === 'ADD_MATERIAL') {
        const targetProj = projects.find(p => p.id === act.projectId) || projects[0];
        if (targetProj && mutateProject) {
          let targetPhaseId = act.phaseId;
          if (!targetPhaseId && targetProj.phases?.length > 0) {
            const uncompleted = targetProj.phases.find(p => !p.completed);
            targetPhaseId = uncompleted ? uncompleted.id : targetProj.phases[0].id;
          }

          const matName = (act.name || act.title || 'Neues Material').trim();
          const matUrl = act.url || act.link || null;
          const matType = act.type || (matUrl ? 'link' : 'document');

          let phaseTitle = '';
          mutateProject(targetProj.id, (proj) => {
            const updatedPhases = (proj.phases || []).map(phase => {
              if (phase.id !== targetPhaseId) return phase;
              phaseTitle = phase.title;
              const newMaterial = {
                id: `m_${Date.now()}`,
                name: matName,
                type: matType,
                url: matUrl,
                content: act.content || null
              };
              return { ...phase, materials: [...(phase.materials || []), newMaterial] };
            });

            const historyEntry = {
              id: `h_${Date.now()}`,
              date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
              title: `Material/Link hinzugefügt: '${matName}'`,
              category: phaseTitle || 'Material (Fio KI)',
              icon: 'attach_file',
              badgeBg: 'bg-primary text-white'
            };

            return { ...proj, phases: updatedPhases, history: [historyEntry, ...(proj.history || [])] };
          });

          results.push({
            type: 'ADD_MATERIAL',
            success: true,
            title: `Material / Link „${matName}“ hinzugefügt`,
            subtitle: `Zu „${targetProj.title}“ (${phaseTitle || 'Abschnitt'}) verknüpft`,
            targetType: 'project',
            targetId: targetProj.id,
            targetTitle: targetProj.title
          });
        }
      }

      else if (act.type === 'UPDATE_PROJECT') {
        const targetProj = projects.find(p => p.id === act.projectId) || projects[0];
        if (targetProj && mutateProject) {
          const updates = {};
          if (act.title) updates.title = act.title.trim();
          if (act.description !== undefined) updates.description = act.description.trim();
          if (act.startDate) updates.startDate = act.startDate.trim();
          if (act.endDate) updates.endDate = act.endDate.trim();
          if (act.categoryId) updates.categoryId = act.categoryId;

          mutateProject(targetProj.id, (proj) => {
            const historyEntry = {
              id: `h_${Date.now()}`,
              date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
              title: `Projektdetails durch Fio aktualisiert`,
              category: 'Aktualisierung (Fio KI)',
              icon: 'edit_note',
              badgeBg: 'bg-primary text-white'
            };
            return {
              ...proj,
              ...updates,
              history: [historyEntry, ...(proj.history || [])]
            };
          });

          results.push({
            type: 'UPDATE_PROJECT',
            success: true,
            title: `Projekt „${updates.title || targetProj.title}“ aktualisiert`,
            subtitle: `Details & Zeitraum angepasst`,
            targetType: 'project',
            targetId: targetProj.id,
            targetTitle: targetProj.title
          });
        }
      }

      else if (act.type === 'UPDATE_REMINDER') {
        const targetRem = reminders.find(r => r.id === act.reminderId) || reminders[0];
        if (targetRem && mutateReminder) {
          const updates = {};
          if (act.title) updates.title = act.title.trim();
          if (act.description !== undefined) updates.description = act.description.trim();
          if (act.date) updates.date = act.date.trim();
          if (act.time !== undefined) updates.time = act.time.trim();
          if (act.priority) updates.priority = act.priority;
          if (act.categoryId) updates.categoryId = act.categoryId;

          mutateReminder(targetRem.id, (rem) => {
            const historyEntry = {
              id: `h_${Date.now()}`,
              date: `${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
              title: `Erinnerungsdetails durch Fio aktualisiert`,
              category: 'Aktualisierung (Fio KI)',
              icon: 'edit_note',
              badgeBg: 'bg-primary text-white'
            };
            return {
              ...rem,
              ...updates,
              history: [historyEntry, ...(rem.history || [])]
            };
          });

          results.push({
            type: 'UPDATE_REMINDER',
            success: true,
            title: `Erinnerung „${updates.title || targetRem.title}“ aktualisiert`,
            subtitle: `${updates.date || targetRem.date || 'Termin'}${updates.time || targetRem.time ? ` um ${updates.time || targetRem.time} Uhr` : ''}`,
            targetType: 'reminder',
            targetId: targetRem.id,
            targetTitle: targetRem.title
          });
        }
      }

      else if (act.type === 'TOGGLE_TASK') {
        const targetProj = projects.find(p => p.id === act.projectId) || projects[0];
        if (!targetProj || !mutateProject) continue;

        let toggledTitle = '';
        mutateProject(targetProj.id, (proj) => {
          const updatedPhases = (proj.phases || []).map(phase => {
            const updatedTasks = (phase.tasks || []).map(t => {
              if (t.id === act.taskId || (act.taskTitle && t.title.toLowerCase().includes(act.taskTitle.toLowerCase()))) {
                toggledTitle = t.title;
                return { ...t, completed: true };
              }
              return t;
            });

            const completedInPhase = updatedTasks.filter(t => t.completed).length;
            const totalInPhase = updatedTasks.length;
            const allPhaseTasksCompleted = totalInPhase > 0 && completedInPhase === totalInPhase;

            return {
              ...phase,
              completed: allPhaseTasksCompleted,
              tasks: updatedTasks
            };
          });

          const totalTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.length : 0), 0);
          const completedTasks = updatedPhases.reduce((acc, p) => acc + (p.tasks ? p.tasks.filter(t => t.completed).length : 0), 0);
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : proj.progress;

          return {
            ...proj,
            progress: progressPercent,
            tasksCompleted: completedTasks,
            phases: updatedPhases
          };
        });

        results.push({
          type: 'TOGGLE_TASK',
          success: true,
          title: `Aufgabe erledigt`,
          subtitle: `„${toggledTitle || 'Aufgabe'}“ in „${targetProj.title}“ abgehakt`,
          targetType: 'project',
          targetId: targetProj.id,
          targetTitle: targetProj.title
        });
      }

      else if (act.type === 'SET_PROJECT_STATUS') {
        if (setProjectStatus && act.projectId && act.status) {
          setProjectStatus(act.projectId, act.status);
          const p = projects.find(pr => pr.id === act.projectId);
          results.push({
            type: 'SET_PROJECT_STATUS',
            success: true,
            title: `Projekt-Status geändert`,
            subtitle: `„${p?.title || 'Projekt'}“ ist jetzt ${act.status}`,
            targetType: 'project',
            targetId: act.projectId,
            targetTitle: p?.title
          });
        }
      }

      else if (act.type === 'SET_REMINDER_STATUS') {
        if (setReminderStatus && act.reminderId && act.status) {
          setReminderStatus(act.reminderId, act.status);
          const r = reminders.find(rem => rem.id === act.reminderId);
          results.push({
            type: 'SET_REMINDER_STATUS',
            success: true,
            title: `Erinnerungs-Status geändert`,
            subtitle: `„${r?.title || 'Erinnerung'}“ ist jetzt ${act.status}`,
            targetType: 'reminder',
            targetId: act.reminderId,
            targetTitle: r?.title
          });
        }
      }
    } catch (err) {
      console.error('[ActionEngine] Fehler beim Ausführen einer Aktion:', err, act);
    }
  }

  return results;
}
