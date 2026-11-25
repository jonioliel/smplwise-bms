import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-card';
import './sw-dropdown';
import type { DropdownChange } from './sw-dropdown';
import './wk-action-button';
import type { StateKind } from './sw-badge';
import type { AccessStation } from '../api/access-stations';
import { outcomeOf } from '../api/schedule-writes';
import { checkScheduleRead, listScheduleReads, startScheduleRead, type ScheduleRead, type ScheduleReadsSupport } from '../api/schedule-reads';
import { canCheck, canStart, readState, readTone, summaryOf, supportState, visibleReads } from '../access-control/schedule-reads-logic';
import type { Tone } from '../access-control/schedule-editor-logic';
import { reasonOf, sed } from '../i18n/schedule-editor';

const KIND: Record<Tone, StateKind> = { live: 'live', stale: 'stale', error: 'error', offline: 'offline', unknown: 'unknown', neutral: 'neutral' };
type Key = Parameters<typeof sed>[0];

/**
 * WISKEY-SCHED-READS-2520: the signed schedule READS from a station (WisKey's `wiskey-schedule-reads.v1`: a short signed start, then
 * signed status checks), shown read-only inside the schedule library's management view, under the existing deploy warning (which this
 * block does not touch: Arx does not run schedules on the stations, and that warning stays as it is).
 *
 * What it does: the support line (supported / unsupported / unavailable - nothing is sent unless supported), a station picker and the
 * two station reads (readiness, dependencies), and the newest inspections (at most five: the block never scrolls) with their honest
 * state - accepted / reading are not done, `unknown` says that only a status check can tell, a refusal quotes WisKey's reason. A status
 * check is one click, one signed read; the browser never re-sends a start (the server makes every request id).
 */
@customElement('wk-schedule-reads')
export class WkScheduleReads extends LitElement {
  @property({ attribute: false }) stations: AccessStation[] = [];
  /** The screen's copy is current (a read is never started on a stale copy). */
  @property({ type: Boolean }) live = true;

  @state() private support: ScheduleReadsSupport | null = null;
  @state() private reads: ScheduleRead[] = [];
  @state() private failed = false;
  @state() private station = '';
  @state() private busy: string | null = null;
  @state() private note: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding: var(--sw-s-4);
    }
    .bh {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .bh h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .bh .sp {
      flex: 1;
    }
    .hint,
    .s {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .warn {
      margin: 0;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      font-size: var(--sw-fs-sm);
    }
    .start {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--sw-s-2);
    }
    .rows {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:first-child {
      border-block-start: 0;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    @media (max-width: 640px) {
      .row {
        flex-wrap: wrap;
      }
      .start sw-dropdown {
        inline-size: 100%;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('stations') && !this.stations.some((s) => s.id === this.station && s.online)) {
      this.station = this.stations.find((s) => s.online)?.id ?? '';
    }
  }

  private async load(): Promise<void> {
    try {
      const r = await listScheduleReads();
      this.support = r.support;
      this.reads = r.reads;
      this.failed = false;
    } catch {
      this.failed = true;
    }
  }

  private merge(read: ScheduleRead | null): void {
    if (!read) return;
    this.reads = [read, ...this.reads.filter((r) => r.request_id !== read.request_id)];
  }

  private async start(action: 'readiness' | 'dependencies'): Promise<void> {
    if (!this.station || this.busy) return;
    this.busy = action;
    this.note = null;
    try {
      const r = await startScheduleRead(action, { station_id: this.station });
      this.support = r.support;
      this.merge(r.read);
    } catch (err) {
      const o = outcomeOf(err);
      this.note = o.message || reasonOf(o.code);
    } finally {
      this.busy = null;
    }
  }

  private async check(read: ScheduleRead): Promise<void> {
    if (this.busy) return;
    this.busy = `check:${read.request_id}`;
    this.note = null;
    try {
      const r = await checkScheduleRead(read.request_id);
      this.support = r.support;
      this.merge(r.read);
      const s = r.status_read;
      if (s && s.outcome !== 'ok' && s.outcome !== 'not_needed') this.note = sed('sr_statusFailed', { reason: reasonOf(s.code) || s.outcome });
    } catch (err) {
      const o = outcomeOf(err);
      this.note = sed('sr_statusFailed', { reason: o.message || reasonOf(o.code) });
    } finally {
      this.busy = null;
    }
  }

  private stationName(id: string): string {
    return this.stations.find((s) => s.id === id)?.name ?? id;
  }

  private supportLine() {
    const s = supportState(this.support, this.failed);
    if (s === 'supported') return nothing;
    const key: Key = s === 'unsupported' ? 'sr_unsupported' : s === 'unavailable' ? 'sr_unavailable' : s === 'failed' ? 'sr_failed' : 'sr_loading';
    return html`<p class=${s === 'loading' ? 's' : 'warn'} role="status" data-sr-support=${s}>${sed(key)}</p>`;
  }

  render() {
    const supported = supportState(this.support, this.failed) === 'supported';
    const online = this.stations.filter((s) => s.online);
    const picked = this.stations.find((s) => s.id === this.station) ?? null;
    const startable = canStart(this.support, this.live, !!this.busy, picked ? !!picked.online : null);
    const { rows, more } = visibleReads(this.reads);
    return html`<sw-card>
      <div class="block" data-sr data-sr-state=${supportState(this.support, this.failed)}>
        <div class="bh"><h3>${sed('sr_title')}</h3></div>
        <p class="hint">${sed('sr_hint')}</p>
        ${this.supportLine()}
        ${supported
          ? html`<div class="start">
              <sw-dropdown data-sr-station label=${sed('sr_station')} .value=${this.station}
                .items=${online.map((s) => ({ id: s.id, label: s.name }))}
                @change=${(ev: CustomEvent<DropdownChange>) => (this.station = ev.detail.id)}></sw-dropdown>
              <wk-action-button icon="search" data-sr-start="readiness" ?busy=${this.busy === 'readiness'} ?disabled=${!startable}
                @click=${() => void this.start('readiness')}>${sed('sr_readiness')}</wk-action-button>
              <wk-action-button tone="quiet" icon="search" data-sr-start="dependencies" ?busy=${this.busy === 'dependencies'} ?disabled=${!startable}
                @click=${() => void this.start('dependencies')}>${sed('sr_dependencies')}</wk-action-button>
            </div>`
          : nothing}
        ${this.note ? html`<p class="warn" role="status" data-sr-note>${this.note}</p>` : nothing}
        ${rows.length
          ? html`<div class="rows">
              ${rows.map((r) => this.renderRow(r))}
            </div>`
          : supported
            ? html`<p class="s" data-sr-none>${sed('sr_none')}</p>`
            : nothing}
        ${more ? html`<p class="s" data-sr-more>${sed('sr_more', { n: more })}</p>` : nothing}
      </div>
    </sw-card>`;
  }

  private renderRow(r: ScheduleRead) {
    const st = readState(r.state);
    const sum = summaryOf(r);
    const line =
      st === 'unknown'
        ? sed('sr_unknownHint')
        : st === 'refused' || st === 'not_sent'
          ? reasonOf(r.wiskey_code)
          : sum
            ? sed(`sr_${sum.key}` as Key, sum.vars)
            : '';
    const subject = r.action === 'plan_recheck' || r.action === 'claim_preview' ? (r.subject ?? '').slice(0, 8) : this.stationName(r.subject);
    return html`<div class="row" data-sr-read=${r.request_id} data-state=${st}>
      <div class="main">
        <span class="t">${sed(`sr_a_${r.action}` as Key)} · ${subject}</span>
        ${line ? html`<span class="s">${line}</span>` : nothing}
      </div>
      <sw-badge kind=${KIND[readTone(st)]} label=${sed(`sr_s_${st}` as Key)}></sw-badge>
      ${canCheck(r, this.support, false)
        ? html`<wk-action-button tone="quiet" icon="refresh" data-sr-check=${r.request_id} ?busy=${this.busy === `check:${r.request_id}`}
            ?disabled=${!!this.busy} @click=${() => void this.check(r)}>${sed('sr_check')}</wk-action-button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-schedule-reads': WkScheduleReads;
  }
}
