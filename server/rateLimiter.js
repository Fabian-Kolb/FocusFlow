// server/rateLimiter.js - In-Memory IP Rate Limiter for Vercel Serverless Functions

const rateLimitMap = new Map();
const WINDOW_MS = 10 * 60 * 1000; // 10 Minuten Zeitfenster
const GUEST_MAX_REQUESTS = 15; // Maximal 15 Anfragen pro 10 Minuten für Gäste
const AUTH_MAX_REQUESTS = 100; // 100 Anfragen für angemeldete Nutzer

/**
 * Überprüft das Rate-Limit basierend auf der IP-Adresse des Anfragenden.
 * @param {object} req - HTTP Request Objekt
 * @returns {{ allowed: boolean, minutesLeft?: number, limit?: number }}
 */
export function checkRateLimit(req) {
  // Wenn ein echtes Firebase-Token übergeben wurde, gilt das höhere Limit
  const authHeader = req.headers.authorization;
  const isAuth = Boolean(authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 50);
  const limit = isAuth ? AUTH_MAX_REQUESTS : GUEST_MAX_REQUESTS;

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || 
             req.headers['x-real-ip'] || 
             req.socket?.remoteAddress || 
             'anonymous_ip';

  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  // Zeitfenster abgelaufen -> Reset
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + WINDOW_MS;
  }

  record.count += 1;
  rateLimitMap.set(ip, record);

  // Periodisches Aufräumen alter Einträge bei hohem Traffic
  if (rateLimitMap.size > 2000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }

  if (record.count > limit) {
    const minutesLeft = Math.max(1, Math.ceil((record.resetAt - now) / 60000));
    return {
      allowed: false,
      minutesLeft,
      limit
    };
  }

  return { allowed: true, remaining: limit - record.count };
}
