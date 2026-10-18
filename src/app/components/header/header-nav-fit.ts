/**
 * How many of the in-app top-menu groups fit in the header bar; the rest go under one "More" menu, so the buttons never overlap
 * however many groups an app has. Pure (unit-tested in header-nav-fit.spec.ts): a width ESTIMATE per button (icon + padding + label),
 * a greedy fill of the space left, and one slot kept for the "More" button itself.
 */
export const NAV_LABELS_SHOWN_FROM = 1024;   // below this the nav labels are hidden by header.css, so every group goes under "More"
const BUTTON_PAD = 52;                       // caret icon + horizontal padding + gap
const CHAR_WIDTH = 7.6;                      // average character at the toolbar font
const MORE_WIDTH = 96;

export function groupButtonWidth(label: string): number {
  return BUTTON_PAD + Math.ceil((label || '').length * CHAR_WIDTH);
}

/** Number of leading groups (by label, in order) that fit beside `reserved` px of other bar content; 0 when the bar is too narrow to show labels. */
export function inlineGroupCount(labels: string[], viewportWidth: number, reserved: number): number {
  if (viewportWidth < NAV_LABELS_SHOWN_FROM || !labels.length) { return 0; }
  const room = viewportWidth - reserved;
  let used = 0;
  let count = 0;
  for (const label of labels) {
    used += groupButtonWidth(label);
    if (used > room) { break; }
    count++;
  }
  if (count === labels.length) { return count; }
  // some go under "More": keep room for that button too
  while (count > 0 && labels.slice(0, count).reduce((n, l) => n + groupButtonWidth(l), 0) + MORE_WIDTH > room) { count--; }
  return count;
}
