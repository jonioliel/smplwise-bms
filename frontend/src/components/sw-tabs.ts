import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TabItem {
  id: string;
  label: string;
  href?: string;
  count?: number;
}

/**
 * Pill tabs (board 1: "All Sites (3) | Buildings | Map"): a light track with the active item as a
 * white/blue pill. `underline` switches to the quieter underlined style for dense settings pages.
 */
@customElement('sw-tabs')
export class SwTabs extends LitElement {
  @property({ attribute: false }) items: TabItem[] = [];
  @property() active = '';
  @property({ type: Boolean, reflect: true }) segmented = false;
  @property({ type: Boolean, reflect: true }) underline = false;

  static styles = css`
    :host {
      display: inline-flex;
      gap: 2px;
      overflow-x: auto;
      scrollbar-width: none;
      max-inline-size: 100%;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 3px;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    :host([underline]) {
      display: flex;
      background: transparent;
      padding: 0;
      border-radius: 0;
      border-block-end: 1px solid var(--sw-border);
      gap: var(--sw-s-1);
    }
    a,
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--sw-text-2);
      text-decoration: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a:hover,
    button:hover {
      color: var(--sw-text);
    }
    .on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    :host([underline]) a,
    :host([underline]) button {
      padding: 10px 12px;
      border-radius: 0;
      border-block-end: 2px solid transparent;
      margin-block-end: -1px;
    }
    :host([underline]) .on {
      background: transparent;
      box-shadow: none;
      border-block-end-color: var(--sw-accent);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .on .count {
      color: var(--sw-accent-text);
    }
  `;

  private choose(item: TabItem) {
    this.active = item.id;
    this.dispatchEvent(new CustomEvent('change', { detail: { id: item.id }, bubbles: true, composed: true }));
  }

  render() {
    return html`${this.items.map((it) =>
      it.href
        ? html`<a href=${it.href} class=${it.id === this.active ? 'on' : ''} aria-current=${it.id === this.active ? 'page' : 'false'}>${it.label}${it.count !== undefined ? html`<span class="count">(${it.count})</span>` : ''}</a>`
        : html`<button type="button" class=${it.id === this.active ? 'on' : ''} aria-pressed=${it.id === this.active} @click=${() => this.choose(it)}>${it.label}${it.count !== undefined ? html`<span class="count">(${it.count})</span>` : ''}</button>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-tabs': SwTabs;
  }
}
