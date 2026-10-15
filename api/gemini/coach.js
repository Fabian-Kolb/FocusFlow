import { handleCoachStream } from '../../server/geminiService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { resolveAiAccess } from '../../server/aiAccess.js';
import { applyGuestQuotaHeaders } from '../../server/guestAiPolicy.js';

function startEventStream(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Anmeldung (Mitglied oder anonymer Gast), Limits und bei Gästen geprüfte Eingaben
  const access = await resolveAiAccess(req, 'coach');
  applyGuestQuotaHeaders(res, access.quota);
  startEventStream(res);

  if (!access.ok) {
    res.write(`data: ${JSON.stringify({ error: access.error, unauthorized: access.unauthorized, rateLimited: access.rateLimited })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const { apiKey, body, guest } = access;

  try {
    await handleCoachStream(
      {
        apiKey,
        prompt: body.prompt || 'Hallo Coach!',
        messages: body.messages,
        systemInstruction: body.systemInstruction,
        aiModel: body.aiModel || 'flash',
        guest
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
