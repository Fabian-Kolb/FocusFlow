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
        "accent-blue": "#0052FF"
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['Plus Jakarta Sans', 'Outfit', 'sans-serif']
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
