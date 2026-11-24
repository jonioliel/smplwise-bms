import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-icon';
import './sw-second-factor';
import { factorResetCheck, resetFactor, secondFactorStatus, type FactorResetCheck } from '../api/second-factor';
import { refused, renderResetConfirm, resetConfirmStyles, resetErrorText, typedMatches } from './factor-reset-confirm';
import { userFactors, type UserFactors } from '../api/factor-screens';
import { t } from '../i18n/he';
import { tr } from '../i18n/msg/mfa';

const SIGN_IN_LABEL: Record<UserFactors['policy']['sign_in'], () => string> = {
  required: () => tr('חובה'),
  optional: () => tr('רשות'),
  exempt: () => tr('פטור'),
};
const SOURCE_LABEL: Record<string, () => string> = {
  user: () => tr('הגדרה אישית'),
  role: () => tr('לפי תפקיד'),
  global: () => tr('לפי המדיניות'),
  wall: () => tr('עמדת קיר'),
  service: () => tr('משתמש שירות'),
};

/**
 * MFA-SCREENS-2510: משתמשים והרשאות › a user's drawer › the factors section. Which factors the user has (the authenticator code, passkeys,
 * phone keys, recovery codes left, the home system's own MFA seen) and what the sign-in policy says for them, from
 * `GET /security/user-factors/{id}`. The administrator's reset is the existing route (`DELETE auth/second-factor/users/{id}`, which
 * removes EVERY factor kind): the authenticator row keeps its own element (sw-second-factor-user, with the administrator's own code when
 * they have one); a user with a passkey or a phone key but no authenticator code gets the same reset here. Read again after a reset.
 * Nothing renders when the route is not readable (an older server, no permission).
 */
@customElement('sw-user-factors')
export class SwUserFactors extends LitElement {
  @property() userId = '';
  @state() private data: UserFactors | null | undefined = undefined;
  @state() private armed = false;
  @state() private busy = false;
  @state() private stepUp = false;
  @state() private ownCode = '';
  /** RELEASE-2510-TRAIN: the reset's preflight (undefined while read, null when unreadable) and the username the administrator typed. */
  @state() private check: FactorResetCheck | null | undefined = undefined;
  @state() private typed = '';
  @state() private error = '';
  @state() private message = '';

  private onChanged = () => void this.load();

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('factors-changed', this.onChanged);
  }

  disconnectedCallback() {
    this.removeEventListener('factors-changed', this.onChanged);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('userId')) {
      this.data = undefined;
      this.armed = false;
      this.ownCode = '';
      this.typed = '';
      this.check = undefined;
      this.error = '';
      this.message = '';
      void this.load();
    }
  }

  private seq = 0;

  private async load() {
    const mine = ++this.seq;
    try {
      const d = await userFactors(this.userId);
      if (mine === this.seq) this.data = d;
    } catch {
      if (mine === this.seq) this.data = null;
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
      this.armed = false;
      this.ownCode = '';
      this.typed = '';
      this.message = t('secondFactor.adminResetDone');
      await this.load();
    } catch (err) {
      this.error = resetErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  private line(key: string, label: string, value: string, on: boolean) {
    return html`<li data-uf=${key} data-on=${on ? 'yes' : 'no'}><span class="l">${label}</span><span class="v">${value}</span></li>`;
  }

  private renderReset(d: UserFactors) {
    // the authenticator row (sw-second-factor-user) carries the reset while the code is on; here only for the other factors
    const others = d.passkeys > 0 || d.device_keys > 0 || d.recovery.total > 0;
    if (d.totp.enabled || !others) return nothing;
    return html`<div class="reset" data-uf-reset-box>
      ${this.armed
        ? html`<div class="lbl">${t('secondFactor.adminResetConfirm')}</div>
            ${renderResetConfirm(this.check, this.typed, (v) => (this.typed = v), () => void this.reset())}
            ${this.stepUp && !refused(this.check)
              ? html`<form @submit=${(e: Event) => { e.preventDefault(); void this.reset(); }}>
                  <input data-uf-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label=${t('secondFactor.adminStepUp')}
                    placeholder="000000" .value=${this.ownCode} @input=${(e: Event) => (this.ownCode = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))} />
                </form>
                <div class="lbl">${t('secondFactor.adminStepUp')}</div>`
              : nothing}
            <span class="acts">${refused(this.check) ? nothing : html`<sw-button size="sm" variant="danger" data-uf-reset-confirm ?disabled=${this.busy || !this.ready()} @click=${() => void this.reset()}>${t('secondFactor.adminReset')}</sw-button>`}
              <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.armed = false)}>${t('secondFactor.cancel')}</sw-button></span>`
        : html`<sw-button size="sm" variant="secondary" data-uf-reset @click=${() => void this.arm()}>${t('secondFactor.adminReset')}</sw-button>`}
    </div>`;
  }

  render() {
    const d = this.data;
    if (d === undefined) return nothing;
    if (d === null) return html`<sw-second-factor-user .userId=${this.userId}></sw-second-factor-user>`;
    const n = (v: number) => (v === 0 ? tr('אין') : String(v));
    const pol = d.policy;
    // the authenticator code first, in its own element (its state, since when, and the reset); the other factors below it
    return html`<div data-second-factor-user-row><sw-second-factor-user .userId=${this.userId}></sw-second-factor-user></div>
      <ul class="list" aria-label=${tr('אמצעי האימות של המשתמש')} data-user-factors>
        ${this.line('passkeys', tr('מפתחות גישה'), d.passkeys && d.passkeys_usable !== d.passkeys ? tr('{n} ({usable} פעילים)', { n: d.passkeys, usable: d.passkeys_usable }) : n(d.passkeys), d.passkeys_usable > 0)}
        ${this.line('device-keys', tr('מפתחות טלפון'), d.device_keys && d.device_keys_counting !== d.device_keys ? tr('{n} ({usable} פעילים)', { n: d.device_keys, usable: d.device_keys_counting }) : n(d.device_keys), d.device_keys_counting > 0)}
        ${d.recovery.total ? this.line('recovery', t('secondFactor.recoveryTitle'), tr('{n} מתוך {total}', { n: d.recovery.remaining, total: d.recovery.total }), d.recovery.remaining > 0) : nothing}
        ${d.ha_mfa_seen ? this.line('ha-mfa', tr('אימות של מערכת הבית'), tr('נראה בכניסה'), true) : nothing}
        ${this.line('policy', tr('מדיניות'), `${SIGN_IN_LABEL[pol.sign_in]()} · ${(SOURCE_LABEL[pol.source] ?? (() => pol.source))()}${pol.enforced ? '' : ` · ${tr('דיווח בלבד')}`}`, pol.sign_in !== 'required' || d.totp.enabled || d.passkeys_usable > 0 || d.device_keys_counting > 0 || d.ha_mfa_seen)}
      </ul>
      ${this.renderReset(d)}
      ${this.message ? html`<div class="ok" role="status" data-uf-message>${this.message}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-uf-error>${this.error}</div>` : nothing}`;
  }

  static styles = [resetConfirmStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .list li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding: var(--sw-s-1) 0;
      border-block-end: thin solid var(--sw-border);
    }
    .list li:last-child {
      border-block-end: 0;
    }
    .l {
      color: var(--sw-text-2);
    }
    .v {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
      text-align: end;
      unicode-bidi: isolate;
    }
    li[data-on='no'][data-uf='policy'] .v {
      color: var(--sw-warning-text);
    }
    .reset {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      align-items: flex-start;
    }
    .acts {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input {
      inline-size: 9.5em;
      min-block-size: var(--sw-ctl-h-lg);
      padding: var(--sw-s-1) var(--sw-s-2);
      border: thin solid var(--sw-border-strong);
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
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .ok {
      font-size: var(--sw-fs-xs);
      color: var(--sw-success-text);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-user-factors': SwUserFactors;
  }
}
