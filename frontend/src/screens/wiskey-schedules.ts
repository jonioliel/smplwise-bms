import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-drawer';
import '../components/sw-table';
import '../components/sw-state-panel';
import '../components/sw-view-switch';
import '../components/sw-week-grid';
import type { StateKind } from '../components/sw-badge';
import type { TableColumn } from '../components/sw-table';
import type { WeekDays } from '../components/sw-week-grid';
import { ApiError, describeError } from '../api/client';
import { getAccessFeatures, getAccessStations, getStationCodes, getStationPrograms, type AccessStation, type AccessStationsReply, type ReadHead, type StationCodes, type StationPrograms } from '../api/access-stations';
import { getScheduleLibrary, getScheduleOperations, getSchedulePlans, type LibrarySchedule, type ScheduleOperations, type SchedulePlan } from '../api/access-schedules';
import type { DisplayZone } from '../api/intercom';
import { can, canAnywhere, isApi, onSession } from '../api/session';
import { onRouteChange, parseRoute, replaceRoute, type RouteState } from '../router';
import { sch, schDynamic } from '../i18n/access-schedules';
import {
  CLASSIC_EDIT_HREF,
  POLL_MS,
  TABLE_MIN,
  codeState,
  codeWord,
  doorGroups,
  doorSchedule,
  doorsOf,
  feedPanel,
  isBusy,
  libraryRows,
  pickDoor,
  planRows,
  programTone,
  schedulesAccess,
  stamp,
  stationNamer,
  subtitle,
  tableRows,
  type DoorRef,
  type SchedulesAccess,
  type TableRow,
  type Tone,
} from '../access-control/schedules-logic';
import { schedulesCss } from './wiskey-schedules-css';

type View = 'door' | 'table';
const VIEW_KEY = 'sw.wiskey.schedules.view';
/** A station's programs / code presence are read again after this long (the server caches them 30 s / 300 s anyway). */
const DETAIL_TTL_MS = 30_000;

/** One read's state on this screen. `data` is the last good answer: a failed reload keeps it, marked not current. */
interface Fetch<T> {
  state: 'loading' | 'ready' | 'busy' | 'error' | 'unsupported' | 'forbidden';
  data: T | null;
  /** When this screen last asked (0 = ask now). */
  at: number;
  /** False: what is shown is not current (the server served a last-known copy, or the last reload failed and the data is kept). */
  fresh: boolean;
  /** When the shown data was read by the server. */
  fetchedAt: string | null;
}
const LOADING: Fetch<never> = { state: 'loading', data: null, at: 0, fresh: true, fetchedAt: null };
const settled = <T,>(state: Fetch<T>['state'], data: T | null = null): Fetch<T> => ({ state, data, at: Date.now(), fresh: true, fetchedAt: null });

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

const KIND: Record<Tone, StateKind> = { live: 'live', stale: 'stale', error: 'error', offline: 'offline', unknown: 'unknown', neutral: 'neutral' };

// ---------------------------------------------------------------- the static demo (no backend: invented data only)
const ZONE: DisplayZone = { kind: 'iana', name: 'Asia/Jerusalem' };
const TECH = { loaded: true, model: null, firmware: null, capabilities: null, clock: null, event_status: null, scanned_at: null, scanning: false, reconciled_at: null, last_poll_ms: null };
const DEMO_STATIONS: AccessStation[] = [
  { id: 'd1', name: 'שער ראשי', online: true, call_state: 'idle', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: 'שער' }], has_camera: false, camera_entity: null, last_seen: null, zone: ZONE, technical: TECH, errors: null },
  { id: 'd2', name: 'לובי', online: true, call_state: 'idle', sync_state: 'synced', lock_enabled: true, locks: [{ physical_index: 1, name: 'כניסה' }, { physical_index: 2, name: 'מחסום' }], has_camera: false, camera_entity: null, last_seen: null, zone: ZONE, technical: TECH, errors: null },
];
const WEEKDAY_HOURS = [{ start: '07:00', end: '09:00' }];
const DEMO_PROGRAMS: Record<string, StationPrograms> = {
  d1: { programs: [], saved: [], timezone: 'Asia/Jerusalem', native_supported: false },
  d2: {
    programs: [{ door: 1, revision: 1, enabled: true, removing: false, policy: { timezone: 'Asia/Jerusalem', name: 'בוקר', weekly: { Sunday: WEEKDAY_HOURS, Monday: WEEKDAY_HOURS, Tuesday: WEEKDAY_HOURS, Wednesday: WEEKDAY_HOURS, Thursday: WEEKDAY_HOURS }, holidays: [] }, execution: { owned: false, attempted: null, status: 'idle' }, error: null, checked_at: null }],
    saved: [],
    timezone: 'Asia/Jerusalem',
    native_supported: false,
  },
};

/**
 * לוחות זמנים - the native door schedules screen (CR-036 slice S9, stage 1: READ ONLY; owner answers of 2026-10-11 / 2026-10-12;
 * the approved mock-up, docs/design/WISKEY_SCREENS_DESIGN.md section 3.4). Per door: its hold-open program as a week grid with its
 * state, the specific dates, and whether the public code is set (presence only, never a value). For callers who hold
 * `access.stations.read` at installation scope, also the integration's schedule library and its deployment proposals with their
 * latest check - said honestly: a proposal is not applied to the station.
 *
 * Data: the typed reads `GET /access-control/stations` (+ `/features`), per station `/stations/{id}/programs` and `/codes`, and the
 * installation-wide `/schedules`, `/schedules/plans`, `/schedules/operations` - the server omits what the caller may not see and
 * this screen never infers a right; it shapes itself from what it was sent. It writes nothing: editing stays in the classic panel
 * (an administrator's "edit in the intercom window") until the write phase. Shown instead of the embedded panel only when Settings
 * says so (`access.ui.schedules` = smplwise; off by default, and the tab exists only then). The reads repeat every minute while the
 * page is visible.
 */
@customElement('wiskey-schedules')
export class WiskeySchedules extends LitElement {
  static styles = schedulesCss;

  @state() private feed: AccessStationsReply | null = null;
  @state() private error = '';
  @state() private access: SchedulesAccess = { screen: true, library: true, edit: false };
  @state() private wanted: string | null = null;
  @state() private view: View = stored(VIEW_KEY) === 'table' ? 'table' : 'door';
  @state() private narrow = typeof window !== 'undefined' && window.innerWidth < TABLE_MIN;
  @state() private sheet = false;
  @state() private programs: Record<string, Fetch<StationPrograms>> = {};
  @state() private codes: Record<string, Fetch<StationCodes>> = {};
  @state() private library: Fetch<LibrarySchedule[]> = LOADING;
  @state() private plans: Fetch<SchedulePlan[]> = LOADING;
  @state() private ops: Fetch<ScheduleOperations> = LOADING;
  @state() private features: Record<string, boolean | null> = {};

  private stopSession: (() => void) | null = null;
  private stopRoute: (() => void) | null = null;
  private poll = 0;
  private loading = false;
  private loadAgain = false;
  private inFlight = new Set<string>();
  private featuresRead = false;
  private mq = typeof matchMedia === 'function' ? matchMedia(`(max-width: ${TABLE_MIN - 1}px)`) : null;
  private onMedia = () => {
    this.narrow = window.innerWidth < TABLE_MIN;
  };
  private onVisible = () => {
    if (!document.hidden) void this.load();
  };

  // ------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    this.mq?.addEventListener('change', this.onMedia);
    this.wanted = parseRoute().params.get('door');
    this.stopRoute = onRouteChange((r) => this.onRoute(r));
    if (!isApi()) return;
    this.stopSession = onSession(() => {
      this.access = schedulesAccess(canAnywhere, can);
    });
    this.access = schedulesAccess(canAnywhere, can);
    if (!this.access.screen) return;
    void this.load();
    this.poll = window.setInterval(() => {
      if (!document.hidden) void this.load();
    }, POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq?.removeEventListener('change', this.onMedia);
    this.stopRoute?.();
    this.stopRoute = null;
    this.stopSession?.();
    this.stopSession = null;
    window.clearInterval(this.poll);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private onRoute(r: RouteState) {
    if (r.mode !== 'wiskey') return;
    const door = r.params.get('door');
    if (door !== this.wanted) {
      this.wanted = door;
      void this.loadNeeded();
    }
  }

  // ------------------------------------------------------------------ data

  private demo(): boolean {
    return !isApi();
  }

  private stations(): AccessStation[] {
    return this.demo() ? DEMO_STATIONS : (this.feed?.stations ?? []);
  }

  /** The whole screen's reads, single-flight: the stations, then what the current view needs, then the installation-wide reads. */
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
          this.feed = await getAccessStations();
          this.error = '';
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) this.access = { ...this.access, screen: false };
          else this.error = describeError(err);
        }
        await this.readFeatures();
        await this.loadNeeded();
        await this.loadLibrary();
      } while (this.loadAgain);
    } finally {
      this.loading = false;
    }
  }

  private async readFeatures() {
    if (this.featuresRead) return;
    try {
      const f = await getAccessFeatures();
      this.features = Object.fromEntries(Object.entries(f.features ?? {}).map(([k, v]) => [k, v.available]));
      this.featuresRead = true;
    } catch {
      /* unknown: treated as available; the reads then answer "unsupported" on their own */
    }
  }

  /** The stations whose door settings the current view shows: the selected door's station, or (table) every station with doors. */
  private needed(): string[] {
    const doors = doorsOf(this.stations());
    if (this.effectiveView() === 'table') return [...new Set(doors.map((d) => d.stationId))];
    const d = pickDoor(doors, this.wanted);
    return d ? [d.stationId] : [];
  }

  /** Reads what the current view shows unless it was read within `DETAIL_TTL_MS` (the minute's poll always finds it older). */
  private async loadNeeded() {
    if (this.demo()) return;
    for (const id of this.needed()) {
      const at = Math.min(this.programs[id]?.at ?? 0, this.codes[id]?.at ?? 0);
      if (Date.now() - at < DETAIL_TTL_MS) continue;
      await this.loadStation(id);
    }
  }

  private classify<T>(r: ReadHead, data: T | null, prev: Fetch<T> | undefined): Fetch<T> {
    const at = Date.now();
    if (r.state === 'ready' && data !== null && data !== undefined) return { state: 'ready', data, at, fresh: r.fresh !== false, fetchedAt: r.fetched_at };
    const state: Fetch<T>['state'] = r.state === 'unsupported' ? 'unsupported' : isBusy(r.last_error) ? 'busy' : 'error';
    if (state === 'unsupported') return settled(state);
    return { state, data: prev?.data ?? null, at, fresh: false, fetchedAt: prev?.fetchedAt ?? null };
  }

  private failed<T>(err: unknown, prev: Fetch<T> | undefined): Fetch<T> {
    // 403 / 404: the server no longer lets this caller read it (a station off their scope answers exactly like an absent one)
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return settled('forbidden');
    return { state: 'error', data: prev?.data ?? null, at: Date.now(), fresh: false, fetchedAt: prev?.fetchedAt ?? null };
  }

  /** One station's door programs and code presence (`access.stations.read` on it; the server answers 404 for a station it hides). */
  private async loadStation(id: string) {
    if (this.inFlight.has(id)) return;
    this.inFlight.add(id);
    try {
      if (this.features.door_programs === false) this.programs = { ...this.programs, [id]: settled('unsupported') };
      else {
        if (!this.programs[id]) this.programs = { ...this.programs, [id]: LOADING };
        try {
          const r = await getStationPrograms(id);
          this.programs = { ...this.programs, [id]: this.classify(r, r.programs, this.programs[id]) };
        } catch (err) {
          this.programs = { ...this.programs, [id]: this.failed(err, this.programs[id]) };
        }
      }
      if (this.features.public_codes === false) this.codes = { ...this.codes, [id]: settled('unsupported') };
      else {
        try {
          const r = await getStationCodes(id);
          this.codes = { ...this.codes, [id]: this.classify(r, r.codes, this.codes[id]) };
        } catch (err) {
          this.codes = { ...this.codes, [id]: this.failed(err, this.codes[id]) };
        }
      }
    } finally {
      this.inFlight.delete(id);
    }
  }

  /** The library, the proposals and their checks: installation-wide in the integration, asked only of a caller who holds
   * `access.stations.read` at installation scope (anyone else would be refused, and the refusal audited). A 403 drops the blocks. */
  private async loadLibrary() {
    if (this.demo() || !this.access.library) return;
    const read = async <T>(feature: string, get: () => Promise<ReadHead & { schedules: T | null }>, prev: Fetch<T>): Promise<Fetch<T>> => {
      if (this.features[feature] === false) return settled('unsupported');
      try {
        const r = await get();
        return this.classify(r, r.schedules, prev);
      } catch (err) {
        return this.failed(err, prev);
      }
    };
    this.library = await read('schedules', getScheduleLibrary, this.library);
    if (this.library.state === 'forbidden') {
      // refused once (a deny the session did not show): the blocks are absent, and the other two are not asked
      this.plans = settled('forbidden');
      this.ops = settled('forbidden');
      return;
    }
    this.plans = await read('schedule_plans', getSchedulePlans, this.plans);
    this.ops = await read('schedule_operations', getScheduleOperations, this.ops);
  }

  // ------------------------------------------------------------------ choices

  private effectiveView(): View {
    return this.narrow ? 'door' : this.view;
  }

  private setView(v: View) {
    this.view = v;
    store(VIEW_KEY, v);
    void this.loadNeeded();
  }

  /** The chosen door is part of the address (`?door=<station>:<relay>`): a link opens it, a reload keeps it. No history entry. */
  private pick(key: string) {
    this.sheet = false;
    if (this.wanted === key && this.effectiveView() === 'door') return;
    this.wanted = key;
    if (this.view === 'table') this.setView('door');
    const r = parseRoute();
    if (r.mode === 'wiskey') {
      const params = new URLSearchParams(r.params);
      params.set('door', key);
      replaceRoute(r.path, params);
    }
    void this.loadNeeded();
  }

  private refresh() {
    this.programs = Object.fromEntries(Object.entries(this.programs).map(([k, v]) => [k, { ...v, at: 0 }]));
    this.codes = Object.fromEntries(Object.entries(this.codes).map(([k, v]) => [k, { ...v, at: 0 }]));
    void this.load();
  }

  private zoneOf(stationId: string): DisplayZone | null {
    return this.stations().find((s) => s.id === stationId)?.zone ?? this.feed?.default_zone ?? null;
  }

  private programsOf(id: string): Fetch<StationPrograms> | undefined {
    return this.demo() ? settled('ready', DEMO_PROGRAMS[id] ?? null) : this.programs[id];
  }

  private codesOf(id: string): Fetch<StationCodes> | undefined {
    return this.demo() ? settled<StationCodes>('ready', { public_pin_state: id === 'd2' ? 'configured' : 'absent', slots: [], capabilities: { advertised: null, min: null, max: null }, checked_at: null }) : this.codes[id];
  }

  /** "Not current · read <time>" for a read whose shown data is a last-known copy. */
  private staleLine(f: Fetch<unknown>, zone: DisplayZone | null, attr: string) {
    if (f.fresh || !f.data) return nothing;
    return html`<p class="status" role="status" data-sch-stale=${attr}>${sch('stale', { t: stamp(f.fetchedAt, zone) || '—' })}</p>`;
  }

  // ------------------------------------------------------------------ render

  render() {
    const title = sch('title');
    if (isApi() && !this.access.screen) {
      return html`<sw-page heading=${title}><div data-sch data-sch-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${sch('noPermission')} data-sch-panel="forbidden"></sw-state-panel></div></sw-page>`;
    }
    if (!this.demo() && !this.feed) {
      return html`<sw-page heading=${title}><div data-sch data-sch-state=${this.error ? 'error' : 'loading'}>${this.error
        ? html`<sw-state-panel quiet state="error" heading=${sch('error')} actionLabel=${sch('retry')} data-sch-panel="error" @action=${() => this.refresh()}></sw-state-panel>`
        : html`<sw-state-panel quiet state="loading" heading=${sch('loading')} data-sch-panel="loading"></sw-state-panel>`}</div></sw-page>`;
    }
    if (!this.demo() && this.feed!.stations === null) {
      const state = this.feed!.state === 'ready' ? 'error' : this.feed!.state;
      const p = feedPanel(state);
      return html`<sw-page heading=${title}><div data-sch data-sch-state=${`feed:${this.feed!.state}`}>
        <sw-state-panel quiet state=${p.panel} heading=${p.heading} actionLabel=${p.panel === 'error' || p.panel === 'stale' ? sch('retry') : ''} data-sch-panel=${`feed:${this.feed!.state}`} @action=${() => this.refresh()}></sw-state-panel>
      </div></sw-page>`;
    }
    return this.renderReady();
  }

  private renderReady() {
    const stations = this.stations();
    const doors = doorsOf(stations);
    const view = this.effectiveView();
    const door = pickDoor(doors, this.wanted);
    const showLibrary = this.demo() ? false : this.access.library && this.library.state !== 'forbidden';
    const libCount = showLibrary && this.library.data ? this.library.data.length : null;
    const stale = !this.demo() && this.feed?.fresh === false;
    return html`<sw-page wide heading=${sch('title')} subheading=${subtitle(doors.length, libCount)}>
      ${this.access.edit && !this.demo()
        ? html`<sw-button slot="actions" variant="ghost" icon="edit" data-sch-edit @click=${() => (window.location.hash = CLASSIC_EDIT_HREF)}>${sch('editClassic')}</sw-button>`
        : nothing}
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${sch('refresh')} @click=${() => this.refresh()}>${sch('refresh')}</sw-button>
      <div data-sch data-sch-state=${doors.length ? 'ready' : 'empty'} data-sch-view=${view}>
        ${stale ? html`<p class="status" role="status" data-sch-stale="stations">${sch('stale', { t: stamp(this.feed?.fetched_at, this.feed?.default_zone ?? null) || '—' })}</p>` : nothing}
        ${doors.length && !this.narrow
          ? html`<div class="toolbar">
              <sw-view-switch data-sch-views label=${sch('viewLabel')} .value=${view} .options=${[
                { id: 'door', label: sch('viewDoor'), icon: 'calendar' },
                { id: 'table', label: sch('viewTable'), icon: 'table' },
              ]} @change=${(e: CustomEvent<string>) => this.setView(e.detail as View)}></sw-view-switch>
            </div>`
          : nothing}
        ${!doors.length
          ? html`<sw-state-panel quiet state="empty" heading=${sch('noDoors')} data-sch-panel="empty"></sw-state-panel>`
          : view === 'table'
            ? this.renderTable(doors)
            : this.renderDoorView(doors, door)}
        ${showLibrary ? this.renderLibrary(stations) : nothing}
      </div>
      ${doors.length ? this.renderSheet(doors, door) : nothing}
    </sw-page>`;
  }

  private renderDoorList(doors: readonly DoorRef[], current: DoorRef | null, inSheet = false) {
    return html`<nav class="doors" aria-label=${sch('doorsHeading')} data-sch-door-list=${inSheet ? 'sheet' : 'side'}>
      ${inSheet ? nothing : html`<div class="ttl">${sch('doorsHeading')}</div>`}
      ${doorGroups(doors).map(
        (g) => html`<div class="station" data-sch-station=${g.stationId}><span class="dot ${g.online ? '' : 'off'}" aria-hidden="true"></span>${g.stationName}</div>
          ${g.doors.map(
            (d) => html`<button type="button" aria-current=${String(d.key === current?.key)} data-sch-door=${d.key} @click=${() => this.pick(d.key)}><span class="name">${d.doorName}</span></button>`,
          )}`,
      )}
    </nav>`;
  }

  private renderSheet(doors: readonly DoorRef[], current: DoorRef | null) {
    return html`<sw-drawer modal ?open=${this.sheet} heading=${sch('pickDoor')} data-sch-sheet @close=${(e: Event) => e.target === e.currentTarget && (this.sheet = false)}>
      ${this.renderDoorList(doors, current, true)}
    </sw-drawer>`;
  }

  private renderDoorView(doors: readonly DoorRef[], door: DoorRef | null) {
    if (!door) return nothing;
    return html`<div class="layout">
      <aside class="doorcol"><sw-card flush>${this.renderDoorList(doors, door)}</sw-card></aside>
      <section class="main" data-sch-door-view=${door.key}>
        <button type="button" class="chip" data-sch-door-chip aria-haspopup="dialog" @click=${() => (this.sheet = true)}>
          <sw-icon name="door" size=${16}></sw-icon><span class="name">${sch('doorAt', { door: door.doorName, station: door.stationName })}</span><sw-icon name="chevronDown" size=${12}></sw-icon>
        </button>
        ${this.renderDoor(door)}
      </section>
    </div>`;
  }

  private renderCodePill(stationId: string) {
    const f = this.codesOf(stationId);
    const cs = f?.data ? codeState(f.data) : 'unknown';
    const kind: StateKind = cs === 'set' ? 'live' : cs === 'unset' ? 'neutral' : 'unknown';
    return html`<sw-badge kind=${kind} label=${sch('codePill', { state: codeWord(cs) })} data-sch-code=${cs}></sw-badge>`;
  }

  private renderDoor(door: DoorRef) {
    const f = this.programsOf(door.stationId);
    const zone = this.zoneOf(door.stationId);
    const head = html`<div class="doorhead">
      <h2 data-sch-door-title>${sch('doorAt', { door: door.doorName, station: door.stationName })}</h2>
      ${door.online ? nothing : html`<span class="sub" data-sch-offline>${sch('offline')}</span>`}
      <span class="sp"></span>
      ${this.renderCodePill(door.stationId)}
    </div>`;
    let body;
    if (!f || (f.state === 'loading' && !f.data)) body = html`<sw-state-panel compact quiet state="loading" heading=${sch('loading')} data-sch-panel="door-loading"></sw-state-panel>`;
    else if (f.state === 'unsupported') body = html`<sw-state-panel compact quiet state="empty" heading=${sch('sUnsupported')} data-sch-panel="door-unsupported"></sw-state-panel>`;
    else if (f.state === 'forbidden') body = html`<sw-state-panel compact quiet state="forbidden" heading=${sch('noPermission')} data-sch-panel="door-forbidden"></sw-state-panel>`;
    else if (!f.data) {
      body = f.state === 'busy'
        ? html`<sw-state-panel compact quiet state="stale" heading=${sch('busy')} data-sch-panel="door-busy"></sw-state-panel>`
        : html`<sw-state-panel compact quiet state="error" heading=${sch('error')} actionLabel=${sch('retry')} data-sch-panel="door-error" @action=${() => void this.loadStation(door.stationId)}></sw-state-panel>`;
    } else body = this.renderProgram(door, f, zone);
    return html`${head}${body}`;
  }

  private renderProgram(door: DoorRef, f: Fetch<StationPrograms>, zone: DisplayZone | null) {
    const s = doorSchedule(door, f.data)!;
    const stale = this.staleLine(f, zone, 'door');
    if (s.none) return html`${stale}<sw-card><div class="block"><sw-state-panel compact quiet state="empty" heading=${sch('noProgram')} data-sch-panel="no-program"></sw-state-panel></div></sw-card>`;
    const tone = programTone(s.state);
    return html`${stale}<sw-card>
      <div class="block" data-sch-program=${s.state}>
        <div class="bh"><h3>${sch('programsTitle')}</h3><span class="sp"></span><sw-badge kind=${KIND[tone]} label=${schDynamic(`st_${s.state}`, 'st_unknown')} data-sch-program-state=${s.state}></sw-badge></div>
        <div class="prog">
          <span class="name" data-sch-program-name>${s.name}</span>
          ${s.execution ? html`<span class="muted" data-sch-execution>${s.execution}</span>` : nothing}
        </div>
        <sw-week-grid data-sch-week aria-label=${sch('weekLabel')} .days=${s.days as unknown as WeekDays} .modes=${[{ id: 'hold', label: sch('legendHold'), color: 'var(--sw-accent)' }]}></sw-week-grid>
        ${s.unreadable ? html`<span class="muted" data-sch-hours-unknown>${sch('hoursUnknown')}</span>` : nothing}
        ${s.lines.length ? html`<ul class="lines" data-sch-lines>${s.lines.map((l) => html`<li>${l}</li>`)}</ul>` : nothing}
        ${s.dates.length ? html`<div class="dates" data-sch-dates><h4>${sch('datesTitle')}</h4><ul class="lines">${s.dates.map((l) => html`<li>${l}</li>`)}</ul></div>` : nothing}
        ${s.checkedAt || s.timezone
          ? html`<span class="muted">${[s.checkedAt ? sch('checked', { when: stamp(s.checkedAt, zone) }) : '', s.timezone ? sch('zone', { zone: s.timezone }) : ''].filter(Boolean).join(' · ')}</span>`
          : nothing}
      </div>
    </sw-card>`;
  }

  private renderTable(doors: readonly DoorRef[]) {
    const programs = Object.fromEntries(doors.map((d) => [d.stationId, this.programsOf(d.stationId)?.data ?? null]));
    const codes = Object.fromEntries(doors.map((d) => [d.stationId, this.codesOf(d.stationId)?.data ?? null]));
    // a station not read yet stays "unknown" in its rows (doorSchedule(null)), never "none"
    const rows = tableRows(doors, programs, codes);
    const cols: TableColumn<TableRow>[] = [
      { key: 'door', label: sch('colDoor'), render: (r) => html`<b>${r.door}</b>` },
      { key: 'station', label: sch('colStation') },
      { key: 'program', label: sch('colProgram') },
      { key: 'kind', label: sch('colKind') },
      { key: 'when', label: sch('colWhen') },
      { key: 'state', label: sch('colState'), render: (r) => (r.state ? html`<sw-badge kind=${KIND[r.tone]} label=${r.state}></sw-badge>` : '') },
      { key: 'code', label: sch('colCode'), render: (r) => html`<span data-sch-code=${r.codeState}>${r.code}</span>` },
    ];
    return html`<sw-table dense data-sch-table .rowKey=${'key'} .columns=${cols as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]} @row-select=${(e: CustomEvent<{ id: string }>) => this.pick(e.detail.id)}></sw-table>`;
  }

  private renderLibrary(stations: readonly AccessStation[]) {
    const names = stationNamer(stations);
    const zone = this.feed?.default_zone ?? null;
    const lib = this.library;
    const plans = this.plans.state === 'forbidden' ? null : this.plans;
    const block = (title: string, attr: string, f: Fetch<unknown>, count: number | null, rows: unknown) => html`<sw-card>
      <div class="block" data-sch-block=${attr}>
        <div class="bh"><h3>${title}</h3>${count !== null ? html`<span class="n">${count}</span>` : nothing}</div>
        ${f.state === 'loading' && !f.data
          ? html`<sw-state-panel compact quiet state="loading" heading=${sch('loading')}></sw-state-panel>`
          : f.state === 'unsupported'
            ? html`<sw-state-panel compact quiet state="empty" heading=${sch('sUnsupported')} data-sch-panel=${`${attr}-unsupported`}></sw-state-panel>`
            : !f.data
              ? f.state === 'busy'
                ? html`<sw-state-panel compact quiet state="stale" heading=${sch('busy')} data-sch-panel=${`${attr}-busy`}></sw-state-panel>`
                : html`<sw-state-panel compact quiet state="error" heading=${sch('error')} actionLabel=${sch('retry')} data-sch-panel=${`${attr}-error`} @action=${() => this.refresh()}></sw-state-panel>`
              : html`${this.staleLine(f, zone, attr)}${rows}`}
      </div>
    </sw-card>`;
    const libRows = libraryRows(lib.data, plans?.data ?? null, names);
    const planList = planRows(plans?.data ?? null, this.ops.state === 'forbidden' ? null : this.ops.data, lib.data, names);
    const libBody = libRows.length
      ? html`<div class="rows">${libRows.map(
          (r) => html`<div class="row" data-sch-lib-row=${r.id}>
            <div class="main"><span class="t">${r.name}${r.version ? html` <span class="muted">${r.version}</span>` : nothing}</span>
              ${r.lines.map((l) => html`<span class="s">${l}</span>`)}
              <span class="s">${[r.holidays, r.proposals].filter(Boolean).join(' · ')}</span></div>
          </div>`,
        )}</div>`
      : html`<sw-state-panel compact quiet state="empty" heading=${sch('libraryEmpty')} data-sch-panel="library-empty"></sw-state-panel>`;
    const planBody = planList.length
      ? html`<div class="rows">${planList.map(
          (p) => html`<div class="row" data-sch-plan-row=${p.id}>
            <div class="main"><span class="t">${p.name} · ${p.station}</span>
              <span class="s">${[p.state !== p.source ? p.source : '', p.outdated ? sch('outdated') : '', p.notApplied ? sch('notApplied') : '', p.checkedAt ? sch('checked', { when: stamp(p.checkedAt, (p.stationId && this.zoneOf(p.stationId)) || zone) }) : ''].filter(Boolean).join(' · ')}</span></div>
            <sw-badge kind=${KIND[p.tone]} label=${p.state} data-sch-plan-state=${p.tone}></sw-badge>
          </div>`,
        )}</div>`
      : html`<sw-state-panel compact quiet state="empty" heading=${sch('plansEmpty')} data-sch-panel="plans-empty"></sw-state-panel>`;
    return html`<div class="two" data-sch-library>
      ${block(sch('libraryTitle'), 'library', lib, lib.data ? lib.data.length : null, libBody)}
      ${plans ? block(sch('plansTitle'), 'plans', plans, plans.data ? plans.data.length : null, planBody) : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-schedules': WiskeySchedules;
  }
}
