// One-shot migration: replace the legacy token system with design/tokens.css
// and rewrite every `var(--legacy)` usage to a Blueprint token.
//
// Run: node dev/tools/migrate-tokens.mjs [--write]
// Without --write it only reports. The map is explicit on purpose: each entry
// is a design decision (e.g. green -> ink, because the brand is monochrome),
// not a mechanical rename.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();

/** old token -> Blueprint token, or a raw CSS value. */
const MAP = {
  // surfaces / text / lines
  bg: 'paper',
  'bg-elev': 'surface',
  'bg-sunken': 'fill-2',
  ink: 'ink',
  'ink-2': 'ink-2',
  'ink-3': 'ink-3',
  'ink-4': 'ink-3',
  line: 'hair',
  'line-2': 'hair-strong',

  // the accent ramp is retired: green becomes ink
  accent: 'ink',
  'accent-ink': 'paper',
  'accent-soft': 'fill-3',
  live: 'ink',
  warn: 'ink-2',
  danger: 'danger',
  p1: 'fill-2',
  p2: 'fill-2',
  p3: 'fill-2',
  p4: 'fill-2',
  p5: 'fill-2',
  p6: 'fill-2',

  'green-50': 'fill-2',
  'green-400': 'ink-2',
  'green-500': 'ink',
  'green-600': 'ink',
  'green-700': 'ink-2',
  'green-500-10': 'hair',
  'green-500-12': 'hair',
  'green-500-25': 'hair-strong',
  'green-500-28': 'hair-strong',
  'green-500-45': 'hair-strong',
  'green-500-50': 'hair-strong',
  'green-500-60': 'hair-strong',

  'neutral-0': 'surface',
  'neutral-25': 'paper',
  'neutral-100': 'hair',
  'neutral-150': 'hair-strong',
  'neutral-400': 'ink-3',
  'neutral-500': 'ink-3',
  'neutral-600': 'ink-2',
  'neutral-700': 'ink',
  'neutral-850': 'ink',
  'neutral-900': 'ink',
  'neutral-50-dark': 'ink',

  'playful-yellow': 'fill-3',
  'playful-coral': 'fill-3',
  'playful-cyan': 'fill-3',
  'playful-violet': 'fill-3',
  'playful-pink': 'fill-3',
  'playful-lime': 'ink',

  'color-bg-canvas': 'paper',
  'color-bg-surface': 'surface',
  'color-text-primary': 'ink',
  'color-text-secondary': 'ink-2',
  'color-text-tertiary': 'ink-3',
  'color-selected-bg': 'fill-2',
  'color-cta-default': 'ink',
  'color-cta-hover': 'ink-2',
  'color-cta-active': 'ink',

  // spacing
  'space-1': 'sp-1',
  'space-2': 'sp-2',
  'space-3': 'sp-3',
  'space-4': 'sp-4',
  'space-5': 'sp-4',
  'space-6': 'sp-6',
  'space-8': 'sp-8',
  'space-10': 'sp-8',
  'space-14': 'sp-12',
  'space-20': 'sp-16',

  // radius
  'radius-xs': 'r-1',
  'radius-sm': 'r-2',
  'radius-btn': 'r-2',
  'radius-card': 'r-3',
  'radius-md': 'r-3',
  'radius-lg': 'r-3',
  'radius-pill': 'r-pill',
  'radius-full': 'r-pill',

  // motion
  'ease-spring': 'ease-out',
  'duration-fast': 't-fast',
  'duration-base': 't-panel',
  'duration-pulse': 't-panel',

  // surfaces / glass -> flat sheets (no blur, per SKILL.md)
  'surface-blur': '0px',
  'surface-translucency-light': 'surface',
  'surface-translucency-dark': 'surface',
  'shadow-float': 'shadow-sheet',
  'shadow-card-rest': 'shadow-sheet',
  'shadow-card-hover': 'shadow-sheet',
  'glass-bg': 'surface',
  'glass-bg-dense': 'surface',
  'glass-bg-fallback': 'surface',
  'glass-blur': '0px',
  'glass-saturation': '1',
  'glass-border': 'hair',
  'glass-highlight': 'surface',
  'glass-shadow': 'shadow-sheet',

  // scrollbars
  'scrollbar-size': '10px',
  'scrollbar-thumb': 'hair-strong',
  'scrollbar-thumb-hover': 'ink-3',
  'scrollbar-track': 'transparent',

  // type
  'font-display': 'font-sans',
  'font-body': 'font-sans',
  'font-handwriting': 'font-sans',
  'font-family': 'font-sans',
  'font-mono': 'font-mono',
  'fs-display': 'fs-hero',
  'fs-title': 'fs-h2',
  'fs-h3': 'fs-h3',
  'fs-body': 'fs-body',
  'fs-sm': 'fs-sm',
  'fs-xs': 'fs-sm',

  // room geometry
  'room-gutter': 'sp-4',
  'room-rail-w': '52px',
  'room-bar-h': '56px',
  'room-topbar-h': '61px',
  'room-btn': '44px',
  'room-btn-sm': '36px',
  'room-panel-top': 'calc(var(--sp-4) + 56px)',

  // z-order
  'room-z-overlays': 'z-canvas',
  'room-z-panels': 'z-panel',
  'room-z-rail': 'z-panel',
  'room-z-context': 'z-panel',
  'room-z-menu': 'z-modal',
  'room-z-modal': 'z-modal',
  'room-z-coachmarks': 'z-panel',
  'z-base': 'z-canvas',
  'z-raised': 'z-panel',
  'z-sticky': 'z-panel',
  'z-nav': 'z-modal',
  'z-overlay': 'z-modal',
  'z-toast': 'z-toast',
  'z-skip-link': 'z-toast',

  // status
  'color-status-ok-bg': 'fill-2',
  'color-status-ok-text': 'ink',
  'color-status-warn-bg': 'fill-2',
  'color-status-warn-text': 'ink-2',
  'color-status-danger-bg': 'danger',
  'color-status-danger-text': 'danger',

  // dark elevation ramp
  'dark-elevation-0': 'paper',
  'dark-elevation-1': 'surface',
  'dark-elevation-2': 'fill-2',
  'dark-elevation-3': 'fill-3',
  'dark-elevation-4': 'fill-4',
  'dark-hairline': 'hair',
  'dark-canvas-grid-dot': 'dot',

  // AI ghost tones -> monochrome
  'ghost-blue': 'ink-3',
  'ghost-blue-border': 'hair-strong',
  'ghost-blue-ink': 'ink-2',
  'ghost-blue-shadow': 'hair',
  'ghost-blue-ink-dark': 'ink-2',
  'ghost-purple': 'ink-3',
  'ghost-purple-border': 'hair-strong',
  'ghost-purple-ink': 'ink-2',
  'ghost-purple-shadow': 'hair',
  'ghost-purple-ink-dark': 'ink-2',
  'ghost-green': 'ink-3',
  'ghost-green-border': 'hair-strong',
  'ghost-green-ink': 'ink-2',
  'ghost-green-shadow': 'hair',
  'ghost-green-ink-dark': 'ink-2',
  'ghost-orange': 'ink-3',
  'ghost-orange-border': 'hair-strong',
  'ghost-orange-ink': 'ink-2',
  'ghost-orange-shadow': 'hair',
  'ghost-orange-ink-dark': 'ink-2',
  'ghost-teal': 'ink-3',
  'ghost-teal-border': 'hair-strong',
  'ghost-teal-ink': 'ink-2',
  'ghost-teal-shadow': 'hair',
  'ghost-teal-ink-dark': 'ink-2',
  'ghost-yellow': 'ink-3',
  'ghost-yellow-border': 'hair-strong',
  'ghost-yellow-ink': 'ink-2',
  'ghost-yellow-shadow': 'hair',
  'ghost-yellow-ink-dark': 'ink-2',
  'ghost-gray': 'ink-3',
  'ghost-gray-border': 'hair-strong',
  'ghost-gray-ink': 'ink-2',
  'ghost-gray-shadow': 'hair',
  'ghost-gray-ink-dark': 'ink-2',

  // Names the legacy stylesheets referenced but never defined — i.e. they were
  // already resolving to nothing (or to their inline fallback).
  'border-subtle': 'hair',
  'text-primary': 'ink',
  'text-secondary': 'ink-2',
  'text-tertiary': 'ink-3',
  'red-400': 'danger',
  'neutral-200': 'hair',
  'neutral-300': 'hair-strong',
  'surface-1': 'surface',
  'surface-2': 'fill-2',
  'color-hover-surface': 'fill-2',
};

/** Names that are not design tokens but are defined locally at runtime. */
const LOCAL = new Set([
  'i',
  'delay',
  'd',
  'tilt',
  'x',
  'y',
  'rotate',
  'progress',
  'index',
]);

const write = process.argv.includes('--write');
const tokens = readFileSync(join(ROOT, 'design/tokens.css'), 'utf8').trim();
const defined = new Set([...tokens.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));

// 1) index.css: swap the whole legacy :root block for the Blueprint tokens.
const indexPath = join(ROOT, 'src/index.css');
const indexCss = readFileSync(indexPath, 'utf8');
const restAt = indexCss.indexOf('\n* {');
if (restAt < 0) throw new Error('could not find the end of the :root block in src/index.css');
const head = indexCss.slice(0, indexCss.indexOf(':root'));
const newIndex = `${head}${tokens}\n\n${indexCss.slice(restAt + 1)}`;
if (write) writeFileSync(indexPath, newIndex);

// 2) every CSS file: rewrite usages.
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (extname(p) === '.css') files.push(p);
  }
})(join(ROOT, 'src'));

const unmatched = new Map();
let changedFiles = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  // The fallback can itself contain one level of parentheses, e.g.
  // var(--glass-bg, rgba(18, 18, 18, 0.62)) — match those before the closing
  // paren so no stray ")" is left behind.
  const after = before.replace(
    /var\(--([a-z0-9-]+)(\s*,\s*(?:[^()]|\([^()]*\))*)?\)/g,
    (whole, name) => {
    if (name in MAP) {
      const target = MAP[name];
      // A raw value (px, transparent, calc) replaces the whole call.
      if (!/^[a-z][a-z0-9-]*$/.test(target) || !defined.has(target)) return target;
      return `var(--${target})`;
    }
    if (defined.has(name) || LOCAL.has(name)) return whole;
    unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
    return whole;
  });
  if (after !== before) {
    changedFiles += 1;
    if (write) writeFileSync(file, after);
  }
}

console.log(`${write ? 'wrote' : 'would write'} ${changedFiles} CSS files`);
console.log(`tokens defined: ${defined.size}`);
if (unmatched.size > 0) {
  console.log('\nunresolved var() names (still used, not defined, not mapped):');
  for (const [name, count] of [...unmatched].sort((a, b) => b[1] - a[1])) {
    console.log(`  --${name}  ×${count}`);
  }
} else {
  console.log('no unresolved tokens');
}
