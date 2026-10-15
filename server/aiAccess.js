// server/aiAccess.js
// Gemeinsame Zugangsprüfung für alle KI-Endpunkte (api/gemini/*).
// Reihenfolge: Token prüfen → Burst-Limit → API-Key → Body → bei Gästen: Eingaben prüfen, dann Kontingent.
// Ungültige Anfragen verbrauchen so kein Gast-Kontingent.

import { authorizeAiCaller } from './authHelper.js';
import { checkRateLimit } from './rateLimiter.js';
import { sanitizeGuestRequest, consumeGuestQuota, getClientIp, getGuestLimits, firestoreQuotaStore } from './guestAiPolicy.js';

function parseBody(req) {
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

/**
 * @returns {Promise<
 *   { ok: true, apiKey: string, body: object, guest: boolean, quota: object | null } |
 *   { ok: false, status: number, error: string, unauthorized?: boolean, rateLimited?: boolean, quota?: object }
 * >}
 */
export async function resolveAiAccess(req, endpoint, deps = {}) {
  const {
    authorize = authorizeAiCaller,
    quotaStore = firestoreQuotaStore,
    env = process.env
  } = deps;

  let caller;
  try {
    caller = await authorize(req);
  } catch (authErr) {
    return { ok: false, status: authErr.statusCode || 401, error: authErr.message || 'Nicht autorisiert', unauthorized: true };
  }

  const isGuest = caller.kind === 'guest';

  // Burst-Schutz: Gäste nach IP (15 pro 10 Minuten), Mitglieder nach Konto
  const rateLimit = checkRateLimit(req, isGuest ? null : caller);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      rateLimited: true,
      error: `Anfrage-Limit erreicht: Aus Sicherheitsgründen sind maximal ${rateLimit.limit} KI-Anfragen pro 10 Minuten erlaubt. Bitte warte ca. ${rateLimit.minutesLeft} Minute(n).`
    };
  }

  const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: 'Server: Kein GEMINI_API_KEY in den Umgebungsvariablen hinterlegt.' };
  }

  const body = parseBody(req);
  if (!isGuest) {
    return { ok: true, apiKey, body, guest: false, quota: null };
  }

  const sanitized = sanitizeGuestRequest(endpoint, body);
  if (!sanitized.ok) return { ok: false, status: sanitized.status, error: sanitized.error };

  const quota = await consumeGuestQuota({
    uid: caller.uid,
    ip: getClientIp(req),
    secret: env.GUEST_AI_HASH_SECRET || apiKey,
    store: quotaStore,
    limits: getGuestLimits(env)
  });
  if (!quota.allowed) {
    return { ok: false, status: quota.status, error: quota.error, rateLimited: quota.status === 429, quota };
  }

  return { ok: true, apiKey, body: sanitized.body, guest: true, quota };
}
