/**
 * CR-036 S8: the paged, single-flight loader of the entry log - the behaviour WisKey's own activity screen has and the first
 * native screen ported (screens/wiskey-events.ts, CR-005 phase 1b), kept as a class of its own so it runs in node tests with a
 * fake `fetchPage`:
 *  - one load at a time; a reload asked for while one is out is queued once (a `reload` outranks a `notice`), "load more" is dropped;
 *  - a generation counter: an answer for filters no longer applied is thrown away;
 *  - page 1 replaces the rows; "load more" appends the next page over the server's opaque cursor, passed back unchanged;
 *  - a `notice` (a change notice from the integration, or the fallback poll) reloads page 1 only while page 1 is all that is shown -
 *    otherwise the reader keeps their place and is told (`pendingUpdate`); that is decided when the load RUNS, not when the notice comes;
 *  - an expired cursor (422 `intercom_cursor_expired`) keeps what is shown and offers a reload from the start;
 *  - a 403 means the caller has no entry-log permission anywhere: `forbidden`;
 *  - rows shown survive a failed or not-ready reload (the screen marks them stale).
 */
import { ApiError, describeError } from '../api/client';
import type { AccessEventFilters, AccessEventsPage, AccessEventsReply } from '../api/access-events';
import { appendPage } from './events-logic';

export type LoadMode = 'reload' | 'more' | 'notice';

export interface FeedSnapshot {
  /** The last answer (its state drives the page); null before the first one. */
  reply: AccessEventsReply | null;
  /** The rows shown (kept across a failed or not-ready reload). */
  page: AccessEventsPage | null;
  /** How many pages the shown rows are made of. */
  pages: number;
  /** When page 1 was fetched (the server's `fetched_at`). */
  shownAt: string | null;
  everReady: boolean;
  busy: boolean;
  loadingMore: boolean;
  cursorExpired: boolean;
  /** The integration reported a change while more than one page was loaded. */
  pendingUpdate: boolean;
  /** A request that did not come back at all (a network error): the text, '' when none. */
  error: string;
  forbidden: boolean;
}

export type FetchPage = (filters: AccessEventFilters, before: string | null) => Promise<AccessEventsReply>;

export class EventsFeed {
  private snapshot: FeedSnapshot = EventsFeed.initial();
  private applied: AccessEventFilters = {};
  private generation = 0;
  private queued: Exclude<LoadMode, 'more'> | null = null;
  private isDisposed = false;

  constructor(private readonly fetchPage: FetchPage, private readonly changed: () => void = () => undefined) {}

  static initial(): FeedSnapshot {
    return { reply: null, page: null, pages: 0, shownAt: null, everReady: false, busy: false, loadingMore: false, cursorExpired: false, pendingUpdate: false, error: '', forbidden: false };
  }

  get snap(): FeedSnapshot {
    return this.snapshot;
  }

  /** `dispose()` was called: this feed sends nothing more (a screen attached again makes a new one). */
  get disposed(): boolean {
    return this.isDisposed;
  }

  get filters(): AccessEventFilters {
    return this.applied;
  }

  /** The filters the NEXT load sends, without restarting: a relative period ("today") is recomputed before each reload, so a
   * screen left open past midnight does not keep yesterday's start. Rows shown are untouched. */
  setFilters(filters: AccessEventFilters): void {
    this.applied = filters;
  }

  /** The caller may not read the entry log at all: nothing is ever sent. */
  markForbidden(): void {
    this.snapshot = { ...this.snapshot, forbidden: true };
    this.changed();
  }

  /** A new filter set: whatever is in flight is for the old one (WisKey `cancelList`). */
  restart(filters: AccessEventFilters): Promise<void> {
    this.generation++;
    this.queued = null;
    this.applied = filters;
    this.snapshot = { ...this.snapshot, busy: false, loadingMore: false, page: null, pages: 0, shownAt: null, cursorExpired: false, pendingUpdate: false, error: '' };
    return this.load('reload');
  }

  /** The reader asked (or the filters changed): page 1, replacing the rows. */
  reload(): Promise<void> {
    return this.load('reload');
  }

  /** The integration said something changed, or the fallback poll ticked. */
  notice(): Promise<void> {
    return this.load('notice');
  }

  more(): Promise<void> {
    return this.load('more');
  }

  dispose(): void {
    this.isDisposed = true;
    this.generation++;
  }

  private set(patch: Partial<FeedSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.isDisposed) this.changed();
  }

  private async load(mode: LoadMode): Promise<void> {
    if (this.isDisposed || this.snapshot.forbidden) return;
    if (this.snapshot.busy) {
      if (mode === 'reload') this.queued = 'reload';
      else if (mode === 'notice' && !this.queued) this.queued = 'notice';
      return;
    }
    if (mode === 'notice' && this.snapshot.pages > 1) {
      this.set({ pendingUpdate: true });
      return;
    }
    const more = mode === 'more';
    const before = more ? this.snapshot.page?.next ?? null : null;
    if (more && !before) return;
    const generation = ++this.generation;
    this.set({ busy: true, loadingMore: more });
    try {
      const r = await this.fetchPage(this.applied, before);
      if (generation !== this.generation) return;
      const patch: Partial<FeedSnapshot> = { reply: r, error: '', cursorExpired: false };
      if (r.events) {
        patch.everReady = true;
        if (more && this.snapshot.page) {
          patch.page = appendPage(this.snapshot.page, r.events);
          patch.pages = this.snapshot.pages + 1;
        } else {
          patch.page = r.events;
          patch.pages = 1;
          patch.shownAt = r.fetched_at;
          patch.pendingUpdate = false;
        }
      }
      this.set(patch);
    } catch (err) {
      if (generation !== this.generation) return;
      if (err instanceof ApiError && err.status === 403) this.set({ forbidden: true });
      else if (err instanceof ApiError && err.code === 'intercom_cursor_expired') this.set({ cursorExpired: true });
      else this.set({ error: describeError(err) });
    } finally {
      if (generation === this.generation) {
        this.set({ busy: false, loadingMore: false });
        const queued = this.queued;
        if (queued) {
          this.queued = null;
          void this.load(queued);
        }
      }
    }
  }
}
