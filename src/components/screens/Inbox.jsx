import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { ensureBulletPoints } from '../../lib/gemini';
import { buildThought } from '../../lib/thoughts';
import { buildDraftSource, initialDraftFromThought } from '../../lib/projectDraft';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ModelSelectorDropdown from '../ui/ModelSelectorDropdown';
import SummaryLengthDropdown from '../ui/SummaryLengthDropdown';

// Gedanken (intern weiterhin "inbox" / Firestore-Collection `inboxItems`):
// schnell festhalten ohne Zuordnung, später manuell oder mit Fio in Projekte/Erinnerungen überführen.

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/** Notiz-Inhalt aus einem Gedanken (Zusammenfassung + Originaltext), für "An … anhängen" */
function thoughtToNote(item) {
  let html = marked.parse(item.summary || item.title || '');
  if (item.originalText && item.originalText !== (item.summary || item.title)) {
    html += `<hr/><h4>Original-Transkript</h4><p>${escapeHtml(item.originalText).replace(/\n/g, '<br/>')}</p>`;
  }
  const firstLine = (item.title || item.summary || '').split('\n')[0].replace(/[*#]/g, '').trim();
  const shortTitle = firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '');
  return {
    id: `note_${Date.now()}`,
    title: `Aus Gedanken: ${shortTitle || 'Notiz'}`,
    content: DOMPurify.sanitize(html),
    source: 'inbox',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** "Manuell ▾": Gedanke von Hand umwandeln oder an Bestehendes anhängen */
function ManualMenu({ item, projects, reminders, onConvert, onAttach }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('main'); // 'main' | 'project' | 'reminder'
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const row = 'w-full min-h-[40px] px-3 py-2 flex items-center gap-2.5 rounded-lg text-sm font-semibold text-left text-primary hover:bg-surface-low transition-colors cursor-pointer';
  const targets = view === 'project' ? projects : reminders;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setView('main');
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 px-3 flex items-center gap-1 rounded-lg border border-outline-variant bg-white text-xs font-bold text-primary hover:border-primary transition-colors cursor-pointer"
      >
        Manuell
        <span className="material-symbols-outlined text-[18px]">expand_more</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-64 max-h-80 overflow-y-auto bg-white border border-outline-variant rounded-xl shadow-xl p-1.5">
          {view === 'main' ? (
            <>
              <button type="button" role="menuitem" className={row} onClick={() => { setOpen(false); onConvert(item, 'reminder'); }}>
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                Als neue Erinnerung
              </button>
              <button type="button" role="menuitem" className={row} onClick={() => { setOpen(false); onConvert(item, 'project'); }}>
                <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
                Als neues Projekt
              </button>
              <div className="h-px bg-outline-variant my-1" />
              <button type="button" role="menuitem" className={row} onClick={() => setView('project')}>
                <span className="material-symbols-outlined text-[20px]">library_add</span>
                <span className="flex-1">An Projekt anhängen</span>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
              </button>
              <button type="button" role="menuitem" className={row} onClick={() => setView('reminder')}>
                <span className="material-symbols-outlined text-[20px]">add_alert</span>
                <span className="flex-1">An Erinnerung anhängen</span>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className={`${row} text-on-surface-variant`} onClick={() => setView('main')}>
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                {view === 'project' ? 'Projekt wählen' : 'Erinnerung wählen'}
              </button>
              {targets.length === 0 ? (
                <p className="px-3 py-2 text-xs text-on-surface-variant italic">
                  Keine aktiven {view === 'project' ? 'Projekte' : 'Erinnerungen'} gefunden.
                </p>
              ) : targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  className={row}
                  onClick={() => {
                    setOpen(false);
                    onAttach(item, view, t.id);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">{view === 'project' ? 'folder' : 'notifications'}</span>
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const Inbox = ({ setCurrentScreen, autoStartVoice = false, onAutoStartConsumed }) => {
  const { inboxItems, addInboxItem, deleteInboxItem, openModal, projects, mutateProject, reminders, mutateReminder } = useModalContext();
  const { createDraftSession } = useChat();
  const { showToast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [activeModel, setActiveModel] = useState('eco');
  const [summaryLength, setSummaryLength] = useState('normal');
  const [isSummaryEnabled, setIsSummaryEnabled] = useState(true);
  const [showAllOlder, setShowAllOlder] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isOlderExpandedManually, setIsOlderExpandedManually] = useState(null);
  const { isListening, toggle: toggleListening, stop: stopListening } = useSpeechInput(inputValue, setInputValue);

  const activeProjects = projects.filter((p) => !p.deletedAt);
  const activeReminders = reminders.filter((r) => !r.deletedAt);

  const timeOf = (item) => item.createdAt || (item.id && item.id.includes('_') ? parseInt(item.id.split('_')[1]) : 0);

  // Aktuelle Gedanken: heute erstellt
  const currentNotes = [...(inboxItems?.today || [])].sort((a, b) => timeOf(b) - timeOf(a));

  // Ältere Gedanken: gestern, diese Woche und älter
  const sortedOlderNotes = [
    ...(inboxItems?.yesterday || []),
    ...(inboxItems?.thisWeek || []),
    ...(inboxItems?.older || []),
  ].sort((a, b) => timeOf(b) - timeOf(a));

  const hasCurrentNotes = currentNotes.length > 0;
  const isOlderOpen = isOlderExpandedManually !== null ? isOlderExpandedManually : !hasCurrentNotes;
  const visibleOlderNotes = showAllOlder ? sortedOlderNotes : sortedOlderNotes.slice(0, 3);

  const toggleOlderSection = () => {
    setIsOlderExpandedManually((prev) => !(prev !== null ? prev : !hasCurrentNotes));
  };

  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [inputValue]);

  // App-Kurzbefehl „Gedanken einsprechen“: Spracheingabe direkt starten.
  // Ohne Nutzergeste kann der Browser das Mikrofon verweigern – dann bleibt das Feld fokussiert.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartVoice || autoStartedRef.current) return;
    autoStartedRef.current = true;
    onAutoStartConsumed?.();
    textareaRef.current?.focus();
    if (!isListening) toggleListening();
  }, [autoStartVoice]);

  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Gedanke direkt speichern – keine Zuordnung nötig
  const handleAdd = async () => {
    const text = inputValue.trim();
    if (!text || isSummarizing) return;
    stopListening();
    setIsSummarizing(true);
    try {
      const thought = await buildThought(text, { summarize: isSummaryEnabled, model: activeModel, length: summaryLength });
      await addInboxItem(thought);
      setInputValue('');
    } catch (err) {
      console.error('Gedanke konnte nicht gespeichert werden:', err);
      // Text bleibt im Feld, damit nichts verloren geht
      showToast({ message: 'Gedanke konnte nicht gespeichert werden. Dein Text ist noch da.', icon: 'error' });
    } finally {
      // Sonst bliebe das Feld nach einem Fehler dauerhaft gesperrt
      setIsSummarizing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleConvert = (item, type) => {
    const rawTitle = item.title || (item.summary ? item.summary.split('\n')[0].replace(/^#{1,6}\s*/, '').replace(/\*/g, '').trim() : '');
    const cleanTitle = rawTitle || 'Neuer Eintrag';

    if (type === 'reminder') {
      const fullDescription = `${item.summary || item.title || ''}\n\n---\n\n${item.cleanText || item.originalText || ''}`.trim();
      openModal('reminder', {
        inboxItemId: item.id,
        prefillTitle: cleanTitle,
        date: item.extractedDate || '',
        time: item.extractedTime || '',
        prefillDescription: fullDescription,
      });
    } else {
      openModal('project', {
        inboxItemId: item.id,
        prefillTitle: cleanTitle,
        startDate: (item.extractedDateType === 'timeframe' ? item.extractedDate : '') || '',
        endDate: item.extractedEndDate || item.extractedDate || '',
        summaryText: item.summary || item.title || '',
        cleanText: item.cleanText || '',
        originalText: item.originalText || '',
        prefillDescription: '',
      });
    }
  };

  // Eigener Chat "Projektanlegung: …"; Fio macht dort den ersten Entwurf
  const handleElaborateWithFio = (item) => {
    createDraftSession({
      title: item.title || 'Neues Projekt',
      source: buildDraftSource(item),
      draft: initialDraftFromThought(item),
    });
    setCurrentScreen('coach');
  };

  // An Bestehendes anhängen: Inhalt wird zur Notiz, der Gedanke wandert in den Papierkorb
  const handleAttach = (item, type, targetId) => {
    const note = thoughtToNote(item);
    if (type === 'project') {
      mutateProject(targetId, (proj) => ({ ...proj, notes: [...(proj.notes || []), note] }));
    } else {
      mutateReminder(targetId, (rem) => ({ ...rem, notes: [...(rem.notes || []), note] }));
    }
    deleteInboxItem(item.id);
  };

  const renderItemCard = (item, isOlder = false) => {
    const isExpanded = !!expandedItems[item.id];

    const createdTimestamp = item.createdAt || parseInt((item.id || '').replace('i_', '')) || Date.now();
    const createdDateObj = new Date(createdTimestamp);
    const createdFormattedStr = createdDateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
    const createdDateStr = createdDateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    let dayLabel = createdDateStr;
    if (createdTimestamp >= startOfToday) dayLabel = 'Heute';
    else if (createdTimestamp >= startOfYesterday) dayLabel = 'Gestern';

    // Von der KI erkannte Zeitangabe
    let targetBadgeLabel = null;
    let targetBadgeIcon = 'event';
    if (item.extractedDate) {
      const formatDate = (isoStr) => {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : isoStr;
      };
      const startStr = formatDate(item.extractedDate);
      const endStr = formatDate(item.extractedEndDate);
      const timeStr = item.extractedTime ? `, ${item.extractedTime} Uhr` : '';

      if (item.extractedDateType === 'timeframe' || (endStr && endStr !== startStr)) {
        targetBadgeLabel = `Zeitraum: ${startStr}${endStr ? ` - ${endStr}` : ''}`;
        targetBadgeIcon = 'date_range';
      } else if (item.extractedDateType === 'appointment') {
        targetBadgeLabel = `Termin: ${startStr}${timeStr}`;
        targetBadgeIcon = 'alarm';
      } else {
        targetBadgeLabel = `Fällig: ${startStr}${timeStr}`;
      }
    }

    return (
      <Card
        key={item.id}
        padding="small"
        className={`flex flex-col gap-2 group hover:border-primary transition-all ${isOlder ? 'opacity-85' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-grow space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-on-surface-variant">
              <span className="bg-surface-low border border-outline-variant rounded-md px-2 py-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {dayLabel}, {createdFormattedStr}
              </span>
              {targetBadgeLabel && (
                <span className="bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5 font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">{targetBadgeIcon}</span>
                  {targetBadgeLabel}
                </span>
              )}
            </div>

            <div className="text-xs sm:text-sm font-medium leading-snug">
              <div className="markdown-body markdown-compact">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {ensureBulletPoints(item.summary || item.title)}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {isDeleteMode && (
            <button
              type="button"
              className="shrink-0 p-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                deleteInboxItem(item.id);
              }}
              title="In den Papierkorb"
              aria-label="Gedanke in den Papierkorb"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
        </div>

        {(item.cleanText || item.originalText) && (
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-low">
            <button
              type="button"
              className="w-full flex items-center justify-between p-2.5 hover:bg-surface-variant/30 transition-colors text-left cursor-pointer"
              onClick={() => toggleExpand(item.id)}
              aria-expanded={isExpanded}
            >
              <span className="text-[11px] font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                {item.cleanText ? 'Bereinigter Fließtext' : 'Original-Transkript'}
              </span>
              <span className="material-symbols-outlined text-[16px] text-primary">
                {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 pt-1 text-sm text-primary leading-relaxed space-y-2">
                <div className="text-primary font-normal">{item.cleanText || item.originalText}</div>
                {item.cleanText && item.originalText && item.cleanText !== item.originalText && (
                  <details className="text-xs text-primary pt-2 border-t border-outline-variant">
                    <summary className="cursor-pointer font-mono text-[11px] uppercase font-bold text-primary hover:text-black transition-colors">
                      Roh-Transkript anzeigen
                    </summary>
                    <div className="mt-2 text-sm text-primary leading-relaxed">{item.originalText}</div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Weiterverarbeiten */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
          <button
            type="button"
            onClick={() => handleElaborateWithFio(item)}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Mit Fio ausarbeiten
          </button>
          <ManualMenu
            item={item}
            projects={activeProjects}
            reminders={activeReminders}
            onConvert={handleConvert}
            onAttach={handleAttach}
          />
        </div>
      </Card>
    );
  };

  const deleteModeButton = (extraClass = '') => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsDeleteMode((prev) => !prev);
      }}
      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs font-mono font-bold ${extraClass} ${
        isDeleteMode
          ? 'bg-red-600 text-white border border-red-600 shadow-sm'
          : 'text-on-surface-variant hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200'
      }`}
      title={isDeleteMode ? 'Löschmodus beenden' : 'Löschmodus aktivieren'}
    >
      <span className="material-symbols-outlined text-[16px]">{isDeleteMode ? 'check' : 'delete'}</span>
      <span>{isDeleteMode ? 'Fertig' : 'Löschen'}</span>
    </button>
  );

  return (
    <div className="screen-transition">
      <div className="w-full mx-auto space-y-6 sm:space-y-8">
        <Card className="border-primary flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor="thought-input" className="text-xs font-mono block uppercase tracking-wider text-on-surface-variant">
              Was geht dir durch den Kopf?
            </label>
            <button
              type="button"
              onClick={() => setCurrentScreen('trash')}
              className="flex items-center justify-center p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
              title="Papierkorb öffnen"
              aria-label="Papierkorb öffnen"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-end">
            <div className="flex-grow flex items-end gap-2 w-full">
              <textarea
                id="thought-input"
                ref={textareaRef}
                disabled={isSummarizing}
                placeholder={
                  isSummarizing
                    ? 'KI fasst deinen Gedanken zusammen …'
                    : isListening
                    ? 'Zuhören aktiv … sprich so lange du möchtest'
                    : 'Neuer Gedanke, Idee oder Notiz …'
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-on-surface-variant resize-none overflow-y-auto min-h-[42px]"
              />
              <button
                type="button"
                disabled={isSummarizing}
                className={`w-[42px] h-[42px] rounded-lg border transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer ${
                  isListening
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-surface-low text-primary border-outline-variant hover:border-primary'
                }`}
                title={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
                aria-label={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
                aria-pressed={isListening}
                onClick={toggleListening}
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
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
                  <span>Fasse zusammen …</span>
                </>
              ) : (
                'Speichern'
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
              <span className="text-xs font-medium text-on-surface-variant">KI-Zusammenfassung</span>
            </label>

            {isSummaryEnabled && (
              <div className="flex flex-wrap items-center gap-2.5">
                <ModelSelectorDropdown activeModel={activeModel} onSelectModel={setActiveModel} showEco={true} />
                <SummaryLengthDropdown value={summaryLength} onChange={setSummaryLength} />
              </div>
            )}
          </div>
        </Card>

        {!hasCurrentNotes && sortedOlderNotes.length === 0 ? (
          <div className="text-center py-10 px-4 bg-surface-low border border-dashed border-outline-variant rounded-2xl text-on-surface-variant text-xs font-mono space-y-2">
            <span className="material-symbols-outlined text-[32px] block opacity-40">lightbulb</span>
            <p>Noch keine Gedanken. Schreib oder sprich einfach drauflos.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {hasCurrentNotes && (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1.5 border-b border-outline-variant/60">
                  <div className="flex items-center gap-2 select-none">
                    <span className="material-symbols-outlined text-[20px] text-primary">schedule</span>
                    <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                      <span>Heute</span>
                      <span className="text-on-surface-variant font-medium">({currentNotes.length})</span>
                    </h2>
                  </div>
                  {deleteModeButton()}
                </div>
                <div className="space-y-3">
                  {currentNotes.map((item) => renderItemCard(item, false))}
                </div>
              </div>
            )}

            {/* Ältere Gedanken: ohne heutige automatisch offen (die letzten 3), sonst zugeklappt */}
            {sortedOlderNotes.length > 0 && (
              <div className="space-y-3 pt-1">
                <div
                  className="flex items-center justify-between py-1.5 border-b border-outline-variant/60 cursor-pointer select-none group"
                  onClick={toggleOlderSection}
                >
                  <div className="flex items-center gap-2 flex-grow">
                    <span className={`material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-transform duration-200 ${
                      isOlderOpen ? 'rotate-90 text-primary' : ''
                    }`}>
                      chevron_right
                    </span>
                    <h2 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>Ältere Gedanken</span>
                      <span className="text-on-surface-variant font-medium">({sortedOlderNotes.length})</span>
                    </h2>
                  </div>
                  {!hasCurrentNotes && deleteModeButton('mr-2')}
                  <span className="text-xs font-mono font-bold text-primary group-hover:underline flex items-center gap-1">
                    {isOlderOpen ? 'Zuklappen' : 'Aufklappen'}
                  </span>
                </div>

                {isOlderOpen && (
                  <div className="space-y-3 animate-fadeIn">
                    {visibleOlderNotes.map((item) => renderItemCard(item, true))}

                    {sortedOlderNotes.length > 3 && (
                      <div className="flex justify-center pt-2">
                        {showAllOlder ? (
                          <button
                            type="button"
                            onClick={() => setShowAllOlder(false)}
                            className="flex items-center gap-2 px-4 py-2 bg-surface-low hover:bg-white border border-outline-variant hover:border-primary text-xs font-mono font-bold text-on-surface-variant hover:text-primary rounded-xl transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">expand_less</span>
                            <span>Weniger anzeigen (nur die letzten 3)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowAllOlder(true)}
                            className="w-full py-3 px-4 bg-surface-low/80 hover:bg-white border border-dashed border-outline-variant hover:border-primary text-xs font-mono font-bold text-primary rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            <span>Mehr anzeigen ({sortedOlderNotes.length - 3} weitere)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
