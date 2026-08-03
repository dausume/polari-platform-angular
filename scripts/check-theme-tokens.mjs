#!/usr/bin/env node
/**
 * sty-4 guardrail — catches the pattern that actually makes text
 * invisible, rather than every raw color in the app.
 *
 * Background and text color are a PAIR the theme owns together. Theme
 * exactly one of them and you get the classic failure: a hardcoded
 * light card whose (themed, therefore light-in-dark-mode) text vanishes
 * on it, or themed dark text sitting on a fill that never flips. So the
 * gate is:
 *
 *   FAIL  a rule sets background and color, one from a var(--…) token
 *         and the other from a raw color         -> split pair
 *   FAIL  a rule sets a raw background together with `color: inherit`
 *         -> inherits a theme color onto a fixed surface
 *
 * A rule that hardcodes BOTH is a legitimate fixed pair (a status chip,
 * a brand button): its text is pinned to its own fill, so it reads the
 * same in either theme. A rule that tokenizes both is correct. Neither
 * is reported as a failure — but both raw-pair rules and lone raw
 * colors are counted and printed as debt so the number can be driven
 * down without blocking the build today.
 *
 * Opt out of a specific line with a /* data-mark *\/ comment.
 *
 * Usage: node scripts/check-theme-tokens.mjs [--verbose]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src/app/components');
const VERBOSE = process.argv.includes('--verbose');
const OPT_OUT = /data-mark/i;

const RAW_COLOR =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black|silver|gray|grey|lightblue|whitesmoke)\b/;

/**
 * Only tokens REDEFINED under body.dark-theme actually change between
 * themes. --brand-blue is one value in both, so `color: #fff` on it is
 * a stable pair, not a split one. Read the two theme files and keep
 * just the names the dark theme overrides.
 */
function flippingTokens() {
  const dark = readFileSync(join(ROOT, 'src/styles/_theme-dark.css'), 'utf8');
  const body = dark.slice(dark.indexOf('body.dark-theme'));
  return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}
const FLIPPING = flippingTokens();

/**
 * A translucent overlay is adaptive: rgba(0,0,0,.05) darkens whatever
 * surface is behind it, so it tracks the theme through its parent and
 * pairs correctly with themed text. Treat it as neutral, not raw.
 */
function isAdaptiveOverlay(value) {
  const m = value.match(/\b(?:rgba|hsla)\([^)]*?([\d.]+)\s*\)/);
  return m ? parseFloat(m[1]) <= 0.5 : false;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(css|scss|ts)$/.test(p)) yield p;
  }
}

/**
 * raw | token | none — what a declaration's value draws from, where
 * "token" means specifically a value that CHANGES with the theme.
 * Non-flipping tokens and adaptive overlays count as neither, since
 * they pair safely with either side.
 */
function kindOf(value) {
  const withoutFallbacks = value.replace(/var\([^)]*\)/g, '');
  if (RAW_COLOR.test(withoutFallbacks)) {
    return isAdaptiveOverlay(withoutFallbacks) ? 'none' : 'raw';
  }
  const used = [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
  return used.some((t) => FLIPPING.has(t)) ? 'token' : 'none';
}

const splitPairs = [];
const inheritOnRaw = [];
let debtRawPairs = 0;
let debtLoneRaw = 0;

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  let scan = text;
  if (file.endsWith('.ts')) {
    const blocks = [...text.matchAll(/styles\s*:\s*\[([\s\S]*?)\]\s*[,}]/g)];
    if (!blocks.length) continue;
    scan = blocks.map((b) => b[0]).join('\n');
  }

  // Split into rule bodies. Good enough for the flat, non-nested parts
  // of these stylesheets, and SCSS nesting only ever narrows a rule.
  const ruleRe = /([^{}]*)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(scan)) !== null) {
    const body = m[2];
    if (OPT_OUT.test(body)) continue;
    const selector = m[1].trim().split('\n').pop().trim();
    const lineNo = scan.slice(0, m.index).split('\n').length;

    const bg = body.match(/(?:^|[\s;])background(?:-color)?\s*:\s*([^;]+);/);
    const fg = body.match(/(?:^|[\s;])color\s*:\s*([^;]+);/);
    if (!bg && !fg) continue;

    const bgKind = bg ? kindOf(bg[1]) : 'none';
    const fgRaw = fg ? fg[1].trim() : '';
    const fgKind = fg ? kindOf(fgRaw) : 'none';

    if (bgKind === 'raw' && /^inherit$/i.test(fgRaw)) {
      inheritOnRaw.push({ file, lineNo, selector, bg: bg[1].trim() });
      continue;
    }
    if (
      (bgKind === 'raw' && fgKind === 'token') ||
      (bgKind === 'token' && fgKind === 'raw')
    ) {
      splitPairs.push({
        file,
        lineNo,
        selector,
        bg: bg ? bg[1].trim() : '(inherited)',
        fg: fgRaw || '(inherited)',
      });
      continue;
    }
    if (bgKind === 'raw' && fgKind === 'raw') debtRawPairs++;
    else if (bgKind === 'raw' || fgKind === 'raw') debtLoneRaw++;
  }
}

const failures = splitPairs.length + inheritOnRaw.length;

if (VERBOSE || failures) {
  console.log(
    `\ntheme debt (not failures): ${debtRawPairs} fixed pairs, ` +
      `${debtLoneRaw} lone raw colors`
  );
}

for (const v of inheritOnRaw) {
  console.error(
    `\n${relative(ROOT, v.file)}:${v.lineNo}  ${v.selector}\n` +
      `  color: inherit on a hardcoded background (${v.bg}).\n` +
      `  The inherited color flips with the theme; the background does ` +
      `not. Tokenize the background, or pin the text to its fill.`
  );
}
for (const v of splitPairs) {
  console.error(
    `\n${relative(ROOT, v.file)}:${v.lineNo}  ${v.selector}\n` +
      `  background: ${v.bg}\n  color: ${v.fg}\n` +
      `  One side of the pair is themed and the other is not, so they ` +
      `drift apart in one of the two themes. Use tokens for both, or ` +
      `raw colors for both.`
  );
}

if (failures) {
  console.error(
    `\nTheme-token check FAILED — ${failures} split background/text pair(s).`
  );
  process.exit(1);
}

console.log(
  `Theme-token check passed — no split background/text pairs ` +
    `(debt: ${debtRawPairs} fixed pairs, ${debtLoneRaw} lone raw colors).`
);
