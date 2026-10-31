import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-icon';
import { floorBars, sectionLevels, type SiteBuilding, type SiteModel } from '../api/home-site';
import { bidi, ltrNum } from '../i18n/bidi';
import { PHONE_WIDTH } from '../api/home-screen';

/** What a building / floor press asks the home screen to open: the building view, on one of OUR floors when given. */
export interface SiteGo {
  building: string;
  floor?: string;
}

/**
 * MULTIBUILDING-HOME-2330 (owner approval 31.10, round 10 answers 1, 3, 5, 8): the SITE level of the home screen - the tree grouped by
 * building (a building opens its floors; a floor is one press away) and a live card per building (its counters, its alerts, a lit bar per
 * floor, "open" and "turn everything off in it"), the shared building last in its own colour, then the site's alerts and the mini
 * cross-section (a column per building, the floors aligned by level; a press opens the building on that floor).
 *
 * Control screen rule: no scrolling. From the phone width up the view takes exactly the height left under it (measured) and every card
 * gives way inside (the floor bars clip from the bottom); a phone stacks the cards and scrolls like every phone screen.
 * Draws only; it emits `site-go` (a building / floor) and `site-off` (one building's "כבה הכל").
 */
@customElement('home-site-view')
export class HomeSiteView extends LitElement {
  @property({ attribute: false }) model!: SiteModel;
  /** The buildings shown (the shared one gone for a viewer who hides it). */
  @property({ attribute: false }) buildings: SiteBuilding[] = [];
  @property({ type: Boolean }) canOff = false;
  @property({ type: Boolean }) offline = false;
  @state() private open = new Set<string>();
  @state() private height = 0;
  private ro: ResizeObserver | null = null;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
      --site-tree-w: 240px;
    }
    .site {
      display: grid;
      grid-template-columns: var(--site-tree-w) minmax(0, 1fr);
      gap: 14px;
      min-block-size: 0;
    }
    .site[data-phone] {
      grid-template-columns: minmax(0, 1fr);
    }
    /* ---- the grouped tree ---- */
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      min-block-size: 0;
      overflow: hidden;
    }
    .trow {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-md);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .trow:hover {
      background: var(--sw-surface-2);
    }
    .trow:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .trow.all {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-bold);
    }
    .trow.b {
      font-weight: var(--sw-fw-semibold);
    }
    .trow.f {
      padding-inline-start: 34px;
      min-block-size: 30px;
      color: var(--sw-text-2);
    }
    .trow.shared sw-icon.ic {
      color: var(--sw-shared);
    }
    .trow.shared .nm {
      color: var(--sw-shared-text);
    }
    .nm {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lit {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--sw-warning-text);
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .lit.zero {
      color: var(--sw-text-3);
    }
    .al {
      min-inline-size: 18px;
      block-size: 18px;
      padding: 0 5px;
      box-sizing: border-box;
      border-radius: 999px;
      background: var(--sw-badge-bg);
      color: var(--sw-badge-fg);
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-bold);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .fold {
      all: unset;
      inline-size: 24px;
      block-size: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-3);
      cursor: pointer;
      flex: none;
    }
    .fold:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    .fold sw-icon {
      transition: transform var(--sw-t-fast, 120ms) var(--sw-ease, ease);
    }
    .fold[aria-expanded='false'] sw-icon {
      transform: rotate(90deg);
    }
    .gr {
      display: flex;
      align-items: center;
    }
    .gr > .trow {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    .loose {
      margin-block-start: auto;
      padding: 8px 10px 2px;
      border-block-start: 1px solid var(--sw-border);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    /* ---- the cards ---- */
    .cards {
      display: grid;
      grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      gap: 12px;
      min-block-size: 0;
    }
    .site[data-phone] .cards {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: auto;
    }
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-block-size: 0;
      overflow: hidden;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
    }
    .site:not([data-phone]) .card {
      container-type: size;
    }
    .card > header,
    .card > .chips,
    .card > .alerts,
    .card > .ok,
    .card > .foot {
      flex: none;
    }
    /* a short card (a landscape tablet, many buildings) keeps what answers "is something wrong, and where": the name, the counters, an
       alert row; "no alerts" and the floor bars go first, then the open button (the name itself opens the building) */
    @container (max-height: 190px) {
      .ok {
        display: none !important;
      }
      .alerts .arow + .arow {
        display: none;
      }
    }
    @container (max-height: 150px) {
      .foot .btn,
      .bars {
        display: none;
      }
      .foot {
        margin-block-start: auto;
      }
    }
    .card.shared {
      border-color: color-mix(in srgb, var(--sw-shared) 45%, var(--sw-border));
      box-shadow: inset 3px 0 0 var(--sw-shared), var(--sw-shadow-1);
    }
    .card.alert {
      border-color: color-mix(in srgb, var(--sw-danger) 55%, var(--sw-border));
    }
    .card header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-inline-size: 0;
    }
    .card h3 {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-inline-size: 0;
    }
    .card h3:focus-visible {
      outline: 2px solid var(--sw-focus);
      border-radius: var(--sw-r-sm);
    }
    .card.shared h3 {
      color: var(--sw-shared-text);
    }
    .card.shared h3 sw-icon {
      color: var(--sw-shared);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-block-size: 26px;
      overflow: hidden;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .chip.on {
      background: var(--sw-lit-soft, var(--sw-warning-soft));
      color: var(--sw-warning-text);
    }
    .chip.cool {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .alerts {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .arow {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ok {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    /* the floors that do not fit wrap into a second column outside the card (clipped whole, never half a row) */
    .bars {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: hidden;
      display: flex;
      flex-flow: column wrap;
      align-content: flex-start;
      gap: 3px 40px;
    }
    .site[data-phone] .bars {
      flex-wrap: nowrap;
    }
    .bar {
      all: unset;
      box-sizing: border-box;
      inline-size: 100%;
      display: grid;
      grid-template-columns: minmax(3.5em, auto) minmax(0, 1fr) 2.2em;
      align-items: center;
      gap: 8px;
      min-block-size: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      cursor: pointer;
      border-radius: var(--sw-r-sm);
    }
    .bar:hover .nm {
      color: var(--sw-text);
    }
    .bar:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    .bar.alert .nm {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-bold);
    }
    .track {
      block-size: 6px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .track > i {
      display: block;
      block-size: 100%;
      border-radius: 999px;
      background: var(--sw-warning);
    }
    .card.shared .track > i {
      background: var(--sw-shared);
    }
    .bar .n {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      padding: 0 12px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    .btn:focus-visible,
    .lnk:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .lnk {
      all: unset;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      border-radius: var(--sw-r-sm);
    }
    .lnk.danger {
      color: var(--sw-danger-text);
    }
    @media (hover: hover) {
      .btn:hover {
        background: var(--sw-surface-2);
      }
    }
    .btn:active,
    .trow:active,
    .bar:active {
      transform: scale(0.98);
    }
    /* ---- the site's alerts and the mini cross-section ---- */
    .card h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-heading, var(--sw-text));
    }
    .alist {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .alist .code {
      font-weight: var(--sw-fw-bold);
    }
    .xs {
      flex: 1 1 auto;
      min-block-size: 0;
      display: grid;
      grid-template-columns: repeat(var(--bn), minmax(0, 1fr));
      gap: 6px;
    }
    .xcol {
      display: grid;
      grid-template-rows: auto repeat(var(--ln), minmax(0, 1fr));
      gap: 2px;
      min-block-size: 0;
    }
    .xh {
      all: unset;
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-text-2);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
    .xcol.shared .xh {
      color: var(--sw-shared-text);
    }
    .cell {
      all: unset;
      box-sizing: border-box;
      min-block-size: 3px;
      border-radius: 3px;
      background: color-mix(in srgb, var(--sw-warning) calc(var(--r, 0) * 85%), var(--sw-surface-3));
      cursor: pointer;
    }
    .xcol.shared .cell {
      background: color-mix(in srgb, var(--sw-shared) calc(var(--r, 0) * 85%), var(--sw-surface-3));
    }
    .cell.alert {
      outline: 2px solid var(--sw-danger);
      outline-offset: -2px;
    }
    .cell.none {
      background: transparent;
      cursor: default;
    }
    .cell:focus-visible,
    .xh:focus-visible {
      outline: 2px solid var(--sw-focus);
    }
    .cell.under {
      box-shadow: 0 -3px 0 -1px var(--sw-border-strong);
    }
    @media (prefers-reduced-motion: reduce) {
      .fold sw-icon {
        transition: none;
      }
      .btn:active,
      .trow:active,
      .bar:active {
        transform: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this.measure);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.measure);
    this.ro?.disconnect();
    this.ro = null;
  }

  protected firstUpdated() {
    this.ro = new ResizeObserver(() => this.measure());
    if (this.parentElement) this.ro.observe(this.parentElement);
    this.measure();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('buildings')) this.measure(true);
    // what the page still overflows after the guess (the page's own bottom padding) comes off the view
    if (changed.has('height') && this.height) {
      const sc = this.scroller();
      const over = sc ? sc.scrollHeight - sc.clientHeight : 0;
      if (over > 0) this.height = Math.max(220, this.height - over);
    }
  }

  /** The view's top and the window size of the last guess: the guess is made again only when one of them moved. */
  private at = '';

  /** The element that would scroll (the page area), across the shadow roots; null = the document. */
  private scroller(): HTMLElement | null {
    let node: Node | null = this;
    while (node) {
      const parent: Node | null = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
      if (parent instanceof HTMLElement && ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent;
      node = parent;
    }
    return document.scrollingElement as HTMLElement | null;
  }

  /** The height left under the view (a control screen never scrolls); a phone keeps its natural height. */
  private measure = (force: boolean | Event = false) => {
    if (window.innerWidth <= PHONE_WIDTH) {
      if (this.height) this.height = 0;
      this.at = '';
      return;
    }
    const sc = this.scroller();
    const top = Math.round(this.getBoundingClientRect().top + (sc?.scrollTop ?? 0));
    const at = `${top}|${window.innerWidth}|${window.innerHeight}`;
    if (at === this.at && force !== true) return;
    this.at = at;
    const h = Math.max(220, Math.floor(window.innerHeight - top - 20));
    if (Math.abs(h - this.height) > 1) this.height = h;
  };

  private go(building: string, floor?: string) {
    this.dispatchEvent(new CustomEvent<SiteGo>('site-go', { detail: { building, floor }, bubbles: true, composed: true }));
  }

  private off(building: string) {
    this.dispatchEvent(new CustomEvent<{ building: string }>('site-off', { detail: { building }, bubbles: true, composed: true }));
  }

  private toggle(id: string) {
    const next = new Set(this.open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.open = next;
  }

  render() {
    if (!this.model) return nothing;
    const phone = window.innerWidth <= PHONE_WIDTH;
    const bs = this.buildings;
    const wide = window.innerWidth > 1180;
    const cols = phone ? 1 : wide ? 4 : 3;
    // the site's alerts card and the mini cross-section on a desktop (a tablet keeps the buildings at a readable height: its alerts are
    // the cards' own rows and the tree's red counts); a phone stacks the cross-section under the cards
    const extra = wide ? 2 : phone ? 1 : 0;
    const rows = Math.max(1, Math.ceil((bs.length + extra) / cols));
    const style = this.height ? `block-size:${this.height}px` : '';
    return html`<div class="site" ?data-phone=${phone} style=${style} data-site-view data-site-rows=${rows}>
      ${phone ? nothing : this.renderTree()}
      <div class="cards" style=${`--cols:${cols};grid-template-rows:${phone ? 'none' : `repeat(${rows}, minmax(0, 1fr))`}`} data-site-cards>
        ${repeat(bs, (b) => b.id, (b) => this.renderCard(b))}
        ${wide ? this.renderAlerts() : nothing}
        ${wide || phone ? this.renderSection() : nothing}
      </div>
    </div>`;
  }

  private lit(n: number) {
    return html`<span class=${classMap({ lit: true, zero: n === 0 })}><sw-icon name="light" size=${12}></sw-icon>${ltrNum(n)}</span>`;
  }

  private renderTree() {
    const total = this.buildings.reduce((s, b) => s + b.counts.lights_on, 0);
    return html`<nav aria-label="בניינים וקומות" data-site-tree>
      <div class="trow all" data-site-tree-all aria-current="true"><sw-icon name="building" size=${15}></sw-icon><span class="nm">כל האתר</span>${this.lit(total)}</div>
      ${repeat(this.buildings, (b) => b.id, (b) => {
        const open = this.open.has(b.id);
        return html`<div class="gr">
            <button type="button" class="fold" aria-expanded=${String(open)} aria-label=${open ? `סגור את ${b.name}` : `פתח את קומות ${b.name}`} data-site-tree-fold=${b.id} @click=${() => this.toggle(b.id)}><sw-icon name="chevronDown" size=${14}></sw-icon></button>
            <button type="button" class=${classMap({ trow: true, b: true, shared: b.shared })} data-site-tree-building=${b.id} @click=${() => this.go(b.id)}>
              <sw-icon class="ic" name=${b.shared ? 'sparkle' : 'building'} size=${15}></sw-icon><span class="nm" title=${b.name}>${bidi(b.name)}</span>
              ${b.alerts.length ? html`<span class="al" aria-label=${`${b.alerts.length} התראות`}>${ltrNum(b.alerts.length)}</span>` : nothing}${this.lit(b.counts.lights_on)}
            </button>
          </div>
          ${open
            ? b.floors.map((f) => html`<button type="button" class="trow f" data-site-tree-floor=${f.id} @click=${() => this.go(b.id, f.id)}><sw-icon name="floor" size=${13}></sw-icon><span class="nm">${bidi(f.name)}</span>${this.lit(f.counts.lights_on)}</button>`)
            : nothing}`;
      })}
      ${this.model.unassigned.length
        ? html`<div class="loose" data-site-unassigned=${this.model.unassigned.length}><sw-icon name="warning" size=${13}></sw-icon>לא משויך · ${ltrNum(this.model.unassigned.length)} אזורים</div>`
        : nothing}
    </nav>`;
  }

  private renderCard(b: SiteBuilding) {
    const c = b.counts;
    const areas = b.floors.reduce((s, f) => s + f.areas.length, 0);
    const dash = (v: string) => (this.offline ? '–' : v);
    const chip = (icon: string, on: number, total: number, cls: string) =>
      total ? html`<span class=${classMap({ chip: true, [cls]: on > 0 })}><sw-icon name=${icon as 'light'} size=${12}></sw-icon>${dash(`${on}/${total}`)}</span>` : nothing;
    return html`<section class=${classMap({ card: true, shared: b.shared, alert: b.alerts.length > 0 })} data-site-card=${b.id} aria-label=${b.name}>
      <header>
        <h3 role="button" tabindex="0" data-site-card-open=${b.id} @click=${() => this.go(b.id)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), this.go(b.id))}>
          <sw-icon name=${b.shared ? 'sparkle' : 'building'} size=${16}></sw-icon>${bidi(b.name)}</h3>
        <span class="sub">${ltrNum(b.floors.length)} קומות · ${ltrNum(areas)} אזורים</span>
      </header>
      <div class="chips">
        ${chip('light', c.lights_on, c.lights, 'on')}${chip('bolt', c.switches_on, c.switches, 'on')}${chip('layers', c.covers_open, c.covers, 'on')}${chip('snow', c.climate_active, c.climate, 'cool')}
      </div>
      ${b.alerts.length
        ? html`<div class="alerts">${b.alerts.slice(0, 2).map((a) => html`<div class="arow" data-site-alert><sw-icon name="warning" size=${13}></sw-icon>${bidi(a.floor)} · ${bidi(a.area.name)} · אזעקה</div>`)}</div>`
        : html`<span class="ok"><sw-icon name="check" size=${13}></sw-icon>אין התראות</span>`}
      <div class="bars" data-site-bars>
        ${floorBars(b).map((f) => html`<button type="button" class=${classMap({ bar: true, alert: f.alert })} data-site-bar=${f.id} aria-label=${`${f.name}: ${f.on} מתוך ${f.total} דולקות`} @click=${() => this.go(b.id, f.id)}>
          <span class="nm">${bidi(f.name)}</span><span class="track"><i style=${`inline-size:${Math.round(f.ratio * 100)}%`}></i></span><span class="n">${ltrNum(f.on)}</span>
        </button>`)}
      </div>
      <div class="foot">
        <button type="button" class="btn" data-site-card-go=${b.id} @click=${() => this.go(b.id)}><sw-icon name=${b.shared ? 'sparkle' : 'building'} size=${14}></sw-icon>${b.shared ? 'פתח משותף' : 'פתח בניין'}</button>
        ${this.canOff ? html`<button type="button" class="lnk danger" data-site-card-off=${b.id} @click=${() => this.off(b.id)}>כבה הכל ב${b.name}</button>` : nothing}
      </div>
    </section>`;
  }

  private renderAlerts() {
    const all = this.buildings.flatMap((b) => b.alerts.map((a) => ({ b, a })));
    return html`<section class="card" data-site-alerts=${all.length}>
      <h4><sw-icon name="warning" size=${15}></sw-icon>התראות באתר${all.length ? html` <span class="sub">· ${ltrNum(all.length)}</span>` : nothing}</h4>
      <div class="alist">
        ${all.length
          ? all.map(({ b, a }) => html`<button type="button" class="lnk" @click=${() => this.go(b.id)}><span class="code">${bidi(b.name)}</span> · ${bidi(a.floor)} · ${bidi(a.area.name)}</button>`)
          : html`<span class="ok"><sw-icon name="check" size=${13}></sw-icon>אין התראות באתר</span>`}
      </div>
    </section>`;
  }

  /** The mini cross-section (owner answer 8): a column per building, a row per level (aligned across buildings), each floor coloured by
   * its share of lights on, an alarm outlined; a press opens the building on that floor, the column head opens the building. */
  private renderSection() {
    const levels = sectionLevels(this.buildings);
    const ground = levels.findIndex((l) => l < 0);
    return html`<section class="card" data-site-section aria-label="חתך האתר">
      <h4><sw-icon name="layers" size=${15}></sw-icon>חתך האתר</h4>
      <div class="xs" style=${`--bn:${this.buildings.length}`}>
        ${this.buildings.map((b) => {
          const bars = new Map(floorBars(b).map((x) => [b.floors.find((f) => f.id === x.id)!.level, x]));
          return html`<div class=${classMap({ xcol: true, shared: b.shared })} style=${`--ln:${levels.length}`} data-site-section-col=${b.id}>
            <button type="button" class="xh" title=${b.name} @click=${() => this.go(b.id)}>${bidi(b.name)}</button>
            ${levels.map((l, i) => {
              const x = bars.get(l);
              const under = i === ground && ground > 0; // the ground line: the first level below 0
              return x
                ? html`<button type="button" class=${classMap({ cell: true, alert: x.alert, under })} style=${`--r:${x.ratio.toFixed(2)}`} title=${`${b.name} · ${x.name}: ${x.on}/${x.total}`} aria-label=${`${b.name} · ${x.name}`} data-site-cell=${x.id} @click=${() => this.go(b.id, x.id)}></button>`
                : html`<span class=${classMap({ cell: true, none: true, under })} aria-hidden="true"></span>`;
            })}
          </div>`;
        })}
      </div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-site-view': HomeSiteView;
  }
}
