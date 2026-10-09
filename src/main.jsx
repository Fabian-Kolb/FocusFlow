import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { applyTheme, readThemePreference } from './lib/theme'

// Hell/Dunkel gilt schon vor dem ersten Bild (index.html); hier folgt die App zusätzlich Systemwechseln
applyTheme(readThemePreference())
if (typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (readThemePreference() === 'system') applyTheme('system')
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary variant="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Service Worker nur im Build registrieren (im Dev-Server würde er HMR stören)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker Registrierung fehlgeschlagen:', err);
    });
  });
}
