import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import {
  KEEP_RUNS_RANGE, STEP_ORDER, adoptManaged, checkManaged, getManaged, isFinished, jobTone, keepRunsOf, managedRefusal, offers, phraseMatches,
  putKeepRuns, putManagedSwitch, refusalCode, startRollback, startUpgrade, switchState, type CheckResult, type ManagedJob, type ManagedView,
  type OnOff, type SwitchName,
} from '../api/wiskey-managed';
import { can, isApi } from '../api/session';
import { statusStyles } from '../access-control/status-css';
import { wmt, wmtOf, type WmKey } from '../i18n/wiskey-managed';

type Pending =
  | { kind: 'switch'; name: SwitchName; next: OnOff }
  | { kind: 'adopt' }
  | { kind: 'upgrade' }
  | { kind: 'rollback' };

const POLL_MS = 2000;

/**
 * WISKEY-MANAGED-INSTALL-2382: the "installation and updates" card of Settings > Security > access-control (#/system/security/wiskey).
 * Current and shipped versions, who owns the installed component, what a run would do; the owner switch (ON needs the typed phrase the
 * server sends), the accepted-risk switch, the one-time adoption of a manual install, the dry-run check, the run itself with a step-by-step
 * progress view, and the rollback. The server decides every rule; a refusal is worded from its closed code. Hidden for a non-administrator
 * (the screen above already shows the forbidden panel).
 */
@customElement('system-security-wiskey-managed')
export class SystemSecurityWiskeyManaged extends LitElement {
  @state() private loading = true;
  @state() private failed = '';
  @state() private concealed = false;
  @state() private view: ManagedView | null = null;
  @state() private pending: Pending | null = null;
  @state() private typed = '';
  @state() private busy = false;
  @state() private dlgError = '';
  @state() private error = '';
  @state() private notice = '';
  @state() private check: CheckResult | null = null;
  @state() private checking = false;
  /** Owner decision 04.11 Q8 = B: the kept-runs number being chosen (null = the server's). */
  @state() private keepDraft: number | null = null;
  @state() private keepSaving = false;
  @state() private keepNote = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  static styles = [
    statusStyles,
    css`
      :host { display: block; margin-block-start: 16px; }
      .hd { margin: 0; padding: 14px 14px 0; color: var(--sw-heading); font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); }
      .lead { margin: 4px 0 0; padding: 0 14px 14px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border-block-start: 1px solid var(--sw-border); }
      .fact { padding: 12px 14px; min-inline-size: 0; }
      .fact + .fact { border-inline-start: 1px solid var(--sw-border); }
      .fact .l { margin: 0; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .fact .v { margin: 4px 0 0; color: var(--sw-heading); font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; text-align: start; overflow-wrap: anywhere; }
      .fact .s { margin: 4px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; }
      .pill { display: inline-flex; align-items: center; min-block-size: 24px; padding: 0 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); background: var(--sw-surface-3, var(--sw-border)); color: var(--sw-text-2); }
      .pill[data-tone='ok'], .pill[data-state='on'] { background: var(--sw-success-bg, var(--sw-toggle-on)); color: var(--sw-success-text, var(--sw-text)); }
      .pill[data-tone='warn'] { background: var(--sw-warning-soft, var(--sw-surface-3)); color: var(--sw-text); }
      .pill[data-tone='danger'] { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
      .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 14px; align-items: center; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .row .t { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); font-weight: var(--sw-fw-bold); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .row .x { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .list { margin: 0; padding: 0 14px 14px; list-style: none; display: grid; gap: 6px; }
      .list li { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text); }
      .list li .c { grid-column: 2 / -1; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .list li[data-state='fail'], .list li[data-state='failed'] { color: var(--sw-danger-text); }
      .list li[data-state='pending'] { color: var(--sw-text-3); }
      .sec { padding: 12px 14px 0; border-block-start: 1px solid var(--sw-border); }
      .sec h4 { margin: 0 0 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); }
      .code { font-family: var(--sw-font-mono, monospace); direction: ltr; unicode-bidi: isolate; }
      .msg { padding: 0 14px 14px; }
      .foot-note { margin: 0; padding: 10px 14px 14px; color: var(--sw-text-3); font-size: var(--sw-fs-xs); border-block-start: 1px solid var(--sw-border); }
      .typed { display: grid; gap: 6px; margin-block-start: 12px; }
      .typed .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .typed .phrase { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
      .typed input { min-block-size: 40px; padding: 0 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong, var(--sw-border)); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-md); }
      .err-line { margin: 10px 0 0; color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
      .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-block-start: 14px; }
      .keep { display: flex; gap: 8px; align-items: center; }
      .keep select { min-block-size: 40px; min-inline-size: 72px; padding: 0 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong, var(--sw-border)); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-md); }
      @media (max-width: 767px) {
        .facts { grid-template-columns: minmax(0, 1fr); }
        .fact + .fact { border-inline-start: 0; border-block-start: 1px solid var(--sw-border); }
        .row { grid-template-columns: minmax(0, 1fr); }
        .actions sw-button { flex: 1 1 100%; }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedulePoll(): void {
    this.stopPolling();
    if (this.view?.running) this.timer = setTimeout(() => void this.refresh(), POLL_MS);
  }

  private async refresh(): Promise<void> {
    try {
      this.view = await getManaged();
    } catch {
      /* keep the last view; the next poll tries again */
    }
    this.schedulePoll();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.failed = '';
    try {
      this.view = await getManaged();
    } catch (err) {
      if (managedRefusal(err) === 'forbidden') this.concealed = true;
      else this.failed = describeError(err);
    } finally {
      this.loading = false;
    }
    this.schedulePoll();
  }

  private get canEdit(): boolean {
    return !isApi() || can('system.configure');
  }

  private ask(p: Pending): void {
    if (this.busy || !this.canEdit) return;
    this.error = '';
    this.notice = '';
    this.dlgError = '';
    this.typed = '';
    this.pending = p;
  }

  /** The typed phrase a pending action needs (null = a plain confirmation). */
  private phraseFor(p: Pending): string | null {
    const v = this.view;
    if (!v) return null;
    if (p.kind === 'adopt') return v.phrases.adopt;
    if (p.kind === 'switch' && p.next === 'on') {
      if (p.name === 'core_risk') return v.phrases.core_risk;
      return p.name === 'startup' ? v.phrases.startup ?? v.phrases.enabled : v.phrases.enabled; // Q7 = A: start-up asks the managed phrase again
    }
    return null;
  }

  private async saveKeep(): Promise<void> {
    const n = this.keepDraft;
    if (n === null || this.keepSaving || !this.canEdit) return;
    this.keepSaving = true;
    this.keepNote = '';
    this.error = '';
    try {
      this.view = await putKeepRuns(n);
      this.keepDraft = null;
      this.keepNote = wmt('keepSaved');
    } catch (err) {
      this.error = this.refusalText(err);
    } finally {
      this.keepSaving = false;
    }
  }

  /** Owner decision 04.11 Q8 = B: how many recent updates keep their previous version and private backup (default 5, 1-10). */
  private keepRow(v: ManagedView) {
    const current = keepRunsOf(v);
    const value = this.keepDraft ?? current;
    const [lo, hi] = v.keep_runs_range ?? KEEP_RUNS_RANGE;
    const options = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const dirty = this.keepDraft !== null && this.keepDraft !== current;
    return html`<div class="row" data-wm-keep data-value=${String(current)}>
      <div>
        <h4 class="t">${wmt('keepTitle')}${this.keepNote ? html`<span class="pill" data-tone="ok" data-wm-keep-saved>${this.keepNote}</span>` : nothing}</h4>
        <p class="x">${wmt('keepText')}</p>
      </div>
      <div class="keep">
        <select aria-label=${wmt('keepLabel')} data-wm-keep-select ?disabled=${!this.canEdit || this.keepSaving || v.running}
          @change=${(e: Event) => { this.keepDraft = Number((e.target as HTMLSelectElement).value); this.keepNote = ''; }}>
          ${options.map((n) => html`<option value=${String(n)} ?selected=${n === value}>${n}</option>`)}
        </select>
        <sw-button variant="secondary" data-wm-keep-save ?disabled=${!dirty || !this.canEdit || this.keepSaving}
          @click=${() => void this.saveKeep()}>${wmt('keepSave')}</sw-button>
      </div>
    </div>`;
  }

  private refusalText(err: unknown): string {
    const kind = managedRefusal(err);
    if (kind === 'forbidden') return wmt('forbidden');
    if (kind === 'confirm') return wmt('typeWrong');
    const code = refusalCode(err);
    return wmtOf('code_', code) ?? `${wmt('failed')} · ${describeError(err)}`;
  }

  private async confirm(): Promise<void> {
    const p = this.pending;
    if (!p || this.busy) return;
    const phrase = this.phraseFor(p);
    if (phrase !== null && !phraseMatches(this.typed, phrase)) {
      this.dlgError = wmt('typeWrong');
      return;
    }
    this.busy = true;
    this.dlgError = '';
    try {
      if (p.kind === 'switch') this.view = await putManagedSwitch(p.name, p.next, phrase !== null ? this.typed.trim() : undefined);
      else if (p.kind === 'adopt') {
        this.view = await adoptManaged(this.typed.trim());
        this.notice = wmt('adoptDone');
      } else {
        await (p.kind === 'upgrade' ? startUpgrade() : startRollback());
        this.check = null;
        this.view = await getManaged();
      }
      this.pending = null;
    } catch (err) {
      this.dlgError = this.refusalText(err);
    } finally {
      this.busy = false;
    }
    this.schedulePoll();
  }

  private async runCheck(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    this.error = '';
    try {
      this.check = await checkManaged();
    } catch (err) {
      this.error = this.refusalText(err);
    } finally {
      this.checking = false;
    }
  }

  private fact(label: WmKey, value: string, sub: unknown, attr: string) {
    return html`<div class="fact" data-wm-fact=${attr}><p class="l">${wmt(label)}</p><p class="v">${value}</p>${sub ? html`<p class="s">${sub}</p>` : nothing}</div>`;
  }

  private facts(v: ManagedView) {
    const own = v.installed.ownership;
    const installedV = v.installed.state === 'present' ? v.installed.version ?? '—' : wmt('none');
    const planText = wmtOf('plan_', v.plan) ?? v.plan;
    const tone = v.plan === 'up_to_date' ? 'ok' : ['install', 'upgrade', 'convert'].includes(v.plan) ? 'info' : 'warn';
    return html`<div class="facts" data-wm-facts>
      ${this.fact('installed', installedV, html`<span data-wm-ownership=${own}>${wmtOf('own_', own) ?? own}</span>`, 'installed')}
      ${this.fact('shipped', v.bundle.version ?? '—', v.bundle.state !== 'ok' ? wmtOf('plan_', 'bundle_missing') : null, 'shipped')}
      <div class="fact" data-wm-fact="status"><p class="l">${wmt('status')}</p><p class="s"><span class="pill" data-tone=${tone} data-wm-plan=${v.plan}>${planText}</span></p></div>
    </div>`;
  }

  private switchRow(v: ManagedView, name: SwitchName) {
    const on = switchState(v, name) === 'on';
    const stem = name === 'enabled' ? 'enabled' : name === 'startup' ? 'startup' : 'risk';
    return html`<div class="row" data-wm-switch=${name} data-state=${on ? 'on' : 'off'}>
      <div>
        <h4 class="t">${wmt(`${stem}Title` as WmKey)}<span class="pill" data-state=${on ? 'on' : 'off'}>${wmt(on ? 'on' : 'off')}</span></h4>
        <p class="x">${wmt(`${stem}Text` as WmKey)}</p>
      </div>
      <sw-button variant=${on ? 'secondary' : 'primary'} data-wm-toggle ?disabled=${!this.canEdit || this.busy || v.running}
        @click=${() => this.ask({ kind: 'switch', name, next: on ? 'off' : 'on' })}>${wmt(on ? 'turnOff' : 'turnOn')}</sw-button>
    </div>`;
  }

  private actions(v: ManagedView) {
    const o = offers(v);
    if (v.switches.enabled !== 'on') return nothing;
    const runLabel: WmKey = v.plan === 'install' ? 'installButton' : v.plan === 'convert' ? 'convertButton' : 'upgradeButton';
    const dis = !this.canEdit || this.busy;
    return html`<div class="actions" data-wm-actions>
      ${o.adopt ? html`<sw-button variant="primary" data-wm-adopt ?disabled=${dis} @click=${() => this.ask({ kind: 'adopt' })}>${wmt('adoptButton')}</sw-button>` : nothing}
      ${o.upgrade ? html`<sw-button variant="secondary" data-wm-check ?disabled=${dis || this.checking} @click=${() => void this.runCheck()}>${wmt(this.checking ? 'checking' : 'checkButton')}</sw-button>
        <sw-button variant="primary" data-wm-upgrade ?disabled=${dis} @click=${() => this.ask({ kind: 'upgrade' })}>${wmt(runLabel)}</sw-button>` : nothing}
      ${o.rollback ? html`<sw-button variant="secondary" data-wm-rollback ?disabled=${dis} @click=${() => this.ask({ kind: 'rollback' })}>${wmt('rollbackButton')}</sw-button>` : nothing}
    </div>`;
  }

  private checkList() {
    const c = this.check;
    if (!c) return nothing;
    const icon = (s: string) => (s === 'pass' ? 'check' : s === 'warn' ? 'warning' : 'close');
    return html`<div class="sec" data-wm-checks data-ready=${c.ready ? 'yes' : 'no'}>
      <h4>${wmt('checkTitle')}</h4>
      <ul class="list">${c.items.map((i) => html`<li data-wm-check-item=${i.name} data-state=${i.state}>
        <sw-icon name=${icon(i.state)} size="16"></sw-icon><span>${wmtOf('chk_', i.name) ?? i.name}</span><span>${wmt(`chk_${i.state}` as WmKey)}</span>
        ${i.code ? html`<span class="c">${wmtOf('code_', i.code) ?? wmtOf('plan_', i.plan) ?? ''} <span class="code">${i.code}</span></span>` : nothing}
      </li>`)}</ul>
    </div>`;
  }

  private jobView(job: ManagedJob | null) {
    if (!job) return nothing;
    const seen = new Set<string>();
    const names = [...job.steps.map((s) => s.name)];
    const done = isFinished(job);
    if (!done) for (const n of STEP_ORDER.slice(0, 9)) if (!names.includes(n) && !(job.kind === 'rollback' && (n === 'core_gate' || n === 'backup_check'))) names.push(n);
    const rows = names.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));
    const stepOf = (n: string) => [...job.steps].reverse().find((s) => s.name === n);
    const icon = (s?: string) => (s === 'done' ? 'check' : s === 'failed' ? 'close' : s === 'running' ? 'refresh' : 'clock');
    const tone = jobTone(job);
    return html`<div class="sec" data-wm-job data-state=${job.state} data-kind=${job.kind}>
      <h4>${wmt(done ? 'lastRun' : 'progress')}<span class="pill" data-tone=${tone}>${wmtOf('job_', job.state) ?? job.state}</span>
        ${job.origin === 'startup' ? html`<span class="pill" data-wm-origin="startup">${wmt('originStartup')}</span>` : nothing}
        <span class="code">${job.from_version ?? '—'} → ${job.to_version ?? '—'}</span></h4>
      <ul class="list" aria-live="polite">${rows.map((n) => {
        const s = stepOf(n);
        const st = s?.state ?? 'pending';
        return html`<li data-wm-step=${n} data-state=${st}><sw-icon name=${icon(s?.state)} size="16"></sw-icon><span>${wmtOf('step_', n) ?? n}</span><span></span>
          ${s?.code ? html`<span class="c">${wmtOf('code_', s.code) ?? ''} <span class="code">${s.code}</span></span>` : nothing}</li>`;
      })}</ul>
      ${job.risk_accepted ? html`<div class="msg"><div class="note stale"><sw-icon name="warning" size="16"></sw-icon><span>${wmt('riskAccepted')}</span></div></div>` : nothing}
      ${done && job.state === 'rollback_failed' ? html`<div class="msg"><div class="note err" role="alert" data-wm-job-alert><sw-icon name="warning" size="16"></sw-icon><span>${wmt('job_rollback_failed')}</span></div></div>` : nothing}
    </div>`;
  }

  private dialog() {
    const p = this.pending;
    if (!p) return nothing;
    const phrase = this.phraseFor(p);
    let heading = '';
    let text = '';
    if (p.kind === 'switch') {
      const stem = p.name === 'enabled' ? 'enabled' : p.name === 'startup' ? 'startup' : 'risk';
      const name = wmt(`${stem}Title` as WmKey);
      heading = wmt(p.next === 'on' ? 'typeQ' : 'offQ', { name });
      text = p.next === 'on' ? wmt(`${stem}Text` as WmKey) : wmt('offText');
    } else if (p.kind === 'adopt') {
      heading = wmt('adoptQ');
      text = wmt('adoptText');
    } else if (p.kind === 'upgrade') {
      heading = wmt('upgradeQ');
      text = wmt('upgradeText');
    } else {
      heading = wmt('rollbackQ');
      text = wmt('rollbackText');
    }
    const ok = phrase === null || phraseMatches(this.typed, phrase);
    const danger = p.kind === 'switch' && p.next === 'off';
    const label = p.kind === 'switch' ? wmt(p.next === 'on' ? 'turnOn' : 'turnOff') : p.kind === 'adopt' ? wmt('adoptButton') : wmt('start');
    return html`<sw-dialog open heading=${heading} data-wm-dialog=${p.kind === 'switch' ? `${p.name}-${p.next}` : p.kind} @close=${() => { if (!this.busy) this.pending = null; }}>
      <p style="margin:0">${text}</p>
      ${phrase !== null ? html`<label class="typed"><span class="lbl">${wmt('typeText', { phrase: '' })}<span class="phrase" data-wm-phrase>${phrase}</span></span>
        <input data-wm-phrase-input autocomplete="off" spellcheck="false" aria-label=${wmt('typeLabel')} .value=${this.typed}
          @input=${(e: Event) => { this.typed = (e.target as HTMLInputElement).value; this.dlgError = ''; }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && ok) void this.confirm(); }}></label>` : nothing}
      ${this.dlgError ? html`<p class="err-line" role="alert" data-wm-dialog-error>${this.dlgError}</p>` : nothing}
      <div class="foot"><sw-button variant="ghost" data-wm-cancel ?disabled=${this.busy} @click=${() => (this.pending = null)}>${wmt('cancel')}</sw-button>
        <sw-button variant=${danger ? 'danger' : 'primary'} data-wm-confirm ?disabled=${this.busy || !ok} @click=${() => void this.confirm()}>${label}</sw-button></div>
    </sw-dialog>`;
  }

  render() {
    if (this.concealed) return nothing;
    if (this.loading) return html`<sw-card flush data-wm-card><sw-state-panel state="loading"></sw-state-panel></sw-card>`;
    if (this.failed || !this.view) {
      return html`<sw-card flush data-wm-card><sw-state-panel state="error" data-wm-load-error heading=${wmt('loadFailed')} hint=${this.failed}
        actionLabel=${wmt('retry')} @action=${() => void this.load()}></sw-state-panel></sw-card>`;
    }
    const v = this.view;
    return html`<sw-card flush data-wm-card data-running=${v.running ? 'yes' : 'no'}>
      <h3 class="hd">${wmt('title')}</h3>
      <p class="lead">${wmt('lead')}</p>
      ${this.facts(v)}
      ${this.switchRow(v, 'enabled')}
      ${v.switches.enabled === 'on' ? this.switchRow(v, 'core_risk') : nothing}
      ${v.switches.enabled === 'on' && v.phrases.startup ? this.switchRow(v, 'startup') : nothing}
      ${v.keep_runs !== undefined ? this.keepRow(v) : nothing}
      ${this.actions(v)}
      ${this.checkList()}
      ${this.jobView(v.job)}
      ${this.error ? html`<div class="msg" style="padding-block-start:14px"><div class="note err" role="alert" data-wm-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>` : nothing}
      ${this.notice && !this.error ? html`<div class="msg" style="padding-block-start:14px"><div class="note info" role="status" data-wm-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>` : nothing}
      ${v.unattended_permitted ? nothing : html`<p class="foot-note" data-wm-unattended>${wmt('unattended')}</p>`}
    </sw-card>
    ${this.dialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security-wiskey-managed': SystemSecurityWiskeyManaged;
  }
}
