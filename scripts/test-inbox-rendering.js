import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ensureBulletPoints } from '../src/lib/gemini.js';
import fs from 'fs';
import { execSync } from 'child_process';

console.log('=== EMPIRICAL TEST SUITE: FOCUSFLOW INBOX & MARKDOWN RENDERING ===\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log('✅ PASS: ' + testName);
    passedTests++;
  } else {
    console.error('❌ FAIL: ' + testName + (details ? ' - ' + details : ''));
    failedTests++;
  }
}

// REQUIREMENT 1: NESTED LIST BULLET POINTS
console.log('--- REQUIREMENT 1: NESTED LIST BULLET POINTS ---');
const nestedInput = '- Item\n  - Subitem\n    - Deep subitem';
const processedNested = ensureBulletPoints(nestedInput);
assert(processedNested === '- Item\n  - Subitem\n    - Deep subitem', 'ensureBulletPoints preserves nested list bullet point structure');

const nestedHtml = renderToString(
  React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], className: 'markdown-body markdown-compact' }, processedNested)
);

assert(nestedHtml.includes('<ul>\n<li>Item'), 'Level 1 <ul> and <li> rendered correctly');
assert(nestedHtml.includes('<ul>\n<li>Subitem'), 'Level 2 nested <ul> and <li> rendered correctly');
assert(nestedHtml.includes('<ul>\n<li>Deep subitem</li>'), 'Level 3 nested <ul> and <li> rendered correctly');

// REQUIREMENT 2: CARDS WITH EMOJIS
console.log('\n--- REQUIREMENT 2: CARDS WITH EMOJIS ---');
const emojiInput1 = '- 🔴 High priority';
const processedEmoji1 = ensureBulletPoints(emojiInput1);
assert(processedEmoji1 === '- 🔴 High priority', 'Cards with emoji `- 🔴 High priority` remain correctly formatted');

const emojiHtml1 = renderToString(
  React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], className: 'markdown-body markdown-compact' }, processedEmoji1)
);
assert(emojiHtml1.includes('🔴 High priority') && emojiHtml1.includes('<li>🔴 High priority</li>'), 'Emoji stands AFTER bullet dash in rendered <li>');

const emojiInput2 = '🔴 - High priority';
const processedEmoji2 = ensureBulletPoints(emojiInput2);
assert(processedEmoji2 === '- 🔴 High priority', 'Post-processor converts `🔴 - High priority` to `- 🔴 High priority`');

const multiEmojiInput = '- 📁 Projekt Alpha\n  - 🔴 Urgent bugfix\n    - ⚡ High priority';
const processedMultiEmoji = ensureBulletPoints(multiEmojiInput);
const multiEmojiHtml = renderToString(
  React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], className: 'markdown-body markdown-compact' }, processedMultiEmoji)
);
assert(multiEmojiHtml.includes('📁 Projekt Alpha'), 'Level 1 emoji rendered in nested bullet tree');
assert(multiEmojiHtml.includes('🔴 Urgent bugfix'), 'Level 2 emoji rendered in nested bullet tree');
assert(multiEmojiHtml.includes('⚡ High priority'), 'Level 3 emoji rendered in nested bullet tree');

// REQUIREMENT 3: PARAGRAPH WRAPPING AND LIST ITEM MARGINS
console.log('\n--- REQUIREMENT 3: PARAGRAPH WRAPPING AND LIST ITEM MARGINS ---');
const indexCss = fs.readFileSync('./src/index.css', 'utf-8');

assert(indexCss.includes('.markdown-body {') && indexCss.includes('word-break: break-word;'), 'CSS has word-break: break-word on .markdown-body for long text wrapping');
assert(indexCss.includes('.markdown-body li > p {') && indexCss.includes('display: inline;'), 'CSS sets li > p display: inline to avoid bullet text wrapping onto new line');
assert(indexCss.includes('.markdown-body ul {') && indexCss.includes('list-style-type: disc !important;'), 'CSS level 1 list-style-type set to disc');
assert(indexCss.includes('.markdown-body ul ul {') && indexCss.includes('list-style-type: circle !important;'), 'CSS level 2 list-style-type set to circle');
assert(indexCss.includes('.markdown-body ul ul ul {') && indexCss.includes('list-style-type: square !important;'), 'CSS level 3 list-style-type set to square');
assert(indexCss.includes('.markdown-body li {') && indexCss.includes('margin-bottom: 0.25em;'), 'CSS li margin-bottom set for readability');
assert(indexCss.includes('.markdown-compact ul, .markdown-compact ol {') && indexCss.includes('margin-bottom: 0.25em !important;'), 'CSS markdown-compact list margin-bottom configured');

// REQUIREMENT 4: COMPILATION / BUNDLE CHECK (npm run build)
console.log('\n--- REQUIREMENT 4: ZERO COMPILATION / BUNDLE ERRORS ---');
try {
  const buildOutput = execSync('npm run build', { cwd: process.cwd(), encoding: 'utf-8' });
  assert(buildOutput.includes('built in') || buildOutput.includes('dist/index.html'), 'npm run build completed with zero errors');
} catch (err) {
  assert(false, 'npm run build failed', err.message);
}

console.log(`\n=== FINAL VERIFICATION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED ===`);
if (failedTests > 0) process.exit(1);
