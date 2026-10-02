/**
 * The performance tier of the glass look (owner pre-approval 2026-10-02, GLASS_DASHBOARDS_ANALYSIS.md): wall tablets and weak
 * phones must not pay for `backdrop-filter` on cards, pills, rows and scrolling lists. The look dial `performance`
 * (design/look.ts, backend services/look.py) is `auto` | `full` | `lite`; this file is how `auto` decides, on the client:
 *
 *   1. A weak-signal check, synchronous and free: hardwareConcurrency <= 4, deviceMemory <= 2 (when the browser reports it),
 *      prefers-reduced-motion, prefers-reduced-transparency. Any one of them => lite, no probe.
 *   2. Otherwise a frame-time probe: ~700 ms of requestAnimationFrame while a (nearly invisible) blurred test layer sits over a
 *      moving backdrop. The median frame interval above 24 ms (under ~42 fps) => lite, else full.
 *   3. The verdict is cached per device in localStorage (keyed on a signature of the capabilities, 30 days) and is what the page
 *      starts with on every load, so nothing flickers; the probe only runs when there is no valid cache, at idle, once.
 *
 * Pure logic (`capsVerdict`, `frameVerdict`, `median`, `decide`, `runProbe` with an injected environment) is exported for the
 * unit spec, which mocks the timings; the DOM bits (`readCaps`, `mountProbeLayer`, `startProbe`) are thin wrappers.
 * No dependency on look.ts (look.ts imports this file).
 */
export type PerformanceMode = 'auto' | 'full' | 'lite';
export type Tier = 'full' | 'lite';

export const PERF_THRESHOLDS = {
  /** hardwareConcurrency at or below this is a weak CPU. */
  maxCores: 4,
  /** deviceMemory (GB, rounded by the browser: 0.25 .. 8) at or below this is a weak device. */
  maxMemoryGb: 2,
  /** A median frame interval above this (ms) means the glass does not run smoothly. */
  medianFrameMs: 24,
  /** How long the probe measures (ms). */
  probeMs: 700,
  /** The first frames after the layer appears (style recalc, layer creation) do not count. */
  warmupFrames: 3,
  /** Fewer usable frames than this is no verdict (a throttled / hidden tab): nothing is cached. */
  minFrames: 12,
  /** How long a cached verdict is trusted (days). */
  cacheDays: 30,
} as const;

export interface Caps {
  cores: number | null;
  memoryGb: number | null;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  /** Part of the cache signature: a different screen density is a different device class for the probe. */
  dpr: number;
}
export type WeakReason = 'cores' | 'memory' | 'reduced-motion' | 'reduced-transparency';

/** The weak-signal check: the first weak capability, or null when none is weak (then the probe / the cache decide). */
export function capsVerdict(c: Caps): WeakReason | null {
  if (c.reducedTransparency) return 'reduced-transparency';
  if (c.reducedMotion) return 'reduced-motion';
  if (c.cores !== null && c.cores > 0 && c.cores <= PERF_THRESHOLDS.maxCores) return 'cores';
  if (c.memoryGb !== null && c.memoryGb > 0 && c.memoryGb <= PERF_THRESHOLDS.maxMemoryGb) return 'memory';
  return null;
}

export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The verdict of a list of frame intervals (ms): the warm-up frames are dropped; too few frames is no verdict (null). */
export function frameVerdict(intervals: readonly number[]): Tier | null {
  const used = intervals.slice(PERF_THRESHOLDS.warmupFrames);
  if (used.length < PERF_THRESHOLDS.minFrames) return null;
  return median(used) > PERF_THRESHOLDS.medianFrameMs ? 'lite' : 'full';
}

// ---- the cache: one verdict per device ----

export const PERF_CACHE_KEY = 'sw.ui.performance';
export interface Cached {
  tier: Tier;
  sig: string;
  at: number;
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const signature = (c: Caps): string => `${c.cores ?? '?'}/${c.memoryGb ?? '?'}/${c.dpr}`;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The cached verdict when it belongs to this device class and is fresh; else null. */
export function readCached(caps: Caps, now: number, store: Store | null = defaultStore()): Tier | null {
  try {
    const raw = store?.getItem(PERF_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Cached>;
    if ((c.tier !== 'full' && c.tier !== 'lite') || c.sig !== signature(caps) || typeof c.at !== 'number') return null;
    if (now - c.at > PERF_THRESHOLDS.cacheDays * 86_400_000 || c.at > now + 86_400_000) return null;
    return c.tier;
  } catch {
    return null;
  }
}

export function writeCached(caps: Caps, tier: Tier, now: number, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(PERF_CACHE_KEY, JSON.stringify({ tier, sig: signature(caps), at: now } satisfies Cached));
  } catch {
    /* storage unavailable: the verdict lasts for this page view only */
  }
}

export function clearCached(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(PERF_CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** What `auto` means right now, without measuring: a weak capability => lite; else the cached verdict; else full (the probe will settle it). */
export function decide(caps: Caps, cached: Tier | null): { tier: Tier; probe: boolean; reason: WeakReason | 'cache' | 'default' } {
  const weak = capsVerdict(caps);
  if (weak) return { tier: 'lite', probe: false, reason: weak };
  if (cached) return { tier: cached, probe: false, reason: 'cache' };
  return { tier: 'full', probe: true, reason: 'default' };
}

// ---- the probe ----

export interface ProbeEnv {
  raf(cb: (t: number) => void): number;
  cancel(id: number): void;
  hidden(): boolean;
  /** Puts the blurred test layer on screen; returns what removes it. */
  mount(): () => void;
}

/** Measures frame intervals for `probeMs`; resolves with the verdict, or null when the page was hidden / too few frames came. */
export function runProbe(env: ProbeEnv, probeMs: number = PERF_THRESHOLDS.probeMs): Promise<Tier | null> {
  return new Promise((resolve) => {
    const unmount = env.mount();
    const intervals: number[] = [];
    let first = -1;
    let last = -1;
    let id = 0;
    const finish = (v: Tier | null) => {
      env.cancel(id);
      unmount();
      resolve(v);
    };
    const tick = (t: number) => {
      if (env.hidden()) return finish(null);
      if (first < 0) first = t;
      else intervals.push(t - last);
      last = t;
      if (t - first >= probeMs) return finish(frameVerdict(intervals));
      id = env.raf(tick);
    };
    id = env.raf(tick);
  });
}

// ---- the DOM bits ----

export function readCaps(): Caps {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
  const mq = (q: string): boolean => {
    try {
      return typeof matchMedia !== 'undefined' && matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  return {
    cores: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    memoryGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    reducedTransparency: mq('(prefers-reduced-transparency: reduce)'),
    dpr: typeof devicePixelRatio === 'number' ? Math.round(devicePixelRatio * 100) / 100 : 1,
  };
}

/** The blurred test layer: a moving backdrop with a blurring pane over it, a corner of the page, near invisible, no pointer events. */
export function mountProbeLayer(): () => void {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('data-perf-probe', '');
  host.style.cssText = 'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:380px;block-size:280px;overflow:hidden;pointer-events:none;opacity:0.02;z-index:2147483000;contain:strict';
  const bg = document.createElement('div');
  bg.style.cssText = 'position:absolute;inset:0 -120px 0 0;background:repeating-linear-gradient(90deg,#fff 0 22px,#222 22px 44px,#e33 44px 66px)';
  const pane = document.createElement('div');
  pane.style.cssText = 'position:absolute;inset:0;-webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%)';
  host.append(bg, pane);
  document.body.append(host);
  let anim: Animation | null = null;
  try {
    anim = bg.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-120px)' }], { duration: 700, iterations: Infinity });
  } catch {
    /* no Web Animations: the backdrop stands still, the blur cost is still paid on every frame the page changes */
  }
  return () => {
    try {
      anim?.cancel();
    } catch {
      /* already gone */
    }
    host.remove();
  };
}

let probing = false;
let probed = false;

/**
 * Runs the probe once per page view, at idle, when `auto` has nothing cached; `done` is called with the verdict (already cached)
 * so the caller re-applies the look. Never throws; a null verdict (hidden tab, too few frames) caches nothing and lets a later
 * call try again.
 */
export function startProbe(done: (tier: Tier) => void, idle: (cb: () => void) => void = defaultIdle): void {
  if (probing || probed || typeof document === 'undefined') return;
  probing = true;
  idle(() => {
    void runProbe({
      raf: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
      hidden: () => document.hidden,
      mount: mountProbeLayer,
    })
      .then((tier) => {
        probing = false;
        if (!tier) return;
        probed = true;
        writeCached(readCaps(), tier, Date.now());
        done(tier);
      })
      .catch(() => {
        probing = false;
      });
  });
}

function defaultIdle(cb: () => void): void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const go = () => (w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 1500));
  // after the first paint and the load burst
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', () => window.setTimeout(go, 600), { once: true });
}

/** `auto` resolved for this device now (the cache or a weak signal); starts the probe when neither exists. */
export function autoTier(onProbed: (tier: Tier) => void): Tier {
  const caps = readCaps();
  const d = decide(caps, readCached(caps, Date.now()));
  if (d.probe) startProbe(onProbed);
  return d.tier;
}
