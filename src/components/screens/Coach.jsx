import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { askGeminiCoach } from '../../lib/gemini';
import { ACTION_ENGINE_SYSTEM_PROMPT, parseAiActions, executeAiActions, parseIntentChoice } from '../../lib/aiActionEngine';
import { fetchCalendarEvents } from '../../lib/calendarAPI';
import { notify } from '../../lib/notify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FioIcon from '../ui/FioIcon';
import ModelSelectorDropdown from '../ui/ModelSelectorDropdown';
import ProjectDraftCard from '../ui/ProjectDraftCard';
import { reviseDraftWithFio, draftToProjectData, clearNewFlags, DETAIL_LEVELS } from '../../lib/projectDraft';

const Coach = ({ setCurrentScreen }) => {
  const modalContext = useModalContext();
  const { projects, reminders = [], setSelectedProjectId, setSelectedReminderId, isCalendarConnected, openModal, addProject, projectCategories = [] } = modalContext;
  const { user } = useAuth();
  const {
    sessions,
    activeSession,
    activeSessionId,
    activeModel,
    setActiveModel,
    createNewSession,
    selectSession,
    deleteSession,
    addMessageToSession,
    removeSessionAttachment,
    updateStreamingMessage,
    updateSessionDraft,
    queuedPrompt,
    takeQueuedPrompt
  } = useChat();

  // Entwurfs-Chat "Projektanlegung: …"
  const isDraftSession = activeSession?.contextScope === 'draft';
  const draftAwaitingDetail = isDraftSession && !!activeSession.draftAwaitingDetail;
  const draftOpen = isDraftSession && activeSession.draftStatus === 'open' && !draftAwaitingDetail;

  const [isHistoryOpen, setIsHistoryOpen] = useState(() => {
    const saved = localStorage.getItem('focusflow_coach_history');
    if (saved !== null) return JSON.parse(saved);
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    localStorage.setItem('focusflow_coach_history', JSON.stringify(isHistoryOpen));
  }, [isHistoryOpen]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionSearchText, setSessionSearchText] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    if (!isCalendarConnected || user?.isGuest) return;
    const now = new Date();
    // Vorzugsweise gesamte anstehende Terminspanne laden, Fallback auf aktuellen Monat
    fetchCalendarEvents()
      .then((events) => {
        setCalendarEvents(events || []);
      })
      .catch(() => {
        fetchCalendarEvents(now.getFullYear(), now.getMonth())
          .then((events) => {
            setCalendarEvents(events || []);
          })
          .catch((err) => {
            console.warn('Konnte Kalenderevents für Fio-Kontext nicht laden:', err);
          });
      });
  }, [isCalendarConnected, user?.isGuest]);
  
  // 1. SIDEBAR FILTER & SEARCH (Filtert die Chatverlauf-Liste auf der linken Seite)
  const [isSidebarFilterModalOpen, setIsSidebarFilterModalOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarScopeFilter, setSidebarScopeFilter] = useState('all'); // 'all' | 'general' | projectId | reminderId
  const [showAllSidebarProjects, setShowAllSidebarProjects] = useState(false);
  const [showAllSidebarReminders, setShowAllSidebarReminders] = useState(false);

  // 2. KI-KONTEXT & ANHÄNGE (Wählt aus, welche Daten der KI als Kontext übergeben werden)
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [contextModalSearch, setContextModalSearch] = useState('');
  const [isAllContextSelected, setIsAllContextSelected] = useState(true);
  const [isGeneralOnlySelected, setIsGeneralOnlySelected] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedReminderIds, setSelectedReminderIds] = useState([]);
  const [isCalendarContextSelected, setIsCalendarContextSelected] = useState(false);
  const [selectedCalendarEventIds, setSelectedCalendarEventIds] = useState([]);
  const [showAllContextProjects, setShowAllContextProjects] = useState(false);
  const [showAllContextReminders, setShowAllContextReminders] = useState(false);
  const [showAllContextCalendar, setShowAllContextCalendar] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const handleToggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify('Spracheingabe wird in diesem Browser nicht unterstützt. Nutze Chrome, Edge oder Safari.', 'mic_off');
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript;
        }
        setInputText(finalTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition failed:', err);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  // Selected context attachments list for the current prompt (queued in input bar)
  const activeAttachments = useMemo(() => {
    if (isGeneralOnlySelected || isAllContextSelected) return [];
    const list = [];
    if (isCalendarContextSelected) {
      list.push({ type: 'calendar', id: 'calendar', title: 'Kalender & Termine' });
    }
    selectedCalendarEventIds.forEach((eid) => {
      const evt = (calendarEvents || []).find((item) => item.id === eid);
      if (evt) list.push({ type: 'calendar_event', id: evt.id, title: evt.summary || 'Termin' });
    });
    selectedProjectIds.forEach((pid) => {
      const p = projects.find((item) => item.id === pid);
      if (p) list.push({ type: 'project', id: p.id, title: p.title });
    });
    selectedReminderIds.forEach((rid) => {
      const r = reminders.find((item) => item.id === rid);
      if (r) list.push({ type: 'reminder', id: r.id, title: r.title });
    });
    return list;
  }, [isGeneralOnlySelected, isAllContextSelected, isCalendarContextSelected, selectedCalendarEventIds, selectedProjectIds, selectedReminderIds, calendarEvents, projects, reminders]);

  const hasCustomContext = useMemo(() => {
    return isGeneralOnlySelected || (!isAllContextSelected && (selectedProjectIds.length > 0 || selectedReminderIds.length > 0 || isCalendarContextSelected || selectedCalendarEventIds.length > 0));
  }, [isGeneralOnlySelected, isAllContextSelected, selectedProjectIds, selectedReminderIds, isCalendarContextSelected, selectedCalendarEventIds]);

  const totalActiveCustomCount = useMemo(() => {
    if (isGeneralOnlySelected) return 1;
    return selectedProjectIds.length + selectedReminderIds.length + (isCalendarContextSelected ? 1 : selectedCalendarEventIds.length);
  }, [isGeneralOnlySelected, selectedProjectIds, selectedReminderIds, isCalendarContextSelected, selectedCalendarEventIds]);

  // Build Multi-Context Grounded System Instruction for Gemini
  const buildSystemInstruction = (specificAttachments) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const pad2 = (n) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowKey = `${tomorrowDate.getFullYear()}-${pad2(tomorrowDate.getMonth() + 1)}-${pad2(tomorrowDate.getDate())}`;

    // Kalendertermine formatieren und nach Tagen aufteilen
    const formatEventItem = (e) => {
      const rawStart = e.start?.dateTime || e.start?.date || '';
      const rawEnd = e.end?.dateTime || e.end?.date || '';
      const isAllDay = !e.start?.dateTime && Boolean(e.start?.date);

      let eventDateKey = '';
      let timeFormatted = isAllDay ? 'Ganztägig' : '';

      if (rawStart) {
        if (rawStart.includes('T')) {
          const d = new Date(rawStart);
          eventDateKey = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          timeFormatted = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          if (rawEnd && rawEnd.includes('T')) {
            const endD = new Date(rawEnd);
            timeFormatted += ` - ${endD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
          } else {
            timeFormatted += ' Uhr';
          }
        } else {
          eventDateKey = rawStart; // YYYY-MM-DD
        }
      }

      return {
        id: e.id,
        titel: e.summary || e.title || 'Unbenannter Termin',
        beschreibung: e.description || '',
        uhrzeit: timeFormatted,
        datum: eventDateKey,
        istHeute: eventDateKey === todayKey,
        istMorgen: eventDateKey === tomorrowKey
      };
    };

    const sessionContexts = activeSession?.contextAttachments || [];
    const msgContexts = specificAttachments || activeAttachments || [];
    const allContexts = [...sessionContexts];
    msgContexts.forEach(c => {
      if (!allContexts.some(item => item.id === c.id && item.type === c.type)) {
        allContexts.push(c);
      }
    });

    const hasCalendarInContext = allContexts.some(a => a.type === 'calendar' || a.type === 'calendar_event');
    const specificCalIds = allContexts.filter(a => a.type === 'calendar_event').map(a => a.id);
    const projIds = allContexts.filter(a => a.type === 'project').map(a => a.id);
    const remIds = allContexts.filter(a => a.type === 'reminder').map(a => a.id);

    const relevantCalendarEvents = (allContexts.length > 0 && !hasCalendarInContext && (projIds.length > 0 || remIds.length > 0))
      ? []
      : (specificCalIds.length > 0 ? (calendarEvents || []).filter(e => specificCalIds.includes(e.id)) : (calendarEvents || []));

    const parsedCalendarEvents = relevantCalendarEvents.map(formatEventItem);
    const termineHeute = parsedCalendarEvents.filter(e => e.istHeute);
    const termineMorgen = parsedCalendarEvents.filter(e => e.istMorgen);
    const weitereTermine = parsedCalendarEvents.filter(e => !e.istHeute && !e.istMorgen).slice(0, 5);

    // Erinnerungen formatieren und Fälligkeiten prüfen
    const formatReminderItem = (r) => {
      let isToday = false;
      let isTomorrow = false;
      let isOverdue = false;
      if (r.date) {
        let rKey = r.date;
        if (r.date.includes('.')) {
          const parts = r.date.split('.');
          if (parts.length === 3) {
            const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            rKey = `${yr}-${pad2(parts[1])}-${pad2(parts[0])}`;
          }
        }
        if (rKey === todayKey) isToday = true;
        else if (rKey === tomorrowKey) isTomorrow = true;
        else if (rKey < todayKey && r.status === 'AKTIV') isOverdue = true;
      }
      return {
        id: r.id,
        titel: r.title,
        beschreibung: r.description || '',
        datum: r.date || 'Kein Termin',
        uhrzeit: r.time ? `${r.time} Uhr` : '',
        prioritaet: r.priority || 'mittel',
        status: r.status || 'AKTIV',
        istHeute: isToday,
        istMorgen: isTomorrow,
        istUeberfaellig: isOverdue,
        notizen: (r.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content }))
      };
    };

    let contextData = {
      heutigesDatum: `${dateStr}, ${timeStr} Uhr`,
      datumHeuteIso: todayKey,
      datumMorgenIso: tomorrowKey
    };

    let contextMetaGuidance = '';

    if (allContexts.length > 0) {
      const chosenProjects = projects.filter((p) => projIds.includes(p.id));
      const chosenReminders = reminders.filter((r) => remIds.includes(r.id));
      const focusTitles = [
        ...chosenProjects.map(p => p.title),
        ...chosenReminders.map(r => r.title),
        ...(hasCalendarInContext ? ['Kalender & Termine'] : [])
      ].join(', ');

      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat für dieses Gespräch gezielt folgenden Fokus gewählt: [${focusTitles || 'Spezifischer Fokus'}].
Er möchte sich in dieser Konversation besonders auf diese Themen konzentrieren.
- Antworte sofort präzise auf den Punkt, ohne Floskeln wie „Ich sehe, du hast X gewählt“.
- Verknüpfe diese Elemente mit dem heutigen Tag und der Zeitplanung.
`;

      contextData = {
        ...contextData,
        fokus: 'Spezifisch ausgewählte Elemente',
        projekte: chosenProjects.map((p) => ({
          id: p.id,
          titel: p.title,
          beschreibung: p.description || '',
          zeitraum: `${p.startDate || 'Start offen'} bis ${p.endDate || 'Ende offen'}`,
          fortschritt: `${p.progress || 0}%`,
          notizen: (p.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content })),
          abschnitte: (p.phases || []).map((ph) => ({
            id: ph.id,
            titel: ph.title,
            zeitraum: ph.dateInfo || '',
            materialien: (ph.materials || []).map(m => ({ id: m.id, name: m.name, typ: m.type, url: m.url })),
            aufgaben: (ph.tasks || []).map((t) => ({
              id: t.id,
              titel: t.title,
              erledigt: !!t.completed,
              termin: t.date || 'Kein Termin',
              notiz: t.note || ''
            }))
          }))
        })),
        erinnerungen: chosenReminders.map(formatReminderItem)
      };
    } else if (isGeneralOnlySelected) {
      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat den allgemeinen Coach-Modus gewählt (ohne spezifische Projektdaten).
Antworte als erfahrener Produktivitätsberater und Zeitmanagement-Experte mit bewährten Methoden.
`;
      contextData = {
        ...contextData,
        fokus: 'Allgemeiner Coach (Freies Gespräch)'
      };
    } else {
      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat dir den vollen Überblick über seinen gesamten Arbeitsbereich zur Verfügung gestellt (Kalender, Erinnerungen & Projekte).
Nutze diesen 360-Grad-Blick für ganzheitliche, harmonische Empfehlungen.
`;
      contextData = {
        ...contextData,
        fokus: 'Alle Daten (Kalender, Erinnerungen & Projekte)',
        projekte: projects.map((p) => ({
          id: p.id,
          titel: p.title,
          beschreibung: p.description || '',
          zeitraum: `${p.startDate || 'Start offen'} bis ${p.endDate || 'Ende offen'}`,
          fortschritt: `${p.progress || 0}%`,
          notizen: (p.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content })),
          abschnitte: (p.phases || []).map((ph) => ({
            id: ph.id,
            titel: ph.title,
            zeitraum: ph.dateInfo || '',
            materialien: (ph.materials || []).map(m => ({ id: m.id, name: m.name, typ: m.type, url: m.url })),
            aufgaben: (ph.tasks || []).map((t) => ({
              id: t.id,
              titel: t.title,
              erledigt: !!t.completed,
              termin: t.date || 'Kein Termin',
              notiz: t.note || ''
            }))
          }))
        })),
        erinnerungen: reminders.map(formatReminderItem)
      };
    }

    // Die Drei Säulen kompakt zusammengefasst für schnelle, präzise Antworten
    const allFormattedReminders = reminders.map(formatReminderItem);
    const activeProjects = projects.filter(p => !p.deletedAt && p.status === 'AKTIV');

    contextData.dreiSaeulen = {
      kalender: {
        verbunden: !!isCalendarConnected,
        gastmodus: !!user?.isGuest,
        termineHeute: termineHeute.map(t => ({ titel: t.titel, zeit: t.uhrzeit, details: t.beschreibung })),
        termineMorgen: termineMorgen.map(t => ({ titel: t.titel, zeit: t.uhrzeit, details: t.beschreibung })),
        weitereTermineDieseWoche: weitereTermine.map(t => ({ datum: t.datum, titel: t.titel, zeit: t.uhrzeit })),
        morgigerVorbereitungsCheck: termineMorgen.length > 0
          ? `WICHTIGER HINWEIS: Morgen stehen ${termineMorgen.length} Termin(e) im Kalender: ${termineMorgen.map(t => `"${t.titel}" (${t.uhrzeit})`).join(', ')}. Prüfe aktiv, ob dazu bereits Aufgaben existieren oder ob noch Vorbereitung nötig ist!`
          : 'Keine Kalendertermine für morgen eingetragen.'
      },
      erinnerungen: {
        heuteFaellig: allFormattedReminders.filter(r => r.istHeute && r.status === 'AKTIV').map(r => ({ id: r.id, titel: r.titel, zeit: r.uhrzeit, prio: r.prioritaet })),
        ueberfaellig: allFormattedReminders.filter(r => r.istUeberfaellig).map(r => ({ id: r.id, titel: r.titel, datum: r.datum })),
        morgenFaellig: allFormattedReminders.filter(r => r.istMorgen && r.status === 'AKTIV').map(r => ({ id: r.id, titel: r.titel, zeit: r.uhrzeit }))
      },
      aktiveProjekte: activeProjects.map(p => {
        // Nächste unerledigte Aufgaben finden
        const pendingTasks = [];
        (p.phases || []).forEach(ph => {
          (ph.tasks || []).forEach(t => {
            if (!t.completed && pendingTasks.length < 3) {
              pendingTasks.push({ aufgabe: t.title, abschnitt: ph.title, termin: t.date || '' });
            }
          });
        });
        return {
          id: p.id,
          titel: p.title,
          fortschritt: `${p.progress || 0}%`,
          naechsteSchritte: pendingTasks
        };
      })
    };

    return `
Du bist der FocusFlow AI Coach (Fio), ein hochkompetenter, empathischer und pragmatischer Produktivitäts-Assistent.
Deine Mission ist es, dem Nutzer zu helfen, seinen Tag mit maximalem Fokus, Klarheit und ohne Stress zu meistern.

DAS DREI-SÄULEN-SYSTEM VON FOCUSFLOW:
FocusFlow basiert auf DREI gleichwertigen, zentralen Säulen:
1. 📅 KALENDER: Feste Termine, feste Uhrzeiten heute und Vorbereitung für anstehende Termine morgen.
2. 🔔 ERINNERUNGEN: Zeitkritische To-Dos, Fristen und Prioritäten für den heutigen Tag.
3. 🎯 PROJEKTE: Strategischer Fortschritt – welcher konkrete nächste Schritt im wichtigsten Vorhaben bringt den größten Hebel?

WICHTIGE VERHALTENSREGELN FÜR TAGESFRAGEN (z. B. „Was sollte ich heute noch machen?“, „Was steht an?“, „Tagesplan“):
1. PRÄZISION STATT REIZÜBERFLUTUNG (WENIGER IST MEHR):
   - Wenn der Nutzer nach seinem Tag oder nach Empfehlungen fragt: Schütte ihn NIEMALS mit einer endlosen Liste aller Projekte und Aufgaben zu! Keine Textwüsten.
   - Gib WENIGER, aber dafür PRÄZISER aus: Wähle maximal 2 bis 3 konkrete, hochrelevante Fokus-Punkte für heute aus.
   - Strukturiere übersichtlich, ansprechend und sofort scannbar mit Emojis:
     • 📅 Kalender-Check: Heutige feste Termine + kurzer Blick auf morgen (insb. wenn Vorbereitung nötig ist).
     • 🔔 Fokus-Erinnerung: Maximal 1 (höchstens 2) überfällige oder heute fällige Erinnerungen.
     • 🎯 Projekt-Fokus: Genau 1 wichtigster nächster Schritt aus dem aktivsten bzw. wichtigsten Projekt (nicht 5 Projekte gleichzeitig).

2. PROAKTIVER KALENDER- & MORGIGER VORBEREITUNGS-CHECK:
   - Der Kalender ist genauso wichtig wie Projekte und Erinnerungen – beziehe ihn immer aktiv ein!
   - Termine heute: Berücksichtige feste Uhrzeiten für die Tagesstruktur.
   - Termine morgen: Untersuche ganz gezielt, ob morgen Termine im Kalender stehen (z. B. Meeting, Präsentation, Kundentermin, Arzt, Deadline, Abgabe).
   - Vorbereitungs-Check: Prüfe, ob in den Projekten oder Erinnerungen bereits Aufgaben dazu vorbereitet wurden oder ob noch gar nichts dazu gemacht wurde.
   - Wenn für einen morgigen Termin noch nichts vorbereitet wurde: Weise den Nutzer kurz und aufmerksam darauf hin (z. B.: „📅 Kalender-Hinweis für morgen: Du hast um 10:00 Uhr ‚Meeting X‘. Da dazu noch keine Vorbereitung hinterlegt ist: Sollen wir heute 20 Minuten einplanen, um die Unterlagen vorzubereiten?“).

3. IMMER MIT EINER PROAKTIVEN RÜCKFRAGE ABSCHLIESSEN:
   - Beende deine Antwort IMMER mit genau EINER konkreten, motivierenden Rückfrage bezüglich des vorgeschlagenen Projekts, des nächsten Schritts oder des Kalendertermins (z. B.: „Möchtest du, dass wir direkt mit [Aufgabe X] im Projekt [Y] starten, oder soll ich dir dafür noch Teilaufgaben anlegen?“ oder „Sollen wir für den morgigen Termin [Z] eine kurze Vorbereitungs-Erinnerung einstellen?“).
   - So kann der Nutzer im Chat direkt antworten und mit dir ins Detail gehen, ohne überlegen zu müssen.

${contextMetaGuidance}

${ACTION_ENGINE_SYSTEM_PROMPT}

AKTUELLE DATEN AUS FOCUSFLOW:
${JSON.stringify(contextData, null, 2)}
`;
  };

  // Dynamic quick prompts
  const getQuickPrompts = () => {
    if (draftAwaitingDetail) return [];
    if (draftOpen) {
      return [
        { id: 'dp_1', label: 'Feiner aufteilen', promptText: 'Teile die Abschnitte feiner in kleinere Aufgaben auf.' },
        { id: 'dp_2', label: 'Termine vorschlagen', promptText: 'Schlage sinnvolle Termine für die Abschnitte vor.' },
        { id: 'dp_3', label: 'Kürzer fassen', promptText: 'Fasse den Entwurf auf die wichtigsten Abschnitte und Aufgaben zusammen.' }
      ];
    }
    return [
      { id: 'qp_1', label: 'Was heute tun?', promptText: 'Was sollte ich heute noch machen? Gib mir einen kurzen, präzisen Fokus aus Kalender, Erinnerungen und Projekten.' },
      { id: 'qp_2', label: 'Engpässe & Termine', promptText: 'Welche anstehenden Termine (heute & morgen), Erinnerungen oder Aufgaben benötigen meine Aufmerksamkeit?' },
      { id: 'qp_3', label: 'Ziele priorisieren', promptText: 'Was ist der wichtigste nächste Schritt für heute?' }
    ];
  };

  const dynamicPrompts = getQuickPrompts();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const messages = activeSession?.messages || [];

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleNewChat = () => {
    createNewSession({
      contextScope: 'general',
      contextId: null,
      contextTitle: 'Allgemein',
      contextAttachments: [],
      model: activeModel,
      initialTitle: 'Neues Gespräch'
    });
  };

  const abortControllerRef = useRef(null);
  const currentBotMsgIdRef = useRef(null);
  const currentBotSessionIdRef = useRef(null);
  const generationRef = useRef(0);

  const handleStopGeneration = () => {
    generationRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    if (currentBotMsgIdRef.current && currentBotSessionIdRef.current) {
      updateStreamingMessage(
        currentBotSessionIdRef.current,
        currentBotMsgIdRef.current,
        undefined,
        false,
        null,
        { cancelled: true }
      );
    }
  };

  useEffect(() => () => {
    generationRef.current += 1;
    abortControllerRef.current?.abort();
    if (currentBotMsgIdRef.current && currentBotSessionIdRef.current) {
      updateStreamingMessage(
        currentBotSessionIdRef.current,
        currentBotMsgIdRef.current,
        undefined,
        false,
        null,
        { cancelled: true }
      );
    }
  }, [updateStreamingMessage]);

  // Vorgemerkte Nachricht (Apps-Menü "Frag Fio …") in einem leeren Gespräch abschicken.
  // Ist das aktive Gespräch nicht leer, einmalig ein neues anlegen und warten, bis es aktiv ist.
  const freshSessionRequestedForRef = useRef(null);
  useEffect(() => {
    if (!queuedPrompt || loading) return;
    if (activeSession.messages.length > 0) {
      if (freshSessionRequestedForRef.current !== activeSession.id) {
        freshSessionRequestedForRef.current = activeSession.id;
        createNewSession();
      }
      return;
    }
    const text = takeQueuedPrompt();
    if (!text) return;
    freshSessionRequestedForRef.current = null;
    handleSendMessage(text);
    // handleSendMessage ändert sich jeden Render; ausgelöst wird nur durch neue Nachricht bzw. neues Gespräch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedPrompt, activeSession.id, loading]);

  // --- Projekt-Entwurf (Chat "Projektanlegung: …") ---
  const confirmDraft = async (session = activeSession) => {
    const draft = session.draft;
    if (!draft?.title?.trim() || session.draftStatus !== 'open') return;
    // Sofort sperren, damit ein Doppelklick kein zweites Projekt anlegt
    updateSessionDraft(session.id, draft, { extra: { draftStatus: 'confirming' } });
    const newId = await addProject(draftToProjectData(draft, session.draftSource));
    if (!newId) {
      updateSessionDraft(session.id, draft, { extra: { draftStatus: 'open' } });
      return;
    }
    updateSessionDraft(session.id, clearNewFlags(draft), { label: 'Angelegt', extra: { draftStatus: 'confirmed' } });
    const taskTotal = draft.phases.reduce((n, p) => n + p.tasks.length, 0);
    // Sichtbare Quittung: Aktionskarte mit Link zum neuen Projekt
    const receiptId = `msg_${Date.now()}_r`;
    addMessageToSession(session.id, { id: receiptId, role: 'assistant', content: 'Das Projekt ist angelegt.', isStreaming: true });
    updateStreamingMessage(session.id, receiptId, 'Das Projekt ist angelegt.', false, [{
      type: 'CREATE_PROJECT',
      targetType: 'project',
      targetId: newId,
      title: draft.title,
      subtitle: `${draft.phases.length} Abschnitte · ${taskTotal} Aufgaben`
    }]);
  };

  const runDraftTurn = async (session, instruction, { showUserMessage = true } = {}) => {
    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    currentBotMsgIdRef.current = botMsgId;
    currentBotSessionIdRef.current = session.id;

    if (showUserMessage) {
      addMessageToSession(session.id, { id: userMsgId, role: 'user', content: instruction });
    }
    addMessageToSession(session.id, { id: botMsgId, role: 'assistant', content: '', isStreaming: true });
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await reviseDraftWithFio({
        source: session.draftSource,
        draft: session.draft,
        instruction,
        model: activeModel,
        projectTitles: projects.filter((p) => !p.deletedAt).map((p) => p.title),
        detail: session.draftDetail,
        signal: abortController.signal,
      });
      if (!result || generationRef.current !== generation || abortController.signal.aborted) return;

      if (result.draft) {
        updateSessionDraft(session.id, result.draft, { label: instruction.slice(0, 40) });
      }
      updateStreamingMessage(session.id, botMsgId, result.reply, false);
      if (result.confirm && result.draft) {
        await confirmDraft({ ...session, draft: result.draft, draftStatus: 'open' });
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) return;
      console.error('Fio-Entwurf Fehler:', err);
      updateStreamingMessage(session.id, botMsgId, `⚠️ **KI-Fehler:** ${err?.message || 'Der Entwurf konnte nicht aktualisiert werden.'}`, false);
    } finally {
      if (generationRef.current === generation) {
        abortControllerRef.current = null;
        currentBotMsgIdRef.current = null;
        currentBotSessionIdRef.current = null;
        setLoading(false);
      }
    }
  };

  // Neuer Entwurfs-Chat: Fio macht automatisch den ersten Vorschlag (einmal pro Sitzung, auch im StrictMode)
  const draftStartedRef = useRef(new Set());
  useEffect(() => {
    if (!isDraftSession || !activeSession.draftPendingStart || loading) return undefined;
    if (draftStartedRef.current.has(activeSession.id)) return undefined;
    // Verzögert starten: StrictMode räumt den ersten Effektlauf sofort wieder ab (Timer wird verworfen),
    // sonst bricht der Aufräum-Effekt oben die gerade gestartete Anfrage ab.
    const session = activeSession;
    const timer = setTimeout(() => {
      if (draftStartedRef.current.has(session.id)) return;
      draftStartedRef.current.add(session.id);
      updateSessionDraft(session.id, session.draft, { extra: { draftPendingStart: false } });
      runDraftTurn(
        { ...session, draftPendingStart: false },
        `Erstelle einen ersten Entwurf für ein Projekt aus diesem Gedanken. Detailtiefe: ${(DETAIL_LEVELS[session.draftDetail] || DETAIL_LEVELS.balanced).label}.`,
        { showUserMessage: false }
      );
    }, 0);
    return () => clearTimeout(timer);
    // runDraftTurn ändert sich jeden Render; ausgelöst wird nur durch ein neues Entwurfs-Gespräch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSession, activeSession.id, activeSession.draftPendingStart, loading]);

  // Detailtiefe gewählt: jetzt erst legt Fio los (der Start-Effekt übernimmt)
  const handlePickDetail = (level) => {
    updateSessionDraft(activeSession.id, activeSession.draft, {
      extra: { draftDetail: level, draftAwaitingDetail: false, draftPendingStart: true }
    });
  };

  const handleDraftEdit = (nextDraft) => {
    if (!draftOpen) return;
    updateSessionDraft(activeSession.id, nextDraft);
  };

  const handleRestoreVersion = (version) => {
    updateSessionDraft(activeSession.id, clearNewFlags(version.draft), { label: `Wiederhergestellt: ${version.label}`.slice(0, 40) });
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading || draftAwaitingDetail) return;

    if (draftOpen) {
      if (isListening) {
        isListeningRef.current = false;
        setIsListening(false);
        try { recognitionRef.current?.stop(); } catch (e) {}
      }
      if (!textToSend) {
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      await runDraftTurn(activeSession, text.trim());
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }

    const trimmed = text.trim();
    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    currentBotMsgIdRef.current = botMsgId;
    currentBotSessionIdRef.current = activeSession.id;
    const currentAttachments = [...activeAttachments];

    // 1. Add User Message with active attachments
    addMessageToSession(activeSession.id, {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      attachments: currentAttachments
    });

    // Clear active attachments in the input bar for the next message
    if (currentAttachments.length > 0) {
      setSelectedProjectIds([]);
      setSelectedReminderIds([]);
      setIsAllContextSelected(true);
      setIsGeneralOnlySelected(false);
    }

    if (!textToSend) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    setLoading(true);

    // 2. Add Placeholder Bot Message
    addMessageToSession(activeSession.id, {
      id: botMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let fullGeneratedText = '';

    try {
      const systemInstruction = buildSystemInstruction(currentAttachments);
      const previousMessages = (activeSession?.messages || []).filter(m => m.id !== botMsgId && m.id !== userMsgId);
      const conversationHistory = [...previousMessages, { role: 'user', content: trimmed }];

      await askGeminiCoach({
        prompt: trimmed,
        messages: conversationHistory,
        systemInstruction,
        aiModel: activeModel,
        signal: abortController.signal,
        onChunk: (currentFullText) => {
          if (generationRef.current !== generation || abortController.signal.aborted) return;
          fullGeneratedText = currentFullText;
          const { cleanText: textWithoutActions } = parseAiActions(currentFullText);
          const { cleanText } = parseIntentChoice(textWithoutActions);
          updateStreamingMessage(activeSession.id, botMsgId, cleanText, true);
        }
      });

      if (generationRef.current !== generation || abortController.signal.aborted) return;

      // Parse and execute any generated actions
      const { cleanText: textWithoutActions, actions } = parseAiActions(fullGeneratedText);
      const { cleanText, intentChoice } = parseIntentChoice(textWithoutActions);
      let executedActionResults = [];
      if (actions && actions.length > 0) {
        executedActionResults = await executeAiActions(actions, modalContext, projects, reminders);
      }

      updateStreamingMessage(
        activeSession.id,
        botMsgId,
        cleanText || undefined,
        false,
        executedActionResults,
        { intentChoice }
      );
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('Gemini Error:', err);
      const errMsg = err?.message || 'Fehler beim Aufruf der Gemini API.';
      updateStreamingMessage(activeSession.id, botMsgId, `⚠️ **KI-Fehler:** ${errMsg}`, false);
    } finally {
      if (generationRef.current === generation) {
        abortControllerRef.current = null;
        currentBotMsgIdRef.current = null;
        currentBotSessionIdRef.current = null;
        setLoading(false);
      }
    }
  };

  // Group and filter sessions chronologically for the SIDEBAR
  const groupedSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by sidebarScopeFilter
    if (sidebarScopeFilter === 'general') {
      filtered = filtered.filter((s) => s.contextScope === 'general' || s.contextScope === 'global');
    } else if (sidebarScopeFilter === 'drafts') {
      filtered = filtered.filter((s) => s.contextScope === 'draft');
    } else if (sidebarScopeFilter === 'calendar') {
      filtered = filtered.filter((s) =>
        s.contextScope === 'calendar' || 
        (s.contextAttachments && s.contextAttachments.some(a => a.type === 'calendar' || a.type === 'calendar_event'))
      );
    } else if (sidebarScopeFilter !== 'all') {
      filtered = filtered.filter((s) =>
        s.contextId === sidebarScopeFilter || 
        (s.contextAttachments && s.contextAttachments.some(a => a.id === sidebarScopeFilter))
      );
    }

    // Filter by search text in sidebar
    if (sessionSearchText.trim()) {
      const query = sessionSearchText.toLowerCase();
      filtered = filtered.filter((s) =>
        (s.title && s.title.toLowerCase().includes(query)) ||
        (s.contextTitle && s.contextTitle.toLowerCase().includes(query))
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - (7 * 86400000);

    const groups = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: []
    };

    filtered.forEach((sess) => {
      const sessionDate = new Date(sess.updatedAt || sess.createdAt || Date.now()).getTime();
      if (sessionDate >= today) {
        groups.today.push(sess);
      } else if (sessionDate >= yesterday) {
        groups.yesterday.push(sess);
      } else if (sessionDate >= sevenDaysAgo) {
        groups.lastWeek.push(sess);
      } else {
        groups.older.push(sess);
      }
    });

    return groups;
  }, [sessions, sidebarScopeFilter, sessionSearchText]);

  // Label for Sidebar Filter Button
  const sidebarScopeLabel = useMemo(() => {
    if (sidebarScopeFilter === 'all') return 'Alle Chats';
    if (sidebarScopeFilter === 'general') return 'Allgemeiner Coach';
    if (sidebarScopeFilter === 'drafts') return 'Entwürfe';
    if (sidebarScopeFilter === 'calendar') return 'Kalender';

    const p = projects.find(pr => pr.id === sidebarScopeFilter);
    if (p) return `Projekt: ${p.title}`;

    const r = reminders.find(rem => rem.id === sidebarScopeFilter);
    if (r) return `Erinnerung: ${r.title}`;

    return 'Alle Chats';
  }, [sidebarScopeFilter, projects, reminders]);

  // Filtered lists for Sidebar Filter Modal
  const sidebarModalFilteredItems = useMemo(() => {
    const q = sidebarSearchQuery.trim().toLowerCase();
    let filteredProjects = projects;
    let filteredReminders = reminders;
    if (q) {
      filteredProjects = projects.filter((p) => p.title.toLowerCase().includes(q));
      filteredReminders = reminders.filter((r) => r.title.toLowerCase().includes(q));
    }
    return { projects: filteredProjects, reminders: filteredReminders };
  }, [projects, reminders, sidebarSearchQuery]);

  // Filtered lists for Context Attachments Modal
  const contextModalFilteredItems = useMemo(() => {
    const q = contextModalSearch.trim().toLowerCase();
    let filteredProjects = projects.filter((p) => !p.deletedAt);
    let filteredReminders = reminders.filter((r) => !r.deletedAt);
    let filteredEvents = calendarEvents || [];
    if (q) {
      filteredProjects = filteredProjects.filter((p) => (p.title || '').toLowerCase().includes(q));
      filteredReminders = filteredReminders.filter((r) => (r.title || '').toLowerCase().includes(q));
      filteredEvents = filteredEvents.filter((e) => (e.summary || e.title || e.description || '').toLowerCase().includes(q));
    }
    return { projects: filteredProjects, reminders: filteredReminders, calendarEvents: filteredEvents };
  }, [projects, reminders, calendarEvents, contextModalSearch]);

  // Toggle Context Attachment helpers
  const toggleProjectContext = (pId) => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.id === pId && a.type === 'project');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, pId, 'project');
    }
    setSelectedProjectIds((prev) => 
      prev.includes(pId) ? prev.filter(id => id !== pId) : (isInSession ? prev : [...prev, pId])
    );
  };

  const toggleReminderContext = (rId) => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.id === rId && a.type === 'reminder');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, rId, 'reminder');
    }
    setSelectedReminderIds((prev) => 
      prev.includes(rId) ? prev.filter(id => id !== rId) : (isInSession ? prev : [...prev, rId])
    );
  };

  const toggleCalendarContext = () => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.type === 'calendar');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, 'calendar', 'calendar');
    }
    setIsCalendarContextSelected((prev) => !prev);
  };

  const toggleCalendarEventContext = (eId) => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.id === eId && a.type === 'calendar_event');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, eId, 'calendar_event');
    }
    setSelectedCalendarEventIds((prev) => 
      prev.includes(eId) ? prev.filter(id => id !== eId) : (isInSession ? prev : [...prev, eId])
    );
  };

  const selectAllContext = () => {
    setIsAllContextSelected(true);
    setIsGeneralOnlySelected(false);
    setSelectedProjectIds([]);
    setSelectedReminderIds([]);
    setSelectedCalendarEventIds([]);
    setIsCalendarContextSelected(false);
    setIsContextModalOpen(false);
  };

  const selectGeneralOnlyContext = () => {
    setIsGeneralOnlySelected(true);
    setIsAllContextSelected(false);
    setSelectedProjectIds([]);
    setSelectedReminderIds([]);
    setSelectedCalendarEventIds([]);
    setIsCalendarContextSelected(false);
    setIsContextModalOpen(false);
  };

  const formatSessionTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderSessionCard = (sess) => {
    const isActive = sess.id === activeSessionId;
    const isProject = sess.contextScope === 'project' || sess.contextScope === 'task' || sess.contextScope === 'section';
    const isReminder = sess.contextScope === 'reminder' || sess.contextScope === 'reminders';
    const isDraft = sess.contextScope === 'draft';

    return (
      <div
        key={sess.id}
        onClick={() => selectSession(sess.id)}
        className={`p-2.5 sm:p-3 cursor-pointer transition-all flex items-center justify-between gap-2.5 rounded-xl border group relative ${
          isActive
            ? 'bg-primary/5 border-primary shadow-xs'
            : 'bg-white border-outline-variant hover:border-primary/30 hover:bg-surface-low/50'
        }`}
      >
        {/* Left / Main: Icon + Title */}
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            isReminder
              ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
              : isProject || isDraft
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-surface-low text-on-surface-variant border border-outline-variant'
          }`}>
            <span className="material-symbols-outlined text-[16px]">
              {isReminder ? 'notifications' : isDraft ? 'edit_note' : isProject ? 'folder' : 'psychology'}
            </span>
          </div>

          <span className={`text-xs block truncate ${isActive ? 'font-bold text-on-surface' : 'font-medium text-on-surface'}`}>
            {sess.title || 'Gespräch'}
          </span>
        </div>

        {/* Right: Time on Top, Message Count below */}
        <div className="flex flex-col items-end shrink-0 text-right gap-0.5">
          <span className="text-[10px] font-mono text-on-surface-variant font-medium">
            {formatSessionTime(sess.updatedAt || sess.createdAt)}
          </span>
          <span className="text-[10px] font-mono text-on-surface-variant/70">
            {sess.messages?.length || 0} Nachr.
          </span>
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteSession(sess.id);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant/40 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
          title="Gespräch löschen"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    );
  };

  return (
    <div className="screen-transition flex flex-col h-full w-full relative overflow-hidden bg-surface">
      <div className="flex h-full w-full relative overflow-hidden">
        {/* Mobile-Only Overlay (Tap to close on small screens) */}
        <div 
          className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[55] md:hidden transition-opacity duration-300 ${
            isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsHistoryOpen(false)}
          aria-hidden="true"
        />
        
        {/* Left Floating History Panel (Slides out smoothly, stable inner width prevents wrapping during close) */}
        <div
          className={`
            fixed inset-y-0 left-0 z-[60] h-full
            md:relative md:inset-auto md:z-20
            transition-[width,transform,opacity] duration-300 ease-in-out overflow-hidden
            ${isHistoryOpen
              ? 'w-[85%] sm:w-80 max-w-[340px] md:w-80 translate-x-0 opacity-100 pointer-events-auto'
              : 'w-[85%] sm:w-80 max-w-[340px] md:w-0 -translate-x-full md:translate-x-0 md:opacity-0 pointer-events-none'
            }
          `}
        >
          {/* Inner Container with fixed width so contents never squish/wrap */}
          <div className={`w-[85vw] sm:w-80 max-w-[340px] md:w-80 h-full p-2.5 sm:p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:pb-3 flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${
            isHistoryOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full'
          }`}>
            {/* Inner Rounded Floating Pill Card */}
            <div className="w-full h-full flex flex-col bg-white/95 dark:bg-surface-low/95 backdrop-blur-xl border border-outline-variant/80 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
              {/* Header with Neuer Chat & Verkleinern Button */}
              <div className="p-3 sm:p-3.5 border-b border-outline-variant/60 flex items-center gap-2 bg-surface-low/50">
                {/* Neuer Chat Button (Prominent, Touch-Friendly 40px) */}
                <button
                  className="flex-grow h-10 px-3.5 bg-neutral-900 text-white hover:bg-black transition-all flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-xs hover:shadow-sm font-mono text-xs font-bold active:scale-[0.98]"
                  title="Neuen Chat starten"
                  onClick={handleNewChat}
                >
                  <span className="material-symbols-outlined text-[19px]">edit_square</span>
                  <span>Neuer Chat</span>
                </button>

                {/* Button zum Verkleinern des Chats (Matching 40px x 40px UI Button) */}
                <button
                  className="w-10 h-10 border border-outline-variant bg-white hover:border-primary text-primary transition-all flex items-center justify-center rounded-xl cursor-pointer shadow-xs hover:shadow-sm active:scale-[0.98] shrink-0"
                  title="Verlauf einklappen"
                  onClick={() => setIsHistoryOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">left_panel_close</span>
                </button>
              </div>

            {/* Search Bar for Sessions */}
            <div className="p-2.5 border-b border-outline-variant/60">
              <div className="flex items-center gap-1.5 bg-white border border-outline-variant rounded-xl px-2.5 py-1.5 focus-within:border-primary transition-colors shadow-2xs">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
                <input
                  type="text"
                  value={sessionSearchText}
                  onChange={(e) => setSessionSearchText(e.target.value)}
                  placeholder="Gespräche durchsuchen..."
                  className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 p-0 text-on-surface placeholder:text-on-surface-variant/50"
                />
                {sessionSearchText && (
                  <button
                    onClick={() => setSessionSearchText('')}
                    className="text-on-surface-variant hover:text-primary cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar Scope / Filter Button */}
            <div className="px-2.5 py-2 border-b border-outline-variant/60">
              <button
                onClick={() => setIsSidebarFilterModalOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-outline-variant rounded-xl text-xs font-mono font-medium hover:border-primary/40 hover:bg-surface-low transition-all cursor-pointer shadow-2xs text-on-surface text-left"
                title="Chat-Verlauf filtern / Suche"
              >
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">filter_list</span>
                <span className="truncate">{sidebarScopeLabel}</span>
              </button>
            </div>

            {/* Chronological Session Groups */}
            <div className="space-y-4 p-2.5 overflow-y-auto flex-grow">
              {groupedSessions.today.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase px-1 tracking-wider">
                    Heute
                  </span>
                  {groupedSessions.today.map(renderSessionCard)}
                </div>
              )}

              {groupedSessions.yesterday.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase px-1 tracking-wider">
                    Gestern
                  </span>
                  {groupedSessions.yesterday.map(renderSessionCard)}
                </div>
              )}

              {groupedSessions.lastWeek.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase px-1 tracking-wider">
                    Letzte 7 Tage
                  </span>
                  {groupedSessions.lastWeek.map(renderSessionCard)}
                </div>
              )}

              {groupedSessions.older.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase px-1 tracking-wider">
                    Älter
                  </span>
                  {groupedSessions.older.map(renderSessionCard)}
                </div>
              )}

              {sessions.length === 0 && (
                <div className="p-6 text-center text-xs text-on-surface-variant italic">
                  Keine gespeicherten Gespräche vorhanden.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Right Main Chat Panel (Adapts Width Dynamically, Keeps Centered Input & Messages) */}
        <div className="flex-grow min-w-0 flex flex-col h-full relative overflow-hidden bg-surface">
          {/* Fixed Top Controls Bar with Soft Gradient */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 sm:p-3.5 pointer-events-none bg-gradient-to-b from-surface via-surface/90 to-transparent pb-6">
            {/* Left Action Buttons with Smooth Crossfade */}
            <div className={`flex items-center gap-2 pointer-events-auto transition-opacity duration-200 ${
              isHistoryOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
              <button
                className="h-10 px-3.5 flex items-center gap-1.5 border border-outline-variant bg-white/95 dark:bg-surface-low/95 backdrop-blur-md hover:border-primary text-primary transition-all rounded-xl cursor-pointer shadow-xs hover:shadow-sm"
                title="Chatverlauf öffnen"
                onClick={() => setIsHistoryOpen(true)}
              >
                <span className="material-symbols-outlined text-[20px]">history</span>
                <span className="text-xs font-mono font-bold hidden sm:inline">Verlauf</span>
              </button>
              <button
                className="h-10 px-3.5 flex items-center gap-1.5 bg-neutral-900 text-white hover:bg-black transition-all rounded-xl cursor-pointer shadow-xs hover:shadow-sm"
                title="Neuen Chat starten"
                onClick={handleNewChat}
              >
                <span className="material-symbols-outlined text-[20px]">edit_square</span>
                <span className="text-xs font-mono font-bold hidden sm:inline">Neuer Chat</span>
              </button>
            </div>

            {/* Right Header Controls (Fio Guide Button & Model Dropdown) */}
            <div className="flex items-center gap-2 pointer-events-auto ml-auto">
              <button
                type="button"
                onClick={() => openModal('settings', { initialTab: 'fio' })}
                className="h-10 px-3 flex items-center gap-1.5 border border-outline-variant bg-white/95 dark:bg-surface-low/95 backdrop-blur-md hover:border-primary text-primary transition-all rounded-xl cursor-pointer shadow-xs hover:shadow-sm text-xs font-semibold"
                title="Was kann Fio? Interaktiven KI-Guide öffnen"
              >
                <span className="material-symbols-outlined text-[18px] text-amber-500">lightbulb</span>
                <span className="hidden sm:inline">Was kann Fio?</span>
              </button>

              <ModelSelectorDropdown
                activeModel={activeModel}
                onSelectModel={setActiveModel}
              />
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-grow overflow-y-auto px-4 pb-4 pt-16 sm:pt-16 min-h-0">
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.length === 0 && isDraftSession ? null : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-4 fade-in">
                  <div className="w-16 h-16 bg-neutral-900 text-white rounded-2xl flex items-center justify-center mb-4 shadow-md p-3.5">
                    <FioIcon className="w-full h-full text-white" color="currentColor" />
                  </div>
                  <h2 className="text-2xl font-bold text-on-surface mb-1.5 tracking-tight">
                    Hallo{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}, ich bin Fio
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                    Dein persönlicher KI-Coach. Wie kann ich dich heute bei deinen Projekten, Aufgaben, Erinnerungen und Terminen unterstützen?
                  </p>
                  <button
                    type="button"
                    onClick={() => openModal('settings', { initialTab: 'fio' })}
                    className="mt-4 px-3.5 py-2 bg-surface-variant/40 hover:bg-surface-variant/80 text-on-surface border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-500">lightbulb</span>
                    <span>Entdecke, was Fio alles kann</span>
                  </button>
                </div>
              ) : (
                messages.map((msg) => {
                  const isBot = msg.role === 'assistant' || msg.sender === 'bot';
                  if (isBot) {
                    return (
                      <div key={msg.id} className="flex gap-3 group">
                        <div className="w-8 h-8 flex-shrink-0 bg-neutral-900 text-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
                          <FioIcon className="w-full h-full text-white" color="currentColor" />
                        </div>
                        <div className="flex flex-col gap-1 items-start max-w-[85%]">
                          <div className="p-4 bg-white border border-outline-variant rounded-xl text-sm shadow-sm markdown-body w-full">
                            {msg.content || msg.text ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content || msg.text}
                              </ReactMarkdown>
                            ) : msg.cancelled ? (
                              <div className="flex items-center gap-1.5 py-1 text-on-surface-variant text-xs italic">
                                <span className="material-symbols-outlined text-[14px]">pause_circle</span>
                                <span>Antwort abgebrochen</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 py-1 text-on-surface-variant text-xs">
                                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                <span>Fio denkt nach...</span>
                              </div>
                            )}

                            {/* Render Interactive Action Results Cards */}
                            {msg.actionResults && msg.actionResults.length > 0 && (
                              <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/60 w-full not-prose">
                                {msg.actionResults.map((res, idx) => {
                                  const isProjAction = res.targetType === 'project' || res.type === 'ADD_PHASE' || res.type === 'ADD_TASK' || res.type === 'CREATE_PROJECT' || res.type === 'UPDATE_PROJECT';
                                  const isRemAction = res.targetType === 'reminder' || res.type === 'CREATE_REMINDER' || res.type === 'UPDATE_REMINDER';
                                  const isCalAction = res.targetType === 'calendar' || res.isOnlyCalendar || res.type === 'CREATE_CALENDAR_EVENT';
                                  const isNoteAction = res.type === 'CREATE_NOTE';
                                  const isMatAction = res.type === 'ADD_MATERIAL';

                                  const iconName = isNoteAction ? 'note_alt' : isMatAction ? 'attach_file' : isCalAction ? 'calendar_month' : isRemAction ? 'notifications' : isProjAction ? 'folder' : 'check_circle';
                                  const iconStyle = isNoteAction
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : isMatAction
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : isCalAction
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : isRemAction
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : isProjAction
                                    ? 'bg-primary/10 text-primary border-primary/20'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between gap-3 p-2.5 bg-surface-low border border-outline-variant rounded-xl text-xs shadow-2xs group hover:border-primary/40 transition-all"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}>
                                          <span className="material-symbols-outlined text-[16px]">{iconName}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-bold text-on-surface truncate">{res.title}</div>
                                          <div className="text-[10px] font-mono text-on-surface-variant truncate">{res.subtitle}</div>
                                        </div>
                                      </div>
                                      {(isCalAction || res.targetType === 'calendar') && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (setCurrentScreen) setCurrentScreen('calendar');
                                          }}
                                          className="px-2.5 py-1 bg-white border border-outline-variant hover:border-primary text-primary font-mono text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs hover:shadow-xs"
                                        >
                                          <span>Im Kalender ansehen</span>
                                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </button>
                                      )}
                                      {res.targetType === 'project' && res.targetId && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedProjectId(res.targetId);
                                            if (setCurrentScreen) setCurrentScreen('project-detail');
                                          }}
                                          className="px-2.5 py-1 bg-white border border-outline-variant hover:border-primary text-primary font-mono text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs hover:shadow-xs"
                                        >
                                          <span>Projekt öffnen</span>
                                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </button>
                                      )}
                                      {res.targetType === 'reminder' && res.targetId && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {res.isCalendarSynced && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (setCurrentScreen) setCurrentScreen('calendar');
                                              }}
                                              className="p-1 bg-white border border-outline-variant hover:border-primary text-emerald-600 rounded-lg transition-all flex items-center cursor-pointer shadow-2xs"
                                              title="Im Kalender ansehen"
                                            >
                                              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedReminderId(res.targetId);
                                              if (setCurrentScreen) setCurrentScreen('reminder-detail');
                                            }}
                                            className="px-2.5 py-1 bg-white border border-outline-variant hover:border-primary text-primary font-mono text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs hover:shadow-xs"
                                          >
                                            <span>Erinnerung öffnen</span>
                                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Render 3-Way Intent Choice Pills if AI proposed an appointment/reminder */}
                            {msg.intentChoice && (
                              <div className="mt-3 pt-2.5 border-t border-outline-variant/60 w-full space-y-2 not-prose">
                                <div className="text-[11px] font-mono font-bold text-on-surface-variant flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px] text-primary">help</span>
                                  <span>Wo soll der Eintrag angelegt werden?</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSendMessage(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur in FocusFlow.`)}
                                    className="px-2.5 py-1.5 rounded-lg bg-surface-low hover:bg-surface-variant border border-outline-variant text-xs font-mono text-on-surface flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:border-primary"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-amber-700">notifications</span>
                                    <span>Nur in FocusFlow</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={user?.isGuest || !isCalendarConnected}
                                    onClick={() => handleSendMessage(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} in FocusFlow mit Google Kalender-Sync.`)}
                                    title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Empfohlen'}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-xs font-mono text-emerald-800 font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-emerald-600">sync</span>
                                    <span>FocusFlow + Kalender-Sync (Empfohlen)</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={user?.isGuest || !isCalendarConnected}
                                    onClick={() => handleSendMessage(`Bitte trage den Termin „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur im Google Kalender ein.`)}
                                    title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Direkt im Kalender eintragen'}
                                    className="px-2.5 py-1.5 rounded-lg bg-surface-low hover:bg-surface-variant border border-outline-variant text-xs font-mono text-on-surface flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-primary">calendar_month</span>
                                    <span>Nur im Google Kalender</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className="flex flex-col items-end gap-1.5">
                      {/* Attached Context Chips in User Bubble */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[85%] pr-1">
                          {msg.attachments.map((att) => (
                            <div
                              key={`${att.type}_${att.id}`}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-outline-variant rounded-lg text-[11px] font-mono text-on-surface shadow-2xs"
                            >
                              <span className={`material-symbols-outlined text-[14px] ${
                                att.type === 'project' ? 'text-primary' : att.type === 'reminder' ? 'text-amber-700' : 'text-blue-600'
                              }`}>
                                {att.type === 'project' ? 'folder' : att.type === 'reminder' ? 'notifications' : 'calendar_month'}
                              </span>
                              <span className="truncate max-w-[150px] font-medium">{att.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 flex-row-reverse">
                        <div className="w-8 h-8 flex-shrink-0 bg-neutral-900 text-white border border-neutral-700 rounded-full flex items-center justify-center text-xs font-mono font-bold shadow-xs overflow-hidden">
                          {user?.photoURL ? (
                            <img src={user.photoURL} alt="User" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">person</span>
                          )}
                        </div>
                        <div className="p-4 bg-neutral-900 text-white rounded-xl text-sm max-w-[85%] shadow-sm markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {draftAwaitingDetail && (
                <div className="rounded-2xl border border-primary/40 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
                    <span className="font-bold text-sm">Wie detailliert soll Fio das Projekt aufteilen?</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Das gibt die Richtung vor. Später kannst du den Entwurf von Hand oder per Prompt anpassen.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.entries(DETAIL_LEVELS).map(([key, level]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePickDetail(key)}
                        className="flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-1 p-3 rounded-xl border border-outline-variant bg-surface-low hover:border-primary hover:bg-white text-left transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px] text-primary">{level.icon}</span>
                        <span>
                          <span className="block text-sm font-bold text-on-surface">{level.label}</span>
                          <span className="block text-[11px] text-on-surface-variant">{level.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isDraftSession && activeSession.draft && !draftAwaitingDetail && (
                <ProjectDraftCard
                  draft={activeSession.draft}
                  status={activeSession.draftStatus}
                  disabled={loading || activeSession.draftStatus === 'confirming'}
                  categories={projectCategories}
                  source={activeSession.draftSource}
                  versions={activeSession.draftVersions || []}
                  onChange={handleDraftEdit}
                  onConfirm={() => confirmDraft()}
                  onRestore={handleRestoreVersion}
                />
              )}
              {/* Bottom Spacer so the latest message always sits comfortably above the floating pill dock */}
              <div className="h-44 sm:h-52 shrink-0 pointer-events-none" />
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating Bottom Input Dock Island */}
          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-5 pb-4 sm:pb-6 z-20 pointer-events-none bg-gradient-to-t from-surface via-surface/85 to-transparent pt-8 flex flex-col items-center">
            <div className="w-full max-w-2xl pointer-events-auto space-y-2">
              {/* Quick Prompts or Floating Stop Indicator */}
              {loading ? (
                <div className="flex items-center justify-center pb-0.5 animate-fadeIn">
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/10 border border-red-500/30 text-red-700 hover:bg-red-500/20 backdrop-blur-md rounded-full text-xs font-mono font-bold transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                    <span>Antwort stoppen</span>
                  </button>
                </div>
              ) : dynamicPrompts.length === 0 ? null : (
                <div className="flex items-center gap-2 no-wrap-scroll text-[11px] font-mono pb-0.5 overflow-x-auto">
                  <span className="text-on-surface-variant font-bold flex-shrink-0">PROMPTS:</span>
                  {dynamicPrompts.map((qp) => (
                    <button
                      key={qp.id}
                      className="px-2.5 py-1 bg-white/95 backdrop-blur-md border border-outline-variant/80 rounded-lg hover:border-primary text-primary transition-all font-medium whitespace-nowrap flex-shrink-0 cursor-pointer shadow-xs hover:shadow-sm"
                      onClick={() => handleSendMessage(qp.promptText)}
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Floating Glass Input Bar */}
              <div className="bg-white/95 backdrop-blur-xl border border-outline-variant/80 rounded-2xl shadow-xl hover:shadow-2xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col p-1.5">
                {/* Attached Context Chips Bar */}
                {activeAttachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-2 border-b border-outline-variant/40">
                    {activeAttachments.map((att) => (
                      <div
                        key={`${att.type}_${att.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-low border border-outline-variant rounded-lg text-xs font-mono font-medium shadow-2xs group hover:bg-white transition-colors"
                      >
                        <span className={`material-symbols-outlined text-[15px] ${
                          att.type === 'project' ? 'text-primary' : att.type === 'reminder' ? 'text-amber-700' : 'text-blue-600'
                        }`}>
                          {att.type === 'project' ? 'folder' : att.type === 'reminder' ? 'notifications' : 'calendar_month'}
                        </span>
                        <span className="truncate max-w-[160px] text-on-surface">{att.title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (att.type === 'project') toggleProjectContext(att.id);
                            else if (att.type === 'reminder') toggleReminderContext(att.id);
                            else if (att.type === 'calendar') toggleCalendarContext();
                            else if (att.type === 'calendar_event') toggleCalendarEventContext(att.id);
                          }}
                          className="text-on-surface-variant hover:text-red-600 transition-colors ml-0.5 cursor-pointer flex items-center justify-center"
                          title={`${att.title} entfernen`}
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsContextModalOpen(true)}
                      className="text-[11px] font-mono font-medium text-primary hover:underline px-1 cursor-pointer flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>Weiteren Kontext hinzufügen</span>
                    </button>
                  </div>
                )}

                {/* Main Input Controls Row */}
                <div className="flex items-center w-full">
                  {/* Context Selector Button with Active Status */}
                  <button
                    type="button"
                    onClick={() => setIsContextModalOpen(true)}
                    className={`relative flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                      hasCustomContext
                        ? 'bg-primary/10 text-primary border border-primary/30 shadow-2xs hover:bg-primary/15'
                        : 'text-on-surface-variant hover:text-primary hover:bg-surface-low border border-transparent'
                    }`}
                    title={
                      hasCustomContext
                        ? isGeneralOnlySelected
                          ? 'KI-Kontext: Allgemeiner Coach (aktiv)'
                          : `KI-Kontext: ${totalActiveCustomCount} Element(e) ausgewählt (aktiv)`
                        : 'Kontext & Daten für Fio wählen (Kalender, Projekte & Erinnerungen)'
                    }
                  >
                    <span className={`material-symbols-outlined text-[20px] ${hasCustomContext ? 'font-bold text-primary' : ''}`}>tune</span>
                    {hasCustomContext && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center shadow-xs">
                        {isGeneralOnlySelected ? (
                          <span className="material-symbols-outlined text-[10px]">psychology</span>
                        ) : (
                          totalActiveCustomCount
                        )}
                      </span>
                    )}
                  </button>

                  <textarea
                    ref={textareaRef}
                    className="flex-grow border-none focus:ring-0 text-sm px-2 sm:px-3 py-2 sm:py-2.5 outline-none resize-none overflow-y-auto min-h-[44px] bg-transparent"
                    placeholder={
                      loading
                        ? 'Fio generiert gerade eine Antwort...'
                        : draftAwaitingDetail
                        ? 'Wähle oben die Detailtiefe …'
                        : draftOpen
                        ? 'Sag Fio, was am Entwurf anders sein soll …'
                        : 'Frage deinen Coach...'
                    }
                    value={inputText}
                    rows={1}
                    disabled={loading || draftAwaitingDetail}
                    style={{ height: 'auto' }}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  {/* Voice Input Button */}
                  {!loading && (
                    <button
                      type="button"
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer mr-1 ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse shadow-md'
                          : 'text-on-surface-variant hover:text-primary hover:bg-surface-low'
                      }`}
                      title={isListening ? 'Zuhören beenden' : 'Spracheingabe starten'}
                      onClick={handleToggleListening}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {isListening ? 'mic' : 'mic_none'}
                      </span>
                    </button>
                  )}

                  {/* Send or Stop Button */}
                  {loading ? (
                    <button
                      type="button"
                      className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md animate-scaleIn hover:scale-105 active:scale-95"
                      title="Antwort unterbrechen"
                      onClick={handleStopGeneration}
                    >
                      <span className="material-symbols-outlined text-[18px]">stop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-10 h-10 bg-neutral-900 text-white rounded-xl hover:bg-black transition-colors flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Nachricht senden"
                      disabled={!inputText.trim() || loading}
                      onClick={() => handleSendMessage()}
                    >
                      <span className="material-symbols-outlined text-[20px]">send</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. SIDEBAR FILTER MODAL: Suche & Filter für den Chatverlauf */}
      {isSidebarFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-low/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">filter_list</span>
                <span className="font-bold text-sm text-on-surface">Chat-Verlauf durchsuchen & filtern</span>
              </div>
              <button
                onClick={() => setIsSidebarFilterModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-low text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-outline-variant/60 bg-white">
              <div className="flex items-center gap-2 bg-surface-low border border-outline-variant rounded-xl px-3 py-2 focus-within:border-primary focus-within:bg-white transition-colors">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                <input
                  type="text"
                  autoFocus
                  value={sidebarSearchQuery}
                  onChange={(e) => setSidebarSearchQuery(e.target.value)}
                  placeholder="Kalender, Projekte oder Erinnerungen filtern..."
                  className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 p-0 text-on-surface"
                />
                {sidebarSearchQuery && (
                  <button onClick={() => setSidebarSearchQuery('')} className="text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider px-1">
                  Allgemein
                </span>
                <div
                  onClick={() => {
                    setSidebarScopeFilter('all');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'all'
                      ? 'bg-primary/5 border-primary shadow-xs'
                      : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">forum</span>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Alle Chats anzeigen</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Gesamten Verlauf anzeigen</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'all' && (
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                  )}
                </div>

                <div
                  onClick={() => {
                    setSidebarScopeFilter('calendar');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'calendar'
                      ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                      : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-blue-400/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">calendar_month</span>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Kalender & Termine</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Chats mit Kalender- und Terminbezug</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'calendar' && (
                    <span className="material-symbols-outlined text-[18px] text-blue-600">check</span>
                  )}
                </div>

                <div
                  onClick={() => {
                    setSidebarScopeFilter('general');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'general'
                      ? 'bg-primary/5 border-primary shadow-xs'
                      : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Allgemeiner Coach</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Chats ohne Projekt-/Erinnerungsbindung</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'general' && (
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                  )}
                </div>

                <div
                  onClick={() => {
                    setSidebarScopeFilter('drafts');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'drafts'
                      ? 'bg-primary/5 border-primary shadow-xs'
                      : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Entwürfe</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Projektanlegung mit fertigen Entwürfen</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'drafts' && (
                    <span className="material-symbols-outlined text-[18px] text-primary">check</span>
                  )}
                </div>
              </div>

              {/* Projects */}
              {sidebarModalFilteredItems.projects.length > 0 && (() => {
                const isSearching = !!sidebarSearchQuery.trim();
                const visible = isSearching || showAllSidebarProjects
                  ? sidebarModalFilteredItems.projects
                  : sidebarModalFilteredItems.projects.slice(0, 3);
                const hasMore = !isSearching && sidebarModalFilteredItems.projects.length > 3;

                return (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider px-1">
                      Projekte ({sidebarModalFilteredItems.projects.length})
                    </span>
                    {visible.map((p) => {
                      const isSelected = sidebarScopeFilter === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSidebarScopeFilter(p.id);
                            setIsSidebarFilterModalOpen(false);
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-primary/5 border-primary shadow-xs'
                              : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">folder</span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-on-surface truncate">{p.title}</div>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                {p.progress || 0}% abgeschlossen • {p.phases?.length || 0} Abschnitte
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">check</span>
                          )}
                        </div>
                      );
                    })}

                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setShowAllSidebarProjects(!showAllSidebarProjects)}
                        className="w-full py-2 px-3 text-[11px] font-mono font-bold text-primary bg-surface-low hover:bg-white border border-outline-variant/60 hover:border-primary/40 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                      >
                        <span>{showAllSidebarProjects ? 'Weniger anzeigen' : `Mehr anzeigen (${sidebarModalFilteredItems.projects.length - 3} weitere)`}</span>
                        <span className="material-symbols-outlined text-[15px]">
                          {showAllSidebarProjects ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Reminders */}
              {sidebarModalFilteredItems.reminders.length > 0 && (() => {
                const isSearching = !!sidebarSearchQuery.trim();
                const visible = isSearching || showAllSidebarReminders
                  ? sidebarModalFilteredItems.reminders
                  : sidebarModalFilteredItems.reminders.slice(0, 3);
                const hasMore = !isSearching && sidebarModalFilteredItems.reminders.length > 3;

                return (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider px-1">
                      Erinnerungen ({sidebarModalFilteredItems.reminders.length})
                    </span>
                    {visible.map((r) => {
                      const isSelected = sidebarScopeFilter === r.id;
                      return (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSidebarScopeFilter(r.id);
                            setIsSidebarFilterModalOpen(false);
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-primary/5 border-primary shadow-xs'
                              : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0">notifications</span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-on-surface truncate">{r.title}</div>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                {r.date || 'Kein Termin'} {r.time ? `• ${r.time} Uhr` : ''} • {r.status || 'AKTIV'}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">check</span>
                          )}
                        </div>
                      );
                    })}

                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setShowAllSidebarReminders(!showAllSidebarReminders)}
                        className="w-full py-2 px-3 text-[11px] font-mono font-bold text-primary bg-surface-low hover:bg-white border border-outline-variant/60 hover:border-primary/40 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                      >
                        <span>{showAllSidebarReminders ? 'Weniger anzeigen' : `Mehr anzeigen (${sidebarModalFilteredItems.reminders.length - 3} weitere)`}</span>
                        <span className="material-symbols-outlined text-[15px]">
                          {showAllSidebarReminders ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 2. KI-KONTEXT & ANHÄNGE MODAL (Wählt aus, welche Daten der KI als Kontext übergeben werden) */}
      {isContextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-low/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
                <span className="font-bold text-sm text-on-surface">Kontext & Anhänge für Fio auswählen</span>
              </div>
              <button
                onClick={() => setIsContextModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-low text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className="p-3 border-b border-outline-variant/60 bg-white">
              <div className="flex items-center gap-2 bg-surface-low border border-outline-variant rounded-xl px-3 py-2 focus-within:border-primary focus-within:bg-white transition-colors">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                <input
                  type="text"
                  autoFocus
                  value={contextModalSearch}
                  onChange={(e) => setContextModalSearch(e.target.value)}
                  placeholder="Kalender, Projekte oder Erinnerungen für Fio suchen..."
                  className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 p-0 text-on-surface"
                />
                {contextModalSearch && (
                  <button onClick={() => setContextModalSearch('')} className="text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Items List with Multi-Select Checkboxes */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Preset Scopes */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider px-1">
                  Voreinstellungen
                </span>
                
                {/* All Context Option */}
                <div
                  onClick={selectAllContext}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isAllContextSelected && (activeSession?.contextAttachments || []).length === 0
                      ? 'bg-primary/5 border-primary shadow-xs'
                      : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">forum</span>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Alle Daten übergeben (Kalender, Projekte & Erinnerungen)</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Voller Zugriff auf alle Termine, Projekte und Erinnerungen</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isAllContextSelected && (activeSession?.contextAttachments || []).length === 0 ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-white'
                  }`}>
                    {isAllContextSelected && (activeSession?.contextAttachments || []).length === 0 && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </div>
                </div>

                {/* General Coach Only */}
                <div
                  onClick={selectGeneralOnlyContext}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isGeneralOnlySelected
                      ? 'bg-primary/5 border-primary shadow-xs'
                      : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Allgemeiner Coach (Ohne Projektdaten)</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Freies Gespräch ohne aktiven Aufgaben-Kontext</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isGeneralOnlySelected ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-white'
                  }`}>
                    {isGeneralOnlySelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </div>
                </div>
              </div>

              {/* Kalender & Termine Multi-Select Section */}
              {(contextModalFilteredItems.calendarEvents.length > 0 || isCalendarConnected) && (() => {
                const isSearching = !!contextModalSearch.trim();
                const visibleEvents = isSearching || showAllContextCalendar
                  ? contextModalFilteredItems.calendarEvents
                  : contextModalFilteredItems.calendarEvents.slice(0, 3);
                const hasMoreEvents = !isSearching && contextModalFilteredItems.calendarEvents.length > 3;
                const isMasterCalChecked = isCalendarContextSelected || (activeSession?.contextAttachments || []).some(a => a.type === 'calendar');

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
                        Kalender ({contextModalFilteredItems.calendarEvents.length} Termine)
                      </span>
                    </div>

                    {/* Master Calendar Option */}
                    <div
                      onClick={toggleCalendarContext}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isMasterCalChecked
                          ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                          : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-blue-400/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">calendar_month</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-on-surface truncate">Gesamter Kalender</div>
                          <div className="text-[10px] font-mono text-on-surface-variant">
                            {isCalendarConnected ? `${calendarEvents.length} Termine geladen • Google Kalender aktiv` : (user?.isGuest ? 'Gastmodus (kein Google Kalender)' : 'Kalender nicht verknüpft')}
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                        isMasterCalChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-outline-variant bg-white'
                      }`}>
                        {isMasterCalChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                      </div>
                    </div>

                    {/* Individual Events */}
                    {visibleEvents.map((evt) => {
                      const isChecked = isMasterCalChecked || selectedCalendarEventIds.includes(evt.id) || (activeSession?.contextAttachments || []).some(a => a.id === evt.id && a.type === 'calendar_event');
                      const rawStart = evt.start?.dateTime || evt.start?.date || '';
                      let timeDisplay = '';
                      if (rawStart) {
                        try {
                          const d = new Date(rawStart);
                          timeDisplay = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                          if (rawStart.includes('T')) {
                            timeDisplay += ` • ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
                          }
                        } catch {
                          timeDisplay = rawStart;
                        }
                      }
                      return (
                        <div
                          key={evt.id}
                          onClick={() => toggleCalendarEventContext(evt.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-400/40 shadow-xs'
                              : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-blue-400/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-blue-500 shrink-0">event</span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-on-surface truncate">{evt.summary || evt.title || 'Termin'}</div>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                {timeDisplay || 'Termin'}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-outline-variant bg-white'
                          }`}>
                            {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreEvents && (
                      <button
                        type="button"
                        onClick={() => setShowAllContextCalendar(!showAllContextCalendar)}
                        className="w-full py-2 px-3 text-[11px] font-mono font-bold text-primary bg-surface-low hover:bg-white border border-outline-variant/60 hover:border-primary/40 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs mt-1"
                      >
                        <span>{showAllContextCalendar ? 'Weniger anzeigen' : `Mehr anzeigen (${contextModalFilteredItems.calendarEvents.length - 3} weitere)`}</span>
                        <span className="material-symbols-outlined text-[15px]">
                          {showAllContextCalendar ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Projects Multi-Select Section */}
              {contextModalFilteredItems.projects.length > 0 && (() => {
                const isSearching = !!contextModalSearch.trim();
                const visibleProjects = isSearching || showAllContextProjects
                  ? contextModalFilteredItems.projects
                  : contextModalFilteredItems.projects.slice(0, 3);
                const hasMoreProjects = !isSearching && contextModalFilteredItems.projects.length > 3;

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
                        Projekte ({contextModalFilteredItems.projects.length})
                      </span>
                    </div>

                    {visibleProjects.map((p) => {
                      const isChecked = selectedProjectIds.includes(p.id) || (activeSession?.contextAttachments || []).some(a => a.id === p.id && a.type === 'project');
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProjectContext(p.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-primary/5 border-primary/40 shadow-xs'
                              : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">folder</span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-on-surface truncate">{p.title}</div>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                {p.progress || 0}% abgeschlossen • {p.phases?.length || 0} Abschnitte
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                            isChecked ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-white'
                          }`}>
                            {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreProjects && (
                      <button
                        type="button"
                        onClick={() => setShowAllContextProjects(!showAllContextProjects)}
                        className="w-full py-2 px-3 text-[11px] font-mono font-bold text-primary bg-surface-low hover:bg-white border border-outline-variant/60 hover:border-primary/40 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs mt-1"
                      >
                        <span>{showAllContextProjects ? 'Weniger anzeigen' : `Mehr anzeigen (${contextModalFilteredItems.projects.length - 3} weitere)`}</span>
                        <span className="material-symbols-outlined text-[15px]">
                          {showAllContextProjects ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Reminders Multi-Select Section */}
              {contextModalFilteredItems.reminders.length > 0 && (() => {
                const isSearching = !!contextModalSearch.trim();
                const visibleReminders = isSearching || showAllContextReminders
                  ? contextModalFilteredItems.reminders
                  : contextModalFilteredItems.reminders.slice(0, 3);
                const hasMoreReminders = !isSearching && contextModalFilteredItems.reminders.length > 3;

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
                        Erinnerungen ({contextModalFilteredItems.reminders.length})
                      </span>
                    </div>

                    {visibleReminders.map((r) => {
                      const isChecked = selectedReminderIds.includes(r.id) || (activeSession?.contextAttachments || []).some(a => a.id === r.id && a.type === 'reminder');
                      return (
                        <div
                          key={r.id}
                          onClick={() => toggleReminderContext(r.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-primary/5 border-primary/40 shadow-xs'
                              : 'bg-white border-outline-variant hover:bg-surface-low/50 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0">notifications</span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-on-surface truncate">{r.title}</div>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                {r.date || 'Kein Termin'} {r.time ? `• ${r.time} Uhr` : ''} • {r.status || 'AKTIV'}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                            isChecked ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-white'
                          }`}>
                            {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreReminders && (
                      <button
                        type="button"
                        onClick={() => setShowAllContextReminders(!showAllContextReminders)}
                        className="w-full py-2 px-3 text-[11px] font-mono font-bold text-primary bg-surface-low hover:bg-white border border-outline-variant/60 hover:border-primary/40 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs mt-1"
                      >
                        <span>{showAllContextReminders ? 'Weniger anzeigen' : `Mehr anzeigen (${contextModalFilteredItems.reminders.length - 3} weitere)`}</span>
                        <span className="material-symbols-outlined text-[15px]">
                          {showAllContextReminders ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {contextModalFilteredItems.projects.length === 0 && contextModalFilteredItems.reminders.length === 0 && contextModalFilteredItems.calendarEvents.length === 0 && (
                <div className="p-8 text-center text-xs text-on-surface-variant italic">
                  Keine Termine, Projekte oder Erinnerungen für „{contextModalSearch}“ gefunden.
                </div>
              )}
            </div>

            {/* Modal Footer with Action Button */}
            <div className="p-3 border-t border-outline-variant flex items-center justify-end bg-surface-low/50">
              <button
                onClick={() => setIsContextModalOpen(false)}
                className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-mono font-bold hover:bg-black transition-all cursor-pointer shadow-xs"
              >
                Auswahl anwenden
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Coach;
