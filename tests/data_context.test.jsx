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

function ContextProbe({ onContext }) {
  onContext(useData());
  return null;
}

function renderDataContext() {
  let value;
  render(
    <DataProvider>
      <ContextProbe onContext={(context) => { value = context; }} />
    </DataProvider>
  );
  return {
    get value() {
      return value;
    }
  };
}

describe('DataProvider guest business mutations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates normalized projects and skips blank phases/tasks', async () => {
    const probe = renderDataContext();
    await waitFor(() => expect(probe.value.projects).toHaveLength(1));

    await act(async () => {
      await probe.value.addProject({
        title: 'New project',
        phases: [
          {
            title: '  first phase ',
            tasks: [
              { title: '  first task ', date: '', note: ' note ' },
              { title: '   ' }
            ]
          },
          { title: '   ' }
        ]
      });
    });

    const project = probe.value.projects[0];
    expect(project.title).toBe('New project');
    expect(project.phases).toHaveLength(1);
    expect(project.phases[0].title).toBe('FIRST PHASE');
    expect(project.phases[0].tasks[0]).toMatchObject({
      title: 'first task',
      date: 'Demnächst',
      completed: false,
      note: ' note '
    });
    expect(project.tasksTotal).toBe(1);
    expect(project.progress).toBe(0);
    expect(probe.value.selectedProjectId).toBe(project.id);
  });

  it('updates task completion, progress, phase completion, and project status', async () => {
    const probe = renderDataContext();
    await waitFor(() => expect(probe.value.projects).toHaveLength(1));
    let project;
    await act(async () => {
      await probe.value.addProject({
        title: 'Task project',
        phases: [{ title: 'Phase', tasks: [{ title: 'Task 1' }, { title: 'Task 2' }] }]
      });
    });
    project = probe.value.projects.find((item) => item.id === probe.value.selectedProjectId);
    const phase = project.phases[0];
    const task = phase.tasks[0];

    await act(async () => {
      probe.value.toggleTask(project.id, phase.id, task.id);
    });
    const updated = probe.value.projects[0];
    expect(updated.progress).toBe(50);
    expect(updated.tasksCompleted).toBe(1);
    expect(updated.status).toBe('GEPLANT');
    expect(updated.phases[0].completed).toBe(false);

    await act(async () => {
      probe.value.toggleTask(project.id, phase.id, phase.tasks[1].id);
    });
    const completed = probe.value.projects[0];
    expect(completed.progress).toBe(100);
    expect(completed.status).toBe('ABGESCHLOSSEN');
    expect(completed.phases[0].completed).toBe(true);
  });

  it('persists reminder mutations for guest users and updates status transitions', async () => {
    const probe = renderDataContext();
    await waitFor(() => expect(probe.value.reminders).toHaveLength(2));

    await act(async () => {
      await probe.value.addReminder({ title: '  New reminder  ', description: 'desc' });
    });
    const reminder = probe.value.reminders[0];
    expect(reminder.title).toBe('  New reminder  ');
    expect(probe.value.selectedReminderId).toBe(reminder.id);

    await act(async () => {
      probe.value.toggleReminderStatus(reminder.id);
    });
    expect(probe.value.reminders[0].status).toBe('AKTIV');
    expect(JSON.parse(localStorage.getItem('focusflow_guest_reminders'))[0].status).toBe('AKTIV');
  });
});
