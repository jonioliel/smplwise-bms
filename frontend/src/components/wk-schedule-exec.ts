import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-card';
import './sw-toggle';
import './wk-action-button';
import type { StateKind } from './sw-badge';
import type { AccessStation } from '../api/access-stations';
import { outcomeOf, type Job } from '../api/schedule-writes';
import {
  checkScheduleExecution,
  getScheduleExecution,
  setScheduleExecution,
  type ScheduleExecutionJob,
  type ScheduleExecutionView,
} from '../api/schedule-execution';
import { anyExecuted, canCheckExec, execPhase, execSupport, execTone, visibleJobs } from '../access-control/schedule-execution-logic';
import type { Tone } from '../access-control/schedule-editor-logic';
import { reasonOf, sed } from '../i18n/schedule-editor';

const KIND: Record<Tone, StateKind> = { live: 'live', stale: 'stale', error: 'error', offline: 'offline', unknown: 'unknown', neutral: 'neutral' };
type Key = Parameters<typeof sed>[0];

/** Fired whenever the view changes: whether the switch is on and a status read showed a job executed (the deploy warning's rule). */
export interface ExecChange {
  executed: boolean;
}

/**
 * WISKEY-A2-EXEC-2530 (owner 25.11, A2 option b: "the owner approves in WisKey's screen, Arx shows status only"): the READ-ONLY status
 * of WisKey's reviewed schedule execution for the deployment jobs of the schedule library's management view.
 *
 * Off (the default): a system administrator sees one line with the switch; everybody else sees nothing - the screen is as before.
 * On: the support line, then the newest five jobs (no inner scrolling) with their phase in WisKey (waiting for the owner, waiting for a
 * second approval, approved, running, run and verified, ...) and ONE action - "בדיקת מצב", a single signed status read. There is no
 * button that approves, runs, previews or cancels anything: that is the owner's, in WisKey's own screen, and the hint says so.
 */
@customElement('wk-schedule-exec')
export class WkScheduleExec extends LitElement {
  @property({ attribute: false }) stations: AccessStation[] = [];
  /** The deployment jobs of the screen's operations answer. */
  @property({ attribute: false }) jobs: Job[] = [];

  @state() private view: ScheduleExecutionView | null = null;
  @state() private failed = false;
  @state() private busy: string | null = null;
  @state() private note: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    /* nothing to show (off for a user without the switch right, not loaded, failed): no box at all, so the library's flex gap stays
       exactly as before this block existed */
    :host([hidden]) {
      display: none;
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
    .rows {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      flex-wrap: wrap; /* a narrow screen puts the badge and the check under the text */
      align-items: center;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
      border-block-start: thin solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:first-child {
      border-block-start: 0;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      /* the text keeps a readable width: on a phone the badge and the check go to the next line instead of squeezing it */
      flex: 1 1 20em;
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.hidden = true;
    void this.load();
  }

  protected willUpdate(): void {
    const v = this.view;
    this.hidden = this.failed ? !v?.can_configure : !v || (!v.enabled && !v.can_configure);
  }

  private set(view: ScheduleExecutionView): void {
    this.view = view;
    this.failed = false;
    this.dispatchEvent(new CustomEvent<ExecChange>('sx-change', { detail: { executed: anyExecuted(view) }, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    try {
      this.set(await getScheduleExecution());
    } catch {
      this.view = null;
      this.failed = true;
    }
  }

  private async toggle(on: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = 'switch';
    this.note = null;
    try {
      this.set(await setScheduleExecution(on));
    } catch (err) {
      const o = outcomeOf(err);
      this.note = o.message || reasonOf(o.code);
    } finally {
      this.busy = null;
    }
  }

  private async check(jobId: string): Promise<void> {
    const v = this.view;
    if (this.busy || !v) return;
    this.busy = `check:${jobId}`;
    this.note = null;
    try {
      const r = await checkScheduleExecution(jobId);
      const jobs = r.job ? [r.job, ...v.jobs.filter((j) => j.job_id !== jobId)] : v.jobs;
      this.set({ ...v, support: r.support, jobs });
      const s = r.status_read;
      if (s.outcome !== 'ok' && s.outcome !== 'not_needed') this.note = sed('sx_statusFailed', { reason: reasonOf(s.code) || s.outcome });
    } catch (err) {
      const o = outcomeOf(err);
      this.note = sed('sx_statusFailed', { reason: o.message || reasonOf(o.code) });
    } finally {
      this.busy = null;
    }
  }

  private stationName(id: string | null | undefined): string {
    return this.stations.find((s) => s.id === id)?.name ?? id ?? '—';
  }

  private readOf(jobId: string): ScheduleExecutionJob | null {
    return this.view?.jobs.find((j) => j.job_id === jobId) ?? null;
  }

  private switchRow() {
    const v = this.view!;
    if (!v.can_configure) return nothing;
    return html`<sw-toggle data-sx-switch size="sm" label=${sed('sx_switch')} ?checked=${v.enabled} ?disabled=${this.busy === 'switch'}
      @change=${(e: CustomEvent<{ checked: boolean }>) => void this.toggle(e.detail.checked === true)}></sw-toggle>`;
  }

  render() {
    const v = this.view;
    if (this.failed) return v?.can_configure ? html`<p class="warn" role="status" data-sx-failed>${sed('sx_failed')}</p>` : nothing;
    if (!v) return nothing;
    if (!v.enabled) {
      if (!v.can_configure) return nothing; // off: the screen is exactly as before for everybody else
      return html`<sw-card>
        <div class="block" data-sx data-sx-state="off">
          <div class="bh"><h3>${sed('sx_title')}</h3><span class="sp"></span>${this.switchRow()}</div>
          <p class="hint">${sed('sx_switchOffHint')}</p>
          ${this.note ? html`<p class="warn" role="status" data-sx-note>${this.note}</p>` : nothing}
        </div>
      </sw-card>`;
    }
    const sup = execSupport(v.support);
    const { rows, more } = visibleJobs(this.jobs);
    return html`<sw-card>
      <div class="block" data-sx data-sx-state=${sup}>
        <div class="bh"><h3>${sed('sx_title')}</h3><span class="sp"></span>${this.switchRow()}</div>
        <p class="hint">${sed('sx_hint')}</p>
        ${sup === 'unsupported' || sup === 'unavailable'
          ? html`<p class="warn" role="status" data-sx-support=${sup}>${sed(sup === 'unsupported' ? 'sx_unsupported' : 'sx_unavailable')}</p>`
          : nothing}
        ${this.note ? html`<p class="warn" role="status" data-sx-note>${this.note}</p>` : nothing}
        ${rows.length ? html`<div class="rows">${rows.map((j) => this.renderRow(j))}</div>` : html`<p class="s" data-sx-none>${sed('sx_none')}</p>`}
        ${more ? html`<p class="s" data-sx-more>${sed('sx_more', { n: more })}</p>` : nothing}
      </div>
    </sw-card>`;
  }

  private renderRow(j: Job) {
    const read = this.readOf(j.id);
    const phase = execPhase(read);
    const parts: string[] = [sed(`sx_h_${phase}` as Key)];
    if (read?.code && phase !== 'executed') parts.push(reasonOf(read.code));
    if (read && read.steps_total > 0) parts.push(sed('sx_steps', { v: read.steps_verified, n: read.steps_total }));
    const checkable = canCheckExec(read, this.view, !!this.busy);
    return html`<div class="row" data-sx-job=${j.id} data-phase=${phase}>
      <div class="main">
        <span class="t">${j.name ?? '—'} · ${this.stationName(j.station_id)}</span>
        <span class="s">${parts.filter(Boolean).join(' · ')}</span>
      </div>
      <sw-badge kind=${KIND[execTone(phase)]} label=${sed(`sx_p_${phase}` as Key)}></sw-badge>
      ${read?.final
        ? nothing
        : html`<wk-action-button tone="quiet" icon="refresh" data-sx-check=${j.id} ?busy=${this.busy === `check:${j.id}`} ?disabled=${!checkable}
            @click=${() => void this.check(j.id)}>${sed('sx_check')}</wk-action-button>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-schedule-exec': WkScheduleExec;
  }
}
