import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { askGeminiCoach } from '../../lib/gemini';
import { ACTION_ENGINE_SYSTEM_PROMPT, parseAiActions, executeAiActions } from '../../lib/aiActionEngine';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FioIcon from '../ui/FioIcon';
import ModelSelectorDropdown from '../ui/ModelSelectorDropdown';

const Coach = ({ setCurrentScreen }) => {
  const modalContext = useModalContext();
  const { projects, reminders = [], setSelectedProjectId, setSelectedReminderId } = modalContext;
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
    updateStreamingMessage
  } = useChat();

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
  const [showAllContextProjects, setShowAllContextProjects] = useState(false);
  const [showAllContextReminders, setShowAllContextReminders] = useState(false);

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
      alert('Spracheingabe wird in diesem Browser leider nicht unterstützt. Bitte benutze Chrome, Edge oder Safari.');
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
    selectedProjectIds.forEach((pid) => {
      const p = projects.find((item) => item.id === pid);
      if (p) list.push({ type: 'project', id: p.id, title: p.title });
    });
    selectedReminderIds.forEach((rid) => {
      const r = reminders.find((item) => item.id === rid);
      if (r) list.push({ type: 'reminder', id: r.id, title: r.title });
    });
    return list;
  }, [isGeneralOnlySelected, isAllContextSelected, selectedProjectIds, selectedReminderIds, projects, reminders]);

  const hasCustomContext = useMemo(() => {
    return isGeneralOnlySelected || (!isAllContextSelected && (selectedProjectIds.length > 0 || selectedReminderIds.length > 0));
  }, [isGeneralOnlySelected, isAllContextSelected, selectedProjectIds, selectedReminderIds]);

  const totalActiveCustomCount = useMemo(() => {
    if (isGeneralOnlySelected) return 1;
    return selectedProjectIds.length + selectedReminderIds.length;
  }, [isGeneralOnlySelected, selectedProjectIds, selectedReminderIds]);

  // Build Multi-Context Grounded System Instruction for Gemini
  const buildSystemInstruction = (specificAttachments) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    let contextData = {
      heutigesDatum: `${dateStr}, ${timeStr} Uhr`
    };

    const sessionContexts = activeSession?.contextAttachments || [];
    const msgContexts = specificAttachments || activeAttachments || [];
    const allContexts = [...sessionContexts];
    msgContexts.forEach(c => {
      if (!allContexts.some(item => item.id === c.id && item.type === c.type)) {
        allContexts.push(c);
      }
    });

    let contextMetaGuidance = '';

    if (allContexts.length > 0) {
      const projIds = allContexts.filter(a => a.type === 'project').map(a => a.id);
      const remIds = allContexts.filter(a => a.type === 'reminder').map(a => a.id);

      const chosenProjects = projects.filter((p) => projIds.includes(p.id));
      const chosenReminders = reminders.filter((r) => remIds.includes(r.id));
      const focusTitles = [...chosenProjects.map(p => p.title), ...chosenReminders.map(r => r.title)].join(', ');

      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat für dieses Gespräch gezielt einen spezifischen Fokus auf folgende Elemente gelegt: [${focusTitles}].
Er möchte sich in dieser Konversation fokussiert genau auf diese Projekte bzw. Erinnerungen konzentrieren.

WICHTIGE ANWEISUNG FÜR DEINE TONALITÄT & FORMULIERUNGEN:
- Sprich diese Einschränkung NICHT mechanisch oder belehrend an (sage z. B. NIE: "Ich sehe, du hast das Projekt X ausgewählt" oder "Da du nur Projekt Y übergeben hast...").
- Nutze dieses Hintergrundwissen ganz natürlich im Kopf, um deine Formulierungen, Ratschläge, Priorisierungen und Teilschritte direkt auf diese Themen zuzuschneiden.
- Antworte sofort präzise auf den Punkt, ohne überflüssiges Vorgeplänkel, und beziehe dich ganz selbstverständlich auf die Aufgaben, Phasen und Termine dieser Elemente.
`;

      contextData = {
        ...contextData,
        fokus: 'Spezifisch an diese Konversation angehängte Projekte und Erinnerungen',
        projekte: chosenProjects.map((p) => ({
          id: p.id,
          titel: p.title,
          beschreibung: p.description || '',
          zeitraum: `${p.startDate || 'Start offen'} bis ${p.endDate || 'Ende offen'}`,
          startDate: p.startDate || '',
          endDate: p.endDate || '',
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
        erinnerungen: chosenReminders.map((r) => ({
          id: r.id,
          titel: r.title,
          beschreibung: r.description || '',
          datum: r.date || 'Kein Termin',
          uhrzeit: r.time || '',
          prioritaet: r.priority || 'mittel',
          status: r.status || 'AKTIV',
          notizen: (r.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content }))
        }))
      };
    } else if (isGeneralOnlySelected) {
      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat den allgemeinen Coach-Modus gewählt (ohne spezifische Projektdaten).
Antworte als erfahrener Produktivitätsberater, Zeitmanagement-Experte und Motivator mit bewährten Methoden (z. B. Eisenhower, Pomodoro, Time-Blocking).
`;
      contextData = {
        ...contextData,
        fokus: 'Allgemeiner Coach (Keine spezifischen Projektdaten aktiv)'
      };
    } else {
      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat dir den vollen Überblick über alle seine Projekte und Erinnerungen zur Verfügung gestellt.
Du kannst projektübergreifend planen, Prioritäten abwägen, Engpässe identifizieren und den gesamten Arbeitsbereich berücksichtigen.
`;
      // Default: All Projects & All Reminders
      contextData = {
        ...contextData,
        fokus: 'Alle Projekte & Erinnerungen',
        projekte: projects.map((p) => ({
          id: p.id,
          titel: p.title,
          beschreibung: p.description || '',
          zeitraum: `${p.startDate || 'Start offen'} bis ${p.endDate || 'Ende offen'}`,
          startDate: p.startDate || '',
          endDate: p.endDate || '',
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
        erinnerungen: reminders.map((r) => ({
          id: r.id,
          titel: r.title,
          beschreibung: r.description || '',
          datum: r.date || 'Kein Termin',
          uhrzeit: r.time || '',
          prioritaet: r.priority || 'mittel',
          status: r.status || 'AKTIV',
          notizen: (r.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content }))
        }))
      };
    }

    return `
Du bist der FocusFlow AI Coach (Fio), ein hochkompetenter, motivierender und pragmatischer Produktivitäts-Assistent.
Deine Aufgabe ist es, dem Nutzer zu helfen, seine Aufgaben, Projekte und Erinnerungen fokussiert, strukturiert und erfolgreich abzuarbeiten.

${contextMetaGuidance}

${ACTION_ENGINE_SYSTEM_PROMPT}

Hier sind die aktuellen Daten und Details der FocusFlow App:
${JSON.stringify(contextData, null, 2)}

Regeln für deine Antworten:
1. Reagiere direkt, empathisch und professionell auf die Anfrage des Nutzers.
2. Beziehe dich bei konkreten Fragen auf die relevanten Daten (Aufgaben, Phasen, Termine, Notizen).
3. Verwende saubere Markdown-Formatierung (Listen, Fettdruck, Absätze), um Antworten leicht scannbar zu machen.
4. Halte deine Antworten fokussiert, umsetzungsstark und ohne überflüssige Floskeln.
`;
  };

  // Dynamic quick prompts
  const getQuickPrompts = () => {
    return [
      { id: 'qp_1', label: 'Tagesplan erstellen', promptText: 'Erstelle einen Fokus-Tagesplan aus allen meinen Projekten und Erinnerungen.' },
      { id: 'qp_2', label: 'Engpässe finden', promptText: 'Welche Aufgaben oder Erinnerungen benötigen meine Aufmerksamkeit?' },
      { id: 'qp_3', label: 'Ziele priorisieren', promptText: 'Was ist das wichtigste Ziel für diese Woche?' }
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

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    if (currentBotMsgIdRef.current) {
      updateStreamingMessage(activeSession.id, currentBotMsgIdRef.current, undefined, false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading) return;

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
    currentBotMsgIdRef.current = botMsgId;
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
          fullGeneratedText = currentFullText;
          const { cleanText } = parseAiActions(currentFullText);
          updateStreamingMessage(activeSession.id, botMsgId, cleanText, true);
        }
      });

      // Parse and execute any generated actions
      const { cleanText, actions } = parseAiActions(fullGeneratedText);
      let executedActionResults = [];
      if (actions && actions.length > 0) {
        executedActionResults = await executeAiActions(actions, modalContext, projects, reminders);
      }

      updateStreamingMessage(activeSession.id, botMsgId, cleanText || undefined, false, executedActionResults);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('Gemini Error:', err);
      const errMsg = err?.message || 'Fehler beim Aufruf der Gemini API.';
      updateStreamingMessage(activeSession.id, botMsgId, `⚠️ **KI-Fehler:** ${errMsg}`, false);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  // Group and filter sessions chronologically for the SIDEBAR
  const groupedSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by sidebarScopeFilter
    if (sidebarScopeFilter === 'general') {
      filtered = filtered.filter((s) => s.contextScope === 'general' || s.contextScope === 'global');
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
    let filteredProjects = projects;
    let filteredReminders = reminders;
    if (q) {
      filteredProjects = projects.filter((p) => p.title.toLowerCase().includes(q));
      filteredReminders = reminders.filter((r) => r.title.toLowerCase().includes(q));
    }
    return { projects: filteredProjects, reminders: filteredReminders };
  }, [projects, reminders, contextModalSearch]);

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

  const selectAllContext = () => {
    setIsAllContextSelected(true);
    setIsGeneralOnlySelected(false);
    setSelectedProjectIds([]);
    setSelectedReminderIds([]);
    setIsContextModalOpen(false);
  };

  const selectGeneralOnlyContext = () => {
    setIsGeneralOnlySelected(true);
    setIsAllContextSelected(false);
    setSelectedProjectIds([]);
    setSelectedReminderIds([]);
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
              : isProject
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-surface-low text-on-surface-variant border border-outline-variant'
          }`}>
            <span className="material-symbols-outlined text-[16px]">
              {isReminder ? 'notifications' : isProject ? 'folder' : 'psychology'}
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
        {isHistoryOpen && (
          <div 
            className="absolute inset-0 bg-black/20 z-30 md:hidden backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsHistoryOpen(false)}
          />
        )}
        
        {/* Left Floating History Pill Panel (Slides out from behind sidebar, adapts chat width on desktop) */}
        <div
          className={`z-40 md:z-20 flex-shrink-0 transition-all duration-300 ease-out flex flex-col ${
            isHistoryOpen
              ? 'absolute md:relative inset-y-0 left-0 w-[85%] sm:w-80 max-w-[340px] p-2.5 sm:p-3 opacity-100 translate-x-0'
              : 'w-0 -translate-x-full opacity-0 p-0 m-0 overflow-hidden pointer-events-none'
          }`}
        >
          {/* Inner Rounded Floating Pill Card */}
          <div className="w-full h-full flex flex-col bg-white/95 dark:bg-surface-low/95 backdrop-blur-xl border border-outline-variant/80 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-3.5 border-b border-outline-variant/60 flex items-center justify-between bg-surface-low/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">history</span>
                </div>
                <span className="text-xs font-mono font-bold text-on-surface tracking-wider uppercase">Verlauf</span>
                <span className="text-[10px] font-mono text-on-surface-variant font-bold bg-white px-2 py-0.5 rounded-md border border-outline-variant">
                  {sessions.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="w-8 h-8 bg-neutral-900 text-white rounded-xl hover:bg-black transition-all flex items-center justify-center cursor-pointer shadow-xs hover:shadow-sm"
                  title="Neues Gespräch beginnen"
                  onClick={handleNewChat}
                >
                  <span className="material-symbols-outlined text-[17px]">edit_square</span>
                </button>
                <button
                  className="w-8 h-8 border border-outline-variant bg-white hover:border-primary text-primary transition-all flex items-center justify-center rounded-xl cursor-pointer shadow-xs hover:shadow-sm"
                  title="Verlauf einklappen"
                  onClick={() => setIsHistoryOpen(false)}
                >
                  <span className="material-symbols-outlined text-[17px]">left_panel_close</span>
                </button>
              </div>
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

        {/* Right Main Chat Panel (Adapts Width Dynamically, Keeps Centered Input & Messages) */}
        <div className="flex-grow min-w-0 flex flex-col h-full relative overflow-hidden bg-surface">
          {/* Fixed Top Controls Bar with Soft Gradient */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 sm:p-3.5 pointer-events-none bg-gradient-to-b from-surface via-surface/90 to-transparent pb-6">
            {/* Left Action Buttons when History is closed */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {!isHistoryOpen && (
                <>
                  <button
                    className="flex items-center gap-1.5 px-3 py-2 border border-outline-variant bg-white/95 backdrop-blur-md hover:border-primary text-primary transition-all rounded-xl cursor-pointer shadow-xs hover:shadow-sm"
                    title="Verlauf öffnen"
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span className="text-xs font-mono font-bold hidden sm:inline">Verlauf</span>
                  </button>
                  <button
                    className="w-10 h-10 bg-neutral-900 text-white rounded-xl hover:bg-black transition-all flex items-center justify-center cursor-pointer shadow-xs hover:shadow-sm"
                    title="Neuer Chat"
                    onClick={handleNewChat}
                  >
                    <span className="material-symbols-outlined text-[19px]">edit_square</span>
                  </button>
                </>
              )}
            </div>

            {/* Right Model Dropdown (Custom Glass Popover Menu) */}
            <div className="flex items-center gap-2 pointer-events-auto ml-auto">
              <ModelSelectorDropdown
                activeModel={activeModel}
                onSelectModel={setActiveModel}
              />
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-grow overflow-y-auto px-4 pb-4 pt-16 sm:pt-16 min-h-0">
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-4 fade-in">
                  <div className="w-16 h-16 bg-neutral-900 text-white rounded-2xl flex items-center justify-center mb-4 shadow-md p-3.5">
                    <FioIcon className="w-full h-full text-white" color="currentColor" />
                  </div>
                  <h2 className="text-2xl font-bold text-on-surface mb-1.5 tracking-tight">
                    Hallo{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}, ich bin Fio
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                    Dein persönlicher KI-Coach. Wie kann ich dich heute bei deinen Projekten, Aufgaben und Erinnerungen unterstützen?
                  </p>
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
                                  const isNoteAction = res.type === 'CREATE_NOTE';
                                  const isMatAction = res.type === 'ADD_MATERIAL';

                                  const iconName = isNoteAction ? 'note_alt' : isMatAction ? 'attach_file' : isRemAction ? 'notifications' : isProjAction ? 'folder' : 'check_circle';
                                  const iconStyle = isNoteAction
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : isMatAction
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
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
                                      )}
                                    </div>
                                  );
                                })}
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
                              <span className={`material-symbols-outlined text-[14px] ${att.type === 'project' ? 'text-primary' : 'text-amber-700'}`}>
                                {att.type === 'project' ? 'folder' : 'notifications'}
                              </span>
                              <span className="truncate max-w-[150px] font-medium">{att.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-3 flex-row-reverse">
                        <div className="w-8 h-8 flex-shrink-0 bg-neutral-900 text-white border border-neutral-700 rounded-xl flex items-center justify-center text-xs font-mono font-bold shadow-xs">
                          {user?.photoURL ? (
                            <img src={user.photoURL} alt="User" className="w-full h-full rounded-xl object-cover" />
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
              ) : (
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
                        <span className={`material-symbols-outlined text-[15px] ${att.type === 'project' ? 'text-primary' : 'text-amber-700'}`}>
                          {att.type === 'project' ? 'folder' : 'notifications'}
                        </span>
                        <span className="truncate max-w-[160px] text-on-surface">{att.title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (att.type === 'project') toggleProjectContext(att.id);
                            else toggleReminderContext(att.id);
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
                        : 'Kontext & Daten für Fio wählen (Alle Projekte & Erinnerungen)'
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
                        : 'Frage deinen Coach...'
                    }
                    value={inputText}
                    rows={1}
                    disabled={loading}
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
                  placeholder="Projekte oder Erinnerungen filtern..."
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
                  placeholder="Projekte oder Erinnerungen für Fio suchen..."
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
                      <div className="font-bold text-xs text-on-surface">Alle Projektdaten & Erinnerungen übergeben</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">Voller Zugriff auf den gesamten Arbeitsbereich</div>
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

              {contextModalFilteredItems.projects.length === 0 && contextModalFilteredItems.reminders.length === 0 && (
                <div className="p-8 text-center text-xs text-on-surface-variant italic">
                  Keine Projekte oder Erinnerungen für „{contextModalSearch}“ gefunden.
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
