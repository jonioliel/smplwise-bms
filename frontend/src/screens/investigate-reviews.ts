import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-drawer';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/frigate-review-card';
import '../components/frigate-review-detail';
import './investigate-events';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { productSettings } from '../api/prefs';
import { listCameras } from '../api/maps';
import { navigate } from '../router';
import {
  DEFAULT_FILTERS, LAYERS, LAYER_TEXT, PERIOD_TEXT, STATUS_TEXT, listReviews, markReviewed, objectLabel, playbackParams, reviewDetail,
  type ReviewDetail, type ReviewFilters, type ReviewItem, type ReviewLayer, type ReviewList, type ReviewPeriod, type ReviewStatus,
} from '../api/frigate';
import { REVIEW_ITEMS, reviewDetail as demoDetail, reviewList as demoList, FRIGATE_CAMERAS } from '../fixtures/frigate';
import { appendPage, applyReviewed, keyAction, moveFocus, nextReviewedValue, targetIds, toggleId, viewOf } from './reviews-logic';
import { he } from '../i18n/he';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/** The motion layer reads at most the last 24 h whatever the period says: the screen says so. */
const f_motionCap = (f: { layer: string; period: string }) => f.layer === 'motion' && (f.period === '7d' || f.period === '30d');

/** How often the list is re-read while the screen is open and visible (the push socket is a later phase: the study, F1 polling backfill). */
const POLL_MS = 30_000;
/** The answer of an installation without a Frigate recorder: the screen is the event windows. */
const UNAVAILABLE: ReviewList = { available: false, items: [], counts: { alert: 0, detection: 0, motion: -1 }, unreviewed: { alert: 0, detection: 0, motion: 0 }, facets: { objects: [] }, next_cursor: null };

/**
 * NN5-F1B: סקירה - the review screen of a Frigate recorder. One card per activity span (not one row per detection), three layers
 * (alerts / detections / motion), filters (camera, period, reviewed state, object), per-user "reviewed" with bulk marking and keys,
 * a drawer with the tracked-object timeline and "פתח הקלטה" through the existing recording screen.
 * An installation without a Frigate recorder (`available: false`) keeps the event windows exactly as before.
 * Without a backend (demo mode) it shows fixture items labelled as such. Data is read-only against Frigate; "reviewed" is Arx's own.
 */
@customElement('investigate-reviews')
export class InvestigateReviews extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** Route params, passed to the fallback event windows. */
  @property() cameraId = '';
  @property() date = '';

  @state() private filters: ReviewFilters = { ...DEFAULT_FILTERS };
  @state() private list: ReviewList | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private busy = false;
  @state() private moreBusy = false;
  @state() private cams: { id: string; name: string; recorder_id?: string }[] = [];
  @state() private tz = 'Asia/Jerusalem';
  @state() private selected: ReadonlySet<string> = new Set();
  @state() private focusIdx = -1;
  @state() private drawer: { item: ReviewItem; detail: ReviewDetail | null; loading: boolean } | null = null;
  @state() private notice = '';
  private demoItems: ReviewItem[] = REVIEW_ITEMS.map((i) => ({ ...i }));
  private timer = 0;
  private seq = 0;

  private get demo() {
    return !isApi();
  }
  /** The caller's own reviewed state: any reader may mark (the server needs events.read on the item). A motion span is not an item. */
  private get canReview() {
    return this.filters.layer !== 'motion';
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisible);
    this.timer = window.setInterval(() => this.poll(), POLL_MS);
    void this.init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.clearInterval(this.timer);
  }

  private async init() {
    if (this.demo) {
      this.cams = FRIGATE_CAMERAS.map((c) => ({ id: c.id, name: c.name }));
      await this.load();
      return;
    }
    try {
      const [settings, cams] = await Promise.all([productSettings(), listCameras()]);
      this.tz = settings['time.zone'] ?? 'Asia/Jerusalem';
      this.cams = cams.cameras.map((c) => ({ id: c.id, name: c.alias || c.name, recorder_id: c.recorder_id }));
    } catch {
      /* the filters still work without names: the review list carries the camera name */
    }
    await this.load();
  }

  private poll() {
    if (document.hidden || this.busy || this.drawer || this.selected.size || !this.list?.available) return;
    void this.load(true);
  }

  private onVisible = () => {
    if (!document.hidden && this.list?.available && !this.drawer) void this.load(true);
  };

  private async load(quiet = false) {
    const seq = ++this.seq;
    if (!quiet) this.busy = true;
    try {
      const list = this.demo ? demoList(this.demoItems, { layer: this.filters.layer, camera: this.filters.camera, object: this.filters.object, reviewed: this.filters.status === 'all' || this.filters.layer === 'motion' ? undefined : String(this.filters.status === 'reviewed') }) : await listReviews(this.filters);
      if (seq !== this.seq) return; // a newer request owns the screen
      this.list = list;
      this.error = '';
      this.forbidden = false;
      if (!quiet) {
        this.selected = new Set();
        this.focusIdx = -1;
      }
    } catch (err) {
      if (seq !== this.seq) return;
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else if (err instanceof ApiError && err.status === 404 && !this.list) this.list = UNAVAILABLE; // a server without the Frigate routes
      else this.error = describeError(err);
    } finally {
      if (seq === this.seq) this.busy = false;
    }
  }

  private async more() {
    if (!this.list?.next_cursor || this.moreBusy) return;
    this.moreBusy = true;
    try {
      this.list = appendPage(this.list, await listReviews(this.filters, this.list.next_cursor));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.moreBusy = false;
    }
  }

  private setFilter(patch: Partial<ReviewFilters>) {
    this.filters = { ...this.filters, ...patch };
    void this.load();
  }

  // ---- reviewed state ----

  private async mark(ids: string[], reviewed: boolean) {
    if (!this.list || !ids.length || !this.canReview) return;
    const before = this.list;
    this.notice = '';
    this.list = applyReviewed(this.list, ids, reviewed); // at once; the server answer only confirms
    if (this.drawer && ids.includes(this.drawer.item.id)) {
      const item = { ...this.drawer.item, reviewed };
      this.drawer = { ...this.drawer, item, detail: this.drawer.detail ? { ...this.drawer.detail, reviewed } : null };
    }
    try {
      if (this.demo) this.demoItems = this.demoItems.map((i) => (ids.includes(i.id) ? { ...i, reviewed } : i));
      else await markReviewed(before.items.filter((i) => ids.includes(i.id)), reviewed);
      this.selected = new Set();
    } catch {
      this.list = before;
      this.notice = he.frigate.review.markFailed;
    }
  }

  private markShown() {
    const ids = (this.list?.items ?? []).filter((i) => !i.reviewed).map((i) => i.id);
    void this.mark(ids, true);
  }

  // ---- keys ----

  private onKey = (e: KeyboardEvent) => {
    if (!this.list?.available) return;
    const act = keyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, target: e.target as Element | null, path: e.composedPath().map((n) => (n as Element).tagName?.toLowerCase() ?? '') });
    if (!act) return;
    const items = this.list.items;
    if (this.drawer) {
      if (act === 'escape') this.closeDrawer();
      else if (act === 'toggle-reviewed') {
        e.preventDefault();
        void this.mark([this.drawer.item.id], !this.drawer.item.reviewed);
      }
      return;
    }
    switch (act) {
      case 'next':
      case 'prev':
        e.preventDefault();
        this.focusIdx = moveFocus(this.focusIdx, act === 'next' ? 1 : -1, items.length);
        void this.updateComplete.then(() => this.renderRoot.querySelector('frigate-review-card[focused]')?.scrollIntoView({ block: 'nearest' }));
        break;
      case 'toggle-select':
        if (items[this.focusIdx] && this.canReview) {
          e.preventDefault();
          this.selected = toggleId(this.selected, items[this.focusIdx].id);
        }
        break;
      case 'toggle-reviewed': {
        const ids = targetIds(this.selected, items[this.focusIdx]?.id ?? null);
        if (ids.length) {
          e.preventDefault();
          void this.mark(ids, nextReviewedValue(items, ids));
        }
        break;
      }
      case 'open':
        if (items[this.focusIdx]) {
          e.preventDefault();
          void this.open(items[this.focusIdx]);
        }
        break;
      case 'select-all':
        if (this.canReview) {
          e.preventDefault();
          this.selected = new Set(items.map((i) => i.id));
        }
        break;
      case 'escape':
        this.selected = new Set();
        break;
    }
  };

  // ---- drawer ----

  private async open(item: ReviewItem) {
    this.drawer = { item, detail: null, loading: true };
    try {
      const detail = this.demo ? demoDetail(item.id, this.demoItems) : await reviewDetail(item);
      if (this.drawer?.item.id === item.id) this.drawer = { item: this.drawer.item, detail: detail ? { ...detail, reviewed: this.drawer.item.reviewed } : { ...item, tracked: [] }, loading: false };
    } catch {
      // the card's own facts still make a useful drawer: the timeline is just not there
      if (this.drawer?.item.id === item.id) this.drawer = { item: this.drawer.item, detail: { ...this.drawer.item, tracked: [] }, loading: false };
    }
  }

  private closeDrawer() {
    this.drawer = null;
  }

  private play() {
    if (this.drawer) navigate('/investigate/playback', playbackParams(this.drawer.item));
  }

  static styles = [css`
    :host {
      display: block;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      margin-block-end: var(--sw-s-3);
    }
    .layers {
      display: inline-flex;
      gap: var(--sw-s-1);
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      max-inline-size: 100%;
    }
    .layers button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: var(--sw-s-3);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
    }
    .layers button[aria-selected='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
    }
    .layers button:focus-visible,
    .linkbtn:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    .layers .n {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
    }
    .layers .new {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .layers [data-layer='detection'] .new {
      background: var(--sw-stale);
    }
    .layers [data-layer='motion'] .new {
      background: var(--sw-recorded);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      margin-block-end: var(--sw-s-3);
    }
    .bulk {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      padding: var(--sw-s-2) var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .banner {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .banner.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
      gap: var(--sw-s-3);
    }
    .foot {
      display: flex;
      justify-content: center;
      margin-block-start: var(--sw-s-4);
    }
    .keys {
      margin-block-start: var(--sw-s-4);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .linkbtn {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
      padding: 0;
    }
    .demo {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `, bubbleChrome];

  private dd(attr: string, label: string, value: string, items: { id: string; label: string }[], on: (id: string) => void) {
    return html`<sw-dropdown data-review-filter=${attr} .label=${label} .placeholder=${label} .value=${value} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => on(e.detail.id)}></sw-dropdown>`;
  }

  private toolbar(list: ReviewList) {
    const r = he.frigate.review;
    const f = this.filters;
    const mine = list.recorder_ids ? this.cams.filter((c) => !c.recorder_id || list.recorder_ids!.includes(c.recorder_id)) : this.cams;
    const cams = [{ id: '', label: r.allCameras }, ...mine.map((c) => ({ id: c.id, label: c.name }))];
    const objs = [{ id: '', label: r.allObjects }, ...list.facets.objects.map((o) => ({ id: o, label: objectLabel(o) }))];
    const periods = (Object.keys(PERIOD_TEXT) as ReviewPeriod[]).map((p) => ({ id: p, label: PERIOD_TEXT[p] }));
    const statuses = (Object.keys(STATUS_TEXT) as ReviewStatus[]).map((s) => ({ id: s, label: STATUS_TEXT[s] }));
    return html`
      <div class="bar">
        <div class="layers" role="tablist" aria-label=${r.title}>
          ${LAYERS.map((l: ReviewLayer) => html`<button type="button" role="tab" data-review-layer=${l} data-layer=${l} aria-selected=${String(f.layer === l)} @click=${() => this.setFilter({ layer: l })}>
            ${LAYER_TEXT[l].many}${list.counts[l] >= 0 ? html`<span class="n">${list.counts[l]}</span>` : nothing}${list.unreviewed[l] > 0 ? html`<span class="new" title=${`${list.unreviewed[l]} ${r.unreviewed}`} data-review-new=${l}></span>` : nothing}
          </button>`)}
        </div>
        ${this.canReview ? html`<sw-button size="sm" icon="check" data-review-mark-shown ?disabled=${!list.items.some((i) => !i.reviewed)} @click=${() => this.markShown()}>${r.markShown}</sw-button>` : nothing}
      </div>
      <div class="filters">
        ${this.dd('camera', r.camera, f.camera, cams, (id) => this.setFilter({ camera: id }))}
        ${this.dd('period', r.period, f.period, periods, (id) => this.setFilter({ period: id as ReviewPeriod }))}
        ${this.dd('status', r.status, f.status, statuses, (id) => this.setFilter({ status: id as ReviewStatus }))}
        ${list.facets.objects.length ? this.dd('object', r.object, f.object, objs, (id) => this.setFilter({ object: id })) : nothing}
      </div>`;
  }

  private body(list: ReviewList) {
    const r = he.frigate.review;
    const view = viewOf({ loading: this.busy, forbidden: this.forbidden, error: this.error, list, statusUnreviewed: this.filters.status === 'unreviewed' });
    const bulk = this.selected.size
      ? html`<div class="bulk" data-review-bulk role="status">
          <span>${this.selected.size} ${r.selected}</span>
          <sw-button size="sm" variant="primary" icon="check" data-review-bulk-mark @click=${() => void this.mark([...this.selected], nextReviewedValue(list.items, [...this.selected]))}>${r.markReviewed}</sw-button>
          <sw-button size="sm" variant="ghost" data-review-clear @click=${() => (this.selected = new Set())}>${r.clearSelection}</sw-button>
        </div>`
      : nothing;
    if (view === 'all-reviewed') return html`${bulk}<sw-state-panel state="empty" heading=${r.emptyAllReviewed} data-review-state="all-reviewed"></sw-state-panel>`;
    if (view === 'empty' || view === 'offline-empty') {
      return html`<sw-state-panel state=${view === 'offline-empty' ? 'stale' : 'empty'} heading=${view === 'offline-empty' ? r.offline : r.empty} hint=${view === 'offline-empty' ? '' : r.emptyHint} data-review-state=${view}></sw-state-panel>`;
    }
    return html`${bulk}
      <div class="grid" data-review-grid role="list">
        ${list.items.map(
          (it, i) => html`<frigate-review-card role="listitem" .item=${it} .tz=${this.tz} .canReview=${this.canReview} ?selected=${this.selected.has(it.id)} ?focused=${i === this.focusIdx}
            @review-open=${() => void this.open(it)} @review-select=${() => (this.selected = toggleId(this.selected, it.id))} @review-toggle=${() => void this.mark([it.id], !it.reviewed)}></frigate-review-card>`,
        )}
      </div>
      ${list.next_cursor ? html`<div class="foot"><sw-button data-review-more ?disabled=${this.moreBusy} @click=${() => this.more()}>${r.loadMore}</sw-button></div>` : nothing}`;
  }

  private drawerView() {
    const d = this.drawer;
    if (!d) return nothing;
    const r = he.frigate.review;
    return html`<sw-drawer open heading=${d.item.camera_name} subheading=${LAYER_TEXT[d.item.layer].one} data-review-drawer @close=${() => this.closeDrawer()}>
      ${d.loading || !d.detail
        ? html`<sw-state-panel state="loading" compact></sw-state-panel>`
        : html`<frigate-review-detail .detail=${d.detail} .tz=${this.tz} .canReview=${this.canReview} @review-play=${() => this.play()} @review-toggle=${() => void this.mark([d.item.id], !d.item.reviewed)}></frigate-review-detail>`}
      <span slot="footer" class="demo">${r.shortcutsText}</span>
    </sw-drawer>`;
  }

  render() {
    const r = he.frigate.review;
    if (this.forbidden) {
      return html`<sw-page heading=${r.title}><sw-state-panel state="forbidden" heading=${r.forbidden} hint=${r.forbiddenHint} data-review-state="forbidden"></sw-state-panel></sw-page>`;
    }
    // no Frigate recorder: the screen is the event windows, as before this feature existed
    if (this.list && !this.list.available) {
      return html`<investigate-events .initialMode=${'windows'} .cameraId=${this.cameraId} .date=${this.date}></investigate-events>`;
    }
    if (!this.list) {
      return html`<sw-page heading=${r.title} subheading=${r.subtitle}>${this.error
        ? html`<sw-state-panel state="error" heading=${r.error} hint=${this.error} actionLabel=${r.retry} data-review-state="error" @action=${() => this.load()}></sw-state-panel>`
        : html`<sw-state-panel state="loading" heading=${r.loading} data-review-state="loading"></sw-state-panel>`}</sw-page>`;
    }
    const list = this.list;
    return html`<sw-page heading=${r.title} subheading=${this.demo ? `${r.subtitle} · נתוני הדגמה` : r.subtitle} data-review-screen>
      ${list.stale ? html`<div class="banner" role="status" data-review-offline><sw-icon name="offline" size="16"></sw-icon>${r.offline}</div>` : nothing}
      ${this.error ? html`<div class="banner err" role="alert" data-review-error>${this.error} <button type="button" class="linkbtn" @click=${() => this.load()}>${r.retry}</button></div>` : nothing}
      ${this.notice ? html`<div class="banner err" role="alert" data-review-notice>${this.notice}</div>` : nothing}
      ${f_motionCap(this.filters) ? html`<div class="banner" data-review-motion-cap><sw-icon name="info" size="16"></sw-icon>${r.motionCap}</div>` : nothing}
      ${list.partial_coverage ? html`<div class="banner" data-review-partial><sw-icon name="info" size="16"></sw-icon>${r.partialCoverage}</div>` : nothing}
      ${this.toolbar(list)}
      ${this.body(list)}
      <div class="keys" data-review-keys><strong>${r.shortcuts}:</strong> ${r.shortcutsText}</div>
      ${this.drawerView()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'investigate-reviews': InvestigateReviews;
  }
}
