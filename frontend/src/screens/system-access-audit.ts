import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import type { DropdownItem } from '../components/sw-dropdown';
import { getStatusStations, getWiskeyAudit, type AuditPage, type AuditRecord, type AuditReply, type StatusStation, type StatusStationsReply, type SyncMeta } from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import { Resource } from '../access-control/status-feed';
import { CELL, statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { AUDIT_ACTIONS, age, appendAudit, auditFields, auditResult, auditTarget, whenOf } from '../access-control/status-logic';
import { actionText, ageText, errorText, fieldText, whenText } from '../access-control/status-text';
import { UTC_ZONE } from './wiskey-format';
import { bubbleChrome } from '../styles/bubble-chrome';
import { st } from '../i18n/access-status';

/**
 * CR-036 S10: "יומן האינטרקום" - the intercom's own action log, the second segment of the Settings page "בקרת כניסה". It lists what was
 * done in the intercom's own window (who, what, to whom or to which stations, and how it ended), newest first, `GET status/audit`. The
 * actions Arx itself started are recorded in Arx's own log (הגדרות › אודיט), not here - the subtitle says so. View only; the server
 * allows it to administrators of every station only (a refusal shows the plain "for administrators of every station" panel).
 * A record carries the NAMES of the fields it changed, never their values; the person on a record is shown as the server sent it.
 */
@customElement('system-access-audit')
export class SystemAccessAudit extends LitElement {
  /** The page's refresh counter: a change reads the log again from its newest page. */
  @property({ type: Number }) rev = 0;
  @state() private station = '';
  @state() private action = '';

  private auditRes!: Resource<AuditPage, AuditReply>;
  private stationsRes!: Resource<StatusStation[], StatusStationsReply>;
  private lastRev = 0;
  private lastMeta = '';

  static styles = [
    statusStyles,
    css`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
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
    this.auditRes = new Resource({
      fetch: (cursor: unknown) => getWiskeyAudit({ station_id: this.station, action: this.action, before: typeof cursor === 'number' ? cursor : null }),
      pick: (r: AuditReply) => r.audit,
      merge: appendAudit,
      cursorOf: (d: AuditPage) => d.next_cursor,
      onChange: change,
    });
    this.reloadAll();
  }

  disconnectedCallback(): void {
    this.stationsRes?.dispose();
    this.auditRes?.dispose();
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
    void this.auditRes.reload();
  }

  private emitMeta(): void {
    const meta: SyncMeta | null = this.auditRes?.snap.reply?.sync ?? this.stationsRes?.snap.reply?.sync ?? null;
    const json = JSON.stringify(meta);
    if (json === this.lastMeta) return;
    this.lastMeta = json;
    this.dispatchEvent(new CustomEvent('access-meta', { detail: { meta, zone: this.zone() }, bubbles: true, composed: true }));
  }

  private zone(): DisplayZone {
    return this.stationsRes?.snap.reply?.default_zone ?? UTC_ZONE;
  }

  private nameOf = (id: string): string => this.stationsRes.snap.data?.find((s) => s.id === id)?.name ?? id;

  private stationItems(): DropdownItem[] {
    return [{ id: '', label: st('auditStationAll') }, ...(this.stationsRes.snap.data ?? []).map((s) => ({ id: s.id, label: s.name }))];
  }

  private actionItems(): DropdownItem[] {
    return [{ id: '', label: st('auditActionAll') }, ...AUDIT_ACTIONS.map((a) => ({ id: a, label: actionText(a) }))];
  }

  private setStation(id: string): void {
    this.station = id;
    void this.auditRes.reload();
  }

  private setAction(id: string): void {
    this.action = id;
    void this.auditRes.reload();
  }

  private clear(): void {
    this.station = '';
    this.action = '';
    void this.auditRes.reload();
  }

  private target(r: AuditRecord): TemplateResult | string {
    const t = auditTarget(r);
    if (t.kind === 'none') return '—';
    if (t.kind === 'person') return html`<span>${t.name ?? st('unnamed')}${t.employee ? html` <span style=${CELL.muted}>· ${st('employeeShort', { n: t.employee })}</span>` : nothing}</span>`;
    const names = t.ids.map((id) => this.nameOf(id)).join(', ');
    return t.more ? st('auditStationsMore', { names, n: t.more }) : st('auditStations', { names });
  }

  private actionCell(r: AuditRecord): TemplateResult {
    const label = actionText(r.action);
    const fields = auditFields(r).map((f) => fieldText(f));
    const known = !!label && label !== r.action;
    return html`<span>${known ? label : html`<span style=${CELL.raw}>${label || '—'}</span>`}${fields.length ? html`<span style=${CELL.sub}>${st('auditFields', { list: fields.join(', ') })}</span>` : nothing}</span>`;
  }

  private resultCell(r: AuditRecord): TemplateResult {
    const res = auditResult(r);
    if (res.kind === 'done') return html`<sw-badge kind="live" label=${st('resDone')}></sw-badge>`;
    return html`<span style=${CELL.row}><sw-badge kind="error" label=${st('resFailed')}></sw-badge><span style=${CELL.muted}>${errorText(res.code)}</span></span>`;
  }

  private table(page: AuditPage, now: Date): TemplateResult {
    const zone = this.zone();
    const rec = (x: Record<string, unknown>) => x as unknown as AuditRecord;
    const columns: TableColumn[] = [
      { key: 'time', label: st('colTime'), render: (x) => (rec(x).time ? whenText(whenOf(rec(x).time, now, zone)) : '—') },
      { key: 'user', label: st('colUser'), render: (x) => rec(x).actor_name ?? st('actorNone') },
      { key: 'action', label: st('colAction'), render: (x) => this.actionCell(rec(x)) },
      { key: 'target', label: st('colTarget'), render: (x) => this.target(rec(x)) },
      { key: 'result', label: st('colResult'), render: (x) => this.resultCell(rec(x)) },
    ];
    return html`<sw-table data-access-audit-table .columns=${columns} .rows=${page.records as unknown as Record<string, unknown>[]} rowKey="sequence"></sw-table>`;
  }

  render() {
    const r = this.auditRes;
    const s = r.snap;
    const now = new Date();
    const page = s.data;
    const filtered = !!(this.station || this.action);
    let body: TemplateResult;
    if (!s.everAnswered || (s.busy && !page)) body = skeletonRows(5);
    else if (!page) return html`<div class="stack" data-access-status=${s.failure ?? 'error'}>${failurePanel(s.failure ?? 'error', s.message, () => this.reloadAll())}</div>`;
    else if (!page.records.length) body = html`<div class="empty" data-access-audit-empty>${filtered ? st('auditEmptyFiltered') : st('auditEmpty')}</div>`;
    else body = this.table(page, now);
    const zone = this.zone();
    return html`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="audit">
        <div class="ch">
          <div><h3>${st('auditTitle')}</h3><div class="sub">${st('auditSub')}</div></div>
          <div class="ctl">
            <sw-dropdown tall data-access-audit-station label=${st('auditStation')} .items=${this.stationItems()} .value=${this.station} @change=${(e: CustomEvent<{ id: string }>) => this.setStation(e.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-action label=${st('auditAction')} .items=${this.actionItems()} .value=${this.action} @change=${(e: CustomEvent<{ id: string }>) => this.setAction(e.detail.id)}></sw-dropdown>
            ${filtered ? html`<sw-button size="lg" variant="ghost" data-access-audit-clear @click=${() => this.clear()}>${st('auditClear')}</sw-button>` : nothing}
          </div>
        </div>
        ${r.stale && page ? html`<div class="note stale" role="status" data-access-stale="audit"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt ? st('stale', { t: ageText(age(s.fetchedAt, now, zone)) }) : st('staleNever')}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => void r.reload()}>${st('refresh')}</sw-button></div>` : nothing}
        ${body}
        ${r.hasMore ? html`<div class="more"><sw-button size="lg" data-access-audit-more ?disabled=${s.loadingMore} @click=${() => void r.more()}>${s.loadingMore ? st('loadingMore') : st('more')}</sw-button></div>` : nothing}
        ${s.moreFailed ? html`<div class="note err" role="alert" data-access-audit-more-failed><span>${st('moreFailed')}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => void r.more()}>${st('retry')}</sw-button></div>` : nothing}
        ${page ? html`<div class="foot-note" data-access-audit-foot>${[page.total !== null ? st('auditTotal', { n: page.total }) : '', page.retention_days ? st('auditRetention', { n: page.retention_days }) : ''].filter(Boolean).join(' · ')}</div>` : nothing}
      </sw-card>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-audit': SystemAccessAudit;
  }
}

