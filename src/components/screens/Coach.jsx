import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { askGeminiCoach } from '../../lib/gemini';
import {
  chatSessions as initialSessions,
  chatHistory as initialHistory
} from '../../data/mockData';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FioIcon from '../ui/FioIcon';

const Coach = () => {
  const { projects, inboxItems, activeCoachScope, setActiveCoachScope } = useModalContext();
  const { user } = useAuth();
  const [isHistoryOpen, setIsHistoryOpen] = useState(() => {
    const saved = localStorage.getItem('focusflow_coach_history');
    if (saved !== null) return JSON.parse(saved);
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    localStorage.setItem('focusflow_coach_history', JSON.stringify(isHistoryOpen));
  }, [isHistoryOpen]);

  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState('cs1');
  const [messages, setMessages] = useState(initialHistory);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('gemini-3.6-flash');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const textareaRef = useRef(null);

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
      dateText: 'Heute • 0 Nachrichten',
      active: true
    };

    setSessions((prev) => [
      newSession,
      ...prev.map((s) => ({ ...s, active: false }))
    ]);
    setActiveSessionId(newSessionId);
    setMessages([]);
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

    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;

    const userMessage = {
      id: userMsgId,
      sender: 'user',
      text: text.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
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
    <div className="screen-transition flex flex-col h-full w-full">
      <div className="flex h-full bg-surface relative overflow-hidden">
        {/* Mobile Overlay */}
        {isHistoryOpen && (
          <div 
            className="absolute inset-0 bg-black/20 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsHistoryOpen(false)}
          />
        )}
        
        {/* Left Sidebar: Chat Session History Drawer */}
        <div
          className={`absolute md:relative z-30 bg-surface-low md:border-r border-outline-variant flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0 rounded-r-2xl md:rounded-none shadow-2xl md:shadow-none ${
            isHistoryOpen ? 'w-[85%] sm:w-72' : 'w-0 p-0 border-0 overflow-hidden'
          }`}
        >
          <div className="p-3 border-b border-outline-variant flex items-center justify-between bg-surface-low">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant">VERLAUF</span>
            <div className="flex items-center gap-1.5">
              <button
                className="w-10 h-10 bg-primary text-on-primary rounded-xl hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                title="Neuer Chat"
                onClick={handleNewChat}
              >
                <span className="material-symbols-outlined text-[20px]">edit_square</span>
              </button>
              <button
                className="w-10 h-10 border border-outline-variant bg-white hover:border-primary text-primary transition-colors flex items-center justify-center rounded-xl cursor-pointer shadow-sm"
                title="Verlauf einklappen"
                onClick={() => setIsHistoryOpen(false)}
              >
                <span className="material-symbols-outlined text-[20px]">left_panel_close</span>
              </button>
            </div>
          </div>

          <div className="space-y-1 p-2 overflow-y-auto flex-grow">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  className={`p-3 cursor-pointer transition-colors flex flex-col gap-0.5 rounded-xl border ${isActive
                    ? 'bg-primary/5 border-primary shadow-sm'
                    : 'bg-white border-outline-variant hover:bg-surface-low'
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
          {/* Floating Action Buttons when Sidebar is closed */}
          {!isHistoryOpen && (
            <div className="absolute top-4 left-4 z-20 flex flex-row gap-2">
              <button
                className="w-10 h-10 border border-outline-variant bg-white hover:border-primary text-primary transition-colors flex items-center justify-center rounded-xl cursor-pointer shadow-sm"
                title="Verlauf ausklappen"
                onClick={() => setIsHistoryOpen(true)}
              >
                <span className="material-symbols-outlined text-[20px]">left_panel_open</span>
              </button>
              <button
                className="w-10 h-10 bg-primary text-on-primary rounded-xl hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                title="Neuer Chat"
                onClick={handleNewChat}
              >
                <span className="material-symbols-outlined text-[20px]">edit_square</span>
              </button>
            </div>
          )}

          {/* Floating Mobile Model Dropdown */}
          <div className="absolute top-4 right-4 z-20 block sm:hidden">
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value)}
              className="bg-white border border-outline-variant text-[10px] font-mono font-bold text-primary rounded-xl px-2.5 py-2 shadow-sm focus:outline-none cursor-pointer"
              title="KI-Modell auswählen"
            >
              <optgroup label="Flash">
                <option value="gemini-3.6-flash">3.6 Flash</option>
                <option value="gemini-3.5-flash">3.5 Flash</option>
              </optgroup>
              <optgroup label="Lite">
                <option value="gemini-3.5-flash-lite">3.5 Lite</option>
                <option value="gemini-3.1-flash-lite">3.1 Lite</option>
              </optgroup>
            </select>
          </div>

          {/* Message Stream */}
          <div className="flex-grow overflow-y-auto px-4 pb-6 pt-16 lg:pt-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-4 fade-in">
                  <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mb-4 shadow-md p-3.5">
                    <FioIcon className="w-full h-full text-white" color="currentColor" />
                  </div>
                  <h2 className="text-2xl font-bold text-on-surface mb-1.5 tracking-tight">
                    Hallo{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}, ich bin Fio 👋
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                    Dein persönlicher KI-Coach. Wie kann ich dich heute bei deinen Aufgaben und Projekten unterstützen?
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                if (msg.sender === 'bot') {
                  return (
                    <div key={msg.id} className="flex gap-3 group">
                      <div className="w-8 h-8 flex-shrink-0 bg-primary text-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
                        <FioIcon className="w-full h-full text-white" color="currentColor" />
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
              }))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Input Control Suite */}
          <div className="p-3 sm:p-4 bg-transparent space-y-3 pb-4 sm:pb-6 relative z-10">
            {/* Quick Prompts */}
            <div className="max-w-2xl mx-auto flex items-center gap-2 no-wrap-scroll text-[11px] font-mono pb-1 overflow-x-auto">
              <span className="text-on-surface-variant font-bold flex-shrink-0">PROMPTS:</span>
              {dynamicPrompts.map((qp) => (
                <button
                  key={qp.id}
                  className="px-2.5 py-1 bg-white border border-outline-variant rounded-lg hover:border-primary text-primary transition-all font-medium whitespace-nowrap flex-shrink-0 cursor-pointer shadow-sm"
                  onClick={() => handleSendMessage(qp.promptText)}
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="max-w-2xl mx-auto flex items-center bg-white border border-outline-variant rounded-2xl shadow-sm p-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              {/* Filter Icon (Scope Dropdown) */}
              <div className="relative flex items-center justify-center pl-2 pr-1 cursor-pointer group">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[22px]">filter_alt</span>
                <select
                  value={activeCoachScope}
                  onChange={(e) => setActiveCoachScope(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Fokus ändern"
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

              <textarea
                ref={textareaRef}
                className="flex-grow border-none focus:ring-0 text-sm px-2 sm:px-3 py-2.5 sm:py-3 outline-none resize-none overflow-y-auto min-h-[44px]"
                placeholder="Frage deinen Coach..."
                value={inputText}
                rows={1}
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
              <button
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors flex items-center justify-center cursor-pointer flex-shrink-0 ${
                  isListening
                    ? 'bg-red-600 text-white shadow-sm'
                    : inputText.trim().length === 0 
                      ? 'bg-primary text-on-primary hover:bg-neutral-800 shadow-sm' 
                      : 'text-on-surface-variant hover:text-primary bg-surface-low border border-outline-variant sm:border-none sm:bg-transparent'
                }`}
                onClick={handleToggleListening}
                title={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe'}
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>

              {inputText.trim().length > 0 && (
                <button
                  className="px-3 sm:px-4 py-2.5 sm:py-3 bg-primary text-on-primary rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer shadow-sm ml-1 flex-shrink-0"
                  onClick={() => handleSendMessage()}
                  title="Senden"
                >
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
              )}

              {/* Model Dropdown right next to Send (Desktop Only) */}
              <div className="hidden sm:flex items-center pl-1 sm:pl-2 ml-1 sm:ml-2 border-l border-outline-variant pr-1">
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="bg-transparent border-none text-[10px] sm:text-[11px] font-mono font-bold text-on-surface-variant focus:outline-none cursor-pointer hover:text-primary transition-colors max-w-[65px] sm:max-w-[80px]"
                  title="KI-Modell auswählen"
                >
                  <optgroup label="Flash">
                    <option value="gemini-3.6-flash">3.6 Flash</option>
                    <option value="gemini-3.5-flash">3.5 Flash</option>
                  </optgroup>
                  <optgroup label="Lite">
                    <option value="gemini-3.5-flash-lite">3.5 Lite</option>
                    <option value="gemini-3.1-flash-lite">3.1 Lite</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Coach;
