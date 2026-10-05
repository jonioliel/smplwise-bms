import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

/**
 * The look of the closed control and of the list (0.1.157, owner decision 2026-10-03: all six approved). `auto` = today's look (the
 * skin's resting style; nothing changes until a style is chosen). The styles live HERE, not in the skins: tokens only, so the four
 * skins, the ten palettes, light and dark, the radius / touch / performance dials all apply. Backend twin: services/dd_style.py.
 */
import { DD_PANEL_IDS, DD_RING_IDS, DD_SIZE_IDS, DD_STYLE_IDS, ddPanelFloor, type DdPanel, type DdRing, type DdSize, type DdStyle } from './dd-style';
import { limitNotice, pickedCount, pickedSummary, toggleCapped } from './multi-select';
export { DD_PANEL_IDS, DD_RING_IDS, DD_SIZE_IDS, DD_STYLE_IDS, type DdPanel, type DdRing, type DdSize, type DdStyle };
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
  /** Unreleased (`capsule` style): an icon at the start of the option (and on the chip while selected, when the chip has no icon of its own). Other styles ignore it. */
  icon?: IconName;
  /** A separator line instead of an option (`capsule` style; the other styles skip it). Never selectable, never counted, skipped by the keys and the search. */
  divider?: boolean;
  /** 2.0.1 (`multiple`): listed but not choosable now (a camera of another recorder in a comparison); `aria-disabled`, reachable by the keys, a press does nothing. */
  disabled?: boolean;
}

/** `change` detail: the option chosen (single), or the option toggled and the whole selection (`multiple`; `id` is '' after "נקה"). */
export interface DropdownChange {
  id: string;
  ids?: string[];
}

/** An item that can be chosen (not a divider). */
const isOption = (it: DropdownItem | undefined): it is DropdownItem => !!it && !it.divider;

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
 * 2.0.1 `multiple` (owner request 2026-10-05, the recordings screen's camera comparison): `values` instead of `value`, up to `max`
 * picks; the list stays open while picking (Enter / Space / a press toggle), `aria-multiselectable`, the remaining options are
 * `aria-disabled` once the limit is reached and a press on one says "אפשר לבחור עד N" (role=status) instead of swapping; the foot of the
 * list carries the count ("n מתוך N"), "נקה" and "סיום"; the chip shows the picked names and the count. Fires `change` ({ id, ids }).
 * Same styles, presentations, search and keys as the single mode (components/multi-select.ts holds the pure logic).
 */
@customElement('sw-dropdown')
export class SwDropdown extends LitElement {
  @property({ attribute: false }) items: DropdownItem[] = [];
  @property() value = '';
  /** 2.0.1: several options at once (`values`, `max`, `count-base`); the single mode when absent. */
  @property({ type: Boolean, reflect: true }) multiple = false;
  /** 2.0.1 (`multiple`): the picked ids in pick order. */
  @property({ attribute: false }) values: string[] = [];
  /** 2.0.1 (`multiple`): at most this many picks (0 = no limit). */
  @property({ type: Number }) max = 0;
  /** 2.0.1 (`multiple`): a fixed member counted in "n מתוך N" on both sides but not in `values` (the recordings screen's lead camera: `max` 3, `count-base` 1 reads "עד 4"). */
  @property({ type: Number, attribute: 'count-base' }) countBase = 0;
  /** 2.0.1 (`multiple`): the short status line in the foot of the list after a refused pick (cleared by the next pick, a close). */
  @state() private notice = '';
  /** The accessible name of the chip and the list. */
  @property() label = '';
  @property() icon?: IconName;
  @property() placeholder = '';
  /** Fills its flexible box (a chip of the pair row: equal widths, min 0, the text ellipsised). */
  @property({ type: Boolean, reflect: true }) block = false;
  /** 0.1.157: the style (attribute `dd-style`, reflected so the per-style CSS below matches the host); `auto` / unknown = today's look. */
  @property({ attribute: 'dd-style', reflect: true }) ddStyle: DdStyle = 'auto';
  /** Unreleased: the size (attribute `dd-size`, reflected): `md` = the reference size (and today's size of every other style), `sm` smaller, `lg` bigger. */
  @property({ attribute: 'dd-size', reflect: true }) ddSize: DdSize = 'md';
  /** Unreleased (capsule only): the ring thickness in px, 1 | 1.5 | 2 (default) | 3 (attribute `dd-ring`, reflected). */
  @property({ attribute: 'dd-ring', reflect: true }) ddRing: DdRing = '2';
  /** Unreleased (capsule only): the open panel's width - `button` (as wide as the button) | 240 (default) | 300 px at the normal size, scaled by the size dial (attribute `dd-panel`, reflected). */
  @property({ attribute: 'dd-panel', reflect: true }) ddPanel: DdPanel = '240';
  @state() private open = false;
  @state() private cursor = -1;
  @state() private query = '';
  @state() private present: Present = 'pop';
  /** The bottom sheet is sliding out (200 ms): `open` is already false, the list is still drawn until the animation ends. */
  @state() private closing = false;
  private closeTimer = 0;
  private inerted: HTMLElement[] = [];
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
    /* 2.0.1: the search field of a multiple list is a target like its options (44 px on touch layouts, the desktop dial above); the input fills its label */
    :host([multiple]) .search {
      min-block-size: max(38px, var(--sw-touch-desktop, 44px));
    }
    @media (max-width: 1100px), (pointer: coarse) {
      :host([multiple]) .search {
        min-block-size: 44px;
      }
    }
    .q {
      flex: 1;
      align-self: stretch;
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
      /* the on-screen keyboard: --dd-kb is the height it covers, --dd-vh the visible height (set while the sheet is open, from visualViewport) */
      inset-block: auto var(--dd-kb, 0px);
      max-block-size: min(72dvh, calc(var(--dd-vh, 100dvh) - 16px));
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
    /* the bottom sheet slides up (the mockups' opening; backwards fill so a swipe's own inline transform takes over after it) and the scrim fades in;
       prefers-reduced-motion: none of it */
    :host .pop.sheet {
      animation: dd-sheet-in var(--sw-t-sheet, 280ms) var(--sw-ease-thumb, cubic-bezier(0.2, 0.8, 0.2, 1)) backwards;
    }
    .pop.sheet::backdrop {
      animation: dd-scrim-in 200ms ease-out backwards;
      /* the live page behind is blurred a little (the mockups: 3 px); not in the lite performance tier, not under reduced transparency */
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(3px));
      backdrop-filter: var(--sw-perf-blur, blur(3px));
    }
    /* closing: 200 ms ease-in down and out (the open attribute is already false; the popover stays up until the animation ends) */
    :host .pop.sheet.closing {
      animation: dd-sheet-out 200ms ease-in forwards;
      pointer-events: none;
    }
    .pop.sheet.closing::backdrop {
      animation: dd-scrim-out 200ms ease-in forwards;
    }
    @keyframes dd-sheet-out {
      to {
        transform: translateY(100%);
      }
    }
    @keyframes dd-scrim-out {
      to {
        opacity: 0;
      }
    }
    @media (prefers-reduced-transparency: reduce) {
      .pop.sheet::backdrop {
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
    }
    @keyframes dd-sheet-in {
      from {
        transform: translateY(100%);
      }
    }
    @keyframes dd-scrim-in {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host .pop.sheet,
      .pop.sheet::backdrop,
      :host .pop.sheet.closing,
      .pop.sheet.closing::backdrop {
        animation: none;
      }
    }
    /* the sheet's head (handle + title): the part a finger drags down to close it */
    .hd {
      flex: none;
      touch-action: none;
      cursor: grab;
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
    /* ---- 2.0.1 multiple: a check box drawn on every option, a dimmed one that cannot be picked now, the foot with the count / "נקה" / "סיום" ---- */
    :host([multiple]) .opt::before {
      content: '';
      flex: none;
      inline-size: 16px;
      block-size: 16px;
      box-sizing: border-box;
      border: 1.5px solid var(--sw-dd-border, var(--sw-border-strong));
      border-radius: var(--sw-r-xs, 4px);
      background: var(--sw-surface);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    :host([multiple]) .opt[aria-selected='true']::before {
      border-color: var(--sw-accent);
      background: var(--sw-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 12px no-repeat;
    }
    :host([multiple][dd-style='field']) .opt[aria-selected='true']::after {
      display: none;
    }
    :host([multiple][dd-style='text']) .opt[aria-selected='true']::before {
      inline-size: 16px;
      block-size: 16px;
      border-radius: var(--sw-r-xs, 4px);
      margin-inline-end: 0;
      background: var(--sw-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 12px no-repeat;
    }
    .opt[aria-disabled='true'] {
      color: var(--sw-dd-text-3, var(--sw-text-3));
      cursor: default;
    }
    .opt[aria-disabled='true']::before {
      opacity: 0.5;
    }
    .opt[aria-disabled='true'] .lbl {
      opacity: 0.7;
    }
    /* the chip in the multiple mode: the count always shows (the capsule hides the single mode's count); the chip box itself is the touch
       target (the desktop dial, 44 px on touch layouts) - a picker that is pressed several times in a row, not a 32 px tab chip */
    :host([multiple]) .chip .n,
    :host([multiple][dd-style='capsule']) .chip .n {
      display: inline;
      flex: none;
      white-space: nowrap;
    }
    :host([multiple]) .chip {
      min-block-size: var(--sw-touch-desktop, 44px);
    }
    :host([multiple]) .chip::after {
      inset-block: 0;
    }
    @media (max-width: 1100px), (pointer: coarse) {
      :host([multiple]) .chip {
        min-block-size: 44px;
      }
    }
    .ft {
      flex: none;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px 6px;
      border-block-start: 1px solid var(--sw-dd-border-soft, var(--sw-border));
    }
    .ft .st {
      flex: 1 1 auto;
      min-inline-size: 0;
      padding-inline: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-dd-text-3, var(--sw-text-3));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ft .st[data-dd-notice] {
      color: var(--sw-text-2, var(--sw-text));
    }
    .act {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 44px;
      min-block-size: var(--_opt, 44px);
      padding-inline: 12px;
      border: 0;
      border-radius: var(--sw-r-sm, 8px);
      background: transparent;
      color: var(--sw-dd-accent, var(--sw-accent-text, var(--sw-accent)));
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    .act:hover {
      background: var(--sw-dd-active, var(--sw-surface-3));
    }
    .act:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 1px;
    }
    .act[disabled] {
      color: var(--sw-dd-text-3, var(--sw-text-3));
      cursor: default;
      background: transparent;
    }
    .act.done {
      background: var(--sw-accent);
      color: var(--sw-text-inverse, #fff);
    }
    .act.done:hover {
      background: var(--sw-accent);
      filter: brightness(1.08);
    }
    .pop.sheet .act,
    .pop.centred .act {
      min-block-size: 48px;
    }
    @media (forced-colors: active) {
      :host([multiple]) .opt::before {
        border-color: ButtonText;
      }
      :host([multiple]) .opt[aria-selected='true']::before {
        background-color: Highlight;
      }
      .act {
        border: 1px solid ButtonText;
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
    /* ---- Unreleased: the SIZE dial (dd-size) for the six older styles and auto. md = today's size, nothing changes. The text style keeps its own big title.
       Row heights never go under the touch dial (44 px by default); the chip's hit area stays 44 px through ::after. ---- */
    :host([dd-size='sm']:not([dd-style='capsule']):not([dd-style='text'])) .chip {
      min-block-size: 26px;
      font-size: var(--sw-fs-xs);
    }
    :host([dd-size='sm']:not([dd-style='capsule'])) .chip::after {
      inset-block: -9px;
    }
    :host([dd-size='lg']:not([dd-style='capsule']):not([dd-style='text'])) .chip {
      min-block-size: 40px;
      font-size: var(--sw-fs-lg);
    }
    :host([dd-size='lg']:not([dd-style='capsule'])) .chip::after {
      inset-block: -2px;
    }
    :host([dd-size='sm']:not([dd-style='capsule'])) .opt {
      min-block-size: max(40px, var(--sw-touch-desktop, 44px));
      font-size: var(--sw-fs-xs);
    }
    :host([dd-size='lg']:not([dd-style='capsule'])) .opt {
      min-block-size: 52px;
      font-size: var(--sw-fs-md);
    }
    /* ---- Unreleased: capsule (owner reference 2026-10-04). Closed: a capsule with a blue ring, a white-to-lavender fill, a soft bottom shadow, an icon at the
       start, a confident label and a small chevron at the end (RTL: icon right, chevron left; the chevron turns up while open). Open: a floating, rounded,
       translucent panel; the chosen row is a tinted row in the accent colour; every row has its icon at the start and a COUNT at the other end; a divider item
       draws a thin line. The visible capsule is the chip's ::before (so a small one still has a 44 px hit box on touch and on the 44 px desktop dial).
       Tokens only: four skins, ten palettes, light / dark, radius / touch / performance dials. The sizes are the --_c* variables. ---- */
    :host([dd-style='capsule']) {
      --_ch: 46px;
      --_cfs: 16px;
      --_cico: 20px;
      --_copt: 52px;
      --_cpad: 8px;
      --_cpanel: 18px;
      --_crow: 14px;
      --_cminw: 180px;
      --_cgap: 10px;
      --_cchev: 16px;
      --_cpscale: 1.3;
      --_cring: 2px;
    }
    :host([dd-style='capsule'][dd-ring='1']) {
      --_cring: 1px;
    }
    :host([dd-style='capsule'][dd-ring='1.5']) {
      --_cring: 1.5px;
    }
    :host([dd-style='capsule'][dd-ring='3']) {
      --_cring: 3px;
    }
    :host([dd-style='capsule'][dd-size='sm']) {
      --_ch: 38px;
      --_cfs: 14px;
      --_cico: 17px;
      --_copt: 44px;
      --_cpad: 6px;
      --_cpanel: 16px;
      --_crow: 12px;
      --_cminw: 150px;
      --_cgap: 8px;
      --_cchev: 14px;
      --_cpscale: 1.15;
    }
    :host([dd-style='capsule'][dd-size='lg']) {
      --_ch: 58px;
      --_cfs: 18px;
      --_cico: 24px;
      --_copt: 62px;
      --_cpad: 10px;
      --_cpanel: 22px;
      --_crow: 16px;
      --_cminw: 220px;
      --_cgap: 12px;
      --_cchev: 18px;
      --_cpscale: 1.6;
    }
    :host([dd-style='capsule']:not([block])) .chip {
      min-inline-size: var(--_cminw);
    }
    :host([dd-style='capsule']) .chip {
      position: relative;
      isolation: isolate;
      min-block-size: max(var(--_ch), var(--sw-touch-desktop, 44px));
      gap: var(--_cgap);
      padding-inline: calc(var(--_ch) * 0.36) calc(var(--_ch) * 0.3);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: none;
      box-shadow: none;
      color: var(--sw-dd-text, var(--sw-text));
      font-size: var(--_cfs);
      font-weight: var(--sw-fw-semibold, 600);
    }
    @media (max-width: 1100px), (pointer: coarse) {
      :host([dd-style='capsule']) .chip {
        min-block-size: max(var(--_ch), 44px);
      }
    }
    :host([dd-style='capsule']) .chip::after {
      inset-block: 0;
      inset-inline: 0;
    }
    :host([dd-style='capsule']) .chip::before {
      content: '';
      position: absolute;
      z-index: -1;
      inset-inline: 0;
      inset-block-start: 50%;
      block-size: var(--_ch);
      transform: translateY(-50%);
      box-sizing: border-box;
      border: var(--_cring) solid var(--sw-dd-accent, var(--sw-accent));
      border-radius: var(--sw-r-pill);
      background: linear-gradient(180deg, var(--sw-surface-solid) 0%, color-mix(in srgb, var(--sw-accent) 11%, var(--sw-surface-solid)) 100%);
      box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--sw-accent) 42%, transparent), 0 1px 2px color-mix(in srgb, var(--sw-text) 10%, transparent);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
    }
    :host([dd-style='capsule']) .chip:hover::before {
      background: linear-gradient(180deg, var(--sw-surface-solid) 0%, color-mix(in srgb, var(--sw-accent) 17%, var(--sw-surface-solid)) 100%);
    }
    :host([dd-style='capsule']) .chip:focus-visible {
      outline: none;
    }
    :host([dd-style='capsule']) .chip:focus-visible::before,
    :host([dd-style='capsule']) .chip[aria-expanded='true']::before {
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--sw-accent) 24%, transparent), 0 4px 10px -4px color-mix(in srgb, var(--sw-accent) 45%, transparent);
    }
    :host([dd-style='capsule']) .chip .ci {
      flex: none;
      display: inline-flex;
      color: var(--sw-accent-text, var(--sw-accent));
    }
    :host([dd-style='capsule']) .chip .txt {
      flex: 1 1 auto;
      text-align: start;
    }
    :host([dd-style='capsule']) .chip .n {
      display: none;
    }
    :host([dd-style='capsule']) .chip .chev {
      color: var(--sw-text-2, var(--sw-text-3));
    }
    :host([dd-style='capsule']) .chip .dot {
      inset-block-start: calc(50% - var(--_ch) / 2 - 2px);
    }
    :host([dd-style='capsule']) .pop:not(.sheet):not(.centred) {
      border-radius: clamp(8px, calc(var(--sw-r-lg) * var(--_cpscale)), var(--_cpanel));
    }
    :host([dd-style='capsule']) .pop {
      border: 0;
      background: var(--sw-dd-pop-bg, var(--sw-perf-glass-bg, color-mix(in srgb, var(--sw-surface-solid) 80%, transparent)));
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(28px) saturate(1.6));
      backdrop-filter: var(--sw-perf-blur, blur(28px) saturate(1.6));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--sw-border) 75%, transparent), 0 26px 56px -18px color-mix(in srgb, var(--sw-text) 34%, transparent), 0 6px 18px -8px color-mix(in srgb, var(--sw-text) 18%, transparent);
    }
    :host([dd-style='capsule']) .lb {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--_cpad);
    }
    :host([dd-style='capsule']) .search {
      margin: var(--_cpad) var(--_cpad) 0;
      border-radius: var(--sw-r-pill);
    }
    :host([dd-style='capsule']) .grp {
      padding-inline: calc(var(--_copt) * 0.28);
    }
    :host([dd-style='capsule']) .opt {
      flex: none;
      min-block-size: var(--_copt);
      padding-inline: calc(var(--_copt) * 0.28);
      gap: calc(var(--_copt) * 0.24);
      border-radius: clamp(6px, calc(var(--sw-r-md) * 1.2), var(--_crow));
      font-size: var(--_cfs);
      font-weight: var(--sw-fw-medium, 500);
      color: var(--sw-dd-text, var(--sw-text));
    }
    :host([dd-style='capsule']) .pop.sheet .opt,
    :host([dd-style='capsule']) .pop.centred .opt {
      min-block-size: max(var(--_copt), 48px);
    }
    :host([dd-style='capsule']) .opt[data-active] {
      background: color-mix(in srgb, var(--sw-text) 6%, transparent);
    }
    :host([dd-style='capsule']) .opt[aria-selected='true'] {
      background: color-mix(in srgb, var(--sw-accent) 14%, transparent);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold, 600);
    }
    :host([dd-style='capsule']) .opt[aria-selected='true'][data-active] {
      background: color-mix(in srgb, var(--sw-accent) 20%, transparent);
    }
    :host([dd-style='capsule']) .opt .n {
      display: none;
    }
    :host([dd-style='capsule']) .opt .oi {
      display: inline-flex;
      flex: none;
      inline-size: var(--_cico);
      justify-content: center;
      color: var(--sw-text-3);
    }
    :host([dd-style='capsule']) .opt[aria-selected='true'] .oi,
    :host([dd-style='capsule']) .opt[aria-selected='true'] .cnt {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    :host([dd-style='capsule']) .opt .cnt {
      display: inline-block;
      flex: none;
      min-inline-size: 2ch;
      text-align: end;
      font-size: 0.94em;
      font-weight: var(--sw-fw-medium, 500);
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-3);
    }
    :host([dd-style='capsule']) .sep {
      display: block;
      flex: none;
      block-size: 1px;
      margin: calc(var(--_cpad) * 0.5) calc(var(--_cpad) * 1.5);
      background: color-mix(in srgb, var(--sw-text) 11%, transparent);
    }
    .oi,
    .cnt,
    .sep,
    .ci {
      display: none;
    }
    @media (prefers-reduced-transparency: reduce) {
      :host([dd-style='capsule']) .pop {
        background: var(--sw-surface-solid);
      }
    }
    @media (forced-colors: active) {
      :host([dd-style='capsule']) .chip::before {
        border-color: ButtonText;
      }
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
    window.clearTimeout(this.closeTimer);
    this.releasePage();
    this.unwatchKeyboard();
    super.disconnectedCallback();
  }

  /** An unknown `dd-style` string reads as `auto` (the attribute is reflected back as `auto`, so the per-style CSS never matches a stray value). */
  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('ddStyle') && !(DD_STYLE_IDS as readonly string[]).includes(this.ddStyle)) this.ddStyle = 'auto';
    if (changed.has('ddSize') && !(DD_SIZE_IDS as readonly string[]).includes(this.ddSize)) this.ddSize = 'md';
    if (changed.has('ddRing') && !(DD_RING_IDS as readonly string[]).includes(this.ddRing)) this.ddRing = '2';
    if (changed.has('ddPanel') && !(DD_PANEL_IDS as readonly string[]).includes(this.ddPanel)) this.ddPanel = '240';
  }

  /** The icon size (px) of the options and of the chip: the capsule follows the size dial, the other styles keep 15. */
  private get iconPx(): number {
    return this.ddStyle === 'capsule' ? ({ sm: 17, md: 20, lg: 24 } as Record<string, number>)[this.ddSize] ?? 20 : 15;
  }

  /** How the open list is presented: a popover under the chip on a wide screen. On the phone the owner's setting (`data-dd-phone` on <html>, from
   * shell/tabs-mode.ts, `ui.dd_phone`) decides: `list` = the popover under the field, `sheet` = a bottom sheet (the Bubble `popup` dial may turn it into
   * a centred box or an inline list). Without the attribute (a component on its own) the old rule holds: `auto` is a popover, the other styles a sheet. */
  private presentation(): Present {
    const choice = document.documentElement.getAttribute('data-dd-phone');
    if (choice !== 'sheet' && choice !== 'list' && this.ddStyle === 'auto') return 'pop';
    let phone = false;
    try {
      phone = window.matchMedia('(max-width: 767px)').matches;
    } catch {
      /* no matchMedia */
    }
    if (!phone || choice === 'list') return 'pop';
    const dial = document.documentElement.getAttribute('data-bubble-popup');
    return dial === 'centred' ? 'centred' : dial === 'inline' ? 'inline' : 'sheet';
  }

  /** Item indices that match the search text (all of them without one). */
  private shownIdx(): number[] {
    const q = this.query.trim().toLocaleLowerCase();
    const out: number[] = [];
    this.items.forEach((it, i) => {
      if (isOption(it) && (!q || it.label.toLocaleLowerCase().includes(q))) out.push(i);
    });
    return out;
  }

  private get hasSearch(): boolean {
    return this.items.filter(isOption).length >= DD_SEARCH_MIN_ITEMS;
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
    const capsule = this.ddStyle === 'capsule';
    const size = this.ddSize;
    // capsule: the panel is at least as wide as the chip and wider than the other styles' (the reference); rows are taller, the gap larger
    const floor = capsule ? ddPanelFloor(this.ddPanel, size) : this.ddStyle === 'text' ? 240 : 200;
    const minWidth = Math.min(Math.max(r.width, floor), vw - pad * 2);
    // anchored to the chip's inline-start edge (the right edge in RTL), then kept inside the viewport
    let left = rtl ? r.right - minWidth : r.left;
    left = Math.max(pad, Math.min(left, vw - pad - minWidth));
    const gap = capsule ? 8 : 4;
    const below = vh - r.bottom - pad - gap;
    const above = r.top - pad - gap;
    const flip = below < 220 && above > below;
    const rowH = capsule ? { sm: 46, md: 54, lg: 64 }[size] : 44;
    const maxHeight = Math.max(160, Math.min(flip ? above : below, capsule ? 8 * rowH + 24 : 360));
    const rows = Math.min(this.items.length, 8) * rowH + 16 + (this.hasSearch ? 46 : 0) + (this.multiple ? 56 : 0);
    this.pos = { top: flip ? Math.max(pad, r.top - gap - Math.min(maxHeight, rows)) : r.bottom + gap, left, minWidth, maxHeight };
  }

  private async openList(cursor?: number) {
    if (this.open || !this.items.some(isOption)) return;
    this.finishClosing();
    this.present = this.presentation();
    if (this.present === 'inline') this.setAttribute('data-present', 'inline');
    else this.removeAttribute('data-present');
    this.query = '';
    this.notice = '';
    this.place();
    this.open = true;
    const sel = this.items.findIndex((i) => (this.multiple ? this.values.includes(i.id) : i.id === this.value));
    this.cursor = cursor ?? (sel >= 0 ? sel : Math.max(0, this.items.findIndex(isOption)));
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
      if (this.present === 'sheet') {
        this.holdPage();
        this.watchKeyboard();
      }
      const q = this.searchEl();
      (q && fine ? q : this.lbEl() ?? pop).focus({ preventScroll: true });
      this.scrollToCursor();
    }
  }

  /** Is the user asking for less motion? (the sheet then closes at once, as before). */
  private reducedMotion(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  /** End a running slide-out now (a new open, a disconnect): the popover goes away, the list is no longer drawn. */
  private finishClosing() {
    window.clearTimeout(this.closeTimer);
    if (!this.closing) return;
    this.closing = false;
    try {
      (this.popEl() as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
    } catch {
      /* not showing */
    }
  }

  private close(refocus: boolean) {
    if (!this.open) return;
    const pop = this.popEl();
    const slide = this.present === 'sheet' && !this.reducedMotion() && !!pop;
    this.releasePage();
    this.unwatchKeyboard();
    if (slide) {
      // 200 ms slide-out: `open` (aria-expanded) is false at once, the popover is hidden when the animation ends
      this.closing = true;
      this.closeTimer = window.setTimeout(() => this.finishClosing(), 230);
    } else {
      try {
        (pop as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
      } catch {
        /* not showing */
      }
    }
    this.open = false;
    this.query = '';
    this.notice = '';
    window.clearTimeout(this.typedTimer);
    this.typed = '';
    if (refocus) void this.updateComplete.then(() => this.chipEl()?.focus({ preventScroll: true }));
  }

  /**
   * The bottom sheet is modal on a phone: everything outside it, up through every shadow root, becomes `inert` (not focusable, not
   * clickable, not read by assistive tech) until it closes. The siblings along the path from this element to the document are marked,
   * so the sheet itself and its ancestors stay live. Desktop and tablet popovers are not modal and never come here.
   */
  private holdPage() {
    this.releasePage();
    let node: Node | null = this;
    while (node && node !== document.documentElement) {
      const parent: Node | null = node.parentNode;
      if (!parent) break;
      for (const sib of Array.from((parent as ParentNode).children ?? [])) {
        if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue;
        if (['STYLE', 'SCRIPT', 'LINK', 'TEMPLATE'].includes(sib.tagName)) continue;
        sib.inert = true;
        this.inerted.push(sib);
      }
      node = parent instanceof ShadowRoot ? parent.host : parent;
    }
    // the chip next to the list in this element's own shadow root is outside the sheet too (marked above as a sibling of .pop)
    const chip = this.chipEl();
    if (chip && !chip.inert) {
      chip.inert = true;
      this.inerted.push(chip);
    }
  }

  private releasePage() {
    for (const el of this.inerted) el.inert = false;
    this.inerted = [];
  }

  /** Tab inside the sheet cycles between the search field and the list (a focus trap); Shift+Tab the other way. */
  private trapTab(e: KeyboardEvent) {
    const ring = [this.searchEl(), this.lbEl(), ...Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>('.act:not([disabled])'))].filter((x): x is HTMLElement => !!x);
    const at = ring.findIndex((x) => x === (this.renderRoot as ShadowRoot).activeElement);
    const next = ring[(at + (e.shiftKey ? -1 : 1) + ring.length) % ring.length];
    e.preventDefault();
    next?.focus({ preventScroll: true });
  }

  /** The on-screen keyboard: while the sheet is open its bottom edge follows the visible viewport and its height is capped by it. */
  private vvHandler = () => this.fitKeyboard();
  private watchingKeyboard = false;

  private watchKeyboard() {
    const vv = window.visualViewport;
    if (!vv || this.watchingKeyboard) return;
    this.watchingKeyboard = true;
    vv.addEventListener('resize', this.vvHandler);
    vv.addEventListener('scroll', this.vvHandler);
    this.fitKeyboard();
  }

  private unwatchKeyboard() {
    if (!this.watchingKeyboard) return;
    this.watchingKeyboard = false;
    const vv = window.visualViewport;
    vv?.removeEventListener('resize', this.vvHandler);
    vv?.removeEventListener('scroll', this.vvHandler);
    const pop = this.popEl();
    pop?.style.removeProperty('--dd-kb');
    pop?.style.removeProperty('--dd-vh');
  }

  private fitKeyboard() {
    const vv = window.visualViewport;
    const pop = this.popEl();
    if (!vv || !pop || this.present !== 'sheet') return;
    const kb = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    if (kb > 40) {
      pop.style.setProperty('--dd-kb', `${kb}px`);
      pop.style.setProperty('--dd-vh', `${Math.round(vv.height)}px`);
    } else {
      pop.style.removeProperty('--dd-kb');
      pop.style.removeProperty('--dd-vh');
    }
  }

  private choose(i: number) {
    const it = this.items[i];
    if (!isOption(it)) return;
    if (this.multiple) {
      this.toggle(it);
      return;
    }
    const changed = it.id !== this.value;
    this.value = it.id;
    this.close(true);
    if (changed) this.dispatchEvent(new CustomEvent<DropdownChange>('change', { detail: { id: it.id }, bubbles: true, composed: true }));
  }

  /** Is this option choosable now (`multiple`)? Not when the item says so, not past the limit (a picked one can always be un-picked). */
  private pickable(it: DropdownItem): boolean {
    if (this.values.includes(it.id)) return true;
    if (it.disabled) return false;
    return !(this.max > 0 && this.values.length >= this.max);
  }

  /** `multiple`: toggle one option, the list stays open; a pick past the limit (or of a disabled option) is refused with the status line. */
  private toggle(it: DropdownItem) {
    if (it.disabled && !this.values.includes(it.id)) return;
    const next = toggleCapped(this.values, it.id, this.max);
    if (next.refused) {
      this.notice = limitNotice(this.max, this.countBase);
      return;
    }
    this.notice = '';
    this.values = next.ids;
    this.dispatchEvent(new CustomEvent<DropdownChange>('change', { detail: { id: it.id, ids: [...next.ids] }, bubbles: true, composed: true }));
  }

  /** `multiple`: "נקה" - nothing picked; the list stays open, the focus goes to the list. */
  private clearAll() {
    if (!this.values.length) return;
    this.values = [];
    this.notice = '';
    this.dispatchEvent(new CustomEvent<DropdownChange>('change', { detail: { id: '', ids: [] }, bubbles: true, composed: true }));
    void this.updateComplete.then(() => this.lbEl()?.focus({ preventScroll: true }));
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

  /** Swipe down on the head of the bottom sheet: it follows the finger (rubber band upwards); released past 35 % of its height or in a quick flick it closes. */
  private drag: { y0: number; t0: number } | null = null;

  private onHeadDown(e: PointerEvent) {
    if (this.present !== 'sheet') return;
    this.drag = { y0: e.clientY, t0: performance.now() };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
  }

  private onHeadMove(e: PointerEvent) {
    const pop = this.popEl();
    if (!this.drag || !pop) return;
    const dy = e.clientY - this.drag.y0;
    pop.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
  }

  private onHeadUp(e: PointerEvent) {
    const pop = this.popEl();
    const d = this.drag;
    this.drag = null;
    if (!d || !pop) return;
    const dy = e.clientY - d.y0;
    const flick = dy > 24 && dy / Math.max(1, performance.now() - d.t0) > 0.6;
    pop.style.transform = '';
    if (e.type !== 'pointercancel' && (dy > pop.getBoundingClientRect().height * 0.35 || flick)) this.close(true);
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
    const target = e.composedPath()[0] as HTMLElement | undefined;
    const inSearch = target?.classList?.contains('q') ?? false;
    const inFoot = target?.classList?.contains('act') ?? false;
    if (inFoot && k !== 'Escape' && k !== 'Tab') return; // the foot's buttons: Enter / Space press them
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
      // the sheet traps the focus; the multiple mode's popover cycles too (its foot has buttons to reach); a single popover closes
      if (this.present === 'sheet' || this.multiple) this.trapTab(e);
      else this.close(false);
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
        if (isOption(this.items[idx]) && this.items[idx].label.toLocaleLowerCase().startsWith(needle)) {
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
    const anyIcon = this.items.some((x) => !!x.icon);
    const filtering = this.query.trim() !== '';
    this.items.forEach((it, i) => {
      // a divider is a thin line (capsule only; the CSS hides it elsewhere) and is not drawn while the search narrows the list
      if (it.divider) {
        if (!filtering) out.push(html`<div class="sep" role="presentation" aria-hidden="true" data-dd-divider></div>`);
        return;
      }
      if (!shown.has(i)) return;
      if (it.group && it.group !== lastGroup) out.push(html`<div class="grp" role="presentation" aria-hidden="true">${it.group}</div>`);
      lastGroup = it.group;
      const picked = this.multiple ? this.values.includes(it.id) : it.id === this.value;
      out.push(html`<div class="opt" role="option" id=${this.optionId(i)} data-id=${it.id} aria-selected=${String(picked)} aria-disabled=${this.multiple && !this.pickable(it) ? 'true' : nothing} ?data-active=${i === this.cursor}
        @click=${() => this.choose(i)} @pointermove=${() => (this.cursor = i)}>
        ${anyIcon ? html`<span class="oi" aria-hidden="true">${it.icon ? html`<sw-icon .name=${it.icon} size=${this.iconPx}></sw-icon>` : nothing}</span>` : nothing}<span class="lbl">${it.label}</span>${it.count !== undefined ? html`<span class="n">(${it.count})</span><span class="cnt">${it.count}</span>` : nothing}${it.alert ? html`<span class="dot ${it.alert === 'warn' ? 'warn' : ''}" data-alert="${it.alert === 'warn' ? 'warn' : 'alert'}"></span>` : nothing}
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

  /** `multiple`: the picked options in pick order (ids the items no longer carry are skipped). */
  private pickedItems(): DropdownItem[] {
    return this.values.map((id) => this.items.find((it) => it.id === id)).filter((it): it is DropdownItem => !!it && !it.divider);
  }

  render() {
    if (this.multiple) return this.renderMultiple();
    const sel = this.selected;
    const alert = this.hiddenAlert;
    const name = sel ? `${sel.label}${sel.count !== undefined ? ` (${sel.count})` : ''}` : this.placeholder;
    const aria = `${[this.label, name].filter(Boolean).join(': ')}${alert ? ', יש התראות באפשרויות אחרות' : ''}`;
    const listId = `l-${this.seq}`;
    return this.renderControl(listId, aria, html`<span class="txt">${sel?.label ?? this.placeholder}</span>${sel?.count !== undefined ? html`<span class="n">(${sel.count})</span>` : nothing}`, nothing, false);
  }

  /** 2.0.1 `multiple`: the chip reads the picked names and "n מתוך N"; the list has a foot with the count (or the refusal), "נקה" and "סיום". */
  private renderMultiple() {
    const picked = this.pickedItems();
    const count = pickedCount(picked.length, this.max, this.countBase);
    const names = pickedSummary(picked.map((it) => it.label), this.placeholder);
    const aria = `${[this.label, names].filter(Boolean).join(': ')}${picked.length ? `, ${count}` : ''}`;
    const listId = `l-${this.seq}`;
    const foot = html`<div class="ft" data-dd-foot>
      <span class="st" role="status" aria-live="polite" data-dd-count=${count} ?data-dd-notice=${!!this.notice}>${this.notice || count}</span>
      <button type="button" class="act" data-dd-clear ?disabled=${!this.values.length} @click=${() => this.clearAll()}>נקה</button>
      <button type="button" class="act done" data-dd-done @click=${() => this.close(true)}>סיום</button>
    </div>`;
    return this.renderControl(listId, aria, html`<span class="txt">${names}</span>${picked.length ? html`<span class="n" data-dd-chip-count>${count}</span>` : nothing}`, foot, true);
  }

  private renderControl(listId: string, aria: string, text: unknown, foot: unknown, multi: boolean) {
    const sel = this.selected;
    const alert = multi ? false : this.hiddenAlert;
    return html`<button type="button" class="chip" data-dropdown-chip aria-haspopup="listbox" aria-expanded=${String(this.open)} aria-controls=${listId} aria-label=${aria}
        @click=${() => (this.open ? this.close(true) : void this.openList())} @keydown=${(e: KeyboardEvent) => this.onChipKey(e)}>
        ${this.ddStyle === 'capsule'
          ? html`<span class="ci" aria-hidden="true"><sw-icon .name=${this.icon ?? sel?.icon ?? 'layers'} size=${this.iconPx}></sw-icon></span>`
          : this.icon ? html`<sw-icon .name=${this.icon} size=${15}></sw-icon>` : nothing}${this.ddStyle === 'prefix' && this.label ? html`<span class="pre" data-dd-prefix aria-hidden="true">${this.label}</span>` : nothing}
        ${text}
        <span class="chev" aria-hidden="true"><sw-icon name="chevronDown" size=${this.ddStyle === 'capsule' ? ({ sm: 14, md: 16, lg: 18 } as Record<string, number>)[this.ddSize] ?? 16 : 12}></sw-icon></span>
        ${alert ? html`<span class="dot ${alert === 'warn' ? 'warn' : ''}" data-chip-alert=${alert}></span>` : nothing}
      </button>
      <div class="pop ${this.present}${this.closing ? ' closing' : ''}" popover=${this.present === 'inline' ? nothing : 'manual'} ?hidden=${!(this.open || this.closing)} data-present=${this.present} @keydown=${(e: KeyboardEvent) => this.onListKey(e)} @click=${(e: MouseEvent) => this.onPopClick(e)}>
        ${(this.open || this.closing) && (this.present === 'sheet' || this.present === 'centred')
          ? html`<div class="hd" data-dd-head @pointerdown=${(e: PointerEvent) => this.onHeadDown(e)} @pointermove=${(e: PointerEvent) => this.onHeadMove(e)} @pointerup=${(e: PointerEvent) => this.onHeadUp(e)} @pointercancel=${(e: PointerEvent) => this.onHeadUp(e)}><div class="grab" aria-hidden="true"></div>${this.label ? html`<div class="ttl" aria-hidden="true">${this.label}</div>` : nothing}</div>`
          : nothing}
        ${(this.open || this.closing) && this.hasSearch
          ? html`<label class="search"><sw-icon name="search" size=${14}></sw-icon><input class="q" type="search" data-dd-search placeholder="חיפוש" aria-label=${`חיפוש ב${this.label || 'רשימה'}`} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
              role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls=${listId} aria-activedescendant=${this.cursor >= 0 ? this.optionId(this.cursor) : nothing} .value=${this.query} @input=${(e: Event) => this.onQuery(e)} /></label>`
          : nothing}
        <div class="lb" id=${listId} role="listbox" tabindex="-1" aria-label=${this.label || nothing} aria-multiselectable=${multi ? 'true' : nothing} aria-activedescendant=${this.cursor >= 0 ? this.optionId(this.cursor) : nothing}>${this.open || this.closing ? this.renderItems() : nothing}</div>
        ${(this.open || this.closing) && multi ? foot : nothing}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-dropdown': SwDropdown;
  }
}
