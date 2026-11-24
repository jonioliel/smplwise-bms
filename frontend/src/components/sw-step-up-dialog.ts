import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { describeError, type StepUpDetails } from '../api/client';
import { isRecoveryCode, verifyStepUp } from '../api/second-factor';
import { appDeviceKeyId, DeviceKeyCancelled, deviceKeyStepUp, NO_RECOVERY_ACTIONS, recoveryStepUp } from '../api/factor-screens';
import { tr as trm } from '../i18n/msg/mfa';
import { passkeyStepUp } from '../api/step-up-passkey';
import { PasskeyCancelled, passkeysSupported } from '../arx/webauthn';
import { t, tf } from '../i18n/he';
import { STEP_UP_VERIFIED } from '../shell/step-up';

/**
 * MFA-STEPUP-TRAIN-2490 slice 2: the code dialog the shell opens when the server's step-up gate refuses a change of settings, users or
 * permissions (403 `step_up_required`, api/client.ts). The user types the current authenticator code; `POST auth/step-up/verify` records a
 * proof on this session (server-side) and the dialog answers true - the client then sends the original request ONCE more. A wrong code
 * keeps the dialog open with the server's message (wrong / locked); cancel, Escape, ✕ or the backdrop answer false (no retry). The
 * system's own sw-dialog, so the skin, RTL, the focus trap and the phone layout are the shell's. Opened by shell/step-up.ts only.
 * MFA-TRAIN-2500: when the server lists `passkey` among the methods (slice 4) and the browser has passkeys, a "confirm with a passkey"
 * button runs the passkey ceremony (api/step-up-passkey.ts `passkeyStepUp`: challenge, the device, verify) - the same server-side
 * proof, the same single retry. A passkey-only user sees only that button; a user with both sees the passkey first and the code under
 * "or". A cancelled or failed ceremony keeps the dialog open with the reason.
 * MFA-SCREENS-2510 (MFA-SECFIX-2500 open question 5, owner-approved): two more methods. The PHONE KEY - only inside the Android app that
 * holds a key (`window.ArxApp.deviceKey.status()`) and when the server lists `device_key`: a "confirm with the phone key" button runs
 * the app's biometric prompt over the server's challenge (api/factor-screens.ts `deviceKeyStepUp`). A RECOVERY CODE - beside the code,
 * for the normal window only (never a once-action nor adding a factor; the server refuses those too): a link switches the field to a
 * one-time recovery code (`XXXX-XXXX`). Same proof, same single retry.
 */
@customElement('sw-step-up-dialog')
export class SwStepUpDialog extends LitElement {
  @property({ attribute: false }) details: StepUpDetails = {};
  @property({ type: Boolean }) open = false;
  @state() private code = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private passkeyBusy = false;
  /** MFA-SCREENS-2510: this app's phone key id (null: not in the app, no key, or the server does not list the method). */
  @state() private keyId: string | null = null;
  @state() private keyBusy = false;
  /** MFA-SCREENS-2510: the field takes a one-time recovery code instead of the app's code. */
  @state() private recovery = false;

  /** Set by stepUpDialog(): called once with the answer. */
  resolver: ((ok: boolean) => void) | null = null;

  static styles = css`
    .msg {
      margin: 0 0 6px;
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .hint {
      margin: 0 0 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    form {
      display: flex;
      justify-content: center;
    }
    input {
      inline-size: 9.5em;
      min-block-size: 44px;
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
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .pk {
      display: flex;
      justify-content: center;
    }
    .or {
      margin: 10px 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: center;
    }
    /* MFA-SCREENS-2510: the recovery-code switch under the field */
    .alt {
      display: flex;
      justify-content: center;
      margin-block-start: var(--sw-s-2);
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
    .err {
      margin: 8px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      text-align: center;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (this.methods.includes('device_key')) void appDeviceKeyId().then((id) => (this.keyId = id));
  }

  /** A recovery code may answer this refusal: beside the code, for the normal window only. */
  private get recoveryAllowed(): boolean {
    return this.methods.includes('totp') && !this.details.once && !NO_RECOVERY_ACTIONS.includes(this.details.action ?? '');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.answer(false); // removed without an answer: nothing was confirmed
  }

  private get methods(): string[] {
    return Array.isArray(this.details.methods) ? this.details.methods : [];
  }

  private get valid(): boolean {
    return this.recovery ? isRecoveryCode(this.code) : /^\d{6}$/.test(this.code.replace(/\s+/g, ''));
  }

  answer(ok: boolean) {
    const r = this.resolver;
    if (!r) return;
    this.resolver = null;
    this.open = false;
    r(ok);
    void this.updateComplete.then(() => requestAnimationFrame(() => this.remove()));
  }

  /** MFA-TRAIN-2500: the passkey proof (slice 4) - the same server-side proof as the code; the dialog then answers true once. */
  private async byPasskey() {
    if (this.busy) return;
    this.busy = true;
    this.passkeyBusy = true;
    this.error = '';
    try {
      await passkeyStepUp(this.details.action);
      window.dispatchEvent(new CustomEvent(STEP_UP_VERIFIED));
      this.answer(true);
    } catch (err) {
      this.error = err instanceof PasskeyCancelled ? t('stepUp.passkeyCancelled') : describeError(err);
    } finally {
      this.busy = false;
      this.passkeyBusy = false;
    }
  }

  /** MFA-SCREENS-2510: the phone-key proof (slice 8) - the app's prompt over the server's challenge; the dialog then answers true once. */
  private async byDeviceKey() {
    if (this.busy || !this.keyId) return;
    this.busy = true;
    this.keyBusy = true;
    this.error = '';
    try {
      await deviceKeyStepUp(this.keyId, t('stepUp.heading'), this.details.action);
      window.dispatchEvent(new CustomEvent(STEP_UP_VERIFIED));
      this.answer(true);
    } catch (err) {
      this.error = err instanceof DeviceKeyCancelled ? trm('האישור בטלפון בוטל או נכשל.') : describeError(err);
    } finally {
      this.busy = false;
      this.keyBusy = false;
    }
  }

  private async submit(e?: Event) {
    e?.preventDefault();
    if (this.busy || !this.valid) return;
    this.busy = true;
    this.error = '';
    try {
      if (this.recovery) await recoveryStepUp(this.code.trim(), this.details.action);
      else await verifyStepUp(this.code.replace(/\s+/g, ''), this.details.action);
      window.dispatchEvent(new CustomEvent(STEP_UP_VERIFIED));
      this.answer(true);
    } catch (err) {
      this.error = describeError(err);
      this.code = '';
    } finally {
      this.busy = false;
    }
  }

  render() {
    const minutes = typeof this.details.minutes === 'number' ? this.details.minutes : 5;
    const code = this.methods.includes('totp');
    const listed = this.methods.includes('passkey');
    const pk = listed && passkeysSupported();
    const dk = !!this.keyId; // MFA-SCREENS-2510: the phone key, in the app that holds one
    const can = code || pk || dk;
    const body = pk && code ? t('stepUp.bodyBoth') : pk ? t('stepUp.bodyPasskey') : code ? t('stepUp.body') : trm('כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון.');
    return html`<sw-dialog ?open=${this.open} heading=${t('stepUp.heading')} data-step-up-dialog @close=${(e: Event) => { e.stopPropagation(); this.answer(false); }}>
      ${can
        ? html`<p class="msg" data-step-up-text>${body}</p>
            <p class="hint" data-step-up-window>${minutes > 0 ? tf('stepUp.window', { minutes }) : t('stepUp.once')}</p>
            ${pk
              ? html`<div class="pk"><sw-button variant=${code ? 'secondary' : 'primary'} data-step-up-passkey ?disabled=${this.busy} @click=${() => void this.byPasskey()}>${this.passkeyBusy ? t('stepUp.passkeyWaiting') : t('stepUp.passkey')}</sw-button></div>`
              : nothing}
            ${dk
              ? html`<div class="pk"><sw-button variant=${code || pk ? 'secondary' : 'primary'} icon="sensor" data-step-up-device-key ?disabled=${this.busy} @click=${() => void this.byDeviceKey()}>${this.keyBusy ? trm('ממתין לטלפון…') : trm('אישור במפתח הטלפון')}</sw-button></div>`
              : nothing}
            ${(pk || dk) && code ? html`<div class="or" aria-hidden="true">${t('stepUp.or')}</div>` : nothing}
            ${code
              ? html`<form @submit=${(e: Event) => void this.submit(e)}>
                  <input name="code" inputmode=${this.recovery ? 'text' : 'numeric'} autocomplete="one-time-code" maxlength=${this.recovery ? 11 : 7} autocapitalize=${this.recovery ? 'characters' : 'off'}
                    spellcheck="false" placeholder=${this.recovery ? 'XXXX-XXXX' : '000000'} aria-label=${this.recovery ? t('secondFactor.recoveryCodeLabel') : t('stepUp.codeLabel')} data-step-up-code
                    .value=${this.code} ?disabled=${this.busy} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} />
                </form>
                ${this.recoveryAllowed
                  ? html`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${() => { this.recovery = !this.recovery; this.code = ''; this.error = ''; }}>${this.recovery ? t('secondFactor.recoveryUseApp') : t('secondFactor.recoveryUse')}</button></div>`
                  : nothing}`
              : nothing}`
        : html`<p class="msg" data-step-up-no-method>${listed ? t('stepUp.passkeyUnsupported') : this.methods.includes('device_key') && !this.methods.includes('totp') ? trm('את מפתח הטלפון אפשר לאשר רק מתוך אפליקציית Android.') : t('stepUp.noMethod')}</p>`}
      ${this.error ? html`<div class="err" role="alert" data-step-up-error>${this.error}</div>` : nothing}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${() => this.answer(false)}>${t('stepUp.cancel')}</sw-button>
      ${code
        ? html`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy || !this.valid} @click=${() => void this.submit()}>${t('stepUp.confirm')}</sw-button>`
        : nothing}
    </sw-dialog>`;
  }
}

/** Open the step-up dialog; resolves true once a proof was recorded, false on cancel. */
export function stepUpDialog(details: StepUpDetails): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const el = document.createElement('sw-step-up-dialog');
    el.details = details;
    el.resolver = resolve;
    document.body.append(el);
    el.open = true;
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-step-up-dialog': SwStepUpDialog;
  }
}
