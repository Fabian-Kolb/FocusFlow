import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { askGeminiCoach } from '../../lib/gemini';
import {
  chatSessions as initialSessions,
  chatHistory as initialHistory
} from '../../data/mockData';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Coach = () => {
  const { projects, inboxItems, activeCoachScope, setActiveCoachScope } = useModalContext();
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState('cs1');
  const [messages, setMessages] = useState(initialHistory);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('gemini-3.6-flash');

  const selectedProject = projects.find(p => p.id === activeCoachScope);

  const buildSystemInstruction = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    let contextData = {
      heutigesDatum: `${dateStr}, ${timeStr} Uhr`
    };

    if (activeCoachScope === 'reminders') {
      contextData = {
        ...contextData,
        kategorie: 'Nur Erinnerungen & Inbox',
        inboxItems: inboxItems
      };
    } else if (selectedProject) {
      contextData = {
        ...contextData,
        kategorie: 'Spezifisches Projekt',
        projekt: selectedProject
      };
    } else {
      contextData = {
        ...contextData,
        kategorie: 'Alle Projekte & Erinnerungen',
        projekte: projects,
        inboxItems: inboxItems
      };
    }

    return `
Du bist der FocusFlow AI Coach, ein präziser, motivierender und hochstrukturierter Produktivitäts-Assistent.
Deine Aufgabe ist es, dem Nutzer zu helfen, seine Aufgaben und Projekte fokussiert abzuarbeiten.

Hier ist der AKTUELLE STATUS und KONTEXT der App des Nutzers:
${JSON.stringify(contextData, null, 2)}

Regeln:
1. Beziehe dich bei Fragen direkt auf die obigen Daten (Projekte, Phasen, Tasks, Inbox).
2. Antworte in klaren, gut strukturierten deutschen Sätzen mit Markdown-Formatierung.
3. Sei lösungsorientiert und halte Antworten prägnant.
`;
  };

  // Dynamic quick prompts based on scope
  const getQuickPrompts = () => {
    if (activeCoachScope === 'reminders') {
      return [
        { id: 'qp_r1', label: '🧹 Inbox & Erinnerungen aufräumen', promptText: 'Hilf mir, meine Inbox und Notizen zu strukturieren.' },
        { id: 'qp_r2', label: '➡️ In Tasks umwandeln', promptText: 'Welche Erinnerungen sollte ich in konkrete Projektaufgaben umwandeln?' },
        { id: 'qp_r3', label: '💡 Notizen zusammenfassen', promptText: 'Fasse meine aktuellen Notizen kurz zusammen.' }
      ];
    }
    if (selectedProject) {
      return [
        { id: 'qp_p1', label: '📋 Nächste Phase aufschlüsseln', promptText: `Wie erreiche ich die nächste Phase im Projekt "${selectedProject.title}" am schnellsten?` },
        { id: 'qp_p2', label: '📝 Aufgaben priorisieren', promptText: `Welche Aufgaben im Projekt "${selectedProject.title}" sind am wichtigsten?` },
        { id: 'qp_p3', label: '⏱️ Zeitplan prüfen', promptText: `Sind wir beim Projekt "${selectedProject.title}" gut im Zeitplan?` }
      ];
    }
    return [
      { id: 'qp_1', label: '⚡ Tagesplan erstellen', promptText: 'Erstelle einen Fokus-Tagesplan aus allen meinen Projekten.' },
      { id: 'qp_2', label: '⚠️ Engpässe finden', promptText: 'Welche Projekte oder Aufgaben benötigen meine Aufmerksamkeit?' },
      { id: 'qp_3', label: '🎯 Ziele priorisieren', promptText: 'Was ist das wichtigste Ziel für diese Woche?' }
    ];
  };

  const dynamicPrompts = getQuickPrompts();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    setSessions((prev) =>
      prev.map((s) => ({ ...s, active: s.id === sessionId }))
    );
  };

  const handleNewChat = () => {
    const newSessionId = `cs_${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'Neues Gespräch',
      dateText: 'Heute • 1 Nachricht',
      active: true
    };

    setSessions((prev) => [
      newSession,
      ...prev.map((s) => ({ ...s, active: false }))
    ]);
    setActiveSessionId(newSessionId);
    setMessages([
      {
        id: `m_${Date.now()}`,
        sender: 'bot',
        text: 'Hallo! Wie kann ich dich heute bei deinen Projekten unterstützen?'
      }
    ]);
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading) return;

    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;

    const userMessage = {
      id: userMsgId,
      sender: 'user',
      text: text.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        sender: 'bot',
        text: 'Denke nach...'
      }
    ]);

    try {
      const systemInstruction = buildSystemInstruction();
      await askGeminiCoach({
        prompt: text.trim(),
        systemInstruction,
        aiModel: activeModel,
        onChunk: (currentFullText) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === botMsgId ? { ...msg, text: currentFullText } : msg))
          );
        }
      });
    } catch (err) {
      console.error("Gemini Error:", err);
      const errMsg = err?.message || 'Fehler beim Aufruf der Gemini API.';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? { ...msg, text: `⚠️ KI-Fehler: ${errMsg}` }
            : msg
        )
      );
    }
    setLoading(false);
  };

  return (
    <div className="screen-transition flex flex-col h-[calc(100vh-140px)]">
      <div className="flex h-full border border-outline-variant bg-surface relative overflow-hidden rounded-xl">
        {/* Left Sidebar: Chat Session History Drawer */}
        <div
          className={`bg-white border-r border-outline-variant flex flex-col h-full transition-all duration-300 ease-in-out relative z-10 flex-shrink-0 ${isHistoryOpen ? 'w-72' : 'w-0 p-0 border-0 overflow-hidden'
            }`}
        >
          <div className="p-3 border-b border-outline-variant flex items-center justify-between gap-2 bg-surface-low">
            <button
              className="flex-grow py-2 px-3 bg-primary text-on-primary rounded-lg text-xs font-mono font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              onClick={handleNewChat}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>NEUER CHAT</span>
            </button>
            <button
              className="p-2 border border-outline-variant bg-white hover:border-primary text-primary transition-colors flex items-center justify-center cursor-pointer"
              title="Verlauf einklappen"
              onClick={() => setIsHistoryOpen(false)}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
          </div>

          <div className="px-4 py-2 border-b border-outline-variant bg-surface-low">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase font-bold">
              Vergangene Chats
            </span>
          </div>

          <div className="space-y-1 p-2 overflow-y-auto flex-grow">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  className={`p-3 cursor-pointer transition-colors flex flex-col gap-0.5 ${isActive
                    ? 'bg-surface-low border-l-2 border-primary'
                    : 'bg-white border border-outline-variant rounded-xl hover:bg-surface-low'
                    }`}
                  onClick={() => handleSelectSession(sess.id)}
                >
                  <span
                    className={`text-xs truncate ${isActive ? 'font-bold text-primary' : 'font-medium text-primary'
                      }`}
                  >
                    {sess.title}
                  </span>
                  <span className="text-[10px] mono text-on-surface-variant">{sess.dateText}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Main Chat Panel */}
        <div className="flex-grow flex flex-col h-full relative overflow-hidden bg-surface">
          {/* Top Bar */}
          <div className="px-4 sm:px-6 py-3 border-b border-outline-variant bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {!isHistoryOpen && (
                <>
                  <button
                    className="p-2 border border-outline-variant bg-surface-low hover:border-primary text-primary transition-colors flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer"
                    title="Verlauf ausklappen"
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span className="hidden sm:inline">VERLAUF</span>
                  </button>

                  <button
                    className="p-2 border border-outline-variant bg-surface-low hover:border-primary text-primary transition-colors flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer"
                    title="Neuer Chat starten"
                    onClick={handleNewChat}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span className="hidden sm:inline">NEUER CHAT</span>
                  </button>
                </>
              )}

              {/* Scope Dropdown */}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">filter_alt</span>
                <select
                  value={activeCoachScope}
                  onChange={(e) => setActiveCoachScope(e.target.value)}
                  className="bg-surface-low border border-outline-variant rounded-lg rounded px-2.5 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="all">🌐 Alle Projekte & Erinnerungen</option>
                  <option value="reminders">🔔 Nur Erinnerungen & Inbox</option>
                  <optgroup label="Projekte">
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        📁 Projekt: {p.title}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              {/* Model Dropdown */}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="bg-surface-low border border-outline-variant rounded-lg rounded px-2.5 py-1.5 text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <optgroup label="Flash">
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  </optgroup>
                  <optgroup label="Flash Lite">
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                  </optgroup>
                </select>
              </div>

            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-1 bg-primary/10 border border-primary/20 text-primary rounded">
                FOKUS: {selectedProject ? selectedProject.title : (activeCoachScope === 'reminders' ? 'Erinnerungen' : 'Alle Projekte')}
              </span>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-grow overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((msg) => {
                if (msg.sender === 'bot') {
                  return (
                    <div key={msg.id} className="flex gap-3 group">
                      <div className="w-8 h-8 flex-shrink-0 bg-primary text-on-primary rounded-lg flex items-center justify-center text-xs">
                        <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                      </div>
                      <div className="flex flex-col gap-1 items-start max-w-[85%]">
                        <div className="p-4 bg-white border border-outline-variant rounded-xl text-sm shadow-sm markdown-body w-full">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </div>
                        <button 
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-bold text-primary flex items-center gap-1 bg-surface-low px-2 py-1 border border-outline-variant rounded-lg hover:bg-white"
                          onClick={() => alert('Dokument gespeichert! (Mockup)')}
                        >
                          <span className="material-symbols-outlined text-[14px]">post_add</span>
                          ALS DOKUMENT SPEICHERN
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex gap-3 flex-row-reverse">
                    <div className="w-8 h-8 flex-shrink-0 bg-surface-low border border-outline-variant rounded-lg flex items-center justify-center text-xs font-mono font-bold">
                      FF
                    </div>
                    <div className="p-4 bg-white border border-primary rounded-xl text-sm max-w-[85%] shadow-sm markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Input Control Suite */}
          <div className="p-3 sm:p-4 border-t border-outline-variant bg-white space-y-2">
            {/* Quick Prompt Pills */}
            <div className="max-w-2xl mx-auto flex items-center gap-2 no-wrap-scroll text-[11px] font-mono pb-1">
              <span className="text-on-surface-variant font-bold flex-shrink-0">PROMPTS:</span>
              {dynamicPrompts.map((qp) => (
                <button
                  key={qp.id}
                  className="px-2.5 py-1 bg-surface-low border border-outline-variant rounded-lg hover:border-primary text-primary transition-all font-medium whitespace-nowrap flex-shrink-0 cursor-pointer"
                  onClick={() => handleSendMessage(qp.promptText)}
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="max-w-2xl mx-auto flex border border-primary bg-white rounded-xl shadow-sm p-1">
              <input
                type="text"
                className="flex-grow border-none focus:ring-0 text-sm px-3 sm:px-4 py-2.5 sm:py-3 outline-none"
                placeholder="Frage deinen Coach..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
              />
              <button
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-on-primary rounded-lg text-xs font-mono font-bold hover:bg-neutral-800 transition-colors flex items-center gap-2 flex-shrink-0 cursor-pointer"
                onClick={() => handleSendMessage()}
              >
                <span>SENDEN</span>
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Coach;
