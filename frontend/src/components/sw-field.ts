import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** Labelled form field wrapper; the control (input/select/textarea) is slotted and styled here. */
@customElement('sw-field')
export class SwField extends LitElement {
  @property() label = '';
  @property() hint = '';
  @property({ type: Boolean, reflect: true }) inline = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    :host([inline]) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
    }
    label {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    ::slotted(input),
    ::slotted(select),
    ::slotted(textarea) {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 40px;
      padding: 8px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
    }
    ::slotted(input:focus),
    ::slotted(select:focus),
    ::slotted(textarea:focus) {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
      border-color: var(--sw-accent);
    }
    ::slotted([data-ltr]) {
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
    }
  `;

  render() {
    return html`
      ${this.label ? html`<label>${this.label}</label>` : ''}
      <slot></slot>
      ${this.hint ? html`<div class="hint">${this.hint}</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-field': SwField;
  }
}
