import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

/**
 * AUDIT30-B-SHARED (design audit round 30, finding 4; owner gate Q3, recommended option א assumed until the owner answers): ONE selected
 * state for every chip / filter pill in the product - a soft accent field with the accent ink, no edge, a step heavier, no raised key.
 * (Measured before: black, navy, full-accent and soft fills on five screens; the classic skin drew the shared chip as a filled key.)
 * Drawn for sw-chip by the skin layer (design/skins/classic.ts rule 1 - the default skin; see the note on :host([selected]) below).
 * A screen that still owns a local chip imports this fragment instead of copying values:
 *   import { chipSelected } from '../components/sw-chip';
 *   css`.rc[aria-pressed='true'] { ${chipSelected} }`
 * The label / field pair is >= 4.5:1 in every live skin, light and dark (tests/unit-audit30b-shared.spec.ts).
 */
export const chipSelected = css`
  background: var(--sw-accent-soft);
  color: var(--sw-accent-text);
  border-color: transparent;
  font-weight: var(--sw-fw-semibold);
  box-shadow: none;
`;
/** The pressed / hovered selected chip: the same soft field one accent step deeper (tokens only). */
export const chipSelectedHover = css`
  background: color-mix(in srgb, var(--sw-accent) 14%, var(--sw-accent-soft));
  border-color: transparent;
`;

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
      /* second pass (break-ui): the text takes its own direction, so a Latin e-mail in the RTL shell is cut at its END, not its start */
      unicode-bidi: plaintext;
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
    /* AUDIT30-B-SHARED: the component's own selected state stays the accent key with inverse ink, because a skin that repaints the
       selected chip as an accent key (domus rule 6) sets only its background and relies on this ink - a soft-field ink here read
       accent-text on accent there (measured on the runner, pixel-round4-leftovers wk-overview domus). The soft field is drawn by the
       skin layer: classic rule 1 (the default skin) uses exactly chipSelected; the other skins follow when their owner adopts it. */
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
      outline: 2px solid var(--sw-chip-dot-ring, color-mix(in srgb, var(--sw-text-inverse) 70%, transparent));
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    :host([selected]) .count {
      color: var(--sw-chip-on-count, var(--sw-text-inverse)); /* UXREST-295: the 80 % mix read 3.7:1 on the accent fill; the count is the quieter figure by its brackets and size. AUDIT30-B: a skin that draws the soft field sets --sw-chip-on-count (classic: --sw-accent-text) */
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
