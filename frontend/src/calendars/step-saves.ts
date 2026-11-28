/**
 * FIX-CALENDAR-2570 (second deep review of 2.57, CU2-30): the debounced saves of the number steppers on הגדרות › יומנים.
 *
 * Before: ONE timer served every stepper (changing one and then another within 500 ms cancelled the first save), the value the row showed
 * before the change was read only when the save ran (a refusal "restored" the unsaved number), and a pending policy change could be
 * written to the calendar picked meanwhile. Here:
 * - one burst per key: each key has its own timer, so two steppers never cancel each other;
 * - `first` (what the row showed, and for a policy the calendar it belongs to) is captured at the FIRST change of a burst;
 * - `flush(prefix)` sends the pending saves of a group at once (before the calendar they belong to is switched), with their own data;
 * - `drop()` forgets every pending save (the screen is gone).
 * Pure: the timer functions are injected (the node unit spec drives them by hand).
 */
export interface StepTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const browserTimers: StepTimers = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (h) => window.clearTimeout(h as number),
};

interface Pending {
  handle: unknown;
  value: unknown;
  run: () => void;
}

export class StepSaves {
  private pending = new Map<string, Pending>();
  private firsts = new Map<string, unknown>();

  constructor(private readonly delayMs = 500, private readonly timers: StepTimers = browserTimers) {}

  /** A stepper changed `key` to `value`. `first()` is read only at the first change of a burst; `save(value, first)` runs after the pause. */
  change<F>(key: string, value: unknown, first: () => F, save: (value: unknown, first: F) => void): void {
    const cur = this.pending.get(key);
    if (cur) this.timers.clear(cur.handle);
    if (!this.firsts.has(key)) this.firsts.set(key, first());
    const f = this.firsts.get(key) as F;
    const run = () => {
      if (this.pending.get(key)?.run !== run) return;
      this.pending.delete(key);
      this.firsts.delete(key);
      save(value, f);
    };
    this.pending.set(key, { handle: this.timers.set(run, this.delayMs), value, run });
  }

  /** Sends now every pending save whose key starts with `prefix` (each with the data captured when its burst began). */
  flush(prefix = ''): void {
    for (const [k, p] of [...this.pending]) {
      if (!k.startsWith(prefix)) continue;
      this.timers.clear(p.handle);
      p.run();
    }
  }

  /** Forgets every pending save. */
  drop(): void {
    for (const p of this.pending.values()) this.timers.clear(p.handle);
    this.pending.clear();
    this.firsts.clear();
  }

  /** The values still waiting under `prefix`, by the key's remainder (a reply from the server must not wipe what the row shows). */
  waiting(prefix: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, p] of this.pending) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = p.value;
    return out;
  }
}
