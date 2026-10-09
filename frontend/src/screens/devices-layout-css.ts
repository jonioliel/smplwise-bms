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
    /* the compact density: tighter columns too (a viewer's rows are packed to one-row gaps, devices-layout.ts) */
    :host([data-devices-density='compact']) .lay-grid.lay-grid.lay-grid[data-lay-cols] {
      column-gap: 8px;
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
      backdrop-filter: var(--sw-glass-blur);
      -webkit-backdrop-filter: var(--sw-glass-blur);
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
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
    }
    .lay-seg button {
      border: 0;
      background: transparent;
      border-radius: var(--sw-r-sm);
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
      color: var(--sw-surface-solid);
      font-size: var(--sw-fs-xs);
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
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-solid);
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
        border-radius: var(--sw-r-sm);
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
      backdrop-filter: var(--sw-glass-blur);
      -webkit-backdrop-filter: var(--sw-glass-blur);
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
      border-radius: var(--sw-r-sm);
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
      font-size: var(--sw-fs-xs);
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
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      cursor: pointer;
    }
    /* the device picker: the list itself never scrolls (the panel does); its search / buttons row sticks to the panel's top */
    .lay-ents {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .lay-ptool {
      position: sticky;
      inset-block-start: -14px;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-block: 0 4px;
      padding-block: 8px 6px;
      background: var(--dv-surface-solid, var(--sw-surface));
      border-block-end: 1px solid var(--sw-border);
    }
    .lay-ptool input[type='search'] {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 32px;
      padding: 5px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    .lay-pbtns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
    }
    .lay-pbtns button {
      min-block-size: 30px;
      padding-inline: 4px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .lay-pbtns button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .lay-pgroup {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding-block-end: 6px;
    }
    .lay-ghead {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding-block: 4px 2px;
      border-block-end: 1px dashed var(--sw-border);
    }
    .lay-ghead .cnt {
      margin-inline-start: auto;
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .lay-panel .lay-del {
      color: var(--sw-danger);
      border-color: var(--sw-danger);
    }
    .lay-undo {
      margin-inline-start: 6px;
      padding: 2px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-accent);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    /* the card library dialog */
    .lay-lib {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 16px 12px;
    }
    .lay-libList {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: min(60vh, 460px);
      overflow: auto;
    }
    .lay-libItem {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .lay-libItem:hover,
    .lay-libItem:focus-visible {
      border-color: var(--sw-accent);
      background: var(--sw-surface-2);
      outline: none;
    }
    .lay-libIcon {
      display: grid;
      place-items: center;
      flex: none;
      inline-size: 38px;
      block-size: 38px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .lay-libTxt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      flex: 1;
    }
    .lay-libTxt > span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .lay-libTxt .lay-libPrev {
      color: var(--sw-text-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lay-libCnt {
      flex: none;
      min-inline-size: 26px;
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
      font-variant-numeric: tabular-nums;
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

    /* ---- slice 6c: device tiles inside an area card (DEVICE_THEMES.md §8) */
    /* an arranged card: one grid of the card's tile columns, the tiles in the saved order (the DOM order), no gaps left
       by hidden ones; beats the screens' automatic .tiles / glass / compact rules */
    :host .lay-tgrid.lay-tgrid.lay-tgrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--dv-gap-sm, 8px);
      align-items: stretch;
    }
    :host([data-devices-density='compact']) .lay-tgrid.lay-tgrid.lay-tgrid {
      gap: 6px;
    }
    .lay-tile {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .lay-tile > :first-child {
      flex: 1 1 auto;
    }
    /* size: three steps, on top of the card's own text size */
    .lay-tile[data-tile-size='s'] {
      --lay-tscale: 0.88;
    }
    .lay-tile[data-tile-size='l'] {
      --lay-tscale: 1.2;
    }
    .lay-tile[data-tile-size] {
      --sw-fs-xs: calc(var(--dvb-fs-xs) * var(--lay-scale, 1) * var(--lay-tscale));
      --sw-fs-sm: calc(var(--dvb-fs-sm) * var(--lay-scale, 1) * var(--lay-tscale));
      --sw-fs-md: calc(var(--dvb-fs-md) * var(--lay-scale, 1) * var(--lay-tscale));
      --sw-fs-lg: calc(var(--dvb-fs-lg) * var(--lay-scale, 1) * var(--lay-tscale));
      --sw-fs-xl: calc(var(--dvb-fs-xl) * var(--lay-scale, 1) * var(--lay-tscale));
      --dv-fs-tile-name: calc(var(--dvb-fs-tile-name) * var(--lay-scale, 1) * var(--lay-tscale));
      --dv-fs-item-name: calc(var(--dvb-fs-item-name) * var(--lay-scale, 1) * var(--lay-tscale));
      --dv-fs-value-big: calc(var(--dvb-fs-value-big) * var(--lay-scale, 1) * var(--lay-tscale));
    }
    :host .lay-tile.lay-tile[data-tile-size='s'] > :is(.tile, .row) {
      min-block-size: 0;
      padding-block: 5px;
    }
    :host .lay-tile.lay-tile[data-tile-size='l'] > :is(.tile, .row) {
      min-block-size: 96px;
      padding-block: 16px;
    }

    /* the arranging editor: the card alone, its tiles with a dashed outline and a place chip */
    .lay-stage {
      display: block;
    }
    .lay-stage[data-lay-phone-preview] {
      inline-size: min(100%, 400px);
    }
    .lay-tile.lay-tedit {
      outline: 2px dashed color-mix(in srgb, var(--sw-accent) 45%, transparent);
      outline-offset: 2px;
      border-radius: var(--sw-r-sm);
      cursor: grab;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
    }
    /* the tile's own controls rest while it is arranged: a tap selects, it never switches a device */
    .lay-tile.lay-tedit > :first-child {
      pointer-events: none;
    }
    .lay-tile.lay-tedit:focus-visible {
      outline: 3px solid var(--sw-focus, var(--sw-accent));
    }
    .lay-tile.lay-tsel {
      outline: 2px solid var(--sw-accent);
      z-index: 2;
    }
    .lay-tile.lay-drag {
      cursor: grabbing;
      opacity: 0.85;
      z-index: 3;
    }
    .lay-tile.lay-hidden > :first-child {
      opacity: 0.35;
    }
    .lay-thd {
      position: absolute;
      inset-block-start: -9px;
      inset-inline-start: 8px;
      z-index: 4;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 7px;
      border-radius: 999px;
      background: var(--sw-text-3);
      color: var(--sw-surface-solid);
      font-size: var(--sw-fs-2xs);
      font-weight: 700;
      line-height: 16px;
      white-space: nowrap;
      cursor: grab;
      touch-action: none;
    }
    .lay-tsel .lay-thd {
      background: var(--sw-accent);
      color: var(--sw-on-accent, #fff);
    }
    /* a card's "סידור התקנים" in the cards editor (the move chip holds the other corner) */
    .lay-tbtn {
      position: absolute;
      inset-block-start: -12px;
      inset-inline-end: 10px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 9px;
      border: 1px solid var(--sw-accent);
      border-radius: 999px;
      background: var(--sw-surface-solid);
      color: var(--sw-accent-text, var(--sw-accent));
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      line-height: 18px;
      white-space: nowrap;
      cursor: pointer;
    }
    .lay-tbtn:hover {
      background: var(--sw-accent-soft, var(--sw-surface-2));
    }
    .lay-tbtn:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    .lay-item:has(> .lay-tbtn) > .lay-hd {
      max-inline-size: calc(100% - 150px);
    }
    @media (pointer: coarse) {
      .lay-tbtn {
        line-height: 26px;
        padding-inline: 12px;
        inset-block-start: -16px;
      }
      .lay-thd {
        line-height: 22px;
        padding-inline: 10px;
        inset-block-start: -12px;
      }
    }
    /* a phone arranging one card: the sticky bar keeps only what that needs (cancel, save, the way back) - the
       variant, reset and copy-to-all act on the whole screen and wait until the cards are back */
    @media (max-width: 767px) {
      .lay-bar[data-tiles] > .lay-seg,
      .lay-bar[data-tiles] [data-layout-phone-auto],
      .lay-bar[data-tiles] [data-layout-reset],
      .lay-bar[data-tiles] [data-layout-copy] {
        display: none;
      }
    }
    /* the breadcrumb back to the cards, on its own line of the edit bar (a phone too) */
    .lay-crumb {
      flex-basis: 100%;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .lay-crumb button {
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      padding: 4px 10px;
      min-block-size: 30px;
      cursor: pointer;
    }
    .lay-crumb .here {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .lay-tacts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .lay-tacts .btn,
    .lay-panel > .btn {
      padding-inline: 12px;
    }
    .lay-panel .btn:disabled,
    .lay-nudge button:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
  unsafeCSS(roleRules),
];
