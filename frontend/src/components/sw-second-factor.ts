import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import qrcode from 'qrcode-generator';
import './sw-button';
import { describeError } from '../api/client';
import { confirmEnrolment, disableSecondFactor, factorUsers, resetFactor, secondFactorStatus, startEnrolment, type Enrolment, type SecondFactorStatus } from '../api/second-factor';
import { t } from '../i18n/he';

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
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('he-IL');
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
  input:focus-visible {
    outline: 2px solid var(--sw-focus);
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
`;

/**
 * החשבון שלי › אימות דו־שלבי (K11): the user's own optional TOTP factor. Off by default; "הפעלה" shows a QR code (and the
 * key to type) for any standard authenticator app, the first code from the app turns it on, "כיבוי" needs a current code.
 * Applies to the remote sign-in only. Mounted while its section of the user menu is open.
 */
@customElement('sw-second-factor')
export class SwSecondFactor extends LitElement {
  @state() private status: SecondFactorStatus | null = null;
  @state() private enrolment: Enrolment | null = null;
  @state() private disabling = false;
  @state() private code = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private message = '';

  static styles = SHARED;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.status = await secondFactorStatus();
    } catch (err) {
      this.error = describeError(err);
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
    this.code = '';
    this.error = '';
  }

  private submit(e: Event) {
    e.preventDefault();
    const code = this.code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) return;
    void this.run(async () => {
      if (this.disabling) {
        this.status = await disableSecondFactor(code);
        this.message = t('secondFactor.disabledDone');
      } else {
        this.status = await confirmEnrolment(code);
        this.message = t('secondFactor.enabledDone');
      }
      this.enrolment = null;
      this.disabling = false;
      this.code = '';
    });
  }

  private codeForm() {
    return html`<form @submit=${this.submit} data-sf-form>
      <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" aria-label=${t('secondFactor.codeLabel')} data-sf-code .value=${this.code}
        @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} ?disabled=${this.busy} />
      <sw-button size="sm" variant="primary" data-sf-confirm @click=${(e: Event) => this.submit(e)} ?disabled=${this.busy || !/^\d{6}$/.test(this.code.replace(/\s+/g, ''))}>${t('secondFactor.confirm')}</sw-button>
      <sw-button size="sm" variant="ghost" data-sf-cancel ?disabled=${this.busy} @click=${() => this.cancel()}>${t('secondFactor.cancel')}</sw-button>
    </form>`;
  }

  render() {
    const s = this.status;
    if (!s) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    return html`
      <div class="row">
        <span class="state" data-sf-state>${s.enabled ? t('secondFactor.on') : t('secondFactor.off')}${s.enabled && s.enabled_at ? html` <small>${t('secondFactor.since')} ${when(s.enabled_at)}</small>` : nothing}</span>
        ${this.enrolment || this.disabling
          ? nothing
          : s.enabled
          ? html`<sw-button size="sm" variant="secondary" data-sf-disable @click=${() => { this.disabling = true; this.message = ''; }}>${t('secondFactor.disable')}</sw-button>`
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

  static styles = SHARED;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('userId')) {
      this.since = undefined;
      this.armed = false;
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

  private async reset() {
    this.busy = true;
    this.error = '';
    try {
      await resetFactor(this.userId);
      this.since = null;
      this.armed = false;
      this.message = t('secondFactor.adminResetDone');
    } catch (err) {
      this.error = describeError(err);
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
          ? html`<span><sw-button size="sm" variant="danger" data-sf-admin-confirm ?disabled=${this.busy} @click=${() => void this.reset()}>${t('secondFactor.adminReset')}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.armed = false)}>${t('secondFactor.cancel')}</sw-button></span>`
          : html`<sw-button size="sm" variant="secondary" data-sf-admin-reset @click=${() => (this.armed = true)}>${t('secondFactor.adminReset')}</sw-button>`}
      </div>
      ${this.armed ? html`<div class="lbl">${t('secondFactor.adminResetConfirm')}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-second-factor': SwSecondFactor;
    'sw-second-factor-user': SwSecondFactorUser;
  }
}
