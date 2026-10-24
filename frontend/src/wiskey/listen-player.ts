/**
 * WKAUDIN-295: the browser's speaker for a listen session - Web Audio, one small scheduler. The frames of a station arrive every 20 ms; they
 * are scheduled back to back a little ahead of the clock (JITTER_S), and when the schedule has run more than MAX_LAG_S ahead (a slow tab, a
 * burst) the frame is DROPPED, never queued: latency stays bounded and old speech is never replayed. Nothing is recorded or kept.
 * The scheduling rule is a pure function (`schedule`), unit-tested without a browser (tests/unit-wkaudin-295.spec.ts).
 */
import type { ListenSink } from './listen-session';

export const JITTER_S = 0.06;
export const MAX_LAG_S = 0.3;

/** Where the next frame starts, or null to drop it. `now` is the audio clock, `nextAt` the end of what is already scheduled. */
export function schedule(now: number, nextAt: number): number | null {
  const start = Math.max(nextAt, now + JITTER_S);
  return start - now > MAX_LAG_S ? null : start;
}

interface AudioCtxLike {
  currentTime: number;
  destination: unknown;
  state: string;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): { gain: { value: number }; connect(to: unknown): void };
  createBuffer(channels: number, length: number, rate: number): { copyToChannel(data: Float32Array, ch: number): void; duration: number };
  createBufferSource(): { buffer: unknown; connect(to: unknown): void; start(at: number): void };
}

/** The real sink. Created inside the operator's click; returns null where the browser has no Web Audio. */
export function openSpeaker(): ListenSink | null {
  const Ctor = (globalThis as { AudioContext?: new () => AudioCtxLike }).AudioContext ?? (globalThis as { webkitAudioContext?: new () => AudioCtxLike }).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioCtxLike;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  void ctx.resume().catch(() => undefined);
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  let nextAt = 0;
  return {
    play(samples: Float32Array, sampleRate: number): void {
      const at = schedule(ctx.currentTime, nextAt);
      if (at === null) return;
      const buf = ctx.createBuffer(1, samples.length, sampleRate);
      buf.copyToChannel(samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start(at);
      nextAt = at + buf.duration;
    },
    setMuted(muted: boolean): void {
      gain.gain.value = muted ? 0 : 1;
    },
    close(): void {
      void ctx.close().catch(() => undefined);
    },
  };
}
