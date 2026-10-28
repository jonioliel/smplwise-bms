import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-field';
import '../components/sw-table';
import '../components/sw-dropdown';
import '../components/sw-dialog';
import '../components/sw-drawer';
import './wiskey-event-drawer';
import './wiskey-events-export';
import type { TableColumn } from '../components/sw-table';
import type { DropdownItem } from '../components/sw-dropdown';
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import { isApi } from '../api/session';
import { subscribeIntercom, type DisplayZone } from '../api/intercom';
import {
  featureOffered,
  getAccessEvents,
  getAccessFeatures,
  getAccessStations,
  type AccessEvent,
  type AccessEventFilters,
  type AccessEventsReply,
  type AccessFeaturesReply,
  type AccessStationInfo,
} from '../api/access-events';
import { accessControlAccess } from '../access-control/access';
import { EventsFeed, type FeedSnapshot } from '../access-control/events-feed';
import {
  activeFilterCount,
  AUTH_CHOICES,
  dateLabel,
  dateOf,
  DOOR_CHOICES,
  EMPTY_FILTERS,
  failureOf,
  filtersFromHash,
  filterZone,
  groupByDay,
  incompleteHistory,
  localDate,
  addDays,
  localTime,
  pillKey,
  rangeBounds,
  RESULT_CHOICES,
  rezoneCustom,
  rowTitle,
  rowTone,
  showsMethod,
  wireFilters,
  type EventFilterState,
  type RangeKey,
  type Tone,
  type ZoneContext,
} from '../access-control/events-logic';
import { printDocument, printHtml } from '../access-control/events-print';
import { glyph } from '../access-control/glyphs';
import { ev, evDynamic, evLang } from '../i18n/access-events';
import { navigate } from '../router';
import { t as wiskeyText, UTC_ZONE } from './wiskey-format';
import { dateInputLang } from '../api/day-format';

const POLL_MS = 30000; // while the change notices are down the list is re-read this often (WisKey's own panel: 30 s)
const SEARCH_MS = 450;
const VIEW_KEY = 'sw.wiskey.events.view';
type ViewMode = 'list' | 'table';

const DEMO_ZONE: DisplayZone = { kind: 'iana', name: 'Asia/Jerusalem' };
const DEMO_STATIONS: AccessStationInfo[] = [
  { id: 'd1', name: 'שער ראשי', online: true, zone: DEMO_ZONE },
  { id: 'd2', name: 'לובי', online: true, zone: DEMO_ZONE },
  { id: 'd3', name: 'חניון', online: true, zone: DEMO_ZONE },
];
const demoRow = (id: string, station_id: string, timestamp: string, person_name: string | null, over: Partial<AccessEvent> = {}): AccessEvent => ({
  id, station_id, timestamp, received_at: timestamp, time_source: 'device', person_name, employee_no: null, authentication: 'card', result: 'granted', event_type: 'access_granted', recovered: false, door: 1, portrait: null, ...over,
});
const DEMO_REPLY: AccessEventsReply = {
  state: 'ready', configured: true, last_error: null, fetched_at: null,
  events: {
    records: [
      demoRow('e1', 'd1', '2026-09-27T07:58:12+03:00', 'דנה כהן'),
      demoRow('e2', 'd2', '2026-09-27T07:41:03+03:00', null, { authentication: 'pin', employee_no: '2044', door: 2 }),
      demoRow('e3', 'd3', '2026-09-26T22:10:40+03:00', null, { authentication: 'unknown', result: 'denied', event_type: 'access_denied', door: null }),
      demoRow('e4', 'd1', '2026-09-26T18:03:55+03:00', 'יוסי לוי', { authentication: 'pin', result: 'denied', event_type: 'access_denied' }),
      demoRow('e5', 'd2', '2026-09-26T17:30:00+03:00', null, { authentication: 'unknown', result: 'unknown', event_type: 'ring', door: null }),
    ],
    next: null, retention_days: 30, capacity: 5000, membership_basis: null, storage_failed: false, stations: {}, complete: true, incomplete_reason: null,
  },
};

const CELL_STYLE = 'min-block-size:max(44px,var(--sw-touch-desktop,44px));padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer';
const PILL_KIND: Record<Tone, StateKind> = { ok: 'live', err: 'error', warn: 'stale', acc: 'recorded', unk: 'unknown', neutral: 'neutral' };

/**
 * "פעילות" - the entry log of the access-control area (CR-036 slice S8; the first native version is CR-005 phase 1b). Rows come from
 * the typed read `GET /access-control/events` (`access.events.read` per station: the server omits rows and fields the caller may not
 * see - this screen never filters for permission, it only shapes itself from what the server sent). Built to the approved mock-up
 * (docs/design/WISKEY_SCREENS_DESIGN.md section 3.3): a day-grouped list or a table, filter chips (period, station, result, method,
 * door) and a search, a detail drawer with the event picture, a CSV export and the browser's print of the list.
 *
 * The data rules this screen keeps (see also access-control/events-feed.ts):
 *  - the entry log has no push: the integration only says "something changed", and then page 1 is re-read - or, when more pages are
 *    shown, the reader keeps their place and is offered a refresh; while those notices are down the list is re-read every 30 s;
 *  - `next` is an opaque cursor and goes back as `before` exactly as served;
 *  - the event picture is fetched only when a row is opened and the server said `portrait: true` - each view is an audited read;
 *  - a period is a day of the FILTER ZONE (the station's own clock zone), never of the browser; a wall time DST repeats or skips is refused;
 *  - operator screen: no hint paragraphs, no platform names; the states are short, the management stays in the Settings.
 */
@customElement('wiskey-events')
export class WiskeyEvents extends LitElement {
  @state() private rev = 0;
  @state() private noAccess = false;
  @state() private stations: AccessStationInfo[] | null = null;
  @state() private defaultZone: DisplayZone = UTC_ZONE;
  @state() private features: AccessFeaturesReply | null = null;
  @state() private filters: EventFilterState = { ...EMPTY_FILTERS };
  @state() private filterNote = '';
  @state() private customOpen = false;
  @state() private customDraft = { start: '', end: '' };
  @state() private customError = '';
  @state() private view: ViewMode = 'list';
  @state() private phone = false;
  @state() private selectedId = '';
  @state() private exportOpen = false;
  @state() private note = '';
  @state() private search = '';
  private known: { start?: string | null; end?: string | null } = {};
  private feed: EventsFeed;
  private stop: (() => void) | null = null;
  private poll = 0;
  private searchTimer = 0;
  private stationsBusy = false;
  private stationsAgain = false;
  private media: MediaQueryList | null = null;

  private session = 0;

  constructor() {
    super();
    this.feed = this.makeFeed();
  }

  private makeFeed(): EventsFeed {
    return new EventsFeed((filters, before) => this.fetchPage(filters, before), () => (this.rev += 1));
  }

  connectedCallback() {
    super.connectedCallback();
    this.media = typeof matchMedia === 'function' ? matchMedia('(max-width: 767px)') : null;
    this.phone = !!this.media?.matches;
    this.media?.addEventListener('change', this.onMedia);
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === 'table' || saved === 'list') this.view = saved;
    } catch {
      /* storage unavailable: the default view */
    }
    if (!isApi()) return; // a static preview shows invented rows (render)
    if (this.feed.disposed) this.feed = this.makeFeed(); // the same element attached again: a feed of its own
    if (!accessControlAccess().events) {
      this.noAccess = true;
      this.feed.markForbidden();
      return;
    }
    this.filters = filtersFromHash(window.location.hash);
    this.search = this.filters.person;
    void this.start(++this.session);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.session++;
    this.media?.removeEventListener('change', this.onMedia);
    this.stop?.();
    this.stop = null;
    this.setPolling(false);
    window.clearTimeout(this.searchTimer);
    this.feed.dispose();
  }

  /** The first load waits for the station list: the clock zones are what a "today" period is read in, so the first request already
   * carries the right instants (a deep link with `range=today` included); the change notices are subscribed after it. */
  private async start(session: number) {
    void this.loadFeatures();
    await this.loadStations();
    if (session !== this.session) return; // detached meanwhile
    this.apply();
    this.stop = subscribeIntercom(
      (m) => {
        if (m.type === 'intercom_refresh' || m.type === 'intercom_state') this.onChangeNotice();
      },
      (connected) => {
        this.setPolling(!connected);
        if (connected) this.onChangeNotice(); // notices sent while the socket was down are gone: catch up now
      },
    );
  }

  private onMedia = (e: MediaQueryListEvent) => {
    this.phone = e.matches;
  };

  private setPolling(on: boolean) {
    window.clearInterval(this.poll);
    this.poll = on ? window.setInterval(() => this.onChangeNotice(), POLL_MS) : 0;
  }

  // ------------------------------------------------------------------ data

  private fetchPage(filters: AccessEventFilters, before: string | null): Promise<AccessEventsReply> {
    return getAccessEvents(filters, before);
  }

  private zoneContext(): ZoneContext {
    return { zoneOf: (id) => this.stations?.find((s) => s.id === id)?.zone ?? null, fallback: this.defaultZone };
  }

  /** Station names, clock zones and the default zone: the typed `stations` read (the feed's live copy - no call to the integration),
   * single-flight with coalescing. A caller without `access.read` gets no names; rows then show the station id. */
  private async loadStations() {
    if (this.stationsBusy) {
      this.stationsAgain = true;
      return;
    }
    this.stationsBusy = true;
    try {
      do {
        this.stationsAgain = false;
        try {
          const r = await getAccessStations();
          if (r.stations) {
            this.stations = r.stations;
            this.defaultZone = r.default_zone ?? UTC_ZONE;
            this.rezone();
          }
        } catch {
          /* names are optional: the rows show the station id until they arrive */
        }
      } while (this.stationsAgain);
    } finally {
      this.stationsBusy = false;
    }
  }

  private async loadFeatures() {
    try {
      this.features = await getAccessFeatures();
    } catch {
      this.features = null; // every feature is then offered; the server answers "unsupported" for a missing one
    }
  }

  /** A relative period ("today") is recomputed before each reload: a screen left open past midnight must not keep yesterday's start. */
  private fresh() {
    if (this.filters.range === 'all' || this.filters.range === 'custom') return;
    const w = wireFilters(this.filters, new Date(), this.zoneContext(), this.known);
    if ('filters' in w) this.feed.setFilters(w.filters);
  }

  private onChangeNotice() {
    void this.loadStations();
    this.fresh();
    void this.feed.notice();
  }

  private refresh() {
    this.fresh();
    void this.feed.reload();
  }

  // ------------------------------------------------------------------ filters

  /** The chips as they are now become the server's filters and the list restarts; a period that cannot be sent says why. */
  private apply() {
    if (!isApi()) return; // the static preview is not a feed
    const w = wireFilters(this.filters, new Date(), this.zoneContext(), this.known);
    if ('error' in w) {
      this.filterNote = w.error;
      return;
    }
    this.filterNote = '';
    this.known = { start: w.start, end: w.end };
    this.selectedId = '';
    void this.feed.restart(w.filters);
  }

  /** The zone the period is typed in changed (another station chosen): re-project a custom period, keeping the instants. */
  private rezone() {
    const f = this.filters;
    if (f.station_id && this.stations && !this.stations.some((s) => s.id === f.station_id)) {
      this.filters = { ...f, station_id: '' };
      this.apply();
      return;
    }
  }

  private set<K extends keyof EventFilterState>(key: K, value: EventFilterState[K]) {
    const before = this.filters;
    let next: EventFilterState = { ...before, [key]: value };
    if (key === 'station_id' && before.range === 'custom') {
      const moved = rezoneCustom(next, filterZone(before, this.zoneContext()), filterZone(next, this.zoneContext()), this.known);
      next = moved.state;
      this.known = moved.known;
      this.filterNote = moved.cleared ? 'filter_zone_changed_invalid' : '';
    }
    this.filters = next;
    this.apply();
  }

  private onRange(id: string) {
    if (id === 'custom') {
      const zone = filterZone(this.filters, this.zoneContext());
      const start = this.filters.customStart;
      const end = this.filters.customEnd;
      const today = localDate(Date.now(), zone);
      this.customDraft = { start: start || `${today}T00:00`, end: end || '' };
      this.customError = '';
      this.customOpen = true;
      return;
    }
    this.set('range', id as RangeKey);
  }

  private applyCustom() {
    const next: EventFilterState = { ...this.filters, range: 'custom', customStart: this.customDraft.start, customEnd: this.customDraft.end };
    const zone = filterZone(next, this.zoneContext());
    const b = rangeBounds(next, new Date(), zone, {});
    if ('error' in b) {
      this.customError = b.error;
      return;
    }
    this.customOpen = false;
    this.known = {};
    this.filters = next;
    this.apply();
  }

  private clearAll() {
    this.filters = { ...EMPTY_FILTERS };
    this.search = '';
    this.known = {};
    this.filterNote = '';
    this.apply();
  }

  private onSearch(value: string) {
    this.search = value;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.commitSearch(), SEARCH_MS);
  }

  private commitSearch() {
    window.clearTimeout(this.searchTimer);
    const person = this.search.trim();
    if (person === this.filters.person.trim()) return;
    this.set('person', person);
  }

  private setView(v: ViewMode) {
    this.view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* the choice just does not persist */
    }
  }

  // ------------------------------------------------------------------ words

  private stationList(): AccessStationInfo[] {
    return isApi() ? this.stations ?? [] : DEMO_STATIONS;
  }

  private stationName(id: string | null): string {
    if (!id) return '—';
    const s = this.stationList().find((x) => x.id === id);
    if (s) return s.name;
    return (isApi() ? this.stations : DEMO_STATIONS) ? ev('removedStation') : id;
  }

  private zoneOf(e: AccessEvent): DisplayZone {
    return this.stationList().find((s) => s.id === e.station_id)?.zone ?? (isApi() ? this.defaultZone : DEMO_ZONE);
  }

  private methodText(e: AccessEvent): string {
    return e.authentication === 'card' ? ev('card') : e.authentication === 'pin' ? ev('pin') : ev('unknown');
  }

  private titleText(e: AccessEvent): string {
    const t = rowTitle(e);
    if (t.kind === 'person' || t.kind === 'employee') return t.text;
    if (t.kind === 'ring') return ev('ring');
    if (t.kind === 'unidentified') return ev('unidentified');
    return evDynamic('type_', t.text);
  }

  private pillLabel(e: AccessEvent): string {
    const k = pillKey(e);
    return k === 'granted' ? ev('granted') : k === 'denied' ? ev('denied') : evDynamic('type_', k);
  }

  private subText(e: AccessEvent): string {
    return [this.stationName(e.station_id), e.door ? ev('doorN', { n: e.door }) : '', showsMethod(e) ? this.methodText(e) : ''].filter(Boolean).join(' · ');
  }

  private dayWord(zone: DisplayZone, date: string, now: Date): string {
    if (!date) return ev('dayUnknown');
    const today = localDate(now.getTime(), zone);
    return date === today ? ev('dayToday') : date === addDays(today, -1) ? ev('dayYesterday') : dateLabel(date);
  }

  private whenText(e: AccessEvent, now: Date): string {
    const zone = this.zoneOf(e);
    const date = dateOf(e.timestamp, zone);
    return `${this.dayWord(zone, date, now)} ${localTime(e.timestamp, zone)}`;
  }

  private updatedText(shownAt: string | null, stale: boolean): string {
    const t = shownAt ? localTime(shownAt, this.defaultZone) : '';
    if (!t || t === '—') return stale ? ev('staleNever') : '';
    return ev(stale ? 'staleAt' : 'updatedAt', { t });
  }

  // ------------------------------------------------------------------ actions

  private open(id: string) {
    this.selectedId = id;
  }

  private closeDrawer() {
    this.selectedId = '';
  }

  private print() {
    const records = this.feed.snap.page?.records ?? [];
    this.note = '';
    if (!records.length) {
      this.note = ev('prNothing');
      return;
    }
    const now = new Date();
    const zone = filterZone(this.filters, this.zoneContext());
    const rangeText = this.filters.range === 'all' ? ev('rangeAll') : this.filters.range === 'today' ? ev('rangeToday') : this.filters.range === 'yesterday' ? ev('rangeYesterday') : this.filters.range === 'week' ? ev('rangeWeek') : ev('rangeCustomShown');
    const subtitle = [ev('prPeriod', { range: rangeText }), this.filters.station_id ? ev('prStation', { name: this.stationName(this.filters.station_id) }) : ''].filter(Boolean).join(' · ');
    const rows = records.map((e) => {
      const z = this.zoneOf(e);
      const t = rowTitle(e);
      const person = t.kind === 'person' ? [t.text, e.employee_no].filter(Boolean).join(' · ') : this.titleText(e);
      return [`${dateLabel(dateOf(e.timestamp, z))} ${localTime(e.timestamp, z, true)}`, this.pillLabel(e), person, this.stationName(e.station_id), e.door ? String(e.door) : '', showsMethod(e) ? this.methodText(e) : ''];
    });
    const doc = printDocument({
      title: ev('prTitle'),
      subtitle,
      columns: [ev('colTime'), ev('colResult'), ev('colPerson'), ev('colStation'), ev('colDoor'), ev('colMethod')],
      rows,
      footer: ev('prFooter', { t: `${dateLabel(localDate(now.getTime(), zone))} ${localTime(now.toISOString(), zone)}`, n: rows.length }),
      lang: evLang(),
    });
    if (!printHtml(doc)) this.note = ev('prUnavailable');
  }

  private toSettings() {
    navigate('/system/access-control');
  }

  // ------------------------------------------------------------------ render

  render() {
    const demo = !isApi();
    if (!demo && (this.noAccess || this.feed.snap.forbidden)) {
      return html`<sw-page heading=${ev('title')}><sw-state-panel quiet data-wiskey-state="no_permission" state="forbidden" heading=${ev('noPermission')}></sw-state-panel></sw-page>`;
    }
    const s = demo ? { ...EventsFeed.initial(), reply: DEMO_REPLY, page: DEMO_REPLY.events, pages: 1, everReady: true } : this.feed.snap;
    const reply = s.reply;
    const stale = !!s.page && !!reply && reply.state !== 'ready';
    // while the rows are stale the banner below says so, with the time they were read: the subtitle does not say it twice
    return html`<sw-page heading=${ev('title')} subheading=${stale ? '' : this.updatedText(s.shownAt, false)} wide>
      ${this.renderActions(demo, s.page?.records.length ?? 0)}
      ${this.renderChips()}
      ${this.renderNotes(s, stale)}
      ${this.renderBody(s, demo)}
      ${this.renderDrawer(s.page?.records ?? [], demo)}
      ${this.renderCustom()}
      ${demo ? nothing : html`<wiskey-events-export ?open=${this.exportOpen} .filters=${this.feed.filters} .stations=${this.stationList()} .zone=${filterZone(this.filters, this.zoneContext())} @close=${() => (this.exportOpen = false)}></wiskey-events-export>`}
    </sw-page>`;
  }

  private renderActions(demo: boolean, count: number) {
    const canExport = !demo && accessControlAccess().export && featureOffered(this.features, 'events_export');
    const table = this.view === 'table' && !this.phone;
    const ph = this.phone;
    // on a phone the three buttons are icons (44 px) on the search's own row; their words stay for assistive technology. The row then
    // leaves the page header's actions slot (a shrink-wrapped box beside the title, where the search would get no width) and takes a row
    // of the page's own
    return html`<div slot=${ifDefined(ph ? undefined : 'actions')} class="actions" data-phone=${String(ph)}>
      <label class="search">
        <sw-icon name="search" size=${16}></sw-icon>
        <input type="search" data-wiskey-search aria-label=${ev('searchLabel')} placeholder=${ev('searchPlaceholder')} maxlength="128" .value=${this.search} ?disabled=${demo}
          @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.commitSearch()} />
      </label>
      ${canExport ? html`<sw-button size="lg" class="ib" ?block=${ph} data-wiskey-export icon="download" @click=${() => (this.exportOpen = true)}><span class="lbl">${ev('export')}</span></sw-button>` : nothing}
      <sw-button size="lg" class="ib" ?block=${ph} data-wiskey-print ?disabled=${demo || !count} @click=${() => this.print()}><span class="bl">${glyph('print', 15)}<span class="lbl">${ev('print')}</span></span></sw-button>
      ${ph
        ? nothing
        : html`<div class="seg" role="group" aria-label=${ev('viewGroup')}>
            <button type="button" data-wiskey-view="list" aria-pressed=${String(!table)} title=${ev('viewList')} aria-label=${ev('viewList')} @click=${() => this.setView('list')}><sw-icon name="list" size=${16}></sw-icon></button>
            <button type="button" data-wiskey-view="table" aria-pressed=${String(table)} title=${ev('viewTable')} aria-label=${ev('viewTable')} @click=${() => this.setView('table')}>${glyph('table', 16)}</button>
          </div>`}
      ${demo ? nothing : html`<sw-button size="lg" class="ib" ?block=${ph} data-wiskey-events-refresh variant="ghost" icon="refresh" ?disabled=${this.feed.snap.busy} @click=${() => this.refresh()}><span class="lbl">${ev('refresh')}</span></sw-button>`}
    </div>`;
  }

  private rangeItems(): DropdownItem[] {
    return [
      { id: 'all', label: ev('rangeAll') },
      { id: 'today', label: ev('rangeToday') },
      { id: 'yesterday', label: ev('rangeYesterday') },
      { id: 'week', label: ev('rangeWeek') },
      { id: 'custom', label: ev('rangeCustomShown') },
    ];
  }

  private renderChips() {
    const f = this.filters;
    const stations: DropdownItem[] = [{ id: '', label: ev('stationAll') }, ...this.stationList().map((s) => ({ id: s.id, label: s.name }))];
    const results: DropdownItem[] = [{ id: '', label: ev('resultAll') }, ...RESULT_CHOICES.map((r) => ({ id: r, label: ev(r) }))];
    const methods: DropdownItem[] = [{ id: '', label: ev('methodAll') }, ...AUTH_CHOICES.map((a) => ({ id: a, label: a === 'card' ? ev('card') : a === 'pin' ? ev('pin') : ev('unknown') }))];
    const doors: DropdownItem[] = [{ id: '', label: ev('doorAll') }, ...DOOR_CHOICES.map((d) => ({ id: d, label: ev('doorN', { n: d }) }))];
    return html`<div class="chips" role="group" aria-label=${ev('filters')} data-wiskey-events-filters>
      <sw-dropdown tall data-wiskey-filter="range" label=${ev('range')} icon="calendar" .items=${this.rangeItems()} .value=${f.range} @change=${(e: CustomEvent<{ id: string }>) => this.onRange(e.detail.id)}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="station" label=${ev('station')} icon="door" .items=${stations} .value=${f.station_id} @change=${(e: CustomEvent<{ id: string }>) => this.set('station_id', e.detail.id)}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="result" label=${ev('result')} icon="check" .items=${results} .value=${f.result} @change=${(e: CustomEvent<{ id: string }>) => this.set('result', e.detail.id as EventFilterState['result'])}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="method" label=${ev('method')} icon="lock" .items=${methods} .value=${f.authentication} @change=${(e: CustomEvent<{ id: string }>) => this.set('authentication', e.detail.id as EventFilterState['authentication'])}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="door" label=${ev('door')} icon="unlock" .items=${doors} .value=${f.door} @change=${(e: CustomEvent<{ id: string }>) => this.set('door', e.detail.id as EventFilterState['door'])}></sw-dropdown>
      ${activeFilterCount(f) ? html`<sw-button variant="ghost" size="lg" data-wiskey-filter-clear @click=${() => this.clearAll()}>${ev('clear')}</sw-button>` : nothing}
    </div>`;
  }

  private renderNotes(s: FeedSnapshot, stale: boolean) {
    const page = s.page;
    const gaps = page ? incompleteHistory(page) : [];
    return html`
      ${stale ? html`<div class="note stale" role="status" data-wiskey-stale><sw-icon name="offline" size=${16}></sw-icon><span>${this.updatedText(s.shownAt, true)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => this.refresh()}>${ev('refresh')}</sw-button></div>` : nothing}
      ${s.pendingUpdate ? html`<div class="note info" role="status" data-wiskey-events-pending><sw-icon name="info" size=${16}></sw-icon><span>${ev('pending')}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => this.refresh()}>${ev('refresh')}</sw-button></div>` : nothing}
      ${s.cursorExpired ? html`<div class="note err" role="alert" data-wiskey-events-cursor-expired><sw-icon name="warning" size=${16}></sw-icon><span>${ev('cursorExpired')}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => this.refresh()}>${ev('reloadFromStart')}</sw-button></div>` : nothing}
      ${page?.storage_failed ? html`<div class="note err" role="alert" data-wiskey-events-storage><sw-icon name="warning" size=${16}></sw-icon><span>${ev('storageFailed')}</span></div>` : nothing}
      ${gaps.map((id) => html`<div class="note stale" role="status" data-wiskey-events-history=${id}><sw-icon name="warning" size=${16}></sw-icon><span>${ev('historyGap', { name: this.stationName(id) })}</span></div>`)}
      ${this.filterNote === 'filter_zone_changed_invalid' ? html`<div class="note info" role="status" data-wiskey-events-filter-note><span>${wiskeyText(this.filterNote)}</span></div>` : nothing}
      ${this.filterNote && this.filterNote !== 'filter_zone_changed_invalid' ? html`<div class="note err" role="alert" data-wiskey-events-filter-error=${this.filterNote}><span>${wiskeyText(this.filterNote)}</span></div>` : nothing}
      ${this.note ? html`<div class="note info" role="status" data-wiskey-events-note><span>${this.note}</span></div>` : nothing}
    `;
  }

  private panel(reply: AccessEventsReply | null, error: string) {
    if (!reply) {
      return html`<sw-state-panel data-wiskey-state="load_error" state="error" heading=${ev('stateError')} hint=${error || ev('stateErrorHint')} actionLabel=${ev('retry')} @action=${() => this.refresh()}></sw-state-panel>`;
    }
    const admin = accessControlAccess().admin;
    const f = failureOf(reply.state, reply.last_error);
    type P = { panel: PanelState; heading: string; hint?: string; action?: string };
    const by: Partial<Record<AccessEventsReply['state'], P>> = {
      ha_not_configured: { panel: 'stale', heading: ev('stateNotConfigured'), action: admin ? ev('toSettings') : undefined },
      connecting: { panel: 'loading', heading: ev('stateConnecting') },
      ha_unavailable: { panel: 'stale', heading: ev('stateUnavailable'), hint: ev('stateUnavailableHint') },
      not_installed: { panel: 'empty', heading: ev('stateNotInstalled'), action: admin ? ev('toSettings') : undefined },
      forbidden: { panel: 'forbidden', heading: ev('stateRefused') },
      unsupported: { panel: 'empty', heading: ev('stateUnsupported') },
    };
    const p: P =
      by[reply.state] ??
      (f === 'rate' ? { panel: 'stale', heading: ev('stateRate'), hint: ev('stateRateHint'), action: ev('retry') } : { panel: 'error', heading: ev('stateError'), hint: ev('stateErrorHint'), action: ev('retry') });
    return html`<sw-state-panel icon="history" quiet data-wiskey-state=${reply.state} state=${p.panel} heading=${p.heading} hint=${p.hint ?? ''} actionLabel=${p.action ?? ''}
      @action=${() => (p.action === ev('toSettings') ? this.toSettings() : this.refresh())}></sw-state-panel>`;
  }

  private skeleton() {
    return html`<sw-card flush><div class="sk-list" aria-busy="true" data-wiskey-events-loading>${[0, 1, 2, 3, 4, 5, 6, 7].map(() => html`<div class="sk-row"><span class="sk dotp"></span><span class="sk-main"><span class="sk l"></span><span class="sk m"></span></span><span class="sk pill"></span></div>`)}</div></sw-card>`;
  }

  private renderBody(s: FeedSnapshot, demo: boolean) {
    const page = s.page;
    if (!page) {
      // loading: the first answer, or the answer for new filters (the old rows are gone, the old reply is not a verdict on the new ones)
      if (s.busy || (!s.reply && !s.error)) return this.skeleton();
      return this.panel(s.reply, s.error);
    }
    const records = page.records;
    const more = page.next && !demo
      ? html`<div class="more"><sw-button size="lg" data-wiskey-events-more ?disabled=${s.busy} @click=${() => void this.feed.more()}>${s.loadingMore ? ev('loadingMore') : ev('more')}</sw-button></div>`
      : nothing;
    if (!records.length) {
      if (page.next) return html`<sw-state-panel icon="history" quiet compact state="empty" data-wiskey-events-empty heading=${ev('emptyMore')}></sw-state-panel>${more}`;
      const filtered = activeFilterCount(this.filters) > 0;
      return html`<sw-state-panel icon="history" quiet state="empty" data-wiskey-events-empty heading=${filtered ? ev('empty') : ev('emptyAll')} actionLabel=${filtered ? ev('clear') : ''} @action=${() => this.clearAll()}></sw-state-panel>`;
    }
    const table = this.view === 'table' && !this.phone;
    return html`<span class="sr" data-wiskey-events-count=${records.length}></span>${table ? this.renderTable(records) : this.renderList(records)}${more}`;
  }

  private renderList(records: AccessEvent[]) {
    const now = new Date();
    const groups = groupByDay(records, (e) => this.zoneOf(e), now);
    return html`<sw-card flush class="feed" data-wiskey-events-list>
      ${groups.map(
        (g) => html`<div class="grp" role="heading" aria-level="3" data-wiskey-day=${g.date || 'unknown'}>${g.kind === 'today' ? ev('dayToday') : g.kind === 'yesterday' ? ev('dayYesterday') : g.kind === 'unknown' ? ev('dayUnknown') : dateLabel(g.date)}</div>
          ${g.rows.map((e) => this.renderRow(e))}`,
      )}
    </sw-card>`;
  }

  private renderRow(e: AccessEvent) {
    const zone = this.zoneOf(e);
    const tone = rowTone(e);
    const title = this.titleText(e);
    return html`<button type="button" class="row" data-row-id=${e.id} data-row-tone=${tone.dot} data-wiskey-event @click=${() => this.open(e.id)}>
      <time class="time" datetime=${e.timestamp ?? ''} data-wiskey-event-time><bdi>${localTime(e.timestamp, zone)}</bdi></time>
      <span class="dot ${tone.dot}" aria-hidden="true"></span>
      <span class="main"><span class="t" data-wiskey-event-person>${title}</span><span class="s" data-wiskey-event-station>${this.subText(e)}</span></span>
      <sw-badge data-wiskey-event-result=${e.result} kind=${PILL_KIND[tone.pill]} label=${this.pillLabel(e)}></sw-badge>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`;
  }

  private columns(now: Date): TableColumn[] {
    const row = (r: Record<string, unknown>) => r as unknown as AccessEvent;
    return [
      {
        key: 'time',
        label: ev('colTime'),
        // rendered inside the table's own shadow root, so the button is styled inline (this screen's stylesheet does not reach it)
        render: (r) => html`<button type="button" style=${CELL_STYLE} data-wiskey-event @click=${() => this.open(row(r).id)}><time datetime=${row(r).timestamp ?? ''} data-wiskey-event-time><bdi>${this.whenText(row(r), now)}</bdi></time></button>`,
      },
      {
        key: 'result',
        label: ev('colResult'),
        render: (r) => html`<sw-badge data-wiskey-event-result=${row(r).result} kind=${PILL_KIND[rowTone(row(r)).pill]} label=${this.pillLabel(row(r))}></sw-badge>`,
      },
      {
        key: 'person',
        label: ev('colPerson'),
        render: (r) => {
          const e = row(r);
          const t = rowTitle(e);
          return html`<span data-wiskey-event-person>${t.kind === 'person' ? html`${t.text}${e.employee_no ? html` · <bdi>${e.employee_no}</bdi>` : nothing}` : this.titleText(e)}</span>`;
        },
      },
      { key: 'station', label: ev('colStation'), render: (r) => html`<span data-wiskey-event-station>${this.stationName(row(r).station_id)}</span>` },
      { key: 'door', label: ev('colDoor'), render: (r) => (row(r).door ? String(row(r).door) : '—') },
      { key: 'method', label: ev('colMethod'), render: (r) => (showsMethod(row(r)) ? this.methodText(row(r)) : '—') },
    ];
  }

  private renderTable(records: AccessEvent[]) {
    return html`<sw-table dense data-wiskey-events-table .columns=${this.columns(new Date())} .rows=${records as unknown as Record<string, unknown>[]} .selected=${this.selectedId || null} @row-select=${(e: CustomEvent<{ id: string }>) => this.open(e.detail.id)}></sw-table>`;
  }

  private renderDrawer(records: AccessEvent[], demo: boolean) {
    const e = this.selectedId ? records.find((r) => r.id === this.selectedId) : undefined;
    const tone = e ? rowTone(e) : null;
    return html`<sw-drawer modal ?open=${!!e} heading=${e ? this.titleText(e) : ''} @close=${() => this.closeDrawer()} data-wiskey-event-drawer>
      ${e && tone ? html`<sw-badge slot="action" data-wiskey-event-detail-result kind=${PILL_KIND[tone.pill]} label=${this.pillLabel(e)}></sw-badge>` : nothing}
      ${e
        ? html`<wiskey-event-drawer data-wiskey-event-detail=${e.id} .event=${e} .zone=${this.zoneOf(e)} .now=${new Date()} stationName=${this.stationName(e.station_id)}
            .detailOn=${!demo && featureOffered(this.features, 'event_detail')} .portraitOn=${!demo && featureOffered(this.features, 'event_portrait')}></wiskey-event-drawer>`
        : nothing}
    </sw-drawer>`;
  }

  private renderCustom() {
    const zone = filterZone(this.filters, this.zoneContext());
    return html`<sw-dialog ?open=${this.customOpen} heading=${ev('crTitle')} @close=${() => (this.customOpen = false)} data-wiskey-custom-range>
      <sw-field label=${ev('crFrom')}><input type="datetime-local" lang=${dateInputLang()} data-wiskey-filter-start .value=${this.customDraft.start} @input=${(e: Event) => (this.customDraft = { ...this.customDraft, start: (e.target as HTMLInputElement).value })} /></sw-field>
      <sw-field label=${ev('crUntil')}><input type="datetime-local" lang=${dateInputLang()} data-wiskey-filter-end .value=${this.customDraft.end} @input=${(e: Event) => (this.customDraft = { ...this.customDraft, end: (e.target as HTMLInputElement).value })} /></sw-field>
      <div class="zone" data-wiskey-events-zone>${ev('crZone', { zone: zone.name })}</div>
      ${this.customError ? html`<div class="note err" role="alert" data-wiskey-events-filter-error=${this.customError}><span>${wiskeyText(this.customError)}</span></div>` : nothing}
      <div slot="footer" class="foot">
        <sw-button size="lg" variant="primary" data-wiskey-custom-apply @click=${() => this.applyCustom()}>${ev('crApply')}</sw-button>
        <sw-button size="lg" data-wiskey-custom-cancel @click=${() => (this.customOpen = false)}>${ev('crCancel')}</sw-button>
      </div>
    </sw-dialog>`;
  }

  static styles = css`
    /* every control of this screen - the shared buttons and the dialogs' close buttons included - has the touch size: the desktop dial
       (44 px unless the owner chose the 32 px one) and 44 px on touch layouts. The control-height tokens inherit into the components'
       shadow roots. */
    :host {
      display: block;
      --_t: var(--sw-touch-desktop, 44px);
      --sw-ctl-h-sm: var(--_t);
      --sw-ctl-h-md: var(--_t);
      --sw-ctl-h-lg: var(--_t);
    }
    @media (max-width: 1100px) {
      :host {
        --_t: max(44px, var(--sw-touch-desktop, 44px));
      }
    }
    .bl {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      inline-size: 100%;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      inline-size: 260px;
      min-inline-size: 0;
      padding-inline: 12px;
      box-sizing: border-box;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-3);
    }
    .search:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .search input {
      /* an explicit zero width: a text input's intrinsic width is also its minimum, and a row of icon buttons beside it must fit a phone */
      flex: 1 1 0;
      inline-size: 0;
      min-inline-size: 0;
      min-block-size: var(--_t);
      padding: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
    }
    .actions[data-phone='true'] {
      flex-wrap: nowrap;
      inline-size: 100%;
    }
    .actions[data-phone='true'] .search {
      flex: 1 1 0;
      inline-size: auto;
    }
    .actions[data-phone='true'] sw-button.ib {
      flex: none;
      inline-size: 44px;
    }
    .actions[data-phone='true'] .lbl {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .seg {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: var(--_t);
      min-block-size: var(--_t);
      padding: 0 10px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface-solid);
      color: var(--sw-heading);
      box-shadow: var(--sw-shadow-1);
    }
    .g {
      display: inline-flex;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    @media (max-width: 767px) {
      /* one scrolling row that bleeds to the screen's edges: sw-page's phone padding is 12 px */
      .chips {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        margin-inline: -12px;
        padding-inline: 12px;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chips > * {
        flex: none;
      }
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 200px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.stale {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .feed {
      display: block;
    }
    /* R5-SECURITY: the day heading is a heading (13/800 in the heading ink on a tone step) */
    .grp {
      padding: 9px 14px;
      background: var(--sw-surface-3);
      border-block-start: 1px solid var(--sw-border);
      color: var(--sw-heading, var(--sw-text));
      font-size: var(--sw-fs-md);
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .grp:first-child {
      border-block-start: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: 100%;
      min-block-size: max(56px, var(--_t));
      padding: 8px 14px;
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      box-sizing: border-box;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .grp + .row {
      border-block-start: 0;
    }
    /* R5-SECURITY (mobile-native / emil): a hover only under a fine pointer; the row sinks on pointer-down; a refused entry is a
       filled danger field, a call a filled accent field (status as a field, never a wash) */
    @media (hover: hover) and (pointer: fine) {
      .row:hover {
        background: var(--sw-hover-wash);
      }
    }
    .row:active {
      transform: scale(var(--sw-press-scale));
    }
    .row[data-row-tone='err'] {
      background: var(--sw-danger-soft);
    }
    .row[data-row-tone='warn'] {
      background: var(--sw-warning-soft);
    }
    .row:focus-visible {
      outline-offset: -2px;
    }
    .time {
      /* the time is the display figure of a log row: 15/800, tabular, in the heading ink */
      flex: none;
      min-inline-size: 56px;
      color: var(--sw-heading, var(--sw-text));
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    .dot {
      flex: none;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-unknown);
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 0%, var(--sw-surface));
    }
    sw-badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      padding-block: 2px;
      min-inline-size: 64px;
      justify-content: center;
    }
    .dot.ok {
      background: var(--sw-live);
    }
    .dot.err {
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .main .t {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .main .s {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chev {
      flex: none;
      color: var(--sw-text-3);
    }
    :host-context([dir='ltr']) .chev {
      transform: scaleX(-1);
    }
    .more {
      display: flex;
      justify-content: center;
      padding: 14px;
    }
    .zone {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    sw-dialog input {
      min-block-size: var(--_t);
    }
    .sk-list {
      display: flex;
      flex-direction: column;
    }
    .sk-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 56px;
      padding: 8px 14px;
      border-block-start: 1px solid var(--sw-border);
    }
    .sk-row:first-child {
      border-block-start: 0;
    }
    .sk-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sk {
      display: block;
      border-radius: var(--sw-r-xs);
      background: var(--sw-skeleton);
    }
    .sk.l {
      inline-size: 38%;
      block-size: 12px;
    }
    .sk.m {
      inline-size: 24%;
      block-size: 10px;
    }
    .sk.dotp {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
    }
    .sk.pill {
      inline-size: 64px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-events': WiskeyEvents;
  }
}
