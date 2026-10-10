import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useModalContext } from '../../context/ModalContext';
import { useChat } from '../../context/ChatContext';
import { askGeminiCoach } from '../../lib/gemini';
import { ACTION_ENGINE_SYSTEM_PROMPT, parseAiActions, executeAiActions, parseIntentChoice } from '../../lib/aiActionEngine';
import { Badge, Button, Chip, FOCUS, Icon, IconButton, IconTile, Spinner, cx } from '../ds';

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
        'Termin und Priorität einschätzen',
        'In ein Projekt umwandeln'
      ];
    }
    if (contextScope === 'task') {
      return [
        'Wie setze ich das am besten um?',
        'In 3 Teilaufgaben aufteilen',
        'Checkliste für die Umsetzung',
        'Mögliche Risiken und Tipps'
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
      updateStreamingMessage(targetSessionId, botMsgId, `**Fehler:** ${errMsg}`, false);
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

  const scopeIcon = contextScope === 'reminder' ? 'notifications' : contextScope === 'task' ? 'check_circle' : 'folder';
  const choiceDisabled = user?.isGuest || !isCalendarConnected;
  const choiceHint = user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : undefined;
  const intentWhen = (c) => `für den ${c.date}${c.time ? ` um ${c.time} Uhr` : ''}`;

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-canvas">

      {/* Verlauf: gleitet von oben über den Chat */}
      <div
        inert={!isHistoryOpen}
        className={cx(
          'absolute inset-0 z-10 flex flex-col overflow-hidden bg-surface transition-[opacity,transform] duration-base ease-standard motion-reduce:transition-none',
          isHistoryOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        )}
      >
        <div className="flex flex-col gap-3 border-b border-subtle p-3">
          <Button fullWidth leadingIcon="edit_square" onClick={handleNewChat}>
            Neuer Chat
          </Button>

          <div className="flex flex-wrap gap-2">
            <Chip selected={historyScopeFilter === 'context'} leadingIcon={scopeIcon} onClick={() => setHistoryScopeFilter('context')}>
              Aktueller Bereich
            </Chip>
            <Chip selected={historyScopeFilter === 'all'} leadingIcon="all_inbox" count={sessions.length} onClick={() => setHistoryScopeFilter('all')}>
              Alle Chats
            </Chip>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {displayedSessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            const isReminder = sess.contextScope === 'reminder' || sess.contextScope === 'reminders';
            const isProject = sess.contextScope === 'project' || sess.contextScope === 'task' || sess.contextScope === 'section';
            const select = () => {
              selectSession(sess.id);
              if (setIsHistoryOpen) setIsHistoryOpen(false);
            };

            return (
              <div
                key={sess.id}
                className={cx(
                  'group flex items-center gap-1 rounded-lg border transition-colors duration-fast',
                  isActive ? 'border-accent bg-selected' : 'border-subtle bg-surface hover:border-default hover:bg-hover'
                )}
              >
                <button
                  type="button"
                  onClick={select}
                  aria-current={isActive ? 'true' : undefined}
                  className={cx('flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-left', FOCUS)}
                >
                  <IconTile area={isReminder ? 'reminders' : isProject ? 'projects' : 'neutral'} icon={isReminder ? 'notifications' : isProject ? 'folder' : 'psychology'} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-body-strong text-primary">{sess.title || 'Gespräch'}</span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <span className="text-micro text-secondary">{formatDate(sess.updatedAt || sess.createdAt)}</span>
                    <span className="text-micro text-tertiary">{sess.messages?.length || 0} Nachr.</span>
                  </span>
                </button>
                <IconButton
                  icon="delete"
                  size="sm"
                  variant="danger-ghost"
                  label="Gespräch löschen"
                  className="mr-2 shrink-0"
                  onClick={() => deleteSession(sess.id)}
                />
              </div>
            );
          })}

          {displayedSessions.length === 0 && (
            <div className="p-8 text-center text-body text-secondary">
              Keine Chats in dieser Auswahl.
            </div>
          )}
        </div>
      </div>

      {/* Fokus-Hinweis */}
      {contextScope !== 'general' && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle bg-surface px-4 py-2 text-caption text-secondary">
          <div className="flex min-w-0 items-center gap-2">
            <Icon name={scopeIcon} size="sm" className="shrink-0 text-secondary" />
            <span className="truncate text-caption-strong text-primary">
              {contextScope === 'reminder'
                ? `Erinnerung: ${contextData?.title || 'Aktive Erinnerung'}`
                : contextScope === 'task'
                ? `Aufgabe: ${contextData?.task?.title || 'Aktive Aufgabe'}`
                : contextScope === 'section'
                ? `Abschnitt: ${contextData?.title || 'Aktiver Abschnitt'}`
                : `Projekt: ${projectData?.title || 'Aktives Projekt'}`}
            </span>
          </div>
          <Badge tone="neutral" size="sm">Fokus</Badge>
        </div>
      )}

      {/* Nachrichten */}
      <div ref={scrollContainerRef} className="relative flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mx-auto my-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <IconTile area="coach" size="lg" />
            <p className="text-body text-secondary">
              {contextScope === 'reminder'
                ? `Frag mich etwas zur Erinnerung „${contextData?.title || 'Aktive Erinnerung'}“ oder wähle einen Vorschlag.`
                : contextScope === 'task'
                ? `Frag mich etwas zur Aufgabe „${contextData?.task?.title || 'Aktive Aufgabe'}“ oder wähle einen Vorschlag.`
                : contextScope === 'section'
                ? `Frag mich etwas zum Abschnitt „${contextData?.title || 'Aktiver Abschnitt'}“ oder zur Planung.`
                : 'Frag mich etwas zum Projektverlauf, Zeitplan oder nächsten Schritten.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.role === 'assistant' || msg.sender === 'bot';
            return (
              <div key={msg.id} className={cx('flex gap-2.5', isBot ? 'justify-start' : 'justify-end')}>
                {isBot && <IconTile area="coach" size="sm" className="mt-0.5 !h-7 !w-7" />}
                <div
                  className={cx(
                    'max-w-[85%] rounded-lg px-4 py-2.5 text-body',
                    isBot ? 'rounded-bl-xs border border-subtle bg-surface text-primary' : 'rounded-br-xs bg-selected text-primary'
                  )}
                >
                  {isBot ? (
                    msg.content || msg.text ? (
                      <div className="markdown-body space-y-2 text-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || msg.text}
                        </ReactMarkdown>

                        {/* Ausgeführte Aktionen als Karten */}
                        {msg.actionResults && msg.actionResults.length > 0 && (
                          <div className="not-prose mt-3 space-y-2 border-t border-subtle pt-3">
                            {msg.actionResults.map((res, idx) => {
                              const isProjAction = res.targetType === 'project' || res.type === 'ADD_PHASE' || res.type === 'ADD_TASK' || res.type === 'CREATE_PROJECT' || res.type === 'UPDATE_PROJECT';
                              const isRemAction = res.targetType === 'reminder' || res.type === 'CREATE_REMINDER' || res.type === 'UPDATE_REMINDER';
                              const isCalAction = res.targetType === 'calendar' || res.isOnlyCalendar || res.type === 'CREATE_CALENDAR_EVENT';
                              const isNoteAction = res.type === 'CREATE_NOTE';
                              const isMatAction = res.type === 'ADD_MATERIAL';

                              const iconName = isNoteAction ? 'note_alt' : isMatAction ? 'attach_file' : isCalAction ? 'calendar_month' : isRemAction ? 'notifications' : isProjAction ? 'folder' : 'check_circle';
                              const area = isCalAction ? 'calendar' : isRemAction ? 'reminders' : isProjAction ? 'projects' : 'neutral';

                              return (
                                <div key={idx} className="flex items-center gap-3 rounded-lg border border-subtle bg-subtle p-2">
                                  <IconTile area={area} icon={iconName} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-caption-strong text-primary">{res.title}</div>
                                    <div className="truncate text-micro text-secondary">{res.subtitle}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Auswahl, wo ein Termin oder eine Erinnerung angelegt wird */}
                        {msg.intentChoice && (
                          <div className="not-prose mt-3 w-full space-y-2 border-t border-subtle pt-3">
                            <div className="flex items-center gap-1.5 text-label-sm text-secondary">
                              <Icon name="help" size="sm" />
                              <span>Wo soll der Eintrag angelegt werden?</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                leadingIcon="notifications"
                                onClick={() => handleSend(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ ${intentWhen(msg.intentChoice)} nur in FocusFlow.`)}
                              >
                                Nur in FocusFlow
                              </Button>
                              <Button
                                size="sm"
                                leadingIcon="sync"
                                disabled={choiceDisabled}
                                title={choiceHint || 'Empfohlen'}
                                onClick={() => handleSend(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ ${intentWhen(msg.intentChoice)} in FocusFlow mit Google Kalender-Sync.`)}
                              >
                                FocusFlow + Kalender-Sync
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                leadingIcon="calendar_month"
                                disabled={choiceDisabled}
                                title={choiceHint || 'Direkt im Kalender eintragen'}
                                onClick={() => handleSend(`Bitte trage den Termin „${msg.intentChoice.title}“ ${intentWhen(msg.intentChoice)} nur im Google Kalender ein.`)}
                              >
                                Nur im Google Kalender
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : msg.isStreaming ? (
                      <div className="flex items-center gap-2 py-1 text-caption text-secondary">
                        <Spinner size="sm" label="" />
                        <span>Fio denkt nach …</span>
                      </div>
                    ) : msg.cancelled ? (
                      <div className="flex items-center gap-1.5 py-1 text-caption text-secondary">
                        <Icon name="pause_circle" size="sm" />
                        <span>Antwort abgebrochen</span>
                      </div>
                    ) : (
                      <div className="text-caption text-secondary">
                        Keine Antwort erhalten.
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

      {/* Eingabe */}
      <div
        className="flex shrink-0 flex-col gap-2 border-t border-subtle bg-surface p-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center pb-1">
            <Button variant="secondary" size="sm" leadingIcon="stop" onClick={handleStopGeneration}>
              Antwort stoppen
            </Button>
          </div>
        ) : (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            {quickPrompts.map((prompt) => (
              <Button variant="secondary" size="sm" key={prompt} leadingIcon="bolt" onClick={() => handleSend(prompt)} disabled={isLoading} className="shrink-0">
                {prompt}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-lg border border-control bg-surface p-1.5 transition-[border-color,box-shadow] duration-fast focus-within:border-transparent focus-within:ring-2 focus-within:ring-focus">
          <textarea
            ref={textareaRef}
            value={inputText}
            disabled={isLoading}
            aria-label="Nachricht an Fio"
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
                ? 'Fio generiert gerade eine Antwort …'
                : contextScope === 'reminder'
                ? 'Frag Fio zu dieser Erinnerung …'
                : contextScope === 'task'
                ? 'Frag Fio zu dieser Aufgabe …'
                : 'Frag Fio zum Projekt …'
            }
            className="max-h-[120px] min-h-9 flex-1 resize-none border-none bg-transparent p-2 text-body text-primary outline-none placeholder:text-tertiary focus:outline-none focus:ring-0 disabled:text-disabled"
            rows={1}
          />

          {isLoading ? (
            <IconButton icon="stop" label="Antwort unterbrechen" variant="danger" className="mb-0.5 mr-0.5 shrink-0" onClick={handleStopGeneration} />
          ) : (
            <IconButton icon="send" label="Nachricht senden" variant="primary" className="mb-0.5 mr-0.5 shrink-0" onClick={() => handleSend()} disabled={!inputText.trim() || isLoading} />
          )}
        </div>
      </div>

    </div>
  );
};

export default ProjectAiChat;
