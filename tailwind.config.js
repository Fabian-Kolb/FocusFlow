/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface": "#FBF9F9",
        "surface-low": "#F5F3F3",
        "surface-card": "#FFFFFF",
        "primary": "#1A1A1A",
        "on-primary": "#FFFFFF",
        "outline-variant": "#E5E5E5",
        "on-surface-variant": "#737373",
        "accent-blue": "#0052FF",

        // Akzent für alles Interaktive (primärer Button, Fokusring, aktiver Zustand, Mikrofon):
        // gedecktes Kobaltblau, seriös statt verspielt. Ein einziger Wert-Satz, hier zentral änderbar.
        "accent": {
          DEFAULT: "#2252C4",
          hover: "#1A44A8",
          soft: "#EAF0FC",
          border: "#BCCDF0",
          strong: "#153A8C",
        },

        // Statusfarben (Bedeutung, nie Dekoration): aktiv/erledigt, geplant, Warnung, Fehler/überfällig.
        // "info" (geplant) ist bewusst ein kühles Stahlblau, damit es sich vom Akzent unterscheidet.
        "success": { DEFAULT: "#18794E", soft: "#EBF6F0", border: "#A9D8BF" },
        "info": { DEFAULT: "#0B6A8F", soft: "#E6F2F7", border: "#A8D0E0" },
        "warning": { DEFAULT: "#A15C07", soft: "#FCF3E1", border: "#EBCF90" },
        "danger": { DEFAULT: "#B42318", soft: "#FCEDEB", border: "#EDBAB4" },

        // Bereichsfarben: nur für das kleine Icon-Chip und den aktiven Navigationspunkt (bewusst gedämpft)
        "area-thoughts": { DEFAULT: "#26788A", soft: "#E4F0F3" },
        "area-reminders": { DEFAULT: "#9C4A6A", soft: "#F5E9EE" },
        "area-projects": { DEFAULT: "#2252C4", soft: "#EAF0FC" },
        "area-calendar": { DEFAULT: "#B8601F", soft: "#FAEBDF" },
        "area-review": { DEFAULT: "#4B5B73", soft: "#EAEEF4" },
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['Plus Jakarta Sans', 'Outfit', 'sans-serif']
      },
      // Mindestgröße im UI: 11px (caption). Alles darunter ist auf dem Handy kaum lesbar.
      fontSize: {
        caption: ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.05)',
        raised: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 20px rgba(15, 23, 42, 0.09)',
        sheet: '0 -4px 24px rgba(15, 23, 42, 0.14)',
      },
      // Ebenen (Stacking): Navigation < Sheet < Dialog < Toast < Befehlsleiste
      zIndex: {
        nav: '40',
        sheet: '60',
        dialog: '80',
        toast: '90',
        palette: '100',
      },
      transitionDuration: {
        fast: '150ms',
        panel: '250ms',
      },
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
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
