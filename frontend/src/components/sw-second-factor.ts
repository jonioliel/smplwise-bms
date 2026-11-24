import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import qrcode from 'qrcode-generator';
import './sw-button';
import { describeError } from '../api/client';
import { confirmEnrolment, disableSecondFactor, factorOverrides, factorResetCheck, factorUsers, isRecoveryCode, recoveryStatus, regenerateRecoveryCodes, resetFactor, secondFactorStatus, setFactorOverride, startEnrolment, type Enrolment, type FactorOverride, type FactorOverrides, type FactorResetCheck, type RecoveryStatus, type SecondFactorStatus } from '../api/second-factor';
import { refused, renderResetConfirm, resetConfirmStyles, resetErrorText, typedMatches } from './factor-reset-confirm';
import { t, tf } from '../i18n/he';
import { dayText } from '../api/day-format';

/** The otpauth link as an inline SVG QR code (one path, no data: URL, so the strict remote CSP is untouched). */
export function qrSvg(text: string, px = 168) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 3;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const size = n + quiet * 2;
  return svg`<svg viewBox="0 0 ${size} ${size}" width=${px} height=${px} role="img" aria-label=${t('secondFactor.qrLabel')} shape-rendering="crispEdges" data-sf-qr>
    <rect width=${size} height=${size} fill="#fff"></rect><path d=${d} fill="#000"></path></svg>`;
}

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return dayText(d);
}

const SHARED = css`
  :host {
    display: block;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-block-size: 44px;
  }
  .state {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
  }
  .state small {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 8px 0 4px;
  }
  .qr {
    background: #fff;
    border-radius: var(--sw-r-md);
    padding: 4px;
    line-height: 0;
  }
  .key {
    direction: ltr;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
    letter-spacing: 0.08em;
    word-break: break-all;
    text-align: center;
    user-select: all;
    color: var(--sw-text);
  }
  .lbl {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    text-align: center;
  }
  form {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }
  input {
    inline-size: 9.5em;
    min-block-size: 36px;
    padding: 4px 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-lg);
    letter-spacing: 0.25em;
    text-align: center;
    direction: ltr;
  }
  select {
    min-block-size: 36px;
    padding: 4px 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  input:focus-visible,
  select:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  .err {
    margin: 4px 0 0;
    font-size: var(--sw-fs-xs);
    color: var(--sw-danger);
  }
  .ok {
    margin: 4px 0 0;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  /* MFA-RECOVERY-CODES-2490: the recovery-codes row, the warning and the one-time list (the card's own tokens, no new look) */
  .rc {
    margin-block-start: var(--sw-s-2);
    padding-block-start: var(--sw-s-1);
  }
  .warn {
    margin: 0 0 var(--sw-s-1);
    font-size: var(--sw-fs-xs);
    color: var(--sw-warning-text);
  }
  .codes {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: var(--sw-s-1h) var(--sw-s-5);
    justify-content: center;
    margin: var(--sw-s-1) 0 0;
    padding: var(--sw-s-3) var(--sw-s-3h);
    list-style: none;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    direction: ltr;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
    letter-spacing: 0.08em;
    color: var(--sw-text);
    user-select: all;
  }
  .acts {
    display: flex;
    gap: var(--sw-s-2);
    justify-content: center;
    flex-wrap: wrap;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    font-size: var(--sw-fs-xs);
    color: var(--sw-accent-text);
    text-decoration: underline;
    cursor: pointer;
  }
  .link:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
`;

/** A typed code is ready to send: six digits from the app, or (where allowed) a recovery code. */
function codeReady(raw: string, recovery: boolean): boolean {
  const code = raw.replace(/\s+/g, '');
  return recovery ? isRecoveryCode(raw) : /^\d{6}$/.test(code);
}

/** The recovery codes as a plain text file (UTF-8, CRLF so every desktop editor shows one code per line). */
function downloadCodes(codes: string[]) {
  const text = [t('secondFactor.recoveryFileTitle'), t('secondFactor.recoveryFileNote'), '', ...codes, ''].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'arx-recovery-codes.txt';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * החשבון שלי › אימות דו־שלבי (K11): the user's own optional TOTP factor. Off by default; "הפעלה" shows a QR code (and the
 * key to type) for any standard authenticator app, the first code from the app turns it on, "כיבוי" needs a current code.
 * Applies to the remote sign-in only. Mounted while its section of the user menu is open.
 */
@customElement('sw-second-factor')
export class SwSecondFactor extends LitElement {
  /** The own status (confirm / disable answer without the installation policy, which this card does not show). */
  @state() private status: Pick<SecondFactorStatus, 'enabled' | 'enabled_at' | 'last_used_at'> | null = null; // RELEASE-2510-TRAIN: the answers of disable / confirm carry no must_enroll
  @state() private enrolment: Enrolment | null = null;
  @state() private disabling = false;
  @state() private code = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private message = '';
  /** MFA-RECOVERY-CODES-2490: the remaining-codes count (null: not loaded / an older server). */
  @state() private recovery: RecoveryStatus | null = null;
  /** A batch just made (enrolment or "new codes"): shown ONCE, until "I saved the codes"; never stored anywhere. */
  @state() private freshCodes: string[] = [];
  /** The "new codes" step (asks the current authenticator code). */
  @state() private regenerating = false;
  /** Removing the factor with a recovery code instead of the app's code (the lost-phone path). */
  @state() private useRecovery = false;

  static styles = SHARED;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.freshCodes = []; // a closed section forgets the codes it showed
  }

  private async load() {
    try {
      this.status = await secondFactorStatus();
    } catch (err) {
      this.error = describeError(err);
    }
    await this.loadRecovery();
  }

  private async loadRecovery() {
    try {
      this.recovery = this.status?.enabled ? await recoveryStatus() : null;
    } catch {
      this.recovery = null;
    }
  }

  private async run(fn: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      await fn();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private start() {
    this.message = '';
    void this.run(async () => {
      this.enrolment = await startEnrolment();
      this.code = '';
    });
  }

  private cancel() {
    this.enrolment = null;
    this.disabling = false;
    this.regenerating = false;
    this.useRecovery = false;
    this.code = '';
    this.error = '';
  }

  private submit(e: Event) {
    e.preventDefault();
    const recovery = this.disabling && this.useRecovery;
    if (!codeReady(this.code, recovery)) return;
    const code = recovery ? this.code.trim() : this.code.replace(/\s+/g, '');
    void this.run(async () => {
      if (this.regenerating) {
        const r = await regenerateRecoveryCodes(code);
        this.freshCodes = r.codes;
        this.recovery = { available: true, remaining: r.remaining, total: r.total, created_at: r.created_at, last_used_at: r.last_used_at, low: r.low, low_at: r.low_at };
        this.regenerating = false;
      } else if (this.disabling) {
        this.status = await disableSecondFactor(code);
        this.message = t('secondFactor.disabledDone');
        this.freshCodes = [];
        this.recovery = null;
      } else {
        const r = await confirmEnrolment(code);
        this.status = { enabled: r.enabled, enabled_at: r.enabled_at, last_used_at: r.last_used_at };
        this.message = t('secondFactor.enabledDone');
        this.freshCodes = r.recovery_codes ?? [];
        await this.loadRecovery();
      }
      this.enrolment = null;
      this.disabling = false;
      this.useRecovery = false;
      this.code = '';
    });
  }

  private async copyCodes() {
    try {
      await navigator.clipboard.writeText(this.freshCodes.join('\n'));
      this.message = t('secondFactor.recoveryCopied');
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private codeForm() {
    const recovery = this.disabling && this.useRecovery;
    return html`<form @submit=${this.submit} data-sf-form>
      <input name="code" inputmode=${recovery ? 'text' : 'numeric'} autocomplete="one-time-code" maxlength=${recovery ? 11 : 7}
        autocapitalize=${recovery ? 'characters' : 'off'} spellcheck="false" placeholder=${recovery ? 'XXXX-XXXX' : ''}
        aria-label=${recovery ? t('secondFactor.recoveryCodeLabel') : t('secondFactor.codeLabel')} data-sf-code .value=${this.code}
        @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} ?disabled=${this.busy} />
      <sw-button size="sm" variant="primary" data-sf-confirm @click=${(e: Event) => this.submit(e)} ?disabled=${this.busy || !codeReady(this.code, recovery)}>${this.regenerating ? t('secondFactor.recoveryCreate') : t('secondFactor.confirm')}</sw-button>
      <sw-button size="sm" variant="ghost" data-sf-cancel ?disabled=${this.busy} @click=${() => this.cancel()}>${t('secondFactor.cancel')}</sw-button>
    </form>
    ${this.disabling
      ? html`<div class="acts"><button type="button" class="link" data-sf-use-recovery ?disabled=${this.busy}
          @click=${() => { this.useRecovery = !this.useRecovery; this.code = ''; this.error = ''; }}>${this.useRecovery ? t('secondFactor.recoveryUseApp') : t('secondFactor.recoveryUse')}</button></div>`
      : nothing}`;
  }

  /** MFA-RECOVERY-CODES-2490: the count, the low / empty warning, "new codes", and a batch just made (shown once). */
  private recoveryPart() {
    const r = this.recovery;
    const s = this.status;
    if (this.freshCodes.length) {
      return html`<div class="box rc" data-sf-recovery-fresh>
        <div class="lbl" data-sf-recovery-once>${t('secondFactor.recoveryShownOnce')}</div>
        <ul class="codes" aria-label=${t('secondFactor.recoveryListLabel')} data-sf-recovery-codes>${this.freshCodes.map((c) => html`<li>${c}</li>`)}</ul>
        <div class="acts">
          <sw-button size="sm" variant="secondary" icon="copy" data-sf-recovery-copy @click=${() => void this.copyCodes()}>${t('secondFactor.recoveryCopy')}</sw-button>
          <sw-button size="sm" variant="secondary" icon="download" data-sf-recovery-download @click=${() => downloadCodes(this.freshCodes)}>${t('secondFactor.recoveryDownload')}</sw-button>
          <sw-button size="sm" variant="primary" data-sf-recovery-saved @click=${() => { this.freshCodes = []; this.message = ''; }}>${t('secondFactor.recoverySaved')}</sw-button>
        </div>
      </div>`;
    }
    if (!s?.enabled || !r || this.enrolment || this.disabling) return nothing;
    const empty = r.remaining === 0;
    return html`<div class="rc" data-sf-recovery>
      <div class="row">
        <span class="state">${t('secondFactor.recoveryTitle')} <small data-sf-recovery-count>${empty ? t('secondFactor.recoveryNone') : tf('secondFactor.recoveryRemaining', { n: r.remaining, total: r.total })}</small></span>
        ${this.regenerating
          ? nothing
          : html`<sw-button size="sm" variant=${r.low || empty ? 'primary' : 'secondary'} data-sf-recovery-new @click=${() => { this.regenerating = true; this.code = ''; this.message = ''; this.error = ''; }}>${t('secondFactor.recoveryNew')}</sw-button>`}
      </div>
      ${r.low || empty ? html`<div class="warn" role="status" data-sf-recovery-low>${empty ? t('secondFactor.recoveryEmpty') : t('secondFactor.recoveryLow')}</div>` : nothing}
      ${this.regenerating ? html`<div class="box" data-sf-recovery-step><div class="lbl">${t('secondFactor.recoveryNewHint')}</div>${this.codeForm()}</div>` : nothing}
    </div>`;
  }

  render() {
    const s = this.status;
    if (!s) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    return html`
      <div class="row">
        <span class="state" data-sf-state>${s.enabled ? t('secondFactor.on') : t('secondFactor.off')}${s.enabled && s.enabled_at ? html` <small>${t('secondFactor.since')} ${when(s.enabled_at)}</small>` : nothing}</span>
        ${this.enrolment || this.disabling || this.regenerating
          ? nothing
          : s.enabled
          ? html`<sw-button size="sm" variant="secondary" data-sf-disable @click=${() => { this.disabling = true; this.useRecovery = false; this.message = ''; }}>${t('secondFactor.disable')}</sw-button>`
          : html`<sw-button size="sm" variant="primary" data-sf-enable ?disabled=${this.busy} @click=${() => this.start()}>${t('secondFactor.enable')}</sw-button>`}
      </div>
      ${this.enrolment
        ? html`<div class="box" data-sf-enrolment>
            <div class="lbl">${t('secondFactor.scan')}</div>
            <div class="qr">${qrSvg(this.enrolment.otpauth_uri)}</div>
            <div class="lbl">${t('secondFactor.keyLabel')}</div>
            <div class="key" data-sf-key>${this.enrolment.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
            ${this.codeForm()}
          </div>`
        : this.disabling
        ? html`<div class="box" data-sf-disabling>${this.codeForm()}</div>`
        : nothing}
      ${this.recoveryPart()}
      ${this.error ? html`<div class="err" role="alert" data-sf-error>${this.error}</div>` : nothing}
      ${this.message ? html`<div class="ok" role="status" data-sf-message>${this.message}</div>` : nothing}
    `;
  }
}

/** משתמשים והרשאות › user drawer (system.configure): whether the user has the factor on, and the audited reset for a lost
 * authenticator. Shows nothing for a user without a factor. */
@customElement('sw-second-factor-user')
export class SwSecondFactorUser extends LitElement {
  @property() userId = '';
  @state() private since: string | null | undefined = undefined;
  @state() private busy = false;
  @state() private armed = false;
  @state() private error = '';
  @state() private message = '';
  /** The administrator's OWN factor is on: the reset needs their current code (security review 2.2.0 M1). */
  @state() private stepUp = false;
  @state() private ownCode = '';
  /** RELEASE-2510-TRAIN: the reset's preflight (undefined while read, null when unreadable) and the username the administrator typed. */
  @state() private check: FactorResetCheck | null | undefined = undefined;
  @state() private typed = '';

  static styles = [SHARED, resetConfirmStyles];

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('userId')) {
      this.since = undefined;
      this.armed = false;
      this.ownCode = '';
      this.typed = '';
      this.check = undefined;
      this.message = '';
      void this.load();
    }
  }

  private seq = 0;

  private async load() {
    const mine = ++this.seq;
    try {
      const r = await factorUsers();
      if (mine !== this.seq) return;
      const row = r.users.find((u) => u.user_id === this.userId);
      this.since = row ? row.enabled_at ?? '' : null;
    } catch {
      if (mine === this.seq) this.since = null;
    }
  }

  private async arm() {
    this.armed = true;
    this.error = '';
    this.ownCode = '';
    this.typed = '';
    this.check = undefined;
    const id = this.userId;
    const [own, check] = await Promise.allSettled([secondFactorStatus(), factorResetCheck(id)]);
    if (id !== this.userId) return;
    this.stepUp = own.status === 'fulfilled' && own.value.enabled;
    this.check = check.status === 'fulfilled' ? check.value : null;
  }

  private ready(): boolean {
    return !refused(this.check) && typedMatches(this.check, this.typed) && (!this.stepUp || /^\d{6}$/.test(this.ownCode));
  }

  private async reset() {
    if (!this.ready()) return;
    this.busy = true;
    this.error = '';
    try {
      await resetFactor(this.userId, this.typed, this.stepUp ? this.ownCode : undefined);
      this.since = null;
      this.armed = false;
      this.ownCode = '';
      this.typed = '';
      this.message = t('secondFactor.adminResetDone');
      this.dispatchEvent(new CustomEvent('factors-changed', { bubbles: true, composed: true })); // MFA-SCREENS-2510: the drawer's factor list reads again
    } catch (err) {
      this.error = resetErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (this.since === undefined) return nothing;
    if (this.since === null) return this.message ? html`<div class="ok" role="status" data-sf-message>${this.message}</div>` : html`<span class="state" data-sf-admin-state>${t('secondFactor.off')}</span>`;
    return html`<div class="row" data-sf-admin>
        <span class="state" data-sf-admin-state>${t('secondFactor.on')}${this.since ? html` <small>${t('secondFactor.since')} ${when(this.since)}</small>` : nothing}</span>
        ${this.armed
          ? html`<span>${refused(this.check) ? nothing : html`<sw-button size="sm" variant="danger" data-sf-admin-confirm ?disabled=${this.busy || !this.ready()} @click=${() => void this.reset()}>${t('secondFactor.adminReset')}</sw-button>`}
              <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.armed = false)}>${t('secondFactor.cancel')}</sw-button></span>`
          : html`<sw-button size="sm" variant="secondary" data-sf-admin-reset @click=${() => void this.arm()}>${t('secondFactor.adminReset')}</sw-button>`}
      </div>
      ${this.armed ? html`<div class="lbl">${t('secondFactor.adminResetConfirm')}</div>` : nothing}
      ${this.armed ? renderResetConfirm(this.check, this.typed, (v) => (this.typed = v), () => void this.reset()) : nothing}
      ${this.armed && this.stepUp && !refused(this.check)
        ? html`<form @submit=${(e: Event) => { e.preventDefault(); void this.reset(); }}>
            <input data-sf-admin-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label=${t('secondFactor.adminStepUp')}
              placeholder="000000" .value=${this.ownCode} @input=${(e: Event) => (this.ownCode = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))} />
          </form>
          <div class="lbl">${t('secondFactor.adminStepUp')}</div>`
        : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}`;
  }
}

/** TFA2: the per-user / per-role policy override (inherit / optional / required) on top of the global policy. One select; the
 * overrides are read once and shared by every instance on the screen (the role cards), refreshed from each save's answer.
 * Unreadable (no permission, old server) -> renders nothing. */
let overridesCache: Promise<FactorOverrides> | null = null;

@customElement('sw-second-factor-policy')
export class SwSecondFactorPolicy extends LitElement {
  @property() kind: 'user' | 'role' = 'user';
  @property() subjectId = '';
  @state() private value: FactorOverride | undefined = undefined;
  @state() private busy = false;
  @state() private error = '';

  static styles = SHARED;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('subjectId') || changed.has('kind')) {
      this.value = undefined;
      void this.load();
    }
  }

  private async load() {
    const kind = this.kind;
    const id = this.subjectId;
    try {
      overridesCache ??= factorOverrides();
      const o = await overridesCache;
      if (kind === this.kind && id === this.subjectId) this.value = o[kind][id] ?? 'inherit';
    } catch {
      overridesCache = null;
      this.value = undefined;
    }
  }

  private async change(e: Event) {
    const sel = e.target as HTMLSelectElement; // captured now: an event's target is cleared once it left the shadow tree
    const next = sel.value as FactorOverride;
    const before = this.value;
    this.busy = true;
    this.error = '';
    try {
      const r = await setFactorOverride(this.kind, this.subjectId, next);
      overridesCache = Promise.resolve(r);
      this.value = next;
    } catch (err) {
      this.error = describeError(err);
      this.value = before;
      sel.value = before ?? 'inherit';
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (this.value === undefined) return nothing;
    return html`<div class="row" data-sf-policy-row>
        <select data-sf-policy-select aria-label=${t('secondFactor.overrideLabel')} ?disabled=${this.busy} @change=${(e: Event) => void this.change(e)}>
          ${(['inherit', 'optional', 'required'] as const).map((v) => html`<option value=${v} ?selected=${this.value === v}>${t(v === 'inherit' ? 'secondFactor.overrideInherit' : v === 'optional' ? 'secondFactor.overrideOptional' : 'secondFactor.overrideRequired')}</option>`)}
        </select>
      </div>
      ${this.error ? html`<div class="err" role="alert" data-sf-policy-error>${this.error}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-second-factor': SwSecondFactor;
    'sw-second-factor-user': SwSecondFactorUser;
    'sw-second-factor-policy': SwSecondFactorPolicy;
  }
}
