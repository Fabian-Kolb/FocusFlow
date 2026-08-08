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
  const processedLines = lines.map((line, index) => {
    if (!line.trim()) return line;

    // Preserve leading indentation
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    let content = line.slice(indent.length).trim();

    // 1. Preserve Markdown headings (### ...) without turning into bullet points
    if (content.match(/^#{1,6}\s+/)) {
      return line;
    }

    // 2. Preserve italic subtitle lines (*...* or _..._) on line 1 or 2 without prepending bullet points
    if ((index === 0 || index === 1) && ((content.startsWith('*') && content.endsWith('*') && !content.startsWith('* ')) || (content.startsWith('_') && content.endsWith('_')))) {
      return line;
    }

    // 3. Preserve first line if it's formatted as title without bullet points
    if (index === 0 && (!content.startsWith('- ') && !content.startsWith('* ') && !content.startsWith('+ '))) {
      return content;
    }

    // 4. Normalize emoji-before-dash syntax (e.g. "🔴 - " or "🔴-") to "- 🔴 "
    const emojiBeforeDashMatch = content.match(/^(\p{Extended_Pictographic}+)\s*[-*+]\s*(.*)$/u);
    if (emojiBeforeDashMatch) {
      const emoji = emojiBeforeDashMatch[1];
      const rest = emojiBeforeDashMatch[2].trim();
      return `${indent}- ${emoji} ${rest}`;
    }

    // 5. Normalize non-standard list markers (* , + , \d+\. ) - REQUIRES space after marker so *Italic* text is NOT matched
    const listMarkerMatch = content.match(/^(?:\*|\+|\d+\.)\s+(.*)$/);
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

    // 6. If line does not start with "- ", prepend "- "
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

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const daysOfWeek = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const dayName = daysOfWeek[today.getDay()];

  let maxBullets = "1 bis 2 dichte Stichpunkte";
  let emojiInstruction = "";
  if (lengthMode === 'compact') {
    maxBullets = "maximal 1 bis 2 sehr kurze, extrem verdichtete Stichpunkte";
    emojiInstruction = "VERWENDE KEINERLEI EMOJIS! Halte den Text schlicht, sauber und frei von Emojis.";
  } else if (lengthMode === 'detailed') {
    maxBullets = "3 bis 4 Stichpunkte";
    emojiInstruction = "NUTZE PASSENDE EMOJIS an den Hauptstichpunkten (z. B. 🛠, 📋, 💡, 📱, ⚙️, 🚀), um die Notiz visuell ansprechend zu gliedern.";
  } else {
    maxBullets = "max. 2 bis 3 komprimierte Stichpunkte";
    emojiInstruction = "NUTZE PASSENDE EMOJIS an den Hauptstichpunkten (z. B. 🛠, 📋, 💡, 📱, ⚙️, 🚀), um die Notiz visuell ansprechend zu gliedern.";
  }

  const systemInstruction = `Du bist ein präziser Zusammenfassungs-Assistent für FocusFlow.
HEUTE IST: ${dateStr} (${dayName}).

STRIKTES VERBOT VON ERFINDUNGEN & HALLUZINATIONEN (SEHR WICHTIG!):
- Fasse AUSSCHLIESSLICH die Fakten zusammen, die der User tatsächlich im Text genannt hat!
- ERFINDE KEINE NEUEN FEATURES, technische Anforderungen, Sicherheits-Layer, Sprachübersetzungen oder Termine/Deadlines, die der User NICHT im Text gesagt hat.

BEREINIGTER FLIESSTEXT (cleanText):
- Erstelle eine überarbeitete, perfekt lesbare Fließtext-Version des eingegebenen/gesprochenen Originaltextes.
- ENTFERNE ALLE FÜLLWÖRTER (wie "ähm", "hm", "halt", "sozusagen", "wie gesagt", "äh", etc.), Versprecher, Stotterer und unnötige Satzwiederholungen.
- Halte den Fließtext so nah wie möglich am gesprochenen Inhalt und Wortlaut des Users, aber mache ihn grammatikalisch sauber und flüssig zu lesen.

FORMAT- & STRUKTURREGELN:
1. ZEILE 1 (Haupttitel): "### **Prägnanter Titel**". KEIN Listenpunkt "-"!
2. ZEILE 2 (Optionaler Untertitel): Falls sinnvoll, ein kleiner kursiver Untertitel direkt darunter: "*Kernziel oder Zusammenfassung in einem Satz*". KEIN Listenpunkt "-"!
3. STICHPUNKTE:
   - Maximal ${maxBullets}.
   - Verdichte zusammengehörige Punkte in Klammern oder Kommas (z. B. "- 🛠 **Funktionen**: KI-Zusammenfassung von Texten (Inhaltsanalyse, Extraktion, Stilanpassung)").
   - ${emojiInstruction}
4. KEINE DATUMS- & UHRZEIT-REDUNDANZ IM TEXT:
   - Da extrahierte Daten und Uhrzeiten automatisch oben als Badge über der Notiz gerendert werden, WIEDERHOLE DAS DATUM ODER DIE UHRZEIT NICHT MEHR EXPLIZIT IM TEXT DER STICHPUNKTE ODER IM TITEL! Halte den Zusammenfassungstext rein auf die inhaltlichen Aufgaben/Gedanken fokussiert.

METADATEN-EXTRAKTION (STRIKT NUR WENN IM TEXT ERWÄHNT, SONST NULL):
- extractedDateType: Bestimme die Art der Zeitangabe:
  - "timeframe": Wenn ein Zeitraum/Spanne genannt wurde (z.B. "vom 10. bis 15. August", "nächste Woche Montag bis Mittwoch", "über das Wochenende").
  - "appointment": Wenn ein konkreter Termin/Uhrzeit genannt wurde (z.B. "am 15.08. um 14 Uhr", "Termin morgen um 10:30").
  - "deadline": Wenn eine Frist/Fälligkeit genannt wurde (z.B. "bis Freitag fertigstellen", "spätestens 15. August").
  - null: Falls KEINE Zeitangabe im Text steht.
- extractedDate: "YYYY-MM-DD" (Konkretes Datum oder Startdatum des Zeitraums relativ zu HEUTE ${dateStr}).
- extractedEndDate: "YYYY-MM-DD" (NUR bei "timeframe", wenn ein Enddatum genannt wurde, sonst null).
- extractedTime: "HH:MM" (Uhrzeit 24h, NUR falls konkret genannt, sonst null).

GIB AUSSCHLIESSLICH SAUBERES JSON ZURÜCK:
{
  "title": "Titel ohne Markdown",
  "cleanText": "Überarbeiteter Fließtext ohne Füllwörter und Stotterer...",
  "extractedDateType": "deadline" | "appointment" | "timeframe" | null,
  "extractedDate": "YYYY-MM-DD" | null,
  "extractedEndDate": "YYYY-MM-DD" | null,
  "extractedTime": "HH:MM" | null,
  "summary": "### **Titel**\\n*Kursiver Untertitel*\\n- 🛠 **Kategorie**: Hauptpunkt (Detail 1, Detail 2)"
}`;

  try {
    return await executeWithFallback(apiKey, aiModel, systemInstruction, async (model) => {
      const result = await model.generateContent(text);
      const rawOutput = result.response.text().trim();
      
      let cleaned = rawOutput;
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
      cleaned = cleaned.trim();

      try {
        const parsed = JSON.parse(cleaned);
        return {
          title: parsed.title || '',
          cleanText: parsed.cleanText || null,
          extractedDateType: parsed.extractedDateType || null,
          extractedDate: parsed.extractedDate || null,
          extractedEndDate: parsed.extractedEndDate || null,
          extractedTime: parsed.extractedTime || null,
          summary: ensureBulletPoints(parsed.summary || '')
        };
      } catch (e) {
        // Fallback if JSON parsing fails
        const formattedSummary = ensureBulletPoints(rawOutput);
        const firstLine = formattedSummary.split('\n')[0].replace(/^#{1,6}\s*/, '').replace(/\*/g, '').trim();
        return {
          title: firstLine || 'Gedanke',
          cleanText: null,
          extractedDateType: null,
          extractedDate: null,
          extractedEndDate: null,
          extractedTime: null,
          summary: formattedSummary
        };
      }
    });
  } catch (error) {
    console.error("Fehler bei der Zusammenfassung (nach allen Fallbacks):", error);
    return null;
  }
}

export async function generateProjectStructure(text, options = {}, aiModel = 'eco') {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const {
    granularity = 'balanced',
    startDate = '',
    endDate = '',
    estimateDates = true
  } = typeof options === 'object' && options ? options : {};

  let structureRules = 'Erstelle eine ausgewogene Struktur mit ca. 3-4 Phasen und je 2-4 Aufgaben.';
  if (granularity === 'few_phases') {
    structureRules = 'Erstelle WENIGE Phasen (z.B. 2 Phasen), aber dafür MEHR Aufgaben pro Phase (z.B. 5-7 Aufgaben pro Phase).';
  } else if (granularity === 'many_phases') {
    structureRules = 'Erstelle MEHRERE Phasen (z.B. 5-6 Phasen), aber dafür WENIGER Aufgaben pro Phase (z.B. 1-2 Aufgaben pro Phase).';
  }

  let dateRules = '';
  if (estimateDates && (startDate || endDate)) {
    dateRules = `Das Projekt besitzt den Zeitraum vom ${startDate || 'heute'} bis ${endDate || 'in der Zukunft'}. Trage für jede Phase (Feld "date", YYYY-MM-DD) und jede Aufgabe (Feld "date", YYYY-MM-DD) logische, gleichmäßig verteilte geschätzte Daten innerhalb dieses Zeitraums ein.`;
  } else {
    dateRules = 'Lass das Feld "date" bei Phasen und Aufgaben leer ("").';
  }

  const systemInstruction = `Du bist ein erfahrener Projekt-Management Assistent.
Analysiere den folgenden Text und erstelle eine hochprofessionelle Phasen- und Aufgabenstruktur für ein Projekt.

STRENG EINZUHALTENDE VORGABEN:
- ${structureRules}
- ${dateRules}

Das JSON muss exakt dieses Format haben:
{
  "phases": [
    {
      "title": "Name der Phase",
      "date": "YYYY-MM-DD",
      "tasks": [
        { "title": "Aufgabe 1", "date": "YYYY-MM-DD" },
        { "title": "Aufgabe 2", "date": "YYYY-MM-DD" }
      ]
    }
  ]
}

Gib NUR das valide JSON zurück, ohne Markdown-Blöcke oder zusätzlichen Text.`;

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
