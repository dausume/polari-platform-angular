// stomp-notices.ts
// ==============================================================================
// Telling a ct-6 GATE NOTICE from a change notification.
// ==============================================================================
// The backend's STOMP gate (accessControl/stomp_gate.py) answers a SUBSCRIBE
// three ways:
//
//   off      — nothing is sent;
//   advisory — the subscription IS registered and a MESSAGE frame arrives on
//              the destination just subscribed to, header
//              `X-Polari-Permission-Advisory: would-deny <Class>:read`, body
//              `{"polariNotice": "permission-advisory", …}`;
//   enforce  — an ERROR frame with the same header and
//              `{"polariNotice": "permission-refused", …}`, and the socket is
//              NOT added to the topic.
//
// The advisory MESSAGE rides the SAME destination as a change notification, so
// without this check a panel would read it as "something changed", refetch,
// and — if the refetch re-subscribed — do it again. It is NOT a change: it
// must never reach a refetch path.
// ==============================================================================

/** The frame header the gate stamps on every notice. */
export const STOMP_ADVISORY_HEADER = 'X-Polari-Permission-Advisory';
/** The `§51` header: the bearer was refused, which is not a permission verdict. */
export const STOMP_AUTH_HEADER = 'X-Polari-Auth';
/** Body marker set by `stomp_gate.NOTICE_KEY`. */
export const NOTICE_KEY = 'polariNotice';

/** What a gate notice tells the frontend. */
export interface StompGateNotice {
    /** `permission-advisory` (subscribed anyway) or `permission-refused` (not subscribed) */
    notice: string;
    /** true for `permission-refused` / an ERROR frame: there is no subscription */
    refused: boolean;
    /** the advisory line, e.g. `would-deny MealEntry:read` */
    advisory: string;
    /** the class the notice is about, from the body or the destination header */
    className: string;
    /** the destination header, for the record */
    destination: string;
}

/** Frame-shaped enough to test without a socket. */
export interface FrameLike { headers?: { [key: string]: any }; body?: string; }

/** `/topic/MealEntry` and `/topic/MealEntry/flatJson` are both `MealEntry`. */
export function classOfDestination(destination: string): string {
    const raw = String(destination || '').trim();
    if (!raw.startsWith('/topic/')) { return ''; }
    const rest = raw.slice('/topic/'.length).replace(/^\/+|\/+$/g, '');
    return rest ? rest.split('/')[0] : '';
}

/** Headers arrive with whatever case the server used; look both ways. */
function header(frame: FrameLike, name: string): string {
    const headers = frame?.headers || {};
    const direct = headers[name];
    if (direct) { return String(direct); }
    const lower = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) { return String(headers[key]); }
    }
    return '';
}

/**
 * The gate notice carried by this frame, or null when it is an ordinary
 * change notification. `refusedFrame` is true for an ERROR frame, whose body
 * says `permission-refused` but whose *consequence* — no subscription — is
 * the part a caller has to act on.
 */
export function gateNoticeOf(frame: FrameLike, refusedFrame = false): StompGateNotice | null {
    const advisory = header(frame, STOMP_ADVISORY_HEADER);
    let parsed: any = null;
    try { parsed = frame?.body ? JSON.parse(frame.body) : null; }
    catch { parsed = null; }
    const marker = parsed && typeof parsed === 'object' ? String(parsed[NOTICE_KEY] || '') : '';
    if (!advisory && !marker && !refusedFrame) { return null; }
    const destination = header(frame, 'destination');
    return {
        notice: marker || (refusedFrame ? 'permission-refused' : 'permission-advisory'),
        refused: refusedFrame || marker === 'permission-refused',
        advisory: advisory || header(frame, 'message') || marker,
        className: String((parsed && parsed.className) || '') || classOfDestination(destination),
        destination,
    };
}

/** True when this frame is a gate notice and NOT a change to refetch on. */
export function isGateNotice(frame: FrameLike): boolean {
    return gateNoticeOf(frame) !== null;
}
