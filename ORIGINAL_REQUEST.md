# Original User Request

## 2026-08-04T21:47:53Z

Implementierung eines "Wochenrückblick" (Weekly Review) Features. Das Feature nutzt vorhandene Daten (erledigte Inbox-Items, Projekt-Fortschritte, abgeschlossene Phasen), um dem Nutzer am Ende der Woche einen motivierenden und klaren Überblick über seine Leistung und unfertige Aufgaben zu geben.

Working directory: c:\Users\Fabia\Desktop\Eigene_Projekte\vibe_codeing\focusflow
Integrity mode: development

## Requirements

### R1. Produktivitäts-Dashboard
Erstelle eine dedizierte Dashboard-Seite für den Wochenrückblick, die harte Metriken visualisiert. Dazu gehören die Anzahl der diese Woche erledigten Tasks, der prozentuale Projektfortschritt und die abgeschlossenen Phasen.

### R2. System Health Übersicht
Integriere einen Bereich, der offene "Inbox"-Items sowie Projekte mit Rückstand oder Warnungen übersichtlich darstellt, um den Fokus auf Problemstellen zu lenken.

### R3. Ausblick & Fokus
Füge einen Abschnitt hinzu, der die nächsten anstehenden Schritte ("nextSteps") für die kommende Woche aus den aktiven Projekten aggregiert auflistet.

## Acceptance Criteria

### Dashboard & Navigation
- [ ] Der Wochenrückblick ist als eigene Ansicht im React-Routing oder in der Navigationsoberfläche verankert und öffnet sich fehlerfrei.

### Daten-Integration
- [ ] Die angezeigten Metriken, Rückstände und nächsten Schritte basieren direkt auf den in `mockData.js` vorhandenen Strukturen (Inbox, Projekte, Phasen).

### Visuelle Umsetzung
- [ ] Das Dashboard ist übersichtlich gegliedert (Produktivität, Health, Ausblick) und passt sich an das bestehende Design-System der App an.
