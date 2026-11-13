import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LiveController, type LiveEnv } from '../api/live-refresh';

/**
 * CR-POLL-SCREENS-A-2436 (review finding D2 / 06:POLL-1): THE way a screen or component polls the server.
 *
 * A bare `setInterval` freezes on a sleeping phone and never catches up on resume, keeps requesting in a hidden tab, and starts a second
 * read while a slow first one is still pending. `api/live-refresh.ts` (`LiveController`, owner bug 2026-10-21) already solves all of that;
 * this file wraps it as a Lit `ReactiveController` so an element gets it in two lines and cannot forget to stop it:
 *
 *     private poll = new PollController(this);                                // starts on connect, stops on disconnect
 *     ...
 *     this.poll.every('state', 15_000, () => this.load(), { when: () => !this.editing });
 *
 * What a registration gets (from `LiveController`):
 *  - the next tick is armed AFTER the previous read finished: never two reads of one source at once;
 *  - nothing runs while the page is hidden or the browser is offline; the tick is skipped and asked again one period later;
 *  - on resume (visible / focus / pageshow / online) a source whose last read is older than `MIN_GAP_MS` (5 s) runs once;
 *  - a read that resolves `false` or throws backs the source off (period x2 per failure in a row, capped at 5 min); a read that catches
 *    its own errors and resolves anything else keeps the plain period - which is what every caller migrated in 2436 does.
 *
 * Differences from `LiveController` used directly, on purpose:
 *  - the period is EXACT (no jitter) unless `{ jitter: true }` is passed: migrating a screen keeps its period as it was;
 *  - `every(id, ...)` with an id that is already registered REPLACES it (the period restarts) - the `clearInterval` + `setInterval` idiom;
 *  - `cancel(id)` is safe from inside the source's own read (a poll that stops itself when its job is done).
 *
 * The host does its own first read (it knows when it is ready). By default a registration counts as "just read" (`fresh: true`), so a
 * resume within 5 s of `every()` does not repeat that read; pass `{ fresh: false }` when nothing was read yet.
 */

export interface PollOptions {
  /** Asked before every tick and every resume run; `false` skips this one (asked again a period later). Default: always. */
  when?: () => boolean;
  /** The host has just read this source itself (default true): the first resume within `MIN_GAP_MS` does not run it again. */
  fresh?: boolean;
}

export interface PollControllerOptions {
  /** +/-10 % jitter on every period, so many sources never fire in the same tick (default false: the exact period). */
  jitter?: boolean;
  /** Tests: a fake clock and fake page events (see `LiveEnv`). */
  env?: Partial<LiveEnv>;
}

interface Registration {
  key: string;
  dead: boolean;
  running: boolean;
}

export class PollController implements ReactiveController {
  private readonly live: LiveController;
  private readonly regs = new Map<string, Registration>();
  private readonly later: (fn: () => void) => void;
  private seq = 0;

  constructor(host: ReactiveControllerHost, opts: PollControllerOptions = {}) {
    // random() = 0.5 is LiveController's "no jitter" ((0.5 * 2 - 1) * 10 % = 0); it wins over a test env unless jitter is asked for
    const env: Partial<LiveEnv> = { ...opts.env, ...(opts.jitter ? {} : { random: () => 0.5 }) };
    this.live = new LiveController(env);
    const set = env.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
    this.later = (fn) => void set(fn, 0);
    host.addController(this);
  }

  hostConnected(): void {
    this.live.start();
  }

  hostDisconnected(): void {
    this.live.stop();
  }

  /** Poll `run` every `ms` (a number, or a function read before every tick) while the host is connected. Replaces an earlier `id`. */
  every(id: string, ms: number | (() => number), run: () => unknown, opts: PollOptions = {}): this {
    this.cancel(id);
    const reg: Registration = { key: `${id}#${++this.seq}`, dead: false, running: false };
    this.regs.set(id, reg);
    this.live.add({
      id: reg.key,
      pollMs: ms,
      enabled: () => !reg.dead && (opts.when ? opts.when() !== false : true),
      run: async () => {
        if (reg.dead) return;
        reg.running = true;
        try {
          return await run();
        } finally {
          reg.running = false;
          // cancelled (or replaced) during its own read: LiveController re-arms the slot right after this returns, so drop it a tick later
          if (reg.dead) this.later(() => this.live.remove(reg.key));
        }
      },
    });
    if (opts.fresh !== false) this.live.markRead(reg.key, true);
    return this;
  }

  /** Stop polling `id` (no-op when it is not registered). Safe from inside its own read. */
  cancel(id: string): void {
    const reg = this.regs.get(id);
    if (!reg) return;
    this.regs.delete(id);
    reg.dead = true;
    if (!reg.running) this.live.remove(reg.key);
  }

  /** True while `id` is registered. */
  has(id: string): boolean {
    return this.regs.has(id);
  }

  /** Run `id` now (a retry button), whatever its age; still never two reads at once. */
  now(id: string): void {
    const reg = this.regs.get(id);
    if (reg) this.live.refreshOne(reg.key);
  }
}

