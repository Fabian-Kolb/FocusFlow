import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'POST, OPTIONS')) {
    return;
  }

  return res.status(200).json({ success: true, connected: false });
}
