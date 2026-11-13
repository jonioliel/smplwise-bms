/**
 * HEALTH-GO2RTC-2430: is the video service reachable? (`GET /api/v1/health/video`, every signed-in user.)
 *
 * Lab 11.11: the video service was stopped for two days; every live tile kept retrying on its own (about every 35 s, each refused) and
 * HA ingress turned the relay's 4503 into a plain close 1000, so no tile knew why. Now one shared watch per tab:
 * - a player that learns the service is down (the relay's error frame, or a close right after open checked here) calls `markDown()`
 *   and waits for `subscribe()` to report the recovery instead of retrying by itself;
 * - while down, this watch asks the server again on a backoff of 5 s doubling to 60 s (`backoffMs`); the server answers from its cache
 *   and probes the service itself at most once per its own backoff window, so many tiles and tabs never hammer anything;
 * - on recovery every waiting tile reconnects.
 */
import { get } from './client';

export type VideoServiceState = 'reachable' | 'unreachable' | 'not_configured' | 'unknown';

export interface VideoServiceView {
  state: VideoServiceState;
  configured: boolean;
  since: string | null;
  down_for_s: number | null;
  last_ok_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  failures: number;
  retry_in_s: number | null;
}

/** The one message every camera, live and playback screen shows while the service is down (no component name). */
export const VIDEO_SERVICE_DOWN_HE = 'שירות הווידאו לא זמין';
/** Administrators (system.configure) may see where to look. */
export const VIDEO_SERVICE_HINT_ADMIN = 'בדקו שהשירות פועל ואת הגדרת שירות הווידאו (go2rtc_url) בתצורת התוסף';
export const VIDEO_SERVICE_HINT_OTHER = 'ננסה שוב אוטומטית; אם זה נמשך, פנו למנהל המערכת';
/** The relay's error values that mean the service itself is down / absent (routers/media.refuse_media). */
export const MEDIA_DOWN_VALUES: ReadonlySet<string> = new Set(['media_unavailable', 'media_not_configured']);

export const BACKOFF_BASE_MS = 5000;
export const BACKOFF_MAX_MS = 60000;
/** The wait before the n-th re-check (0-based): 5 s, 10 s, 20 s, 40 s, 60 s, 60 s ... */
export const backoffMs = (n: number): number => Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(n, 10)));

/** A relay error frame that says the service is down: its value, or the server's own `media` state next to `upstream_unavailable`. */
export function frameSaysDown(msg: { type?: string; value?: string; media?: string }): boolean {
  if (msg.type !== 'error') return false;
  return MEDIA_DOWN_VALUES.has(msg.value ?? '') || msg.media === 'unreachable' || msg.media === 'not_configured';
}

export const isDownState = (s: VideoServiceState): boolean => s === 'unreachable' || s === 'not_configured';

type Listener = (down: boolean) => void;

export class VideoServiceWatch {
  down = false;
  state: VideoServiceState = 'unknown';
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  private inflight: Promise<VideoServiceState> | null = null;

  constructor(private fetchView: () => Promise<VideoServiceView> = () => get<VideoServiceView>('health/video')) {}

  /** Ask the server now (one request in flight per tab). A failed request reads as `unknown` - never as "down". */
  check(): Promise<VideoServiceState> {
    if (!this.inflight) {
      this.inflight = this.fetchView()
        .then((v) => v?.state ?? 'unknown')
        .catch((): VideoServiceState => 'unknown')
        .then((s) => {
          this.inflight = null;
          this.apply(s);
          return s;
        });
    }
    return this.inflight;
  }

  /** A player saw the service down (an error frame): no request needed, start the backoff watch. */
  markDown() {
    this.apply('unreachable');
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Tests. */
  reset() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.down = false;
    this.state = 'unknown';
    this.attempt = 0;
    this.inflight = null;
    this.listeners.clear();
  }

  private apply(s: VideoServiceState) {
    this.state = s;
    const down = isDownState(s);
    if (down) {
      const was = this.down;
      this.down = true;
      if (!was) this.attempt = 0;
      this.schedule();
      if (!was) this.emit(true);
      return;
    }
    if (s === 'unknown') {
      if (this.down) this.schedule(); // the check itself failed: keep watching on the same backoff
      return;
    }
    if (this.down) {
      this.down = false;
      this.attempt = 0;
      clearTimeout(this.timer);
      this.timer = undefined;
      this.emit(false);
    }
  }

  private schedule() {
    if (this.timer !== undefined) return;
    const delay = backoffMs(this.attempt);
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.check();
    }, delay);
  }

  private emit(down: boolean) {
    for (const fn of [...this.listeners]) {
      try {
        fn(down);
      } catch {
        /* a listener never breaks the watch */
      }
    }
  }
}

export const videoService = new VideoServiceWatch();
