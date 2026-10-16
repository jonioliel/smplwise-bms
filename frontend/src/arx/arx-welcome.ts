import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ArxAuthError } from './auth';
import { forgetWelcomeToken, setPassword } from './local-auth';
import { lit } from '../i18n/local-identity';

/**
 * USR2: the welcome page of an Arx-only identity (`<remote_path>/#/welcome?t=<token>`): the person chooses a password with a
 * first-login or reset link an administrator handed over. The token is read from the URL fragment once, taken out of the address
 * bar at once, and posted over TLS; no session is created here - the page then shows the sign-in page in the "משתמש Arx" mode.
 * RTL, the product's tokens, phone first. Dispatches `arx-password-set` ({ mustEnrol }) when the password was saved.
 */
@customElement('arx-welcome')
export class ArxWelcome extends LitElement {
  /** The link token (read by boot.ts from the fragment, which it then clears). */
  @property() token = '';
  @property({ type: Boolean }) enabled = true;
  @property({ type: Number }) minLength = 12;
  @state() private busy = false;
  @state() private error = '';
  @query('#pw') private pwEl?: HTMLInputElement;
  @query('#again') private againEl?: HTMLInputElement;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
      overflow: auto;
      box-sizing: border-box;
      font-family: var(--sw-font);
      color: var(--sw-text);
      background:
        radial-gradient(1200px 600px at 85% -10%, color-mix(in srgb, var(--sw-accent) 16%, transparent), transparent 60%),
        var(--sw-bg);
    }
    .card {
      inline-size: min(400px, 100%);
      box-sizing: border-box;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      padding: 28px 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    p {
      margin: 0;
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
      font-size: var(--sw-fs-lg);
      min-block-size: 44px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      box-sizing: border-box;
      inline-size: 100%;
      direction: ltr;
      text-align: start;
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    button {
      font: inherit;
      min-block-size: 44px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .msg {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
  `;

  firstUpdated() {
    forgetWelcomeToken();
    this.pwEl?.focus();
  }

  private async onSubmit(e: Event) {
    e.preventDefault();
    const pw = this.pwEl?.value ?? '';
    if (pw !== (this.againEl?.value ?? '')) {
      this.error = lit('mismatch');
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const r = await setPassword(this.token, pw);
      this.dispatchEvent(new CustomEvent('arx-password-set', { detail: { mustEnrol: r.must_enrol }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = err instanceof ArxAuthError ? err.message : lit('unexpected');
    } finally {
      this.busy = false;
    }
  }

  render() {
    const usable = this.enabled && !!this.token;
    return html`<main class="card" aria-labelledby="w-title" data-arx-welcome>
      <h1 id="w-title">${lit('welcomeTitle')}</h1>
      <p>${!this.enabled ? lit('welcomeOff') : !this.token ? lit('welcomeNoToken') : lit('welcomeSub', { min: this.minLength })}</p>
      ${this.error ? html`<div class="msg" role="alert" data-arx-welcome-error>${this.error}</div>` : nothing}
      ${usable
        ? html`<form @submit=${this.onSubmit} novalidate>
            <label>${lit('newPassword')}<input id="pw" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <label>${lit('repeatPassword')}<input id="again" type="password" autocomplete="new-password" required ?disabled=${this.busy} /></label>
            <button type="submit" ?disabled=${this.busy} data-arx-welcome-save>${this.busy ? lit('saving') : lit('setPassword')}</button>
          </form>`
        : nothing}
    </main>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-welcome': ArxWelcome;
  }
}
