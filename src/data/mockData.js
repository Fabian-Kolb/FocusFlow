export const inboxItems = {
  today: [
    {
      id: "i1",
      title: "- Richtlinien & Dokumentation für Design System lesen",
      completed: false
    },
    {
      id: "i2",
      title: "- Einkaufsliste für Server-Setup vorbereiten",
      completed: false
    }
  ],
  yesterday: [
    {
      id: "i3",
      title: "- Altes Software-Abonnement kündigen",
      completed: false
    }
  ]
};

export const projects = [
  {
    id: "p1",
    title: "Re-Branding 2024",
    status: "AKTIV",
    nextStep: "Nächste Etappe: Stakeholder Interviews führen",
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
    recommendedSteps: [
      {
        id: "rec1",
        num: 1,
        title: "Stakeholder Interviews führen",
        date: "Geplant: Freitag, 17. Mai",
        targetTaskId: "t2"
      },
      {
        id: "rec2",
        num: 2,
        title: "Deep Work: UI Design Prototyping",
        date: "Geplant: Nächste Woche",
        targetTaskId: "t3"
      }
    ],
    materials: [
      {
        id: "m1",
        name: "Briefing-Dokument.pdf",
        url: "#"
      }
    ],
    history: [
      {
        id: "h1",
        timestamp: "14. MAI 2024 • 16:30 Uhr",
        text: "Unterpunkt erledigt: 'Moodboard & Designinspo erstellen'",
        phase: "Phase 1: Vorbereitung & Analyse",
        icon: "check",
        iconStyle: "bg-emerald-100 border border-emerald-300 text-emerald-800"
      },
      {
        id: "h2",
        timestamp: "12. MAI 2024 • 11:15 Uhr",
        text: "Neues Phasenmaterial hinzugefügt: 'Briefing-Dokument.pdf'",
        phase: "Phase 1: Vorbereitung & Analyse",
        icon: "attach_file",
        iconStyle: "bg-surface-low border border-outline-variant text-primary"
      },
      {
        id: "h3",
        timestamp: "10. MAI 2024 • 09:00 Uhr",
        text: "Phase 1 gestartet: 'Vorbereitung & Analyse'",
        phase: "Projekt-Startschuss",
        icon: "flag",
        iconStyle: "bg-surface-low border border-outline-variant text-primary"
      },
      {
        id: "h4",
        timestamp: "12. APRIL 2024 • 10:00 Uhr",
        text: "Projekt 'Re-Branding 2024' erfolgreich angelegt",
        phase: "Gesamtdauer: 70 Tage (Deadline: 30. Juni)",
        icon: "rocket_launch",
        iconStyle: "bg-primary text-white"
      }
    ],
    phases: [
      {
        id: "ph1",
        phaseNum: "Phase 01",
        title: "Vorbereitung & Analyse",
        badgeText: "1/2 ERLEDIGT",
        completed: false,
        materials: [
          {
            id: "pm1",
            name: "Briefing-Dokument.pdf",
            url: "#"
          }
        ],
        tasks: [
          {
            id: "t1",
            title: "Moodboard & Designinspo erstellen",
            date: "Geplant: 14. Mai 2024",
            completed: true,
            note: "",
            links: [
              {
                id: "l1",
                name: "Pinterest Board",
                url: "#"
              }
            ]
          },
          {
            id: "t2",
            title: "Stakeholder Interviews führen",
            date: "Geplant: Freitag, 17. Mai",
            completed: false,
            note: "Fr. Schmidt bevorzugt Termine ab 14 Uhr. Fragenkatalog V2 für das Gespräch nutzen.",
            links: []
          }
        ]
      },
      {
        id: "ph2",
        phaseNum: "Phase 02",
        title: "Konzept & Design",
        badgeText: "0/1 ERLEDIGT",
        completed: false,
        materials: [],
        tasks: [
          {
            id: "t3",
            title: "Deep Work: UI Design Prototyping",
            date: "Geplant: Nächste Woche",
            completed: false,
            note: "",
            links: []
          }
        ]
      }
    ]
  },
  {
    id: "p2",
    title: "Markteintritt APAC Expansion & Partnering",
    status: "LAUFEND",
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
    phases: []
  }
];

export const calendarTimeline = [
  {
    id: "c1",
    time: "09:00",
    title: "Fokus-Session: Deep Work",
    description: "Geplante Aufgaben abarbeiten",
    type: "primary"
  },
  {
    id: "c2",
    time: "14:00",
    title: "Review & Checkpoint",
    description: "Tagesfortschritt dokumentieren",
    type: "outline"
  }
];

export const calendarEvents = {
  8: [
    {
      id: "ce1",
      time: "14:00",
      title: "Workshop"
    }
  ]
};

export const chatSessions = [
  {
    id: "cs1",
    title: "Re-Branding Start-Hilfe",
    dateText: "Heute • 2 Nachrichten",
    active: true
  },
  {
    id: "cs2",
    title: "Inbox-Priorisierung",
    dateText: "Gestern • 4 Nachrichten",
    active: false
  }
];

export const chatHistory = [
  {
    id: "ch1",
    sender: "bot",
    text: "Hallo! Ich bin dein FocusFlow AI Coach. Stelle mir eine Frage oder wähle einen Fokus-Filter oben aus."
  }
];

export const quickPrompts = [
  {
    id: "qp1",
    label: "⚡ Blockade lösen",
    promptText: "Ich habe gerade eine Blockade. Was ist der kleinste erste Schritt?"
  },
  {
    id: "qp2",
    label: "🎯 Naechsten Schritt finden",
    promptText: "Welche Aufgabe sollte ich heute zuerst erledigen?"
  },
  {
    id: "qp3",
    label: "📥 Inbox sortieren",
    promptText: "Hilf mir, meine Inbox zu priorisieren."
  }
];

export const weeklyReport = {
  weekLabel: "BERICHT KW 19",
  title: "Dein Erfolg dieser Woche",
  subtitle: "Überblick über deine Ergebnisse und fertigen Meilensteine (keine Zeitmessung).",
  dailyStats: [
    { day: "MON", heightPct: 45, isWeekend: false },
    { day: "DIE", heightPct: 70, isWeekend: false },
    { day: "MIT", heightPct: 95, isWeekend: false },
    { day: "DON", heightPct: 50, isWeekend: false },
    { day: "FRE", heightPct: 80, isWeekend: false },
    { day: "SAM", heightPct: 25, isWeekend: true },
    { day: "SON", heightPct: 15, isWeekend: true }
  ],
  totalCompletedTasks: 48,
  totalMilestones: 3,
  successRatePct: 85,
  topAchievements: [
    "Phase 1: Vorbereitung 'Re-Branding' abgeschlossen",
    "Q2 Finanzbericht Meilenstein 2 erreicht",
    "12 Inbox-Gedanken verarbeitet & zugeordnet"
  ]
};

export const reminders = [
  {
    id: "r1",
    title: "Steuerberater Unterlagen senden",
    date: "15.08.24",
    status: "active",
    note: "Q2 Belege fehlen noch."
  },
  {
    id: "r2",
    title: "Domain verlängern",
    date: "01.09.24",
    status: "active",
    note: "focusflow.app läuft aus."
  },
  {
    id: "r3",
    title: "Neuen Monitor bestellen",
    date: "05.08.24",
    status: "inactive",
    note: "Warte auf Black Friday Angebote."
  }
];
