// src/lib/gemini.js
// Client-side Gemini API client calling the secure backend proxy (/api/gemini/*)
// Authenticates every request with Firebase Auth ID-Token.
// NEVER exposes API keys in the client bundle or Network tab.

import { auth } from './firebase';

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

/**
 * Helper to get authorization headers with Firebase ID token
 */
async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && auth.currentUser && !auth.currentUser.isGuest) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.warn('[Auth] Konnte ID-Token nicht abrufen:', e);
    }
  }
  return headers;
}

/**
 * Streams AI Coach responses from backend proxy
 */
export async function askGeminiCoach({ prompt, systemInstruction, onChunk, aiModel = 'flash' }) {
  const headers = await getAuthHeaders();

  const response = await fetch('/api/gemini/coach', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, systemInstruction, aiModel })
  });

  if (!response.ok) {
    let errorMsg = 'Fehler bei der Kommunikation mit dem KI-Coach.';
    try {
      const errJson = await response.json();
      if (errJson?.error) errorMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  if (!response.body) {
    throw new Error('Kein Streaming-Response-Body vom Server empfangen.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            fullText = `⚠️ ${parsed.error}`;
            if (onChunk) onChunk(fullText);
            break;
          }
          if (parsed.chunk) {
            fullText += parsed.chunk;
            if (onChunk) onChunk(fullText);
          }
        } catch {
          // ignore non-json chunks
        }
      }
    }
  }

  return fullText;
}

/**
 * Summarizes voice note via backend proxy
 */
export async function summarizeVoiceNote(text, aiModel = 'eco', lengthMode = 'normal') {
  if (!text || !text.trim()) return null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/gemini/summarize', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, aiModel, lengthMode })
    });

    if (response.status === 429) {
      const err = await response.json();
      alert(err.error || 'Anfrage-Limit erreicht: Aus Sicherheitsgründen sind maximal 15 KI-Anfragen pro 10 Minuten erlaubt.');
      return null;
    }

    if (!response.ok) {
      console.error('Server returned error on summarize:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return {
      title: data.title || '',
      cleanText: data.cleanText || null,
      extractedDateType: data.extractedDateType || null,
      extractedDate: data.extractedDate || null,
      extractedEndDate: data.extractedEndDate || null,
      extractedTime: data.extractedTime || null,
      summary: ensureBulletPoints(data.summary || '')
    };
  } catch (error) {
    console.error('Fehler bei der Zusammenfassung über Server-Proxy:', error);
    return null;
  }
}

/**
 * Generates project structure (phases & tasks) via backend proxy
 */
export async function generateProjectStructure(text, options = {}, aiModel = 'eco') {
  if (!text || !text.trim()) return null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/gemini/generate-project', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, options, aiModel })
    });

    if (response.status === 429) {
      const err = await response.json();
      alert(err.error || 'Anfrage-Limit erreicht: Aus Sicherheitsgründen sind maximal 15 KI-Anfragen pro 10 Minuten erlaubt.');
      return null;
    }

    if (!response.ok) {
      console.error('Server returned error on generate-project:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Fehler bei generateProjectStructure über Server-Proxy:', error);
    return null;
  }
}

/**
 * Generates reminder structure via backend proxy
 */
export async function generateReminderStructure(text, aiModel = 'eco') {
  if (!text || !text.trim()) return null;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/gemini/generate-reminder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, aiModel })
    });

    if (response.status === 429) {
      const err = await response.json();
      alert(err.error || 'Anfrage-Limit erreicht: Aus Sicherheitsgründen sind maximal 15 KI-Anfragen pro 10 Minuten erlaubt.');
      return null;
    }

    if (!response.ok) {
      console.error('Server returned error on generate-reminder:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Fehler bei generateReminderStructure über Server-Proxy:', error);
    return null;
  }
}
