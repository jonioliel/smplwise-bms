import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

// Selectable chip used for floor switching and layer toggles (toolbar-light map UI).
@customElement('sw-chip')
export class SwChip extends LitElement {
  @property({ type: Boolean, reflect: true }) selected = false;
  @property() icon?: IconName;
  @property({ type: Number }) count?: number;

  static styles = css`
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: var(--sw-s-3);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    :host([selected]) button {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
    }
    .count {
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-pill);
      padding: 0 6px;
      color: var(--sw-text-2);
    }
    :host([selected]) .count {
      background: var(--sw-surface);
    }
  `;

  render() {
    return html`
      <button type="button" aria-pressed=${this.selected}>
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${16}></sw-icon>` : ''}
        <slot></slot>
        ${this.count !== undefined ? html`<span class="count">${this.count}</span>` : ''}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-chip': SwChip;
  }
}
