import { LiveController, type LiveEnv } from '../api/live-refresh';

/**
 * 2.5.4: ONE refresh helper for the lists of the module (cards, table, manager board). It calls `run` every `ms` (20 s) while the tab is
 * visible, when the tab becomes visible again and when the window regains focus - never more than once a second, never while hidden.
 * `start()` in connectedCallback, `stop()` in disconnectedCallback. The callback decides whether it is a good moment (nothing open).
 *
 * CR-POLL-FEATURES-2439 (review D2 / 08:F06): a thin alias of the shared polling engine (`api/live-refresh.ts` `LiveController`, the one
 * under `components/poll-controller.ts`) instead of a second hand-written loop. The contract above is unchanged: the exact period (no
 * jitter), visible only, a resume (visible / focus) runs it when the last run is older than 1 s. From the engine it also gains: nothing
 * while the browser is offline, `pageshow` / `online` count as a resume, and the next tick is armed after the run returned.
 */
export const LIVE_REFRESH_MS = 20_000;
const MIN_GAP_MS = 1_000;

export class LiveRefresh {
  private readonly live: LiveController;

  /** `env`: tests only (a fake clock and fake page events, see `LiveEnv`). */
  constructor(run: () => void, ms = LIVE_REFRESH_MS, env: Partial<LiveEnv> = {}) {
    // random() = 0.5 is the engine's "no jitter": the period stays exactly `ms`
    this.live = new LiveController({ ...env, random: () => 0.5 });
    this.live.add({
      id: 'list',
      pollMs: ms,
      resumeGapMs: MIN_GAP_MS,
      run: () => {
        try {
          run();
        } catch (e) {
          console.error(e); // as with the old setInterval: a throwing callback is reported and never slows the poll (no back-off)
        }
      },
    });
  }

  start(): void {
    this.stop();
    this.live.start();
  }

  stop(): void {
    this.live.stop();
  }
}
