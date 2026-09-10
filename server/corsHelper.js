// server/corsHelper.js
// Central CORS & Security Headers helper for FocusFlow Vercel Serverless & Node backends

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://focusflow-d5a55.web.app',
  'https://focusflow-d5a55.firebaseapp.com',
  'https://focusflow-me.vercel.app'
];

/**
 * Applies security and CORS headers to the response.
 * Handles OPTIONS preflight automatically.
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {string} allowedMethods - Comma-separated allowed HTTP methods
 * @returns {boolean} true if preflight OPTIONS was handled and response ended
 */
export function applyCorsAndSecurityHeaders(req, res, allowedMethods = 'GET, POST, PATCH, PUT, DELETE, OPTIONS') {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
