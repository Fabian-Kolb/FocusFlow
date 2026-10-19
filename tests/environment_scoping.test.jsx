import { act, render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const guestUser = { uid: 'guest_preview_user', isGuest: true, email: 'guest@example.com' };
vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: guestUser })
}));
vi.mock('../src/lib/firebase.js', () => ({
  db: {}
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((...parts) => parts.join('/')),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn()
}));

import { DataProvider, useData } from '../src/context/DataContext.jsx';
import { EnvironmentProvider, useEnvironment } from '../src/context/EnvironmentContext.jsx';

function Probe({ onContext }) {
  onContext({ ...useData(), ...useEnvironment() });
  return null;
}

function renderApp() {
  let value;
  render(
    <EnvironmentProvider>
      <DataProvider>
        <Probe onContext={(context) => { value = context; }} />
      </DataProvider>
    </EnvironmentProvider>
  );
  return {
    get value() {
      return value;
    }
  };
}

const project = (id, env) => ({ id, title: `Projekt ${id}`, status: 'AKTIV', phases: [], notes: [], history: [], categoryId: 'allgemein', ...(env ? { environmentId: env } : {}) });
const reminder = (id, env) => ({ id, title: `Eintrag ${id}`, status: 'AKTIV', date: '', time: '', categoryId: 'allgemein', ...(env ? { environmentId: env } : {}) });
const thought = (id, env) => ({ id, createdAt: Date.now(), title: `Gedanke ${id}`, type: 'unclassified', ...(env ? { environmentId: env } : {}) });

const seed = () => {
  localStorage.setItem('focusflow_guest_projects', JSON.stringify([project('p1'), project('p2', 'hochschule'), project('p3', 'arbeit')]));
  localStorage.setItem('focusflow_guest_reminders', JSON.stringify([reminder('r1'), reminder('r2', 'hochschule'), reminder('r3', 'hochschule'), reminder('r4', 'arbeit')]));
  localStorage.setItem('focusflow_guest_inbox', JSON.stringify([thought('i_1'), thought('i_2', 'hochschule')]));
};

const thoughts = (value) => Object.values(value.inboxItems).flat();
const storedReminder = (id) => JSON.parse(localStorage.getItem('focusflow_guest_reminders')).find((r) => r.id === id);

describe('Umgebungen im DataContext', () => {
  beforeEach(() => {
    localStorage.clear();
    seed();
  });

  it('Allgemein ist Standard und zeigt nur Dinge ohne Umgebung; die all…-Listen sind ungefiltert', async () => {
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allProjects).toHaveLength(3));
    expect(probe.value.activeEnvironmentId).toBe('allgemein');
    expect(probe.value.projects.map((p) => p.id)).toEqual(['p1']);
    expect(probe.value.reminders.map((r) => r.id)).toEqual(['r1']);
    expect(thoughts(probe.value).map((i) => i.id)).toEqual(['i_1']);
    expect(probe.value.allReminders).toHaveLength(4);
    expect(Object.values(probe.value.allInboxItems).flat()).toHaveLength(2);
  });

  it('die gespeicherte Umgebung filtert Projekte, Merkliste und Gedanken', async () => {
    localStorage.setItem('focusflow_environment', 'hochschule');
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allProjects).toHaveLength(3));
    expect(probe.value.activeEnvironmentId).toBe('hochschule');
    expect(probe.value.projects.map((p) => p.id)).toEqual(['p2']);
    expect(probe.value.reminders.map((r) => r.id).sort()).toEqual(['r2', 'r3']);
    expect(thoughts(probe.value).map((i) => i.id)).toEqual(['i_2']);
  });

  it('beim Wechsel zeigen die Listen sofort die neue Umgebung', async () => {
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allProjects).toHaveLength(3));
    await act(async () => { probe.value.setActiveEnvironment('arbeit'); });
    expect(probe.value.projects.map((p) => p.id)).toEqual(['p3']);
    expect(probe.value.reminders.map((r) => r.id)).toEqual(['r4']);
    expect(localStorage.getItem('focusflow_environment')).toBe('arbeit');
  });

  it('neu angelegte Dinge gehören zur aktiven Umgebung; in Allgemein setzen sie kein Feld', async () => {
    localStorage.setItem('focusflow_environment', 'hochschule');
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allProjects).toHaveLength(3));

    let reminderId;
    await act(async () => { reminderId = await probe.value.addReminder({ title: 'Blatt 5 abgeben', status: 'AKTIV' }); });
    expect(storedReminder(reminderId).environmentId).toBe('hochschule');
    expect(probe.value.reminders.some((r) => r.id === reminderId)).toBe(true);

    let projectId;
    await act(async () => { projectId = await probe.value.addProject({ title: 'Analysis' }); });
    expect(JSON.parse(localStorage.getItem('focusflow_guest_projects')).find((p) => p.id === projectId).environmentId).toBe('hochschule');

    await act(async () => { await probe.value.addInboxItem('Idee für die Klausur'); });
    expect(JSON.parse(localStorage.getItem('focusflow_guest_inbox')).find((i) => i.title === 'Idee für die Klausur').environmentId).toBe('hochschule');

    await act(async () => { probe.value.setActiveEnvironment('allgemein'); });
    let plainId;
    await act(async () => { plainId = await probe.value.addReminder({ title: 'Einkaufen' }); });
    expect('environmentId' in storedReminder(plainId)).toBe(false);
  });

  it('Verschieben nach Hochschule setzt das Feld, zurück nach Allgemein entfernt den Schlüssel', async () => {
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allReminders).toHaveLength(4));

    await act(async () => { await probe.value.moveToEnvironment('reminder', 'r1', 'hochschule'); });
    expect(storedReminder('r1').environmentId).toBe('hochschule');
    expect(probe.value.reminders.some((r) => r.id === 'r1')).toBe(false);

    await act(async () => { probe.value.setActiveEnvironment('hochschule'); });
    await act(async () => { await probe.value.moveToEnvironment('reminder', 'r1', 'allgemein'); });
    expect('environmentId' in storedReminder('r1')).toBe(false);
    expect(probe.value.reminders.some((r) => r.id === 'r1')).toBe(false);
  });

  it('Verschieben funktioniert auch für Projekte und Gedanken und ist wirkungslos, wenn nichts zu tun ist', async () => {
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allProjects).toHaveLength(3));

    await act(async () => { await probe.value.moveToEnvironment('project', 'p1', 'arbeit'); });
    expect(JSON.parse(localStorage.getItem('focusflow_guest_projects')).find((p) => p.id === 'p1').environmentId).toBe('arbeit');

    await act(async () => { await probe.value.moveToEnvironment('thought', 'i_1', 'gym'); });
    expect(JSON.parse(localStorage.getItem('focusflow_guest_inbox')).find((i) => i.id === 'i_1').environmentId).toBe('gym');

    const before = localStorage.getItem('focusflow_guest_reminders');
    await act(async () => { await probe.value.moveToEnvironment('reminder', 'r4', 'arbeit'); }); // liegt schon dort
    expect(localStorage.getItem('focusflow_guest_reminders')).toBe(before);
  });

  it('eine ausgeschaltete oder unbekannte Umgebung fällt auf Allgemein zurück', async () => {
    localStorage.setItem('focusflow_environment', 'quatsch');
    const probe = renderApp();
    await waitFor(() => expect(probe.value.allProjects).toHaveLength(3));
    expect(probe.value.activeEnvironmentId).toBe('allgemein');

    await act(async () => { probe.value.setActiveEnvironment('arbeit'); });
    await act(async () => { probe.value.setEnvironmentEnabled('arbeit', false); });
    expect(probe.value.activeEnvironmentId).toBe('allgemein');
    expect(probe.value.enabledIds).not.toContain('arbeit');
    await act(async () => { probe.value.setEnvironmentEnabled('allgemein', false); });
    expect(probe.value.enabledIds).toContain('allgemein');
  });
});
