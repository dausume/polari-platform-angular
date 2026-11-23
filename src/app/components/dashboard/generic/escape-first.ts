/**
 * ONE ESCAPE CLEARS ONE THING. A picture with its own selection (a wire, a hole, a pin) takes the key first - in the capture phase, before any table's
 * document listener - and marks it spent when it cleared something. A rows table leaves a spent Escape alone (`escapeSpent`), so the row picked behind
 * the picture (the live session a bench picture is bound to) stays picked; the next Escape, with nothing selected in the picture, clears the table as before.
 *
 * WHY THE MARK IS OUR OWN, NOT `defaultPrevented`. On a real page `preventDefault()` does nothing here: the Material focus monitor registers a PASSIVE
 * capture listener for keydown on the document first, zone.js keeps ONE native listener per (target, event, capture) with the options of the first
 * registration, and so every later capture listener for keydown runs as passive. A component spec has no focus monitor and never sees it (release 93
 * shipped that way: the spec passed, the page did not). The key is still prevented where that works; nothing reads it.
 *
 * `take()` clears the caller's selection and says whether there was one. Returns the function that removes the listener (call it on destroy).
 */
const spent = new WeakSet<Event>();

/** Was this Escape already used up by a picture's own selection? */
export function escapeSpent(ev?: Event | null): boolean { return !!ev && (spent.has(ev) || ev.defaultPrevented); }

export function escapeFirst(take: () => boolean): () => void {
  const onKey = (ev: KeyboardEvent): void => { if (ev.key === 'Escape' && !escapeSpent(ev) && take()) { spent.add(ev); ev.preventDefault(); } };
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}
