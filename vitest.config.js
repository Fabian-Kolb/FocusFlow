import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    include: [
      'tests/critical_backend.test.js',
      'tests/data_context.test.jsx',
      'tests/auth_context.test.jsx',
      'tests/calendar_sync.test.js',
      'tests/settings_modal.test.jsx',
      'tests/card_drag_and_drop.test.jsx',
      'tests/reminder_dates.test.js',
      'tests/calendar_ui.test.jsx',
      'tests/calendar_utils.test.js',
      'tests/calendar_events_hook.test.jsx',
      'tests/recurrence.test.js',
      'tests/command_search.test.js',
      'tests/dashboard_agenda.test.js',
      'tests/project_progress.test.js',
      'tests/design_system.test.js',
      'tests/speech_input.test.jsx',
      'tests/calendar_views.test.jsx',
      'tests/sheet_snap.test.js'
    ]
  }
});
