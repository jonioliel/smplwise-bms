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
  @property({ type: Boolean, reflect: true }) round = false;
  @property() label = '';
  @property() type: 'button' | 'submit' = 'button';

  static styles = css`
    :host {
      display: inline-flex;
    }
    :host([hidden]) {
      display: none;
    }
    /* block: the button fills its container (phone layouts, action grids) */
    :host([block]) {
      display: flex;
    }
    :host([block]) button {
      inline-size: 100%;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: var(--sw-ctl-h-md);
      padding-inline: 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
      white-space: nowrap;
      color: var(--sw-text);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    button:hover {
      background: var(--sw-surface-2);
    }
    :host([size='sm']) button {
      min-block-size: var(--sw-ctl-h-sm);
      padding-inline: 9px;
      font-size: var(--sw-fs-xs);
      border-radius: var(--sw-r-xs);
      gap: 5px;
    }
    :host([size='lg']) button {
      min-block-size: var(--sw-ctl-h-lg);
      padding-inline: 16px;
      font-size: var(--sw-fs-md);
    }
    :host([variant='primary']) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    :host([variant='primary']) button:hover {
      background: var(--sw-accent-hover);
      border-color: var(--sw-accent-hover);
    }
    :host([variant='ghost']) button {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
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
      opacity: var(--sw-disabled-opacity);
    }
    :host([icononly]) button {
      inline-size: var(--sw-ctl-h-md);
      padding-inline: 0;
    }
    :host([icononly][size='sm']) button {
      inline-size: var(--sw-ctl-h-sm);
    }
    :host([icononly][size='lg']) button {
      inline-size: var(--sw-ctl-h-lg);
    }
    :host([round]) button {
      border-radius: 50%;
    }
    /* touch targets (mobile audit 2026-09-30): a finger on a phone needs 40-44 px, not the desktop's 26-36 px */
    @media (max-width: 767px) and (pointer: coarse) {
      button {
        min-block-size: 40px;
      }
      :host([size='sm']) button {
        min-block-size: 36px;
      }
      :host([size='lg']) button {
        min-block-size: 44px;
      }
      :host([icononly]) button {
        inline-size: 40px;
      }
      :host([icononly][size='sm']) button {
        inline-size: 36px;
      }
      :host([icononly][size='lg']) button {
        inline-size: 44px;
      }
    }
  `;

  render() {
    return html`
      <button type=${this.type} ?disabled=${this.disabled} aria-label=${this.iconOnly ? this.label : ''} title=${this.iconOnly ? this.label : ''}>
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${this.size === 'sm' ? 13 : this.size === 'lg' ? 18 : 15}></sw-icon>` : ''}
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
