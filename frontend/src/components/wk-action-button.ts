import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { isWkIcon, wkIcon } from '../screens/wiskey-stations-icons';

/**
 * The one action button of the native stations screen (CR-036 slice S6): a door's "פתח", a call's answer / decline / end, the
 * announce icon, a station's name in a table row, the talk control's link to the classic panel. Its own shadow styles, so the
 * button looks the same in a card, a list row, a table cell (which renders inside sw-table's shadow root) and the drawer, and its
 * hit area meets the 44 px rule in touch layouts and the look dial (`--sw-touch-desktop`) on a desktop - whatever the skin.
 * A native `<button>` (or an `<a>` with `href`): Enter / Space and focus come for free, `disabled` is the native one.
 * Presentational only: the click is the host's own event (it bubbles and is composed); the screen decides what it does.
 */
@customElement('wk-action-button')
export class WkActionButton extends LitElement {
  /** default | ok (answer) | danger (decline, end) | primary | quiet (a link-like name) | dashed (the classic-panel talk). */
  @property({ reflect: true }) tone: 'default' | 'ok' | 'danger' | 'primary' | 'quiet' | 'dashed' = 'default';
  /** A shared icon name (sw-icon) or one of the local glyphs (phone, hangup, window, table). */
  @property() icon = '';
  @property({ type: Boolean, reflect: true, attribute: 'icon-only' }) iconOnly = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) busy = false;
  /** The first tap of a two-tap control: ringed until the second tap or the timeout. */
  @property({ type: Boolean, reflect: true }) armed = false;
  @property({ type: Boolean, reflect: true }) block = false;
  @property() size: 'md' | 'lg' = 'md';
  /** The accessible name when the visible text is not enough (icon-only controls, an armed control). */
  @property() label = '';
  /** A link instead of a button (the same look). */
  @property() href = '';

  static styles = css`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      /* WALL-OVERFLOW-2270: the slotted label is ellipsized by the inner span (.btn > span); the host says so too, so the
         label's full (unpainted) run past a narrow card - a long door name at 320 px - reads as ellipsized text, not as text
         cut by the card. No rendering change: text-overflow does not apply to the flex host itself. */
      text-overflow: ellipsis;
    }
    :host([block]) {
      display: flex;
    }
    :host([block]) .btn {
      inline-size: 100%;
    }
    .btn {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: var(--sw-touch-desktop, 44px);
      max-inline-size: 100%;
      padding-inline: var(--sw-s-3h);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1.2;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    .btn > span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([size='lg']) .btn {
      min-block-size: 56px;
      font-size: var(--sw-fs-md);
    }
    :host([icon-only]) .btn {
      padding-inline: 0;
    }
    .btn:hover {
      background: var(--sw-surface-2);
    }
    :host([tone='ok']) .btn {
      background: var(--sw-success-soft);
      border-color: transparent;
      color: var(--sw-success-text);
      box-shadow: none;
    }
    :host([tone='danger']) .btn {
      background: var(--sw-danger-soft);
      border-color: transparent;
      color: var(--sw-danger-text);
      box-shadow: none;
    }
    :host([tone='primary']) .btn {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    :host([tone='primary']) .btn:hover {
      background: var(--sw-accent-hover);
    }
    :host([tone='quiet']) .btn {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      padding-inline: var(--sw-s-1);
      justify-content: flex-start;
    }
    :host([tone='dashed']) .btn {
      background: transparent;
      border-style: dashed;
      color: var(--sw-text-2);
      box-shadow: none;
      font-weight: var(--sw-fw-regular);
    }
    :host([tone='ok']) .btn:hover,
    :host([tone='danger']) .btn:hover,
    :host([tone='quiet']) .btn:hover,
    :host([tone='dashed']) .btn:hover {
      background: var(--sw-hover-wash);
    }
    :host([armed]) .btn {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    :host([busy]) .btn {
      cursor: progress;
    }
    :host([disabled]) .btn {
      cursor: not-allowed;
      opacity: var(--sw-disabled-opacity);
    }
    .btn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      .btn {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;

  private glyph() {
    if (!this.icon) return nothing;
    return isWkIcon(this.icon) ? wkIcon(this.icon, 16) : html`<sw-icon .name=${this.icon as IconName} size=${16}></sw-icon>`;
  }

  render() {
    const text = this.iconOnly ? nothing : html`<span><slot></slot></span>`;
    const name = this.label || nothing;
    if (this.href && !this.disabled) return html`<a class="btn" href=${this.href} aria-label=${name}>${this.glyph()}${text}</a>`;
    return html`<button class="btn" type="button" ?disabled=${this.disabled} aria-label=${name} aria-busy=${this.busy ? 'true' : nothing}>${this.glyph()}${text}</button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-action-button': WkActionButton;
  }
}
