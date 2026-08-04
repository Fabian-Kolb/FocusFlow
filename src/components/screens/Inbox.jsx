import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { summarizeVoiceNote, ensureBulletPoints } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';

const Inbox = ({ setCurrentScreen }) => {
  const { inboxItems, addInboxItem, deleteInboxItem, openModal } = useModalContext();
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [activeModel, setActiveModel] = useState('eco');
  const [summaryLength, setSummaryLength] = useState('normal');

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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

  const handleAdd = async () => {
    const text = inputValue.trim();
    if (!text || isSummarizing) return;

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }

    if (text.length > 35) {
      setIsSummarizing(true);
      try {
        const summary = await summarizeVoiceNote(text, activeModel, summaryLength);
        if (summary) {
          const formattedSummary = ensureBulletPoints(summary);
          addInboxItem({
            title: formattedSummary,
            summary: formattedSummary,
            originalText: text
          });
        } else {
          addInboxItem(ensureBulletPoints(text));
        }
      } catch (e) {
        console.error(e);
        addInboxItem(ensureBulletPoints(text));
      } finally {
        setIsSummarizing(false);
      }
    } else {
      addInboxItem(ensureBulletPoints(text));
    }

    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleAdd();
    }
  };

  const handleConvertToProject = (item) => {
    openModal('project', { inboxItemId: item.id, prefillTitle: item.title });
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

            {item.originalText && (
              <button
                className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                onClick={() => toggleExpand(item.id)}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isExpanded ? 'expand_less' : 'graphic_eq'}
                </span>
                <span>{isExpanded ? 'Transkript verbergen' : '🎙️ Original-Transkript anzeigen'}</span>
              </button>
            )}
          </div>

          <div className="relative flex-shrink-0 group/dropdown">
            <button className="p-1 hover:bg-surface-low rounded-md transition-colors">
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
            <div className="hidden group-hover/dropdown:block absolute right-0 top-full mt-1 bg-white border border-primary rounded-xl z-20 w-48 shadow-lg overflow-hidden">
              <button
                className="w-full text-left px-4 py-2.5 hover:bg-surface-low text-xs font-medium"
                onClick={() => handleConvertToProject(item)}
              >
                Zu Projekt umwandeln
              </button>
              <button
                className="w-full text-left px-4 py-2.5 hover:bg-surface-low text-xs font-medium text-red-600"
                onClick={() => deleteInboxItem(item.id)}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>

        {item.originalText && isExpanded && (
          <div className="mt-2 p-3 bg-surface-low border border-outline-variant rounded-lg text-xs text-on-surface-variant leading-relaxed">
            <div className="text-[10px] font-mono font-bold uppercase mb-1 text-primary">
              Gesprochener Originaltext:
            </div>
            <p className="italic">"{item.originalText}"</p>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="screen-transition">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <Card className="border-primary">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-mono block uppercase tracking-wider text-on-surface-variant">
              WAS GEHT DIR DURCH DEN KOPF?
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[14px]">psychology</span>
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="bg-surface-low border border-outline-variant rounded-lg px-1.5 py-1 text-[10px] font-mono font-bold text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
                <span className="material-symbols-outlined text-primary text-[14px]">straighten</span>
                <select
                  value={summaryLength}
                  onChange={(e) => setSummaryLength(e.target.value)}
                  className="bg-surface-low border border-outline-variant rounded-lg px-1.5 py-1 text-[10px] font-mono font-bold text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="compact">Kompakt (Maximal verdichtet)</option>
                  <option value="normal">Präzise (Nur das Wichtigste)</option>
                  <option value="detailed">Ausführlich (Detailliert)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-grow flex items-center gap-2">
              <Input
                type="text"
                disabled={isSummarizing}
                placeholder={
                  isSummarizing
                    ? '✨ KI fasst deine Sprachnotiz zusammen...'
                    : isListening
                    ? 'Zuhören aktiv... Spreche so lange du möchtest!'
                    : 'Neuer Gedanke, Aufgabe oder Notiz...'
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
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
              className="gap-2 w-full sm:w-auto"
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
    </div>
  );
};

export default Inbox;
