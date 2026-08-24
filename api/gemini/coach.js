// api/gemini/coach.js - Vercel Serverless Function for AI Coach Streaming
import { handleCoachStream } from '../../server/geminiService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Kein GEMINI_API_KEY im Server hinterlegt.' });
  }

  const body = req.body || {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    await handleCoachStream(
      {
        apiKey,
        prompt: body.prompt,
        systemInstruction: body.systemInstruction,
        aiModel: body.aiModel
      },
      (chunkText, fullText) => {
        res.write(`data: ${JSON.stringify({ chunk: chunkText, fullText })}\n\n`);
      }
    );

    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (err) {
    console.error('Gemini Coach Error:', err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'Fehler beim KI-Aufruf' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }
}
