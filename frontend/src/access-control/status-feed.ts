/**
 * CR-036 S10: the loader every card of the Settings page "בקרת כניסה" is built on - one read, one answer, in plain node so the unit
 * tests (tests/unit-access-status-feed.spec.ts) run it with a fake `fetch`:
 *  - one request at a time; a reload asked for while one is out is queued once (a "load more" asked for then is dropped);
 *  - a generation guard: an answer that comes back after `dispose()` or after a newer reload started is thrown away;
 *  - the last GOOD payload is kept across a failed or not-ready reload (the card marks it "not current" with when it was read);
 *  - a 403 means the caller has no view of this read at all (a station-scoped administrator on an installation-wide view): the
 *    payload is dropped and the card is absent, never greyed;
 *  - a paged read appends the next page over the server's own cursor (`merge` + `cursorOf`); a failed "more" keeps what is shown.
 * Reads that answer `ready` with a null payload are failures too (the server promises a payload only with `ready`).
 */
import { ApiError, describeError } from '../api/client';
import { panelKind, type PanelKind } from './status-logic';

/** What every typed reply carries that the loader reads. */
export interface Reply {
  state: string;
  last_error: string | null;
  fetched_at: string | null;
  fresh?: boolean;
}

export type Failure = PanelKind | 'network';

export interface ResourceSnap<T, R extends Reply> {
  /** The last good payload; kept across a failed reload, dropped by a 403. */
  data: T | null;
  /** The last reply of any state (the page's subtitle reads `sync` from it). */
  reply: R | null;
  /** When the payload was read by the server (`fetched_at`). */
  fetchedAt: string | null;
  /** The payload's own freshness: false = the server served its cache after the integration stopped answering. */
  fresh: boolean;
  busy: boolean;
  loadingMore: boolean;
  /** At least one answer (of any kind) has come back. */
  everAnswered: boolean;
  /** Why the LAST attempt gave no new payload; null after a good one. */
  failure: Failure | null;
  /** A sentence for a failure the server did not word (a network error, a 5xx). */
  message: string;
  /** A "load more" failed: the shown pages stay, the card offers to try again. */
  moreFailed: boolean;
}

export interface ResourceOptions<T, R extends Reply> {
  /** One read; `cursor` is null for the first page, else what `cursorOf` gave for the shown data. */
  fetch: (cursor: unknown) => Promise<R>;
  pick: (reply: R) => T | null;
  /** Paged reads: the next page appended to the shown one. */
  merge?: (shown: T, next: T) => T;
  /** Paged reads: the cursor of the next page, or null at the end. */
  cursorOf?: (data: T) => unknown;
  /** Called after every change of the snapshot. */
  onChange: () => void;
}

export class Resource<T, R extends Reply> {
  snap: ResourceSnap<T, R> = Resource.initial();
  private generation = 0;
  private inFlight: Promise<void> | null = null;
  private queued = false;
  private disposed = false;

  constructor(private readonly o: ResourceOptions<T, R>) {}

  static initial<T, R extends Reply>(): ResourceSnap<T, R> {
    return { data: null, reply: null, fetchedAt: null, fresh: true, busy: false, loadingMore: false, everAnswered: false, failure: null, message: '', moreFailed: false };
  }

  /** The shown payload is not the newest the server could give: a failed reload kept it, or the server served its cache. */
  get stale(): boolean {
    return this.snap.data !== null && (this.snap.failure !== null || !this.snap.fresh);
  }

  /** There is another page to ask for. */
  get hasMore(): boolean {
    const d = this.snap.data;
    return !!this.o.cursorOf && d !== null && this.o.cursorOf(d) !== null && this.o.cursorOf(d) !== undefined;
  }

  get disposedNow(): boolean {
    return this.disposed;
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
  }

  /** Reads page one (replaces what is shown when it succeeds). Single-flight: asked for while a read is out, it runs once more after. */
  reload(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.inFlight) {
      this.queued = true;
      return this.inFlight;
    }
    return this.run(false);
  }

  /** Reads the next page and appends it; dropped while another read is out or when there is no next page. */
  more(): Promise<void> {
    if (this.disposed || this.inFlight || !this.hasMore) return this.inFlight ?? Promise.resolve();
    return this.run(true);
  }

  private run(more: boolean): Promise<void> {
    const gen = ++this.generation;
    const cursor = more && this.snap.data !== null && this.o.cursorOf ? this.o.cursorOf(this.snap.data) : null;
    this.set({ busy: !more, loadingMore: more, moreFailed: false });
    const job = (async () => {
      try {
        const reply = await this.o.fetch(cursor);
        if (gen !== this.generation) return;
        this.accept(reply, more);
      } catch (err) {
        if (gen !== this.generation) return;
        this.fail(err, more);
      }
    })().finally(() => {
      this.inFlight = null;
      if (this.disposed) return;
      this.set({ busy: false, loadingMore: false });
      if (this.queued) {
        this.queued = false;
        void this.run(false);
      }
    });
    this.inFlight = job;
    return job;
  }

  private accept(reply: R, more: boolean): void {
    const payload = reply.state === 'ready' ? this.o.pick(reply) : null;
    if (payload === null) {
      const failure: Failure = panelKind(reply.state, reply.last_error);
      this.set({ reply, everAnswered: true, failure, message: '', moreFailed: more, ...(failure === 'forbidden' ? { data: null, fetchedAt: null } : {}) });
      return;
    }
    const shown = more && this.snap.data !== null && this.o.merge ? this.o.merge(this.snap.data, payload) : payload;
    this.set({ data: shown, reply, fetchedAt: reply.fetched_at, fresh: reply.fresh !== false, everAnswered: true, failure: null, message: '', moreFailed: false });
  }

  private fail(err: unknown, more: boolean): void {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        this.set({ data: null, fetchedAt: null, everAnswered: true, failure: 'forbidden', message: '', moreFailed: false });
        return;
      }
      const d = err.body.details as { state?: unknown; last_error?: unknown } | undefined;
      if (err.code === 'intercom_unavailable' && typeof d?.state === 'string') {
        this.set({ everAnswered: true, failure: panelKind(d.state, typeof d.last_error === 'string' ? d.last_error : null), message: '', moreFailed: more });
        return;
      }
      if (err.status === 429) {
        this.set({ everAnswered: true, failure: 'rate', message: '', moreFailed: more });
        return;
      }
      this.set({ everAnswered: true, failure: 'error', message: describeError(err), moreFailed: more });
      return;
    }
    this.set({ everAnswered: true, failure: err instanceof TypeError ? 'network' : 'error', message: describeError(err), moreFailed: more });
  }

  private set(patch: Partial<ResourceSnap<T, R>>): void {
    if (this.disposed) return;
    this.snap = { ...this.snap, ...patch };
    this.o.onChange();
  }
}
