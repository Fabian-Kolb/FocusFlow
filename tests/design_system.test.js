import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Hält das Design System ein: keine rohen Farben, keine Emoji, keine freien Größen/Radien/z-Werte,
// keine Klassen ohne Wirkung (Regel 01, `.agents/rules/01-ui-guidelines.md`).
// Die Prüfung selbst steht in `scripts/check-design-system.js` (auch als `npm run check:design`).
describe('Design System (Regel 01)', () => {
  it('Quellcode hält die Design-System-Regeln ein', () => {
    const script = path.resolve(process.cwd(), 'scripts/check-design-system.js');
    const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    if (run.status !== 0) {
      // Meldung der Prüfung im Testfehler sichtbar machen
      throw new Error(`\n${run.stderr || run.stdout}`);
    }
    expect(run.status).toBe(0);
  }, 90000);
});
