import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-sheet';
import { ApiError, describeError } from '../api/client';
import {
  getIncident, prepareRelease, prepareStart, releaseIncident, startIncident,
  type EmergencyKind, type EmergencyState, type Incident, type Prepared, type Scope,
} from '../api/door-windows';
import { dwt, dwtDynamic } from '../i18n/door-windows';
import { AUTO_CLOSE_MS, RESULT_TONE, holdProgress, incidentLines, nextStep, type SheetStep } from './logic';
import { dwCss } from './styles';
import { timeText } from '../api/day-format';

/**
 * CR-039 8 / DOORWIN-295: the emergency door controls.
 * - `door-hold-button`: press and HOLD (1.5 s by default, the server's `hold_ms`) - pointer or keyboard (Enter / Space held); moving off
 *   the button or letting go early cancels. `prefers-reduced-motion` keeps the ring static but the hold time stays (CR-039 8.1 (5)).
 * - `door-emergency-sheet`: opened only from the screen header (never one tap from a list row). Two large buttons, the scope the binding
 *   allows, a drill switch (forced while the real buttons are off). Hold -> the server's `prepare` (step one) -> one line with the count
 *   and the scope and one confirm button -> `start` with the single-use token (step two) -> the per-door result list, failures first.
 *   It closes itself after 20 s without a decision.
 * - `door-emergency-strip`: the red strip on the door screens while an incident is in effect, with the release (hold, then confirm) for
 *   the holders of the same permission. The only place that releases.
 * No platform or vendor name, no claim of a physical door state: the words are the engine's acknowledgement.
 */
@customElement('door-hold-button')
export class DoorHoldButton extends LitElement {
  static styles = [dwCss, css`
    :host { display: block; }
    button {
      position: relative; inline-size: 100%; min-block-size: 96px; display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center;
      text-align: start; padding: 16px; border-radius: var(--sw-r-lg); cursor: pointer; font: inherit; overflow: hidden;
      border: 2px solid var(--sw-danger); background: var(--sw-surface); color: var(--sw-danger-text); touch-action: none; user-select: none;
      -webkit-user-select: none;
    }
    :host([fill]) button { background: var(--sw-danger); color: var(--sw-text-inverse); }
    button:focus-visible { outline: 3px solid var(--sw-focus); outline-offset: 2px; }
    button[disabled] { opacity: .5; cursor: not-allowed; }
    .ring { inline-size: 52px; block-size: 52px; border-radius: 50%; display: grid; place-items: center;
      background: conic-gradient(currentColor calc(var(--p, 0) * 360deg), color-mix(in srgb, currentColor 18%, transparent) 0); }
    .ring > span { inline-size: 40px; block-size: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-surface); color: var(--sw-danger); }
    :host([fill]) .ring > span { background: var(--sw-danger); color: var(--sw-text-inverse); }
    .t { display: grid; gap: 4px; min-inline-size: 0; }
    .t b { font-size: var(--sw-fs-lg); }
    .t small { font-size: var(--sw-fs-sm); opacity: .9; }
    .t em { font-style: normal; font-size: var(--sw-fs-xs); opacity: .85; }
  `];

  @property() label = '';
  @property() sub = '';
  @property() icon: 'lock' | 'unlock' = 'lock';
  @property({ type: Number }) holdMs = 1500;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean, reflect: true }) fill = false;
  @state() private started: number | null = null;
  @state() private p = 0;
  private raf = 0;

  disconnectedCallback(): void {
    this.cancel();
    super.disconnectedCallback();
  }

  private begin(): void {
    if (this.disabled || this.started !== null) return;
    this.started = performance.now();
    const step = () => {
      this.p = holdProgress(this.started, performance.now(), this.holdMs);
      if (this.p >= 1) {
        this.cancel();
        this.dispatchEvent(new CustomEvent('held', { bubbles: true, composed: true }));
        return;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private cancel(): void {
    cancelAnimationFrame(this.raf);
    this.started = null;
    this.p = 0;
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (down && !e.repeat) this.begin();
    if (!down) this.cancel();
  }

  render() {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = reduce && this.started !== null ? 0.5 : this.p;
    return html`<button ?disabled=${this.disabled} style=${`--p:${p}`} aria-label=${`${this.label} - ${dwt('emHold', { s: (this.holdMs / 1000).toLocaleString() })}`}
        @pointerdown=${(e: PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); this.begin(); }}
        @pointerup=${() => this.cancel()} @pointercancel=${() => this.cancel()} @pointerleave=${() => this.cancel()}
        @keydown=${(e: KeyboardEvent) => this.key(e, true)} @keyup=${(e: KeyboardEvent) => this.key(e, false)} @contextmenu=${(e: Event) => e.preventDefault()}>
      <span class="ring"><span><sw-icon name=${this.icon}></sw-icon></span></span>
      <span class="t"><b>${this.label}</b>${this.sub ? html`<small>${this.sub}</small>` : nothing}
        <em>${this.started !== null ? dwt('emHolding') : dwt('emHold', { s: (this.holdMs / 1000).toLocaleString() })}</em></span>
    </button>`;
  }
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'rate_limited') return dwt('emRateLimited');
    if (err.code === 'incident_active') return dwt('emActiveFirst');
    if (err.code === 'confirmation_expired') return dwt('emExpired');
  }
  return describeError(err);
}

@customElement('door-emergency-sheet')
export class DoorEmergencySheet extends LitElement {
  static styles = [dwCss, css`
    .em { display: grid; gap: 14px; }
    .row { display: grid; gap: 6px; }
    .row label { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    select, input[type='text'] { font: inherit; padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); }
    .drill { display: flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); }
    .confirm { display: grid; gap: 12px; padding: 14px; border-radius: var(--sw-r-lg); background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .confirm b { font-size: var(--sw-fs-lg); }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .head { font-size: var(--sw-fs-xl); font-weight: 700; }
    .note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  `];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) data: EmergencyState | null = null;
  @state() private step: SheetStep = 'choose';
  @state() private drill = true;
  @state() private scopeKey = 'installation:*';
  @state() private prepared: Prepared | null = null;
  @state() private incident: Incident | null = null;
  @state() private error = '';
  @state() private left = 0;
  @state() private reason = '';
  private idle = 0;
  private tick = 0;
  private poll = 0;

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open) {
      this.step = 'choose';
      this.prepared = null;
      this.incident = null;
      this.error = '';
      this.reason = '';
      this.drill = !this.data?.enabled;
      const scopes = this.scopes('lock_secure').length ? this.scopes('lock_secure') : this.scopes('open');
      this.scopeKey = scopes[0] ? `${scopes[0].scope_type}:${scopes[0].scope_id}` : 'installation:*';
      this.armIdle();
    }
    if (changed.has('open') && !this.open) this.stopTimers();
  }

  disconnectedCallback(): void {
    this.stopTimers();
    super.disconnectedCallback();
  }

  private stopTimers(): void {
    clearTimeout(this.idle);
    clearInterval(this.tick);
    clearInterval(this.poll);
  }

  /** CR-039 8.1 (4): the sheet closes itself after 20 s without a decision (never while sending). */
  private armIdle(): void {
    clearTimeout(this.idle);
    this.idle = window.setTimeout(() => {
      if (this.step === 'choose' || this.step === 'confirm') this.close();
    }, AUTO_CLOSE_MS);
  }

  private close(): void {
    this.step = nextStep(this.step, 'cancel');
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private scopes(kind: EmergencyKind): Scope[] {
    return this.data?.scopes?.[kind] ?? [];
  }

  private scope(kind: EmergencyKind): Scope | undefined {
    return this.scopes(kind).find((s) => `${s.scope_type}:${s.scope_id}` === this.scopeKey) ?? this.scopes(kind)[0];
  }

  private async held(kind: EmergencyKind): Promise<void> {
    const sc = this.scope(kind);
    if (!sc) return;
    this.error = '';
    try {
      this.prepared = await prepareStart(kind, { scope_type: sc.scope_type, scope_id: sc.scope_id }, this.drill || !this.data?.enabled);
      this.step = nextStep(this.step, 'held');
      this.armIdle();
      clearInterval(this.tick);
      const until = Date.parse(this.prepared.expires_at);
      this.left = Math.max(0, Math.round((until - Date.now()) / 1000));
      this.tick = window.setInterval(() => {
        this.left = Math.max(0, Math.round((until - Date.now()) / 1000));
        if (this.left <= 0 && this.step === 'confirm') {
          clearInterval(this.tick);
          this.step = 'choose';
          this.prepared = null;
          this.error = dwt('emExpired');
        }
      }, 500);
    } catch (err) {
      this.error = errorText(err);
      this.step = nextStep(this.step, 'failed');
    }
  }

  private async confirm(): Promise<void> {
    if (!this.prepared) return;
    this.step = nextStep(this.step, 'confirm');
    clearTimeout(this.idle);
    clearInterval(this.tick);
    try {
      const r = await startIncident(this.prepared.confirm_token, this.reason);
      this.incident = r.incident;
      this.step = nextStep(this.step, 'sent');
      this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
      this.follow();
    } catch (err) {
      this.error = errorText(err);
      this.step = nextStep(this.step, 'failed');
    } finally {
      this.prepared = null;
    }
  }

  /** While doors are still being sent, read the incident again (the server's lane works after the answer). */
  private follow(): void {
    clearInterval(this.poll);
    this.poll = window.setInterval(async () => {
      if (!this.incident || this.incident.state !== 'applying') {
        clearInterval(this.poll);
        return;
      }
      try {
        this.incident = (await getIncident(this.incident.id)).incident;
      } catch {
        /* the next poll tries again */
      }
    }, 1500);
  }

  private renderChoose() {
    const d = this.data;
    const forced = !d?.enabled;
    const lockScopes = this.scopes('lock_secure');
    const openScopes = this.scopes('open');
    const all = [...lockScopes, ...openScopes.filter((o) => !lockScopes.some((l) => l.scope_type === o.scope_type && l.scope_id === o.scope_id))];
    const lock = this.scope('lock_secure');
    const open = this.scope('open');
    const hold = d?.hold_ms ?? 1500;
    const openUsable = !!d?.can.open && (this.drill || forced || !!d?.open_enabled);
    return html`<div class="em" data-em-step="choose">
      ${forced ? html`<div class="callout" data-tone="warn"><sw-icon name="info"></sw-icon><span>${dwt('emOff')}</span></div>` : nothing}
      ${all.length > 1 ? html`<div class="row"><label for="scope">${dwt('emScope')}</label>
        <select id="scope" data-em-scope .value=${this.scopeKey} @change=${(e: Event) => { this.scopeKey = (e.target as HTMLSelectElement).value; this.armIdle(); }}>
          ${all.map((s) => html`<option value=${`${s.scope_type}:${s.scope_id}`} ?selected=${`${s.scope_type}:${s.scope_id}` === this.scopeKey}>${s.name} · ${dwt('emDoors', { n: s.doors })}</option>`)}
        </select></div>` : all.length === 1 ? html`<div class="note" data-em-scope-one>${all[0].name}</div>` : nothing}
      <label class="drill"><input type="checkbox" data-em-drill .checked=${this.drill || forced} ?disabled=${forced}
        @change=${(e: Event) => { this.drill = (e.target as HTMLInputElement).checked; this.armIdle(); }}>${forced ? dwt('emDrillForced') : dwt('emDrill')}</label>
      ${d?.can.lock && lock ? html`<door-hold-button data-em-kind="lock_secure" icon="lock" .holdMs=${hold} label=${dwt('emLock')}
          sub=${`${dwt('emDoors', { n: lock.doors })} · ${dwt('emLockSub')}`} @held=${() => this.held('lock_secure')}></door-hold-button>` : nothing}
      ${d?.can.open && open ? html`<door-hold-button fill data-em-kind="open" icon="unlock" .holdMs=${hold} ?disabled=${!openUsable} label=${dwt('emOpen')}
          sub=${openUsable ? `${dwt('emDoors', { n: open.doors })} · ${dwt('emOpenSub')}` : dwt('emOpenUnavailable')} @held=${() => this.held('open')}></door-hold-button>` : nothing}
      ${this.error ? html`<div class="callout" data-tone="err" data-em-error><sw-icon name="warning"></sw-icon><span>${this.error}</span></div>` : nothing}
    </div>`;
  }

  private renderConfirm() {
    const p = this.prepared!;
    const kind = p.kind === 'open' ? dwt('emOpen') : dwt('emLock');
    return html`<div class="em" data-em-step="confirm">
      <div class="confirm"><b>${dwt('emConfirmTitle')}</b><span data-em-confirm-text>${dwt('emConfirmText', { kind, n: p.doors, scope: p.scope_name })}</span>
        ${p.drill ? html`<span class="chip" data-tone="warn">${dwt('emDrillForced')}</span>` : nothing}
        <span class="note">${dwt('emExpires', { s: this.left })}</span></div>
      <div class="row"><label for="reason">${dwt('emReason')}</label>
        <input id="reason" type="text" maxlength="200" .value=${this.reason} @input=${(e: Event) => (this.reason = (e.target as HTMLInputElement).value)}></div>
      <div class="actions">
        <sw-button variant="danger" size="lg" data-em-confirm @click=${() => this.confirm()}>${dwt('emConfirmBtn')}</sw-button>
        <sw-button variant="ghost" data-em-cancel @click=${() => { this.step = 'choose'; this.prepared = null; this.armIdle(); }}>${dwt('cancel')}</sw-button>
      </div>
    </div>`;
  }

  private renderResult() {
    const inc = this.incident!;
    const lines = incidentLines(inc);
    const head = dwt(inc.drill ? 'emResultDrill' : 'emResult', { ok: inc.counts.ok, total: inc.counts.total });
    return html`<div class="em" data-em-step="result">
      <div class="head" data-em-headline>${head}</div>
      <ul class="lines">${lines.map((l) => html`<li data-em-door=${l.door}><span>${l.label}</span>
        <span class="chip" data-tone=${RESULT_TONE[l.state]}>${dwtDynamic(`dr_${l.state}`, 'dr_unknown')}</span>
        ${l.state === 'refused' || l.state === 'unknown' ? html`<small>${dwt('drNextCamera')}</small>` : nothing}</li>`)}</ul>
      <div class="actions"><sw-button variant="secondary" @click=${() => this.close()}>${dwt('close')}</sw-button></div>
    </div>`;
  }

  render() {
    if (!this.open) return nothing;
    let body;
    if (this.step === 'confirm' && this.prepared) body = this.renderConfirm();
    else if (this.step === 'sending') body = html`<div class="em" data-em-step="sending"><div class="head">${dwt('emSending')}</div></div>`;
    else if (this.step === 'result' && this.incident) body = this.renderResult();
    else body = this.renderChoose();
    return html`<sw-sheet open heading=${dwt('emTitle')} kind="sheet" ?locked=${this.step === 'sending'} @close=${() => this.close()}>${body}</sw-sheet>`;
  }
}

@customElement('door-emergency-strip')
export class DoorEmergencyStrip extends LitElement {
  static styles = [dwCss, css`
    :host { display: block; }
    .strip { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; border-radius: var(--sw-r-lg);
      background: var(--sw-danger); color: var(--sw-text-inverse); }
    .strip.drill { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .t { display: grid; gap: 2px; min-inline-size: 0; }
    .t b { font-size: var(--sw-fs-md); }
    .t small { font-size: var(--sw-fs-sm); opacity: .9; }
    .rel { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    door-hold-button { min-inline-size: 180px; }
    @media (max-width: 640px) { .strip { grid-template-columns: auto 1fr; } .rel { grid-column: 1 / -1; justify-content: stretch; } door-hold-button { inline-size: 100%; } }
  `];

  @property({ attribute: false }) incident: Incident | null = null;
  @property({ type: Number }) holdMs = 1500;
  @property() zone = 'Asia/Jerusalem';
  @state() private prepared: Prepared | null = null;
  @state() private error = '';
  @state() private busy = false;

  private async held(): Promise<void> {
    if (!this.incident) return;
    this.error = '';
    try {
      this.prepared = await prepareRelease(this.incident);
    } catch (err) {
      this.error = errorText(err);
    }
  }

  private async release(): Promise<void> {
    if (!this.incident || !this.prepared) return;
    this.busy = true;
    try {
      await releaseIncident(this.incident.id, this.prepared.confirm_token);
      this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
    } catch (err) {
      this.error = errorText(err);
    } finally {
      this.prepared = null;
      this.busy = false;
    }
  }

  render() {
    const inc = this.incident;
    if (!inc) return nothing;
    const since = timeText(new Date(inc.requested_at), { timeZone: this.zone });
    const text = inc.drill ? dwt('emStripDrill', { kind: inc.kind_label, scope: inc.scope_name }) : dwt('emStrip', { kind: inc.kind_label, scope: inc.scope_name, since });
    return html`<div class="strip ${inc.drill ? 'drill' : ''}" role="status" data-em-strip=${inc.kind}>
      <sw-icon name="warning"></sw-icon>
      <div class="t"><b>${text}</b><small>${dwt(inc.drill ? 'emResultDrill' : 'emResult', { ok: inc.counts.ok, total: inc.counts.total })}</small>
        ${this.error ? html`<small data-em-error>${this.error}</small>` : nothing}</div>
      ${inc.can_release !== false ? html`<div class="rel">
        ${this.prepared
          ? html`<sw-button variant="secondary" data-em-release-confirm ?disabled=${this.busy} @click=${() => this.release()}>${dwt('emRelease')}</sw-button>
                 <sw-button variant="ghost" @click=${() => (this.prepared = null)}>${dwt('cancel')}</sw-button>`
          : html`<door-hold-button data-em-release .holdMs=${this.holdMs} icon="unlock" label=${dwt('emReleaseHold')} @held=${() => this.held()}></door-hold-button>`}
      </div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'door-hold-button': DoorHoldButton;
    'door-emergency-sheet': DoorEmergencySheet;
    'door-emergency-strip': DoorEmergencyStrip;
  }
}
