import { handleGenerateReminder } from '../../server/geminiService.js';
import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';
import { resolveAiAccess } from '../../server/aiAccess.js';
import { applyGuestQuotaHeaders } from '../../server/guestAiPolicy.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Anmeldung (Mitglied oder anonymer Gast), Limits und bei Gästen geprüfte Eingaben
  const access = await resolveAiAccess(req, 'generate-reminder');
  applyGuestQuotaHeaders(res, access.quota);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error, unauthorized: access.unauthorized, rateLimited: access.rateLimited });
  }

  const { apiKey, body, guest } = access;

  try {
    const result = await handleGenerateReminder({
      apiKey,
      text: body.text,
      aiModel: body.aiModel || 'flash',
      guest
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Generate Reminder Error:', err);
    return res.status(500).json({ error: err?.message || 'Fehler beim Generieren der Erinnerung' });
  }
}
