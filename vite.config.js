import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleCoachStream, handleSummarize, handleGenerateProject, handleGenerateReminder } from './server/geminiService.js';

function geminiApiPlugin(apiKey) {
  return {
    name: 'gemini-api-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/gemini/')) {
          return next();
        }

        const endpoint = req.url.replace('/api/gemini/', '').split('?')[0];

        // Parse JSON body
        let body = {};
        if (req.method === 'POST') {
          try {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            if (rawBody) {
              body = JSON.parse(rawBody);
            }
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Ungültiger JSON-Body: ' + err.message }));
          }
        }

        const key = apiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!key) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Server: Kein Gemini API-Key in Umgebungsvariablen gefunden.' }));
        }

        try {
          if (endpoint === 'coach') {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            await handleCoachStream(
              {
                apiKey: key,
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
              apiKey: key,
              text: body.text,
              aiModel: body.aiModel,
              lengthMode: body.lengthMode
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(result));
          }

          if (endpoint === 'generate-project') {
            const result = await handleGenerateProject({
              apiKey: key,
              text: body.text,
              options: body.options,
              aiModel: body.aiModel
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(result));
          }

          if (endpoint === 'generate-reminder') {
            const result = await handleGenerateReminder({
              apiKey: key,
              text: body.text,
              aiModel: body.aiModel
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(result));
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Unbekannter Gemini-Endpunkt: ' + endpoint }));
        } catch (err) {
          console.error('[Gemini Proxy Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err?.message || 'Interner Server-Fehler beim KI-Aufruf.' }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';

  return {
    plugins: [
      react(),
      geminiApiPlugin(apiKey)
    ]
  };
});
