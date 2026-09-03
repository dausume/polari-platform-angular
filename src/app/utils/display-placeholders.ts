// Author: Dustin Etts
// display-placeholders.ts — the date/time placeholders a seeded display
// definition may use in a form field's defaultValue.
//
//   {today}  -> local ISO date, YYYY-MM-DD
//   {now}    -> local wall-clock time, HH:MM
//
// Seeds used to bake a fixed date string into defaultValue, so a form
// opened a week later still proposed the day it was seeded. These are
// resolved at RENDER time (display-page substitutes them alongside
// '{object}'; the renderer re-resolves pristine fields when the local
// date rolls over so a page left open past midnight is not stale).

const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;

/** Local calendar date as YYYY-MM-DD (NOT toISOString — that is UTC). */
export function todayIso(d: Date = new Date()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local wall-clock time as HH:MM. */
export function nowHm(d: Date = new Date()): string {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function hasDatePlaceholder(v: any): boolean {
    return typeof v === 'string' && (v.includes('{today}') || v.includes('{now}'));
}

/** Replace every {today}/{now} in a string; non-strings pass through. */
export function resolveDatePlaceholders(v: any, at: Date = new Date()): any {
    if (!hasDatePlaceholder(v)) { return v; }
    return (v as string)
        .split('{today}').join(todayIso(at))
        .split('{now}').join(nowHm(at));
}
