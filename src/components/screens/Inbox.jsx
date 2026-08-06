import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { summarizeVoiceNote, ensureBulletPoints } from '../../lib/gemini';
import { marked } from 'marked';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';

const Inbox = ({ setCurrentScreen }) => {
  const { inboxItems, addInboxItem, updateInboxItem, deleteInboxItem, openModal, projects, mutateProject, reminders, mutateReminder } = useModalContext();
  const [appendToProjectId, setAppendToProjectId] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [triageText, setTriageText] = useState(null);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [triageView, setTriageView] = useState('main'); // 'main', 'inbox', 'project', 'reminder'
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
    setTriageView('main');
    setIsTriageOpen(true);
  };

  const processTriageChoice = async (choice) => {
    setIsTriageOpen(false);
    setTriageView('main');
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

  const appendDirectly = (targetId, type) => {
    const rawText = triageText || '';
    let htmlContent = marked.parse(ensureBulletPoints(rawText));
    
    const newNote = {
      id: `note_${Date.now()}`,
      title: 'Aus der Inbox (Schnellnotiz)',
      content: htmlContent,
      source: 'inbox',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    if (type === 'project') {
      mutateProject(targetId, (proj) => {
        return { ...proj, notes: [...(proj.notes || []), newNote] };
      });
    } else if (type === 'reminder') {
      mutateReminder(targetId, (rem) => {
        return { ...rem, notes: [...(rem.notes || []), newNote] };
      });
    }

    setIsTriageOpen(false);
    setTriageView('main');
    setTriageText(null);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  const handleAppendToProject = (item) => {
    const targetProjectId = appendToProjectId[item.id];
    if (!targetProjectId) return;
    
    const targetProject = projects.find(p => p.id === targetProjectId);
    if (!targetProject) return;

    let htmlContent = marked.parse(item.summary || item.title || '');
    if (item.originalText && item.originalText !== (item.summary || item.title)) {
      htmlContent += '<hr/>';
      htmlContent += `<h4>Original-Transkript</h4><p>${item.originalText.replace(/\n/g, '<br/>')}</p>`;
    }
    
    // Extract a nice title from the summary (first line)
    const firstLine = (item.summary || item.title || '').split('\n')[0].replace(/[*#]/g, '').trim();
    const shortTitle = firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '');

    const newNote = {
      id: `note_${Date.now()}`,
      title: `Aus Inbox: ${shortTitle || 'Notiz'}`,
      content: htmlContent,
      source: 'inbox',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    mutateProject(targetProjectId, (proj) => {
      return { ...proj, notes: [...(proj.notes || []), newNote] };
    });

    deleteInboxItem(item.id);
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {item.type === 'project' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  className="w-full sm:w-auto flex-grow sm:flex-grow-0 bg-surface-low border border-outline-variant rounded-lg px-2.5 py-1.5 text-[11px] font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer max-w-[200px] truncate"
                  value={appendToProjectId[item.id] || ''}
                  onChange={(e) => setAppendToProjectId(prev => ({ ...prev, [item.id]: e.target.value }))}
                >
                  <option value="">-- An bestehendes Projekt anhängen --</option>
                  {projects.filter(p => !p.deletedAt).map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                
                {appendToProjectId[item.id] && (
                  <button
                    onClick={() => handleAppendToProject(item)}
                    className="px-2 py-1.5 bg-primary/10 text-primary border border-primary/30 text-xs font-bold rounded flex justify-center items-center gap-1 hover:bg-primary/20 transition-all shadow-sm flex-shrink-0"
                    title="An Projekt anhängen"
                  >
                    <span className="material-symbols-outlined text-[16px]">library_add</span>
                  </button>
                )}
              </div>
            )}
            
            <button
              onClick={() => handleConvert(item)}
              disabled={!item.type || item.type === 'unclassified'}
              className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-primary text-white text-xs font-bold rounded flex justify-center items-center gap-1.5 hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:bg-surface-variant disabled:text-on-surface-variant disabled:cursor-not-allowed shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">
                {!item.type || item.type === 'unclassified' ? 'lock' : 'arrow_forward'}
              </span>
              {!item.type || item.type === 'unclassified' ? 'Bitte Typ wählen' : `Als neu${item.type === 'project' ? 'es Projekt' : 'e Erinnerung'}`}
            </button>
          </div>
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
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono block uppercase tracking-wider text-on-surface-variant">
              WAS GEHT DIR DURCH DEN KOPF?
            </label>
            <button
              onClick={() => setCurrentScreen('trash')}
              className="flex items-center justify-center p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
              title="Papierkorb öffnen"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>

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
          <div className="bg-white border-2 border-primary rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                {triageView !== 'main' && (
                  <button onClick={() => setTriageView('main')} className="p-1 hover:bg-surface-low border border-transparent hover:border-outline-variant rounded transition-colors cursor-pointer mr-1">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>
                )}
                <span className="material-symbols-outlined text-primary text-[22px]">inbox</span>
                <h3 className="text-xs sm:text-sm font-bold font-mono uppercase text-primary">
                  {triageView === 'main' ? 'GEDANKE ZUWEISEN' : triageView === 'inbox' ? 'INBOX-EINTRAG ERFASSEN' : triageView === 'project' ? 'PROJEKT AUSWÄHLEN' : 'ERINNERUNG AUSWÄHLEN'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTriageOpen(false);
                  setTriageView('main');
                  setTriageText(null);
                }}
                className="p-1 hover:bg-surface-low border border-outline-variant transition-colors cursor-pointer"
                title="Abbrechen (ESC)"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {triageView === 'main' && (
              <>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  Wohin möchtest du diesen Gedanken legen?
                </p>
                <div className="space-y-4 pt-1">
                  <div>
                    <h4 className="text-[10px] font-mono text-on-surface-variant uppercase mb-2">Vormerken</h4>
                    <button
                      onClick={() => setTriageView('inbox')}
                      className="w-full p-3 bg-surface-low border border-outline-variant rounded-2xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">inbox</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary uppercase">In Inbox ablegen</div>
                        <div className="text-[11px] text-on-surface-variant">Als offenen Task für später speichern</div>
                      </div>
                    </button>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-mono text-on-surface-variant uppercase mb-2">Direkt einsortieren</h4>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setTriageView('project')}
                        className="w-full p-3 bg-surface-low border border-outline-variant rounded-2xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[20px]">library_add</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-primary uppercase">Zu Projekt hinzufügen</div>
                          <div className="text-[11px] text-on-surface-variant">Direkt als Notiz an ein Projekt hängen</div>
                        </div>
                      </button>

                      <button
                        onClick={() => setTriageView('reminder')}
                        className="w-full p-3 bg-surface-low border border-outline-variant rounded-2xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[20px]">notifications</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-primary uppercase">Zu Erinnerung hinzufügen</div>
                          <div className="text-[11px] text-on-surface-variant">An bestehende Erinnerung anheften</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {triageView === 'inbox' && (
              <>
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
              </>
            )}

            {triageView === 'project' && (
              <div className="flex flex-col gap-2.5 pt-1">
                {projects.filter(p => !p.deletedAt).length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">Keine aktiven Projekte gefunden.</p>
                ) : (
                  projects.filter(p => !p.deletedAt).map(p => (
                    <button
                      key={p.id}
                      onClick={() => appendDirectly(p.id, 'project')}
                      className="w-full p-3 bg-surface-low border border-outline-variant rounded-xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-primary">folder</span>
                      <span className="text-xs font-bold text-primary">{p.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {triageView === 'reminder' && (
              <div className="flex flex-col gap-2.5 pt-1">
                {reminders.filter(r => !r.deletedAt).length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">Keine aktiven Erinnerungen gefunden.</p>
                ) : (
                  reminders.filter(r => !r.deletedAt).map(r => (
                    <button
                      key={r.id}
                      onClick={() => appendDirectly(r.id, 'reminder')}
                      className="w-full p-3 bg-surface-low border border-outline-variant rounded-xl hover:border-primary text-left transition-all flex items-center gap-3 group cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-primary">notifications</span>
                      <span className="text-xs font-bold text-primary">{r.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
