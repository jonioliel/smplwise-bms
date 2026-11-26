/**
 * SCR-13: the server's time line on this device. Physical commands carry `expires_at` on the SERVER's clock (T054 final review S-3):
 * a wall tablet whose own clock is off by more than the 15 s command life would otherwise get "expired" (409) or "too far" (422) on
 * every door release / answer / reject. The offset is learned from every answer:
 *  - `body`: a reply's own `server_time_ms` (the intercom overview, the active-calls banner) - millisecond exact;
 *  - `header`: the HTTP `Date` header of any API answer (api/client.ts) - one-second resolution, used until an exact sample arrives.
 * The server read its clock somewhere during the round trip: the middle is assumed (error <= half the round trip, + 0.5 s for a header).
 * Pure module (no DOM, no imports), so client.ts can feed it without an import cycle.
 */
export type ClockSource = 'body' | 'header';

let offsetMs = 0;
let source: ClockSource | null = null;

/** Records one sample: `serverMs` is the server's clock (epoch ms) in an answer sent at `sentAt` and received at `receivedAt` (device ms). */
export function noteServerTime(serverMs: number | null | undefined, sentAt: number, receivedAt: number, from: ClockSource = 'body'): void {
  if (typeof serverMs !== 'number' || !Number.isFinite(serverMs) || serverMs <= 0) return;
  if (from === 'header' && source === 'body') return; // an exact sample is never replaced by a coarse one
  const at = from === 'header' ? serverMs + 500 : serverMs; // a Date header is truncated to the second: its instant is in [t, t + 1 s)
  offsetMs = at - (sentAt + receivedAt) / 2;
  source = from;
}

/** The HTTP `Date` header of an answer, as a sample (absent / unparsable: nothing). */
export function noteDateHeader(value: string | null | undefined, sentAt: number, receivedAt: number): void {
  if (!value) return;
  noteServerTime(Date.parse(value), sentAt, receivedAt, 'header');
}

/** Now on the server's time line (the device clock until the first sample). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Server clock minus device clock (ms) and where it came from - for tests and diagnostics. */
export function serverOffset(): { ms: number; source: ClockSource | null } {
  return { ms: offsetMs, source };
}

/** Tests only: back to "no sample yet". */
export function resetServerClock(): void {
  offsetMs = 0;
  source = null;
}
