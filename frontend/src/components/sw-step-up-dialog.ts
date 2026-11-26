import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { describeError, type StepUpDetails } from '../api/client';
import { isRecoveryCode, verifyStepUp } from '../api/second-factor';
import { appDeviceKeyId, DeviceKeyCancelled, deviceKeyStepUp, NO_RECOVERY_ACTIONS, recoveryStepUp } from '../api/factor-screens';
import { tr as trm } from '../i18n/msg/mfa';
import { passkeyStepUp } from '../api/step-up-passkey';
import { PasskeyCancelled, PasskeyWrongHost, passkeysSupported } from '../arx/webauthn';
import { t, tf } from '../i18n/he';
import { lit } from '../i18n/local-identity';
import { STEP_UP_VERIFIED } from '../shell/step-up';
import { alarmPinStepUp, cancelPushApproval, pushApprovalState, startPushApproval, verifyPushApproval } from '../api/push-approval';

/** MFA-T095-REST-2530: how often the requesting screen asks whether the phone approved (the request lives 90 s). */
const PUSH_POLL_MS = 2000;

/** CLIENT-RESILIENCE-2540 (review SCR-23): the dialog answers "not confirmed" by itself this long after it opened (and at once when the
 * route changes), so a refused request - a door, the alarm - is never sent later because somebody typed a code into a box left open.
 * As long as a phone approval lives (90 s); the client's own backstop for physical actions is longer (api/client.ts STEP_UP_REPLAY_MS). */
const STEP_UP_DIALOG_MS = 90_000;

/** SCR-23: what the refused request was, in the person's words (never an internal id on screen); unknown = the dialog of before. */
const SETTINGS_ACTIONS = ['system.configure', 'sources.configure', 'nvr.configure', 'site.content.configure', 'calendar.configure', 'tickets.configure',
  'backup.manage', 'system.update', 'bridge.key.rotate', 'partner.manage'];
const ACTION_TEXT: Record<string, () => string> = {
  'alarm.disarm': () => trm('נטרול האזעקה'),
  'alarm.bypass': () => trm('עקיפת חיישן באזעקה'),
  'door.open': () => trm('פתיחת דלת'),
  'identity.local.manage': () => trm('שינוי משתמשים'),
  'users.ha_manage': () => trm('שינוי משתמשים'),
  'rbac.assign': () => trm('שינוי הרשאות'),
  'rbac.roles.manage': () => trm('שינוי הרשאות'),
  'rbac.system_admin.assign': () => trm('מינוי מנהל מערכת'),
  'backup.restore': () => trm('שחזור מגיבוי'),
  ...Object.fromEntries(SETTINGS_ACTIONS.map((a) => [a, () => trm('שינוי הגדרות')])),
};
function stepUpActionText(action: unknown): string | null {
  return typeof action === 'string' && Object.prototype.hasOwnProperty.call(ACTION_TEXT, action) ? ACTION_TEXT[action]() : null;
}
const PUSH_END_TEXT: Record<string, () => string> = {
  denied: () => trm('הבקשה נדחתה בטלפון.'),
  expired: () => trm('הבקשה פגה לפני שאושרה. נסה שוב.'),
  cancelled: () => trm('הבקשה בוטלה.'),
  used: () => trm('הבקשה כבר נוצלה. נסה שוב.'),
};

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
 * MFA-T095-REST-2530 (CR-011 option D and 4E / Q6): two ACTION-BOUND methods, each listed by the server only when its switch is on.
 * APPROVE ON THE PHONE (`push`, outside the app that holds the key): the dialog opens a request, shows its two-digit number and waits;
 * the person types that number in the Android app and confirms with the phone key; the dialog then spends the approval
 * (`auth/step-up/verify {method: "push"}`) and answers true. THE PERSONAL ALARM CODE (`alarm_pin`, an alarm disarm / zone bypass only):
 * the field takes the alarm code instead (the only field when the account has no authenticator code). Both prove ONE request of exactly
 * the refused action - the same single retry. Cancelling the dialog cancels an open phone request.
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
  /** MFA-T095-REST-2530: the field takes the personal alarm code (an alarm action, `alarm_pin` listed). */
  @state() private pin = false;
  /** MFA-T095-REST-2530: the open phone approval (its id and the number this screen shows), null when none. */
  @state() private push: { id: string; number: number } | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set by stepUpDialog(): called once with the answer. */
  resolver: ((ok: boolean) => void) | null = null;
  /** CLIENT-RESILIENCE-2540 (SCR-23): how long the dialog waits before it answers "not confirmed" by itself. */
  expiresMs = STEP_UP_DIALOG_MS;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  /** SCR-23: another screen was opened - the request belonged to the screen that is gone. */
  private readonly onRoute = () => this.answer(false);

  static styles = css`
    .msg {
      margin: 0 0 6px;
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    /* CLIENT-RESILIENCE-2540 (SCR-23): the refused action, named above the method sentence */
    .msg.action {
      font-weight: var(--sw-fw-semibold);
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
    /* MFA-T095-REST-2530: the number the phone must type, while the dialog waits for the approval */
    .push {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sw-s-1);
    }
    .push .hint {
      margin: 0;
    }
    .num {
      font-size: var(--sw-fs-3xl);
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
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
    // SCR-23: a short life - expired, the request is cancelled (never replayed); a route change cancels it too
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.answer(false), this.expiresMs);
    window.addEventListener('hashchange', this.onRoute);
  }

  /** A recovery code may answer this refusal: beside the code, for the normal window only. */
  private get recoveryAllowed(): boolean {
    return this.methods.includes('totp') && !this.details.once && !NO_RECOVERY_ACTIONS.includes(this.details.action ?? '');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.answer(false); // removed without an answer: nothing was confirmed
    this.stopExpiry();
  }

  private stopExpiry() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    window.removeEventListener('hashchange', this.onRoute);
  }

  private get action(): string {
    return typeof this.details.action === 'string' ? this.details.action : '';
  }

  /** MFA-T095-REST-2530: approve on the phone - listed by the server, and this is not the app that holds the key (it signs itself). */
  private get pushOffered(): boolean {
    return this.methods.includes('push') && !!this.action && !this.keyId;
  }

  /** MFA-T095-REST-2530: the personal alarm code - listed by the server for an alarm action only. */
  private get pinOffered(): boolean {
    return this.methods.includes('alarm_pin') && !!this.action;
  }

  /** The field holds the alarm code: chosen by the link, or the only field there is. */
  private get pinMode(): boolean {
    return this.pinOffered && (this.pin || !this.methods.includes('totp'));
  }

  private get methods(): string[] {
    return Array.isArray(this.details.methods) ? this.details.methods : [];
  }

  private get valid(): boolean {
    if (this.pinMode) return /^\d{4,8}$/.test(this.code.trim());
    return this.recovery ? isRecoveryCode(this.code) : /^\d{6}$/.test(this.code.replace(/\s+/g, ''));
  }

  answer(ok: boolean) {
    const r = this.resolver;
    if (!r) return;
    this.resolver = null;
    this.stopExpiry();
    this.stopPush(!ok);
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
      // MFA-RESET-CHANNEL-UI-2520: a page at another address (the local network's address) cannot use a passkey made for the public one
      this.error = err instanceof PasskeyWrongHost ? lit('passkeyWrongHost', { origin: err.rpId }) : err instanceof PasskeyCancelled ? t('stepUp.passkeyCancelled') : describeError(err);
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

  /** MFA-T095-REST-2530: stop waiting for the phone; `cancel` also cancels the open request on the server (best effort). */
  private stopPush(cancel: boolean) {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = null;
    const open = this.push;
    this.push = null;
    if (cancel && open) void cancelPushApproval(open.id).catch(() => undefined);
  }

  /** MFA-T095-REST-2530: open a phone approval and wait for it; approved -> spend it here and answer true once. */
  private async byPush() {
    if (this.busy || this.push) return;
    this.busy = true;
    this.error = '';
    try {
      const started = await startPushApproval(this.action);
      this.push = { id: started.request_id, number: started.number };
      this.schedulePushPoll();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private schedulePushPoll() {
    this.pushTimer = setTimeout(() => void this.pollPush(), PUSH_POLL_MS);
  }

  private async pollPush() {
    const open = this.push;
    if (!open || !this.resolver) return;
    try {
      const st = await pushApprovalState(open.id);
      if (this.push?.id !== open.id) return;
      if (st.status === 'pending') return this.schedulePushPoll();
      if (st.status === 'approved') {
        this.busy = true;
        await verifyPushApproval(open.id, this.action);
        this.push = null;
        window.dispatchEvent(new CustomEvent(STEP_UP_VERIFIED));
        this.answer(true);
        return;
      }
      this.push = null;
      this.error = PUSH_END_TEXT[st.status]?.() ?? trm('הבקשה פגה לפני שאושרה. נסה שוב.');
    } catch (err) {
      this.push = null;
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async submit(e?: Event) {
    e?.preventDefault();
    if (this.busy || !this.valid) return;
    this.busy = true;
    this.error = '';
    try {
      if (this.pinMode) await alarmPinStepUp(this.code.trim(), this.action);
      else if (this.recovery) await recoveryStepUp(this.code.trim(), this.details.action);
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
    const totp = this.methods.includes('totp');
    const pinField = this.pinOffered; // MFA-T095-REST-2530: the personal alarm code (an alarm action)
    const pinMode = this.pinMode;
    const code = totp || pinField;
    const listed = this.methods.includes('passkey');
    const pk = listed && passkeysSupported();
    const dk = !!this.keyId; // MFA-SCREENS-2510: the phone key, in the app that holds one
    const push = this.pushOffered; // MFA-T095-REST-2530: approve on the phone, from another screen
    const can = code || pk || dk || push;
    // CLIENT-RESILIENCE-2540 (SCR-23): the refused action by name (a door is not "settings"); then the method sentence without a purpose
    const named = stepUpActionText(this.details.action);
    const body = named
      ? (pk && totp ? trm('כדי להמשיך, אשר במפתח גישה או הזן את הקוד הנוכחי מאפליקציית האימות.') : pk ? trm('כדי להמשיך, אשר במפתח גישה במכשיר הזה.')
        : totp ? trm('כדי להמשיך, הזן את הקוד הנוכחי מאפליקציית האימות.') : pinField ? trm('כדי להמשיך, הזן את קוד האזעקה האישי שלך.')
        : push ? trm('כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה.') : trm('כדי להמשיך, אשר במפתח הטלפון.'))
      : pk && totp ? t('stepUp.bodyBoth') : pk ? t('stepUp.bodyPasskey') : totp ? t('stepUp.body')
      : pinField ? trm('כדי להמשיך, הזן את קוד האזעקה האישי שלך.') : push ? trm('כדי להמשיך, אשר את הפעולה בטלפון שבו מותקנת האפליקציה.')
      : trm('כדי לשנות הגדרות, משתמשים או הרשאות, אשר במפתח הטלפון.');
    const seconds = Math.round(this.expiresMs / 1000);
    // MFA-RESET-CHANNEL-UI-2520: the user HAS a passkey that counts (the server lists it) but this browser cannot use passkeys - the
    // dialog offers the code and says why the passkey is not offered, instead of leaving it out silently
    // (RELEASE-2530-TRAIN: MFA-T095-REST-2530's phone approval is another way too)
    const pkElsewhere = listed && !pk && (code || dk || push);
    return html`<sw-dialog ?open=${this.open} heading=${t('stepUp.heading')} data-step-up-dialog @close=${(e: Event) => { e.stopPropagation(); this.answer(false); }}>
      ${named ? html`<p class="msg action" data-step-up-action>${trm('הפעולה: {action}', { action: named })}</p>` : nothing}
      ${can
        ? html`<p class="msg" data-step-up-text>${body}</p>
            ${pkElsewhere ? html`<p class="hint" data-step-up-passkey-elsewhere>${trm('למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה. כאן אפשר לאשר בדרך אחרת.')}</p>` : nothing}
            <p class="hint" data-step-up-window>${minutes > 0 ? tf('stepUp.window', { minutes }) : t('stepUp.once')}</p>
            <p class="hint" data-step-up-expiry>${trm('אם לא תאשר תוך {seconds} שניות, הבקשה תבוטל ולא תבוצע.', { seconds })}</p>
            ${pk
              ? html`<div class="pk"><sw-button variant=${code ? 'secondary' : 'primary'} data-step-up-passkey ?disabled=${this.busy} @click=${() => void this.byPasskey()}>${this.passkeyBusy ? t('stepUp.passkeyWaiting') : t('stepUp.passkey')}</sw-button></div>`
              : nothing}
            ${dk
              ? html`<div class="pk"><sw-button variant=${code || pk ? 'secondary' : 'primary'} icon="sensor" data-step-up-device-key ?disabled=${this.busy} @click=${() => void this.byDeviceKey()}>${this.keyBusy ? trm('ממתין לטלפון…') : trm('אישור במפתח הטלפון')}</sw-button></div>`
              : nothing}
            ${push
              ? this.push
                ? html`<div class="push" role="status" data-step-up-push-wait>
                    <span class="hint">${trm('בטלפון, הקלד את המספר:')}</span>
                    <span class="num" dir="ltr" data-step-up-push-number>${this.push.number}</span>
                    <span class="hint">${trm('ממתין לאישור בטלפון…')}</span>
                  </div>`
                : html`<div class="pk"><sw-button variant=${code || pk || dk ? 'secondary' : 'primary'} icon="bell" data-step-up-push ?disabled=${this.busy}
                    @click=${() => void this.byPush()}>${trm('אישור בטלפון')}</sw-button></div>`
              : nothing}
            ${(pk || dk || push) && code ? html`<div class="or" aria-hidden="true">${t('stepUp.or')}</div>` : nothing}
            ${code
              ? html`<form @submit=${(e: Event) => void this.submit(e)}>
                  ${pinMode
                    ? html`<input name="code" type="password" inputmode="numeric" autocomplete="off" maxlength="8" spellcheck="false" placeholder="••••"
                        aria-label=${trm('קוד האזעקה האישי')} data-step-up-code data-step-up-pin-field
                        .value=${this.code} ?disabled=${this.busy} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} />`
                    : html`<input name="code" inputmode=${this.recovery ? 'text' : 'numeric'} autocomplete="one-time-code" maxlength=${this.recovery ? 11 : 7} autocapitalize=${this.recovery ? 'characters' : 'off'}
                        spellcheck="false" placeholder=${this.recovery ? 'XXXX-XXXX' : '000000'} aria-label=${this.recovery ? t('secondFactor.recoveryCodeLabel') : t('stepUp.codeLabel')} data-step-up-code
                        .value=${this.code} ?disabled=${this.busy} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} />`}
                </form>
                ${this.recoveryAllowed && !pinMode
                  ? html`<div class="alt"><button type="button" class="link" data-step-up-recovery ?disabled=${this.busy}
                      @click=${() => { this.recovery = !this.recovery; this.code = ''; this.error = ''; }}>${this.recovery ? t('secondFactor.recoveryUseApp') : t('secondFactor.recoveryUse')}</button></div>`
                  : nothing}
                ${pinField && totp
                  ? html`<div class="alt"><button type="button" class="link" data-step-up-pin ?disabled=${this.busy}
                      @click=${() => { this.pin = !this.pin; this.recovery = false; this.code = ''; this.error = ''; }}>${this.pin ? trm('אישור בקוד מאפליקציית האימות') : trm('אישור בקוד האזעקה האישי')}</button></div>`
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
