import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TabItem {
  id: string;
  label: string;
  href?: string;
  count?: number;
}

/** Secondary navigation inside a mode (routes) or inside a screen (panels). */
@customElement('sw-tabs')
export class SwTabs extends LitElement {
  @property({ attribute: false }) items: TabItem[] = [];
  @property() active = '';
  @property({ type: Boolean, reflect: true }) segmented = false;

  static styles = css`
    :host {
      display: flex;
      gap: var(--sw-s-1);
      overflow-x: auto;
      scrollbar-width: none;
      border-block-end: 1px solid var(--sw-border);
      max-inline-size: 100%;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    :host([segmented]) {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px;
      background: var(--sw-surface);
      inline-size: fit-content;
    }
    a,
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      border: 0;
      border-block-end: 2px solid transparent;
      background: transparent;
      color: var(--sw-text-2);
      text-decoration: none;
      font: inherit;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      margin-block-end: -1px;
    }
    a:hover,
    button:hover {
      color: var(--sw-text);
    }
    .on {
      color: var(--sw-accent-text);
      border-block-end-color: var(--sw-accent);
    }
    :host([segmented]) a,
    :host([segmented]) button {
      padding: 6px 14px;
      border-radius: var(--sw-r-pill);
      border-block-end: 0;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    :host([segmented]) .on {
      background: var(--sw-accent-soft);
    }
    .count {
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-pill);
      padding: 0 7px;
      color: var(--sw-text-2);
    }
  `;

  private choose(item: TabItem) {
    this.active = item.id;
    this.dispatchEvent(new CustomEvent('change', { detail: { id: item.id }, bubbles: true, composed: true }));
  }

  render() {
    return html`${this.items.map((it) =>
      it.href
        ? html`<a href=${it.href} class=${it.id === this.active ? 'on' : ''} aria-current=${it.id === this.active ? 'page' : 'false'}>${it.label}${it.count !== undefined ? html`<span class="count">${it.count}</span>` : ''}</a>`
        : html`<button type="button" class=${it.id === this.active ? 'on' : ''} aria-pressed=${it.id === this.active} @click=${() => this.choose(it)}>${it.label}${it.count !== undefined ? html`<span class="count">${it.count}</span>` : ''}</button>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-tabs': SwTabs;
  }
}
