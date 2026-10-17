import { LitElement, html, css, nothing } from 'lit';
import { leadReserveStyles } from '../styles/lead-reserve';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-dropdown';
import { getDevicesTree, type DeviceCounts, type DeviceTree } from '../api/devices';
import { navigate } from '../router';
import { bidi } from '../i18n/bidi';
import { TabsModeController } from '../shell/tabs-mode';

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
 * from any other. Keyboard: Enter / Space / ArrowDown open a list, ArrowUp / ArrowDown / Home / End move, Esc closes and
 * returns to the control.
 *
 * HOME polish, owner request 2026-10-10: the floor and the area are two comfortable PICKERS side by side (a caption, the
 * value, a chevron; 44 px, the group's dropdown size dial grows or shrinks them), on every width and in every skin - the
 * floor first, the area beside it in reading order. The area picker IS the page title (its value is the screen's h1), so the
 * area's name is on the screen once; the floor's areas are no longer a chip row on the phone nor a chip in the shell's pair
 * row (both lists open under their picker; a bottom sheet on a phone). The floors / areas tree of the home screen is untouched.
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
  /** The home group's dropdown SIZE dial (sm / md / lg) sizes the two pickers (`data-dd-size` on the host). */
  private tabsMode = new TabsModeController(this, 'home');

  static styles = css`
    ${leadReserveStyles}
    :host {
      display: block;
      margin-block-end: 4px;
      min-inline-size: 0;
      max-inline-size: 100%;
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
    /* the two pickers (owner 2026-10-10): a field-like control - the level's caption over its value, a chevron at the end */
    .picks {
      display: flex;
      align-items: stretch;
      gap: 8px;
      flex-wrap: wrap;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .picks .wrap {
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .pick {
      display: inline-grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 8px;
      box-sizing: border-box;
      min-inline-size: 150px;
      max-inline-size: 100%;
      min-block-size: var(--pick-h, 44px);
      padding: 4px 10px 4px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    :host([data-dd-size='sm']) {
      --pick-h: 36px;
    }
    :host([data-dd-size='lg']) {
      --pick-h: 52px;
    }
    .pick > sw-icon:first-child {
      color: var(--sw-text-3);
    }
    .pick .chev {
      color: var(--sw-text-2);
    }
    .pick .pt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.15;
    }
    .pick .cap {
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
    }
    .pick .val {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      letter-spacing: normal;
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pick[data-crumb='area'] .val {
      font-size: var(--sw-fs-xl);
    }
    .pick:hover {
      border-color: var(--sw-text-3);
      background: var(--sw-surface-2);
    }
    .pick[aria-expanded='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pick:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (prefers-reduced-motion: no-preference) {
      .pick {
        transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
      }
      .pick .chev {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
    }
    .pick[aria-expanded='true'] .chev {
      transform: rotate(180deg);
    }
    .menu {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-start: 0;
      z-index: var(--sw-z-modal);
      min-inline-size: 200px;
      max-block-size: min(60vh, 420px);
      overflow: auto;
      padding: 4px;
      /* the picker's list (a popover, a bottom sheet on a phone) is a menu: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
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
    .back {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sw-z-modal) - 1);
      background: var(--sw-overlay);
    }
    @media (max-width: 599px) {
      .crumb {
        min-block-size: 44px;
        padding: 0 10px;
      }
      /* a phone: the two pickers take the next line, side by side; a long area name gets the whole line */
      .picks {
        flex: 1 1 100%;
      }
      .picks .wrap {
        flex: 1 1 calc(50% - 4px);
        display: flex;
      }
      .pick {
        flex: 1 1 auto;
        inline-size: 100%;
        min-inline-size: 0;
        min-block-size: max(var(--pick-h, 44px), 44px);
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

  /** The group's dropdown size dial on the host (the pickers read it); re-evaluated on every render (the controller re-renders on a change). */
  protected updated() {
    const size = this.tabsMode.ddSize;
    if (this.getAttribute('data-dd-size') !== size) this.setAttribute('data-dd-size', size);
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

  /** A picker: the level's caption over its value (the area's value is the page's h1), the chevron, and its list. */
  private pick(which: Exclude<Open, ''>, caption: string, text: string, icon: 'floor' | 'door') {
    const value = which === 'area' ? html`<h1 class="val">${bidi(text)}</h1>` : html`<span class="val">${bidi(text)}</span>`;
    return html`<span class="wrap">
      <button type="button" class="pick" data-crumb=${which} aria-haspopup="menu" aria-expanded=${String(this.open === which)} aria-current=${which === 'area' ? 'location' : nothing} aria-label=${`${caption}: ${text}`} @click=${() => this.toggle(which)} @keydown=${(e: KeyboardEvent) => this.onTriggerKey(e, which)}>
        <sw-icon .name=${icon} size=${16}></sw-icon>
        <span class="pt"><span class="cap" aria-hidden="true">${caption}</span>${value}</span>
        <sw-icon class="chev" name="chevronDown" size=${14}></sw-icon>
      </button>${this.renderMenu(which)}
    </span>`;
  }

  render() {
    const floor = this.floorName || 'ללא קומה';
    const sep = html`<span class="sep" aria-hidden="true"><sw-icon name="chevron" size=${11}></sw-icon></span>`;
    // the unassigned bucket is not an area of a floor: the floor picker alone, the page keeps its plain title
    const area = this.areaId !== 'unassigned';
    return html`<nav class="lead-head" aria-label="ניווט: קומה ואזור">
        <a class="crumb" data-crumb="home" href="#/devices/building" @click=${(e: Event) => { e.preventDefault(); navigate('/devices/building'); }}>${this.phone ? html`<sw-icon name="home" size=${16}></sw-icon>` : nothing}<span>חשמל והתקנים</span></a>
        ${sep}
        <div class="picks" data-nav-picks>${this.pick('floor', 'קומה', floor, 'floor')}${area ? this.pick('area', 'אזור', this.areaName, 'door') : nothing}</div>
      </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-area-nav': DevicesAreaNav;
  }
}
