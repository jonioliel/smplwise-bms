import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { LookController } from '../design/look';

export type PillVariant = 'plain' | 'toggle' | 'slider';

/**
 * The pill row of the Bubble foundation (owner 2026-10-02; the Bubble Card "button"): an icon ring, a label, a state line and
 * sub-buttons at the end (slot `subs`) that WRAP UNDER the label when the row is narrow - nothing ever leaves the bubble.
 *
 * `variant`: `plain` (a row that opens something: fires `activate`), `toggle` (role switch: tap / Enter / Space fires `toggle`),
 * `slider` (role slider: tap toggles, dragging along the pill sets `value` 0..1 - the fill grows from the inline start - keyboard
 * arrows step 5 %, Page Up / Down 20 %; fires `input` while dragging and `change` on release). The ring is its own 44 px button
 * (`icon-click`, for the device pop-up). `on` paints the fill (`--sw-lit`, or `fill-color`); the label is drawn twice and clipped at
 * the fill edge, so text keeps its contrast on both sides (the mockup's dual-colour label). `hue` 1..8 colours the ring
 * (decoration only) and, in the gradient surface, washes the pill. `unavailable` greys the row and blocks input.
 *
 * Sizes and colours are tokens the look dials rewrite (`--sw-pill-h`, `--sw-icon-ring`, `--sw-sub`, `--sw-fs-name`, `--sw-r-pill`,
 * `--sw-look-scale`, the surface attribute of <html>); every target is >= 44 px in touch layouts (<= 1100 px) and
 * `--sw-touch-desktop` (44 / 32) on a desktop. `density="row"` (the list view) is set by the host container, or follows the dial.
 */
@customElement('sw-pill')
export class SwPill extends LitElement {
  @property() icon: IconName = 'light';
  @property() label = '';
  /** The state line under the label ("דולק · 72%"). */
  @property() state = '';
  @property() variant: PillVariant = 'plain';
  @property({ type: Boolean, reflect: true }) on = false;
  /** 0..1, the slider's value (and the fill while `on`). */
  @property({ type: Number }) value = 0;
  /** The fill colour while on (a token or colour); the default is the warm `--sw-lit`. */
  @property({ attribute: 'fill-color' }) fillColor = '';
  /** 1..8: the decorative hue of the ring (and the gradient surface's wash). 0 = none. */
  @property({ type: Number }) hue = 0;
  @property({ type: Boolean, reflect: true }) unavailable = false;
  /** Read-only: the row shows its state but takes no tap, drag or key (no permission to control); the ring still opens the sheet. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Accent fill (a switch that is on, the "all off" row). */
  @property({ type: Boolean, reflect: true }) accent = false;
  /** A translucent fill (a cover's position, a fan's speed): the label keeps its one colour, no dual-colour clip. */
  @property({ type: Boolean, reflect: true, attribute: 'keep-text' }) keepText = false;
  /** The ring is a plain badge, not a button (a pill that is itself the head of its own sheet). */
  @property({ type: Boolean, reflect: true, attribute: 'ring-static' }) ringStatic = false;
  /** The list view: set by the host container when its density is `row`; '' = follow the look dial. */
  @property() density: '' | 'wide' | 'regular' | 'compact' | 'row' = '';
  /** The surface: set by a host that shows a draft (the settings preview); '' = follow the look dial. */
  @property() surface: '' | 'flat' | 'glass' | 'gradient' | 'fill' | 'none' = '';
  @state() private hasSubs = false;
  private look = new LookController(this);
  private drag: { x0: number; y0: number; id: number; moved: boolean } | null = null;

  static styles = css`
    :host {
      --fill: 0;
      --fill-c: var(--sw-lit);
      --h: var(--sw-accent);
      --pill-pad: 8px;
      --pill-gap: 10px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px var(--pill-gap);
      position: relative;
      isolation: isolate;
      overflow: hidden;
      box-sizing: border-box;
      min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
      padding-inline: var(--pill-pad);
      padding-block: 4px;
      border-radius: var(--sw-r-pill);
      background: var(--pill-base, var(--sw-surface)); /* --pill-base: a host puts the pill on a translucent sheet (--sw-layer) */
      color: var(--sw-text);
      font-family: var(--sw-font);
      font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
      line-height: 1.35;
      user-select: none;
      -webkit-user-select: none;
      transition: background var(--sw-t-state) var(--sw-ease), color var(--sw-t-med) var(--sw-ease);
      container-type: inline-size;
    }
    :host(:focus-visible) {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* the fill grows from the inline start (RTL: from the right) */
    :host::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      z-index: -1;
      inline-size: calc(var(--fill) * 100%);
      background: var(--fill-c);
      transition: inline-size var(--sw-t-med) var(--sw-ease), background var(--sw-t-state) var(--sw-ease);
    }
    :host([data-dragging])::before {
      transition: none;
    }
    /* a palette whose fill is under 3:1 against the track marks the fill's end (transparent otherwise) */
    :host([variant='slider'])::before {
      box-sizing: border-box;
      border-inline-end: 3px solid var(--sw-fill-edge);
    }
    :host(:not([on]))::before,
    :host([accent])::before {
      inline-size: 0;
      border-inline-end-width: 0;
    }
    :host([variant='slider']) {
      cursor: ew-resize;
      touch-action: pan-y;
    }
    :host([variant='toggle']),
    :host([variant='plain']) {
      cursor: pointer;
    }
    :host([variant='plain']:hover),
    :host([variant='toggle']:not([on]):hover) {
      background: var(--sw-surface-3);
    }
    :host([accent]) {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    :host([unavailable]) {
      opacity: 0.55;
      cursor: not-allowed;
    }
    :host([readonly]) {
      cursor: default;
    }
    :host([readonly][variant='plain']:hover),
    :host([readonly][variant='toggle']:not([on]):hover) {
      background: var(--pill-base, var(--sw-surface));
    }
    .ring {
      flex: none;
      inline-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      block-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      border-radius: 50%;
      border: 0;
      padding: 0;
      display: grid;
      place-items: center;
      cursor: pointer;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      transition: background var(--sw-t-state) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease-thumb);
    }
    .ring:hover {
      transform: scale(1.06);
    }
    .ring:active {
      transform: scale(0.94);
    }
    .ring:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    span.ring {
      cursor: default;
    }
    span.ring:hover {
      transform: none;
    }
    .ring.hue {
      background: var(--h);
      color: var(--sw-ring-on-hue);
    }
    :host([on]) .ring:not(.hue) {
      background: rgba(0, 0, 0, 0.16);
      color: var(--sw-on-lit);
    }
    :host([accent]) .ring {
      background: rgba(0, 0, 0, 0.18);
      color: var(--sw-text-inverse);
    }
    :host(:not([on]):not([accent])) .ring sw-icon {
      opacity: 0.8;
    }
    /* the text, drawn twice in a slider: the base colour, and the on-fill colour clipped to the fill (same box, so wrapping never misaligns them) */
    .txw {
      position: relative;
      flex: 1 1 96px;
      min-inline-size: 0;
      min-block-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      display: flex;
    }
    .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    /* a full fill (a switch that is on, a flat-surface state): the text simply takes the on-fill colour */
    :host([on][variant='toggle']:not([accent])) .tx.base,
    :host([on][variant='plain']:not([accent])) .tx.base,
    :host([on][data-surface='flat']:not([accent])) .tx.base,
    :host([on][variant='toggle']:not([accent])) .pct,
    :host([on][data-surface='flat']:not([accent])) .pct {
      color: var(--sw-on-lit);
    }
    .nm {
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .st {
      font-size: calc(var(--sw-fs-state) * var(--sw-look-scale));
      opacity: 0.86;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tx.over {
      position: absolute;
      inset: 0;
      pointer-events: none;
      color: var(--sw-on-lit);
      /* --lay-s: where this layer starts, from the pill's inline start; the fill edge is --fill * 100cqw from there (the host is the container).
         Visible = the part of the layer before the fill edge; the rest is clipped on the inline-END side (LTR: right, RTL: left). */
      --lay-s: calc(var(--pill-pad) + max(var(--sw-touch-desktop), var(--sw-icon-ring) * var(--sw-look-scale)) + var(--pill-gap));
      --lay-cut: calc(100% - (var(--fill) * 100cqw - var(--lay-s)));
      clip-path: inset(-2px var(--lay-cut) -2px -2px);
      transition: clip-path var(--sw-t-med) var(--sw-ease);
    }
    :host(:dir(rtl)) .tx.over {
      clip-path: inset(-2px -2px -2px var(--lay-cut));
    }
    :host(:not([on])) .tx.over,
    :host(:not([variant='slider'])) .tx.over,
    :host([data-surface='flat']) .tx.over,
    :host([keep-text]) .tx.over,
    :host([accent]) .tx.over {
      display: none;
    }
    :host([keep-text][on][data-surface='flat']:not([accent])) .tx.base,
    :host([keep-text][on][data-surface='flat']:not([accent])) .pct {
      color: var(--sw-text);
    }
    :host([data-dragging]) .tx.over {
      transition: none;
    }
    /* sub-buttons wrap under the label when the row is too narrow; every target 44 px in touch layouts */
    .subs {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
      margin-inline-start: auto;
      max-inline-size: 100%;
    }
    .subs[hidden] {
      display: none;
    }
    ::slotted(*) {
      --sw-sub-size: calc(var(--sw-sub) * var(--sw-look-scale));
    }
    .pct {
      font-size: calc(var(--sw-fs-state) * var(--sw-look-scale));
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      min-inline-size: 38px;
      text-align: center;
      position: relative;
    }
    /* ---- the list view (density row): rows touch, only the group's outer corners are round ---- */
    :host([data-density='row']) {
      border-radius: min(10px, var(--sw-r-md));
    }
    :host([data-density='row']:first-child) {
      border-start-start-radius: var(--sw-r-lg);
      border-start-end-radius: var(--sw-r-lg);
    }
    :host([data-density='row']:last-child) {
      border-end-start-radius: var(--sw-r-lg);
      border-end-end-radius: var(--sw-r-lg);
    }
    :host([data-density='wide']) {
      --pill-pad: 11px;
      --pill-gap: 14px;
    }
    :host([data-density='compact']) {
      --pill-pad: 6px;
      --pill-gap: 8px;
    }
    /* ---- the surface dial ---- */
    /* flat: a state is the whole pill (no partial fill) */
    :host([data-surface='flat'][on])::before {
      inline-size: 100%;
    }
    /* gradient: a hue-to-hue wash with a solid hue ring; the lit part is a light tint of the hue with dark text */
    :host([data-surface='gradient']:not([accent])) {
      background: linear-gradient(100deg, color-mix(in oklab, var(--h) var(--sw-wash-start), var(--sw-surface)) 0%, color-mix(in oklab, var(--h) var(--sw-wash-end), var(--sw-surface)) 100%);
    }
    :host([data-surface='gradient']:not([accent])) .ring {
      background: var(--h);
      color: var(--sw-ring-on-hue);
    }
    :host([data-surface='gradient'][on]:not([accent]))::before {
      background: color-mix(in oklab, var(--h) var(--sw-wash-lit), #fff);
    }
    /* glass: a translucent, blurred layer over the canvas */
    :host([data-surface='glass']:not([accent])) {
      /* the lite tier (performance dial): no blur on a pill, a tinted near-solid fill at the contrast-computed alpha */
      background: var(--sw-perf-glass-bg, rgba(var(--sw-sheet-rgb), 0.42));
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(16px) saturate(150%));
      backdrop-filter: var(--sw-perf-blur, blur(16px) saturate(150%));
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong);
    }
    :host([data-surface='glass']) .ring:not(.hue) {
      background: var(--sw-layer-2);
    }
    @media (prefers-reduced-transparency: reduce) {
      :host([data-surface='glass']:not([accent])) {
        background: var(--sw-surface);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
    }
    /* none (BV1, the surfaceless look): no fill at all - the ring and the text on the canvas; a lit pill shows its fill as a 4 px bar
       under the text (the fill still grows from the inline start, so the slider reads the same); hover is a faint layer */
    :host([data-surface='none']:not([accent])) {
      background: transparent;
      box-shadow: none;
    }
    :host([data-surface='none'][variant='plain']:not([accent]):hover),
    :host([data-surface='none'][variant='toggle']:not([on]):not([accent]):hover) {
      background: var(--sw-layer);
    }
    :host([data-surface='none']:not([accent]))::before {
      inset-block: auto 0;
      block-size: 4px;
      border-radius: 2px;
      border-inline-end-width: 0;
      inline-size: calc(var(--fill) * (100% - 2 * var(--pill-pad)));
      margin-inline-start: var(--pill-pad);
    }
    :host([data-surface='none'][on]:not([accent])) .tx.base,
    :host([data-surface='none'][on]:not([accent])) .pct {
      color: var(--sw-text);
    }
    :host([data-surface='none']) .tx.over {
      display: none;
    }
    :host([data-surface='none'][on]) .ring:not(.hue) {
      background: var(--fill-c);
      color: var(--sw-on-lit);
    }
    /* a list of surfaceless rows: a hairline under each row instead of touching fills */
    :host([data-surface='none'][data-density='row']:not(:last-child)) {
      box-shadow: inset 0 -1px 0 var(--sw-border-strong);
    }
    /* ---- touch layouts: 44 px targets whatever the density says ---- */
    @media (max-width: 1100px) {
      :host {
        min-block-size: max(calc(var(--sw-pill-h) * var(--sw-look-scale)), 52px);
      }
      .ring {
        min-inline-size: 44px;
        min-block-size: 44px;
      }
      .tx.over {
        --lay-s: calc(var(--pill-pad) + max(44px, var(--sw-icon-ring) * var(--sw-look-scale)) + var(--pill-gap));
      }
      ::slotted(*) {
        --sw-sub-size: max(44px, calc(var(--sw-sub) * var(--sw-look-scale)));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host,
      :host::before,
      .ring,
      .tx.over {
        transition: none !important;
      }
    }
  `;

  private get role_(): string {
    return this.variant === 'slider' ? 'slider' : this.variant === 'toggle' ? 'switch' : 'button';
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
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

  /** The row's main action: a slider / switch toggles, a plain row activates. */
  private tap() {
    if (this.unavailable || this.readonly) return;
    if (this.variant === 'plain') this.emit('activate');
    else this.emit('toggle', { on: !this.on });
  }

  private clamp(v: number) {
    return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  }

  private setFromPointer(x: number) {
    const r = this.getBoundingClientRect();
    const rtl = getComputedStyle(this).direction === 'rtl';
    const v = this.clamp(rtl ? (r.right - x) / r.width : (x - r.left) / r.width);
    if (v !== this.value) {
      this.value = v;
      this.emit('input', { value: v });
    }
  }

  private onDown = (e: PointerEvent) => {
    if (this.unavailable || this.readonly) return;
    const t = e.composedPath()[0] as HTMLElement;
    if (t instanceof HTMLElement && (t.closest('.ring') || t.closest('.subs') || t.assignedSlot?.name === 'subs')) return;
    // a sub-button slotted from the light DOM: its own click, not the pill's
    const path = e.composedPath();
    if (path.some((n) => n instanceof HTMLElement && n !== this && n.slot === 'subs')) return;
    this.drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId, moved: false };
  };
  private onMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id || this.variant !== 'slider') return;
    const dx = e.clientX - this.drag.x0;
    if (!this.drag.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - this.drag.y0)) {
      this.drag.moved = true;
      this.setAttribute('data-dragging', '');
      try {
        this.setPointerCapture(e.pointerId);
      } catch {
        /* no capture */
      }
    }
    if (this.drag.moved) this.setFromPointer(e.clientX);
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
    if (e.type === 'pointerup') this.tap();
  };
  private onKey = (e: KeyboardEvent) => {
    // only the pill itself: a key on the ring or on a slotted sub-button is theirs (the host listener sees them retargeted to the host)
    if (e.composedPath()[0] !== this || this.unavailable || this.readonly) return;
    if (this.variant === 'slider') {
      // RTL: ArrowLeft moves toward the fill's growth (the mockup's rule); LTR the other way round
      const rtl = getComputedStyle(this).direction === 'rtl';
      const step: Record<string, number> = { ArrowUp: 0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2, ArrowLeft: rtl ? 0.05 : -0.05, ArrowRight: rtl ? -0.05 : 0.05, Home: -1, End: 1 };
      const s = step[e.key];
      if (s !== undefined) {
        e.preventDefault();
        this.value = this.clamp(this.value + s);
        this.emit('input', { value: this.value });
        this.emit('change', { value: this.value });
        return;
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.tap();
    }
  };

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('variant') || !this.hasAttribute('role')) this.setAttribute('role', this.role_);
    if (this.variant === 'slider') {
      const pct = Math.round((this.on ? this.value : 0) * 100);
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', '100');
      this.setAttribute('aria-valuenow', String(pct));
      this.setAttribute('aria-valuetext', this.state || `${pct}%`);
    } else {
      for (const a of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) this.removeAttribute(a);
    }
    if (this.variant === 'toggle') this.setAttribute('aria-checked', String(this.on));
    else this.removeAttribute('aria-checked');
    this.setAttribute('aria-label', this.label);
    if (this.unavailable) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    if (this.readonly && this.variant !== 'plain') this.setAttribute('aria-readonly', 'true');
    else this.removeAttribute('aria-readonly');
    // the effective density and surface: the host's word, else the look dials (the styles key on these)
    this.setAttribute('data-density', this.density || this.look.of('density'));
    this.setAttribute('data-surface', this.surface || this.look.of('surface'));
  }

  render() {
    const text = html`<span class="nm">${this.label}</span>${this.state ? html`<span class="st">${this.state}</span>` : nothing}`;
    const ringCls = classMap({ ring: true, hue: this.hue >= 1 && this.hue <= 8 });
    return html`${this.ringStatic
        ? html`<span class=${ringCls} aria-hidden="true" data-pill-ring-static><sw-icon .name=${this.icon} size=${20}></sw-icon></span>`
        : html`<button type="button" class=${ringCls} aria-label=${`פרטים: ${this.label}`} ?disabled=${this.unavailable} data-pill-ring
            @click=${(e: Event) => { e.stopPropagation(); this.emit('icon-click'); }} @pointerdown=${(e: Event) => e.stopPropagation()}>
            <sw-icon .name=${this.icon} size=${20}></sw-icon>
          </button>`}
      <span class="txw"><span class="tx base">${text}</span><span class="tx over" aria-hidden="true">${text}</span></span>
      ${this.variant === 'slider' && this.on ? html`<span class="pct" aria-hidden="true">${Math.round(this.value * 100)}%</span>` : nothing}
      <span class="subs" ?hidden=${!this.hasSubs} @pointerdown=${(e: Event) => e.stopPropagation()}><slot name="subs" @slotchange=${(e: Event) => (this.hasSubs = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0)}></slot></span>`;
  }

  /** The fill and hue custom properties live on the host (the ::before and the ring read them). */
  protected willUpdate() {
    const fill = this.on && this.variant === 'slider' ? this.value : this.on ? 1 : 0;
    this.style.setProperty('--fill', String(fill));
    if (this.fillColor) this.style.setProperty('--fill-c', this.fillColor);
    else this.style.removeProperty('--fill-c');
    if (this.hue >= 1 && this.hue <= 8) this.style.setProperty('--h', `var(--sw-hue-${this.hue})`);
    else this.style.removeProperty('--h');
    // MD1 (styles/material.ts): the tone of the state for the tint dial - the fill colour while on (the list stripe reads it always);
    // the wash itself (--sw-m-on) only on the glass surface: on fill / flat the state already is the fill, on gradient two colours would fight
    const toned = this.on && !this.accent && !this.unavailable;
    const surface = this.surface || this.look.of('surface');
    if (toned) this.style.setProperty('--sw-m-tone', this.fillColor || 'var(--sw-lit)');
    else this.style.removeProperty('--sw-m-tone');
    if (toned && surface === 'glass') this.style.setProperty('--sw-m-on', '1');
    else this.style.removeProperty('--sw-m-on');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-pill': SwPill;
  }
}
