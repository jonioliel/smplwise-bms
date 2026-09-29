import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ArxAuthError, completeSignIn, haErrorText, startFlow, submitStep, type LoginFlow } from './auth';

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
  @state() private step: 'credentials' | 'mfa' = 'credentials';
  @state() private busy = false;
  @state() private error = '';
  @state() private mfaName = '';
  @query('#username') private usernameEl?: HTMLInputElement;
  @query('#password') private passwordEl?: HTMLInputElement;
  @query('#code') private codeEl?: HTMLInputElement;
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
      border-radius: var(--sw-r-lg, 16px);
      box-shadow: var(--sw-shadow-3);
      padding: 28px 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand img {
      inline-size: 44px;
      block-size: 44px;
      border-radius: 12px;
    }
    .brand .name {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .brand b {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
      direction: ltr;
      text-align: end;
    }
    .brand b span {
      color: var(--sw-accent);
    }
    .brand small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
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
      font-size: 16px; /* no zoom-on-focus on iOS */
      min-block-size: 44px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      box-sizing: border-box;
      inline-size: 100%;
    }
    input:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 1px;
      border-color: var(--sw-accent);
    }
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    input.code {
      letter-spacing: 0.4em;
      text-align: center;
      font-size: 22px;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    button {
      font: inherit;
      min-block-size: 44px;
      border-radius: 10px;
      border: 1px solid var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse, #fff);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    button:hover:not(:disabled) {
      background: var(--sw-accent-hover, var(--sw-accent));
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
    }
    .msg {
      border-radius: 10px;
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
      color: var(--sw-text);
    }
    .msg.error {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
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
  `;

  firstUpdated() {
    this.usernameEl?.focus();
  }

  private async onCredentials(e: Event) {
    e.preventDefault();
    const username = this.usernameEl?.value.trim() ?? '';
    const password = this.passwordEl?.value ?? '';
    if (!username || !password) {
      this.error = 'יש למלא שם משתמש וסיסמה.';
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
    await this.run(async () => this.handle(await submitStep(this.flow!, { code })));
  }

  private async handle(step: Awaited<ReturnType<typeof submitStep>>) {
    if (step.kind === 'done') {
      await completeSignIn(this.flow!, step.code);
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

  private async run(fn: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await fn();
    } catch (err) {
      this.error = err instanceof ArxAuthError ? err.message : 'שגיאה לא צפויה. נסה שוב.';
      if (!(err instanceof ArxAuthError) || !['network', 'ha_unavailable'].includes(err.code)) this.restart(false);
    } finally {
      this.busy = false;
    }
  }

  /** A new flow from the credentials step (HA's flows are single-use after an abort, a finish or a refusal). */
  private restart(clearError = true) {
    this.flow = null;
    this.step = 'credentials';
    if (clearError) this.error = '';
  }

  render() {
    const base = import.meta.env.BASE_URL;
    const notice = this.notice ? REASON_TEXT[this.notice] ?? this.notice : '';
    return html`<main class="card" aria-labelledby="arx-title">
      <div class="brand">
        <img src="${base}brand/smplwise-mark.png" alt="" />
        <span class="name"><b>SmplWise <span>Arx</span></b><small>גישה מרחוק מאובטחת</small></span>
      </div>
      <div>
        <h1 id="arx-title">${this.step === 'mfa' ? 'אימות דו־שלבי' : 'כניסה'}</h1>
        <p class="sub">${this.step === 'mfa'
          ? html`הזן את הקוד מ${this.mfaName ? html`<bdi>${this.mfaName}</bdi>` : 'אפליקציית האימות'} שמוגדרת בחשבון שלך.`
          : 'היכנס עם שם המשתמש והסיסמה שלך.'}</p>
      </div>
      ${notice && !this.error ? html`<div class="msg ${this.noticeKind === 'error' ? 'error' : ''}" role="status" data-arx-notice>${notice}</div>` : nothing}
      ${this.error ? html`<div class="msg error" role="alert" data-arx-error>${this.error}</div>` : nothing}
      ${this.step === 'credentials'
        ? html`<form @submit=${this.onCredentials} novalidate>
            <label>שם משתמש<input id="username" class="ltr" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required ?disabled=${this.busy} /></label>
            <label>סיסמה<input id="password" class="ltr" name="password" type="password" autocomplete="current-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-submit>${this.busy ? 'מתחבר…' : 'כניסה'}</button>
          </form>`
        : html`<form @submit=${this.onCode} novalidate>
            <label>קוד אימות<input id="code" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-verify>${this.busy ? 'בודק…' : 'אימות'}</button>
            <button type="button" class="link" ?disabled=${this.busy} @click=${() => this.restart()}>חזרה לכניסה</button>
          </form>`}
      <div class="foot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
        <span>הסיסמה נבדקת מול תשתית המערכת ואינה נשמרת ב־SmplWise; ההרשאות שלך זהות להרשאותיך במערכת.</span>
      </div>
    </main>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-login': ArxLogin;
  }
}
