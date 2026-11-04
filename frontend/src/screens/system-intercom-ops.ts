import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-state-panel';
import '../components/sw-kpi';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/wk-ops-charts';
import { settingsStyles } from '../styles/settings';
import { ApiError } from '../api/client';
import type { DisplayZone } from '../api/intercom';
import {
  cancelJob,
  exportChangeLog,
  exportFleetInventory,
  exportJobErrors,
  getCapacity,
  getEventsReport,
  getInvestigations,
  getJobs,
  getOperations,
  getOpsOverview,
  saveFile,
  type CapacityReply,
  type CapacityValues,
  type EventsReport,
  type JobRow,
  type JobsReply,
  type OperationsPage,
  type OpsOverview,
  type OpsStation,
  type Read,
  type TimelinePage,
} from '../api/intercom-ops';
import { formatTime, UTC_ZONE } from './wiskey-format';
import {
  ACTION_HE,
  ALERT_HE,
  ANOMALY_HE,
  KIND_HE,
  METHOD_HE,
  OPS_HREF,
  OPS_TABS,
  SOURCE_HE,
  STATE_HE,
  T,
  alertTone,
  canCancel,
  he,
  meterTone,
  opDone,
  stateTone,
  tabOf,
  type OpsTab,
  type Tone,
} from './intercom-ops-logic';

type Part<V> = { s: 'idle' } | { s: 'loading' } | { s: 'ready'; v: V } | { s: 'error'; code: string; message: string; status: number };

const DAY_MS = 86_400_000;
const PERIODS = [1, 7, 30] as const;

function failure(err: unknown): { s: 'error'; code: string; message: string; status: number } {
  if (err instanceof ApiError) return { s: 'error', code: err.body.code, message: err.body.user_message || err.body.code, status: err.status };
  return { s: 'error', code: 'error', message: String(err), status: 0 };
}

/**
 * WISKEY-OPS-VIEWS-2400 (integration plan T11): הגדרות › תפעול האינטרקום - the intercom system's operations and fleet views, natively:
 * `#/system/intercom-operations/<tab>`. A KPI summary with the stations, the operations (sync / bulk / CSV) with the bulk jobs and their
 * failed rows (an administrator may cancel one, with a confirmation, sent once), the investigations timeline, capacity per station with
 * Arx's stored trend, the entry log's aggregate report, and the CSV exports (administrator; audited on the server).
 *
 * `access.read` at the installation opens it (the server checks every call; a 403 shows the forbidden state). A view the installed intercom
 * does not offer shows as unavailable - never guessed. Each tab loads only when shown; each part says its own state (loading / empty /
 * error / ready). The page never names the intercom platform.
 */
@customElement('system-intercom-ops')
export class SystemIntercomOps extends LitElement {
  @property() view = '';
  @state() private overview: OpsOverview | null = null;
  @state() private loadState: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private loadError = '';

  @state() private ops: Part<OperationsPage> = { s: 'idle' };
  @state() private opsFilter = { kind: 'all', state: 'all', station_id: '', query: '', offset: 0 };
  @state() private jobs: Part<JobsReply> = { s: 'idle' };
  @state() private openJob = '';
  @state() private confirmJob: JobRow | null = null;
  @state() private cancelBusy = false;
  @state() private cancelError = '';
  @state() private flash = '';

  @state() private timeline: Part<TimelinePage> = { s: 'idle' };
  @state() private tlFilter = { source: 'all', station_id: '', query: '', period: 7 as number, offset: 0 };

  @state() private capacity: Part<CapacityReply> = { s: 'idle' };
  @state() private trendStation = '';
  @state() private trendDays = 30;

  @state() private report: Part<Read<EventsReport>> = { s: 'idle' };
  @state() private evFilter = { station_id: '', period: 7 as number };

  @state() private exportBusy = '';
  @state() private exportMsg: { kind: string; ok: boolean; text: string } | null = null;

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
      }
      nav.tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
        margin-block-end: 16px;
        border-block-end: 1px solid var(--sw-border);
      }
      nav.tabs::-webkit-scrollbar {
        display: none;
      }
      nav.tabs a {
        flex: none;
        padding: 10px 14px;
        color: var(--sw-text-2);
        text-decoration: none;
        font-weight: var(--sw-fw-medium);
        border-block-end: 2px solid transparent;
        margin-block-end: -1px;
        white-space: nowrap;
      }
      nav.tabs a[aria-current='page'] {
        color: var(--sw-accent-text);
        border-block-end-color: var(--sw-accent);
      }
      nav.tabs a:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: -2px;
      }
      @media (hover: hover) and (pointer: fine) {
        nav.tabs a:hover {
          color: var(--sw-text);
        }
      }
      section.part {
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 16px;
        margin-block-end: 16px;
        min-inline-size: 0;
      }
      section.part > header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px 16px;
        margin-block-end: 12px;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-lg);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      h3 {
        margin: 16px 0 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .hint,
      .muted {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        margin: 4px 0 0;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px;
        margin-block-end: 16px;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        align-items: flex-end;
        margin-block-end: 12px;
      }
      label.f {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
        min-inline-size: 0;
      }
      label.f select,
      label.f input {
        font: inherit;
        font-size: var(--sw-fs-md);
        min-block-size: 40px;
        padding: 0 10px;
        border: 1px solid var(--sw-border-strong, var(--sw-border));
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
        color: var(--sw-text);
        min-inline-size: 0;
        max-inline-size: 100%;
      }
      label.f select:focus-visible,
      label.f input:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: 1px;
      }
      .list {
        display: grid;
        gap: 0;
      }
      .item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        padding: 10px 0;
        border-block-end: 1px solid var(--sw-border);
        min-inline-size: 0;
      }
      .item:last-child {
        border-block-end: 0;
      }
      .item .main {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        align-items: center;
        min-inline-size: 0;
      }
      .item .main b {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .item .meta {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 2px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .item .end {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-medium);
        background: var(--sw-surface-3, var(--sw-surface-2));
        color: var(--sw-text-2);
        white-space: nowrap;
      }
      .pill::before {
        content: '';
        inline-size: 6px;
        block-size: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .pill[data-tone='ok'] {
        background: var(--sw-success-soft);
        color: var(--sw-success-text);
      }
      .pill[data-tone='warn'] {
        background: var(--sw-warning-soft);
        color: var(--sw-warning-text);
      }
      .pill[data-tone='err'] {
        background: var(--sw-danger-soft);
        color: var(--sw-danger-text);
      }
      code {
        font-family: var(--sw-font-mono, ui-monospace, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        overflow-wrap: anywhere;
      }
      .meter {
        display: grid;
        gap: 4px;
        min-inline-size: 0;
      }
      .meter .bar {
        block-size: 8px;
        border-radius: 4px;
        background: var(--sw-accent-soft);
        overflow: hidden;
      }
      .meter .bar > i {
        display: block;
        block-size: 100%;
        border-radius: 4px;
        background: var(--sw-accent);
      }
      .meter[data-tone='warn'] .bar {
        background: var(--sw-warning-soft);
      }
      .meter[data-tone='warn'] .bar > i {
        background: var(--sw-warning);
      }
      .meter[data-tone='err'] .bar {
        background: var(--sw-danger-soft);
      }
      .meter[data-tone='err'] .bar > i {
        background: var(--sw-danger);
      }
      .meter .lbl {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .meter .lbl b {
        font-variant-numeric: tabular-nums;
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text);
      }
      .cap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 12px;
      }
      .cap {
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 12px;
        display: grid;
        gap: 10px;
        min-inline-size: 0;
      }
      .cap header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }
      .cap header b {
        font-weight: var(--sw-fw-semibold);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pager {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        margin-block-start: 8px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .msg {
        padding: 10px 12px;
        border-radius: var(--sw-r-md);
        font-size: var(--sw-fs-sm);
        margin-block-end: 12px;
      }
      .msg.ok {
        background: var(--sw-success-soft);
        color: var(--sw-success-text);
      }
      .msg.warn {
        background: var(--sw-warning-soft);
        color: var(--sw-warning-text);
      }
      .msg.err {
        background: var(--sw-danger-soft);
        color: var(--sw-danger-text);
      }
      .errs {
        grid-column: 1 / -1;
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 2px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .two {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }
      table.t {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: var(--sw-fs-sm);
      }
      table.t th,
      table.t td {
        text-align: start;
        padding: 6px 8px;
        border-block-end: 1px solid var(--sw-border);
      }
      table.t th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
      }
      table.t td.n {
        font-variant-numeric: tabular-nums;
      }
      .exp {
        display: grid;
        gap: 8px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 14px;
        align-content: start;
      }
      .exp b {
        font-weight: var(--sw-fw-semibold);
      }
      @media (max-width: 640px) {
        section.part {
          padding: 12px;
        }
        .kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .item {
          grid-template-columns: minmax(0, 1fr);
        }
        .item .end {
          justify-content: flex-start;
        }
        label.f {
          flex: 1 1 140px;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private get tab(): OpsTab {
    return tabOf(this.view);
  }

  private get zone(): DisplayZone {
    const s = this.overview?.summary;
    return s && s.state === 'ready' ? s.data.zone : UTC_ZONE;
  }

  private get stations(): OpsStation[] {
    const s = this.overview?.summary;
    return s && s.state === 'ready' ? s.data.stations : [];
  }

  private name(id: string): string {
    return this.stations.find((s) => s.id === id)?.name ?? id;
  }

  private time(iso: string | null | undefined): string {
    return formatTime(iso, 'he-IL', this.zone);
  }

  private async load(): Promise<void> {
    this.loadState = 'loading';
    try {
      this.overview = await getOpsOverview();
      this.loadState = 'ready';
      this.loadTab(this.tab);
    } catch (err) {
      this.loadState = err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error';
      this.loadError = err instanceof ApiError ? err.body.user_message : String(err);
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('view') && changed.get('view') !== undefined && this.loadState === 'ready') this.loadTab(this.tab);
    const strip = this.renderRoot.querySelector<HTMLElement>('nav.tabs');
    const current = strip?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (strip && current) {
      const s = strip.getBoundingClientRect();
      const c = current.getBoundingClientRect();
      if (c.left < s.left) strip.scrollLeft -= s.left - c.left + 8;
      else if (c.right > s.right) strip.scrollLeft += c.right - s.right + 8;
    }
  }

  private loadTab(tab: OpsTab): void {
    if (tab === 'operations') {
      if (this.ops.s === 'idle') void this.loadOps();
      if (this.jobs.s === 'idle') void this.loadJobs();
    } else if (tab === 'investigations' && this.timeline.s === 'idle') void this.loadTimeline();
    else if (tab === 'capacity' && this.capacity.s === 'idle') void this.loadCapacity();
    else if (tab === 'events' && this.report.s === 'idle') void this.loadReport();
  }

  private offered(view: string): boolean {
    return this.overview?.views?.[view as keyof OpsOverview['views']] !== false;
  }

  // ---------------------------------------------------------------- loads

  private async loadOps(): Promise<void> {
    this.ops = { s: 'loading' };
    const f = this.opsFilter;
    try {
      const r = await getOperations({ kind: f.kind, state: f.state, station_id: f.station_id || undefined, query: f.query || undefined, offset: f.offset, limit: 25 });
      this.ops = { s: 'ready', v: r.data };
    } catch (err) {
      this.ops = failure(err);
    }
  }

  private async loadJobs(): Promise<void> {
    this.jobs = { s: 'loading' };
    try {
      this.jobs = { s: 'ready', v: await getJobs() };
    } catch (err) {
      this.jobs = failure(err);
    }
  }

  private async loadTimeline(): Promise<void> {
    this.timeline = { s: 'loading' };
    const f = this.tlFilter;
    const start = f.period ? new Date(Date.now() - f.period * DAY_MS).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined;
    try {
      const r = await getInvestigations({ source: f.source, station_id: f.station_id || undefined, query: f.query || undefined, start, offset: f.offset, limit: 25 });
      this.timeline = { s: 'ready', v: r.data };
    } catch (err) {
      this.timeline = failure(err);
    }
  }

  private async loadCapacity(): Promise<void> {
    this.capacity = { s: 'loading' };
    try {
      const r = await getCapacity(this.trendDays);
      this.capacity = { s: 'ready', v: r };
      if (!this.trendStation || !r.data.records.some((x) => x.station_id === this.trendStation)) {
        const busiest = [...r.data.records].sort((a, b) => (b.users.used_percent ?? -1) - (a.users.used_percent ?? -1))[0];
        this.trendStation = busiest?.station_id ?? '';
      }
    } catch (err) {
      this.capacity = failure(err);
    }
  }

  private async loadReport(): Promise<void> {
    this.report = { s: 'loading' };
    const f = this.evFilter;
    const start = new Date(Date.now() - f.period * DAY_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
    try {
      this.report = { s: 'ready', v: await getEventsReport({ station_id: f.station_id || undefined, start }) };
    } catch (err) {
      this.report = failure(err);
    }
  }

  // ---------------------------------------------------------------- shared bits

  private pill(tone: Tone, text: string, attr = ''): TemplateResult {
    return html`<span class="pill" data-tone=${tone} data-pill=${attr}>${text}</span>`;
  }

  private partState<V>(p: Part<V>, view: string, retry: () => void): TemplateResult | null {
    if (p.s === 'idle' || p.s === 'loading') return html`<sw-state-panel state="loading" compact heading=${T.loading} data-part-state="loading"></sw-state-panel>`;
    if (p.s === 'error') {
      if (p.status === 501 || !this.offered(view))
        return html`<sw-state-panel state="empty" compact heading=${T.unavailable} data-part-state="unavailable"></sw-state-panel>`;
      return html`<sw-state-panel state="error" compact heading=${T.errorTitle} hint=${p.message} actionLabel=${T.retry} @action=${retry} data-part-state="error"></sw-state-panel>`;
    }
    return null;
  }

  private stationSelect(value: string, on: (v: string) => void, attr: string): TemplateResult {
    return html`<label class="f">${T.filterStation}
      <select data-filter=${attr} .value=${value} @change=${(e: Event) => on((e.target as HTMLSelectElement).value)}>
        <option value="">${T.all}</option>
        ${this.stations.map((s) => html`<option value=${s.id} ?selected=${s.id === value}>${s.name}</option>`)}
      </select></label>`;
  }

  private meter(label: string, v: CapacityValues, attr: string): TemplateResult {
    const pct = v.used_percent;
    const tone = meterTone(pct);
    return html`<div class="meter" data-tone=${tone} data-meter=${attr} role="meter" aria-valuemin="0" aria-valuemax=${v.limit ?? 0} aria-valuenow=${v.count ?? 0} aria-label=${label}>
      <div class="lbl"><span>${label}</span><b><bdi dir="ltr">${T.usersOf(v.count, v.limit)}</bdi>${pct !== null ? html` · <bdi dir="ltr">${Math.round(pct)}%</bdi>` : nothing}</b></div>
      <div class="bar"><i style=${`inline-size:${Math.max(0, Math.min(100, pct ?? 0))}%`}></i></div>
    </div>`;
  }

  // ---------------------------------------------------------------- tabs

  private renderOverview(): TemplateResult {
    const s = this.overview!.summary;
    if (s.state === 'error') {
      return html`<sw-state-panel state="error" heading=${T.errorTitle} hint=${s.message} actionLabel=${T.retry} @action=${() => void this.load()} data-part-state="error"></sw-state-panel>`;
    }
    const k = s.data.kpis;
    const tile = (key: keyof typeof k, icon: string, tone: string, attr: string) =>
      html`<sw-kpi data-kpi=${attr} label=${T.kpi[key]} value=${String(k[key])} icon=${icon} tone=${tone}></sw-kpi>`;
    return html`
      <div class="kpis" data-kpis>
        ${tile('stations', 'door', 'neutral', 'stations')}
        ${tile('online', 'wifi', k.online === k.stations ? 'live' : 'neutral', 'online')}
        ${tile('offline', 'offline', k.offline ? 'error' : 'neutral', 'offline')}
        ${tile('pending_users', 'clock', k.pending_users ? 'partial' : 'neutral', 'pending')}
        ${tile('sync_problems', 'warning', k.sync_problems ? 'error' : 'neutral', 'sync')}
        ${tile('near_capacity', 'storage', k.near_capacity ? 'partial' : 'neutral', 'capacity')}
      </div>
      <section class="part" data-stations>
        <header><div><h2>${T.stationsTitle}</h2><p class="hint">${T.fetchedAt} ${this.time(s.fetched_at)}</p></div>
          <sw-button size="sm" icon="refresh" @click=${() => void this.load()} data-refresh>${T.refresh}</sw-button></header>
        ${s.data.stations.length
          ? html`<div class="list">${s.data.stations.map(
              (st) => html`<article class="item" data-station=${st.id}>
                <div class="main"><b>${st.name}</b>${this.pill(st.online ? 'ok' : 'err', st.online ? T.online : T.offline, 'online')}${this.pill(stateTone(st.sync_state), he(STATE_HE, st.sync_state), 'sync')}</div>
                <div class="end">${st.max_users ? this.meter(T.table.users, { count: st.users, limit: st.max_users, used_percent: st.users !== null ? Math.round((1000 * st.users) / st.max_users) / 10 : null, remaining: null, growth_per_day: null, days_to_limit: null, alert: 'observed' }, 'users') : nothing}</div>
                <div class="meta">
                  ${st.pending_users ? html`<span>${T.table.pending}: ${st.pending_users}</span>` : nothing}
                  ${st.cards !== null ? html`<span>${T.table.cards}: <bdi dir="ltr">${st.cards}${st.max_cards ? ` / ${st.max_cards}` : ''}</bdi></span>` : nothing}
                  ${st.last_error ? html`<span>${T.table.error}: <code>${st.last_error}</code></span>` : nothing}
                </div>
              </article>`,
            )}</div>`
          : html`<sw-state-panel state="empty" compact heading=${T.empty}></sw-state-panel>`}
      </section>`;
  }

  private renderOperations(): TemplateResult {
    const f = this.opsFilter;
    const set = (patch: Partial<typeof f>) => {
      this.opsFilter = { ...f, offset: 0, ...patch };
      void this.loadOps();
    };
    const opsState = this.partState(this.ops, 'operations', () => void this.loadOps());
    const page = this.ops.s === 'ready' ? this.ops.v : null;
    return html`
      ${this.flash ? html`<div class="msg ok" role="status" data-flash>${this.flash}</div>` : nothing}
      <section class="part" data-ops>
        <header><div><h2>${T.opsTitle}</h2><p class="hint">${T.opsHint}</p></div></header>
        <div class="filters">
          <label class="f">${T.filterKind}<select data-filter="kind" .value=${f.kind} @change=${(e: Event) => set({ kind: (e.target as HTMLSelectElement).value })}>
            ${['all', 'sync', 'bulk', 'csv'].map((k) => html`<option value=${k} ?selected=${k === f.kind}>${k === 'all' ? T.all : KIND_HE[k]}</option>`)}</select></label>
          <label class="f">${T.filterState}<select data-filter="state" .value=${f.state} @change=${(e: Event) => set({ state: (e.target as HTMLSelectElement).value })}>
            ${['all', 'pending', 'failed', 'verified', 'settled', 'saved'].map((k) => html`<option value=${k} ?selected=${k === f.state}>${k === 'all' ? T.all : STATE_HE[k]}</option>`)}</select></label>
          ${this.stationSelect(f.station_id, (v) => set({ station_id: v }), 'station')}
          <sw-button size="sm" icon="refresh" @click=${() => void this.loadOps()} data-ops-refresh>${T.refresh}</sw-button>
        </div>
        ${opsState ??
        html`${page!.stale ? html`<div class="msg warn" role="status">${T.stale}</div>` : nothing}
          <div class="filters" data-ops-summary>${(['pending', 'failed', 'verified', 'settled', 'saved'] as const).map((k) => this.pill(stateTone(k), `${STATE_HE[k]}: ${page!.summary[k]}`, k))}</div>
          ${page!.records.length
            ? html`<div class="list">${page!.records.map(
                (op) => html`<article class="item" data-op=${op.id}>
                  <div class="main"><b>${he(ACTION_HE, op.action)}</b>${this.pill('neutral', he(KIND_HE, op.kind), 'kind')}${this.pill(stateTone(op.state), he(STATE_HE, op.state), 'state')}</div>
                  <div class="end"><span class="muted">${T.progress(opDone(op), op.progress.total)}</span></div>
                  <div class="meta">
                    <span>${T.people(op.user_ids.length)}</span>
                    <span>${op.station_ids.map((id) => this.name(id)).join(', ')}</span>
                    <span>${this.time(op.updated_at)}</span>
                    ${op.errors.map((c) => html`<code>${c}</code>`)}
                  </div>
                </article>`,
              )}</div>
              ${this.pager(page!, (o) => {
                this.opsFilter = { ...f, offset: o };
                void this.loadOps();
              })}`
            : html`<sw-state-panel state="empty" compact heading=${T.empty} data-part-state="empty"></sw-state-panel>`}`}
      </section>
      ${this.renderJobs()}
      ${this.renderCancelDialog()}`;
  }

  private pager(p: { total: number; offset: number; next_offset: number | null; previous_offset: number | null; limit: number | null }, go: (o: number) => void): TemplateResult | typeof nothing {
    if (p.next_offset === null && p.previous_offset === null) return nothing;
    return html`<div class="pager" data-pager><bdi dir="ltr">${p.offset + 1}–${Math.min(p.total, p.offset + (p.limit ?? 25))} / ${p.total}</bdi>
      <sw-button size="sm" ?disabled=${p.previous_offset === null} @click=${() => p.previous_offset !== null && go(p.previous_offset)}>${T.prev}</sw-button>
      <sw-button size="sm" ?disabled=${p.next_offset === null} @click=${() => p.next_offset !== null && go(p.next_offset)}>${T.more}</sw-button></div>`;
  }

  private renderJobs(): TemplateResult {
    const st = this.partState(this.jobs, 'jobs', () => void this.loadJobs());
    const reply = this.jobs.s === 'ready' ? this.jobs.v : null;
    const admin = !!reply?.can_cancel;
    return html`<section class="part" data-jobs>
      <header><div><h2>${T.jobsTitle}</h2><p class="hint">${T.jobsHint}</p></div></header>
      ${st ??
      (reply!.data.records.length
        ? html`<div class="list">${reply!.data.records.map((j) => {
            const open = this.openJob === j.id;
            return html`<article class="item" data-job=${j.id}>
              <div class="main"><b>${he(KIND_HE, j.kind)}</b>${this.pill(stateTone(j.state), he(STATE_HE, j.state), 'state')}
                <span class="muted">${T.progress(j.saved, j.total)}</span>${j.failed ? this.pill('err', T.rowsFailed(j.failed), 'failed') : nothing}</div>
              <div class="end">
                ${j.errors.length ? html`<sw-button size="sm" variant="ghost" @click=${() => (this.openJob = open ? '' : j.id)} aria-expanded=${open} data-job-errors-toggle>${T.rowsFailed(j.errors.length)}</sw-button>` : nothing}
                ${admin && j.errors.length ? html`<sw-button size="sm" icon="download" @click=${() => void this.download('job', () => exportJobErrors(j.id))} data-job-errors-csv>${T.errorsCsv}</sw-button>` : nothing}
                ${canCancel(j, admin) ? html`<sw-button size="sm" variant="danger" @click=${() => this.askCancel(j)} data-job-cancel>${T.cancel}</sw-button>` : nothing}
              </div>
              <div class="meta"><span>${this.time(j.created_at)}</span>${j.pending ? html`<span>${STATE_HE.pending}: ${j.pending}</span>` : nothing}</div>
              ${open ? html`<ul class="errs" data-job-error-rows>${j.errors.map((e) => html`<li>${T.row} ${e.row ?? '—'}: <code>${e.code}</code></li>`)}</ul>` : nothing}
            </article>`;
          })}</div>`
        : html`<sw-state-panel state="empty" compact heading=${T.jobsEmpty} data-part-state="empty"></sw-state-panel>`)}
      ${this.exportMsg && this.exportMsg.kind === 'job' ? html`<div class="msg ${this.exportMsg.ok ? 'ok' : 'err'}" role="status" data-export-msg>${this.exportMsg.text}</div>` : nothing}
    </section>`;
  }

  private askCancel(j: JobRow): void {
    this.cancelError = '';
    this.confirmJob = j;
  }

  private async doCancel(): Promise<void> {
    const j = this.confirmJob;
    if (!j || j.revision === null || this.cancelBusy) return;
    this.cancelBusy = true;
    this.cancelError = '';
    try {
      await cancelJob(j.id, j.revision);
      this.confirmJob = null;
      this.flash = T.cancelled;
      await this.loadJobs();
    } catch (err) {
      this.cancelError = err instanceof ApiError ? err.body.user_message || err.body.code : String(err);
      // an unknown outcome must not be repeated blindly: the list is reloaded and the button follows the job's new state
      if (err instanceof ApiError && (err.body.details as { outcome?: string })?.outcome !== 'not_sent') void this.loadJobs();
    } finally {
      this.cancelBusy = false;
    }
  }

  private renderCancelDialog(): TemplateResult {
    const j = this.confirmJob;
    return html`<sw-dialog ?open=${!!j} heading=${T.cancelTitle} ?locked=${this.cancelBusy} @close=${() => (this.confirmJob = null)} data-cancel-dialog>
      <p>${T.cancelBody}</p>
      ${j ? html`<p class="muted">${he(KIND_HE, j.kind)} · ${T.progress(j.saved, j.total)} · ${this.time(j.created_at)}</p>` : nothing}
      ${this.cancelError ? html`<div class="msg err" role="alert" data-cancel-error>${this.cancelError}</div>` : nothing}
      <sw-button slot="footer" @click=${() => (this.confirmJob = null)} ?disabled=${this.cancelBusy} data-cancel-keep>${T.cancelKeep}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${() => void this.doCancel()} ?disabled=${this.cancelBusy || !!this.cancelError} data-cancel-confirm>${T.cancelConfirm}</sw-button>
    </sw-dialog>`;
  }

  private renderInvestigations(): TemplateResult {
    const f = this.tlFilter;
    const can = this.overview!.can;
    const set = (patch: Partial<typeof f>) => {
      this.tlFilter = { ...f, offset: 0, ...patch };
      void this.loadTimeline();
    };
    const st = this.partState(this.timeline, 'investigations', () => void this.loadTimeline());
    const page = this.timeline.s === 'ready' ? this.timeline.v : null;
    return html`<section class="part" data-timeline>
      <header><div><h2>${T.invTitle}</h2><p class="hint">${T.invHint}</p></div></header>
      <div class="filters">
        <label class="f">${T.invSource}<select data-filter="source" .value=${f.source} @change=${(e: Event) => set({ source: (e.target as HTMLSelectElement).value })}>
          ${['all', 'access', 'change', 'sync'].map((k) => html`<option value=${k} ?selected=${k === f.source}>${k === 'all' ? T.all : SOURCE_HE[k]}</option>`)}</select></label>
        ${this.stationSelect(f.station_id, (v) => set({ station_id: v }), 'station')}
        <label class="f">${T.invFrom}<select data-filter="period" .value=${String(f.period)} @change=${(e: Event) => set({ period: Number((e.target as HTMLSelectElement).value) })}>
          ${PERIODS.map((d) => html`<option value=${d} ?selected=${d === f.period}>${d === 1 ? '24 שעות' : T.days(d)}</option>`)}</select></label>
        ${can.names
          ? html`<label class="f">${T.filterSearch}<input type="search" data-filter="query" .value=${f.query} maxlength="128"
              @change=${(e: Event) => set({ query: (e.target as HTMLInputElement).value.trim() })} /></label>`
          : nothing}
      </div>
      ${st ??
      html`${page!.fields_hidden.length ? html`<div class="msg warn" role="status" data-hidden-fields>${T.hiddenFields}</div>` : nothing}
        ${page!.access_storage_failed ? html`<div class="msg err" role="status">${T.storageFailed}</div>` : nothing}
        <div class="filters">${(['access', 'change', 'sync'] as const).map((k) => this.pill('neutral', `${SOURCE_HE[k]}: ${page!.summary[k]}`, k))}</div>
        ${page!.records.length
          ? html`<div class="list">${page!.records.map(
              (r) => html`<article class="item" data-tl=${r.id} data-source=${r.source}>
                <div class="main"><b>${he(ACTION_HE, r.action)}</b>${this.pill('neutral', he(SOURCE_HE, r.source), 'source')}${this.pill(stateTone(r.status), he(STATE_HE, r.status), 'status')}</div>
                <div class="end"><span class="muted">${this.time(r.time)}</span></div>
                <div class="meta">
                  <span>${r.station_ids.map((id) => this.name(id)).join(', ')}${r.door ? ` · דלת ${r.door}` : ''}</span>
                  ${r.person_name ? html`<span data-person>${r.person_name}${r.employee_no ? ` (${r.employee_no})` : ''}</span>` : nothing}
                  ${r.actor ? html`<span data-actor>${T.operator}: ${page!.actors[r.actor] ?? r.actor}</span>` : nothing}
                  ${r.fields.length ? html`<span>${r.fields.join(', ')}</span>` : nothing}
                  <code>${r.evidence}</code>
                </div>
              </article>`,
            )}</div>
            ${this.pager(page!, (o) => {
              this.tlFilter = { ...f, offset: o };
              void this.loadTimeline();
            })}`
          : html`<sw-state-panel state="empty" compact heading=${T.empty} data-part-state="empty"></sw-state-panel>`}`}
    </section>`;
  }

  private renderCapacity(): TemplateResult {
    const st = this.partState(this.capacity, 'capacity', () => void this.loadCapacity());
    const reply = this.capacity.s === 'ready' ? this.capacity.v : null;
    const rows = reply?.data.records ?? [];
    const sel = rows.find((r) => r.station_id === this.trendStation) ?? null;
    const series = reply?.trend.series[this.trendStation] ?? [];
    return html`<section class="part" data-capacity>
        <header><div><h2>${T.capTitle}</h2><p class="hint">${T.capHint}</p></div>
          <sw-button size="sm" icon="refresh" @click=${() => void this.loadCapacity()} data-cap-refresh>${T.refresh}</sw-button></header>
        ${st ??
        (rows.length
          ? html`<div class="cap-grid">${rows.map(
              (r) => html`<article class="cap" data-cap=${r.station_id}>
                <header><b>${r.name}</b>${this.pill(alertTone(r.users.alert), ALERT_HE[r.users.alert], 'alert')}</header>
                ${this.meter(T.table.users, r.users, 'users')}${this.meter(T.table.cards, r.cards, 'cards')}
                <div class="muted">
                  ${r.users.growth_per_day !== null ? html`<span><bdi dir="ltr">${r.users.growth_per_day > 0 ? '+' : ''}${r.users.growth_per_day}</bdi> ביום</span>` : nothing}
                  ${r.users.days_to_limit !== null ? html` · <span data-days-to-limit>${T.daysToLimit(r.users.days_to_limit)}</span>` : nothing}
                  <div>${T.sampledAt}: ${this.time(r.sampled_at)}</div>
                </div>
              </article>`,
            )}</div>`
          : html`<sw-state-panel state="empty" compact heading=${T.empty} data-part-state="empty"></sw-state-panel>`)}
      </section>
      ${reply && rows.length
        ? html`<section class="part" data-trend>
            <header><div><h2>${T.trendTitle}${sel ? ` · ${sel.name}` : ''}</h2><p class="hint">${T.trendHint}</p></div></header>
            <div class="filters">
              <label class="f">${T.filterStation}<select data-filter="trend-station" .value=${this.trendStation} @change=${(e: Event) => (this.trendStation = (e.target as HTMLSelectElement).value)}>
                ${rows.map((r) => html`<option value=${r.station_id} ?selected=${r.station_id === this.trendStation}>${r.name}</option>`)}</select></label>
              <label class="f">טווח<select data-filter="trend-days" .value=${String(this.trendDays)} @change=${(e: Event) => {
                this.trendDays = Number((e.target as HTMLSelectElement).value);
                void this.loadCapacity();
              }}>${[7, 30, 90, 365].map((d) => html`<option value=${d} ?selected=${d === this.trendDays}>${T.days(d)}</option>`)}</select></label>
            </div>
            <wk-ops-trend-chart .points=${series} .limit=${sel?.users.limit ?? null} label=${T.table.users} .fmt=${(iso: string) => this.time(iso)}></wk-ops-trend-chart>
          </section>`
        : nothing}`;
  }

  private renderEvents(): TemplateResult {
    const f = this.evFilter;
    const set = (patch: Partial<typeof f>) => {
      this.evFilter = { ...f, ...patch };
      void this.loadReport();
    };
    const st = this.partState(this.report, 'events_report', () => void this.loadReport());
    const rep = this.report.s === 'ready' ? this.report.v.data : null;
    return html`<section class="part" data-events>
      <header><div><h2>${T.evTitle}</h2><p class="hint">${T.evHint}</p></div></header>
      <div class="filters">
        ${this.stationSelect(f.station_id, (v) => set({ station_id: v }), 'station')}
        <label class="f">${T.invFrom}<select data-filter="period" .value=${String(f.period)} @change=${(e: Event) => set({ period: Number((e.target as HTMLSelectElement).value) })}>
          ${PERIODS.map((d) => html`<option value=${d} ?selected=${d === f.period}>${d === 1 ? '24 שעות' : T.days(d)}</option>`)}</select></label>
      </div>
      ${st ??
      html`
        ${rep!.storage_failed ? html`<div class="msg err" role="status">${T.storageFailed}</div>` : nothing}
        <div class="kpis" data-ev-kpis>
          <sw-kpi label=${T.total} value=${String(rep!.totals.records)} icon="activity" tone="neutral" data-kpi="records"></sw-kpi>
          <sw-kpi label=${T.granted} value=${String(rep!.totals.granted)} icon="check" tone="neutral" data-kpi="granted"></sw-kpi>
          <sw-kpi label=${T.denied} value=${String(rep!.totals.denied)} icon="lock" tone=${rep!.totals.denied ? 'partial' : 'neutral'} data-kpi="denied"></sw-kpi>
          <sw-kpi label=${T.other} value=${String(rep!.totals.other)} icon="info" tone="neutral" data-kpi="other"></sw-kpi>
        </div>
        <h3>${T.byDay}</h3>
        <wk-ops-day-chart .days=${rep!.by_day.map((d) => ({ day: d.day, granted: d.granted, denied: d.denied }))}></wk-ops-day-chart>
        <div class="two">
          <div>
            <h3>${T.byStation}</h3>
            <table class="t" data-ev-stations>
              <thead><tr><th scope="col">${T.table.station}</th><th scope="col">${T.granted}</th><th scope="col">${T.denied}</th><th scope="col">${T.other}</th></tr></thead>
              <tbody>${rep!.by_station.map((r) => html`<tr><td>${this.name(r.station_id)}</td><td class="n">${r.granted}</td><td class="n">${r.denied}</td><td class="n">${r.other}</td></tr>`)}</tbody>
            </table>
          </div>
          <div>
            <h3>${T.anomalies}</h3>
            <table class="t" data-ev-anomalies>
              <tbody>${Object.entries(rep!.anomalies).map(([k, n]) => html`<tr><td>${he(ANOMALY_HE, k)}</td><td class="n">${n}</td></tr>`)}</tbody>
            </table>
            <h3>${T.methods}</h3>
            <table class="t" data-ev-methods>
              <tbody>${Object.entries(rep!.methods).map(([k, n]) => html`<tr><td>${he(METHOD_HE, k)}</td><td class="n">${n}</td></tr>`)}</tbody>
            </table>
          </div>
        </div>`}
    </section>`;
  }

  private async download(kind: string, fn: () => Promise<{ blob: Blob; rows: number | null; filename: string }>): Promise<void> {
    if (this.exportBusy) return;
    this.exportBusy = kind;
    this.exportMsg = null;
    try {
      const f = await fn();
      saveFile(f);
      this.exportMsg = { kind, ok: true, text: T.downloaded(f.rows) };
    } catch (err) {
      this.exportMsg = { kind, ok: false, text: err instanceof ApiError ? err.body.user_message || err.body.code : String(err) };
    } finally {
      this.exportBusy = '';
    }
  }

  private renderExports(): TemplateResult {
    const can = this.overview!.can;
    const msg = (kind: string) =>
      this.exportMsg && this.exportMsg.kind === kind ? html`<div class="msg ${this.exportMsg.ok ? 'ok' : 'err'}" role="status" data-export-msg=${kind}>${this.exportMsg.text}</div>` : nothing;
    return html`<section class="part" data-exports>
      <header><div><h2>${T.expTitle}</h2><p class="hint">${T.expHint}</p></div></header>
      ${can.export
        ? html`<div class="two">
            <div class="exp" data-export="inventory"><b>${T.expInventory}</b><span class="muted">${T.expInventoryHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy || !this.offered('inventory')} @click=${() => void this.download('inventory', exportFleetInventory)} data-export-btn="inventory">${T.download}</sw-button>${msg('inventory')}</div>
            <div class="exp" data-export="audit"><b>${T.expAudit}</b><span class="muted">${T.expAuditHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy || !this.offered('audit_export')} @click=${() => void this.download('audit', () => exportChangeLog())} data-export-btn="audit">${T.download}</sw-button>${msg('audit')}</div>
          </div>`
        : html`<sw-state-panel state="forbidden" compact heading=${T.adminOnly} data-part-state="forbidden"></sw-state-panel>`}
    </section>`;
  }

  private body(tab: OpsTab): TemplateResult {
    if (tab === 'operations') return this.renderOperations();
    if (tab === 'investigations') return this.renderInvestigations();
    if (tab === 'capacity') return this.renderCapacity();
    if (tab === 'events') return this.renderEvents();
    if (tab === 'exports') return this.renderExports();
    return this.renderOverview();
  }

  render(): TemplateResult {
    const page = (inner: TemplateResult, st: string) =>
      html`<sw-page crumbs="הגדרות" heading=${T.title} subheading=${T.sub} data-intercom-ops data-state=${st}>${inner}</sw-page>`;
    if (this.loadState === 'loading') return page(html`<sw-state-panel state="loading" heading=${T.loading}></sw-state-panel>`, 'loading');
    if (this.loadState === 'forbidden') return page(html`<sw-state-panel state="forbidden" heading=${T.forbiddenTitle} hint=${T.forbiddenHint}></sw-state-panel>`, 'forbidden');
    if (this.loadState === 'error') {
      return page(html`<sw-state-panel state="error" heading=${T.errorTitle} hint=${this.loadError} actionLabel=${T.retry} @action=${() => void this.load()}></sw-state-panel>`, 'error');
    }
    const tab = this.tab;
    return page(
      html`<nav class="tabs" aria-label=${T.title}>
          ${OPS_TABS.map((t) => html`<a href="${OPS_HREF}/${t}" aria-current=${t === tab ? 'page' : 'false'} data-ops-tab=${t}>${T.tabs[t]}</a>`)}
        </nav>
        <div data-ops-view=${tab}>${this.body(tab)}</div>`,
      'ready',
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-intercom-ops': SystemIntercomOps;
  }
}
