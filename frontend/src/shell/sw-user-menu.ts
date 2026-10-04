import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-avatar';
import '../components/sw-icon';
import '../components/sw-remote-sessions';
import './sw-wiskey-prefs';
import './sw-home-personal';
import { can, canAnywhere } from '../api/session';
import { WISKEY_HIDDEN } from './nav';
import { REMOTE } from '../arx/pre-gate';
import { logout as arxLogout } from '../arx/auth';
import { inAndroidApp, switchServer } from '../arx/android-app';

/** "99+" for a long list: the dot and the chip stay compact. */
export function alertCountText(n: number): string {
  return n > 99 ? '99+' : String(n);
}

/** "התראה פתוחה אחת" / "N התראות פתוחות" (the avatar's accessible name, the chip's label). */
export function openAlertsText(n: number): string {
  return n === 1 ? 'התראה פתוחה אחת' : `${alertCountText(n)} התראות פתוחות`;
}

/**
 * CR-013: the user menu of the app shell (design SW A). One panel for every width, opened from the user avatar - the
 * last item of the side rail (a popover beside the rail's foot) and of the phone bottom bar (a bottom sheet). Two
 * levels in the same panel, no explanatory text:
 * - first: a header (avatar, name, role; on the phone the status pills that lived in the top bar), התראות (opens the notification
 *   center, CR-018: `open-notifications`; a count chip only when there are unread notifications), עריכת המסך הראשי (the home screen's layout editor: system.configure only), מערכת (a user holding a settings permission), החשבון שלי, and a destructive-styled
 *   יציאה at the foot (the remote channel only: under the local entry the platform owns the sign-in);
 * - החשבון שלי: סדר הלשוניות, הגדרות התראות, הכניסות שלי, החלף שרת (inside the Android app).
 * The shell owns the open state; this element reports `close` and `nav-order` (open the tab-order dialog).
 */
@customElement('sw-user-menu')
export class SwUserMenu extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() name = '';
  @property() role = '';
  /** A backend answers (the sign-ins section needs one). */
  @property({ type: Boolean }) api = false;
  /** The user sees no tab at all (no role yet): nothing to order, no notifications to set. */
  @property({ type: Boolean }) gated = false;
  /** Open alerts in the user's scope; null = the user may not read alerts (no item). */
  @property({ type: Number }) alerts: number | null = null;
  /** CR-018: the open-critical state (the avatar's red dot): the bell's icon turns red. */
  @property({ type: Boolean }) alertsHot: boolean | undefined = undefined;
  /** CR-018: the count is the center's unread count (`/notifications/summary`), not the legacy open rule alerts. */
  @property({ type: Boolean }) notifyCenter = false;
  @property() alertsHref = '#/investigate/rules?tab=alerts';
  /** "מערכת" for a user with a settings permission (nav.ts settingsEntry); '' = no item. */
  @property() settingsHref = '';
  /** CR-021 S2: "עדכון זמין" - an update exists and the user holds system.update (the shell decides; '' = no row). */
  @property() updateHref = '';
  /** CR-021 S3: "נדרשת הפעלה מחדש" - the platform needs a restart and no update row is shown ('' = no row). */
  @property() restartHref = '';
  /** "עריכת המסך הראשי": the home screen in its layout-edit mode (the shell decides who may; '' = no item). */
  @property() editHomeHref = '';
  /** UI round 1c (shell/screen-edit.ts): the edit modes the CURRENT screen registered that this user may enter ("עריכת פריסה", ...). */
  @property({ attribute: false }) screenEdits: { id: string; label: string; icon: string }[] = [];
  /** shell/screen-view.ts: the CURRENT screen's view choices (the home screen's cards | tiles), each an inline two-option control. */
  @property({ attribute: false }) screenViews: { id: string; label: string; icon?: string; options: { value: string; label: string }[]; current: string }[] = [];
  @state() private level: 'main' | 'account' = 'main';
  /** The sign-ins list loads only while its section is open (it asks the server). */
  @state() private sessionsOpen = false;
  /** The WisKey start choices section (WisKey rc.37) loads only while it is open. */
  @state() private wiskeyOpen = false;
  /** The personal home screen section (screen.personalize) loads only while it is open. */
  @state() private homeOpen = false;

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
        inline-size: 300px;
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
      padding: 12px 16px;
    }
    header sw-avatar {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
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
    header h2 {
      flex: 1;
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    button.x {
      all: unset;
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      margin-inline: -8px;
      border-radius: 50%;
      color: var(--sw-text-3);
      cursor: pointer;
      flex: none;
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
      min-block-size: 48px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      color: var(--sw-text);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) {
      li > a:hover,
      li > button:hover,
      footer > button:hover,
      summary:hover {
        background: var(--sw-surface-3);
      }
      footer > button:hover {
        background: var(--sw-danger-soft);
      }
    }
    li > a:focus-visible,
    li > button:focus-visible,
    footer > button:focus-visible,
    summary:focus-visible,
    button.x:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: -2px;
    }
    /* a view choice: the label and, at the end, a compact two-option control (the menu stays open when it is used) */
    li.view {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 48px;
      padding: 6px 10px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    li.view .seg {
      display: inline-flex;
      padding: 2px;
      gap: 1px;
      background: var(--sw-surface-3);
      border-radius: 999px;
      flex: none;
    }
    li.view .seg button {
      border: 0;
      background: transparent;
      min-block-size: 32px;
      padding: 0 12px;
      border-radius: 999px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    li.view .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    li.view .seg button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
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
      flex: 1;
      min-inline-size: 0;
    }
    .chev {
      color: var(--sw-text-3);
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
    li.update .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
      flex: none;
      margin-inline-end: 4px;
    }
    li.alerts.hot .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    details > summary::-webkit-details-marker {
      display: none;
    }
    details > summary::marker {
      content: '';
    }
    details sw-icon.chev {
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
    footer {
      padding: 6px 8px 10px;
      border-block-start: 1px solid var(--sw-border);
    }
    footer > button {
      color: var(--sw-danger);
    }
    footer > button .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
  `;

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  /** A menu link: the shell navigates (after dropping the sheet's history entry, so Back is not spent on it). A plain
   * click only - a modified click (new tab) keeps the browser's own behaviour. */
  private go(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
    if (!href) return;
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('navigate', { detail: { href }, bubbles: true, composed: true }));
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (this.level === 'account') this.goLevel('main');
      else this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    // keep the keyboard inside the open menu (a modal on the phone, and a small popover elsewhere)
    const items = this.focusables();
    if (!items.length) return;
    const active = this.renderRoot instanceof ShadowRoot ? this.renderRoot.activeElement : null;
    const i = items.indexOf(active as HTMLElement);
    if (e.shiftKey && i <= 0) {
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

  private goLevel(level: 'main' | 'account') {
    this.level = level;
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(level === 'account' ? 'header button[data-menu-back]' : 'ul a[href], ul button')?.focus({ preventScroll: true }));
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.level = 'main';
      this.sessionsOpen = false;
      this.wiskeyOpen = false;
      this.homeOpen = false;
    }
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      // the first item, not the ✕: the menu is for going somewhere
      requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>('ul a[href], ul button')?.focus({ preventScroll: true }));
    }
  }

  private accountItems() {
    const android = inAndroidApp();
    // WisKey rc.37: the user's own start choices of the embedded panel - only for a user who may see the WisKey area
    const wiskey = this.api && !this.gated && !WISKEY_HIDDEN && can('access.read');
    // home redesign: the personal home screen - only for a holder of screen.personalize (the server checks it again)
    const home = this.api && !this.gated && canAnywhere('screen.personalize');
    return { order: !this.gated, prefs: !this.gated, sessions: this.api, android, wiskey, home };
  }

  private renderMain() {
    const alerts = this.alerts;
    const acc = this.accountItems();
    const hasAccount = acc.order || acc.prefs || acc.sessions || acc.android || acc.wiskey || acc.home;
    return html`
      <header data-user-menu-header>
        <sw-avatar name=${this.name} size=${40}></sw-avatar>
        <div class="id"><b data-user-name>${this.name}</b>${this.role ? html`<span data-user-role>${this.role}</span>` : nothing}</div>
        <button type="button" class="x" aria-label="סגור" title="סגור" @click=${() => this.close()}><sw-icon name="close" size=${18}></sw-icon></button>
      </header>
      <div class="pills" data-user-menu-pills><slot name="pills"></slot></div>
      <ul data-menu-level="main">
        ${alerts !== null
          ? html`<li class="alerts ${(this.notifyCenter ? this.alertsHot : !!alerts) ? 'hot' : ''}"><button type="button" data-menu-alerts aria-haspopup="dialog" @click=${() => this.dispatchEvent(new CustomEvent('open-notifications', { bubbles: true, composed: true }))}>
              <span class="ic"><sw-icon name="bell" size=${18}></sw-icon></span><span class="txt">התראות</span>
              ${alerts ? html`<span class="count" data-alert-count aria-label=${this.notifyCenter ? `${alertCountText(alerts)} התראות שלא נקראו` : openAlertsText(alerts)}>${alertCountText(alerts)}</span>` : nothing}</button></li>`
          : nothing}
        ${this.screenEdits.map(
          (a) => html`<li><button type="button" data-menu-screen-edit=${a.id} @click=${() => this.dispatchEvent(new CustomEvent('screen-edit', { detail: { id: a.id }, bubbles: true, composed: true }))}>
            <span class="ic"><sw-icon name=${a.icon} size=${18}></sw-icon></span><span class="txt">${a.label}</span></button></li>`,
        )}
        ${this.screenViews.map(
          (v) => html`<li class="view" data-menu-screen-view=${v.id}>
            <span class="ic"><sw-icon name=${v.icon ?? 'layers'} size=${18}></sw-icon></span><span class="txt" id=${`mv-${v.id}`}>${v.label}</span>
            <span class="seg" role="group" aria-labelledby=${`mv-${v.id}`}>${v.options.map((o) => html`<button type="button" data-menu-view-option=${o.value} aria-pressed=${String(v.current === o.value)} @click=${() => this.dispatchEvent(new CustomEvent('screen-view', { detail: { id: v.id, value: o.value }, bubbles: true, composed: true }))}>${o.label}</button>`)}</span>
          </li>`,
        )}
        ${this.editHomeHref
          ? html`<li><a href=${this.editHomeHref} data-menu-edit-home @click=${(e: MouseEvent) => this.go(e)}>
              <span class="ic"><sw-icon name="edit" size=${18}></sw-icon></span><span class="txt">עריכת המסך הראשי</span></a></li>`
          : nothing}
        ${this.settingsHref
          ? html`<li><a href=${this.settingsHref} data-menu-settings @click=${(e: MouseEvent) => this.go(e)}>
              <span class="ic"><sw-icon name="system" size=${18}></sw-icon></span><span class="txt">מערכת</span></a></li>`
          : nothing}
        ${this.updateHref
          ? html`<li class="update"><a href=${this.updateHref} data-menu-update @click=${(e: MouseEvent) => this.go(e)}>
              <span class="ic"><sw-icon name="refresh" size=${18}></sw-icon></span><span class="txt">עדכון זמין</span><span class="dot" aria-hidden="true"></span></a></li>`
          : this.restartHref
            ? html`<li class="update"><a href=${this.restartHref} data-menu-restart @click=${(e: MouseEvent) => this.go(e)}>
                <span class="ic"><sw-icon name="power" size=${18}></sw-icon></span><span class="txt">נדרשת הפעלה מחדש</span><span class="dot" aria-hidden="true"></span></a></li>`
            : nothing}
        ${hasAccount
          ? html`<li><button type="button" data-menu-account aria-haspopup="true" @click=${() => this.goLevel('account')}>
              <span class="ic"><sw-icon name="user" size=${18}></sw-icon></span><span class="txt">החשבון שלי</span><sw-icon class="chev" name="chevron" size=${16}></sw-icon></button></li>`
          : nothing}
      </ul>
      ${REMOTE
        ? html`<footer><button type="button" data-profile-signout data-arx-signout @click=${() => void arxLogout('logout')}>
            <span class="ic"><sw-icon name="logout" size=${18}></sw-icon></span><span class="txt">יציאה</span></button></footer>`
        : nothing}
    `;
  }

  private renderAccount() {
    const acc = this.accountItems();
    return html`
      <header>
        <button type="button" class="x" data-menu-back aria-label="חזרה" title="חזרה" @click=${() => this.goLevel('main')}><sw-icon name="chevronBack" size=${18}></sw-icon></button>
        <h2>החשבון שלי</h2>
        <button type="button" class="x" aria-label="סגור" title="סגור" @click=${() => this.close()}><sw-icon name="close" size=${18}></sw-icon></button>
      </header>
      <ul data-menu-level="account">
        ${acc.order
          ? html`<li><button type="button" data-menu-nav-order @click=${() => this.dispatchEvent(new CustomEvent('nav-order', { bubbles: true, composed: true }))}>
              <span class="ic"><sw-icon name="grip" size=${18}></sw-icon></span><span class="txt">סדר הלשוניות</span></button></li>`
          : nothing}
        ${acc.prefs
          ? html`<li><a href="#/system/notifications" data-menu-notify-prefs @click=${(e: MouseEvent) => this.go(e)}>
              <span class="ic"><sw-icon name="bellSettings" size=${18}></sw-icon></span><span class="txt">הגדרות התראות</span></a></li>`
          : nothing}
        ${acc.home
          ? html`<li><details data-my-home @toggle=${(e: Event) => (this.homeOpen = (e.currentTarget as HTMLDetailsElement).open)}>
              <summary><span class="ic"><sw-icon name="dashboard" size=${18}></sw-icon></span><span class="txt">המסך שלי</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
              <div class="sessions">${this.open && this.homeOpen ? html`<sw-home-personal></sw-home-personal>` : nothing}</div>
            </details></li>`
          : nothing}
        ${acc.wiskey
          ? html`<li><details data-my-wiskey @toggle=${(e: Event) => (this.wiskeyOpen = (e.currentTarget as HTMLDetailsElement).open)}>
              <summary><span class="ic"><sw-icon name="door" size=${18}></sw-icon></span><span class="txt">WisKey</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
              <div class="sessions">${this.open && this.wiskeyOpen ? html`<sw-wiskey-prefs></sw-wiskey-prefs>` : nothing}</div>
            </details></li>`
          : nothing}
        ${acc.sessions
          ? html`<li><details data-my-sessions @toggle=${(e: Event) => (this.sessionsOpen = (e.currentTarget as HTMLDetailsElement).open)}>
              <summary><span class="ic"><sw-icon name="users" size=${18}></sw-icon></span><span class="txt">הכניסות שלי</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
              <div class="sessions">${this.open && this.sessionsOpen ? html`<sw-remote-sessions compact scope="own" @remote-signed-out=${(e: CustomEvent<{ everywhere?: boolean }>) => void arxLogout(e.detail?.everywhere ? 'everywhere' : 'logout')}></sw-remote-sessions>` : nothing}</div>
            </details></li>`
          : nothing}
        ${acc.android
          ? html`<li><button type="button" data-arx-switch-server @click=${() => {
              this.close();
              switchServer();
            }}><span class="ic"><sw-icon name="list" size=${18}></sw-icon></span><span class="txt">החלף שרת</span></button></li>`
          : nothing}
      </ul>
    `;
  }

  render() {
    return html`
      <div class="scrim" @click=${() => this.close()}></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="תפריט המשתמש" data-profile-menu-panel data-user-menu data-level=${this.level} ?inert=${!this.open}>
        <span class="grab" aria-hidden="true"></span>
        ${this.level === 'account' ? this.renderAccount() : this.renderMain()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-user-menu': SwUserMenu;
  }
}
