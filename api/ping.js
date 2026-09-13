// api/ping.js - Vercel Serverless Diagnostics Endpoint
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  return res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    node: process.version,
    env: {
      hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID),
      hasGoogleSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      hasFirebaseProjectId: Boolean(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID)
    }
  });
}
