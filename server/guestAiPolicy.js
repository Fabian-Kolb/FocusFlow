// server/guestAiPolicy.js
// KI für Gäste: begrenzt, günstig und nur serverseitig entschieden.
//
// Sicherheitsprinzipien:
// - Der Server entscheidet alles (Gast-Status, Modell, Limits). Angaben des Clients zählen nicht.
// - Drei Tageslimits: pro Gast-Konto, pro IP-Adresse und für alle Gäste zusammen.
//   Das Gesamtlimit ist die harte Obergrenze, die das Kontingent der Mitglieder schützt.
// - Zähler werden atomar in Firestore erhöht (eindeutiger Zählerstand pro Anfrage, keine Wettläufe).
// - Erst Gast und IP zählen, dann das Gesamtlimit: Ein einzelner Gast kann so höchstens sein
//   eigenes Limit vom gemeinsamen Topf verbrauchen.
// - Fehler beim Zählen führen zur Ablehnung (fail closed).
// - IP-Adressen werden nur als HMAC-Hash gespeichert.

import crypto from 'crypto';
import { firestoreRestIncrement } from './serviceAccountRest.js';

const readLimit = (value, fallback, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : fallback;
};

export function getGuestLimits(env = process.env) {
  return {
    perGuest: readLimit(env.GUEST_AI_PER_GUEST_DAILY, 10, 100),
    perIp: readLimit(env.GUEST_AI_PER_IP_DAILY, 30, 500),
    total: readLimit(env.GUEST_AI_TOTAL_DAILY, 150, 2000)
  };
}

// Eingabegrenzen für Gäste
export const GUEST_INPUT_LIMITS = {
  prompt: 2000,
  messageCount: 10,
  messageLength: 2000,
  messagesTotal: 10000,
  systemInstruction: 24000,
  text: 4000
};

const ALLOWED_ENDPOINTS = ['coach', 'summarize', 'generate-project', 'generate-reminder'];
const LENGTH_MODES = ['compact', 'normal', 'detailed'];
const GRANULARITIES = ['few_phases', 'balanced', 'many_phases'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIREBASE_UID = /^[A-Za-z0-9]{1,128}$/;

const reject = (status, error) => ({ ok: false, status, error });
const str = (value) => (typeof value === 'string' ? value : '');

/**
 * Prüft und kürzt die Anfrage eines Gastes. Nur bekannte Felder werden übernommen;
 * aiModel wird verworfen (Gäste bekommen immer die Lite-Modelle).
 * @returns {{ ok: true, body: object } | { ok: false, status: number, error: string }}
 */
export function sanitizeGuestRequest(endpoint, rawBody) {
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) return reject(404, 'Unbekannte KI-Funktion.');
  const body = rawBody && typeof rawBody === 'object' ? rawBody : {};
  const L = GUEST_INPUT_LIMITS;

  if (endpoint === 'coach') {
    const prompt = str(body.prompt).trim();
    if (!prompt) return reject(400, 'Leere Nachricht.');
    if (prompt.length > L.prompt) {
      return reject(413, `Im Gast-Modus sind Nachrichten auf ${L.prompt} Zeichen begrenzt.`);
    }

    // Verlauf: nur die letzten Nachrichten, jede gekürzt, insgesamt begrenzt (neueste zuerst behalten)
    const history = Array.isArray(body.messages) ? body.messages.slice(-L.messageCount) : [];
    const messages = [];
    let total = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (!m || typeof m !== 'object') continue;
      const content = str(m.content || m.text).slice(0, L.messageLength);
      if (!content.trim()) continue;
      total += content.length;
      if (total > L.messagesTotal) break;
      const role = m.role === 'assistant' || m.role === 'model' || m.sender === 'bot' ? 'assistant' : 'user';
      messages.unshift({ role, content });
    }

    return {
      ok: true,
      body: {
        prompt,
        messages,
        systemInstruction: str(body.systemInstruction).slice(0, L.systemInstruction)
      }
    };
  }

  const text = str(body.text).trim();
  if (!text) return reject(400, 'Kein Text übergeben.');
  if (text.length > L.text) {
    return reject(413, `Im Gast-Modus sind Texte für die KI auf ${L.text} Zeichen begrenzt.`);
  }

  if (endpoint === 'summarize') {
    const lengthMode = LENGTH_MODES.includes(body.lengthMode) ? body.lengthMode : 'normal';
    return { ok: true, body: { text, lengthMode } };
  }

  if (endpoint === 'generate-project') {
    const o = body.options && typeof body.options === 'object' ? body.options : {};
    const options = {
      granularity: GRANULARITIES.includes(o.granularity) ? o.granularity : 'balanced',
      startDate: ISO_DATE.test(str(o.startDate)) ? o.startDate : '',
      endDate: ISO_DATE.test(str(o.endDate)) ? o.endDate : '',
      estimateDates: o.estimateDates !== false
    };
    return { ok: true, body: { text, options } };
  }

  return { ok: true, body: { text } };
}

/** Kalendertag in Deutschland (YYYY-MM-DD), damit „heute“ für Nutzer stimmt */
export function berlinDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Client-IP. Auf Vercel setzt die Plattform x-real-ip / x-forwarded-for selbst.
 * Ohne IP landen alle in einem gemeinsamen Topf (strenger, nicht lockerer).
 */
export function getClientIp(req) {
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/** IP nur als HMAC-Hash speichern (nicht umkehrbar ohne Server-Geheimnis) */
export function hashIp(ip, secret) {
  return crypto.createHmac('sha256', secret || 'focusflow-guest').update(String(ip)).digest('hex').slice(0, 32);
}

/** Zähler-Speicher in Firestore (Collection guest_ai_usage, für Clients gesperrt) */
export const firestoreQuotaStore = {
  async increment(ids, day) {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return firestoreRestIncrement(ids.map((id) => `guest_ai_usage/${id}`), { day, expiresAt });
  }
};

/** Nur für den lokalen Dev-Server und Tests */
export function createMemoryQuotaStore() {
  const counts = new Map();
  return {
    async increment(ids) {
      return ids.map((id) => {
        const next = (counts.get(id) || 0) + 1;
        counts.set(id, next);
        return next;
      });
    }
  };
}

const LIMIT_MESSAGES = {
  guest: (limit) => `Dein Gast-Kontingent für heute ist aufgebraucht (${limit} KI-Aktionen). Morgen geht es weiter.`,
  ip: () => 'Aus deinem Netzwerk kamen heute schon zu viele Gast-Anfragen. Morgen geht es weiter.',
  total: () => 'Die KI für Gäste hat ihr Tageslimit erreicht. Morgen geht es weiter.'
};

/**
 * Verbraucht eine KI-Aktion eines Gastes.
 * @returns {Promise<{ allowed: true, remaining: number, limit: number } |
 *   { allowed: false, status: number, reason: string, error: string, remaining: number, limit: number }>}
 */
export async function consumeGuestQuota({ uid, ip, secret, store = firestoreQuotaStore, limits = getGuestLimits(), now = new Date() }) {
  const limit = limits.perGuest;
  const unavailable = {
    allowed: false,
    status: 503,
    reason: 'unavailable',
    error: 'Die KI für Gäste ist gerade nicht verfügbar. Bitte versuch es später noch einmal.',
    remaining: 0,
    limit
  };

  if (typeof uid !== 'string' || !FIREBASE_UID.test(uid)) {
    return { ...unavailable, status: 401, reason: 'invalid_uid', error: 'Nicht autorisiert: Ungültiges Gast-Konto.' };
  }

  const day = berlinDay(now);
  const deny = (reason, remaining = 0) => ({
    allowed: false,
    status: 429,
    reason,
    error: LIMIT_MESSAGES[reason](limit),
    remaining,
    limit
  });

  try {
    // Stufe 1: pro Gast und pro IP
    const [perGuest, perIp] = await store.increment([`${day}_g_${uid}`, `${day}_ip_${hashIp(ip, secret)}`], day);
    if (perGuest > limits.perGuest) return deny('guest');
    const remaining = Math.max(0, limits.perGuest - perGuest);
    if (perIp > limits.perIp) return deny('ip', remaining);

    // Stufe 2: gemeinsamer Topf aller Gäste
    const [total] = await store.increment([`${day}_all`], day);
    if (total > limits.total) return deny('total', remaining);

    return { allowed: true, remaining, limit };
  } catch (err) {
    console.error('[guestAiPolicy] Zähler nicht erreichbar, Gast-Anfrage abgelehnt:', err?.message);
    return unavailable;
  }
}

/** Kontingent für die App mitschicken (gleiche Herkunft, kein CORS-Expose nötig) */
export function applyGuestQuotaHeaders(res, quota) {
  if (!quota) return;
  res.setHeader('X-Guest-Ai-Remaining', String(quota.remaining));
  res.setHeader('X-Guest-Ai-Limit', String(quota.limit));
}
