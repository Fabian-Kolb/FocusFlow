/**
 * E2E Testing Framework & Micro-Runner
 * Provides assertion library, DOM/State simulation, and test runner reporting for opaque-box testing.
 */

import { JSDOM } from 'jsdom'; // Fallback DOM simulation or synthetic DOM parsing

export class E2ETestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      tiers: {
        'Tier 1: Feature Coverage': { passed: 0, failed: 0, total: 0 },
        'Tier 2: Boundary & Corner Cases': { passed: 0, failed: 0, total: 0 },
        'Tier 3: Cross-Feature Interactions': { passed: 0, failed: 0, total: 0 },
        'Tier 4: Real-World Scenarios': { passed: 0, failed: 0, total: 0 },
      },
      features: {}
    };
    this.startTime = Date.now();
  }

  describe(tier, featureName, fn) {
    const suite = {
      tier,
      featureName,
      tests: [],
    };
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  }

  test(name, fn) {
    if (!this.currentSuite) {
      throw new Error('test() must be called inside a describe() block');
    }
    this.currentSuite.tests.push({ name, fn });
  }

  async run() {
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
    console.log('\x1b[36m%s\x1b[0m', '      FOCUSFLOW E2E TEST SUITE RUNNER (DUAL TRACK)     ');
    console.log('\x1b[36m%s\x1b[0m', '=======================================================\n');

    for (const suite of this.suites) {
      console.log(`\n\x1b[34m[${suite.tier}]\x1b[0m \x1b[1m${suite.featureName}\x1b[0m`);
      
      if (!this.results.features[suite.featureName]) {
        this.results.features[suite.featureName] = { passed: 0, failed: 0, total: 0 };
      }

      for (const t of suite.tests) {
        this.results.total++;
        this.results.tiers[suite.tier].total++;
        this.results.features[suite.featureName].total++;

        try {
          await t.fn();
          this.results.passed++;
          this.results.tiers[suite.tier].passed++;
          this.results.features[suite.featureName].passed++;
          console.log(`  \x1b[32m✓\x1b[0m ${t.name}`);
        } catch (err) {
          this.results.failed++;
          this.results.tiers[suite.tier].failed++;
          this.results.features[suite.featureName].failed++;
          console.log(`  \x1b[31m✗\x1b[0m ${t.name}`);
          console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
          if (err.stack) {
            const stackLine = err.stack.split('\n')[1];
            if (stackLine) console.log(`    \x1b[90m${stackLine.trim()}\x1b[0m`);
          }
        }
      }
    }

    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    this.printSummary(duration);
    return this.results.failed === 0;
  }

  printSummary(duration) {
    console.log('\n\x1b[36m%s\x1b[0m', '=======================================================');
    console.log('\x1b[36m%s\x1b[0m', '                 E2E TEST SUMMARY MATRIX                ');
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
    
    console.log('\n\x1b[1m--- RESULTS BY TIER ---\x1b[0m');
    for (const [tier, data] of Object.entries(this.results.tiers)) {
      const status = data.failed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
      console.log(`  ${tier.padEnd(36)} : ${data.passed}/${data.total} Passed [${status}]`);
    }

    console.log('\n\x1b[1m--- RESULTS BY FEATURE AREA ---\x1b[0m');
    for (const [feat, data] of Object.entries(this.results.features)) {
      const status = data.failed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
      console.log(`  ${feat.padEnd(36)} : ${data.passed}/${data.total} Passed [${status}]`);
    }

    console.log('\n\x1b[36m%s\x1b[0m', '-------------------------------------------------------');
    console.log(`Total Tests Executed : ${this.results.total}`);
    console.log(`Passed               : \x1b[32m${this.results.passed}\x1b[0m`);
    console.log(`Failed               : ${this.results.failed > 0 ? '\x1b[31m' + this.results.failed + '\x1b[0m' : '0'}`);
    console.log(`Execution Time       : ${duration}s`);
    console.log('\x1b[36m%s\x1b[0m', '=======================================================\n');
  }
}

// Lightweight assertions
export const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
};

export const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(message || `Expected '${expected}', but got '${actual}'`);
  }
};

export const assertContains = (haystack, needle, message) => {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected string to contain '${needle}', got '${haystack}'`);
    }
  } else if (Array.isArray(haystack)) {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected array to include '${needle}'`);
    }
  } else {
    throw new Error('haystack must be string or array');
  }
};

export const assertMatch = (str, pattern, message) => {
  if (!pattern.test(str)) {
    throw new Error(message || `Expected '${str}' to match regex ${pattern}`);
  }
};
