// src/lib/aiActionEngine.js
// Fio AI Action Engine: Tool Calling & Real-Time App Actions
// Allows Fio to create & mutate projects, phases, tasks, reminders, and statuses directly in the app state.

import { createCalendarEvent } from './calendarAPI';
import { parseDateToGooglePayload } from './calendarSyncService';

/**
 * System prompt guidelines instructing Gemini on how to format actions.
 */
export const ACTION_ENGINE_SYSTEM_PROMPT = `
AKTIONEN IN DER APP AUSFÜHREN (TOOL CAPABILITIES):
Du hast die Fähigkeit, echte Aktionen in der FocusFlow-App des Nutzers auszuführen!
Wenn Nutzer dich darum bittet (z. B. "erstelle einen Abschnitt", "füge Aufgabe X hinzu", "erinnere mich an...", "lege ein Projekt an", "hake Y ab"), antworte zuerst freundlich im Text und hänge AM ENDE deiner Antwort zwingend JSON-Aktionsblock folgenden Format an:

\`\`\`focusflow-action
{
  "actions": [
    // Wähle eine oder mehrere passende Aktionen:
    
 1. Neuen Abschnitt (Phase) zu bestehendem hinzufügen:

      "type": "ADD_PHASE",
      "projectId": "id_des_projekts",
      "phaseTitle": "Titel Abschnitts",
      "dateInfo": "Zeitraum '15.09. – 30.09.' 'Demnächst')",
      "description": "Optionale Beschreibung",
      "tasks":
 "title": "Aufgabe 1", "date": "18.09.26", "note": Notiz" },
   2", "22.09.26" }
      ]


 2. Neue bestehender Phase /

 "ADD_TASK",
 
      "phaseId": "optionale_phase_id",
   Aufgabe",
 "Fälligkeitsdatum '05.09.26'
  


 3. Erinnerung erstellen:

 "CREATE_REMINDER",
   Erinnerung",
  Beschreibung Notizen",
 "YYYY-MM-DD (oder
      "time": "HH:MM leer)",
      "priority": "hoch" | "mittel" "niedrig",
      "syncWithCalendar": true false = mit Google Kalender synchronisieren


 4. Termin direkt eintragen (ohne FocusFlow-Erinnerung):

 "CREATE_CALENDAR_EVENT",
   Kalendertermins",
  
 "YYYY-MM-DD",
  (optional)",
      "endTime": (optional)"


  Neues Phasen

 "CREATE_PROJECT",
 "Projektname",
 "Projektbeschreibung",
      "startDate":
      "endDate":
      "phases":

 "Phase 1: Vorbereitung",
 "Aktuell",
 
  "Erste "01.09.26"





 5. Notiz

 "CREATE_NOTE",
      "targetType": "project" "reminder",
      "targetId": "id_des_projekts_oder_der_erinnerung",
   Notiz",
      "content": "<p>Inhalt (HTML strukturierter Text)</p>"


 6. Material Link Projekt-Abschnitt

 "ADD_MATERIAL",
 
 
      "name": "Name Materials Links",
      "url": "https://... Link-Ziel)",
 "link" "document" "note"


 7. Projektdetails & Zeitplan anpassen (Start-/Enddatum, Beschreibung, Titel):

 "UPDATE_PROJECT",
 
 "Neuer Projektname
 "Neue
  
  


 8. Erinnerungsdetails (Datum, Uhrzeit, Priorität):

 "UPDATE_REMINDER",
      "reminderId": "id_der_erinnerung",
  Titel

  
  
  "niedrig" (optional)


 9. als erledigt markieren:

 "TOGGLE_TASK",
 
      "taskId": "id_der_aufgabe"


 10. Projekt- Erinnerungs-Status ändern:

 "SET_PROJECT_STATUS",
 
      "status": "GEPLANT" "AKTIV" "ABGESCHLOSSEN"


 "SET_REMINDER_STATUS",
 
  

  

\`\`\`

WICHTIG:
- Verwende für 'projectId', 'phaseId' 'taskId' immer echten IDs aus dem oben übergebenen Kontext.
 Falls sich auf bezieht, nimm dessen ID Datenbestand.
   'phaseTitle' (Abschnitt) EXAKT vom gewünschte Bezeichnung 'Neu', 'Konzept', 'Design'), OHNE künstlich Präfixe wie 'Phase 04:' davorzuschreiben!
   deinen deutschen Antworten den Begriff 'Abschnitt' 'Etappe') anstelle von 'Phase'.
 Formuliere deine Textantwort positiv bestätigend "Ich habe '...' Aufgaben zum hinzugefügt!"), da Aktionsblock nach ausgeführt wird.

SPEZIELLE REGELN FÜR DIE DREI SÄULEN (KALENDER, ERINNERUNGEN, PROJEKTE):
FocusFlow basiert drei gleichwertigen, zentralen Säulen:
 📅 KALENDER: Feste Termine, Zeitfenster Vorbereitungen anstehende Ereignisse.
 🔔 ERINNERUNGEN: Zeitkritische To-Dos Prioritäten Tag.
 🎯 PROJEKTE: Substantieller Fortschritt aktiven Vorhaben (konkrete Abschnitte Aufgaben).

WICHTIGE VERHALTENSREGELN TAGESPLANUNG „WAS SOLLTE ICH HEUTE NOCH MACHEN?“:
 PRÄZISION STATT REIZÜBERFLUTUNG (WENIGER IST MEHR):
 fragt „Was sollte ich heute noch machen?“, steht an?“, „Wie sieht mein Tag aus?“ fragt:
     Erstelle NIEMALS lange Liste aller Projekte Aufgaben! Keine Textwüsten.
 Gib WENIGER, aber dafür PRÄZISER aus: maximal 2 bis 3 konkrete, hochrelevante Fokus-Punkte aus.
 Strukturiere übersichtlich sofort scannbar Emojis:
  Kalender-Check: Heutige feste Termine + kurzer Blick morgen (insb. wenn Vorbereitung nötig ist).
  Fokus-Erinnerung: Maximal 1 (höchstens 2) dringende überfällige Erinnerungen.
  Projekt-Fokus: Genau wichtigster nächster Schritt relevantesten (nicht 5 gleichzeitig).

 PROAKTIVE KALENDER-ANALYSE VORBEREITUNGS-CHECK:
 Gehe aktiv ein! Prüfe vor allem MORGEN.
 Vorbereitungs-Check: Meeting, Präsentation, Arzt, Deadline, Kundengespräch) Projekten/Erinnerungen nichts dazu gemacht vorbereitet wurde:
     Weise aufmerksam, kurz charmant darauf hin B.: „📅 Kalender-Hinweis morgen: um 10:00 Uhr ‚Meeting X‘. Da keine Vorbereitungs-Aufgabe hinterlegt ist: Sollen wir 20 Minuten einplanen, Unterlagen vorzubereiten?“).

 RÜCKFRAGE ENDE:
 Schließe IMMER genau EINER konkreten, proaktiven Rückfrage ab, bezogen das empfohlene Projekt, vorgeschlagene morgigen Termin.
 Beispiele:
     „Möchtest du, dass [X] [Y] starten, soll dir Teilaufgaben anlegen?“
     „Sollen [Z] kurze Vorbereitungs-Erinnerung einplanen?“
 So kann per vertiefen gemeinsam planen.

  KALENDER-AKTIONEN:
  bittet, einzutragen "Trage am Freitag 14 Zahnarzt ein"), NICHT spezifiziert hat, ob nur FocusFlow, synchronisiert Kalender:
  Führe KEINE Aktion aus! Frage freundlich, welche Variante er wünscht:
   [Nur FocusFlow] (Lokale Erinnerung)
   [FocusFlow Kalender-Sync] (Erinnerung Empfohlen)
   Kalender] (Direkter Kalendertermin)
  Hänge Ende Markierung
  [INTENT_CHOICE: appointment YYYY-MM-DD HH:MM]
   2026-09-25 14:00])
 "FocusFlow Kalender-Sync" wählt "beides" "synchronisieren"), nutze "CREATE_REMINDER" true.
 "Nur FocusFlow" wählt, false.
 Kalender" "CREATE_CALENDAR_EVENT".
  Terminen ("Was meinem Kalender?", "Welche diese Woche?"), prüfe 'kalender.termine' heutigen 'erinnerungen' Kontext liste sie auf!
 Gastmodus Verbindung: 'kalender.verbunden' ist ist, weise ihn hin, nicht verknüpft lege lokale FocusFlow-Erinnerung an.
`;

/**
 * Extracts any [INTENT_CHOICE: type | title | date | time] marker from text.
 */
export function parseIntentChoice(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: rawText || '', intentChoice: null };
  }
  const match = rawText.match(/\[INTENT_CHOICE:\s*([^\]|]+)\s*\|\s*([^\]|]+)\s*\|\s*([^\]|]+)(?:\s*\|\s*([^\]]+))?\]/);
  if (!match) {
    return { cleanText: rawText, intentChoice: null };
  }
  const cleanText = rawText.replace(match[0], '').trim();
  return {
    cleanText,
    intentChoice: {
      type: match[1].trim(),
      title: match[2].trim(),
      date: match[3].trim(),
      time: (match[4] || '').trim()
    }
  };
}

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
            badgeBg: 'bg-accent text-on-accent'
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
            badgeBg: 'bg-accent text-on-accent'
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
        const syncWithCalendar = Boolean(act.syncWithCalendar);
        const newRemId = await addReminder({
          title: act.title || 'Neue Erinnerung',
          description: act.description || '',
          date: act.date || 'Demnächst',
          time: act.time || '',
          priority: act.priority || 'mittel',
          categoryId: act.categoryId || 'allgemein'
        }, { syncWithCalendar });

        results.push({
          type: 'CREATE_REMINDER',
          success: true,
          title: `Erinnerung „${act.title}“ erstellt`,
          subtitle: `${act.date || 'Demnächst'}${act.time ? ` um ${act.time} Uhr` : ''}${syncWithCalendar ? ' • Mit Google Kalender synchronisiert' : ''}`,
          targetType: 'reminder',
          targetId: newRemId,
          targetTitle: act.title,
          isCalendarSynced: syncWithCalendar
        });
      }

      else if (act.type === 'CREATE_CALENDAR_EVENT') {
        const title = act.title || act.summary || 'Neuer Termin';
        const description = act.description || '';
        const date = act.date || act.startDate || new Date().toISOString().split('T')[0];
        const time = act.time || act.startTime || '';
        const endTime = act.endTime || '';

        const payload = parseDateToGooglePayload({
          title,
          description,
          date,
          time,
          endTime
        });

        const created = await createCalendarEvent(payload);

        results.push({
          type: 'CREATE_CALENDAR_EVENT',
          success: true,
          title: `Google Kalendereintrag erstellt: „${title}“`,
          subtitle: `${date}${time ? ` um ${time} Uhr` : ' (Ganztägig)'}`,
          targetType: 'calendar',
          targetId: created?.id || 'cal_event',
          targetTitle: title,
          isOnlyCalendar: true
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
                badgeBg: 'bg-accent text-on-accent'
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
                badgeBg: 'bg-accent text-on-accent'
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
              badgeBg: 'bg-accent text-on-accent'
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
              badgeBg: 'bg-accent text-on-accent'
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
              badgeBg: 'bg-accent text-on-accent'
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
