import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { PlaceRow } from '../screens/wiskey-stations-logic';

/**
 * A places tree used as a filter (CR-036 slice S6, the design's `sw-place-tree`): "all", then floors (collapsible) with their
 * areas, state dots and counts. The owner's rule "the floors / areas tree survives in every design" - the same look as the
 * building screen's tree, built here as its own component because the stations, activity and schedules screens all need it as
 * a filter. Presentational: rows come from `placeRows()` (screens/wiskey-stations-logic.ts); it fires `place-select` (detail: the
 * row id) and `place-toggle` (detail: the floor row id). Every row is a native button, `aria-current` marks the selection and a
 * floor carries `aria-expanded`.
 */
@customElement('sw-place-tree')
export class SwPlaceTree extends LitElement {
  @property({ attribute: false }) rows: PlaceRow[] = [];
  @property() selected = 'all';
  @property() heading = '';
  /** Accessible names of a floor's fold button. */
  @property() foldLabel = '';
  @property() unfoldLabel = '';

  static styles = css`
    :host {
      display: block;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--sw-s-2);
    }
    .ttl {
      padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-1);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .line {
      display: flex;
      align-items: stretch;
      gap: 2px;
    }
    button {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    button:hover {
      background: var(--sw-hover-wash);
    }
    button.pick {
      flex: 1;
      min-inline-size: 0;
    }
    button.pick .name {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    button.fold {
      justify-content: center;
      min-inline-size: var(--sw-touch-desktop, 44px);
      padding-inline: 0;
      color: var(--sw-text-3);
    }
    button.fold sw-icon {
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    button.fold[aria-expanded='false'] sw-icon {
      transform: rotate(90deg);
    }
    .floor .name {
      font-weight: var(--sw-fw-semibold);
    }
    .depth-1 {
      padding-inline-start: var(--sw-s-4);
    }
    button[aria-current='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .n {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .dot.off {
      background: var(--sw-offline);
    }
    .dot.mixed {
      background: var(--sw-unknown);
    }
    /* CR-MAINT215: a place's worst due state */
    .dot.alarm {
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .dot.ok {
      background: var(--sw-success);
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      button {
        min-block-size: 44px;
      }
      button.fold {
        min-inline-size: 44px;
      }
    }
  `;

  private select(id: string) {
    this.dispatchEvent(new CustomEvent('place-select', { detail: id, bubbles: true, composed: true }));
  }

  private toggle(id: string) {
    this.dispatchEvent(new CustomEvent('place-toggle', { detail: id, bubbles: true, composed: true }));
  }

  private row(r: PlaceRow) {
    const current = String(r.id === this.selected);
    if (r.kind === 'floor') {
      return html`<div class="line floor" data-place-row=${r.id}>
        <button type="button" class="fold" aria-expanded=${String(!!r.open)} aria-label=${(r.open ? this.foldLabel : this.unfoldLabel) + ' ' + r.name} data-place-fold=${r.id} @click=${() => this.toggle(r.id)}>
          <sw-icon name="chevronDown" size=${14}></sw-icon>
        </button>
        <button type="button" class="pick" aria-current=${current} data-place-pick=${r.id} @click=${() => this.select(r.id)}>
          <span class="name">${r.name}</span><span class="n">${r.count}</span>
        </button>
      </div>`;
    }
    return html`<div class="line" data-place-row=${r.id}>
      <button type="button" class="pick ${r.depth === 1 ? 'depth-1' : ''}" aria-current=${current} data-place-pick=${r.id} @click=${() => this.select(r.id)}>
        ${r.kind === 'all' ? html`<sw-icon name="pin" size=${14}></sw-icon>` : r.dot ? html`<span class="dot ${r.dot === 'live' ? '' : r.dot}" aria-hidden="true"></span>` : nothing}
        <span class="name">${r.name}</span><span class="n">${r.count}</span>
      </button>
    </div>`;
  }

  render() {
    return html`<nav aria-label=${this.heading}>${this.heading ? html`<div class="ttl">${this.heading}</div>` : nothing}${this.rows.map((r) => this.row(r))}</nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-place-tree': SwPlaceTree;
  }
}
