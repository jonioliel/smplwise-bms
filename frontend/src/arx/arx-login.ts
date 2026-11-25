import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ArxAuthError, abandonSecondFactor, completeEnrolmentPasskey, completeSecondFactor, completeSecondFactorPasskey, completeSignIn, haErrorText, hasPendingEnrolment, hasPendingSecondFactor, pendingEnrolOrigin, pendingFactorMethods, pendingPasskeyOrigin, startFlow, submitStep, type LoginFlow } from './auth';
import { t } from '../i18n/he';
import { brandLogo, loadPublicBrand, onBrandLogo } from '../design/brand-logo';
import '../components/sw-brand';
import { inAndroidApp, switchServer } from './android-app';
import { formatSize, loadAndroidOffer, offerText, type AndroidOffer } from './android-download';
import { changePassword, confirmReset, localMe, localPasskeySecondFactor, localPasskeySignIn, localSecondFactor, localSignIn, requestReset } from './local-auth';
import { lit } from '../i18n/local-identity';
import { tr } from '../i18n/msg/misc';
import { tr as trm } from '../i18n/msg/mfa';
import { PasskeyCancelled, passkeysSupported, rpIdFits } from './webauthn';
import '../components/sw-second-factor';
import '../components/sw-passkeys';

const MODE_KEY = 'arx.login.mode';

function storedMode(): 'infra' | 'local' {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'local' ? 'local' : 'infra';
  } catch {
    return 'infra';
  }
}

const REASON_TEXT: Record<string, string> = {
  idle: tr('ננעלת לאחר חוסר פעילות. יש להיכנס שוב.'),
  expired: tr('הכניסה פגה. יש להיכנס שוב.'),
  logout: tr('יצאת מ־SmplWise Arx.'),
  everywhere: tr('יצאת מ־SmplWise Arx בכל המכשירים.'),
  revoked: tr('הכניסה במכשיר הזה נותקה מרשימת הכניסות מרחוק. יש להיכנס שוב.'),
};

/**
 * CR-008 SmplWise Arx sign-in page (remote channel only): the Home Assistant username and password, then the MFA code
 * when HA asks for one. It talks to HA's own login flow on the same origin (auth.ts); the password never reaches the
 * add-on. RTL, the product's tokens, phone first. Dispatches `arx-signed-in` once the Arx session exists.
 */
@customElement('arx-login')
export class ArxLogin extends LitElement {
  /** A message to show before anything is typed (the last sign-out's reason, or why the server refused the session). */
  @property() notice = '';
  @property() noticeKind: 'info' | 'error' = 'info';
  /** USR2: the server offers the Arx-only sign-in (remote-config `local_identity`); the page then shows the two modes. */
  @property({ type: Boolean }) localEnabled = false;
  /** USR2: open straight in the "משתמש Arx" mode (after the welcome page saved a password). */
  @property() initialMode: '' | 'infra' | 'local' = '';
  /** USR2 phase 4: the server allows passkey-only sign-in (remote-config `local_passkey_first`): the local mode shows the button. */
  @property({ type: Boolean }) passkeyFirst = false;
  /** MFA-SCREENS-2510 (owner answer 2026-11-24 Q14: not yet): the screen hook for "a sign-in with a recovery code asks to set up the
   * authenticator again". On (remote-config `recovery_reenrol`, which no server sends yet), a recovery-code sign-in lands on the
   * enrolment step instead of the app; off (the default) changes nothing. */
  @property({ type: Boolean }) recoveryReenrol = false;
  /** USR2 phase 4: how the pending local second step can be answered (`methods` of the 202; TOTP when absent). */
  @state() private factorMethods: ('totp' | 'passkey')[] = ['totp'];
  @state() private mode: 'infra' | 'local' = 'infra';
  /** MFA-RESET-CHANNEL-UI-2520: `henrol` - a home-system user told "enrol first" registers a passkey as that enrolment (the server offered it). */
  @state() private step: 'credentials' | 'mfa' | 'factor' | 'lfactor' | 'enrol' | 'henrol' | 'change' | 'forgot' | 'reset' = hasPendingEnrolment() ? 'henrol' : hasPendingSecondFactor() ? 'factor' : 'credentials';
  /** USR2 phase 2: the username of the self-service reset in progress (the steps 'forgot' -> 'reset'). */
  @state() private resetUser = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private mfaName = '';
  /** MFA-RECOVERY-CODES-2490: the Arx code step takes a one-time recovery code instead of the app's code (letters, not a number pad). */
  @state() private recoveryCode = false;
  /** MFA-SCREENS-2510: the passkey is the chosen way of the second step (the methods chooser; the code form otherwise). */
  @state() private passkeyChosen = false;
  /** MFA-HA-PASSKEY-2520: how the remote second step of a home-system user may be answered - what the server offered (`totp` alone
   * when it offered nothing: the owner's switch `security.passkey_remote_factor` off, the step of before) - and the address a passkey
   * works at. */
  @state() private haMethods: string[] = pendingFactorMethods();
  @state() private haPasskeyOrigin: string | null = pendingPasskeyOrigin();
  /** MFA-RESET-CHANNEL-UI-2520: the address a passkey made in the pending enrolment works at. */
  @state() private enrolOrigin: string | null = pendingEnrolOrigin();
  /** The Android download offer (only on an Android device, only when an administrator configured an address). */
  @state() private offer: AndroidOffer | null = null;
  @query('#username') private usernameEl?: HTMLInputElement;
  @query('#password') private passwordEl?: HTMLInputElement;
  @query('#code') private codeEl?: HTMLInputElement;
  @query('#current') private currentEl?: HTMLInputElement;
  @query('#next') private nextEl?: HTMLInputElement;
  @query('#again') private againEl?: HTMLInputElement;
  @query('#rcode') private rcodeEl?: HTMLInputElement;
  @query('#runame') private runameEl?: HTMLInputElement;
  private flow: LoginFlow | null = null;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      /* standalone (installed) iOS/Android: keep the card clear of the notch, status bar and home indicator */
      padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
      overflow: auto;
      box-sizing: border-box;
      font-family: var(--sw-font);
      color: var(--sw-text);
      background:
        radial-gradient(1200px 600px at 85% -10%, color-mix(in srgb, var(--sw-accent) 16%, transparent), transparent 60%),
        radial-gradient(900px 500px at 0% 110%, color-mix(in srgb, var(--sw-accent) 10%, transparent), transparent 60%),
        var(--sw-bg);
    }
    /* R5-SYSTEM-297: the card is the hero of the page - wider, deeper (shadow 3 + the light line), a 26/800 title, 48 px wells for the
       fields and a 48 px primary key; it materialises once (240 ms ease-out, fade + 10 px rise; a cross-fade under reduced motion) */
    .card {
      inline-size: min(420px, 100%);
      box-sizing: border-box;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-2xl, 22px);
      box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight);
      padding: 32px 28px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: login-in 240ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1)) both;
    }
    @keyframes login-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.985);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .card {
        animation: login-fade 160ms ease both;
      }
      @keyframes login-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    }
    /* LOGOS-295 (mockup v3.1): BOTH logos in the card head, centred - the company's on top (when one is set), the SmplWise logo below;
       with no company logo the SmplWise logo alone, larger. The sizes follow the administrator's scale (sw-brand). */
    .lhead {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding-block-end: 4px;
    }
    .lhead .lsep {
      inline-size: 56px;
      block-size: 1px;
      background: var(--sw-border-strong);
    }
    .linst {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      max-inline-size: 100%;
      text-align: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .linst b {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
      unicode-bidi: plaintext;
    }
    .linst span {
      overflow-wrap: anywhere;
      unicode-bidi: plaintext;
    }
    .lhead small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .sub {
      margin: 6px 0 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    /* a field is a well (surface-2, no resting outline); the accent ring appears on focus */
    input {
      font: inherit;
      font-size: max(16px, var(--sw-fs-lg)); /* no zoom-on-focus on iOS */
      min-block-size: 48px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      border: 1px solid transparent;
      /* loop 2: the well is a real step down from the card (surface-2 pulled toward the border tone), so an empty field reads as a field */
      background: color-mix(in srgb, var(--sw-surface-2, var(--sw-surface)) 76%, var(--sw-border));
      color: var(--sw-text);
      box-sizing: border-box;
      inline-size: 100%;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-border-strong) 60%, transparent);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
    }
    input:focus-visible {
      outline: none;
      border-color: var(--sw-accent);
      background: var(--sw-surface);
      /* the same focus as every field of the product (sw-field): the accent outline and a soft halo */
      box-shadow: 0 0 0 3px var(--sw-accent-soft), 0 0 0 1px var(--sw-accent);
    }
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    input.code {
      letter-spacing: 0.4em;
      text-align: center;
      font-size: var(--sw-fs-3xl);
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    button {
      font: inherit;
      min-block-size: 48px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      letter-spacing: -0.005em;
      cursor: pointer;
      box-shadow: var(--sw-shadow-primary);
      transition: background var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    button:not(.link):active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
      background: var(--sw-accent-hover, var(--sw-accent));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-accent-hover, var(--sw-accent));
      }
    }
    button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    button.link {
      background: none;
      border: 0;
      color: var(--sw-accent-text, var(--sw-accent));
      min-block-size: 32px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      align-self: center;
      box-shadow: none;
    }
    .msg {
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      line-height: 1.5;
      background: var(--sw-accent-soft);
      color: var(--sw-text);
    }
    .msg.error {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 30%, transparent);
    }
    .foot {
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 12px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      line-height: 1.5;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .foot svg {
      flex: none;
      margin-block-start: 1px;
    }
    /* a link-style button never takes the primary buttons' hover fill (a touch leaves :hover behind on phones,
       which turned "החלף שרת" into a blue block with invisible text - seen in the Android app) */
    button.link:hover:not(:disabled) {
      background: none;
      text-decoration: underline;
    }
    .app-download {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      margin-block-start: -8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .app-download a {
      color: var(--sw-accent-text, var(--sw-accent));
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      min-block-size: 32px;
      display: inline-flex;
      align-items: center;
    }
    .app-download details summary {
      cursor: pointer;
    }
    .app-download code {
      direction: ltr;
      display: block;
      word-break: break-all;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      user-select: all;
    }
    .modes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-bg));
      border: 1px solid transparent;
    }
    button.mode {
      background: none;
      border: 0;
      color: var(--sw-text-2);
      min-block-size: 40px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      box-shadow: none;
    }
    button.mode.on {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-heading, var(--sw-text)));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-2, none));
    }
    button.mode:hover:not(:disabled):not(.on) {
      background: none;
      color: var(--sw-text);
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      line-height: 1.5;
    }
    .app-servers {
      display: flex;
      justify-content: center;
      margin-block-start: -8px;
    }
    /* USR2 phase 4: the passkey buttons sit under the primary action */
    button.secondary {
      background: var(--sw-surface);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    button.secondary:hover:not(:disabled) {
      /* loop 2: the well is a real step down from the card (surface-2 pulled toward the border tone), so an empty field reads as a field */
      background: color-mix(in srgb, var(--sw-surface-2, var(--sw-surface)) 76%, var(--sw-border));
    }
    /* MFA-SCREENS-2510: the second step's methods chooser - the modes' look (the local / infrastructure switch), up to three keys */
    .modes.methods.n3 {
      grid-template-columns: 1fr 1fr 1fr;
    }
    .modes.methods button.mode {
      font-size: var(--sw-fs-sm);
      padding-inline: var(--sw-s-1);
    }
    .passkey-only {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    form > .hint[aria-hidden] {
      text-align: center;
    }
  `;

  private stopBrand?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.stopBrand = onBrandLogo(() => this.requestUpdate());
    void loadPublicBrand(); // no session yet: the public brand view (company name / logos, size, dark-background mode)
    if (this.localEnabled) this.mode = this.initialMode || storedMode();
  }

  disconnectedCallback() {
    this.stopBrand?.();
    super.disconnectedCallback();
  }

  private setMode(mode: 'infra' | 'local') {
    if (this.busy) return;
    this.mode = mode;
    this.error = '';
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    void this.updateComplete.then(() => this.usernameEl?.focus());
  }

  private signedIn() {
    this.dispatchEvent(new CustomEvent('arx-signed-in', { bubbles: true, composed: true }));
  }

  /** USR2: after a local sign-in - a gated session (enrolment required / new password required) stays on this page. */
  private async afterLocal(mustChange: boolean) {
    const me = await localMe();
    const gate = me?.local_identity?.gate ?? null;
    if (mustChange || gate === 'change') {
      this.step = 'change';
      return;
    }
    if (gate === 'enrol') {
      this.step = 'enrol';
      return;
    }
    this.signedIn();
  }

  private async onLocalCredentials(username: string, password: string) {
    await this.run(async () => {
      const r = await localSignIn(username, password);
      if (r.second_factor === 'required') {
        this.factorMethods = r.methods?.length ? r.methods : ['totp'];
        this.step = 'lfactor';
        await this.updateComplete;
        this.codeEl?.focus();
        return;
      }
      await this.afterLocal(!!r.must_change_password);
    }, false);
    if (this.error && this.passwordEl) {
      this.passwordEl.value = '';
      this.passwordEl.focus();
    }
  }

  /** USR2 phase 4: the pending second step answered with a passkey instead of the code. */
  private async onPasskeyFactor() {
    if (this.busy) return;
    await this.run(async () => {
      const r = await localPasskeySecondFactor();
      await this.afterLocal(!!r.must_change_password);
    }, false);
  }

  /** MFA-HA-PASSKEY-2520: the remote second step of a home-system user answered with a passkey (a cancelled ceremony keeps the step). */
  private async onHaPasskeyFactor() {
    if (this.busy) return;
    await this.run(async () => {
      await completeSecondFactorPasskey();
      this.dispatchEvent(new CustomEvent('arx-signed-in', { bubbles: true, composed: true }));
    });
  }

  /** MFA-RESET-CHANNEL-UI-2520: the pending enrolment answered with a new passkey made on this device (a cancelled ceremony keeps the step). */
  private async onEnrolPasskey() {
    if (this.busy) return;
    await this.run(async () => {
      await completeEnrolmentPasskey();
      this.dispatchEvent(new CustomEvent('arx-signed-in', { bubbles: true, composed: true }));
    });
  }

  /** MFA-RESET-CHANNEL-UI-2520: this page is at the address the enrolment's passkey will work at. */
  private enrolHere(): boolean {
    if (!this.enrolOrigin) return false;
    try {
      const u = new URL(this.enrolOrigin);
      return u.origin === window.location.origin && rpIdFits(u.hostname, window.location.hostname);
    } catch {
      return false;
    }
  }

  /** USR2 phase 4: passkey first - no username, no password; the server answers uniformly when it is not allowed for this passkey. */
  private async onPasskeySignIn() {
    if (this.busy) return;
    await this.run(async () => {
      const r = await localPasskeySignIn();
      await this.afterLocal(!!r.must_change_password);
    }, false);
  }

  private async onChange(e: Event) {
    e.preventDefault();
    const current = this.currentEl?.value ?? '';
    const next = this.nextEl?.value ?? '';
    if (next !== (this.againEl?.value ?? '')) {
      this.error = lit('mismatch');
      return;
    }
    await this.run(async () => {
      await changePassword(current, next);
      await this.afterLocal(false);
    }, false);
  }

  /** USR2 phase 2: "שכחתי את הסיסמה" - the username step (prefilled from the sign-in form). */
  private openForgot() {
    if (this.busy) return;
    this.resetUser = this.usernameEl?.value.trim() ?? '';
    this.error = '';
    this.notice = '';
    this.step = 'forgot';
    void this.updateComplete.then(() => this.runameEl?.focus());
  }

  private async onForgot(e: Event) {
    e.preventDefault();
    const username = this.runameEl?.value.trim() ?? this.resetUser;
    if (!username) {
      this.error = lit('fillUsername');
      return;
    }
    await this.run(async () => {
      await requestReset(username);  // the same answer for every account: the page always moves on to the code step
      this.resetUser = username;
      this.step = 'reset';
      await this.updateComplete;
      this.rcodeEl?.focus();
    }, false);
  }

  private async onReset(e: Event) {
    e.preventDefault();
    const code = this.rcodeEl?.value.replace(/[\s-]+/g, '') ?? '';
    const next = this.nextEl?.value ?? '';
    if (!code || !next || !(this.againEl?.value ?? '')) {
      this.error = lit('fillCode');
      return;
    }
    if (next !== (this.againEl?.value ?? '')) {
      this.error = lit('mismatch');
      return;
    }
    await this.run(async () => {
      const r = await confirmReset(this.resetUser, code, next);
      this.step = 'credentials';
      this.mode = 'local';
      this.noticeKind = 'info';
      const done = r.must_enrol ? lit('resetEnrol') : lit('resetDone');
      await this.updateComplete;
      this.notice = done;
      if (this.usernameEl) this.usernameEl.value = this.resetUser;
      this.passwordEl?.focus();
    }, false);
    if (this.error && this.rcodeEl && this.step === 'reset') this.rcodeEl.select();
  }

  firstUpdated() {
    this.usernameEl?.focus();
    void loadAndroidOffer(navigator.userAgent, inAndroidApp()).then((o) => (this.offer = o));
  }

  private async onCredentials(e: Event) {
    e.preventDefault();
    const username = this.usernameEl?.value.trim() ?? '';
    const password = this.passwordEl?.value ?? '';
    if (!username || !password) {
      this.error = this.mode === 'local' ? lit('fillBoth') : tr('יש למלא שם משתמש וסיסמה.');
      return;
    }
    if (this.localEnabled && this.mode === 'local') {
      await this.onLocalCredentials(username, password);
      return;
    }
    await this.run(async () => {
      if (!this.flow) this.flow = (await startFlow()).flow;
      await this.handle(await submitStep(this.flow, { username, password }));
    });
  }

  private async onCode(e: Event) {
    e.preventDefault();
    const code = this.codeEl?.value.replace(/\s+/g, '') ?? '';
    if (!code) {
      this.error = tr('יש להזין את קוד האימות.');
      return;
    }
    if (this.step === 'lfactor') {
      const recovery = this.recoveryCode;
      await this.run(async () => {
        const r = await localSecondFactor(code);
        if (recovery && this.recoveryReenrol && !r.must_change_password) {
          this.step = 'enrol';
          return;
        }
        await this.afterLocal(!!r.must_change_password);
      }, false);
      if (this.error && this.codeEl) this.codeEl.value = '';
      return;
    }
    if (this.step === 'factor') {
      const recovery = this.recoveryCode;
      await this.run(async () => {
        await completeSecondFactor(code);
        if (recovery && this.recoveryReenrol) {
          this.step = 'enrol'; // MFA-SCREENS-2510 Q14 hook (off by default)
          return;
        }
        this.dispatchEvent(new CustomEvent('arx-signed-in', { bubbles: true, composed: true }));
      });
      return;
    }
    await this.run(async () => this.handle(await submitStep(this.flow!, { code })));
  }

  private async handle(step: Awaited<ReturnType<typeof submitStep>>) {
    if (step.kind === 'done') {
      try {
        await completeSignIn(this.flow!, step.code);
      } catch (err) {
        if (err instanceof ArxAuthError && err.code === 'second_factor_required') {
          // K11: HA accepted the sign-in; the optional second factor of this user is the next step
          this.haMethods = pendingFactorMethods();
          this.haPasskeyOrigin = pendingPasskeyOrigin();
          this.step = 'factor';
          this.error = '';
          await this.updateComplete;
          this.codeEl?.focus();
          return;
        }
        if (err instanceof ArxAuthError && err.code === 'second_factor_enrollment_required' && hasPendingEnrolment()) {
          // MFA-RESET-CHANNEL-UI-2520: HA accepted the sign-in; the policy requires a factor and a passkey may be that enrolment
          this.enrolOrigin = pendingEnrolOrigin();
          this.step = 'henrol';
          this.error = '';
          await this.updateComplete;
          this.renderRoot.querySelector<HTMLElement>('[data-arx-enrol-passkey-create]')?.focus();
          return;
        }
        throw err;
      }
      this.dispatchEvent(new CustomEvent('arx-signed-in', { bubbles: true, composed: true }));
      return;
    }
    if (step.step === 'mfa' || step.step === 'select_mfa_module') {
      if (step.step === 'select_mfa_module') {
        // one enabled module is the common case: take HA's default choice and go on to the code
        await this.handle(await submitStep(this.flow!, {}));
        return;
      }
      const first = this.step !== 'mfa';
      this.step = 'mfa';
      this.mfaName = step.mfaName ?? '';
      this.error = first ? '' : step.error ?? '';
      if (!first && this.codeEl) this.codeEl.value = '';
      await this.updateComplete;
      this.codeEl?.focus();
      return;
    }
    this.error = step.error ?? haErrorText('invalid_auth');
    if (this.passwordEl) {
      this.passwordEl.value = '';
      this.passwordEl.focus();
    }
  }

  private async run(fn: () => Promise<void>, haFlow = true) {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await fn();
    } catch (err) {
      this.error = err instanceof ArxAuthError ? err.message : err instanceof PasskeyCancelled ? lit('passkeyCancelled') : tr('שגיאה לא צפויה. נסה שוב.');
      if (err instanceof ArxAuthError && err.code === 'code_invalid') this.error = lit('resetCodeInvalid');
      if (!haFlow) {
        // USR2: a wrong code keeps the code step; an expired / locked second step goes back to the credentials
        if (this.step === 'lfactor' && err instanceof ArxAuthError && ['second_factor_expired', 'second_factor_locked'].includes(err.code)) this.step = 'credentials';
        return;
      }
      // MFA-HA-PASSKEY-2520: a cancelled passkey ceremony, or a passkey not offered (any more), keeps the step like a wrong code
      if (err instanceof PasskeyCancelled) return;
      // MFA-RESET-CHANNEL-UI-2520: the enrolment step stays while the server still offers it (a renewed offer answers 403 again)
      if (this.step === 'henrol' && err instanceof ArxAuthError && err.code === 'second_factor_enrollment_required' && hasPendingEnrolment()) return;
      if (!(err instanceof ArxAuthError) || !['network', 'ha_unavailable', 'second_factor_invalid', 'passkey_not_offered'].includes(err.code)) this.restart(false);
    } finally {
      this.busy = false;
    }
  }

  /** A new flow from the credentials step (HA's flows are single-use after an abort, a finish or a refusal). */
  private restart(clearError = true) {
    if (this.mode !== 'local' && (this.step === 'factor' || this.step === 'henrol' || hasPendingSecondFactor())) void abandonSecondFactor();
    this.flow = null;
    this.step = 'credentials';
    this.recoveryCode = false;
    this.passkeyChosen = false;
    this.haMethods = ['totp'];
    this.haPasskeyOrigin = null;
    this.enrolOrigin = null;
    if (clearError) this.error = '';
  }

  /** MFA-HA-PASSKEY-2520: the server offered the passkey for the remote step, and this page is at the address it works at. */
  private haPasskeyHere(): boolean {
    return this.haMethods.includes('passkey') && !!this.haPasskeyOrigin && this.haPasskeyOrigin === window.location.origin;
  }

  /** MFA-HA-PASSKEY-2520: the remote step of a home-system user whose only factor here is the passkey - no chooser, the button alone. */
  private haPasskeyOnly(): boolean {
    return this.step === 'factor' && this.haMethods.includes('passkey') && !this.haMethods.includes('totp');
  }

  /** MFA-SCREENS-2510: the ways the second step can be answered here - the authenticator code, a passkey (an Arx-only identity whose
   * browser can use one) and a one-time recovery code (only beside the authenticator code: the codes are made with it). The remote
   * sign-in of a home-system user offers the code and the recovery code - and, MFA-HA-PASSKEY-2520, a passkey when the server offered
   * one (the owner's switch on) and this browser can use it here. */
  private methods(): ('totp' | 'passkey' | 'recovery')[] {
    if (this.step === 'factor') {
      if (!this.haMethods.includes('passkey')) return ['totp', 'recovery']; // the step of before
      if (!this.haMethods.includes('totp')) return []; // passkey only: the button alone
      return ['totp', ...(passkeysSupported() && this.haPasskeyHere() ? (['passkey'] as const) : []), 'recovery'];
    }
    if (this.step !== 'lfactor') return [];
    const totp = this.factorMethods.includes('totp');
    return [...(totp ? (['totp'] as const) : []), ...(this.factorMethods.includes('passkey') && passkeysSupported() ? (['passkey'] as const) : []), ...(totp ? (['recovery'] as const) : [])];
  }

  private async chooseMethod(m: 'totp' | 'passkey' | 'recovery') {
    this.passkeyChosen = m === 'passkey';
    this.recoveryCode = m === 'recovery';
    this.error = '';
    if (this.codeEl) this.codeEl.value = '';
    await this.updateComplete;
    if (m === 'passkey') this.renderRoot.querySelector<HTMLElement>('[data-arx-passkey-factor]')?.focus();
    else this.codeEl?.focus();
  }

  /** MFA-SCREENS-2510: one chooser for the second step (replaces slice 7's "use a recovery code" link and the separate passkey button),
   * in the look of the local / infrastructure switch. Nothing when there is only one way. */
  private renderMethods() {
    const all = this.methods();
    if (all.length < 2) return nothing;
    const current = this.passkeyChosen ? 'passkey' : this.recoveryCode ? 'recovery' : 'totp';
    // three keys on a phone are narrow: the app's code is "אפליקציה" there, "קוד מהאפליקציה" beside one other key
    const label = { totp: all.length > 2 ? trm('אפליקציה') : trm('קוד מהאפליקציה'), passkey: trm('מפתח גישה'), recovery: t('secondFactor.recoveryCodeLabel') };
    return html`<div class="modes methods n${all.length}" role="group" aria-label=${trm('דרך האימות')} data-arx-methods>
      ${all.map((m) => html`<button type="button" class="mode ${m === current ? 'on' : ''}" aria-pressed=${m === current ? 'true' : 'false'} ?disabled=${this.busy}
        data-arx-method=${m} @click=${() => void this.chooseMethod(m)}>${label[m]}</button>`)}
    </div>`;
  }

  private renderOffer() {
    const o = this.offer;
    if (!o) return nothing;
    const t = offerText(navigator.language);
    return html`<div class="app-download" data-arx-android-download-box>
      <a href=${o.url} rel="noopener noreferrer" download data-arx-android-download>${t.link}</a>
      ${o.version ? html`<span data-arx-android-version>${t.version} <bdi>${o.version}</bdi>${o.size ? html` <bdi data-arx-android-size>(${formatSize(o.size)})</bdi>` : nothing}</span>` : nothing}
      ${o.sha256 ? html`<details data-arx-android-sha><summary>${t.sha}</summary><code>${o.sha256}</code></details>` : nothing}
    </div>`;
  }

  render() {
    const notice = this.notice ? REASON_TEXT[this.notice] ?? this.notice : '';
    return html`<main class="card" aria-labelledby="arx-title">
      ${(() => {
        const hasCompany = !!(brandLogo().files.light || brandLogo().files.dark);
        return html`<div class="lhead" data-arx-brand>
          <sw-brand kind="company" .h=${46} .maxw=${220} data-arx-company-logo></sw-brand>
          ${hasCompany ? html`<span class="lsep" aria-hidden="true"></span>` : nothing}
          <sw-brand kind="product" stacked decorative .h=${hasCompany ? 60 : 84} data-arx-product-logo></sw-brand>
          <span class="sr">SmplWise Arx</span>
          ${brandLogo().wl.enabled && (brandLogo().wl.name || brandLogo().wl.contact || brandLogo().wl.files.light || brandLogo().wl.files.dark)
            ? html`<div class="linst" data-arx-installer>
                <sw-brand kind="installer" .h=${30} .maxw=${180} data-arx-installer-logo></sw-brand>
                ${brandLogo().wl.name ? html`<b data-arx-installer-name>${brandLogo().wl.name}</b>` : nothing}
                ${brandLogo().wl.contact ? html`<span data-arx-installer-contact>${brandLogo().wl.contact}</span>` : nothing}
              </div>`
            : nothing}
          <small>${tr('גישה מרחוק מאובטחת')}</small>
        </div>`;
      })()}
      <div>
        <h1 id="arx-title">${this.step === 'credentials' ? (this.localEnabled ? lit('signInTitle') : tr('כניסה')) : this.step === 'enrol' ? lit('enrolTitle') : this.step === 'change' ? lit('changeTitle') : this.step === 'forgot' || this.step === 'reset' ? lit('forgotTitle') : tr('אימות דו־שלבי')}</h1>
        <p class="sub">${this.step === 'forgot'
          ? lit('forgotSub')
          : this.step === 'reset'
          ? lit('resetSub')
          : (this.step === 'factor' || this.step === 'lfactor') && this.recoveryCode
          ? t('secondFactor.recoveryLoginPrompt')
          : this.step === 'factor'
          ? this.passkeyChosen || this.haPasskeyOnly() ? lit('passkeyUse') : t('secondFactor.loginPrompt')
          : this.step === 'lfactor'
          ? this.factorMethods.includes('totp') && !this.passkeyChosen ? lit('codePrompt') : lit('passkeyUse')
          : this.step === 'enrol'
          ? lit('enrolSub')
          : this.step === 'henrol'
          ? trm('מנהל המערכת דורש אימות דו־שלבי לחשבון הזה. אפשר להוסיף עכשיו מפתח גישה במכשיר הזה, והוא ישמש לאימות בכניסות הבאות.')
          : this.step === 'change'
          ? lit('changeSub')
          : this.localEnabled && this.mode === 'local' && this.step === 'credentials'
          ? lit('signInSubLocal')
          : this.step === 'mfa'
          ? html`${tr('הזן את הקוד מ')}${this.mfaName ? html`<bdi>${this.mfaName}</bdi>` : tr('אפליקציית האימות')} ${tr('שמוגדרת בחשבון שלך.')}`
          : tr('היכנס עם שם המשתמש והסיסמה שלך.')}</p>
      </div>
      ${this.localEnabled && this.step === 'credentials'
        ? html`<div class="modes" role="tablist" data-arx-login-modes>
            <button type="button" role="tab" class="mode ${this.mode === 'local' ? 'on' : ''}" aria-selected=${this.mode === 'local' ? 'true' : 'false'} data-arx-mode="local" @click=${() => this.setMode('local')}>${lit('modeLocal')}</button>
            <button type="button" role="tab" class="mode ${this.mode === 'infra' ? 'on' : ''}" aria-selected=${this.mode === 'infra' ? 'true' : 'false'} data-arx-mode="infra" @click=${() => this.setMode('infra')}>${lit('modeInfra')}</button>
          </div>`
        : nothing}
      ${notice && !this.error ? html`<div class="msg ${this.noticeKind === 'error' ? 'error' : ''}" role="status" data-arx-notice>${notice}</div>` : nothing}
      ${this.error ? html`<div class="msg error" role="alert" data-arx-error>${this.error}</div>` : nothing}
      ${this.step === 'enrol'
        ? html`<sw-second-factor data-arx-enrol></sw-second-factor>
            <sw-passkeys data-arx-enrol-passkey></sw-passkeys>
            <button type="button" data-arx-enrol-continue ?disabled=${this.busy} @click=${() => window.location.reload()}>${lit('continue')}</button>`
        : this.step === 'change'
        ? html`<form @submit=${this.onChange} novalidate data-arx-change>
            <label>${lit('currentPassword')}<input id="current" class="ltr" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <label>${lit('newPassword')}<input id="next" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${lit('repeatPassword')}<input id="again" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-change-save>${this.busy ? lit('saving') : lit('save')}</button>
          </form>`
        : this.step === 'forgot'
        ? html`<form @submit=${this.onForgot} novalidate data-arx-forgot-form>
            <label>${lit('username')}<input id="runame" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" .value=${this.resetUser} required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-send-code>${this.busy ? lit('sending') : lit('sendCode')}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${lit('back')}</button>
          </form>`
        : this.step === 'reset'
        ? html`<form @submit=${this.onReset} novalidate data-arx-reset-form>
            <label>${lit('resetCode')}<input id="rcode" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required ?disabled=${this.busy} /></label>
            <label>${lit('newPassword')}<input id="next" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${lit('repeatPassword')}<input id="again" class="ltr" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-reset-save>${this.busy ? lit('saving') : lit('resetSave')}</button>
            <span class="hint" data-arx-no-code>${lit('noCodeHint')}</span>
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => (this.step = 'forgot')} data-arx-resend>${lit('resendCode')}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${lit('back')}</button>
          </form>`
        : this.step === 'credentials'
        ? html`<form @submit=${this.onCredentials} novalidate>
            <label>${tr('שם משתמש')}<input id="username" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required ?disabled=${this.busy} /></label>
            <label>${tr('סיסמה')}<input id="password" class="ltr" name="password" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-submit>${this.busy ? tr('מתחבר…') : tr('כניסה')}</button>
            ${this.localEnabled && this.mode === 'local'
              ? html`<button type="button" class="link" ?disabled=${this.busy} @click=${() => this.openForgot()} data-arx-forgot>${lit('forgot')}</button>`
              : nothing}
            ${this.localEnabled && this.mode === 'local' && this.passkeyFirst && passkeysSupported()
              ? html`<span class="hint" aria-hidden="true">${lit('passkeyOr')}</span>
                  <button type="button" class="secondary" ?disabled=${this.busy} @click=${() => void this.onPasskeySignIn()} data-arx-passkey-signin>${this.busy ? lit('passkeyWaiting') : lit('passkeySignIn')}</button>`
              : nothing}
          </form>`
        : (this.step === 'lfactor' && !this.factorMethods.includes('totp')) || (this.step === 'lfactor' && this.passkeyChosen)
        ? html`${this.renderMethods()}<div class="passkey-only" data-arx-passkey-only>
            <button type="button" ?disabled=${this.busy || !passkeysSupported()} @click=${() => void this.onPasskeyFactor()} data-arx-passkey-factor>${this.busy ? lit('passkeyWaiting') : lit('passkeyUse')}</button>
            ${passkeysSupported() ? nothing : html`<span class="hint">${lit('passkeyUnsupported')}</span>`}
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${lit('back')}</button>
          </div>`
        : this.step === 'henrol'
        ? html`<div class="passkey-only" data-arx-passkey-only data-arx-ha-enrol>
            <button type="button" ?disabled=${this.busy || !passkeysSupported() || !this.enrolHere()} @click=${() => void this.onEnrolPasskey()} data-arx-enrol-passkey-create>${this.busy ? lit('passkeyWaiting') : trm('הוספת מפתח גישה וכניסה')}</button>
            ${!passkeysSupported()
              ? html`<span class="hint">${lit('passkeyUnsupported')}</span>`
              : !this.enrolHere()
              ? html`<span class="hint" data-arx-passkey-wrong-host>${lit('passkeyWrongHost', { origin: this.enrolOrigin ?? '' })}</span>`
              : nothing}
            <span class="hint" data-arx-enrol-other>${trm('אפשר גם להפעיל אפליקציית אימות ב״החשבון שלי״ בכניסה מהרשת המקומית.')}</span>
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${lit('back')}</button>
          </div>`
        : this.haPasskeyOnly() || (this.step === 'factor' && this.passkeyChosen)
        ? html`${this.renderMethods()}<div class="passkey-only" data-arx-passkey-only data-arx-ha-passkey>
            <button type="button" ?disabled=${this.busy || !passkeysSupported() || !this.haPasskeyHere()} @click=${() => void this.onHaPasskeyFactor()} data-arx-passkey-factor>${this.busy ? lit('passkeyWaiting') : lit('passkeyUse')}</button>
            ${!passkeysSupported()
              ? html`<span class="hint">${lit('passkeyUnsupported')}</span>`
              : !this.haPasskeyHere()
              ? html`<span class="hint" data-arx-passkey-wrong-host>${lit('passkeyWrongHost', { origin: this.haPasskeyOrigin ?? '' })}</span>`
              : nothing}
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${lit('back')}</button>
          </div>`
        : html`${this.renderMethods()}<form @submit=${this.onCode} novalidate>
            <label>${this.recoveryCode ? t('secondFactor.recoveryCodeLabel') : tr('קוד אימות')}<input id="code" class="code" name="code" inputmode=${this.recoveryCode ? 'text' : 'numeric'}
              autocomplete="one-time-code" autocapitalize=${this.recoveryCode ? 'characters' : 'off'} spellcheck="false" placeholder=${this.recoveryCode ? 'XXXX-XXXX' : ''}
              maxlength="12" required ?disabled=${this.busy} data-arx-code /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-verify>${this.busy ? tr('בודק…') : tr('אימות')}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${tr('חזרה לכניסה')}</button>
          </form>`}
      <div class="foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
        <span>${this.localEnabled && this.mode === 'local' ? lit('footLocal') : tr('הסיסמה נבדקת מול תשתית המערכת ואינה נשמרת ב־Arx; ההרשאות שלך זהות להרשאותיך במערכת.')}</span>
      </div>
      ${this.renderOffer()}
      ${inAndroidApp()
        ? html`<div class="app-servers"><button type="button" class="link" data-arx-switch-server @click=${() => switchServer()}>${tr('החלף שרת')}</button></div>`
        : nothing}
    </main>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-login': ArxLogin;
  }
}
