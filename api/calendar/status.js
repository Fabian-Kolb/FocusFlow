import { applyCorsAndSecurityHeaders } from '../../server/corsHelper.js';

export default async function handler(req, res) {
  if (applyCorsAndSecurityHeaders(req, res, 'GET, OPTIONS')) {
    return;
  }

  const uid = req.query.uid;
  // If no UID is provided, default to disconnected
  if (!uid) {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({ connected: false });
}
