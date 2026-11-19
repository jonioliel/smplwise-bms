import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-page';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-dropdown';
import '../components/sw-schedule-bar';
import '../components/sw-pager';
import { PAGE_SIZE_DEFAULT, clampPage, fittedPageSize, loadScreenDisplay, measureFitItems, pageCount, pageSlice } from '../api/screen-display';
import { LongListsController, perPageFor } from '../api/long-lists';
import { pl } from '../i18n/polish';
import './schedule-drawer';
import type { ScheduleActions } from './schedule-drawer';
import type { DropdownItem } from '../components/sw-dropdown';
import { aIcon, type AutomationIconName } from '../components/automation-icons';
import { measureHeaderBar } from '../styles/media-page';
import { KeyedMemo, NewestApplied, SingleFlight } from './editor-guards';
import { ApiError } from '../api/client';
import { isApi } from '../api/session';
import { autoApi, autoReady } from '../api/automations-demo';
import { applyAutomationsGlass } from '../styles/glass';
import { visibleKinds } from '../api/automations';
import type { ItemKind } from '../api/automations';
import { SEGMENTS, itemPath } from './automations-logic';
import type { KavarnitSegments } from '../shell/nav';
import { bidi } from '../i18n/bidi';
import { tr } from '../i18n/msg/devices';
import { onRouteChange, parseRoute, navigate, pushRoute, replaceRoute, type RouteState } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import { DEMO_SUN } from '../api/schedules-mock';
import {
  ACKABLE_ISSUES,
  DAY_ORDER,
  DAY_SHORT,
  REVIEW_LABEL,
  STATE_LABEL,
  acknowledgeScheduleIssue,
  bulkSchedules,
  getSchedule,
  getScheduleReview,
  getScheduleStatus,
  listSchedules,
  listTrash,
  purgeTrash,
  restoreFromTrash,
  subscribeSchedules,
  type AckableIssue,
  type DayId,
  type ReviewItem,
  type Schedule,
  type ScheduleStatus,
  type TrashItem,
} from '../api/schedules';
import {
  NO_FILTERS,
  STATE_SEGMENTS,
  activeFilterCount,
  conditionOptions,
  deletedText,
  devicesLine,
  extraFilterCount,
  filterSchedules,
  filtersToParams,
  groupSchedules,
  keptText,
  nextRunText,
  parseFilters,
  parseView,
  periodLabel,
  placeOptions,
  screenState,
  slotChips,
  sortSchedules,
  stateCounts,
  tagOptions,
  togglable,
  upcomingToday,
  windowText,
  STALE_TEXT,
  type ListFilters,
  type ListGroup,
  type ListSort,
  type ListView,
  type StateFilter,
  scheduleErrorText,
} from './schedules-logic';
import { toneColor } from '../components/sw-schedule-bar';
import { SkinController } from '../design/skin';
import { tablistKeydown } from '../components/a11y-keys';
import { readStoredJson, storedText, writeStoredJson } from '../api/safe-storage';
import { FrameCoalescer } from '../components/frame-coalescer';
import { devicesSchedulesStyles } from './devices-schedules-css';
import '../components/sw-toggle';
import { switchPress } from '../components/sw-toggle';

const VIEW_KEY = 'sw.schedules.view';
const FILTERS_KEY = 'sw.schedules.filters';
const BASE = '/devices/schedules';

interface Note {
  text: string;
  tone: 'ok' | 'error';
  action?: { label: string; run: () => void };
}

const VIEW_ICON: Record<ListView, AutomationIconName> = { rows: 'rows', cards: 'grid', table: 'list', week: 'calendar' };
const VIEW_LABEL: Record<ListView, () => string> = { rows: () => pl('rows'), cards: () => tr('כרטיסים'), table: () => tr('טבלה'), week: () => tr('שבוע') };
const VIEWS: ListView[] = ['rows', 'cards', 'table', 'week'];

/** POLISH-295: the minutes since local midnight of an instant, as a share of the day (the "today" timeline). */
function dayShare(d: Date): number {
  return Math.min(1, Math.max(0, (d.getHours() * 60 + d.getMinutes()) / 1440));
}

/** CR-EDITORS-MEMO-2440: state that changes no size or position the header bar / the fit measurement reads (a popover menu, the toast, disabled buttons). */
const NO_LAYOUT_STATE: ReadonlySet<string> = new Set(['menuFor', 'note', 'busy']);

/** The floor of a schedule's devices when they share one ("קומת קרקע"), else '' (the card's bold "where" word). */
function floorOf(s: Schedule): string {
  const floors = [...new Set(s.entities.map((e) => e.floor_name).filter((x): x is string => !!x))];
  return floors.length === 1 ? floors[0] : '';
}

/**
 * CR-014 "תזמונים", the first segment of "קברניט" (`#/devices/schedules`). Owner 2026-10-04: designed exactly like the automations
 * and scenes screens (docs/design/schedules-parity.md) - the same page frame and glass material (styles/media-page.ts +
 * styles/automations-glass.ts, light or dark by `devices.scheme`, the bubble skin through its knobs): a large title with the
 * floors as chips, the segment strip (תזמונים · אוטומציות · סצנות · סקריפטים), the state filter with counts, "סינון", the search and
 * "+ תזמון חדש"; cards of the automation card's shape (the whole card opens the drawer, the switch and the "⋯" menu on it), the
 * table and the week as further views, a bulk bar for a selection; the same state boxes, banners and toast. The trash is in the
 * user menu ("סל מחזור"), as on the automations screen; the administrator's review list opens from its banner.
 * Written only against the typed client (api/schedules.ts) - the server decides what is visible and what may change.
 * Filtering, sorting and grouping run in the browser over the visible list (docs/architecture/SCHEDULER_API.md §3.2).
 */
@customElement('devices-schedules')
export class DevicesSchedules extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** 0.1.154: the segments of "קברניט" this user is offered (set by the shell). This screen is the first segment; the strip leads to the others. */
  @property({ attribute: false }) kavarnit: KavarnitSegments = { schedules: true, automations: true };
  /** The kinds of the automations screen this user may open and their counts (null = not loaded / not offered). */
  @state() private autoKinds: ItemKind[] | null = null;
  @state() private autoCounts: Record<ItemKind, number> | null = null;
  @state() private status: ScheduleStatus | null = null;
  @state() private items: Schedule[] | null = null;
  @state() private failed = '';
  @state() private noView = false;
  @state() private filters: ListFilters = { ...NO_FILTERS };
  @state() private view: ListView = 'rows';
  /** POLISH-295: the view an address without one opens (ui.schedules_view, rows by default), and the rows per page (ui.page_size.*). */
  @state() private defaultView: ListView = 'rows';
  @state() private perPage = PAGE_SIZE_DEFAULT.schedules;
  @state() private page = 1;
  /** FIX2200: the schedules that fit the screen's height in the rows view (NOSCROLL-295: and the table and cards views; null: not measured). The page size setting stays the maximum;
   * a shorter window (1366x768, a tablet) takes fewer rows a page instead of scrolling (owner rule: control screens never scroll). */
  @state() private fitRows: number | null = null;
  /** PAGING-SETTING-2439 (owner round 32, Q-SYS-5): the installation's long-lists setting - pages (the default) or every item drawn, the
   * screen's own scroller scrolling (api/long-lists.ts). A change starts again at page 1 and measures the fit anew. */
  private lists = new LongListsController(this, () => {
    this.page = 1;
    this.fitRows = null;
  });
  /** POLISH-295: the selection boxes show only in selection mode (the user menu's "בחירה מרובה") or while something is picked. */
  @state() private selecting = false;
  @state() private filtersOpen = false;
  @state() private selected = new Set<string>();
  @state() private sub = '';
  @state() private detail: Schedule | null = null;
  @state() private detailMissing = false;
  @state() private drawerUsed = false;
  @state() private trash: TrashItem[] | null = null;
  @state() private review: ReviewItem[] | null = null;
  @state() private subError = '';
  @state() private note: Note | null = null;
  @state() private createOpen = false;
  @state() private busy = false;
  @state() private reviewSel = new Set<string>();
  @state() private menuFor = '';
  @state() private compactHeader = false;
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;

  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offRoute: (() => void) | null = null;
  private offEdit: (() => void) | null = null;
  private offSelect: (() => void) | null = null;
  private stopWs: (() => void) | null = null;
  private lastWritten = '';
  // CR-EDITORS-MEMO-2440 (06:RACE-6): one refresh round in flight and one waiting - a burst of pushes costs one extra round, and
  // rounds cannot land out of order; `recheck` of any caller that shares the waiting round is kept
  private readonly rounds = new SingleFlight<boolean>((recheck) => this.refreshRound(recheck), (a, b) => a || b);
  /** The open schedule is read by `onSub` and by every round: an older answer never lands on a newer one. */
  private readonly detailReads = new NewestApplied();
  // CR-EDITORS-MEMO-2440 (06:PERF-6): the filtered and the sorted list, once per list / filters (both are replaced, never edited in place)
  private readonly filteredMemo = new KeyedMemo<Schedule[]>();
  private readonly sortedMemo = new KeyedMemo<Schedule[]>();
  private urlTimer = 0;
  private noteTimer = 0;

  static styles = devicesSchedulesStyles;

  // ---------------------------------------------------------------------------- lifecycle

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    window.addEventListener('resize', this.onResize);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
    // the trash is in the user menu, as on the automations screen (screen-edit.ts)
    this.offEdit = registerScreenEdit({ id: 'schedules-trash', label: tr('סל מחזור'), icon: 'trash', can: () => screenState(this.status).kind === 'ready' && this.sub !== 'trash', run: () => this.go('trash') });
    const stored = readStoredJson<Partial<ListFilters>>(FILTERS_KEY);
    // POLISH-295: the choice is written as JSON (writeStoredJson); reading it raw never matched, so the browser's view was never remembered
    const storedView = parseView(readStoredJson<string>(VIEW_KEY)) ?? parseView(storedText(VIEW_KEY));
    const params = parseRoute().params;
    // the address carries the state (a link keeps it); without one, this browser's last choice
    this.filters = params.toString() ? parseFilters(params) : stored ? parseFilters(filtersToParams({ ...NO_FILTERS, ...stored })) : { ...NO_FILTERS };
    this.view = parseView(params.get('view')) ?? storedView ?? this.defaultView;
    // POLISH-295: the installation's default view (when neither the address nor this browser chose) and the rows per page
    const urlView = !!parseView(params.get('view'));
    void loadScreenDisplay().then((d) => {
      this.defaultView = d.schedulesView;
      this.perPage = d.pageSize.schedules;
      if (!urlView && !storedView) this.view = d.schedulesView;
    });
    this.offSelect = registerScreenEdit({ id: 'schedules-select', label: pl('select'), icon: 'check', can: () => screenState(this.status).kind === 'ready' && !this.sub && this.view !== 'week' && !this.selecting, run: () => (this.selecting = true) });
    this.filtersOpen = extraFilterCount(this.filters) > 0;
    this.offRoute = onRouteChange((r) => this.onRoute(r));
    void this.load();
    void this.loadSegments();
    this.stopWs = subscribeSchedules(() => void this.refresh());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    window.removeEventListener('resize', this.onResize);
    this.resizeFrame.cancel();
    this.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
    this.offRoute?.();
    this.offEdit?.();
    this.offSelect?.();
    this.stopWs?.();
    window.clearTimeout(this.urlTimer);
    window.clearTimeout(this.noteTimer);
  }

  /** PAGING-SETTING-2439: the list panel scrolls, not the screen (the lists scroll; the rows, table or cards views of the main list). */
  protected willUpdate() {
    this.toggleAttribute('data-list-panel', !this.lists.paged && this.view !== 'week' && this.sub !== 'trash' && this.sub !== 'review' && !!this.items?.length);
  }

  protected updated(changed: PropertyValues) {
    // CR-EDITORS-MEMO-2440 (06:PERF-6): the two measurements force a layout; an update that only opened a card's menu, showed a note
    // or flipped `busy` moved nothing they read. An update with no changed property (requestUpdate after a resize) still measures.
    if (!changed.size || [...changed.keys()].some((k) => !NO_LAYOUT_STATE.has(k as string))) {
      measureHeaderBar(this.renderRoot, this.phone);
      this.measureFit();
    }
    const t = this.renderRoot.querySelector<HTMLElement>('.toast[popover]');
    if (t) {
      try {
        if (!t.matches(':popover-open')) t.showPopover();
      } catch {
        /* no popover support: the note stays in the page */
      }
    }
  }

  /** FIX2200: how many schedules fit between the top of the list and the bottom of the screen, less the pager's band (measureFitItems).
   * NOSCROLL-295: the rows, the table and the cards views alike (a grid takes whole rows of cards); the ungrouped list only. */
  private measureFit(): void {
    const sel = this.view === 'rows' ? '[data-sched-rows]' : this.view === 'table' ? '[data-sched-table]' : this.view === 'cards' ? '[data-sched-grid]' : '';
    const list = sel && !this.filters.group && !this.sub && this.lists.paged ? this.renderRoot.querySelector<HTMLElement>(sel) : null;
    const fit = measureFitItems({ host: this, list, itemSelector: '[data-schedule]', pager: this.renderRoot.querySelector<HTMLElement>('[data-sched-pager]'), padded: [this.renderRoot.querySelector<HTMLElement>('.page')] });
    if (fit !== null && (this.fitRows === null || fit < this.fitRows)) this.fitRows = fit; // only ever smaller until a reset (no oscillation)
  }

  /** CR-FE-NITS-2442 (06:RESIZE-1): a run of window resize events restarts the fit once per animation frame (was once per event). */
  private resizeFrame = new FrameCoalescer(() => {
    this.fitRows = null;
    this.requestUpdate();
  });
  private onResize = this.resizeFrame.schedule;

  private onScroll = () => {
    const compact = this.scrollTop > 40;
    if (compact !== this.compactHeader) this.compactHeader = compact;
  };

  private onOutside = (e: PointerEvent) => {
    if (!this.menuFor) return;
    const card = this.renderRoot.querySelector(`[data-schedule="${CSS.escape(this.menuFor)}"]`);
    if (!card || !e.composedPath().includes(card)) this.menuFor = '';
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.menuFor && e.key === 'Escape') this.menuFor = '';
  };

  /** The other segments of "קברניט": which kinds the automations screen offers this caller, with their counts (best effort: no answer = only "אוטומציות"). */
  private async loadSegments() {
    if (!this.kavarnit.automations) return;
    try {
      await autoReady();
      const st = await autoApi().status();
      if (st.available === 'feature_disabled') return;
      this.autoKinds = visibleKinds(st);
      this.autoCounts = { automation: st.counts.automations, script: st.counts.scripts, scene: st.counts.scenes };
    } catch {
      this.autoKinds = null;
    }
  }

  // ---------------------------------------------------------------------------- routing

  private onRoute(r: RouteState) {
    if (r.segments[0] !== 'devices' || r.segments[1] !== 'schedules') return;
    const raw = r.segments[2] ?? '';
    const sub = raw === 'new' ? '' : decodeURIComponent(raw);
    const incoming = r.params.toString();
    if (incoming !== this.lastWritten && (incoming || this.lastWritten)) {
      this.filters = parseFilters(r.params);
      this.view = parseView(r.params.get('view')) ?? this.view;
      this.lastWritten = incoming;
    }
    if (sub !== this.sub) {
      this.sub = sub;
      this.menuFor = '';
      void this.onSub();
    }
  }

  private path(sub: string): string {
    return sub ? `${BASE}/${encodeURIComponent(sub)}` : BASE;
  }

  private params(): URLSearchParams {
    return filtersToParams(this.filters, this.view, this.defaultView);
  }

  /** Change the sub-route (the drawer, the trash, the review, or back to the list): a history entry. */
  private go(sub: string) {
    const p = this.params();
    this.lastWritten = p.toString();
    pushRoute(this.path(sub), p);
  }

  /** The filters into the address, without a history entry (and after a short pause while typing). */
  private syncUrl(delay = 0) {
    window.clearTimeout(this.urlTimer);
    this.urlTimer = window.setTimeout(() => {
      const p = this.params();
      this.lastWritten = p.toString();
      replaceRoute(this.path(this.sub), p);
      writeStoredJson(FILTERS_KEY, this.filters);
    }, delay);
  }

  private href(id: string): string {
    const q = this.params().toString();
    return `#${this.path(id)}${q ? `?${q}` : ''}`;
  }

  private async onSub() {
    const sub = this.sub;
    this.subError = '';
    if (sub === 'trash') return void this.loadTrash();
    if (sub === 'review') return void this.loadReview();
    if (!sub) {
      this.detail = null;
      this.detailMissing = false;
      return;
    }
    this.drawerUsed = true;
    this.detailMissing = false;
    this.detail = this.items?.find((s) => s.id === sub) ?? null;
    const land = this.detailReads.begin();
    try {
      const fresh = await getSchedule(sub);
      if (this.sub === sub && land()) this.detail = fresh;
    } catch (err) {
      if (this.sub === sub && err instanceof ApiError && err.status === 404) {
        this.detail = null;
        this.detailMissing = true;
      }
    }
  }

  // ---------------------------------------------------------------------------- data

  private demoLoading(): boolean {
    return !isApi() && parseRoute().params.get('state') === 'loading';
  }

  private async load() {
    if (this.demoLoading()) return;
    try {
      this.status = await getScheduleStatus();
    } catch (err) {
      // /schedules/status answers only holders of schedule.view: a refusal is "no permission", not a failure
      if (err instanceof ApiError && err.status === 403) this.noView = true;
      else this.failed = scheduleErrorText(err);
      return;
    }
    if (screenState(this.status).kind !== 'ready') {
      this.items = [];
      return;
    }
    await this.loadList();
    if (this.sub) void this.onSub();
  }

  private async loadList() {
    try {
      const r = await listSchedules({ limit: 500 });
      this.items = r.items;
      this.failed = '';
      this.selected = new Set([...this.selected].filter((id) => r.items.some((s) => s.id === id)));
    } catch (err) {
      if (this.items === null) this.failed = scheduleErrorText(err);
    }
  }

  /** The server says something changed (or a write finished): status, list and whatever is open, again. One round at a time; a call
   * made while a round runs waits for ONE further round that starts after it (so it reads what the caller just wrote). */
  private refresh(recheck = false): Promise<void> {
    return this.rounds.run(recheck);
  }

  private async refreshRound(recheck: boolean) {
    try {
      this.status = await getScheduleStatus(recheck);
    } catch {
      /* keep the last answer; the list below reports its own failure */
    }
    if (screenState(this.status).kind === 'ready') await this.loadList();
    if (this.sub === 'trash') await this.loadTrash();
    else if (this.sub === 'review') await this.loadReview();
    else if (this.sub) {
      // the person may open another schedule (or close the drawer) while this read is in flight: the answer is for `sub`
      const sub = this.sub;
      const land = this.detailReads.begin();
      try {
        const fresh = await getSchedule(sub);
        if (this.sub === sub && land()) this.detail = fresh;
      } catch {
        /* the detail keeps its last copy */
      }
    }
  }

  private async loadTrash() {
    try {
      this.trash = (await listTrash()).items;
      this.subError = '';
    } catch (err) {
      this.subError = scheduleErrorText(err);
    }
  }

  private async loadReview() {
    try {
      this.review = (await getScheduleReview()).items;
      this.subError = '';
    } catch (err) {
      this.subError = scheduleErrorText(err);
    }
  }

  // ---------------------------------------------------------------------------- feedback

  private say(text: string, tone: Note['tone'] = 'ok', action?: Note['action']) {
    window.clearTimeout(this.noteTimer);
    this.note = { text, tone, action };
    this.noteTimer = window.setTimeout(() => (this.note = null), action ? 10000 : 4000);
  }

  private get actionsHost(): ScheduleActions | null {
    return this.renderRoot.querySelector('schedule-actions');
  }

  // ---------------------------------------------------------------------------- events from the actions host and the drawer

  private onChanged = (e: CustomEvent<{ schedule: Schedule | null }>) => {
    const s = e.detail?.schedule;
    if (s) {
      this.items = (this.items ?? []).map((x) => (x.id === s.id ? { ...s, raw: undefined } : x));
      if (this.detail?.id === s.id) this.detail = s;
      void this.refreshStatusOnly();
    } else void this.refresh();
  };

  private async refreshStatusOnly() {
    try {
      this.status = await getScheduleStatus();
    } catch {
      /* keep */
    }
  }

  private onDeleted = (e: CustomEvent<{ trashId: string; name: string; scheduleId: string }>) => {
    const { trashId, name, scheduleId } = e.detail;
    this.items = (this.items ?? []).filter((s) => s.id !== scheduleId);
    if (this.sub === scheduleId) this.go('');
    void this.refreshStatusOnly();
    this.say(tr('"{name}" נמחק', { name }), 'ok', { label: tr('שחזור'), run: () => void this.restore(trashId) });
  };

  private onCopied = (e: CustomEvent<{ schedule: Schedule }>) => {
    void this.refresh();
    this.go(e.detail.schedule.id);
  };

  private onResult = (e: CustomEvent<{ text: string; tone: 'ok' | 'error' }>) => {
    this.say(e.detail.text, e.detail.tone);
  };

  private async restore(trashId: string, item?: TrashItem) {
    try {
      const r = await restoreFromTrash(trashId);
      this.say(tr('"{name}" שוחזר', { name: r.schedule.display_name }), 'ok', { label: tr('פתיחה'), run: () => this.go(r.schedule.id) });
      await this.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'lowering_confirmation_required' && item) {
        this.trashLowering = item;
        return;
      }
      this.say(scheduleErrorText(err), 'error');
      await this.refresh();
    }
  }

  /** A trashed schedule that opens or disarms something: confirmed through S4's dialog before it is re-created (§3.13). */
  @state() private trashLowering: TrashItem | null = null;

  private async confirmTrashLowering(e: CustomEvent<{ alarm_code: string | null }>) {
    const item = this.trashLowering;
    if (!item) return;
    e.stopPropagation();
    try {
      const r = await restoreFromTrash(item.trash_id, { confirm_lowering: true, alarm_code: e.detail?.alarm_code ?? null });
      this.trashLowering = null;
      this.say(tr('"{name}" שוחזר', { name: r.schedule.display_name }), 'ok', { label: tr('פתיחה'), run: () => this.go(r.schedule.id) });
      await this.refresh();
    } catch (err) {
      this.trashLowering = null;
      this.say(scheduleErrorText(err), 'error');
    }
  }

  // ---------------------------------------------------------------------------- actions

  private setFilter(patch: Partial<ListFilters>, delay = 0) {
    this.filters = { ...this.filters, ...patch };
    this.page = 1;
    this.syncUrl(delay);
  }

  private clearFilters() {
    this.filters = { ...NO_FILTERS, sort: this.filters.sort, group: this.filters.group };
    this.page = 1;
    this.syncUrl();
  }

  private setView(v: ListView) {
    this.view = v;
    this.page = 1;
    this.fitRows = null; // NOSCROLL-295: each view has its own item height
    writeStoredJson(VIEW_KEY, v);
    this.syncUrl();
  }

  private newSchedule() {
    if (customElements.get('schedule-create-dialog')) this.createOpen = true;
    else navigate(`${BASE}/new/edit`);
  }

  private toggleSel(id: string, on: boolean) {
    const next = new Set(this.selected);
    if (on) next.add(id);
    else next.delete(id);
    this.selected = next;
  }

  private async bulk(op: 'enable' | 'disable') {
    const picked = (this.items ?? []).filter((s) => this.selected.has(s.id));
    const eligible = togglable(picked).filter((s) => (op === 'disable' ? s.enabled : !s.enabled)).filter((s) => op === 'disable' || !s.lowering);
    const skippedLowering = op === 'enable' ? picked.filter((s) => s.lowering && !s.enabled).length : 0;
    if (!eligible.length) {
      this.say(skippedLowering ? tr('תזמונים שפותחים או מנטרלים מופעלים אחד־אחד') : tr('אין בבחירה תזמונים לשינוי'), 'error');
      return;
    }
    this.busy = true;
    try {
      const r = await bulkSchedules(op, eligible.map((s) => s.id));
      const ok = r.results.filter((x) => x.ok).length;
      const bad = r.results.length - ok;
      const done = op === 'enable' ? tr('הופעלו {n}', { n: ok }) : tr('הושבתו {n}', { n: ok });
      this.say(bad ? `${done}; ${tr('{n} לא שונו', { n: bad })}` : `${done}${skippedLowering ? `; ${tr('{n} מופעלים אחד־אחד', { n: skippedLowering })}` : ''}`, bad ? 'error' : 'ok');
      this.selected = new Set();
    } catch (err) {
      this.say(scheduleErrorText(err), 'error');
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  /** Acknowledge (or restore) one review warning: a system administrator's decision, bound by the server to the schedule's content. */
  private async ack(scheduleId: string, issue: AckableIssue, undo: boolean) {
    this.busy = true;
    try {
      await acknowledgeScheduleIssue(scheduleId, issue, undo);
      this.say(undo ? tr('האזהרה הוחזרה') : tr('סומן כתקין'));
    } catch (err) {
      this.say(scheduleErrorText(err), 'error');
    } finally {
      this.busy = false;
      // the round reads the review list itself while the review is open (it used to be read twice in a row)
      if (this.sub !== 'review') await this.loadReview();
      await this.refresh();
    }
  }

  private async bulkReview() {
    const picked = (this.review ?? []).map((r) => r.schedule).filter((s) => this.reviewSel.has(s.id) && s.enabled && s.can.toggle);
    if (!picked.length) return;
    this.busy = true;
    try {
      const r = await bulkSchedules('disable', picked.map((s) => s.id));
      const ok = r.results.filter((x) => x.ok).length;
      this.say(tr('הושבתו {n}', { n: ok }), ok === r.results.length ? 'ok' : 'error');
      this.reviewSel = new Set();
    } catch (err) {
      this.say(scheduleErrorText(err), 'error');
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  @state() private purging: TrashItem | null = null;

  private async doPurge() {
    const item = this.purging;
    if (!item) return;
    try {
      await purgeTrash(item.trash_id);
      this.purging = null;
      this.say(tr('"{name}" נמחק לצמיתות', { name: item.name || tr('תזמון ללא שם') }));
    } catch (err) {
      this.purging = null;
      this.say(scheduleErrorText(err), 'error');
    }
    await this.loadTrash();
  }

  private toggle(s: Schedule, on: boolean) {
    void this.actionsHost?.enable(s, on);
  }

  private menuAct(s: Schedule, action: 'run' | 'edit' | 'copy' | 'delete') {
    this.menuFor = '';
    if (action === 'run') this.actionsHost?.run(s);
    else if (action === 'edit') navigate(`${BASE}/${s.id}/edit`);
    else if (action === 'copy') this.actionsHost?.copy(s);
    else this.actionsHost?.askDelete(s);
  }

  // ---------------------------------------------------------------------------- render: the header (media-page.ts, as on the automations screen)

  private header(scr: ReturnType<typeof screenState>): TemplateResult | typeof nothing {
    const sub = this.sub;
    if (sub === 'trash' || sub === 'review') {
      return nothing; // the shared back control of sw-page (backHref) leads to the list
    }
    const all = this.items ?? [];
    const floors = placeOptions(all, 'floor');
    const f = this.filters;
    const tools = scr.kind === 'ready' && this.items !== null;
    const manage = !!this.status?.can.manage;
    const extra = extraFilterCount(f);
    const sc = stateCounts(all);
    // POLISH-295: "דורשים בדיקה" is a quiet chip beside the state filter (an administrator's), not a banner across the screen
    const attention = scr.admin ? this.status?.counts.attention ?? 0 : 0;
    const rooms = tools && floors.length ? html`<div class="rooms" role="group" aria-label=${tr('קומות')}>
          <button type="button" class="rc" aria-pressed=${String(!f.floor)} data-floor="" @click=${() => this.setFilter({ floor: '' })}>${tr('הכל')}</button>
          ${floors.map((x) => html`<button type="button" class="rc" aria-pressed=${String(f.floor === x.value)} data-floor=${x.value} @click=${() => this.setFilter({ floor: x.value })}>${bidi(x.label)}</button>`)}
        </div>` : nothing;
    return html`${!this.phone ? html`<div class="dh-row hdact" slot="actions">${rooms}${tools && all.length ? html`<div class="vwrap">${this.viewSwitch()}</div>` : nothing}</div>` : nothing}
    <header class="dh" data-sched-header>
      ${this.phone && rooms !== nothing ? html`<div class="dh-row fl">${rooms}</div>` : nothing}
      ${tools ? html`<div class="dh-det" data-sched-toolbar>
        ${this.renderSegments()}
        ${all.length ? html`<sw-segmented class="stf" radio size="sm" label=${tr('סינון לפי מצב')} ?data-open=${this.filtersOpen} value=${f.state} @change=${(e: CustomEvent<SegmentedChange>) => this.setFilter({ state: e.detail.value as StateFilter })}
          .options=${STATE_SEGMENTS.map((s) => ({ value: s.id, label: s.label, count: String(sc[s.id]), attrs: { 'data-state-filter': s.id || 'all' } }))}></sw-segmented>` : nothing}
        ${attention ? html`<button type="button" class="rc attn" data-open-review data-sched-attention @click=${() => this.go('review')}><i class="wdot" aria-hidden="true"></i>${pl('review')}<small>${attention}</small></button>` : nothing}
        ${all.length ? html`<button type="button" class="btn foldbtn" data-filters-toggle aria-label=${tr('סינון')} title=${tr('סינון')} aria-expanded=${String(this.filtersOpen)} @click=${() => (this.filtersOpen = !this.filtersOpen)}>${aIcon('filter')}<span class="lbl">${tr('סינון')}</span>${extra ? html`<small>${extra}</small>` : nothing}</button>` : nothing}
        <span class="grow"></span>
        ${all.length && this.phone ? html`<div class="vwrap">${this.viewSwitch()}</div>` : nothing}
        ${all.length ? html`<label class="search">${aIcon('search')}<span class="sr-only">${tr('חיפוש')}</span><input type="search" data-filter="q" placeholder=${this.phone ? tr('חיפוש') : tr('חיפוש תזמון, התקן או תג')} .value=${live(f.q)} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value }, 250)} /></label>` : nothing}
        ${manage ? html`<button type="button" class="btn primary newbtn" data-new-schedule ?disabled=${scr.readOnly} title=${scr.readOnly ? scr.readOnlyText : ''} @click=${() => this.newSchedule()}>${aIcon('plus')}<span class="lbl">${tr('חדש')}</span></button>` : nothing}
        ${all.length && this.filtersOpen ? this.renderMoreFilters(all) : nothing}
      </div>` : nothing}
    </header>`;
  }

  /** Cards · table · week: the view switch sits where the media pages keep their floor menu (the end of the title row). */
  private viewSwitch(): TemplateResult {
    // CR-CMP2-SEGMENTED-C-2450: sw-segmented with icon-only keys (each named by its label, which is also its tooltip)
    return html`<sw-segmented class="views" size="sm" labels="none" label=${tr('תצוגה')} value=${this.view} @change=${(e: CustomEvent<SegmentedChange>) => this.setView(e.detail.value as ListView)}
      .options=${VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v](), icon: aIcon(VIEW_ICON[v]), attrs: { 'data-view-btn': v } }))}></sw-segmented>`;
  }

  /** The strip of "קברניט": תזמונים (this screen) first, then the automations screen's segments. Shown only when there is a second segment to go to. */
  private renderSegments() {
    const others = this.kavarnit.automations ? SEGMENTS.filter((s) => (this.autoKinds ? this.autoKinds.includes(s.kind) : s.id === 'automations')) : [];
    if (!others.length) return nothing;
    const n = this.status?.counts.visible;
    return html`<div class="seg kinds" role="tablist" aria-label=${tr('קברניט')} data-kavarnit-segments @keydown=${tablistKeydown}>
      <button type="button" role="tab" aria-selected="true" data-segment="schedules">${tr('תזמונים')}${n === undefined ? nothing : html` <small>${n}</small>`}</button>
      ${others.map((s) => html`<button type="button" role="tab" aria-selected="false" data-segment=${s.id} @click=${() => navigate(itemPath(s.id))}>${s.label}${this.autoCounts ? html` <small>${this.autoCounts[s.kind]}</small>` : nothing}</button>`)}
    </div>`;
  }

  private dd(attr: string, label: string, value: string, items: DropdownItem[], on: (v: string) => void): TemplateResult {
    return html`<sw-dropdown data-filter=${attr} .label=${label} .placeholder=${label} .value=${value} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => on(e.detail.id)}></sw-dropdown>`;
  }

  /** "סינון": the area, the days, the conditions, the tags, grouping and sorting (chips and dropdown chips, never a paragraph). */
  private renderMoreFilters(items: Schedule[]): TemplateResult {
    const f = this.filters;
    const areas = placeOptions(items, 'area');
    const tags = tagOptions(items);
    const conds = conditionOptions(items);
    const sensor = this.status?.settings.shabbat_sensor ?? null;
    const anyPreset = items.some((s) => s.conditions.preset);
    const anyCond = items.some((s) => s.conditions.items.length);
    const opts = (all: string, list: { value: string; label: string }[]): DropdownItem[] => [{ id: '', label: all }, ...list.map((o) => ({ id: o.value, label: o.label }))];
    return html`<div class="more" data-sched-filters>
      ${areas.length > 1 ? this.dd('area', tr('כל האזורים'), f.area, opts(tr('כל האזורים'), areas), (v) => this.setFilter({ area: v })) : nothing}
      <span class="days" role="group" aria-label=${tr('ימים')}>${DAY_ORDER.map((d) => html`<button type="button" class="rc day" data-day-filter=${d} aria-pressed=${String(f.day === d)} aria-label=${tr('יום {day}', { day: DAY_SHORT[d] })} @click=${() => this.setFilter({ day: f.day === d ? '' : (d as DayId) })}>${DAY_SHORT[d]}</button>`)}</span>
      ${sensor || anyPreset ? html`<button type="button" class="rc" data-chip-preset="only_holy_days" aria-pressed=${String(f.preset === 'only_holy_days')} @click=${() => this.setFilter({ preset: f.preset === 'only_holy_days' ? '' : 'only_holy_days' })}>${tr('רק בשבת ובחג')}</button><button type="button" class="rc" data-chip-preset="not_holy_days" aria-pressed=${String(f.preset === 'not_holy_days')} @click=${() => this.setFilter({ preset: f.preset === 'not_holy_days' ? '' : 'not_holy_days' })}>${tr('לא בשבת ובחג')}</button>` : nothing}
      ${anyCond ? html`<button type="button" class="rc" data-chip-has-cond aria-pressed=${String(f.hasConditions)} @click=${() => this.setFilter({ hasConditions: !f.hasConditions })}>${tr('עם תנאי')}</button>` : nothing}
      ${conds.length > 1 ? this.dd('condition', tr('כל התנאים'), f.condition, opts(tr('כל התנאים'), conds), (v) => this.setFilter({ condition: v })) : nothing}
      ${tags.length ? html`<span class="sep" aria-hidden="true"></span>${tags.map((t) => html`<button type="button" class="rc" data-chip-tag=${t.value} aria-pressed=${String(f.tag === t.value)} @click=${() => this.setFilter({ tag: f.tag === t.value ? '' : t.value })}>${bidi(t.label)}</button>`)}` : nothing}
      <span class="sep" aria-hidden="true"></span>
      ${this.dd('group', tr('ללא קיבוץ'), f.group, [{ id: '', label: tr('ללא קיבוץ') }, { id: 'area', label: tr('לפי אזור') }, { id: 'floor', label: tr('לפי קומה') }, { id: 'tag', label: tr('לפי תג') }, { id: 'state', label: tr('לפי מצב') }], (v) => this.setFilter({ group: v as ListGroup }))}
      ${this.dd('sort', tr('מיון: הרצה הבאה'), f.sort, [{ id: 'next_run', label: tr('מיון: הרצה הבאה') }, { id: 'name', label: tr('מיון: שם') }, { id: 'order', label: tr('מיון: סדר ידני') }, { id: 'updated', label: tr('מיון: עודכן לאחרונה') }], (v) => this.setFilter({ sort: (v || 'next_run') as ListSort }))}
      ${activeFilterCount(f) ? html`<button type="button" class="btn sm quiet" data-clear-filters @click=${() => this.clearFilters()}>${tr('נקה סינון')}</button>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: states, banners

  private skeleton(): TemplateResult {
    const card = html`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:24px"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:28px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;
    return html`<div data-sched-state="loading" aria-busy="true"><div class="cgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
  }

  private stateBox(icon: AutomationIconName, title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-sched-state=${kind}><span class="ring">${aIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private bannerRow(st: ReturnType<typeof screenState>): TemplateResult | typeof nothing {
    // a viewer sees no banner (the automations screen does the same): the screen simply offers nothing to change. POLISH-295: the
    // review count moved to a chip of the header's filter row (clean operator screens: no banner for a to-do)
    const blocked = st.readOnly && !!this.status?.can.manage;
    if (!st.stale && !blocked) return nothing;
    return html`<div class="stack">
      ${st.stale ? html`<div class="banner warn" role="status" data-sched-stale>${aIcon('wifiOff')}<div>${STALE_TEXT}</div><button type="button" class="btn sm" data-banner-retry @click=${() => void this.refresh(true)}>${aIcon('refresh')}${tr('נסו שוב')}</button></div>` : nothing}
      ${blocked ? html`<div class="banner info" role="status" data-sched-readonly>${aIcon('lock')}<div>${st.readOnlyText}</div></div>` : nothing}
    </div>`;
  }

  /** POLISH-295: "today" as one 24-hour timeline - the past shaded, a line at now, a dot per run still to come today, and only the next
   * run named (a link into it); the dots are a picture of the day (their times are each one's tooltip). */
  private renderUpcoming(items: Schedule[]): TemplateResult | typeof nothing {
    const ups = upcomingToday(items, new Date(), 48);
    if (!ups.length) return nothing;
    const now = dayShare(new Date());
    const next = ups[0];
    const hours = [0, 6, 12, 18, 24];
    return html`<div class="upnext glass" data-sched-upnext role="group" aria-label=${tr('ההרצות הבאות היום')}>
      <b>${tr('היום')}</b>
      <div class="tl">
        <span class="track" aria-hidden="true"><span class="past" style=${`inline-size:${(now * 100).toFixed(2)}%`}></span></span>
        <span class="now" aria-hidden="true" style=${`left:${(now * 100).toFixed(2)}%`}></span>
        ${hours.map((h) => html`<span class=${`hr${h === 0 ? ' h0' : h === 24 ? ' h24' : ''}`} aria-hidden="true" style=${`left:${(h / 24) * 100}%`}>${String(h).padStart(2, '0')}</span>`)}
        ${ups.map((u) => html`<span class=${`tdot${u === next ? ' nx' : ''}`} aria-hidden="true" data-upcoming=${u.scheduleId} style=${`left:${(dayShare(new Date(u.at)) * 100).toFixed(2)}%;--c:${toneColor(u.tone)}`} title=${`${u.time} · ${u.name}${u.conditional ? ` · ${tr('בתנאי')}` : ''}`}></span>`)}
      </div>
      <a class="up" href=${this.href(next.scheduleId)} data-upcoming-next=${next.scheduleId}><time class="n">${next.time}</time><span class="nm">${bidi(next.name)}</span>${next.conditional ? html`<span class="what">· ${tr('בתנאי')}</span>` : nothing}</a>
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: the cards

  private stateChip(s: Schedule) {
    if (s.state === 'triggered') return html`<span class="chip ok" data-state-chip="triggered">${STATE_LABEL.triggered}</span>`;
    if (s.state === 'completed') return html`<span class="chip" data-state-chip="completed">${tr('הסתיים')}</span>`;
    if (s.enabled && s.state === 'unavailable') return html`<span class="chip" data-state-chip="unavailable">${STATE_LABEL.unavailable}</span>`;
    return nothing;
  }

  private switchOf(s: Schedule): TemplateResult {
    if (!s.can.toggle) return html`<span class=${`chip ${s.enabled ? 'ok' : ''}`} data-card-state>${s.enabled ? tr('פעיל') : tr('מושבת')}</span>`;
    return html`<sw-toggle .checked=${live(s.enabled)} label=${`${s.enabled ? tr('השבתה') : tr('הפעלה')} · ${s.display_name}`} labelHidden data-toggle=${s.id} ?disabled=${this.busy} @change=${switchPress(s.enabled, () => void this.toggle(s, !s.enabled))}></sw-toggle>`;
  }

  private menu(s: Schedule): TemplateResult {
    const row = (action: 'run' | 'edit' | 'copy' | 'delete', icon: AutomationIconName, label: string, show: boolean, cls = '') =>
      show ? html`<button type="button" role="menuitem" class=${cls} data-card-action=${action} @click=${() => this.menuAct(s, action)}>${aIcon(icon)}${label}</button>` : nothing;
    return html`<div class="pop" role="menu" aria-label=${`${tr('פעולות')} · ${s.display_name}`}>
      ${row('edit', 'edit', tr('עריכה'), s.can.edit)}
      ${row('run', 'play', tr('הרץ עכשיו'), s.can.run)}
      ${row('copy', 'copy', tr('שכפול'), s.can.copy)}
      ${s.can.delete ? html`<hr />` : nothing}
      ${row('delete', 'trash', tr('מחיקה'), s.can.delete, 'dz')}
    </div>`;
  }

  private renderCard(s: Schedule) {
    const period = periodLabel(s);
    const sun = isApi() ? null : DEMO_SUN;
    const floor = floorOf(s);
    const hasMenu = s.can.edit || s.can.run || s.can.copy || s.can.delete;
    const open = this.menuFor === s.id;
    return html`<article class=${`acard ${s.enabled ? 'on' : 'off'}`} data-schedule=${s.id} data-enabled=${s.enabled} ?data-picked=${this.selected.has(s.id)} ?data-menu=${open} aria-label=${s.display_name}>
      <header>
        <label class="pick" title=${tr('בחירה')}><input type="checkbox" data-select=${s.id} aria-label=${tr('בחירת {name}', { name: s.display_name })} .checked=${this.selected.has(s.id)} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} /></label>
        <div class="ttl">
          <h3><a class="name" href=${this.href(s.id)} data-card-open>${bidi(s.display_name)}</a></h3>
          <div class="where">${aIcon('layers')}${floor ? html`<b>${bidi(floor)}</b>` : nothing}<span class="ar">${bidi(devicesLine(s))}</span></div>
        </div>
        <div class="ctl">
          ${this.switchOf(s)}
          ${hasMenu ? html`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(open)} aria-label=${`${tr('עוד')} · ${s.display_name}`} data-card-menu @click=${() => (this.menuFor = open ? '' : s.id)}>${aIcon('dots')}</button>` : nothing}
        </div>
        ${open ? this.menu(s) : nothing}
      </header>
      <div class="bar"><sw-schedule-bar .slots=${s.slots} .sun=${sun}></sw-schedule-bar></div>
      <div class="meta">
        <sw-day-chips .days=${s.days} compact></sw-day-chips>
        ${period ? html`<span class="chip info" data-period>${aIcon('calendar')}${period}</span>` : nothing}
        <schedule-condition-chip .conditions=${s.conditions}></schedule-condition-chip>
        <sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>
        ${s.slots.some((sl) => sl.actions.some((a) => a.invalid)) ? html`<span class="chip warn" data-invalid title=${s.slots.flatMap((sl) => sl.actions).find((a) => a.invalid)?.invalid?.message ?? ''}>${aIcon('warning')}${tr('פעולה לא תקפה')}</span>` : nothing}
        ${s.slots.some((sl) => sl.actions.some((a) => a.blocked)) ? html`<span class="chip warn" data-script-blocked title=${s.slots.flatMap((sl) => sl.actions).find((a) => a.blocked)?.blocked?.message ?? ''}>${aIcon('lock')}${tr('סקריפט לא מאושר')}</span>` : nothing}
        ${this.stateChip(s)}
      </div>
      <footer>
        <span class="run" data-card-run><i class=${`dot ${s.enabled && s.next_run ? 'ok' : ''}`}></i>${tr('הרצה הבאה')} <b data-next-run>${nextRunText(s)}</b></span>
      </footer>
    </article>`;
  }

  // ---------------------------------------------------------------------------- render: the table

  private renderRow(s: Schedule) {
    const shown = s.slots.slice(0, 3);
    return html`<div class=${`tr${s.enabled ? '' : ' off'}`} data-schedule=${s.id} data-enabled=${s.enabled} ?data-picked=${this.selected.has(s.id)}>
      <span class="csel"><label class="pick"><input type="checkbox" data-select=${s.id} aria-label=${tr('בחירת {name}', { name: s.display_name })} .checked=${this.selected.has(s.id)} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} /></label></span>
      <span class="cname" style="min-inline-size:0"><a class="name" href=${this.href(s.id)}>${bidi(s.display_name)}</a><div class="sub">${bidi(devicesLine(s))}</div>${s.sensitive || s.lowering ? html`<sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>` : nothing}</span>
      <span class="cdays"><sw-day-chips .days=${s.days} compact></sw-day-chips></span>
      <span class="cslots slotrows">${shown.map((sl) => html`<span class="sr"><span class="w">${windowText(sl)}</span><span class="a">${slotChips(sl, s).map((c) => html`<span class="ac" style=${`--c:${toneColor(c.tone)}`} title=${c.devices.join(', ')}>${c.label}${c.devices.length > 1 ? ` · ${c.devices.length}` : ''}</span>`)}</span></span>`)}${s.slots.length > shown.length ? html`<button type="button" class="linkbtn" @click=${() => this.go(s.id)}>${tr('ועוד {n} משבצות', { n: s.slots.length - shown.length })}</button>` : nothing}</span>
      <span class="ccond"><schedule-condition-chip .conditions=${s.conditions} compact></schedule-condition-chip></span>
      <span class="cnext"><b data-next-run>${nextRunText(s)}</b></span>
      <span class="ctog">${this.switchOf(s)}</span>
      <span class="cops ops">${s.can.run ? html`<button type="button" class="rb sm" aria-label=${`${tr('הרץ עכשיו')} · ${s.display_name}`} title=${tr('הרץ עכשיו')} data-run=${s.id} @click=${() => this.actionsHost?.run(s)}>${aIcon('play')}</button>` : nothing}${s.can.edit ? html`<button type="button" class="rb sm" aria-label=${`${tr('עריכה')} · ${s.display_name}`} title=${tr('עריכה')} data-edit=${s.id} @click=${() => navigate(`${BASE}/${s.id}/edit`)}>${aIcon('edit')}</button>` : nothing}</span>
    </div>`;
  }

  private renderTable(rows: Schedule[]) {
    const all = rows.length > 0 && rows.every((s) => this.selected.has(s.id));
    return html`<div class="tbl glass" data-sched-table>
      <div class="tr h"><span><label class="pick"><input type="checkbox" aria-label=${tr('בחירת הכול')} data-select-all .checked=${all} @change=${(e: Event) => (this.selected = (e.target as HTMLInputElement).checked ? new Set([...this.selected, ...rows.map((s) => s.id)]) : new Set([...this.selected].filter((id) => !rows.some((s) => s.id === id))))} /></label></span><span>${tr('שם')}</span><span class="cdays">${tr('ימים')}</span><span>${tr('משעה')} · ${tr('פעולה')}</span><span>${tr('תנאי')}</span><span>${tr('הרצה הבאה')}</span><span>${tr('פעיל')}</span><span></span></div>
      ${repeat(rows, (s) => s.id, (s) => this.renderRow(s))}
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: the rows (POLISH-295)

  /** Why a row's next run is amber: a device that is not there, an action no longer valid, a script not approved. */
  private rowIssue(s: Schedule): string {
    if (s.enabled && s.state === 'unavailable') return STATE_LABEL.unavailable;
    if (s.slots.some((sl) => sl.actions.some((a) => a.invalid))) return tr('פעולה לא תקפה');
    if (s.slots.some((sl) => sl.actions.some((a) => a.blocked))) return tr('סקריפט לא מאושר');
    return '';
  }

  /** One schedule as a 54 px row (the approved preview): the switch, the name and where, the days as small letters, a thin 24-hour bar,
   * the next run (amber when something needs a look), the "⋯" menu. The selection box shows only in selection mode. */
  private renderSchedRow(s: Schedule, picking: boolean) {
    const floor = floorOf(s);
    const hasMenu = s.can.edit || s.can.run || s.can.copy || s.can.delete;
    const open = this.menuFor === s.id;
    const issue = this.rowIssue(s);
    const sun = isApi() ? null : DEMO_SUN;
    return html`<div class=${`lr${s.enabled ? '' : ' off'}`} role="row" data-schedule=${s.id} data-enabled=${s.enabled} ?data-picked=${this.selected.has(s.id)} ?data-menu=${open}>
      ${picking ? html`<span class="lsel" role="cell"><label class="pick" title=${tr('בחירה')}><input type="checkbox" data-select=${s.id} aria-label=${tr('בחירת {name}', { name: s.display_name })} .checked=${this.selected.has(s.id)} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} /></label></span>` : nothing}
      <span class="ltog" role="cell">${this.switchOf(s)}</span>
      <span class="lname" role="cell"><a class="name" href=${this.href(s.id)} data-row-open>${bidi(s.display_name)}</a><span class="sub">${floor ? html`<b>${bidi(floor)}</b> · ` : nothing}${bidi(devicesLine(s))}</span></span>
      <span class="ldays" role="cell"><sw-day-chips .days=${s.days} compact></sw-day-chips></span>
      <span class="lbar" role="cell"><sw-schedule-bar compact .slots=${s.slots} .sun=${sun}></sw-schedule-bar></span>
      <span class=${`lnext${issue ? ' warn' : ''}`} role="cell" data-row-next title=${issue}>${issue ? html`${aIcon('warning')}${issue}` : html`<i class=${`dot ${s.enabled && s.next_run ? 'ok' : ''}`}></i><b data-next-run>${nextRunText(s)}</b>`}</span>
      <span class="lops" role="cell">${hasMenu ? html`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(open)} aria-label=${`${tr('עוד')} · ${s.display_name}`} data-card-menu @click=${() => (this.menuFor = open ? '' : s.id)}>${aIcon('dots')}</button>` : nothing}${open ? this.menu(s) : nothing}</span>
    </div>`;
  }

  private renderRows(items: Schedule[]) {
    const picking = this.selecting || this.selected.size > 0;
    return html`<div class=${`rlist glass${picking ? ' picking' : ''}`} role="table" aria-label=${tr('תזמונים')} data-sched-rows>${repeat(items, (s) => s.id, (s) => this.renderSchedRow(s, picking))}</div>`;
  }

  private renderList(rows: Schedule[]) {
    if (this.view === 'week') {
      return html`<schedules-week-view .schedules=${rows} .sun=${isApi() ? null : DEMO_SUN} .snap=${this.status?.settings.snap_minutes ?? 15} @open-schedule=${(e: CustomEvent<{ id: string }>) => this.go(e.detail.id)}></schedules-week-view>`;
    }
    // POLISH-295: one page at a time (control screens never scroll): the sorted list is cut to the page, then grouped
    const sort = this.filters.sort;
    const sorted = this.sortedMemo.get([rows, sort], () => sortSchedules(rows, sort));
    const setting = this.phone ? this.perPage.phone : this.perPage.wide;
    // FIX2200 / NOSCROLL-295: the rows, table and cards views take no more than fit the screen's height (measureFit); the setting is the maximum
    // PAGING-SETTING-2439: the long lists scroll -> every schedule on one page (no pager)
    const per = perPageFor(this.lists.paged, !this.filters.group ? fittedPageSize(setting, this.fitRows) : setting, sorted.length);
    const pages = pageCount(sorted.length, per);
    const page = clampPage(this.page, sorted.length, per);
    const groups = groupSchedules(pageSlice(sorted, page, per), this.filters.group);
    const body = (items: Schedule[]) => (this.view === 'table' ? this.renderTable(items) : this.view === 'rows' ? this.renderRows(items) : html`<div class="cgrid" data-sched-grid>${repeat(items, (s) => s.id, (s) => this.renderCard(s))}</div>`);
    const pager = pages > 1 ? html`<div class="lfoot" data-sched-pager><sw-pager .page=${page} .pages=${pages} @page-change=${(e: CustomEvent<{ page: number }>) => { this.page = e.detail.page; this.menuFor = ''; }}></sw-pager></div>` : nothing;
    if (!this.filters.group) return html`<div class="groups"><section class="fsec group" data-group="">${body(groups[0]?.items ?? [])}</section>${pager}</div>`;
    return html`<div class="groups">${groups.map((g) => html`<section class="fsec group" data-group=${g.key}><header class="sh"><h2>${bidi(g.label)}</h2></header>${body(g.items)}</section>`)}${pager}</div>`;
  }

  private renderBulk() {
    const n = this.selected.size;
    if (this.selecting && !n && this.view !== 'week') {
      return html`<div class="editbar bulk" role="region" aria-label=${pl('select')} data-bulk-bar="empty"><span class="t">${aIcon('check')}${tr('{n} נבחרו', { n: 0 })}</span><span class="grow"></span><button type="button" class="btn sm quiet" data-select-done @click=${() => (this.selecting = false)}>${pl('selectDone')}</button></div>`;
    }
    if (!n || this.view === 'week') return nothing;
    const can = !!this.status?.can.manage && !!this.status?.writable;
    return html`<div class="editbar bulk" role="region" aria-label=${tr('פעולות על הבחירה')} data-bulk-bar>
      <span class="t">${aIcon('check')}${tr('{n} נבחרו', { n })}</span>
      <span class="grow"></span>
      ${can ? html`<button type="button" class="btn sm" data-bulk-enable ?disabled=${this.busy} @click=${() => void this.bulk('enable')}>${aIcon('play')}${tr('הפעלה')}</button><button type="button" class="btn sm" data-bulk-disable ?disabled=${this.busy} @click=${() => void this.bulk('disable')}>${aIcon('stop')}${tr('השבתה')}</button>` : nothing}
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${() => { this.selected = new Set(); this.selecting = false; }}>${tr('ביטול בחירה')}</button>
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: the sub-views

  private renderTrash() {
    if (this.subError) return this.stateBox('warning', this.subError, 'error', html`<button type="button" class="btn sm" data-sched-retry @click=${() => void this.loadTrash()}>${aIcon('refresh')}${tr('נסו שוב')}</button>`);
    if (this.trash === null) return this.skeleton();
    if (!this.trash.length) return this.stateBox('trash', tr('סל המחזור ריק'), 'trash-empty');
    const canPurge = !!this.status?.can.configure && !!this.status?.can.manage;
    return html`<div class="rows" data-sched-trash>${this.trash.map(
      (t) => html`<div class="li glass" data-trash-item=${t.trash_id}>
        <div><div class="t">${bidi(t.name || tr('תזמון ללא שם'))}</div><div class="d">${t.entities.map((e) => e.name).join(' · ')}</div><div class="d">${deletedText(t.deleted_at)}${t.deleted_by ? ` · ${t.deleted_by.display_name}` : ''} · ${keptText(t.expires_at)}</div></div>
        <div class="lops">${t.sensitive ? html`<sw-schedule-markers .sensitive=${true}></sw-schedule-markers>` : nothing}
          <button type="button" class="btn sm primary" data-restore=${t.trash_id} ?disabled=${!t.can_restore} title=${t.can_restore ? '' : tr('אין הרשאה לשחזר תזמון זה')} @click=${() => void this.restore(t.trash_id, t)}>${aIcon('restore')}${tr('שחזור')}</button>
          ${canPurge ? html`<button type="button" class="rb sm" aria-label=${tr('מחיקה לצמיתות')} title=${tr('מחיקה לצמיתות')} data-purge=${t.trash_id} @click=${() => (this.purging = t)}>${aIcon('trash')}</button>` : nothing}</div>
      </div>`,
    )}</div>`;
  }

  private renderReview() {
    if (this.subError) return this.stateBox('warning', this.subError, 'error', html`<button type="button" class="btn sm" data-sched-retry @click=${() => void this.loadReview()}>${aIcon('refresh')}${tr('נסו שוב')}</button>`);
    if (this.review === null) return this.skeleton();
    if (!this.review.length) return this.stateBox('check', tr('אין תזמונים הדורשים בדיקה'), 'review-empty');
    const n = this.reviewSel.size;
    const canAck = !!this.status?.can.acknowledge;
    return html`<div class="rows" data-sched-review>${this.review.map(
      (r) => html`<div class="li glass" data-review-item=${r.schedule.id}>
        <div style="display:flex;gap:10px;align-items:flex-start;min-inline-size:0">
          <label class="pick"><input type="checkbox" data-review-select=${r.schedule.id} aria-label=${tr('בחירת {name}', { name: r.schedule.display_name })} ?disabled=${!r.schedule.enabled || !r.schedule.can.toggle} .checked=${this.reviewSel.has(r.schedule.id)} @change=${(e: Event) => { const next = new Set(this.reviewSel); if ((e.target as HTMLInputElement).checked) next.add(r.schedule.id); else next.delete(r.schedule.id); this.reviewSel = next; }} /></label>
          <div style="min-inline-size:0"><div class="t"><a class="name" href=${this.href(r.schedule.id)}>${bidi(r.schedule.display_name)}</a></div><div class="d">${devicesLine(r.schedule)}${r.schedule.owner ? ` · ${r.schedule.owner.display_name}` : ''}</div>
          <div class="issues">${r.issues.map((i) => {
            const ackable = canAck && (ACKABLE_ISSUES as string[]).includes(i);
            return html`<span class="iss"><span class="chip warn" data-issue=${i}>${REVIEW_LABEL[i]}</span>${ackable ? html`<button type="button" class="linkbtn" data-ack=${i} ?disabled=${this.busy} @click=${() => void this.ack(r.schedule.id, i as AckableIssue, false)}>${tr('אשר כתקין')}</button>` : nothing}</span>`;
          })}${(r.acknowledged ?? []).map((a) => html`<span class="iss"><span class="chip acked" data-acked=${a.issue} title=${`${REVIEW_LABEL[a.issue]} · ${a.by?.display_name ? tr('אושר על ידי {name}', { name: a.by.display_name }) : tr('אושר')}`}>${aIcon('check')}${tr('אושר')}</span>${canAck ? html`<button type="button" class="linkbtn" data-unack=${a.issue} ?disabled=${this.busy} @click=${() => void this.ack(r.schedule.id, a.issue, true)}>${tr('בטל אישור')}</button>` : nothing}</span>`)}</div></div>
        </div>
        <div class="lops"><span class=${r.schedule.enabled ? 'chip ok' : 'chip'}>${r.schedule.enabled ? tr('פעיל') : tr('מושבת')}</span></div>
      </div>`,
    )}</div>
    ${n ? html`<div class="editbar bulk" data-bulk-bar="review"><span class="t">${aIcon('check')}${tr('{n} נבחרו', { n })}</span><span class="grow"></span><button type="button" class="btn sm" data-review-disable ?disabled=${this.busy} @click=${() => void this.bulkReview()}>${aIcon('stop')}${tr('השבתת הנבחרים')}</button></div>` : nothing}`;
  }

  // ---------------------------------------------------------------------------- render

  private renderReady(st: ReturnType<typeof screenState>) {
    const all = this.items ?? [];
    const filters = this.filters;
    const rows = this.filteredMemo.get([all, filters], () => filterSchedules(all, filters));
    const manage = !!this.status?.can.manage;
    let content: TemplateResult;
    if (!all.length) {
      content = this.stateBox('calendar', tr('אין עדיין תזמונים'), 'empty', manage && !st.readOnly ? html`<button type="button" class="btn primary" data-new-schedule @click=${() => this.newSchedule()}>${aIcon('plus')}${tr('תזמון חדש')}</button>` : undefined);
    } else if (!rows.length) {
      content = this.stateBox('search', tr('לא נמצאו תזמונים'), 'no-match', html`<button type="button" class="btn sm" data-clear-filters @click=${() => this.clearFilters()}>${tr('נקה סינון')}</button>`);
    } else {
      content = html`${this.view !== 'week' ? this.renderUpcoming(all) : nothing}${this.renderList(rows)}`;
    }
    return html`${this.bannerRow(st)}${content}${this.renderBulk()}`;
  }

  private renderBody(st: ReturnType<typeof screenState>) {
    const settings = st.admin ? html`<button type="button" class="btn sm" data-open-settings @click=${() => navigate('/system/schedules')}>${aIcon('settings')}${tr('הגדרות התזמונים')}</button>` : undefined;
    switch (st.kind) {
      case 'loading':
        return this.skeleton();
      case 'error':
        return this.stateBox('warning', tr('לא ניתן לטעון את הרשימה'), 'error', html`<button type="button" class="btn sm" data-sched-retry @click=${() => { this.failed = ''; this.items = null; void this.load(); }}>${aIcon('refresh')}${tr('נסו שוב')}</button>`);
      case 'no_view':
        return this.stateBox('lock', tr('אין הרשאה לצפות בתזמונים'), 'no_permission');
      case 'feature_disabled':
        return this.stateBox('settings', tr('התזמונים כבויים'), 'feature_disabled', settings);
      case 'missing':
        return st.admin ? this.stateBox('settings', tr('רכיב התזמונים אינו מחובר'), 'missing_admin', settings) : this.stateBox('calendar', tr('אין תזמונים להצגה'), 'missing');
      default:
        return this.sub === 'trash' ? this.renderTrash() : this.sub === 'review' ? this.renderReview() : this.renderReady(st);
    }
  }

  render() {
    const st = this.noView && !this.status ? { ...screenState(null), kind: 'no_view' as const } : screenState(this.status, !!this.failed && !this.status);
    const listFailed = st.kind === 'ready' && this.items === null && !!this.failed;
    const scr = listFailed ? { ...st, kind: 'error' as const } : st.kind === 'ready' && this.items === null ? { ...st, kind: 'loading' as const } : st;
    const sub = this.sub;
    const drawerId = sub && sub !== 'trash' && sub !== 'review' ? sub : '';
    const title = sub === 'trash' ? tr('סל מחזור') : sub === 'review' ? tr('תזמונים לבדיקה') : tr('תזמונים');
    return html`<sw-page class="page" heading=${title} backHref=${sub === 'trash' || sub === 'review' ? BASE : ''} data-sched-title data-screen="devices-schedules" data-sched-screen=${scr.kind}>
        ${this.header(scr)}
        ${this.renderBody(scr)}
      </sw-page>
      ${scr.kind === 'ready' && this.drawerUsed
        ? html`<schedule-drawer ?open=${!!drawerId} .schedule=${this.detail} .status=${this.status} ?missing=${this.detailMissing} @drawer-close=${() => this.go('')} @edit=${(e: CustomEvent<{ id: string }>) => navigate(`${BASE}/${e.detail.id}/edit`)} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-drawer>`
        : nothing}
      ${scr.kind === 'ready' && this.createOpen
        ? html`<schedule-create-dialog .open=${true} @close=${() => (this.createOpen = false)} @created=${(e: CustomEvent<{ id: string }>) => { this.createOpen = false; void this.refresh(); this.go(e.detail.id); }}></schedule-create-dialog>`
        : nothing}
      ${this.trashLowering
        ? html`<schedule-lowering-dialog .open=${true} .summary=${{ entities: this.trashLowering.entities.filter((e) => e.sensitive).map((e) => e.name), times: [], text: tr('השחזור יחזיר תזמון שפותח או מנטרל {names} גם כשאיש אינו נמצא במקום.', { names: this.trashLowering.entities.filter((e) => e.sensitive).map((e) => e.name).join(', ') }) }} .needsCode=${false} @confirm=${(e: CustomEvent<{ alarm_code: string | null }>) => void this.confirmTrashLowering(e)} @close=${() => (this.trashLowering = null)}></schedule-lowering-dialog>`
        : nothing}
      ${this.purging
        ? html`<sw-dialog open heading=${tr('למחוק לצמיתות את "{name}"?', { name: this.purging.name || tr('תזמון ללא שם') })} data-dialog="purge" @close=${() => (this.purging = null)}><div class="dlgform"><p>${tr('אי אפשר יהיה לשחזר אותו.')}</p><div class="dlgrow"><button type="button" class="btn" @click=${() => (this.purging = null)}>${tr('ביטול')}</button><button type="button" class="btn danger" data-purge-confirm @click=${() => void this.doPurge()}>${tr('מחיקה')}</button></div></div></sw-dialog>`
        : nothing}
      <schedule-actions .status=${this.status} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult}></schedule-actions>
      ${this.note ? html`<div class=${`toast${this.note.tone === 'error' ? ' bad' : ''}`} popover="manual" role="status" data-sched-note>${aIcon(this.note.tone === 'error' ? 'warning' : 'check')}${this.note.text}${this.note.action ? html`<button type="button" class="btn sm" data-note-action @click=${() => { const a = this.note?.action; this.note = null; a?.run(); }}>${this.note.action.label}</button>` : nothing}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-schedules': DevicesSchedules;
  }
}
