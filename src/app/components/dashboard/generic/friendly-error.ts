/**
 * friendly-error.ts — one wording for a panel that could not load (bp-2b, his: "the failing to retrieve files
 * error is not particularly user friendly").
 *
 * A panel's error line is read by a person, not a log parser: it says what happened in their terms first
 * (sign in / not allowed / nothing there / the server could not answer), and keeps the technical detail
 * (path, status, the server's own sentence) for the tooltip. The backend's own `error` sentence is kept when
 * it is one — those are written for people too.
 */
export interface FriendlyError {
  /** what a person reads */
  text: string;
  /** the technical detail, for a title= tooltip */
  detail: string;
  /** true when signing in would change the answer */
  signIn: boolean;
}

export function friendlyError(err: any, what: string): FriendlyError {
  const status: number = Number(err?.status ?? 0);
  const body = err?.error;
  const server = body && typeof body === 'object' ? (body.description || body.error || body.title || body.refusal || '') : '';
  const detail = `${what}: HTTP ${status || '—'}${server ? ' — ' + server : ''}${err?.message ? ' (' + err.message + ')' : ''}`;
  if (status === 401) {
    return { text: 'Sign in to see this.', detail, signIn: true };
  }
  if (status === 403) {
    return { text: 'Your account is not allowed to see this.' + (server ? ' ' + server : ''), detail, signIn: false };
  }
  if (status === 404) {
    return { text: 'Nothing is published here yet.' + (server ? ' ' + server : ''), detail, signIn: false };
  }
  if (status === 503) {
    return { text: 'This part of the server is still starting or is switched off.' + (server ? ' ' + server : ''), detail, signIn: false };
  }
  if (status === 0) {
    return { text: 'The server could not be reached.', detail, signIn: false };
  }
  if (status >= 500) {
    return { text: 'The server could not answer this.' + (server ? ' ' + server : ''), detail, signIn: false };
  }
  return { text: server || 'This could not be loaded.', detail, signIn: false };
}
