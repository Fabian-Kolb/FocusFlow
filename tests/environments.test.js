import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ENVIRONMENT_ID, ENVIRONMENTS, ENVIRONMENT_IDS, environmentField, environmentOf, getEnvironment, getEnvironmentNav, NAV_ORDER,
  inEnvironment, normalizeEnabled, resolveActive, screenLabel, summarizeElsewhere, summarizeEnvironment, withEnvironment,
} from '../src/lib/environments';

// Montag, 19. Oktober 2026, 10:00 Uhr
const NOW = new Date(2026, 9, 19, 10, 0);
const reminder = (over = {}) => ({ id: 'r', title: 'Aufgabe', status: 'AKTIV', date: '2026-10-19', time: '', ...over });
const project = (tasks, over = {}) => ({ id: 'p', title: 'Projekt', status: 'AKTIV', phases: [{ id: 'ph', title: 'Phase', tasks }], ...over });

describe('Umgebungen – Definition', () => {
  it('kennt Allgemein, Hochschule, Arbeit und Gym; Allgemein ist Standard und fertig', () => {
    expect(ENVIRONMENT_IDS).toEqual(['allgemein', 'hochschule', 'arbeit', 'gym']);
    expect(DEFAULT_ENVIRONMENT_ID).toBe('allgemein');
    expect(ENVIRONMENTS.allgemein.ready).toBe(true);
  });

  it('unbekannte Ids fallen auf Allgemein zurück', () => {
    expect(getEnvironment('quatsch').id).toBe('allgemein');
    expect(getEnvironment(undefined).id).toBe('allgemein');
    expect(getEnvironment('arbeit').id).toBe('arbeit');
  });

  it('jede Umgebung hat vier Plätze für die untere Leiste, und alle Einträge existieren', () => {
    ENVIRONMENT_IDS.forEach((id) => {
      const nav = getEnvironmentNav(id);
      expect(nav.tabs).toHaveLength(4);
      [...nav.tabs, ...nav.hub, ...nav.sidebar].forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeTruthy();
        expect(item.screens).toContain(item.id);
      });
      expect(nav.tabs[0].id).toBe('dashboard');
    });
  });

  it('Allgemein hat das Menü der App wie bisher, mit „Merkliste“ statt „Erinnerungen“', () => {
    const nav = getEnvironmentNav('allgemein');
    expect(nav.tabs.map((i) => i.id)).toEqual(['dashboard', 'projects', 'reminders', 'calendar']);
    expect(nav.hub.map((i) => i.id)).toEqual(['inbox', 'board', 'review', 'trash']);
    expect(nav.sidebar.map((i) => i.id)).toEqual(['dashboard', 'inbox', 'reminders', 'projects', 'board', 'calendar', 'coach', 'review', 'trash']);
    expect(nav.tabs.find((i) => i.id === 'reminders').label).toBe('Merkliste');
  });

  it('alle Umgebungen nutzen dieselbe Reihenfolge, nur ohne die fehlenden Punkte', () => {
    ENVIRONMENT_IDS.forEach((envId) => {
      const nav = getEnvironmentNav(envId);
      ['sidebar', 'hub'].forEach((part) => {
        const ids = nav[part].map((i) => i.id);
        expect(ids).toEqual([...ids].sort((a, b) => NAV_ORDER.indexOf(a) - NAV_ORDER.indexOf(b)));
        ids.forEach((id) => expect(NAV_ORDER).toContain(id));
      });
    });
    expect(getEnvironmentNav('arbeit').sidebar.map((i) => i.id).slice(0, 4)).toEqual(['dashboard', 'inbox', 'reminders', 'projects']);
  });

  it('Hochschule nennt Projekte „Fächer“, Gym hat eigene Plätze', () => {
    expect(getEnvironmentNav('hochschule').tabs.find((i) => i.id === 'projects').label).toBe('Fächer');
    expect(screenLabel('hochschule', 'projects')).toBe('Fächer');
    expect(screenLabel('allgemein', 'projects')).toBe('Projekte');
    expect(getEnvironmentNav('gym').tabs.map((i) => i.id)).toEqual(['dashboard', 'gym-log', 'gym-history', 'gym-progress']);
  });

  it('Detailseiten lassen den Menüpunkt aktiv aussehen', () => {
    const nav = getEnvironmentNav('allgemein');
    expect(nav.tabs.find((i) => i.id === 'projects').screens).toContain('project-detail');
    expect(nav.tabs.find((i) => i.id === 'reminders').screens).toContain('reminder-detail');
  });
});

describe('Umgebungen – Zugehörigkeit', () => {
  it('ohne Feld oder mit unbekanntem Wert gehört ein Ding zu Allgemein', () => {
    expect(environmentOf({})).toBe('allgemein');
    expect(environmentOf(undefined)).toBe('allgemein');
    expect(environmentOf({ environmentId: 'quatsch' })).toBe('allgemein');
    expect(environmentOf({ environmentId: 'gym' })).toBe('gym');
  });

  it('inEnvironment prüft genau eine Umgebung', () => {
    expect(inEnvironment({}, 'allgemein')).toBe(true);
    expect(inEnvironment({}, 'arbeit')).toBe(false);
    expect(inEnvironment({ environmentId: 'arbeit' }, 'arbeit')).toBe(true);
    expect(inEnvironment({ environmentId: 'arbeit' }, 'allgemein')).toBe(false);
    expect(inEnvironment({ environmentId: 'arbeit' }, 'quatsch')).toBe(false);
  });

  it('environmentField setzt das Feld nur außerhalb von Allgemein', () => {
    expect(environmentField('allgemein')).toEqual({});
    expect(environmentField('hochschule')).toEqual({ environmentId: 'hochschule' });
    expect(environmentField('quatsch')).toEqual({});
    expect(Object.keys(environmentField('allgemein'))).not.toContain('environmentId');
  });

  it('withEnvironment verschiebt und entfernt den Schlüssel bei Allgemein', () => {
    const item = { id: 'x', title: 'T' };
    expect(withEnvironment(item, 'gym')).toEqual({ id: 'x', title: 'T', environmentId: 'gym' });
    const moved = withEnvironment({ ...item, environmentId: 'gym' }, 'allgemein');
    expect(moved).toEqual({ id: 'x', title: 'T' });
    expect('environmentId' in moved).toBe(false);
    expect(withEnvironment({ ...item, environmentId: 'gym' }, 'arbeit').environmentId).toBe('arbeit');
    expect(item).toEqual({ id: 'x', title: 'T' }); // Original bleibt unverändert
  });
});

describe('Umgebungen – eingeschaltet', () => {
  it('Standard sind alle fertigen Umgebungen', () => {
    const ready = ENVIRONMENT_IDS.filter((id) => ENVIRONMENTS[id].ready);
    expect(normalizeEnabled(null)).toEqual(ready);
    expect(normalizeEnabled(undefined)).toEqual(ready);
    expect(normalizeEnabled('quatsch')).toEqual(ready);
  });

  it('Allgemein ist immer dabei, Unbekanntes fliegt raus, die Reihenfolge bleibt die der Vorlagen', () => {
    expect(normalizeEnabled(['arbeit'])).toEqual(['allgemein', 'arbeit']);
    expect(normalizeEnabled([])).toEqual(['allgemein']);
    expect(normalizeEnabled(['quatsch', 'hochschule'])).toEqual(['allgemein', 'hochschule']);
    expect(normalizeEnabled(['gym', 'arbeit'])).toEqual(['allgemein', 'arbeit', 'gym']);
  });

  it('die aktive Umgebung muss eingeschaltet sein, sonst Allgemein', () => {
    expect(resolveActive('arbeit', ['allgemein', 'arbeit'])).toBe('arbeit');
    expect(resolveActive('arbeit', ['allgemein'])).toBe('allgemein');
    expect(resolveActive('quatsch', ['allgemein', 'arbeit'])).toBe('allgemein');
  });
});

describe('Umgebungen – Lage', () => {
  const reminders = [
    reminder({ id: 'a', date: '2026-10-19' }), // Allgemein heute
    reminder({ id: 'h1', date: '2026-10-19', environmentId: 'hochschule' }),
    reminder({ id: 'h2', date: '2026-10-15', environmentId: 'hochschule' }), // überfällig
    reminder({ id: 'h3', date: '2026-10-25', environmentId: 'hochschule' }), // später
    reminder({ id: 'h4', date: '2026-10-19', environmentId: 'hochschule', status: 'ABGESCHLOSSEN' }),
    reminder({ id: 'w', date: '2026-10-19', environmentId: 'arbeit' }),
  ];

  it('zählt Überfälliges und Heutiges einer Umgebung, ohne Erledigtes und Späteres', () => {
    expect(summarizeEnvironment('hochschule', { reminders, now: NOW })).toEqual({ due: 2, overdue: 1 });
    expect(summarizeEnvironment('allgemein', { reminders, now: NOW })).toEqual({ due: 1, overdue: 0 });
    expect(summarizeEnvironment('gym', { reminders, now: NOW })).toEqual({ due: 0, overdue: 0 });
  });

  it('zählt Projekt-Aufgaben der Umgebung mit', () => {
    const projects = [
      project([{ id: 't', title: 'Blatt', date: '2026-10-19' }], { environmentId: 'hochschule' }),
      project([{ id: 't2', title: 'Anderes', date: '2026-10-19' }], { id: 'p2' }),
    ];
    expect(summarizeEnvironment('hochschule', { projects, now: NOW }).due).toBe(1);
    expect(summarizeEnvironment('allgemein', { projects, now: NOW }).due).toBe(1);
  });

  it('„Anderswo heute“ nennt nur andere Umgebungen mit etwas Fälligem', () => {
    const enabled = ['allgemein', 'hochschule', 'arbeit'];
    const elsewhere = summarizeElsewhere('allgemein', enabled, { reminders, now: NOW });
    expect(elsewhere.map((e) => e.id)).toEqual(['hochschule', 'arbeit']);
    expect(elsewhere[0]).toMatchObject({ due: 2, overdue: 1 });
    expect(summarizeElsewhere('hochschule', enabled, { reminders, now: NOW }).map((e) => e.id)).toEqual(['allgemein', 'arbeit']);
    expect(summarizeElsewhere('arbeit', ['allgemein', 'arbeit'], { reminders: [], now: NOW })).toEqual([]);
  });
});
