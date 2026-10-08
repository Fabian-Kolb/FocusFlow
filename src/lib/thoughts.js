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
