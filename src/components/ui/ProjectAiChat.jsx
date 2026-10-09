import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useModalContext } from '../../context/ModalContext';
import { useChat } from '../../context/ChatContext';
import { askGeminiCoach } from '../../lib/gemini';
import { ACTION_ENGINE_SYSTEM_PROMPT, parseAiActions, executeAiActions, parseIntentChoice } from '../../lib/aiActionEngine';

import { Button, FioMark, Icon, IconButton } from '../ds';
const ProjectAiChat = ({
  projectData,
  contextScope = 'project', // 'project' | 'section' | 'task' | 'reminder'
  contextData = null,
  scrollContainerRef,
  isHistoryOpen = false,
  setIsHistoryOpen,
  newChatTrigger = 0
}) => {
  const {
    sessions,
    activeSession,
    activeSessionId,
    activeModel,
    createNewSession,
    selectSession,
    deleteSession,
    addMessageToSession,
    updateStreamingMessage
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyScopeFilter, setHistoryScopeFilter] = useState('context'); // 'context' | 'all'
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const contextId = projectData?.id || contextData?.id || null;

  // Auto-select or create a session for this context on first open if needed
  const initializedRef = useRef(null);
  useEffect(() => {
    if (contextId && initializedRef.current !== contextId) {
      initializedRef.current = contextId;
      // Look for an existing session for this project or reminder
      const existingSession = sessions.find((s) => s.contextId === contextId);
      if (existingSession) {
        selectSession(existingSession.id);
      } else if (!activeSession || activeSession.contextScope === 'general') {
        const title = contextScope === 'reminder'
          ? `Erinnerung: ${contextData?.title || 'Erinnerung'}`
          : `Projekt: ${projectData?.title || 'Projekt'}`;

        createNewSession({
          contextScope,
          contextId,
          contextTitle: contextData?.title || projectData?.title || 'Fokus',
          model: activeModel,
          initialTitle: title
        });
      }
    }
  }, [contextId, contextScope, contextData, projectData, sessions, activeSession, activeModel, selectSession, createNewSession]);

  // Handle New Chat Trigger from drawer header
  const prevTriggerRef = useRef(newChatTrigger);
  useEffect(() => {
    if (newChatTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = newChatTrigger;
      handleNewChat();
    }
  }, [newChatTrigger]);

  const messages = activeSession?.messages || [];

  // Auto-scroll to bottom when messages change or stream in
  useEffect(() => {
    if (!isHistoryOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isHistoryOpen]);

  const handleNewChat = () => {
    let title = 'Neues Gespräch';
    let cTitle = 'Fokus';

    if (contextScope === 'reminder' && contextData) {
      title = `Erinnerung: ${contextData.title}`;
      cTitle = `Erinnerung: ${contextData.title}`;
    } else if (contextScope === 'task' && contextData?.task) {
      title = `Aufgabe: ${contextData.task.title}`;
      cTitle = projectData ? projectData.title : contextData.task.title;
    } else if (contextScope === 'section' && contextData) {
      title = `Abschnitt: ${contextData.title}`;
      cTitle = projectData ? projectData.title : contextData.title;
    } else if (projectData) {
      title = `Projekt: ${projectData.title}`;
      cTitle = projectData.title;
    }

    createNewSession({
      contextScope: contextScope || 'general',
      contextId: contextId,
      contextTitle: cTitle,
      model: activeModel,
      initialTitle: title
    });

    if (setIsHistoryOpen) setIsHistoryOpen(false);
  };

  // Build context-grounded system instruction for Fio
  const buildSystemInstruction = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    let contextSummary = {
      heutigesDatum: `${dateStr}, ${timeStr} Uhr`
    };

    if (contextScope === 'reminder' && contextData) {
      contextSummary.aktiverFokus = {
        typ: 'Erinnerung',
        id: contextData.id,
        titel: contextData.title,
        beschreibung: contextData.description || '',
        status: contextData.status || 'AKTIV',
        datum: contextData.date || 'Kein Datum',
        uhrzeit: contextData.time || 'Keine Uhrzeit',
        notizen: (contextData.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content }))
      };
    } else if (projectData) {
      contextSummary.projekt = {
        id: projectData.id,
        titel: projectData.title || 'Unbenanntes Projekt',
        beschreibung: projectData.description || '',
        zeitraum: `${projectData.startDate || 'Start offen'} bis ${projectData.endDate || 'Ende offen'}`,
        startDate: projectData.startDate || '',
        endDate: projectData.endDate || '',
        status: projectData.status || 'AKTIV',
        fortschritt: `${projectData.progress || 0}%`,
        notizen: (projectData.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content })),
        abschnitte: (projectData.phases || []).map((p) => ({
          id: p.id,
          titel: p.title,
          zeitraum: p.dateInfo,
          materialien: (p.materials || []).map(m => ({ id: m.id, name: m.name, typ: m.type, url: m.url })),
          aufgaben: (p.tasks || []).map((t) => ({
            id: t.id,
            titel: t.title,
            erledigt: !!t.completed,
            termin: t.date,
            notizen: t.notes || t.note || ''
          }))
        }))
      };

      if (contextScope === 'task' && contextData?.task) {
        contextSummary.aktiverFokus = {
          typ: 'Spezifische Aufgabe',
          abschnitt: contextData.phase?.title || 'Aktueller Abschnitt',
          aufgabeTitel: contextData.task?.title,
          erledigt: !!contextData.task?.completed,
          termin: contextData.task?.date || 'Kein Termin',
          // Aufgaben speichern ihre Notiz im Feld `note`
          details: contextData.task?.note || contextData.task?.notes || contextData.task?.description || ''
        };
      } else if (contextScope === 'section' && contextData) {
        contextSummary.aktiverFokus = {
          typ: 'Spezifischer Abschnitt',
          abschnittTitel: contextData.title,
          zeitraum: contextData.dateInfo,
          aufgaben: (contextData.tasks || []).map((t) => ({
            titel: t.title,
            erledigt: !!t.completed
          }))
        };
      }
    }

    return `
Du bist Fio, der persönliche, hochkompetente KI-Coach in Produktivitäts-App FocusFlow.
  motivierend, präzise, pragmatisch und lösungsorientiert.
Deine Aufgabe ist es, dem Nutzer zu helfen, seine Projekte, Aufgaben Erinnerungen fokussiert erfolgreich abzuarbeiten.

KONTEXT DES NUTZERS:
${JSON.stringify(contextSummary, null, 2)}

${ACTION_ENGINE_SYSTEM_PROMPT}

REGELN:
1. Beziehe dich direkt auf den aktiven Kontext (Erinnerung, Aufgabe, Abschnitt oder Projekt) und behalte Termine und Deadlines im Blick.
2. PRÄZISION STATT REIZÜBERFLUTUNG (WENIGER IST MEHR): Antworte prägnant, strukturiert und fokussiert. Keine überlangen Textwüsten oder ausschweifenden Aufzählungen.
3. Sei konkret und handlungsorientiert: Gib direkt umsetzbare, klare Ratschläge für den nächsten logischen Schritt.
4. RÜCKFRAGE AM ENDE: Beende deine Antwort IMMER mit genau EINER konkreten, proaktiven Rückfrage zum Projekt oder zur nächsten Aufgabe, damit der Nutzer direkt im Dialog weiterarbeiten und vertiefen kann.
`;
  };

  // Dynamic quick prompts
  const getQuickPrompts = () => {
    if (contextScope === 'reminder') {
      return [
        'Wie gehe ich das am besten an?',
        'Notizen zu dieser Erinnerung',
        'Termin & Priorität einschätzen',
        'In ein Projekt umwandeln'
      ];
    }
    if (contextScope === 'task') {
      return [
        'Wie setze ich das am besten um?',
        'In 3 Teilaufgaben aufteilen',
        'Checkliste für die Umsetzung',
        'Mögliche Risiken & Tipps'
      ];
    }
    if (contextScope === 'section') {
      return [
        'Welche Aufgaben fehlen noch?',
        'Diesen Abschnitt priorisieren',
        'Abschnitt zusammenfassen',
        'Zeitplan einschätzen'
      ];
    }
    return [
      'Was sind die nächsten Schritte?',
      'Projektstatus zusammenfassen',
      'Aufgaben nach Dringlichkeit ordnen',
      'Tagesfokus für dieses Projekt'
    ];
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
    setIsLoading(false);
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

  const modalContext = useModalContext();
  const { projects = [], reminders = [], user, isCalendarConnected } = modalContext;

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    const trimmedText = text.trim();
    const userMsgId = `user_${Date.now()}`;
    const botMsgId = `bot_${Date.now()}`;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    currentBotMsgIdRef.current = botMsgId;

    // Ensure we have an active session
    let targetSessionId = activeSession?.id;
    if (!targetSessionId) {
      const newSess = handleNewChat();
      targetSessionId = newSess.id;
    }
    currentBotSessionIdRef.current = targetSessionId;

    // 1. Add User Message
    addMessageToSession(targetSessionId, {
      id: userMsgId,
      role: 'user',
      content: trimmedText
    });

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    // 2. Add Placeholder Bot Message
    addMessageToSession(targetSessionId, {
      id: botMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let fullStreamedText = '';

    try {
      const systemInstruction = buildSystemInstruction();
      const previousMessages = (activeSession?.messages || []).filter(m => m.id !== botMsgId && m.id !== userMsgId);
      const conversationHistory = [...previousMessages, { role: 'user', content: trimmedText }];

      await askGeminiCoach({
        prompt: trimmedText,
        messages: conversationHistory,
        systemInstruction,
        aiModel: activeModel,
        signal: abortController.signal,
        onChunk: (streamedText) => {
          if (generationRef.current !== generation || abortController.signal.aborted) return;
          fullStreamedText = streamedText;
          const { cleanText: textWithoutActions } = parseAiActions(streamedText);
          const { cleanText } = parseIntentChoice(textWithoutActions);
          updateStreamingMessage(targetSessionId, botMsgId, cleanText, true);
        }
      });

      if (generationRef.current !== generation || abortController.signal.aborted) return;

      const { cleanText: textWithoutActions, actions } = parseAiActions(fullStreamedText);
      const { cleanText, intentChoice } = parseIntentChoice(textWithoutActions);
      let executedActionResults = [];
      if (actions && actions.length > 0) {
        executedActionResults = await executeAiActions(actions, modalContext, projects, reminders);
      }

      updateStreamingMessage(targetSessionId, botMsgId, cleanText || undefined, false, executedActionResults, { intentChoice });
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        // Stopped by user
        return;
      }
      console.error('Fio Chat Error:', err);
      const errMsg = err?.message || 'Fehler bei der Kommunikation mit dem KI-Coach.';
      updateStreamingMessage(targetSessionId, botMsgId, `⚠️ **Fehler:** ${errMsg}`, false);
    } finally {
      if (generationRef.current === generation) {
        abortControllerRef.current = null;
        currentBotMsgIdRef.current = null;
        currentBotSessionIdRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const quickPrompts = getQuickPrompts();

  // Filter sessions for drawer history
  const displayedSessions = useMemo(() => {
    if (historyScopeFilter === 'context' && contextId) {
      return sessions.filter((s) => s.contextId === contextId);
    }
    return sessions;
  }, [sessions, historyScopeFilter, contextId]);

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-subtle overflow-hidden relative">

      {/* Synchronized History Slide-Down Overlay */}
      <div 
        className={`absolute inset-0 z-10 bg-surface flex flex-col overflow-hidden transition-all duration-200 ease-in-out ${
          isHistoryOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* History Header & Scope Toggle */}
        <div className="p-3 border-b border-subtle flex flex-col gap-2 bg-subtle">
          <div className="flex items-center w-full">
            <Button fullWidth onClick={handleNewChat}>
              <Icon name="edit_square" size="md" />
              <span>NEUER CHAT</span>
            </Button>
          </div>

          {/* Scope Filter Segmented Tabs */}
          <div className="flex items-center p-1 bg-subtle border border-subtle rounded-lg gap-1 shadow-xs">
            <button
              onClick={() => setHistoryScopeFilter('context')}
              className={`flex-1 py-1.5 px-2 rounded-md text-caption-strong font-label transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                historyScopeFilter === 'context'
                  ? 'bg-surface dark:bg-canvas text-primary shadow-xs border border-subtle'
                  : 'text-secondary hover:bg-surface border border-transparent'
              }`}
            >
              <Icon name={contextScope === 'reminder' ? 'notifications' : contextScope === 'task' ? 'check_circle' : 'folder'} size="sm" />
              <span>Aktueller Bereich</span>
            </button>
            <button
              onClick={() => setHistoryScopeFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-md text-caption-strong font-label transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                historyScopeFilter === 'all'
                  ? 'bg-surface dark:bg-canvas text-primary shadow-xs border border-subtle'
                  : 'text-secondary hover:bg-surface border border-transparent'
              }`}
            >
              <Icon name="all_inbox" size="sm" />
              <span>Alle Chats</span>
              <span className={`text-micro px-1.5 py-0.5 rounded-md font-label ${
                historyScopeFilter === 'all' ? 'bg-hover text-primary font-semibold' : 'bg-subtle text-secondary'
              }`}>
                {sessions.length}
              </span>
            </button>
          </div>
        </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {displayedSessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              const isReminder = sess.contextScope === 'reminder' || sess.contextScope === 'reminders';
              const isProject = sess.contextScope === 'project' || sess.contextScope === 'task' || sess.contextScope === 'section';

              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    selectSession(sess.id);
                    if (setIsHistoryOpen) setIsHistoryOpen(false);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2.5 group ${
                    isActive
                      ? 'bg-hover border-control shadow-xs'
                      : 'bg-surface border-subtle hover:border-default hover:bg-hover'
                  }`}
                >
                  {/* Left / Main: Icon + Title */}
                  <div className="min-w-0 flex-1 flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      isReminder
                        ? 'bg-warning-subtle text-warning border border-warning'
                        : isProject
                        ? 'bg-hover text-primary border border-default'
                        : 'bg-subtle text-secondary border border-subtle'
                    }`}>
                      <Icon name={isReminder ? 'notifications' : isProject ? 'folder' : 'psychology'} size="sm" />
                    </div>

                    <span className={`text-caption-strong block truncate ${isActive ? 'text-primary' : ''}`}>
                      {sess.title || 'Gespräch'}
                    </span>
                  </div>

                  {/* Right: Time on Top, Message count below */}
                  <div className="flex flex-col items-end shrink-0 text-right gap-0.5">
                    <span className="text-micro font-label text-secondary font-medium">
                      {formatDate(sess.updatedAt || sess.createdAt)}
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
                    className="w-7 h-7 flex items-center justify-center rounded-md text-secondary hover:text-danger hover:bg-danger-subtle transition-colors opacity-60 group-hover:opacity-100 cursor-pointer shrink-0"
                    title="Gespräch löschen"
                  >
                    <Icon name="delete" size="sm" />
                  </button>
                </div>
              );
            })}

            {displayedSessions.length === 0 && (
              <div className="p-8 text-center text-caption text-secondary italic">
                Keine Chats in dieser Auswahl vorhanden.
              </div>
            )}
          </div>
        </div>

      {/* Context Scope Indicator */}
      {contextScope !== 'general' && (
        <div className="shrink-0 bg-surface border-b border-subtle px-4 py-2 flex items-center justify-between text-caption font-label text-secondary">
          <div className="flex items-center gap-2 truncate">
            <Icon name={contextScope === 'reminder' ? 'notifications' : contextScope === 'task' ? 'check_circle' : 'folder'} size="sm" className="text-primary" />
            <span className="font-semibold truncate">
              {contextScope === 'reminder'
                ? `Erinnerung: ${contextData?.title || 'Aktive Erinnerung'}`
                : contextScope === 'task'
                ? `Aufgabe: ${contextData?.task?.title || 'Aktive Aufgabe'}`
                : contextScope === 'section'
                ? `Abschnitt: ${contextData?.title || 'Aktiver Abschnitt'}`
                : `Projekt: ${projectData?.title || 'Aktives Projekt'}`}
            </span>
          </div>
          <span className="font-label text-eyebrow text-secondary uppercase font-semibold shrink-0 bg-hover px-2 py-0.5 rounded-xs border border-default">
            Fokus
          </span>
        </div>
      )}

      {/* Chat Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto my-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-surface border border-subtle flex items-center justify-center shadow-md p-4 sm:p-5 mb-4">
              <FioMark size={20} className="text-primary" />
            </div>
            <p className="text-caption text-secondary leading-relaxed">
              {contextScope === 'reminder'
                ? `Frag mich etwas zur Erinnerung „${contextData?.title || 'Aktive Erinnerung'}“ oder wähle einen Quick-Prompt.`
                : contextScope === 'task' 
                ? `Frag mich etwas zur Aufgabe „${contextData?.task?.title || 'Aktive Aufgabe'}“ oder wähle einen Quick-Prompt.`
                : contextScope === 'section'
                ? `Frag mich etwas zum Abschnitt „${contextData?.title || 'Aktiver Abschnitt'}“ oder zur Planung.`
                : 'Frag mich etwas zum Projektverlauf, Zeitplan oder nächsten Schritten.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.role === 'assistant' || msg.sender === 'bot';
            return (
              <div 
                key={msg.id} 
                className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {isBot && (
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-accent text-on-accent flex items-center justify-center p-1.5 shadow-sm mt-0.5">
                    <FioMark size={20} className="text-on-accent" />
                  </div>
                )}
                <div 
                  className={`max-w-[85%] rounded-lg px-4 py-2.5 text-body shadow-sm leading-relaxed ${
                    !isBot 
                      ? 'bg-accent text-on-accent rounded-br-xs' 
                      : 'bg-surface border border-subtle rounded-bl-xs'
                  }`}
                >
                  {isBot ? (
                    msg.content || msg.text ? (
                      <div className="markdown-body text-body space-y-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || msg.text}
                        </ReactMarkdown>

                        {/* Render Interactive Action Results Cards */}
                        {msg.actionResults && msg.actionResults.length > 0 && (
                          <div className="space-y-1.5 mt-2.5 pt-2.5 border-t border-subtle not-prose">
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
                                  className="flex items-center gap-2 p-2 bg-subtle border border-subtle rounded-lg text-caption shadow-xs"
                                >
                                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${iconStyle}`}>
                                    <Icon name={iconName} size="sm" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate text-micro">{res.title}</div>
                                    <div className="text-micro font-label text-secondary truncate">{res.subtitle}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Render 3-Way Intent Choice Pills if AI proposed an appointment/reminder */}
                        {msg.intentChoice && (
                          <div className="mt-2.5 pt-2 border-t border-subtle w-full space-y-1.5 not-prose">
                            <div className="text-micro font-label font-semibold text-secondary flex items-center gap-1">
                              <Icon name="help" size="sm" className="text-primary" />
                              <span>Wo soll der Eintrag angelegt werden?</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Button variant="secondary" size="sm" onClick={() => handleSend(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur in FocusFlow.`)}>
                                <Icon name="notifications" size="sm" className="text-warning" />
                                <span>Nur in FocusFlow</span>
                              </Button>

                              <button
                                type="button"
                                disabled={user?.isGuest || !isCalendarConnected}
                                onClick={() => handleSend(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} in FocusFlow mit Google Kalender-Sync.`)}
                                title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Empfohlen'}
                                className="px-2 py-1 rounded-md bg-success-subtle hover:bg-success-subtle border border-success text-micro font-label text-success font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Icon name="sync" size="sm" className="text-success" />
                                <span>FocusFlow + Kalender-Sync</span>
                              </button>

                              <Button variant="secondary" size="sm" disabled={user?.isGuest || !isCalendarConnected} onClick={() => handleSend(`Bitte trage den Termin „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur im Google Kalender ein.`)} title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Direkt im Kalender eintragen'}>
                                <Icon name="calendar_month" size="sm" className="text-primary" />
                                <span>Nur im Google Kalender</span>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : msg.isStreaming ? (
                      <div className="flex items-center gap-1.5 py-1 text-secondary text-caption">
                        <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                        <span>Fio denkt nach...</span>
                      </div>
                    ) : msg.cancelled ? (
                      <div className="flex items-center gap-1.5 py-1 text-secondary text-caption italic">
                        <Icon name="pause_circle" size="sm" />
                        <span>Antwort abgebrochen</span>
                      </div>
                    ) : (
                      <div className="text-secondary text-caption italic">
                        (Keine Antwort erhalten)
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content || msg.text}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (Sticky Bottom) */}
      <div 
        className="shrink-0 bg-surface border-t border-subtle p-3 flex flex-col gap-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Quick Prompts or Floating Stop Indicator */}
        {isLoading ? (
          <div className="flex items-center justify-center pb-1">
            <button
              type="button"
              onClick={handleStopGeneration}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-subtle border border-danger text-danger hover:bg-danger-subtle rounded-md text-caption-strong font-label transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
            >
              <span className="w-2.5 h-2.5 bg-danger rounded-xs animate-pulse" />
              <span>Antwort stoppen</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {quickPrompts.map((prompt, idx) => (
              <Button variant="secondary" size="sm" key={idx} onClick={() => handleSend(prompt)} disabled={isLoading} className="shrink-0">
                <Icon name="bolt" size="sm" />
                <span>{prompt}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Input Box */}
        <div className="flex items-end gap-2 bg-subtle border border-subtle focus-within:border-strong focus-within:bg-surface rounded-lg p-1.5 transition-all">
          <textarea
            ref={textareaRef}
            value={inputText}
            disabled={isLoading}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isLoading
                ? 'Fio generiert gerade eine Antwort...'
                : contextScope === 'reminder'
                ? 'Frag Fio zu dieser Erinnerung...'
                : contextScope === 'task'
                ? 'Frag Fio zu dieser Aufgabe...'
                : 'Frag Fio zum Projekt...'
            }
            className="flex-1 max-h-[120px] bg-transparent border-none outline-none focus:ring-0 resize-none text-body p-2"
            rows={1}
            style={{ minHeight: '36px' }}
          />

          {/* Send or Stop Button */}
          {isLoading ? (
            <IconButton icon="stop" label="Antwort unterbrechen" variant="danger" className="shrink-0 mb-0.5 mr-0.5" onClick={handleStopGeneration} />
          ) : (
            <IconButton icon="send" label="Nachricht senden" variant="primary" className="shrink-0 mb-0.5 mr-0.5" onClick={() => handleSend()} disabled={!inputText.trim() || isLoading} />
          )}
        </div>
      </div>

    </div>
  );
};

export default ProjectAiChat;
