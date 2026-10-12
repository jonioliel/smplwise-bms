import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-drawer';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-table';
import './system-access-health';
import type { TableColumn } from '../components/sw-table';
import type { DropdownItem } from '../components/sw-dropdown';
import {
  ALERT_KINDS,
  getAlerts,
  getConflicts,
  getStatusStations,
  getSyncStatus,
  type AlertKind,
  type AlertsPage,
  type AlertsReply,
  type ConflictsReply,
  type FleetAlert,
  type StatusStation,
  type StatusStationsReply,
  type SyncConflict,
  type SyncMeta,
  type SyncStatus,
  type SyncStatusReply,
} from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import { can, isApi, onSession } from '../api/session';
import { Resource } from '../access-control/status-feed';
import { CELL, statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows, skeletonTiles } from '../access-control/status-panel';
import {
  age,
  alertTone,
  appendAlerts,
  conflictKindKey,
  conflictWho,
  kpis,
  stationDot,
  syncPill,
  syncRows,
  zoneOfStation,
  type SyncRowView,
} from '../access-control/status-logic';
import { ageText, alertDetail, alertTitle, errorText, modelLine, syncText } from '../access-control/status-text';
import { localTime } from '../access-control/events-logic';
import { UTC_ZONE } from './wiskey-format';
import { bubbleChrome } from '../styles/bubble-chrome';
import { st, type StKey } from '../i18n/access-status';

const REFRESH_MS = 60_000; // the reads are cached by the server for 30-60 s: asking more often only repeats the same answer

/**
 * CR-036 S10: "מצב מערכת" - the status segment of the Settings page "בקרת כניסה" (#/system/access-control). Four tiles (stations online,
 * people waiting to sync, conflicts, the last sync), the health of every station (a click opens its health card and seven days), the
 * fleet alerts (a kind filter, muted ones on request, paged), the per-station sync table and - for an installation-wide administrator -
 * the list of sync conflicts and errors. Built to the approved mock-up (docs/design/WISKEY_SCREENS_DESIGN.md section 3.5).
 *
 * Data rules (see access-control/status-feed.ts): every card reads on its own and keeps its last good payload when a reload fails,
 * marked "not current"; a card the server refuses (403) is absent, never greyed; counts come from the server and are never summed
 * from people; the sync read carries no person at all. Nothing here writes or asks a device. The reads repeat every minute while the
 * page is visible, and whenever the page's refresh is pressed (`rev`).
 */
@customElement('system-access-status')
export class SystemAccessStatus extends LitElement {
  /** The page's refresh counter: a change reads everything again. */
  @property({ type: Number }) rev = 0;
  @state() private selected = '';
  @state() private kind: AlertKind | '' = '';
  @state() private muted = false;
  @state() private wide = true;

  private stationsRes!: Resource<StatusStation[], StatusStationsReply>;
  private syncRes!: Resource<SyncStatus, SyncStatusReply>;
  private alertsRes!: Resource<AlertsPage, AlertsReply>;
  private conflictsRes!: Resource<SyncConflict[], ConflictsReply>;
  private timer = 0;
  private stopSession: (() => void) | null = null;
  private lastMeta = '';
  private lastRev = 0;

  static styles = [
    statusStyles,
    css`
      .when {
        white-space: nowrap;
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    const change = () => {
      this.requestUpdate();
      this.emitMeta();
    };
    this.stationsRes = new Resource({ fetch: () => getStatusStations(), pick: (r: StatusStationsReply) => r.stations, onChange: change });
    this.syncRes = new Resource({ fetch: () => getSyncStatus(), pick: (r: SyncStatusReply) => r.sync_status, onChange: change });
    this.alertsRes = new Resource({
      fetch: (cursor: unknown) => getAlerts({ kind: this.kind, includeSuppressed: this.muted, offset: typeof cursor === 'number' ? cursor : 0 }),
      pick: (r: AlertsReply) => r.alerts,
      merge: appendAlerts,
      cursorOf: (d: AlertsPage) => d.next_offset,
      onChange: change,
    });
    this.conflictsRes = new Resource({ fetch: () => getConflicts(), pick: (r: ConflictsReply) => r.conflicts, onChange: change });
    this.wide = !isApi() || can('access.admin.read');
    this.stopSession = onSession(() => {
      const wide = !isApi() || can('access.admin.read');
      if (wide !== this.wide) {
        this.wide = wide;
        this.reloadAll();
      }
    });
    this.reloadAll();
    this.timer = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') this.reloadAll();
    }, REFRESH_MS);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    this.stopSession?.();
    for (const r of [this.stationsRes, this.syncRes, this.alertsRes, this.conflictsRes]) r?.dispose();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      this.reloadAll();
    }
  }

  private reloadAll(): void {
    void this.stationsRes.reload();
    void this.syncRes.reload();
    void this.alertsRes.reload();
    // WisKey's conflicts are installation-wide: a station-scoped administrator is never asked (the server would audit a refusal)
    if (this.wide) void this.conflictsRes.reload();
  }

  /** The integration's connection facts, for the page's subtitle. */
  private emitMeta(): void {
    const meta: SyncMeta | null = this.stationsRes?.snap.reply?.sync ?? this.syncRes?.snap.reply?.sync ?? this.alertsRes?.snap.reply?.sync ?? null;
    const json = JSON.stringify(meta);
    if (json === this.lastMeta) return;
    this.lastMeta = json;
    this.dispatchEvent(new CustomEvent('access-meta', { detail: { meta, zone: this.defaultZone() }, bubbles: true, composed: true }));
  }

  private defaultZone(): DisplayZone {
    return this.stationsRes?.snap.reply?.default_zone ?? UTC_ZONE;
  }

  private nameOf = (id: string): string => this.stationsRes.snap.data?.find((s) => s.id === id)?.name ?? id;

  private zoneOf(id: string | null | undefined): DisplayZone {
    return zoneOfStation(this.stationsRes.snap.data, id, this.defaultZone());
  }

  // ------------------------------------------------------------------ pieces

  private tiles(now: Date): TemplateResult {
    const k = kpis(this.stationsRes.snap.data, this.syncRes.snap.data, this.wide ? this.conflictsRes.snap.data : null);
    const zone = this.defaultZone();
    const tile = (key: string, label: StKey, value: string, detail = '', tone: '' | 'warn' | 'err' = '') =>
      html`<div class="tile" data-access-tile=${key}><span class="k">${label ? st(label) : ''}</span><span class="v ${tone}">${value}</span>${detail ? html`<span class="d">${detail}</span>` : html`<span class="d">&nbsp;</span>`}</div>`;
    return html`<div class="tiles" data-access-tiles>
      ${tile('online', 'kpiOnline', String(k.online), st('kpiOnlineOf', { total: k.total }), k.total > 0 && k.online < k.total ? 'warn' : '')}
      ${tile('pending', 'kpiPending', k.pending === null ? '—' : String(k.pending), '', (k.pending ?? 0) > 0 ? 'warn' : '')}
      ${k.conflicts === null ? nothing : tile('conflicts', 'kpiConflicts', String(k.conflicts), '', k.conflicts > 0 ? 'err' : '')}
      ${tile('last-sync', 'kpiLastSync', k.lastSync ? localTime(k.lastSync, zone) : '—', k.lastSync ? ageText(age(k.lastSync, now, zone)) : '')}
    </div>`;
  }

  private stationRow(s: StatusStation, now: Date): TemplateResult {
    const dot = stationDot(s);
    const pill = syncPill(s.sync_state, s.online);
    const model = modelLine(s.technical?.model, s.technical?.firmware);
    return html`<button type="button" class="row two" data-access-station=${s.id} aria-label=${st('healthOpen', { name: s.name })} @click=${() => (this.selected = s.id)}>
      <span class="dot ${dot}" aria-hidden="true"></span>
      <span class="main"><span class="t">${s.name}</span>${model ? html`<span class="s"><bdi class="ltr">${model}</bdi></span>` : nothing}</span>
      <span class="side"><sw-badge kind=${pill.kind} label=${syncText(pill.word)}></sw-badge><span class="when">${ageText(age(s.last_seen, now, this.zoneOf(s.id)))}</span></span>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`;
  }

  private healthCard(now: Date): TemplateResult {
    const stations = this.stationsRes.snap.data ?? [];
    return html`<sw-card flush data-access-card="health">
      <div class="ch"><div><h3>${st('healthTitle')}</h3><div class="sub ltr">${st('healthSub')}</div></div></div>
      ${stations.length ? html`<div class="list">${stations.map((s) => this.stationRow(s, now))}</div>` : html`<div class="empty">${st('healthEmpty')}</div>`}
    </sw-card>`;
  }

  private kindItems(): DropdownItem[] {
    return [{ id: '', label: st('alertKindAll') }, ...ALERT_KINDS.map((k) => ({ id: k, label: st(`alert_${k}` as StKey) }))];
  }

  private alertRow(a: FleetAlert, now: Date): TemplateResult {
    const tone = alertTone(a);
    return html`<div class="row" data-access-alert=${a.id} data-tone=${tone}>
      <span class="dot ${tone === 'muted' ? 'muted' : tone}" aria-hidden="true"></span>
      <span class="main"><span class="t">${alertTitle(a)}</span>${alertDetail(a, now, this.zoneOf(a.station_id)) ? html`<span class="s wrap">${alertDetail(a, now, this.zoneOf(a.station_id))}</span>` : nothing}</span>
    </div>`;
  }

  private alertsCard(now: Date): TemplateResult {
    const r = this.alertsRes;
    const s = r.snap;
    const page = s.data;
    let body: TemplateResult;
    if (!s.everAnswered || (s.busy && !page)) body = skeletonRows(3);
    else if (!page) body = html`<div class="empty-panel">${failurePanel(s.failure ?? 'error', s.message, () => void r.reload(), true)}</div>`;
    else if (!page.items.length) body = html`<div class="empty" data-access-alerts-empty><span class="dot ok" aria-hidden="true"></span>${st('alertsEmpty')}</div>`;
    else body = html`<div class="list" data-access-alerts>${page.items.map((a) => this.alertRow(a, now))}</div>`;
    return html`<sw-card flush data-access-card="alerts">
      <div class="ch">
        <div><h3>${st('alertsTitle')}</h3><div class="sub ltr">${st('alertsSub', { n: page ? (page.total ?? page.items.length) : 0 })}</div></div>
        <div class="ctl">
          <sw-dropdown tall data-access-alert-kind label=${st('alertKind')} .items=${this.kindItems()} .value=${this.kind} @change=${(e: CustomEvent<{ id: string }>) => this.setKind(e.detail.id as AlertKind | '')}></sw-dropdown>
          <button type="button" class="chipbtn" data-access-alerts-muted aria-pressed=${String(this.muted)} @click=${() => this.toggleMuted()}>${st('alertMutedShow')}</button>
        </div>
      </div>
      ${r.stale && page ? html`<div class="note stale" role="status" data-access-stale="alerts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt, now)}</span></div>` : nothing}
      ${body}
      ${page && !page.complete ? html`<div class="note info" role="status" data-access-alerts-partial><sw-icon name="info" size=${16}></sw-icon><span>${st('alertsPartial')}</span></div>` : nothing}
      ${r.hasMore ? html`<div class="more"><sw-button size="lg" data-access-alerts-more ?disabled=${s.loadingMore} @click=${() => void r.more()}>${s.loadingMore ? st('loadingMore') : st('more')}</sw-button></div>` : nothing}
      ${s.moreFailed ? html`<div class="note err" role="alert" data-access-alerts-more-failed><span>${st('moreFailed')}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => void r.more()}>${st('retry')}</sw-button></div>` : nothing}
    </sw-card>`;
  }

  private setKind(kind: AlertKind | ''): void {
    this.kind = kind;
    void this.alertsRes.reload();
  }

  private toggleMuted(): void {
    this.muted = !this.muted;
    void this.alertsRes.reload();
  }

  private staleText(fetchedAt: string | null, now: Date): string {
    return fetchedAt ? st('stale', { t: ageText(age(fetchedAt, now, this.defaultZone())) }) : st('staleNever');
  }

  private syncCard(now: Date): TemplateResult {
    const r = this.syncRes;
    const s = r.snap;
    const rows = syncRows(s.data, this.nameOf);
    const cell = (n: number) => (n > 0 ? String(n) : '—');
    const row = (x: Record<string, unknown>) => x as unknown as SyncRowView;
    const columns: TableColumn[] = [
      { key: 'name', label: st('colStation'), render: (x) => html`<span style=${CELL.strong}>${row(x).name}</span>` },
      { key: 'managed', label: st('colManaged'), render: (x) => (row(x).managed === null ? '—' : String(row(x).managed)) },
      { key: 'pending', label: st('colPending'), render: (x) => cell(row(x).pending) },
      { key: 'removals', label: st('colRemovals'), render: (x) => cell(row(x).removals) },
      { key: 'failed', label: st('colFailed'), render: (x) => cell(row(x).failed) },
      { key: 'last', label: st('colLastSync'), render: (x) => ageText(age(row(x).reconciledAt, now, this.zoneOf(row(x).id))) },
      {
        key: 'state',
        label: st('colState'),
        render: (x) => {
          const pill = syncPill(row(x).state, true);
          return html`<span style=${CELL.row}><sw-badge kind=${pill.kind} label=${syncText(pill.word)}></sw-badge>${row(x).error ? html`<span style=${CELL.muted}>${errorText(row(x).error)}</span>` : nothing}</span>`;
        },
      },
    ];
    let body: TemplateResult;
    if (!s.everAnswered || (s.busy && !s.data)) body = skeletonRows(3);
    else if (!s.data) body = failurePanel(s.failure ?? 'error', s.message, () => void r.reload(), true);
    else if (!rows.length) body = html`<div class="empty">${st('syncEmpty')}</div>`;
    else body = html`<sw-table data-access-sync .columns=${columns} .rows=${rows as unknown as Record<string, unknown>[]} rowKey="id"></sw-table>`;
    return html`<sw-card flush data-access-card="sync">
      <div class="ch"><div><h3>${st('syncTitle')}</h3><div class="sub">${st('syncSub')}</div></div></div>
      ${r.stale && s.data ? html`<div class="note stale" role="status" data-access-stale="sync"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt, now)}</span></div>` : nothing}
      ${body}
    </sw-card>`;
  }

  private conflictsCard(now: Date): TemplateResult | typeof nothing {
    if (!this.wide) return nothing;
    const r = this.conflictsRes;
    const s = r.snap;
    if (s.failure === 'forbidden') return nothing; // the server holds this view for installation-wide administrators: absent, never greyed
    const row = (x: Record<string, unknown>) => x as unknown as SyncConflict;
    const columns: TableColumn[] = [
      {
        key: 'who',
        label: st('colWho'),
        render: (x) => {
          const w = conflictWho(row(x));
          return w.kind === 'name' ? html`<span style=${CELL.strong}>${w.text}</span>` : w.kind === 'employee' ? html`<span>${st('employeeShort', { n: w.text })}</span>` : html`<span style=${CELL.muted}>${st('unnamed')}</span>`;
        },
      },
      { key: 'kind', label: st('colKind'), render: (x) => st(conflictKindKey(row(x).kind) as StKey) },
      { key: 'station', label: st('colStation'), render: (x) => this.nameOf(row(x).station_id) },
      {
        key: 'state',
        label: st('colState'),
        render: (x) => {
          const pill = syncPill(row(x).sync_state, true);
          return html`<sw-badge kind=${pill.kind} label=${syncText(pill.word)}></sw-badge>`;
        },
      },
      { key: 'error', label: st('colError'), render: (x) => errorText(row(x).last_error) || '—' },
    ];
    const rows = (s.data ?? []).map((c, i) => ({ ...c, id: `${c.station_id}/${c.kind}/${c.person?.id ?? i}` })) as unknown as Record<string, unknown>[];
    let body: TemplateResult;
    if (!s.everAnswered || (s.busy && !s.data)) body = skeletonRows(2);
    else if (!s.data) body = failurePanel(s.failure ?? 'error', s.message, () => void r.reload(), true);
    else if (!rows.length) body = html`<div class="empty" data-access-conflicts-empty><span class="dot ok" aria-hidden="true"></span>${st('conflictsEmpty')}</div>`;
    else body = html`<sw-table data-access-conflicts .columns=${columns} .rows=${rows} rowKey="id"></sw-table>`;
    return html`<sw-card flush data-access-card="conflicts">
      <div class="ch"><div><h3>${st('conflictsTitle')}</h3><div class="sub ltr">${st('conflictsSub')}</div></div></div>
      ${r.stale && s.data ? html`<div class="note stale" role="status" data-access-stale="conflicts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt, now)}</span></div>` : nothing}
      ${body}
    </sw-card>`;
  }

  private drawer(now: Date): TemplateResult {
    const s = this.selected ? this.stationsRes.snap.data?.find((x) => x.id === this.selected) : undefined;
    const pill = s ? syncPill(s.sync_state, s.online) : null;
    return html`<sw-drawer modal ?open=${!!s} heading=${s?.name ?? ''} @close=${() => (this.selected = '')} data-access-health-drawer>
      ${pill ? html`<sw-badge slot="action" kind=${pill.kind} label=${syncText(pill.word)}></sw-badge>` : nothing}
      ${s ? html`<system-access-health data-access-health=${s.id} .station=${s} .zone=${this.zoneOf(s.id)} .rev=${this.rev} .now=${now}></system-access-health>` : nothing}
    </sw-drawer>`;
  }

  render() {
    const now = new Date();
    const r = this.stationsRes;
    const s = r.snap;
    if (!s.everAnswered || (s.busy && !s.data)) {
      return html`<div class="stack" data-access-status="loading">${skeletonTiles()}<sw-card flush>${skeletonRows(4)}</sw-card></div>`;
    }
    if (!s.data) {
      return html`<div class="stack" data-access-status=${s.failure ?? 'error'}>${failurePanel(s.failure ?? 'error', s.message, () => this.reloadAll())}</div>`;
    }
    return html`<div class="stack" data-access-status="ready">
        ${r.stale ? html`<div class="note stale" role="status" data-access-stale="page"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt, now)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => this.reloadAll()}>${st('refresh')}</sw-button></div>` : nothing}
        ${this.tiles(now)}
        <div class="grid2">${this.healthCard(now)}${this.alertsCard(now)}</div>
        ${this.syncCard(now)}
        ${this.conflictsCard(now)}
      </div>
      ${this.drawer(now)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-status': SystemAccessStatus;
  }
}
