import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-chip';
import { getDevicesTree, type DeviceCounts, type DeviceTree } from '../api/devices';
import { navigate } from '../router';
import { bidi } from '../i18n/bidi';

/** One switcher entry: a floor or an area of the current floor, with its device count. */
export interface NavOption {
  id: string;
  name: string;
  count: number;
  /** Where choosing it lands (a router path); absent = not selectable (a floor with no area to show). */
  href?: string;
}

/** The floors of the tree as switcher entries. Choosing a floor lands on the area of the same name when the floor has one,
 * else on its first area (the tree is already narrowed to what the caller may see). */
export function floorOptions(tree: DeviceTree | null, areaName: string): NavOption[] {
  if (!tree) return [];
  return tree.floors.map((f) => {
    const target = f.areas.find((a) => a.name === areaName) ?? f.areas[0];
    return { id: f.floor_id, name: f.name || 'ללא קומה', count: f.counts.entities, href: target ? `/devices/areas/${encodeURIComponent(target.area_id)}` : undefined };
  });
}

export function areaOptions(areas: { area_id: string; name: string; counts: DeviceCounts }[]): NavOption[] {
  return areas.map((a) => ({ id: a.area_id, name: a.name, count: a.counts.entities, href: `/devices/areas/${encodeURIComponent(a.area_id)}` }));
}

type Open = '' | 'floor' | 'area';

/**
 * The area screen's navigation (owner 2026-09-30): ONE breadcrumb of real controls - the home overview, the floor and the
 * area - where the floor and the area each open a small list of their siblings with counts, so a level is one tap away
 * from any other. Desktop: `חשמל והתקנים › קומה ▾ › אזור ▾` (lists open under the crumb). Phone: the home link and the floor
 * (a bottom sheet), with the floor's areas as a scrollable row of chips under them (44 px targets). Keyboard: Enter / Space /
 * ArrowDown open a list, ArrowUp / ArrowDown / Home / End move, Esc closes and returns to the crumb.
 */
@customElement('devices-area-nav')
export class DevicesAreaNav extends LitElement {
  @property() areaId = '';
  @property() areaName = '';
  @property() floorName = '';
  @property({ attribute: false }) areas: { area_id: string; name: string; counts: DeviceCounts }[] = [];

  @state() private open: Open = '';
  @state() private tree: DeviceTree | null = null;
  @state() private treeError = false;
  @state() private phone = false;
  private mq: MediaQueryList | null = null;

  static styles = css`
    :host {
      display: block;
      margin-block-end: 4px;
    }
    nav {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
    }
    .sep {
      color: var(--sw-border-strong);
      display: inline-flex;
    }
    .wrap {
      position: relative;
      display: inline-flex;
    }
    .crumb {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 30px;
      padding: 0 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      cursor: pointer;
      text-decoration: none;
    }
    .crumb:hover,
    .crumb[aria-expanded='true'] {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .crumb:focus-visible,
    .opt:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -1px;
    }
    .crumb[aria-current] {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .menu {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-start: 0;
      z-index: var(--sw-z-modal, 50);
      min-inline-size: 200px;
      max-block-size: min(60vh, 420px);
      overflow: auto;
      padding: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
    }
    .opt {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      inline-size: 100%;
      min-block-size: 34px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .opt:hover:not(:disabled) {
      background: var(--sw-surface-3);
    }
    .opt[aria-checked='true'] {
      background: var(--sw-accent-soft, var(--sw-surface-3));
      color: var(--sw-accent);
      font-weight: var(--sw-fw-semibold);
    }
    .opt:disabled {
      color: var(--sw-text-3);
      cursor: default;
    }
    .opt .n {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .note {
      padding: 8px 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .areas {
      display: flex;
      gap: 8px;
      margin-block-start: 6px;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      padding-block-end: 4px;
      -webkit-overflow-scrolling: touch;
    }
    .areas sw-chip {
      flex: none;
      scroll-snap-align: start;
      min-block-size: 44px;
    }
    .back {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sw-z-modal, 50) - 1);
      background: var(--sw-overlay, rgba(0, 0, 0, 0.4));
    }
    @media (max-width: 599px) {
      .crumb {
        min-block-size: 44px;
        padding: 0 10px;
      }
      .menu {
        position: fixed;
        inset-inline: 0;
        inset-block: auto 0;
        max-block-size: 65vh;
        border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
        padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
      }
      .opt {
        min-block-size: 48px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    try {
      this.mq = window.matchMedia('(max-width: 599px)');
      this.phone = this.mq.matches;
      this.mq.addEventListener('change', this.onMq);
    } catch {
      this.mq = null;
    }
    document.addEventListener('pointerdown', this.onOutside, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq?.removeEventListener('change', this.onMq);
    document.removeEventListener('pointerdown', this.onOutside, true);
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('areaId')) this.open = ''; // navigated: a list left open is closed
  }

  private onMq = () => {
    this.phone = this.mq?.matches ?? false;
  };

  private onOutside = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.open = '';
  };

  private async ensureTree() {
    if (this.tree || this.treeError) return;
    try {
      this.tree = await getDevicesTree();
    } catch {
      this.treeError = true;
    }
  }

  private toggle(which: Exclude<Open, ''>, focusFirst = false) {
    const opening = this.open !== which;
    this.open = opening ? which : '';
    if (opening) {
      if (which === 'floor') void this.ensureTree();
      void this.updateComplete.then(() => (focusFirst ? this.focusOption(0) : undefined));
    }
  }

  private options(which: Exclude<Open, ''>): NavOption[] {
    return which === 'floor' ? floorOptions(this.tree, this.areaName) : areaOptions(this.areas);
  }

  private isCurrent(which: Exclude<Open, ''>, o: NavOption): boolean {
    return which === 'area' ? o.id === this.areaId : o.name === (this.floorName || 'ללא קומה');
  }

  private optionButtons(): HTMLButtonElement[] {
    return [...(this.renderRoot.querySelectorAll<HTMLButtonElement>('.menu .opt:not(:disabled)') ?? [])];
  }

  private focusOption(i: number) {
    const list = this.optionButtons();
    if (!list.length) return;
    const cur = list.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    (i < 0 ? list[list.length - 1] : list[i === 0 && cur >= 0 ? cur : Math.min(i, list.length - 1)]).focus();
  }

  private onTriggerKey(e: KeyboardEvent, which: Exclude<Open, ''>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.open !== which) this.toggle(which, true);
      else this.focusOption(0);
    } else if (e.key === 'Escape' && this.open) {
      this.open = '';
    }
  }

  private onMenuKey(e: KeyboardEvent, which: Exclude<Open, ''>) {
    const list = this.optionButtons();
    const at = list.indexOf(this.renderRoot.querySelector<HTMLButtonElement>('.menu .opt:focus') ?? (document.activeElement as HTMLButtonElement));
    const focus = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') focus(at + 1);
    else if (e.key === 'ArrowUp') focus(at < 0 ? -1 : at - 1);
    else if (e.key === 'Home') focus(0);
    else if (e.key === 'End') focus(-1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.open = '';
      void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`[data-crumb="${which}"]`)?.focus());
    } else if (e.key === 'Tab') this.open = '';
  }

  private choose(o: NavOption) {
    if (!o.href) return;
    this.open = '';
    navigate(o.href);
  }

  private renderMenu(which: Exclude<Open, ''>) {
    if (this.open !== which) return nothing;
    const opts = this.options(which);
    const label = which === 'floor' ? 'קומות' : 'אזורים בקומה';
    const body = opts.length
      ? opts.map(
          (o) => html`<button type="button" role="menuitemradio" class="opt" data-nav-option=${o.id} data-count=${o.count} aria-checked=${String(this.isCurrent(which, o))} ?disabled=${!o.href} @click=${() => this.choose(o)}>
            <span>${bidi(o.name)}</span><span class="n">${o.count}</span>
          </button>`,
        )
      : html`<div class="note">${which === 'floor' && !this.treeError ? 'טוען קומות…' : which === 'floor' ? 'לא ניתן לטעון את הקומות' : 'אין אזורים'}</div>`;
    return html`${this.phone ? html`<div class="back" @click=${() => (this.open = '')}></div>` : nothing}
      <div class="menu" role="menu" aria-label=${label} data-nav-menu=${which} @keydown=${(e: KeyboardEvent) => this.onMenuKey(e, which)}>${body}</div>`;
  }

  private trigger(which: Exclude<Open, ''>, text: string, current: boolean) {
    return html`<span class="wrap">
      <button type="button" class="crumb" data-crumb=${which} aria-haspopup="menu" aria-expanded=${String(this.open === which)} aria-current=${current ? 'location' : nothing} @click=${() => this.toggle(which)} @keydown=${(e: KeyboardEvent) => this.onTriggerKey(e, which)}>
        <span>${bidi(text)}</span><sw-icon name="chevronDown" size=${12}></sw-icon>
      </button>${this.renderMenu(which)}
    </span>`;
  }

  render() {
    const floor = this.floorName || 'ללא קומה';
    const sep = html`<span class="sep" aria-hidden="true"><sw-icon name="chevron" size=${11}></sw-icon></span>`;
    return html`<nav aria-label="ניווט: קומה ואזור">
        <a class="crumb" data-crumb="home" href="#/devices/building" @click=${(e: Event) => { e.preventDefault(); navigate('/devices/building'); }}>${this.phone ? html`<sw-icon name="home" size=${16}></sw-icon>` : nothing}<span>חשמל והתקנים</span></a>
        ${sep}${this.trigger('floor', floor, this.phone)}
        ${this.phone ? nothing : html`${sep}${this.trigger('area', this.areaName, true)}`}
      </nav>
      ${this.phone && this.areas.length > 1
        ? html`<div class="areas" role="navigation" aria-label="אזורים בקומה">${this.areas.map(
            (a) => html`<sw-chip data-nav-option=${a.area_id} data-count=${a.counts.entities} ?selected=${a.area_id === this.areaId} .count=${a.counts.entities} @click=${() => navigate(`/devices/areas/${encodeURIComponent(a.area_id)}`)}>${bidi(a.name)}</sw-chip>`,
          )}</div>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-area-nav': DevicesAreaNav;
  }
}
