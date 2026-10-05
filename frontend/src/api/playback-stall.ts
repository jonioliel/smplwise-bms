/**
 * 2.0.0 playback stall detection and automatic resume (docs/changes/PLAYBACK-STALL-RESUME.md).
 *
 * Live measurement (CR-025 section 6.4): when the recording source stops (network drop, recorder stall) the player keeps
 * "playing" a frozen picture and says nothing; go2rtc reconnects to the source by itself, but not always within a minute,
 * while "resume from here" (a new generation of the same session at the same position) brought the picture back in about 9 s.
 *
 * A pure state machine, no timers and no DOM: the screen samples it every tick with its own clock (`now`, milliseconds) and
 * the media time of every tile it plays, and acts on the answer. Tests drive it with a fake clock.
 *
 *   ok ──(an armed track without progress for stallMs, or a lost connection)──▶ stalled
 *   stalled ──(progress again: go2rtc recovered by itself)──▶ ok
 *   stalled ──(grace / back-off elapsed, the screen is free)──▶ reconnecting  [answer: 'resume', attempts + 1]
 *   reconnecting ──(media progresses on the new generation)──▶ ok            [resumes + 1]
 *   reconnecting ──(request failed, lost connection, or no progress within attemptTimeoutMs)──▶ stalled (back-off) | gave_up
 *   gave_up ──(retry(): the operator's button)──▶ stalled, immediately due
 *   any ──(reset(): the operator seeks, changes camera or day, closes)──▶ ok, attempts 0
 *
 * Never loops: the attempt counter only returns to 0 after `stableMs` of continuous progress, so a source that drops again and
 * again ends in gave_up after `maxAttempts`, and a resume is only ever asked for while no request is in flight.
 * A track (one tile) is armed only after its media advanced once, so a slow first start (a cold go2rtc producer took 18 s) is
 * never a stall; a track whose media time goes backwards (a new generation started) is disarmed until it advances again.
 */

export type StallPhase = 'ok' | 'stalled' | 'reconnecting' | 'gave_up';
export type StallAnswer = 'none' | 'resume';

export interface StallOptions {
  /** No media progress for this long on an armed track = a stall. Installation setting `playback.stall_s` (default 5 s). */
  stallMs: number;
  /** Automatic attempts before gave_up. Installation setting `playback.auto_resume_attempts` (default 3; 0 = never resume by itself). */
  maxAttempts: number;
  /** "מתחבר מחדש" is shown at once; the first attempt waits this long, in case go2rtc recovers by itself. */
  graceMs?: number;
  /** Wait before attempt n+1 after attempt n failed (the last value repeats). */
  backoffMs?: number[];
  /** An attempt that has not produced progress this long after its request returned has failed. */
  attemptTimeoutMs?: number;
  /** Continuous progress this long after a recovery forgets the earlier attempts. */
  stableMs?: number;
  /** Media seconds that count as progress (slow motion at 0.25x advances 0.125 s per 500 ms tick). */
  epsilon?: number;
}

export interface StallTrack {
  /** The tile (camera id). */
  key: string;
  /** The media element's own clock, seconds since the generation started. */
  mediaTime: number;
  /** The player reports it is playing (not connecting, not ended, not failed). */
  playing: boolean;
}

export interface StallContext {
  /** The screen expects media to advance: a session is open, not paused by the operator, not being scrubbed. */
  expect: boolean;
  /** The screen may send a request now (no seek / start in flight). */
  canAct: boolean;
}

export const STALL_DEFAULTS = { stallS: 5, attempts: 3, graceMs: 2000, backoffMs: [3000, 6000], attemptTimeoutMs: 20000, stableMs: 30000, epsilon: 0.05 } as const;

interface TrackState {
  last: number;
  at: number;
  armed: boolean;
}

/** `playback.stall_s` / `playback.auto_resume_attempts` from the settings, clamped to what the server accepts. */
export function stallOptionsFromSettings(settings: Record<string, unknown>): StallOptions {
  const num = (v: unknown, def: number, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
  };
  return {
    stallMs: num(settings['playback.stall_s'], STALL_DEFAULTS.stallS, 2, 30) * 1000,
    maxAttempts: num(settings['playback.auto_resume_attempts'], STALL_DEFAULTS.attempts, 0, 5),
  };
}

export class StallWatch {
  phase: StallPhase = 'ok';
  /** Automatic attempts since the last stable stretch (or the last reset). */
  attempts = 0;
  /** Recoveries after an automatic or manual resume, since the last reset (diagnostics / tests). */
  resumes = 0;
  private readonly o: Required<StallOptions>;
  private tracks = new Map<string, TrackState>();
  private since = 0; // stalled: when the current wait started
  private wait = 0; // stalled: how long to wait before the next attempt
  private pending = false; // reconnecting: the resume request is in flight
  private sentAt = 0; // reconnecting: when the request returned
  private fault = false;
  private okSince = 0;

  constructor(opts: StallOptions) {
    this.o = {
      graceMs: STALL_DEFAULTS.graceMs,
      backoffMs: [...STALL_DEFAULTS.backoffMs],
      attemptTimeoutMs: STALL_DEFAULTS.attemptTimeoutMs,
      stableMs: STALL_DEFAULTS.stableMs,
      epsilon: STALL_DEFAULTS.epsilon,
      ...opts,
    };
  }

  get options(): Readonly<Required<StallOptions>> {
    return this.o;
  }

  /** The operator moved (seek, nudge, other camera or day, close): back to ok, nothing remembered. */
  reset(now: number): void {
    this.phase = 'ok';
    this.attempts = 0;
    this.resumes = 0;
    this.tracks.clear();
    this.pending = false;
    this.fault = false;
    this.okSince = now;
  }

  /** One tile restarts on purpose (a group member re-seeked alone): it is not a stall until its media advances again. */
  disarm(key: string, now: number): void {
    const t = this.tracks.get(key);
    if (t) {
      t.armed = false;
      t.at = now;
    }
  }

  /** The player lost its connection or ended in the middle of the range: no need to wait `stallMs` for the frozen picture. */
  lost(): void {
    this.fault = true;
  }

  /** The resume request returned: the new generation now has `attemptTimeoutMs` to show progress. */
  attemptSent(now: number): void {
    if (this.phase !== 'reconnecting') return;
    this.pending = false;
    this.sentAt = now;
    this.fault = false; // the old generation's socket closing is not a failure of the new one
    this.disarmAll(now);
  }

  /** The resume request failed (network, server, quota): count it and back off, or give up. */
  attemptFailed(now: number): void {
    if (this.phase !== 'reconnecting') return;
    this.failAttempt(now);
  }

  /** The operator's "נסה שוב" after gave_up: a fresh round of attempts, the first one due at once. */
  retry(now: number): void {
    this.attempts = 0;
    this.pending = false;
    this.fault = false;
    this.phase = 'stalled';
    this.since = now;
    this.wait = 0;
  }

  step(now: number, tracks: StallTrack[], ctx: StallContext): StallAnswer {
    const eps = this.o.epsilon;
    let progressed = false;
    let stuck = false;
    const seen = new Set<string>();
    for (const t of tracks) {
      seen.add(t.key);
      const rec = this.tracks.get(t.key);
      if (!rec) {
        this.tracks.set(t.key, { last: t.mediaTime, at: now, armed: false });
        continue;
      }
      if (!ctx.expect || !t.playing) {
        // paused, scrubbing, connecting, ended: not measured; it must advance again before it can stall
        rec.armed = false;
        rec.last = t.mediaTime;
        rec.at = now;
        continue;
      }
      if (t.mediaTime > rec.last + eps) {
        rec.armed = true;
        rec.last = t.mediaTime;
        rec.at = now;
        progressed = true;
      } else if (t.mediaTime < rec.last - eps) {
        rec.armed = false; // a new generation started from 0
        rec.last = t.mediaTime;
        rec.at = now;
      } else if (rec.armed && now - rec.at >= this.o.stallMs) {
        stuck = true;
      }
    }
    for (const key of [...this.tracks.keys()]) if (!seen.has(key)) this.tracks.delete(key);
    const fault = this.fault;
    this.fault = false;

    switch (this.phase) {
      case 'ok':
        if (!ctx.expect) return 'none';
        if (stuck || fault) {
          this.phase = 'stalled';
          this.since = now;
          this.wait = this.attempts === 0 ? this.o.graceMs : this.backoff(this.attempts);
          return this.dueAttempt(now, ctx);
        }
        if (this.attempts > 0 && progressed && now - this.okSince >= this.o.stableMs) this.attempts = 0;
        return 'none';
      case 'stalled':
        if (!ctx.expect) {
          // the operator paused during the wait: no automatic action; measured again once playing
          this.phase = 'ok';
          this.okSince = now;
          return 'none';
        }
        if (progressed && !stuck && !fault) {
          this.phase = 'ok'; // go2rtc brought the source back by itself
          this.okSince = now;
          return 'none';
        }
        return this.dueAttempt(now, ctx);
      case 'reconnecting':
        if (this.pending) return 'none';
        if (progressed && !stuck) {
          this.phase = 'ok';
          this.resumes += 1;
          this.okSince = now;
          return 'none';
        }
        if (fault || now - this.sentAt >= this.o.attemptTimeoutMs) {
          this.failAttempt(now);
          return this.phase === 'stalled' ? this.dueAttempt(now, ctx) : 'none';
        }
        return 'none';
      case 'gave_up':
      default:
        return 'none';
    }
  }

  private dueAttempt(now: number, ctx: StallContext): StallAnswer {
    if (this.attempts >= this.o.maxAttempts) {
      this.phase = 'gave_up';
      return 'none';
    }
    if (now - this.since < this.wait || !ctx.canAct) return 'none';
    this.phase = 'reconnecting';
    this.attempts += 1;
    this.pending = true;
    this.sentAt = now;
    return 'resume';
  }

  private failAttempt(now: number): void {
    this.pending = false;
    if (this.attempts >= this.o.maxAttempts) {
      this.phase = 'gave_up';
      return;
    }
    this.phase = 'stalled';
    this.since = now;
    this.wait = this.backoff(this.attempts);
  }

  private backoff(attempts: number): number {
    const b = this.o.backoffMs;
    return b.length ? b[Math.min(b.length - 1, Math.max(0, attempts - 1))] : 0;
  }

  private disarmAll(now: number): void {
    for (const t of this.tracks.values()) {
      t.armed = false;
      t.at = now;
    }
  }
}
