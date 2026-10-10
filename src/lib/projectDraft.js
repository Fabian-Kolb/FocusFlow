import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { askGeminiCoach, ensureBulletPoints } from './gemini';

// Projekt-Entwurf: ein Zustand, den Hand und Fio gemeinsam bearbeiten.
// Aufbau: { title, description, startDate, endDate, categoryId, phases: [{ id, title, date, tasks: [{ id, title, date }] }],
//           includeNotes: { summary, clean, raw }, keepThought }

const MAX_SOURCE_TEXT = 4000;

/** Detailtiefe, die der Nutzer vor dem ersten Entwurf wählt */
export const DETAIL_LEVELS = {
  coarse: {
    label: 'Grob',
    hint: '2–3 Abschnitte, wenige große Aufgaben',
    icon: 'view_agenda',
    prompt: '2–3 Abschnitte mit je 1–3 übergeordneten Aufgaben',
  },
  balanced: {
    label: 'Ausgewogen',
    hint: '3–5 Abschnitte, je 3–5 Aufgaben',
    icon: 'view_list',
    prompt: '3–5 Abschnitte mit je 3–5 Aufgaben',
  },
  fine: {
    label: 'Detailliert',
    hint: '5–8 Abschnitte, viele kleine Schritte',
    icon: 'format_list_numbered',
    prompt: '5–8 Abschnitte mit je 4–8 kleinen, konkreten Aufgaben',
  },
};

let idCounter = 0;
export const draftId = (prefix) => `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export const emptyDraft = (title = '') => ({
  title,
  description: '',
  startDate: '',
  endDate: '',
  categoryId: 'allgemein',
  phases: [],
  includeNotes: { summary: true, clean: false, raw: false },
  keepThought: false,
});

/** Nur das, was Fio vom Gedanken sieht: Titel, Zusammenfassung, bereinigter Text (gekürzt) */
export function buildDraftSource(item) {
  const text = item.cleanText || item.originalText || '';
  return {
    thoughtId: item.id,
    title: item.title || '',
    summary: item.summary || '',
    text: text.slice(0, MAX_SOURCE_TEXT),
    cleanText: item.cleanText || '',
    originalText: item.originalText || '',
    extractedDate: item.extractedDate || '',
    extractedEndDate: item.extractedEndDate || '',
  };
}

export function initialDraftFromThought(item) {
  const draft = emptyDraft((item.title || '').trim() || 'Neues Projekt');
  if (item.extractedDateType === 'timeframe' && item.extractedDate) draft.startDate = item.extractedDate;
  draft.endDate = item.extractedEndDate || item.extractedDate || '';
  return draft;
}

const str = (v) => (typeof v === 'string' ? v : '');
const isoOrEmpty = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v).trim()) ? v.trim() : '');

/** Antwort von Fio in einen gültigen Entwurf übersetzen; unbekannte IDs werden neu vergeben und als neu markiert */
export function normalizeDraft(raw, previous) {
  const known = new Set();
  (previous?.phases || []).forEach((p) => {
    known.add(p.id);
    (p.tasks || []).forEach((t) => known.add(t.id));
  });
  const seen = new Set();
  const keepOrNew = (id, prefix) => {
    if (id && known.has(id) && !seen.has(id)) {
      seen.add(id);
      return { id, isNew: false };
    }
    const fresh = draftId(prefix);
    seen.add(fresh);
    return { id: fresh, isNew: true };
  };

  return {
    ...(previous || emptyDraft()),
    title: str(raw.title).trim() || previous?.title || 'Neues Projekt',
    description: str(raw.description),
    startDate: isoOrEmpty(raw.startDate),
    endDate: isoOrEmpty(raw.endDate),
    phases: (Array.isArray(raw.phases) ? raw.phases : [])
      .filter((p) => p && str(p.title).trim())
      .map((p) => {
        const ph = keepOrNew(p.id, 'dph');
        return {
          id: ph.id,
          isNew: ph.isNew,
          title: str(p.title).trim(),
          date: isoOrEmpty(p.date),
          tasks: (Array.isArray(p.tasks) ? p.tasks : [])
            .filter((t) => t && str(typeof t === 'string' ? t : t.title).trim())
            .map((t) => {
              const obj = typeof t === 'string' ? { title: t } : t;
              const tk = keepOrNew(obj.id, 'dt');
              return { id: tk.id, isNew: tk.isNew, title: str(obj.title).trim(), date: isoOrEmpty(obj.date) };
            }),
        };
      }),
  };
}

/** Wie viele Elemente (Abschnitte + Aufgaben) wurden gegenüber `previous` neu? */
export const countNew = (draft) =>
  (draft.phases || []).reduce((n, p) => n + (p.isNew ? 1 : 0) + (p.tasks || []).filter((t) => t.isNew).length, 0);

/** Hervorhebungen löschen (nach kurzer Zeit oder bei Handänderung) */
export function clearNewFlags(draft) {
  return {
    ...draft,
    phases: draft.phases.map((p) => ({
      ...p,
      isNew: false,
      tasks: p.tasks.map((t) => ({ ...t, isNew: false })),
    })),
  };
}

// Für die Anfrage an Fio: ohne UI-Felder
const draftForPrompt = (draft) => ({
  title: draft.title,
  description: draft.description,
  startDate: draft.startDate,
  endDate: draft.endDate,
  phases: draft.phases.map((p) => ({
    id: p.id,
    title: p.title,
    date: p.date,
    tasks: p.tasks.map((t) => ({ id: t.id, title: t.title, date: t.date })),
  })),
});

const buildSystemInstruction = ({ source, draft, projectTitles, detail }) => {
  const level = DETAIL_LEVELS[detail] || DETAIL_LEVELS.balanced;
  const today = new Date().toISOString().split('T')[0];
  return `
Du bist Fio, der KI-Coach von FocusFlow. arbeitest gemeinsam mit dem Nutzer an EINEM Projekt-Entwurf.
Heute ist ${today}.

QUELLE (Gedanke des Nutzers):
Titel: ${source.title}
Zusammenfassung:
${source.summary}
Text:
${source.text}

BESTEHENDE PROJEKTE DES NUTZERS (nur Titel, zur Vermeidung von Dubletten): ${JSON.stringify(projectTitles)}

AKTUELLER ENTWURF (der Nutzer kann ihn auch von Hand geändert haben, arbeite immer auf dieser Fassung):
${JSON.stringify(draftForPrompt(draft), null, 2)}

AUFGABE:
Setze die Anweisung des Nutzers auf den aktuellen Entwurf um und gib den GESAMTEN neuen Entwurf zurück.
- Behalte die "id" aller Abschnitte und Aufgaben, die bestehen bleiben. Neue Elemente bekommen KEINE id.
- Ändere nur, was die Anweisung verlangt. Handänderungen des Nutzers bleiben erhalten.
- Datumsangaben immer als YYYY-MM-DD oder leerer String. Erfinde keine Termine, die nicht im Text stehen oder verlangt wurden.
- Gewünschte Detailtiefe (${level.label}): ${level.prompt}. Halte sie ein, außer der Nutzer verlangt ausdrücklich etwas anderes.
- Abschnitte sind sinnvolle Etappen, Aufgaben konkrete Schritte.
 Frage nur nach, wenn im Text wirklich unklar ist. Dann setze "draft" auf null und stelle genau eine kurze Rückfrage in "reply".
 Erwähne "reply" niemals IDs oder technische Details, sondern nur, was sich inhaltlich geändert hat.
 Setze "confirm" dann true, den Entwurf bestätigt (z. B. "passt, leg das Projekt an").

ANTWORTFORMAT: ausschließlich ein JSON-Objekt, ohne Markdown-Codeblock, weiteren Text:
{"reply":"1–2 Sätze Deutsch, du getan hast","confirm":false,"draft":{"title":"","description":"","startDate":"","endDate":"","phases":[{"id":"…","title":"","date":"","tasks":[{"id":"…","title":"","date":""}]}]}}
`;
};

const extractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * Fio den Entwurf bearbeiten lassen.
 * Liefert { reply, confirm, draft } – `draft` ist null, wenn Fio nur eine Rückfrage stellt.
 */
export async function reviseDraftWithFio({ source, draft, instruction, model, projectTitles = [], detail, signal }) {
  const text = await askGeminiCoach({
    prompt: instruction,
    messages: [{ role: 'user', content: instruction }],
    systemInstruction: buildSystemInstruction({ source, draft, projectTitles, detail }),
    aiModel: model,
    signal,
  });
  if (signal?.aborted) return null;

  const parsed = extractJson(text || '');
  if (!parsed) {
    throw new Error(text?.startsWith('**Fehler:**') ? text.replace(/^\*\*Fehler:\*\*\s*/, '') : 'Fio hat keinen gültigen Entwurf geliefert. Bitte versuche es noch einmal.');
  }
  return {
    reply: str(parsed.reply) || 'Entwurf aktualisiert.',
    confirm: parsed.confirm === true,
    draft: parsed.draft && typeof parsed.draft === 'object' ? normalizeDraft(parsed.draft, draft) : null,
  };
}

const textNote = (id, title, text, now) => {
  const safe = DOMPurify.sanitize(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  return { id, title, content: `<p>${safe.replace(/\n/g, '<br/>')}</p>`, source: 'inbox', createdAt: now, updatedAt: now };
};

/** Entwurf in die Daten für `addProject` umwandeln (inkl. gewählter Notizen) */
export function draftToProjectData(draft, source) {
  const now = Date.now();
  const notes = [];
  if (draft.includeNotes?.summary && source?.summary) {
    notes.push({
      id: `note_sum_${now}`,
      title: 'KI-Zusammenfassung',
      content: DOMPurify.sanitize(marked.parse(ensureBulletPoints(source.summary))),
      source: 'inbox',
      createdAt: now,
      updatedAt: now,
    });
  }
  if (draft.includeNotes?.clean && (source?.cleanText || source?.summary)) {
    notes.push(textNote(`note_clean_${now + 1}`, 'Zusammenfassung des Textes', source.cleanText || source.summary, now + 1));
  }
  if (draft.includeNotes?.raw && source?.originalText) {
    notes.push(textNote(`note_raw_${now + 2}`, 'Roh-Transkription', source.originalText, now + 2));
  }

  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    categoryId: draft.categoryId || 'allgemein',
    phases: draft.phases.map((p) => ({
      title: p.title,
      date: p.date,
      note: '',
      tasks: p.tasks.map((t) => ({ title: t.title, date: t.date, note: '' })),
    })),
    notes,
    inboxItemId: source?.thoughtId,
    keepInboxItem: !!draft.keepThought,
  };
}
