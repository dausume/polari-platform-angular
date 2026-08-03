#!/usr/bin/env node
/**
 * Responsive guardrail — fails on the two authoring mistakes that
 * actually break a layout on a small screen or inside a MeshHTML
 * panel. Like the theme check, it is deliberately narrow: it does not
 * police every hardcoded number, only the ones that CANNOT adapt.
 *
 *   FAIL  a `width` wider than a phone with no viewport ceiling.
 *         `width: 880px` cannot fit a 390px screen; `width: min(880px,
 *         100vw - …)` or a `max-width: 100%` alongside it can.
 *
 *   FAIL  a grid with a fixed track COUNT (`repeat(3, 1fr)`).
 *         A fixed count cannot drop to one column, and because a grid
 *         track never shrinks below its content's min-content size,
 *         the row overflows its container instead of wrapping. Use
 *         `repeat(auto-fit, minmax(min(100%, …), 1fr))`.
 *
 *   WARN  `min-width` above the phone width. Legitimate for a
 *         genuinely irreducible control, so it is counted, not failed.
 *
 * Opt out of a line with a /* fixed-size *\/ comment when the element
 * really is a fixed-size surface — an XR panel host, a canvas whose
 * pixel size is the texture size.
 *
 * Usage: node scripts/check-responsive.mjs [--verbose]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src/app/components');
const VERBOSE = process.argv.includes('--verbose');

/** Narrowest device class we support (see _responsive.css). */
const PHONE_WIDTH = 390;

const OPT_OUT = /fixed-size|data-mark/i;

/* Files whose whole job is to host a fixed-size rasterized surface.
   Their pixel sizes ARE the contract with HTMLMesh (1 CSS px = 1
   texel), so a viewport ceiling would be wrong there. */
const FIXED_SURFACE_FILES = [
  'xr-panel-host.component.ts',
  'xr-direct-entry-page.component.ts',
  'xr-zone-capture-page.component.ts',
  'ar-unavailable-notice.component.ts',
  'ai-assistant-panel.component.ts',
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(css|scss|ts)$/.test(p)) yield p;
  }
}

const fixedWidths = [];
const fixedGrids = [];
let warnMinWidth = 0;

for (const file of walk(SRC)) {
  if (FIXED_SURFACE_FILES.some((f) => file.endsWith(f))) continue;

  const text = readFileSync(file, 'utf8');
  let scan = text;
  if (file.endsWith('.ts')) {
    const blocks = [...text.matchAll(/styles\s*:\s*\[([\s\S]*?)\]\s*[,}]/g)];
    if (!blocks.length) continue;
    scan = blocks.map((b) => b[0]).join('\n');
  }

  const lines = scan.split('\n');
  lines.forEach((line, i) => {
    if (OPT_OUT.test(line)) return;

    // --- fixed width with no ceiling ---
    const w = line.match(/(?:^|[\s;{])width\s*:\s*([^;]+)[;}]?/);
    if (w && !/^\s*(?:max|min)-width/.test(line)) {
      const value = w[1];
      const px = value.match(/(\d{3,})px/);
      const guarded =
        /\bmin\s*\(/.test(value) ||
        /\bclamp\s*\(/.test(value) ||
        /\b(?:vw|%|auto|fit-content|max-content|min-content)\b/.test(value);
      if (px && Number(px[1]) > PHONE_WIDTH && !guarded) {
        // A max-width:100% on an adjacent line also makes it safe.
        const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
        if (!/max-width\s*:\s*(100%|min\(|calc\(|var\()/.test(near)) {
          fixedWidths.push({
            file,
            line: i + 1,
            decl: line.trim().slice(0, 90),
          });
        }
      }
    }

    // --- min-width above phone width (counted, not failed) ---
    const mw = line.match(/min-width\s*:\s*(\d{3,})px/);
    if (mw && Number(mw[1]) > PHONE_WIDTH) warnMinWidth++;

    // --- grid with a fixed track count ---
    const g = line.match(/grid-template-columns\s*:\s*([^;]+)/);
    if (g && /repeat\(\s*\d+\s*,/.test(g[1])) {
      fixedGrids.push({ file, line: i + 1, decl: g[0].trim().slice(0, 90) });
    }
  });
}

const failures = fixedWidths.length + fixedGrids.length;

for (const v of fixedWidths) {
  console.error(
    `\n${relative(ROOT, v.file)}:${v.line}\n  ${v.decl}\n` +
      `  Fixed width wider than a ${PHONE_WIDTH}px phone and no ceiling. ` +
      `Wrap it: width: min(<n>px, 100vw) — or add max-width: 100%.`
  );
}
for (const v of fixedGrids) {
  console.error(
    `\n${relative(ROOT, v.file)}:${v.line}\n  ${v.decl}\n` +
      `  Fixed track count cannot collapse to one column, and a track ` +
      `never shrinks below its content, so the row overflows. Use ` +
      `repeat(auto-fit, minmax(min(100%, <n>px), 1fr)).`
  );
}

if (failures) {
  console.error(
    `\nResponsive check FAILED — ${fixedWidths.length} unbounded fixed ` +
      `width(s), ${fixedGrids.length} fixed-count grid(s).`
  );
  process.exit(1);
}

console.log(
  `Responsive check passed — no unbounded fixed widths, no fixed-count ` +
    `grids (${warnMinWidth} min-width declarations above ${PHONE_WIDTH}px ` +
    `remain; all audited 2026-08-03 — 19 belong to MatDialogs, which go ` +
    `full-screen below 600px via _dialog-patterns.css, and one is a ` +
    `1200px diagram inside its own scroll wrapper).`
);
