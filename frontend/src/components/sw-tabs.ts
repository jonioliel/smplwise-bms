import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-dropdown';
import './sw-icon';
import type { DdPanel, DdRing, DdSize, DdStyle } from './sw-dropdown';
import { motionReduced } from '../design/apply';
import { fadeOf, moreSides, nextIndex, pageDelta, revealDelta, wheelDelta, wheelPixels, type Extent, type Side } from './tab-strip';
import type { IconName } from './sw-icon';

export interface TabItem {
  id: string;
  label: string;
  href?: string;
  count?: number;
  /** RFQQUESTIONS: something waits for the user here (a red number pill after the label; the dropdown shows `alert`'s dot) */
  badge?: number;
  /** Dropdown presentation only: a dot on the chip while this item is not the selected one (`true` = alert, `'warn'` = attention). */
  alert?: boolean | 'warn';
  /** Dropdown presentation, capsule style only (Unreleased): an icon at the start of the option; the other looks ignore it. */
  icon?: IconName;
  /** Dropdown presentation, capsule style only: a separator line instead of an item (the tab bars and the other dropdown looks skip it). */
  divider?: boolean;
  /** SERVICEIA1-295: a shorter label the bar shows when the host asks for short labels (`short-labels`, the phone rows). */
  short?: string;
  /** SERVICEIA1-295 / CR-LIVEEVENT100: a small red dot after the label (the bar forms; the dropdown uses `alert`): something waits inside
   * this entry (an open incident on the live event tab). */
  dot?: boolean;
}

/** The look of a tab bar (0.1.148, `ui.tabs` styles - shell/nav.ts tabStyleOf): the narrow segmented pill, the underline row,
 * or the compact underline row. The first hierarchy level of an area is a pill by default, its sub-tabs the compact row. */
export type TabVariant = 'pill' | 'underline' | 'underline-compact' | 'dropdown';
/** hybrid (0.1.153): up to this many items stay the bar the host asked for, more become a dropdown. */
export const ADAPTIVE_MAX_ITEMS = 3;

/**
 * Tabs as on the boards ("All Sites (3) | Buildings | Map"). `variant` picks the look:
 *  - `pill` (default): a light rounded track, the active item as a white pill with blue text - a narrow segmented control;
 *  - `underline`: the settings-page style (thin blue underline);
 *  - `underline-compact`: the same underline row with less height and padding.
 * A row wider than its box scrolls sideways (snapping to tabs) and fades at the edge that hides more tabs; the active tab is
 * kept in view. The host may ask for taller touch targets with `--sw-tab-min-h` (the shell's phone rows: 44 px): the pill track
 * and the compact row stay slim and the hit area grows around them (the compact row's extra hit height overlaps the empty
 * space below it, so the row takes no more room). `underline` (boolean) is the older spelling of `variant="underline"`.
 */
@customElement('sw-tabs')
export class SwTabs extends LitElement {
  @property({ attribute: false }) items: TabItem[] = [];
  @property() active = '';
  @property({ type: Boolean, reflect: true }) segmented = false;
  @property({ type: Boolean, reflect: true }) underline = false;
  @property() variant: TabVariant | '' = '';
  /** Hybrid presentation (0.1.153, the `hybrid` tabs mode): a list of up to three items keeps the bar chosen by `variant`, a longer one
   * becomes the dropdown. With `variant="dropdown"` the list is always a dropdown. */
  @property({ type: Boolean, reflect: true }) adaptive = false;
  /** Dropdown only: fill the flexible box it sits in (the pair row of the shell). */
  @property({ type: Boolean, reflect: true }) block = false;
  /** The accessible name of the dropdown (the group's name). */
  @property({ attribute: 'group-label' }) groupLabel = '';
  /** Dropdown only (0.1.157): the look of the dropdown (sw-dropdown `dd-style`); `auto` = today's look. */
  @property({ attribute: 'dd-style' }) ddStyle: DdStyle = 'auto';
  /** Dropdown only (Unreleased): the size of the dropdown (sw-dropdown `dd-size`); `md` = the reference size. */
  @property({ attribute: 'dd-size' }) ddSize: DdSize = 'md';
  /** Dropdown only (Unreleased, capsule style): the ring thickness and the open panel width (sw-dropdown `dd-ring`, `dd-panel`). */
  @property({ attribute: 'dd-ring' }) ddRing: DdRing = '2';
  @property({ attribute: 'dd-panel' }) ddPanel: DdPanel = '240';
  /** Dropdown only (PHONENAV-295): the chip box itself is a 44 px touch target (sw-dropdown `tall`). */
  @property({ type: Boolean }) tall = false;
  /** SERVICEIA1-295: the bar forms show each item's `short` label when it has one (the shell's phone rows). */
  @property({ type: Boolean, attribute: 'short-labels' }) shortLabels = false;

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
      max-inline-size: 100%;
      min-inline-size: 0;
      box-sizing: border-box;
      /* the hit height: the host's --sw-tab-min-h, else 44 px on a phone (coarse pointer, below), else none */
      --_h: var(--sw-tab-min-h, 0px);
      /* SETTINGS-TABS-SCROLL-2331: the scroll arrow's box and the fade that runs from under it into the tabs */
      --_arr: 32px;
      --_fade: calc(var(--_arr) + 20px);
    }
    /* CR-013: a row wider than its box scrolls sideways (snapping to tabs) and fades at the edge that hides more tabs,
       so a clipped label reads as "more this way" rather than a cut word. SETTINGS-TABS-SCROLL-2331: the scrolling box is the
       viewport inside the host (the arrows sit over it, outside the fade); the fade masks the viewport, not the tabs. */
    .vp {
      display: flex;
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      /* no scroll snapping since 2.33.1: a snap re-aligned the strip after the arrows, the wheel and the active-tab reveal had placed
         it (the revealed tab could land back under the fade); the arrows and the keyboard now do what the snap did */
      scroll-padding-inline: var(--_fade);
      overscroll-behavior-x: contain;
      outline: none;
    }
    .vp::-webkit-scrollbar {
      display: none;
    }
    :host([data-fade='left']) .vp {
      -webkit-mask-image: linear-gradient(to right, transparent 0, transparent 8px, #000 var(--_fade));
      mask-image: linear-gradient(to right, transparent 0, transparent 8px, #000 var(--_fade));
    }
    :host([data-fade='right']) .vp {
      -webkit-mask-image: linear-gradient(to left, transparent 0, transparent 8px, #000 var(--_fade));
      mask-image: linear-gradient(to left, transparent 0, transparent 8px, #000 var(--_fade));
    }
    :host([data-fade='both']) .vp {
      -webkit-mask-image: linear-gradient(to right, transparent 0, transparent 8px, #000 var(--_fade), #000 calc(100% - var(--_fade)), transparent calc(100% - 8px), transparent 100%);
      mask-image: linear-gradient(to right, transparent 0, transparent 8px, #000 var(--_fade), #000 calc(100% - var(--_fade)), transparent calc(100% - 8px), transparent 100%);
    }
    /* the scroll arrows: one per reading side, drawn only while that side hides tabs (data-more). A mouse affordance - the keyboard
       walks the tabs with the arrow keys and a finger swipes - so they are hidden from assistive technology and take no focus. */
    .arr {
      position: absolute;
      inset-block: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      inline-size: var(--_arr);
      color: var(--sw-text-2);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity var(--sw-t-hover) var(--sw-ease-color), visibility 0s linear var(--sw-t-hover);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .arr.start {
      inset-inline-start: 0;
    }
    .arr.end {
      inset-inline-end: 0;
    }
    :host([data-more='start']) .arr.start,
    :host([data-more='end']) .arr.end,
    :host([data-more='both']) .arr {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transition: opacity var(--sw-t-hover) var(--sw-ease-color), visibility 0s;
    }
    .arr .knob {
      display: grid;
      place-items: center;
      inline-size: 24px;
      block-size: 24px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-solid);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      transition: color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .arr:hover .knob {
        color: var(--sw-text);
        border-color: var(--sw-border-strong);
      }
    }
    .arr:active .knob {
      transform: scale(var(--sw-press-scale));
    }
    @media (prefers-reduced-motion: reduce) {
      .vp {
        scroll-behavior: auto;
      }
      .arr,
      .arr .knob {
        transition: none;
      }
    }
    .row {
      position: relative;
      display: inline-flex;
      flex: none;
      gap: 2px;
      min-inline-size: 0;
    }
    a,
    button {
      position: relative;
      display: inline-flex;
      align-items: center;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      text-decoration: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    /* POLISH-CLASSIC-DOMUS-297 (mobile-native): hover only under a hovering pointer */
    @media (hover: hover) and (pointer: fine) {
      a:hover,
      button:hover {
        color: var(--sw-text);
      }
    }
    .lbl {
      transition: background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    a:active .lbl,
    button:active .lbl {
      transform: scale(var(--sw-press-scale));
    }
    a:focus-visible,
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
      border-radius: var(--sw-r-xs);
    }
    .lbl {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    /* touch targets (mobile audit 2026-09-30): page-level tab strips were 29-37 px high on a phone; a host may still ask for more */
    @media (max-width: 767px) and (pointer: coarse) {
      :host {
        --_h: var(--sw-tab-min-h, 44px);
      }
      a,
      button {
        min-block-size: var(--_h);
      }
    }
    .on {
      color: var(--sw-accent-text);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .on .count {
      color: var(--sw-accent-text);
    }
    .tbadge {
      display: inline-grid;
      place-items: center;
      min-inline-size: 18px;
      block-size: 18px;
      margin-inline-start: 6px;
      padding-inline: 5px;
      border-radius: 999px;
      background: var(--sw-danger);
      color: var(--sw-on-video); /* white on the danger fill */
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      line-height: 1;
    }
    /* SERVICEIA1-295: the "something waits inside" dot (the dropdown chip's dot, in the bar forms) */
    .tdot {
      inline-size: 8px;
      block-size: 8px;
      margin-inline-start: 2px;
      border-radius: 999px;
      background: var(--sw-danger);
      flex: none;
    }

    /* ---- dropdown (0.1.153): one chip + a popover list; nothing to scroll or fade, and the chip's dot / hit area stick out of the box ---- */
    :host([data-variant='dropdown']) {
      display: inline-flex;
      overflow: visible;
      padding-block: 4px; /* 32 px chip + 4 + 4 = the 40 px row; the chip's hit area reaches 44 px */
      -webkit-mask-image: none;
      mask-image: none;
    }

    :host([data-variant='dropdown'][block]) {
      display: flex;
      flex: 1 1 0;
      min-inline-size: 0;
    }

    /* ---- pill: the narrow segmented control (the track is 34 px; a taller hit area grows around it) ---- */
    :host([data-variant='pill']) .row {
      padding-inline: 3px;
    }
    :host([data-variant='pill']) .row::before {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block: max(0px, calc((var(--_h) - 34px) / 2));
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
    }
    :host([data-variant='pill']) a,
    :host([data-variant='pill']) button {
      min-block-size: max(34px, var(--_h));
      padding-inline: 1px;
    }
    :host([data-variant='pill']) .lbl {
      min-block-size: 28px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      box-sizing: border-box;
      justify-content: center;
    }
    :host([data-variant='pill']) .on .lbl {
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      font-weight: var(--sw-fw-semibold);
    }

    /* ---- underline: the settings-page style (thin accent underline under the active tab) ---- */
    :host([data-variant='underline']),
    :host([data-variant='underline-compact']) {
      display: flex;
    }
    :host([data-variant='underline']) {
      border-block-end: 1px solid var(--sw-border);
    }
    :host([data-variant='underline']) .row {
      flex: 1 0 auto;
    }
    :host([data-variant='underline']) a,
    :host([data-variant='underline']) button {
      padding: 8px 12px;
      min-block-size: var(--_h);
      border-block-end: 2px solid transparent;
      margin-block-end: -1px;
      box-sizing: border-box;
    }
    :host([data-variant='underline']) .on {
      border-block-end-color: var(--sw-accent);
    }

    /* ---- underline-compact: the same row, 32 px high (the sub-tabs) ----
       The text sits at the top of the tab, the underline at 30 px; with a taller --sw-tab-min-h the extra hit height lies BELOW
       the underline, and a negative margin gives that room back to the layout, so the row takes 32 px whatever the target. */
    :host([data-variant='underline-compact']) {
      position: relative;
      z-index: 1;
      margin-block-end: calc(32px - max(32px, var(--_h)));
    }
    :host([data-variant='underline-compact']) .row {
      flex: 1 0 auto;
      gap: 0;
    }
    /* the arrow sits on the visible 32 px row, not on the extra hit height below it */
    :host([data-variant='underline-compact']) .arr {
      inset-block-end: auto;
      block-size: 32px;
    }
    :host([data-variant='underline-compact']) .row::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block-start: 31px;
      block-size: 1px;
      background: var(--sw-border);
    }
    :host([data-variant='underline-compact']) a,
    :host([data-variant='underline-compact']) button {
      align-items: flex-start;
      padding: 0 10px;
      min-block-size: max(32px, var(--_h));
      box-sizing: border-box;
    }
    :host([data-variant='underline-compact']) .lbl {
      min-block-size: 30px;
    }
    :host([data-variant='underline-compact']) a::after,
    :host([data-variant='underline-compact']) button::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block-start: 29px;
      block-size: 2px;
      background: transparent;
      z-index: 1;
    }
    :host([data-variant='underline-compact']) .on::after {
      background: var(--sw-accent);
    }
  `;

  private resizeObs: ResizeObserver | null = null;
  private observedRow: Element | null = null;
  private onScroll = () => this.updateFade();

  connectedCallback() {
    super.connectedCallback();
    this.resizeObs = new ResizeObserver(() => {
      this.revealActive();
      this.updateFade();
    });
    this.resizeObs.observe(this);
    // the web font widens the tabs after the first layout, which the box observer does not see: reveal again once it is
    // in (a long row - the ten investigation tabs - otherwise kept its active last tab clipped on the phone)
    void document.fonts?.ready.then(() => {
      this.revealActive();
      this.updateFade();
    });
  }

  disconnectedCallback() {
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.observedRow = null;
    super.disconnectedCallback();
  }

  /** SETTINGS-TABS-SCROLL-2331: the scrolling box (the viewport inside the shadow root); null in the dropdown form. */
  get viewport(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.vp');
  }

  private get rtl(): boolean {
    return getComputedStyle(this).direction === 'rtl';
  }

  private get smooth(): ScrollBehavior {
    return motionReduced() ? ('instant' as ScrollBehavior) : 'smooth';
  }

  /** The physical extent of the tabs against the viewport's box, or null when nothing scrolls. */
  private extent(): Extent | null {
    const vp = this.viewport;
    const kids = this.renderRoot.querySelectorAll<HTMLElement>('a, button');
    if (!vp || !kids.length || vp.scrollWidth <= vp.clientWidth + 1) return null;
    const box = vp.getBoundingClientRect();
    let minLeft = Infinity;
    let maxRight = -Infinity;
    kids.forEach((k) => {
      const r = k.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left);
      maxRight = Math.max(maxRight, r.right);
    });
    return { boxLeft: box.left, boxRight: box.right, minLeft, maxRight };
  }

  /** An arrow: one "page" toward that reading side. */
  private step(side: Side) {
    const e = this.extent();
    const vp = this.viewport;
    if (!e || !vp) return;
    const left = pageDelta(side, this.rtl, e);
    if (left) vp.scrollBy({ left, behavior: this.smooth });
  }

  /** A vertical mouse wheel over a strip that overflows scrolls it sideways (until its edge, then the page has the wheel back). */
  private onWheel = (ev: WheelEvent) => {
    if (ev.ctrlKey) return; // pinch-zoom on a trackpad
    const e = this.extent();
    const vp = this.viewport;
    if (!e || !vp) return;
    const dy = wheelPixels(ev.deltaY, ev.deltaMode, vp.clientWidth);
    const dx = wheelPixels(ev.deltaX, ev.deltaMode, vp.clientWidth);
    const left = wheelDelta(dx, dy, this.rtl, e, 1);
    if (!left) return;
    ev.preventDefault();
    vp.scrollBy({ left, behavior: 'instant' as ScrollBehavior });
  };

  /** The arrow keys walk the tabs (in RTL ArrowLeft is the next one), Home / End jump to the ends; the focus moves, Enter opens. */
  private onKey = (ev: KeyboardEvent) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const tabs = [...this.renderRoot.querySelectorAll<HTMLElement>('.row > a, .row > button')];
    const focused = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
    const at = focused ? tabs.indexOf(focused) : -1;
    if (at < 0) return; // the focus is not on a tab of this strip
    const next = nextIndex(ev.key, at, tabs.length, this.rtl);
    if (next === null) return;
    ev.preventDefault();
    const el = tabs[next];
    el.focus({ preventScroll: true });
    this.reveal(el, this.smooth);
  };

  /** The look in force: `variant`, else the older `underline` flag, else the pill. */
  get mode(): TabVariant {
    if (this.variant === 'dropdown' || (this.adaptive && this.items.filter((i) => !i.divider).length > ADAPTIVE_MAX_ITEMS)) return 'dropdown';
    return this.variant === 'pill' || this.variant === 'underline' || this.variant === 'underline-compact' ? this.variant : this.underline ? 'underline' : 'pill';
  }

  protected willUpdate() {
    if (this.getAttribute('data-variant') !== this.mode) this.setAttribute('data-variant', this.mode);
  }

  protected updated(changed: Map<string, unknown>) {
    const row = this.renderRoot.querySelector('.row');
    if (row !== this.observedRow) {
      // the row's own width changes (a label, a count, the web font) without the host's box changing
      if (this.observedRow) this.resizeObs?.unobserve(this.observedRow);
      if (row) this.resizeObs?.observe(row);
      this.observedRow = row;
    }
    if (changed.has('active') || changed.has('items') || changed.has('variant') || changed.has('underline') || changed.has('adaptive')) this.revealActive();
    this.updateFade();
  }

  /** Which physical edges hide tabs (`data-fade`, direction-agnostic: compares the tabs' boxes with the viewport's box) and which
   * reading sides therefore show an arrow (`data-more`: start / end / both). */
  private updateFade() {
    const e = this.extent();
    const fade = e ? fadeOf(e) : '';
    const m = e ? moreSides(e, this.rtl) : { start: false, end: false };
    const more = m.start && m.end ? 'both' : m.start ? 'start' : m.end ? 'end' : '';
    if (fade) this.setAttribute('data-fade', fade);
    else this.removeAttribute('data-fade');
    if (more) this.setAttribute('data-more', more);
    else this.removeAttribute('data-more');
  }

  /** Bring one tab fully into view inside the row, clear of the fade and the arrow (never scrolls the page). */
  private reveal(el: HTMLElement, behavior: ScrollBehavior) {
    const vp = this.viewport;
    if (!vp || vp.scrollWidth <= vp.clientWidth + 1) return;
    const box = vp.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(this).getPropertyValue('--_fade')) || 52;
    const left = revealDelta(box.left, box.right, r.left, r.right, pad);
    if (left) vp.scrollBy({ left, behavior });
  }

  /** The active tab, on load, on a route / selection change and when the box or the font changes. */
  private revealActive() {
    const on = this.renderRoot.querySelector<HTMLElement>('.on');
    if (on) this.reveal(on, 'instant' as ScrollBehavior);
  }

  private choose(item: TabItem) {
    this.active = item.id;
    this.dispatchEvent(new CustomEvent('change', { detail: { id: item.id }, bubbles: true, composed: true }));
  }

  /** The dropdown's choice: a link item navigates like its `<a>` would, any item fires the same `change` as a tab does. */
  private onPick = (e: CustomEvent<{ id: string }>) => {
    e.stopPropagation();
    const item = this.items.find((i) => i.id === e.detail.id);
    if (!item) return;
    if (item.href?.startsWith('#')) window.location.hash = item.href;
    this.choose(item);
  };

  render() {
    if (this.mode === 'dropdown') {
      return html`<sw-dropdown ?block=${this.block} ?tall=${this.tall} dd-style=${this.ddStyle} dd-size=${this.ddSize} dd-ring=${this.ddRing} dd-panel=${this.ddPanel} .items=${this.items} .value=${this.active} .label=${this.groupLabel} @change=${this.onPick}></sw-dropdown>`;
    }
    const label = (it: TabItem) => html`<span class="lbl">${this.shortLabels && it.short ? it.short : it.label}${it.count !== undefined ? html`<span class="count">(${it.count})</span>` : ''}${it.badge ? html`<span class="tbadge" data-tab-badge=${it.id}>${it.badge}</span>` : ''}${it.dot && !it.badge ? html`<span class="tdot" data-tab-dot=${it.id} aria-hidden="true"></span>` : ''}</span>`;
    const row = html`<div class="row">${this.items.filter((it) => !it.divider).map((it) =>
      it.href
        ? html`<a href=${it.href} class=${it.id === this.active ? 'on' : ''} aria-current=${it.id === this.active ? 'page' : 'false'}>${label(it)}</a>`
        : html`<button type="button" class=${it.id === this.active ? 'on' : ''} aria-pressed=${it.id === this.active} @click=${() => this.choose(it)}>${label(it)}</button>`,
    )}</div>`;
    // SETTINGS-TABS-SCROLL-2331: the viewport scrolls (swipe, wheel, the arrows, the arrow keys); the two arrows sit over its ends
    return html`<div class="vp" part="viewport" data-tabs-viewport @scroll=${this.onScroll} @wheel=${{ handleEvent: this.onWheel, passive: false }} @keydown=${this.onKey}>${row}</div><div class="arr start" data-tabs-arrow="start" aria-hidden="true" @click=${() => this.step('start')}><span class="knob"><sw-icon name="chevronBack" size=${14}></sw-icon></span></div><div class="arr end" data-tabs-arrow="end" aria-hidden="true" @click=${() => this.step('end')}><span class="knob"><sw-icon name="chevron" size=${14}></sw-icon></span></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-tabs': SwTabs;
  }
}
