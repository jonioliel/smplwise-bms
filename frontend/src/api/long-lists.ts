import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LONG_LISTS, LONG_LISTS_DEFAULT, loadScreenDisplay, type LongLists } from './screen-display';

/**
 * PAGING-SETTING-2439 (owner round 32, Q-SYS-4 a + Q-SYS-5 a): a control screen never scrolls the page; a long list on it is split into
 * pages (`sw-pager`). The owner's note on Q-SYS-5: the system administrator can switch the long lists back to scrolling. The setting is
 * the installation's `ui.long_lists` (`paged`, the default | `scroll`; GET/PATCH /settings, system.configure), edited in
 * הגדרות › כללי › עיצוב הממשק.
 *
 * `scroll` never brings back a page that scrolls: every item of the list is drawn and the list's own panel scrolls (only an inner panel
 * may scroll, Q-SYS-4). Every paged list of a control screen reads the mode through this one module:
 *  - `LongListsController` (a Lit controller): `.paged`, the host's `data-long-lists="paged|scroll"` attribute for the screen's CSS
 *    (`:host([data-long-lists='scroll']) .region { overflow-y: auto }`), and a re-render when the setting changes;
 *  - `perPageFor(paged, perPage, total)`: the page size a list uses (all items on one page in `scroll`), so `pageCount`, `clampPage` and
 *    `pageSlice` of api/screen-display.ts need no second code path;
 *  - `PageFit` (components/page-fit.ts, the measured pages of a card region) takes the controller and draws every card in `scroll`.
 * `?long_lists=paged|scroll` in the address chooses for this page load only (the layout specs and a demo page; like `?fit=off`).
 */

let mode: LongLists = LONG_LISTS_DEFAULT;
let loading: Promise<LongLists> | null = null;
let loadedOnce = false;
const listeners = new Set<(m: LongLists) => void>();

export const isLongLists = (v: unknown): v is LongLists => (LONG_LISTS as readonly unknown[]).includes(v);

/** The mode in force now (the default until the settings were read once). */
export function longListsMode(): LongLists {
  return mode;
}

/** Set the mode (after the settings screen saved it, or when the settings were read); open screens re-render at once. */
export function setLongListsMode(v: unknown): void {
  const next = isLongLists(v) ? v : LONG_LISTS_DEFAULT;
  loadedOnce = true;
  if (next === mode) return;
  mode = next;
  for (const fn of [...listeners]) fn(mode);
}

/** Subscribe to changes of the mode; returns the unsubscribe. */
export function onLongLists(fn: (m: LongLists) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** `?long_lists=` in the address, when valid (null otherwise, and outside a browser). */
export function longListsFromUrl(search?: string): LongLists | null {
  try {
    const v = new URLSearchParams(search ?? location.search).get('long_lists');
    return isLongLists(v) ? v : null;
  } catch {
    return null;
  }
}

/** Read the setting once per page load (the shared settings cache); a failed read keeps the default (pages). */
export function ensureLongLists(force = false): Promise<LongLists> {
  if (loadedOnce && !force) return Promise.resolve(mode);
  const pinned = longListsFromUrl();
  if (pinned) {
    setLongListsMode(pinned);
    return Promise.resolve(mode);
  }
  if (!loading) {
    loading = loadScreenDisplay()
      .then((d) => {
        setLongListsMode(d.longLists);
        return mode;
      })
      .catch(() => mode)
      .finally(() => (loading = null));
  }
  return loading;
}

/** The page size a list uses: the screen's own (setting or measured fit) when paged, every item on one page when the lists scroll. */
export function perPageFor(paged: boolean, perPage: number, total: number): number {
  return paged ? Math.max(1, perPage) : Math.max(1, total, perPage);
}

/** The pages a list shows: one when the lists scroll. */
export const pagesFor = (paged: boolean, pages: number): number => (paged ? Math.max(1, pages) : 1);

/** Test hook: back to the state of a fresh page load. */
export function resetLongListsForTest(): void {
  mode = LONG_LISTS_DEFAULT;
  loading = null;
  loadedOnce = false;
  listeners.clear();
}

/**
 * The Lit side: `.paged` / `.mode`, the host attribute `data-long-lists`, a re-render on a change, and an optional `onChange` (a screen
 * resets its page number and its measured fit there).
 */
export class LongListsController implements ReactiveController {
  private stop: (() => void) | null = null;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private onChange?: (m: LongLists) => void,
  ) {
    host.addController(this);
  }

  get mode(): LongLists {
    return mode;
  }

  get paged(): boolean {
    return mode === 'paged';
  }

  private reflect() {
    if (this.host.getAttribute('data-long-lists') !== mode) this.host.setAttribute('data-long-lists', mode);
  }

  hostConnected() {
    this.reflect();
    this.stop = onLongLists((m) => {
      this.reflect();
      this.onChange?.(m);
      this.host.requestUpdate();
    });
    void ensureLongLists();
  }

  hostDisconnected() {
    this.stop?.();
    this.stop = null;
  }
}
