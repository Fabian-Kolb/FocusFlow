import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { askGeminiCoach } from '../../lib/gemini';
import { ACTION_ENGINE_SYSTEM_PROMPT, parseAiActions, executeAiActions, parseIntentChoice } from '../../lib/aiActionEngine';
import { fetchCalendarEvents } from '../../lib/calendarAPI';
import { notify } from '../../lib/notify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ModelSelectorDropdown from '../ui/ModelSelectorDropdown';
import ProjectDraftCard from '../ui/ProjectDraftCard';
import { reviseDraftWithFio, draftToProjectData, clearNewFlags, DETAIL_LEVELS } from '../../lib/projectDraft';
import { Avatar, Button, Card, Dialog, FOCUS, Icon, IconButton, IconTile, Input, SectionHeader, Spinner, cx } from '../ds';

const statusLabel = (s) => {
  const v = s || 'AKTIV';
  return v.charAt(0) + v.slice(1).toLowerCase();
};
const projectMeta = (p) => `${p.progress || 0}% abgeschlossen · ${p.phases?.length || 0} Abschnitte`;
const reminderMeta = (r) => `${r.date || 'Kein Termin'}${r.time ? ` · ${r.time} Uhr` : ''} · ${statusLabel(r.status)}`;
const ATTACHMENT_ICONS = { project: 'folder', reminder: 'notifications' };

/** Auswahlzeile in den Kontext-/Filter-Dialogen. `multi`: Kästchen (mehrere wählbar), sonst Haken (genau eine). */
function PickRow({ icon, area = 'neutral', title, meta, selected, multi = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-fast',
        FOCUS,
        selected ? 'border-accent bg-selected' : 'border-subtle bg-surface hover:border-default hover:bg-hover'
      )}
    >
      <IconTile area={area} icon={icon} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-strong text-primary">{title}</span>
        {meta && <span className="block truncate text-caption text-secondary">{meta}</span>}
      </span>
      {multi ? (
        <span
          aria-hidden="true"
          className={cx(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs border',
            selected ? 'border-transparent bg-accent text-on-accent' : 'border-control bg-surface'
          )}
        >
          {selected && <Icon name="check" size="sm" />}
        </span>
      ) : (
        selected && <Icon name="check" size="md" className="shrink-0 text-accent" />
      )}
    </button>
  );
}

/** Gruppe von Auswahlzeilen mit Überschrift und „Mehr anzeigen“ */
function PickSection({ title, count, hiddenCount = 0, expanded, onToggle, children }) {
  return (
    <section className="space-y-2">
      <SectionHeader title={title} count={count} />
      {children}
      {hiddenCount > 0 && (
        <Button variant="ghost" size="sm" fullWidth trailingIcon={expanded ? 'expand_less' : 'expand_more'} onClick={onToggle}>
          {expanded ? 'Weniger anzeigen' : `Mehr anzeigen (${hiddenCount} weitere)`}
        </Button>
      )}
    </section>
  );
}

function SearchField({ value, onChange, placeholder, label, autoFocus = false }) {
  return (
    <Input
      leadingIcon="search"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-autofocus={autoFocus ? '' : undefined}
      trailing={value ? <IconButton icon="close" size="sm" label="Suche leeren" onClick={() => onChange('')} /> : null}
    />
  );
}

/** Kontext-Anhang als kleine Marke; mit `onRemove` entfernbar */
function AttachmentChip({ att, onRemove }) {
  return (
    <span className={cx('inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-subtle bg-subtle text-caption-strong text-primary', onRemove ? 'pl-2 pr-1' : 'px-2')}>
      <Icon name={ATTACHMENT_ICONS[att.type] || 'calendar_month'} size="sm" className="shrink-0 text-secondary" />
      <span className="max-w-[160px] truncate">{att.title}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={`${att.title} entfernen`}
          aria-label={`${att.title} entfernen`}
          className={cx('flex h-5 w-5 items-center justify-center rounded-xs text-secondary transition-colors duration-fast hover:text-danger', FOCUS)}
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </span>
  );
}

const Coach = ({ setCurrentScreen }) => {
  const modalContext = useModalContext();
  const { projects, reminders = [], setSelectedProjectId, setSelectedReminderId, isCalendarConnected, openModal, addProject, projectCategories = [] } = modalContext;
  const { user } = useAuth();
  const {
    sessions,
    activeSession,
    activeSessionId,
    activeModel,
    setActiveModel,
    createNewSession,
    selectSession,
    deleteSession,
    addMessageToSession,
    removeSessionAttachment,
    updateStreamingMessage,
    updateSessionDraft,
    queuedPrompt,
    takeQueuedPrompt
  } = useChat();

  // Entwurfs-Chat "Projektanlegung: …"
  const isDraftSession = activeSession?.contextScope === 'draft';
  const draftAwaitingDetail = isDraftSession && !!activeSession.draftAwaitingDetail;
  const draftOpen = isDraftSession && activeSession.draftStatus === 'open' && !draftAwaitingDetail;

  const [isHistoryOpen, setIsHistoryOpen] = useState(() => {
    const saved = localStorage.getItem('focusflow_coach_history');
    if (saved !== null) return JSON.parse(saved);
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    localStorage.setItem('focusflow_coach_history', JSON.stringify(isHistoryOpen));
  }, [isHistoryOpen]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionSearchText, setSessionSearchText] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    if (!isCalendarConnected || user?.isGuest) return;
    const now = new Date();
    // Vorzugsweise gesamte anstehende Terminspanne laden, Fallback auf aktuellen Monat
    fetchCalendarEvents()
      .then((events) => {
        setCalendarEvents(events || []);
      })
      .catch(() => {
        fetchCalendarEvents(now.getFullYear(), now.getMonth())
          .then((events) => {
            setCalendarEvents(events || []);
          })
          .catch((err) => {
            console.warn('Konnte Kalenderevents für Fio-Kontext nicht laden:', err);
          });
      });
  }, [isCalendarConnected, user?.isGuest]);

  // 1. SIDEBAR FILTER & SEARCH (Filtert die Chatverlauf-Liste auf der linken Seite)
  const [isSidebarFilterModalOpen, setIsSidebarFilterModalOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarScopeFilter, setSidebarScopeFilter] = useState('all'); // 'all' | 'general' | projectId | reminderId
  const [showAllSidebarProjects, setShowAllSidebarProjects] = useState(false);
  const [showAllSidebarReminders, setShowAllSidebarReminders] = useState(false);

  // 2. KI-KONTEXT & ANHÄNGE (Wählt aus, welche Daten der KI als Kontext übergeben werden)
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [contextModalSearch, setContextModalSearch] = useState('');
  const [isAllContextSelected, setIsAllContextSelected] = useState(true);
  const [isGeneralOnlySelected, setIsGeneralOnlySelected] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedReminderIds, setSelectedReminderIds] = useState([]);
  const [isCalendarContextSelected, setIsCalendarContextSelected] = useState(false);
  const [selectedCalendarEventIds, setSelectedCalendarEventIds] = useState([]);
  const [showAllContextProjects, setShowAllContextProjects] = useState(false);
  const [showAllContextReminders, setShowAllContextReminders] = useState(false);
  const [showAllContextCalendar, setShowAllContextCalendar] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const handleToggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify('Spracheingabe wird in diesem Browser nicht unterstützt. Nutze Chrome, Edge oder Safari.', 'mic_off');
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

  // Selected context attachments list for the current prompt (queued in input bar)
  const activeAttachments = useMemo(() => {
    if (isGeneralOnlySelected || isAllContextSelected) return [];
    const list = [];
    if (isCalendarContextSelected) {
      list.push({ type: 'calendar', id: 'calendar', title: 'Kalender und Termine' });
    }
    selectedCalendarEventIds.forEach((eid) => {
      const evt = (calendarEvents || []).find((item) => item.id === eid);
      if (evt) list.push({ type: 'calendar_event', id: evt.id, title: evt.summary || 'Termin' });
    });
    selectedProjectIds.forEach((pid) => {
      const p = projects.find((item) => item.id === pid);
      if (p) list.push({ type: 'project', id: p.id, title: p.title });
    });
    selectedReminderIds.forEach((rid) => {
      const r = reminders.find((item) => item.id === rid);
      if (r) list.push({ type: 'reminder', id: r.id, title: r.title });
    });
    return list;
  }, [isGeneralOnlySelected, isAllContextSelected, isCalendarContextSelected, selectedCalendarEventIds, selectedProjectIds, selectedReminderIds, calendarEvents, projects, reminders]);

  const hasCustomContext = useMemo(() => {
    return isGeneralOnlySelected || (!isAllContextSelected && (selectedProjectIds.length > 0 || selectedReminderIds.length > 0 || isCalendarContextSelected || selectedCalendarEventIds.length > 0));
  }, [isGeneralOnlySelected, isAllContextSelected, selectedProjectIds, selectedReminderIds, isCalendarContextSelected, selectedCalendarEventIds]);

  const totalActiveCustomCount = useMemo(() => {
    if (isGeneralOnlySelected) return 1;
    return selectedProjectIds.length + selectedReminderIds.length + (isCalendarContextSelected ? 1 : selectedCalendarEventIds.length);
  }, [isGeneralOnlySelected, selectedProjectIds, selectedReminderIds, isCalendarContextSelected, selectedCalendarEventIds]);

  // Build Multi-Context Grounded System Instruction for Gemini
  const buildSystemInstruction = (specificAttachments) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const pad2 = (n) => String(n).padStart(2, '0');
    const todayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowKey = `${tomorrowDate.getFullYear()}-${pad2(tomorrowDate.getMonth() + 1)}-${pad2(tomorrowDate.getDate())}`;

    // Kalendertermine formatieren und nach Tagen aufteilen
    const formatEventItem = (e) => {
      const rawStart = e.start?.dateTime || e.start?.date || '';
      const rawEnd = e.end?.dateTime || e.end?.date || '';
      const isAllDay = !e.start?.dateTime && Boolean(e.start?.date);

      let eventDateKey = '';
      let timeFormatted = isAllDay ? 'Ganztägig' : '';

      if (rawStart) {
        if (rawStart.includes('T')) {
          const d = new Date(rawStart);
          eventDateKey = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          timeFormatted = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          if (rawEnd && rawEnd.includes('T')) {
            const endD = new Date(rawEnd);
            timeFormatted += ` - ${endD.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
          } else {
            timeFormatted += ' Uhr';
          }
        } else {
          eventDateKey = rawStart; // YYYY-MM-DD
        }
      }

      return {
        id: e.id,
        titel: e.summary || e.title || 'Unbenannter Termin',
        beschreibung: e.description || '',
        uhrzeit: timeFormatted,
        datum: eventDateKey,
        istHeute: eventDateKey === todayKey,
        istMorgen: eventDateKey === tomorrowKey
      };
    };

    const sessionContexts = activeSession?.contextAttachments || [];
    const msgContexts = specificAttachments || activeAttachments || [];
    const allContexts = [...sessionContexts];
    msgContexts.forEach(c => {
      if (!allContexts.some(item => item.id === c.id && item.type === c.type)) {
        allContexts.push(c);
      }
    });

    const hasCalendarInContext = allContexts.some(a => a.type === 'calendar' || a.type === 'calendar_event');
    const specificCalIds = allContexts.filter(a => a.type === 'calendar_event').map(a => a.id);
    const projIds = allContexts.filter(a => a.type === 'project').map(a => a.id);
    const remIds = allContexts.filter(a => a.type === 'reminder').map(a => a.id);

    const relevantCalendarEvents = (allContexts.length > 0 && !hasCalendarInContext && (projIds.length > 0 || remIds.length > 0))
      ? []
      : (specificCalIds.length > 0 ? (calendarEvents || []).filter(e => specificCalIds.includes(e.id)) : (calendarEvents || []));

    const parsedCalendarEvents = relevantCalendarEvents.map(formatEventItem);
    const termineHeute = parsedCalendarEvents.filter(e => e.istHeute);
    const termineMorgen = parsedCalendarEvents.filter(e => e.istMorgen);
    const weitereTermine = parsedCalendarEvents.filter(e => !e.istHeute && !e.istMorgen).slice(0, 5);

    // Erinnerungen formatieren und Fälligkeiten prüfen
    const formatReminderItem = (r) => {
      let isToday = false;
      let isTomorrow = false;
      let isOverdue = false;
      if (r.date) {
        let rKey = r.date;
        if (r.date.includes('.')) {
          const parts = r.date.split('.');
          if (parts.length === 3) {
            const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            rKey = `${yr}-${pad2(parts[1])}-${pad2(parts[0])}`;
          }
        }
        if (rKey === todayKey) isToday = true;
        else if (rKey === tomorrowKey) isTomorrow = true;
        else if (rKey < todayKey && r.status === 'AKTIV') isOverdue = true;
      }
      return {
        id: r.id,
        titel: r.title,
        beschreibung: r.description || '',
        datum: r.date || 'Kein Termin',
        uhrzeit: r.time ? `${r.time} Uhr` : '',
        prioritaet: r.priority || 'mittel',
        status: r.status || 'AKTIV',
        istHeute: isToday,
        istMorgen: isTomorrow,
        istUeberfaellig: isOverdue,
        notizen: (r.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content }))
      };
    };

    let contextData = {
      heutigesDatum: `${dateStr}, ${timeStr} Uhr`,
      datumHeuteIso: todayKey,
      datumMorgenIso: tomorrowKey
    };

    let contextMetaGuidance = '';

    if (allContexts.length > 0) {
      const chosenProjects = projects.filter((p) => projIds.includes(p.id));
      const chosenReminders = reminders.filter((r) => remIds.includes(r.id));
      const focusTitles = [
        ...chosenProjects.map(p => p.title),
        ...chosenReminders.map(r => r.title),
        ...(hasCalendarInContext ? ['Kalender & Termine'] : [])
      ].join(', ');

      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat für dieses Gespräch gezielt folgenden Fokus gewählt: [${focusTitles || 'Spezifischer Fokus'}].
Er möchte sich in dieser Konversation besonders auf diese Themen konzentrieren.
- Antworte sofort präzise auf den Punkt, ohne Floskeln wie „Ich sehe, du hast X gewählt“.
- Verknüpfe diese Elemente mit dem heutigen Tag und der Zeitplanung.
`;

      contextData = {
        ...contextData,
        fokus: 'Spezifisch ausgewählte Elemente',
        projekte: chosenProjects.map((p) => ({
          id: p.id,
          titel: p.title,
          beschreibung: p.description || '',
          zeitraum: `${p.startDate || 'Start offen'} bis ${p.endDate || 'Ende offen'}`,
          fortschritt: `${p.progress || 0}%`,
          notizen: (p.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content })),
          abschnitte: (p.phases || []).map((ph) => ({
            id: ph.id,
            titel: ph.title,
            zeitraum: ph.dateInfo || '',
            materialien: (ph.materials || []).map(m => ({ id: m.id, name: m.name, typ: m.type, url: m.url })),
            aufgaben: (ph.tasks || []).map((t) => ({
              id: t.id,
              titel: t.title,
              erledigt: !!t.completed,
              termin: t.date || 'Kein Termin',
              notiz: t.note || ''
            }))
          }))
        })),
        erinnerungen: chosenReminders.map(formatReminderItem)
      };
    } else if (isGeneralOnlySelected) {
      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat den allgemeinen Coach-Modus gewählt (ohne spezifische Projektdaten).
Antworte als erfahrener Produktivitätsberater und Zeitmanagement-Experte mit bewährten Methoden.
`;
      contextData = {
        ...contextData,
        fokus: 'Allgemeiner Coach (Freies Gespräch)'
      };
    } else {
      contextMetaGuidance = `
HINTERGRUNDWISSEN ZUM AKTIVEN KONTEXT:
Der Nutzer hat dir den vollen Überblick über seinen gesamten Arbeitsbereich zur Verfügung gestellt (Kalender, Erinnerungen & Projekte).
Nutze diesen 360-Grad-Blick für ganzheitliche, harmonische Empfehlungen.
`;
      contextData = {
        ...contextData,
        fokus: 'Alle Daten (Kalender, Erinnerungen & Projekte)',
        projekte: projects.map((p) => ({
          id: p.id,
          titel: p.title,
          beschreibung: p.description || '',
          zeitraum: `${p.startDate || 'Start offen'} bis ${p.endDate || 'Ende offen'}`,
          fortschritt: `${p.progress || 0}%`,
          notizen: (p.notes || []).map(n => ({ id: n.id, titel: n.title, inhalt: n.content })),
          abschnitte: (p.phases || []).map((ph) => ({
            id: ph.id,
            titel: ph.title,
            zeitraum: ph.dateInfo || '',
            materialien: (ph.materials || []).map(m => ({ id: m.id, name: m.name, typ: m.type, url: m.url })),
            aufgaben: (ph.tasks || []).map((t) => ({
              id: t.id,
              titel: t.title,
              erledigt: !!t.completed,
              termin: t.date || 'Kein Termin',
              notiz: t.note || ''
            }))
          }))
        })),
        erinnerungen: reminders.map(formatReminderItem)
      };
    }

    // Die Drei Säulen kompakt zusammengefasst für schnelle, präzise Antworten
    const allFormattedReminders = reminders.map(formatReminderItem);
    const activeProjects = projects.filter(p => !p.deletedAt && p.status === 'AKTIV');

    contextData.dreiSaeulen = {
      kalender: {
        verbunden: !!isCalendarConnected,
        gastmodus: !!user?.isGuest,
        termineHeute: termineHeute.map(t => ({ titel: t.titel, zeit: t.uhrzeit, details: t.beschreibung })),
        termineMorgen: termineMorgen.map(t => ({ titel: t.titel, zeit: t.uhrzeit, details: t.beschreibung })),
        weitereTermineDieseWoche: weitereTermine.map(t => ({ datum: t.datum, titel: t.titel, zeit: t.uhrzeit })),
        morgigerVorbereitungsCheck: termineMorgen.length > 0
          ? `WICHTIGER HINWEIS: Morgen stehen ${termineMorgen.length} Termin(e) im Kalender: ${termineMorgen.map(t => `"${t.titel}" (${t.uhrzeit})`).join(', ')}. Prüfe aktiv, ob dazu bereits Aufgaben existieren oder ob noch Vorbereitung nötig ist!`
          : 'Keine Kalendertermine für morgen eingetragen.'
      },
      erinnerungen: {
        heuteFaellig: allFormattedReminders.filter(r => r.istHeute && r.status === 'AKTIV').map(r => ({ id: r.id, titel: r.titel, zeit: r.uhrzeit, prio: r.prioritaet })),
        ueberfaellig: allFormattedReminders.filter(r => r.istUeberfaellig).map(r => ({ id: r.id, titel: r.titel, datum: r.datum })),
        morgenFaellig: allFormattedReminders.filter(r => r.istMorgen && r.status === 'AKTIV').map(r => ({ id: r.id, titel: r.titel, zeit: r.uhrzeit }))
      },
      aktiveProjekte: activeProjects.map(p => {
        // Nächste unerledigte Aufgaben finden
        const pendingTasks = [];
        (p.phases || []).forEach(ph => {
          (ph.tasks || []).forEach(t => {
            if (!t.completed && pendingTasks.length < 3) {
              pendingTasks.push({ aufgabe: t.title, abschnitt: ph.title, termin: t.date || '' });
            }
          });
        });
        return {
          id: p.id,
          titel: p.title,
          fortschritt: `${p.progress || 0}%`,
          naechsteSchritte: pendingTasks
        };
      })
    };

    return `
Du bist der FocusFlow AI Coach (Fio), ein hochkompetenter, empathischer und pragmatischer Produktivitäts-Assistent.
Deine Mission ist es, dem Nutzer zu helfen, seinen Tag mit maximalem Fokus, Klarheit ohne Stress meistern.

DAS DREI-SÄULEN-SYSTEM VON FOCUSFLOW:
 basiert auf DREI gleichwertigen, zentralen Säulen:
1. Kalender: Feste Termine, feste Uhrzeiten heute Vorbereitung für anstehende Termine morgen.
2. Erinnerungen: Zeitkritische To-Dos, Fristen Prioritäten den heutigen Tag.
3. Projekte: Strategischer Fortschritt – welcher konkrete nächste Schritt im wichtigsten Vorhaben bringt größten Hebel?

WICHTIGE VERHALTENSREGELN FÜR TAGESFRAGEN (z. B. „Was sollte ich noch machen?“, steht an?“, „Tagesplan“):
 PRÄZISION STATT REIZÜBERFLUTUNG (WENIGER IST MEHR):
   - Wenn nach seinem oder Empfehlungen fragt: Schütte ihn NIEMALS einer endlosen Liste aller Projekte Aufgaben zu! Keine Textwüsten.
 Gib WENIGER, aber dafür PRÄZISER aus: Wähle maximal 2 bis 3 konkrete, hochrelevante Fokus-Punkte aus.
 Strukturiere übersichtlich, ansprechend und sofort scannbar mit schlichten Zwischenüberschriften (Verwende keine Emojis):
     • Kalender-Check: Heutige + kurzer Blick morgen (insb. wenn nötig ist).
  Fokus-Erinnerung: Maximal 1 (höchstens 2) überfällige fällige Erinnerungen.
  Projekt-Fokus: Genau wichtigster nächster aus aktivsten bzw. Projekt (nicht 5 gleichzeitig).

 PROAKTIVER KALENDER- & MORGIGER VORBEREITUNGS-CHECK:
 Der Kalender genauso wichtig wie Erinnerungen beziehe immer aktiv ein!
  heute: Berücksichtige die Tagesstruktur.
  morgen: Untersuche ganz gezielt, ob stehen Meeting, Präsentation, Kundentermin, Arzt, Deadline, Abgabe).
 Vorbereitungs-Check: Prüfe, in Projekten bereits dazu vorbereitet wurden gar nichts gemacht wurde.
   einen morgigen Termin wurde: Weise kurz aufmerksam darauf hin B.: „Kalender-Hinweis hast um 10:00 Uhr ‚Meeting X‘. Da keine hinterlegt ist: Sollen wir 20 Minuten einplanen, Unterlagen vorzubereiten?“).

 IMMER MIT EINER PROAKTIVEN RÜCKFRAGE ABSCHLIESSEN:
 Beende deine Antwort genau konkreten, motivierenden Rückfrage bezüglich des vorgeschlagenen Projekts, nächsten Schritts Kalendertermins „Möchtest du, dass direkt [Aufgabe X] [Y] starten, soll dir Teilaufgaben anlegen?“ „Sollen [Z] eine kurze Vorbereitungs-Erinnerung einstellen?“).
 So kann Chat antworten ins Detail gehen, überlegen müssen.

${contextMetaGuidance}

${ACTION_ENGINE_SYSTEM_PROMPT}

AKTUELLE DATEN AUS FOCUSFLOW:
${JSON.stringify(contextData, null, 2)}
`;
  };

  // Dynamic quick prompts
  const getQuickPrompts = () => {
    if (draftAwaitingDetail) return [];
    if (draftOpen) {
      return [
        { id: 'dp_1', label: 'Feiner aufteilen', promptText: 'Teile die Abschnitte feiner in kleinere Aufgaben auf.' },
        { id: 'dp_2', label: 'Termine vorschlagen', promptText: 'Schlage sinnvolle Termine für die Abschnitte vor.' },
        { id: 'dp_3', label: 'Kürzer fassen', promptText: 'Fasse den Entwurf auf die wichtigsten Abschnitte und Aufgaben zusammen.' }
      ];
    }
    return [
      { id: 'qp_1', label: 'Was heute tun?', promptText: 'Was sollte ich heute noch machen? Gib mir einen kurzen, präzisen Fokus aus Kalender, Erinnerungen und Projekten.' },
      { id: 'qp_2', label: 'Engpässe und Termine', promptText: 'Welche anstehenden Termine (heute & morgen), Erinnerungen oder Aufgaben benötigen meine Aufmerksamkeit?' },
      { id: 'qp_3', label: 'Ziele priorisieren', promptText: 'Was ist der wichtigste nächste Schritt für heute?' }
    ];
  };

  const dynamicPrompts = getQuickPrompts();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const messages = activeSession?.messages || [];

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleNewChat = () => {
    createNewSession({
      contextScope: 'general',
      contextId: null,
      contextTitle: 'Allgemein',
      contextAttachments: [],
      model: activeModel,
      initialTitle: 'Neues Gespräch'
    });
  };

  const abortControllerRef = useRef(null);
  const currentBotMsgIdRef = useRef(null);
  const currentBotSessionIdRef = useRef(null);
  const generationRef = useRef(0);

  const handleStopGeneration = () => {
    generationRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    if (currentBotMsgIdRef.current && currentBotSessionIdRef.current) {
      updateStreamingMessage(
        currentBotSessionIdRef.current,
        currentBotMsgIdRef.current,
        undefined,
        false,
        null,
        { cancelled: true }
      );
    }
  };

  useEffect(() => () => {
    generationRef.current += 1;
    abortControllerRef.current?.abort();
    if (currentBotMsgIdRef.current && currentBotSessionIdRef.current) {
      updateStreamingMessage(
        currentBotSessionIdRef.current,
        currentBotMsgIdRef.current,
        undefined,
        false,
        null,
        { cancelled: true }
      );
    }
  }, [updateStreamingMessage]);

  // Vorgemerkte Nachricht (Apps-Menü "Frag Fio …") in einem leeren Gespräch abschicken.
  // Ist das aktive Gespräch nicht leer, einmalig ein neues anlegen und warten, bis es aktiv ist.
  const freshSessionRequestedForRef = useRef(null);
  useEffect(() => {
    if (!queuedPrompt || loading) return;
    if (activeSession.messages.length > 0) {
      if (freshSessionRequestedForRef.current !== activeSession.id) {
        freshSessionRequestedForRef.current = activeSession.id;
        createNewSession();
      }
      return;
    }
    const text = takeQueuedPrompt();
    if (!text) return;
    freshSessionRequestedForRef.current = null;
    handleSendMessage(text);
    // handleSendMessage ändert sich jeden Render; ausgelöst wird nur durch neue Nachricht bzw. neues Gespräch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedPrompt, activeSession.id, loading]);

  // --- Projekt-Entwurf (Chat "Projektanlegung: …") ---
  const confirmDraft = async (session = activeSession) => {
    const draft = session.draft;
    if (!draft?.title?.trim() || session.draftStatus !== 'open') return;
    // Sofort sperren, damit ein Doppelklick kein zweites Projekt anlegt
    updateSessionDraft(session.id, draft, { extra: { draftStatus: 'confirming' } });
    const newId = await addProject(draftToProjectData(draft, session.draftSource));
    if (!newId) {
      updateSessionDraft(session.id, draft, { extra: { draftStatus: 'open' } });
      return;
    }
    updateSessionDraft(session.id, clearNewFlags(draft), { label: 'Angelegt', extra: { draftStatus: 'confirmed' } });
    const taskTotal = draft.phases.reduce((n, p) => n + p.tasks.length, 0);
    // Sichtbare Quittung: Aktionskarte mit Link zum neuen Projekt
    const receiptId = `msg_${Date.now()}_r`;
    addMessageToSession(session.id, { id: receiptId, role: 'assistant', content: 'Das Projekt ist angelegt.', isStreaming: true });
    updateStreamingMessage(session.id, receiptId, 'Das Projekt ist angelegt.', false, [{
      type: 'CREATE_PROJECT',
      targetType: 'project',
      targetId: newId,
      title: draft.title,
      subtitle: `${draft.phases.length} Abschnitte · ${taskTotal} Aufgaben`
    }]);
  };

  const runDraftTurn = async (session, instruction, { showUserMessage = true } = {}) => {
    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    currentBotMsgIdRef.current = botMsgId;
    currentBotSessionIdRef.current = session.id;

    if (showUserMessage) {
      addMessageToSession(session.id, { id: userMsgId, role: 'user', content: instruction });
    }
    addMessageToSession(session.id, { id: botMsgId, role: 'assistant', content: '', isStreaming: true });
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await reviseDraftWithFio({
        source: session.draftSource,
        draft: session.draft,
        instruction,
        model: activeModel,
        projectTitles: projects.filter((p) => !p.deletedAt).map((p) => p.title),
        detail: session.draftDetail,
        signal: abortController.signal,
      });
      if (!result || generationRef.current !== generation || abortController.signal.aborted) return;

      if (result.draft) {
        updateSessionDraft(session.id, result.draft, { label: instruction.slice(0, 40) });
      }
      updateStreamingMessage(session.id, botMsgId, result.reply, false);
      if (result.confirm && result.draft) {
        await confirmDraft({ ...session, draft: result.draft, draftStatus: 'open' });
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) return;
      console.error('Fio-Entwurf Fehler:', err);
      updateStreamingMessage(session.id, botMsgId, `**KI-Fehler:** ${err?.message || 'Der Entwurf konnte nicht aktualisiert werden.'}`, false);
    } finally {
      if (generationRef.current === generation) {
        abortControllerRef.current = null;
        currentBotMsgIdRef.current = null;
        currentBotSessionIdRef.current = null;
        setLoading(false);
      }
    }
  };

  // Neuer Entwurfs-Chat: Fio macht automatisch den ersten Vorschlag (einmal pro Sitzung, auch im StrictMode)
  const draftStartedRef = useRef(new Set());
  useEffect(() => {
    if (!isDraftSession || !activeSession.draftPendingStart || loading) return undefined;
    if (draftStartedRef.current.has(activeSession.id)) return undefined;
    // Verzögert starten: StrictMode räumt den ersten Effektlauf sofort wieder ab (Timer wird verworfen),
    // sonst bricht der Aufräum-Effekt oben die gerade gestartete Anfrage ab.
    const session = activeSession;
    const timer = setTimeout(() => {
      if (draftStartedRef.current.has(session.id)) return;
      draftStartedRef.current.add(session.id);
      updateSessionDraft(session.id, session.draft, { extra: { draftPendingStart: false } });
      runDraftTurn(
        { ...session, draftPendingStart: false },
        `Erstelle einen ersten Entwurf für ein Projekt aus diesem Gedanken. Detailtiefe: ${(DETAIL_LEVELS[session.draftDetail] || DETAIL_LEVELS.balanced).label}.`,
        { showUserMessage: false }
      );
    }, 0);
    return () => clearTimeout(timer);
    // runDraftTurn ändert sich jeden Render; ausgelöst wird nur durch ein neues Entwurfs-Gespräch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSession, activeSession.id, activeSession.draftPendingStart, loading]);

  // Detailtiefe gewählt: jetzt erst legt Fio los (der Start-Effekt übernimmt)
  const handlePickDetail = (level) => {
    updateSessionDraft(activeSession.id, activeSession.draft, {
      extra: { draftDetail: level, draftAwaitingDetail: false, draftPendingStart: true }
    });
  };

  const handleDraftEdit = (nextDraft) => {
    if (!draftOpen) return;
    updateSessionDraft(activeSession.id, nextDraft);
  };

  const handleRestoreVersion = (version) => {
    updateSessionDraft(activeSession.id, clearNewFlags(version.draft), { label: `Wiederhergestellt: ${version.label}`.slice(0, 40) });
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading || draftAwaitingDetail) return;

    if (draftOpen) {
      if (isListening) {
        isListeningRef.current = false;
        setIsListening(false);
        try { recognitionRef.current?.stop(); } catch (e) {}
      }
      if (!textToSend) {
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      await runDraftTurn(activeSession, text.trim());
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }

    const trimmed = text.trim();
    const userMsgId = `msg_${Date.now()}_u`;
    const botMsgId = `msg_${Date.now()}_b`;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    currentBotMsgIdRef.current = botMsgId;
    currentBotSessionIdRef.current = activeSession.id;
    const currentAttachments = [...activeAttachments];

    // 1. Add User Message with active attachments
    addMessageToSession(activeSession.id, {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      attachments: currentAttachments
    });

    // Clear active attachments in the input bar for the next message
    if (currentAttachments.length > 0) {
      setSelectedProjectIds([]);
      setSelectedReminderIds([]);
      setIsAllContextSelected(true);
      setIsGeneralOnlySelected(false);
    }

    if (!textToSend) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    setLoading(true);

    // 2. Add Placeholder Bot Message
    addMessageToSession(activeSession.id, {
      id: botMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let fullGeneratedText = '';

    try {
      const systemInstruction = buildSystemInstruction(currentAttachments);
      const previousMessages = (activeSession?.messages || []).filter(m => m.id !== botMsgId && m.id !== userMsgId);
      const conversationHistory = [...previousMessages, { role: 'user', content: trimmed }];

      await askGeminiCoach({
        prompt: trimmed,
        messages: conversationHistory,
        systemInstruction,
        aiModel: activeModel,
        signal: abortController.signal,
        onChunk: (currentFullText) => {
          if (generationRef.current !== generation || abortController.signal.aborted) return;
          fullGeneratedText = currentFullText;
          const { cleanText: textWithoutActions } = parseAiActions(currentFullText);
          const { cleanText } = parseIntentChoice(textWithoutActions);
          updateStreamingMessage(activeSession.id, botMsgId, cleanText, true);
        }
      });

      if (generationRef.current !== generation || abortController.signal.aborted) return;

      // Parse and execute any generated actions
      const { cleanText: textWithoutActions, actions } = parseAiActions(fullGeneratedText);
      const { cleanText, intentChoice } = parseIntentChoice(textWithoutActions);
      let executedActionResults = [];
      if (actions && actions.length > 0) {
        executedActionResults = await executeAiActions(actions, modalContext, projects, reminders);
      }

      updateStreamingMessage(
        activeSession.id,
        botMsgId,
        cleanText || undefined,
        false,
        executedActionResults,
        { intentChoice }
      );
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('Gemini Error:', err);
      const errMsg = err?.message || 'Fehler beim Aufruf der Gemini API.';
      updateStreamingMessage(activeSession.id, botMsgId, `**KI-Fehler:** ${errMsg}`, false);
    } finally {
      if (generationRef.current === generation) {
        abortControllerRef.current = null;
        currentBotMsgIdRef.current = null;
        currentBotSessionIdRef.current = null;
        setLoading(false);
      }
    }
  };

  // Group and filter sessions chronologically for the SIDEBAR
  const groupedSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by sidebarScopeFilter
    if (sidebarScopeFilter === 'general') {
      filtered = filtered.filter((s) => s.contextScope === 'general' || s.contextScope === 'global');
    } else if (sidebarScopeFilter === 'drafts') {
      filtered = filtered.filter((s) => s.contextScope === 'draft');
    } else if (sidebarScopeFilter === 'calendar') {
      filtered = filtered.filter((s) =>
        s.contextScope === 'calendar' ||
        (s.contextAttachments && s.contextAttachments.some(a => a.type === 'calendar' || a.type === 'calendar_event'))
      );
    } else if (sidebarScopeFilter !== 'all') {
      filtered = filtered.filter((s) =>
        s.contextId === sidebarScopeFilter ||
        (s.contextAttachments && s.contextAttachments.some(a => a.id === sidebarScopeFilter))
      );
    }

    // Filter by search text in sidebar
    if (sessionSearchText.trim()) {
      const query = sessionSearchText.toLowerCase();
      filtered = filtered.filter((s) =>
        (s.title && s.title.toLowerCase().includes(query)) ||
        (s.contextTitle && s.contextTitle.toLowerCase().includes(query))
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - (7 * 86400000);

    const groups = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: []
    };

    filtered.forEach((sess) => {
      const sessionDate = new Date(sess.updatedAt || sess.createdAt || Date.now()).getTime();
      if (sessionDate >= today) {
        groups.today.push(sess);
      } else if (sessionDate >= yesterday) {
        groups.yesterday.push(sess);
      } else if (sessionDate >= sevenDaysAgo) {
        groups.lastWeek.push(sess);
      } else {
        groups.older.push(sess);
      }
    });

    return groups;
  }, [sessions, sidebarScopeFilter, sessionSearchText]);

  // Label for Sidebar Filter Button
  const sidebarScopeLabel = useMemo(() => {
    if (sidebarScopeFilter === 'all') return 'Alle Chats';
    if (sidebarScopeFilter === 'general') return 'Allgemeiner Coach';
    if (sidebarScopeFilter === 'drafts') return 'Entwürfe';
    if (sidebarScopeFilter === 'calendar') return 'Kalender';

    const p = projects.find(pr => pr.id === sidebarScopeFilter);
    if (p) return `Projekt: ${p.title}`;

    const r = reminders.find(rem => rem.id === sidebarScopeFilter);
    if (r) return `Erinnerung: ${r.title}`;

    return 'Alle Chats';
  }, [sidebarScopeFilter, projects, reminders]);

  // Filtered lists for Sidebar Filter Modal
  const sidebarModalFilteredItems = useMemo(() => {
    const q = sidebarSearchQuery.trim().toLowerCase();
    let filteredProjects = projects;
    let filteredReminders = reminders;
    if (q) {
      filteredProjects = projects.filter((p) => p.title.toLowerCase().includes(q));
      filteredReminders = reminders.filter((r) => r.title.toLowerCase().includes(q));
    }
    return { projects: filteredProjects, reminders: filteredReminders };
  }, [projects, reminders, sidebarSearchQuery]);

  // Filtered lists for Context Attachments Modal
  const contextModalFilteredItems = useMemo(() => {
    const q = contextModalSearch.trim().toLowerCase();
    let filteredProjects = projects.filter((p) => !p.deletedAt);
    let filteredReminders = reminders.filter((r) => !r.deletedAt);
    let filteredEvents = calendarEvents || [];
    if (q) {
      filteredProjects = filteredProjects.filter((p) => (p.title || '').toLowerCase().includes(q));
      filteredReminders = filteredReminders.filter((r) => (r.title || '').toLowerCase().includes(q));
      filteredEvents = filteredEvents.filter((e) => (e.summary || e.title || e.description || '').toLowerCase().includes(q));
    }
    return { projects: filteredProjects, reminders: filteredReminders, calendarEvents: filteredEvents };
  }, [projects, reminders, calendarEvents, contextModalSearch]);

  // Toggle Context Attachment helpers
  const toggleProjectContext = (pId) => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.id === pId && a.type === 'project');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, pId, 'project');
    }
    setSelectedProjectIds((prev) =>
      prev.includes(pId) ? prev.filter(id => id !== pId) : (isInSession ? prev : [...prev, pId])
    );
  };

  const toggleReminderContext = (rId) => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.id === rId && a.type === 'reminder');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, rId, 'reminder');
    }
    setSelectedReminderIds((prev) =>
      prev.includes(rId) ? prev.filter(id => id !== rId) : (isInSession ? prev : [...prev, rId])
    );
  };

  const toggleCalendarContext = () => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.type === 'calendar');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, 'calendar', 'calendar');
    }
    setIsCalendarContextSelected((prev) => !prev);
  };

  const toggleCalendarEventContext = (eId) => {
    setIsAllContextSelected(false);
    setIsGeneralOnlySelected(false);
    const isInSession = (activeSession?.contextAttachments || []).some(a => a.id === eId && a.type === 'calendar_event');
    if (isInSession) {
      removeSessionAttachment(activeSession.id, eId, 'calendar_event');
    }
    setSelectedCalendarEventIds((prev) =>
      prev.includes(eId) ? prev.filter(id => id !== eId) : (isInSession ? prev : [...prev, eId])
    );
  };

  const selectAllContext = () => {
    setIsAllContextSelected(true);
    setIsGeneralOnlySelected(false);
    setSelectedProjectIds([]);
    setSelectedReminderIds([]);
    setSelectedCalendarEventIds([]);
    setIsCalendarContextSelected(false);
    setIsContextModalOpen(false);
  };

  const selectGeneralOnlyContext = () => {
    setIsGeneralOnlySelected(true);
    setIsAllContextSelected(false);
    setSelectedProjectIds([]);
    setSelectedReminderIds([]);
    setSelectedCalendarEventIds([]);
    setIsCalendarContextSelected(false);
    setIsContextModalOpen(false);
  };

  const formatSessionTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderSessionCard = (sess) => {
    const isActive = sess.id === activeSessionId;
    const isProject = sess.contextScope === 'project' || sess.contextScope === 'task' || sess.contextScope === 'section';
    const isReminder = sess.contextScope === 'reminder' || sess.contextScope === 'reminders';
    const isDraft = sess.contextScope === 'draft';

    return (
      <div
        key={sess.id}
        className={cx(
          'group flex items-center gap-1 rounded-lg border transition-colors duration-fast',
          isActive ? 'border-accent bg-selected' : 'border-subtle bg-surface hover:border-default hover:bg-hover'
        )}
      >
        <button
          type="button"
          onClick={() => selectSession(sess.id)}
          aria-current={isActive ? 'true' : undefined}
          className={cx('flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 text-left', FOCUS)}
        >
          <IconTile
            area={isReminder ? 'reminders' : isProject || isDraft ? 'projects' : 'neutral'}
            icon={isReminder ? 'notifications' : isDraft ? 'edit_note' : isProject ? 'folder' : 'psychology'}
            size="sm"
          />
          <span className="min-w-0 flex-1 truncate text-caption-strong text-primary">{sess.title || 'Gespräch'}</span>
          <span className="flex shrink-0 flex-col items-end text-right">
            <span className="text-micro text-secondary">{formatSessionTime(sess.updatedAt || sess.createdAt)}</span>
            <span className="text-micro text-tertiary">{sess.messages?.length || 0} Nachr.</span>
          </span>
        </button>
        <IconButton
          icon="delete"
          size="sm"
          variant="danger-ghost"
          label="Gespräch löschen"
          className="mr-2 shrink-0 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
          onClick={() => deleteSession(sess.id)}
        />
      </div>
    );
  };

  const sessionGroups = [
    ['Heute', groupedSessions.today],
    ['Gestern', groupedSessions.yesterday],
    ['Letzte 7 Tage', groupedSessions.lastWeek],
    ['Älter', groupedSessions.older],
  ];

  const closeFilterDialog = () => setIsSidebarFilterModalOpen(false);
  const pickScope = (value) => {
    setSidebarScopeFilter(value);
    closeFilterDialog();
  };
  const noContextAttachments = (activeSession?.contextAttachments || []).length === 0;

  /** Drei sichtbare Einträge, der Rest hinter „Mehr anzeigen“ (außer bei aktiver Suche) */
  const limited = (list, searchText, showAll) => {
    const isSearching = !!searchText.trim();
    return {
      visible: isSearching || showAll ? list : list.slice(0, 3),
      hiddenCount: !isSearching && list.length > 3 ? list.length - 3 : 0,
    };
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-canvas">
      <div className="relative flex h-full w-full overflow-hidden">
        {/* Handy: Tippen außerhalb schließt den Verlauf */}
        <div
          className={cx(
            'fixed inset-0 z-sheet bg-scrim transition-opacity duration-slow md:hidden',
            isHistoryOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setIsHistoryOpen(false)}
          aria-hidden="true"
        />

        {/* Verlauf: Handy als Panel von links, ab md als einklappbare Spalte */}
        <aside
          inert={!isHistoryOpen}
          aria-label="Chat-Verlauf"
          className={cx(
            'fixed inset-y-0 left-0 z-sheet h-full overflow-hidden transition-[width,transform,opacity] duration-slow ease-standard motion-reduce:transition-none md:relative md:inset-auto md:z-10',
            isHistoryOpen
              ? 'pointer-events-auto w-[85%] max-w-[340px] translate-x-0 opacity-100 sm:w-80 md:w-80'
              : 'pointer-events-none w-[85%] max-w-[340px] -translate-x-full sm:w-80 md:w-0 md:translate-x-0 md:opacity-0'
          )}
        >
          <div className="flex h-full w-[85vw] max-w-[340px] shrink-0 flex-col border-r border-subtle bg-surface shadow-lg sm:w-80 md:shadow-none">
            <div className="flex items-center gap-2 border-b border-subtle p-3">
              <Button leadingIcon="edit_square" title="Neuen Chat starten" onClick={handleNewChat} className="flex-1">
                Neuer Chat
              </Button>
              <IconButton icon="left_panel_close" label="Verlauf einklappen" variant="secondary" className="shrink-0" onClick={() => setIsHistoryOpen(false)} />
            </div>

            <div className="space-y-2 border-b border-subtle p-3">
              <SearchField value={sessionSearchText} onChange={setSessionSearchText} label="Gespräche durchsuchen" placeholder="Gespräche durchsuchen …" />
              <Button
                variant="secondary"
                fullWidth
                leadingIcon="filter_list"
                title="Chat-Verlauf filtern"
                onClick={() => setIsSidebarFilterModalOpen(true)}
                className="!justify-start"
              >
                <span className="min-w-0 truncate">{sidebarScopeLabel}</span>
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-3">
              {sessionGroups.map(([label, list]) => list.length > 0 && (
                <section key={label} className="space-y-2">
                  <SectionHeader title={label} />
                  {list.map(renderSessionCard)}
                </section>
              ))}

              {sessions.length === 0 && (
                <div className="p-6 text-center text-body text-secondary">
                  Keine gespeicherten Gespräche vorhanden.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Chat */}
        <div className="relative flex h-full min-w-0 flex-grow flex-col overflow-hidden bg-canvas">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-subtle bg-canvas px-3 py-2 sm:px-4">
            <div
              inert={isHistoryOpen}
              className={cx('flex items-center gap-2 transition-opacity duration-base', isHistoryOpen && 'pointer-events-none opacity-0')}
            >
              <Button variant="secondary" leadingIcon="history" title="Chatverlauf öffnen" aria-label="Chatverlauf öffnen" onClick={() => setIsHistoryOpen(true)}>
                <span className="hidden sm:inline">Verlauf</span>
              </Button>
              <Button leadingIcon="edit_square" title="Neuen Chat starten" aria-label="Neuen Chat starten" onClick={handleNewChat}>
                <span className="hidden sm:inline">Neuer Chat</span>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                leadingIcon="lightbulb"
                title="Was kann Fio? Interaktiven KI-Guide öffnen"
                aria-label="Was kann Fio?"
                onClick={() => openModal('settings', { initialTab: 'fio' })}
              >
                <span className="hidden sm:inline">Was kann Fio?</span>
              </Button>

              <ModelSelectorDropdown activeModel={activeModel} onSelectModel={setActiveModel} />
            </div>
          </div>

          <div className="min-h-0 flex-grow overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-reading space-y-6">
              {messages.length === 0 && isDraftSession ? null : messages.length === 0 ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
                  <IconTile area="coach" size="lg" className="mb-4" />
                  <h2 className="mb-1.5 text-title text-primary">
                    Hallo{user?.displayName ? ` ${user.displayName.split(' ')[0]}` : ''}, ich bin Fio
                  </h2>
                  <p className="max-w-md text-body text-secondary">
                    Dein persönlicher KI-Coach. Wie kann ich dich heute bei deinen Projekten, Aufgaben, Erinnerungen und Terminen unterstützen?
                  </p>
                  <Button variant="secondary" leadingIcon="lightbulb" onClick={() => openModal('settings', { initialTab: 'fio' })} className="mt-4">
                    Entdecke, was Fio alles kann
                  </Button>
                </div>
              ) : (
                messages.map((msg) => {
                  const isBot = msg.role === 'assistant' || msg.sender === 'bot';
                  if (isBot) {
                    return (
                      <div key={msg.id} className="flex gap-3">
                        <IconTile area="coach" size="md" className="mt-0.5" />
                        <div className="flex min-w-0 max-w-[85%] flex-col items-start gap-1">
                          <div className="markdown-body w-full rounded-lg border border-subtle bg-surface p-4 text-body-lg text-primary">
                            {msg.content || msg.text ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content || msg.text}
                              </ReactMarkdown>
                            ) : msg.cancelled ? (
                              <div className="flex items-center gap-1.5 py-1 text-caption text-secondary">
                                <Icon name="pause_circle" size="sm" />
                                <span>Antwort abgebrochen</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 py-1 text-caption text-secondary">
                                <Spinner size="sm" label="" />
                                <span>Fio denkt nach …</span>
                              </div>
                            )}

                            {/* Ausgeführte Aktionen als Karten */}
                            {msg.actionResults && msg.actionResults.length > 0 && (
                              <div className="not-prose mt-3 w-full space-y-2 border-t border-subtle pt-3">
                                {msg.actionResults.map((res, idx) => {
                                  const isProjAction = res.targetType === 'project' || res.type === 'ADD_PHASE' || res.type === 'ADD_TASK' || res.type === 'CREATE_PROJECT' || res.type === 'UPDATE_PROJECT';
                                  const isRemAction = res.targetType === 'reminder' || res.type === 'CREATE_REMINDER' || res.type === 'UPDATE_REMINDER';
                                  const isCalAction = res.targetType === 'calendar' || res.isOnlyCalendar || res.type === 'CREATE_CALENDAR_EVENT';
                                  const isNoteAction = res.type === 'CREATE_NOTE';
                                  const isMatAction = res.type === 'ADD_MATERIAL';

                                  const iconName = isNoteAction ? 'note_alt' : isMatAction ? 'attach_file' : isCalAction ? 'calendar_month' : isRemAction ? 'notifications' : isProjAction ? 'folder' : 'check_circle';
                                  const area = isCalAction ? 'calendar' : isRemAction ? 'reminders' : isProjAction ? 'projects' : 'neutral';

                                  return (
                                    <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-subtle p-2.5">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <IconTile area={area} icon={iconName} size="sm" />
                                        <div className="min-w-0">
                                          <div className="truncate text-caption-strong text-primary">{res.title}</div>
                                          <div className="truncate text-micro text-secondary">{res.subtitle}</div>
                                        </div>
                                      </div>
                                      {(isCalAction || res.targetType === 'calendar') && (
                                        <Button variant="secondary" size="sm" trailingIcon="arrow_forward" className="shrink-0" onClick={() => { if (setCurrentScreen) setCurrentScreen('calendar'); }}>
                                          Im Kalender ansehen
                                        </Button>
                                      )}
                                      {res.targetType === 'project' && res.targetId && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          trailingIcon="arrow_forward"
                                          className="shrink-0"
                                          onClick={() => {
                                            setSelectedProjectId(res.targetId);
                                            if (setCurrentScreen) setCurrentScreen('project-detail');
                                          }}
                                        >
                                          Projekt öffnen
                                        </Button>
                                      )}
                                      {res.targetType === 'reminder' && res.targetId && (
                                        <div className="flex shrink-0 items-center gap-1.5">
                                          {res.isCalendarSynced && (
                                            <IconButton icon="calendar_month" label="Im Kalender ansehen" variant="secondary" size="sm" onClick={() => { if (setCurrentScreen) setCurrentScreen('calendar'); }} />
                                          )}
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            trailingIcon="arrow_forward"
                                            className="shrink-0"
                                            onClick={() => {
                                              setSelectedReminderId(res.targetId);
                                              if (setCurrentScreen) setCurrentScreen('reminder-detail');
                                            }}
                                          >
                                            Erinnerung öffnen
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Auswahl, wo ein Termin oder eine Erinnerung angelegt wird */}
                            {msg.intentChoice && (
                              <div className="not-prose mt-3 w-full space-y-2 border-t border-subtle pt-3">
                                <div className="flex items-center gap-1.5 text-label-sm text-secondary">
                                  <Icon name="help" size="sm" />
                                  <span>Wo soll der Eintrag angelegt werden?</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    leadingIcon="notifications"
                                    onClick={() => handleSendMessage(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur in FocusFlow.`)}
                                  >
                                    Nur in FocusFlow
                                  </Button>
                                  <Button
                                    size="sm"
                                    leadingIcon="sync"
                                    disabled={user?.isGuest || !isCalendarConnected}
                                    title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Empfohlen'}
                                    onClick={() => handleSendMessage(`Bitte erstelle die Erinnerung „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} in FocusFlow mit Google Kalender-Sync.`)}
                                  >
                                    FocusFlow + Kalender-Sync (empfohlen)
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    leadingIcon="calendar_month"
                                    disabled={user?.isGuest || !isCalendarConnected}
                                    title={user?.isGuest ? 'Im Gastmodus nicht verfügbar' : !isCalendarConnected ? 'Google Kalender nicht verbunden' : 'Direkt im Kalender eintragen'}
                                    onClick={() => handleSendMessage(`Bitte trage den Termin „${msg.intentChoice.title}“ für den ${msg.intentChoice.date}${msg.intentChoice.time ? ` um ${msg.intentChoice.time} Uhr` : ''} nur im Google Kalender ein.`)}
                                  >
                                    Nur im Google Kalender
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className="flex flex-col items-end gap-2">
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex max-w-[85%] flex-wrap items-center justify-end gap-1.5 pr-1">
                          {msg.attachments.map((att) => (
                            <AttachmentChip key={`${att.type}_${att.id}`} att={att} />
                          ))}
                        </div>
                      )}
                      <div className="flex flex-row-reverse gap-3">
                        <Avatar name={user?.displayName || user?.email || 'Du'} src={user?.photoURL} size="md" />
                        <div className="markdown-body max-w-[85%] rounded-lg bg-selected p-4 text-body-lg text-primary">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {draftAwaitingDetail && (
                <Card variant="outlined" padding="md" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon name="tune" size="md" className="text-secondary" />
                    <span className="text-body-strong text-primary">Wie detailliert soll Fio das Projekt aufteilen?</span>
                  </div>
                  <p className="text-caption text-secondary">
                    Das gibt die Richtung vor. Später kannst du den Entwurf von Hand oder per Prompt anpassen.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {Object.entries(DETAIL_LEVELS).map(([key, level]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePickDetail(key)}
                        className={cx('flex items-center gap-3 rounded-lg border border-subtle bg-surface p-3 text-left transition-colors duration-fast hover:border-strong hover:bg-hover sm:flex-col sm:items-start sm:gap-1', FOCUS)}
                      >
                        <Icon name={level.icon} size="md" className="text-secondary" />
                        <span>
                          <span className="block text-body-strong text-primary">{level.label}</span>
                          <span className="block text-caption text-secondary">{level.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
              {isDraftSession && activeSession.draft && !draftAwaitingDetail && (
                <ProjectDraftCard
                  draft={activeSession.draft}
                  status={activeSession.draftStatus}
                  disabled={loading || activeSession.draftStatus === 'confirming'}
                  categories={projectCategories}
                  source={activeSession.draftSource}
                  versions={activeSession.draftVersions || []}
                  onChange={handleDraftEdit}
                  onConfirm={() => confirmDraft()}
                  onRestore={handleRestoreVersion}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Eingabe */}
          <div className="shrink-0 bg-canvas px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5 sm:pb-5">
            <div className="mx-auto w-full max-w-reading space-y-2">
              {loading ? (
                <div className="flex items-center justify-center pb-0.5">
                  <Button variant="secondary" size="sm" leadingIcon="stop" onClick={handleStopGeneration}>
                    Antwort stoppen
                  </Button>
                </div>
              ) : dynamicPrompts.length === 0 ? null : (
                <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
                  {dynamicPrompts.map((qp) => (
                    <Button variant="secondary" size="sm" key={qp.id} onClick={() => handleSendMessage(qp.promptText)} className="shrink-0">
                      {qp.label}
                    </Button>
                  ))}
                </div>
              )}

              <div className="flex flex-col rounded-lg border border-control bg-surface p-1.5 shadow-sm transition-[border-color,box-shadow] duration-fast focus-within:border-transparent focus-within:ring-2 focus-within:ring-focus">
                {activeAttachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-subtle px-2 pb-2 pt-1">
                    {activeAttachments.map((att) => (
                      <AttachmentChip
                        key={`${att.type}_${att.id}`}
                        att={att}
                        onRemove={() => {
                          if (att.type === 'project') toggleProjectContext(att.id);
                          else if (att.type === 'reminder') toggleReminderContext(att.id);
                          else if (att.type === 'calendar') toggleCalendarContext();
                          else if (att.type === 'calendar_event') toggleCalendarEventContext(att.id);
                        }}
                      />
                    ))}
                    <Button variant="ghost" size="sm" leadingIcon="add" onClick={() => setIsContextModalOpen(true)}>
                      Weiteren Kontext hinzufügen
                    </Button>
                  </div>
                )}

                <div className="flex w-full items-center">
                  <div className="relative shrink-0">
                    <IconButton
                      icon="tune"
                      variant={hasCustomContext ? 'secondary' : 'ghost'}
                      label={
                        hasCustomContext
                          ? isGeneralOnlySelected
                            ? 'KI-Kontext: Allgemeiner Coach (aktiv)'
                            : `KI-Kontext: ${totalActiveCustomCount} Element(e) ausgewählt (aktiv)`
                          : 'Kontext und Daten für Fio wählen (Kalender, Projekte, Erinnerungen)'
                      }
                      onClick={() => setIsContextModalOpen(true)}
                    />
                    {hasCustomContext && (
                      <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-micro text-on-accent">
                        {isGeneralOnlySelected ? <Icon name="psychology" size="sm" /> : totalActiveCustomCount}
                      </span>
                    )}
                  </div>

                  <textarea
                    ref={textareaRef}
                    aria-label="Nachricht an Fio"
                    className="min-h-11 flex-grow resize-none overflow-y-auto border-none bg-transparent px-2 py-2 text-body text-primary outline-none placeholder:text-tertiary focus:ring-0 disabled:text-disabled sm:px-3 sm:py-2.5"
                    placeholder={
                      loading
                        ? 'Fio generiert gerade eine Antwort …'
                        : draftAwaitingDetail
                        ? 'Wähle oben die Detailtiefe …'
                        : draftOpen
                        ? 'Sag Fio, was am Entwurf anders sein soll …'
                        : 'Frage deinen Coach …'
                    }
                    value={inputText}
                    rows={1}
                    disabled={loading || draftAwaitingDetail}
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

                  {!loading && (
                    <IconButton
                      icon={isListening ? 'mic' : 'mic_none'}
                      variant={isListening ? 'danger' : 'ghost'}
                      label={isListening ? 'Zuhören beenden' : 'Spracheingabe starten'}
                      className={cx('mr-1', isListening && 'animate-pulse')}
                      onClick={handleToggleListening}
                    />
                  )}

                  {loading ? (
                    <IconButton icon="stop" label="Antwort unterbrechen" variant="danger" onClick={handleStopGeneration} />
                  ) : (
                    <IconButton icon="send" label="Nachricht senden" variant="primary" disabled={!inputText.trim() || loading} onClick={() => handleSendMessage()} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat-Verlauf durchsuchen und filtern */}
      <Dialog open={isSidebarFilterModalOpen} onClose={closeFilterDialog} size="md" title="Chat-Verlauf filtern">
        <div className="space-y-4">
          <SearchField value={sidebarSearchQuery} onChange={setSidebarSearchQuery} label="Chats filtern" placeholder="Kalender, Projekte oder Erinnerungen filtern …" autoFocus />

          <div className="-mx-6 max-h-[55vh] space-y-5 overflow-y-auto px-6 pb-1">
            <section className="space-y-2">
              <SectionHeader title="Allgemein" />
              <PickRow icon="forum" title="Alle Chats anzeigen" meta="Gesamten Verlauf anzeigen" selected={sidebarScopeFilter === 'all'} onClick={() => pickScope('all')} />
              <PickRow icon="calendar_month" area="calendar" title="Kalender und Termine" meta="Chats mit Kalender- und Terminbezug" selected={sidebarScopeFilter === 'calendar'} onClick={() => pickScope('calendar')} />
              <PickRow icon="psychology" title="Allgemeiner Coach" meta="Chats ohne Projekt- oder Erinnerungsbindung" selected={sidebarScopeFilter === 'general'} onClick={() => pickScope('general')} />
              <PickRow icon="edit_note" area="projects" title="Entwürfe" meta="Projektanlegung mit fertigen Entwürfen" selected={sidebarScopeFilter === 'drafts'} onClick={() => pickScope('drafts')} />
            </section>

            {sidebarModalFilteredItems.projects.length > 0 && (() => {
              const { visible, hiddenCount } = limited(sidebarModalFilteredItems.projects, sidebarSearchQuery, showAllSidebarProjects);
              return (
                <PickSection title="Projekte" count={sidebarModalFilteredItems.projects.length} hiddenCount={hiddenCount} expanded={showAllSidebarProjects} onToggle={() => setShowAllSidebarProjects(!showAllSidebarProjects)}>
                  {visible.map((p) => (
                    <PickRow key={p.id} icon="folder" area="projects" title={p.title} meta={projectMeta(p)} selected={sidebarScopeFilter === p.id} onClick={() => pickScope(p.id)} />
                  ))}
                </PickSection>
              );
            })()}

            {sidebarModalFilteredItems.reminders.length > 0 && (() => {
              const { visible, hiddenCount } = limited(sidebarModalFilteredItems.reminders, sidebarSearchQuery, showAllSidebarReminders);
              return (
                <PickSection title="Erinnerungen" count={sidebarModalFilteredItems.reminders.length} hiddenCount={hiddenCount} expanded={showAllSidebarReminders} onToggle={() => setShowAllSidebarReminders(!showAllSidebarReminders)}>
                  {visible.map((r) => (
                    <PickRow key={r.id} icon="notifications" area="reminders" title={r.title} meta={reminderMeta(r)} selected={sidebarScopeFilter === r.id} onClick={() => pickScope(r.id)} />
                  ))}
                </PickSection>
              );
            })()}
          </div>
        </div>
      </Dialog>

      {/* Kontext und Anhänge: welche Daten Fio bekommt */}
      <Dialog
        open={isContextModalOpen}
        onClose={() => setIsContextModalOpen(false)}
        size="md"
        title="Kontext für Fio auswählen"
        footer={<Button onClick={() => setIsContextModalOpen(false)}>Auswahl anwenden</Button>}
      >
        <div className="space-y-4">
          <SearchField value={contextModalSearch} onChange={setContextModalSearch} label="Kontext suchen" placeholder="Kalender, Projekte oder Erinnerungen suchen …" autoFocus />

          <div className="-mx-6 max-h-[50vh] space-y-5 overflow-y-auto px-6 pb-1">
            <section className="space-y-2">
              <SectionHeader title="Voreinstellungen" />
              <PickRow
                icon="forum"
                title="Alle Daten übergeben"
                meta="Voller Zugriff auf alle Termine, Projekte und Erinnerungen"
                selected={isAllContextSelected && noContextAttachments}
                onClick={selectAllContext}
              />
              <PickRow
                icon="psychology"
                title="Allgemeiner Coach"
                meta="Freies Gespräch ohne Projektdaten"
                selected={isGeneralOnlySelected}
                onClick={selectGeneralOnlyContext}
              />
            </section>

            {(contextModalFilteredItems.calendarEvents.length > 0 || isCalendarConnected) && (() => {
              const { visible, hiddenCount } = limited(contextModalFilteredItems.calendarEvents, contextModalSearch, showAllContextCalendar);
              const isMasterCalChecked = isCalendarContextSelected || (activeSession?.contextAttachments || []).some(a => a.type === 'calendar');

              return (
                <PickSection title="Kalender" count={contextModalFilteredItems.calendarEvents.length} hiddenCount={hiddenCount} expanded={showAllContextCalendar} onToggle={() => setShowAllContextCalendar(!showAllContextCalendar)}>
                  <PickRow
                    multi
                    icon="calendar_month"
                    area="calendar"
                    title="Gesamter Kalender"
                    meta={isCalendarConnected ? `${calendarEvents.length} Termine geladen · Google Kalender aktiv` : (user?.isGuest ? 'Gastmodus (kein Google Kalender)' : 'Kalender nicht verknüpft')}
                    selected={isMasterCalChecked}
                    onClick={toggleCalendarContext}
                  />
                  {visible.map((evt) => {
                    const isChecked = isMasterCalChecked || selectedCalendarEventIds.includes(evt.id) || (activeSession?.contextAttachments || []).some(a => a.id === evt.id && a.type === 'calendar_event');
                    const rawStart = evt.start?.dateTime || evt.start?.date || '';
                    let timeDisplay = '';
                    if (rawStart) {
                      try {
                        const d = new Date(rawStart);
                        timeDisplay = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                        if (rawStart.includes('T')) {
                          timeDisplay += ` · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
                        }
                      } catch {
                        timeDisplay = rawStart;
                      }
                    }
                    return (
                      <PickRow
                        key={evt.id}
                        multi
                        icon="event"
                        area="calendar"
                        title={evt.summary || evt.title || 'Termin'}
                        meta={timeDisplay || 'Termin'}
                        selected={isChecked}
                        onClick={() => toggleCalendarEventContext(evt.id)}
                      />
                    );
                  })}
                </PickSection>
              );
            })()}

            {contextModalFilteredItems.projects.length > 0 && (() => {
              const { visible, hiddenCount } = limited(contextModalFilteredItems.projects, contextModalSearch, showAllContextProjects);
              return (
                <PickSection title="Projekte" count={contextModalFilteredItems.projects.length} hiddenCount={hiddenCount} expanded={showAllContextProjects} onToggle={() => setShowAllContextProjects(!showAllContextProjects)}>
                  {visible.map((p) => (
                    <PickRow
                      key={p.id}
                      multi
                      icon="folder"
                      area="projects"
                      title={p.title}
                      meta={projectMeta(p)}
                      selected={selectedProjectIds.includes(p.id) || (activeSession?.contextAttachments || []).some(a => a.id === p.id && a.type === 'project')}
                      onClick={() => toggleProjectContext(p.id)}
                    />
                  ))}
                </PickSection>
              );
            })()}

            {contextModalFilteredItems.reminders.length > 0 && (() => {
              const { visible, hiddenCount } = limited(contextModalFilteredItems.reminders, contextModalSearch, showAllContextReminders);
              return (
                <PickSection title="Erinnerungen" count={contextModalFilteredItems.reminders.length} hiddenCount={hiddenCount} expanded={showAllContextReminders} onToggle={() => setShowAllContextReminders(!showAllContextReminders)}>
                  {visible.map((r) => (
                    <PickRow
                      key={r.id}
                      multi
                      icon="notifications"
                      area="reminders"
                      title={r.title}
                      meta={reminderMeta(r)}
                      selected={selectedReminderIds.includes(r.id) || (activeSession?.contextAttachments || []).some(a => a.id === r.id && a.type === 'reminder')}
                      onClick={() => toggleReminderContext(r.id)}
                    />
                  ))}
                </PickSection>
              );
            })()}

            {contextModalFilteredItems.projects.length === 0 && contextModalFilteredItems.reminders.length === 0 && contextModalFilteredItems.calendarEvents.length === 0 && (
              <div className="p-8 text-center text-body text-secondary">
                Keine Termine, Projekte oder Erinnerungen für „{contextModalSearch}“ gefunden.
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Coach;
