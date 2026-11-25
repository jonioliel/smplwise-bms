import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { getStatusStations, type StatusStation, type StatusStationsReply } from '../api/access-status';
import { getWkJobsStatus, getWkSystemStatus, type WkJob, type WkRead, type WkStation, type WkSystem } from '../api/wiskey-system-status';
import type { DisplayZone } from '../api/intercom';
import { Resource, type Reply } from '../access-control/status-feed';
import { CELL, statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows, skeletonTiles } from '../access-control/status-panel';
import { age } from '../access-control/status-logic';
import { ageText } from '../access-control/status-text';
import {
  APPROVAL_ACTIONS,
  APPROVAL_STATES,
  CONNECTIONS,
  FAILURE_REASONS,
  JOB_KINDS,
  JOB_STATES,
  PROFILES,
  RESULT_STATES,
  SYNC_STATES,
  TEMPLATE_STATES,
  connectionKind,
  failureCodes,
  familyRows,
  jobKind,
  jobsView,
  readPanel,
  reasonWord,
  requestLine,
  shortId,
  syncKind,
  systemView,
  tiles,
  wordOf,
  type FamilyRow,
  type ReadPanel,
  type Word,
} from '../access-control/status-wiskey-logic';
import { UTC_ZONE } from './wiskey-format';
import { bubbleChrome } from '../styles/bubble-chrome';
import { accessPanelPolish } from './system-access-polish-css';
import { st, type StKey } from '../i18n/access-status';

/** A WisKey read wrapped for the page's loader: every HTTP 200 is an answer (WisKey's own state - ready, unsupported, refused... - is the
 * read's, shown as it is and never replaced by an earlier copy); only a failure of Arx's own request (403, 429, 5xx, no network) keeps the
 * last answer, marked "not current". */
interface WkReply extends Reply {
  read: WkRead;
}
const wrap = async (fetch: () => Promise<WkRead>): Promise<WkReply> => {
  const read = await fetch();
  return { state: 'ready', last_error: null, fetched_at: read.fetched_at, read };
};

/**
 * WISKEY-STATUS-UI-2520 (row R2 of docs/changes/WISKEY-RESYNC-2520.md): "מערכת האינטרקום" - the segment of the Settings page "בקרת כניסה"
 * (#/system/access-control/wiskey) that shows WisKey's own numbered status reads (row R1's GET status/system and GET status/jobs): the
 * integration's version, API contract and profile (D1), every station's connection, last authentication, last failure, firmware and sync
 * observation (D2), the write admission - never one global "writes open" (D3), the job counts per family with a missing family said as
 * missing (D4), the message templates and schedules (D5), and every retained checkpoint job (B3).
 *
 * Offered to an installation-wide administrator only (`access.admin.read` unrestricted - the server's own rule; a station-scoped one gets
 * neither the segment nor a request). The reads run when the segment opens and when the page's refresh is pressed - never on a timer
 * (each one is a WisKey command). Nothing here writes, and no device is asked: WisKey answers from memory. A read WisKey does not offer
 * (the lab's rc10 does not list either command), refuses, or answers outside its contract shows that, never an older read instead.
 */
@customElement('system-access-wiskey')
export class SystemAccessWiskey extends LitElement {
  /** The page's refresh counter: a change reads everything again. */
  @property({ type: Number }) rev = 0;

  private systemRes!: Resource<WkRead, WkReply>;
  private jobsRes!: Resource<WkRead, WkReply>;
  private namesRes!: Resource<StatusStation[], StatusStationsReply>;
  private lastRev = 0;

  static styles = [
    statusStyles,
    css`
      .kv .side {
        flex-wrap: wrap;
        justify-content: flex-end;
        max-inline-size: 60%;
        text-align: end;
      }
      .tile .v.sm {
        font-size: var(--sw-fs-lg);
      }
    `,
    accessPanelPolish,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    const change = () => this.requestUpdate();
    this.systemRes = new Resource({ fetch: () => wrap(getWkSystemStatus), pick: (r: WkReply) => r.read, onChange: change });
    this.jobsRes = new Resource({ fetch: () => wrap(getWkJobsStatus), pick: (r: WkReply) => r.read, onChange: change });
    // the stations' names and the installation's zone only (the status segment's own read, cached by the server)
    this.namesRes = new Resource({ fetch: () => getStatusStations(), pick: (r: StatusStationsReply) => r.stations, onChange: change });
    this.lastRev = this.rev;
    this.reloadAll();
  }

  disconnectedCallback(): void {
    for (const r of [this.systemRes, this.jobsRes, this.namesRes]) r?.dispose();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      this.reloadAll();
    }
  }

  private reloadAll(): void {
    void this.systemRes.reload();
    void this.jobsRes.reload();
    void this.namesRes.reload();
  }

  private zone(): DisplayZone {
    return this.namesRes?.snap.reply?.default_zone ?? UTC_ZONE;
  }

  private nameOf(id: string): string | null {
    return this.namesRes.snap.data?.find((s) => s.id === id)?.name ?? null;
  }

  // ------------------------------------------------------------------ words

  /** A closed-set word: the page's sentence, or the code itself in a muted technical style. */
  private word(w: Word): TemplateResult | string {
    return 'key' in w ? st(w.key as StKey) : html`<bdi class="ltr mono" style=${CELL.raw}>${w.code}</bdi>`;
  }

  private wordText(w: Word): string {
    return 'key' in w ? st(w.key as StKey) : w.code;
  }

  private num(n: number | null): string {
    return n === null ? st('wkUnknown') : String(n);
  }

  private when(iso: string | null, now: Date): string {
    return ageText(age(iso, now, this.zone()));
  }

  private reason(code: string | null): TemplateResult | typeof nothing {
    const w = reasonWord(code);
    return w ? html`<span class="s wrap">${this.word(w)}</span>` : nothing;
  }

  // ------------------------------------------------------------------ a read that did not answer

  private panel(p: ReadPanel, which: string, retry: () => void, compact = false): TemplateResult {
    const hint = [p.hint ? st(p.hint as StKey) : '', p.code ? st('wkCode', { code: p.code }) : ''].filter(Boolean).join(' ');
    return html`<sw-state-panel icon="door" quiet ?compact=${compact} data-wk-state=${p.kind} data-wk-read=${which} state=${p.panel} heading=${st(p.heading as StKey)} hint=${hint} actionLabel=${p.retry ? st('retry') : ''} @action=${retry}></sw-state-panel>`;
  }

  private staleNote(res: Resource<WkRead, WkReply>, now: Date, which: string): TemplateResult | typeof nothing {
    if (!res.stale) return nothing;
    const at = res.snap.fetchedAt;
    return html`<div class="note stale" role="status" data-wk-stale=${which}><sw-icon name="offline" size=${16}></sw-icon><span>${at ? st('stale', { t: this.when(at, now) }) : st('staleNever')}</span></div>`;
  }

  // ------------------------------------------------------------------ system/status_v1

  private tilesRow(v: WkSystem): TemplateResult {
    const t = tiles(v);
    const profile = wordOf('wkProfile_', t.profile, PROFILES);
    const tile = (key: string, label: StKey, value: TemplateResult | string, detail: string, tone = '', small = false) =>
      html`<div class="tile" data-wk-tile=${key}><span class="k">${st(label)}</span><span class="v ${tone} ${small ? 'sm' : ''}">${value}</span><span class="d">${detail || html`&nbsp;`}</span></div>`;
    return html`<div class="tiles" data-wk-tiles>
      ${tile('version', 'wkTileVersion', t.version ? html`<bdi class="ltr">${t.version}</bdi>` : st('wkUnknown'), t.apiContract !== null ? st('wkTileContract', { n: t.apiContract }) : '', '', true)}
      ${tile('profile', 'wkTileProfile', this.word(profile), '', '', true)}
      ${tile('stations', 'wkTileStations', String(t.connected), t.unknown ? st('wkTileStationsUnknown', { total: t.total, n: t.unknown }) : st('wkTileStationsOf', { total: t.total }), t.total > 0 && t.connected < t.total ? 'warn' : '')}
      ${tile('writes', 'wkTileWrites', st('wkWritesPerCommand'), '', '', true)}
    </div>`;
  }

  private stationsCard(v: WkSystem, now: Date): TemplateResult {
    const row = (x: Record<string, unknown>) => x as unknown as WkStation;
    const columns: TableColumn[] = [
      {
        key: 'station',
        label: st('wkColStation'),
        card: 'title',
        render: (x) => {
          const s = row(x);
          const name = this.nameOf(s.station_id);
          return html`<span style=${CELL.strong}>${name ?? html`<bdi style=${CELL.raw}>${s.station_id}</bdi>`}</span>${s.loaded === false ? html`<span style=${CELL.sub}>${st('wkNotLoaded')}</span>` : nothing}`;
        },
      },
      {
        key: 'connection',
        label: st('wkColConnection'),
        card: 'badge',
        render: (x) => html`<sw-badge kind=${connectionKind(row(x).connection)} label=${this.wordText(wordOf('wkConn_', row(x).connection, CONNECTIONS))}></sw-badge>`,
      },
      { key: 'auth', label: st('wkColAuth'), card: 'show', render: (x) => this.when(row(x).last_authenticated_at, now) },
      {
        key: 'failure',
        label: st('wkColFailure'),
        card: 'show',
        render: (x) => {
          const f = row(x).last_failure;
          if (!f) return st('ageNone');
          const codes = failureCodes(f);
          return html`<span style=${CELL.wrap}>${this.word(wordOf('wkFail_', f.reason, FAILURE_REASONS))} · ${this.when(f.at, now)}</span>${codes ? html`<span style=${CELL.sub}><bdi style=${CELL.raw}>${codes}</bdi></span>` : nothing}`;
        },
      },
      { key: 'firmware', label: st('wkColFirmware'), hideBelow: 'tablet', render: (x) => (row(x).firmware ? html`<bdi style=${CELL.raw}>${row(x).firmware}</bdi>` : st('wkUnknown')) },
      {
        key: 'sync',
        label: st('wkColSync'),
        card: 'meta',
        render: (x) => {
          const s = row(x).sync;
          return html`<span style=${CELL.row}><sw-badge kind=${syncKind(s.state)} label=${this.wordText(wordOf('wkSync_', s.state, SYNC_STATES))}></sw-badge><span style=${CELL.muted}>${this.when(s.last_reconciled_at, now)}</span></span>`;
        },
      },
      {
        key: 'request',
        label: st('wkColRequest'),
        card: 'show',
        render: (x) => {
          const r = requestLine(row(x));
          if (r.kind === 'none') return st('ageNone');
          if (r.kind === 'pending') return st('wkReqPending');
          if (r.kind === 'active') return st('wkReqActive');
          return html`<span style=${CELL.row}><sw-badge kind=${syncKind(r.state)} label=${this.wordText(wordOf('wkSync_', r.state, RESULT_STATES))}></sw-badge><span style=${CELL.muted}>${st('wkNotProven')}</span></span>${r.code ? html`<span style=${CELL.sub}><bdi style=${CELL.raw}>${r.code}</bdi></span>` : nothing}`;
        },
      },
    ];
    const rows = v.stations.map((s) => ({ ...s, id: s.station_id })) as unknown as Record<string, unknown>[];
    return html`<sw-card flush data-wk-card="stations">
      <div class="ch"><div><h3>${st('wkStationsTitle')}</h3><div class="sub">${st('wkStationsSub')}</div></div></div>
      ${rows.length ? html`<sw-table data-wk-stations .columns=${columns} .rows=${rows} rowKey="id" static-rows></sw-table>` : html`<div class="empty" data-wk-stations-empty>${st('wkStationsEmpty')}</div>`}
      ${rows.length ? html`<div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${st('wkRequestNote')}</span></div>` : nothing}
    </sw-card>`;
  }

  private familiesCard(v: WkSystem): TemplateResult {
    const row = (x: Record<string, unknown>) => x as unknown as FamilyRow;
    const count = (f: FamilyRow, k: 'waiting' | 'running' | 'failed') => (f.present ? this.num(f[k]) : st('ageNone'));
    const columns: TableColumn[] = [
      {
        key: 'family',
        label: st('wkColFamily'),
        card: 'title',
        render: (x) => html`<span style=${CELL.strong}>${st(`wkFamily_${row(x).family}` as StKey)}</span>${row(x).present ? nothing : html`<span style=${CELL.sub}>${st('wkFamilyMissing')}</span>`}`,
      },
      { key: 'waiting', label: st('wkColWaiting'), card: 'meta', kind: 'num', render: (x) => count(row(x), 'waiting') },
      { key: 'running', label: st('wkColRunning'), card: 'meta', kind: 'num', render: (x) => count(row(x), 'running') },
      { key: 'failed', label: st('wkColFailed'), card: 'meta', kind: 'num', render: (x) => count(row(x), 'failed') },
    ];
    const rows = familyRows(v).map((f) => ({ ...f, id: f.family })) as unknown as Record<string, unknown>[];
    return html`<sw-card flush data-wk-card="families">
      <div class="ch"><div><h3>${st('wkFamiliesTitle')}</h3><div class="sub">${st('wkFamiliesSub')}</div></div></div>
      <sw-table data-wk-families .columns=${columns} .rows=${rows} rowKey="id" static-rows .rowAttrs=${(x: Record<string, unknown>) => ({ 'data-wk-family': String(x.family), 'data-wk-present': String(x.present) })}></sw-table>
      <div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${st('wkFamiliesNote')}${v.jobs.reason_codes.length ? html` · ${v.jobs.reason_codes.map((c, i) => html`${i ? ' · ' : ''}${this.word(reasonWord(c)!)}`)}` : nothing}</span></div>
    </sw-card>`;
  }

  /** One key / value line of a small card: the label (with WisKey's reason as a second line) and the value. */
  private kv(key: string, label: StKey, value: TemplateResult | string, reason: TemplateResult | typeof nothing = nothing): TemplateResult {
    return html`<div class="row kv" data-wk-line=${key}><span class="main"><span class="t">${st(label)}</span>${reason}</span><span class="side">${value}</span></div>`;
  }

  private writesCard(v: WkSystem): TemplateResult {
    const w = v.writes;
    return html`<sw-card flush data-wk-card="writes">
      <div class="ch"><div><h3>${st('wkWritesTitle')}</h3><div class="sub">${st('wkWritesSub')}</div></div></div>
      <div class="list">
        ${this.kv('writes', 'wkWritesLine', html`<sw-badge kind="neutral" label=${st('wkWritesPerCommand')}></sw-badge>`, html`<span class="s wrap">${st('wkWritesValue')}</span>`)}
        ${this.kv('legacy-schedules', 'wkLegacySched', html`<sw-badge kind="offline" label=${st('wkOff')}></sw-badge>`, this.reason(w.legacy_schedule_reason))}
        ${this.kv(
          'reviewed-schedules',
          'wkReviewedSched',
          w.reviewed_schedule_contract || v.schedules.reviewed_execution_contract ? html`<bdi class="ltr mono">${w.reviewed_schedule_contract ?? v.schedules.reviewed_execution_contract}</bdi>` : st('wkUnknown'),
          this.reason(w.reviewed_schedule_reason),
        )}
        ${this.kv('physical', 'wkPhysical', html`<sw-badge kind="unknown" label=${st('wkNotMeasured')}></sw-badge>`)}
      </div>
    </sw-card>`;
  }

  private templatesCard(v: WkSystem): TemplateResult {
    const t = v.templates;
    const admission = reasonWord(t.send_admission);
    return html`<sw-card flush data-wk-card="templates">
      <div class="ch"><div><h3>${st('wkTplTitle')}</h3><div class="sub">${st('wkTplSub')}</div></div></div>
      <div class="list">
        ${this.kv('installation', 'wkTplState', this.word(wordOf('wkTpl_', t.installation_state, TEMPLATE_STATES)), t.reason_codes.length ? html`<span class="s wrap">${t.reason_codes.map((c, i) => html`${i ? ' · ' : ''}${this.word(reasonWord(c)!)}`)}</span>` : nothing)}
        ${this.kv('accounts', 'wkTplAccounts', this.num(t.configured_accounts))}
        ${this.kv('templates', 'wkTplTemplates', this.num(t.configured_templates))}
        ${this.kv('admission', 'wkTplAdmission', admission ? this.word(admission) : st('wkUnknown'))}
      </div>
      <div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${st('wkTplNote')}</span></div>
    </sw-card>`;
  }

  private systemPart(now: Date): TemplateResult {
    const r = this.systemRes;
    const s = r.snap;
    if (!s.everAnswered || (s.busy && !s.data)) return html`${skeletonTiles()}<sw-card flush>${skeletonRows(3)}</sw-card>`;
    if (!s.data) return failurePanel(s.failure ?? 'error', s.message, () => void r.reload());
    const panel = readPanel(s.data, 'system');
    if (panel) return this.panel(panel, 'system', () => void r.reload());
    const v = systemView(s.data.data);
    if (!v) return this.panel(readPanel({ state: 'error', reason: 'contract_mismatch', wiskey_code: null }, 'system')!, 'system', () => void r.reload());
    return html`${this.staleNote(r, now, 'system')}
      <div class="note info" role="note" data-wk-scope><sw-icon name="info" size=${16}></sw-icon><span>${st('wkScopeNote')}${v.generated_at ? html` · ${st('wkReadAt', { when: this.when(v.generated_at, now) })}` : nothing}</span></div>
      ${this.tilesRow(v)} ${this.stationsCard(v, now)} ${this.familiesCard(v)}
      <div class="grid2">${this.writesCard(v)}${this.templatesCard(v)}</div>`;
  }

  // ------------------------------------------------------------------ jobs/status_v1

  private jobsCard(now: Date): TemplateResult {
    const r = this.jobsRes;
    const s = r.snap;
    let body: TemplateResult;
    let note = false;
    if (!s.everAnswered || (s.busy && !s.data)) body = skeletonRows(2);
    else if (!s.data) body = html`<div class="empty-panel">${failurePanel(s.failure ?? 'error', s.message, () => void r.reload(), true)}</div>`;
    else {
      const panel = readPanel(s.data, 'jobs');
      const v = panel ? null : jobsView(s.data.data);
      if (panel || !v) body = html`<div class="empty-panel">${this.panel(panel ?? readPanel({ state: 'error', reason: 'contract_mismatch', wiskey_code: null }, 'jobs')!, 'jobs', () => void r.reload(), true)}</div>`;
      else {
        note = true;
        body = v.records.length ? this.jobsTable(v.records, now) : html`<div class="empty" data-wk-jobs-empty>${st('wkJobsEmpty')}</div>`;
      }
    }
    return html`<sw-card flush data-wk-card="jobs">
      <div class="ch"><div><h3>${st('wkJobsTitle')}</h3><div class="sub">${st('wkJobsSub')}</div></div></div>
      ${this.staleNote(r, now, 'jobs')} ${body}
      ${note ? html`<div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${st('wkJobsNote')}</span></div>` : nothing}
    </sw-card>`;
  }

  private jobsTable(records: WkJob[], now: Date): TemplateResult {
    const row = (x: Record<string, unknown>) => x as unknown as WkJob;
    const columns: TableColumn[] = [
      { key: 'id', label: st('wkColJob'), card: 'title', cellTitle: (x) => row(x).id, render: (x) => html`<bdi style=${CELL.raw}>${shortId(row(x).id)}</bdi>` },
      { key: 'kind', label: st('wkColKind'), card: 'meta', render: (x) => this.word(wordOf('wkJobKind_', row(x).kind, JOB_KINDS)) },
      { key: 'state', label: st('wkColState'), card: 'badge', render: (x) => html`<sw-badge kind=${jobKind(row(x).state)} label=${this.wordText(wordOf('wkJob_', row(x).state, JOB_STATES))}></sw-badge>` },
      {
        key: 'rows',
        label: st('wkColRows'),
        card: 'show',
        render: (x) => {
          const j = row(x);
          const errors = j.errors.length ? (j.errors_truncated ? st('wkErrorsMore', { n: j.errors.length }) : st('wkErrors', { n: j.errors.length })) : '';
          return html`<span style=${CELL.wrap}>${st('wkRows', { saved: this.num(j.saved), failed: this.num(j.failed), pending: this.num(j.pending), total: this.num(j.total) })}</span>${errors ? html`<span style=${CELL.sub}>${errors}</span>` : nothing}`;
        },
      },
      {
        key: 'approval',
        label: st('wkColApproval'),
        card: 'show',
        render: (x) => {
          const a = row(x).approval;
          if (!a) return st('ageNone');
          return html`<span style=${CELL.wrap}>${this.word(wordOf('wkAppr_', a.state, APPROVAL_STATES))} · ${this.word(wordOf('wkApprAct_', a.action, APPROVAL_ACTIONS))}${a.expires_at ? html` · ${st('wkApprUntil', { when: this.when(a.expires_at, now) })}` : nothing}</span>`;
        },
      },
      { key: 'updated', label: st('wkColUpdated'), card: 'meta', render: (x) => this.when(row(x).updated_at ?? row(x).created_at, now) },
    ];
    return html`<sw-table data-wk-jobs .columns=${columns} .rows=${records as unknown as Record<string, unknown>[]} rowKey="id" static-rows></sw-table>`;
  }

  render() {
    const now = new Date();
    return html`<div class="stack" data-wk-status=${this.systemRes.snap.data?.state ?? (this.systemRes.snap.everAnswered ? 'failed' : 'loading')}>${this.systemPart(now)} ${this.jobsCard(now)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-wiskey': SystemAccessWiskey;
  }
}
