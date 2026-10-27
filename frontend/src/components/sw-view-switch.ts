import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { isWkIcon, wkIcon } from '../screens/wiskey-stations-icons';

export interface ViewOption {
  id: string;
  label: string;
  /** A shared icon name (sw-icon) or one of the local glyphs (screens/wiskey-stations-icons.ts). */
  icon: string;
}

/**
 * The cards / list / table choice of a screen, as a segmented control of icon buttons (CR-036 slice S6, the design's
 * `sw-view-switch`). Presentational: it fires `change` with the chosen id and the screen keeps the choice (the stations screen
 * remembers it per browser). Every button is a native button with an accessible name, `aria-pressed`, and a hit area that meets
 * the 44 px rule in touch layouts and the look dial on a desktop.
 */
@customElement('sw-view-switch')
export class SwViewSwitch extends LitElement {
  @property() value = '';
  @property({ attribute: false }) options: ViewOption[] = [];
  /** The group's accessible name. */
  @property() label = '';

  static styles = css`
    :host {
      display: inline-flex;
    }
    .group {
      display: inline-flex;
      gap: var(--sw-s-1);
      padding: var(--sw-s-1);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    button {
      box-sizing: border-box;
      display: grid;
      place-items: center;
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: var(--sw-touch-desktop);
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover {
        background: var(--sw-hover-wash);
      }
    }
    button[aria-pressed='true'] {
      background: var(--sw-surface-solid);
      color: var(--sw-heading);
      box-shadow: var(--sw-shadow-1);
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;

  private pick(id: string) {
    if (id === this.value) return;
    this.value = id;
    this.dispatchEvent(new CustomEvent('change', { detail: id, bubbles: true, composed: true }));
  }

  render() {
    return html`<div class="group" role="group" aria-label=${this.label}>
      ${this.options.map(
        (o) => html`<button type="button" data-view=${o.id} aria-pressed=${String(o.id === this.value)} aria-label=${o.label} title=${o.label} @click=${() => this.pick(o.id)}>
          ${isWkIcon(o.icon) ? wkIcon(o.icon, 18) : html`<sw-icon .name=${o.icon as IconName} size=${18}></sw-icon>`}
        </button>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-view-switch': SwViewSwitch;
  }
}
