import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-avatar';
import '../components/sw-icon';
import '../components/sw-remote-sessions';
import { REMOTE } from '../arx/pre-gate';
import { logout as arxLogout } from '../arx/auth';
import { inAndroidApp, switchServer } from '../arx/android-app';

/** "99+" for a long list: the dot and the row stay compact. */
export function alertCountText(n: number): string {
  return n > 99 ? '99+' : String(n);
}

/**
 * CR-013: the user menu of the app shell (design SW A). One panel for every width, opened from the user avatar - the
 * last item of the side rail (a popover anchored to the rail's foot) and of the phone bottom bar (a bottom sheet):
 * a header (avatar, name, role, and on the phone the status pills that lived in the top bar), grouped items with icons
 * - התראות (the open-alerts inbox, with its count), סדר הלשוניות, הגדרות התראות; מערכת for a user who holds a settings
 * permission; החלף שרת inside the Android app, כל המסכים, the user's own remote sign-ins - and a destructive-styled
 * sign-out at the foot (SmplWise Arx only: under Ingress Home Assistant owns the sign-in).
 * The shell owns the open state; this element reports `close` and `nav-order` (open the tab-order dialog).
 */
@customElement('sw-user-menu')
export class SwUserMenu extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() name = '';
  @property() role = '';
  /** A backend answers (the sign-ins section needs one). */
  @property({ type: Boolean }) api = false;
  /** Open alerts in the user's scope; null = the user may not read alerts (no item). */
  @property({ type: Number }) alerts: number | null = null;
  @property() alertsHref = '#/investigate/rules?tab=alerts';
  /** "מערכת" for a user with a settings permission (nav.ts settingsEntry); '' = no item. */
  @property() settingsHref = '';
  @property({ type: Boolean }) screens = false;
  /** The sign-ins list loads only while its section is open (it asks the server). */
  @state() private sessionsOpen = false;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--sw-z-modal);
      pointer-events: none;
      visibility: hidden;
      transition: visibility 0s linear var(--sw-t-med);
    }
    :host([open]) {
      pointer-events: auto;
      visibility: visible;
      transition: none;
    }
    .scrim {
      position: absolute;
      inset: 0;
      background: var(--sw-overlay);
      opacity: 0;
      transition: opacity var(--sw-t-med) var(--sw-ease);
    }
    :host([open]) .scrim {
      opacity: 1;
    }
    .panel {
      position: absolute;
      display: flex;
      flex-direction: column;
      background: var(--sw-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-3);
      overflow: auto;
      overscroll-behavior: contain;
      text-align: start;
      outline: none;
    }
    /* desktop and tablet: a popover beside the rail's foot (RTL: the rail is on the right, the panel opens to its left) */
    @media (min-width: 768px) {
      .scrim {
        background: transparent;
      }
      .panel {
        inset-inline-start: calc(var(--sw-rail-w, 86px) + 10px);
        inset-block-end: max(12px, env(safe-area-inset-bottom, 0px));
        inline-size: 320px;
        max-block-size: min(640px, calc(100dvh - 24px));
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-lg);
        opacity: 0;
        transform: translateY(8px) scale(0.98);
        transform-origin: bottom right;
        transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-t-med) var(--sw-ease);
      }
      :host([open]) .panel {
        opacity: 1;
        transform: none;
      }
      .panel > .grab,
      .panel > .pills {
        display: none;
      }
    }
    /* phone: a bottom sheet over the bottom bar */
    @media (max-width: 767px) {
      .panel {
        inset-inline: 0;
        inset-block-end: 0;
        max-block-size: min(88dvh, 720px);
        border-radius: 18px 18px 0 0;
        padding-block-end: env(safe-area-inset-bottom, 0px);
        padding-inline: env(safe-area-inset-right, 0px) env(safe-area-inset-left, 0px);
        transform: translateY(100%);
        transition: transform var(--sw-t-med) var(--sw-ease);
      }
      :host([open]) .panel {
        transform: none;
      }
    }
    .grab {
      align-self: center;
      inline-size: 38px;
      block-size: 4px;
      border-radius: 4px;
      background: var(--sw-border-strong);
      margin-block: 8px 2px;
      flex: none;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px 12px;
    }
    .id {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      flex: 1;
      line-height: 1.3;
    }
    .id b {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .id span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    button.x {
      all: unset;
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      margin-inline-end: -8px;
      border-radius: 50%;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    button.x:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 12px;
    }
    .pills:not(:has(*)) {
      display: none;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 6px 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    li > a,
    li > button,
    footer > button,
    summary {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: 100%;
      min-block-size: 44px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      color: var(--sw-text);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    li > a:hover,
    li > button:hover,
    footer > button:hover,
    summary:hover {
      background: var(--sw-surface-3);
    }
    li > a:focus-visible,
    li > button:focus-visible,
    footer > button:focus-visible,
    summary:focus-visible,
    button.x:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: -2px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 9px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      flex: none;
    }
    .txt {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-inline-size: 0;
      line-height: 1.3;
    }
    .txt small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .count {
      min-inline-size: 22px;
      block-size: 22px;
      padding: 0 7px;
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger);
      color: #fff;
      font-size: 11.5px;
      font-weight: var(--sw-fw-bold);
      display: inline-grid;
      place-items: center;
      font-variant-numeric: tabular-nums;
    }
    .count.zero {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    li.alerts .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    li.alerts.quiet .ic {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    details > summary::-webkit-details-marker {
      display: none;
    }
    details > summary::marker {
      content: '';
    }
    details sw-icon.chev {
      color: var(--sw-text-3);
      /* the chevron mirrors in RTL (points left): -90deg turns it down, +90deg up */
      transform: rotate(-90deg);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    details[open] sw-icon.chev {
      transform: rotate(90deg);
    }
    .sessions {
      padding: 4px 10px 10px;
    }
    .sessions p {
      margin: 0 0 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    footer {
      padding: 6px 8px 10px;
      border-block-start: 1px solid var(--sw-border);
    }
    footer button {
      color: var(--sw-danger);
    }
    footer button .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    footer > button:hover {
      background: var(--sw-danger-soft);
    }
  `;

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    // keep the keyboard inside the open menu (a modal on the phone, and a small popover elsewhere)
    const items = this.focusables();
    if (!items.length) return;
    const active = this.renderRoot instanceof ShadowRoot ? this.renderRoot.activeElement : null;
    const i = items.indexOf(active as HTMLElement);
    if (e.shiftKey && (i <= 0)) {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (!e.shiftKey && i === items.length - 1) {
      e.preventDefault();
      items[0].focus();
    }
  };

  private focusables(): HTMLElement[] {
    return Array.from(this.renderRoot.querySelectorAll<HTMLElement>('button, a[href], summary'));
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      // the first item, not the ✕: the menu is for going somewhere
      requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>('ul a[href], ul button')?.focus({ preventScroll: true }));
    }
  }

  render() {
    const alerts = this.alerts;
    const android = inAndroidApp();
    return html`
      <div class="scrim" @click=${() => this.close()}></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="תפריט המשתמש" data-profile-menu-panel data-user-menu ?inert=${!this.open}>
        <span class="grab" aria-hidden="true"></span>
        <header data-user-menu-header>
          <sw-avatar name=${this.name} size=${44}></sw-avatar>
          <div class="id"><b data-user-name>${this.name}</b>${this.role ? html`<span data-user-role>${this.role}</span>` : nothing}</div>
          <button type="button" class="x" aria-label="סגור" title="סגור" @click=${() => this.close()}><sw-icon name="close" size=${18}></sw-icon></button>
        </header>
        <div class="pills" data-user-menu-pills><slot name="pills"></slot></div>
        <ul>
          ${alerts !== null
            ? html`<li class="alerts ${alerts ? '' : 'quiet'}"><a href=${this.alertsHref} data-menu-alerts @click=${() => this.close()}>
                <span class="ic"><sw-icon name="bell" size=${18}></sw-icon></span><span class="txt">התראות<small>${alerts ? 'התראות פתוחות שממתינות לאישור' : 'אין התראות פתוחות'}</small></span>
                <span class="count ${alerts ? '' : 'zero'}" data-alert-count aria-label=${`${alerts} התראות פתוחות`}>${alertCountText(alerts)}</span></a></li>`
            : nothing}
          <li><button type="button" data-menu-nav-order @click=${() => this.dispatchEvent(new CustomEvent('nav-order', { bubbles: true, composed: true }))}>
            <span class="ic"><sw-icon name="grip" size=${18}></sw-icon></span><span class="txt">סדר הלשוניות<small>בסרגל הניווט, לכל המכשירים שלך</small></span></button></li>
          <li><a href="#/system/notifications" data-menu-notify-prefs @click=${() => this.close()}>
            <span class="ic"><sw-icon name="volume" size=${18}></sw-icon></span><span class="txt">הגדרות התראות<small>מה נשלח לטלפון ומתי</small></span></a></li>
        </ul>
        ${this.settingsHref
          ? html`<ul><li><a href=${this.settingsHref} data-menu-settings @click=${() => this.close()}>
              <span class="ic"><sw-icon name="system" size=${18}></sw-icon></span><span class="txt">מערכת<small>הגדרות, משתמשים והרשאות</small></span></a></li></ul>`
          : nothing}
        ${android || this.screens || this.api
          ? html`<ul>
              ${android
                ? html`<li><button type="button" data-arx-switch-server @click=${() => {
                    this.close();
                    switchServer();
                  }}><span class="ic"><sw-icon name="list" size=${18}></sw-icon></span><span class="txt">החלף שרת</span></button></li>`
                : nothing}
              ${this.screens
                ? html`<li><a href="#/screens" data-menu-screens @click=${() => this.close()}><span class="ic"><sw-icon name="layers" size=${18}></sw-icon></span><span class="txt">כל המסכים</span></a></li>`
                : nothing}
              ${this.api
                ? html`<li><details data-my-sessions @toggle=${(e: Event) => (this.sessionsOpen = (e.currentTarget as HTMLDetailsElement).open)}>
                    <summary><span class="ic"><sw-icon name="users" size=${18}></sw-icon></span><span class="txt">הכניסות שלי<small>כניסות מרחוק מכל המכשירים</small></span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
                    <div class="sessions"><p>כניסות פעילות מרחוק (SmplWise Arx) מכל המכשירים שלך.</p>
                      ${this.open && this.sessionsOpen ? html`<sw-remote-sessions compact scope="own" @remote-signed-out=${(e: CustomEvent<{ everywhere?: boolean }>) => void arxLogout(e.detail?.everywhere ? 'everywhere' : 'logout')}></sw-remote-sessions>` : nothing}</div>
                  </details></li>`
                : nothing}
            </ul>`
          : nothing}
        ${REMOTE
          ? html`<footer><button type="button" data-profile-signout data-arx-signout @click=${() => void arxLogout('logout')}>
              <span class="ic"><sw-icon name="logout" size=${18}></sw-icon></span><span class="txt">יציאה<small>מ־SmplWise Arx במכשיר הזה</small></span></button></footer>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-user-menu': SwUserMenu;
  }
}
