import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

// Selectable chip: floor switching, layer toggles, event-type filters (with an optional colour dot,
// like the playback filter row on board 1).
@customElement('sw-chip')
export class SwChip extends LitElement {
  @property({ type: Boolean, reflect: true }) selected = false;
  @property() icon?: IconName;
  @property({ type: Number }) count?: number;
  @property() dot = '';

  static styles = css`
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-block-size: 32px;
      padding-inline: 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    button:hover {
      background: var(--sw-surface-2);
    }
    :host([selected]) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .d {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--dot);
      flex-shrink: 0;
    }
    :host([selected]) .d {
      outline: 2px solid rgba(255, 255, 255, 0.7);
    }
    .count {
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-pill);
      padding: 0 6px;
      color: var(--sw-text-2);
    }
    :host([selected]) .count {
      background: rgba(255, 255, 255, 0.22);
      color: var(--sw-text-inverse);
    }
  `;

  render() {
    return html`
      <button type="button" aria-pressed=${this.selected}>
        ${this.dot ? html`<span class="d" style="--dot:${this.dot}"></span>` : ''}
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${15}></sw-icon>` : ''}
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
