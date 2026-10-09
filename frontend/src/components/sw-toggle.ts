import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('sw-toggle')
export class SwToggle extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';
  /** Keep `label` as the switch's accessible name but do not render it (the row already shows the text). */
  @property({ type: Boolean }) labelHidden = false;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    button {
      inline-size: 42px;
      block-size: 24px;
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-border-strong);
      position: relative;
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease);
      padding: 0;
    }
    button::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 18px;
      block-size: 18px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      box-shadow: var(--sw-shadow-1);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    :host([checked]) button {
      background: var(--sw-accent);
    }
    :host([checked]) button::after {
      transform: translateX(-18px);
    }
    :host-context([dir='ltr'][checked]) button::after {
      transform: translateX(18px);
    }
    :host([disabled]) button {
      opacity: var(--sw-disabled-opacity);
      cursor: not-allowed;
    }
    span {
      font-size: var(--sw-fs-sm);
    }
  `;

  constructor() {
    super();
    // A press on the host's own box around the switch (a screen may pad it to a 44 px touch target) flips it too; a
    // press on the switch itself is handled by the button. Nothing changes where the host has no padding.
    this.addEventListener('click', (e) => {
      if (e.composedPath()[0] === this) this.flip();
    });
  }

  private flip() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('change', { detail: { checked: this.checked }, bubbles: true, composed: true }));
  }

  render() {
    return html`<button type="button" role="switch" aria-checked=${this.checked} aria-label=${this.label} ?disabled=${this.disabled} @click=${this.flip}></button>${this.label && !this.labelHidden ? html`<span>${this.label}</span>` : ''}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-toggle': SwToggle;
  }
}
