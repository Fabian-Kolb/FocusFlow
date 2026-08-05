import { GoogleGenerativeAI } from '@google/generative-ai';

const getApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || '';

const FALLBACK_MODELS = {
  flash: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  'flash-lite': ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash'],
  'eco': ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']
};

function getFallbackChain(modelName) {
  if (FALLBACK_MODELS[modelName]) return FALLBACK_MODELS[modelName];

  for (const models of Object.values(FALLBACK_MODELS)) {
    const index = models.indexOf(modelName);
    if (index !== -1) {
      return models.slice(index);
    }
  }
  return [modelName];
}

async function executeWithFallback(apiKey, modelType, systemInstruction, executeFn) {
  const models = getFallbackChain(modelType);
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
      });
      // console.log(`Versuche Modell: ${modelName}`); // Optional debug
      return await executeFn(model, modelName);
    } catch (error) {
      console.warn(`Modell ${modelName} fehlgeschlagen, versuche nächstes... Fehler:`, error?.message || error);
      lastError = error;
      // Continue to the next model in the fallback array
    }
  }
  throw lastError || new Error("Alle Fallback-Modelle sind fehlgeschlagen.");
}

export async function askGeminiCoach({ prompt, systemInstruction, onChunk, aiModel = 'flash' }) {
  const apiKey = getApiKey();

  if (!apiKey || apiKey === 'dein_gemini_api_key_hier') {
    throw new Error('VITE_GEMINI_API_KEY fehlt in der .env.local Datei.');
  }

  return executeWithFallback(apiKey, aiModel, systemInstruction, async (model) => {
    const resultStream = await model.generateContentStream(prompt);
    let fullText = '';
    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullText += chunkText;
        if (onChunk) onChunk(fullText);
      }
    }
    return fullText;
  });
}

export function ensureBulletPoints(rawText) {
  if (!rawText || typeof rawText !== 'string') return rawText || '';

  const lines = rawText.split('\n');
  const processedLines = lines.map(line => {
    if (!line.trim()) return line;

    // Preserve leading indentation
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    let content = line.slice(indent.length).trim();

    // 1. Strip heading hashes (#{1,6}\s*) and convert to bold bullet points - **Heading**
    const headingMatch = content.match(/^#{1,6}\s*(.+)$/);
    if (headingMatch) {
      let headingText = headingMatch[1].trim();
      if (headingText.startsWith('**') && headingText.endsWith('**') && headingText.length > 4) {
        headingText = headingText.slice(2, -2).trim();
      }
      return `${indent}- **${headingText}**`;
    }

    // 2. Normalize emoji-before-dash syntax (e.g. "🔴 - " or "🔴-") to "- 🔴 "
    const emojiBeforeDashMatch = content.match(/^(\p{Extended_Pictographic}+)\s*[-*+]\s*(.*)$/u);
    if (emojiBeforeDashMatch) {
      const emoji = emojiBeforeDashMatch[1];
      const rest = emojiBeforeDashMatch[2].trim();
      return `${indent}- ${emoji} ${rest}`;
    }

    // 3. Normalize non-standard list markers (* , + , \d+\. ) to -
    const listMarkerMatch = content.match(/^(?:\*|\+|\d+\.)\s*(.*)$/);
    if (listMarkerMatch) {
      content = listMarkerMatch[1].trim();
      const subEmojiMatch = content.match(/^(\p{Extended_Pictographic}+)\s*[-*+]\s*(.*)$/u);
      if (subEmojiMatch) {
        const emoji = subEmojiMatch[1];
        const rest = subEmojiMatch[2].trim();
        return `${indent}- ${emoji} ${rest}`;
      }
      return `${indent}- ${content}`;
    }

    // 4. If line does not start with "- ", prepend "- "
    if (!content.startsWith('- ')) {
      if (content.startsWith('-')) {
        content = content.slice(1).trim();
      }
      return `${indent}- ${content}`;
    }

    return `${indent}${content}`;
  });

  return processedLines.join('\n');
}

export async function summarizeVoiceNote(text, aiModel = 'eco', lengthMode = 'normal') {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  let lengthInstruction = "";
  if (lengthMode === 'compact') {
    lengthInstruction = "Fasse die Informationen EXTREM KURZ UND KOMPAKT zusammen. Nutze nur absolute Schlüsselwörter in den Stichpunkten. Lass jegliche Ausschmückung weg.";
  } else if (lengthMode === 'detailed') {
    lengthInstruction = "Fasse die Informationen AUSFÜHRLICH UND DETAILLIERT zusammen. Erhalte alle Nuancen und Nebeninformationen der Sprachnotiz in der Struktur.";
  } else {
    lengthInstruction = "Fasse die Informationen PRÄZISE zusammen. Behalte alle wichtigen Details, aber komprimiere sie auf das Wesentliche.";
  }

  const systemInstruction = `Du bist ein Assistent, der Eingabetexte in strikt strukturierte Markdown-Stichpunkte verwandelt.

FORMATREGELN (STRIKT EINHALTEN):
- GENERIERE IMMER EINE KURZE ÜBERSCHRIFT (max. 3-5 Wörter) als allererste Zeile. Formatiere sie zwingend als fette H3-Überschrift (z.B. ### **Meine Überschrift**), und NICHT als Listenpunkt. Darunter folgen die Stichpunkte.
- Auch Kategorie-Überschriften müssen als Fett-Stichpunkte formatiert sein (z. B. "- 🛒 **Einkaufen**" oder "- 📋 **Arbeit**").
- Nutze Stichpunkte und eingerückte Unterstichpunkte 
- Nutze **Fettdruck** für Schlüsselbegriffe, Kategorien und Deadlines.
- Kein Fließtext, keine Nummerierung, keine Einleitungssätze, keine Überschriften mit #.
- ${lengthInstruction}`;

  try {
    return await executeWithFallback(apiKey, aiModel, systemInstruction, async (model) => {
      const result = await model.generateContent(text);
      const rawOutput = result.response.text().trim();
      return ensureBulletPoints(rawOutput);
    });
  } catch (error) {
    console.error("Fehler bei der Zusammenfassung (nach allen Fallbacks):", error);
    return null;
  }
}

export async function generateProjectStructure(text, aiModel = 'eco') {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const systemInstruction = `Du bist ein Projekt-Management Assistent.
Analysiere den folgenden Text und erstelle eine JSON-Struktur für ein Projekt.
Das JSON muss exakt dieses Format haben:
{
  "title": "Kurzer, prägnanter Projektname",
  "description": "Der ursprüngliche Text sinnvoll aufbereitet als Beschreibung",
  "phases": [
    {
      "title": "Name der Phase (z.B. Vorbereitung & Analyse)",
      "tasks": [
        { "title": "Erste Unteraufgabe dieser Phase" },
        { "title": "Zweite Unteraufgabe dieser Phase" }
      ]
    }
  ]
}
Wenn der Text nur kurz ist, generiere trotzdem eine logische Phasen- und Taskstruktur (mindestens 1-2 Phasen mit je 2-3 Tasks), die zur Erreichung des Projektziels sinnvoll ist.
Gib NUR das JSON zurück, ohne Markdown-Blöcke oder zusätzlichen Text.`;

  try {
    return await executeWithFallback(apiKey, aiModel, systemInstruction, async (model) => {
      const result = await model.generateContent(text);
      const rawOutput = result.response.text().trim();
      let cleaned = rawOutput;
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
      return JSON.parse(cleaned.trim());
    });
  } catch (error) {
    console.error("Fehler bei generateProjectStructure:", error);
    return null;
  }
}

export async function generateReminderStructure(text, aiModel = 'eco') {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const systemInstruction = `Du bist ein Produktivitäts-Assistent.
Analysiere den folgenden Text und erstelle eine JSON-Struktur für eine Erinnerung.
Das JSON muss exakt dieses Format haben:
{
  "title": "Kurzer, prägnanter Titel für die Erinnerung",
  "description": "Der ursprüngliche Text sinnvoll aufbereitet als Notiz/Beschreibung"
}
Gib NUR das JSON zurück, ohne Markdown-Blöcke oder zusätzlichen Text.`;

  try {
    return await executeWithFallback(apiKey, aiModel, systemInstruction, async (model) => {
      const result = await model.generateContent(text);
      const rawOutput = result.response.text().trim();
      let cleaned = rawOutput;
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
      return JSON.parse(cleaned.trim());
    });
  } catch (error) {
    console.error("Fehler bei generateReminderStructure:", error);
    return null;
  }
}
