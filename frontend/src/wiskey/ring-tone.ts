/**
 * WISKEY-INBOUND-CALLS-2382: the incoming-call ring of the banner - a short two-note chime made with Web Audio (no audio file, no
 * network), repeated every RING_EVERY_MS while a ringing call is shown, for at most RING_MAX_MS. An ordinary in-page sound: never the
 * phone's critical, do-not-disturb-bypassing sound (a doorbell never qualifies for it).
 *
 * Browsers start audio only after the user touched the page once (autoplay policy). The context is created / resumed on the first
 * pointer or key press anywhere (`armRingTone`), so a call arriving later can ring; before that `blocked` is true and the banner says
 * so in one short line instead of ringing silently.
 */
export const RING_EVERY_MS = 3_000;
export const RING_MAX_MS = 45_000;

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let armed = false;

function context(): Ctx | null {
  if (ctx) return ctx;
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Listen once for the user's first gesture and unlock audio with it (idempotent). */
export function armRingTone(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const unlock = () => {
    const c = context();
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** True when a ring would not be heard now (no audio, or the page was not touched yet). */
export function ringBlocked(): boolean {
  const c = ctx;
  return !c || c.state !== 'running';
}

function chime(c: Ctx): void {
  const t0 = c.currentTime + 0.02;
  for (const [i, f] of [880, 660].entries()) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const start = t0 + i * 0.32;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + 0.32);
  }
}

/** A ringer: `set(true)` starts the repeating chime (once per call of `set(true)` after a `set(false)`), `set(false)` stops it. */
export class Ringer {
  private timer = 0;
  private startedAt = 0;
  on = false;

  constructor(private readonly now: () => number = () => Date.now()) {}

  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    window.clearInterval(this.timer);
    this.timer = 0;
    if (!on) return;
    this.startedAt = this.now();
    this.ring();
    this.timer = window.setInterval(() => this.ring(), RING_EVERY_MS);
  }

  private ring(): void {
    if (this.now() - this.startedAt > RING_MAX_MS) {
      window.clearInterval(this.timer);
      this.timer = 0;
      return;
    }
    const c = ctx;
    if (!c || c.state !== 'running') return;
    try {
      chime(c);
    } catch {
      /* audio unavailable: the banner is the signal */
    }
  }

  dispose(): void {
    this.set(false);
  }
}
