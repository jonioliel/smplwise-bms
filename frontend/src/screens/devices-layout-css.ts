import { css, unsafeCSS } from 'lit';
import { LAYOUT_ROLE_IDS } from '../styles/devices-palettes';

/**
 * CR-007 slice 6b: how an edited layout is applied on the device screens, and the edit mode's own chrome
 * (docs/design/DEVICE_THEMES.md §7). Included by every device screen through devicesStyleTokens (devices-style.ts).
 *
 * A grid that has a stored layout (`.lay-grid`) becomes a CSS grid of `data-lay-cols` columns (12 on a desktop, 4 on a
 * phone) and rows of 8 px that grow with their content (`minmax(8px, auto)`: a card is never clipped - its height is a
 * minimum). Each item is placed with `grid-column` / `grid-row` in grid units (devices-layout.ts, never pixels), so the
 * layout scales with the screen, and RTL needs nothing: column 1 is the start edge, on the right in Hebrew. A grid with
 * no stored layout matches no rule here and keeps its automatic look pixel for pixel.
 *
 * Colours are palette ROLES only (`data-lay-bg` / `data-lay-border` = accent | warm | cool | success | warning | danger
 * | neutral), resolved per theme and scheme by `--dv-role-*` (devices-palettes.ts). Text size: three steps scale the
 * tokens the card reads.
 */

const SURFACES = (sel: string) => `:host .lay-item${sel} > :is(sw-card, section.fcard), :host .lay-item${sel} > .tile-wrap > a.tile`;

const roleRules = LAYOUT_ROLE_IDS.map(
  (r) => `${SURFACES(`[data-lay-bg='${r}']`)} { background-image: linear-gradient(var(--dv-role-${r}-bg), var(--dv-role-${r}-bg)); }
${SURFACES(`[data-lay-border='${r}']`)} { border-color: var(--dv-role-${r}-border); border-width: 1.5px; }
.lay-swatch[data-role='${r}'] { background: linear-gradient(var(--dv-role-${r}-bg), var(--dv-role-${r}-bg)), var(--sw-surface); border-color: var(--dv-role-${r}-border); color: var(--dv-role-${r}-fg); }`,
).join('\n');

export const devicesLayoutCss = [
  css`
    /* the base values the text-size steps scale (resolved on the host, inherited as values) */
    :host {
      --dvb-fs-xs: var(--sw-fs-xs);
      --dvb-fs-sm: var(--sw-fs-sm);
      --dvb-fs-md: var(--sw-fs-md);
      --dvb-fs-lg: var(--sw-fs-lg);
      --dvb-fs-xl: var(--sw-fs-xl);
      --dvb-fs-2xl: var(--sw-fs-2xl);
      --dvb-fs-3xl: var(--sw-fs-3xl);
      --dvb-fs-title: var(--dv-fs-title, 16px);
      --dvb-fs-tile-name: var(--dv-fs-tile-name, 14px);
      --dvb-fs-item-name: var(--dv-fs-item-name, 12.5px);
      --dvb-fs-value-big: var(--dv-fs-value-big, 24px);
    }

    /* ---- an applied layout: grid units only (4 classes + attribute: beats every automatic grid rule of the screens) */
    :host .lay-grid.lay-grid.lay-grid[data-lay-cols] {
      display: grid;
      grid-auto-rows: minmax(8px, auto);
      row-gap: 0;
      column-gap: var(--dv-gap, 12px);
      align-items: stretch;
      justify-items: stretch;
    }
    :host .lay-grid.lay-grid.lay-grid[data-lay-cols='12'] {
      grid-template-columns: repeat(12, minmax(0, 1fr));
    }
    :host .lay-grid.lay-grid.lay-grid[data-lay-cols='4'] {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    /* editing the phone layout on a wide screen: a phone-wide preview */
    :host .lay-grid.lay-grid.lay-grid[data-lay-phone-preview] {
      inline-size: min(100%, 400px);
      justify-self: start;
    }
    .lay-item {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .lay-item > * {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    .lay-item > .lay-hd,
    .lay-item > .lay-rz {
      flex: none;
    }
    .lay-title-icon {
      flex: none;
      color: var(--sw-accent);
    }

    /* text size: three steps */
    .lay-item[data-lay-text='sm'] {
      --lay-scale: 0.88;
    }
    .lay-item[data-lay-text='lg'] {
      --lay-scale: 1.16;
    }
    .lay-item[data-lay-text] {
      --sw-fs-xs: calc(var(--dvb-fs-xs) * var(--lay-scale));
      --sw-fs-sm: calc(var(--dvb-fs-sm) * var(--lay-scale));
      --sw-fs-md: calc(var(--dvb-fs-md) * var(--lay-scale));
      --sw-fs-lg: calc(var(--dvb-fs-lg) * var(--lay-scale));
      --sw-fs-xl: calc(var(--dvb-fs-xl) * var(--lay-scale));
      --sw-fs-2xl: calc(var(--dvb-fs-2xl) * var(--lay-scale));
      --sw-fs-3xl: calc(var(--dvb-fs-3xl) * var(--lay-scale));
      --dv-fs-title: calc(var(--dvb-fs-title) * var(--lay-scale));
      --dv-fs-tile-name: calc(var(--dvb-fs-tile-name) * var(--lay-scale));
      --dv-fs-item-name: calc(var(--dvb-fs-item-name) * var(--lay-scale));
      --dv-fs-value-big: calc(var(--dvb-fs-value-big) * var(--lay-scale));
    }

    /* ---- edit mode */
    :host([data-lay-editing]) {
      --lay-panel: 300px;
    }
    @media (min-width: 768px) {
      :host([data-lay-editing]) sw-page {
        padding-inline-end: calc(var(--lay-panel) + 32px);
      }
    }
    @media (max-width: 767px) {
      :host([data-lay-editing]) sw-page {
        padding-block-end: 52vh;
      }
    }
    .lay-bar {
      position: sticky;
      inset-block-start: 0;
      z-index: 6;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
      padding: 10px 12px;
      border: 1px solid var(--sw-accent);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
      backdrop-filter: var(--sw-glass-blur, none);
      -webkit-backdrop-filter: var(--sw-glass-blur, none);
    }
    @media (max-width: 767px) {
      /* a phone: a compact bar (the variant and the actions), the page stays visible under it */
      .lay-bar {
        padding: 6px 8px;
        gap: 6px;
      }
      .lay-bar .where {
        display: none;
      }
      .lay-bar .acts {
        margin-inline-start: 0;
      }
    }
    .lay-bar .what {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .lay-bar .where {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .lay-bar .acts {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-inline-start: auto;
    }
    .lay-seg {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: 10px;
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
    }
    .lay-seg button {
      border: 0;
      background: transparent;
      border-radius: 8px;
      padding: 5px 10px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      cursor: pointer;
      min-block-size: 30px;
    }
    .lay-seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .lay-seg button:disabled {
      cursor: default;
      opacity: 0.55;
    }
    .lay-msg {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .lay-msg.err {
      color: var(--sw-danger);
    }
    .lay-live {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .lay-item.lay-edit {
      outline: 2px dashed color-mix(in srgb, var(--sw-accent) 45%, transparent);
      outline-offset: 3px;
      border-radius: var(--sw-r-md);
      cursor: grab;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
    }
    /* the card's own controls rest while its layout is edited: a tap selects, it never switches a device */
    .lay-item.lay-edit > :first-child {
      pointer-events: none;
    }
    .lay-item.lay-edit:focus-visible {
      outline: 3px solid var(--sw-focus, var(--sw-accent));
    }
    .lay-item.lay-sel {
      outline: 2px solid var(--sw-accent);
      z-index: 2;
    }
    .lay-item.lay-drag {
      cursor: grabbing;
      opacity: 0.88;
      z-index: 3;
    }
    .lay-item.lay-hidden > :first-child {
      opacity: 0.35;
    }
    .lay-hd {
      position: absolute;
      inset-block-start: -12px;
      inset-inline-start: 10px;
      z-index: 4;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-inline-size: calc(100% - 20px);
      padding: 2px 9px;
      border-radius: 999px;
      background: var(--sw-text-3);
      color: var(--sw-surface-solid, #fff);
      font-size: 11px;
      font-weight: 700;
      line-height: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: grab;
      touch-action: none;
    }
    .lay-sel .lay-hd {
      background: var(--sw-accent);
      color: var(--sw-on-accent, #fff);
    }
    .lay-rz {
      position: absolute;
      inset-block-end: -8px;
      inset-inline-end: -8px;
      z-index: 4;
      inline-size: 16px;
      block-size: 16px;
      box-sizing: border-box;
      border-radius: 4px;
      background: var(--sw-surface-solid, #fff);
      border: 2px solid var(--sw-accent);
      cursor: nwse-resize;
      touch-action: none;
    }
    :host(:dir(rtl)) .lay-rz {
      cursor: nesw-resize;
    }
    @media (pointer: coarse) {
      .lay-rz {
        inline-size: 26px;
        block-size: 26px;
        inset-block-end: -12px;
        inset-inline-end: -12px;
        border-radius: 8px;
      }
      .lay-hd {
        line-height: 24px;
        padding-inline: 12px;
        inset-block-start: -16px;
      }
    }

    /* the side panel of the selected card (a bottom sheet on a phone) */
    .lay-panel {
      position: fixed;
      z-index: 30;
      inset-block-start: 76px;
      inset-inline-end: 16px;
      inline-size: var(--lay-panel, 300px);
      max-block-size: calc(100vh - 96px);
      overflow: auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-3);
      backdrop-filter: var(--sw-glass-blur, none);
      -webkit-backdrop-filter: var(--sw-glass-blur, none);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .lay-panel {
        background: var(--dv-surface-solid, var(--sw-surface));
      }
    }
    @media (max-width: 767px) {
      .lay-panel {
        inset-block-start: auto;
        inset-block-end: calc(8px + env(safe-area-inset-bottom, 0px));
        inset-inline: 8px;
        inline-size: auto;
        max-block-size: 46vh;
        padding: 12px;
        gap: 10px;
      }
    }
    .lay-panel .ph {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
    }
    .lay-panel .ph .chip {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      border-radius: 999px;
      padding: 2px 8px;
    }
    .lay-f {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .lay-f > label,
    .lay-f > .lbl {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .lay-f input[type='text'],
    .lay-f input[type='number'],
    .lay-f select {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 34px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    .lay-row2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .lay-swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .lay-swatch {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      cursor: pointer;
      padding: 0;
      font: inherit;
      font-size: 11px;
    }
    .lay-swatch[aria-pressed='true'] {
      box-shadow: 0 0 0 2px var(--sw-surface), 0 0 0 4px var(--sw-accent);
    }
    .lay-swatch[data-role='none'] {
      background: repeating-linear-gradient(135deg, var(--sw-surface), var(--sw-surface) 4px, var(--sw-surface-2) 4px, var(--sw-surface-2) 8px);
    }
    .lay-nudge {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    .lay-nudge button,
    .lay-panel .btn {
      min-block-size: 36px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      cursor: pointer;
    }
    .lay-check {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lay-hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      line-height: 1.5;
    }
  `,
  unsafeCSS(roleRules),
];
