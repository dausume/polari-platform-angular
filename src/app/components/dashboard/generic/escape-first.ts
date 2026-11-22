/**
 * ONE ESCAPE CLEARS ONE THING. A picture with its own selection (a wire, a hole, a pin) takes the key first - in the capture phase, before any table's
 * document listener - and marks it handled when it cleared something. A rows table leaves a handled Escape alone, so the row picked behind the picture
 * (the live session a bench picture is bound to) stays picked; the next Escape, with nothing selected in the picture, clears the table as before.
 *
 * `take()` clears the caller's selection and says whether there was one. Returns the function that removes the listener (call it on destroy).
 */
export function escapeFirst(take: () => boolean): () => void {
  const onKey = (ev: KeyboardEvent): void => { if (ev.key === 'Escape' && !ev.defaultPrevented && take()) { ev.preventDefault(); } };
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}
