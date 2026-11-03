import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-state-panel';
import '../components/wk-installer-confirm';
import type { ConfirmRequest } from '../components/wk-installer-confirm';
import { settingsStyles } from '../styles/settings';
import { installerStyles } from './installer-styles';
import { ApiError } from '../api/client';
import {
  COMMITTING_STEPS,
  PULSE_PHRASE,
  abortOnboarding,
  connectionErrors,
  connectionInput,
  getLifecycle,
  jobProgress,
  lifecycleAction,
  nextAction,
  onboardingStep,
  outcomeOf,
  prepareLifecycle,
  reviewLifecycle,
  startOnboarding,
  type FlowView,
  type LifecycleImpact,
  type LifecycleJob,
  type LifecycleList,
  type WriteOutcome,
} from '../api/installer';
import { fill, installerText as T, lifecycleText as L } from '../i18n/wiskey-installer';

type Station = { id: string; name: string; online: boolean };

/**
 * WISKEY-INSTALLER-NATIVE-2400 phase 3 - הגדרות › התקנה ותחזוקת מערכת האינטרקום › הוספה והסרה.
 * Three jobs an installer does: add a station (WisKey's own onboarding flow, step by step: connection, device identity, door, relay test),
 * reconnect one (new address or credentials, same device) and remove or replace one (WisKey's reviewed lifecycle: impact, prepare, move
 * the people, verify the cleanup, remove). The wizard shows only what WisKey asks at the step it waits on; the credentials are sent to
 * WisKey and dropped from the form; the steps that save or change something get the confirmation dialog, the relay test the typed phrase.
 * A removal is a job with states - its step indicator is the progress, read again from WisKey on demand.
 */
@customElement('installer-lifecycle')
export class InstallerLifecycle extends LitElement {
  @property({ attribute: false }) stations: Station[] = [];
  @state() private list: LifecycleList | null = null;
  @state() private listError = '';
  @state() private flow: (FlowView & { kind: 'add' | 'reconfigure' }) | null = null;
  @state() private form: Record<string, string | boolean> = {};
  @state() private busy = false;
  @state() private stepError: WriteOutcome | null = null;
  @state() private reStation = '';
  @state() private source = '';
  @state() private target = '';
  @state() private impact: LifecycleImpact | null = null;
  @state() private reviewing = false;
  @state() private reviewError = '';
  @state() private confirm: ConfirmRequest | null = null;
  @state() private flash: { tone: 'ok' | 'warn'; text: string } | null = null;

  static styles = [
    settingsStyles,
    installerStyles,
    css`
      :host {
        display: block;
      }
      .wizard-steps {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-block-end: 8px;
      }
      .wizard-steps span {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      .wizard-steps span[aria-current='step'] {
        color: var(--sw-accent-text);
        font-weight: var(--sw-fw-semibold);
      }
      .radios {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .stepper {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
        margin-block: 6px;
      }
      .stepper i {
        display: block;
        block-size: 4px;
        border-radius: 2px;
        background: var(--sw-surface-3);
      }
      .stepper i[data-on] {
        background: var(--sw-accent);
      }
      .stepper-labels {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
        font-size: var(--sw-fs-xs, var(--sw-fs-sm));
        color: var(--sw-text-3);
      }
      .nums {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
        gap: 8px;
      }
      .num {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
      }
      .num b {
        font-size: var(--sw-fs-lg, var(--sw-fs-md));
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadJobs();
  }

  private async loadJobs(): Promise<void> {
    try {
      this.list = await getLifecycle();
      this.listError = '';
    } catch (err) {
      this.listError = err instanceof ApiError ? err.body.user_message : String(err);
    }
  }

  // ---------------------------------------------------------------- the wizard

  private async begin(kind: 'add' | 'reconfigure'): Promise<void> {
    this.busy = true;
    this.stepError = null;
    this.flash = null;
    try {
      const r = await startOnboarding(kind, kind === 'reconfigure' ? this.reStation : undefined);
      this.adopt(r.data, kind);
    } catch (err) {
      this.stepError = outcomeOf(err);
    } finally {
      this.busy = false;
    }
  }

  private adopt(view: FlowView, kind: 'add' | 'reconfigure'): void {
    if (view.type === 'form') {
      const d = view.defaults;
      this.form =
        view.step_id === 'user' || view.step_id === 'reconfigure'
          ? { name: String(d.name ?? ''), host: String(d.host ?? ''), username: String(d.username ?? 'admin'), password: '', scheme: String(d.scheme ?? 'http'),
              port: String(d.port ?? 80), verify_ssl: d.verify_ssl !== false, rtsp_port: String(d.rtsp_port ?? 554), ...(this.flow?.step_id === view.step_id ? { ...this.form, password: '' } : {}) }
          : view.step_id === 'locks'
            ? { mode: String(view.choices.mode?.[0] ?? 'camera_only'), lock_name: String(d.lock_name ?? '') }
            : view.step_id === 'mapping'
              ? { api_id: String(view.choices.api_id?.[0] ?? '') }
              : view.step_id === 'confirm_mapping'
                ? { result: 'released_and_returned' }
                : {};
      this.flow = { ...view, kind };
      return;
    }
    this.flow = null;
    this.form = {};
    if (view.type === 'create_entry') this.flash = { tone: 'ok', text: fill(L.created, { title: view.entry?.title ?? '' }) };
    else if (view.type === 'abort' && view.reason === 'reconfigure_successful') this.flash = { tone: 'ok', text: L.reconfigured };
    else if (view.type === 'abort') this.flash = { tone: 'warn', text: fill(L.aborted, { reason: L.abortReasons[view.reason ?? ''] ?? view.reason ?? '' }) };
    void this.loadJobs();
  }

  private stepInput(): Record<string, unknown> {
    const f = this.flow!;
    const step = f.step_id!;
    if (step === 'user' || step === 'reconfigure') return connectionInput(this.form, step);
    if (step === 'locks') return { mode: this.form.mode, ...(this.form.mode !== 'camera_only' || this.form.lock_name ? { lock_name: String(this.form.lock_name ?? '') } : {}) };
    if (step === 'mapping') return { api_id: Number(this.form.api_id), test_unlock: true };
    if (step === 'confirm_mapping') return { result: this.form.result };
    return {};
  }

  private async sendStep(typed?: string): Promise<unknown> {
    const f = this.flow!;
    const r = await onboardingStep(f.flow_id, f.step_id!, this.stepInput(), typed);
    this.form = { ...this.form, password: '' }; // the password leaves the form as soon as it was sent
    this.adopt(r.data, f.kind);
    return r;
  }

  private async next(): Promise<void> {
    const f = this.flow;
    if (!f || !f.step_id) return;
    if (f.step_id === 'mapping') {
      this.confirm = { heading: L.pulseHeading, body: L.pulseWarn, typed: PULSE_PHRASE, danger: true, maxSeconds: 55, send: (t) => this.sendStep(t) };
      return;
    }
    if (COMMITTING_STEPS.includes(f.step_id)) {
      this.confirm = { heading: L.commitHeading, body: L.commitBody, maxSeconds: 55, send: () => this.sendStep() };
      return;
    }
    this.busy = true;
    this.stepError = null;
    try {
      await this.sendStep();
    } catch (err) {
      this.form = { ...this.form, password: '' };
      this.stepError = outcomeOf(err);
    } finally {
      this.busy = false;
    }
  }

  private async cancelFlow(): Promise<void> {
    const f = this.flow;
    if (!f) return;
    this.busy = true;
    try {
      await abortOnboarding(f.flow_id);
      this.flash = { tone: 'warn', text: L.cancelled };
    } catch (err) {
      this.stepError = outcomeOf(err);
    } finally {
      this.flow = null;
      this.form = {};
      this.busy = false;
    }
  }

  private field(key: string, type: 'text' | 'password' | 'number' = 'text', hint = ''): TemplateResult {
    const bad = this.flow && (this.flow.step_id === 'user' || this.flow.step_id === 'reconfigure') ? connectionErrors(connectionInput(this.form, this.flow.step_id), this.flow.step_id) : [];
    const touched = String(this.form[key] ?? '') !== '' || key === 'password';
    return html`<label class="f"><span>${L.fields[key]}</span>
      <input type=${type === 'number' ? 'text' : type} inputmode=${type === 'number' ? 'numeric' : 'text'} dir=${key === 'name' ? 'auto' : 'ltr'}
        autocomplete=${type === 'password' ? 'new-password' : 'off'} spellcheck="false" .value=${String(this.form[key] ?? '')} ?disabled=${this.busy}
        aria-invalid=${touched && bad.includes(key) && !(key === 'password' && !this.form.password) ? 'true' : 'false'} data-flow-field=${key}
        @input=${(e: Event) => (this.form = { ...this.form, [key]: (e.target as HTMLInputElement).value })} />
      ${hint ? html`<span class="muted">${hint}</span>` : nothing}</label>`;
  }

  private wizard(): TemplateResult {
    const f = this.flow!;
    const step = f.step_id ?? 'other';
    const order = f.kind === 'add' ? ['user', 'confirm_device', 'locks', 'mapping', 'confirm_mapping'] : ['reconfigure', 'confirm_device', 'locks', 'mapping', 'confirm_mapping'];
    const errors = Object.values(f.errors ?? {});
    let body: TemplateResult = html``;
    let canNext = !this.busy;
    if (step === 'user' || step === 'reconfigure') {
      const bad = connectionErrors(connectionInput(this.form, step), step);
      canNext = canNext && bad.length === 0;
      body = html`<div class="grid2">
          ${this.field('name')}${this.field('host')}${this.field('username')}${this.field('password', 'password', step === 'reconfigure' ? L.passwordKeep : '')}
          <label class="f"><span>${L.fields.scheme}</span>
            <select .value=${String(this.form.scheme)} ?disabled=${this.busy} data-flow-field="scheme" @change=${(e: Event) => (this.form = { ...this.form, scheme: (e.target as HTMLSelectElement).value })}>
              ${(f.choices.scheme ?? ['http', 'https']).map((o) => html`<option value=${String(o)} ?selected=${String(o) === this.form.scheme}>${o}</option>`)}
            </select></label>
          ${this.field('port', 'number')}${this.field('rtsp_port', 'number')}
        </div>
        <label class="opt"><input type="checkbox" .checked=${this.form.verify_ssl === true} ?disabled=${this.busy} data-flow-field="verify_ssl"
          @change=${(e: Event) => (this.form = { ...this.form, verify_ssl: (e.target as HTMLInputElement).checked })} /><span>${L.fields.verify_ssl}</span></label>`;
    } else if (step === 'confirm_device') {
      body = html`<div class="hint">${L.device}</div>
        <div class="check"><span>${L.model}</span><span class="val" dir="ltr">${f.device?.model ?? T.none}</span></div>
        <div class="check"><span>${L.firmware}</span><span class="val" dir="ltr">${f.device?.firmware ?? T.none}</span></div>
        <div class="check"><span>${L.serial}</span><span class="val" dir="ltr">${f.device?.serial ?? T.none}</span></div>`;
    } else if (step === 'locks') {
      body = html`<div class="radios" role="radiogroup" aria-label=${L.fields.mode}>
          ${(f.choices.mode ?? ['camera_only']).map(
            (m) => html`<label class="opt"><input type="radio" name="mode" .checked=${this.form.mode === m} ?disabled=${this.busy} data-flow-mode=${String(m)}
              @change=${() => (this.form = { ...this.form, mode: String(m) })} /><span>${L.modes[String(m)] ?? m}</span></label>`,
          )}
        </div>
        ${this.form.mode !== 'camera_only' ? this.field('lock_name') : nothing}`;
    } else if (step === 'mapping') {
      body = html`<div class="msg warn" role="status">${L.pulseWarn}</div>
        <label class="f"><span>${L.fields.api_id}</span>
          <select .value=${String(this.form.api_id)} ?disabled=${this.busy} data-flow-field="api_id" @change=${(e: Event) => (this.form = { ...this.form, api_id: (e.target as HTMLSelectElement).value })}>
            ${(f.choices.api_id ?? []).map((o) => html`<option value=${String(o)} ?selected=${String(o) === this.form.api_id}>${o}</option>`)}
          </select></label>`;
    } else if (step === 'confirm_mapping') {
      body = html`<div class="radios" role="radiogroup" aria-label=${L.fields.result}>
        ${(f.choices.result ?? []).map(
          (m) => html`<label class="opt"><input type="radio" name="result" .checked=${this.form.result === m} ?disabled=${this.busy} data-flow-result=${String(m)}
            @change=${() => (this.form = { ...this.form, result: String(m) })} /><span>${L.results[String(m)] ?? m}</span></label>`,
        )}
      </div>`;
    }
    const nextLabel = step === 'confirm_device' ? L.deviceConfirm : step === 'mapping' ? L.pulseButton : L.next;
    return html`<sw-card heading=${L.wizardTitle[f.kind]} data-wizard=${step}>
      <div class="wizard-steps" aria-label=${L.wizardTitle[f.kind]}>
        ${order.map((s, i) => html`<span aria-current=${s === step ? 'step' : 'false'}>${i + 1}. ${L.steps[s]}</span>`)}
      </div>
      ${errors.length ? html`<div class="msg err" role="alert" data-flow-error>${errors.map((e) => L.flowErrors[e] ?? L.flowErrors.other).join(' · ')}</div>` : nothing}
      ${body}
      ${this.busy ? html`<div class="hint" role="status" data-flow-busy>${L.checking}</div>` : nothing}
      ${this.stepError ? this.outcomeLine(this.stepError) : nothing}
      <div class="foot">
        <sw-button variant=${step === 'mapping' ? 'danger' : 'primary'} ?disabled=${!canNext} @click=${() => void this.next()} data-flow-next>${nextLabel}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${() => void this.cancelFlow()} data-flow-cancel>${L.cancel}</sw-button>
      </div>
    </sw-card>`;
  }

  private outcomeLine(o: WriteOutcome): TemplateResult {
    const text = o.status === 'refused' ? fill(T.result.refused, { code: o.code ?? '' }) : o.status === 'not_sent' ? fill(T.result.not_sent, { message: o.message }) : T.result.unknown;
    return html`<div class="msg ${o.status === 'unknown' ? 'warn' : 'err'}" role="alert" data-outcome=${o.status}>${text}</div>`;
  }

  // ---------------------------------------------------------------- removal / replacement

  private async review(): Promise<void> {
    this.reviewing = true;
    this.reviewError = '';
    this.impact = null;
    try {
      this.impact = (await reviewLifecycle(this.source, this.target)).review;
    } catch (err) {
      this.reviewError = err instanceof ApiError ? err.body.user_message : String(err);
    } finally {
      this.reviewing = false;
    }
  }

  private name(id: string | null | undefined): string {
    return this.stations.find((s) => s.id === id)?.name ?? id ?? '';
  }

  private askPrepare(): void {
    const name = this.name(this.source);
    this.confirm = {
      heading: fill(L.prepareHeading, { name }),
      body: L.prepareBody,
      maxSeconds: 55,
      send: () => prepareLifecycle(this.source, this.target || undefined),
      done: () => {
        this.impact = null;
        void this.loadJobs();
      },
    };
  }

  private askJob(job: LifecycleJob): void {
    const action = nextAction(job);
    if (!action) return;
    const name = job.source_name ?? job.source_id ?? '';
    const heading = { apply: L.applyHeading, verify: L.verifyHeading, remove: L.removeHeading }[action];
    const body = { apply: fill(L.applyBody, { n: job.affected_people ?? 0 }), verify: L.verifyBody, remove: L.removeBody }[action];
    this.confirm = {
      heading: fill(heading, { name }),
      body,
      typed: action === 'verify' ? undefined : name,
      danger: action !== 'verify',
      maxSeconds: 55,
      send: (t) => lifecycleAction(job, action, t),
      done: (reply) => {
        const state = (reply as { data: { job: LifecycleJob } }).data.job.state ?? 'unknown';
        this.flash = { tone: 'ok', text: fill(L.doneJob, { state: L.states[state] ?? state }) };
        void this.loadJobs();
      },
    };
  }

  private impactView(i: LifecycleImpact): TemplateResult {
    const num = (label: string, v: number | null) => html`<div class="num"><span class="muted">${label}</span><b>${v ?? T.none}</b></div>`;
    return html`<div data-impact>
      <div class="nums">${num(L.people, i.affected_people)}${num(L.bindings, i.known_bindings)}${num(L.unknownOwners, i.unknown_owners)}${num(L.holdPrograms, i.hold_programs)}${num(L.nativeSchedules, i.native_schedules)}</div>
      ${i.blockers.length
        ? html`<div class="msg err" role="alert" data-blockers>${L.blockers}: ${i.blockers.map((b) => L.blockerText[b] ?? L.blockerText.other).join(' · ')}</div>`
        : html`<div class="msg ok" role="status">${L.noBlockers}</div>`}
      <div class="foot"><sw-button variant="primary" ?disabled=${i.blockers.length > 0} @click=${() => this.askPrepare()} data-prepare>${L.prepare}</sw-button></div>
    </div>`;
  }

  private jobRow(job: LifecycleJob): TemplateResult {
    const p = jobProgress(job.state);
    const action = nextAction(job);
    return html`<div class="item" data-job=${job.id ?? ''} data-state=${job.state ?? ''}>
      <div class="grow">
        <b dir="auto">${job.source_name ?? job.source_id}${job.target_name ? html` ← <span dir="auto">${job.target_name}</span>` : nothing}</b>
        <div class="stepper" aria-hidden="true">${[0, 1, 2, 3].map((i) => html`<i ?data-on=${p >= i}></i>`)}</div>
        <div class="stepper-labels" aria-hidden="true">${L.stepLabels.map((l) => html`<span>${l}</span>`)}</div>
        <span class="muted">${L.states[job.state ?? 'unknown'] ?? job.state}${job.affected_people !== null ? ` · ${L.people}: ${job.affected_people}` : ''}</span>
        ${job.require_approval ? html`<span class="muted">${L.approval}</span>` : nothing}
      </div>
      ${action
        ? html`<sw-button size="sm" variant=${action === 'verify' ? 'secondary' : 'danger'} @click=${() => this.askJob(job)} data-job-action=${action}>${L.actions[action]}</sw-button>`
        : nothing}
    </div>`;
  }

  render(): TemplateResult {
    const stations = this.list?.stations ?? this.stations;
    return html`<div class="sections" data-lifecycle>
      ${this.flash ? html`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>` : nothing}
      ${this.flow
        ? this.wizard()
        : html`<sw-card heading=${L.addTitle} data-add>
              <div class="hint">${L.addHint}</div>
              ${this.stepError ? this.outcomeLine(this.stepError) : nothing}
              <div class="foot"><sw-button variant="primary" ?disabled=${this.busy} @click=${() => void this.begin('add')} data-add-start>${L.addStart}</sw-button></div>
            </sw-card>
            <sw-card heading=${L.reTitle} data-reconfigure>
              <div class="hint">${L.reHint}</div>
              <div class="pickrow">
                <label class="f"><span>${L.station}</span>
                  <select class="pick" @change=${(e: Event) => (this.reStation = (e.target as HTMLSelectElement).value)} data-re-pick>
                    <option value="" ?selected=${!this.reStation}>—</option>
                    ${stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.reStation}>${s.name}</option>`)}
                  </select></label>
                <sw-button variant="secondary" ?disabled=${!this.reStation || this.busy} @click=${() => void this.begin('reconfigure')} data-re-start>${L.reStart}</sw-button>
              </div>
            </sw-card>`}
      <sw-card heading=${L.removeTitle} data-remove>
        <div class="hint">${L.removeHint}</div>
        <div class="pickrow">
          <label class="f"><span>${L.source}</span>
            <select class="pick" @change=${(e: Event) => ((this.source = (e.target as HTMLSelectElement).value), (this.impact = null))} data-source-pick>
              <option value="" ?selected=${!this.source}>—</option>
              ${stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.source}>${s.name}</option>`)}
            </select></label>
          <label class="f"><span>${L.target}</span>
            <select class="pick" @change=${(e: Event) => ((this.target = (e.target as HTMLSelectElement).value), (this.impact = null))} data-target-pick>
              <option value="" ?selected=${!this.target}>${L.noTarget}</option>
              ${stations.filter((s) => s.id !== this.source).map((s) => html`<option value=${s.id} ?selected=${s.id === this.target}>${s.name}</option>`)}
            </select></label>
          <sw-button variant="secondary" ?disabled=${!this.source || this.reviewing} @click=${() => void this.review()} data-review>${L.review}</sw-button>
        </div>
        ${this.reviewing ? html`<sw-state-panel state="loading" heading=${T.loading} compact></sw-state-panel>` : nothing}
        ${this.reviewError ? html`<div class="msg err" role="alert" data-review-error>${this.reviewError}</div>` : nothing}
        ${this.impact ? this.impactView(this.impact) : nothing}
      </sw-card>
      <sw-card heading=${L.jobs} data-jobs>
        ${this.listError ? html`<div class="msg err" role="alert">${this.listError}</div>` : nothing}
        ${this.list && this.list.records.length === 0 ? html`<div class="hint">${L.noJobs}</div>` : nothing}
        ${this.list && this.list.records.length ? html`<div class="list">${this.list.records.map((j) => this.jobRow(j))}</div>` : nothing}
        <div class="foot"><sw-button variant="ghost" size="sm" @click=${() => void this.loadJobs()} data-jobs-refresh>${L.refresh}</sw-button></div>
      </sw-card>
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${() => (this.confirm = null)}></wk-installer-confirm>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'installer-lifecycle': InstallerLifecycle;
  }
}
