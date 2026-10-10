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

---

## Nachtrag 2026-10-09 (Claude Code): Promo-Video 16:9

### Getan
- Motion-Graphics-Vorstellung der App: `promo/focusflow-intro.mp4` (1920×1080, 30 fps, ca. 24 s, ohne Ton). Quelle: `promo/focusflow-intro.html`.
- Die Bildschirme (Home, Gedanken, Kanban, Erinnerungen) sind mit den Tokens aus `tailwind.config.js` nachgebaut. Inhalte stammen aus dem Dev-Account (`src/lib/devSeed.js`).
- Die Animation ist eine reine Funktion der Zeit (`frame(t)`), keine Abhängigkeiten. Das Render-Skript (puppeteer-core + Chrome, ffmpeg) liegt nur im Scratchpad und nicht im Repo.
- Keine Änderungen an App-Code.

### Tests
- Standbilder geprüft, Render ohne Seitenfehler, Kontrollbild aus der fertigen MP4 geprüft. Keine Unit-Tests betroffen.

### Next Steps
1. Entscheiden: Sprachaufnahme, Musik und Texte (Intro „Vom Gedanken zum erledigten Schritt.“, Outro „Fio, dein KI-Coach, räumt deine Gedanken auf.“).
2. Optional: 9:16-Schnitt für Social Media.

### Fallstricke
- Die HTML lädt Google Fonts und Material Symbols. Ohne Internet fehlen Schrift und Icons.
- Zeiten, Kamera (`CAM`), Cursor (`CUR`) und Captions sind in der HTML fest verdrahtet. Nach Änderungen neu rendern.

---

## Nachtrag 2026-10-09 (Claude Code): 2D-Hintergrundband auf dem Login

### Getan
- Neu: `src/components/brand/LoginMarquee.jsx`. Fünf Zeilen „FOCUSFLOW“ in der Wortmarken-Geometrie, abwechselnd links und rechts, endlos, sehr leise, hinter der Karte. Ausblenden beim Scrollen.
- `src/components/brand/wordmarkPaths.js`: Pfad-Umrechnung, von `WordmarkSvg.jsx` und dem Band gemeinsam genutzt (Darstellung der Wortmarke unverändert).
- `tailwind.config.js`: Keyframes `band-ltr` / `band-rtl`. `Login.jsx`: Band eingebaut, Wurzel mit `isolate`.
- Doku: `docs/Wissen/12_3D_Branding_und_Landingpage/01-3D-Schriftzug-und-Interaktive-Landingpage.md` (Status und Next Steps).

### Tests & Build
- Lint sauber. `vite build` ok.
- Vitest: 179/180. Rot ist `tests/calendar_events_hook.test.jsx` („automatisch erneut geladen“). Der Test ist unabhängig vom Band und wackelt bekannt. Allein gelaufen: 2 von 3 Läufen grün.
- Browser (Headless-Chrome, Dev-Server): Zeilen laufen gegenläufig, Light und Dark umgeschaltet, auf dem Handy blendet das Band beim Scrollen aus, Konsole ohne Fehler.

### Offen
1. Blauer Radialverlauf im Dark Mode des Logins (`Login.jsx`): Regel 01 verbietet Verläufe. Der Nutzer hat noch nicht entschieden, deshalb unverändert.
2. Calendar-Hook-Test stabilisieren (siehe oben).

### Fallstricke
- Der eingebettete Browser-Pane rendert CSS-Animationen nur bei Bedarf. Für Bewegungstests den Headless-Chrome aus dem Render-Setup nutzen, nicht den Pane.

---

## Nachtrag 2026-10-09 (Claude Code): Login-Band an Rand, Wortmarke größer

### Getan
- `LoginMarquee.jsx`: Bänder nur noch oben (zwei Zeilen) und unten (zwei Zeilen), die Mitte bleibt frei. Auf dem Handy nur eine Zeile oben.
- `Login.jsx`: 3D-Wörter größer (Desktop bis 28/30 rem statt 22 rem, Handy bis 21/26 rem statt 17/20 rem).

### Tests
- Lint sauber, `vite build` ok. Browser-Messung: 1440 px ~424 px je Wort, 1920 px 480 px. Keine Überlappung von Bändern und Karte.

### Offen
1. Blauer Radialverlauf im Dark Mode weiterhin ungeklärt (siehe vorheriger Nachtrag).

---

## Nachtrag 2026-10-09 (Claude Code): Login-Band eine Zeile, 3D-Wörter größer

### Getan
- `LoginMarquee.jsx`: oben eine Zeile FOCUS, unten eine Zeile FLOW (statt je zwei Zeilen FOCUSFLOW), deutlich größer (`h-16 sm:h-24 xl:h-28`). Handy: nur oben.
- `Login.jsx`: 3D-Wörter größer (`lg:max-w-[32rem]`, `xl:max-w-[36rem]`), Karte am Desktop schmaler (`lg:max-w-sm`, `xl:max-w-md`), damit mehr Platz für die Wörter bleibt.

### Tests
- Lint ohne neue Warnungen, Sichtprüfung bei 1440 px im Browser. Kein Build/Vitest gelaufen.

### Offen
- Ideen für 3D-Mehrwert (Cursor-Interaktion, Opening-Animation) mit dem Nutzer besprechen.

## Nachtrag 2026-10-09 (Claude Code): 3D-Wortmarke mit Interaktionen

### Getan
- `Wordmark3D.jsx`: Einflug beim Laden (FOCUS, dann FLOW), Spotlight (Buchstaben am Cursor hell, Rest transparenter und zurückgesetzt, kein echter Blur), Punktlicht am Cursor, Klick/schnelles Maus-Wischen wirbelt die Buchstaben durcheinander und lässt sie per Feder einrasten, Ausrichtung auf die Login-Karte solange ein Formularfeld Fokus hat, Hüpfer pro Tastendruck, Gyroskop am Handy (iOS fragt nach der ersten Berührung um Erlaubnis). Pro Buchstabe ein eigenes Material.
- Neu: `BrandFlight.jsx` + `src/lib/brandTransition.js`: Der Login merkt sich vor dem Login die Positionen der Wörter, nach dem Login fliegen sie als flaches SVG zum Namen in der Sidebar (`data-brand-mark`), auf dem Handy nach oben aus dem Bild.
- `WordmarkWord` reicht `ref` und Effekt-Props durch; `Login.jsx` verdrahtet Fokus, Tippen und Merken der Position.

### Tests
- `vite build` ok, Lint ohne neue Warnungen, Vitest 178/180 (rot: der bekannte wacklige Kalender-Hook-Test, bei jedem Lauf ein anderer Fall).
- Browser (Dev, Mausereignisse): Spotlight/Licht, Ausrichtung beim Tippen und Flug nach Gast-Login geprüft. Nicht geprüft: Gyroskop, Touch, Stärke des Lichts im Hell-Modus, Flug auf dem Handy.

### Offen
- Stärken feinjustieren (`CURSOR_LIGHT_INTENSITY`, Dimmen 0.62, Wisch-Schwelle 2.4 px/ms).

## Nachtrag 2026-10-09 (Claude Code): Wortmarke nachgeschärft

### Getan
- Kein 2D-Vorbild mehr beim Laden (`WordmarkWord`: Suspense-Fallback leer), der Einflug der 3D-Buchstaben bleibt sichtbar. Nur ohne WebGL erscheint das flache SVG.
- Kein Ausweichen/Zittern der Buchstaben am Cursor mehr, kein Ergrauen. Stattdessen Glow: Buchstaben in Cursornähe leuchten blau und bekommen einen Schein (zwei vergrößerte Rückseiten-Hüllen je Buchstabe, `HALO_SCALES`), dazu das Punktlicht.
- Login → App: Die Wörter richten sich vor dem Login gerade aus (`prepareExit` in `Wordmark3D`, max. ~0,8 s), werden als PNG festgehalten und fliegen in `BrandFlight.jsx` mit weicher Kurve ins neue Logo der Sidebar; das Standbild blendet dabei in die flache Fassung über. Google-Login hält sofort fest (Popup braucht direkte Nutzergeste).
- Neu: `BrandLogo.jsx` (FOCUS FLOW als Logo statt Text „FocusFlow“ in der Sidebar, Ziel per `data-brand-word`).

### Tests
- `vite build` ok, Lint ohne neue Fehler. Headless-Chrome: Hover-Glow, Einflug, Flug nach Gast-Login (Einzelbilder) geprüft, keine Konsolenfehler. Nicht geprüft: Touch/Gyro, Hell-Modus, Handy-Flug, E-Mail/Google-Login.

### Offen
- Das Gast-Willkommensfenster erscheint gleichzeitig mit dem Flug; ggf. Fenster erst nach dem Flug öffnen.
- Zugeklappte Sidebar (nur „FF“): Wörter fliegen dann nach oben aus dem Bild.

## Nachtrag 2026-10-09 (Claude Code): Zug zum Cursor, FF-Bildmarke, Zeichenfläche

### Getan
- **Abgeschnittene Buchstaben beim Einflug:** Die 3D-Zeichenfläche ragt jetzt über den Layout-Kasten hinaus (`wordmarkStage.js`: `STAGE_PAD_X/Y`), Kasten, Klickfläche und Flug bleiben gleich. Die Fläche selbst hat `pointer-events: none`.
- **Wirbeln beim Drüberfahren entfernt** (das war die Wisch-Erkennung). Es wirbelt nur noch bei Klick/Tipp auf das Wort.
- **Zug zum Cursor** (`Wordmark3D.jsx`, `PULL_*`): Buchstaben bleiben fest, werden aber über eine weiche Extra-Feder Richtung (geglättetem) Zeiger gezogen, am stärksten im mittleren Abstand, Nachbarn gehen anteilig mit, das ganze Wort driftet leicht mit, Buchstaben lehnen sich in Zugrichtung.
- **FF-Bildmarke:** Neu `BrandMark.jsx` (zwei kursive F aus der Wortmarke, ligaturartig verbunden) in der eingeklappten Sidebar statt „FF“-Text. App-Icons neu erzeugt (`public/icons/app-icon*.svg`, `icon-192/512`, `icon-maskable-512`, `apple-touch-icon`), das Favicon nutzt `app-icon-rounded.svg`. Die Erzeugung lief mit einem Skript im Session-Scratchpad (nicht im Repo): F-Pfad aus `focusFlowWordmarkData.js`, `FF_OFFSET` = 62 in `wordmarkPaths.js`.
- **Flug bei eingeklappter Sidebar:** `BrandFlight.jsx` wählt das Ziel selbst: offenes Logo (`data-brand-word`), sonst die beiden F der Bildmarke (`data-brand-f`; Wort schrumpft so, dass sein F auf dem Ziel-F landet, die übrigen Buchstaben verschwinden), sonst nach oben raus.

### Tests
- `vite build` ok, Lint ohne neue Fehler. Headless-Chrome: Einflug ohne Abschneiden, Zug beim Durchfahren mit der Maus, Flug mit offener und eingeklappter Sidebar, keine Konsolenfehler.
- Nicht geprüft: Touch/Gyro, Hell-Modus, Handy, PWA-Installation mit neuen Icons (Service Worker evtl. cacht alte Icons), Stärke des Zugs am echten Mauszeiger.

### Offen
- Stellschrauben: `PULL_MAX`, `PULL_COUPLING`, `PULL_STIFFNESS`/`PULL_DAMPING`, `FF_OFFSET`.
- `shortcut-*.png` und Manifest-Farben unverändert.

## Nachtrag 2026-10-09 (Claude Code): Anschlag der Buchstaben, Logo-Animation beim Einklappen

### Getan
- **Buchstaben dringen nie ineinander ein** (`Wordmark3D.jsx`): Je Buchstabe wird die Silhouette (links/rechts je Zeile, aus den Umrissdaten) berechnet. Nach der Feder-Integration prüft ein Anschlag-Schritt jedes Nachbarpaar (`gapBetween`, `MIN_GAP` = 3, nie kleiner als der Ruheabstand im Logo) und schiebt sich berührende Buchstaben gegenseitig weg (mehrere Durchläufe, Nachbarn gehen mit). Nur im Ruhezustand, Einflug und Klick-Wirbeln dürfen durcheinanderfliegen. Vertikaler Zug auf 40 %, Neigung in Zugrichtung verkleinert.
- **Sidebar-Logo** (`BrandLockup.jsx` ersetzt `BrandLogo` und `BrandMark`): ein Logo, das beim Ein-/Ausklappen animiert (JS-Fortschritt, 650 ms, rAF). Die beiden F bleiben stehen, O/C/U/S und L/O/W schieben sich in die F hinein und blenden aus, das F von FLOW wandert nach links und verkürzt dabei seinen Balken exakt auf die Länge des F von FOCUS (der Balkenabschluss ist dasselbe Rundungsprofil, nur um `BAR_SHIFT` verschoben; die Punkte werden zurückgeschoben). Endzustand = FF-Bildmarke, Mitte in der 72-px-Leiste. Flug nach dem Login findet seine Ziele weiter über `data-brand-word` bzw. `data-brand-f` (je nach Zustand nur eine Sorte im DOM).

### Tests
- `vite build` ok. Headless-Chrome: Cursor-Zug mit Anschlag (Einzelbilder), Einklappen mit künstlicher Zeit in 65-ms-Schritten, beide Login-Flüge, keine Konsolenfehler.
- Nicht geprüft: Ausklappen (gleiche Funktion rückwärts), Tablet-Drawer, Touch, Handy, Hell-Modus der Wortmarke.

### Offen
- Anschlag nutzt Zeilenprofile mit 1-Einheiten-Raster; sehr starke Neigung des ganzen Wortes ändert nichts daran (alles im Wortraum).
- Stellschrauben: `MIN_GAP`, `PULL_*` in `Wordmark3D.jsx`; `DURATION`, Fenster in `apply` in `BrandLockup.jsx`.

## Nachtrag 2026-10-09 (Claude Code): Buchstaben ziehen, mehr Luft, Sidebar synchron

### Getan
- **Kein Zittern/Wirbeln per Klick mehr.** Das Wirbeln gibt es nur noch beim Einflug (`scramble` intern), `burst` ist entfernt.
- **Buchstaben greifen und ziehen** (`Wordmark3D.jsx`): Beim Klick/Tipp wird der Buchstabe unter dem Zeiger über seine Silhouette erkannt (`hitLetter`, Toleranz `HIT_TOLERANCE`). Gedrückt halten zieht ihn (angehoben, mit Glow, leichte Schräglage) überallhin, auch über die ganze Seite: Dafür wird die Zeichenfläche beim Ziehen fensterfüllend (`wide`, `position: fixed`, Kamera per `setViewOffset`, gleiche Perspektive). Die Nachbarn werden etwas mitgezogen. Beim Loslassen federt er zurück (`RETURN_*`), bleibt dabei vorn und darf über die anderen hinweg, danach gilt wieder die Kollisionsprüfung. Cursor: `grab`/`grabbing`. Auf Touch: `touch-action: pan-y`, Ziehen also horizontal.
- **Mehr Abstand:** Bei Zug/Hover (`MIN_GAP_ACTIVE` = 6) lassen benachbarte Buchstaben mehr Luft als im Ruhezustand; im Ruhezustand gilt der Logo-Abstand.
- **Sidebar und Logo exakt gleichzeitig:** `BrandLockup` leitet seinen Fortschritt jedes Bild aus der echten Breite der Sidebar ab (`aside.getBoundingClientRect()`), egal mit welcher Dauer oder Kurve die Sidebar läuft. Die äußeren Buchstaben gehen zuerst, damit nichts von der schmaler werdenden Sidebar abgeschnitten wird. Sidebar-Übergang von 300 auf 450 ms (`Sidebar.jsx`).
- `tests/sidebar_geometry_and_state.test.js` (SIDEBAR-GEOM-02) prüft jetzt den `BrandLockup` statt des alten Monogramm-Slots.

### Tests
- `vite build` ok, Vitest 179/180 (nur der bekannte wacklige Kalender-Test), E2E-Skript 141/142 (nur T2-CAL-04, wie vorher).
- Headless-Chrome: Hover (`grab`), Ziehen eines O quer über die Karte, Zurückfedern, Sidebar-Breite gegen Logo-Fortschritt aufgezeichnet. Hinweis: Im langsamen Headless-Chrome dauert der Einflug länger, Greifen geht erst danach.

### Offen
- Echtes Ziehen/Loslassen mit Maus und Touch von Hand ausprobieren, Stellschrauben: `DRAG_*`, `RETURN_*`, `MIN_GAP_ACTIVE`, Nachbar-Faktoren (0,14 / 0,05).
- Hell-Modus, Handy und Tablet-Drawer ungeprüft.

### Bugfix 2026-10-09: Wortmarke riesig nach dem Ziehen
- Ursache: Nach dem Wechsel der Zeichenfläche von `position: fixed` (Ziehen) zurück auf `absolute` hat Chrome die Prozentwerte (`left/top/width/height` in %) gegen das Fenster statt gegen den Kasten aufgelöst (Fläche 3040×2250 statt 958×520), das Wort erschien ~3× zu groß. Kamera und Szene waren korrekt.
- Fix in `Wordmark3D.jsx` (`layout`): Im Normalmodus feste Pixelwerte aus `boxW/boxH` statt Prozent. Im Headless-Chrome reproduziert (U ziehen, loslassen) und nach dem Fix geprüft.

## Nachtrag 2026-10-10 (Claude Code): Wortmarke am Handy
- **Buchstaben am Handy ziehen** (`Wordmark3D.jsx`): Trifft der Finger einen Buchstaben (größere Trefferfläche `HIT_TOLERANCE_TOUCH`, auch knapp daneben), gehört die Geste ihm: `touchstart`/`touchmove` (nicht passiv) rufen `preventDefault`, dazu `overscroll-behavior: none` während des Ziehens. Dadurch weder Scrollen noch Pull-to-Refresh. `touch-action: pan-y` entfernt (Entscheidung erst beim Berühren).
- **Riesige Wortmarke nach Antippen:** Dasselbe Prozent-Problem wie beim Ziehen am Desktop (siehe Bugfix oben), am Handy löst schon ein Tippen den Fenster-Modus aus. Fenstermaße jetzt über `viewW()`/`viewH()` (`clientWidth` ohne Scrollbalken, `innerHeight`) für Canvas und Kamera.
- **Login-Hintergrundband** (`LoginMarquee.jsx`): Nach dem Design-System-Umbau sind Farben CSS-Variablen ohne Alpha, `text-primary/[0.055]` wirkte nicht mehr und das Band war voll deckend weiß. Jetzt `text-primary` plus `opacity-[0.055] dark:opacity-[0.07]` auf einer inneren Ebene.
- Geprüft im Headless-Chrome (Handy-Emulation 390×844, Touch): Ziehen des C quer über die Karte, Seite bleibt bei `scrollY` 0, danach normale Größe. Nicht auf einem echten Gerät getestet (iOS-Gyro-Erlaubnis, Adressleiste).

### Bugfix 2026-10-10 (2): Seite springt/streckt sich am Handy nach dem Antippen/Ziehen eines Buchstabens
- Ursache (per Bisektion im Handy-Emulator belegt): Der Fenstermodus nutzte `position: fixed`. Nach dem Zurückschalten auf `absolute` wuchs das Layout-Viewport von Chrome (innerWidth 390 → 519, innerHeight 844 → 1124), die ganze Seite wurde dadurch neu skaliert. Ohne den Fenstermodus trat es nicht auf.
- Fix (`Wordmark3D.jsx`): Der Fenstermodus bleibt `position: absolute` im Kasten und wird per `left/top = -Kasten.left/top` auf das Fenster versetzt (jeden Frame nachgeführt), kein `fixed` mehr. Zusätzlich beginnt der Fenstermodus erst, wenn der Zeiger sich mehr als 6 px bewegt hat: Ein bloßes Antippen ändert am Layout nichts.
- Außerdem `Login.jsx`: Der Theme-Umschalter hing in der Mitte/links, weil `IconButton` selbst `relative` setzt und `absolute` aus `className` verdrängt. Jetzt in eigenem `absolute`-Wrapper (oben rechts).
- Geprüft im Handy-Emulator (390×844, Touch): Antippen und Ziehen, Viewport bleibt 390×844, Seite stabil; Desktop: Ziehen, Loslassen, Flug nach Login ohne Fehler.

---

## Nachtrag 2026-10-10 (Claude Code): Design System vollständig umgesetzt

### Getan
- **Regel 01** (`.agents/rules/01-ui-guidelines.md`) komplett ersetzt, abgeleitet aus dem Claude-Design-System-Artefakt (Warmes Neutral plus Kobalt). Regel 05 (Verweis auf Abschnitt 12) und 07 (Pfad `ds/overlays.jsx`, Griff-Klassen), `CLAUDE.md`-Tabelle, `docs/INDEX.md` und `docs/Wissen/00_System_und_Design/01-UI-Design-System.md` angepasst.
- **Fundament:** `src/styles/tokens.css` (Hell/Dunkel über `data-theme`), `src/styles/tailwind-preset.js` (entfernt die Roh-Palette, Farben sind CSS-Variablen), Schriften lokal in `src/assets/fonts/`, `src/lib/theme.js` (System/Hell/Dunkel, Key `focusflow_theme`), `src/lib/historyStyle.js`. Bausteine in `src/components/ds/` (`core`, `actions`, `forms`, `display`, `feedback`, `navigation`, `overlays`). Gelöscht: `ui/Button`, `Card`, `Badge`, `Input`, `EmptyState`, `Skeleton`, `Overlay`, `FioIcon`.
- **Umgestellt:** alle Screens (Home, Gedanken, Erinnerungen, Projekte, Kanban, Detailseiten, Kalender samt `EventEditForm`, Coach, Wochenrückblick, Papierkorb, Login, E-Mail-Bestätigung, Rechtsseiten), alle Modals und Einstellungen (Account, Fio-Guide, Hilfe, Über), Sidebar, BottomNav, Toast, Befehlsleiste, Schnellerfassung, Kürzel-Übersicht, `ProjectAiChat`, `ProjectDraftCard` (am Handy als `Sheet`). Im Coach sind Verlauf, Kontext-Auswahl und Verlaufsfilter jetzt `Dialog` mit gemeinsamen Auswahlzeilen.
- **Inhalte:** Emoji aus UI, Fio-Prompts (`Coach.jsx`, `aiActionEngine.js`), Quick-Prompts und Fehlermeldungen entfernt; Satzschreibung statt Versalien (Phasentitel, Datumsangaben, `projectProgress.js`-Labels); „&“ in UI-Labels durch „und“. Fehlerpräfix der KI jetzt `**Fehler:**` (`gemini.js`, `projectDraft.js` abgestimmt). Screen-Wechsel blendet über `.screen-transition` ein (`index.css`, `App.jsx`).

### Tests & Build
- `npx vitest run`: 14 Dateien, 180/180 grün. Die zwei früher wackligen Tests in `tests/calendar_events_hook.test.jsx` (Race zwischen Fehler-Reset und Cache) warten jetzt auf beides gemeinsam; drei Gesamtläufe in Folge grün.
- `node scripts/run-e2e-tests.js`: 142/142. `calendar_security` 20/20, `firestore_security` 16/16. `vite build` ok, `oxlint` nur alte Warnungen.
- Angepasst wurden Tests, die alte Klassen oder Versalien-Labels prüften (`calendar_ui`, `project_progress`, `data_context`, `settings_modal`, `tier1`, `tier2`, `responsive_drawers`). Der Tages-Sheet-Test in `calendar_ui` klickt nicht mehr „10“, denn der Heute-Knopf zeigt am 10.10. dieselbe Zahl und der Test brach am Datumswechsel.
- Browser (Dev-Konto, 1280 und 375 px, Hell und Dunkel): Home, Gedanken, Erinnerungen (mit „Neue Erinnerung“-Sheet), Projektliste, Kanban, Papierkorb, Wochenrückblick, Coach (Verlauf, Kontext-Dialog), Befehlsleiste, Kürzel-Dialog, Einstellungen (Fio-Guide, Hilfe), Projektdetail am Handy.

### Offen / Next Steps
1. Echte Geräte prüfen (Wischen, Langdruck, iOS). Kalender-Raster und `CalendarHeader` nur per Tests, weil das Dev-Konto keinen Google-Token hat.
2. `TaskDetailDrawer`, `SectionDetailDrawer`, `GlobalChatDrawer` bleiben eigene Seitenpanels (stehen in `ProjectDetail` nebeneinander); bei Bedarf auf `Sheet` heben.
3. Rich-Text-Editor und Markdown-Stile in `index.css` sind nicht Teil des Systems.
4. Noch nicht neu angesehen nach dem letzten Umbau: Projekt- und Aufgaben-Modal, Login im Hellen.
5. Nichts committet; die Änderungen liegen im Arbeitsbaum (parallele Sitzung im selben Checkout, `src/components/brand/*` unberührt).

### Fallstricke
- Farben sind CSS-Variablen: keine Deckkraft-Zusätze wie `bg-accent/50`, dafür `-subtle`-Töne. Rohe Tailwind-Farben kompilieren nicht.
- `IconButton` und `Button` setzen selbst `relative`; `absolute` per `className` wird verdrängt, also in einen Wrapper legen.
- `Dialog` und `Sheet` ziehen den Startfokus auf das Element mit `data-autofocus`, nicht auf `autoFocus`.
- Skripte mit Backslashes oder `$` als Datei schreiben, nicht per Heredoc.

### Nachtrag 2026-10-10 (Claude Code): Design-Drift verhindern
- **Prüfskript:** `npm run check:design` (`scripts/check-design-system.js`), zusätzlich als `tests/design_system.test.js` in `vitest.config.js`. Findet Klassen ohne Wirkung (rohe Farben, `/50`), Emoji, freie Größen/Radien/Farben/z-Werte, `dark:`, Gewichtsklassen, Versalien ohne `text-eyebrow`, Verläufe, `alert()`/`confirm()`. Ausnahmen nur mit `ds-allow`/`ds-allow-next` und Grund. Nicht geprüft: `brand/`, `data/` (nur Emoji), `prototype3d/`, `styles/`.
- **Echter Fund:** `useCardTouchDrag.js` (Drag-Vorschaubild) las noch `classList.contains('dark')` mit Hex-Farben und Verlauf; nutzt jetzt Tokens.
- **Neu:** `docs/Wissen/00_System_und_Design/06-Design-System-Referenz.md` (Artefakt-Link und Stand `1791643192-9772`, Zuordnung, Abweichungen, Begründungen, Ablauf einer Design-Änderung, Abgleich). `CLAUDE.md` hat den Abschnitt „UI und Design System (verbindlich)“; Regel 01 hat Abschnitt 0 „Quelle und Änderungen“.
- **Bereinigt:** veraltete Klassenangaben (`rounded-2xl`, `outline-variant`, `bg-black/…`, `z-[100]`, `FioIcon` …) in 8 Wissens-Dateien. Offen für die Marken-Sitzung: `12_3D_Branding…` nennt beim Login-Band noch `text-primary/[0.055]` und `dark:text-white`.
- **Regel:** Das Design wird nicht eigenmächtig geändert. Ablauf: Vorschlag, Freigabe, erst Artefakt (Artifact-Tool, `project/…`), dann Repo, dann Referenz und Prüfung.
- Tests: Vitest 181/181, E2E 142/142, `check:design` grün.
