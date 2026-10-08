import { useEffect, useRef, useState } from 'react';
import { notify } from '../lib/notify';

/**
 * Diktat per Web Speech API (de-DE). Hängt das Gesprochene an den Text an, der beim Start im Feld stand,
 * und läuft weiter, bis man stoppt (Chrome beendet die Erkennung sonst nach kurzer Stille).
 *
 * @param {string} value     aktueller Feldinhalt
 * @param {(text: string) => void} setValue
 */
export function useSpeechInput(value, setValue) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const baseTextRef = useRef('');

  const stop = () => {
    isListeningRef.current = false;
    setIsListening(false);
    try {
      recognitionRef.current?.stop();
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
      baseTextRef.current = value.trim();
      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
        const base = baseTextRef.current;
        if (!base) setValue(transcript);
        else setValue(`${base}${base.endsWith(' ') || base.endsWith('\n') ? '' : ' '}${transcript}`);
      };
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };
      recognition.onend = () => {
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
      recognitionRef.current?.stop();
    } catch {
      // bereits gestoppt
    }
  }, []);

  return { isListening, toggle: () => (isListening ? stop() : start()), stop };
}
