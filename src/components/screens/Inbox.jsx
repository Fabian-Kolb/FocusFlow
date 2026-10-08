import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { ensureBulletPoints } from '../../lib/gemini';
import { buildThought } from '../../lib/thoughts';
import { buildDraftSource, initialDraftFromThought } from '../../lib/projectDraft';
import { areaOf } from '../../lib/areas';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import SwipeableCard from '../ui/SwipeableCard';
import ThoughtAiChip from '../ui/ThoughtAiChip';
import { AI_MODELS } from '../ui/ModelSelectorDropdown';
import { SUMMARY_LENGTH_OPTIONS } from '../ui/SummaryLengthDropdown';

// Gedanken (intern weiterhin "inbox" / Firestore-Collection `inboxItems`):
// schnell festhalten ohne Zuordnung, später manuell oder mit Fio in Projekte/Erinnerungen überführen.
// Aufbau: Die Eingabe ist das Wichtigste. Am Handy sitzt sie fest unten in der Daumenzone (sticky),
// am Desktop steht sie oben. Löschen: Wischen (Handy), Hover-Icon / Rechtsklick / Entf (Desktop),
// Mehrfachauswahl per Langdruck bzw. Menü. Alles rückholbar über den Rückgängig-Toast.

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const LONG_PRESS_MS = 480;
const LONG_PRESS_MOVE_PX = 8;

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

/** Eine Aktion pro Karte: „Weiterverarbeiten“ öffnet dieses Menü (auch per Rechtsklick auf die Karte) */
function ThoughtMenu({ item, open, onOpenChange, projects, reminders, onElaborate, onConvert, onAttach, onSelect, onDelete }) {
  const [view, setView] = useState('main'); // 'main' | 'project' | 'reminder'
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setView('main');
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
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

  const row = 'w-full min-h-[44px] sm:min-h-[40px] px-3 py-2 flex items-center gap-2.5 rounded-lg text-sm font-medium text-left text-primary hover:bg-surface-low transition-colors cursor-pointer';
  const targets = view === 'project' ? projects : reminders;
  const close = () => onOpenChange(false);

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Weiterverarbeiten
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">expand_more</span>
      </Button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-72 max-h-80 overflow-y-auto bg-white border border-outline-variant rounded-xl shadow-raised p-1.5">
          {view === 'main' ? (
            <>
              <button type="button" role="menuitem" className={`${row} font-semibold`} onClick={() => { close(); onElaborate(item); }}>
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                Mit Fio ausarbeiten
              </button>
              <button type="button" role="menuitem" className={row} onClick={() => { close(); onConvert(item, 'reminder'); }}>
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                Als neue Erinnerung
              </button>
              <button type="button" role="menuitem" className={row} onClick={() => { close(); onConvert(item, 'project'); }}>
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
              <div className="h-px bg-outline-variant my-1" />
              <button type="button" role="menuitem" className={row} onClick={() => { close(); onSelect(item.id); }}>
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                Auswählen
              </button>
              <button type="button" role="menuitem" className={`${row} text-danger hover:bg-danger-soft`} onClick={() => { close(); onDelete(item.id); }}>
                <span className="material-symbols-outlined text-[20px]">delete</span>
                In den Papierkorb
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
                    close();
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

// Zum Vergleichen: Markdown-Zeichen und Leerraum entfernen
const flat = (text) => String(text || '').replace(/[-*+#_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const stripMd = (text) => String(text || '')
  .replace(/^\s*(?:[-*+]\s+|#{1,6}\s*)/, '')
  .replace(/[*_`]/g, '')
  .trim();

/**
 * Titel und Inhalt eines Gedankens trennen: Der Titel ist das Wichtigste und steht groß oben,
 * der Rest der Zusammenfassung darunter. Ist die erste Zeile der Zusammenfassung nur der Titel
 * (Überschrift oder gleicher Text), wird sie nicht doppelt gezeigt.
 */
function splitThought(item) {
  const summary = ensureBulletPoints(item.summary || item.title || '');
  const lines = String(summary).split('\n');
  const firstRaw = lines[0] || '';
  const first = stripMd(firstRaw);
  const rawTitle = stripMd(item.title) || first || 'Gedanke';
  const isHeading = /^\s*#{1,6}\s/.test(firstRaw);
  const a = first.toLowerCase();
  const b = rawTitle.toLowerCase();
  const same = Boolean(first) && (isHeading || a.startsWith(b.slice(0, 30)) || b.startsWith(a.slice(0, 30)));
  const body = (same ? lines.slice(1) : lines).join('\n').trim();
  // Wurde der Titel bei 40 Zeichen abgeschnitten, ist die ganze erste Zeile der bessere Titel
  const title = same && !isHeading && first.length > rawTitle.length ? first : rawTitle;
  return { title, body };
}

const Inbox = ({ setCurrentScreen, autoStartVoice = false, onAutoStartConsumed }) => {
  const { inboxItems, addInboxItem, deleteInboxItem, deleteInboxItems, openModal, projects, mutateProject, reminders, mutateReminder } = useModalContext();
  const { createDraftSession } = useChat();
  const { showToast } = useToast();
  const area = areaOf('inbox');

  const [inputValue, setInputValue] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [showAllOlder, setShowAllOlder] = useState(false);
  const [isOlderExpandedManually, setIsOlderExpandedManually] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // KI-Einstellungen werden gemerkt, damit man sie nicht bei jedem Gedanken neu wählt
  const [summaryFlag, setSummaryFlag] = usePersistedChoice('focusflow_thought_ai', ['on', 'off'], 'on');
  const [summaryLength, setSummaryLength] = usePersistedChoice('focusflow_thought_length', SUMMARY_LENGTH_OPTIONS.map((o) => o.id), 'normal');
  const [activeModel, setActiveModel] = usePersistedChoice('focusflow_thought_model', AI_MODELS.map((m) => m.id), 'eco');
  const isSummaryEnabled = summaryFlag === 'on';

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
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

  // Esc beendet die Mehrfachauswahl
  useEffect(() => {
    if (!selectMode) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') exitSelectMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode]);

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

  // --- Mehrfachauswahl ---
  const enterSelectMode = (id) => {
    setSelectMode(true);
    setSelectedIds(id ? [id] : []);
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };
  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const deleteSelected = async () => {
    const ids = selectedIds;
    exitSelectMode();
    await deleteInboxItems(ids);
  };

  // Langdruck startet am Handy die Mehrfachauswahl (Bewegung > 8 px = Wischen, kein Langdruck)
  const pressRef = useRef({ timer: null, x: 0, y: 0 });
  const startPress = (e, id) => {
    if (selectMode) return;
    const t = e.touches[0];
    pressRef.current.x = t.clientX;
    pressRef.current.y = t.clientY;
    clearTimeout(pressRef.current.timer);
    pressRef.current.timer = setTimeout(() => {
      navigator.vibrate?.(15);
      enterSelectMode(id);
    }, LONG_PRESS_MS);
  };
  const movePress = (e) => {
    const t = e.touches[0];
    if (Math.hypot(t.clientX - pressRef.current.x, t.clientY - pressRef.current.y) > LONG_PRESS_MOVE_PX) {
      clearTimeout(pressRef.current.timer);
    }
  };
  const endPress = () => clearTimeout(pressRef.current.timer);

  const renderItemCard = (item, isOlder = false) => {
    const isExpanded = !!expandedItems[item.id];
    const isSelected = selectedIds.includes(item.id);
    const { title, body } = splitThought(item);
    // Original nur anbieten, wenn es sich vom Gezeigten unterscheidet
    const hasOriginal = Boolean(item.cleanText)
      || Boolean(item.originalText && flat(item.originalText) !== flat(item.summary) && flat(item.originalText) !== flat(item.title));
    const longBody = body.length > 170 || body.split('\n').length > 4;
    const titleLong = title.length > 90;
    const canExpand = longBody || hasOriginal || titleLong;

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
      <SwipeableCard
        key={item.id}
        className="mb-3 break-inside-avoid"
        disabled={selectMode}
        left={{ label: 'Papierkorb', icon: 'delete', className: 'bg-danger', dismiss: true, onCommit: () => deleteInboxItem(item.id) }}
      >
        <Card
          padding="none"
          tabIndex={0}
          data-thought-id={item.id}
          className={`group h-full flex flex-col transition-[box-shadow,border-color,opacity] duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            isOlder ? 'opacity-90' : ''
          } ${isSelected ? 'border-accent ring-2 ring-accent/30' : 'hover:border-primary/30'}`}
          onClick={selectMode ? () => toggleSelected(item.id) : undefined}
          onContextMenu={(e) => {
            if (selectMode) return;
            e.preventDefault();
            setMenuFor(item.id);
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              if (selectMode && selectedIds.length) deleteSelected();
              else deleteInboxItem(item.id);
            } else if (selectMode && (e.key === ' ' || e.key === 'Enter')) {
              e.preventDefault();
              toggleSelected(item.id);
            }
          }}
          onTouchStart={(e) => startPress(e, item.id)}
          onTouchMove={movePress}
          onTouchEnd={endPress}
          onTouchCancel={endPress}
        >
          {/* Kopf + Inhalt: Der Titel ist das Wichtigste */}
          <div className="relative flex-1 flex flex-col gap-2 px-4 pt-3.5 pb-3">
            {/* Auswahl (in der Mehrfachauswahl immer, am Desktop beim Darüberfahren) und Papierkorb */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label="Gedanke auswählen"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectMode) enterSelectMode(item.id);
                  else toggleSelected(item.id);
                }}
                className={`${selectMode ? 'flex' : 'hidden md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'} w-6 h-6 rounded-md border-2 items-center justify-center transition-colors cursor-pointer ${
                  isSelected ? 'bg-accent border-accent text-white' : 'border-outline-variant bg-white text-transparent hover:border-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check</span>
              </button>
              {!selectMode && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteInboxItem(item.id); }}
                  className="hidden md:flex w-7 h-7 items-center justify-center rounded-md text-on-surface-variant opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger hover:bg-danger-soft transition-[opacity,color,background-color] cursor-pointer"
                  title="In den Papierkorb"
                  aria-label="Gedanke in den Papierkorb"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>

            <h3 className={`text-base font-bold leading-snug text-primary pr-8 md:pr-16 ${isExpanded ? '' : 'line-clamp-2'}`}>{title}</h3>

            {body && (
              <div
                className={`text-sm leading-snug text-on-surface-variant ${
                  !isExpanded && longBody ? 'max-h-[5.75rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]' : ''
                }`}
              >
                <div className="markdown-body markdown-compact">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              </div>
            )}

            {targetBadgeLabel && (
              <div>
                <Badge variant="default">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{targetBadgeIcon}</span>
                  {targetBadgeLabel}
                </Badge>
              </div>
            )}

            {isExpanded && hasOriginal && (
              <div className="rounded-lg bg-surface-low px-3 py-2.5 text-sm leading-relaxed space-y-2">
                <p className="text-xs font-semibold text-on-surface-variant">{item.cleanText ? 'Bereinigter Text' : 'Original-Transkript'}</p>
                <div>{item.cleanText || item.originalText}</div>
                {item.cleanText && item.originalText && item.cleanText !== item.originalText && (
                  <details className="text-xs pt-2 border-t border-outline-variant">
                    <summary className="cursor-pointer font-semibold text-on-surface-variant hover:text-primary transition-colors">
                      Roh-Transkript anzeigen
                    </summary>
                    <div className="mt-2 text-sm leading-relaxed">{item.originalText}</div>
                  </details>
                )}
              </div>
            )}

            {canExpand && (
              <button
                type="button"
                className="self-start inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                aria-expanded={isExpanded}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                {isExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
              </button>
            )}
          </div>

          {/* Fußzeile: Zeit und Aktion, leicht getönt gibt der Karte Struktur */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-surface-low border-t border-outline-variant/70 rounded-b-xl">
            <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
              {dayLabel}, {createdFormattedStr}
            </span>
            {!selectMode && (
              <div onClick={(e) => e.stopPropagation()}>
                <ThoughtMenu
                  item={item}
                  open={menuFor === item.id}
                  onOpenChange={(v) => setMenuFor(v ? item.id : null)}
                  projects={activeProjects}
                  reminders={activeReminders}
                  onElaborate={handleElaborateWithFio}
                  onConvert={handleConvert}
                  onAttach={handleAttach}
                  onSelect={enterSelectMode}
                  onDelete={deleteInboxItem}
                />
              </div>
            )}
          </div>
        </Card>
      </SwipeableCard>
    );
  };

  const hasText = inputValue.trim().length > 0;
  const totalCount = currentNotes.length + sortedOlderNotes.length;

  return (
    <div className="screen-transition flex-1 flex flex-col gap-5 sm:gap-6 w-full mx-auto">
      {/* Kopfzeile: Titel oder – in der Mehrfachauswahl – die Aktionsleiste */}
      {selectMode ? (
        <header className="flex items-center justify-between gap-3 min-h-[44px] px-3 py-1.5 bg-white border border-outline-variant shadow-card rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={exitSelectMode} aria-label="Auswahl beenden" className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-low cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <span className="text-sm font-semibold truncate" aria-live="polite">
              {selectedIds.length === 0 ? 'Gedanken auswählen' : `${selectedIds.length} ausgewählt`}
            </span>
          </div>
          <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={selectedIds.length === 0}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
            Löschen
          </Button>
        </header>
      ) : (
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${area.chip}`} aria-hidden="true">
              <span className="material-symbols-outlined text-[22px]">lightbulb</span>
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Gedanken</h1>
              {totalCount > 0 && <p className="text-xs text-on-surface-variant">{totalCount} {totalCount === 1 ? 'Gedanke' : 'Gedanken'}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurrentScreen('trash')}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
            title="Papierkorb öffnen"
            aria-label="Papierkorb öffnen"
          >
            <span className="material-symbols-outlined text-[22px]">delete</span>
          </button>
        </header>
      )}

      {/* Eingabe: Desktop oben, Handy fest unten (Daumenzone) */}
      <section
        aria-label="Neuer Gedanke"
        className="order-last md:order-none sticky bottom-2 md:static z-10 md:z-auto"
      >
        <div className="bg-white rounded-xl border border-outline-variant shadow-raised md:shadow-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-shadow">
          <div className="flex items-end gap-2 p-1.5 pl-4 md:p-2 md:pl-4">
            <label htmlFor="thought-input" className="sr-only">Was geht dir durch den Kopf?</label>
            <textarea
              id="thought-input"
              ref={textareaRef}
              disabled={isSummarizing}
              placeholder={
                isSummarizing
                  ? 'KI fasst deinen Gedanken zusammen …'
                  : isListening
                  ? 'Zuhören aktiv … sprich so lange du möchtest'
                  : 'Was geht dir durch den Kopf?'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-1 min-w-0 border-0 bg-transparent px-0 py-2.5 text-base placeholder:text-on-surface-variant focus:ring-0 focus:outline-none resize-none overflow-y-auto min-h-[44px] md:min-h-[52px] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="md:hidden">
              <ThoughtAiChip
                variant="icon"
                enabled={isSummaryEnabled}
                onEnabledChange={(on) => setSummaryFlag(on ? 'on' : 'off')}
                length={summaryLength}
                onLengthChange={setSummaryLength}
                model={activeModel}
                onModelChange={setActiveModel}
              />
            </div>
            {(!hasText || isListening) ? (
              <button
                type="button"
                disabled={isSummarizing}
                onClick={toggleListening}
                className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
                  isListening ? 'bg-danger text-white animate-pulse motion-reduce:animate-none' : 'bg-accent text-white hover:bg-accent-hover'
                }`}
                title={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
                aria-label={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
                aria-pressed={isListening}
              >
                <span className="material-symbols-outlined text-[22px]">{isListening ? 'stop' : 'mic'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSummarizing}
                  onClick={toggleListening}
                  className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer disabled:opacity-50"
                  title="Spracheingabe starten"
                  aria-label="Spracheingabe starten"
                >
                  <span className="material-symbols-outlined text-[22px]">mic</span>
                </button>
                <Button onClick={handleAdd} loading={isSummarizing} size="icon" className="w-11 h-11 shrink-0" aria-label="Speichern" title="Speichern (Enter)">
                  {!isSummarizing && <span className="material-symbols-outlined text-[22px]">arrow_upward</span>}
                </Button>
              </>
            )}
          </div>
          <div className="hidden md:flex items-center justify-between gap-2 px-3 pb-2.5">
            <ThoughtAiChip
              variant="chip"
              enabled={isSummaryEnabled}
              onEnabledChange={(on) => setSummaryFlag(on ? 'on' : 'off')}
              length={summaryLength}
              onLengthChange={setSummaryLength}
              model={activeModel}
              onModelChange={setActiveModel}
            />
            <span className="text-xs text-on-surface-variant">Enter speichert · Shift+Enter neue Zeile</span>
          </div>
        </div>
      </section>

      {/* Liste */}
      {!hasCurrentNotes && sortedOlderNotes.length === 0 ? (
        <EmptyState className="flex-1 md:flex-none flex flex-col justify-center" icon="lightbulb" title="Halte deinen ersten Gedanken fest">
          Schreib oder sprich einfach drauflos. Sortiert wird später.
        </EmptyState>
      ) : (
        <div className="space-y-6 flex-1 md:flex-none">
          {hasCurrentNotes && (
            <section className="space-y-3" aria-label="Heute">
              <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <span>Heute</span>
                <span className="text-on-surface-variant font-medium">({currentNotes.length})</span>
              </h2>
              <div className="md:columns-2 2xl:columns-3 md:gap-3">
                {currentNotes.map((item) => renderItemCard(item, false))}
              </div>
            </section>
          )}

          {/* Ältere Gedanken: ohne heutige automatisch offen (die letzten 3), sonst zugeklappt */}
          {sortedOlderNotes.length > 0 && (
            <section className="space-y-3" aria-label="Ältere Gedanken">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 py-1 text-left select-none group cursor-pointer"
                onClick={toggleOlderSection}
                aria-expanded={isOlderOpen}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-transform duration-fast ${isOlderOpen ? 'rotate-90' : ''}`} aria-hidden="true">
                    chevron_right
                  </span>
                  <span className="text-sm font-bold text-primary">Ältere Gedanken</span>
                  <span className="text-sm text-on-surface-variant font-medium">({sortedOlderNotes.length})</span>
                </span>
                <span className="text-xs font-semibold text-on-surface-variant group-hover:text-primary">
                  {isOlderOpen ? 'Zuklappen' : 'Aufklappen'}
                </span>
              </button>

              {isOlderOpen && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="md:columns-2 2xl:columns-3 md:gap-3">
                    {visibleOlderNotes.map((item) => renderItemCard(item, true))}
                  </div>

                  {sortedOlderNotes.length > 3 && (
                    <div className="flex justify-center pt-1">
                      {showAllOlder ? (
                        <Button variant="secondary" size="sm" onClick={() => setShowAllOlder(false)}>
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">expand_less</span>
                          Weniger anzeigen (nur die letzten 3)
                        </Button>
                      ) : (
                        <Button variant="secondary" fullWidth onClick={() => setShowAllOlder(true)}>
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">expand_more</span>
                          Mehr anzeigen ({sortedOlderNotes.length - 3} weitere)
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default Inbox;
