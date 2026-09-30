import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TabItem {
  id: string;
  label: string;
  href?: string;
  count?: number;
}

/** The look of a tab bar (0.1.148, `ui.tabs` styles - shell/nav.ts tabStyleOf): the narrow segmented pill, the underline row,
 * or the compact underline row. The first hierarchy level of an area is a pill by default, its sub-tabs the compact row. */
export type TabVariant = 'pill' | 'underline' | 'underline-compact';

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

  static styles = css`
    :host {
      display: inline-flex;
      overflow-x: auto;
      scrollbar-width: none;
      max-inline-size: 100%;
      box-sizing: border-box;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    /* CR-013: a row wider than its box scrolls sideways (snapping to tabs) and fades at the edge that hides more tabs,
       so a clipped label reads as "more this way" rather than a cut word. The fade masks the box, not the tabs. */
    :host {
      scroll-snap-type: x proximity;
      scroll-padding-inline: 24px;
      overscroll-behavior-x: contain;
    }
    a,
    button {
      scroll-snap-align: start;
    }
    :host([data-fade='left']) {
      -webkit-mask-image: linear-gradient(to right, transparent 0, #000 32px);
      mask-image: linear-gradient(to right, transparent 0, #000 32px);
    }
    :host([data-fade='right']) {
      -webkit-mask-image: linear-gradient(to left, transparent 0, #000 32px);
      mask-image: linear-gradient(to left, transparent 0, #000 32px);
    }
    :host([data-fade='both']) {
      -webkit-mask-image: linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
      mask-image: linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
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
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a:hover,
    button:hover {
      color: var(--sw-text);
    }
    a:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: -2px;
      border-radius: 6px;
    }
    .lbl {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .on {
      color: var(--sw-accent-text);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .on .count {
      color: var(--sw-accent-text);
    }

    /* ---- pill: the narrow segmented control (the track is 34 px; a taller hit area grows around it) ---- */
    :host([data-variant='pill']) .row {
      padding-inline: 3px;
    }
    :host([data-variant='pill']) .row::before {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block: max(0px, calc((var(--sw-tab-min-h, 0px) - 34px) / 2));
      background: var(--sw-surface-3);
      border-radius: 12px;
    }
    :host([data-variant='pill']) a,
    :host([data-variant='pill']) button {
      min-block-size: max(34px, var(--sw-tab-min-h, 0px));
      padding-inline: 1px;
    }
    :host([data-variant='pill']) .lbl {
      min-block-size: 28px;
      padding: 0 12px;
      border-radius: 9px;
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
      min-block-size: var(--sw-tab-min-h, auto);
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
      margin-block-end: calc(32px - max(32px, var(--sw-tab-min-h, 32px)));
    }
    :host([data-variant='underline-compact']) .row {
      flex: 1 0 auto;
      gap: 0;
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
      min-block-size: max(32px, var(--sw-tab-min-h, 0px));
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
  private onScroll = () => this.updateFade();

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('scroll', this.onScroll, { passive: true });
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
    this.removeEventListener('scroll', this.onScroll);
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    super.disconnectedCallback();
  }

  /** The look in force: `variant`, else the older `underline` flag, else the pill. */
  get mode(): TabVariant {
    return this.variant === 'pill' || this.variant === 'underline' || this.variant === 'underline-compact' ? this.variant : this.underline ? 'underline' : 'pill';
  }

  protected willUpdate() {
    if (this.getAttribute('data-variant') !== this.mode) this.setAttribute('data-variant', this.mode);
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('active') || changed.has('items') || changed.has('variant') || changed.has('underline')) this.revealActive();
    this.updateFade();
  }

  /** Which physical edges hide tabs (direction-agnostic: compares the tabs' boxes with this box). */
  private updateFade() {
    const kids = this.renderRoot.querySelectorAll<HTMLElement>('a, button');
    if (!kids.length || this.scrollWidth <= this.clientWidth + 1) {
      this.removeAttribute('data-fade');
      return;
    }
    const box = this.getBoundingClientRect();
    let minLeft = Infinity;
    let maxRight = -Infinity;
    kids.forEach((k) => {
      const r = k.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left);
      maxRight = Math.max(maxRight, r.right);
    });
    const left = minLeft < box.left - 1;
    const right = maxRight > box.right + 1;
    const fade = left && right ? 'both' : left ? 'left' : right ? 'right' : '';
    if (fade) this.setAttribute('data-fade', fade);
    else this.removeAttribute('data-fade');
  }

  /** Bring the active tab fully into view inside the row (never scrolls the page). */
  private revealActive() {
    const on = this.renderRoot.querySelector<HTMLElement>('.on');
    if (!on || this.scrollWidth <= this.clientWidth + 1) return;
    const box = this.getBoundingClientRect();
    const r = on.getBoundingClientRect();
    const pad = 24;
    let delta = 0;
    if (r.left < box.left + pad) delta = r.left - (box.left + pad);
    else if (r.right > box.right - pad) delta = r.right - (box.right - pad);
    if (delta) this.scrollBy({ left: delta, behavior: 'instant' as ScrollBehavior });
  }

  private choose(item: TabItem) {
    this.active = item.id;
    this.dispatchEvent(new CustomEvent('change', { detail: { id: item.id }, bubbles: true, composed: true }));
  }

  render() {
    const label = (it: TabItem) => html`<span class="lbl">${it.label}${it.count !== undefined ? html`<span class="count">(${it.count})</span>` : ''}</span>`;
    return html`<div class="row">${this.items.map((it) =>
      it.href
        ? html`<a href=${it.href} class=${it.id === this.active ? 'on' : ''} aria-current=${it.id === this.active ? 'page' : 'false'}>${label(it)}</a>`
        : html`<button type="button" class=${it.id === this.active ? 'on' : ''} aria-pressed=${it.id === this.active} @click=${() => this.choose(it)}>${label(it)}</button>`,
    )}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-tabs': SwTabs;
  }
}
