import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { summarizeVoiceNote, ensureBulletPoints } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';

const Inbox = ({ setCurrentScreen }) => {
  const { inboxItems, addInboxItem, updateInboxItem, deleteInboxItem, openModal } = useModalContext();
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [triageText, setTriageText] = useState(null);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [activeModel, setActiveModel] = useState('eco');
  const [summaryLength, setSummaryLength] = useState('normal');
  const [isSummaryEnabled, setIsSummaryEnabled] = useState(true);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isTriageOpen) {
        setIsTriageOpen(false);
        setTriageText(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTriageOpen]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (activeDropdownId) setActiveDropdownId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeDropdownId]);

  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
        setInputValue(finalTranscript);
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

  const handleAdd = () => {
    const text = inputValue.trim();
    if (!text || isSummarizing) return;

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }

    setTriageText(text);
    setIsTriageOpen(true);
  };

  const processTriageChoice = async (choice) => {
    setIsTriageOpen(false);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const textToProcess = triageText;
    setTriageText(null);

    let summaryText = ensureBulletPoints(textToProcess);
    let finalTitle = summaryText;

    if (textToProcess.length > 35 && isSummaryEnabled) {
      setIsSummarizing(true);
      try {
        const summary = await summarizeVoiceNote(textToProcess, activeModel, summaryLength);
        if (summary) {
          summaryText = ensureBulletPoints(summary);
          finalTitle = summaryText;
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSummarizing(false);
      }
    }

    addInboxItem({
      title: finalTitle,
      summary: summaryText,
      originalText: textToProcess,
      type: choice === 'inbox' ? 'unclassified' : choice
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleConvert = (item) => {
    if (!item.type || item.type === 'unclassified') return;
    const fullDescription = `${item.title}\n\n---\n\n${item.originalText || ''}`.trim();
    openModal(item.type, { inboxItemId: item.id, prefillTitle: '', prefillDescription: fullDescription });
  };

  const renderItemCard = (item, isYesterday = false) => {
    const isExpanded = !!expandedItems[item.id];
    return (
      <Card
        key={item.id}
        padding="small"
        className={`flex flex-col gap-2 group hover:border-primary transition-all ${
          isYesterday ? 'opacity-75' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-grow space-y-1">
            <div className="text-xs sm:text-sm font-medium leading-snug">
              <div className="markdown-body markdown-compact">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {ensureBulletPoints(item.title)}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <button
              type="button"
              className="p-1 hover:bg-surface-low rounded-md transition-colors text-on-surface-variant cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdownId(prev => prev === item.id ? null : item.id);
              }}
              title="Optionen"
            >
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
            {activeDropdownId === item.id && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-primary rounded-xl z-30 w-48 shadow-lg overflow-hidden">
                <button
                  className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-xs font-medium text-red-600 flex items-center gap-2 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteInboxItem(item.id);
                    setActiveDropdownId(null);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Löschen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Klassifizierung / Aktionen */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-1 pt-3 border-t border-outline-variant">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase flex-shrink-0">TYP:</span>
            <select
              value={item.type || 'unclassified'}
              onChange={(e) => updateInboxItem(item.id, { type: e.target.value })}
              className="flex-grow sm:flex-grow-0 bg-surface-low border border-outline-variant rounded-lg px-2.5 py-1 text-xs font-bold text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="unclassified">Offen</option>
              <option value="project">Projekt</option>
              <option value="reminder">Erinnerung</option>
            </select>
          </div>

          <button
            onClick={() => handleConvert(item)}
            disabled={!item.type || item.type === 'unclassified'}
            className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-primary text-white text-xs font-bold rounded flex justify-center items-center gap-1.5 hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:bg-surface-variant disabled:text-on-surface-variant disabled:cursor-not-allowed shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">
              {!item.type || item.type === 'unclassified' ? 'lock' : 'arrow_forward'}
            </span>
            {!item.type || item.type === 'unclassified' ? 'Bitte Typ wählen' : `Als ${item.type === 'project' ? 'Projekt' : 'Erinnerung'} anlegen`}
          </button>
        </div>

        {item.originalText && (
          <div className="mt-2 border border-outline-variant rounded-xl overflow-hidden bg-surface-low">
            <button
              className="w-full flex items-center justify-between p-2.5 hover:bg-surface-variant/30 transition-colors text-left cursor-pointer"
              onClick={() => toggleExpand(item.id)}
            >
              <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">
                Original-Transkript
              </span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>
            
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 text-sm text-on-surface leading-relaxed">
                {item.originalText}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="screen-transition">
      <div className="w-full mx-auto space-y-6 sm:space-y-8">
        <Card className="border-primary flex flex-col gap-3">
          <label className="text-xs font-mono block uppercase tracking-wider text-on-surface-variant">
            WAS GEHT DIR DURCH DEN KOPF?
          </label>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-end">
            <div className="flex-grow flex items-end gap-2 w-full">
              <textarea
                ref={textareaRef}
                disabled={isSummarizing}
                placeholder={
                  isSummarizing
                    ? '✨ KI fasst deine Sprachnotiz zusammen...'
                    : isListening
                    ? 'Zuhören aktiv... Spreche so lange du möchtest!'
                    : 'Neuer Gedanke, Aufgabe oder Notiz...'
                }
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-on-surface-variant resize-none overflow-y-auto min-h-[42px]"
                style={{ height: 'auto' }}
              />
              <button
                disabled={isSummarizing}
                className={`w-[42px] h-[42px] rounded-lg border transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer ${
                  isListening
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-surface-low text-primary border-outline-variant hover:border-primary'
                }`}
                title={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
                onClick={handleToggleListening}
              >
                <span className="material-symbols-outlined text-[20px]">
                  mic
                </span>
              </button>
            </div>
            <Button
              disabled={isSummarizing}
              onClick={handleAdd}
              className="gap-2 w-full sm:w-auto h-[42px] flex-shrink-0"
            >
              {isSummarizing ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                  <span>Fasse zusammen...</span>
                </>
              ) : (
                'Hinzufügen'
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 border-t border-outline-variant pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSummaryEnabled}
                onChange={(e) => setIsSummaryEnabled(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-xs font-medium text-on-surface-variant">
                KI Zusammenfassung
              </span>
            </label>

            {isSummaryEnabled && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-on-surface-variant text-[14px]">psychology</span>
                  <select
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="bg-surface-low border border-outline-variant rounded-lg px-2 py-1 text-[11px] font-medium text-on-surface-variant focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="eco">Eco (Älteste zuerst)</option>
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

                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-on-surface-variant text-[14px]">straighten</span>
                  <select
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(e.target.value)}
                    className="bg-surface-low border border-outline-variant rounded-lg px-2 py-1 text-[11px] font-medium text-on-surface-variant focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="compact">Kompakt (Maximal verdichtet)</option>
                    <option value="normal">Präzise (Nur das Wichtigste)</option>
                    <option value="detailed">Ausführlich (Detailliert)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div>
          <h2 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-1 uppercase">
            HEUTE
          </h2>
          <div className="space-y-3">
            {inboxItems.today.map((item) => renderItemCard(item, false))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-1 uppercase">
            GESTERN
          </h2>
          <div className="space-y-3">
            {inboxItems.yesterday.map((item) => renderItemCard(item, true))}
          </div>
        </div>
      </div>

      {isTriageOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-primary w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">inbox</span>
                <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-primary">
                  INBOX-EINTRAG ERFASSEN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTriageOpen(false);
                  setTriageText(null);
                }}
                className="p-1 hover:bg-surface-low border border-outline-variant transition-colors cursor-pointer"
                title="Abbrechen (ESC)"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Dein Gedanke wird in deiner <strong>Inbox</strong> abgelegt. Möchtest du ihn direkt für die spätere Weiterverarbeitung vormerken?
            </p>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={() => processTriageChoice('project')}
                className="w-full p-3 bg-surface-low border border-outline-variant rounded-xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase">Als Projekt vormerken</div>
                  <div className="text-[11px] text-on-surface-variant">In die Inbox legen mit Typ "Projekt"</div>
                </div>
              </button>

              <button
                onClick={() => processTriageChoice('reminder')}
                className="w-full p-3 bg-surface-low border border-outline-variant rounded-xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase">Als Erinnerung vormerken</div>
                  <div className="text-[11px] text-on-surface-variant">In die Inbox legen mit Typ "Erinnerung"</div>
                </div>
              </button>

              <button
                onClick={() => processTriageChoice('inbox')}
                className="w-full p-3 bg-surface-low border border-outline-variant rounded-xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-surface-variant text-on-surface-variant flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[20px]">help_outline</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase">Noch unentschieden</div>
                  <div className="text-[11px] text-on-surface-variant">In die Inbox legen ohne Typ</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
