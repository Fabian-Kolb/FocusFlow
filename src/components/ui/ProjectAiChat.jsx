import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askGeminiCoach } from '../../lib/gemini';
import FioIcon from './FioIcon';

const ProjectAiChat = ({
  projectData,
  contextScope = 'project',
  contextData = null,
  scrollContainerRef,
  activeModel = 'gemini-3.6-flash',
  isHistoryOpen = false,
  setIsHistoryOpen,
  newChatTrigger = 0
}) => {
  const storageKey = `focusflow_ai_sessions_${projectData?.id || 'global'}`;

  // Multi-session storage
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load AI sessions from storage:', e);
    }
    return [{
      id: `sess_${Date.now()}`,
      title: 'Neues Gespräch',
      createdAt: new Date().toISOString(),
      messages: []
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id || `sess_${Date.now()}`);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Could not save AI sessions to storage:', e);
    }
  }, [sessions, storageKey]);

  // Handle New Chat Trigger from header
  const prevTriggerRef = useRef(newChatTrigger);
  useEffect(() => {
    if (newChatTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = newChatTrigger;
      handleNewChat();
    }
  }, [newChatTrigger]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: `sess_${Date.now()}`,
    title: 'Neues Gespräch',
    createdAt: new Date().toISOString(),
    messages: []
  };

  const messages = activeSession.messages || [];

  // Auto-scroll to bottom when messages change or stream in
  useEffect(() => {
    if (!isHistoryOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isHistoryOpen]);

  const handleNewChat = () => {
    const newSessionId = `sess_${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'Neues Gespräch',
      createdAt: new Date().toISOString(),
      messages: []
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    if (setIsHistoryOpen) setIsHistoryOpen(false);
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = {
          id: `sess_${Date.now()}`,
          title: 'Neues Gespräch',
          createdAt: new Date().toISOString(),
          messages: []
        };
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    if (setIsHistoryOpen) setIsHistoryOpen(false);
  };

  // Build context-grounded system instruction for Fio
  const buildSystemInstruction = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    let contextSummary = {
      heutigesDatum: `${dateStr}, ${timeStr} Uhr`,
      projekt: {
        titel: projectData?.title || 'Unbenanntes Projekt',
        beschreibung: projectData?.description || '',
        status: projectData?.status || 'AKTIV',
        fortschritt: `${projectData?.progress || 0}%`,
        abschnitte: (projectData?.phases || []).map((p) => ({
          id: p.id,
          titel: p.title,
          zeitraum: p.dateInfo,
          aufgaben: (p.tasks || []).map((t) => ({
            id: t.id,
            titel: t.title,
            erledigt: !!t.completed,
            termin: t.date,
            notizen: t.notes || ''
          }))
        }))
      }
    };

    if (contextScope === 'task' && contextData?.task) {
      contextSummary.aktiverFokus = {
        typ: 'Spezifische Aufgabe',
        abschnitt: contextData?.phase?.title || 'Aktueller Abschnitt',
        aufgabeTitel: contextData?.task?.title,
        erledigt: !!contextData?.task?.completed,
        termin: contextData?.task?.date || 'Kein Termin',
        details: contextData?.task?.notes || contextData?.task?.description || ''
      };
    } else if (contextScope === 'section' && contextData) {
      contextSummary.aktiverFokus = {
        typ: 'Spezifischer Abschnitt',
        abschnittTitel: contextData?.title,
        zeitraum: contextData?.dateInfo,
        aufgaben: (contextData?.tasks || []).map((t) => ({
          titel: t.title,
          erledigt: !!t.completed
        }))
      };
    }

    return `
Du bist Fio, der persönliche, hochkompetente KI-Coach in der Produktivitäts-App FocusFlow.
Du bist motivierend, präzise, pragmatisch und lösungsorientiert.
Deine Aufgabe ist es, dem Nutzer zu helfen, seine Projekte und Aufgaben erfolgreich, strukturiert und fokussiert abzuarbeiten.

KONTEXT DES NUTZERS:
${JSON.stringify(contextSummary, null, 2)}

REGELN:
1. Beziehe dich direkt auf das Projekt und den aktiven Fokus (Aufgabe oder Abschnitt), falls vorhanden.
2. Antworte in natürlichem, klarem und gut lesbarem Deutsch mit Markdown (fette Schlüsselwörter, übersichtliche Aufzählungszeichen mit - oder Zahlen).
3. Sei konkret und handlungsorientiert: Gib direkt umsetzbare Ratschläge, konkrete Schritte oder klare Empfehlungen.
4. Halte Antworten prägnant und fokussiert, ohne ausschweifende Floskeln.
`;
  };

  // Dynamic quick prompts
  const getQuickPrompts = () => {
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

  const handleSend = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    const trimmedText = text.trim();
    const userMsgId = `user_${Date.now()}`;
    const botMsgId = `bot_${Date.now()}`;

    // Update active session messages
    setSessions((prevSessions) =>
      prevSessions.map((sess) => {
        if (sess.id === activeSessionId) {
          const newTitle = sess.messages.length === 0 
            ? (trimmedText.length > 32 ? trimmedText.slice(0, 32) + '...' : trimmedText)
            : sess.title;
          return {
            ...sess,
            title: newTitle,
            messages: [
              ...sess.messages,
              { id: userMsgId, role: 'user', content: trimmedText },
              { id: botMsgId, role: 'assistant', content: '', isStreaming: true }
            ]
          };
        }
        return sess;
      })
    );

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const systemInstruction = buildSystemInstruction();
      await askGeminiCoach({
        prompt: trimmedText,
        systemInstruction,
        aiModel: activeModel,
        onChunk: (streamedText) => {
          setSessions((prevSessions) =>
            prevSessions.map((sess) => {
              if (sess.id === activeSessionId) {
                return {
                  ...sess,
                  messages: sess.messages.map((msg) =>
                    msg.id === botMsgId ? { ...msg, content: streamedText } : msg
                  )
                };
              }
              return sess;
            })
          );
        }
      });

      setSessions((prevSessions) =>
        prevSessions.map((sess) => {
          if (sess.id === activeSessionId) {
            return {
              ...sess,
              messages: sess.messages.map((msg) =>
                msg.id === botMsgId ? { ...msg, isStreaming: false } : msg
              )
            };
          }
          return sess;
        })
      );
    } catch (err) {
      console.error('Fio Chat Error:', err);
      const errMsg = err?.message || 'Fehler bei der Kommunikation mit dem KI-Coach.';
      setSessions((prevSessions) =>
        prevSessions.map((sess) => {
          if (sess.id === activeSessionId) {
            return {
              ...sess,
              messages: sess.messages.map((msg) =>
                msg.id === botMsgId
                  ? { ...msg, content: `⚠️ **Fehler:** ${errMsg}`, isStreaming: false }
                  : msg
              )
            };
          }
          return sess;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = getQuickPrompts();

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

      {/* History Slide-Down Overlay */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-30 bg-white flex flex-col overflow-hidden animate-fadeIn">
          <div className="p-3 border-b border-outline-variant flex items-center justify-between bg-surface-low/50">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[18px]">history</span>
              <span>GESPEICHERTE CHATS ({sessions.length})</span>
            </div>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white text-[11px] font-mono font-bold rounded-lg hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>NEUER CHAT</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                    isActive
                      ? 'bg-primary/5 border-primary/40 shadow-xs'
                      : 'bg-white border-outline-variant hover:border-primary/30 hover:bg-surface-low/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-xs text-on-surface truncate">
                        {sess.title || 'Gespräch'}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded shrink-0">
                          AKTIV
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-2">
                      <span>{formatDate(sess.createdAt)}</span>
                      <span>•</span>
                      <span>{sess.messages?.length || 0} Nachrichten</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                    title="Gespräch löschen"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Context Scope Indicator */}
      {contextScope !== 'project' && (
        <div className="shrink-0 bg-white border-b border-outline-variant/60 px-4 py-2 flex items-center justify-between text-xs font-mono text-on-surface-variant">
          <div className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-[15px] text-primary">
              {contextScope === 'task' ? 'check_circle' : 'folder'}
            </span>
            <span className="font-bold text-on-surface truncate">
              {contextScope === 'task' 
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
              {contextScope === 'task' 
                ? `Frag mich etwas zur Aufgabe „${contextData?.task?.title || 'Aktive Aufgabe'}“ oder wähle einen Quick-Prompt.`
                : contextScope === 'section'
                ? `Frag mich etwas zum Abschnitt „${contextData?.title || 'Aktiver Abschnitt'}“ oder zur Planung.`
                : 'Frag mich etwas zum Projektverlauf, Zeitplan oder nächsten Schritten.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 shrink-0 rounded-xl bg-neutral-900 text-white flex items-center justify-center p-1.5 shadow-sm mt-0.5">
                  <FioIcon className="w-full h-full text-white" color="currentColor" />
                </div>
              )}
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-neutral-900 text-white rounded-br-xs' 
                    : 'bg-white border border-outline-variant text-on-surface rounded-bl-xs'
                }`}
              >
                {msg.role === 'assistant' ? (
                  msg.content ? (
                    <div className="markdown-body text-sm space-y-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 py-1 text-on-surface-variant text-xs">
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span>Fio denkt nach...</span>
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (Sticky Bottom) */}
      <div className="shrink-0 bg-white border-t border-outline-variant/60 p-3 flex flex-col gap-2">
        {/* Quick Prompts */}
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

        {/* Input Box */}
        <div className="flex items-end gap-2 bg-surface-low border border-outline-variant focus-within:border-primary focus-within:bg-white rounded-xl p-1.5 transition-all">
          <textarea
            ref={textareaRef}
            value={inputText}
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
            placeholder={contextScope === 'task' ? 'Frag Fio zu dieser Aufgabe...' : 'Frag Fio zum Projekt...'}
            className="flex-1 max-h-[120px] bg-transparent border-none outline-none focus:ring-0 resize-none text-sm p-2 text-on-surface"
            rows={1}
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-neutral-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black transition-all cursor-pointer mb-0.5 mr-0.5 shadow-sm"
            title="Nachricht senden"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">send</span>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default ProjectAiChat;
