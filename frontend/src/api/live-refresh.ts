/**
 * HOMELIVE-295: ONE refresh controller for the live data of a screen whose widgets read the server by themselves (the home screen: the
 * structure tree with the weather and the sensors, the elevators, the temperature units, the generators).
 *
 * Why it exists (owner bug 2026-10-21, "the widgets do not refresh online, I have to refresh the screen"): the home screen relied on the push
 * socket for its tree and on three bare setIntervals for the widgets. A phone that sleeps loses both: the socket dies half-open (no close event,
 * no reconnect for minutes), the intervals are frozen, and nothing looked at the page becoming visible again. The widgets stayed on the data of
 * the moment the phone went to sleep until the user pressed refresh.
 *
 * Contract:
 *  - each source has its own poll period (a number, or a function when it depends on the state of the push socket); the next poll is armed
 *    AFTER the previous one finished (no overlap), with a small jitter so several sources never fire in the same tick;
 *  - nothing is requested while the page is hidden or the browser is offline;
 *  - on resume (visibilitychange to visible, focus, pageshow, online) every source whose last start is older than MIN_GAP_MS runs, staggered
 *    by STAGGER_MS (a focus + visibilitychange pair is one refresh, never two);
 *  - a failure backs the source off (period x2 per consecutive failure, capped at MAX_BACKOFF_MS); `online` and a manual refresh reset it;
 *  - `nudge(id)` (a push told us something moved) runs the source only if its data is older than NUDGE_GAP_MS - a push storm is bounded;
 *  - `lastOkAt()` / `staleMs()` let the screen show a tiny "not current" state; no text is produced here.
 */

export interface LiveSource {
  id: string;
  /** Runs one read. Resolve `false` (or throw) for a failure; anything else is a success. */
  run: () => Promise<unknown> | unknown;
  /** The poll period in ms. */
  pollMs: number | (() => number);
  /** Asked before every poll / resume run; a disabled source is skipped and asked again at the next period (default: enabled). */
  enabled?: () => boolean;
}

export interface LiveEnv {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  visible(): boolean;
  online(): boolean;
  /** Registers the resume events; returns the unregister function. */
  onResume(fn: () => void, onOnline: () => void): () => void;
  random(): number;
}

export const MIN_GAP_MS = 5_000;
export const NUDGE_GAP_MS = 15_000;
export const STAGGER_MS = 300;
export const MAX_BACKOFF_MS = 300_000;
const JITTER = 0.1;

function browserEnv(): LiveEnv {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    visible: () => document.visibilityState !== 'hidden',
    online: () => navigator.onLine !== false,
    onResume(fn, onOnline) {
      const vis = () => {
        if (document.visibilityState !== 'hidden') fn();
      };
      const online = () => onOnline();
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('focus', fn);
      window.addEventListener('pageshow', fn);
      window.addEventListener('online', online);
      return () => {
        document.removeEventListener('visibilitychange', vis);
        window.removeEventListener('focus', fn);
        window.removeEventListener('pageshow', fn);
        window.removeEventListener('online', online);
      };
    },
    random: () => Math.random(),
  };
}

interface Slot {
  src: LiveSource;
  timer: unknown;
  running: boolean;
  /** a staggered resume run is already scheduled for this source */
  queued: boolean;
  lastStart: number;
  lastOk: number;
  failures: number;
}

export class LiveController {
  private readonly slots = new Map<string, Slot>();
  private readonly env: LiveEnv;
  private off: (() => void) | null = null;
  private started = false;
  private listeners = new Set<() => void>();

  constructor(env: Partial<LiveEnv> = {}) {
    this.env = { ...browserEnv(), ...env };
  }

  add(src: LiveSource): this {
    this.slots.set(src.id, { src, timer: null, running: false, queued: false, lastStart: 0, lastOk: 0, failures: 0 });
    if (this.started) this.arm(this.slots.get(src.id)!);
    return this;
  }

  remove(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    this.env.clearTimeout(s.timer);
    this.slots.delete(id);
  }

  /** Begin polling and listening for resume events. The first read of each source is the screen's own (it knows when it is ready):
   * call `markOk(id)` after it, or the first resume treats the source as never read. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.off = this.env.onResume(
      () => this.resume(false),
      () => this.resume(true),
    );
    for (const s of this.slots.values()) this.arm(s);
  }

  stop(): void {
    this.started = false;
    this.off?.();
    this.off = null;
    for (const s of this.slots.values()) {
      this.env.clearTimeout(s.timer);
      s.timer = null;
    }
  }

  /** The screen did its own read of this source: remember the time (and clear the failure streak when it worked). */
  markRead(id: string, ok: boolean): void {
    const s = this.slots.get(id);
    if (!s) return;
    const t = this.env.now();
    s.lastStart = t;
    if (ok) {
      s.lastOk = t;
      s.failures = 0;
    } else s.failures++;
    this.emit();
  }

  /** A push said something moved: run the source when its data is older than NUDGE_GAP_MS. */
  nudge(id: string, gapMs = NUDGE_GAP_MS): void {
    const s = this.slots.get(id);
    if (!s || !this.started || !this.canRun(s)) return;
    if (this.env.now() - s.lastStart < gapMs) return;
    void this.runSlot(s);
  }

  /** The user asked for fresh data (the refresh button): every source runs now (staggered), failure streaks reset. */
  refreshAll(skip: string[] = []): void {
    this.fanOut(true, true, skip);
  }

  /** Run one source now (a retry button on its failure panel); the gap guard does not apply. */
  refreshOne(id: string): void {
    const s = this.slots.get(id);
    if (!s) return;
    s.failures = 0;
    void this.runSlot(s);
  }

  /** The newest successful read over all sources (0 = none yet). */
  lastOkAt(): number {
    let t = 0;
    for (const s of this.slots.values()) if (s.lastOk > t) t = s.lastOk;
    return t;
  }

  /** Milliseconds since `id` was last read successfully (Infinity = never). */
  ageOf(id: string): number {
    const s = this.slots.get(id);
    return !s || !s.lastOk ? Number.POSITIVE_INFINITY : this.env.now() - s.lastOk;
  }

  /** True while at least one source is in a failure streak. */
  failing(): boolean {
    for (const s of this.slots.values()) if (s.failures > 0) return true;
    return false;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------------------------------------------------------------------------------------------------------------- internals

  private emit(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
        /* a listener never stops the controller */
      }
    }
  }

  private canRun(s: Slot): boolean {
    if (s.running || !this.env.visible() || !this.env.online()) return false;
    try {
      return s.src.enabled ? s.src.enabled() !== false : true;
    } catch {
      return false;
    }
  }

  private period(s: Slot): number {
    const base = typeof s.src.pollMs === 'function' ? s.src.pollMs() : s.src.pollMs;
    const backed = Math.min(base * 2 ** Math.min(s.failures, 10), Math.max(base, MAX_BACKOFF_MS));
    return Math.round(backed * (1 + (this.env.random() * 2 - 1) * JITTER));
  }

  private arm(s: Slot): void {
    this.env.clearTimeout(s.timer);
    s.timer = null;
    if (!this.started) return;
    s.timer = this.env.setTimeout(() => {
      s.timer = null;
      if (this.canRun(s)) void this.runSlot(s);
      else this.arm(s); // hidden / offline / disabled: look again next period; the resume event does the catching up
    }, this.period(s));
  }

  private async runSlot(s: Slot): Promise<void> {
    if (s.running) return;
    s.running = true;
    s.lastStart = this.env.now();
    let ok = true;
    try {
      ok = (await s.src.run()) !== false;
    } catch {
      ok = false;
    }
    s.running = false;
    if (ok) {
      s.lastOk = this.env.now();
      s.failures = 0;
    } else s.failures++;
    this.emit();
    this.arm(s);
  }

  private resume(fromOnline: boolean): void {
    if (!this.started) return;
    this.fanOut(false, fromOnline);
  }

  private fanOut(force: boolean, resetFailures: boolean, skip: string[] = []): void {
    const t = this.env.now();
    let i = 0;
    for (const s of this.slots.values()) {
      if (resetFailures) s.failures = 0;
      if (skip.includes(s.src.id)) continue;
      if (!force && t - s.lastStart < MIN_GAP_MS) continue;
      if (s.queued || !this.canRun(s)) continue;
      const delay = i++ * STAGGER_MS;
      if (!delay) void this.runSlot(s);
      else {
        s.queued = true;
        this.env.setTimeout(() => {
          s.queued = false;
          if (this.started && this.canRun(s) && (force || this.env.now() - s.lastStart >= MIN_GAP_MS)) void this.runSlot(s);
        }, delay);
      }
    }
  }
}
