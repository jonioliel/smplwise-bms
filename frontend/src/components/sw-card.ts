import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';

/**
 * A card. Owner decisions 2026-09-30 (area redesign) added two optional looks used by the area screens:
 * - `row`: the heading block at the start side and the body beside it (the "sequential sections" direction);
 * - `collapsible` / `collapsed`: the heading is a button that folds the body away (phone sections; the sensors section
 *   starts folded). `sw-card-toggle` (detail: {collapsed}) is fired when the user folds or unfolds it.
 * Both are off by default: every other card is what it always was.
 */
@customElement('sw-card')
export class SwCard extends LitElement {
  @property() heading = '';
  @property() subheading = '';
  @property({ type: Boolean, reflect: true }) flush = false;
  @property({ type: Boolean, reflect: true }) interactive = false;
  @property({ type: Boolean, reflect: true }) row = false;
  @property({ type: Boolean, reflect: true }) collapsible = false;
  @property({ type: Boolean, reflect: true }) collapsed = false;

  static styles = css`
    :host {
      display: block;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      padding: 14px;
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
      gap: 10px;
      margin-block-end: 10px;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
      margin-block-start: 1px;
    }
    .fold {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    /* open: the chevron points up (fold it); folded: down (unfold it) - the same in either text direction */
    .fold sw-icon {
      color: var(--sw-text-3);
      transform: rotate(180deg);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    :host([collapsed]) .fold sw-icon {
      transform: none;
    }
    .fold:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
      border-radius: var(--sw-r-xs);
    }
    :host([collapsed]) header {
      margin-block-end: 0;
    }
    :host([collapsed]) .body {
      display: none;
    }
    /* row: heading at the start side, the body beside it */
    :host([row]) {
      display: grid;
      grid-template-columns: minmax(110px, 140px) minmax(0, 1fr);
      column-gap: 16px;
      align-items: start;
    }
    :host([row]) header {
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      margin-block-end: 0;
      gap: 8px;
    }
    :host([row][collapsed]) {
      grid-template-columns: 1fr;
    }
  `;

  private toggle() {
    this.collapsed = !this.collapsed;
    this.dispatchEvent(new CustomEvent('sw-card-toggle', { detail: { collapsed: this.collapsed }, bubbles: true, composed: true }));
  }

  render() {
    const title = html`<h3>${this.heading}</h3>${this.subheading ? html`<div class="sub">${this.subheading}</div>` : ''}`;
    return html`
      ${this.heading || this.querySelector('[slot="actions"]')
        ? html`<header>${this.collapsible
            ? html`<button type="button" class="fold" aria-expanded=${String(!this.collapsed)} @click=${() => this.toggle()}><sw-icon name="chevronDown" size=${14}></sw-icon><div>${title}</div></button>`
            : html`<div>${title}</div>`}<slot name="actions"></slot></header>`
        : ''}
      <div class="body"><slot></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-card': SwCard;
  }
}
