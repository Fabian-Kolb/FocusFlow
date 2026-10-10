#!/usr/bin/env node
/**
 * Design-System-Prüfung (Regel 01, `.agents/rules/01-ui-guidelines.md`).
 *
 * Findet im Quellcode alles, was dem Design System widerspricht, damit das Design nicht still auseinanderläuft:
 *  1. Klassen, die mit dem Preset (`src/styles/tailwind-preset.js`) gar kein CSS erzeugen: rohe Palettenfarben,
 *     Deckkraft-Zusätze (`bg-accent/50`), Tailwind-Standardgrößen, freie z-Werte, Alt-Tokens. Tailwind meldet sie
 *     nicht selbst, sie wirken einfach nicht.
 *  2. Ausdrückliche Regeln: Emoji, `dark:`, freie Schriftgrößen/Radien/Farben, Gewichtsklassen, Großschreibung ohne
 *     `text-eyebrow`, Verläufe, `alert()`/`confirm()`.
 *
 * Aufruf:   npm run check:design            (Exit-Code 1 bei Verstößen)
 * Ausnahme: `ds-allow` in derselben Zeile oder `ds-allow-next` in der Zeile davor, immer mit Begründung.
 *           Dauerhafte Ausnahmen für ganze Dateien stehen unten in FILE_EXCEPTIONS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const tailwindConfig = (await import(pathToFileURL(path.join(root, 'tailwind.config.js')).href)).default;

// Ordner, die nicht zum App-UI gehören (eigene Markenfarben, 3D, Beispieldaten)
const SKIP_DIRS = ['src/prototype3d', 'src/components/brand', 'src/data', 'src/styles'];
// Nur die Emoji-Regel gilt auch dort, wo das UI Texte aus Daten bezieht
const EMOJI_ONLY_DIRS = ['src/components/brand', 'src/data'];
const FILE_EXCEPTIONS = {
  // Fällt ohne Provider (isolierte Tests) auf den Browser-Dialog zurück
  'src/context/ConfirmContext.jsx': ['browser-dialog'],
};

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B1B}\u{2B1C}\u{2705}]|\u{FE0F}/u;
const RAW_PALETTE = /\b(?:bg|text|border|ring|from|to|via|divide|shadow|fill|stroke|outline|placeholder|decoration|accent|caret)-(?:neutral|gray|slate|zinc|stone|red|rose|pink|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia)-\d+/;
const TOKEN_OPACITY = /^(?:[a-z0-9-]+:)*(?:bg|text|border|ring|divide|outline|fill|stroke|placeholder)-[a-z][a-z0-9-]*\/(?:\d+|\[)/;
const CLASS_PREFIX = /^(?:[a-z0-9\-[\].:_/]+:)*!?-?(bg|text|border|ring|divide|outline|shadow|from|via|to|fill|stroke|rounded|z|duration|ease|font|tracking|leading|opacity|placeholder|caret|accent|decoration|min-h|min-w|max-h|max-w|w|h|size|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space|top|left|right|bottom|inset|translate|rotate|scale|grid|col|row|flex|basis|order|columns|line-clamp)-/;
const CLASS_CHARS = /^[!-]?[a-zA-Z0-9\-[\].:/_%#(),&>*@+=]+$/;

const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const inDir = (file, dirs) => dirs.some((d) => file === d || file.startsWith(`${d}/`));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Kommentare entfernen, Zeilennummern bleiben erhalten */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => (/^\s*\/\//.test(l) ? '' : l))
    .join('\n');
}

const violations = [];
const report = (file, line, rule, text, hint) => violations.push({ file, line, rule, text: text.trim().slice(0, 140), hint });

// css-eigene Klassen aus index.css (z. B. `pb-safe`, `no-scrollbar`) gelten als vorhanden
const customCss = new Set();
for (const m of fs.readFileSync(path.join(root, 'src/index.css'), 'utf8').matchAll(/\.([a-zA-Z0-9_-]+)(?=[\s{,.:>[])/g)) customCss.add(m[1]);

const tokenFiles = new Map();
const files = walk(path.join(root, 'src'))
  .map((p) => ({ abs: p, file: rel(p) }))
  .filter(({ file }) => !inDir(file, ['src/prototype3d']));

for (const { abs, file } of files) {
  const raw = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  const lines = stripComments(raw).split('\n');
  const emojiOnly = inDir(file, EMOJI_ONLY_DIRS);
  const skipped = inDir(file, SKIP_DIRS);
  const exceptions = FILE_EXCEPTIONS[file] || [];
  const usesConfirmHook = /\buseConfirm\b/.test(raw);
  let allowNext = false;

  lines.forEach((line, i) => {
    const original = raw.split('\n')[i] || '';
    const marker = /ds-allow-next/.test(original);
    const allowed = allowNext || /ds-allow(?!-next)/.test(original);
    allowNext = marker;
    if (allowed) return;
    const at = i + 1;

    if (EMOJI.test(line)) report(file, at, 'Emoji', line, 'Regel 01 §3/§11: Icon, Badge oder Alert statt Emoji');
    if (emojiOnly || skipped) return;

    if (RAW_PALETTE.test(line)) report(file, at, 'Rohe Farbe', line, 'Regel 01 §4: semantischen Token nehmen (bg-surface, text-danger …)');
    if (/(?<![\w$.])dark:[a-z![-]/.test(line)) report(file, at, 'dark:-Präfix', line, 'Regel 01 §5: die Tokens wechseln das Theme selbst');
    if (/\bbg-gradient-|linear-gradient\(/.test(line)) report(file, at, 'Verlauf', line, 'Regel 01 §4: keine Verläufe');
    if (/\btext-\[[\d.]+(?:px|rem)\]/.test(line)) report(file, at, 'Freie Schriftgröße', line, 'Regel 01 §6: benannten Textstil nehmen (text-caption, text-micro …)');
    if (/\brounded(?:-[a-z]{1,2})?-\[/.test(line)) report(file, at, 'Freier Radius', line, 'Regel 01 §7: Radius nach Rolle (rounded-xs … rounded-xl)');
    if (/\b(?:bg|text|border|ring|fill|stroke)-\[(?:#|rgb|hsl|oklch)/.test(line)) report(file, at, 'Freie Farbe', line, 'Regel 01 §4: semantischer Token statt Hex/rgb');
    if (/\bshadow-\[/.test(line)) report(file, at, 'Freier Schatten', line, 'Regel 01 §9: shadow-xs … shadow-lg, shadow-sheet');
    if (/\bz-\[/.test(line)) report(file, at, 'Freier z-Wert', line, 'Regel 01 §9: z-nav, z-dropdown, z-sheet, z-dialog, z-toast, z-tooltip, z-palette');
    if (/(?:^|[\s'"`:])font-(?:thin|light|normal|medium|semibold|bold|extrabold|black)\b/.test(line)) report(file, at, 'Gewichtsklasse', line, 'Regel 01 §6: Gewicht steckt in den benannten Textstilen');
    if (/\buppercase\b/.test(line) && !/text-eyebrow/.test(line)) report(file, at, 'Versalien', line, 'Regel 01 §3: Großbuchstaben nur über SectionHeader (text-eyebrow)');
    if (!exceptions.includes('browser-dialog') && (usesConfirmHook ? /(?<![\w.$])(?:window\.)?alert\(|window\.confirm\(/ : /(?<![\w.$])(?:window\.)?(?:alert|confirm)\(/).test(line)) report(file, at, 'alert()/confirm()', line, 'Regel 01 §12: Toast, Alert oder useConfirm()');

    // Kandidaten für die Prüfung „erzeugt die Klasse CSS?“
    for (const t of line.split(/[^A-Za-z0-9\-[\].:/_%#(),&>*@+=!]+/)) {
      if (!t || t.length > 140 || !CLASS_CHARS.test(t) || !CLASS_PREFIX.test(t)) continue;
      if (/^[-.]|[-.:/,(]$/.test(t)) continue;
      if (!tokenFiles.has(t)) tokenFiles.set(t, []);
      tokenFiles.get(t).push(`${file}:${at}`);
    }
  });
}

// Tailwind mit dem echten Preset laufen lassen und prüfen, welche Kandidaten CSS bekommen
const tokens = [...tokenFiles.keys()];
const result = await postcss([tailwindcss({
  ...tailwindConfig,
  content: [{ raw: tokens.join(' '), extension: 'html' }],
  corePlugins: { ...(tailwindConfig.corePlugins || {}), preflight: false },
})]).process('@tailwind utilities; @tailwind components;', { from: undefined });

const unescapeCss = (s) => s
  .replace(/\\([0-9a-f]{1,6}) ?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/\\(.)/g, '$1');
const generated = new Set();
for (const m of result.css.matchAll(/(?<=^|[{}])\s*([^{}]+)\{/g)) {
  for (const sel of m[1].split(/(?<!\\),/)) {
    // Klassennamen mit Hex-Escapes (`\2c ` für Kommas) enthalten Leerzeichen und gehören trotzdem dazu
    for (const mm of sel.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[^\s.:>+~[\],()\\])+)/g)) generated.add(unescapeCss(mm[1]));
  }
}

for (const t of tokens) {
  const base = t.replace(/^(?:[^:[\]]+:)+/, '').replace(/^!/, '');
  if (generated.has(t) || customCss.has(t) || customCss.has(base)) continue;
  const hint = TOKEN_OPACITY.test(t)
    ? 'Deckkraft-Zusatz wirkt nicht (Farben sind CSS-Variablen): -subtle-Ton oder anderen Token nehmen'
    : RAW_PALETTE.test(t)
      ? 'rohe Palettenfarbe: semantischen Token nehmen'
      : 'Klasse gibt es im Design System nicht und erzeugt kein CSS (Regel 01, Tokens in src/styles/)';
  for (const where of tokenFiles.get(t)) {
    const [file, line] = where.split(/:(?=\d+$)/);
    report(file, Number(line), 'Klasse ohne Wirkung', t, hint);
  }
}

if (violations.length === 0) {
  console.log(`Design-System-Prüfung: ok (${files.length} Dateien, ${tokens.length} Klassen geprüft).`);
  process.exit(0);
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
console.error(`Design-System-Prüfung: ${violations.length} Verstöße gegen Regel 01\n`);
let current = '';
for (const v of violations) {
  if (v.file !== current) { console.error(v.file); current = v.file; }
  console.error(`  ${v.line}: [${v.rule}] ${v.text}\n      → ${v.hint}`);
}
console.error('\nBewusste Ausnahme: `ds-allow` (gleiche Zeile) oder `ds-allow-next` (Zeile davor) mit Begründung. Design ändern: erst Rückfrage, dann Artefakt und Regel 01 (docs/Wissen/00_System_und_Design/06-Design-System-Referenz.md).');
process.exit(1);
