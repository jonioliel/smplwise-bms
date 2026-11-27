/**
 * SCR-13: the server's time line on this device. Physical commands carry `expires_at` on the SERVER's clock (T054 final review S-3):
 * a wall tablet whose own clock is off by more than the 15 s command life would otherwise get "expired" (409) or "too far" (422) on
 * every door release / answer / reject. The offset is learned from every answer:
 *  - `body`: a reply's own `server_time_ms` (the intercom overview, the active-calls banner) - millisecond exact;
 *  - `header`: the HTTP `Date` header of any API answer (api/client.ts) - one-second resolution, used until an exact sample arrives.
 * The server read its clock somewhere during the round trip: the middle is assumed (error <= half the round trip, + 0.5 s for a header).
 * FIX-SERVER-CLOCK-2560 (review FE-03): a sample whose round trip is longer than SAMPLE_MAX_RTT_MS teaches nothing (a phone that slept with
 * a request in flight would put the midpoint minutes off and make every command "expired"); of the usable samples the one with the
 * smallest error wins, and a sample older than SAMPLE_FRESH_MS may be replaced by any usable one (a header may then replace a body).
 * Pure module (no DOM, no imports), so client.ts can feed it without an import cycle.
 */
type ClockSource = 'body' | 'header';

/** A round trip longer than this (ms) is not a clock sample. */
export const SAMPLE_MAX_RTT_MS = 2_000;
/** A kept sample older than this (ms, device clock) gives way to any usable one. */
export const SAMPLE_FRESH_MS = 60_000;

let offsetMs = 0;
let source: ClockSource | null = null;
let errorMs = Infinity; // the kept sample's worst-case error: half its round trip (+ 0.5 s for a header)
let keptAt = 0; // device ms when the kept sample arrived

/** Records one sample: `serverMs` is the server's clock (epoch ms) in an answer sent at `sentAt` and received at `receivedAt` (device ms). */
export function noteServerTime(serverMs: number | null | undefined, sentAt: number, receivedAt: number, from: ClockSource = 'body'): void {
  if (typeof serverMs !== 'number' || !Number.isFinite(serverMs) || serverMs <= 0) return;
  const rtt = receivedAt - sentAt;
  if (!Number.isFinite(rtt) || rtt < 0 || rtt > SAMPLE_MAX_RTT_MS) return; // FE-03: a long (or clock-jumped) round trip is no sample
  const err = rtt / 2 + (from === 'header' ? 500 : 0);
  const stale = source === null || Math.abs(receivedAt - keptAt) > SAMPLE_FRESH_MS; // old, or the device clock jumped back
  if (!stale && err > errorMs) return; // the kept, recent sample is better (an exact body sample is not replaced by a coarse header)
  const at = from === 'header' ? serverMs + 500 : serverMs; // a Date header is truncated to the second: its instant is in [t, t + 1 s)
  offsetMs = at - (sentAt + receivedAt) / 2;
  source = from;
  errorMs = err;
  keptAt = receivedAt;
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
  errorMs = Infinity;
  keptAt = 0;
}
