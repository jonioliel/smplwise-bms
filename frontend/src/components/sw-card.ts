import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('sw-card')
export class SwCard extends LitElement {
  @property() heading = '';
  @property({ type: Boolean, reflect: true }) flush = false;
  @property({ type: Boolean, reflect: true }) interactive = false;

  static styles = css`
    :host {
      display: block;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      padding: var(--sw-s-4);
      min-inline-size: 0;
    }
    :host([flush]) {
      padding: 0;
      overflow: hidden;
    }
    :host([interactive]) {
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    :host([interactive]:hover) {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
  `;

  render() {
    return html`
      ${this.heading || this.querySelector('[slot="actions"]')
        ? html`<header><h3>${this.heading}</h3><slot name="actions"></slot></header>`
        : ''}
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-card': SwCard;
  }
}
