import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

/**
 * The look of the closed control and of the list (0.1.157, owner decision 2026-10-03: all six approved). `auto` = today's look (the
 * skin's resting style; nothing changes until a style is chosen). The styles live HERE, not in the skins: tokens only, so the four
 * skins, the ten palettes, light and dark, the radius / touch / performance dials all apply. Backend twin: services/dd_style.py.
 */
import { DD_STYLE_IDS, type DdStyle } from './dd-style';
export { DD_STYLE_IDS, type DdStyle };
/** A list of this many options or more gets a search field (the mockups' long lists: the settings tabs, 13 items). */
export const DD_SEARCH_MIN_ITEMS = 8;
type Present = 'pop' | 'sheet' | 'centred' | 'inline';

export interface DropdownItem {
  id: string;
  label: string;
  /** Shown as "(6)" in the option and, for the selected one, in the chip. */
  count?: number;
  /** A dot on the option, and on the chip while this option is not the selected one: `true` = alert (red), `'warn'` = attention (amber). */
  alert?: boolean | 'warn';
  /** Options with the same `group` are listed together under that heading (the floors of an area list). */
  group?: string;
  /** Where choosing it lands, for a list that navigates (a link target; the host handles it on `change`). */
  href?: string;
}

/**
 * A compact dropdown for choosing ONE of a list (0.1.153, the tabs presentation modes): a 32 px chip with a 44 px hit area and a
 * translucent popover with a real listbox - `aria-haspopup="listbox"` / `aria-expanded` / `aria-controls` on the chip,
 * `role="listbox"` + `aria-activedescendant` on the popover, `role="option"` / `aria-selected` on the options (44 px each), groups as
 * `role="group"`. Keys: Arrow Up/Down move (wrapping), Home / End jump, typeahead jumps to the next option starting with the typed
 * text, Enter / Space choose, Esc closes and returns focus to the chip, Tab closes; an outside press closes. The chip opens with
 * Arrow Down / Up, Enter, Space. The popover lives in the top layer (the popover API; a fixed box when it is missing), so a row that
 * scrolls or clips never cuts it, and it is anchored to the chip's inline edge, kept inside the viewport (RTL aware). Motion uses
 * the `--sw-t-*` tokens, which are 0 ms under prefers-reduced-motion. Fires `change` ({ id }) when the choice changes.
 * 0.1.157 (styles other than `auto`): a list of 8+ options carries a search field (live filter, keys keep working from it); on the
 * phone the list is a bottom sheet / a centred box / inline following the Bubble `popup` dial (`data-bubble-popup` on <html>).
 */
@customElement('sw-dropdown')
export class SwDropdown extends LitElement {
  @property({ attribute: false }) items: DropdownItem[] = [];
  @property() value = '';
  /** The accessible name of the chip and the list. */
  @property() label = '';
  @property() icon?: IconName;
  @property() placeholder = '';
  /** Fills its flexible box (a chip of the pair row: equal widths, min 0, the text ellipsised). */
  @property({ type: Boolean, reflect: true }) block = false;
  /** 0.1.157: the style (attribute `dd-style`, reflected so the per-style CSS below matches the host); `auto` / unknown = today's look. */
  @property({ attribute: 'dd-style', reflect: true }) ddStyle: DdStyle = 'auto';
  @state() private open = false;
  @state() private cursor = -1;
  @state() private query = '';
  @state() private present: Present = 'pop';
  @state() private pos = { top: 0, left: 0, minWidth: 0, maxHeight: 320 };
  private seq = Math.random().toString(36).slice(2, 8);
  private typed = '';
  private typedTimer = 0;

  static styles = css`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    :host([block]) {
      display: flex;
      flex: 1 1 0;
    }
    :host([block]) .chip {
      flex: 1;
    }
    :host([block]) .txt {
      flex: 1 1 auto;
      text-align: start;
    }
    .chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      min-inline-size: 0;
      max-inline-size: 100%;
      padding-inline: 12px 8px;
      border: 1px solid var(--sw-dd-border, var(--sw-border-strong));
      border-radius: var(--sw-dd-radius, 10px);
      background: var(--sw-dd-bg, var(--sw-surface));
      color: var(--sw-dd-text, var(--sw-text));
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      box-shadow: var(--sw-dd-shadow, var(--sw-shadow-1));
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    /* the 44 px target: the chip stays 32 px and the hit area grows into the row's padding (the shell's floating-button trick) */
    .chip::after {
      content: '';
      position: absolute;
      inset-inline: -4px;
      inset-block: -7px;
    }
    .chip:hover {
      background: var(--sw-dd-hover, var(--sw-surface-2));
    }
    .chip:focus-visible,
    .opt:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 1px;
    }
    .chip[aria-expanded='true'] {
      border-color: var(--sw-dd-accent, var(--sw-accent));
    }
    .txt {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .n {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-dd-text-3, var(--sw-text-3));
      font-size: var(--sw-fs-xs);
    }
    .chev {
      flex: none;
      display: inline-flex;
      color: var(--sw-dd-text-3, var(--sw-text-3));
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .chip[aria-expanded='true'] .chev {
      transform: rotate(180deg);
    }
    .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .chip .dot {
      position: absolute;
      inset-block-start: -2px;
      inset-inline-end: -2px;
      box-shadow: 0 0 0 2px var(--sw-dd-bg, var(--sw-surface));
    }
    .pop {
      position: fixed;
      inset: auto;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--sw-dd-border-soft, var(--sw-border));
      border-radius: 14px;
      color: var(--sw-dd-text, var(--sw-text));
      background: var(--sw-dd-pop-bg, var(--mm-sheet-surface, color-mix(in srgb, var(--sw-surface) 86%, transparent)));
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(40px) saturate(1.8));
      backdrop-filter: var(--sw-perf-blur, blur(40px) saturate(1.8));
      box-shadow: var(--sw-shadow-3);
      outline: none;
      opacity: 1;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .pop[hidden] {
      display: none !important;
    }
    /* the options scroll, the search field above them stays put; the box of the listbox is the box of the popover (anchoring checks use it) */
    .lb {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: auto;
      padding: 4px;
      outline: none;
    }
    .none {
      padding: 14px 12px;
      color: var(--sw-dd-text-3, var(--sw-text-3));
      font-size: var(--sw-fs-sm);
    }
    /* the search field of a long list (8+ options) */
    .search {
      flex: none;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 6px 2px;
      padding-inline: 10px;
      min-block-size: 38px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border-strong);
      color: var(--sw-text-3);
    }
    .search:focus-within {
      border-color: var(--sw-accent);
    }
    .q {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }
    .q::placeholder {
      color: var(--sw-text-3);
    }
    .q::-webkit-search-cancel-button {
      -webkit-appearance: none;
    }
    /* the phone: a bottom sheet (default) or a centred box (the Bubble popup dial), both over a dimmed backdrop; inline = the list opens in the flow */
    :host .pop.sheet,
    :host .pop.centred {
      inset-inline: 0;
      inline-size: auto;
      max-inline-size: none;
      border-radius: var(--sw-r-xl) var(--sw-r-xl) 0 0;
      max-block-size: 72dvh;
      padding-block-end: env(safe-area-inset-bottom, 0px);
    }
    :host .pop.sheet {
      inset-block: auto 0;
    }
    :host .pop.centred {
      inset-inline: 16px;
      inset-block: 50% auto;
      transform: translateY(-50%);
      border-radius: var(--sw-r-xl);
      max-block-size: 70dvh;
      padding-block-end: 0;
    }
    .pop.sheet::backdrop,
    .pop.centred::backdrop {
      background: var(--sw-overlay, rgba(0, 0, 0, 0.4));
    }
    .grab {
      flex: none;
      inline-size: 36px;
      block-size: 4px;
      margin: 8px auto 4px;
      border-radius: 2px;
      background: var(--sw-border-strong);
    }
    .ttl {
      flex: none;
      padding: 2px 16px 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-semibold);
    }
    .pop.sheet .opt,
    .pop.centred .opt {
      min-block-size: 48px;
      border-radius: var(--sw-r-md);
    }
    :host([data-present='inline']) {
      flex-wrap: wrap;
    }
    .pop.inline {
      position: static;
      flex: 1 1 100%;
      inline-size: 100%;
      margin-block-start: 6px;
      max-block-size: 60vh;
    }
    .opt {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 12px;
      border-radius: 10px;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      user-select: none;
    }
    .opt .lbl {
      flex: 1;
      min-inline-size: 0;
    }
    .opt[data-active] {
      background: var(--sw-dd-active, var(--sw-surface-3));
    }
    .opt[aria-selected='true'] {
      color: var(--sw-dd-accent, var(--sw-accent-text, var(--sw-accent)));
      font-weight: var(--sw-fw-semibold);
    }
    .grp {
      padding: 8px 12px 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-dd-text-3, var(--sw-text-3));
      font-weight: var(--sw-fw-semibold);
    }
    @media (forced-colors: active) {
      .opt[aria-selected='true'] {
        outline: 2px solid Highlight;
      }
    }

    /* ---- 0.1.157 styles: tokens only (skins, palettes, light / dark, radius / touch / performance dials). auto has none of this. ---- */
    :host(:where(:not([dd-style='auto']))) {
      --_h: max(28px, calc(var(--sw-touch-desktop, 44px) - 12px));
      --_opt: var(--sw-touch-desktop, 44px);
    }
    :host(:where(:not([dd-style='auto']))) .chip {
      min-block-size: var(--_h);
      border-radius: var(--sw-r-sm);
    }
    :host(:where(:not([dd-style='auto']))) .chip::after {
      inset-block: calc((var(--_h) - var(--_opt)) / 2);
    }
    :host(:where(:not([dd-style='auto']))) .chip:focus-visible,
    :host(:where(:not([dd-style='auto']))) .opt:focus-visible {
      outline-offset: 2px;
    }
    :host(:where(:not([dd-style='auto']))) .pop {
      border: 0;
      border-radius: var(--sw-r-lg);
      background: var(--sw-dd-pop-bg, var(--sw-perf-glass-bg, var(--sw-surface-solid)));
      box-shadow: 0 0 0 1px var(--sw-border), var(--sw-shadow-3);
      -webkit-backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur-sheet, none));
      backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur-sheet, none));
    }
    :host(:where(:not([dd-style='auto']))) .opt {
      min-block-size: var(--_opt);
      border-radius: var(--sw-r-sm);
    }
    .pre {
      display: none;
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
    }
    /* pill: a filled pill, no border */
    :host([dd-style='pill']) .chip {
      border-color: transparent;
      border-radius: var(--sw-r-pill);
      background: var(--sw-dd-pill-bg, var(--sw-surface-3));
      box-shadow: none;
    }
    :host([dd-style='pill']) .chip:hover {
      background: var(--sw-dd-hover, var(--sw-surface-2));
    }
    :host([dd-style='pill']) .chip[aria-expanded='true'] {
      background: var(--sw-surface-solid);
      box-shadow: var(--sw-shadow-2);
    }
    :host([dd-style='pill']) .opt {
      border-radius: var(--sw-r-pill);
    }
    :host([dd-style='pill']) .opt[aria-selected='true'] {
      background: var(--sw-surface-solid);
      box-shadow: var(--sw-shadow-1);
    }
    :host([dd-style='pill']) .opt[aria-selected='true'][data-active] {
      background: var(--sw-surface-3);
    }
    /* field: a bordered form control, a check mark on the selected option */
    :host([dd-style='field']) .chip {
      background: var(--sw-surface);
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    :host([dd-style='field']) .opt[aria-selected='true']::after {
      content: '';
      flex: none;
      inline-size: 14px;
      block-size: 14px;
      background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }
    /* underline: the tab that stayed a tab */
    :host([dd-style='underline']) .chip {
      padding-inline: 6px 2px;
      border-color: transparent;
      border-radius: var(--sw-r-sm) var(--sw-r-sm) 0 0;
      background: transparent;
      color: var(--sw-accent-text, var(--sw-accent));
      box-shadow: inset 0 -2px 0 var(--sw-accent);
    }
    :host([dd-style='underline']) .chip .chev,
    :host([dd-style='underline']) .chip .n {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    :host([dd-style='underline']) .chip:hover,
    :host([dd-style='underline']) .chip[aria-expanded='true'] {
      background: var(--sw-accent-soft);
    }
    :host([dd-style='underline']) .chip[aria-expanded='true'] {
      box-shadow: inset 0 -3px 0 var(--sw-accent);
    }
    :host([dd-style='underline']) .opt {
      border-inline-start: 3px solid transparent;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }
    :host([dd-style='underline']) .opt[aria-selected='true'] {
      border-inline-start-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    /* text: the title is the menu (the chevron sits in a small round badge) */
    :host([dd-style='text']) .chip {
      padding-inline: 2px 0;
      gap: 8px;
      border-color: transparent;
      background: transparent;
      box-shadow: none;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold, 700);
      color: var(--sw-heading, var(--sw-text));
    }
    :host([dd-style='text']) .chip .n {
      font-size: var(--sw-fs-sm);
      align-self: flex-end;
      margin-block-end: 2px;
    }
    :host([dd-style='text']) .chip .chev {
      inline-size: 22px;
      block-size: 22px;
      justify-content: center;
      align-items: center;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    :host([dd-style='text']) .chip:hover .chev,
    :host([dd-style='text']) .chip[aria-expanded='true'] .chev {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    :host([dd-style='text']) .chip .dot {
      position: static;
      box-shadow: none;
      margin-inline-start: -2px;
    }
    :host([dd-style='text']) .chip:focus-visible {
      outline-offset: 4px;
    }
    :host([dd-style='text']) .opt {
      font-size: var(--sw-fs-md, var(--sw-fs-sm));
    }
    :host([dd-style='text']) .opt[aria-selected='true'] {
      color: var(--sw-heading, var(--sw-text));
      font-weight: var(--sw-fw-bold, 700);
    }
    :host([dd-style='text']) .opt[aria-selected='true']::before {
      content: '';
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-accent);
      margin-inline-end: 2px;
    }
    @media (max-width: 767px) {
      :host([dd-style='text'][block]) .chip {
        font-size: var(--sw-fs-lg, var(--sw-fs-sm));
      }
    }
    /* prefix: the group name before the value ("אבטחה: חקירה"); a pair chip on the phone drops it (width) */
    :host([dd-style='prefix']) .pre {
      display: inline;
      padding-inline-end: 8px;
      margin-inline-end: 8px;
      border-inline-end: 1px solid var(--sw-border-strong);
    }
    @media (max-width: 767px) {
      :host([dd-style='prefix'][block]) .pre {
        display: none;
      }
    }
    :host([dd-style='prefix']) .chip {
      gap: 0;
      padding-inline-start: 10px;
      border-color: transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
      box-shadow: none;
    }
    :host([dd-style='prefix']) .chip .txt {
      margin-inline-end: 6px;
    }
    :host([dd-style='prefix']) .chip .n {
      margin-inline-end: 4px;
    }
    :host([dd-style='prefix']) .chip:hover {
      background: var(--sw-surface-2);
    }
    :host([dd-style='prefix']) .chip[aria-expanded='true'] {
      box-shadow: inset 0 0 0 1px var(--sw-accent);
    }
    :host([dd-style='prefix']) .opt[aria-selected='true'] {
      background: var(--sw-surface-3);
    }
    :host([dd-style='prefix']) .grp {
      margin: 0 6px 4px;
      padding: 6px;
      border-block-end: 1px solid var(--sw-border-strong);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    /* tonal: the selected segment of a pill bar, standing alone */
    :host([dd-style='tonal']) .chip {
      border-color: transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
      box-shadow: none;
    }
    :host([dd-style='tonal']) .chip .chev,
    :host([dd-style='tonal']) .chip .n {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    :host([dd-style='tonal']) .chip:hover {
      box-shadow: inset 0 0 0 1px var(--sw-accent);
    }
    :host([dd-style='tonal']) .chip[aria-expanded='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse, #fff);
    }
    :host([dd-style='tonal']) .chip[aria-expanded='true'] .chev,
    :host([dd-style='tonal']) .chip[aria-expanded='true'] .n {
      color: var(--sw-text-inverse, #fff);
    }
    :host([dd-style='tonal']) .opt {
      border-radius: var(--sw-r-md);
    }
    :host([dd-style='tonal']) .opt[aria-selected='true'] {
      background: var(--sw-accent-soft);
    }
    :host([dd-style='tonal']) .opt[aria-selected='true'][data-active] {
      box-shadow: inset 0 0 0 1px var(--sw-accent);
    }
    /* ---- the mockups' per-skin notes (docs/design/compare/dropdown-styles): the list surface and four small exceptions. The skin is mirrored on the host (data-skin). ---- */
    /* classic and Tesla: an opaque list (the base above); Domus: the glass sheet (84 % of the solid surface under the blur); Bubble: its own sheet colour at the transparency dial (skins/bubble.ts) */
    :host([data-skin='domus']:not([dd-style='auto'])) .pop {
      background: var(--sw-dd-pop-bg, var(--sw-perf-glass-bg, color-mix(in srgb, var(--sw-surface-solid) 84%, transparent)));
    }
    /* Tesla: the pill is a 6 px rectangle there, so it gets a hairline to read as a control; the text style's badge follows the square radius */
    :host([data-skin='tesla'][dd-style='pill']) .chip {
      border-color: var(--sw-border);
    }
    :host([data-skin='tesla'][dd-style='text']) .chip .chev {
      border-radius: var(--sw-r-sm);
    }
    /* Bubble: the field style rounds to r-md (the borderless language, softened) */
    :host([data-skin='bubble'][dd-style='field']) .chip {
      border-radius: var(--sw-r-md);
    }
    :host([dd-style='pill']) .search {
      border-radius: var(--sw-r-pill);
    }
    :host([dd-style='underline']) .pop.pop:not(.sheet):not(.centred) {
      border-radius: var(--sw-r-md);
    }
    :host([dd-style='text']) .pop {
      min-inline-size: 240px;
    }
    @media (prefers-reduced-transparency: reduce) {
      .pop {
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      :host([data-skin='domus']:not([dd-style='auto'])) .pop {
        background: var(--sw-surface-solid);
      }
    }
    @media (forced-colors: active) {
      :host(:where(:not([dd-style='auto']))) .chip {
        border: 1px solid ButtonText;
      }
      :host(:where(:not([dd-style='auto']))) .pop {
        border: 1px solid CanvasText;
      }
    }
  `;

  private onOutside = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.close(false);
  };

  private skinObserver?: MutationObserver;

  /** The active skin, mirrored on the host (`data-skin`): the per-skin exceptions of the six styles (the mockups' Tesla / Bubble / Domus notes) key on it. */
  private syncSkin = () => {
    const skin = document.documentElement.getAttribute('data-skin') ?? '';
    if (skin) {
      if (this.getAttribute('data-skin') !== skin) this.setAttribute('data-skin', skin);
    } else this.removeAttribute('data-skin');
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside, true);
    this.syncSkin();
    try {
      this.skinObserver = new MutationObserver(this.syncSkin);
      this.skinObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin'] });
    } catch {
      /* no observer: the skin is read once */
    }
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.skinObserver?.disconnect();
    window.clearTimeout(this.typedTimer);
    super.disconnectedCallback();
  }

  /** An unknown `dd-style` string reads as `auto` (the attribute is reflected back as `auto`, so the per-style CSS never matches a stray value). */
  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('ddStyle') && !(DD_STYLE_IDS as readonly string[]).includes(this.ddStyle)) this.ddStyle = 'auto';
  }

  /** How the open list is presented: a popover under the chip on a wide screen; on the phone (a style other than `auto`) the Bubble `popup` dial decides - sheet (default), centred, inline. */
  private presentation(): Present {
    if (this.ddStyle === 'auto') return 'pop';
    let phone = false;
    try {
      phone = window.matchMedia('(max-width: 767px)').matches;
    } catch {
      /* no matchMedia */
    }
    if (!phone) return 'pop';
    const dial = document.documentElement.getAttribute('data-bubble-popup');
    return dial === 'centred' ? 'centred' : dial === 'inline' ? 'inline' : 'sheet';
  }

  /** Item indices that match the search text (all of them without one). */
  private shownIdx(): number[] {
    const q = this.query.trim().toLocaleLowerCase();
    const out: number[] = [];
    this.items.forEach((it, i) => {
      if (!q || it.label.toLocaleLowerCase().includes(q)) out.push(i);
    });
    return out;
  }

  private get hasSearch(): boolean {
    return this.items.length >= DD_SEARCH_MIN_ITEMS;
  }

  private lbEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.lb');
  }

  private searchEl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('.q');
  }

  /** True when an option other than the selected one carries an alert (the chip's dot). */
  private get hiddenAlert(): false | 'alert' | 'warn' {
    let warn = false;
    for (const it of this.items) {
      if (it.id === this.value || !it.alert) continue;
      if (it.alert === true) return 'alert';
      warn = true;
    }
    return warn ? 'warn' : false;
  }

  private get selected(): DropdownItem | undefined {
    return this.items.find((i) => i.id === this.value);
  }

  private popEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.pop');
  }

  private chipEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.chip');
  }

  private place() {
    const chip = this.chipEl();
    if (!chip) return;
    const r = chip.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const minWidth = Math.min(Math.max(r.width, this.ddStyle === 'text' ? 240 : 200), vw - pad * 2);
    // anchored to the chip's inline-start edge (the right edge in RTL), then kept inside the viewport
    let left = rtl ? r.right - minWidth : r.left;
    left = Math.max(pad, Math.min(left, vw - pad - minWidth));
    const below = vh - r.bottom - pad - 4;
    const above = r.top - pad - 4;
    const flip = below < 220 && above > below;
    const maxHeight = Math.max(160, Math.min(flip ? above : below, 360));
    const rows = Math.min(this.items.length, 8) * 44 + 16 + (this.hasSearch ? 46 : 0);
    this.pos = { top: flip ? Math.max(pad, r.top - 4 - Math.min(maxHeight, rows)) : r.bottom + 4, left, minWidth, maxHeight };
  }

  private async openList(cursor?: number) {
    if (this.open || !this.items.length) return;
    this.present = this.presentation();
    if (this.present === 'inline') this.setAttribute('data-present', 'inline');
    else this.removeAttribute('data-present');
    this.query = '';
    this.place();
    this.open = true;
    const sel = this.items.findIndex((i) => i.id === this.value);
    this.cursor = cursor ?? (sel >= 0 ? sel : 0);
    await this.updateComplete;
    const pop = this.popEl();
    if (pop) {
      try {
        if (this.present !== 'inline') (pop as HTMLElement & { showPopover?: () => void }).showPopover?.();
      } catch {
        /* already showing, or no popover API: the element is then a plain fixed box */
      }
      // a search field takes the focus where there is a keyboard to type with; a touch screen keeps the keyboard down until the field is tapped
      let fine = true;
      try {
        fine = window.matchMedia('(pointer: fine)').matches;
      } catch {
        /* assume a pointer */
      }
      const q = this.searchEl();
      (q && fine ? q : this.lbEl() ?? pop).focus({ preventScroll: true });
      this.scrollToCursor();
    }
  }

  private close(refocus: boolean) {
    if (!this.open) return;
    const pop = this.popEl();
    try {
      (pop as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
    } catch {
      /* not showing */
    }
    this.open = false;
    this.query = '';
    window.clearTimeout(this.typedTimer);
    this.typed = '';
    if (refocus) void this.updateComplete.then(() => this.chipEl()?.focus({ preventScroll: true }));
  }

  private choose(i: number) {
    const it = this.items[i];
    if (!it) return;
    const changed = it.id !== this.value;
    this.value = it.id;
    this.close(true);
    if (changed) this.dispatchEvent(new CustomEvent('change', { detail: { id: it.id }, bubbles: true, composed: true }));
  }

  /** Move the cursor by `d` among the options the search leaves (wrapping). */
  private step(d: number) {
    const shown = this.shownIdx();
    if (!shown.length) return;
    const at = shown.indexOf(this.cursor);
    this.cursor = shown[at < 0 ? (d > 0 ? 0 : shown.length - 1) : (at + d + shown.length) % shown.length];
    this.scrollToCursor();
  }

  /** Jump to the first / last option the search leaves. */
  private jump(last: boolean) {
    const shown = this.shownIdx();
    if (!shown.length) return;
    this.cursor = last ? shown[shown.length - 1] : shown[0];
    this.scrollToCursor();
  }

  private onQuery(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    const shown = this.shownIdx();
    if (!shown.includes(this.cursor)) this.cursor = shown[0] ?? -1;
    this.scrollToCursor();
  }

  /** A press on the dimmed backdrop of a sheet (the click lands on the popover element, outside its box) closes it. */
  private onPopClick(e: MouseEvent) {
    if (this.present !== 'sheet' && this.present !== 'centred') return;
    const r = this.popEl()?.getBoundingClientRect();
    if (r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) this.close(true);
  }

  private scrollToCursor() {
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.opt[data-active]')?.scrollIntoView({ block: 'nearest' }));
  }

  private onChipKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void this.openList();
    } else if (e.key === 'Escape' && this.open) {
      this.close(true);
    }
  }

  private onListKey(e: KeyboardEvent) {
    const k = e.key;
    const inSearch = (e.composedPath()[0] as HTMLElement | undefined)?.classList?.contains('q') ?? false;
    if (k === 'ArrowDown') {
      e.preventDefault();
      this.step(1);
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      this.step(-1);
    } else if ((k === 'Home' || k === 'End') && !(inSearch && this.query)) {
      // in the search field with text typed, Home / End move the caret instead
      e.preventDefault();
      this.jump(k === 'End');
    } else if (k === 'Enter' || (k === ' ' && !inSearch)) {
      e.preventDefault();
      if (this.cursor >= 0) this.choose(this.cursor);
    } else if (inSearch && k !== 'Escape' && k !== 'Tab') {
      return; // typing in the search field: the field's own input event filters the list
    } else if (k === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close(true);
    } else if (k === 'Tab') {
      this.close(false);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // typeahead: the typed text so far (reset after 600 ms); the same letter again cycles through the options starting with it
      e.preventDefault();
      window.clearTimeout(this.typedTimer);
      this.typed += k.toLocaleLowerCase();
      this.typedTimer = window.setTimeout(() => (this.typed = ''), 600);
      const n = this.items.length;
      const cycle = this.typed.length > 1 && [...this.typed].every((c) => c === this.typed[0]);
      const needle = cycle ? this.typed[0] : this.typed;
      const from = cycle || this.typed.length === 1 ? this.cursor + 1 : this.cursor;
      for (let o = 0; o < n; o++) {
        const idx = (from + o) % n;
        if (this.items[idx].label.toLocaleLowerCase().startsWith(needle)) {
          this.cursor = idx;
          this.scrollToCursor();
          break;
        }
      }
    }
  }

  private optionId(i: number) {
    return `o-${this.seq}-${i}`;
  }

  private renderItems() {
    const out: unknown[] = [];
    let lastGroup: string | undefined;
    const shown = new Set(this.shownIdx());
    if (!shown.size) return [html`<div class="none" role="status" data-dd-none>לא נמצאו תוצאות</div>`];
    this.items.forEach((it, i) => {
      if (!shown.has(i)) return;
      if (it.group && it.group !== lastGroup) out.push(html`<div class="grp" role="presentation" aria-hidden="true">${it.group}</div>`);
      lastGroup = it.group;
      out.push(html`<div class="opt" role="option" id=${this.optionId(i)} data-id=${it.id} aria-selected=${String(it.id === this.value)} ?data-active=${i === this.cursor}
        @click=${() => this.choose(i)} @pointermove=${() => (this.cursor = i)}>
        <span class="lbl">${it.label}</span>${it.count !== undefined ? html`<span class="n">(${it.count})</span>` : nothing}${it.alert ? html`<span class="dot ${it.alert === 'warn' ? 'warn' : ''}" data-alert="${it.alert === 'warn' ? 'warn' : 'alert'}"></span>` : nothing}
      </div>`);
    });
    return out;
  }

  protected updated(changed: Map<string, unknown>) {
    if (this.open && (changed.has('pos') || changed.has('open') || changed.has('present'))) {
      const pop = this.popEl();
      // only the popover is anchored to the chip; a sheet, a centred box and the inline list are placed by the CSS
      if (pop) pop.style.cssText = this.present === 'pop' ? `top:${this.pos.top}px;left:${this.pos.left}px;min-inline-size:${this.pos.minWidth}px;max-block-size:${this.pos.maxHeight}px;` : '';
    }
  }

  render() {
    const sel = this.selected;
    const alert = this.hiddenAlert;
    const name = sel ? `${sel.label}${sel.count !== undefined ? ` (${sel.count})` : ''}` : this.placeholder;
    const aria = `${[this.label, name].filter(Boolean).join(': ')}${alert ? ', יש התראות באפשרויות אחרות' : ''}`;
    const listId = `l-${this.seq}`;
    return html`<button type="button" class="chip" data-dropdown-chip aria-haspopup="listbox" aria-expanded=${String(this.open)} aria-controls=${listId} aria-label=${aria}
        @click=${() => (this.open ? this.close(true) : void this.openList())} @keydown=${(e: KeyboardEvent) => this.onChipKey(e)}>
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${15}></sw-icon>` : nothing}${this.ddStyle === 'prefix' && this.label ? html`<span class="pre" data-dd-prefix aria-hidden="true">${this.label}</span>` : nothing}
        <span class="txt">${sel?.label ?? this.placeholder}</span>${sel?.count !== undefined ? html`<span class="n">(${sel.count})</span>` : nothing}
        <span class="chev" aria-hidden="true"><sw-icon name="chevronDown" size=${12}></sw-icon></span>
        ${alert ? html`<span class="dot ${alert === 'warn' ? 'warn' : ''}" data-chip-alert=${alert}></span>` : nothing}
      </button>
      <div class="pop ${this.present}" popover=${this.present === 'inline' ? nothing : 'manual'} ?hidden=${!this.open} data-present=${this.present} @keydown=${(e: KeyboardEvent) => this.onListKey(e)} @click=${(e: MouseEvent) => this.onPopClick(e)}>
        ${this.open && (this.present === 'sheet' || this.present === 'centred') ? html`<div class="grab" aria-hidden="true"></div>${this.label ? html`<div class="ttl" aria-hidden="true">${this.label}</div>` : nothing}` : nothing}
        ${this.open && this.hasSearch
          ? html`<label class="search"><sw-icon name="search" size=${14}></sw-icon><input class="q" type="search" data-dd-search placeholder="חיפוש" aria-label=${`חיפוש ב${this.label || 'רשימה'}`} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
              role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls=${listId} aria-activedescendant=${this.cursor >= 0 ? this.optionId(this.cursor) : nothing} .value=${this.query} @input=${(e: Event) => this.onQuery(e)} /></label>`
          : nothing}
        <div class="lb" id=${listId} role="listbox" tabindex="-1" aria-label=${this.label || nothing} aria-activedescendant=${this.cursor >= 0 ? this.optionId(this.cursor) : nothing}>${this.open ? this.renderItems() : nothing}</div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-dropdown': SwDropdown;
  }
}
