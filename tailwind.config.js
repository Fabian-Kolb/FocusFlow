import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';
import preset from './src/styles/tailwind-preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  // Alle Tokens kommen aus dem Design-System-Preset (src/styles/tailwind-preset.js + tokens.css, Regel 01).
  presets: [preset],
  // Hell/Dunkel über <html data-theme="dark">; die Tokens wechseln selbst, `dark:` bleibt nur für Sonderfälle.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Login-Hintergrundband (LoginMarquee): Zeilen laufen je nach Richtung nach rechts oder links
      keyframes: {
        'band-ltr': {
          '0%': { transform: 'translate3d(-50%, 0, 0)' },
          '100%': { transform: 'translate3d(0, 0, 0)' },
        },
        'band-rtl': {
          '0%': { transform: 'translate3d(0, 0, 0)' },
          '100%': { transform: 'translate3d(-50%, 0, 0)' },
        },
      },
      animation: {
        'band-ltr': 'band-ltr 80s linear infinite',
        'band-rtl': 'band-rtl 80s linear infinite',
      },
    },
  },
  plugins: [
    // Nur auf Anforderung (`form-input` …): Eingabefelder bekommen ihr Aussehen aus den ds-Bausteinen.
    forms({ strategy: 'class' }),
    containerQueries,
  ],
};
