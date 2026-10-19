import { summarizeVoiceNote, ensureBulletPoints } from './gemini';

// Länger wartet niemand beim schnellen Erfassen – danach wird ohne Zusammenfassung gespeichert
const SUMMARY_TIMEOUT_MS = 15000;

/**
 * Baut aus einem frei eingegebenen Text die Daten für einen Gedanken (Firestore-Collection `inboxItems`).
 * Mit `summarize` fasst die KI zusammen, bereinigt den Text und erkennt Zeitangaben.
 * Ohne KI bzw. bei kurzen Texten (≤ 20 Zeichen) wird der Text unverändert übernommen.
 */
export async function buildThought(text, { summarize = true, model = 'eco', length = 'normal', timeoutMs = SUMMARY_TIMEOUT_MS } = {}) {
  const thought = {
    title: text.split('\n')[0].substring(0, 40),
    summary: ensureBulletPoints(text),
    originalText: text,
    cleanText: null,
    extractedDateType: null,
    extractedDate: null,
    extractedEndDate: null,
    extractedTime: null,
    createdAt: Date.now(),
    type: 'unclassified',
  };

  if (!summarize || text.length <= 20) return thought;

  try {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const result = await Promise.race([summarizeVoiceNote(text, model, length), timeout]);
    if (result) {
      thought.summary = result.summary;
      thought.title = result.title || thought.title;
      thought.cleanText = result.cleanText || null;
      thought.extractedDateType = result.extractedDateType || null;
      thought.extractedDate = result.extractedDate || null;
      thought.extractedEndDate = result.extractedEndDate || null;
      thought.extractedTime = result.extractedTime || null;
    }
  } catch (e) {
    // Gedanke trotzdem speichern – nur ohne Zusammenfassung
    console.error(e);
  }
  return thought;
}

/** Anzahl offener Gedanken über alle Zeit-Gruppen (`inboxItems` ist nach heute/gestern/... gruppiert) */
export function countThoughts(inboxItems) {
  return Object.values(inboxItems || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const parseDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const dayWord = (date, now) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date - today) / DAY_MS);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};

/**
 * Die von der KI erkannte Zeitangabe eines Gedankens als kurzes Etikett für die Karte:
 * { label, icon, tone } oder null. Termin = feste Uhrzeit („Termin · Morgen, 10:00“),
 * Zeitraum = von–bis, sonst Frist („Bis Fr., 23. Okt.“). Heute = warning, vorbei = danger.
 */
export function thoughtWhen(item, now = new Date()) {
  const start = parseDay(item?.extractedDate);
  if (!start) return null;
  const end = parseDay(item?.extractedEndDate);
  const time = item?.extractedTime ? `, ${item.extractedTime}` : '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last = end && end > start ? end : start;
  const tone = last < today ? 'danger' : (start <= today && last >= today) ? 'warning' : 'neutral';

  if (item.extractedDateType === 'timeframe' || (end && end.getTime() !== start.getTime())) {
    return { label: `${dayWord(start, now)} – ${dayWord(last, now)}`, icon: 'date_range', tone };
  }
  if (item.extractedDateType === 'appointment') {
    return { label: `Termin · ${dayWord(start, now)}${time}`, icon: 'event', tone };
  }
  return { label: `Bis ${dayWord(start, now)}${time}`, icon: 'flag', tone };
}

/** Kurzvorschau für die Karte: Markdown weg, Stichpunkte mit „ · “ verbunden */
export function thoughtPreview(body) {
  return String(body || '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+\.\s+|#{1,6}\s*)/, '').replace(/[*_`>]/g, '').trim())
    .filter(Boolean)
    .join(' · ');
}
