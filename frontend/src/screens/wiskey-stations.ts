import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-table';
import '../components/sw-state-panel';
import '../components/sw-place-tree';
import '../components/sw-view-switch';
import '../components/wk-action-button';
import '../components/wk-announce-dialog';
import '../components/wk-station-live';
import '../components/wk-talk-button';
import type { StateKind } from '../components/sw-badge';
import { ApiError, describeError } from '../api/client';
import { getDevicesTree, getEntityRows } from '../api/devices';
import { intercomSnapshotUrl, releaseIntercomDoor, signalIntercomCall, subscribeIntercom, type IntercomCallCommand } from '../api/intercom';
import { getStationMedia, parseMediaMode, type StationMedia, type StationMediaMode } from '../api/station-media';
import { smt } from '../i18n/wiskey-station-media';
import {
  getAccessFeatures,
  getAccessStations,
  getStationCodes,
  getStationPrograms,
  type AccessStation,
  type AccessStationsReply,
  type ReadHead,
} from '../api/access-stations';
import { productSettings } from '../api/prefs';
import { can, canAnywhere, cap, isApi } from '../api/session';
import { onRouteChange, parseRoute, replaceRoute, type RouteState } from '../router';
import { fill, ws } from '../i18n/wiskey-stations';
import { StationActions } from './wiskey-stations-actions';
import { stationsCss } from './wiskey-stations-css';
import { wkIcon } from './wiskey-stations-icons';
import {
  CallClock,
  classicPanelHref,
  NO_RIGHTS,
  POLICY_DEFAULTS,
  POLL_MS,
  POSTER_MS,
  ageText,
  derivePlaces,
  feedPanel,
  inPlace,
  isActiveCall,
  parsePolicy,
  phrasesOf,
  placeRows,
  rightsOf,
  STATION_FILTERS,
  subtitleOf,
  TABLE_COMPACT_MAX,
  TABLE_MEDIUM_MAX,
  TABLE_MIN,
  tableTierOf,
  tally,
  visibleStations,
  type PlaceMap,
  type Rights,
  type StationFilter,
  type StationsPolicy,
  type TableTier,
} from './wiskey-stations-logic';
import { drawerBody, grid, rows, tableColumns, type Fetch, type StationDetail, type ViewCtx } from './wiskey-stations-views';
import { timeText } from '../api/day-format';

type ViewMode = 'cards' | 'list' | 'table';
const VIEW_KEY = 'sw.wiskey.stations.view';
const TREE_KEY = 'sw.wiskey.stations.treeCollapsed';
/** The read copy of a station's door settings stays this long before the drawer reads again. */
const DETAIL_TTL_MS = 30_000;

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}
const readView = (): ViewMode => {
  const v = stored(VIEW_KEY);
  return v === 'list' || v === 'table' ? v : 'cards';
};
const readCollapsed = (): ReadonlySet<string> => {
  try {
    const raw = JSON.parse(stored(TREE_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
};
const uiLocale = () => (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en-GB' : 'he-IL';

const ZONE = { kind: 'iana', name: 'Asia/Jerusalem' } as const;
const DEMO: AccessStation[] = [
  { id: 'd1', name: 'שער ראשי', online: true, call_state: 'ringing', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: null }], has_camera: true, camera_entity: null, last_seen: '2026-09-27T08:00:00+03:00', zone: ZONE, technical: null, errors: null },
  { id: 'd2', name: 'לובי', online: true, call_state: 'idle', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: 'כניסה' }, { physical_index: 2, name: 'מחסום' }], has_camera: true, camera_entity: null, last_seen: '2026-09-27T08:00:00+03:00', zone: ZONE, technical: null, errors: null },
  { id: 'd3', name: 'חניון', online: true, call_state: 'idle', sync_state: 'pending', lock_enabled: false, locks: [], has_camera: true, camera_entity: null, last_seen: '2026-09-27T08:00:00+03:00', zone: ZONE, technical: null, errors: null },
  { id: 'd4', name: 'מחסן', online: false, call_state: 'unavailable', sync_state: 'offline', lock_enabled: true, locks: [{ physical_index: 1, name: null }], has_camera: false, camera_entity: null, last_seen: '2026-09-26T19:02:00+03:00', zone: ZONE, technical: null, errors: null },
];

/**
 * תחנות ודלתות - the native stations and doors screen (CR-036 slice S6; owner answers of 2026-10-11 / 2026-10-12): the stations
 * the caller sees as cards, a list or a table, a drawer per station, and the physical actions of the entry center - door release
 * (confirmation, "sent", never "opened"), answer / decline / hang up, an announcement - plus the incoming-call hint for everyone
 * who sees the station, the talk button in "talk in the classic panel" mode, and the technical part (sync, model, door programs,
 * code presence) for who may see it. Read-only except those existing actions.
 *
 * Data: the typed reads `GET /access-control/stations` (+ `/features`, and per station `/programs` and `/codes` on demand) - the
 * server omits stations outside the caller's scope and fields they may not see. The writes are the existing physical-action
 * endpoints (api/intercom.ts), unchanged; this screen only decides what to OFFER (screens/wiskey-stations-logic.ts `rightsOf`).
 * Shown instead of the embedded panel only when הגדרות › מתגי מסכי כניסה says so (`access.ui.stations` = smplwise).
 */
@customElement('wiskey-stations')
export class WiskeyStations extends LitElement {
  static styles = stationsCss;

  @state() private feed: AccessStationsReply | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private filter: StationFilter = 'all';
  @state() private query = '';
  @state() private view: ViewMode = readView();
  @state() private place = 'all';
  @state() private places: PlaceMap | null = null;
  @state() private collapsed: ReadonlySet<string> = readCollapsed();
  @state() private selected: string | null = null;
  @state() private sheet = false;
  @state() private announceOpen = false;
  @state() private announceFor = '';
  @state() private policy: StationsPolicy = POLICY_DEFAULTS;
  @state() private features: Record<string, boolean | null> = {};
  @state() private detail: Record<string, StationDetail> = {};
  @state() private detailOpen = false;
  @state() private now = Date.now();
  @state() private poster = Date.now();
  @state() private failed: Record<string, number> = {};
  @state() private table: TableTier = tableTierOf(typeof window === 'undefined' ? 1440 : window.innerWidth);
  /** CR-036 S18: the station drawer's own live video and talk (`access.station_media`, off by default) and the read per station. */
  @state() private mediaMode: StationMediaMode = 'off';
  @state() private media: Record<string, StationMedia | null> = {};
  private mediaAt: Record<string, number> = {};

  private clock = new CallClock();
  private actions = new StationActions({
    release: (id, lock) => releaseIntercomDoor(id, lock),
    signal: (id, command) => signalIntercomCall(id, command),
    station: (id) => this.list().find((s) => s.id === id),
    live: () => this.isLive(),
    now: () => Date.now(),
    tick: () => performance.now(),
    after: (fn, ms) => window.setTimeout(fn, ms),
    cancel: (id) => window.clearTimeout(id),
    changed: () => this.requestUpdate(),
    refetch: () => void this.load(),
    stamp: () => timeText(new Date()),
  });
  private stop: (() => void) | null = null;
  private stopRoute: (() => void) | null = null;
  private poll = 0;
  private tickTimer = 0;
  private posterTimer = 0;
  private loading = false;
  private loadAgain = false;
  private placesKey = '';
  private detailAt: Record<string, number> = {};
  // the table gives up columns at two widths and is gone below a third (screens/wiskey-stations-logic.ts `tableTierOf`)
  private mqc = typeof matchMedia === 'function' ? matchMedia(`(max-width: ${TABLE_COMPACT_MAX}px)`) : null;
  private mqm = typeof matchMedia === 'function' ? matchMedia(`(max-width: ${TABLE_MEDIUM_MAX}px)`) : null;
  private mqn = typeof matchMedia === 'function' ? matchMedia(`(max-width: ${TABLE_MIN - 1}px)`) : null;
  private onMedia = () => {
    this.table = tableTierOf(window.innerWidth);
  };

  // ------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    this.mqc?.addEventListener('change', this.onMedia);
    this.mqm?.addEventListener('change', this.onMedia);
    this.mqn?.addEventListener('change', this.onMedia);
    this.stopRoute = onRouteChange((r) => this.onRoute(r));
    if (!isApi()) return;
    if (!canAnywhere('access.read')) {
      this.forbidden = true;
      return;
    }
    void this.load();
    void this.readFeatures();
    this.posterTimer = window.setInterval(() => {
      if (!document.hidden) this.poster = Date.now();
    }, POSTER_MS);
    this.stop = subscribeIntercom(
      (m) => {
        if (m.type === 'intercom_tts') this.actions.noteTts(m.status);
        else if (m.type !== 'heartbeat') void this.load();
      },
      (connected) => {
        this.setPolling(!connected);
        if (connected) void this.load(); // notices sent while the socket was down are gone: catch up now
      },
    );
    this.schedule();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mqc?.removeEventListener('change', this.onMedia);
    this.mqm?.removeEventListener('change', this.onMedia);
    this.mqn?.removeEventListener('change', this.onMedia);
    this.stop?.();
    this.stop = null;
    this.stopRoute?.();
    this.stopRoute = null;
    this.setPolling(false);
    window.clearInterval(this.posterTimer);
    window.clearTimeout(this.tickTimer);
    this.actions.dispose();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('selected') || changed.has('detailOpen')) this.maybeLoadDetail();
    if (changed.has('selected') || changed.has('mediaMode')) this.maybeLoadMedia();
  }

  private setPolling(on: boolean) {
    window.clearInterval(this.poll);
    this.poll = on ? window.setInterval(() => void this.load(), POLL_MS) : 0;
  }

  /** The screen's own clock: every second while a call is on (its duration counts), else slowly (the "seen" words age). */
  private schedule() {
    window.clearTimeout(this.tickTimer);
    this.tickTimer = window.setTimeout(
      () => {
        this.now = Date.now();
        this.clock.observe(this.list(), this.now);
        this.actions.prune();
        this.schedule();
      },
      this.clock.active ? 1000 : 20_000,
    );
  }

  private onRoute(r: RouteState) {
    if (r.mode !== 'wiskey') return;
    const id = r.params.get('station');
    if (id && id !== this.selected) {
      this.selected = id;
      this.detailOpen = false;
    } else if (!id && this.selected) {
      this.selected = null;
      this.detailOpen = false;
    }
  }

  // ------------------------------------------------------------------ data

  private demo(): boolean {
    return !isApi();
  }

  private list(): AccessStation[] {
    return this.demo() ? DEMO : (this.feed?.stations ?? []);
  }

  /** The feed is live and fresh. Nothing physical is offered on a last-known copy (it is for reading). */
  private isLive(): boolean {
    return !this.demo() && this.feed?.state === 'ready' && this.feed.fresh !== false;
  }

  private rights(): Rights {
    return this.demo() ? NO_RIGHTS : rightsOf(can, this.policy, canAnywhere);
  }

  private async load() {
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    try {
      do {
        this.loadAgain = false;
        try {
          const r = await getAccessStations();
          this.feed = r;
          this.error = '';
          this.forbidden = false;
          this.afterLoad(r);
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) this.forbidden = true;
          else this.error = describeError(err);
        }
      } while (this.loadAgain);
    } finally {
      this.loading = false;
    }
  }

  private afterLoad(r: AccessStationsReply) {
    this.now = Date.now();
    this.clock.observe(r.stations ?? [], this.now);
    this.actions.dropStaleArm();
    void this.readPolicy();
    void this.ensurePlaces(r.stations ?? []);
    this.maybeLoadMedia();
    this.schedule();
  }

  private async readPolicy() {
    try {
      const settings = (await productSettings()) as unknown as Record<string, unknown>;
      this.policy = parsePolicy(settings);
      this.mediaMode = parseMediaMode(settings);
    } catch {
      /* the defaults (the owner's answers) stay */
    }
  }

  private async readFeatures() {
    try {
      const f = await getAccessFeatures();
      this.features = Object.fromEntries(Object.entries(f.features ?? {}).map(([k, v]) => [k, v.available]));
    } catch {
      /* unknown: treated as available; the reads then answer "unsupported" on their own */
    }
  }

  /** Places come from Arx's own floors and areas: the area of each station's camera entity (the authoritative station placement,
   * CR-033 D2, is not part of this build). Read again only when the set of cameras changes; anything that fails leaves no tree. */
  private async ensurePlaces(stations: readonly AccessStation[]) {
    const withCamera = stations.filter((s) => s.camera_entity);
    const key = withCamera.map((s) => `${s.id}:${s.camera_entity}`).sort().join('|');
    if (key === this.placesKey) return;
    this.placesKey = key;
    if (!withCamera.length || !canAnywhere('devices.read')) {
      this.places = null;
      return;
    }
    try {
      const [tree, rows] = await Promise.all([getDevicesTree(), getEntityRows(withCamera.map((s) => s.camera_entity as string))]);
      if (key !== this.placesKey) return;
      this.places = derivePlaces(stations, tree, rows.entities);
    } catch {
      this.places = null;
    }
  }

  // ------------------------------------------------------------------ the drawer's door settings (programs, code presence)

  private maybeLoadDetail() {
    const id = this.selected;
    if (!id || !this.detailOpen || this.demo()) return;
    const s = this.list().find((x) => x.id === id);
    if (!s?.technical) return;
    const at = this.detailAt[id] ?? 0;
    if (this.detail[id] && Date.now() - at < DETAIL_TTL_MS) return;
    void this.loadDetail(id);
  }

  private async loadDetail(id: string) {
    this.detailAt = { ...this.detailAt, [id]: Date.now() };
    const idle: Fetch<never> = { state: 'loading', data: null };
    this.detail = { ...this.detail, [id]: { programs: idle, codes: idle } };
    const set = (patch: Partial<StationDetail>) => (this.detail = { ...this.detail, [id]: { ...this.detail[id], ...patch } as StationDetail });
    const classify = <T>(r: ReadHead, data: T | null): Fetch<T> =>
      r.state === 'ready' && data
        ? { state: 'ready', data }
        : r.state === 'unsupported'
          ? { state: 'unsupported', data: null }
          : r.last_error === 'busy' || r.last_error === 'rate_limited' || r.last_error === 'timeout'
            ? { state: 'busy', data: null } // a transient answer of the shared reads: try again in a moment
            : { state: 'error', data: null };
    if (this.features.door_programs !== false) {
      try {
        const r = await getStationPrograms(id);
        set({ programs: classify(r, r.programs) });
      } catch {
        set({ programs: { state: 'error', data: null } });
      }
    } else set({ programs: { state: 'unsupported', data: null } });
    if (this.features.public_codes !== false) {
      try {
        const r = await getStationCodes(id);
        set({ codes: classify(r, r.codes) });
      } catch {
        set({ codes: { state: 'error', data: null } });
      }
    } else set({ codes: { state: 'unsupported', data: null } });
  }

  // ------------------------------------------------------------------ CR-036 S18: the drawer's live video and talk

  /** Read what the open station's drawer may offer, when the setting is on (never while it is off: the screen then makes exactly
   * the requests it made before). Read again at most every DETAIL_TTL_MS while the drawer stays open. */
  private maybeLoadMedia() {
    const id = this.selected;
    if (!id || this.mediaMode === 'off' || this.demo()) return;
    if (this.media[id] !== undefined && Date.now() - (this.mediaAt[id] ?? 0) < DETAIL_TTL_MS) return;
    this.mediaAt = { ...this.mediaAt, [id]: Date.now() };
    void getStationMedia(id)
      .then((m) => (this.media = { ...this.media, [id]: m }))
      .catch(() => (this.media = { ...this.media, [id]: null })); // the still and the classic panel, as before
  }

  /** The station's still as the live view's poster (only where the drawer would show one). */
  private posterOf(s: AccessStation): string {
    if (!s.camera_entity || this.demo() || !cap('go2rtc') || this.failed[s.id] === this.poster) return '';
    return intercomSnapshotUrl(s.id, this.poster);
  }

  /** The drawer's own live area: the live player and the talk control, when the read offers video the caller may watch or talk;
   * null (the still and the classic panel) otherwise. */
  private liveArea(s: AccessStation, v: ViewCtx) {
    if (this.mediaMode === 'off') return null;
    const m = this.media[s.id];
    if (!m || m.state !== 'ready') return null;
    const video = !!m.video?.allowed && Object.keys(m.video.paths).length > 0;
    if (!video && !m.talk?.available) return null;
    const classic = v.rights.talk && !m.talk?.available;
    return html`<wk-station-live
      data-wk-live-native
      .stationId=${s.id}
      .stationName=${s.name}
      .media=${video ? m : { ...m, video: null }}
      .poster=${this.posterOf(s)}
      .live=${v.live && s.online}
      .classicHref=${classic ? classicPanelHref() : ''}
      .classicLabel=${v.text.talk.classic}
    ></wk-station-live>`;
  }

  /** Where the classic-panel talk link would be. In a card or a row: "talk" opens the drawer (its push-to-talk) once the setting
   * allows talk and the caller may call somewhere; in the drawer: nothing when the live area holds the talk control. */
  private talkControl(s: AccessStation, large: boolean, v: ViewCtx) {
    if (this.mediaMode !== 'video_talk') return undefined;
    if (!large) {
      if (!canAnywhere('access.call') || !s.online) return undefined;
      return html`<wk-action-button icon="mic" data-wk-talk="drawer" label=${smt().talk.openDrawer} @click=${(e: Event) => {
        e.stopPropagation();
        this.open(s.id);
      }}>${smt().talk.openDrawer}</wk-action-button>`;
    }
    return this.liveArea(s, v) ? nothing : undefined;
  }

  // ------------------------------------------------------------------ selection and navigation

  private open(id: string) {
    if (this.selected === id) return;
    this.selected = id;
    this.detailOpen = false;
    this.syncRoute(id);
  }

  private closeDrawer() {
    this.selected = null;
    this.detailOpen = false;
    this.syncRoute(null);
  }

  /** The open station is part of the address (`?station=<id>`): a link to a station opens its drawer, and the drawer's state
   * survives a reload. Rewritten in place - no history entry. */
  private syncRoute(id: string | null) {
    const r = parseRoute();
    if (r.mode !== 'wiskey') return;
    const params = new URLSearchParams(r.params);
    if (id) params.set('station', id);
    else params.delete('station');
    replaceRoute(r.path, params);
  }

  private setView(v: ViewMode) {
    this.view = v;
    store(VIEW_KEY, v);
  }

  private toggleFloor(id: string) {
    const next = new Set(this.collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.collapsed = next;
    store(TREE_KEY, JSON.stringify([...next]));
  }

  private pickPlace(id: string) {
    this.place = id;
    this.sheet = false;
  }

  // ------------------------------------------------------------------ the view context

  private ctx(): ViewCtx {
    const features: Record<string, boolean | null> = this.features;
    const ctx: ViewCtx = {
      text: ws(),
      now: this.now,
      defaultZone: this.feed?.default_zone ?? null,
      live: this.isLive(),
      rights: this.rights(),
      policy: this.policy,
      places: this.places,
      actions: this.actions,
      clock: this.clock,
      table: this.table,
      media: this.demo() ? false : cap('go2rtc'),
      poster: this.poster,
      failed: this.failed,
      selected: this.selected,
      detail: this.detail,
      detailOpen: this.detailOpen,
      features,
      open: (id) => this.open(id),
      door: (s, lock) => void this.actions.askRelease(s.id, lock),
      call: (s, command: IntercomCallCommand, ev) => this.actions.tapCall(s.id, command, ev.detail),
      announce: (id) => {
        this.announceFor = id;
        this.announceOpen = true;
      },
      stillError: (id, bust) => (this.failed = { ...this.failed, [id]: bust }),
      toggleDetail: () => (this.detailOpen = !this.detailOpen),
      retryDetail: () => {
        if (this.selected) void this.loadDetail(this.selected);
      },
    };
    if (this.mediaMode !== 'off') {
      ctx.liveArea = (s) => this.liveArea(s, ctx);
      ctx.talkControl = (s, large) => this.talkControl(s, large, ctx);
    }
    return ctx;
  }

  // ------------------------------------------------------------------ render

  render() {
    const t = ws();
    if (this.forbidden && isApi()) {
      return html`<sw-page heading=${t.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${t.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;
    }
    if (!this.demo() && !this.feed) {
      return html`<sw-page heading=${t.title}><div data-wk-stations data-wk-state=${this.error ? 'error' : 'loading'}>${this.error
        ? html`<sw-state-panel state="error" heading=${t.states.error} hint=${this.error} actionLabel=${t.retry} data-wk-panel="error" @action=${() => void this.load()}></sw-state-panel>`
        : html`<sw-state-panel state="loading" heading=${t.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;
    }
    const stations = this.demo() ? DEMO : this.feed!.stations;
    if (stations === null) {
      const state = this.feed!.state === 'ready' ? 'error' : this.feed!.state;
      const p = feedPanel(state, t);
      return html`<sw-page heading=${t.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed!.state}`}>
          <sw-state-panel icon="door" state=${p.panel} heading=${p.heading} actionLabel=${p.settings && can('system.configure') ? t.states.toSettings : ''} data-wk-panel=${`feed:${this.feed!.state}`} @action=${() => (window.location.hash = '#/system/diagnostics?tab=access-control')}></sw-state-panel>
        </div>
      </sw-page>`;
    }
    return this.renderReady(stations);
  }

  private renderFeedBadge() {
    const t = ws();
    if (this.demo()) return html`<sw-badge slot="actions" kind="neutral" label=${t.demo} data-wk-feed="demo"></sw-badge>`;
    const f = this.feed;
    if (!f) return nothing;
    const live = f.state === 'ready' && f.fresh !== false;
    const kind: StateKind = live ? 'live' : f.state === 'connecting' ? 'unknown' : f.state === 'forbidden' ? 'forbidden' : f.state === 'error' ? 'error' : f.stations ? 'stale' : 'offline';
    const label = live ? t.feed.live : f.state === 'connecting' ? t.feed.connecting : f.stations && f.fetched_at ? fill(t.feed.stale, { ago: ageText(f.fetched_at, this.now, t) || '…' }) : t.feed.off;
    return html`<sw-badge slot="actions" kind=${kind} label=${label} data-wk-feed=${live ? 'live' : f.state}></sw-badge>`;
  }

  /** A narrow window has no table (the list does its job); the choice itself stays, for when the window grows. */
  private effectiveView(): ViewMode {
    return this.table === 'none' && this.view === 'table' ? 'list' : this.view;
  }

  private renderReady(all: readonly AccessStation[]) {
    const t = ws();
    const v = this.ctx();
    const rowsOf = placeRows(all, this.places, this.collapsed, t);
    const hasTree = rowsOf.length > 0;
    const place = hasTree && rowsOf.some((r) => r.id === this.place) ? this.place : 'all';
    const shown = visibleStations(all, this.filter, this.query, place, this.places);
    const tl = tally(all);
    const view = this.effectiveView();
    const active = all.filter(isActiveCall).length;
    const online = all.some((s) => s.online);
    const state = !all.length ? 'empty' : 'ready';
    const placeName = rowsOf.find((r) => r.id === place)?.name ?? t.places.all;
    return html`<sw-page wide heading=${t.title} subheading=${subtitleOf(tl, t)}>
      ${this.renderFeedBadge()}
      <div data-wk-stations data-wk-state=${state} data-view=${view} data-live=${String(v.live)}>
        ${all.length
          ? html`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${t.searchLabel} placeholder=${t.searchLabel} .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} /></label>
              ${v.rights.announce && online
                ? html`<wk-action-button icon="volume" data-wk-announce ?disabled=${!v.live} label=${t.announce} @click=${() => v.announce('')}><span class="lbl">${t.announce}</span></wk-action-button>`
                : nothing}
              <sw-view-switch data-wk-views label=${t.views.label} .value=${view} .options=${[
                { id: 'cards', label: t.views.cards, icon: 'grid' },
                { id: 'list', label: t.views.list, icon: 'list' },
                ...(this.table === 'none' ? [] : [{ id: 'table', label: t.views.table, icon: 'table' }]),
              ]} @change=${(e: CustomEvent<string>) => this.setView(e.detail as ViewMode)}></sw-view-switch>
            </div>`
          : nothing}
        <div class="layout ${hasTree ? '' : 'no-tree'}">
          ${hasTree
            ? html`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${rowsOf} .selected=${place} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${(e: CustomEvent<string>) => this.pickPlace(e.detail)} @place-toggle=${(e: CustomEvent<string>) => this.toggleFloor(e.detail)}></sw-place-tree></sw-card></aside>`
            : nothing}
          <section class="main">
            ${all.length
              ? html`<div class="chips" role="group" aria-label=${t.filters.label}>
                  ${hasTree ? html`<button type="button" class="chip places" data-wk-places-chip @click=${() => (this.sheet = true)}><sw-icon name="pin" size=${14}></sw-icon>${t.places.chip}: ${placeName}<sw-icon name="chevronDown" size=${12}></sw-icon></button>` : nothing}
                  ${STATION_FILTERS.map(
                    (f) => html`<button type="button" class="chip" data-wk-filter=${f} aria-pressed=${String(this.filter === f)} @click=${() => (this.filter = f)}>
                      ${f === 'in_call' ? wkIcon('phone', 14) : nothing}${f === 'all' ? t.filters.all : f === 'online' ? t.filters.online : f === 'attention' ? t.filters.attention : t.filters.inCall}
                    </button>`,
                  )}
                </div>`
              : nothing}
            ${active && view === 'cards' && v.rights.call
              ? html`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${active === 1 ? t.strip.one : fill(t.strip.many, { n: active })}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${() => this.setView('list')}>${t.strip.toList}</wk-action-button>
                </div>`
              : nothing}
            ${this.renderContent(v, all, shown, view)}
          </section>
        </div>
      </div>
      ${this.renderSheet(rowsOf, place)} ${this.renderDrawer(v, all)} ${this.selected ? nothing : this.renderDialogs(v, all)}
    </sw-page>`;
  }

  private renderContent(v: ViewCtx, all: readonly AccessStation[], shown: readonly AccessStation[], view: ViewMode) {
    const t = v.text;
    if (!all.length) return html`<sw-state-panel icon="door" state="empty" heading=${t.states.empty} data-wk-panel="empty"></sw-state-panel>`;
    if (!shown.length) return html`<sw-state-panel icon="door" compact state="empty" heading=${t.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`;
    if (view === 'table') {
      return html`<sw-table class="tbl" dense data-wk-table .columns=${tableColumns(v, all)} .rows=${shown as unknown as Record<string, unknown>[]} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => this.open(e.detail.id)}></sw-table>`;
    }
    return view === 'list' ? rows(v, shown) : grid(v, shown);
  }

  private renderSheet(rowsOf: ReturnType<typeof placeRows>, place: string) {
    const t = ws();
    if (!rowsOf.length) return nothing;
    return html`<sw-drawer modal ?open=${this.sheet} heading=${t.places.sheet} data-wk-places-sheet @close=${(e: Event) => e.target === e.currentTarget && (this.sheet = false)}>
      <sw-place-tree .rows=${rowsOf} .selected=${place} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${(e: CustomEvent<string>) => this.pickPlace(e.detail)} @place-toggle=${(e: CustomEvent<string>) => this.toggleFloor(e.detail)}></sw-place-tree>
    </sw-drawer>`;
  }

  private renderDrawer(v: ViewCtx, all: readonly AccessStation[]) {
    const t = v.text;
    const id = this.selected;
    const s = id ? all.find((x) => x.id === id) : undefined;
    const kind: StateKind = !s ? 'neutral' : s.online ? 'live' : 'offline';
    return html`<sw-drawer modal ?open=${!!id} heading=${s?.name ?? t.drawer.notFound} data-wk-drawer data-wk-drawer-station=${id ?? ''} @close=${(e: Event) => e.target === e.currentTarget && this.closeDrawer()}>
      ${id && s ? html`<sw-badge slot="action" kind=${kind} label=${s.online ? t.status.online : t.status.offline}></sw-badge>` : nothing}
      ${id ? (s ? drawerBody(v, s) : html`<sw-state-panel compact state="forbidden" heading=${t.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`) : nothing}
      ${id ? this.renderDialogs(v, all) : nothing}
    </sw-drawer>`;
  }

  /** The release confirmation and the announcement composer. Opened from the open drawer they render INSIDE it (a modal drawer
   * makes everything outside its top layer inert); otherwise at the page. */
  private renderDialogs(v: ViewCtx, all: readonly AccessStation[]) {
    return html`${this.renderConfirm(v, all)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${all as AccessStation[]}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${phrasesOf(this.policy, v.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${(e: CustomEvent) => this.actions.noteTts(e.detail)}
      @close=${(e: Event) => {
        if (e.target === e.currentTarget) this.announceOpen = false;
      }}
    ></wk-announce-dialog>`;
  }

  private renderConfirm(v: ViewCtx, all: readonly AccessStation[]) {
    const c = this.actions.confirm;
    if (!c) return nothing;
    const s = all.find((x) => x.id === c.stationId);
    if (!s) return nothing;
    const t = v.text;
    const name = s.locks.find((l) => l.physical_index === c.lock)?.name?.trim();
    const where = inPlace(s.name);
    const sentence = name ? fill(t.door.confirmNamed, { door: name, inPlace: where }) : fill(t.door.confirmPlain, { inPlace: where });
    const busy = this.actions.releasing.has(`${s.id}/${c.lock}`);
    return html`<sw-dialog open ?locked=${busy} heading=${t.door.confirmTitle} data-wk-release-dialog @close=${(e: Event) => e.target === e.currentTarget && this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${sentence}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${busy} @click=${() => this.actions.cancelRelease()}>${t.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${busy} ?disabled=${busy || !v.live} @click=${() => void this.actions.confirmRelease()}>${busy ? t.door.sending : t.door.send}</wk-action-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-stations': WiskeyStations;
  }
}
