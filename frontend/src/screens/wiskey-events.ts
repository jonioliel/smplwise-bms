import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../components/sw-field';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import { can, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import {
  getIntercomEvents,
  getIntercomOverview,
  subscribeIntercom,
  type DisplayZone,
  type IntercomEvent,
  type IntercomEventAuth,
  type IntercomEventFilters,
  type IntercomEventPage,
  type IntercomEventResult,
  type IntercomEventsReply,
  type IntercomFeedState,
  type IntercomStation,
} from '../api/intercom';
import { FEED_PANELS, feedBadge } from './wiskey-overview';
import { formatTime, localInput, resolveLocalInput, t, UTC_ZONE } from './wiskey-format';

const POLL_MS = 30000; // WisKey's panel refetches every 30 s while visible; here only while the change notices are down
const RESULTS: IntercomEventResult[] = ['granted', 'denied', 'unknown'];
const AUTHS: IntercomEventAuth[] = ['card', 'pin', 'unknown'];

/** The filter form as typed (WisKey events.ts form fields); `start` / `end` are `datetime-local` values in the filter
 * zone, turned into absolute instants only when applied. */
interface Draft {
  station_id: string;
  person: string;
  result: string;
  authentication: string;
  door: string;
  start: string;
  end: string;
}

const EMPTY_DRAFT: Draft = { station_id: '', person: '', result: '', authentication: '', door: '', start: '', end: '' };

type StationInfo = Pick<IntercomStation, 'id' | 'name' | 'zone'>;
/** `reload`: page 1, replacing the list; `more`: the next page, appended; `notice`: page 1 after a change notice,
 * unless more than one page is shown by the time it runs (then the reader keeps their place and is told). */
type LoadMode = 'reload' | 'more' | 'notice';
const TITLE = `WisKey · ${t('wk4_nav_events')}`;
type EventsState = IntercomFeedState | 'unsupported';

/** The result as a badge: granted / denied / unknown in this codebase's good / bad / unknown kinds (WisKey marks a
 * denied result red, events.ts `badge error`). Every other value - a door or contact record has no access result -
 * reads as the neutral kind with WisKey's own label. */
export function resultBadge(result: string): { kind: StateKind; label: string } {
  if (result === 'granted') return { kind: 'live', label: t('granted') };
  if (result === 'denied') return { kind: 'error', label: t('denied') };
  if (result === 'unknown') return { kind: 'unknown', label: t('unknown') };
  return { kind: 'neutral', label: t(result) };
}

const DEMO_ZONE: DisplayZone = { kind: 'iana', name: 'Asia/Jerusalem' };
const DEMO_STATIONS: StationInfo[] = [
  { id: 'd1', name: 'שער ראשי', zone: DEMO_ZONE },
  { id: 'd2', name: 'לובי', zone: DEMO_ZONE },
  { id: 'd3', name: 'חניון', zone: DEMO_ZONE },
];
const demoEvent = (id: string, station_id: string, timestamp: string, person_name: string | null, employee_no: string | null, authentication: string, result: string, event_type: string, extra: Partial<IntercomEvent> = {}): IntercomEvent => ({
  id, station_id, timestamp, received_at: timestamp, time_source: 'device', person_name, employee_no, authentication, result, event_type, recovered: false, door: 1, ...extra,
});
const DEMO_PAGE: IntercomEventPage = {
  records: [
    demoEvent('e1', 'd1', '2026-09-27T07:58:12+03:00', 'דנה כהן', '1001', 'card', 'granted', 'access_granted'),
    demoEvent('e2', 'd2', '2026-09-27T07:41:03+03:00', null, '2044', 'pin', 'granted', 'access_granted', { door: 2 }),
    demoEvent('e3', 'd3', '2026-09-26T22:10:40+03:00', null, null, 'unknown', 'denied', 'access_denied', { time_source: 'received', recovered: true, door: null }),
    demoEvent('e4', 'd1', '2026-09-26T18:03:55+03:00', 'יוסי לוי', '1017', 'pin', 'denied', 'access_denied'),
    demoEvent('e5', 'd2', '2026-09-26T17:30:00+03:00', null, null, 'unknown', 'unknown', 'door_unlocked'),
  ],
  next: null,
  retention_days: 30,
  capacity: 5000,
  membership_basis: null,
  storage_failed: false,
  stations: {},
};

/**
 * WisKey tab: the activity log (CR-005 phase 1b, read-only, `access.read`). Ported from the owner's WisKey frontend -
 * `hikvision-intercom-events` (events.ts): its filter fields (station, person, result, authentication, door, from /
 * until in the station's clock zone), single-flight load with one queued reload, "load more" over the `next` cursor
 * (appended, never a full refetch), the v4 table (date, person, station + door, authentication, result badge) with the
 * inspector for the selected row, and its storage-failed / history-incomplete notices - with WisKey's `hass.callWS`
 * replaced by the SMPLWISE API and WisKey's styles by SMPLWISE's own components.
 *
 * WisKey has no event push: its only signal is the data-free `refresh` notice, and SMPLWISE's feed relays it to
 * browsers (`intercom_refresh`) only when the entry center's projection changed - a new access record changes a
 * station's last access, a door or contact record does not. The list is refetched on that notice, on a manual refresh,
 * and every 30 s only while the notices are down - and the page says exactly that; it never presents itself as a live
 * feed. Left out on purpose: saved report presets, the activity report,
 * CSV export and print (WisKey `events/report|export|print`, not served by SMPLWISE), per-event evidence / support
 * download, portraits and the masked card (the backend projection drops them), and the `event_type` /
 * `current_group` / `current_profile` filters (not accepted by GET /intercom/events).
 */
@customElement('wiskey-events')
export class WiskeyEvents extends LitElement {
  @state() private forbidden = false;
  @state() private stations: StationInfo[] | null = null; // from the overview: names and clock zones
  @state() private defaultZone: DisplayZone = UTC_ZONE;
  @state() private version: string | null = null;
  @state() private reply: IntercomEventsReply | null = null; // the last answer (its state drives the page)
  @state() private page: IntercomEventPage | null = null; // the records shown, for `applied`; kept across a failed reload
  @state() private shownAt: string | null = null; // when the shown page 1 was fetched
  @state() private pages = 0;
  @state() private everReady = false;
  @state() private applied: IntercomEventFilters = {};
  @state() private draft: Draft = { ...EMPTY_DRAFT };
  @state() private dirty = false;
  @state() private filterError = ''; // an i18n key (wiskey-format.ts), shown translated
  @state() private error = '';
  @state() private busy = false;
  @state() private loadingMore = false;
  @state() private cursorExpired = false;
  @state() private pendingUpdate = false; // WisKey signalled a change while extra pages were loaded
  @state() private notices = false; // the change-notice socket is connected
  @state() private selected = '';
  private inputZone: DisplayZone = UTC_ZONE; // the zone the draft's from / until are typed in
  private knownTimes: { start?: string | null; end?: string | null } = {};
  private generation = 0;
  /** A page-1 reload asked for while another load was out, and why: `reload` (the reader asked, or the filters
   * changed) always replaces the list; `notice` (a change notice or the fallback poll) is judged when it runs. */
  private reloadQueued: Exclude<LoadMode, 'more'> | null = null;
  private overviewBusy = false;
  private overviewAgain = false;
  private stop: (() => void) | null = null;
  private poll = 0;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    if (!can('access.read')) {
      this.forbidden = true;
      return;
    }
    void this.loadOverview();
    void this.load();
    this.stop = subscribeIntercom(
      (m) => {
        if (m.type === 'intercom_refresh' || m.type === 'intercom_state') this.onChangeNotice();
      },
      (connected) => {
        this.notices = connected;
        this.setPolling(!connected);
        if (connected) this.onChangeNotice(); // notices sent while the socket was down are gone: catch up now
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    this.setPolling(false);
    this.generation++;
  }

  private setPolling(on: boolean) {
    window.clearInterval(this.poll);
    this.poll = on ? window.setInterval(() => this.onChangeNotice(), POLL_MS) : 0;
  }

  /** WisKey said something changed (or the fallback poll ticked). WisKey's own panel then reloads page 1 and drops the
   * pages loaded with "load more"; here page 1 is reloaded only while it is the only page shown - with more pages
   * loaded the reader keeps their place and is told that a refresh would bring newer records. That is decided when the
   * reload runs, not when the notice arrives: a notice during an in-flight "load more" waits for it (see `load`). */
  private onChangeNotice() {
    void this.loadOverview();
    void this.load('notice');
  }

  /** Station names and clock zones (the filter's station list and each row's time zone) - single-flight with
   * coalescing, as the entry center's own refetch. */
  private async loadOverview() {
    if (this.overviewBusy) {
      this.overviewAgain = true;
      return;
    }
    this.overviewBusy = true;
    try {
      do {
        this.overviewAgain = false;
        try {
          const feed = await getIntercomOverview();
          if (feed.overview) {
            this.stations = feed.overview.stations.map((s) => ({ id: s.id, name: s.name, zone: s.zone }));
            this.defaultZone = feed.overview.default_zone ?? UTC_ZONE;
            this.version = feed.overview.version;
            this.rezone();
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) this.forbidden = true;
          // otherwise the events reply itself says what is wrong; rows show the station id until names arrive
        }
      } while (this.overviewAgain);
    } finally {
      this.overviewBusy = false;
    }
  }

  /** One page of `events/list` (WisKey events.ts `load(more)`): single-flight - a reload asked for while one is out is
   * queued once (a `reload` outranks a `notice`), a "load more" is dropped - and a generation counter discards answers
   * for filters no longer applied. Page 1 replaces the records; "load more" appends the next page over the `next`
   * cursor. A `notice` reload is judged when it RUNS: if more than one page is shown by then (a "load more" that was in
   * flight when the notice came has landed meanwhile), nothing is fetched and the reader is told instead. */
  private async load(mode: LoadMode = 'reload') {
    if (this.forbidden) return;
    if (this.busy) {
      if (mode === 'reload') this.reloadQueued = 'reload';
      else if (mode === 'notice' && !this.reloadQueued) this.reloadQueued = 'notice';
      return;
    }
    if (mode === 'notice' && this.pages > 1) {
      this.pendingUpdate = true;
      return;
    }
    const more = mode === 'more';
    const before = more ? this.page?.next : null;
    if (more && !before) return;
    const generation = ++this.generation;
    this.busy = true;
    this.loadingMore = more;
    try {
      const r = await getIntercomEvents(this.applied, before);
      if (generation !== this.generation) return;
      this.reply = r;
      this.error = '';
      this.cursorExpired = false;
      if (r.events) {
        this.everReady = true;
        if (more && this.page) {
          this.page = { ...r.events, records: [...this.page.records, ...r.events.records] };
          this.pages += 1;
        } else {
          this.page = r.events;
          this.pages = 1;
          this.shownAt = r.fetched_at;
          this.pendingUpdate = false;
          if (!r.events.records.some((e) => e.id === this.selected)) this.selected = '';
        }
      }
    } catch (err) {
      if (generation !== this.generation) return;
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else if (err instanceof ApiError && err.code === 'intercom_cursor_expired') this.cursorExpired = true;
      else this.error = `${t('events_load_failed')} (${describeError(err)})`;
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.loadingMore = false;
        const queued = this.reloadQueued;
        if (queued) {
          this.reloadQueued = null;
          void this.load(queued);
        }
      }
    }
  }

  /** A new filter set: whatever is in flight is for the old one (WisKey `cancelList`). */
  private restart(filters: IntercomEventFilters) {
    this.generation++;
    this.busy = false;
    this.loadingMore = false;
    this.reloadQueued = null;
    this.applied = filters;
    this.page = null;
    this.pages = 0;
    this.shownAt = null;
    this.selected = '';
    this.cursorExpired = false;
    this.pendingUpdate = false;
    this.error = '';
    void this.load();
  }

  // ------------------------------------------------------------------ filters

  /** The zone the from / until fields are typed in: the filtered station's clock zone, else the installation's default
   * zone (WisKey `refreshFilterZone`). */
  private filterZone(): DisplayZone {
    const station = this.stations?.find((s) => s.id === this.draft.station_id);
    return station ? (station.zone ?? UTC_ZONE) : this.defaultZone;
  }

  /** Re-project the typed from / until into a new filter zone, keeping the instants they stood for (WisKey
   * `refreshFilterZone`); a draft that cannot be carried over unambiguously is cleared, and the reader is told. */
  private rezone() {
    if (this.draft.station_id && this.stations && !this.stations.some((s) => s.id === this.draft.station_id)) {
      this.draft = { ...this.draft, station_id: '' };
      this.dirty = true;
    }
    const zone = this.filterZone();
    if (JSON.stringify(zone) === JSON.stringify(this.inputZone)) return;
    try {
      const start = resolveLocalInput(this.draft.start, this.inputZone, this.knownTimes.start);
      const end = resolveLocalInput(this.draft.end, this.inputZone, this.knownTimes.end);
      this.draft = { ...this.draft, start: localInput(start, zone), end: localInput(end, zone) };
      this.knownTimes = { start, end };
    } catch {
      this.draft = { ...this.draft, start: '', end: '' };
      this.knownTimes = {};
      this.dirty = true;
      this.filterError = 'filter_zone_changed_invalid';
    }
    this.inputZone = zone;
  }

  private edit(key: keyof Draft, value: string) {
    this.draft = { ...this.draft, [key]: value };
    this.dirty = true;
    if (key === 'station_id') this.rezone();
  }

  /** Apply the typed filters (WisKey `apply`): from / until are converted from the filter zone to absolute instants;
   * a local time that is invalid, repeated or skipped by a DST change is refused here and nothing is sent. */
  private apply(e?: Event) {
    e?.preventDefault();
    const d = this.draft;
    let start: string | null;
    let end: string | null;
    try {
      start = resolveLocalInput(d.start, this.inputZone, this.knownTimes.start);
      end = resolveLocalInput(d.end, this.inputZone, this.knownTimes.end);
    } catch (err) {
      this.filterError = (err as Error).message; // clock_invalid_local | clock_ambiguous | clock_nonexistent
      return;
    }
    if (start && end && Date.parse(start) >= Date.parse(end)) {
      this.filterError = 'filter_start_before_end';
      return;
    }
    const filters: IntercomEventFilters = {};
    if (d.station_id) filters.station_id = d.station_id;
    if (d.person.trim()) filters.person = d.person.trim();
    if (RESULTS.includes(d.result as IntercomEventResult)) filters.result = d.result as IntercomEventResult;
    if (AUTHS.includes(d.authentication as IntercomEventAuth)) filters.authentication = d.authentication as IntercomEventAuth;
    if (d.door === '1' || d.door === '2') filters.door = Number(d.door) as 1 | 2;
    if (start) filters.start = start;
    if (end) filters.end = end;
    this.knownTimes = { start, end };
    this.filterError = '';
    this.dirty = false;
    this.restart(filters);
  }

  /** WisKey's "clear search and filters". */
  private clear() {
    this.draft = { ...EMPTY_DRAFT };
    this.knownTimes = {};
    this.filterError = '';
    this.dirty = false;
    this.rezone();
    this.restart({});
  }

  /** WisKey's quick investigation "denied entries": a fresh filter set with only `result: denied`. */
  private quickDenied() {
    this.draft = { ...EMPTY_DRAFT, result: 'denied' };
    this.knownTimes = {};
    this.filterError = '';
    this.dirty = false;
    this.rezone();
    this.restart({ result: 'denied' });
  }

  // ------------------------------------------------------------------ render helpers

  private station(id: string): StationInfo | undefined {
    return (isApi() ? this.stations : DEMO_STATIONS)?.find((s) => s.id === id);
  }

  /** A row's station name: WisKey's "removed station" only when the station list is known and lacks it. */
  private stationName(id: string): string {
    const s = this.station(id);
    if (s) return s.name;
    return (isApi() ? this.stations : DEMO_STATIONS) ? t('removed_station') : id;
  }

  private zoneOf(e: IntercomEvent): DisplayZone {
    return this.station(e.station_id)?.zone ?? UTC_ZONE;
  }

  private columns(): TableColumn[] {
    const row = (r: Record<string, unknown>) => r as unknown as IntercomEvent;
    return [
      { key: 'timestamp', label: t('report_date'), render: (r) => html`<time datetime=${row(r).timestamp} data-wiskey-event-time><bdi>${formatTime(row(r).timestamp, 'he-IL', this.zoneOf(row(r)))}</bdi></time>` },
      {
        key: 'person',
        label: t('person'),
        render: (r) => {
          const e = row(r);
          return html`<span data-wiskey-event-person>${e.person_name ?? (e.employee_no ? '' : t('unknown_person'))}${e.employee_no ? html`${e.person_name ? ' · ' : ''}<bdi>${e.employee_no}</bdi>` : nothing}</span>`;
        },
      },
      { key: 'station', label: t('station'), render: (r) => html`<span data-wiskey-event-station>${this.stationName(row(r).station_id)}${row(r).door ? html` · ${t('door')} ${row(r).door}` : nothing}</span>` },
      { key: 'authentication', label: t('authentication'), render: (r) => html`<span data-wiskey-event-auth=${row(r).authentication}>${t(row(r).authentication)}</span>` },
      {
        key: 'result',
        label: t('result'),
        render: (r) => {
          const b = resultBadge(row(r).result);
          return html`<sw-badge data-wiskey-event-result=${row(r).result} kind=${b.kind} label=${b.label}></sw-badge>`;
        },
      },
    ];
  }

  // ------------------------------------------------------------------ render

  render() {
    if (!isApi()) return this.renderPage({ state: 'ready', configured: true, last_error: null, fetched_at: null, events: DEMO_PAGE }, DEMO_PAGE, true);
    if (this.forbidden) {
      return html`<sw-page heading=${TITLE}><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (!this.reply) {
      return html`<sw-page heading=${TITLE}>${this.error
        ? html`<sw-state-panel data-wiskey-state="load_error" state="error" heading="לא ניתן לטעון את יומן הפעילות" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    return this.renderPage(this.reply, this.page, false);
  }

  private renderPage(reply: IntercomEventsReply, page: IntercomEventPage | null, demo: boolean) {
    const sub = `${t('events_intro')} · צפייה בלבד${demo ? ' · נתוני הדגמה' : ''}`;
    const ready = reply.state === 'ready';
    return html`<sw-page heading=${TITLE} subheading=${sub} wide>
      ${this.renderBadge(reply.state, demo)}
      ${demo ? nothing : html`<sw-button slot="actions" size="sm" variant="ghost" icon="refresh" data-wiskey-events-refresh ?disabled=${this.busy} @click=${() => void this.load()}>${t('refresh')}</sw-button>`}
      ${this.renderNoPush(demo)}
      ${page && !ready ? this.renderStaleNote(reply.state) : nothing}
      ${this.error ? html`<div class="note err" role="status" data-wiskey-events-error>${this.error}</div>` : nothing}
      ${this.everReady || demo ? this.renderFilters(demo) : nothing}
      ${page ? this.renderRecords(page, demo) : this.busy && this.everReady ? html`<sw-state-panel state="loading"></sw-state-panel>` : this.renderStatePanel(reply)}
    </sw-page>`;
  }

  private renderBadge(s: EventsState, demo: boolean) {
    if (demo) return html`<sw-badge slot="actions" kind="neutral" label="נתוני הדגמה"></sw-badge>`;
    const { kind, label } = s === 'unsupported' ? { kind: 'error' as StateKind, label: 'לא נתמך' } : feedBadge(s, this.version);
    return html`<sw-badge slot="actions" data-wiskey-feed=${s} kind=${kind} label=${label}></sw-badge>`;
  }

  /** WisKey has no event push, and the page says so rather than pretending to be a live feed. */
  private renderNoPush(demo: boolean) {
    if (demo) return nothing;
    return html`<div class="note info" role="note" data-wiskey-events-nopush>
      <sw-icon name="info" size=${16}></sw-icon>
      <span
        >יומן הפעילות אינו זרם חי: WisKey אינו שולח אירועים בדחיפה. הרשימה נטענת מחדש כשמרכז הכניסה מקבל עדכון מ־WisKey (למשל
        אירוע גישה חדש), או ב${t('refresh')} ידני; אירוע שאינו משנה את מרכז הכניסה (כמו דיווח דלת) יופיע רק ברענון${this.notices
          ? ''
          : '. ההודעות על שינויים אינן זמינות כרגע, ולכן הרשימה נבדקת מחדש כל 30 שניות'}.${this.shownAt
          ? html` נטען לאחרונה: <bdi data-wiskey-events-fetched>${formatTime(this.shownAt, 'he-IL', this.defaultZone)}</bdi>.`
          : nothing}</span
      >
    </div>`;
  }

  /** The feed dropped after records were shown: they stay, marked as last-known (the entry center's stale note). */
  private renderStaleNote(s: EventsState) {
    const heading = s === 'unsupported' ? 'גרסת WisKey המותקנת אינה תומכת ביומן הפעילות' : FEED_PANELS[s === 'ready' ? 'error' : s].heading;
    return html`<div class="note stale" role="status" data-wiskey-stale>
      <sw-icon name="offline" size=${16}></sw-icon>
      <span>${heading}. מוצגות הרשומות האחרונות שנטענו${this.shownAt ? html` (<bdi>${formatTime(this.shownAt, 'he-IL', this.defaultZone)}</bdi>)` : nothing} - ייתכן שאינן עדכניות.</span>
    </div>`;
  }

  private renderStatePanel(reply: IntercomEventsReply) {
    if (reply.state === 'unsupported') {
      return html`<sw-state-panel data-wiskey-state="unsupported" state="empty" heading="גרסת WisKey המותקנת אינה תומכת ביומן הפעילות" hint="WisKey אינו מכיר את הפקודה events/list. אחרי עדכון WisKey היומן יוצג כאן."></sw-state-panel>`;
    }
    const p: { panel: PanelState; heading: string; hint: string } = FEED_PANELS[reply.state === 'ready' ? 'error' : reply.state];
    // a per-request failure (rate limit, busy, timeout) is retried by the next change notice or a manual refresh
    const hint = reply.state === 'error' ? `הבקשה ל־WisKey לא הושלמה${reply.last_error ? ` (${reply.last_error})` : ''}. אפשר לנסות שוב ב${t('refresh')}.` : p.hint;
    return html`<sw-state-panel data-wiskey-state=${reply.state} state=${p.panel} heading=${p.heading} hint=${hint}></sw-state-panel>`;
  }

  private renderFilters(demo: boolean) {
    const d = this.draft;
    const count = Object.keys(this.applied).length;
    const zone = this.filterZone();
    const off = demo || this.busy;
    return html`<sw-card class="filters" data-wiskey-events-filters>
      <div class="filter-head">
        <b>${t('event_filters')}</b>
        <span class="muted" data-wiskey-events-filter-count=${count}>${count ? `${t('event_filters_active')}: ${count}` : t('event_filters_all')}</span>
        <span class="quick" role="group" aria-label=${t('event_investigation_quick')}>
          <sw-chip data-wiskey-events-quick="denied" ?selected=${count === 1 && this.applied.result === 'denied'} @click=${() => !demo && this.quickDenied()}>${t('event_quick_denied')}</sw-chip>
        </span>
      </div>
      <form class="form-grid" @submit=${(e: Event) => this.apply(e)}>
        <sw-field label=${t('station')}>
          <select name="station_id" data-wiskey-filter-station .value=${d.station_id} ?disabled=${demo} @change=${(e: Event) => this.edit('station_id', (e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!d.station_id}>${t('all')}</option>
            ${(demo ? DEMO_STATIONS : (this.stations ?? [])).map((s) => html`<option value=${s.id} ?selected=${s.id === d.station_id}>${s.name}</option>`)}
          </select>
        </sw-field>
        <sw-field label=${t('person')}>
          <input name="person" data-wiskey-filter-person maxlength="128" .value=${d.person} ?disabled=${demo} @input=${(e: Event) => this.edit('person', (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && !off && this.apply(e)} />
        </sw-field>
        <sw-field label=${t('result')}>
          <select name="result" data-wiskey-filter-result .value=${d.result} ?disabled=${demo} @change=${(e: Event) => this.edit('result', (e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!d.result}>${t('all')}</option>
            ${RESULTS.map((v) => html`<option value=${v} ?selected=${v === d.result}>${t(v)}</option>`)}
          </select>
        </sw-field>
        <sw-field label=${t('authentication')}>
          <select name="authentication" data-wiskey-filter-auth .value=${d.authentication} ?disabled=${demo} @change=${(e: Event) => this.edit('authentication', (e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!d.authentication}>${t('all')}</option>
            ${AUTHS.map((v) => html`<option value=${v} ?selected=${v === d.authentication}>${t(v)}</option>`)}
          </select>
        </sw-field>
        <sw-field label=${t('door')}>
          <select name="door" data-wiskey-filter-door .value=${d.door} ?disabled=${demo} @change=${(e: Event) => this.edit('door', (e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!d.door}>${t('all')}</option>
            ${['1', '2'].map((v) => html`<option value=${v} ?selected=${v === d.door}>${v}</option>`)}
          </select>
        </sw-field>
        <sw-field label=${t('from_time')}>
          <input type="datetime-local" name="start" data-wiskey-filter-start .value=${d.start} ?disabled=${demo} @input=${(e: Event) => this.edit('start', (e.target as HTMLInputElement).value)} />
        </sw-field>
        <sw-field label=${t('until_time')}>
          <input type="datetime-local" name="end" data-wiskey-filter-end .value=${d.end} ?disabled=${demo} @input=${(e: Event) => this.edit('end', (e.target as HTMLInputElement).value)} />
        </sw-field>
        <div class="form-actions">
          <sw-button variant="primary" icon="filter" data-wiskey-filter-apply ?disabled=${off} @click=${() => this.apply()}>${t('filter')}</sw-button>
          <sw-button variant="ghost" data-wiskey-filter-clear ?disabled=${off} @click=${() => this.clear()}>${t('clear_user_filters')}</sw-button>
        </div>
      </form>
      <div class="muted" data-wiskey-events-zone>${t('clock_filter_basis')}: <bdi>${zone.name}</bdi></div>
      ${this.dirty ? html`<div class="note pending" role="status" data-wiskey-events-dirty>${t('filters_not_applied')}</div>` : nothing}
      ${this.filterError ? html`<div class="note err" role="alert" data-wiskey-events-filter-error=${this.filterError}>${t(this.filterError)}</div>` : nothing}
    </sw-card>`;
  }

  private renderRecords(page: IntercomEventPage, demo: boolean) {
    const records = page.records;
    const selected = records.find((e) => e.id === this.selected) ?? records[0];
    const incomplete = Object.entries(page.stations).filter(([, s]) => s.history && !['recovered', 'pending'].includes(s.history));
    return html`
      ${page.storage_failed ? html`<div class="note err" role="alert" data-wiskey-events-storage>${t('audit_save_failed')}</div>` : nothing}
      ${incomplete.map(([id]) => html`<div class="note stale" role="status" data-wiskey-events-history=${id}>${this.stationName(id)}: ${t('history_incomplete')}</div>`)}
      ${this.pendingUpdate
        ? html`<div class="note info" role="status" data-wiskey-events-pending>
            <span>WisKey דיווח על שינוי מאז שהרשימה נטענה. ${t('refresh')} יטען מחדש את העמוד הראשון (העמודים הנוספים שנטענו יוסרו).</span>
            <sw-button size="sm" variant="ghost" icon="refresh" @click=${() => void this.load()}>${t('refresh')}</sw-button>
          </div>`
        : nothing}
      <div class="summary" role="status">
        <span data-wiskey-events-count=${records.length}>${this.busy && !this.loadingMore ? t('loading') : `${t('loaded_records')}: ${records.length}`}</span>
        ${page.capacity || page.retention_days
          ? html`<span class="muted">WisKey שומר עד ${page.capacity?.toLocaleString('he-IL') ?? '—'} רשומות / ${page.retention_days ?? '—'} יום; רשומות ישנות יותר אינן זמינות.</span>`
          : nothing}
      </div>
      ${records.length
        ? html`<div class="layout">
            <div class="main">
              <sw-table dense data-wiskey-events-table .columns=${this.columns()} .rows=${records as unknown as Record<string, unknown>[]} .selected=${selected?.id ?? null} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>
              ${this.cursorExpired
                ? html`<div class="note err" role="alert" data-wiskey-events-cursor-expired>
                    <span>רשימת האירועים ב־WisKey התעדכנה והמקום שממנו ממשיכים לטעון כבר אינו קיים. יש לטעון מחדש מההתחלה.</span>
                    <sw-button size="sm" variant="ghost" icon="refresh" @click=${() => void this.load()}>טען מחדש מההתחלה</sw-button>
                  </div>`
                : page.next && !demo
                  ? html`<div class="more">
                      <sw-button data-wiskey-events-more ?disabled=${this.busy} @click=${() => void this.load('more')}>${this.loadingMore ? t('loading') : t('load_more')}</sw-button>
                    </div>`
                  : html`<div class="end muted" data-wiskey-events-end>סוף הרשומות התואמות שנשמרו ב־WisKey.</div>`}
            </div>
            ${selected ? this.renderInspector(selected) : nothing}
          </div>`
        : html`<sw-state-panel compact state="empty" data-wiskey-events-empty heading=${t('no_events')} hint=${Object.keys(this.applied).length ? 'נסו להרחיב או לנקות את המסננים.' : ''}></sw-state-panel>`}
    `;
  }

  /** WisKey v4's inspector for the selected row (events.ts `v4ListView` aside), without portrait, card and evidence. */
  private renderInspector(e: IntercomEvent) {
    const zone = this.zoneOf(e);
    const b = resultBadge(e.result);
    const identified = !!(e.person_name || e.employee_no);
    return html`<aside class="side">
      <sw-card heading=${t('event_detail')} data-wiskey-event-detail=${e.id}>
        <dl>
          <dt>${t('person')}</dt>
          <dd>${e.person_name ?? t('unknown_person')}</dd>
          ${e.employee_no ? html`<dt>${t('employee_no')}</dt><dd><bdi>${e.employee_no}</bdi></dd>` : nothing}
          <dt>${t('report_date')}</dt>
          <dd><bdi>${formatTime(e.timestamp, 'he-IL', zone)}</bdi>${e.time_source === 'received' ? html` · ${t('receipt_time')}` : nothing}</dd>
          <dt>${t('station')}</dt>
          <dd>${this.stationName(e.station_id)}</dd>
          <dt>${t('door')}</dt>
          <dd>${e.door ?? t('unknown')}</dd>
          <dt>${t('authentication')}</dt>
          <dd>${t(e.authentication)}</dd>
          <dt>${t('result')}</dt>
          <dd><sw-badge kind=${b.kind} label=${b.label}></sw-badge></dd>
          <dt>${t('event_type')}</dt>
          <dd>${t(e.event_type)}</dd>
          ${e.received_at && e.time_source !== 'received' ? html`<dt>${t('receipt_time')}</dt><dd><bdi>${formatTime(e.received_at, 'he-IL', zone)}</bdi></dd>` : nothing}
        </dl>
        ${!identified ? html`<p class="muted">${t('identity_unavailable')}</p>` : nothing}
        ${e.recovered ? html`<p class="muted">${t('historical_record')}</p>` : nothing}
      </sw-card>
    </aside>`;
  }

  static styles = css`
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
      flex: 1 1 240px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.stale {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.pending {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      box-shadow: inset 3px 0 0 var(--sw-accent);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .filters {
      display: block;
    }
    .filter-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      margin-block-end: 10px;
    }
    .quick {
      margin-inline-start: auto;
      display: flex;
      gap: 6px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px 12px;
      align-items: end;
    }
    @media (max-width: 900px) {
      .form-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 480px) {
      .form-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .filters > .muted,
    .filters > .note {
      margin-block-start: 8px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 14px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 1000px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .main,
    .side {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .more,
    .end {
      display: flex;
      justify-content: center;
      padding-block: 4px;
    }
    dl {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    aside p {
      margin: 10px 0 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-events': WiskeyEvents;
  }
}
