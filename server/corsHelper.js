// server/corsHelper.js
// Central CORS & Security Headers helper for FocusFlow Vercel Serverless & Node backends

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

  if (origin) {
    // Dynamic origin matching with Vary header
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Direct or same-origin requests without Origin header
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
