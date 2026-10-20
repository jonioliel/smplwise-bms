/**
 * CLOCK-293: ONE shared wall-clock ticker for every screen that shows a time, a date or a relative time ("לפני 5 דק׳", a countdown).
 *
 * Why it exists: the home clock used to re-arm its own timeout from `updated()`, i.e. after EVERY render. A live installation re-renders the
 * widgets on each data refresh (sensor pushes, polls), so a 10 s timer that restarts on each render never got to fire and the clock froze at
 * the time the page loaded. A ticker that lives outside any component cannot be reset by a render.
 *
 * Contract:
 *  - one timer for the whole page, only while something is subscribed; stops with the last subscriber;
 *  - aligned to the wall clock: a minute subscriber is told when the minute changes, a seconds subscriber when the second changes;
 *  - re-derived from `Date.now()` on every wake-up, never accumulated, so a late timer (a throttled background tab, a laptop that slept,
 *    a clock that was corrected) is healed by the next callback; the wake-up cap (MAX_WAIT_MS) bounds how late that can be;
 *  - resumes at once on visibilitychange (visible), focus, pageshow and online, and when the wall clock jumped (drift);
 *  - hands out `Date` instances; the installation time zone is applied by the formatter that renders it (clockParts, hebrewDate ...),
 *    so a zone change needs no work here: the next tick formats with the new zone.
 */

export type TickListener = (now: Date) => void;

interface Sub {
  fn: TickListener;
  seconds: boolean;
  /** the last granule (minute or second index) this subscriber was told about */
  last: number;
}

/** A late timer is healed by the next wake-up; never wait longer than this (bounds the lateness after a sleep without any event). */
const MAX_WAIT_MS = 15_000;
/** A wall clock that moved by more than this between two wake-ups (sleep, a manual change, NTP) forces a notification. */
const DRIFT_MS = 2_500;
/** Wake up a hair after the boundary so the formatter never sees 12:59:59.999. */
const SLACK_MS = 15;

const subs = new Set<Sub>();
let timer = 0;
let armedAt = 0;
let armedFor = 0;
let installed = false;

const granule = (ms: number, seconds: boolean) => Math.floor(ms / (seconds ? 1000 : 60_000));

function nextDelay(ms: number, anySeconds: boolean): number {
  const step = anySeconds ? 1000 : 60_000;
  return Math.min(step - (ms % step) + SLACK_MS, MAX_WAIT_MS);
}

function arm(): void {
  window.clearTimeout(timer);
  timer = 0;
  if (!subs.size) return;
  const t = Date.now();
  const delay = nextDelay(t, [...subs].some((s) => s.seconds));
  armedAt = t;
  armedFor = delay;
  timer = window.setTimeout(wake, delay);
}

/** Tell every subscriber whose granule changed (or all of them when `force`), then re-arm from the real clock. */
function wake(force = false): void {
  const t = Date.now();
  const drifted = armedAt !== 0 && Math.abs(t - armedAt - armedFor) > DRIFT_MS;
  const now = new Date(t);
  for (const s of [...subs]) {
    const g = granule(t, s.seconds);
    if (force || drifted || g !== s.last) {
      s.last = g;
      try {
        s.fn(now);
      } catch {
        /* one broken listener never stops the clock */
      }
    }
  }
  arm();
}

const onResume = () => {
  if (document.visibilityState === 'hidden') return;
  wake(true);
};

function install(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('focus', onResume);
  window.addEventListener('pageshow', onResume);
  window.addEventListener('online', onResume);
}

function uninstall(): void {
  if (!installed) return;
  installed = false;
  document.removeEventListener('visibilitychange', onResume);
  window.removeEventListener('focus', onResume);
  window.removeEventListener('pageshow', onResume);
  window.removeEventListener('online', onResume);
}

/**
 * Call `fn(now)` whenever the minute (or, with `seconds`, the second) changes. Returns the unsubscribe function. The listener is NOT called on
 * subscribe: read `new Date()` for the first render yourself. Idempotent unsubscribe.
 */
export function subscribeClock(fn: TickListener, opts: { seconds?: boolean } = {}): () => void {
  const sub: Sub = { fn, seconds: !!opts.seconds, last: granule(Date.now(), !!opts.seconds) };
  subs.add(sub);
  install();
  arm();
  return () => {
    if (!subs.delete(sub)) return;
    if (!subs.size) {
      window.clearTimeout(timer);
      timer = 0;
      armedAt = 0;
      uninstall();
    } else {
      arm();
    }
  };
}

/** A subscription whose precision can change without losing its place (the home clock turns seconds on and off with its card size). */
export function createClockSubscription(fn: TickListener): { setSeconds(on: boolean): void; stop(): void } {
  let off: (() => void) | null = null;
  let mode: boolean | null = null;
  return {
    setSeconds(on: boolean) {
      if (off && mode === on) return;
      off?.();
      mode = on;
      off = subscribeClock(fn, { seconds: on });
    },
    stop() {
      off?.();
      off = null;
      mode = null;
    },
  };
}

/** The number of live subscribers (the tests read it to prove that nothing leaks). */
export function clockSubscribers(): number {
  return subs.size;
}
