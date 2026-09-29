import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../components/sw-field';
import '../components/sw-table';
import '../components/sw-avatar';
import './wiskey-person-editor';
import type { TableColumn } from '../components/sw-table';
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import { can, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import {
  getIntercomOverview,
  getIntercomPeople,
  getIntercomPerson,
  subscribeIntercom,
  PEOPLE_PAGE,
  PEOPLE_PAGE_SIZES,
  type DisplayZone,
  type IntercomFeedState,
  type IntercomPeopleFilters,
  type IntercomPeoplePage,
  type IntercomPeopleReply,
  type IntercomPeopleRights,
  type IntercomPeopleSort,
  type IntercomPeopleState,
  type IntercomEditorPerson,
  type IntercomPerson,
  type IntercomStation,
} from '../api/intercom';
import { FEED_PANELS, feedBadge } from './wiskey-overview';
import { formatTime, t, UTC_ZONE } from './wiskey-format';

const POLL_MS = 30000; // WisKey's panel refetches every 30 s while visible; here only while the change notices are down
const TYPING_DEBOUNCE_MS = 250; // WisKey panel.ts: `scheduleUserQuery(true, 250)` on typing, 0 on a filter change
const DETAIL_TTL_MS = 60_000; // WisKey's `users/get` cache: 60 s, at most 100 entries, invalidated by revision
const DETAIL_CACHE_MAX = 100;
const RIGHTS: IntercomPeopleRights[] = ['assigned', 'unassigned', 'disabled'];
const STATES: IntercomPeopleState[] = ['active', 'inactive', 'expired', 'upcoming'];
const SORTS: IntercomPeopleSort[] = ['name', 'name_desc', 'employee'];
const TITLE = `WisKey · ${t('wk4_nav_users')}`;
type PeopleState = IntercomFeedState | 'unsupported';
type StationInfo = Pick<IntercomStation, 'id' | 'name'>;

/** WisKey panel.ts `personStatus(user)`: the first of conflict / error / syncing / pending present among the
 * assignments' sync states, else `synced`, or `unassigned` without any assignment (WisKey says "inactive" there; this
 * codebase keeps that word for the person's own active flag). WisKey decides an `offline` assignment by comparing its
 * desired and applied revisions, which the SMPLWISE projection does not carry - so `offline` is shown as itself, after
 * `pending`, instead of being guessed either way. */
export function personSyncStatus(p: IntercomPerson): string {
  const values = p.stations.map((s) => s.sync_state ?? 'pending');
  return ['conflict', 'error', 'syncing', 'pending', 'offline'].find((v) => values.includes(v)) ?? (values.length ? 'synced' : 'unassigned');
}

/** The sync status as a badge (WisKey `badge(status)`: a coloured pill with the translated state). */
export function syncBadge(status: string): { kind: StateKind; label: string } {
  if (status === 'synced') return { kind: 'recorded', label: t('synced') };
  if (status === 'pending' || status === 'syncing' || status === 'delete_pending') return { kind: 'stale', label: t(status) };
  if (status === 'conflict' || status === 'error') return { kind: 'error', label: t(status) };
  if (status === 'offline') return { kind: 'offline', label: t('offline') };
  if (status === 'unassigned') return { kind: 'unknown', label: t('filter_unassigned') };
  return { kind: 'neutral', label: t(status) };
}

export type ValidityState = 'permanent' | 'validity_unknown' | 'validity_future' | 'validity_expired' | 'validity_current';

/** WisKey panel.ts `validitySummary(user)`, the state part: no window at all is `permanent`; a half or inverted window
 * is `validity_unknown`; else where `now` falls against it. */
export function validityState(p: Pick<IntercomPerson, 'valid_from' | 'valid_until'>, now = Date.now()): ValidityState {
  const start = p.valid_from ? Date.parse(p.valid_from) : null;
  const end = p.valid_until ? Date.parse(p.valid_until) : null;
  if (start === null && end === null) return 'permanent';
  if (start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'validity_unknown';
  return now < start ? 'validity_future' : now >= end ? 'validity_expired' : 'validity_current';
}

const DEMO_STATIONS: StationInfo[] = [
  { id: 'd1', name: 'שער ראשי' },
  { id: 'd2', name: 'לובי' },
  { id: 'd3', name: 'חניון' },
];
const demoPerson = (id: string, employee_no: string, display_name: string, extra: Partial<IntercomPerson> = {}): IntercomPerson => ({
  id, employee_no, display_name, active: true, valid_from: null, valid_until: null, revision: 1, group_ids: [], stations: [], ...extra,
});
const DEMO_PAGE: IntercomPeoplePage = {
  records: [
    demoPerson('p1', '1001', 'דנה כהן', { group_ids: ['staff'], stations: [{ station_id: 'd1', enabled: true, doors: [1], sync_state: 'synced' }, { station_id: 'd2', enabled: true, doors: [1, 2], sync_state: 'synced' }] }),
    demoPerson('p2', '1017', 'יוסי לוי', { stations: [{ station_id: 'd1', enabled: true, doors: [1], sync_state: 'pending' }] }),
    demoPerson('p3', '1033', 'מאיה כץ', { valid_from: '2026-01-01T00:00:00+02:00', valid_until: '2026-06-30T00:00:00+03:00', stations: [{ station_id: 'd3', enabled: true, doors: [1], sync_state: 'synced' }] }),
    demoPerson('p4', '2044', 'אורן ברק', { active: false, stations: [{ station_id: 'd2', enabled: false, doors: [1], sync_state: 'error' }] }),
    demoPerson('p5', '2051', 'נועה שלו'),
  ],
  total: 5,
  total_all: 5,
  offset: 0,
  limit: PEOPLE_PAGE,
  next_offset: null,
  previous_offset: null,
  snapshot: 'demo',
  stale: false,
  complete: true,
  incomplete_reason: null,
};

/**
 * WisKey tab: the people directory (CR-005 phase 1b, read-only, `access.read`). Ported from the owner's WisKey frontend -
 * the users tab (`usersView()`, panel.ts): its search box (typing debounced 250 ms), the station / assignment / state
 * filters and the sort (each change re-queries from offset 0), the server-paged directory (`users/query` with the page
 * size select, previous / next, "page / pages", the loading status, WisKey's snapshot passed back page after page),
 * the result bar, the people table (name with initials avatar and employee number, enabled assignments, sync badge with
 * the active flag, validity), the "people workspace" with the right-hand details pane (`wiskey-user-details`, embedded:
 * employee id, status, groups, validity with the HA zone, the grants list with a per-station sync label) loaded through
 * `users/get` with WisKey's 60 s cache - with WisKey's `hass.callWS` replaced by the SMPLWISE API and WisKey's styles by
 * SMPLWISE's own components.
 *
 * Shown is exactly what GET /intercom/people serves: the backend projection deliberately strips phones, cards, PIN
 * flags, profile values and photos (0.1.105 review), so none of those appear here - not as columns, not as filters, not
 * as a "—" placeholder - and the search hint promises name / employee number only (the SMPLWISE backend matches the
 * text itself and never sends it to WisKey). No "add", "edit", "sync now", selection or bulk affordances: editing is a
 * separate phase. Left out on purpose: the credential (PIN / card) and profile-field filters, the groups filter (WisKey
 * lists group labels from its profile settings, which SMPLWISE does not serve - group ids are shown as-is in the details
 * pane), saved views and column choice, CSV import / export, "import existing", "sync all", bulk actions, the WhatsApp
 * composer and conversation, the timing-policy lines (not served), and portraits (`users/photo_get` is not served;
 * the avatar is the initials WisKey shows when no photo is configured).
 *
 * WisKey has no directory push: its only signal is the data-free `refresh` notice, relayed by SMPLWISE's feed as
 * `intercom_refresh`. The shown page is refetched on that notice, on a manual refresh, and every 30 s only while the
 * notices are down (as WisKey's own panel re-issues `users/query` after each overview refresh) - and the page says so.
 * A refetch carries the shown page's snapshot, so a directory that changed underneath is reported (`stale`) with a
 * reload from page 1 offered; a search whose scan stopped early (`complete: false`) says its total is a minimum.
 *
 * CR-005 phase 2, slice A1: with `access.people.manage` (installation scope) the directory gains WisKey's "Add user"
 * button and the details pane its "Edit", both opening `wiskey-person-editor` (the port of WisKey's editor dialog); a
 * save or a delete refetches the page and says what WisKey answered. Without the permission nothing of that renders.
 */
@customElement('wiskey-people')
export class WiskeyPeople extends LitElement {
  @state() private forbidden = false;
  @state() private stations: StationInfo[] | null = null; // from the overview: names for the filter and the grants
  @state() private defaultZone: DisplayZone = UTC_ZONE;
  @state() private version: string | null = null;
  @state() private reply: IntercomPeopleReply | null = null; // the last answer (its state drives the page)
  @state() private page: IntercomPeoplePage | null = null; // the page shown; kept across a failed reload
  @state() private shownAt: string | null = null;
  @state() private everReady = false;
  @state() private query = '';
  @state() private filters: IntercomPeopleFilters = { sort: 'employee' };
  @state() private pageSize: number = PEOPLE_PAGE;
  @state() private offset = 0;
  @state() private error = '';
  @state() private busy = false;
  @state() private notices = false; // the change-notice socket is connected
  @state() private selected = '';
  @state() private detail: IntercomPerson | null = null; // the `users/get` record for the selected row
  @state() private detailBusy = false;
  @state() private detailError = ''; // an ApiError code (intercom_person_not_found) or a described failure
  @state() private editing: { id: string } | 'new' | null = null; // the person editor, when open
  @state() private notice: { tone: 'ok' | 'warn'; text: string } | null = null; // the last save / delete, as WisKey reported it
  private snapshot = ''; // WisKey `_userSnapshot`: the last page's token, passed back with every request
  private generation = 0;
  private detailGeneration = 0;
  private reloadQueued = false; // one reload asked for while another was out
  private typing = 0;
  private cache = new Map<string, { person: IntercomPerson; expires: number }>();
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
    window.clearTimeout(this.typing);
    this.generation++;
    this.detailGeneration++;
  }

  private setPolling(on: boolean) {
    window.clearInterval(this.poll);
    this.poll = on ? window.setInterval(() => this.onChangeNotice(), POLL_MS) : 0;
  }

  /** WisKey said something changed (or the fallback poll ticked): WisKey's own panel re-issues the directory query
   * after every overview refresh while on the users tab (panel.ts:749); the shown page is refetched here likewise. */
  private onChangeNotice() {
    void this.loadOverview();
    void this.load();
  }

  /** Station names (the filter's list and each grant's label) - single-flight with coalescing, as the entry center's
   * own refetch. */
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
            this.stations = feed.overview.stations.map((s) => ({ id: s.id, name: s.name }));
            this.defaultZone = feed.overview.default_zone ?? UTC_ZONE;
            this.version = feed.overview.version;
            if (this.filters.station && !this.stations.some((s) => s.id === this.filters.station)) this.setFilter('station', '');
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) this.forbidden = true;
          // otherwise the people reply itself says what is wrong; grants show the station id until names arrive
        }
      } while (this.overviewAgain);
    } finally {
      this.overviewBusy = false;
    }
  }

  /** One page of `users/query` (WisKey panel.ts `loadUserPage`): single-flight - a load asked for while one is out is
   * queued once - and a generation counter discards answers for a query no longer current (WisKey's sequence + key
   * check). Every load - the reader's, a change notice's or the fallback poll's - refetches the page currently shown
   * with its snapshot, so a directory that changed underneath is reported as `stale`. The answer's own `offset`
   * (WisKey clamps a past-the-end offset to the last page) and `snapshot` are adopted, as WisKey does; the selection
   * survives when its row is still on the page. */
  private async load() {
    if (this.forbidden) return;
    if (this.busy) {
      this.reloadQueued = true;
      return;
    }
    const generation = ++this.generation;
    this.busy = true;
    try {
      const r = await getIntercomPeople(this.query.trim(), this.filters, this.offset, this.pageSize, this.snapshot);
      if (generation !== this.generation) return;
      this.reply = r;
      this.error = '';
      if (r.people) {
        this.everReady = true;
        this.page = r.people;
        this.offset = r.people.offset ?? this.offset;
        this.snapshot = r.people.snapshot;
        this.shownAt = r.fetched_at;
        const row = r.people.records.find((p) => p.id === this.selected);
        if (!row) this.clearDetail();
        else if (this.detail?.id === row.id && row.revision !== this.detail.revision) void this.select(row.id); // WisKey: a changed revision reloads the card
      }
    } catch (err) {
      if (generation !== this.generation) return;
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else this.error = `${t('panel_data_stale')} (${describeError(err)})`;
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        if (this.reloadQueued) {
          this.reloadQueued = false;
          void this.load();
        }
      }
    }
  }

  /** A new query, filter set, page size or page: whatever is in flight is for the old one (WisKey's sequence check). */
  private restart() {
    this.generation++;
    this.busy = false;
    this.reloadQueued = false;
    this.error = '';
    void this.load();
  }

  // ------------------------------------------------------------------ search, filters, paging

  private editQuery(value: string) {
    this.query = value;
    window.clearTimeout(this.typing);
    this.typing = window.setTimeout(() => this.applyQuery(), TYPING_DEBOUNCE_MS);
  }

  private applyQuery() {
    window.clearTimeout(this.typing);
    this.offset = 0;
    this.restart();
  }

  private setFilter(key: keyof IntercomPeopleFilters, value: string) {
    const next = { ...this.filters };
    if (value) (next as Record<string, string>)[key] = value;
    else delete next[key];
    if (!next.sort) next.sort = 'employee';
    this.filters = next;
    this.offset = 0;
    this.restart();
  }

  /** WisKey's "clear search and filters": keeps the sort. */
  private clear() {
    window.clearTimeout(this.typing);
    this.query = '';
    this.filters = { sort: this.filters.sort ?? 'employee' };
    this.offset = 0;
    this.restart();
  }

  private setPageSize(size: number) {
    this.pageSize = size;
    this.offset = 0;
    this.restart();
  }

  /** WisKey `changeUserPage`: a new offset, the selection dropped (its row is on another page). */
  private changePage(offset: number) {
    this.offset = Math.max(0, offset);
    this.clearDetail();
    this.restart();
  }

  /** The stale banner's action: forget the snapshot and start over from the first page. */
  private reloadFromStart() {
    this.snapshot = '';
    this.offset = 0;
    this.clearDetail();
    this.restart();
  }

  private filtered(): boolean {
    return !!this.query.trim() || Object.entries(this.filters).some(([k, v]) => k !== 'sort' && !!v);
  }

  // ------------------------------------------------------------------ details

  private clearDetail() {
    this.detailGeneration++;
    this.selected = '';
    this.detail = null;
    this.detailError = '';
    this.detailBusy = false;
  }

  /** WisKey `openPersonDetails` + `loadPersonDetails`: fetch `users/get` for the row unless a fresh cached record of the
   * same revision exists. While it loads (or when it fails) the page's own record stays the safe fallback. */
  private async select(id: string) {
    this.selected = id;
    const row = this.page?.records.find((p) => p.id === id);
    const cached = this.cache.get(id);
    if (cached && cached.expires > Date.now() && cached.person.revision === row?.revision) {
      this.detail = cached.person;
      this.detailError = '';
      this.detailBusy = false;
      return;
    }
    const generation = ++this.detailGeneration;
    this.detail = null;
    this.detailError = '';
    this.detailBusy = true;
    try {
      const r = await getIntercomPerson(id);
      if (generation !== this.detailGeneration) return;
      if (r.person) {
        this.cache.delete(id);
        this.cache.set(id, { person: r.person, expires: Date.now() + DETAIL_TTL_MS });
        while (this.cache.size > DETAIL_CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
        this.detail = r.person;
      } else {
        this.detailError = r.state === 'unsupported' ? 'unsupported' : `${FEED_PANELS[r.state === 'ready' ? 'error' : r.state].heading}${r.last_error ? ` (${r.last_error})` : ''}`;
      }
    } catch (err) {
      if (generation !== this.detailGeneration) return;
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else if (err instanceof ApiError && err.code === 'intercom_person_not_found') this.detailError = 'intercom_person_not_found';
      else this.detailError = describeError(err);
    } finally {
      if (generation === this.detailGeneration) this.detailBusy = false;
    }
  }

  // ------------------------------------------------------------------ editing (access.people.manage)

  private get canManage(): boolean {
    return isApi() && can('access.people.manage');
  }

  /** WisKey's `saved` / `saved_sync` notice: the page is refetched (the saved person is selected when it is on it)
   * and the record WisKey returned is shown in the details pane at once. */
  private onSaved(e: CustomEvent<{ person: IntercomEditorPerson; notice: string; note: string }>) {
    const { person, notice, note } = e.detail;
    this.editing = null;
    this.notice = { tone: 'ok', text: `${t(notice)} ${note}` };
    // only the read projection's fields are kept on this screen (the editor's phone / cards / PIN flag stay in the editor)
    const asRow: IntercomPerson = {
      id: person.id, employee_no: person.employee_no, display_name: person.display_name, active: person.active, valid_from: person.valid_from, valid_until: person.valid_until,
      revision: person.revision, group_ids: person.group_ids,
      stations: person.stations.map((s) => ({ station_id: s.station_id, enabled: s.enabled, doors: s.doors, sync_state: s.sync_state })),
    };
    this.cache.set(person.id, { person: asRow, expires: Date.now() + DETAIL_TTL_MS });
    this.selected = person.id;
    this.detail = asRow;
    this.detailError = '';
    this.snapshot = ''; // the directory changed by our own hand: no stale banner for that
    this.restart();
  }

  private onDeleted(e: CustomEvent<{ id: string; notice: string; note: string }>) {
    this.editing = null;
    this.notice = { tone: 'ok', text: `${t(e.detail.notice)} ${e.detail.note}` };
    this.cache.delete(e.detail.id);
    this.clearDetail();
    this.snapshot = '';
    this.restart();
  }

  // ------------------------------------------------------------------ render helpers

  private stationList(): StationInfo[] | null {
    return isApi() ? this.stations : DEMO_STATIONS;
  }

  /** A grant's station name: WisKey's "removed station" only when the station list is known and lacks it. */
  private stationName(id: string): string {
    const list = this.stationList();
    return list?.find((s) => s.id === id)?.name ?? (list ? t('removed_station') : id);
  }

  private columns(): TableColumn[] {
    const row = (r: Record<string, unknown>) => r as unknown as IntercomPerson;
    return [
      {
        key: 'name',
        label: t('name'),
        render: (r) => {
          const p = row(r);
          return html`<span class="who">
            <sw-avatar name=${p.display_name} size=${28} aria-hidden="true"></sw-avatar>
            <span class="who-text"><b data-wiskey-person-name>${p.display_name}</b><small><bdi data-wiskey-person-employee>${p.employee_no}</bdi></small></span>
          </span>`;
        },
      },
      {
        key: 'assignments',
        label: t('assignments'),
        render: (r) => {
          const n = row(r).stations.filter((s) => s.enabled).length;
          return html`<span data-wiskey-person-assignments=${n}>${n} <span class="muted">${t('devices')}</span></span>`;
        },
      },
      {
        key: 'status',
        label: t('status'),
        render: (r) => {
          const p = row(r);
          const status = personSyncStatus(p);
          const b = syncBadge(status);
          return html`<span class="status" title=${t('user_sync_hint')}>
            <sw-badge data-wiskey-person-sync=${status} kind=${b.kind} label=${b.label}></sw-badge>
            <span class="muted" data-wiskey-person-active=${String(p.active)}>${t(p.active ? 'active' : 'inactive')}</span>
          </span>`;
        },
      },
      {
        key: 'validity',
        label: t('validity'),
        render: (r) => {
          const p = row(r);
          const v = validityState(p);
          return html`<span data-wiskey-person-validity=${v} title=${t('validity_summary_hint')}>${t(v)}</span>`;
        },
      },
    ];
  }

  // ------------------------------------------------------------------ render

  render() {
    if (!isApi()) return this.renderPage({ state: 'ready', configured: true, last_error: null, fetched_at: null, people: DEMO_PAGE }, DEMO_PAGE, true);
    if (this.forbidden) {
      return html`<sw-page heading=${TITLE}><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (!this.reply) {
      return html`<sw-page heading=${TITLE}>${this.error
        ? html`<sw-state-panel data-wiskey-state="load_error" state="error" heading="לא ניתן לטעון את ספריית האנשים" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    return this.renderPage(this.reply, this.page, false);
  }

  private renderPage(reply: IntercomPeopleReply, page: IntercomPeoplePage | null, demo: boolean) {
    const manage = !demo && this.canManage;
    const sub = `מי מנוהל ב־WisKey, לאילו תחנות יש לו הרשאה ומה מצב הסנכרון${manage ? '' : ' · צפייה בלבד'}${demo ? ' · נתוני הדגמה' : ''}`;
    const ready = reply.state === 'ready';
    return html`<sw-page heading=${TITLE} subheading=${sub} wide>
      ${this.renderBadge(reply.state, demo)}
      ${demo ? nothing : html`<sw-button slot="actions" size="sm" variant="ghost" icon="refresh" data-wiskey-people-refresh ?disabled=${this.busy} @click=${() => void this.load()}>${t('refresh')}</sw-button>`}
      ${manage && ready ? html`<sw-button slot="actions" size="sm" variant="primary" icon="plus" data-wiskey-people-add @click=${() => (this.editing = 'new')}>${t('add_user')}</sw-button>` : nothing}
      ${this.renderNoPush(demo)}
      ${page && !ready ? this.renderStaleNote(reply.state) : nothing}
      ${this.error ? html`<div class="note err" role="status" data-wiskey-people-error>${this.error}</div>` : nothing}
      ${this.notice
        ? html`<div class="note ${this.notice.tone === 'ok' ? 'ok' : 'stale'}" role="status" data-wiskey-people-notice=${this.notice.tone}>
            <sw-icon name=${this.notice.tone === 'ok' ? 'check' : 'warning'} size=${16}></sw-icon>
            <span>${this.notice.text}</span>
            <sw-button size="sm" variant="ghost" iconOnly icon="close" label="סגור" @click=${() => (this.notice = null)}></sw-button>
          </div>`
        : nothing}
      ${this.editing
        ? html`<wiskey-person-editor .userId=${this.editing === 'new' ? '' : this.editing.id} @editor-saved=${(e: CustomEvent) => this.onSaved(e)} @editor-deleted=${(e: CustomEvent) => this.onDeleted(e)} @editor-close=${() => (this.editing = null)}></wiskey-person-editor>`
        : nothing}
      ${this.everReady || demo ? this.renderFilters(demo) : nothing}
      ${page ? this.renderRecords(page, demo) : this.busy && this.everReady ? html`<sw-state-panel state="loading"></sw-state-panel>` : this.renderStatePanel(reply)}
    </sw-page>`;
  }

  private renderBadge(s: PeopleState, demo: boolean) {
    if (demo) return html`<sw-badge slot="actions" kind="neutral" label="נתוני הדגמה"></sw-badge>`;
    const { kind, label } = s === 'unsupported' ? { kind: 'error' as StateKind, label: 'לא נתמך' } : feedBadge(s, this.version);
    return html`<sw-badge slot="actions" data-wiskey-feed=${s} kind=${kind} label=${label}></sw-badge>`;
  }

  /** WisKey has no directory push, and the page says so rather than pretending to be live. */
  private renderNoPush(demo: boolean) {
    if (demo) return nothing;
    return html`<div class="note info" role="note" data-wiskey-people-nopush>
      <sw-icon name="info" size=${16}></sw-icon>
      <span
        >ספריית האנשים אינה מתעדכנת בזמן אמת: WisKey אינו שולח שינויים בדחיפה. העמוד המוצג נטען מחדש כשמרכז הכניסה מקבל עדכון
        מ־WisKey, או ב${t('refresh')} ידני${this.notices ? '' : '. ההודעות על שינויים אינן זמינות כרגע, ולכן העמוד נבדק מחדש כל 30 שניות'}.${this.shownAt
          ? html` נטען לאחרונה: <bdi data-wiskey-people-fetched>${formatTime(this.shownAt, 'he-IL', this.defaultZone)}</bdi>.`
          : nothing}</span
      >
    </div>`;
  }

  /** The feed dropped after a page was shown: it stays, marked as last-known (the entry center's stale note). */
  private renderStaleNote(s: PeopleState) {
    const heading = s === 'unsupported' ? 'גרסת WisKey המותקנת אינה תומכת בספריית האנשים' : FEED_PANELS[s === 'ready' ? 'error' : s].heading;
    return html`<div class="note stale" role="status" data-wiskey-stale>
      <sw-icon name="offline" size=${16}></sw-icon>
      <span>${heading}. מוצג העמוד האחרון שנטען${this.shownAt ? html` (<bdi>${formatTime(this.shownAt, 'he-IL', this.defaultZone)}</bdi>)` : nothing} - ייתכן שאינו עדכני.</span>
    </div>`;
  }

  private renderStatePanel(reply: IntercomPeopleReply) {
    if (reply.state === 'unsupported') {
      return html`<sw-state-panel data-wiskey-state="unsupported" state="empty" heading="גרסת WisKey המותקנת אינה תומכת בספריית האנשים" hint="WisKey אינו מכיר את הפקודה users/query. אחרי עדכון WisKey הספרייה תוצג כאן."></sw-state-panel>`;
    }
    const p: { panel: PanelState; heading: string; hint: string } = FEED_PANELS[reply.state === 'ready' ? 'error' : reply.state];
    // a per-request failure (rate limit, busy, timeout) is retried by the next change notice or a manual refresh
    const hint = reply.state === 'error' ? `הבקשה ל־WisKey לא הושלמה${reply.last_error ? ` (${reply.last_error})` : ''}. אפשר לנסות שוב ב${t('refresh')}.` : p.hint;
    return html`<sw-state-panel data-wiskey-state=${reply.state} state=${p.panel} heading=${p.heading} hint=${hint}></sw-state-panel>`;
  }

  /** WisKey's users toolbar and `user-filters` details: search, station / rights / state selects and the sort. */
  private renderFilters(demo: boolean) {
    const f = this.filters;
    const off = demo;
    const select = (name: string, key: keyof IntercomPeopleFilters, label: string, options: [string, string][], any: boolean) => html`<sw-field label=${t(label)}>
      <select name=${name} data-wiskey-people-filter=${key} aria-label=${t(label)} .value=${f[key] ?? ''} ?disabled=${off} @change=${(e: Event) => this.setFilter(key, (e.target as HTMLSelectElement).value)}>
        ${any ? html`<option value="" ?selected=${!f[key]}>${t('filter_any')}</option>` : nothing}
        ${options.map(([v, name]) => html`<option value=${v} ?selected=${v === f[key]}>${name}</option>`)}
      </select>
    </sw-field>`;
    return html`<sw-card class="filters" data-wiskey-people-filters>
      <div class="filter-head">
        <b>${t('user_filter_controls')}</b>
        ${this.filtered() ? html`<sw-button size="sm" variant="ghost" data-wiskey-people-clear ?disabled=${off} @click=${() => this.clear()}>${t('clear_user_filters')}</sw-button>` : nothing}
      </div>
      <form class="form-grid" @submit=${(e: Event) => { e.preventDefault(); this.applyQuery(); }}>
        <sw-field class="search" label="חיפוש">
          <input type="search" name="query" data-wiskey-people-search maxlength="160" placeholder="חיפוש לפי שם או מזהה עובד" aria-label="חיפוש לפי שם או מזהה עובד" .value=${this.query} ?disabled=${off} @input=${(e: Event) => this.editQuery((e.target as HTMLInputElement).value)} />
        </sw-field>
        ${select('station', 'station', 'user_filter_station', (this.stationList() ?? []).map((s) => [s.id, s.name]), true)}
        ${select('rights', 'rights', 'user_filter_rights', RIGHTS.map((v) => [v, t(`filter_${v}`)]), true)}
        ${select('state', 'state', 'user_filter_state', STATES.map((v) => [v, t(`filter_${v}`)]), true)}
        ${select('sort', 'sort', 'user_sort', SORTS.map((v) => [v, t(`sort_${v}`)]), false)}
      </form>
      <div class="muted">החיפוש מתבצע ב־Arx לפי שם ומזהה עובד בלבד; הטקסט אינו נשלח ל־WisKey.</div>
    </sw-card>`;
  }

  private renderRecords(page: IntercomPeoplePage, demo: boolean) {
    const records = page.records;
    const total = page.total ?? records.length;
    const offset = page.offset ?? 0;
    const size = page.limit ?? this.pageSize;
    const from = offset + (records.length ? 1 : 0);
    const to = offset + records.length;
    const pages = Math.ceil(total / size);
    const current = total ? Math.floor(offset / size) + 1 : 0;
    const filtered = this.filtered();
    const selected = records.find((p) => p.id === this.selected) ?? null;
    return html`
      ${page.stale
        ? html`<div class="note stale" role="status" data-wiskey-people-stale>
            <sw-icon name="offline" size=${16}></sw-icon>
            <span>ספריית האנשים ב־WisKey השתנתה מאז שהדפדוף התחיל, ולכן ייתכן שהעמוד הזה אינו רציף עם העמודים הקודמים (אנשים עשויים להיות חסרים או להופיע פעמיים).</span>
            <sw-button size="sm" variant="ghost" icon="refresh" data-wiskey-people-restart ?disabled=${demo || this.busy} @click=${() => this.reloadFromStart()}>טען מחדש מהעמוד הראשון</sw-button>
          </div>`
        : nothing}
      ${!page.complete
        ? html`<div class="note stale" role="status" data-wiskey-people-incomplete=${page.incomplete_reason ?? 'unknown'}>
            <sw-icon name="warning" size=${16}></sw-icon>
            <span>${page.incomplete_reason === 'rate_limited'
              ? 'WisKey הגביל את קצב הבקשות והסריקה נעצרה לפני סופה, ולכן מספר התוצאות הוא מינימום וייתכן שחסרות התאמות. צמצמו את החיפוש - טקסט מדויק יותר או מסננים - או נסו שוב בעוד כמה שניות.'
              : 'החיפוש נעצר לפני שכל הספרייה נסרקה (מגבלת הסריקה לבקשה אחת), ולכן מספר התוצאות הוא מינימום וייתכן שחסרות התאמות. צמצמו את החיפוש - טקסט מדויק יותר או מסננים.'}</span>
          </div>`
        : nothing}
      <div class="summary" role="status">
        <span data-wiskey-people-results=${total}>${t('user_results')}: <bdi dir="ltr">${from}–${to} / ${total}${page.complete ? '' : '+'}</bdi></span>
        ${filtered && page.total_all !== null ? html`<span class="muted" data-wiskey-people-total-all=${page.total_all}>מתוך ${page.total_all.toLocaleString('he-IL')} בספרייה</span>` : nothing}
      </div>
      <nav class="paging" aria-label=${t('user_pagination')} data-wiskey-people-paging>
        <label class="muted">${t('users_per_page')}
          <select data-wiskey-people-page-size .value=${String(this.pageSize)} ?disabled=${demo} @change=${(e: Event) => this.setPageSize(Number((e.target as HTMLSelectElement).value))}>
            ${PEOPLE_PAGE_SIZES.map((n) => html`<option value=${n} ?selected=${n === this.pageSize}>${n}</option>`)}
          </select>
        </label>
        <sw-button size="sm" variant="ghost" data-wiskey-people-prev ?disabled=${demo || this.busy || page.previous_offset === null} @click=${() => this.changePage(page.previous_offset ?? 0)}>${t('wall_previous')}</sw-button>
        <span data-wiskey-people-page=${current}><bdi dir="ltr">${current} / ${pages}</bdi></span>
        <sw-button size="sm" variant="ghost" data-wiskey-people-next ?disabled=${demo || this.busy || page.next_offset === null} @click=${() => this.changePage(page.next_offset ?? offset + size)}>${t('wall_next')}</sw-button>
        ${this.busy ? html`<span class="muted" role="status" data-wiskey-people-loading>${t('user_page_loading')}</span>` : nothing}
      </nav>
      ${records.length
        ? html`<div class="layout">
            <div class="main">
              <sw-table dense data-wiskey-people-table .columns=${this.columns()} .rows=${records as unknown as Record<string, unknown>[]} .selected=${selected?.id ?? null} @row-select=${(e: CustomEvent<{ id: string }>) => (demo ? (this.selected = e.detail.id) : void this.select(e.detail.id))}></sw-table>
            </div>
            ${selected ? this.renderInspector(selected, demo) : html`<aside class="side"><sw-card heading=${t('person_details')} data-wiskey-person-none><p class="muted">בחרו אדם ברשימה כדי לראות את פרטיו, את תוקף ההרשאה ואת התחנות שבהן יש לו גישה.</p></sw-card></aside>`}
          </div>`
        : html`<sw-state-panel compact state="empty" data-wiskey-people-empty heading=${t(filtered ? 'no_results' : 'no_users')} hint=${filtered ? 'נסו להרחיב או לנקות את החיפוש והמסננים.' : !demo && this.canManage ? `הוסיפו אדם ראשון ב"${t('add_user')}".` : 'ניהול אנשים מתבצע ב־WisKey עצמו.'}></sw-state-panel>`}
    `;
  }

  /** WisKey's embedded `wiskey-user-details` (the users tab's right-hand pane), reduced to what the projection serves:
   * no phone, profile fields, PIN, cards, timing policy, WhatsApp or "Edit". */
  private renderInspector(row: IntercomPerson, demo: boolean) {
    const p = (!demo && this.detail?.id === row.id ? this.detail : null) ?? row;
    const fromList = !demo && (this.detail?.id !== row.id);
    const v = validityState(p);
    const enabled = p.stations.filter((s) => s.enabled);
    const disabled = p.stations.filter((s) => !s.enabled);
    return html`<aside class="side">
      <sw-card heading=${t('person_details')} data-wiskey-person-detail=${p.id} data-wiskey-person-detail-source=${fromList ? 'list' : 'record'}>
        <div class="identity">
          <sw-avatar name=${p.display_name} size=${44} aria-hidden="true"></sw-avatar>
          <div><b>${p.display_name}</b><div class="muted"><bdi>${p.employee_no}</bdi></div></div>
        </div>
        ${this.detailBusy && fromList ? html`<p class="muted" role="status" data-wiskey-person-detail-loading>${t('loading')}</p>` : nothing}
        ${this.detailError
          ? html`<div class="note err" role="alert" data-wiskey-person-detail-error=${this.detailError}>${this.detailError === 'intercom_person_not_found'
              ? 'האדם הזה לא נמצא עוד ב־WisKey (ייתכן שנמחק). מוצגים הפרטים כפי שהופיעו ברשימה שנטענה.'
              : this.detailError === 'unsupported'
                ? 'גרסת WisKey המותקנת אינה מכירה את הפקודה users/get. מוצגים הפרטים כפי שהופיעו ברשימה.'
                : `לא ניתן לטעון את הרשומה העדכנית (${this.detailError}). מוצגים הפרטים כפי שהופיעו ברשימה.`}</div>`
          : nothing}
        <dl>
          <dt>${t('employee_id')}</dt>
          <dd><bdi>${p.employee_no}</bdi></dd>
          <dt>${t('status')}</dt>
          <dd data-wiskey-person-detail-active=${String(p.active)}>${t(p.active ? 'active' : 'inactive')}</dd>
          <dt>${t('profile_groups')}</dt>
          <dd>${p.group_ids.length ? html`<bdi>${p.group_ids.join(', ')}</bdi> <span class="muted">(מזהי קבוצות ב־WisKey)</span>` : '—'}</dd>
          <dt>${t('validity')}</dt>
          <dd data-wiskey-person-detail-validity=${v}>
            ${t(v)}
            ${v !== 'permanent' ? html`<div class="muted">${t('clock_ha_zone')}: <bdi>${this.defaultZone.name}</bdi></div>` : nothing}
            ${p.valid_from ? html`<div class="muted">${t('valid_from')}: <bdi>${formatTime(p.valid_from, 'he-IL', this.defaultZone)}</bdi></div>` : nothing}
            ${p.valid_until ? html`<div class="muted">${t('valid_until')}: <bdi>${formatTime(p.valid_until, 'he-IL', this.defaultZone)}</bdi></div>` : nothing}
          </dd>
        </dl>
        <h4>${t('assignments')}</h4>
        ${enabled.length || disabled.length
          ? html`<ul class="rights">
              ${enabled.map((s) => {
                const b = syncBadge(s.sync_state ?? 'pending');
                return html`<li data-wiskey-person-grant=${s.station_id}>
                  <span>${this.stationName(s.station_id)} · ${t('door')} <bdi>${s.doors.join(', ') || '—'}</bdi></span>
                  <sw-badge kind=${b.kind} label=${b.label}></sw-badge>
                </li>`;
              })}
              ${disabled.map((s) => html`<li class="off" data-wiskey-person-grant-disabled=${s.station_id}>
                <span>${this.stationName(s.station_id)}</span>
                <sw-badge kind="neutral" label=${t('filter_disabled')}></sw-badge>
              </li>`)}
            </ul>`
          : html`<p class="muted">${t('filter_unassigned')}</p>`}
        ${!demo && this.canManage
          ? html`<div class="detail-actions">
              <sw-button size="sm" icon="edit" data-wiskey-person-edit ?disabled=${this.detailBusy} @click=${() => (this.editing = { id: p.id })}>${t('edit')}</sw-button>
              <span class="muted">טלפון, קוד כניסה וכרטיסים נטענים בעורך בלבד.</span>
            </div>`
          : html`<p class="muted">עריכת אנשים מתבצעת ב־WisKey עצמו. כאן מוצגים שם, מזהה עובד, מצב, תוקף, קבוצות והרשאות לתחנות - לא יותר.</p>`}
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
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .note.ok {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .detail-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      margin-block-start: 10px;
    }
    .filters {
      display: block;
    }
    .filter-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 12px;
      margin-block-end: 10px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px 12px;
      align-items: end;
    }
    .form-grid .search {
      grid-column: span 2;
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
      .form-grid .search {
        grid-column: auto;
      }
    }
    .filters > .muted {
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
    .paging {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      font-size: var(--sw-fs-sm);
    }
    .paging select {
      margin-inline-start: 4px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
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
    .who {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .who-text {
      display: inline-flex;
      flex-direction: column;
      line-height: 1.25;
    }
    .who-text small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .status {
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
      align-items: flex-start;
    }
    .identity {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block-end: 10px;
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
    h4 {
      margin: 12px 0 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    ul.rights {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    ul.rights li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    ul.rights li.off {
      color: var(--sw-text-3);
    }
    aside p {
      margin: 10px 0 0;
    }
    aside .note {
      margin-block-end: 8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-people': WiskeyPeople;
  }
}
