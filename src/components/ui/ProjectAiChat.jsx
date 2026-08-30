import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useModalContext } from '../../context/ModalContext';
import { useChat } from '../../context/ChatContext';
import { askGeminiCoach } from '../../lib/gemini';
import { ACTION_ENGINE_SYSTEM_PROMPT, parseAiActions, executeAiActions } from '../../lib/aiActionEngine';
import FioIcon from './FioIcon';

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
          details: contextData.task?.notes || contextData.task?.description || ''
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
Du bist Fio, der persönliche, hochkompetente KI-Coach in der Produktivitäts-App FocusFlow.
Du bist motivierend, präzise, pragmatisch und lösungsorientiert.
Deine Aufgabe ist es, dem Nutzer zu helfen, seine Projekte, Aufgaben und Erinnerungen fokussiert und erfolgreich abzuarbeiten.

KONTEXT DES NUTZERS:
${JSON.stringify(contextSummary, null, 2)}

${ACTION_ENGINE_SYSTEM_PROMPT}

REGELN:
1. Beziehe dich direkt auf den aktiven Kontext (Erinnerung, Aufgabe, Abschnitt oder Projekt).
2. Antworte in natürlichem, klarem und gut lesbarem Deutsch mit strukturierter Markdown-Formatierung.
3. Sei konkret und handlungsorientiert: Gib direkt umsetzbare Ratschläge oder klare Empfehlungen.
4. Halte Antworten prägnant und fokussiert, ohne ausschweifende Floskeln.
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

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    if (currentBotMsgIdRef.current && activeSession?.id) {
      updateStreamingMessage(activeSession.id, currentBotMsgIdRef.current, undefined, false);
    }
  };

  const modalContext = useModalContext();
  const { projects = [], reminders = [] } = modalContext;

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    const trimmedText = text.trim();
    const userMsgId = `user_${Date.now()}`;
    const botMsgId = `bot_${Date.now()}`;
    currentBotMsgIdRef.current = botMsgId;

    // Ensure we have an active session
    let targetSessionId = activeSession?.id;
    if (!targetSessionId) {
      const newSess = handleNewChat();
      targetSessionId = newSess.id;
    }

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
          fullStreamedText = streamedText;
          const { cleanText } = parseAiActions(streamedText);
          updateStreamingMessage(targetSessionId, botMsgId, cleanText, true);
        }
      });

      const { cleanText, actions } = parseAiActions(fullStreamedText);
      let executedActionResults = [];
      if (actions && actions.length > 0) {
        executedActionResults = await executeAiActions(actions, modalContext, projects, reminders);
      }

      updateStreamingMessage(targetSessionId, botMsgId, cleanText || undefined, false, executedActionResults);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        // Stopped by user
        return;
      }
      console.error('Fio Chat Error:', err);
      const errMsg = err?.message || 'Fehler bei der Kommunikation mit dem KI-Coach.';
      updateStreamingMessage(targetSessionId, botMsgId, `⚠️ **Fehler:** ${errMsg}`, false);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
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
    <div className="flex-1 flex flex-col h-full bg-surface-low/30 overflow-hidden relative">

      {/* Synchronized History Slide-Down Overlay */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-30 bg-white flex flex-col overflow-hidden animate-fadeIn">
          {/* History Header & Scope Toggle */}
          <div className="p-3 border-b border-outline-variant flex flex-col gap-2 bg-surface-low/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span className="uppercase tracking-wider">Verlauf ({displayedSessions.length})</span>
              </div>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-mono font-bold rounded-lg hover:bg-black transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>NEUER CHAT</span>
              </button>
            </div>

            {/* Scope Filter Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setHistoryScopeFilter('context')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer text-center ${
                  historyScopeFilter === 'context'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white border border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                Aktueller Bereich
              </button>
              <button
                onClick={() => setHistoryScopeFilter('all')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer text-center ${
                  historyScopeFilter === 'all'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white border border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                Alle Chats ({sessions.length})
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
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 group ${
                    isActive
                      ? 'bg-primary/5 border-primary/40 shadow-xs'
                      : 'bg-white border-outline-variant hover:border-primary/30 hover:bg-surface-low/40'
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

                    <span className={`font-bold text-xs text-on-surface block truncate ${isActive ? 'text-primary' : ''}`}>
                      {sess.title || 'Gespräch'}
                    </span>
                  </div>

                  {/* Right: Time on Top, Message count below */}
                  <div className="flex flex-col items-end shrink-0 text-right gap-0.5">
                    <span className="text-[10px] font-mono text-on-surface-variant font-medium">
                      {formatDate(sess.updatedAt || sess.createdAt)}
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
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer shrink-0"
                    title="Gespräch löschen"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              );
            })}

            {displayedSessions.length === 0 && (
              <div className="p-8 text-center text-xs text-on-surface-variant italic">
                Keine Chats in dieser Auswahl vorhanden.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Scope Indicator */}
      {contextScope !== 'general' && (
        <div className="shrink-0 bg-white border-b border-outline-variant/60 px-4 py-2 flex items-center justify-between text-xs font-mono text-on-surface-variant">
          <div className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[15px] text-primary">
              {contextScope === 'reminder' ? 'notifications' : contextScope === 'task' ? 'check_circle' : 'folder'}
            </span>
            <span className="font-bold text-on-surface truncate">
              {contextScope === 'reminder'
                ? `Erinnerung: ${contextData?.title || 'Aktive Erinnerung'}`
                : contextScope === 'task' 
                ? `Aufgabe: ${contextData?.task?.title || 'Aktive Aufgabe'}` 
                : `Abschnitt: ${contextData?.title || 'Aktiver Abschnitt'}`}
            </span>
          </div>
          <span className="text-[10px] text-primary/80 uppercase font-bold tracking-wider shrink-0 bg-primary/5 px-2 py-0.5 rounded border border-primary/20">
            Fokus
          </span>
        </div>
      )}

      {/* Chat Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto my-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white border border-outline-variant/60 flex items-center justify-center shadow-md p-4 sm:p-5 mb-4">
              <FioIcon className="w-full h-full text-primary" color="currentColor" />
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
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
                  <div className="w-7 h-7 shrink-0 rounded-xl bg-neutral-900 text-white flex items-center justify-center p-1.5 shadow-sm mt-0.5">
                    <FioIcon className="w-full h-full text-white" color="currentColor" />
                  </div>
                )}
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                    !isBot 
                      ? 'bg-neutral-900 text-white rounded-br-xs' 
                      : 'bg-white border border-outline-variant text-on-surface rounded-bl-xs'
                  }`}
                >
                  {isBot ? (
                    msg.content || msg.text ? (
                      <div className="markdown-body text-sm space-y-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || msg.text}
                        </ReactMarkdown>

                        {/* Render Interactive Action Results Cards */}
                        {msg.actionResults && msg.actionResults.length > 0 && (
                          <div className="space-y-1.5 mt-2.5 pt-2.5 border-t border-outline-variant/60 not-prose">
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
                                  className="flex items-center gap-2 p-2 bg-surface-low border border-outline-variant rounded-xl text-xs shadow-2xs"
                                >
                                  <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}>
                                    <span className="material-symbols-outlined text-[14px]">{iconName}</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-on-surface truncate text-[11px]">{res.title}</div>
                                    <div className="text-[9px] font-mono text-on-surface-variant truncate">{res.subtitle}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : msg.isStreaming ? (
                      <div className="flex items-center gap-1.5 py-1 text-on-surface-variant text-xs">
                        <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        <span>Fio denkt nach...</span>
                      </div>
                    ) : (
                      <div className="text-on-surface-variant text-xs italic">
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
      <div className="shrink-0 bg-white border-t border-outline-variant/60 p-3 flex flex-col gap-2">
        {/* Quick Prompts or Floating Stop Indicator */}
        {isLoading ? (
          <div className="flex items-center justify-center pb-1 animate-fadeIn">
            <button
              type="button"
              onClick={handleStopGeneration}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-full text-xs font-mono font-bold transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
            >
              <span className="w-2.5 h-2.5 bg-red-600 rounded-xs animate-pulse" />
              <span>Antwort stoppen</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface-low border border-outline-variant rounded-full text-xs font-mono font-bold text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Box */}
        <div className="flex items-end gap-2 bg-surface-low border border-outline-variant focus-within:border-primary focus-within:bg-white rounded-xl p-1.5 transition-all">
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
            className="flex-1 max-h-[120px] bg-transparent border-none outline-none focus:ring-0 resize-none text-sm p-2 text-on-surface"
            rows={1}
            style={{ minHeight: '36px' }}
          />

          {/* Send or Stop Button */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleStopGeneration}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer mb-0.5 mr-0.5 shadow-sm hover:scale-105 active:scale-95"
              title="Antwort unterbrechen"
            >
              <span className="material-symbols-outlined text-[18px]">stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isLoading}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-neutral-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black transition-all cursor-pointer mb-0.5 mr-0.5 shadow-sm"
              title="Nachricht senden"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProjectAiChat;
