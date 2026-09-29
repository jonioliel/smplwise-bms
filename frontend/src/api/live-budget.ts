/**
 * The camera wall's live-stream budget (hotfix for the remote cap `remote.max_live_streams`).
 *
 * A wall never holds more live streams than the budget, and never holds one for a tile nobody can see:
 *   - `wanted` = the tiles in view (plus one tile of margin) and the tiles that left the view less than RELEASE_MS ago;
 *   - a tile that already streams keeps its slot while it is wanted, then the free slots go to the wanted tiles in the
 *     wall's own order - the rest show their snapshot ("תמונה · לחץ לצפייה חיה").
 * Pure functions: the wall owns the observer and the timers (screens/live-wall.ts), this owns the arithmetic.
 */

/** A tile that scrolled out of view keeps its stream this long (so a short scroll back does not reconnect). */
export const RELEASE_MS = 5000;
/** How often a snapshot-only tile refreshes its picture. */
export const SNAPSHOT_REFRESH_MS = 10_000;

/** No remote cap (LAN / Ingress): only the installation-wide `media.max_live_sessions` applies. */
export function effectiveLiveCap(mediaCap: number, remoteCap: number | null): number {
  const media = Number.isFinite(mediaCap) && mediaCap > 0 ? mediaCap : 8;
  return remoteCap != null && remoteCap > 0 ? Math.min(media, remoteCap) : media;
}

/** Which tiles may hold a live stream now. `order` is the wall's order of the tiles that can stream at all. */
export function allocateLive(order: readonly string[], wanted: ReadonlySet<string>, current: ReadonlySet<string>, cap: number): Set<string> {
  const next = new Set<string>();
  for (const id of order) if (next.size < cap && current.has(id) && wanted.has(id)) next.add(id); // keep what streams
  for (const id of order) if (next.size < cap && wanted.has(id) && !next.has(id)) next.add(id); // then the newcomers, in order
  return next;
}

export function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
