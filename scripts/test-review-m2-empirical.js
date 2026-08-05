import React from 'react';
import { renderToString } from 'react-dom/server';
import ModalContext from '../src/context/ModalContext.jsx';
import Review from '../src/components/screens/Review.jsx';

console.log('=== EMPIRICAL STRESS TEST SUITE: MILESTONE 2 (R2 SYSTEM HEALTH) ===\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log('✅ PASS: ' + testName);
    passed++;
  } else {
    console.error('❌ FAIL: ' + testName + (details ? ' - ' + details : ''));
    failed++;
  }
}

function renderAndNormalize(contextValue) {
  const rawHtml = renderToString(
    React.createElement(
      ModalContext.Provider,
      { value: contextValue },
      React.createElement(Review)
    )
  );
  // Remove SSR comment markers <!-- --> for reliable text matching
  return rawHtml.replace(/<!-- -->/g, '');
}

// TEST 1: 0 open inbox items
console.log('--- TEST 1: 0 OPEN INBOX ITEMS ---');
try {
  const html1 = renderAndNormalize({
    projects: [],
    inboxItems: { today: [{ id: '1', title: 'Done task', completed: true }], yesterday: [] }
  });
  assert(html1.includes('0 OFFEN'), 'Displays "0 OFFEN" badge for open inbox items');
  assert(html1.includes('check_circle'), 'Renders "check_circle" icon when inbox is 0');
  assert(html1.includes('Inbox ist vollständig aufgeräumt!'), 'Renders "Inbox ist vollständig aufgeräumt!" text');
  assert(html1.includes('text-emerald-700 bg-emerald-50 border-emerald-300'), 'Uses emerald badge styling when open count is 0');
} catch (e) {
  assert(false, 'TEST 1 threw exception', e.stack);
}

// TEST 2: 0 flagged projects
console.log('\n--- TEST 2: 0 FLAGGED PROJECTS ---');
try {
  const html2 = renderAndNormalize({
    projects: [
      { id: 'p1', title: 'Project 1', status: 'AKTIV', progress: 60, timeElapsed: 50, isPaused: false, warning: null }
    ],
    inboxItems: { today: [], yesterday: [] }
  });
  assert(html2.includes('0 BETROFFEN'), 'Displays "0 BETROFFEN" badge for flagged projects');
  assert(html2.includes('verified'), 'Renders "verified" icon when flagged projects count is 0');
  assert(html2.includes('Alle aktiven Projekte sind im Zeitplan!'), 'Renders "Alle aktiven Projekte sind im Zeitplan!" text');
  assert(html2.includes('text-emerald-700 bg-emerald-50 border-emerald-300'), 'Uses emerald badge styling when flagged count is 0');
} catch (e) {
  assert(false, 'TEST 2 threw exception', e.stack);
}

// TEST 3: Projects with isPaused: true, timeElapsed > progress, and warning
console.log('\n--- TEST 3: FLAGGED & DELAYED PROJECTS ---');
try {
  const html3 = renderAndNormalize({
    projects: [
      { id: 'p1', title: 'Paused Project', status: 'AKTIV', progress: 50, timeElapsed: 40, isPaused: true, warning: null },
      { id: 'p2', title: 'Delayed Project', status: 'AKTIV', progress: 25, timeElapsed: 75, isPaused: false, warning: null },
      { id: 'p3', title: 'Warning Project', status: 'AKTIV', progress: 50, timeElapsed: 40, isPaused: false, warning: 'Critical Bug' }
    ],
    inboxItems: { today: [], yesterday: [] }
  });
  assert(html3.includes('3 BETROFFEN'), 'Displays "3 BETROFFEN" badge for flagged projects');
  assert(html3.includes('PAUSIERT'), 'Displays PAUSIERT badge for isPaused: true');
  assert(html3.includes('Rückstand: +50%'), 'Calculates and displays correct delay (75 - 25 = +50%)');
  assert(html3.includes('Critical Bug'), 'Displays custom warning text badge');
  assert(html3.includes('width:25%') && html3.includes('width:50%'), 'Progress bar rendered with progress and delay width percentages');
} catch (e) {
  assert(false, 'TEST 3 threw exception', e.stack);
}

// TEST 4: Null or missing inbox / projects arrays & robust handling
console.log('\n--- TEST 4: NULL OR MISSING INBOX / PROJECTS ARRAYS ---');
try {
  const html4a = renderAndNormalize({ projects: null, inboxItems: null });
  assert(html4a.includes('0 HINWEISE'), 'Handles projects: null and inboxItems: null gracefully');
  assert(html4a.includes('0 OFFEN'), 'Handles inboxItems: null with 0 open count');
  assert(html4a.includes('0 BETROFFEN'), 'Handles projects: null with 0 flagged count');

  const html4b = renderAndNormalize({ projects: undefined, inboxItems: undefined });
  assert(html4b.includes('0 HINWEISE'), 'Handles projects: undefined and inboxItems: undefined gracefully');

  const html4c = renderAndNormalize({ projects: [], inboxItems: { today: null, yesterday: null } });
  assert(html4c.includes('0 OFFEN'), 'Handles inboxItems with today: null and yesterday: null');

  const html4d = renderAndNormalize({
    projects: [null, undefined, { id: 'p1', title: 'Valid Project', status: 'AKTIV', progress: 50, timeElapsed: 60 }],
    inboxItems: { today: [null, undefined, { id: 'i1', title: 'Valid Item', completed: false }], yesterday: [] }
  });
  assert(html4d.includes('1 BETROFFEN'), 'Handles array with null/undefined elements safely for projects');
  assert(html4d.includes('1 OFFEN'), 'Handles array with null/undefined elements safely for inboxItems');
} catch (e) {
  assert(false, 'TEST 4 threw exception', e.stack);
}

console.log(`\n=== EMPIRICAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
