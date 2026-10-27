import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

// Selectable chip / filter pill (boards: "All | Motion | Person | Vehicle" with colour dots).
@customElement('sw-chip')
export class SwChip extends LitElement {
  @property({ type: Boolean, reflect: true }) selected = false;
  @property() icon?: IconName;
  @property({ type: Number }) count?: number;
  @property() dot = '';
  /** 2.0.2: a chip that cannot be pressed now (a camera of another recorder, the comparison at its limit); the native button is disabled. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  static styles = css`
    :host {
      display: inline-flex;
      /* break-ui (POLISH-CLASSIC-DOMUS-297): a long label (an e-mail, a long area name) ends in an ellipsis inside its container
         instead of running out of the card; the count and the dot never shrink */
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .t {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count,
    sw-icon {
      flex-shrink: 0;
    }
    button {
      max-inline-size: 100%;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 28px;
      padding-inline: 11px;
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
      /* POLISH-CLASSIC-DOMUS-297: colour on the hover curve, press feedback on transform (1 = none in a skin that sets no scale) */
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-surface-2);
      }
      :host([selected]) button:hover:not(:disabled) {
        background: var(--sw-accent-hover);
        border-color: var(--sw-accent-hover);
      }
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .count {
      font-variant-numeric: tabular-nums;
    }
    :host([selected]) button {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .d {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dot);
      flex-shrink: 0;
    }
    :host([selected]) .d {
      outline: 2px solid color-mix(in srgb, var(--sw-text-inverse) 70%, transparent);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    :host([selected]) .count {
      color: var(--sw-text-inverse); /* UXREST-295: the 80 % mix read 3.7:1 on the accent fill; the count is the quieter figure by its brackets and size */
    }
    button:disabled {
      cursor: default;
      color: var(--sw-text-3);
      box-shadow: none;
      opacity: var(--sw-disabled-opacity);
    }
    button:disabled:hover {
      background: var(--sw-surface);
    }
  `;

  render() {
    return html`
      <button type="button" class="sw-hit" aria-pressed=${this.selected} ?disabled=${this.disabled}>
        ${this.dot ? html`<span class="d" style="--dot:${this.dot}"></span>` : ''}
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${13}></sw-icon>` : ''}
        <span class="t"><slot></slot></span>
        ${this.count !== undefined ? html`<span class="count">(${this.count})</span>` : ''}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-chip': SwChip;
  }
}
