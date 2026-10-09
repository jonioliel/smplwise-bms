import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/frigate-review-card';
import '../components/frigate-review-detail';
import './investigate-events';
import { ApiError, describeError } from '../api/client';
import { canAnywhere, isApi } from '../api/session';
import { productSettings } from '../api/prefs';
import { listCameras } from '../api/maps';
import { navigate } from '../router';
import {
  DEFAULT_FILTERS, LAYERS, LAYER_TEXT, PERIOD_TEXT, STATUS_TEXT, listReviews, markReviewed, objectLabel, playbackParams, reviewDetail, spanText,
  type ReviewDetail, type ReviewFilters, type ReviewItem, type ReviewLayer, type ReviewList, type ReviewPeriod, type ReviewStatus,
} from '../api/frigate';
import { createExport, getFirstWrites, getPolicy, isFirstWriteRefusal, type FirstWrites } from '../api/frigate-control';
import { ROW_COLUMNS_CSS } from '../components/frigate-review-card';
import { REVIEW_ITEMS, reviewDetail as demoDetail, reviewList as demoList, FRIGATE_CAMERAS } from '../fixtures/frigate';
import { appendPage, applyReviewed, keyAction, moveFocus, nextReviewedValue, targetIds, toggleId, viewOf } from './reviews-logic';
import { fx, frigateLocale } from '../i18n/frigate-text';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/** The motion layer reads at most the last 24 h whatever the period says: the screen says so. */
const f_motionCap = (f: { layer: string; period: string }) => f.layer === 'motion' && (f.period === '7d' || f.period === '30d');

/** How often the list is re-read while the screen is open and visible (the push socket is a later phase: the study, F1 polling backfill). */
const POLL_MS = 30_000;
/** The answer of an installation without a Frigate recorder: the screen is the event windows. */
const UNAVAILABLE: ReviewList = { available: false, items: [], counts: { alert: 0, detection: 0, motion: -1 }, unreviewed: { alert: 0, detection: 0, motion: 0 }, facets: { objects: [] }, next_cursor: null };

type ViewMode = 'cards' | 'table';
const VIEW_KEY = 'sw.reviews.view';
const readView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
};

/** The export form of one review item: the name and the range follow the item; `supervised` only for the first write of a recorder. */
interface ExportDraft {
  item: ReviewItem;
  name: string;
  start: number;
  end: number;
  first: FirstWrites | null;
  supervised: boolean;
  busy: boolean;
  error: string;
}

/**
 * NN5-F1B / FRGD: סקירה - the review screen of a Frigate recorder. One card per activity span (not one row per detection), three layers
 * (alerts / detections / motion), filters (camera, period, reviewed state, object), cards or a table (the person's choice, remembered),
 * per-user "reviewed" with bulk marking and keys, a drawer with the facts, the tracked-object timeline, "פתח הקלטה" through the existing
 * recording screen and "ייצוא הקטע" when the caller may export now. An installation without a Frigate recorder (`available: false`)
 * keeps the event windows exactly as before. Without a backend (demo mode) it shows fixture items labelled as such.
 * Clean operator screen: no hints or paragraphs; the states are short chips; the keys live behind one help button.
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
  @state() private toast: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private view: ViewMode = readView();
  @state() private keysOpen = false;
  /** the recorders whose `exports` write class is on (read once the caller is known to hold the permissions) */
  @state() private exportOn: ReadonlySet<string> = new Set();
  @state() private exp: ExportDraft | null = null;
  private demoItems: ReviewItem[] = REVIEW_ITEMS.map((i) => ({ ...i }));
  private timer = 0;
  private seq = 0;
  private policyRead = new Set<string>();

  private get demo() {
    return !isApi();
  }
  /** The caller's own reviewed state: any reader may mark (the server needs events.read on the item). A motion span is not an item. */
  private get canReview() {
    return this.filters.layer !== 'motion';
  }
  /** The caller holds both permissions somewhere: the recorders' export class is then read, and the drawer offers the action per item. */
  private get mayExport() {
    return !this.demo && canAnywhere('analytics.exports') && canAnywhere('video.export');
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
    if (document.hidden || this.busy || this.drawer || this.selected.size || this.exp || !this.list?.available) return;
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
      void this.readExportPolicy(list.recorder_ids ?? []);
    } catch (err) {
      if (seq !== this.seq) return;
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else if (err instanceof ApiError && err.status === 404 && !this.list) this.list = UNAVAILABLE; // a server without the Frigate routes
      else this.error = describeError(err);
    } finally {
      if (seq === this.seq) this.busy = false;
    }
  }

  /** Which recorders may export now (the class switched on); read once per recorder and only for a caller who may export at all. */
  private async readExportPolicy(rids: string[]) {
    if (!this.mayExport) return;
    const fresh = rids.filter((r) => !this.policyRead.has(r));
    if (!fresh.length) return;
    for (const r of fresh) this.policyRead.add(r);
    await Promise.all(fresh.map(async (rid) => {
      try {
        const p = await getPolicy(rid);
        if (p.classes.some((c) => c.class === 'exports' && c.enabled)) this.exportOn = new Set([...this.exportOn, rid]);
      } catch {
        /* no permission to read the policy: the action is not offered */
      }
    }));
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

  private setView(v: ViewMode) {
    this.view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* a private window: the choice lives for this page */
    }
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.toast = { tone, text };
    window.setTimeout(() => {
      if (this.toast?.text === text) this.toast = null;
    }, 4000);
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
      this.notice = fx().review.markFailed;
    }
  }

  private markShown() {
    const ids = (this.list?.items ?? []).filter((i) => !i.reviewed).map((i) => i.id);
    void this.mark(ids, true);
  }

  // ---- keys ----

  private onKey = (e: KeyboardEvent) => {
    if (!this.list?.available || this.exp || this.keysOpen) return;
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

  // ---- export of one item (F2b exports class) ----

  private async openExport() {
    const it = this.drawer?.item;
    if (!it || !this.exportOn.has(it.recorder_id)) return;
    const start = Math.floor(Date.parse(it.start) / 1000);
    const end = it.end ? Math.ceil(Date.parse(it.end) / 1000) : Math.min(start + 60, Math.floor(Date.now() / 1000));
    const when = new Intl.DateTimeFormat(frigateLocale(), { timeZone: this.tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(it.start));
    this.exp = { item: it, name: `${it.camera_name} ${when}`.slice(0, 80), start, end: Math.max(end, start + 1), first: null, supervised: false, busy: false, error: '' };
    try {
      const first = await getFirstWrites(it.recorder_id);
      if (this.exp?.item.id === it.id) this.exp = { ...this.exp, first };
    } catch {
      /* an older server or no right to ask: the form has no supervision box */
    }
  }

  private async submitExport() {
    const x = this.exp;
    if (!x || x.busy || !x.name.trim()) return;
    this.exp = { ...x, busy: true, error: '' };
    try {
      const body = { camera_id: x.item.camera_id, start: x.start, end: x.end, name: x.name.trim(), ...(x.supervised ? { supervised: true } : {}) };
      const r = await createExport(x.item.recorder_id, body);
      this.exp = null;
      this.flash('ok', r.verified ? fx().review.exported : fx().control.unverified);
    } catch (err) {
      const text = isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : `${fx().review.exportFailed}: ${describeError(err)}`;
      this.exp = { ...x, busy: false, error: text };
    }
  }

  static styles = [css`
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .toolbar .grow {
      flex: 1 1 auto;
    }
    .layers {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      max-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .layers button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 34px;
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
    .seg button:focus-visible,
    .ib:focus-visible,
    .linkbtn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .layers .n {
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding: 0 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
    }
    .layers button[aria-selected='true'] .n {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .layers .new {
      inline-size: 7px;
      block-size: 7px;
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
      min-inline-size: 0;
    }
    /* the view switch and the help: a quiet segmented pair and one icon button */
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-inline-size: 36px;
      min-block-size: 34px;
      padding-inline: var(--sw-s-2);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
    }
    .ib {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 36px;
      block-size: 36px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .ib:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    /* state chips: short, inline, never a paragraph */
    .notes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px var(--sw-s-3) 3px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .note.info {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .bulk {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 268px), 1fr));
      gap: var(--sw-s-3);
    }
    /* the table view: one card, a header row, the items as rows */
    .tbl {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
      --rv-cols: ${ROW_COLUMNS_CSS};
    }
    .tbl .h {
      display: grid;
      grid-template-columns: var(--rv-cols);
      gap: var(--sw-s-2);
      align-items: center;
      padding: var(--sw-s-2) var(--sw-s-1);
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .tbl .h span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    .tbl .h .end {
      text-align: end;
    }
    @media (max-width: 899px) {
      .tbl .h {
        display: none;
      }
    }
    .foot {
      display: flex;
      justify-content: center;
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
    /* the keys dialog: a two-column list */
    .keys {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--sw-s-2) var(--sw-s-4);
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .keys dt {
      display: flex;
      gap: 4px;
    }
    .keys dd {
      margin: 0;
      color: var(--sw-text-2);
    }
    kbd {
      display: inline-block;
      min-inline-size: 1.6em;
      padding: 0 6px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      text-align: center;
      direction: ltr;
    }
    /* the export form */
    .form {
      display: grid;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .form label {
      display: grid;
      gap: 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .form input[type='text'] {
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-2) var(--sw-s-3);
      min-block-size: 36px;
      box-sizing: border-box;
      inline-size: 100%;
    }
    .form .range {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      color: var(--sw-text);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .form .sup {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      font-size: var(--sw-fs-xs);
    }
    .form .sup input {
      margin: 2px 0 0;
      accent-color: var(--sw-accent);
    }
    .form .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    @media (max-width: 767px) {
      .layers button {
        padding-inline: var(--sw-s-2);
      }
      .toolbar .txt {
        display: none;
      }
    }
  `, bubbleChrome];

  private dd(attr: string, label: string, value: string, items: { id: string; label: string }[], on: (id: string) => void) {
    return html`<sw-dropdown data-review-filter=${attr} .label=${label} .placeholder=${label} .value=${value} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => on(e.detail.id)}></sw-dropdown>`;
  }

  private toolbar(list: ReviewList) {
    const r = fx().review;
    const f = this.filters;
    const mine = list.recorder_ids ? this.cams.filter((c) => !c.recorder_id || list.recorder_ids!.includes(c.recorder_id)) : this.cams;
    const cams = [{ id: '', label: r.allCameras }, ...mine.map((c) => ({ id: c.id, label: c.name }))];
    const objs = [{ id: '', label: r.allObjects }, ...list.facets.objects.map((o) => ({ id: o, label: objectLabel(o) }))];
    const periods = (Object.keys(PERIOD_TEXT) as ReviewPeriod[]).map((p) => ({ id: p, label: PERIOD_TEXT[p] }));
    const statuses = (Object.keys(STATUS_TEXT) as ReviewStatus[]).map((s) => ({ id: s, label: STATUS_TEXT[s] }));
    return html`
      <div class="toolbar" data-review-toolbar>
        <div class="layers" role="tablist" aria-label=${r.title}>
          ${LAYERS.map((l: ReviewLayer) => html`<button type="button" role="tab" data-review-layer=${l} data-layer=${l} aria-selected=${String(f.layer === l)} @click=${() => this.setFilter({ layer: l })}>
            ${LAYER_TEXT[l].many}${list.counts[l] >= 0 ? html`<span class="n">${list.counts[l]}</span>` : nothing}${list.unreviewed[l] > 0 ? html`<span class="new" title=${`${list.unreviewed[l]} ${r.unreviewed}`} data-review-new=${l}></span>` : nothing}
          </button>`)}
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label=${r.view} data-review-view>
          <button type="button" aria-pressed=${String(this.view === 'cards')} title=${r.viewCards} aria-label=${r.viewCards} data-review-view-cards @click=${() => this.setView('cards')}><sw-icon name="grid" size="15"></sw-icon></button>
          <button type="button" aria-pressed=${String(this.view === 'table')} title=${r.viewTable} aria-label=${r.viewTable} data-review-view-table @click=${() => this.setView('table')}><sw-icon name="list" size="15"></sw-icon></button>
        </div>
        <button type="button" class="ib" title=${r.keysTitle} aria-label=${r.keysTitle} data-review-keys @click=${() => (this.keysOpen = true)}><sw-icon name="help" size="16"></sw-icon></button>
        ${this.canReview ? html`<sw-button size="sm" icon="check" data-review-mark-shown ?disabled=${!list.items.some((i) => !i.reviewed)} @click=${() => this.markShown()}>${r.markShown}</sw-button>` : nothing}
      </div>
      <div class="filters">
        ${this.dd('camera', r.camera, f.camera, cams, (id) => this.setFilter({ camera: id }))}
        ${this.dd('period', r.period, f.period, periods, (id) => this.setFilter({ period: id as ReviewPeriod }))}
        ${this.dd('status', r.status, f.status, statuses, (id) => this.setFilter({ status: id as ReviewStatus }))}
        ${list.facets.objects.length ? this.dd('object', r.object, f.object, objs, (id) => this.setFilter({ object: id })) : nothing}
      </div>`;
  }

  private notes(list: ReviewList) {
    const r = fx().review;
    const rows = [
      list.stale ? html`<span class="note" role="status" data-review-offline><sw-icon name="offline" size="13"></sw-icon>${r.offline}</span>` : nothing,
      this.error ? html`<span class="note err" role="alert" data-review-error>${this.error} <button type="button" class="linkbtn" @click=${() => this.load()}>${r.retry}</button></span>` : nothing,
      this.notice ? html`<span class="note err" role="alert" data-review-notice>${this.notice}</span>` : nothing,
      this.toast ? html`<span class=${`note ${this.toast.tone}`} role="status" data-review-toast>${this.toast.text}</span>` : nothing,
      f_motionCap(this.filters) ? html`<span class="note info" data-review-motion-cap><sw-icon name="clock" size="13"></sw-icon>${r.motionCap}</span>` : nothing,
      list.partial_coverage ? html`<span class="note info" data-review-partial><sw-icon name="info" size="13"></sw-icon>${r.partialCoverage}</span>` : nothing,
    ].filter((x) => x !== nothing);
    return rows.length ? html`<div class="notes">${rows}</div>` : nothing;
  }

  private items(list: ReviewList) {
    const r = fx().review;
    const card = (it: ReviewItem, i: number, variant: 'card' | 'row') => html`<frigate-review-card role=${variant === 'row' ? 'row' : 'listitem'} variant=${variant} .item=${it} .tz=${this.tz} .canReview=${this.canReview} ?selected=${this.selected.has(it.id)} ?focused=${i === this.focusIdx}
      @review-open=${() => void this.open(it)} @review-select=${() => (this.selected = toggleId(this.selected, it.id))} @review-toggle=${() => void this.mark([it.id], !it.reviewed)}></frigate-review-card>`;
    if (this.view === 'table') {
      return html`<div class="tbl" role="table" aria-label=${r.title} data-review-table>
        <div class="h" role="row"><span></span><span></span><span>${r.camera}</span><span>${r.time}</span><span>${r.duration}</span><span>${r.objects}</span><span>${r.zones}</span><span>${r.where}</span><span>${r.state}</span><span class="end">${r.actions}</span></div>
        ${list.items.map((it, i) => card(it, i, 'row'))}
      </div>`;
    }
    return html`<div class="grid" data-review-grid role="list">${list.items.map((it, i) => card(it, i, 'card'))}</div>`;
  }

  private body(list: ReviewList) {
    const r = fx().review;
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
      return html`<sw-state-panel state=${view === 'offline-empty' ? 'stale' : 'empty'} heading=${view === 'offline-empty' ? r.offline : r.empty} data-review-state=${view}></sw-state-panel>`;
    }
    return html`${bulk}
      ${this.items(list)}
      ${list.next_cursor ? html`<div class="foot"><sw-button data-review-more ?disabled=${this.moreBusy} @click=${() => this.more()}>${r.loadMore}</sw-button></div>` : nothing}`;
  }

  private drawerView() {
    const d = this.drawer;
    if (!d) return nothing;
    const canExport = this.mayExport && this.exportOn.has(d.item.recorder_id);
    return html`<sw-drawer modal open heading=${d.item.camera_name} subheading=${LAYER_TEXT[d.item.layer].one} data-review-drawer @close=${() => this.closeDrawer()}>
      ${d.loading || !d.detail
        ? html`<sw-state-panel state="loading" compact></sw-state-panel>`
        : html`<frigate-review-detail .detail=${d.detail} .tz=${this.tz} .canReview=${this.canReview} .canEvents=${!this.demo && canAnywhere('analytics.events')} .canExport=${canExport}
            @review-play=${() => this.play()} @review-toggle=${() => void this.mark([d.item.id], !d.item.reviewed)} @review-export=${() => void this.openExport()}></frigate-review-detail>`}
      ${this.exportDialog()}
    </sw-drawer>`;
  }

  private exportDialog() {
    const x = this.exp;
    if (!x) return nothing;
    const r = fx().review;
    const c = fx().control;
    const fmt = new Intl.DateTimeFormat(frigateLocale(), { timeZone: this.tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const needSup = !!x.first && x.first.can_supervise && !x.first.done.export_create;
    return html`<sw-dialog open heading=${r.exportTitle} subheading=${x.item.camera_name} data-review-export-dialog @close=${() => (this.exp = null)}>
      <div class="form">
        <label>${r.exportName}<input type="text" maxlength="80" data-review-export-name .value=${x.name} ?disabled=${x.busy} @input=${(e: Event) => (this.exp = { ...x, name: (e.target as HTMLInputElement).value })} /></label>
        <label>${r.exportRange}<span class="range" data-review-export-range>${fmt.format(new Date(x.start * 1000))} → ${fmt.format(new Date(x.end * 1000))} · ${spanText(new Date(x.start * 1000).toISOString(), new Date(x.end * 1000).toISOString())}</span></label>
        ${needSup ? html`<label class="sup"><input type="checkbox" data-review-export-supervised .checked=${x.supervised} @change=${(e: Event) => (this.exp = { ...x, supervised: (e.target as HTMLInputElement).checked })} /><span><b>${c.settings.supervised.label}</b> · ${c.settings.supervised.hint}</span></label>` : nothing}
        ${x.error ? html`<div class="err" role="alert" data-review-export-error>${x.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.exp = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="download" data-review-export-ok ?disabled=${x.busy || !x.name.trim() || (needSup && !x.supervised)} @click=${() => void this.submitExport()}>${r.exportClip}</sw-button>
    </sw-dialog>`;
  }

  private keysDialog() {
    if (!this.keysOpen) return nothing;
    const r = fx().review;
    const k = r.keyRows;
    return html`<sw-dialog open heading=${r.keysTitle} data-review-keys-dialog @close=${() => (this.keysOpen = false)}>
      <dl class="keys">
        <dt><kbd>↑</kbd><kbd>↓</kbd><kbd>J</kbd><kbd>K</kbd></dt><dd>${k.move}</dd>
        <dt><kbd>Space</kbd><kbd>X</kbd></dt><dd>${k.select}</dd>
        <dt><kbd>R</kbd></dt><dd>${k.reviewed}</dd>
        <dt><kbd>Enter</kbd></dt><dd>${k.open}</dd>
        <dt><kbd>Ctrl</kbd>+<kbd>A</kbd></dt><dd>${k.all}</dd>
        <dt><kbd>Esc</kbd></dt><dd>${k.esc}</dd>
      </dl>
    </sw-dialog>`;
  }

  render() {
    const r = fx().review;
    if (this.forbidden) {
      return html`<sw-page heading=${r.title}><sw-state-panel state="forbidden" heading=${r.forbidden} hint=${r.forbiddenHint} data-review-state="forbidden"></sw-state-panel></sw-page>`;
    }
    // no Frigate recorder: the screen is the event windows, as before this feature existed
    if (this.list && !this.list.available) {
      return html`<investigate-events .initialMode=${'windows'} .cameraId=${this.cameraId} .date=${this.date}></investigate-events>`;
    }
    if (!this.list) {
      return html`<sw-page heading=${r.title}>${this.error
        ? html`<sw-state-panel state="error" heading=${r.error} hint=${this.error} actionLabel=${r.retry} data-review-state="error" @action=${() => this.load()}></sw-state-panel>`
        : html`<sw-state-panel state="loading" heading=${r.loading} data-review-state="loading"></sw-state-panel>`}</sw-page>`;
    }
    const list = this.list;
    return html`<sw-page heading=${r.title} subheading=${this.demo ? r.demo : ''} data-review-screen>
      ${this.toolbar(list)}
      ${this.notes(list)}
      ${this.body(list)}
      ${this.drawerView()}
      ${this.keysDialog()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'investigate-reviews': InvestigateReviews;
  }
}
