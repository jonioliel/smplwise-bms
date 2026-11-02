/**
 * PLAYBACK-SCRUB-2341 (docs/changes/PLAYBACK-SCRUB-2341.md): rapid seeks in recorded playback are coalesced before they reach the
 * server, because every seek there is a new generation (a new go2rtc stream and a new relay socket, the old ones torn down).
 *
 * - Debounce: only the LAST seek requested within `delayMs` (250 ms) is sent; earlier ones are dropped (counted as coalesced).
 * - At most one seek in flight and at most one pending behind it: a seek requested while one is in flight replaces the pending one
 *   and is sent when the in-flight one finishes (never two generations requested at once, never a queue of stale positions).
 * - A run that answers 'busy' (the screen was doing something else, e.g. its own automatic resume) is retried after `busyRetryMs`
 *   unless a newer seek arrived meanwhile - the operator's last position is never silently lost.
 *
 * Pure (no DOM): the timers are injectable, the unit spec drives it with a fake clock.
 */
export type SeekOutcome = 'done' | 'busy';

export interface SeekTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SeekCoalescerOptions {
  delayMs?: number;
  busyRetryMs?: number;
  timers?: SeekTimers;
}

export const SEEK_DEBOUNCE_MS = 250;

const realTimers: SeekTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class SeekCoalescer<T> {
  private latest: T | undefined;
  private hasLatest = false;
  private timer: unknown = null;
  private inflight = false;
  private readonly delayMs: number;
  private readonly busyRetryMs: number;
  private readonly timers: SeekTimers;
  /** requested = every request(); sent = runs started; coalesced = requests replaced before they were sent. */
  readonly stats = { requested: 0, sent: 0, coalesced: 0 };

  constructor(
    private readonly run: (value: T) => Promise<SeekOutcome | void>,
    opts: SeekCoalescerOptions = {},
  ) {
    this.delayMs = opts.delayMs ?? SEEK_DEBOUNCE_MS;
    this.busyRetryMs = opts.busyRetryMs ?? 200;
    this.timers = opts.timers ?? realTimers;
  }

  /** Ask for a seek to `value`; the latest value within the debounce window wins. */
  request(value: T): void {
    this.stats.requested += 1;
    if (this.hasLatest) this.stats.coalesced += 1;
    this.latest = value;
    this.hasLatest = true;
    this.arm(this.delayMs);
  }

  /** Send the pending seek now (no debounce), e.g. on pointer release. Still waits for an in-flight seek to finish. */
  flush(): void {
    if (this.timer !== null) {
      this.timers.clear(this.timer);
      this.timer = null;
    }
    this.fire();
  }

  /** Drop the pending seek (camera / day change, the screen went away). An in-flight seek finishes on its own. */
  cancel(): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
    this.hasLatest = false;
    this.latest = undefined;
  }

  get pending(): boolean {
    return this.hasLatest;
  }

  get inFlight(): boolean {
    return this.inflight;
  }

  private arm(ms: number): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = this.timers.set(() => {
      this.timer = null;
      this.fire();
    }, ms);
  }

  private fire(): void {
    if (!this.hasLatest || this.inflight) return; // an in-flight seek picks the pending one up when it finishes
    const value = this.latest as T;
    this.hasLatest = false;
    this.latest = undefined;
    this.inflight = true;
    this.stats.sent += 1;
    const after = (outcome: SeekOutcome | void) => {
      this.inflight = false;
      if (outcome === 'busy' && !this.hasLatest) {
        this.latest = value;
        this.hasLatest = true;
        this.arm(this.busyRetryMs);
        return;
      }
      if (this.hasLatest && this.timer === null) this.fire(); // its debounce already ran out while this one was in flight
    };
    let p: Promise<SeekOutcome | void>;
    try {
      p = this.run(value);
    } catch {
      p = Promise.resolve();
    }
    p.then(after, () => after());
  }
}
