/**
 * Plan Studio 6, slice S5-A (CR-029 sections 4.2 and 4.4): the saved positions as a ROUTE - the stops in the order of the
 * document's `walk_positions` list ("a route = the list in order"), each shown for ROUTE_DWELL_MS (4 s). Pure: no DOM, no
 * timers, no three. The player is told the time (`start(now)`, `advance(now)`), so a scripted clock gives the same steps every
 * time (unit-walk-route.spec.ts); the walk session owns the one timeout that asks it.
 *
 * A route of fewer than ROUTE_MIN_STOPS is no route. The kiosk's "play the route when the screen is idle" (S5-B) uses the same
 * player with `loop: true`; the walk bar's play button plays it once: the last stop shows for its dwell and the route ends there.
 */
import type { WalkStart } from './walk-world';

/** How long each stop is shown (CR-029 section 4.2, kiosk row). */
export const ROUTE_DWELL_MS = 4000;
export const ROUTE_MIN_STOPS = 2;

/** The route of a walk world: its saved positions, in order. */
export function routeStops(starts: readonly WalkStart[]): WalkStart[] {
  return starts.filter((s) => s.kind === 'saved');
}

export interface RouteStep {
  index: number;
  stop: WalkStart;
}

export class RoutePlayer {
  private i = -1;
  private due = Infinity;
  private readonly dwell: number;
  private readonly loop: boolean;

  constructor(readonly stops: readonly WalkStart[], opts: { dwellMs?: number; loop?: boolean } = {}) {
    this.dwell = Math.max(1, opts.dwellMs ?? ROUTE_DWELL_MS);
    this.loop = !!opts.loop;
  }

  /** Whether the route has enough stops to play at all. */
  get playable(): boolean {
    return this.stops.length >= ROUTE_MIN_STOPS;
  }

  get playing(): boolean {
    return this.i >= 0;
  }

  /** The stop being shown (-1 when not playing). */
  get index(): number {
    return this.i;
  }

  /** When the next stop is due (ms on the caller's clock), or null when not playing. */
  get dueAt(): number | null {
    return this.i >= 0 ? this.due : null;
  }

  /** Start at the first stop at `now`; null when the route is not playable. */
  start(now: number): RouteStep | null {
    if (!this.playable) return null;
    this.i = 0;
    this.due = now + this.dwell;
    return { index: 0, stop: this.stops[0] };
  }

  /** The next stop when it is due at `now` (one stop per call even after a long pause: the clock never "catches up"),
   * 'end' when the last stop's time is up and the route does not loop, null while the current stop still shows. */
  advance(now: number): RouteStep | 'end' | null {
    if (this.i < 0 || now < this.due) return null;
    const next = this.i + 1;
    if (next >= this.stops.length) {
      if (!this.loop) {
        this.stop();
        return 'end';
      }
      this.i = 0;
    } else this.i = next;
    this.due = now + this.dwell;
    return { index: this.i, stop: this.stops[this.i] };
  }

  stop(): void {
    this.i = -1;
    this.due = Infinity;
  }
}
