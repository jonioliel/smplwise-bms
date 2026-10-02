import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import type { StateKind } from './sw-badge';

/**
 * Stat tile as on the boards: icon in a soft-blue square, big value, label, green/amber sub-label.
 *
 * Owner 2026-09-29 (overview tiles):
 * - `layout`: `cards` (default - the tall tile, icon above) or `compact` (a rectangle: the icon at the inline-start
 *   side, the value and label beside it on one line - a long label wraps to a second line, then ellipsis - and one
 *   line of secondary text). The screen resolves `ui.tile_layout` (api/tile-layout.ts) and passes it here. The compact
 *   sizes are the `--sw-kpi-compact-*` custom properties (the knobs: styles/tile-knobs.ts, DEVICE_THEMES.md §9).
 * - a tile can be a real control: `href` makes it a link (a navigation), `action` a button (it opens something on the
 *   same screen; `expanded` is its aria-expanded). The hit area is the whole tile, a native <a> / <button> laid over
 *   it, named by the tile's own text; the host's `title` carries the full text for a label cut by the ellipsis.
 */
@customElement('sw-kpi')
export class SwKpi extends LitElement {
  @property() label = '';
  @property() value = '';
  @property() detail = '';
  @property() icon: IconName = 'info';
  @property({ reflect: true }) tone: StateKind = 'neutral';
  @property() badge = '';
  @property({ reflect: true }) layout: 'cards' | 'compact' = 'cards';
  /** A navigation: the whole tile is this link. */
  @property() href = '';
  /** A button: the whole tile is a button (the host's own click event carries the press). */
  @property({ type: Boolean }) action = false;
  @property({ type: Boolean }) expanded = false;
  /** Compact layout: the icon sits at the END of the text block (the left side in Hebrew) instead of the start. */
  @property({ type: Boolean, reflect: true, attribute: 'icon-end' }) iconEnd = false;
  /** Words added to the control's accessible name ("הצג ושלוט", "פתח"). */
  @property() hint = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
      position: relative;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      flex: none;
    }
    :host([tone='error']) .icon,
    :host([tone='offline']) .icon {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    :host([tone='stale']) .icon,
    :host([tone='partial']) .icon {
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
    }
    :host([tone='live']) .icon {
      background: var(--sw-live-soft);
      color: var(--sw-success-text);
    }
    .txt {
      min-inline-size: 0;
    }
    .value,
    .label {
      display: block;
    }
    .value {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
    }
    .label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 2px;
    }
    .detail {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-success-text);
      margin-block-start: 1px;
      font-variant-numeric: tabular-nums;
    }
    :host([tone='stale']) .detail,
    :host([tone='partial']) .detail {
      color: var(--sw-warning-text);
    }
    :host([tone='error']) .detail,
    :host([tone='offline']) .detail {
      color: var(--sw-danger);
    }
    :host([tone='neutral']) .detail {
      color: var(--sw-text-3);
    }
    .badge {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-start: 10px;
      background: var(--sw-danger);
      color: #fff;
      font-size: 9.5px;
      font-weight: var(--sw-fw-semibold);
      border-radius: var(--sw-r-pill);
      padding: 1px 7px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    /* ---- compact: a rectangle, the icon beside the text (knobs: --sw-kpi-compact-*) ---- */
    :host([layout='compact']) {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      column-gap: var(--sw-kpi-compact-gap, 10px);
      row-gap: 0;
      box-sizing: border-box;
      min-block-size: var(--sw-kpi-compact-min-block, 60px);
      padding-block: var(--sw-kpi-compact-pad-block, 8px);
      padding-inline: var(--sw-kpi-compact-pad-inline, 12px);
    }
    :host([layout='compact']) .icon {
      inline-size: var(--sw-kpi-compact-icon, 32px);
      block-size: var(--sw-kpi-compact-icon, 32px);
    }
    /* owner 2026-09-30 (home screen): the icon at the end of the text block - the left side in Hebrew */
    :host([layout='compact'][icon-end]) {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    :host([layout='compact'][icon-end]) .icon {
      order: 2;
    }
    /* the value above its label: the text block stays narrow enough for a small tile */
    :host([layout='compact'][icon-end]) .value,
    :host([layout='compact'][icon-end]) .label {
      display: block;
      margin: 0;
    }
    :host([layout='compact'][icon-end]) .label {
      line-height: 1.25;
    }
    /* the value and the label on one line; a long label wraps once, then ellipsis (the full text is the host's title) */
    :host([layout='compact']) .line {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
      line-height: 1.25;
    }
    :host([layout='compact']) .value,
    :host([layout='compact']) .label {
      display: inline;
      margin: 0;
    }
    :host([layout='compact']) .value {
      font-size: var(--sw-kpi-compact-value-fs, 17px);
      line-height: 1.2;
      margin-inline-end: 6px;
    }
    :host([layout='compact']) .label {
      font-size: var(--sw-fs-xs);
    }
    :host([layout='compact']) .detail {
      margin-block-start: 1px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* review M6: the badge rides the tile's top corner - it never takes a column from the value and the label */
    :host([layout='compact']) .badge {
      inset-block-start: -7px;
      inset-inline-end: 8px;
      z-index: 2;
      pointer-events: none;
    }

    /* ---- a tile that is a control: the native link / button covers it ---- */
    .hit {
      position: absolute;
      inset: 0;
      z-index: 1;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: inherit;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .hit:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    :host([interactive]) {
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    :host([interactive]:hover),
    :host([interactive][data-expanded]) {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    :host([interactive][data-expanded]) {
      border-color: var(--sw-accent);
    }
  `;

  /** Everything the tile says, in reading order: the control's accessible name and the host's tooltip. */
  private get words(): string {
    return [`${this.value} ${this.label}`.trim(), this.detail, this.badge].filter(Boolean).join(' · ');
  }

  protected willUpdate(changed: PropertyValues<this>) {
    const interactive = !!this.href || this.action;
    this.toggleAttribute('interactive', interactive);
    this.toggleAttribute('data-expanded', this.action && this.expanded);
    if (changed.has('value') || changed.has('label') || changed.has('detail') || changed.has('badge')) this.title = this.words;
  }

  render() {
    const name = [this.words, this.hint].filter(Boolean).join(' · ');
    // review low: the control carries the whole text as its name - the visible text is not read a second time
    const interactive = !!this.href || this.action;
    return html`
      <div class="icon" aria-hidden=${interactive ? 'true' : nothing}><sw-icon .name=${this.icon} size=${16}></sw-icon></div>
      <div class="txt" aria-hidden=${interactive ? 'true' : nothing}>
        <div class="line"><span class="value">${this.value}</span> <span class="label">${this.label}</span></div>
        ${this.detail ? html`<div class="detail">${this.detail}</div>` : nothing}
      </div>
      ${this.badge ? html`<span class="badge" aria-hidden=${interactive ? 'true' : nothing}>${this.badge}</span>` : nothing}
      ${this.href
        ? html`<a class="hit" href=${this.href} aria-label=${name}></a>`
        : this.action
          ? html`<button class="hit" type="button" aria-haspopup="dialog" aria-expanded=${String(this.expanded)} aria-label=${name}></button>`
          : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-kpi': SwKpi;
  }
}
