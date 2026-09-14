import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@customElement('sw-button')
export class SwButton extends LitElement {
  @property() variant: ButtonVariant = 'secondary';
  @property() size: ButtonSize = 'md';
  @property() icon?: IconName;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) iconOnly = false;
  @property() label = '';
  @property() type: 'button' | 'submit' = 'button';

  static styles = css`
    :host {
      display: inline-flex;
    }
    :host([hidden]) {
      display: none;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch);
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-sm);
      border: 1px solid transparent;
      font: inherit;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
      white-space: nowrap;
      color: var(--sw-text);
      background: var(--sw-surface);
      border-color: var(--sw-border-strong);
    }
    button:hover {
      background: var(--sw-surface-3);
    }
    :host([size='sm']) button {
      min-block-size: 32px;
      padding-inline: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
      border-radius: var(--sw-r-sm);
    }
    :host([size='lg']) button {
      min-block-size: 48px;
      padding-inline: var(--sw-s-5);
      font-size: var(--sw-fs-lg);
    }
    :host([variant='primary']) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    :host([variant='primary']) button:hover {
      background: var(--sw-accent-hover);
      border-color: var(--sw-accent-hover);
    }
    :host([variant='ghost']) button {
      background: transparent;
      border-color: transparent;
      color: var(--sw-text-2);
    }
    :host([variant='ghost']) button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    :host([variant='danger']) button {
      background: var(--sw-surface);
      border-color: var(--sw-danger);
      color: var(--sw-danger);
    }
    :host([variant='danger']) button:hover {
      background: var(--sw-danger-soft);
    }
    :host([disabled]) button {
      cursor: not-allowed;
      opacity: 0.5;
    }
    :host([icononly]) button {
      inline-size: var(--sw-touch);
      padding-inline: 0;
    }
    :host([icononly][size='sm']) button {
      inline-size: 32px;
    }
  `;

  render() {
    return html`
      <button type=${this.type} ?disabled=${this.disabled} aria-label=${this.iconOnly ? this.label : ''} title=${this.iconOnly ? this.label : ''}>
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${this.size === 'sm' ? 16 : 18}></sw-icon>` : ''}
        ${this.iconOnly ? '' : html`<slot>${this.label}</slot>`}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-button': SwButton;
  }
}
