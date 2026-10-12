import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../components/sw-avatar';
import './wiskey-person-editor';
import './wiskey-person-drawer';
import './wiskey-message-dialog';
import type { StateKind } from '../components/sw-badge';
import { can, isApi, onSession } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { subscribeIntercom, type DisplayZone, type IntercomEditorPerson } from '../api/intercom';
import {
  getAcFeatures,
  getAcGroups,
  getAcPeople,
  getAcPerson,
  getAcStations,
  type AcFeaturesReply,
  type AcGroup,
  type AcPeoplePage,
  type AcPeopleReply,
  type AcPerson,
  type AcProfileField,
  type AcStationLite,
} from '../api/access-people';
import { createFakeDemoTransport, createFakeDraftTransport } from '../api/messaging-fake';
import { accessControlAccess, type AccessControlAccess } from '../access-control/access';
import {
  CREDENTIALS,
  PEOPLE_PAGE,
  PEOPLE_MAX_LIMIT,
  RIGHTS,
  SORTS,
  STATES,
  clearedFilters,
  countLine,
  credentialKinds,
  effectiveView,
  enabledStations,
  filterCount,
  isFiltered,
  mergeRows,
  nextOffset,
  parseColumnPrefs,
  parseView,
  personSyncStatus,
  pruneSelection,
  sanitizeFilters,
  selectionState,
  setProfileFilter,
  toggleAll,
  toggleColumn,
  toggleSelected,
  visibleColumns,
  offeredColumns,
  withFilter,
  type ColumnKey,
  type PeopleFilters,
  type PeopleRequest,
  type PeopleView,
} from '../access-control/people-logic';
import type { MessagingConfig, MessagingTransport } from '../access-control/messaging-logic';
import { pt } from '../i18n/access-people';
import { formatTime, t, UTC_ZONE } from './wiskey-format';
import { stateBadge, syncKind, validityText } from './wiskey-person-drawer';

const POLL_MS = 30000; // while the change notices are down, the shown list is refetched this often
const TYPING_DEBOUNCE_MS = 250;
const NOTICE_COALESCE_MS = 800; // WisKey sends a data-free notice for any change: one refetch for a burst
const STORE_VIEW = 'sw.people.view';
const STORE_COLUMNS = 'sw.people.columns';

/** The sync status as a badge for the person editor's station rows (WisKey `badge(status)`): the editor's own contract, unchanged. */
export function syncBadge(status: string): { kind: StateKind; label: string } {
  if (status === 'synced') return { kind: 'recorded', label: t('synced') };
  if (status === 'pending' || status === 'syncing' || status === 'delete_pending') return { kind: 'stale', label: t(status) };
  if (status === 'conflict' || status === 'error') return { kind: 'error', label: t(status) };
  if (status === 'offline') return { kind: 'offline', label: t('offline') };
  if (status === 'unassigned') return { kind: 'unknown', label: t('filter_unassigned') };
  return { kind: 'neutral', label: t(status) };
}

type Phase = 'loading' | 'ready' | 'forbidden' | 'unavailable' | 'unsupported' | 'error';

const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private window or blocked storage: the choice lasts until the page closes */
    }
  },
};

const DEMO_ZONE: DisplayZone = { kind: 'iana', name: 'Asia/Jerusalem' };
const DEMO_STATIONS: AcStationLite[] = [{ id: 'd1', name: 'שער ראשי' }, { id: 'd2', name: 'לובי' }, { id: 'd3', name: 'חניון' }];
const DEMO_GROUPS: AcGroup[] = [{ id: 'staff', label: 'עובדים', enabled: true, station_ids: ['d1', 'd2'] }, { id: 'night', label: 'משמרת לילה', enabled: true, station_ids: ['d3'] }];
const demoPerson = (id: string, employee_no: string, display_name: string, extra: Partial<AcPerson> = {}): AcPerson => ({
  id, display_name, active: true, archived: false, valid_from: null, valid_until: null, revision: 1, access_category: 'staff', user_type: 'normal', identity_locked: false,
  employee_no, group_ids: [], stations: [], timing: null, level: 'sensitive', editable: false, phone: null, phone_set: true, credentials: { pin: true, cards: 1 },
  photo_configured: false, profile: null, responsible_person: null, access_purpose: null, ...extra,
});
const st = (station_id: string, sync_state: string, enabled = true) => ({ station_id, enabled, doors: [1], sync_state, last_sync_at: null, last_error: null });
const DEMO_ROWS: AcPerson[] = [
  demoPerson('p1', '1001', 'דנה כהן', { group_ids: ['staff'], stations: [st('d1', 'synced'), st('d2', 'synced')], credentials: { pin: true, cards: 2 } }),
  demoPerson('p2', '1017', 'יוסי לוי', { stations: [st('d1', 'pending')], credentials: { pin: false, cards: 1 } }),
  demoPerson('p3', '1033', 'מאיה כץ', { valid_from: '2026-01-01T00:00:00+02:00', valid_until: '2026-06-30T00:00:00+03:00', stations: [st('d3', 'synced')], phone_set: false, credentials: { pin: true, cards: 0 } }),
  demoPerson('p4', '2044', 'אורן ברק', { active: false, group_ids: ['night'], stations: [st('d2', 'error', false)], credentials: { pin: false, cards: 0 } }),
  demoPerson('p5', '2051', 'נועה שלו', { credentials: { pin: false, cards: 1 } }),
];

/**
 * The people of the access-control area ("אנשים"), native (CR-036 slice S7): the directory with server-side filters (group,
 * station, state, rights, credential kind, profile field), sort, text search that includes the employee number, "load more" paging
 * that carries WisKey's snapshot (a changed directory is said, never hidden), three views (cards, list, table with a column
 * chooser), a person's page in a drawer (details with the validity and timing views, access per station with its sync state,
 * groups, the sensitive section, the audited photo), a selection with a bulk bar, and the message dialog (fakes only: see
 * api/messaging-fake.ts).
 *
 * WHO SEES WHAT is the server's (services/intercom_authority.py): this screen only shapes itself from the answer. It needs
 * `access.people.read` (the new permission, at any scope a station can be) - a viewer holding only `access.read` sees the "not
 * available to you" panel, never an empty list. A field the caller may not see is simply absent (no placeholder, no greyed control):
 * the credentials column, the credential and profile filters, the phone, the photo and the profile values are sensitive-level; the
 * employee-number column and the search by number follow the administrator's setting through `employee_no_visible`.
 *
 * The person editor, the PIN generator and the card capture are the existing components, untouched (their gate moves in a later
 * slice): "עריכה" in the person's page and "הוספת אדם" open `wiskey-person-editor` exactly as before.
 *
 * Operator-screen hygiene: no hint paragraphs, no platform names, no codes; the only texts are titles, counts, labels, state words
 * and one-line confirmations. The change notices (data-free, from the add-on's feed) refetch the shown list; when they are down the
 * list is polled.
 */
@customElement('wiskey-people')
export class WiskeyPeople extends LitElement {
  @state() private access: AccessControlAccess = accessControlAccess();
  @state() private phase: Phase = 'loading';
  @state() private panelNote = '';
  @state() private rows: AcPerson[] = [];
  @state() private page: AcPeoplePage | null = null;
  @state() private shownAt: string | null = null;
  @state() private feedDown = false;
  @state() private changed = false; // the directory moved under the paging, or grew beyond one refetch
  @state() private busy = false;
  @state() private moreBusy = false;
  @state() private query = '';
  @state() private filters: PeopleFilters = {};
  @state() private view: PeopleView | null = parseView(store.get(STORE_VIEW));
  @state() private columns: ColumnKey[] | null = parseColumnPrefs(store.get(STORE_COLUMNS));
  @state() private columnsOpen = false;
  @state() private phone = false;
  @state() private stations: AcStationLite[] = [];
  @state() private zone: DisplayZone = UTC_ZONE;
  @state() private groups: AcGroup[] = [];
  @state() private fields: AcProfileField[] | null = null;
  @state() private features: AcFeaturesReply['features'] = {};
  @state() private photoOn = true;
  @state() private profileDraft: { field: string; value: string } = { field: '', value: '' };
  @state() private selecting = false;
  @state() private selected: Set<string> = new Set();
  @state() private openId = '';
  @state() private drawerOpen = false;
  @state() private detail: AcPerson | null = null;
  @state() private detailLoading = false;
  @state() private detailError: '' | 'gone' | 'failed' = '';
  @state() private editing: { id: string } | 'new' | null = null;
  @state() private notice: { tone: 'ok' | 'warn'; text: string } | null = null;
  @state() private transport: MessagingTransport | null = null;
  @state() private msgConfig: MessagingConfig | null = null;
  @state() private message: { people: { id: string; name: string }[]; inDrawer: boolean } | null = null;

  private generation = 0;
  private detailGeneration = 0;
  private inflight = false;
  private queued = false;
  private typing = 0;
  private coalesce = 0;
  private poll = 0;
  private stop: (() => void) | null = null;
  private stopSession: (() => void) | null = null;
  private media: MediaQueryList | null = null;
  private onMedia = () => (this.phone = !!this.media?.matches);

  // ------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    this.media = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 767px)') : null;
    this.phone = !!this.media?.matches;
    this.media?.addEventListener('change', this.onMedia);
    if (!isApi()) {
      this.phase = 'ready';
      this.rows = DEMO_ROWS;
      this.stations = DEMO_STATIONS;
      this.zone = DEMO_ZONE;
      this.groups = DEMO_GROUPS;
      this.transport = createFakeDemoTransport();
      void this.transport.config().then((c) => (this.msgConfig = c));
      return;
    }
    this.stopSession = onSession(() => {
      const next = accessControlAccess();
      const was = this.access.people;
      this.access = next;
      if (next.people && !was && this.phase === 'forbidden') this.begin();
    });
    if (!this.access.people) {
      this.phase = 'forbidden';
      return;
    }
    this.begin();
    this.stop = subscribeIntercom(
      (m) => {
        if (m.type === 'intercom_refresh' || m.type === 'intercom_state') this.scheduleRefresh();
      },
      (connected) => {
        window.clearInterval(this.poll);
        this.poll = connected ? 0 : window.setInterval(() => this.scheduleRefresh(), POLL_MS);
        if (connected) this.scheduleRefresh(); // notices sent while the socket was down are gone: catch up now
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.media?.removeEventListener('change', this.onMedia);
    this.stop?.();
    this.stop = null;
    this.stopSession?.();
    this.stopSession = null;
    window.clearTimeout(this.typing);
    window.clearTimeout(this.coalesce);
    window.clearInterval(this.poll);
    this.generation++;
    this.detailGeneration++;
  }

  private begin() {
    this.phase = 'loading';
    void this.loadMeta();
    void this.reload();
  }

  // ------------------------------------------------------------------ data

  private get filterAccess() {
    return { people: this.access.people, sensitive: this.access.sensitive };
  }

  private request(offset: number, limit: number, snapshot: string): PeopleRequest {
    return { query: this.query, filters: sanitizeFilters(this.filters, this.filterAccess), offset, limit, snapshot };
  }

  /** Features, station names, groups and (when offered) the message configuration: none of them is fatal. */
  private async loadMeta() {
    const [features, stations, groups] = await Promise.allSettled([getAcFeatures(), getAcStations(), getAcGroups()]);
    if (features.status === 'fulfilled') {
      this.features = features.value.features ?? {};
      this.transport = this.features.messaging?.available === true ? createFakeDraftTransport() : null;
      this.photoOn = this.features.person_photo?.available !== false;
      if (this.transport) {
        try {
          this.msgConfig = await this.transport.config();
        } catch {
          this.msgConfig = null;
        }
      }
    }
    if (stations.status === 'fulfilled' && stations.value.stations) {
      this.stations = stations.value.stations;
      this.zone = (stations.value as { default_zone?: DisplayZone | null }).default_zone ?? UTC_ZONE;
      if (this.filters.station && !this.stations.some((s) => s.id === this.filters.station)) this.filters = withFilter(this.filters, 'station', '');
    }
    if (groups.status === 'fulfilled' && groups.value.groups) {
      this.groups = groups.value.groups.groups;
      this.fields = groups.value.groups.fields;
      this.photoOn = this.photoOn && groups.value.groups.photo_enabled !== false;
    }
  }

  /** A new query, filter set or sort (and the first load): start over from the first page. */
  private async reload() {
    const generation = ++this.generation;
    this.busy = true;
    this.moreBusy = false;
    try {
      const reply = await getAcPeople(this.request(0, PEOPLE_PAGE, ''));
      if (generation !== this.generation) return;
      this.apply(reply, 'replace');
    } catch (err) {
      if (generation !== this.generation) return;
      this.fail(err);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  /** "עוד N": the next page, carrying the snapshot of the one before, appended; a person already shown is not repeated. */
  private async loadMore() {
    const page = this.page;
    const next = page ? nextOffset(page) : null;
    if (!page || next === null || this.moreBusy || this.busy) return;
    const generation = this.generation;
    this.moreBusy = true;
    try {
      const reply = await getAcPeople(this.request(next, PEOPLE_PAGE, page.snapshot));
      if (generation !== this.generation) return;
      this.apply(reply, 'append');
    } catch (err) {
      if (generation !== this.generation) return;
      this.fail(err);
    } finally {
      if (generation === this.generation) this.moreBusy = false;
    }
  }

  private scheduleRefresh() {
    window.clearTimeout(this.coalesce);
    this.coalesce = window.setTimeout(() => void this.refresh(), NOTICE_COALESCE_MS);
  }

  /** WisKey said something changed (or the fallback poll ticked): the rows shown are asked for again in one request (up to the
   * server's largest page); a list longer than that is marked "changed" instead and the sender decides. */
  private async refresh() {
    if (this.phase === 'forbidden' || !this.access.people) return;
    if (this.inflight) {
      this.queued = true;
      return;
    }
    if (this.rows.length > PEOPLE_MAX_LIMIT) {
      this.changed = true;
      return;
    }
    this.inflight = true;
    const generation = ++this.generation;
    try {
      const reply = await getAcPeople(this.request(0, Math.max(PEOPLE_PAGE, this.rows.length), ''));
      if (generation !== this.generation) return;
      this.apply(reply, 'replace');
    } catch (err) {
      if (generation !== this.generation) return;
      if (this.rows.length) this.feedDown = true;
      else this.fail(err);
    } finally {
      this.inflight = false;
      if (this.queued) {
        this.queued = false;
        void this.refresh();
      }
    }
  }

  private apply(reply: AcPeopleReply, mode: 'replace' | 'append') {
    if (reply.state === 'ready' && reply.people) {
      const page = reply.people;
      this.rows = mergeRows(this.rows, page.records, mode);
      this.page = page; // its `next_offset` continues right after the rows it covered; its `snapshot` is the one the next page carries
      this.shownAt = reply.fetched_at;
      this.feedDown = false;
      this.changed = mode === 'append' ? page.stale : false;
      this.phase = 'ready';
      this.selected = pruneSelection(this.selected, this.rows);
      if (this.openId) {
        const row = this.rows.find((p) => p.id === this.openId);
        if (row && this.detail && row.revision !== this.detail.revision) void this.openPerson(this.openId, false);
      }
      return;
    }
    if (reply.state === 'unsupported') {
      if (!this.rows.length) this.phase = 'unsupported';
      return;
    }
    if (reply.state === 'forbidden') {
      this.phase = 'forbidden';
      return;
    }
    if (reply.state === 'connecting' && !this.rows.length) {
      this.phase = 'loading';
      return;
    }
    if (this.rows.length) {
      this.feedDown = true; // the last list stays, marked as the last known
      return;
    }
    this.phase = reply.state === 'error' ? 'error' : 'unavailable';
    this.panelNote = reply.last_error ?? '';
  }

  private fail(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      this.phase = 'forbidden';
      return;
    }
    if (this.rows.length) {
      this.feedDown = true;
      return;
    }
    this.phase = 'error';
    this.panelNote = describeError(err);
  }

  // ------------------------------------------------------------------ search, filters, view

  private editQuery(value: string) {
    this.query = value;
    window.clearTimeout(this.typing);
    this.typing = window.setTimeout(() => this.restart(), TYPING_DEBOUNCE_MS);
  }

  private restart() {
    window.clearTimeout(this.typing);
    this.selected = new Set();
    if (!isApi()) return;
    void this.reload();
  }

  private setFilter(key: 'station' | 'group' | 'rights' | 'state' | 'credential' | 'sort', value: string) {
    this.filters = withFilter(this.filters, key, value);
    this.restart();
  }

  private clearAll() {
    window.clearTimeout(this.typing);
    this.query = '';
    this.filters = clearedFilters(this.filters);
    this.profileDraft = { field: '', value: '' };
    this.restart();
  }

  private applyProfile() {
    const { field, value } = this.profileDraft;
    if (!field || !value.trim()) return;
    this.filters = setProfileFilter(this.filters, field, value.trim());
    this.profileDraft = { field: '', value: '' };
    this.restart();
  }

  private setView(view: PeopleView) {
    this.view = view;
    store.set(STORE_VIEW, view);
    this.columnsOpen = false;
  }

  private setColumns(key: ColumnKey) {
    this.columns = toggleColumn(this.columns, key, this.access, this.employeeNoVisible);
    store.set(STORE_COLUMNS, JSON.stringify(this.columns));
  }

  private get employeeNoVisible(): boolean {
    return this.page?.employee_no_visible ?? true;
  }

  private get shownView(): PeopleView {
    return effectiveView(this.view, this.phone);
  }

  // ------------------------------------------------------------------ the person's page

  private async openPerson(id: string, focus = true) {
    this.openId = id;
    if (focus) this.drawerOpen = true;
    const row = this.rows.find((p) => p.id === id) ?? null;
    this.detail = row;
    this.detailError = '';
    if (!isApi()) {
      this.detailLoading = false;
      return;
    }
    this.detailLoading = true;
    const generation = ++this.detailGeneration;
    try {
      const reply = await getAcPerson(id);
      if (generation !== this.detailGeneration) return;
      if (reply.state === 'ready' && reply.person) this.detail = reply.person;
      else this.detailError = 'failed';
    } catch (err) {
      if (generation !== this.detailGeneration) return;
      this.detailError = err instanceof ApiError && (err.status === 404 || err.status === 403) ? 'gone' : 'failed';
    } finally {
      if (generation === this.detailGeneration) this.detailLoading = false;
    }
  }

  private closePerson() {
    this.detailGeneration++;
    this.drawerOpen = false;
    this.openId = '';
    this.detail = null;
    this.detailLoading = false;
    this.detailError = '';
    this.message = this.message?.inDrawer ? null : this.message;
  }

  // ------------------------------------------------------------------ the editor (access.people.manage; unchanged)

  private get canManage(): boolean {
    return isApi() && can('access.people.manage');
  }

  private onSaved(e: CustomEvent<{ person: IntercomEditorPerson; notice: string; note: string }>) {
    const { person, notice, note } = e.detail;
    this.editing = null;
    this.notice = { tone: 'ok', text: `${t(notice)} ${note}` };
    this.selected = new Set();
    void this.reload().then(() => {
      if (this.rows.some((p) => p.id === person.id)) void this.openPerson(person.id);
    });
  }

  private onDeleted(e: CustomEvent<{ id: string; notice: string; note: string }>) {
    this.editing = null;
    this.notice = { tone: 'ok', text: `${t(e.detail.notice)} ${e.detail.note}` };
    this.closePerson();
    this.selected = new Set();
    void this.reload();
  }

  private openEditor(target: { id: string } | 'new') {
    this.drawerOpen = false; // the editor is a page-level dialog: it must not sit behind the modal drawer
    this.editing = target;
  }

  private closeEditor() {
    this.editing = null;
    if (this.openId) this.drawerOpen = true;
  }

  // ------------------------------------------------------------------ messaging (fakes only)

  private get canMessage(): boolean {
    return !!this.transport && this.msgConfig?.can_send === true;
  }

  private openMessage(ids: string[], inDrawer: boolean) {
    const people = ids.map((id) => ({ id, name: this.rows.find((p) => p.id === id)?.display_name ?? (this.detail?.id === id ? this.detail.display_name : id) }));
    if (!people.length) return;
    this.message = { people, inDrawer };
  }

  private closeMessage() {
    this.message = null;
  }

  // ------------------------------------------------------------------ render helpers

  private groupLabel(id: string): string {
    return this.groups.find((g) => g.id === id)?.label ?? id;
  }

  private groupsText(p: AcPerson): string {
    const ids = p.group_ids ?? [];
    return ids.length ? ids.map((g) => this.groupLabel(g)).join(' · ') : pt('row.no_groups');
  }

  private stationsText(p: AcPerson): string {
    const n = enabledStations(p);
    return n === 0 ? pt('row.no_stations') : n === 1 ? pt('row.station_one') : pt('row.stations', { n });
  }

  private subtitle(): string {
    if (!this.page && !isApi()) return `${DEMO_ROWS.length} אנשים · נתוני הדגמה`;
    const line = countLine(this.rows.length, this.page, isFiltered(this.query, this.filters));
    if (line.total === null) return '';
    if (line.total === 0) return pt('page.count_zero');
    if (this.rows.length < line.total || line.minimum) return pt(line.minimum ? 'page.count_min' : 'page.count_of', { shown: this.rows.length, total: line.total });
    const base = line.total === 1 ? pt('page.count_one') : pt('page.count', { n: line.total });
    return line.of !== null && line.of !== line.total ? `${base} · ${pt('page.count_of', { shown: line.total, total: line.of })}` : base;
  }

  // ------------------------------------------------------------------ render

  render() {
    if (isApi() && this.phase === 'forbidden') {
      return html`<sw-page heading=${pt('page.title')}><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading=${pt('state.forbidden')}></sw-state-panel></sw-page>`;
    }
    const ready = this.phase === 'ready';
    const selecting = this.selecting && ready;
    return html`<sw-page heading=${pt('page.title')} subheading=${ready ? this.subtitle() : ''} wide data-people-screen data-people-phase=${this.phase}>
        ${this.renderActions(ready)}
        ${ready ? this.renderFilters() : nothing}
        ${this.renderStrips()}
        ${selecting ? this.renderBulkBar() : nothing}
        ${this.renderBody()}
      </sw-page>
      ${this.renderDrawer()}
      ${this.editing
        ? html`<wiskey-person-editor .userId=${this.editing === 'new' ? '' : this.editing.id} @editor-saved=${(e: CustomEvent) => this.onSaved(e)} @editor-deleted=${(e: CustomEvent) => this.onDeleted(e)} @editor-close=${() => this.closeEditor()}></wiskey-person-editor>`
        : nothing}
      ${this.message && !this.message.inDrawer ? this.renderMessage() : nothing}`;
  }

  private renderActions(ready: boolean): TemplateResult {
    const view = this.shownView;
    const views: [PeopleView, string, string][] = [['cards', pt('view.cards'), 'grid'], ['list', pt('view.list'), 'list']];
    if (!this.phone) views.push(['table', pt('view.table'), 'menu']);
    const nameOnly = !this.employeeNoVisible;
    return html`
      ${ready
        ? html`<div class="search" slot="actions">
            <sw-icon name="search" size=${16}></sw-icon>
            <input type="search" data-wiskey-people-search name="query" maxlength="160" autocomplete="off" aria-label=${pt('search.label')} placeholder=${nameOnly ? pt('search.name') : pt('search.name_number')}
              .value=${this.query} ?disabled=${!isApi()} @input=${(e: Event) => this.editQuery((e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.restart()} />
          </div>`
        : nothing}
      ${ready
        ? html`<div class="seg" slot="actions" role="group" aria-label=${pt('view.label')}>
            ${views.map(([id, label, icon]) => html`<button type="button" data-people-view=${id} aria-pressed=${view === id} aria-label=${label} title=${label} @click=${() => this.setView(id)}><sw-icon name=${icon as 'grid'} size=${16}></sw-icon></button>`)}
          </div>`
        : nothing}
      ${ready
        ? html`<sw-button slot="actions" variant=${this.selecting ? 'primary' : 'secondary'} icon="check" iconOnly data-people-select-mode label=${this.selecting ? pt('action.select_off') : pt('action.select')} aria-pressed=${this.selecting}
            @click=${() => { this.selecting = !this.selecting; if (!this.selecting) this.selected = new Set(); }}></sw-button>`
        : nothing}
      ${ready && this.canManage
        ? html`<sw-button slot="actions" variant="primary" icon="plus" data-wiskey-people-add @click=${() => this.openEditor('new')}>${pt('action.add')}</sw-button>`
        : nothing}
      ${isApi() && this.phase !== 'forbidden'
        ? html`<sw-button slot="actions" variant="ghost" icon="refresh" iconOnly data-wiskey-people-refresh label=${pt('action.refresh')} ?disabled=${this.busy} @click=${() => void this.reload()}></sw-button>`
        : nothing}`;
  }

  private selectChip(name: string, label: string, value: string, options: [string, string][], on: (v: string) => void): TemplateResult {
    return html`<label class="fchip${value ? ' on' : ''}" data-people-chip=${name}>
      <span class="k">${label}</span>
      <select name=${name} data-wiskey-people-filter=${name} aria-label=${label} .value=${value} ?disabled=${!isApi()} @change=${(e: Event) => on((e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!value}>${pt('filter.any')}</option>
        ${options.map(([v, l]) => html`<option value=${v} ?selected=${v === value}>${l}</option>`)}
      </select>
    </label>`;
  }

  private renderFilters(): TemplateResult {
    const f = this.filters;
    const sensitive = this.access.sensitive;
    const profileFields = (this.fields ?? []).filter((x) => x.enabled);
    const draftField = profileFields.find((x) => x.id === this.profileDraft.field) ?? null;
    const sorts = SORTS.filter((s) => s !== 'employee' || this.employeeNoVisible);
    const sortValue = f.sort ?? this.page?.sort ?? (this.employeeNoVisible ? 'employee' : 'name');
    return html`<div class="filters" role="group" aria-label=${pt('filter.bar')} data-people-filters>
      ${this.groups.length ? this.selectChip('group', pt('filter.group'), f.group ?? '', this.groups.filter((g) => g.enabled).map((g): [string, string] => [g.id, g.label]), (v) => this.setFilter('group', v)) : nothing}
      ${this.stations.length ? this.selectChip('station', pt('filter.station'), f.station ?? '', this.stations.map((s): [string, string] => [s.id, s.name]), (v) => this.setFilter('station', v)) : nothing}
      ${this.selectChip('state', pt('filter.state'), f.state ?? '', STATES.map((s): [string, string] => [s, pt(`state.${s}`)]), (v) => this.setFilter('state', v))}
      ${this.selectChip('rights', pt('filter.rights'), f.rights ?? '', RIGHTS.map((r): [string, string] => [r, pt(`rights.${r}`)]), (v) => this.setFilter('rights', v))}
      ${sensitive ? this.selectChip('credential', pt('filter.credential'), f.credential ?? '', CREDENTIALS.map((c): [string, string] => [c, pt(`credential.${c}`)]), (v) => this.setFilter('credential', v)) : nothing}
      ${sensitive && profileFields.length
        ? html`${Object.entries(f.profile ?? {}).map(([k, v]) => html`<button type="button" class="fchip on" data-people-profile-clear=${k} @click=${() => { this.filters = setProfileFilter(this.filters, k, ''); this.restart(); }}><span class="k">${profileFields.find((x) => x.id === k)?.label ?? k}</span><span class="v">${v}</span><sw-icon name="close" size=${12}></sw-icon></button>`)}
          <label class="fchip" data-people-chip="profile"><span class="k">${pt('filter.profile')}</span>
            <select data-people-profile-field aria-label=${pt('filter.profile')} .value=${this.profileDraft.field} @change=${(e: Event) => (this.profileDraft = { field: (e.target as HTMLSelectElement).value, value: '' })}>
              <option value="">${pt('filter.any')}</option>${profileFields.map((x) => html`<option value=${x.id} ?selected=${x.id === this.profileDraft.field}>${x.label}</option>`)}
            </select></label>
          ${draftField
            ? html`<label class="fchip on" data-people-chip="profile-value"><span class="k">${pt('filter.profile_value')}</span>
                ${draftField.type === 'select' && draftField.options.length
                  ? html`<select data-people-profile-value aria-label=${pt('filter.profile_value')} .value=${this.profileDraft.value} @change=${(e: Event) => { this.profileDraft = { ...this.profileDraft, value: (e.target as HTMLSelectElement).value }; this.applyProfile(); }}>
                      <option value="">${pt('filter.any')}</option>${draftField.options.map((o) => html`<option value=${o}>${o}</option>`)}
                    </select>`
                  : html`<input data-people-profile-value type="text" maxlength="100" aria-label=${pt('filter.profile_value')} .value=${this.profileDraft.value}
                      @input=${(e: Event) => (this.profileDraft = { ...this.profileDraft, value: (e.target as HTMLInputElement).value })} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.applyProfile()} @change=${() => this.applyProfile()} />`}
              </label>`
            : nothing}`
        : nothing}
      <label class="fchip" data-people-chip="sort"><span class="k">${pt('filter.sort')}</span>
        <select name="sort" data-wiskey-people-filter="sort" aria-label=${pt('filter.sort')} .value=${sortValue} @change=${(e: Event) => this.setFilter('sort', (e.target as HTMLSelectElement).value)}>
          ${sorts.map((s) => html`<option value=${s} ?selected=${s === sortValue}>${pt(`sort.${s}`)}</option>`)}
        </select></label>
      ${filterCount(this.query, this.filters) > 0 ? html`<button type="button" class="clear" data-wiskey-people-clear @click=${() => this.clearAll()}>${pt('action.clear')}</button>` : nothing}
    </div>`;
  }

  private renderStrips(): TemplateResult {
    return html`
      ${this.notice
        ? html`<div class="note ${this.notice.tone}" role="status" data-wiskey-people-notice=${this.notice.tone}>
            <sw-icon name=${this.notice.tone === 'ok' ? 'check' : 'warning'} size=${16}></sw-icon><span>${this.notice.text}</span>
            <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${pt('action.close')} @click=${() => (this.notice = null)}></sw-button>
          </div>`
        : nothing}
      ${this.feedDown && this.rows.length
        ? html`<div class="note stale" role="status" data-wiskey-stale><sw-icon name="offline" size=${16}></sw-icon><span>${pt('state.stale', { when: this.shownAt ? formatTime(this.shownAt, 'he-IL', this.zone) : '' })}</span></div>`
        : nothing}
      ${this.changed
        ? html`<div class="note stale" role="status" data-wiskey-people-stale><sw-icon name="warning" size=${16}></sw-icon><span>${pt('state.page_stale')}</span>
            <sw-button size="sm" variant="ghost" icon="refresh" data-wiskey-people-restart ?disabled=${this.busy} @click=${() => { this.changed = false; void this.reload(); }}>${pt('action.reload')}</sw-button></div>`
        : nothing}
      ${this.page && !this.page.complete
        ? html`<div class="note stale" role="status" data-wiskey-people-incomplete=${this.page.incomplete_reason ?? 'unknown'}><sw-icon name="warning" size=${16}></sw-icon><span>${pt('state.partial')} · ${this.page.incomplete_reason === 'rate_limited' ? pt('state.partial_rate') : pt('state.partial_scan')}</span></div>`
        : nothing}`;
  }

  private renderBody(): TemplateResult {
    switch (this.phase) {
      case 'loading':
        return html`<div class="skeletons" aria-busy="true" data-people-skeleton>${Array.from({ length: 6 }, () => html`<div class="sk-row"><span class="sk dot"></span><span class="sk-col"><span class="sk a"></span><span class="sk b"></span></span><span class="sk c"></span></div>`)}</div>`;
      case 'unsupported':
        return html`<sw-state-panel data-wiskey-state="unsupported" state="empty" heading=${pt('state.unsupported')}></sw-state-panel>`;
      case 'unavailable':
        return html`<sw-state-panel data-wiskey-state="unavailable" state="empty" heading=${pt('state.unavailable')}>${can('system.configure') ? html`<a class="settings-link" href="#/system/diagnostics?tab=access-control">${pt('action.settings')}</a>` : nothing}</sw-state-panel>`;
      case 'error':
        return html`<sw-state-panel data-wiskey-state="load_error" state="error" heading=${pt('state.error')} hint=${this.panelNote} actionLabel=${pt('action.retry')} @action=${() => this.begin()}></sw-state-panel>`;
      default:
        break;
    }
    if (this.busy && !this.rows.length) return html`<div class="skeletons" aria-busy="true"></div>`;
    if (!this.rows.length) {
      const filtered = isFiltered(this.query, this.filters);
      return html`<sw-state-panel data-wiskey-people-empty state="empty" heading=${filtered ? pt('state.no_results') : pt('state.empty')} actionLabel=${filtered ? pt('action.clear') : ''} @action=${() => this.clearAll()}></sw-state-panel>`;
    }
    const view = this.shownView;
    const more = this.page ? nextOffset(this.page) : null;
    return html`${view === 'cards' ? this.renderCards() : view === 'table' ? this.renderTable() : this.renderList()}
      ${more !== null
        ? html`<div class="more"><sw-button data-wiskey-people-more ?disabled=${this.moreBusy} @click=${() => void this.loadMore()}>${this.moreBusy ? pt('state.detail_loading') : pt('action.more', { n: Math.min(PEOPLE_PAGE, Math.max(1, (this.page?.total ?? 0) - this.rows.length)) })}</sw-button></div>`
        : nothing}`;
  }

  private checkbox(p: AcPerson): TemplateResult {
    const on = this.selected.has(p.id);
    return html`<button type="button" class="cbx" role="checkbox" aria-checked=${on} aria-label=${pt('action.select_row', { name: p.display_name })} data-person-select=${p.id}
      @click=${(e: Event) => { e.stopPropagation(); this.selected = toggleSelected(this.selected, p.id); }} @keydown=${(e: KeyboardEvent) => e.stopPropagation()}>
      <span class="box${on ? ' on' : ''}">${on ? html`<sw-icon name="check" size=${14}></sw-icon>` : nothing}</span></button>`;
  }

  private messageButton(p: AcPerson): TemplateResult | typeof nothing {
    if (!this.canMessage || p.phone_set === false) return nothing;
    return html`<sw-button variant="ghost" iconOnly icon="mail" data-person-message-row label=${pt('action.message')} @click=${(e: Event) => { e.stopPropagation(); this.openMessage([p.id], false); }}></sw-button>`;
  }

  private credentialsText(p: AcPerson): string {
    const c = credentialKinds(p);
    if (!c) return '';
    if (c.kinds.length) return c.kinds.map((k) => (k === 'card' ? (c.cards > 1 ? pt('cred.cards', { n: c.cards }) : pt('cred.card')) : pt('cred.pin'))).join(' · ');
    return c.none ? pt('cred.none') : pt('cred.unknown');
  }

  private rowKeys(p: AcPerson) {
    return (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void this.openPerson(p.id);
      }
    };
  }

  private renderList(): TemplateResult {
    return html`<ul class="rows" role="list" data-wiskey-people-list>
      ${repeat(this.rows, (p) => p.id, (p) => {
        const sb = stateBadge(p);
        return html`<li class="row${this.selected.has(p.id) ? ' sel' : ''}" tabindex="0" data-wiskey-person-name-row=${p.id} data-person-row=${p.id} @click=${() => void this.openPerson(p.id)} @keydown=${this.rowKeys(p)}>
          ${this.selecting ? this.checkbox(p) : nothing}
          <sw-avatar name=${p.display_name} size=${36} aria-hidden="true"></sw-avatar>
          <span class="main"><b data-wiskey-person-name>${p.display_name}</b><span class="sub">${p.employee_no !== null ? html`<bdi class="ltr" data-wiskey-person-employee>${p.employee_no}</bdi> · ` : nothing}${this.groupsText(p)}</span></span>
          <span class="side hide-p">${this.stationsText(p)}</span>
          <span class="side hide-p">${validityText(p, this.zone)}</span>
          <sw-badge data-person-state kind=${sb.kind} label=${sb.label}></sw-badge>
          ${this.messageButton(p)}
        </li>`;
      })}
    </ul>`;
  }

  private renderCards(): TemplateResult {
    return html`<div class="grid" data-wiskey-people-cards>
      ${repeat(this.rows, (p) => p.id, (p) => {
        const sb = stateBadge(p);
        const sync = syncKind(personSyncStatus(p));
        return html`<article class="card${this.selected.has(p.id) ? ' sel' : ''}" tabindex="0" data-person-row=${p.id} @click=${() => void this.openPerson(p.id)} @keydown=${this.rowKeys(p)}>
          <div class="ctop">${this.selecting ? this.checkbox(p) : nothing}<sw-avatar name=${p.display_name} size=${40} aria-hidden="true"></sw-avatar>
            <span class="main"><b data-wiskey-person-name>${p.display_name}</b>${p.employee_no !== null ? html`<span class="sub"><bdi class="ltr" data-wiskey-person-employee>${p.employee_no}</bdi></span>` : nothing}</span>
            <sw-badge kind=${sb.kind} label=${sb.label}></sw-badge></div>
          <div class="cmeta"><span>${this.groupsText(p)}</span><span>${this.stationsText(p)}</span><span>${validityText(p, this.zone)}</span></div>
          <div class="cfoot">${enabledStations(p) || p.stations?.length ? html`<sw-badge kind=${sync.kind} label=${sync.label}></sw-badge>` : nothing}${this.credentialsText(p) ? html`<span class="sub">${this.credentialsText(p)}</span>` : nothing}${this.messageButton(p)}</div>
        </article>`;
      })}
    </div>`;
  }

  private renderTable(): TemplateResult {
    const cols = visibleColumns(this.columns, this.access, this.employeeNoVisible);
    const label: Record<ColumnKey, string> = {
      name: pt('col.name'), employee: pt('col.employee'), groups: pt('col.groups'), stations: pt('col.stations'), credentials: pt('col.credentials'), validity: pt('col.validity'), state: pt('col.state'), sync: pt('col.sync'),
    };
    const state = selectionState(this.selected, this.rows);
    const cell = (p: AcPerson, key: ColumnKey): TemplateResult => {
      switch (key) {
        case 'name': return html`<span class="who"><sw-avatar name=${p.display_name} size=${28} aria-hidden="true"></sw-avatar><b data-wiskey-person-name>${p.display_name}</b></span>`;
        case 'employee': return html`<bdi class="ltr" data-wiskey-person-employee>${p.employee_no ?? ''}</bdi>`;
        case 'groups': return html`${this.groupsText(p)}`;
        case 'stations': return html`<span data-wiskey-person-assignments=${enabledStations(p)}>${this.stationsText(p)}</span>`;
        case 'credentials': return html`${this.credentialsText(p)}`;
        case 'validity': return html`${validityText(p, this.zone)}`;
        case 'state': { const b = stateBadge(p); return html`<sw-badge data-person-state kind=${b.kind} label=${b.label}></sw-badge>`; }
        default: { const b = syncKind(personSyncStatus(p)); return html`<sw-badge kind=${b.kind} label=${b.label}></sw-badge>`; }
      }
    };
    return html`<div class="tablewrap" data-wiskey-people-table>
      <div class="tabletools">
        <button type="button" class="linkbtn" data-people-columns aria-expanded=${this.columnsOpen} @click=${() => (this.columnsOpen = !this.columnsOpen)}><sw-icon name="filter" size=${14}></sw-icon>${pt('action.columns')}</button>
        ${this.columnsOpen
          ? html`<div class="colmenu" role="group" aria-label=${pt('action.columns')}>
              ${offeredColumns(this.access, this.employeeNoVisible).map((k) => html`<label class="colopt"><input type="checkbox" data-people-column=${k} .checked=${cols.includes(k)} ?disabled=${k === 'name'} @change=${() => this.setColumns(k)} />${label[k]}</label>`)}
            </div>`
          : nothing}
      </div>
      <div class="scroll">
        <table>
          <thead><tr>
            ${this.selecting ? html`<th class="chk"><button type="button" class="cbx" role="checkbox" aria-checked=${state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'} aria-label=${pt('action.select_all')} data-people-select-all @click=${() => (this.selected = toggleAll(this.selected, this.rows))}><span class="box${state !== 'none' ? ' on' : ''}">${state === 'all' ? html`<sw-icon name="check" size=${14}></sw-icon>` : state === 'some' ? html`<sw-icon name="minus" size=${14}></sw-icon>` : nothing}</span></button></th>` : nothing}
            ${cols.map((k) => html`<th scope="col" data-col=${k}>${label[k]}</th>`)}
            <th class="act" aria-label=${pt('col.actions')}></th>
          </tr></thead>
          <tbody>
            ${repeat(this.rows, (p) => p.id, (p) => html`<tr class="${this.selected.has(p.id) ? 'sel' : ''}" tabindex="0" data-person-row=${p.id} @click=${() => void this.openPerson(p.id)} @keydown=${this.rowKeys(p)}>
              ${this.selecting ? html`<td class="chk">${this.checkbox(p)}</td>` : nothing}
              ${cols.map((k) => html`<td data-col=${k}>${cell(p, k)}</td>`)}
              <td class="act">${this.messageButton(p)}</td>
            </tr>`)}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  private renderBulkBar(): TemplateResult {
    const n = this.selected.size;
    return html`<div class="bulk" role="toolbar" aria-label=${pt('bulk.bar')} data-people-bulk>
      <span class="n" data-people-bulk-count=${n}>${pt('bulk.selected', { n })}</span>
      <span class="sp"></span>
      ${this.canMessage ? html`<sw-button icon="mail" data-people-bulk-message ?disabled=${n === 0} @click=${() => this.openMessage([...this.selected], false)}>${pt('action.message_selected')}</sw-button>` : nothing}
      <sw-button variant="ghost" data-people-bulk-clear ?disabled=${n === 0} @click=${() => (this.selected = new Set())}>${pt('action.clear_selection')}</sw-button>
    </div>`;
  }

  private renderDrawer(): TemplateResult | typeof nothing {
    if (!this.openId && !this.drawerOpen) return nothing;
    const stationNames = Object.fromEntries(this.stations.map((s): [string, string] => [s.id, s.name]));
    const groupLabels = Object.fromEntries(this.groups.map((g) => [g.id, g.label]));
    const groupStations = Object.fromEntries(this.groups.map((g) => [g.id, g.station_ids ? g.station_ids.length : null]));
    const p = this.detail;
    const canEdit = this.canManage && !!p && p.editable !== false;
    return html`<wiskey-person-drawer .open=${this.drawerOpen} .person=${p} .loading=${this.detailLoading} .error=${this.detailError}
        .stationNames=${stationNames} .groupLabels=${groupLabels} .groupStations=${groupStations} .fields=${this.fields} .zone=${this.zone} .photoEnabled=${this.photoOn}
        .canEdit=${canEdit} .canMessage=${this.canMessage && !!p && p.phone_set !== false}
        @close=${() => this.closePerson()} @edit=${(e: CustomEvent<{ id: string }>) => this.openEditor({ id: e.detail.id })} @message=${(e: CustomEvent<{ id: string }>) => this.openMessage([e.detail.id], true)}>
        ${this.message?.inDrawer ? this.renderMessage() : nothing}
      </wiskey-person-drawer>`;
  }

  private renderMessage(): TemplateResult {
    const m = this.message!;
    return html`<wiskey-message-dialog open .transport=${this.transport} .people=${m.people} @close=${(e: CustomEvent<{ sent?: boolean }>) => { e.stopPropagation(); this.closeMessage(); if (e.detail?.sent) this.selected = new Set(); }}></wiskey-message-dialog>`;
  }

  static styles = css`
    :host {
      display: contents;
    }
    .search {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1 1 18rem;
      min-inline-size: min(100%, 17rem);
      max-inline-size: 26rem;
      color: var(--sw-text-3);
    }
    .search sw-icon {
      position: absolute;
      inset-inline-start: 12px;
      pointer-events: none;
    }
    .search input {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 44px;
      padding-inline: 36px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
    }
    .search input:focus-visible,
    .fchip select:focus-visible,
    .fchip input:focus-visible,
    .seg button:focus-visible,
    .cbx:focus-visible,
    .linkbtn:focus-visible,
    .clear:focus-visible,
    .row:focus-visible,
    .card:focus-visible,
    tr:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface);
    }
    .seg button {
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    sw-button {
      min-block-size: 44px;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .fchip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 12px 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      max-inline-size: 100%;
    }
    .fchip.on {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .fchip .k {
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .fchip.on .k {
      color: inherit;
    }
    .fchip select,
    .fchip input {
      min-block-size: 40px;
      max-inline-size: 11rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: var(--sw-fw-medium);
      text-overflow: ellipsis;
    }
    .fchip input {
      max-inline-size: 9rem;
      border-block-end: 1px solid var(--sw-border-strong);
    }
    button.fchip {
      cursor: pointer;
      padding-inline: 12px;
    }
    .clear {
      min-block-size: 44px;
      padding-inline: 12px;
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .note > span {
      flex: 1 1 12rem;
    }
    .note.stale {
      background: var(--sw-stale-soft);
    }
    .note.ok {
      background: var(--sw-success-soft);
    }
    .bulk {
      position: sticky;
      inset-block-start: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--sw-accent);
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .bulk .n {
      font-weight: var(--sw-fw-semibold);
    }
    .bulk .sp {
      flex: 1;
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 56px;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .row:hover,
    .card:hover,
    tbody tr:hover {
      background: var(--sw-surface-2);
    }
    .row.sel,
    .card.sel,
    tbody tr.sel {
      background: var(--sw-accent-soft);
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    .main b {
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .side {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
      gap: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
    }
    .ctop {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cmeta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .cfoot {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      min-block-size: 24px;
    }
    .cfoot sw-button {
      margin-inline-start: auto;
    }
    .cbx {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      flex-shrink: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }
    .box {
      display: grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border: 2px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text-inverse);
    }
    .box.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .tablewrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .tabletools {
      position: relative;
      display: flex;
      justify-content: flex-end;
    }
    .linkbtn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .colmenu {
      position: absolute;
      inset-block-start: 100%;
      inset-inline-end: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      min-inline-size: 12rem;
      padding: 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-solid);
      box-shadow: var(--sw-shadow-3);
    }
    .colopt {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 8px;
      font-size: var(--sw-fs-sm);
    }
    .colopt input {
      inline-size: 20px;
      block-size: 20px;
    }
    .scroll {
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      padding: 8px 12px;
      text-align: start;
      white-space: nowrap;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    th {
      position: sticky;
      inset-block-start: 0;
      background: var(--sw-surface);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
    }
    tbody tr {
      cursor: pointer;
      block-size: 52px;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    td.chk,
    th.chk {
      inline-size: 44px;
      padding: 0 4px;
    }
    td.act,
    th.act {
      inline-size: 48px;
      padding: 0 4px;
    }
    .who {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .more {
      display: flex;
      justify-content: center;
      padding-block: 4px;
    }
    .skeletons {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .sk-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 56px;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    .sk-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
    .sk {
      display: block;
      border-radius: var(--sw-r-xs);
      background: linear-gradient(90deg, var(--sw-skeleton), var(--sw-skeleton-shine), var(--sw-skeleton));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    .sk.dot {
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
    }
    .sk.a {
      inline-size: 40%;
      block-size: 12px;
    }
    .sk.b {
      inline-size: 25%;
      block-size: 10px;
    }
    .sk.c {
      inline-size: 70px;
      block-size: 18px;
      border-radius: var(--sw-r-pill);
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk {
        animation: none;
      }
    }
    .settings-link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .hide-p {
        display: none;
      }
      .search {
        flex-basis: 100%;
        max-inline-size: none;
      }
      .filters {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-block-end: 4px;
        scrollbar-width: none;
      }
      .fchip {
        flex-shrink: 0;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-people': WiskeyPeople;
  }
}

