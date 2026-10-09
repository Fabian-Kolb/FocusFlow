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
import ModelSelectorDropdown from '../ui/ModelSelectorDropdown';
import ProjectDraftCard from '../ui/ProjectDraftCard';
import { reviseDraftWithFio, draftToProjectData, clearNewFlags, DETAIL_LEVELS } from '../../lib/projectDraft';

import { Button, FioMark, Icon, IconButton } from '../ds';
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
Deine Mission ist es, dem Nutzer zu helfen, seinen Tag mit maximalem Fokus, Klarheit ohne Stress meistern.

DAS DREI-SÄULEN-SYSTEM VON FOCUSFLOW:
 basiert auf DREI gleichwertigen, zentralen Säulen:
1. 📅 KALENDER: Feste Termine, feste Uhrzeiten heute Vorbereitung für anstehende Termine morgen.
2. 🔔 ERINNERUNGEN: Zeitkritische To-Dos, Fristen Prioritäten den heutigen Tag.
3. 🎯 PROJEKTE: Strategischer Fortschritt – welcher konkrete nächste Schritt im wichtigsten Vorhaben bringt größten Hebel?

WICHTIGE VERHALTENSREGELN FÜR TAGESFRAGEN (z. B. „Was sollte ich noch machen?“, steht an?“, „Tagesplan“):
 PRÄZISION STATT REIZÜBERFLUTUNG (WENIGER IST MEHR):
   - Wenn nach seinem oder Empfehlungen fragt: Schütte ihn NIEMALS einer endlosen Liste aller Projekte Aufgaben zu! Keine Textwüsten.
 Gib WENIGER, aber dafür PRÄZISER aus: Wähle maximal 2 bis 3 konkrete, hochrelevante Fokus-Punkte aus.
 Strukturiere übersichtlich, ansprechend sofort scannbar Emojis:
     • Kalender-Check: Heutige + kurzer Blick morgen (insb. wenn nötig ist).
  Fokus-Erinnerung: Maximal 1 (höchstens 2) überfällige fällige Erinnerungen.
  Projekt-Fokus: Genau wichtigster nächster aus aktivsten bzw. Projekt (nicht 5 gleichzeitig).

 PROAKTIVER KALENDER- & MORGIGER VORBEREITUNGS-CHECK:
 Der Kalender genauso wichtig wie Erinnerungen beziehe immer aktiv ein!
  heute: Berücksichtige die Tagesstruktur.
  morgen: Untersuche ganz gezielt, ob stehen Meeting, Präsentation, Kundentermin, Arzt, Deadline, Abgabe).
 Vorbereitungs-Check: Prüfe, in Projekten bereits dazu vorbereitet wurden gar nichts gemacht wurde.
   einen morgigen Termin wurde: Weise kurz aufmerksam darauf hin B.: „📅 Kalender-Hinweis hast um 10:00 Uhr ‚Meeting X‘. Da keine hinterlegt ist: Sollen wir 20 Minuten einplanen, Unterlagen vorzubereiten?“).

 IMMER MIT EINER PROAKTIVEN RÜCKFRAGE ABSCHLIESSEN:
 Beende deine Antwort genau konkreten, motivierenden Rückfrage bezüglich des vorgeschlagenen Projekts, nächsten Schritts Kalendertermins „Möchtest du, dass direkt [Aufgabe X] [Y] starten, soll dir Teilaufgaben anlegen?“ „Sollen [Z] eine kurze Vorbereitungs-Erinnerung einstellen?“).
 So kann Chat antworten ins Detail gehen, überlegen müssen.

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
        className={`p-2.5 sm:p-3 cursor-pointer transition-all flex items-center justify-between gap-2.5 rounded-lg border group relative ${
          isActive
            ? 'bg-hover border-strong shadow-xs'
            : 'bg-surface border-subtle hover:border-default hover:bg-hover'
        }`}
      >
        {/* Left / Main: Icon + Title */}
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
            isReminder
              ? 'bg-warning-subtle text-warning border border-warning'
              : isProject || isDraft
              ? 'bg-hover text-primary border border-default'
              : 'bg-subtle text-secondary border border-subtle'
          }`}>
            <Icon name={isReminder ? 'notifications' : isDraft ? 'edit_note' : isProject ? 'folder' : 'psychology'} size="sm" />
          </div>

          <span className={`text-caption block truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
            {sess.title || 'Gespräch'}
          </span>
        </div>

        {/* Right: Time on Top, Message Count below */}
        <div className="flex flex-col items-end shrink-0 text-right gap-0.5">
          <span className="text-micro font-label text-secondary font-medium">
            {formatSessionTime(sess.updatedAt || sess.createdAt)}
          </span>
          <span className="text-micro font-label text-tertiary">
            {sess.messages?.length || 0} Nachr.
          </span>
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteSession(sess.id);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-disabled hover:text-danger hover:bg-danger-subtle transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
          title="Gespräch löschen"
        >
          <Icon name="delete" size="sm" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-canvas">
      <div className="flex h-full w-full relative overflow-hidden">
        {/* Mobile-Only Overlay (Tap to close on small screens) */}
        <div 
          className={`fixed inset-0 bg-scrim z-sheet md:hidden transition-opacity duration-300 ${
            isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsHistoryOpen(false)}
          aria-hidden="true"
        />
        
        {/* Left Floating History Panel (Slides out smoothly, stable inner width prevents wrapping during close) */}
        <div
          className={`
            fixed inset-y-0 left-0 z-sheet h-full
            md:relative md:inset-auto md:z-10
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
            <div className="w-full h-full flex flex-col bg-surface dark:bg-subtle border border-subtle rounded-xl sm:rounded-xl shadow-lg overflow-hidden">
              {/* Header with Neuer Chat & Verkleinern Button */}
              <div className="p-3 sm:p-3.5 border-b border-subtle flex items-center gap-2 bg-subtle">
                {/* Neuer Chat Button (Prominent, Touch-Friendly 40px) */}
                <Button title="Neuen Chat starten" onClick={handleNewChat}>
                  <Icon name="edit_square" size="md" />
                  <span>Neuer Chat</span>
                </Button>

                {/* Button zum Verkleinern des Chats (Matching 40px x 40px UI Button) */}
                <IconButton icon="left_panel_close" label="Verlauf einklappen" variant="secondary" className="shrink-0" onClick={() => setIsHistoryOpen(false)} />
              </div>

            {/* Search Bar for Sessions */}
            <div className="p-2.5 border-b border-subtle">
              <div className="flex items-center gap-1.5 bg-surface border border-subtle rounded-lg px-2.5 py-1.5 focus-within:border-strong transition-colors shadow-xs">
                <Icon name="search" size="sm" className="text-secondary" />
                <input
                  type="text"
                  value={sessionSearchText}
                  onChange={(e) => setSessionSearchText(e.target.value)}
                  placeholder="Gespräche durchsuchen..."
                  className="w-full text-caption bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-tertiary"
                />
                {sessionSearchText && (
                  <button
                    onClick={() => setSessionSearchText('')}
                    className="text-secondary hover:text-primary cursor-pointer"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar Scope / Filter Button */}
            <div className="px-2.5 py-2 border-b border-subtle">
              <button
                onClick={() => setIsSidebarFilterModalOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-surface border border-subtle rounded-lg text-caption-strong font-label hover:border-control hover:bg-hover transition-all cursor-pointer shadow-xs text-left"
                title="Chat-Verlauf filtern / Suche"
              >
                <Icon name="filter_list" size="sm" className="text-primary shrink-0" />
                <span className="truncate">{sidebarScopeLabel}</span>
              </button>
            </div>

            {/* Chronological Session Groups */}
            <div className="space-y-4 p-2.5 overflow-y-auto flex-grow">
              {groupedSessions.today.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
                    Heute
                  </span>
                  {groupedSessions.today.map(renderSessionCard)}
                </div>
              )}

              {groupedSessions.yesterday.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
                    Gestern
                  </span>
                  {groupedSessions.yesterday.map(renderSessionCard)}
                </div>
              )}

              {groupedSessions.lastWeek.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
                    Letzte 7 Tage
                  </span>
                  {groupedSessions.lastWeek.map(renderSessionCard)}
                </div>
              )}

              {groupedSessions.older.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
                    Älter
                  </span>
                  {groupedSessions.older.map(renderSessionCard)}
                </div>
              )}

              {sessions.length === 0 && (
                <div className="p-6 text-center text-caption text-secondary italic">
                  Keine gespeicherten Gespräche vorhanden.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Right Main Chat Panel (Adapts Width Dynamically, Keeps Centered Input & Messages) */}
        <div className="flex-grow min-w-0 flex flex-col h-full relative overflow-hidden bg-canvas">
          {/* Fixed Top Controls Bar with Soft Gradient */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-3 sm:p-3.5 pointer-events-none pb-6">
            {/* Left Action Buttons with Smooth Crossfade */}
            <div className={`flex items-center gap-2 pointer-events-auto transition-opacity duration-200 ${
              isHistoryOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
              <button
                className="h-10 px-3.5 flex items-center gap-1.5 border border-subtle bg-surface dark:bg-subtle hover:border-strong text-primary transition-all rounded-lg cursor-pointer shadow-xs hover:shadow-sm"
                title="Chatverlauf öffnen"
                onClick={() => setIsHistoryOpen(true)}
              >
                <Icon name="history" size="md" />
                <span className="text-caption-strong font-label hidden sm:inline">Verlauf</span>
              </button>
              <button
                className="h-10 px-3.5 flex items-center gap-1.5 bg-accent text-on-accent hover:bg-accent-hover transition-all rounded-lg cursor-pointer shadow-xs hover:shadow-sm"
                title="Neuen Chat starten"
                onClick={handleNewChat}
              >
                <Icon name="edit_square" size="md" />
                <span className="text-caption-strong font-label hidden sm:inline">Neuer Chat</span>
              </button>
            </div>

            {/* Right Header Controls (Fio Guide Button & Model Dropdown) */}
            <div className="flex items-center gap-2 pointer-events-auto ml-auto">
              <button
                type="button"
                onClick={() => openModal('settings', { initialTab: 'fio' })}
                className="h-10 px-3 flex items-center gap-1.5 border border-subtle bg-surface dark:bg-subtle hover:border-strong text-primary transition-all rounded-lg cursor-pointer shadow-xs hover:shadow-sm text-caption-strong"
                title="Was kann Fio? Interaktiven KI-Guide öffnen"
              >
                <Icon name="lightbulb" size="md" className="text-warning" />
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
                <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-4">
                  <div className="w-16 h-16 bg-accent text-on-accent rounded-lg flex items-center justify-center mb-4 shadow-md p-3.5">
                    <FioMark size={20} className="text-on-accent" />
                  </div>
                  <h2 className="text-title mb-1.5 tracking-tight">
                    Hallo{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}, ich bin Fio
                  </h2>
                  <p className="text-body text-secondary max-w-md leading-relaxed">
                    Dein persönlicher KI-Coach. Wie kann ich dich heute bei deinen Projekten, Aufgaben, Erinnerungen und Terminen unterstützen?
                  </p>
                  <Button variant="secondary" onClick={() => openModal('settings', { initialTab: 'fio' })} className="mt-4">
                    <Icon name="lightbulb" size="sm" className="text-warning" />
                    <span>Entdecke, was Fio alles kann</span>
                  </Button>
                </div>
              ) : (
                messages.map((msg) => {
                  const isBot = msg.role === 'assistant' || msg.sender === 'bot';
                  if (isBot) {
                    return (
                      <div key={msg.id} className="flex gap-3 group">
                        <div className="w-8 h-8 flex-shrink-0 bg-accent text-on-accent rounded-lg flex items-center justify-center p-1.5 shadow-sm">
                          <FioMark size={20} className="text-on-accent" />
                        </div>
                        <div className="flex flex-col gap-1 items-start max-w-[85%]">
                          <div className="p-4 bg-surface border border-subtle rounded-lg text-body shadow-sm markdown-body w-full">
                            {msg.content || msg.text ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content || msg.text}
                              </ReactMarkdown>
                            ) : msg.cancelled ? (
                              <div className="flex items-center gap-1.5 py-1 text-secondary text-caption italic">
                                <Icon name="pause_circle" size="sm" />
                                <span>Antwort abgebrochen</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 py-1 text-secondary text-caption">
                                <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                                <span>Fio denkt nach...</span>
                              </div>
                            )}

                            {/* Render Interactive Action Results Cards */}
                            {msg.actionResults && msg.actionResults.length > 0 && (
                              <div className="space-y-2 mt-3 pt-3 border-t border-subtle w-full not-prose">
                                {msg.actionResults.map((res, idx) => {
                                  const isProjAction = res.targetType === 'project' || res.type === 'ADD_PHASE' || res.type === 'ADD_TASK' || res.type === 'CREATE_PROJECT' || res.type === 'UPDATE_PROJECT';
                                  const isRemAction = res.targetType === 'reminder' || res.type === 'CREATE_REMINDER' || res.type === 'UPDATE_REMINDER';
                                  const isCalAction = res.targetType === 'calendar' || res.isOnlyCalendar || res.type === 'CREATE_CALENDAR_EVENT';
                                  const isNoteAction = res.type === 'CREATE_NOTE';
                                  const isMatAction = res.type === 'ADD_MATERIAL';

                                  const iconName = isNoteAction ? 'note_alt' : isMatAction ? 'attach_file' : isCalAction ? 'calendar_month' : isRemAction ? 'notifications' : isProjAction ? 'folder' : 'check_circle';
                                  const iconStyle = isNoteAction
                                    ? 'bg-accent-subtle text-accent border-accent'
                                    : isMatAction
                                    ? 'bg-info-subtle text-info border-info'
                                    : isCalAction
                                    ? 'bg-info-subtle text-accent border-info'
                                    : isRemAction
                                    ? 'bg-warning-subtle text-warning border-warning'
                                    : isProjAction
                                    ? 'bg-hover text-primary border-default'
                                    : 'bg-success-subtle text-success border-success';

                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between gap-3 p-2.5 bg-subtle border border-subtle rounded-lg text-caption shadow-xs group hover:border-control transition-all"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${iconStyle}`}>
                                          <Icon name={iconName} size="sm" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-semibold truncate">{res.title}</div>
                                          <div className="text-micro font-label text-secondary truncate">{res.subtitle}</div>
                                        </div>
                                      </div>
                                      {(isCalAction || res.targetType === 'calendar') && (
                                        <Button variant="secondary" size="sm" onClick={() => {
                                            if (setCurrentScreen) setCurrentScreen('calendar');
                                          }} className="shrink-0">
                                          <span>Im Kalender ansehen</span>
                                          <Icon name="arrow_forward" size="sm" />
                                        </Button>
                                      )}
                                      {res.targetType === 'project' && res.targetId && (
                                        <Button variant="secondary" size="sm" onClick={() => {
                                            setSelectedProjectId(res.targetId);
                                            if (setCurrentScreen) setCurrentScreen('project-detail');
                                          }} className="shrink-0">
                                          <span>Projekt öffnen</span>
                                          <Icon name="arrow_forward" size="sm" />
                                        </Button>
                                      )}
                                      {res.targetType === 'reminder' && res.targetId && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {res.isCalendarSynced && (
                                            <IconButton icon="calendar_month" label="Im Kalender ansehen" variant="secondary" size="sm" onClick={() => {
                                                if (setCurrentScreen) setCurrentScreen('calendar');
                                              }} />
                                          )}
                                          <Button variant="secondary" size="sm" onClick={() => {
                                              setSelectedReminderId(res.targetId);
                                              if (setCurrentScreen) setCurrentScreen('reminder-detail');
                                            }} className="shrink-0">
                                            <span>Erinnerung öffnen</span>
                                            <Icon name="arrow_forward" size="sm" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Render 3-Way Intent Choice Pills if AI proposed an appointment/reminder */}
                            {msg.intentChoice && (
                              <div className="mt-3 pt-2.5 border-t border-subtle w-full space-y-2 not-prose">
                                <div className="text-micro font-label font-semibold text-secondary flex items-center gap-1">
                                  <Icon name="help" size="sm" className="text-primary" />
                                  <span>Wo soll der Eintrag angelegt werden?</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <Button variant="secondary" size="sm" onClick={() => handleSendMessage(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur in FocusFlow.`)}>
                                    <Icon name="notifications" size="sm" className="text-warning" />
                                    <span>Nur in FocusFlow</span>
                                  </Button>

                                  <button
                                    type="button"
                                    disabled={user?.isGuest || !isCalendarConnected}
                                    onClick={() => handleSendMessage(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} in FocusFlow mit Google Kalender-Sync.`)}
                                    title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Empfohlen'}
                                    className="px-2.5 py-1.5 rounded-md bg-success-subtle hover:bg-success-subtle border border-success text-caption-strong font-label text-success flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Icon name="sync" size="sm" className="text-success" />
                                    <span>FocusFlow + Kalender-Sync (Empfohlen)</span>
                                  </button>

                                  <Button variant="secondary" size="sm" disabled={user?.isGuest || !isCalendarConnected} onClick={() => handleSendMessage(`Bitte trage den Termin „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur im Google Kalender ein.`)} title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Direkt im Kalender eintragen'}>
                                    <Icon name="calendar_month" size="sm" className="text-primary" />
                                    <span>Nur im Google Kalender</span>
                                  </Button>
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
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-subtle rounded-md text-micro font-label shadow-xs"
                            >
                              <Icon name={att.type === 'project' ? 'folder' : att.type === 'reminder' ? 'notifications' : 'calendar_month'} size="sm" className={`${att.type === 'project' ? 'text-primary' : att.type === 'reminder' ? 'text-warning' : 'text-accent'}`} />
                              <span className="truncate max-w-[150px] font-medium">{att.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 flex-row-reverse">
                        <div className="w-8 h-8 flex-shrink-0 bg-accent text-on-accent border border-default rounded-full flex items-center justify-center text-caption-strong font-label shadow-xs overflow-hidden">
                          {user?.photoURL ? (
                            <img src={user.photoURL} alt="User" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <Icon name="person" size="md" />
                          )}
                        </div>
                        <div className="p-4 bg-accent text-on-accent rounded-lg text-body max-w-[85%] shadow-sm markdown-body">
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
                <div className="rounded-lg border border-control bg-surface p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon name="tune" size="md" className="text-primary" />
                    <span className="text-body-strong">Wie detailliert soll Fio das Projekt aufteilen?</span>
                  </div>
                  <p className="text-caption text-secondary">
                    Das gibt die Richtung vor. Später kannst du den Entwurf von Hand oder per Prompt anpassen.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.entries(DETAIL_LEVELS).map(([key, level]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePickDetail(key)}
                        className="flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-1 p-3 rounded-lg border border-subtle bg-subtle hover:border-strong hover:bg-surface text-left transition-all cursor-pointer"
                      >
                        <Icon name={level.icon} size="md" className="text-primary" />
                        <span>
                          <span className="block text-body-strong">{level.label}</span>
                          <span className="block text-micro text-secondary">{level.hint}</span>
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
          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-5 pb-4 sm:pb-6 z-10 pointer-events-none pt-8 flex flex-col items-center">
            <div className="w-full max-w-2xl pointer-events-auto space-y-2">
              {/* Quick Prompts or Floating Stop Indicator */}
              {loading ? (
                <div className="flex items-center justify-center pb-0.5">
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-danger-subtle border border-danger text-danger hover:bg-danger-subtle rounded-md text-caption-strong font-label transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <span className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                    <span>Antwort stoppen</span>
                  </button>
                </div>
              ) : dynamicPrompts.length === 0 ? null : (
                <div className="flex items-center gap-2 no-wrap-scroll text-micro font-label pb-0.5 overflow-x-auto">
                  <span className="text-secondary font-semibold flex-shrink-0">PROMPTS:</span>
                  {dynamicPrompts.map((qp) => (
                    <Button variant="secondary" size="sm" key={qp.id} onClick={() => handleSendMessage(qp.promptText)}>
                      {qp.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Floating Glass Input Bar */}
              <div className="bg-surface border border-subtle rounded-xl shadow-lg hover:shadow-lg focus-within:border-control focus-within:ring-2 focus-within:ring-focus transition-all flex flex-col p-1.5">
                {/* Attached Context Chips Bar */}
                {activeAttachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-2 border-b border-subtle">
                    {activeAttachments.map((att) => (
                      <div
                        key={`${att.type}_${att.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-subtle border border-subtle rounded-md text-caption-strong font-label shadow-xs group hover:bg-surface transition-colors"
                      >
                        <Icon name={att.type === 'project' ? 'folder' : att.type === 'reminder' ? 'notifications' : 'calendar_month'} size="sm" className={`${att.type === 'project' ? 'text-primary' : att.type === 'reminder' ? 'text-warning' : 'text-accent'}`} />
                        <span className="truncate max-w-[160px]">{att.title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (att.type === 'project') toggleProjectContext(att.id);
                            else if (att.type === 'reminder') toggleReminderContext(att.id);
                            else if (att.type === 'calendar') toggleCalendarContext();
                            else if (att.type === 'calendar_event') toggleCalendarEventContext(att.id);
                          }}
                          className="text-secondary hover:text-danger transition-colors ml-0.5 cursor-pointer flex items-center justify-center"
                          title={`${att.title} entfernen`}
                        >
                          <Icon name="close" size="sm" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsContextModalOpen(true)}
                      className="text-micro font-label font-medium text-primary hover:underline px-1 cursor-pointer flex items-center gap-0.5"
                    >
                      <Icon name="add" size="sm" />
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
                    className={`relative flex items-center justify-center p-2 rounded-lg transition-all cursor-pointer shrink-0 ${
                      hasCustomContext
                        ? 'bg-hover text-primary border border-default shadow-xs hover:bg-pressed'
                        : 'text-secondary hover:text-primary hover:bg-hover border border-transparent'
                    }`}
                    title={
                      hasCustomContext
                        ? isGeneralOnlySelected
                          ? 'KI-Kontext: Allgemeiner Coach (aktiv)'
                          : `KI-Kontext: ${totalActiveCustomCount} Element(e) ausgewählt (aktiv)`
                        : 'Kontext & Daten für Fio wählen (Kalender, Projekte & Erinnerungen)'
                    }
                  >
                    <Icon name="tune" size="md" className={`${hasCustomContext ? 'font-semibold text-primary' : ''}`} />
                    {hasCustomContext && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-on-accent text-micro font-label font-semibold rounded-full flex items-center justify-center shadow-xs">
                        {isGeneralOnlySelected ? (
                          <Icon name="psychology" size="sm" />
                        ) : (
                          totalActiveCustomCount
                        )}
                      </span>
                    )}
                  </button>

                  <textarea
                    ref={textareaRef}
                    className="flex-grow border-none focus:ring-0 text-body px-2 sm:px-3 py-2 sm:py-2.5 outline-none resize-none overflow-y-auto min-h-11 bg-transparent"
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
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all cursor-pointer mr-1 ${
                        isListening
                          ? 'bg-danger text-on-accent animate-pulse shadow-md'
                          : 'text-secondary hover:text-primary hover:bg-hover'
                      }`}
                      title={isListening ? 'Zuhören beenden' : 'Spracheingabe starten'}
                      onClick={handleToggleListening}
                    >
                      <Icon name={isListening ? 'mic' : 'mic_none'} size="md" />
                    </button>
                  )}

                  {/* Send or Stop Button */}
                  {loading ? (
                    <IconButton icon="stop" label="Antwort unterbrechen" variant="danger" onClick={handleStopGeneration} />
                  ) : (
                    <IconButton icon="send" label="Nachricht senden" variant="primary" disabled={!inputText.trim() || loading} onClick={() => handleSendMessage()} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. SIDEBAR FILTER MODAL: Suche & Filter für den Chatverlauf */}
      {isSidebarFilterModalOpen && (
        <div className="fixed inset-0 z-dropdown flex items-center justify-center p-4 bg-scrim">
          <div className="bg-surface rounded-xl border border-subtle shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-subtle flex items-center justify-between bg-subtle">
              <div className="flex items-center gap-2">
                <Icon name="filter_list" size="md" className="text-primary" />
                <span className="text-body-strong">Chat-Verlauf durchsuchen & filtern</span>
              </div>
              <button
                onClick={() => setIsSidebarFilterModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-hover text-secondary transition-colors cursor-pointer"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-subtle bg-surface">
              <div className="flex items-center gap-2 bg-subtle border border-subtle rounded-lg px-3 py-2 focus-within:border-strong focus-within:bg-surface transition-colors">
                <Icon name="search" size="md" className="text-secondary" />
                <input
                  type="text"
                  autoFocus
                  value={sidebarSearchQuery}
                  onChange={(e) => setSidebarSearchQuery(e.target.value)}
                  placeholder="Kalender, Projekte oder Erinnerungen filtern..."
                  className="w-full text-caption bg-transparent border-none outline-none focus:ring-0 p-0"
                />
                {sidebarSearchQuery && (
                  <button onClick={() => setSidebarSearchQuery('')} className="text-secondary hover:text-primary">
                    <Icon name="close" size="sm" />
                  </button>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1.5">
                <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
                  Allgemein
                </span>
                <div
                  onClick={() => {
                    setSidebarScopeFilter('all');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'all'
                      ? 'bg-hover border-strong shadow-xs'
                      : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name="forum" size="md" className="text-primary" />
                    <div>
                      <div className="text-caption-strong">Alle Chats anzeigen</div>
                      <div className="text-micro font-label text-secondary">Gesamten Verlauf anzeigen</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'all' && (
                    <Icon name="check" size="md" className="text-primary" />
                  )}
                </div>

                <div
                  onClick={() => {
                    setSidebarScopeFilter('calendar');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'calendar'
                      ? 'bg-info-subtle border-info shadow-xs'
                      : 'bg-surface border-subtle hover:bg-hover hover:border-info'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name="calendar_month" size="md" className="text-accent" />
                    <div>
                      <div className="text-caption-strong">Kalender & Termine</div>
                      <div className="text-micro font-label text-secondary">Chats mit Kalender- und Terminbezug</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'calendar' && (
                    <Icon name="check" size="md" className="text-accent" />
                  )}
                </div>

                <div
                  onClick={() => {
                    setSidebarScopeFilter('general');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'general'
                      ? 'bg-hover border-strong shadow-xs'
                      : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name="psychology" size="md" className="text-primary" />
                    <div>
                      <div className="text-caption-strong">Allgemeiner Coach</div>
                      <div className="text-micro font-label text-secondary">Chats ohne Projekt-/Erinnerungsbindung</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'general' && (
                    <Icon name="check" size="md" className="text-primary" />
                  )}
                </div>

                <div
                  onClick={() => {
                    setSidebarScopeFilter('drafts');
                    setIsSidebarFilterModalOpen(false);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    sidebarScopeFilter === 'drafts'
                      ? 'bg-hover border-strong shadow-xs'
                      : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name="edit_note" size="md" className="text-primary" />
                    <div>
                      <div className="text-caption-strong">Entwürfe</div>
                      <div className="text-micro font-label text-secondary">Projektanlegung mit fertigen Entwürfen</div>
                    </div>
                  </div>
                  {sidebarScopeFilter === 'drafts' && (
                    <Icon name="check" size="md" className="text-primary" />
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
                    <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
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
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-hover border-strong shadow-xs'
                              : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon name="folder" size="md" className="text-primary shrink-0" />
                            <div className="min-w-0">
                              <div className="text-caption-strong truncate">{p.title}</div>
                              <div className="text-micro font-label text-secondary">
                                {p.progress || 0}% abgeschlossen • {p.phases?.length || 0} Abschnitte
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <Icon name="check" size="md" className="text-primary shrink-0" />
                          )}
                        </div>
                      );
                    })}

                    {hasMore && (
                      <Button variant="secondary" fullWidth onClick={() => setShowAllSidebarProjects(!showAllSidebarProjects)} className="mt-1">
                        <span>{showAllSidebarProjects ? 'Weniger anzeigen' : `Mehr anzeigen (${sidebarModalFilteredItems.projects.length - 3} weitere)`}</span>
                        <Icon name={showAllSidebarProjects ? 'expand_less' : 'expand_more'} size="sm" />
                      </Button>
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
                    <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
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
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-hover border-strong shadow-xs'
                              : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon name="notifications" size="md" className="text-warning shrink-0" />
                            <div className="min-w-0">
                              <div className="text-caption-strong truncate">{r.title}</div>
                              <div className="text-micro font-label text-secondary">
                                {r.date || 'Kein Termin'} {r.time ? `• ${r.time} Uhr` : ''} • {r.status || 'AKTIV'}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <Icon name="check" size="md" className="text-primary shrink-0" />
                          )}
                        </div>
                      );
                    })}

                    {hasMore && (
                      <Button variant="secondary" fullWidth onClick={() => setShowAllSidebarReminders(!showAllSidebarReminders)} className="mt-1">
                        <span>{showAllSidebarReminders ? 'Weniger anzeigen' : `Mehr anzeigen (${sidebarModalFilteredItems.reminders.length - 3} weitere)`}</span>
                        <Icon name={showAllSidebarReminders ? 'expand_less' : 'expand_more'} size="sm" />
                      </Button>
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
        <div className="fixed inset-0 z-dropdown flex items-center justify-center p-4 bg-scrim">
          <div className="bg-surface rounded-xl border border-subtle shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-subtle flex items-center justify-between bg-subtle">
              <div className="flex items-center gap-2">
                <Icon name="tune" size="md" className="text-primary" />
                <span className="text-body-strong">Kontext & Anhänge für Fio auswählen</span>
              </div>
              <button
                onClick={() => setIsContextModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-hover text-secondary transition-colors cursor-pointer"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className="p-3 border-b border-subtle bg-surface">
              <div className="flex items-center gap-2 bg-subtle border border-subtle rounded-lg px-3 py-2 focus-within:border-strong focus-within:bg-surface transition-colors">
                <Icon name="search" size="md" className="text-secondary" />
                <input
                  type="text"
                  autoFocus
                  value={contextModalSearch}
                  onChange={(e) => setContextModalSearch(e.target.value)}
                  placeholder="Kalender, Projekte oder Erinnerungen für Fio suchen..."
                  className="w-full text-caption bg-transparent border-none outline-none focus:ring-0 p-0"
                />
                {contextModalSearch && (
                  <button onClick={() => setContextModalSearch('')} className="text-secondary hover:text-primary">
                    <Icon name="close" size="sm" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Items List with Multi-Select Checkboxes */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Preset Scopes */}
              <div className="space-y-1.5">
                <span className="font-label text-eyebrow font-semibold text-tertiary uppercase px-1">
                  Voreinstellungen
                </span>
                
                {/* All Context Option */}
                <div
                  onClick={selectAllContext}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isAllContextSelected && (activeSession?.contextAttachments || []).length === 0
                      ? 'bg-hover border-strong shadow-xs'
                      : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name="forum" size="md" className="text-primary" />
                    <div>
                      <div className="text-caption-strong">Alle Daten übergeben (Kalender, Projekte & Erinnerungen)</div>
                      <div className="text-micro font-label text-secondary">Voller Zugriff auf alle Termine, Projekte und Erinnerungen</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isAllContextSelected && (activeSession?.contextAttachments || []).length === 0 ? 'bg-accent border-strong text-on-accent' : 'border-subtle bg-surface'
                  }`}>
                    {isAllContextSelected && (activeSession?.contextAttachments || []).length === 0 && <Icon name="check" size="sm" />}
                  </div>
                </div>

                {/* General Coach Only */}
                <div
                  onClick={selectGeneralOnlyContext}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isGeneralOnlySelected
                      ? 'bg-hover border-strong shadow-xs'
                      : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon name="psychology" size="md" className="text-primary" />
                    <div>
                      <div className="text-caption-strong">Allgemeiner Coach (Ohne Projektdaten)</div>
                      <div className="text-micro font-label text-secondary">Freies Gespräch ohne aktiven Aufgaben-Kontext</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isGeneralOnlySelected ? 'bg-accent border-strong text-on-accent' : 'border-subtle bg-surface'
                  }`}>
                    {isGeneralOnlySelected && <Icon name="check" size="sm" />}
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
                      <span className="font-label text-eyebrow font-semibold text-tertiary uppercase">
                        Kalender ({contextModalFilteredItems.calendarEvents.length} Termine)
                      </span>
                    </div>

                    {/* Master Calendar Option */}
                    <div
                      onClick={toggleCalendarContext}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isMasterCalChecked
                          ? 'bg-info-subtle border-info shadow-xs'
                          : 'bg-surface border-subtle hover:bg-hover hover:border-info'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon name="calendar_month" size="md" className="text-accent shrink-0" />
                        <div className="min-w-0">
                          <div className="text-caption-strong truncate">Gesamter Kalender</div>
                          <div className="text-micro font-label text-secondary">
                            {isCalendarConnected ? `${calendarEvents.length} Termine geladen • Google Kalender aktiv` : (user?.isGuest ? 'Gastmodus (kein Google Kalender)' : 'Kalender nicht verknüpft')}
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                        isMasterCalChecked ? 'bg-accent border-accent text-on-accent' : 'border-subtle bg-surface'
                      }`}>
                        {isMasterCalChecked && <Icon name="check" size="sm" />}
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
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-info-subtle border-info shadow-xs'
                              : 'bg-surface border-subtle hover:bg-hover hover:border-info'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon name="event" size="sm" className="text-accent shrink-0" />
                            <div className="min-w-0">
                              <div className="text-caption-strong truncate">{evt.summary || evt.title || 'Termin'}</div>
                              <div className="text-micro font-label text-secondary">
                                {timeDisplay || 'Termin'}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                            isChecked ? 'bg-accent border-accent text-on-accent' : 'border-subtle bg-surface'
                          }`}>
                            {isChecked && <Icon name="check" size="sm" />}
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreEvents && (
                      <Button variant="secondary" fullWidth onClick={() => setShowAllContextCalendar(!showAllContextCalendar)} className="mt-1">
                        <span>{showAllContextCalendar ? 'Weniger anzeigen' : `Mehr anzeigen (${contextModalFilteredItems.calendarEvents.length - 3} weitere)`}</span>
                        <Icon name={showAllContextCalendar ? 'expand_less' : 'expand_more'} size="sm" />
                      </Button>
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
                      <span className="font-label text-eyebrow font-semibold text-tertiary uppercase">
                        Projekte ({contextModalFilteredItems.projects.length})
                      </span>
                    </div>

                    {visibleProjects.map((p) => {
                      const isChecked = selectedProjectIds.includes(p.id) || (activeSession?.contextAttachments || []).some(a => a.id === p.id && a.type === 'project');
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProjectContext(p.id)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-hover border-control shadow-xs'
                              : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon name="folder" size="md" className="text-primary shrink-0" />
                            <div className="min-w-0">
                              <div className="text-caption-strong truncate">{p.title}</div>
                              <div className="text-micro font-label text-secondary">
                                {p.progress || 0}% abgeschlossen • {p.phases?.length || 0} Abschnitte
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                            isChecked ? 'bg-accent border-strong text-on-accent' : 'border-subtle bg-surface'
                          }`}>
                            {isChecked && <Icon name="check" size="sm" />}
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreProjects && (
                      <Button variant="secondary" fullWidth onClick={() => setShowAllContextProjects(!showAllContextProjects)} className="mt-1">
                        <span>{showAllContextProjects ? 'Weniger anzeigen' : `Mehr anzeigen (${contextModalFilteredItems.projects.length - 3} weitere)`}</span>
                        <Icon name={showAllContextProjects ? 'expand_less' : 'expand_more'} size="sm" />
                      </Button>
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
                      <span className="font-label text-eyebrow font-semibold text-tertiary uppercase">
                        Erinnerungen ({contextModalFilteredItems.reminders.length})
                      </span>
                    </div>

                    {visibleReminders.map((r) => {
                      const isChecked = selectedReminderIds.includes(r.id) || (activeSession?.contextAttachments || []).some(a => a.id === r.id && a.type === 'reminder');
                      return (
                        <div
                          key={r.id}
                          onClick={() => toggleReminderContext(r.id)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-hover border-control shadow-xs'
                              : 'bg-surface border-subtle hover:bg-hover hover:border-default'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon name="notifications" size="md" className="text-warning shrink-0" />
                            <div className="min-w-0">
                              <div className="text-caption-strong truncate">{r.title}</div>
                              <div className="text-micro font-label text-secondary">
                                {r.date || 'Kein Termin'} {r.time ? `• ${r.time} Uhr` : ''} • {r.status || 'AKTIV'}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                            isChecked ? 'bg-accent border-strong text-on-accent' : 'border-subtle bg-surface'
                          }`}>
                            {isChecked && <Icon name="check" size="sm" />}
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreReminders && (
                      <Button variant="secondary" fullWidth onClick={() => setShowAllContextReminders(!showAllContextReminders)} className="mt-1">
                        <span>{showAllContextReminders ? 'Weniger anzeigen' : `Mehr anzeigen (${contextModalFilteredItems.reminders.length - 3} weitere)`}</span>
                        <Icon name={showAllContextReminders ? 'expand_less' : 'expand_more'} size="sm" />
                      </Button>
                    )}
                  </div>
                );
              })()}

              {contextModalFilteredItems.projects.length === 0 && contextModalFilteredItems.reminders.length === 0 && contextModalFilteredItems.calendarEvents.length === 0 && (
                <div className="p-8 text-center text-caption text-secondary italic">
                  Keine Termine, Projekte oder Erinnerungen für „{contextModalSearch}“ gefunden.
                </div>
              )}
            </div>

            {/* Modal Footer with Action Button */}
            <div className="p-3 border-t border-subtle flex items-center justify-end bg-subtle">
              <Button onClick={() => setIsContextModalOpen(false)}>
                Auswahl anwenden
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Coach;
