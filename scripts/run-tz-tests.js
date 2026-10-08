// Führt die zeitzonenabhängigen Kalender-Tests in mehreren Zeitzonen aus (Sommerzeit-Regeln, positive/negative Offsets).
// Aufruf: npm run test:tz
import { spawnSync } from 'node:child_process';

const ZONES = ['UTC', 'Europe/Berlin', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata'];
const FILES = ['tests/calendar_utils.test.js'];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let failed = false;
for (const tz of ZONES) {
  console.log(`\n=== Zeitzone ${tz} ===`);
  const res = spawnSync(npx, ['vitest', 'run', ...FILES], {
    env: { ...process.env, TZ: tz },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
