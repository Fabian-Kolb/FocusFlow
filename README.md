# FocusFlow 🚀

> **Intelligente Produktivitäts- & Aufgabenplattform** – Entwickelt für fokussiertes Arbeiten, strukturiertes Projektmanagement und KI-gestützte Workflows.

![KI-gestützte Entwicklung](https://img.shields.io/badge/Entwicklung-KI--gest%C3%BCtzt-7c3aed?style=for-the-badge&logo=sparkles)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff?style=for-the-badge&logo=vite)
![Vercel](https://img.shields.io/badge/Vercel-Serverless%20Backend-000000?style=for-the-badge&logo=vercel)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-ffca28?style=for-the-badge&logo=firebase)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%203.6-4285F4?style=for-the-badge&logo=google)

---

## 🌐 Live-Demo & Gast-Zugang

Die Web-Anwendung kann **direkt ohne Registrierung im 1-Klick Gast-Modus** getestet werden:

👉 **Klicke rechts oben im GitHub-Repository unter `About` auf den Live-Link** (oder direkt: **[https://focusflow-me.vercel.app](https://focusflow-me.vercel.app)**).

Auf dem Login-Bildschirm einfach auf **„Als Gast ausprobieren (Demo)“** klicken, um sofort das interaktive Dashboard mit vorbefüllten Projekten, Phasen, Aufgaben, Kanban-Boards und dem KI-Coach auszuprobieren.

---

## 🤖 KI-gestützte Entwicklung

**FocusFlow** wurde unter gezieltem Einsatz moderner **KI-gestützter Entwicklungsmethoden** umgesetzt.

* **Effizienter Workflow**: Schnelle Iterationen bei der Strukturierung und Erstellung der Anwendung.
* **Integrierte KI-Features**: Neben dem Entwicklungs-Workflow nutzt FocusFlow auch direkt in der App intelligente Funktionen wie den **KI-Coach** über die **Google Gemini API** (Streaming per Server-Sent Events).

---

## 💡 Über FocusFlow

FocusFlow ist eine moderne Web-App für intelligentes Aufgaben- und Projektmanagement. Sie vereint Smart Inbox, Kanban-Boards, Fristen-Kalender und Wochenrückblicke mit einem integrierten KI-Coach auf Basis der Google Gemini API – entwickelt für maximale Produktivität und strukturiertes Arbeiten.

---

## ✨ Hauptfunktionen (Features)

* 📥 **Smart Inbox**: Schnelle Erfassung von Gedanken, Aufgaben und Notizen.
* 📋 **Projektmanagement & Kanban-Board**: Gliederung von Projekten in Meilensteine und interaktive Kanban-Boards zur visuellen Fortschrittsverfolgung.
* 🤖 **Integrierter KI-Coach**: KI-gestützte Empfehlungen, Zusammenfassungen und Produktivitäts-Tipps direkt in der App.
* 📊 **Wochenrückblick (Weekly Review)**: Ein dediziertes Dashboard zur Analyse erledigter Tasks, System-Health-Warnungen und Vorbereitung der nächsten Schritte.
* 📅 **Kalender & Reminder Integration**: Integrierter Kalender mit Fristenmanagement und Erinnerungen.
* 🎮 **1-Klick Gast-Modus**: Sofortiges Erkunden und Testen aller Funktionen ohne Registrierungshürde.
* 🗑️ **Papierkorb & Wiederherstellung**: Zuverlässige Verwaltung und Wiederherstellung gelöschter Elemente.

---

## 🛠️ Tech Stack

### Frontend & UI
* **React 19** – Komponentenbasierte UI-Entwicklung
* **Vite** – Ultraschneller Build-Toolchain & Dev-Server
* **Tailwind CSS** – Utility-First Styling für modernes Design
* **React Markdown & Quill** – Formatierte Notizen und Markdown-Unterstützung

### Backend & Cloud Services
* **Vercel Serverless Functions** – Gesicherte API-Proxies mit IP-Rate-Limiting & SSE-Streaming
* **Firebase Auth** – Authentifizierung und geschützter Nutzer-Zugang
* **Firebase Firestore** – Echtzeit-Datenbank für Aufgaben, Projekte und Einstellungen

### KI & Schnittstellen
* **Google Gemini API** (`gemini-3.6-flash` / `@google/generative-ai`) – Intelligente Sprachmodelle für den KI-Coach
* **Google Calendar API** (`@googleapis/calendar`) – OAuth 2.0 Schnittstelle mit Auto-Token-Refresh

### Code Quality & Testing
* **Oxlint** – High-Performance Linter
* **Node.js Test-Runner & JSDOM** – Ende-zu-Ende- & Komponenten-Tests (118 E2E Tests)

---

## 💻 Lokale Entwicklung & Setup

### Voraussetzungen
* **Node.js** (Version 18 oder höher)
* **npm**

### 1. Repository klonen & Abhängigkeiten installieren
```bash
git clone https://github.com/Fabian-Kolb/FocusFlow.git
cd focusflow
npm install
```

### 2. Umgebungsvariablen konfigurieren
Erstelle eine `.env.local` Datei im Stammverzeichnis und trage deine API-Schlüssel ein:

```env
VITE_FIREBASE_API_KEY=dein_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=dein_projekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dein_projekt_id
VITE_FIREBASE_STORAGE_BUCKET=dein_projekt.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=deine_sender_id
VITE_FIREBASE_APP_ID=deine_app_id
VITE_FIREBASE_MEASUREMENT_ID=deine_measurement_id

GEMINI_API_KEY=dein_gemini_api_key
GOOGLE_CLIENT_SECRET=dein_google_client_secret
VITE_GOOGLE_CLIENT_ID=deine_google_client_id
```

### 3. Entwicklungs-Server starten
```bash
npm run dev
```
Die Anwendung ist anschließend unter `http://localhost:5173` erreichbar.

### 4. Weitere Befehle
* **Build erstellen**: `npm run build`
* **Vorschau des Builds**: `npm run preview`
* **Linter ausführen**: `npm run lint`
* **Tests ausführen**: `npm run test`
