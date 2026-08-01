#!/usr/bin/env node

/**
 * FocusFlow E2E Master Test Runner
 * Dual-Track Opaque-Box Requirement-Driven Test Suite Runner
 */

import { E2ETestRunner } from '../tests/e2e_framework.js';
import { registerTier1Tests } from '../tests/tier1_feature_coverage.test.js';
import { registerTier2Tests } from '../tests/tier2_boundary_corner.test.js';
import { registerTier3Tests } from '../tests/tier3_cross_feature.test.js';
import { registerTier4Tests } from '../tests/tier4_real_world.test.js';

async function main() {
  const runner = new E2ETestRunner();

  // Register all 4 tiers of tests
  registerTier1Tests(runner);
  registerTier2Tests(runner);
  registerTier3Tests(runner);
  registerTier4Tests(runner);

  // Run test suite
  const success = await runner.run();

  if (!success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\x1b[31mFatal error running E2E test suite:\x1b[0m', err);
  process.exit(1);
});
