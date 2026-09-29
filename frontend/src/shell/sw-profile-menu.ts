import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-avatar';
import '../components/sw-button';
import '../components/sw-remote-sessions';
import { t } from '../i18n/he';
import { REMOTE } from '../arx/pre-gate';
import { logout as arxLogout } from '../arx/auth';
import { inAndroidApp, switchServer } from '../arx/android-app';

/**
 * The account avatar of the top bar as a small menu (CR-008 P2): who is signed in and, with a backend, "הסשנים שלי" -
 * the user's remote sign-ins (SmplWise Arx) with "התנתק מכל המקומות" (on the remote channel) or "נתק את כל הכניסות
 * מרחוק" (locally). On the remote channel the menu also carries the sign-out, and inside the Android app "החלף שרת"
 * (CR-008 §9: the app's native server list).
 */
@customElement('sw-profile-menu')
export class SwProfileMenu extends LitElement {
  @property() name = '';
  @property() role = '';
  @property({ type: Number }) size = 28;
  /** A backend answers (the sessions section needs one). */
  @property({ type: Boolean }) api = false;
  @state() private open = false;

  private onDocClick = (e: MouseEvent) => {
    if (!e.composedPath().includes(this)) this.open = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) {
      this.open = false;
      this.renderRoot.querySelector<HTMLButtonElement>('button.me')?.focus();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.onDocClick, true);
    document.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onDocClick, true);
    document.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  render() {
    return html`
      <button class="me" type="button" aria-haspopup="dialog" aria-expanded=${this.open ? 'true' : 'false'} title=${t('app.account')} aria-label=${t('app.account')} data-profile-menu @click=${() => (this.open = !this.open)}>
        <sw-avatar name=${this.name} size=${this.size}></sw-avatar>
      </button>
      ${this.open
        ? html`<div class="menu" role="dialog" aria-label=${t('app.account')} data-profile-menu-panel>
            <div class="who"><sw-avatar name=${this.name} size=${36}></sw-avatar><div><b>${this.name}</b>${this.role ? html`<span>${this.role}</span>` : nothing}</div></div>
            ${inAndroidApp()
              ? html`<sw-button variant="ghost" size="sm" icon="list" data-arx-switch-server @click=${() => {
                  this.open = false;
                  switchServer();
                }}>החלף שרת</sw-button>`
              : nothing}
            ${this.api
              ? html`<section data-my-sessions>
                  <h3>הסשנים שלי</h3>
                  <p>כניסות פעילות מרחוק (SmplWise Arx) מכל המכשירים שלך.</p>
                  <sw-remote-sessions compact scope="own" @remote-signed-out=${(e: CustomEvent<{ everywhere?: boolean }>) => void arxLogout(e.detail?.everywhere ? 'everywhere' : 'logout')}></sw-remote-sessions>
                </section>`
              : nothing}
            ${REMOTE ? html`<sw-button variant="ghost" size="sm" icon="logout" data-profile-signout @click=${() => void arxLogout('logout')}>יציאה מ־SmplWise Arx</sw-button>` : nothing}
          </div>`
        : nothing}
    `;
  }

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }
    button.me {
      border: 0;
      padding: 0;
      background: none;
      border-radius: 50%;
      cursor: pointer;
      display: inline-flex;
    }
    button.me:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .menu {
      position: absolute;
      inset-block-start: calc(100% + 8px);
      inset-inline-end: 0;
      z-index: var(--sw-z-drawer, 50);
      inline-size: 360px;
      max-inline-size: calc(100vw - 24px);
      max-block-size: min(70vh, 560px);
      overflow: auto;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      color: var(--sw-text);
      text-align: start;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .who div {
      display: flex;
      flex-direction: column;
      font-size: var(--sw-fs-sm);
    }
    .who span {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    section {
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 8px;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold, 600);
    }
    p {
      margin: 2px 0 4px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-profile-menu': SwProfileMenu;
  }
}
