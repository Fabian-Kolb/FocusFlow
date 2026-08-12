# FocusFlow 🚀

> **Intelligente Produktivitäts- & Aufgabenplattform** – Entwickelt für fokussiertes Arbeiten, strukturiertes Projektmanagement und KI-gestützte Workflows.

![KI-gestützte Entwicklung](https://img.shields.io/badge/Entwicklung-KI--gest%C3%BCtzt-7c3aed?style=for-the-badge&logo=sparkles)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff?style=for-the-badge&logo=vite)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-ffca28?style=for-the-badge&logo=firebase)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google)

---

## 🔒 Zugang & Live-Demo
Diese Web-App befindet sich in der aktiven Entwicklung. Um automatisierte Zugriffe (Spam) zu verhindern und die regulären API-Nutzungslimits zu schonen, liegt die Live-Version hinter einem geschlossenen Login.
Falls Sie dieses Projekt im Rahmen einer Bewerbung oder eines Portfolio-Reviews sichten, kontaktieren Sie mich gerne über die in meinen Unterlagen hinterlegten Kontaktdaten, um einen temporären Demo-Zugang anzufordern.

---

## 🤖 KI-gestützte Entwicklung

**FocusFlow** wurde unter gezieltem Einsatz moderner **KI-gestützter Entwicklungsmethoden** umgesetzt.

* **Effizienter Workflow**: Schnelle Iterationen bei der Strukturierung und Erstellung der Anwendung.
* **Integrierte KI-Features**: Neben dem Entwicklungs-Workflow nutzt FocusFlow auch direkt in der App intelligente Funktionen wie den **KI-Coach** über die **Google Gemini API**.

---

## 💡 Über FocusFlow

FocusFlow kombiniert bewährte Selbstorganisations-Konzepte (wie *Getting Things Done* / GTD, Kanban und Wochenrückblicke) in einer modernen, performanten Webanwendung. Sie hilft Nutzern dabei, den Überblick über offene Inbox-Items zu behalten, Projekte in strukturierte Phasen zu gliedern und vieles mehr.
---

## ✨ Hauptfunktionen (Features)

* 📥 **Smart Inbox**: Schnelle Erfassung von Gedanken, Aufgaben und Notizen.
* 📋 **Projektmanagement & Kanban-Board**: Gliederung von Projekten in Meilensteine und interaktive Kanban-Boards zur visuellen Fortschrittsverfolgung.
* 🤖 **Integrierter KI-Coach**: KI-gestützte Empfehlungen, Zusammenfassungen und Produktivitäts-Tipps direkt in der App.
* 📊 **Wochenrückblick (Weekly Review)**: Ein dediziertes Dashboard zur Analyse erledigter Tasks, System-Health-Warnungen und Vorbereitung der nächsten Schritte.
* 📅 **Kalender & Reminder Integration**: Integrierter Kalender mit Fristenmanagement und Erinnerungen.
* 🗑️ **Papierkorb & Wiederherstellung**: Zuverlässige Verwaltung und Wiederherstellung gelöschter Elemente.

---

## 🛠️ Tech Stack

### Frontend & UI
* **React 19** – Komponentenbasierte UI-Entwicklung
* **Vite** – Ultraschneller Build-Toolchain & Dev-Server
* **Tailwind CSS** – Utility-First Styling für modernes Design
* **React Markdown & Quill** – Formatierte Notizen und Markdown-Unterstützung

### Backend & Cloud Services
* **Firebase Auth** – Authentifizierung und geschützter Nutzer-Zugang
* **Firebase Firestore** – Echtzeit-Datenbank für Aufgaben, Projekte und Einstellungen
* **Firebase Hosting** – Schnelles & sicheres SSL-Deployment

### KI & Schnittstellen
* **Google Gemini API** (`@google/genai` / `@google/generative-ai`) – Intelligente Sprachmodelle für den KI-Coach
* **Google Calendar API** (`@googleapis/calendar`) – Kalender-Synchronisation

### Code Quality & Testing
* **Oxlint** – High-Performance Linter
* **Node.js Test-Runner & JSDOM** – Ende-zu-Ende- & Komponenten-Tests

---

## 💻 Lokale Entwicklung & Setup

### Voraussetzungen
* **Node.js** (Version 18 oder höher)
* **npm**

### 1. Repository klonen & Abhängigkeiten installieren
```bash
git clone <repository-url>
cd focusflow
npm install
```

### 2. Umgebungsvariablen konfigurieren
Erstelle eine `.env.local` Datei im Stammverzeichnis und trage deine API-Schlüssel ein:

```env
VITE_FIREBASE_API_KEY=dein_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=dein_projekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dein_projekt_id
VITE_FIREBASE_STORAGE_BUCKET=dein_projekt.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=deine_sender_id
VITE_FIREBASE_APP_ID=deine_app_id

VITE_GEMINI_API_KEY=dein_gemini_api_key
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

---
