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
      'tests/calendar_sync.test.js'
    ]
  }
});
