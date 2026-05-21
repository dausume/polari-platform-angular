/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:overlay
 * @consumers
 *   - SimSpaceViewerComponent
 * @see /OVERLAP_MAP.md
 *
 * Hover-tooltip helpers extracted from SimSpaceViewerComponent. Pure
 * DOM + small formatters — no Angular, no rxjs.
 */

import { SimSpaceObject } from '@models/sim-space/sim-space-types';

/** Create the singleton tooltip element used by SimSpaceViewer. */
export function createTooltipElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sim-space-hover-tooltip';
  el.style.cssText = [
    'background: rgba(33, 33, 33, 0.92)',
    'color: white',
    'padding: 6px 10px',
    'border-radius: 4px',
    'font-size: 0.75rem',
    'line-height: 1.35',
    'pointer-events: none',
    'white-space: nowrap',
    'box-shadow: 0 2px 6px rgba(0,0,0,0.25)',
    'margin-top: -8px',
  ].join(';');
  return el;
}

/** Render tooltip contents for a hovered object. Includes the
 * object's temporal value when one was attached by the snapshot
 * compiler (i.e. its source class has a temporal binding). */
export function renderTooltipForObject(
  el: HTMLElement,
  obj: SimSpaceObject,
  temporalLabel?: string,
): void {
  const parts: string[] = [];
  if (obj.classRef) {
    parts.push(`<div><strong>${escapeHtml(obj.classRef.className)}</strong></div>`);
    parts.push(`<div style="opacity:0.75">id: ${escapeHtml(obj.classRef.instanceId)}</div>`);
  } else if (obj.label) {
    parts.push(`<div><strong>${escapeHtml(obj.label)}</strong></div>`);
  } else {
    parts.push(`<div>${escapeHtml(obj.id)}</div>`);
  }
  parts.push(
    `<div style="opacity:0.65;font-family:monospace">` +
    `(${formatNum(obj.position[0])}, ${formatNum(obj.position[1])}` +
    (obj.position.length >= 3 ? `, ${formatNum(obj.position[2])}` : '') +
    `)</div>`
  );
  if (obj.temporalValue !== undefined && temporalLabel) {
    parts.push(
      `<div style="opacity:0.65;font-family:monospace">${escapeHtml(temporalLabel)}</div>`
    );
  }
  el.innerHTML = parts.join('');
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNum(n: number | undefined): string {
  if (n === undefined || n === null || !isFinite(n)) return '?';
  if (Math.abs(n) >= 1000 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
    return n.toExponential(2);
  }
  return parseFloat(n.toPrecision(4)).toString();
}
