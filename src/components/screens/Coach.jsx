import React, { useState, useRef, useEffect } from 'react';
import {
  chatSessions as initialSessions,
  chatHistory as initialHistory,
  quickPrompts
} from '../../data/mockData';

const Coach = () => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState('cs1');
  const [messages, setMessages] = useState(initialHistory);
  const [inputText, setInputText] = useState('');
  
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
        text: 'Hallo Fabian! Wie kann ich dich heute bei deinen Projekten unterstützen?'
      }
    ]);
  };

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim()) return;

    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;

    const userMessage = {
      id: userMsgId,
      sender: 'user',
      text: text.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');

    // Generate automated bot response
    setTimeout(() => {
      let botText = 'Danke für deine Nachricht! Lass uns diesen Schritt direkt in FocusFlow strukturieren.';
      const lower = text.toLowerCase();
      if (lower.includes('blockade') || lower.includes('schritt')) {
        botText = 'Der beste erste Schritt ist: Zerlege die Aufgabe in ein 10-Minuten Häppchen. Starte jetzt mit dem Titel der ersten Notiz.';
      } else if (lower.includes('inbox') || lower.includes('priorisieren')) {
        botText = 'Schau in deine Inbox und frage dich bei jedem Punkt: "Kann ich das in unter 2 Minuten erledigen?" Wenn ja, sofort tun. Wenn nein, als Projekt-Task einplanen.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: botText
        }
      ]);
    }, 400);
  };

  return (
    <div className="screen-transition flex flex-col h-[calc(100vh-140px)]">
      <div className="flex h-full border border-outline-variant bg-surface relative overflow-hidden">
        {/* Left Sidebar: Chat Session History Drawer */}
        <div
          className={`bg-white border-r border-outline-variant flex flex-col h-full transition-all duration-300 ease-in-out relative z-10 flex-shrink-0 ${
            isHistoryOpen ? 'w-72' : 'w-0 p-0 border-0 overflow-hidden'
          }`}
        >
          <div className="p-3 border-b border-outline-variant flex items-center justify-between gap-2 bg-surface-low">
            <button
              className="flex-grow py-2 px-3 bg-primary text-on-primary text-xs font-mono font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
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
                  className={`p-3 cursor-pointer transition-colors flex flex-col gap-0.5 ${
                    isActive
                      ? 'bg-surface-low border-l-2 border-primary'
                      : 'bg-white border border-outline-variant hover:bg-surface-low'
                  }`}
                  onClick={() => handleSelectSession(sess.id)}
                >
                  <span
                    className={`text-xs truncate ${
                      isActive ? 'font-bold text-primary' : 'font-medium text-primary'
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
          <div className="px-4 sm:px-6 py-3 border-b border-outline-variant bg-white flex items-center justify-between">
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

              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                </div>
                <span className="text-xs font-bold font-mono truncate">
                  {activeSession ? activeSession.title : 'Re-Branding Start-Hilfe'}
                </span>
              </div>
            </div>

            <span className="text-[10px] mono px-2 py-0.5 bg-surface-low border border-outline-variant whitespace-nowrap">
              AI COACH
            </span>
          </div>

          {/* Message Stream */}
          <div className="flex-grow overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((msg) => {
                if (msg.sender === 'bot') {
                  return (
                    <div key={msg.id} className="flex gap-3">
                      <div className="w-8 h-8 flex-shrink-0 bg-primary text-on-primary flex items-center justify-center text-xs">
                        <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                      </div>
                      <div className="p-4 bg-white border border-outline-variant text-sm shadow-sm">
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex gap-3 flex-row-reverse">
                    <div className="w-8 h-8 flex-shrink-0 bg-surface-low border border-outline-variant flex items-center justify-center text-xs font-mono font-bold">
                      FF
                    </div>
                    <div className="p-4 bg-white border border-primary text-sm max-w-[85%] shadow-sm">
                      <p>{msg.text}</p>
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
              {quickPrompts.map((qp) => (
                <button
                  key={qp.id}
                  className="px-2.5 py-1 bg-surface-low border border-outline-variant hover:border-primary text-primary transition-all font-medium whitespace-nowrap flex-shrink-0 cursor-pointer"
                  onClick={() => handleSendMessage(qp.promptText)}
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="max-w-2xl mx-auto flex border border-primary bg-white shadow-sm p-1">
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
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-on-primary text-xs font-mono font-bold hover:bg-neutral-800 transition-colors flex items-center gap-2 flex-shrink-0 cursor-pointer"
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
