import React, { useState, useRef, useEffect } from 'react';

const ProjectAiChat = ({ projectData, contextScope = 'project', contextData = null, onClearContext }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isBreadcrumbExpanded, setIsBreadcrumbExpanded] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get quick prompts based on context
  const getQuickPrompts = () => {
    if (contextScope === 'task') {
      return ['Wie setze ich das um?', 'In Unteraufgaben aufteilen', 'Notizen zusammenfassen'];
    }
    if (contextScope === 'section') {
      return ['Welche Aufgaben fehlen?', 'Zeitaufwand schätzen', 'Abschnitt zusammenfassen'];
    }
    return ['Nächste Schritte', 'Projekt-Fortschritt', 'Risiken prüfen'];
  };

  const handleSend = (text) => {
    const content = text || inputText;
    if (!content.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: content.trim() }]);
    setInputText('');
    
    // Simulate AI typing for UI demo
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Das ist eine KI-Antwort im Kontext: **${contextScope}**. Die API ist aktuell noch nicht angebunden.`,
        isStreaming: false 
      }]);
    }, 1000);
  };

  const quickPrompts = getQuickPrompts();

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-low/30 overflow-hidden relative">

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant max-w-sm mx-auto opacity-70">
            <div className="w-16 h-16 rounded-2xl bg-white border border-outline-variant/60 flex items-center justify-center mb-4 shadow-sm">
              <span className="material-symbols-outlined text-3xl text-primary">forum</span>
            </div>
            <h3 className="font-bold text-primary mb-2">KI-Coach bereit</h3>
            <p className="text-sm leading-relaxed">
              Frag mich etwas zum Thema <span className="font-bold text-primary">"{contextData?.title || projectData?.title}"</span> oder nutze einen der Vorschläge unten.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-br-sm' 
                  : 'bg-white border border-outline-variant text-on-surface rounded-bl-sm'
              }`}>
                {msg.content}
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
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface-low border border-outline-variant rounded-full text-xs font-mono font-bold text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Box */}
        <div className="flex items-end gap-2 bg-surface-low border border-outline-variant focus-within:border-primary focus-within:bg-white rounded-xl p-1.5 transition-all">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Frag die KI..."
            className="flex-1 max-h-[120px] bg-transparent border-none outline-none focus:ring-0 resize-none text-sm p-2 text-on-surface"
            rows={1}
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer mb-0.5 mr-0.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default ProjectAiChat;
