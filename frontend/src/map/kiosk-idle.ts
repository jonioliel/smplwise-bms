/**
 * Plan Studio 6, slice S5-B (CR-029 sections 3.3 / 3.4, docs/changes/CR-029-ST7-S5B-NOTES.md): the kiosk's idle behaviour as pure
 * logic - no DOM, no globals. The clock and the timers are injected (`IdleScheduler`), so a unit test drives every rule with a
 * fake scheduler and the 3D element drives the real one.
 *
 * `KioskIdle` is a two-phase machine. A wall tablet is `active` while anyone touches it or anything on the plan changes; after
 * `idleS` seconds of neither it turns `idle` - the owner of the view then swaps the live 3D for the baked still and stops the
 * frame loop ("no frames when idle", the NeonPlan rule taken one step further). An input, or a device-state change on the plan
 * (when `wakeOnChange`), wakes it. It never decides what the swap looks like; it only says when.
 *
 * - One outstanding timer, whatever the input rate: `input()` only stamps the time; the timer re-checks when it fires.
 * - `hold()` keeps the view awake while something runs that draws frames on purpose (an eye-level walk, a route tour).
 * - A tab or screen coming back (`setVisible(true)`) counts as a person: a woken tablet starts live and idles again after `idleS`.
 * - `idleS` 0 means never (a desk); changing it while idle wakes the view so the new rule starts clean.
 *
 * `PauseGate` is the other half: the reasons the frame loop is stopped (a hidden tab, the idle phase, the host) in one place, so
 * "paused" is the union of the reasons and clearing one never un-pauses another.
 */
export type IdlePhase = 'active' | 'idle';
export type IdleReason = 'timeout' | 'input' | 'change' | 'visible' | 'config' | 'hold';

export interface IdleScheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The real clock and timers (the element's scheduler). */
export const realScheduler: IdleScheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface KioskIdleOptions {
  /** Seconds of no input and no plan change before the view goes idle; 0 (or anything not positive) = never. */
  idleS: number;
  /** A plan change wakes an idle view (default true: the wall shows what happened). Off: it only keeps an active view awake. */
  wakeOnChange?: boolean;
  scheduler?: IdleScheduler;
  /** The phase changed. Called after the state is updated, so the callback may call back into the machine. */
  onChange: (phase: IdlePhase, reason: IdleReason) => void;
}

/** A valid idle time in milliseconds: finite and positive seconds, else 0 (never). */
export function idleMs(idleS: unknown): number {
  const s = typeof idleS === 'number' ? idleS : Number(idleS);
  return Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : 0;
}

export class KioskIdle {
  private phaseNow: IdlePhase = 'active';
  private lastActivity: number;
  private timer: unknown = null;
  private timerDue = 0;
  private readonly holds = new Set<string>();
  private ms: number;
  private readonly wakeOnChange: boolean;
  private readonly sched: IdleScheduler;
  private disposed = false;

  constructor(private readonly opts: KioskIdleOptions) {
    this.sched = opts.scheduler ?? realScheduler;
    this.wakeOnChange = opts.wakeOnChange !== false;
    this.ms = idleMs(opts.idleS);
    this.lastActivity = this.sched.now();
    this.arm();
  }

  get phase(): IdlePhase {
    return this.phaseNow;
  }

  /** The idle time in force, in seconds (0 = never). */
  get idleS(): number {
    return this.ms / 1000;
  }

  /** A person touched, pressed, scrolled or moved the pointer: stamp the time, and wake an idle view. */
  input(): void {
    if (this.disposed) return;
    this.lastActivity = this.sched.now();
    if (this.phaseNow === 'idle') this.set('active', 'input');
  }

  /** What the plan shows of the devices changed (a lit room, an open door, presence, a camera's status). Counts as activity;
   * it wakes an idle view unless `wakeOnChange` is off. */
  change(): void {
    if (this.disposed) return;
    if (this.phaseNow === 'idle') {
      if (this.wakeOnChange) {
        this.lastActivity = this.sched.now();
        this.set('active', 'change');
      }
      return;
    }
    this.lastActivity = this.sched.now();
  }

  /** Something that draws frames on purpose is running (a walk, a tour): while any hold is on the view stays active, and when
   * the last one ends the idle time starts again from that moment. */
  hold(reason: string, on: boolean): void {
    if (this.disposed) return;
    if (on) {
      this.holds.add(reason);
      this.lastActivity = this.sched.now();
      if (this.phaseNow === 'idle') this.set('active', 'hold');
      else this.clear();
      return;
    }
    if (!this.holds.delete(reason)) return;
    this.lastActivity = this.sched.now();
    this.arm();
  }

  /** The tab or the screen was hidden / shown. Showing it again is a person (or a schedule) waking the tablet. */
  setVisible(visible: boolean): void {
    if (this.disposed || !visible) return;
    this.lastActivity = this.sched.now();
    if (this.phaseNow === 'idle') this.set('active', 'visible');
  }

  /** A new idle time (the setting changed). 0 = never; an idle view wakes so the new rule starts from a live view. */
  setIdleS(idleS: number): void {
    if (this.disposed) return;
    const next = idleMs(idleS);
    if (next === this.ms) return;
    this.ms = next;
    this.lastActivity = this.sched.now();
    if (this.phaseNow === 'idle') {
      this.set('active', 'config');
      return;
    }
    this.clear();
    this.arm();
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
    this.holds.clear();
  }

  // ---- internals

  private set(next: IdlePhase, reason: IdleReason): void {
    if (next === this.phaseNow) return;
    this.phaseNow = next;
    if (next === 'active') this.arm();
    else this.clear();
    this.opts.onChange(next, reason);
  }

  private clear(): void {
    if (this.timer !== null) this.sched.clearTimeout(this.timer);
    this.timer = null;
    this.timerDue = 0;
  }

  /** One timer at the moment the idle time would run out; a later input only moves `lastActivity`, and the timer, when it
   * fires early, re-arms for what is left. */
  private arm(): void {
    if (this.disposed || this.ms <= 0 || this.phaseNow === 'idle' || this.holds.size > 0) {
      this.clear();
      return;
    }
    const due = this.lastActivity + this.ms;
    if (this.timer !== null && this.timerDue <= due) return; // already armed for this moment or an earlier look (it re-arms for the rest)
    this.clear();
    this.timerDue = due;
    this.timer = this.sched.setTimeout(() => this.fire(), Math.max(0, due - this.sched.now()));
  }

  private fire(): void {
    this.timer = null;
    this.timerDue = 0;
    if (this.disposed || this.phaseNow !== 'active' || this.holds.size > 0 || this.ms <= 0) return;
    if (this.sched.now() - this.lastActivity < this.ms) {
      this.arm(); // an input moved the deadline since this timer was set
      return;
    }
    this.set('idle', 'timeout');
  }
}

export type PauseReason = 'hidden' | 'idle' | 'host';

/** Why the frame loop is stopped. Paused = at least one reason; clearing a reason that is not set changes nothing. */
export class PauseGate {
  private readonly reasons = new Set<PauseReason>();

  /** Set or clear one reason; true when the paused state itself changed. */
  set(reason: PauseReason, on: boolean): boolean {
    const before = this.paused;
    if (on) this.reasons.add(reason);
    else this.reasons.delete(reason);
    return before !== this.paused;
  }

  has(reason: PauseReason): boolean {
    return this.reasons.has(reason);
  }

  get paused(): boolean {
    return this.reasons.size > 0;
  }
}
