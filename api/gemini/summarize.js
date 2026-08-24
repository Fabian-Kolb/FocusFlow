// api/gemini/summarize.js - Vercel Serverless Function for Voice Note Summarization
import { handleSummarize } from '../../server/geminiService.js';
import { checkRateLimit } from '../../server/rateLimiter.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate-Limit Prüfung
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Anfrage-Limit erreicht: Aus Sicherheitsgründen sind maximal ${rateLimit.limit} KI-Anfragen pro 10 Minuten erlaubt. Bitte warte ca. ${rateLimit.minutesLeft} Minute(n).`,
      rateLimited: true
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server: Kein GEMINI_API_KEY in Vercel Environment Variables hinterlegt.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  try {
    const result = await handleSummarize({
      apiKey,
      text: body.text,
      aiModel: body.aiModel || 'flash',
      lengthMode: body.lengthMode
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Summarize Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler bei der Zusammenfassung' });
  }
}
