import { handleCoachStream } from '../../server/geminiService.js';
import { checkRateLimit } from '../../server/rateLimiter.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { verifyAuthToken } from '../../server/authHelper.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authentifizierung prüfen
  let user = null;
  try {
    user = await verifyAuthToken(req);
  } catch (authErr) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ error: authErr.message || 'Nicht autorisiert', unauthorized: true })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  // 2. Rate-Limit Prüfung
  const rateLimit = checkRateLimit(req, user);
  if (!rateLimit.allowed) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    const msg = `Anfrage-Limit erreicht: Aus Sicherheitsgründen sind maximal ${rateLimit.limit} KI-Anfragen pro 10 Minuten erlaubt. Bitte warte ca. ${rateLimit.minutesLeft} Minute(n).`;
    res.write(`data: ${JSON.stringify({ error: msg, rateLimited: true })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.write(`data: ${JSON.stringify({ error: 'Server: Kein GEMINI_API_KEY in Vercel Environment Variables hinterlegt.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    await handleCoachStream(
      {
        apiKey,
        prompt: body.prompt || 'Hallo Coach!',
        messages: body.messages,
        systemInstruction: body.systemInstruction,
        aiModel: body.aiModel || 'flash'
      },
      (chunkText, fullText) => {
        res.write(`data: ${JSON.stringify({ chunk: chunkText, fullText })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      }
    );

    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (err) {
    console.error('Gemini Coach Error:', err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'Fehler beim KI-Coach Aufruf.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }
}
