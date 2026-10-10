import { useEffect, useRef, useState } from 'react';
import { notify } from '../lib/notify';

const join = (base, addition) => {
  if (!base) return addition;
  if (!addition) return base;
  return `${base}${base.endsWith(' ') || base.endsWith('\n') ? '' : ' '}${addition}`;
};

const ERROR_MESSAGES = {
  'not-allowed': 'Mikrofon-Zugriff verweigert. Erlaube das Mikrofon in den Browser- oder Website-Einstellungen.',
  'service-not-allowed': 'Mikrofon-Zugriff verweigert. Erlaube das Mikrofon in den Browser- oder Website-Einstellungen.',
  'audio-capture': 'Kein Mikrofon gefunden.',
  network: 'Spracheingabe braucht eine Internetverbindung.',
  'language-not-supported': 'Deutsch wird für die Spracheingabe nicht unterstützt.',
};

/**
 * Diktat per Web Speech API (de-DE). Hängt das Gesprochene an den Text an, der beim Start im Feld stand,
 * und läuft weiter, bis man stoppt (Chrome beendet die Erkennung sonst nach kurzer Stille und startet hier neu).
 * Bereits erkannte Sätze bleiben beim Neustart erhalten.
 *
 * @param {string} value     aktueller Feldinhalt
 * @param {(text: string) => void} setValue
 * @returns {{ isListening: boolean, toggle: () => void, stop: (opts?: { discard?: boolean }) => void }}
 *   `stop({ discard: true })` verwirft noch ausstehende Ergebnisse (z. B. nach dem Absenden, wenn das Feld geleert wird).
 */
export function useSpeechInput(value, setValue) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const committedRef = useRef('');
  const valueRef = useRef(value);
  const setValueRef = useRef(setValue);
  valueRef.current = value;
  setValueRef.current = setValue;

  const stop = ({ discard = false } = {}) => {
    isListeningRef.current = false;
    setIsListening(false);
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (discard) recognition.onresult = null;
    try {
      if (discard) recognition.abort();
      else recognition.stop();
    } catch {
      // bereits gestoppt
    }
  };

  const start = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify('Spracheingabe wird in diesem Browser nicht unterstützt. Nutze Chrome, Edge oder Safari.', 'mic_off');
      return;
    }
    try {
      committedRef.current = (valueRef.current || '').trim();
      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };
      recognition.onresult = (event) => {
        let interim = '';
        // Nur neue Ergebnisse auswerten: Finale werden festgeschrieben, Zwischenstände nur angezeigt
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript.trim();
          if (!text) continue;
          if (result.isFinal) committedRef.current = join(committedRef.current, text);
          else interim = join(interim, text);
        }
        setValueRef.current(join(committedRef.current, interim));
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.error('Speech recognition error:', event.error);
        isListeningRef.current = false;
        setIsListening(false);
        notify(ERROR_MESSAGES[event.error] || 'Spracheingabe ist fehlgeschlagen. Versuche es noch einmal.', 'mic_off');
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        if (!isListeningRef.current) {
          setIsListening(false);
          return;
        }
        try {
          recognition.start();
        } catch {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition failed:', err);
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  // Beim Verlassen der Komponente das Mikrofon freigeben
  useEffect(() => () => {
    isListeningRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      // bereits gestoppt
    }
  }, []);

  return { isListening, toggle: () => (isListening ? stop() : start()), stop };
}
