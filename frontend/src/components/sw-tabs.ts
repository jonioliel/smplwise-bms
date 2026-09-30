import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TabItem {
  id: string;
  label: string;
  href?: string;
  count?: number;
}

/**
 * Pill tabs as on the boards ("All Sites (3) | Buildings | Map"): a light track, the active item as a
 * white pill with blue text. `underline` switches to the settings-page style (thin blue underline).
 */
@customElement('sw-tabs')
export class SwTabs extends LitElement {
  @property({ attribute: false }) items: TabItem[] = [];
  @property() active = '';
  @property({ type: Boolean, reflect: true }) segmented = false;
  @property({ type: Boolean, reflect: true }) underline = false;

  static styles = css`
    :host {
      display: inline-flex;
      gap: 2px;
      overflow-x: auto;
      scrollbar-width: none;
      max-inline-size: 100%;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
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
    :host([underline]) {
      display: flex;
      background: transparent;
      padding: 0;
      border-radius: 0;
      border-block-end: 1px solid var(--sw-border);
      gap: 2px;
    }
    a,
    button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--sw-text-2);
      text-decoration: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
      /* a host may ask for taller touch targets (the shell's phone tab row, CR-013) */
      min-block-size: var(--sw-tab-min-h, auto);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a:hover,
    button:hover {
      color: var(--sw-text);
    }
    .on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    :host([underline]) a,
    :host([underline]) button {
      padding: 8px 12px;
      border-radius: 0;
      border-block-end: 2px solid transparent;
      margin-block-end: -1px;
    }
    :host([underline]) .on {
      background: transparent;
      box-shadow: none;
      border-block-end-color: var(--sw-accent);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .on .count {
      color: var(--sw-accent-text);
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

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('active') || changed.has('items')) this.revealActive();
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
    return html`${this.items.map((it) =>
      it.href
        ? html`<a href=${it.href} class=${it.id === this.active ? 'on' : ''} aria-current=${it.id === this.active ? 'page' : 'false'}>${it.label}${it.count !== undefined ? html`<span class="count">(${it.count})</span>` : ''}</a>`
        : html`<button type="button" class=${it.id === this.active ? 'on' : ''} aria-pressed=${it.id === this.active} @click=${() => this.choose(it)}>${it.label}${it.count !== undefined ? html`<span class="count">(${it.count})</span>` : ''}</button>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-tabs': SwTabs;
  }
}
