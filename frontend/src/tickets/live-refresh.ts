/**
 * 2.5.4: ONE refresh helper for the lists of the module (cards, table, manager board). It calls `run` every `ms` (20 s) while the tab is
 * visible, when the tab becomes visible again and when the window regains focus - never more than once a second, never while hidden.
 * `start()` in connectedCallback, `stop()` in disconnectedCallback. The callback decides whether it is a good moment (nothing open).
 */
export const LIVE_REFRESH_MS = 20_000;
const MIN_GAP_MS = 1_000;

export class LiveRefresh {
  private timer = 0;
  private last = 0;

  constructor(private readonly run: () => void, private readonly ms = LIVE_REFRESH_MS, private readonly now: () => number = () => Date.now()) {}

  private fire = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const t = this.now();
    if (t - this.last < MIN_GAP_MS) return;
    this.last = t;
    this.run();
  };

  private onVisible = (): void => {
    if (document.visibilityState === 'visible') this.fire();
  };

  start(): void {
    this.stop();
    this.timer = window.setInterval(this.fire, this.ms);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('focus', this.fire);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('focus', this.fire);
  }
}
