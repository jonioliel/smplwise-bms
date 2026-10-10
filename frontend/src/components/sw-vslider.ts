import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { LookController } from '../design/look';

/**
 * The vertical slider of the Bubble skin (BV1, 2026-10-05; the Bubble Card "vertical slider" button): a tall pill whose fill grows
 * from the BOTTOM (a vertical axis has no RTL mirror), the icon ring at the top, the value and the label at the bottom. Drag along it
 * sets `value` 0..1 (`input` while dragging, `change` on release, the same events as sw-pill's slider), a tap toggles (`toggle`),
 * ArrowUp / ArrowDown step 5 %, PageUp / PageDown 20 %, Home / End the ends. `on` paints the fill (`fill-color`, default `--sw-lit`);
 * `unavailable` greys it and blocks input; `readonly` shows the state only. Width = 44 px minimum (the touch target), height
 * `--sw-vslider-h` (160 px). The surface dial applies: `none` = an outlined track, `glass` = a translucent one.
 */
@customElement('sw-vslider')
export class SwVSlider extends LitElement {
  @property() icon: IconName = 'light';
  @property() label = '';
  /** The state line ("72%", "כבוי"); '' = the percentage while on. */
  @property() state = '';
  @property({ type: Number }) value = 0;
  @property({ type: Boolean, reflect: true }) on = false;
  @property({ attribute: 'fill-color' }) fillColor = '';
  @property({ type: Boolean, reflect: true }) unavailable = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** The surface: set by a host that shows a draft; '' = follow the look dial. */
  @property() surface: '' | 'flat' | 'glass' | 'gradient' | 'fill' | 'none' = '';
  private look = new LookController(this);
  private drag: { y0: number; id: number; moved: boolean } | null = null;

  static styles = css`
    :host {
      --fill: 0;
      --fill-c: var(--sw-lit);
      --vs-w: max(var(--sw-touch-desktop), calc(72px * var(--sw-look-scale)));
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      box-sizing: border-box;
      inline-size: var(--vs-w);
      min-inline-size: var(--sw-touch-desktop);
      block-size: calc(var(--sw-vslider-h, 160px) * var(--sw-look-scale));
      padding: 8px 4px;
      border-radius: var(--sw-r-lg);
      background: var(--pill-base, var(--sw-surface));
      color: var(--sw-text);
      font-family: var(--sw-font);
      font-size: calc(var(--sw-fs-state) * var(--sw-look-scale));
      user-select: none;
      -webkit-user-select: none;
      cursor: ns-resize;
      touch-action: pan-x;
      transition: background var(--sw-t-state) var(--sw-ease);
    }
    :host(:focus-visible) {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* the fill: from the bottom edge up */
    :host::before {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      z-index: -1;
      block-size: calc(var(--fill) * 100%);
      background: var(--fill-c);
      transition: block-size var(--sw-t-med) var(--sw-ease), background var(--sw-t-state) var(--sw-ease);
    }
    :host([data-dragging])::before {
      transition: none;
    }
    :host(:not([on]))::before {
      block-size: 0;
    }
    :host([unavailable]) {
      opacity: 0.55;
      cursor: not-allowed;
    }
    :host([readonly]) {
      cursor: default;
    }
    .ring {
      flex: none;
      inline-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      block-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      max-inline-size: calc(100% - 4px);
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    :host([on]) .ring {
      background: rgba(0, 0, 0, 0.16);
      color: var(--sw-on-lit);
    }
    .tx {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      min-inline-size: 0;
      max-inline-size: 100%;
      text-align: center;
    }
    .v {
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
      direction: ltr;
      unicode-bidi: isolate;
    }
    .nm {
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.86;
    }
    /* once the fill passes the text, the text takes the on-fill colour (one colour per state; the bar is tall enough to read either way) */
    :host([on][data-high]) .tx {
      color: var(--sw-on-lit);
    }
    /* the surface dial */
    :host([data-surface='glass']) {
      background: var(--sw-perf-glass-bg, rgba(var(--sw-sheet-rgb), 0.42));
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong);
    }
    :host([data-surface='none']) {
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    :host([data-surface='none']:not([on]):hover) {
      background: var(--sw-layer);
    }
    @media (max-width: 1100px) {
      :host {
        min-inline-size: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host,
      :host::before {
        transition: none !important;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.setAttribute('role', 'slider');
    this.addEventListener('pointerdown', this.onDown);
    this.addEventListener('pointermove', this.onMove);
    this.addEventListener('pointerup', this.onUp);
    this.addEventListener('pointercancel', this.onUp);
    this.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    this.removeEventListener('pointerdown', this.onDown);
    this.removeEventListener('pointermove', this.onMove);
    this.removeEventListener('pointerup', this.onUp);
    this.removeEventListener('pointercancel', this.onUp);
    this.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private clamp(v: number) {
    return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  }

  private setFromPointer(y: number) {
    const r = this.getBoundingClientRect();
    const v = this.clamp((r.bottom - y) / r.height);
    if (v !== this.value) {
      this.value = v;
      this.emit('input', { value: v });
    }
  }

  private onDown = (e: PointerEvent) => {
    if (this.unavailable || this.readonly) return;
    this.drag = { y0: e.clientY, id: e.pointerId, moved: false };
  };
  private onMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dy = e.clientY - this.drag.y0;
    if (!this.drag.moved && Math.abs(dy) > 6) {
      this.drag.moved = true;
      this.setAttribute('data-dragging', '');
      try {
        this.setPointerCapture(e.pointerId);
      } catch {
        /* no capture */
      }
    }
    if (this.drag.moved) this.setFromPointer(e.clientY);
  };
  private onUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const moved = this.drag.moved;
    this.drag = null;
    this.removeAttribute('data-dragging');
    if (moved) {
      this.emit('change', { value: this.value });
      return;
    }
    if (e.type === 'pointerup') this.emit('toggle', { on: !this.on });
  };
  private onKey = (e: KeyboardEvent) => {
    if (this.unavailable || this.readonly) return;
    const step: Record<string, number> = { ArrowUp: 0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2, Home: -1, End: 1 };
    const s = step[e.key];
    if (s !== undefined) {
      e.preventDefault();
      this.value = this.clamp(this.value + s);
      this.emit('input', { value: this.value });
      this.emit('change', { value: this.value });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.emit('toggle', { on: !this.on });
    }
  };

  protected willUpdate() {
    const fill = this.on ? this.value : 0;
    this.style.setProperty('--fill', String(fill));
    if (this.fillColor) this.style.setProperty('--fill-c', this.fillColor);
    else this.style.removeProperty('--fill-c');
    this.toggleAttribute('data-high', this.on && this.value > 0.42);
  }

  protected updated() {
    const pct = Math.round((this.on ? this.value : 0) * 100);
    this.setAttribute('aria-valuemin', '0');
    this.setAttribute('aria-valuemax', '100');
    this.setAttribute('aria-valuenow', String(pct));
    this.setAttribute('aria-valuetext', this.state || `${pct}%`);
    this.setAttribute('aria-orientation', 'vertical');
    this.setAttribute('aria-label', this.label);
    if (this.unavailable) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    if (this.readonly) this.setAttribute('aria-readonly', 'true');
    else this.removeAttribute('aria-readonly');
    this.setAttribute('data-surface', this.surface || this.look.of('surface'));
  }

  render() {
    const pct = Math.round(this.value * 100);
    return html`<span class="ring" aria-hidden="true"><sw-icon .name=${this.icon} size=${20}></sw-icon></span>
      <span class=${classMap({ tx: true })}><span class="v">${this.state || (this.on ? `${pct}%` : '—')}</span>${this.label ? html`<span class="nm">${this.label}</span>` : nothing}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-vslider': SwVSlider;
  }
}
