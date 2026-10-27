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
      /* POLISH-CLASSIC-DOMUS-297: colour on the hover curve, the press on the press curve (emil-design-eng: name the properties,
         transform for feedback). --sw-press-scale is 1 in a skin that sets no press feedback, so nothing moves there. */
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      white-space: nowrap;
      color: var(--sw-text);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      /* mobile-native: no grey tap flash, no 300 ms wait, a long press does not select the label */
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    /* hover only where a pointer can hover (mobile-native: a tapped button kept its hover tint on a phone) */
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-surface-2);
      }
      :host([variant='primary']) button:hover:not(:disabled) {
        background: var(--sw-accent-hover);
        border-color: var(--sw-accent-hover);
      }
      :host([variant='ghost']) button:hover:not(:disabled) {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
      :host([variant='danger']) button:hover:not(:disabled) {
        background: var(--sw-danger-soft);
      }
    }
    /* the press wash where there is no hover (touch): the state is visible under the finger */
    button:active:not(:disabled) {
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
    :host([variant='primary']) button:active:not(:disabled) {
      background: var(--sw-accent-hover);
      border-color: var(--sw-accent-hover);
    }
    :host([variant='ghost']) button {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      color: var(--sw-text-2);
    }
    :host([variant='ghost']) button:active:not(:disabled) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    :host([variant='danger']) button {
      background: var(--sw-surface);
      border-color: var(--sw-danger);
      color: var(--sw-danger-text);
    }
    :host([variant='danger']) button:active:not(:disabled) {
      background: var(--sw-danger-soft);
    }
    /* disabled keeps its shape and fades; it never lifts, presses or casts a shadow (it read as "enabled but pale") */
    :host([disabled]) button,
    :host([disabled][variant]) button {
      cursor: not-allowed;
      opacity: var(--sw-disabled-opacity);
      box-shadow: none;
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
    /* touch targets (mobile audit 2026-09-30): a finger on a phone needs 40-44 px, not the desktop's 26-36 px. SHAREDUI-295: never
       below the host's own control height, so a screen that asks for 44 px targets (--sw-ctl-h-*) keeps them on a phone too */
    @media (max-width: 767px) and (pointer: coarse) {
      button {
        min-block-size: max(40px, var(--sw-ctl-h-md));
      }
      :host([size='sm']) button {
        min-block-size: max(36px, var(--sw-ctl-h-sm));
      }
      :host([size='lg']) button {
        min-block-size: max(44px, var(--sw-ctl-h-lg));
      }
      :host([icononly]) button {
        inline-size: max(40px, var(--sw-ctl-h-md));
      }
      :host([icononly][size='sm']) button {
        inline-size: max(36px, var(--sw-ctl-h-sm));
      }
      :host([icononly][size='lg']) button {
        inline-size: max(44px, var(--sw-ctl-h-lg));
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
