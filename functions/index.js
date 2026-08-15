import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { handleCoachStream, handleSummarize, handleGenerateProject, handleGenerateReminder } from '../server/geminiService.js';

initializeApp();
const auth = getAuth();
const db = getFirestore();

export const api = onRequest({ region: 'europe-west3', cors: true, maxInstances: 10 }, async (req, res) => {
  // CORS Preflight Handling
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const url = req.url || '';
  const endpoint = url.replace('/api/gemini/', '').replace('/gemini/', '').replace('/api/', '').split('?')[0];

  // 1. Zwingende Authentifizierung über Firebase ID-Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Nicht autorisiert: Fehlendes oder ungültiges Authentifizierungs-Token.' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  let userEmail = '';
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    userEmail = decodedToken.email ? decodedToken.email.trim().toLowerCase() : '';
  } catch (authErr) {
    res.status(401).json({ error: 'Ungültiges Authentifizierungs-Token: ' + authErr.message });
    return;
  }

  // 2. Zwingende Whitelist-Prüfung auf dem Server
  if (!userEmail) {
    res.status(403).json({ error: 'Zugriff verweigert: Keine verifizierte E-Mail-Adresse im Token vorhanden.' });
    return;
  }

  const whitelistDoc = await db.collection('whitelist').doc(userEmail).get();
  if (!whitelistDoc.exists) {
    res.status(403).json({ error: 'Zugriff verweigert: Dein Account ist nicht auf der Whitelist freigeschaltet.' });
    return;
  }

  // 3. API-Key Prüfung
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server-Konfigurationsfehler: Kein GEMINI_API_KEY hinterlegt.' });
    return;
  }

  try {
    const body = req.body || {};

    if (endpoint === 'coach') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

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

      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    if (endpoint === 'summarize') {
      const result = await handleSummarize({
        apiKey,
        text: body.text,
        aiModel: body.aiModel,
        lengthMode: body.lengthMode
      });
      return res.status(200).json(result);
    }

    if (endpoint === 'generate-project') {
      const result = await handleGenerateProject({
        apiKey,
        text: body.text,
        options: body.options,
        aiModel: body.aiModel
      });
      return res.status(200).json(result);
    }

    if (endpoint === 'generate-reminder') {
      const result = await handleGenerateReminder({
        apiKey,
        text: body.text,
        aiModel: body.aiModel
      });
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: 'Unbekannter API-Endpunkt: ' + endpoint });
  } catch (err) {
    console.error('[Cloud Function Gemini Error]:', err);
    return res.status(500).json({ error: err?.message || 'Interner Server-Fehler beim KI-Aufruf.' });
  }
});
