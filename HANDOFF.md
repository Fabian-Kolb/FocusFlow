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

---

## Nachtrag 2026-10-09 (Claude Code): Release-Vorbereitung & UX-Paket

**Kontext:** Die App ist nur auf Einladung nutzbar: Fabian plus Freunde, die er per Whitelist in Firebase freischaltet. Keine öffentliche Registrierung. Push-Benachrichtigungen sind bewusst zurückgestellt.

### Getan
- **Stabilität & Recht:** Error Boundary (App + Screen-Bereich), Impressum/Datenschutz unter `/impressum` und `/datenschutz` (Betreiberdaten in `src/lib/legal.js` sind noch Platzhalter), „Konto löschen“ in Einstellungen → Mein Account (`deleteAccount` in `AuthContext`).
- **Performance:** Code-Splitting der großen Screens in `App.jsx` (`lazy` + `Suspense`).
- **PWA & Offline:** `public/manifest.webmanifest`, `public/sw.js` (nur im Build), Icons in `public/icons/` (Platzhalter „FF“), Firestore `persistentLocalCache`. App-Kurzbefehle „Gedanken einsprechen“ und „Neue Erinnerung“ (`src/lib/launchAction.js`).
- **Rückgängig-Toast:** `src/context/ToastContext.jsx`; `DataContext` bietet Rückgängig bei Löschen, Erledigen und Kategorie verschieben. Die `confirm()`-Rückfragen in den Karten-Menüs sind entfernt.
- **Wischgesten:** `src/components/ui/SwipeableCard.jsx` in `Reminders.jsx` und `Projects.jsx` (rechts erledigt, links Papierkorb).
- **Wiederkehrende Erinnerungen:** `src/lib/recurrence.js`, Auswahl im `ReminderModal` und in `ReminderDetail`, Symbol auf der Karte; beim Erledigen geht es auf den nächsten Termin. `firestore.rules` erlaubt jetzt `recurrence` und `lastCompletedAt`.
- **PC:** Befehlsleiste (`Strg+K` / `/`), Tastenkürzel (`n`, `e`, `p`, `,`, `?`, `g`+Buchstabe), Schnellerfassung. Siehe `src/lib/appCommands.js`, `src/hooks/useGlobalShortcuts.js`, `src/components/ui/{CommandPalette,QuickCaptureDialog,ShortcutsHelp}.jsx`.

### Tests & Build
- `npx vitest run`: 149/150. Rot ist nur der zeitabhängig wackelige `tests/calendar_events_hook.test.jsx`, jedes Mal ein anderer Fall; einzeln dreimal grün. Neu: `tests/recurrence.test.js` (12), `tests/command_search.test.js` (6).
- `node tests/firestore_security.test.js` 16/16, `node tests/calendar_security.test.js` 20/20, `node scripts/run-e2e-tests.js` 141/142. Rot ist T2-CAL-04: Der Test erwartet `p-4`/`sm:p-6` in `Calendar.jsx`, das ist seit dem Kalender-Refactor weg.
- `vite build` ok. Im Browser geprüft (Gast-Modus, Dev und `vite preview`): Service Worker aktiv, Offline-Start, beide Kurzbefehle, Toast + Rückgängig (Desktop + Handy), Wischen (simulierte Touch-Events), Wiederholung, Befehlsleiste, Kürzel, Schnellerfassung.

### Offen / Next Steps
1. **[Prio 1] `npm run deploy:rules`.** Ohne den Deploy scheitert das Speichern wiederkehrender Erinnerungen für angemeldete Nutzer.
2. Echte Betreiberangaben in `src/lib/legal.js`.
3. Am echten Android-Handy testen: PWA installieren, Kurzbefehle, Wischgesten, Mikrofon-Start per Kurzbefehl (ohne Nutzergeste kann der Browser das Mikrofon verweigern; dann bleibt das Eingabefeld fokussiert).
4. Push-Benachrichtigungen (später): Empfehlung kostenloser externer Cron (cron-job.org) → Vercel-Endpunkt → Web-Push, der Service Worker ist dafür schon da.
5. Fio kennt `recurrence` noch nicht; T2-CAL-04 anpassen; wackeligen Kalender-Hook-Test stabilisieren.

### Fallstricke
- Neue Felder an Firestore-Dokumenten nur setzen, wenn sie einen Wert haben. `firestore.rules` arbeitet mit `hasOnly`, unbekannte Schlüssel (auch mit `null`) werden abgelehnt, solange die Regeln nicht deployt sind.
- Rückgängig bei gelöschten Elementen nicht über `mutateProject`/`mutateReminder`: Die finden gelöschte Einträge nicht mehr (sie liegen in `trashed…`). Den gemerkten Stand per `saveProject`/`saveReminder` zurückschreiben.
- Der Service Worker läuft nur im Build. Zum Testen die Launch-Konfiguration „preview“ nutzen (`vite preview`, Port 4173).

---

## Nachtrag 2026-10-09 (Claude Code, Sitzung „UI/UX Verbesserung Produktivitäts-Tabs“): UX-Plan + Phase 1 Bugfixes

### Getan
- **UX-Plan für alle Tabs** (7 Phasen + „Zum Besprechen“) liegt außerhalb des Repos in `~/.claude/plans/delegated-stargazing-garden.md`. Leitplanke des Nutzers: Bestehendes ausbauen; Fokus-Timer, Push und externe Dienste nur nach Rücksprache.
- **Live-Kennzahlen für Projekte:** neu `src/lib/projectProgress.js`. `ProjectDetail.jsx` und das Home-Widget lesen keine gespeicherten `badgeText`/`progress`/`timeElapsed`/`daysRemaining`/`nextStep` mehr (zeigten „0/0 ERLEDIGT“, 25 % verstrichene Zeit bei abgelaufenem Projekt).
- **`ProjectDetail.jsx`:** Papierkorb-Schreibschutz umfasst die ganze Arbeitsfläche, kein Rückfall auf `contextProjects[0]`, Abschnitt-Beschreibung gespeichert, keine Fantasie-Daten, „IN ARBEIT“ = AKTIV, Aufgaben-Datum als `type="date"`, Verlauf mit echtem Zeitstempel (max. 100, nur Erledigtes), Verlaufsfenster liest beide Eintragsformate.
- **`Dashboard.jsx`:** Häkchen nutzt `setReminderStatus` (vorher Geplant→Aktiv), lokales `todayIso`, totes Sprechblasen-Intervall entfernt, kein „Fabian“-Fallback.
- **`Inbox.jsx`:** Speichern mit `try/finally` + Fehler-Toast (Feld blieb nach Fehler gesperrt).
- **`ProjectAiChat.jsx`:** Aufgaben-Notiz (`note`) geht an Fio; Kopfzeile zeigt im Projekt-Fokus „Projekt: …“.

### Tests & Build
- `npx vitest run`: 13 Dateien, 165 Tests grün (neu: `tests/project_progress.test.js`, in `vitest.config.js` eingetragen). `vite build` ok, `oxlint` ohne neue Warnungen.
- Browser (Gast, 400 px): Abschnitt-Zähler, Frist „9 TAGE ÜBERFÄLLIG“, Status-Markierung, Home-Häkchen mit Undo-Toast geprüft.

### Next Steps
1. Projekt-Karten (`ItemCardContent.jsx`) auf `getProjectStats` umstellen, sobald die Parallel-Sitzung ihre Änderungen dort committet hat.
2. Erinnerungs-Beschreibung in `ReminderDetail.jsx` anzeigen (gleicher Grund).
3. Weiter mit Plan Phase 2 (Fundament: Tailwind-Klassen, Datums-Helfer, Checkbox/EmptyState/Dialog-Bausteine).

---

## Nachtrag 2026-10-09 (Claude Code): UI-Überarbeitung (Tokens, Gedanken, Dashboard, Overlay-System)

### Getan
- **Regel 01** `.agents/rules/01-ui-guidelines.md` ist jetzt die einzige UI-Regel (Farbe = Bedeutung, eckige Formen, 11-px-Minimum, z-Tokens, Overlay-System; ersetzt die früheren Regeln 04 und 09).
- **Tokens** in `tailwind.config.js`: `accent` (Kobaltblau, nur Hinzufügen/Speichern/Interaktion), `success`/`info`/`warning`/`danger`, gedämpfte `area-*` (nur Icon-Chip + aktiver Nav-Punkt, `src/lib/areas.js`), Schatten, z-Ebenen, `text-caption`. `Button`/`Card`/`Badge`/`Input` angepasst (eckig, `Button` mit `loading`, `danger-ghost`). Neu: `Skeleton`, `EmptyState`.
- **Overlay-System:** `src/components/ui/Overlay.jsx` (`Sheet`: Desktop Seitenpanel, Handy Bottom Sheet mit `useSwipeToClose`; `Dialog`), `src/context/ConfirmContext.jsx` (`useConfirm`, ersetzt `window.confirm`), `src/lib/notify.js` (Toast aus Code ohne React-Kontext). Alle `alert()`/`confirm()` ersetzt (Calendar, TaskModal, EventEditForm, Trash, NotesSection, Coach, `useSpeechInput`, `gemini.js`).
- **Aufräumen (2026-10-09):** Agenten-Archiv (`.agents/orchestrator`, `worker_*`, `reviewer_*` …, `ORIGINAL_REQUEST.md`) und 22 nicht benötigte Skills gelöscht. Es bleiben `firebase-basics`, `-auth-basics`, `-firestore`, `-hosting-basics`, `-security-rules-auditor`, `google-ai-models`, `secure-api-proxy-architecture`. Regeln: 04 und 09 in `01-ui-guidelines.md` aufgegangen, `02` und `07` an den Ist-Stand angepasst (`useBoardSort`, `Sheet`), `05` ohne Overlay-Doppelung. Sicherung des Gelöschten nur lokal im Session-Scratchpad (`agents-backup-2026-10-09.zip`), `ORIGINAL_REQUEST.md` steht im Git-Verlauf.
- **Gedanken** (`Inbox.jsx`, `ThoughtAiChip.jsx`): Karten mit fettem Titel, getönter Fußzeile und Spaltenlayout am Desktop; schwebende Eingabe am Handy, KI-Chip statt Checkbox + Dropdowns, schlanke Karten, kein Löschmodus mehr (Wischen / Hover-Papierkorb / Rechtsklick-Menü / `Entf` / Mehrfachauswahl, `deleteInboxItems`).
- **Dashboard** (`Dashboard.jsx`, `src/lib/dashboardAgenda.js`): Tagesübersicht mit Überfällig, Heute (Uhrzeiten), Nächste 7 Tage, Projekt, letzte Gedanken. Fokus-Score, Kapazität, Must-Win und rotierende Fio-Fragen entfernt.
- Navigation färbt den aktiven Punkt nach Bereich; der mittlere Hub-Knopf bleibt schwarz.

### Tests & Build
- `npx vitest run`: 180/180 grün (neu: `tests/dashboard_agenda.test.js`, 15 Tests; in `vitest.config.js` eingetragen).
- `node scripts/run-e2e-tests.js`: 141/142, rot ist nur das alte T2-CAL-04 (wie vorher). Sechs Quelltext-Tests wurden an das neue Dashboard/Gedanken angepasst (Fokus-Score, Must-Win, Inbox-Dropdowns).
- `vite build` ok. Im Browser (Gast) geprüft: Dashboard und Gedanken auf Desktop und 375 px, Popover liegt im Bild, Speichern, `Entf` + Rückgängig. Nicht geprüft: Wischen und Langdruck auf echtem Touch, Kalendertermine im Dashboard (Gast kann Kalender nicht verbinden), Mehrfachauswahl visuell.

### Offen / Next Steps
1. Alte Modals (`ProjectModal`, `TaskModal`, `ReminderModal`, `MaterialModal` …) und Drawer auf `Sheet`/`Dialog` umstellen; freie `z-[..]`-Werte auf Tokens.
2. Rohe `red-*`/`emerald-*`/`amber-*`-Klassen und `text-[9px]`/`[10px]` in Bestandsscreens auf Tokens migrieren; Primärbuttons (`bg-neutral-900 text-white`) auf `<Button>` (blau = Hinzufügen) umstellen.
3. Skeletons in Projekt-/Erinnerungslisten einbauen; Löschen in Erinnerungen/Projekten ebenfalls ohne Rückfrage-Modus prüfen.
4. Optional: Fokus-Aufgabe auf dem Dashboard selbst markieren; Dashboard-Rangfolge am echten Gerät prüfen.

### Fallstricke
- Der Kalender-Cache nummeriert Monate ab 0 (`2026-10` = November); `dashboardAgenda.js` folgt dieser Konvention.
- Python-Heredocs mit gemischten Anführungszeichen scheiterten im Shell-Tool; Skripte als Datei schreiben.

### Dev-Account zum Testen (2026-10-09)
- Nur `npm run dev`: Login-Screen zeigt „Mit Test-Konto anmelden (nur Entwicklung)“. Zugangsdaten in `.env.development.local` (Git-ignoriert, nicht im Build, hier nicht wiederholen). Code: `src/lib/devAccount.js`, `src/lib/devSeed.js`, `AuthContext.jsx`, `Login.jsx`.
- Wirkt wie ein normales Konto (kein Gast-Hinweis, Name „Test-Konto“), speichert aber nur im Browser (`focusflow_guest_*`). Beispieldaten sind relativ zu heute; zurücksetzen mit `ffDev.reset()` in der Konsole.
- Grenzen: kein Firebase-Token, also keine Fio/Gemini-Antworten, kein Google Kalender, keine Firestore-Regeln. Gegen das echte Firebase wird nicht angemeldet; es wurde kein Firebase-Konto angelegt oder freigeschaltet.
- `Button` kennt jetzt `variant="outline"` (Login-Gastknopf nutzte es, sonst wäre er blau geworden).
