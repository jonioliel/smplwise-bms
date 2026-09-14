import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** Page frame: title row (title, subtitle, actions), optional demo-data notice, content. */
@customElement('sw-page')
export class SwPage extends LitElement {
  @property() heading = '';
  @property() subheading = '';
  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: Boolean, reflect: true }) flush = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      padding: var(--sw-s-4) var(--sw-s-6) var(--sw-s-6);
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
      gap: var(--sw-s-4);
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
      gap: var(--sw-s-3);
    }
    :host([flush]) header {
      padding: var(--sw-s-3) var(--sw-s-4) 0;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
    }
    .sub {
      margin-block-start: var(--sw-s-1);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      min-block-size: 0;
      flex: 1;
    }
    @media (max-width: 767px) {
      :host {
        padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-4);
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
    }
  `;

  render() {
    return html`
      <header>
        <div>
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
