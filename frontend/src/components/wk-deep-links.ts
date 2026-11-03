import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { can, isApi, onSession } from '../api/session';
import { WISKEY_HIDDEN, onWiskeyEmbedNav, wiskeyEmbedNav } from '../shell/nav';
import { wkIcon } from '../screens/wiskey-stations-icons';
import { deepLinksFor, mayOpenPanel, type DeepLink } from '../wiskey/deep-links';

/** What the control is called (no platform name: the embedded panel is "חלון האינטרקום" on every operator screen). */
export const DEEP_LINKS_HEADING = 'פתיחה בחלון האינטרקום';

/**
 * WISKEY-DEEPLINKS-2382: the "no dead end" links of one Arx place into the embedded intercom panel - exactly the tab / tool where
 * the capability lives (wiskey/deep-links.ts is the one table). Drawn only for a caller who may open the panel (the WisKey area's
 * rule: `access.read` at installation scope, a backend, the area not hidden); with nothing to offer the element draws nothing and
 * is `hidden`. Links only: following one changes no setting and sends nothing to a station.
 *
 *   <wk-deep-links place="station"></wk-deep-links>                 a quiet disclosure line (closed by default) inside a section
 *   <wk-deep-links slot="actions" place="people" mode="menu">     an icon button in a page's actions that opens a short list
 *
 * Test hooks: the host carries `data-wk-deeplinks=<place>`; each link `data-wk-deeplink=<capability id>` and
 * `data-wk-target=<tab>[/<tool>]`.
 */
@customElement('wk-deep-links')
export class WkDeepLinks extends LitElement {
  @property({ reflect: true }) place = '';
  @property({ reflect: true }) mode: 'inline' | 'menu' = 'inline';
  @state() private open = false;
  @state() private rev = 0;
  private stops: Array<() => void> = [];

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    :host([mode='menu']) {
      display: inline-block;
      position: relative;
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: 0;
      cursor: pointer;
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2, 8px);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-1, 4px);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      border-radius: var(--sw-r-sm);
    }
    .toggle sw-icon {
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .toggle[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .icon-btn {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sw-touch-desktop, 44px);
      block-size: var(--sw-touch-desktop, 44px);
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
    }
    .icon-btn:hover,
    .toggle:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .icon-btn[aria-expanded='true'] {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    a {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2, 8px);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-2, 8px);
      border-radius: var(--sw-r-sm);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    a:hover {
      background: var(--sw-surface-2);
    }
    a svg {
      flex: none;
      color: var(--sw-text-2);
    }
    a span {
      min-inline-size: 0;
    }
    .menu {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-end: 0;
      z-index: var(--sw-z-drawer);
      inline-size: max-content;
      min-inline-size: 240px;
      max-inline-size: min(340px, calc(100vw - 32px));
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
    }
    .menu .h {
      padding: 6px 8px 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs, 12px);
      font-weight: var(--sw-fw-semibold);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const bump = () => (this.rev += 1);
    this.stops = [onSession(bump), onWiskeyEmbedNav(bump)];
    document.addEventListener('pointerdown', this.onOutside, true);
    this.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback(): void {
    for (const s of this.stops) s();
    this.stops = [];
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  /** The links this caller gets here (none when they may not open the panel). */
  links(): DeepLink[] {
    void this.rev;
    const api = isApi();
    const panel = mayOpenPanel({ api, accessReadInstallation: api && can('access.read'), hidden: WISKEY_HIDDEN });
    return deepLinksFor(this.place, { panel, admin: api && can('access.admin.read'), catalog: wiskeyEmbedNav().catalog });
  }

  private onOutside = (e: Event) => {
    if (this.open && this.mode === 'menu' && !e.composedPath().includes(this)) this.open = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.open) return;
    e.stopPropagation();
    this.open = false;
    requestAnimationFrame(() => (this.renderRoot.querySelector('[data-wk-deeplinks-toggle]') as HTMLElement | null)?.focus());
  };

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('place')) this.open = false;
    this.setAttribute('data-wk-deeplinks', this.place);
  }

  /** The list of the menu mode hangs from its button; on a narrow screen it is moved sideways so it never leaves the viewport. */
  protected updated(): void {
    const menu = this.renderRoot.querySelector('.menu') as HTMLElement | null;
    if (!menu) return;
    menu.style.translate = '';
    const r = menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    let dx = 0;
    if (r.right > vw - 8) dx = vw - 8 - r.right;
    if (r.left + dx < 8) dx = 8 - r.left;
    if (dx) menu.style.translate = `${Math.round(dx)}px 0`;
  }

  private list(links: DeepLink[]) {
    return html`<ul class="list" role="list">
      ${links.map(
        (l) => html`<li>
          <a href=${l.href} data-wk-deeplink=${l.id} data-wk-target=${l.target.tool ? `${l.target.tab}/${l.target.tool}` : l.target.tab} @click=${() => (this.open = false)}
            >${wkIcon('window', 14)}<span>${l.label}</span></a
          >
        </li>`,
      )}
    </ul>`;
  }

  render() {
    const links = this.links();
    this.toggleAttribute('hidden', !links.length);
    if (!links.length) return nothing;
    if (this.mode === 'menu') {
      return html`<button
          type="button"
          class="icon-btn"
          aria-label=${DEEP_LINKS_HEADING}
          title=${DEEP_LINKS_HEADING}
          aria-expanded=${String(this.open)}
          aria-haspopup="true"
          data-wk-deeplinks-toggle
          @click=${() => (this.open = !this.open)}
        >
          ${wkIcon('window', 18)}
        </button>
        ${this.open ? html`<div class="menu" role="group" aria-label=${DEEP_LINKS_HEADING} data-wk-deeplinks-list><div class="h">${DEEP_LINKS_HEADING}</div>${this.list(links)}</div>` : nothing}`;
    }
    return html`<button type="button" class="toggle" aria-expanded=${String(this.open)} data-wk-deeplinks-toggle @click=${() => (this.open = !this.open)}>
        <sw-icon name="chevronDown" size=${14}></sw-icon><span>${DEEP_LINKS_HEADING} (${links.length})</span>
      </button>
      ${this.open ? html`<div data-wk-deeplinks-list>${this.list(links)}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-deep-links': WkDeepLinks;
  }
}
