import React, { useState, useRef, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { ensureBulletPoints } from '../../lib/gemini';
import { buildThought } from '../../lib/thoughts';
import { buildDraftSource, initialDraftFromThought } from '../../lib/projectDraft';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { usePersistedChoice } from '../../hooks/usePersistedChoice';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge, Button, Card, EmptyState, FOCUS, Icon, IconButton, Menu, MenuItem, MenuSeparator, PageHeader, SectionHeader, cx } from '../ds';
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

  const targets = view === 'project' ? projects : reminders;
  const close = () => onOpenChange(false);

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        trailingIcon="expand_more"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Weiterverarbeiten
      </Button>

      {open && (
        <Menu className="absolute right-0 top-full z-dropdown mt-1 max-h-80 w-72 overflow-y-auto">
          {view === 'main' ? (
            <>
              <MenuItem icon="auto_awesome" onClick={() => { close(); onElaborate(item); }}>Mit Fio ausarbeiten</MenuItem>
              <MenuItem icon="notifications" onClick={() => { close(); onConvert(item, 'reminder'); }}>Als neue Erinnerung</MenuItem>
              <MenuItem icon="create_new_folder" onClick={() => { close(); onConvert(item, 'project'); }}>Als neues Projekt</MenuItem>
              <MenuSeparator />
              <MenuItem icon="library_add" onClick={() => setView('project')}>An Projekt anhängen</MenuItem>
              <MenuItem icon="add_alert" onClick={() => setView('reminder')}>An Erinnerung anhängen</MenuItem>
              <MenuSeparator />
              <MenuItem icon="check_circle" onClick={() => { close(); onSelect(item.id); }}>Auswählen</MenuItem>
              <MenuItem icon="delete" danger onClick={() => { close(); onDelete(item.id); }}>In den Papierkorb</MenuItem>
            </>
          ) : (
            <>
              <MenuItem icon="arrow_back" onClick={() => setView('main')}>
                {view === 'project' ? 'Projekt wählen' : 'Erinnerung wählen'}
              </MenuItem>
              <MenuSeparator />
              {targets.length === 0 ? (
                <p className="px-2.5 py-2 text-caption text-secondary">
                  Keine aktiven {view === 'project' ? 'Projekte' : 'Erinnerungen'} gefunden.
                </p>
              ) : targets.map((t) => (
                <MenuItem
                  key={t.id}
                  icon={view === 'project' ? 'folder' : 'notifications'}
                  onClick={() => {
                    close();
                    onAttach(item, view, t.id);
                  }}
                >
                  {t.title}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
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
          className={cx(
            'group flex h-full flex-col transition-[box-shadow,border-color,opacity] duration-fast',
            FOCUS,
            isOlder && 'opacity-90',
            isSelected ? 'border-accent ring-2 ring-focus' : 'hover:border-default',
          )}
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
                className={cx(
                  selectMode ? 'flex' : 'hidden md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
                  'h-6 w-6 items-center justify-center rounded-xs border-2 transition-colors duration-fast',
                  FOCUS,
                  isSelected ? 'border-accent bg-accent text-on-accent' : 'border-control bg-surface text-transparent hover:border-strong',
                )}
              >
                <Icon name="check" size="sm" aria-hidden="true" />
              </button>
              {!selectMode && (
                <IconButton
                  icon="delete"
                  label="Gedanke in den Papierkorb"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); deleteInboxItem(item.id); }}
                  className="hidden opacity-0 hover:!bg-danger-subtle hover:!text-danger focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
                />
              )}
            </div>

            <h3 className={`text-subheading leading-snug text-primary pr-8 md:pr-16 ${isExpanded ? '' : 'line-clamp-2'}`}>{title}</h3>

            {body && (
              <div
                className={`text-body leading-snug text-secondary ${
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
                <Badge tone="neutral">
                  <Icon name={targetBadgeIcon} size="sm" aria-hidden="true" />
                  {targetBadgeLabel}
                </Badge>
              </div>
            )}

            {isExpanded && hasOriginal && (
              <div className="rounded-md bg-subtle px-3 py-2.5 text-body leading-relaxed space-y-2">
                <p className="text-caption-strong text-secondary">{item.cleanText ? 'Bereinigter Text' : 'Original-Transkript'}</p>
                <div>{item.cleanText || item.originalText}</div>
                {item.cleanText && item.originalText && item.cleanText !== item.originalText && (
                  <details className="text-caption pt-2 border-t border-subtle">
                    <summary className="cursor-pointer font-semibold text-secondary hover:text-primary transition-colors">
                      Roh-Transkript anzeigen
                    </summary>
                    <div className="mt-2 text-body leading-relaxed">{item.originalText}</div>
                  </details>
                )}
              </div>
            )}

            {canExpand && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={isExpanded ? 'expand_less' : 'expand_more'}
                className="-ml-3 self-start"
                onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                aria-expanded={isExpanded}
              >
                {isExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
              </Button>
            )}
          </div>

          {/* Fußzeile: Zeit und Aktion, leicht getönt gibt der Karte Struktur */}
          <div className="flex items-center justify-between gap-2 rounded-b-lg border-t border-subtle bg-subtle px-4 py-2">
            <span className="inline-flex items-center gap-1 text-caption text-secondary">
              <Icon name="schedule" size="sm" aria-hidden="true" />
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
    <div className="flex w-full flex-1 flex-col gap-5 md:gap-6">
      {/* Kopfzeile: Titel oder – in der Mehrfachauswahl – die Aktionsleiste */}
      {selectMode ? (
        <header className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-subtle bg-surface px-3 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton icon="close" label="Auswahl beenden" onClick={exitSelectMode} />
            <span className="truncate text-body-strong" aria-live="polite">
              {selectedIds.length === 0 ? 'Gedanken auswählen' : `${selectedIds.length} ausgewählt`}
            </span>
          </div>
          <Button variant="danger" size="sm" leadingIcon="delete" onClick={deleteSelected} disabled={selectedIds.length === 0}>
            Löschen
          </Button>
        </header>
      ) : (
        <PageHeader
          title="Gedanken"
          description={totalCount > 0 ? `${totalCount} ${totalCount === 1 ? 'Gedanke' : 'Gedanken'}` : 'Festhalten, sortiert wird später.'}
          className="md:items-center"
          actions={(
            <IconButton icon="delete" label="Papierkorb öffnen" onClick={() => setCurrentScreen('trash')} className="hover:text-danger" />
          )}
        />
      )}

      {/* Eingabe: Desktop oben, Handy fest unten (Daumenzone) */}
      <section
        aria-label="Neuer Gedanke"
        className="sticky bottom-2 z-10 order-last md:static md:order-none"
      >
        <div className="rounded-lg border border-subtle bg-surface shadow-md transition-shadow duration-fast focus-within:border-accent focus-within:ring-2 focus-within:ring-focus md:shadow-sm">
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
              className="min-h-12 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 py-3 text-body-lg placeholder:text-tertiary focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[52px]"
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
              <IconButton
                variant={isListening ? 'danger' : 'primary'}
                size="lg"
                icon={isListening ? 'stop' : 'mic'}
                label={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
                disabled={isSummarizing}
                onClick={toggleListening}
                aria-pressed={isListening}
                className={isListening ? 'animate-pulse motion-reduce:animate-none' : undefined}
              />
            ) : (
              <>
                <IconButton
                  variant="secondary"
                  size="lg"
                  icon="mic"
                  label="Spracheingabe starten"
                  disabled={isSummarizing}
                  onClick={toggleListening}
                />
                <IconButton
                  variant="primary"
                  size="lg"
                  icon="arrow_upward"
                  label="Speichern (Enter)"
                  loading={isSummarizing}
                  onClick={handleAdd}
                />
              </>
            )}
          </div>
          <div className="hidden items-center justify-between gap-2 px-3 pb-2.5 md:flex">
            <ThoughtAiChip
              variant="chip"
              enabled={isSummaryEnabled}
              onEnabledChange={(on) => setSummaryFlag(on ? 'on' : 'off')}
              length={summaryLength}
              onLengthChange={setSummaryLength}
              model={activeModel}
              onModelChange={setActiveModel}
            />
            <span className="text-caption text-tertiary">Enter speichert · Shift+Enter neue Zeile</span>
          </div>
        </div>
      </section>

      {/* Liste */}
      {!hasCurrentNotes && sortedOlderNotes.length === 0 ? (
        <EmptyState
          className="flex flex-1 flex-col justify-center md:flex-none"
          icon="lightbulb"
          title="Halte deinen ersten Gedanken fest"
          description="Schreib oder sprich einfach drauflos. Sortiert wird später."
        />
      ) : (
        <div className="flex-1 space-y-6 md:flex-none">
          {hasCurrentNotes && (
            <section className="space-y-3" aria-label="Heute">
              <SectionHeader title="Heute" count={currentNotes.length} />
              <div className="md:columns-2 md:gap-3">
                {currentNotes.map((item) => renderItemCard(item, false))}
              </div>
            </section>
          )}

          {/* Ältere Gedanken: ohne heutige automatisch offen (die letzten 3), sonst zugeklappt */}
          {sortedOlderNotes.length > 0 && (
            <section className="space-y-3" aria-label="Ältere Gedanken">
              <SectionHeader
                title="Ältere Gedanken"
                count={sortedOlderNotes.length}
                action={(
                  <Button
                    variant="ghost"
                    size="sm"
                    trailingIcon={isOlderOpen ? 'expand_less' : 'expand_more'}
                    onClick={toggleOlderSection}
                    aria-expanded={isOlderOpen}
                  >
                    {isOlderOpen ? 'Zuklappen' : 'Aufklappen'}
                  </Button>
                )}
              />

              {isOlderOpen && (
                <div className="space-y-3">
                  <div className="md:columns-2 md:gap-3">
                    {visibleOlderNotes.map((item) => renderItemCard(item, true))}
                  </div>

                  {sortedOlderNotes.length > 3 && (
                    <div className="flex justify-center pt-1">
                      {showAllOlder ? (
                        <Button variant="secondary" size="sm" leadingIcon="expand_less" onClick={() => setShowAllOlder(false)}>
                          Weniger anzeigen (nur die letzten 3)
                        </Button>
                      ) : (
                        <Button variant="secondary" fullWidth leadingIcon="expand_more" onClick={() => setShowAllOlder(true)}>
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
