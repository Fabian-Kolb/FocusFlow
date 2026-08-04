const fs = require('fs');
const path = require('path');

const mockDataPath = 'c:/Users/Fabia/Desktop/Eigene_Projekte/vibe_codeing/focusflow/src/data/mockData.js';

let content = fs.readFileSync(mockDataPath, 'utf8');

// Generate realistic p1
const generateTasks = (count, startIndex, completedCount) => {
    let tasks = [];
    for(let i=0; i<count; i++) {
        tasks.push({
            id: `t_${Date.now()}_${startIndex + i}`,
            title: `Task ${startIndex + i}`,
            date: "Geplant: Irgendwann",
            completed: i < completedCount,
            note: "",
            links: []
        });
    }
    return tasks;
};

// p1 has 3 phases. 1 completed. 20 tasks total. 9 completed.
// Phase 1 (completed): 9 tasks, all completed.
// Phase 2 (not completed): 6 tasks, 0 completed.
// Phase 3 (not completed): 5 tasks, 0 completed.
const p1Phases = [
    {
        id: "ph1",
        phaseNum: "Phase 01",
        title: "Vorbereitung & Analyse",
        badgeText: "ERLEDIGT",
        completed: true,
        materials: [{ id: "pm1", name: "Briefing-Dokument.pdf", url: "#" }],
        tasks: generateTasks(9, 1, 9)
    },
    {
        id: "ph2",
        phaseNum: "Phase 02",
        title: "Konzept & Design",
        badgeText: "0/6 ERLEDIGT",
        completed: false,
        materials: [],
        tasks: generateTasks(6, 10, 0)
    },
    {
        id: "ph3",
        phaseNum: "Phase 03",
        title: "Umsetzung & Launch",
        badgeText: "0/5 ERLEDIGT",
        completed: false,
        materials: [],
        tasks: generateTasks(5, 16, 0)
    }
];

// p2 has 5 phases. 0 completed. 45 tasks total. 2 completed.
// Phase 1: 10 tasks, 2 completed.
// Phase 2: 10 tasks, 0 completed
// Phase 3: 10 tasks, 0 completed
// Phase 4: 10 tasks, 0 completed
// Phase 5: 5 tasks, 0 completed
const p2Phases = [
    {
        id: "p2_ph1", phaseNum: "Phase 01", title: "Marktforschung", badgeText: "2/10 ERLEDIGT", completed: false, materials: [], tasks: generateTasks(10, 1, 2)
    },
    {
        id: "p2_ph2", phaseNum: "Phase 02", title: "Partner-Identifikation", badgeText: "0/10 ERLEDIGT", completed: false, materials: [], tasks: generateTasks(10, 11, 0)
    },
    {
        id: "p2_ph3", phaseNum: "Phase 03", title: "Vertragsverhandlungen", badgeText: "0/10 ERLEDIGT", completed: false, materials: [], tasks: generateTasks(10, 21, 0)
    },
    {
        id: "p2_ph4", phaseNum: "Phase 04", title: "Infrastruktur-Aufbau", badgeText: "0/10 ERLEDIGT", completed: false, materials: [], tasks: generateTasks(10, 31, 0)
    },
    {
        id: "p2_ph5", phaseNum: "Phase 05", title: "Go-Live Vorbereitung", badgeText: "0/5 ERLEDIGT", completed: false, materials: [], tasks: generateTasks(5, 41, 0)
    }
];

// p3 (new) has 2 phases, 2 completed. 10 tasks total, 10 completed.
const p3Phases = [
    {
        id: "p3_ph1", phaseNum: "Phase 01", title: "Design System initialisieren", badgeText: "ERLEDIGT", completed: true, materials: [], tasks: generateTasks(5, 1, 5)
    },
    {
        id: "p3_ph2", phaseNum: "Phase 02", title: "Komponenten-Bibliothek", badgeText: "ERLEDIGT", completed: true, materials: [], tasks: generateTasks(5, 6, 5)
    }
];

const newProjectsArray = [
    {
        id: "p1",
        title: "Re-Branding 2024",
        status: "AKTIV",
        isPaused: false,
        inKanban: true,
        nextStep: "Nächste Etappe: Konzept & Design",
        dateRange: "12. APRIL – 30. JUNI 2024",
        daysRemaining: "NOCH 14 TAGE",
        progress: 45,
        timeElapsed: 68,
        tasksCountText: "(9 / 20 Tasks)",
        daysCountText: "(48 / 70 Tage)",
        phasesCompleted: 1,
        phasesTotal: 3,
        tasksCompleted: 9,
        tasksTotal: 20,
        warning: "⚠️ 4 TAGE RÜCKSTAND",
        recommendedSteps: [],
        materials: [],
        history: [],
        phases: p1Phases
    },
    {
        id: "p2",
        title: "Markteintritt APAC Expansion & Partnering",
        status: "GEPLANT",
        isPaused: false,
        inKanban: true,
        nextStep: "Verträge finalisieren",
        dateRange: "01.03.24 – 15.12.24",
        daysRemaining: "NOCH 5 MONATE",
        progress: 15,
        timeElapsed: 25,
        tasksCountText: "(2 / 45 Tasks)",
        daysCountText: "(45 / 180 Tage)",
        phasesCompleted: 0,
        phasesTotal: 5,
        tasksCompleted: 2,
        tasksTotal: 45,
        warning: null,
        recommendedSteps: [],
        materials: [],
        history: [],
        phases: p2Phases
    },
    {
        id: "p3",
        title: "Design System Update",
        status: "ABGESCHLOSSEN",
        isPaused: false,
        inKanban: true,
        nextStep: "Keine (Projekt abgeschlossen)",
        dateRange: "01.01.24 – 28.02.24",
        daysRemaining: "BEENDET",
        progress: 100,
        timeElapsed: 100,
        tasksCountText: "(10 / 10 Tasks)",
        daysCountText: "(59 / 59 Tage)",
        phasesCompleted: 2,
        phasesTotal: 2,
        tasksCompleted: 10,
        tasksTotal: 10,
        warning: null,
        recommendedSteps: [],
        materials: [],
        history: [],
        phases: p3Phases
    }
];

// we need to replace the export const projects = [...] with this new array
const startStr = 'export const projects = [';
const startIndex = content.indexOf(startStr);
const endStr = 'export const calendarTimeline = [';
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find start or end index for projects array.");
    process.exit(1);
}

// Find the precise end of the projects array (the '];' before calendarTimeline)
const beforeProjects = content.substring(0, startIndex);
const afterProjects = content.substring(endIndex);

// wait, between end of projects array and calendarTimeline might be some lines.
// We'll just construct the new file content.
const newContent = beforeProjects + 'export const projects = ' + JSON.stringify(newProjectsArray, null, 2) + ';\n\n' + afterProjects;

fs.writeFileSync(mockDataPath, newContent);
console.log("mockData updated successfully");
