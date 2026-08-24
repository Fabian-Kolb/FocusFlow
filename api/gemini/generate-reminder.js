// api/gemini/generate-reminder.js - Vercel Serverless Function for AI Reminder Generation
import { handleGenerateReminder } from '../../server/geminiService.js';

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
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const result = await handleGenerateReminder({
      apiKey,
      text: body.text,
      aiModel: body.aiModel
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Generate Reminder Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Generieren der Erinnerung' });
  }
}
