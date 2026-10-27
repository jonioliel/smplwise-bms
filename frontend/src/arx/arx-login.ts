import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ArxAuthError, abandonSecondFactor, completeSecondFactor, completeSignIn, haErrorText, hasPendingSecondFactor, startFlow, submitStep, type LoginFlow } from './auth';
import { t } from '../i18n/he';
import { brandLogo, loadPublicBrand, onBrandLogo } from '../design/brand-logo';
import '../components/sw-brand';
import { inAndroidApp, switchServer } from './android-app';
import { formatSize, loadAndroidOffer, offerText, type AndroidOffer } from './android-download';
import { changePassword, confirmReset, localMe, localPasskeySecondFactor, localPasskeySignIn, localSecondFactor, localSignIn, requestReset } from './local-auth';
import { lit } from '../i18n/local-identity';
import { PasskeyCancelled, passkeysSupported } from './webauthn';
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
  idle: 'ננעלת לאחר חוסר פעילות. יש להיכנס שוב.',
  expired: 'הכניסה פגה. יש להיכנס שוב.',
  logout: 'יצאת מ־SmplWise Arx.',
  everywhere: 'יצאת מ־SmplWise Arx בכל המכשירים.',
  revoked: 'הכניסה במכשיר הזה נותקה מרשימת הכניסות מרחוק. יש להיכנס שוב.',
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
  /** USR2 phase 4: how the pending local second step can be answered (`methods` of the 202; TOTP when absent). */
  @state() private factorMethods: ('totp' | 'passkey')[] = ['totp'];
  @state() private mode: 'infra' | 'local' = 'infra';
  @state() private step: 'credentials' | 'mfa' | 'factor' | 'lfactor' | 'enrol' | 'change' | 'forgot' | 'reset' = hasPendingSecondFactor() ? 'factor' : 'credentials';
  /** USR2 phase 2: the username of the self-service reset in progress (the steps 'forgot' -> 'reset'). */
  @state() private resetUser = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private mfaName = '';
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
    .card {
      inline-size: min(400px, 100%);
      box-sizing: border-box;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      /* POLISH-CLASSIC-DOMUS-297: the card is the one floating object on the page - the floating shadow and the 1 px top edge */
      box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight);
      padding: 28px 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
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
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.01em;
    }
    .sub {
      margin: 4px 0 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
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
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    input {
      font: inherit;
      font-size: var(--sw-fs-lg); /* no zoom-on-focus on iOS */
      min-block-size: 44px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      box-sizing: border-box;
      inline-size: 100%;
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
    }
    input:focus-visible {
      outline: none;
      border-color: var(--sw-accent);
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
      min-block-size: 44px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
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
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
      color: var(--sw-text);
    }
    .msg.error {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
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
      border: 1px solid var(--sw-border);
    }
    button.mode {
      background: none;
      border: 0;
      color: var(--sw-text-2);
      min-block-size: 40px;
      font-weight: var(--sw-fw-medium);
    }
    button.mode.on {
      background: var(--sw-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1, none);
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
      background: var(--sw-surface-2, var(--sw-surface));
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
      this.error = this.mode === 'local' ? lit('fillBoth') : 'יש למלא שם משתמש וסיסמה.';
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
      this.error = 'יש להזין את קוד האימות.';
      return;
    }
    if (this.step === 'lfactor') {
      await this.run(async () => {
        const r = await localSecondFactor(code);
        await this.afterLocal(!!r.must_change_password);
      }, false);
      if (this.error && this.codeEl) this.codeEl.value = '';
      return;
    }
    if (this.step === 'factor') {
      await this.run(async () => {
        await completeSecondFactor(code);
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
          this.step = 'factor';
          this.error = '';
          await this.updateComplete;
          this.codeEl?.focus();
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
      this.error = err instanceof ArxAuthError ? err.message : err instanceof PasskeyCancelled ? lit('passkeyCancelled') : 'שגיאה לא צפויה. נסה שוב.';
      if (err instanceof ArxAuthError && err.code === 'code_invalid') this.error = lit('resetCodeInvalid');
      if (!haFlow) {
        // USR2: a wrong code keeps the code step; an expired / locked second step goes back to the credentials
        if (this.step === 'lfactor' && err instanceof ArxAuthError && ['second_factor_expired', 'second_factor_locked'].includes(err.code)) this.step = 'credentials';
        return;
      }
      if (!(err instanceof ArxAuthError) || !['network', 'ha_unavailable', 'second_factor_invalid'].includes(err.code)) this.restart(false);
    } finally {
      this.busy = false;
    }
  }

  /** A new flow from the credentials step (HA's flows are single-use after an abort, a finish or a refusal). */
  private restart(clearError = true) {
    if (this.mode !== 'local' && (this.step === 'factor' || hasPendingSecondFactor())) void abandonSecondFactor();
    this.flow = null;
    this.step = 'credentials';
    if (clearError) this.error = '';
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
          <small>גישה מרחוק מאובטחת</small>
        </div>`;
      })()}
      <div>
        <h1 id="arx-title">${this.step === 'credentials' ? (this.localEnabled ? lit('signInTitle') : 'כניסה') : this.step === 'enrol' ? lit('enrolTitle') : this.step === 'change' ? lit('changeTitle') : this.step === 'forgot' || this.step === 'reset' ? lit('forgotTitle') : 'אימות דו־שלבי'}</h1>
        <p class="sub">${this.step === 'forgot'
          ? lit('forgotSub')
          : this.step === 'reset'
          ? lit('resetSub')
          : this.step === 'factor'
          ? t('secondFactor.loginPrompt')
          : this.step === 'lfactor'
          ? this.factorMethods.includes('totp') ? lit('codePrompt') : lit('passkeyUse')
          : this.step === 'enrol'
          ? lit('enrolSub')
          : this.step === 'change'
          ? lit('changeSub')
          : this.localEnabled && this.mode === 'local' && this.step === 'credentials'
          ? lit('signInSubLocal')
          : this.step === 'mfa'
          ? html`הזן את הקוד מ${this.mfaName ? html`<bdi>${this.mfaName}</bdi>` : 'אפליקציית האימות'} שמוגדרת בחשבון שלך.`
          : 'היכנס עם שם המשתמש והסיסמה שלך.'}</p>
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
            <label>שם משתמש<input id="username" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required ?disabled=${this.busy} /></label>
            <label>סיסמה<input id="password" class="ltr" name="password" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-submit>${this.busy ? 'מתחבר…' : 'כניסה'}</button>
            ${this.localEnabled && this.mode === 'local'
              ? html`<button type="button" class="link" ?disabled=${this.busy} @click=${() => this.openForgot()} data-arx-forgot>${lit('forgot')}</button>`
              : nothing}
            ${this.localEnabled && this.mode === 'local' && this.passkeyFirst && passkeysSupported()
              ? html`<span class="hint" aria-hidden="true">${lit('passkeyOr')}</span>
                  <button type="button" class="secondary" ?disabled=${this.busy} @click=${() => void this.onPasskeySignIn()} data-arx-passkey-signin>${this.busy ? lit('passkeyWaiting') : lit('passkeySignIn')}</button>`
              : nothing}
          </form>`
        : this.step === 'lfactor' && !this.factorMethods.includes('totp')
        ? html`<div class="passkey-only" data-arx-passkey-only>
            <button type="button" ?disabled=${this.busy || !passkeysSupported()} @click=${() => void this.onPasskeyFactor()} data-arx-passkey-factor>${this.busy ? lit('passkeyWaiting') : lit('passkeyUse')}</button>
            ${passkeysSupported() ? nothing : html`<span class="hint">${lit('passkeyUnsupported')}</span>`}
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>${lit('back')}</button>
          </div>`
        : html`<form @submit=${this.onCode} novalidate>
            <label>קוד אימות<input id="code" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-verify>${this.busy ? 'בודק…' : 'אימות'}</button>
            ${this.step === 'lfactor' && this.factorMethods.includes('passkey') && passkeysSupported()
              ? html`<button type="button" class="secondary" ?disabled=${this.busy} @click=${() => void this.onPasskeyFactor()} data-arx-passkey-factor>${lit('passkeyUse')}</button>`
              : nothing}
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>חזרה לכניסה</button>
          </form>`}
      <div class="foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
        <span>${this.localEnabled && this.mode === 'local' ? lit('footLocal') : 'הסיסמה נבדקת מול תשתית המערכת ואינה נשמרת ב־Arx; ההרשאות שלך זהות להרשאותיך במערכת.'}</span>
      </div>
      ${this.renderOffer()}
      ${inAndroidApp()
        ? html`<div class="app-servers"><button type="button" class="link" data-arx-switch-server @click=${() => switchServer()}>החלף שרת</button></div>`
        : nothing}
    </main>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-login': ArxLogin;
  }
}
