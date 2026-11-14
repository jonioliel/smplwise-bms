import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { DD_CHIPS, DD_COLLIDE_MS, DD_FIT_FRAMES, DD_FIT_STABLE, DD_GAP, DD_TITLE_WAIT_MS, ddHeader, type DdBox } from './dd-place-fit';

/**
 * CR-SHELL-TIMERS-2439 (review 07:F14, 07:F24): the header-fit logic of the shell (`fitDd` and its bookkeeping), moved out of
 * shell/sw-app.ts into one controller, and no longer measured every 1.2 s for the life of the page.
 *
 * What it does is unchanged (FIX2231C-295, 2.7.2, CR-WAVE1B-COMBINED-2436): placements 2-4 of the header dropdown put the chips on the
 * page's first row; `fit()` measures that row (the title as a text range, every control of the screen's top rows through the shadow roots,
 * the floating corner), publishes --sw-dd-float-end / --sw-dd-end / --sw-dd-title-offset, marks the row fitted (data-dd-fit), and when a
 * chip still covers something for DD_COLLIDE_MS the route falls back to the own row (data-dd-fallback="collision").
 *
 * When it measures (the change):
 *  - after every render of the shell (one animation frame later, as before) and every frame of the burst after a route / placement change;
 *  - when the screen, the tab row or the floating corner changes size (ResizeObserver; a window resize included);
 *  - every DD_TICK_MS (1.2 s, as before) only until the row is settled: fitted, nothing pending (no collision being timed, no title being
 *    waited for) and DD_SETTLE_PASSES clear passes in a row; then a slow re-check every DD_IDLE_CHECK_MS, so a control a screen draws late
 *    (its data arrived after the row settled) is still caught - any pass that finds something pending goes back to the 1.2 s tick;
 *  - never while the page is hidden; once on return, followed by the 1.2 s tick until settled again.
 */

export const DD_TICK_MS = 1200;
/** Clear passes in a row (after data-dd-fit) before the 1.2 s tick gives way to the slow re-check. */
export const DD_SETTLE_PASSES = 4;
/** The slow re-check of a settled row. */
export const DD_IDLE_CHECK_MS = 6000;

/** What one measurement found: nothing to fit here, a clear row, something still pending (wait / collision timer), or the fallback taken. */
export type FitPass = 'idle' | 'clear' | 'pending' | 'fallback';

export interface FitEnv {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  visible(): boolean;
  /** Registers the "page became visible" listener; returns the unregister function. */
  onVisible(fn: () => void): () => void;
}

function browserFitEnv(): FitEnv {
  return {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    visible: () => document.visibilityState !== 'hidden',
    onVisible(fn) {
      const vis = () => {
        if (document.visibilityState !== 'hidden') fn();
      };
      document.addEventListener('visibilitychange', vis);
      return () => document.removeEventListener('visibilitychange', vis);
    },
  };
}

/** The timing of the re-measurement, without the DOM (unit-tested with a fake clock). */
export class FitScheduler {
  private readonly env: FitEnv;
  private timer: unknown = null;
  private off: (() => void) | null = null;
  private running = false;
  private quiet = 0;

  constructor(
    private readonly pass: () => FitPass,
    private readonly fitted: () => boolean,
    env: Partial<FitEnv> = {},
  ) {
    this.env = { ...browserFitEnv(), ...env };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.off = this.env.onVisible(() => {
      this.report(this.pass());
      this.wake();
    });
    this.wake();
  }

  stop(): void {
    this.running = false;
    this.off?.();
    this.off = null;
    this.env.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Something moved (a route, a placement, a size, the page back in view): measure at the 1.2 s rate until settled again. */
  wake(): void {
    this.quiet = 0;
    this.arm(DD_TICK_MS);
  }

  /** A measurement made outside the tick (after a render, a resize): something pending brings the 1.2 s tick back. */
  report(r: FitPass): void {
    if (r === 'pending' && (this.quiet > 0 || this.timer === null)) this.wake();
  }

  /** True while the slow re-check is armed (the row is settled). */
  idle(): boolean {
    return this.quiet >= DD_SETTLE_PASSES && this.fitted();
  }

  private arm(ms: number): void {
    this.env.clearTimeout(this.timer);
    this.timer = null;
    if (!this.running) return;
    this.timer = this.env.setTimeout(() => this.tick(), ms);
  }

  private tick(): void {
    this.timer = null;
    if (!this.running || !this.env.visible()) return; // hidden: nothing; the visibility listener measures and wakes on return
    const r = this.pass();
    this.quiet = r === 'pending' ? 0 : this.quiet + 1;
    this.arm(this.idle() ? DD_IDLE_CHECK_MS : DD_TICK_MS);
  }
}

type FitHost = ReactiveControllerHost & HTMLElement & { renderRoot: HTMLElement | DocumentFragment };

/** The shell's header fit: `sync()` from the shell's updated(), everything else runs by itself while the shell is connected. */
export class HeaderFit implements ReactiveController {
  /** The route (hash) on which the measured header layout still collided with the chips: that route falls back to the own-row placement. */
  collideRoute = '';
  /** When the current collision was first seen: a collision has to persist for DD_COLLIDE_MS before the route falls back (a loading
   * screen draws a provisional header for a moment). */
  private missSince = 0;
  /** CR-WAVE1B-COMBINED-2436: when placement 3 first found no title on this route (it waits DD_TITLE_WAIT_MS for the heading). */
  private titleWaitSince = 0;
  private route = '';

  /** FIX2231C-295: first paint of the hanging chips. Placements 2 and 3 are MEASURED (the floating corner's extent, the title's far edge), so
   * the first frame after a route / placement change used to draw the chips at the CSS defaults and the next frame moved them (a visible
   * jump, over the title on the way). Until a measurement came out clear (data-dd-fit), the CSS keeps those chips invisible (visibility:
   * hidden - they keep their box, so nothing else moves and the content is not delayed). sync() measures once synchronously (before
   * paint: enough for placement 2, which needs only the shell's own pieces) and then every frame for DD_FIT_FRAMES (placement 3 waits for the
   * screen's heading and follows it while its data loads); when the burst ends the chips are shown in any case. */
  private fitKey = '';
  private fitFrames = 0;
  private fitPump = 0;
  private fitOffset = -2;
  private fitStable = 0;

  private readonly sched: FitScheduler;
  private ro: ResizeObserver | null = null;
  private observed: Element[] = [];

  constructor(private readonly host: FitHost) {
    this.sched = new FitScheduler(
      () => this.pass(),
      () => this.host.hasAttribute('data-dd-fit'),
    );
    host.addController(this);
  }

  hostConnected(): void {
    this.sched.start();
  }

  hostDisconnected(): void {
    this.sched.stop();
    if (this.fitPump) cancelAnimationFrame(this.fitPump);
    this.fitPump = 0;
    this.ro?.disconnect();
    this.ro = null;
    this.observed = [];
  }

  /** A new route: a collision or a title wait seen on the previous screen does not count here. */
  enterRoute(route: string): void {
    if (route !== this.collideRoute) this.collideRoute = '';
    if (route !== this.route) {
      this.route = route;
      this.missSince = 0;
      this.titleWaitSince = 0;
    }
  }

  /** After every render of the shell: a new route / placement / chip count starts the first-paint burst; one measurement a frame later;
   * the measured pieces are observed for size changes. */
  sync(fitKey: string): void {
    if (fitKey !== this.fitKey) {
      this.fitKey = fitKey;
      this.startFit();
      this.sched.wake();
    }
    requestAnimationFrame(() => this.fit());
    this.observe();
  }

  /** One measurement (the old fitDd, re-run after every render); something pending keeps the 1.2 s tick going. */
  fit(): FitPass {
    const r = this.pass();
    this.sched.report(r);
    return r;
  }

  private markFitted(): void {
    if (!this.host.hasAttribute('data-dd-fit')) this.host.setAttribute('data-dd-fit', '');
  }

  private startFit(): void {
    this.host.removeAttribute('data-dd-fit');
    this.fitFrames = DD_FIT_FRAMES;
    this.fitOffset = -2;
    this.fitStable = 0;
    this.pass();
    if (this.fitPump) return;
    const step = () => {
      this.fitPump = 0;
      if (!this.host.isConnected) return;
      this.pass();
      if (--this.fitFrames > 0) this.fitPump = requestAnimationFrame(step);
      else this.markFitted();
    };
    this.fitPump = requestAnimationFrame(step);
  }

  /** The screen, the chips' row and the floating corner: a size change of any of them (a window resize included) measures again. */
  private observe(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const root = this.host.renderRoot;
    const els = [
      root.querySelector('.screen'),
      root.querySelector('.tabpair:not(.single), .subnav[data-tabstyle="dropdown"]'),
      root.querySelector('.float'),
    ].filter((e): e is Element => !!e);
    if (els.length === this.observed.length && els.every((e, i) => e === this.observed[i])) return;
    this.ro?.disconnect();
    this.ro = new ResizeObserver(() => {
      this.pass();
      this.sched.wake();
    });
    for (const e of els) this.ro.observe(e);
    this.observed = els;
  }

  /** Placements 2-4 put the chips on the page's first row. This measures that row (the title as a text range, and every control of the
   * screen's top rows: buttons, links, fields, selectors, tabs, headings, through the shadow roots - ddHeader) and the floating corner:
   *   - 2: publishes the corner's extent (--sw-dd-float-end) and the chips' own (--sw-dd-end, read as the pages' --sw-float-reserve);
   *   - 3: places the chips right after the title (the title plus a control that wraps it, such as the devices area selector), moving on
   *     past any control already there to the first free gap of the row (--sw-dd-title-offset);
   *   - every placement: when a chip still overlaps the title, a control or the corner (or leaves the viewport) for DD_COLLIDE_MS, the route
   *     falls back to the own row (data-dd-fallback="collision"), so nothing is ever covered. */
  private pass(): FitPass {
    const host = this.host;
    const place = host.getAttribute('data-dd-place');
    if (!place || place === '1' || !host.hasAttribute('data-dd-head') || !window.matchMedia('(min-width: 1100px)').matches) {
      this.missSince = 0;
      return 'idle';
    }
    const row = host.renderRoot.querySelector<HTMLElement>('.tabpair:not(.single), .subnav[data-tabstyle="dropdown"]');
    const screen = host.renderRoot.querySelector('.screen');
    const chipEls = [...host.renderRoot.querySelectorAll<HTMLElement>(DD_CHIPS)];
    const measure = () => chipEls.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    let chips = measure();
    if (!row || !screen || !chips.length) return 'pending';
    const rtl = getComputedStyle(host).direction === 'rtl';
    const rr = row.getBoundingClientRect();
    /** how far an x coordinate lies from the row's start edge / far edge */
    const fromStart = (x: number) => (rtl ? rr.right - x : x - rr.left);
    const fromEnd = (x: number) => (rtl ? x - rr.left : rr.right - x);
    const set = (k: string, v: number) => {
      const px = `${Math.max(0, Math.round(v))}px`;
      if (host.style.getPropertyValue(k) !== px) host.style.setProperty(k, px);
    };
    const corner = host.renderRoot.querySelector<HTMLElement>('.float');
    const cr = corner && corner.offsetWidth > 0 ? corner.getBoundingClientRect() : null;
    if (place === '2') {
      if (cr) set('--sw-dd-float-end', fromEnd(rtl ? cr.right : cr.left) + DD_GAP);
      chips = measure();
      set('--sw-dd-end', Math.max(...chips.map((c) => fromEnd(rtl ? c.right : c.left))) + DD_GAP);
    }
    const band = Math.max(...chips.map((c) => c.bottom)) + 8;
    const { title, obstacles } = ddHeader(screen, band);
    let offset = -1; // placement 3: where the chips were put this pass
    if (place === '3' && title && title.top < band) {
      // the title, together with a control that wraps or overlaps it (the devices area selector draws the area name as its heading)
      const box = { left: title.left, right: title.right };
      for (const o of obstacles) {
        if (o.left < title.right && o.right > title.left && o.top < title.bottom && o.bottom > title.top) {
          box.left = Math.min(box.left, o.left);
          box.right = Math.max(box.right, o.right);
        }
      }
      const span = Math.max(...chips.map((c) => c.right)) - Math.min(...chips.map((c) => c.left));
      let at = fromStart(rtl ? box.left : box.right) + DD_GAP;
      for (let i = 0; i < 60; i++) {
        const a = rtl ? rr.right - at - span : rr.left + at;
        const b = a + span;
        const hit = obstacles.filter((o) => o.left < b && o.right > a && !(o.left >= box.left - 0.5 && o.right <= box.right + 0.5));
        if (!hit.length) break;
        at = Math.max(...hit.map((o) => fromStart(rtl ? o.left : o.right))) + DD_GAP;
      }
      set('--sw-dd-title-offset', at);
      offset = Math.round(at);
      chips = measure();
    }
    const covers = (c: DOMRect, o: DdBox) => c.left < o.right - 0.5 && c.right > o.left + 0.5 && c.top < o.bottom - 0.5 && c.bottom > o.top + 0.5;
    const blocked: DdBox[] = [...obstacles, ...(title ? [title] : []), ...(cr ? [cr] : [])];
    const offPage = chips.some((c) => c.left < -0.5 || c.right > window.innerWidth + 0.5);
    // placement 3 with no title on the chips' row (a title under a row of the screen's own tabs) has nothing to follow
    let hit = offPage || (place === '3' && !!title && title.top >= band) || chips.some((c) => blocked.some((o) => covers(c, o)));
    // CR-WAVE1B-COMBINED-2436: no title at all yet is a screen still loading its heading, not a collision - placement 3 waits for it
    // (chips hidden, nothing covered) up to DD_TITLE_WAIT_MS in all, then falls back as before
    if (place === '3' && !title && !hit) {
      const t = performance.now();
      if (!this.titleWaitSince) this.titleWaitSince = t;
      if (t - this.titleWaitSince < DD_TITLE_WAIT_MS - DD_COLLIDE_MS) {
        this.missSince = 0;
        return 'pending';
      }
      hit = true;
    } else if (title) this.titleWaitSince = 0;
    if (!hit) {
      this.missSince = 0;
      // measured, clear of everything: the chips may be painted now. Placement 3 follows the heading, which is swapped while its data loads:
      // it waits until the same place came out DD_FIT_STABLE passes in a row
      if (place !== '3') this.markFitted();
      else {
        this.fitStable = offset === this.fitOffset ? this.fitStable + 1 : 0;
        this.fitOffset = offset;
        if (this.fitStable >= DD_FIT_STABLE) this.markFitted();
      }
      return 'clear';
    }
    const now = performance.now();
    if (!this.missSince) this.missSince = now;
    if (now - this.missSince < DD_COLLIDE_MS) return 'pending';
    this.missSince = 0;
    this.collideRoute = location.hash;
    host.setAttribute('data-dd-place', '1');
    host.setAttribute('data-dd-fallback', 'collision');
    return 'fallback';
  }
}
