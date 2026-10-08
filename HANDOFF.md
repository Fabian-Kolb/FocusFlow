# 🤝 FocusFlow Agent Handoff

> **Stand:** 2026-10-08 18:50 | **Agent:** Antigravity (Gemini 3.8 Flash High) / DeepCoder | **Ziel:** Komplette Kalender-UI-Überarbeitung nach Referenz-Screenshots (Design, Zeilenumbrüche, Mobile Day Sheet, Swipe-Karussell, Heute-Button, Preloading).

### 1. 🎯 Getan & Warum
- `src/components/screens/Calendar.jsx`:
  - **Kompakte Terminhöhe & Zeilenumbruch (User-Feedback):** Keine vertikale Streckung mehr (`h-auto` statt `flex-1 h-full`). Zeitgebundene Termine (`dateTime`) nutzen transparente Hintergründe mit vertikaler Farbakzentlinie (`border-l-[3px]`) vorne, sodass nur der tatsächlich für die Schrift benötigte Platz eingenommen wird. Ganztägige Termine bleiben dezent gefüllte Pastell-Chips. Maximal 2 Zeilen Text (`line-clamp-2 break-all`).
  - **Mobile Day Sheet (Screenshot 2):** Bottom-Sheet öffnet sich auf Mobile gleichermaßen bei Klick auf Tag oder Termin. Standardmodus ist die Liste. Nach rechts wischen öffnet den Zeitstrahl. Ganztägige Termine als elegante blaue Karten oben, zeitgebundene Termine mit Zeit-Clusterung (Uhrzeit nur beim ersten Termin eines Slots). Unnötige Schließen-Buttons entfernt.
  - **Heute-Button (Screenshot 1 oben rechts):** Als abgerundetes Quadrat mit Rahmen und aktueller Tageszahl umgesetzt. Navigiert direkt zum heutigen Tag im Kalenderraster, ohne das Mobile-Sheet aufzuzwingen.
  - **Monats-Karussell & Wischgeste:** 3-Slide-Karussell mit Vormonat, aktuellem und Folgemonat. Flackerfreier Übergang ohne Reverse-Glitch. Unnötige Texte wie „Wischen für den nächsten Monat“ restlos entfernt.
  - **Preloading:** Vormonat, aktueller Monat und Folgemonat werden parallel vorgeladen und gecacht.
  - **Z-Index & A11y:** Event-Detail-Modal und Month-Picker auf `z-[80]` über dem Sheet (`z-[60]`) angehoben. Dialog-Rollen und ARIA-Labels integriert.
- `src/App.jsx`: Kalender-Padding auf Mobilgeräten auf `p-0` gesetzt (`p-0 md:px-8 md:py-8`), damit das Monatsraster bündig an die Displayränder reicht.
- `tests/calendar_ui.test.jsx`: 12 umfassende automatisierte Tests für Preloading, Gesten, kompakte `h-auto` Skalierung, zeitgebundene vs. ganztägige Termine und Z-Indexe.

### 2. 🧪 Tests & Build
- Build: [x] `npm run build` erfolgreich (1079 Module in 2.33s).
- Tests: [x] `npx vitest run` erfolgreich (8/8 Files, 79/79 Tests grün).
- Lint: [x] `npx oxlint` (0 Errors, 0 Warnings).

### 3. 📍 Status & Offenes
- Alle UI- und UX-Vorgaben aus beiden Referenzbildern und dem Benutzerfeedback sind vollständig umgesetzt und getestet.

### 4. 🚀 Next Steps
1. [Prio 1] Manueller Smoke-Test auf physischen Mobilgeräten (Touch-Haptik & Animationen).

### 5. ⚠️ Warnungen & Fallstricke
- **KEINE SECRETS:** Niemals API-Keys/Tokens eintragen (nur `.env.local` referenzieren).
- Bei Touch-Gesten immer `isAnimatingRef` beachten, um Race Conditions bei schnellen Swipes zu verhindern.

---

## Nachtrag 2026-10-08 (Claude Code): Fio-Entwürfe, Drag & Drop v2, Sortierung

### Getan
- **„Mit Fio ausarbeiten“ (Gedanken → Projekt):** Eigener Chat „Projektanlegung: …“ (`createDraftSession` in `ChatContext`), Detailtiefe (Grob/Ausgewogen/Detailliert) wird vor Fios erstem Entwurf gewählt. Logik `src/lib/projectDraft.js`, Editor `src/components/ui/ProjectDraftCard.jsx` (Ziehen am Griff, keine Pfeile, Handy = Bottom-Drawer, Versionen, Bestätigen per Knopf oder Chat). Filter „Entwürfe“ im Chatverlauf.
- **Drag & Drop v2 für Projekte/Erinnerungen:** `src/components/ui/useBoardSort.js` (Kategorien und Karten, auch zwischen Kategorien; Anheben, FLIP, Totzone `SWITCH_DEADZONE`, zeilenbasierte Raster-Treffer). Reihenfolge in `sortOrder` (`placeProjectInCategory` / `placeReminderInCategory` in `DataContext`).
- **Sortier-Menü** (`SortMenu` in `ListToolbar.jsx`, `sortItems` in `src/lib/itemOrder.js`, Modus per `usePersistedChoice`); Ziehen in automatischer Sortierung wechselt auf „Benutzerdefiniert“.
- `firestore.rules`: `sortOrder` für Projekte und Erinnerungen erlaubt.

### Tests & Build
- `npx vitest run`: 79/79 grün, `vite build` ok. Browser-Tests nur mit simulierten Maus-/Zeigerereignissen (Gast-Modus). Keine neuen automatisierten Tests für Entwurf, `useBoardSort`, `sortItems`.

### Kalender-Refactoring (Claude Code, 2026-10-08)
- `Calendar.jsx` aufgeteilt (siehe `docs/Wissen/06_Kalender/01-Kalender-Integration.md`): `src/lib/calendarUtils.js`, `src/hooks/useCalendarEvents.js` + `useMonthCarousel.js`, `src/components/calendar/*`. Fehler-/Offline-Banner, Retry, Auto-Reload bei online. Neue Tests `calendar_utils` (40) und `calendar_events_hook` (13); `npm run test:tz` für mehrere Zeitzonen. Gesamt: 132 Tests grün, Build ok. Nicht im Browser geprüft (Gast kann den Kalender nicht verbinden), Abdeckung nur über Tests.

### Offen / Next Steps
1. **[Prio 1] Firestore-Regeln deployen:** `firebase deploy --only firestore:rules` (sonst „Missing or insufficient permissions“ beim Verschieben).
2. Echter Touch-Test am Handy: Long-Press-Drag von Karten, Griff-Drag im Fio-Entwurfs-Drawer.
3. Fio-Entwürfe: Knopf neben „Neues Projekt“/„Neue Erinnerung“; Editor im manuellen `ProjectModal` statt KI-Phasen-Vorschau; Fio legt im normalen Chat Projekte nur noch als Entwurf an; Erinnerungen als Entwurf; „Fio, räum meine Gedanken auf“ (siehe `docs/Wissen/07_KI_Coach/01-Generative-KI.md`).
4. Unit-Tests für `moveInDraft`, `sortItems`, `groupByCategory` ergänzen.

### Fallstricke
- Dev-Server (Vite) verpasst auf Windows teils Dateiänderungen: Datei `touch`en oder neu starten.
- React-StrictMode bricht beim Start Anfragen ab (Cleanup in `Coach.jsx`): Entwurfs-Start läuft verzögert per `setTimeout`.
- `useCategoryDrag` bleibt im Repo (Tests lesen die Quelle), `useCardTouchDrag` nutzt weiter das Status-Kanban-Board.
