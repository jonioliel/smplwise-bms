import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';

/** Page frame as on the boards: optional breadcrumb, 18px title, grey one-line subtitle, actions on the end side. */
@customElement('sw-page')
export class SwPage extends LitElement {
  @property() heading = '';
  @property() subheading = '';
  @property() crumbs = '';
  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: Boolean, reflect: true }) flush = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      padding: 14px 24px 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
      gap: 14px;
    }
    :host([wide]) {
      max-inline-size: none;
    }
    :host([flush]) {
      padding: 0;
      gap: 0;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px 12px;
    }
    :host([flush]) header {
      padding: 12px 16px 0;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .crumbs sw-icon {
      color: var(--sw-border-strong);
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .sub {
      margin-block-start: 2px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 0;
      flex: 1;
    }
    @media (max-width: 767px) {
      :host {
        padding: 12px 12px 16px;
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
    }
  `;

  render() {
    const crumbs = this.crumbs ? this.crumbs.split('|').map((c) => c.trim()) : [];
    return html`
      <header>
        <div>
          ${crumbs.length ? html`<div class="crumbs">${crumbs.map((c, i) => html`${i ? html`<sw-icon name="chevron" size=${11}></sw-icon>` : ''}<span>${c}</span>`)}</div>` : ''}
          <h1>${this.heading}</h1>
          ${this.subheading ? html`<div class="sub">${this.subheading}</div>` : ''}
        </div>
        <div class="actions"><slot name="actions"></slot></div>
      </header>
      <div class="body"><slot></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-page': SwPage;
  }
}
