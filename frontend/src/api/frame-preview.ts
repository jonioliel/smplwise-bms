/**
 * PLAYBACK-SCRUB-2341 (docs/changes/PLAYBACK-SCRUB-2341.md): the timeline hover preview's picture loader.
 *
 * - De-duplication: requests are keyed by camera + 10-second bucket (the server's cache unit); a bucket that is cached, already
 *   loading or known to have no recording is never asked for again.
 * - Stale-request cancellation: at most `maxConcurrent` (2, the server's own grab limit) requests in flight and at most one waiting
 *   (the latest hover); when a new bucket is wanted and every slot is busy with buckets nobody looks at any more, the oldest one is
 *   aborted (AbortController) to make room. A finished stale request still fills the cache (the pointer often comes back).
 * - No blank holes: the state keeps the last good picture while the wanted one loads; `none` (404: no recording within 30 s) is the
 *   only "no picture" answer; a 503 (the recorder did not hand it over this time) keeps the last picture and is asked again next time.
 * - A small LRU of object URLs (revoked when evicted or on dispose).
 *
 * Pure apart from the injected fetch / object-URL functions: the unit spec drives it with fakes.
 */
export const FRAME_BUCKET_S = 10;

export type FrameAnswer = { ok: true; blob: Blob; at: string | null } | { ok: false; status: number };
export type FrameFetch = (url: string, signal: AbortSignal) => Promise<FrameAnswer>;

export interface PreviewState {
  /** The bucket the pointer is over now. */
  key: string | null;
  /** Object URL of the picture on show: the wanted one, or the last good one while it loads. */
  url: string | null;
  /** The recording instant of the picture on show (the server's X-Frame-At), when known. */
  at: string | null;
  /** True while the wanted bucket is loading. */
  loading: boolean;
  /** The wanted bucket has no recording within the search window (404). */
  none: boolean;
}

export interface FramePreviewOptions {
  fetchFrame: FrameFetch;
  onChange: (state: PreviewState) => void;
  maxConcurrent?: number;
  cacheSize?: number;
  makeUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
}

/** The bucket of a UTC instant, its key per camera and the instant the request asks for (the bucket start, so the HTTP cache helps). */
export function frameBucket(cameraId: string, at: Date): { key: string; atIso: string } {
  const ms = Math.floor(at.getTime() / (FRAME_BUCKET_S * 1000)) * FRAME_BUCKET_S * 1000;
  const atIso = new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { key: `${cameraId}|${atIso}`, atIso };
}

/** The real fetch: same-origin credentials like every API call; X-Frame-At carries the picture's own instant. */
export const fetchFrameHttp: FrameFetch = async (url, signal) => {
  const res = await fetch(url, { credentials: 'same-origin', signal });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, blob: await res.blob(), at: res.headers.get('X-Frame-At') };
};

interface Flight {
  key: string;
  ctrl: AbortController;
  started: number;
}

export class FramePreviewLoader {
  private readonly cache = new Map<string, { url: string; at: string | null }>();
  private readonly noRecording = new Set<string>();
  private readonly flights = new Map<string, Flight>();
  private waiting: { key: string; url: string } | null = null;
  private seq = 0;
  private readonly maxConcurrent: number;
  private readonly cacheSize: number;
  private readonly makeUrl: (blob: Blob) => string;
  private readonly revokeUrl: (url: string) => void;
  /** requests = fetches started; aborted = stale fetches cancelled; deduped = wants answered without a new fetch. */
  readonly stats = { requests: 0, aborted: 0, deduped: 0 };
  state: PreviewState = { key: null, url: null, at: null, loading: false, none: false };

  constructor(private readonly opts: FramePreviewOptions) {
    this.maxConcurrent = Math.max(1, opts.maxConcurrent ?? 2);
    this.cacheSize = Math.max(4, opts.cacheSize ?? 40);
    this.makeUrl = opts.makeUrl ?? ((b) => URL.createObjectURL(b));
    this.revokeUrl = opts.revokeUrl ?? ((u) => URL.revokeObjectURL(u));
  }

  /** The pointer is over `key` (frameBucket); `url` is the request for it. */
  want(key: string, url: string): void {
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key); // LRU: most recent last
      this.cache.set(key, hit);
      this.stats.deduped += 1;
      this.waiting = null;
      this.set({ key, url: hit.url, at: hit.at, loading: false, none: false });
      return;
    }
    if (this.noRecording.has(key)) {
      this.stats.deduped += 1;
      this.waiting = null;
      this.set({ key, url: this.state.url, at: this.state.at, loading: false, none: true });
      return;
    }
    this.set({ key, url: this.state.url, at: this.state.at, loading: true, none: false });
    if (this.flights.has(key)) {
      this.stats.deduped += 1;
      this.waiting = null; // the wanted one is already on its way
      return;
    }
    this.waiting = { key, url };
    this.pump();
  }

  /** The pointer left the timeline: nothing is wanted; in-flight fetches are aborted, the cache stays. */
  clear(): void {
    this.waiting = null;
    for (const f of this.flights.values()) {
      f.ctrl.abort();
      this.stats.aborted += 1;
    }
    this.flights.clear();
    this.set({ key: null, url: null, at: null, loading: false, none: false });
  }

  /** The camera changed or the screen went away: everything goes, object URLs are revoked. */
  dispose(): void {
    this.clear();
    for (const v of this.cache.values()) this.revokeUrl(v.url);
    this.cache.clear();
    this.noRecording.clear();
  }

  get inFlight(): number {
    return this.flights.size;
  }

  private set(next: PreviewState): void {
    this.state = next;
    this.opts.onChange(next);
  }

  private pump(): void {
    const w = this.waiting;
    if (!w) return;
    if (this.flights.size >= this.maxConcurrent) {
      // every slot is busy: abort the oldest fetch that is not for the wanted bucket (nobody looks at it any more)
      const stale = [...this.flights.values()].filter((f) => f.key !== this.state.key).sort((a, b) => a.started - b.started)[0];
      if (!stale) return; // the slots hold what is wanted: wait for them
      stale.ctrl.abort();
      this.flights.delete(stale.key);
      this.stats.aborted += 1;
    }
    this.waiting = null;
    const ctrl = new AbortController();
    const flight: Flight = { key: w.key, ctrl, started: ++this.seq };
    this.flights.set(w.key, flight);
    this.stats.requests += 1;
    this.opts
      .fetchFrame(w.url, ctrl.signal)
      .then((answer) => this.done(flight, answer))
      .catch(() => this.done(flight, null));
  }

  private done(flight: Flight, answer: FrameAnswer | null): void {
    const current = this.flights.get(flight.key) === flight;
    if (current) this.flights.delete(flight.key);
    if (flight.ctrl.signal.aborted) {
      this.pump();
      return;
    }
    if (answer && answer.ok) {
      const url = this.makeUrl(answer.blob);
      this.cache.set(flight.key, { url, at: answer.at });
      if (this.cache.size > this.cacheSize) {
        for (const [oldKey, old] of [...this.cache]) {
          if (this.cache.size <= this.cacheSize) break;
          if (old.url === this.state.url) continue; // never revoke the picture on show
          this.cache.delete(oldKey);
          this.revokeUrl(old.url);
        }
      }
      if (this.state.key === flight.key) this.set({ key: flight.key, url, at: answer.at, loading: false, none: false });
      else if (!this.state.url && this.state.key !== null) this.set({ ...this.state, url, at: answer.at }); // nothing on show yet: a near picture beats a hole
    } else if (answer && !answer.ok && answer.status === 404) {
      if (this.noRecording.size > 500) this.noRecording.clear();
      this.noRecording.add(flight.key);
      if (this.state.key === flight.key) this.set({ ...this.state, loading: false, none: true });
    } else if (this.state.key === flight.key) {
      this.set({ ...this.state, loading: false }); // 503 / network: keep the last picture; asked again on the next hover
    }
    this.pump();
  }
}
