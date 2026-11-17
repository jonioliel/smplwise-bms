import { css } from 'lit';
import { devicesStyleTokens } from './devices-style';
import { TREE_UNASSIGNED_CSS } from './tree-unassigned';
import { HOME_SCREEN_CSS } from './home-screen-css';
import { HOME_DRAWER_CSS } from './home-edit-drawer';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `devices-building` (screens/devices-building.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = devicesBuildingStyles`.
 */

/** The Bubble skin (phase C, 2026-10-02; the approved board docs/design/mockups/bubble-taste/home.html): the floor cards are bare
 * groups under a separator title, every area row a pill with a hue ring, the area tiles pills too, the tree rows carry the ring;
 * `--sw-grid-min` (the density dial) sets the columns and `row` makes one column (the list view). Keyed on the host's data-skin. */
const BUILDING_BUBBLE = css`
  :host([data-skin='bubble']) .kpis {
    gap: var(--sw-gap);
  }
  :host([data-skin='bubble']) .fcards {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, max(300px, var(--sw-grid-min))), 1fr));
    gap: 6px var(--sw-gap-grid);
  }
  :host([data-skin='bubble']) section.fcard {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    gap: 4px;
  }
  :host([data-skin='bubble']) .fcard header {
    padding: 8px 4px 4px;
  }
  :host([data-skin='bubble']) .fcard header h2 {
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
  }
  :host([data-skin='bubble']) .fh-top::after {
    content: '';
    flex: 1 1 24px;
    order: 5;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-2);
  }
  :host([data-skin='bubble']) .fcard header .fh-top devices-bulk-menu {
    order: 9;
    margin-inline-start: 0;
  }
  :host([data-skin='bubble']) .fcard .rows {
    gap: var(--sw-gap);
    padding: 0;
  }
  :host([data-skin='bubble']) .arow,
  :host([data-skin='bubble']) a.tile {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    box-shadow: none;
    min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
    padding: 4px 8px;
    gap: 10px;
    transition: background var(--sw-t-fast) var(--sw-ease);
  }
  :host([data-skin='bubble']) .arow:hover,
  :host([data-skin='bubble']) .arow:focus-visible,
  :host([data-skin='bubble']) a.tile:hover,
  :host([data-skin='bubble']) a.tile:focus-visible {
    background: var(--sw-surface-3);
    outline: none;
    box-shadow: none;
  }
  :host([data-skin='bubble']) .arow:focus-visible,
  :host([data-skin='bubble']) a.tile:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  :host([data-skin='bubble']) .arow .nm {
    font-weight: var(--sw-fw-semibold);
    font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
  }
  /* the ring: the area's hue, the lit halo when something is on */
  :host([data-skin='bubble']) .arow .sdot,
  :host([data-skin='bubble']) .tile-head .ring {
    inline-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
    block-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
    border-radius: 50%;
    background: var(--h, var(--sw-surface-2));
    color: var(--sw-ring-on-hue);
    display: grid;
    place-items: center;
    flex: none;
  }
  :host([data-skin='bubble']) .arow .sdot.on,
  :host([data-skin='bubble']) a.tile.on .ring {
    box-shadow: 0 0 0 3px var(--sw-lit-soft);
  }
  :host([data-skin='bubble']) .tree-row .sdot {
    inline-size: 22px;
    block-size: 22px;
    background: var(--h, var(--sw-surface-3));
    color: var(--sw-ring-on-hue);
    display: grid;
    place-items: center;
  }
  :host([data-skin='bubble']) .tree-row .sdot.on {
    box-shadow: 0 0 0 2px var(--sw-lit-soft);
  }
  :host([data-skin='bubble']) .tree-row.selected .sdot {
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
  }
  :host([data-skin='bubble']) .ind .i.more {
    background: var(--sw-surface-2);
  }
  :host([data-skin='bubble']) .fcard footer {
    border: 0;
    padding: 4px 4px 0;
  }
  :host([data-skin='bubble']) .fcard.loose {
    border: 0;
  }
  :host([data-skin='bubble']) .fcard.loose .arow {
    background: var(--sw-surface-2);
  }
  /* the tiles view: a pill per area with the ring at the start */
  :host([data-skin='bubble']) a.tile {
    flex-direction: row;
    align-items: center;
    min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
    padding: 4px 8px;
  }
  :host([data-skin='bubble']) a.tile.on {
    background: var(--sw-surface);
  }
  :host([data-skin='bubble']) a.tile .tile-head {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :host([data-skin='bubble']) a.tile .tile-head > sw-icon,
  :host([data-skin='bubble']) a.tile .tile-head .dot {
    display: none;
  }
  :host([data-skin='bubble']) .tile-wrap devices-bulk-menu {
    inset-block-start: 50%;
    transform: translateY(-50%);
  }
  :host([data-skin='bubble']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    gap: var(--sw-gap-grid);
  }
  :host([data-skin='bubble']) .floor-head h2 {
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
  }
  :host([data-skin='bubble']) button.chip,
  :host([data-skin='bubble']) .chip,
  :host([data-skin='bubble']) .fchips button.chip {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    min-block-size: var(--sw-touch-desktop);
    padding-inline: 12px;
  }
  /* the targets of the tree and the floor headers: the fold, the title, the "⋯" (the layout guard's touch dial) */
  :host([data-skin='bubble']) .tfold {
    inline-size: var(--sw-touch-desktop);
    block-size: var(--sw-touch-desktop);
    border-radius: 50%;
  }
  :host([data-skin='bubble']) .tree-area {
    padding-inline-start: calc(var(--sw-touch-desktop) - 20px);
  }
  :host([data-skin='bubble']) .fcard header h2 .ftitle {
    min-block-size: var(--sw-touch-desktop);
    min-inline-size: var(--sw-touch-desktop);
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
  }
  /* the area tile's "⋯" sits in the row, never over the tile */
  :host([data-skin='bubble']) .tile-wrap {
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
  :host([data-skin='bubble']) .tile-wrap > a.tile {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :host([data-skin='bubble']) .tile-wrap.bulk > a.tile .tile-head {
    padding-inline-end: 0;
  }
  :host([data-skin='bubble']) .tile-wrap devices-bulk-menu {
    position: static;
    transform: none;
    flex: none;
  }
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) button.chip,
    :host([data-skin='bubble']) .fchips button.chip,
    :host([data-skin='bubble']) .fcard header h2 .ftitle {
      min-block-size: 44px;
    }
    :host([data-skin='bubble']) .tfold {
      inline-size: 44px;
      block-size: 44px;
    }
  }
  :host([data-skin='bubble']) button.chip:hover,
  :host([data-skin='bubble']) button.chip:focus-visible {
    background: var(--sw-surface-3);
  }
  :host([data-skin='bubble']) .seg .opts {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    padding: 3px;
  }
  :host([data-skin='bubble']) .seg button {
    border-radius: var(--sw-r-pill);
    background: transparent;
  }
  :host([data-skin='bubble']) .seg button[aria-pressed='true'] {
    background: var(--sw-surface-solid);
  }
  :host([data-skin='bubble']) .floor-filter .opts {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    padding: 3px;
  }
  :host([data-skin='bubble']) .floor-filter button {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    min-block-size: 36px;
  }
  :host([data-skin='bubble']) .floor-filter button[aria-pressed='true'] {
    background: var(--sw-surface-solid);
  }
`;

/** CR-007 6a: the building screen's own element rules for the "glass" style (tokens: devices-style.ts) and for the
 * compact density. Logical properties only; smplwise + comfortable match none of them. */
const BUILDING_GLASS = css`
  :host([data-devices-style='glass']) sw-kpi,
  :host([data-devices-style='glass']) nav.tree,
  :host([data-devices-style='glass']) section.fcard,
  :host([data-devices-style='glass']) a.tile {
    backdrop-filter: var(--sw-glass-blur);
    -webkit-backdrop-filter: var(--sw-glass-blur);
  }
  :host([data-devices-style='glass']) .kpis {
    gap: var(--dv-gap);
  }
  :host([data-devices-style='glass']) sw-kpi {
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
  }
  /* iOS-like segmented control for "פריסה" */
  :host([data-devices-style='glass']) .seg .opts {
    border: 0;
    border-radius: var(--dv-radius-control);
    background: var(--dv-surface-3);
    padding: 3px;
    gap: 2px;
  }
  :host([data-devices-style='glass']) .seg button {
    border-radius: var(--dv-radius-control);
    background: transparent;
    padding-block: 6px;
    padding-inline: var(--dv-item-pad-inline);
    font-weight: var(--sw-fw-semibold);
  }
  :host([data-devices-style='glass']) .seg button + button {
    border-inline-start: 0;
  }
  :host([data-devices-style='glass']) .seg button[aria-pressed='true'] {
    background: var(--sw-surface);
    color: var(--dv-text);
    box-shadow: var(--dv-shadow-control);
  }
  /* the tree panel: pill rows */
  :host([data-devices-style='glass']) .split {
    /* owner 2026-09-29: a wide screen gives the tree (and its area names) more room */
    grid-template-columns: clamp(var(--dv-tree-inline), 16vw, var(--dv-tree-inline-max, 340px)) minmax(0, 1fr);
    gap: var(--dv-gap-lg);
  }
  :host([data-devices-style='glass']) nav.tree {
    padding: var(--dv-gap-sm);
    gap: 3px;
  }
  :host([data-devices-style='glass']) .tree-row {
    border-radius: var(--dv-radius-control);
    padding-block: 8px;
    padding-inline: var(--dv-item-pad-inline);
  }
  :host([data-devices-style='glass']) .tree-row.selected {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  /* larger floor ("room") cards */
  :host([data-devices-style='glass']) .fcards {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-floor-card-min), 1fr));
    gap: var(--dv-gap-lg);
  }
  :host([data-devices-style='glass']) .fcard header {
    padding-block: var(--dv-card-pad-block) var(--dv-gap-sm);
    padding-inline: var(--dv-card-pad-inline);
  }
  :host([data-devices-style='glass']) .fcard header h2,
  :host([data-devices-style='glass']) .floor-head h2 {
    font-size: var(--dv-fs-title);
    font-weight: var(--dv-fw-title);
    letter-spacing: -0.01em;
  }
  :host([data-devices-style='glass']) .fcard .rows {
    padding-block: 0 var(--dv-gap-sm);
    padding-inline: var(--dv-gap-sm);
    gap: 4px;
  }
  :host([data-devices-style='glass']) .arow {
    box-sizing: border-box;
    border-block-start: 0;
    border-radius: var(--dv-radius-sm);
    background: var(--sw-surface-2);
    padding-block: var(--dv-item-pad-block);
    padding-inline: var(--dv-item-pad-inline);
  }
  :host([data-devices-style='glass']) .arow:hover,
  :host([data-devices-style='glass']) .arow:focus-visible {
    background: var(--sw-surface);
  }
  :host([data-devices-style='glass']) .fcard footer {
    border-block-start: 0;
    padding-block: 4px var(--dv-card-pad-block);
    padding-inline: var(--dv-card-pad-inline);
  }
  /* icon-forward area tiles */
  :host([data-devices-style='glass']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-area-tile-min), 1fr));
    gap: var(--dv-gap);
  }
  :host([data-devices-style='glass']) a.tile {
    min-block-size: var(--dv-tile-min-block);
    padding-block: var(--dv-tile-pad-block);
    padding-inline: var(--dv-tile-pad-inline);
    gap: var(--dv-item-pad-block);
  }
  :host([data-devices-style='glass']) .tile-head {
    gap: var(--dv-item-pad-block);
  }
  :host([data-devices-style='glass']) .tile-head > sw-icon {
    box-sizing: border-box;
    inline-size: var(--dv-icon-ring-size-lg);
    block-size: var(--dv-icon-ring-size-lg);
    padding: var(--dv-icon-ring-pad);
    border-radius: 50%;
    background: var(--dv-icon-ring-bg);
    color: var(--dv-icon-ring-fg);
  }
  :host([data-devices-style='glass']) .tile-head .name {
    font-size: var(--dv-fs-tile-name);
  }
  :host([data-devices-style='glass']) a.tile.on {
    background: linear-gradient(135deg, rgb(var(--dv-tile-on-warm) / var(--dv-glow-fill-start)), rgb(var(--dv-tile-on-warm) / var(--dv-glow-fill-end))), var(--sw-surface);
    border-color: rgb(var(--dv-tile-on-warm) / var(--dv-glow-border));
    box-shadow: 0 0 28px rgb(var(--dv-tile-on-warm) / var(--dv-glow-halo)), var(--dv-shadow-1);
  }
  :host([data-devices-style='glass']) a.tile.on .tile-head > sw-icon {
    background: rgb(var(--dv-tile-on-warm) / var(--dv-glow-fill-start));
  }
  :host([data-devices-style='glass']) a.tile.empty {
    background: var(--sw-surface-2);
  }
  :host([data-devices-style='glass']) .tile-wrap devices-bulk-menu {
    inset-block-start: var(--dv-gap-sm);
    inset-inline-end: var(--dv-gap-sm);
  }
  @media (prefers-reduced-motion: no-preference) {
    :host([data-devices-style='glass']) a.tile {
      transition: transform var(--sw-t-med) var(--sw-ease), box-shadow var(--sw-t-med) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    :host([data-devices-style='glass']) a.tile:hover {
      transform: translateY(var(--dv-hover-lift));
    }
  }
  @media (max-width: 899px) {
    :host([data-devices-style='glass']) .split,
    :host([data-devices-style='glass']) .fcards {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* compact density (either style): tighter tiles, rows and gaps */
  :host([data-devices-density='compact']) .kpis {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }
  :host([data-devices-density='compact']) sw-kpi {
    padding-block: 8px;
    padding-inline: 10px;
    gap: 4px;
  }
  :host([data-devices-density='compact']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
  :host([data-devices-density='compact']) a.tile {
    min-block-size: 68px;
    padding-block: 8px;
    padding-inline: 10px;
    gap: 6px;
  }
  :host([data-devices-density='compact']) .fcards {
    gap: 8px;
  }
  :host([data-devices-density='compact']) .fcard header {
    padding-block: 8px 6px;
    padding-inline: 10px;
  }
  :host([data-devices-density='compact']) .arow {
    padding-block: 5px;
    padding-inline: 8px;
  }
  :host([data-devices-density='compact']) .fcard footer {
    padding-block: 6px 8px;
    padding-inline: 10px;
  }
  :host([data-devices-density='compact']) .tree-row {
    padding-block: 4px;
    padding-inline: 8px;
  }
  :host([data-devices-style='glass'][data-devices-density='compact']) .tile-head > sw-icon {
    inline-size: calc(var(--dv-icon-ring-size-lg) - 10px);
    block-size: calc(var(--dv-icon-ring-size-lg) - 10px);
    padding: calc(var(--dv-icon-ring-pad) - 3px);
  }
`;

/** Owner 2026-09-29: the compact summary tiles (ui.tile_layout, `data-tile-layout` on the host) - the building's counters
 * and the area tiles of the "אריחים" view as rectangles, icon beside the value. Every size is a `--dv-kpi-*` knob
 * (styles/devices-themes.ts); placed after the glass and density rules so it wins over both. */
const TILE_LAYOUT = css`
  :host([data-tile-layout='compact']) .kpis {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-kpi-compact-col-min), 1fr));
    grid-auto-rows: 1fr; /* review low: every compact tile as tall as the tallest */
    gap: var(--dv-kpi-compact-grid-gap);
  }
  :host([data-tile-layout='compact']) sw-kpi {
    min-block-size: var(--dv-kpi-compact-min-block);
    padding-block: var(--dv-kpi-compact-pad-block);
    padding-inline: var(--dv-kpi-compact-pad-inline);
    column-gap: var(--dv-kpi-compact-gap);
    row-gap: 0;
  }
  :host([data-tile-layout='compact']) .areas {
    grid-template-columns: repeat(auto-fill, minmax(var(--dv-kpi-compact-col-min), 1fr));
    gap: var(--dv-kpi-compact-grid-gap);
  }
  :host([data-tile-layout='compact']) a.tile {
    min-block-size: var(--dv-kpi-compact-min-block);
    padding-block: var(--dv-kpi-compact-pad-block);
    padding-inline: var(--dv-kpi-compact-pad-inline);
    gap: 4px;
  }
  :host([data-tile-layout='compact'][data-devices-style='glass']) .tile-head > sw-icon {
    inline-size: var(--dv-kpi-compact-icon);
    block-size: var(--dv-kpi-compact-icon);
    padding: calc(var(--dv-icon-ring-pad) - 2px);
  }
  @media (max-width: 599px) {
    :host([data-tile-layout='compact']) .kpis,
    :host([data-tile-layout='compact']) .areas {
      grid-template-columns: repeat(var(--dv-kpi-compact-cols-phone), minmax(0, 1fr));
    }
    /* an odd last tile takes the whole row */
    :host([data-tile-layout='compact']) .kpis > sw-kpi:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }
`;

/** Owner notes 2026-09-30: the home screen's own compact layout - the header row, the small summary tiles, the packed
 * "אריחים" view beside the tree, the fit steps (`data-fit`) and edit mode's card. Declared after the glass / density /
 * tile-shape rules on purpose: at equal specificity it wins over them. */
const HOME_LAYOUT = css`
  /* MULTIBUILDING-HOME-2330: the site bar of a multi-building site - where we are, the building switch (segmented), the level's off
     actions. Drawn only when the site has two or more buildings; one building never sees it. */
  .site-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    min-inline-size: 0;
  }
  .site-bar .crumbs {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-size: var(--sw-fs-md);
    min-inline-size: 0;
  }
  .site-bar .crumb {
    all: unset;
    color: var(--sw-accent-text);
    cursor: pointer;
    border-radius: var(--sw-r-sm);
  }
  .site-bar .crumb:focus-visible {
    outline: 2px solid var(--sw-focus);
  }
  .site-bar .crumb.here {
    color: var(--sw-heading, var(--sw-text));
    font-weight: var(--sw-fw-bold);
    cursor: default;
  }
  .site-bar .sitename {
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-medium);
  }
  .site-bar .sep {
    color: var(--sw-text-3);
  }
  .bswitch {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-3);
    min-inline-size: 0;
  }
  .bswitch button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-block-size: 32px;
    padding: 0 12px;
    border-radius: var(--sw-r-sm);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
    white-space: nowrap;
  }
  .bswitch button:focus-visible {
    outline: 2px solid var(--sw-focus);
  }
  .bswitch button[aria-pressed='true'] {
    background: var(--sw-seg-on-bg, var(--sw-seg-key, var(--sw-surface)));
    color: var(--sw-seg-on-text, var(--sw-seg-key-ink, var(--sw-accent-text)));
    box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    font-weight: var(--sw-fw-semibold);
  }
  .bswitch button.shared {
    color: var(--sw-shared-text);
  }
  /* DARK-SEG-ALL-2380: a chosen shared building on the dark light pill takes the key's dark label (light keeps the shared ink) */
  .bswitch button.shared[aria-pressed='true'] {
    color: var(--sw-seg-key-ink, var(--sw-shared-text));
  }
  .bswitch button.shared sw-icon {
    color: var(--sw-shared);
  }
  .bswitch .dot {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: var(--sw-danger);
  }
  .site-off {
    display: inline-flex;
    gap: 8px;
    margin-inline-start: auto;
  }
  .hdr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px 10px;
    min-inline-size: 0;
  }
  .ha-refresh {
    gap: 6px;
    flex-wrap: nowrap;
  }
  /* POLISH-295: the info bar sits first in the header row and gives way (it clips its own text) before the refresh icon does */
  .hdr home-ambient-bar {
    flex: 0 1 auto;
    min-inline-size: 0;
  }
  /* POLISH-295: a counter that has something on takes its kind's colour (sw-kpi --sw-kpi-on-*): light, switches and screens warm,
     cooling cool, heating amber; covers and locks keep the live green */
  sw-kpi[data-tile-kind='lights'],
  sw-kpi[data-tile-kind='switches'],
  sw-kpi[data-tile-kind='media'] {
    --sw-kpi-on-bg: var(--sw-lit-soft);
    --sw-kpi-on-fg: var(--sw-warning-text);
  }
  /* the owner's explicit "compact" tile choice stays compact: one label line, the 18 px numeral, the knobs' own height */
  :host([data-tile-layout='compact']) .kpis[data-kpis] > sw-kpi[data-kpi][layout='compact'] {
    --sw-kpi-label-lines: 1;
    --sw-kpi-compact-value-fs: var(--sw-fs-xl);
    min-block-size: var(--dv-kpi-compact-min-block);
    padding-block: var(--dv-kpi-compact-pad-block);
  }
  /* HOMEFABLE-297: the display size is for numerals; the alarm tile's value is a word ("armed (home)") and keeps the 16 px reading size, so a
     wrapped state never stretches the whole counter row */
  :host .kpis[data-kpis] > sw-kpi[data-tile-kind='alarm'][layout='compact'] {
    --sw-kpi-compact-value-fs: var(--sw-fs-lg);
  }
  sw-kpi[data-tile-kind='climate'] {
    --sw-kpi-on-bg: var(--sw-accent-soft);
    --sw-kpi-on-fg: var(--sw-accent-text);
  }
  sw-kpi[data-tile-kind='heating'] {
    --sw-kpi-on-bg: var(--sw-warning-soft);
    --sw-kpi-on-fg: var(--sw-warning-text);
  }
  /* the widgets (home redesign): direction a puts the band above the summary tiles, c a compact row, b a column beside the
     floors (the tree becomes a floor filter in the toolbar row); a phone gets a snap row above the tiles */
  .page-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .kpis[data-kpis] {
    grid-auto-rows: minmax(44px, 1fr);
  }
  .page-body[data-fit='1'],
  .page-body[data-fit='2'] {
    gap: 8px;
  }
  .bgrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--side-w, 300px);
    gap: 18px;
    align-items: start;
    min-inline-size: 0;
  }
  .bgrid[data-side='start'] {
    grid-template-columns: var(--side-w, 300px) minmax(0, 1fr);
  }
  .bgrid[data-side='start'] > .bside {
    order: -1;
  }
  .bmain {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .bgrid[data-fit='1'] .bmain {
    gap: 10px;
  }
  .floor-filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    flex-wrap: wrap;
  }
  .floor-filter .opts {
    display: inline-flex;
    flex-wrap: wrap;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    overflow: hidden;
  }
  .floor-filter button {
    border: 0;
    padding: 5px 12px;
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .floor-filter button + button {
    border-inline-start: 1px solid var(--sw-border-strong);
  }
  .floor-filter button:hover {
    background: var(--sw-hover-wash);
  }
  .floor-filter button:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  .floor-filter button[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .split[data-no-tree] {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (max-width: 899px) {
    .bgrid,
    .bgrid[data-side='start'] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  /* the summary tiles: small rectangles, the icon at the end of the text */
  :host .kpis[data-kpis] {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    grid-auto-rows: auto;
    gap: 10px;
  }
  /* HOMEFABLE-297 (impeccable typeset, taste-skill §5 "the figure leads"): the counter is a display numeral (the type scale's 2xl, 800,
     tight), its label a full 12 px line under it (two lines before an ellipsis, never "תאורה..."), the icon a quiet 30 px mark; the
     tile is a tone step DOWN from the floor cards (surface-2, a hairline, no shadow) so the floors read as the page's objects */
  :host .kpis[data-kpis] > sw-kpi[data-kpi][layout='compact'] {
    --sw-kpi-compact-icon: 30px;
    --sw-kpi-compact-value-fs: var(--sw-fs-2xl);
    --sw-kpi-label-lines: 2;
    min-block-size: 56px;
    padding-block: 5px;
    padding-inline: 12px;
    column-gap: 10px;
    row-gap: 0;
  }
  /* "אריחים": the floors as packed sections beside the tree - floors with few areas share a row */
  .floors {
    --tw: 172px;
    --th: 78px;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    align-content: flex-start;
    gap: 8px 14px;
    min-inline-size: 0;
  }
  .floors > section.floor {
    margin: 0;
    gap: 6px;
    flex: var(--n, 3) 1 calc(var(--n, 3) * var(--tw) + (var(--n, 3) - 1) * 8px);
    min-inline-size: min(100%, var(--tw));
    max-inline-size: 100%;
  }
  .floors > section.floor.laid {
    flex: 1 1 100%;
  }
  :host .floors .areas:not(.lay-grid) {
    grid-template-columns: repeat(auto-fill, minmax(var(--tw), 1fr));
    gap: 8px;
  }
  :host .floors a.tile {
    min-block-size: var(--th);
    padding-block: var(--tpad, 10px);
    padding-inline: 10px;
    gap: 4px;
  }
  :host([data-devices-density='compact']) .floors {
    --tpad: 6px;
    --th: 62px;
  }
  .floors .floor-head h2 {
    font-size: var(--sw-fs-md);
  }
  .split[data-layout-view='tiles'] > .floors {
    align-self: start;
  }
  /* the floor card's header is two rows: the title with the floor action, then the counts (home redesign) */
  .fcard header {
    flex-direction: column;
    flex-wrap: nowrap; /* a wrapping column sizes its one line by the widest row: a long chip row then pushed the floor action out of the card */
    align-items: stretch;
    gap: 6px;
  }
  .fh-top,
  .fh-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-inline-size: 0;
  }
  @media (max-width: 767px) {
    /* the floor header's chips stay on one line (release 0.1.149); a long list scrolls sideways instead of wrapping */
    .fh-chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .fh-chips::-webkit-scrollbar {
      display: none;
    }
    .fh-chips > *,
    .fchips {
      flex: none;
    }
    .fchips {
      flex-wrap: nowrap;
    }
  }
  .fh-top .lay-title-icon {
    flex: none;
  }
  .fcard header .fh-top devices-bulk-menu {
    margin-inline-start: auto;
  }
  /* fit step 1: smaller tiles and rows */
  .split[data-fit='1'] .floors {
    --tw: 156px;
    --th: 60px;
    gap: 6px 12px;
  }
  .split[data-fit='1'] .floors a.tile {
    padding-block: 6px;
    padding-inline: 8px;
    gap: 2px;
  }
  .split[data-fit='1'] .floor-head .level {
    display: none;
  }
  .split[data-fit='1'] .fcard header {
    padding-block: 8px 4px;
  }
  .split[data-fit='1'] .arow {
    padding-block: 4px;
  }
  .split[data-fit='1'] .fcard footer {
    padding-block: 4px 8px;
  }
  .split[data-fit='1'] .tree-row {
    padding-block: 3px;
  }
  /* fit step 2: the smallest */
  .split[data-fit='2'] .floors {
    --tw: 140px;
    --th: 0px;
    gap: 4px 10px;
  }
  .split[data-fit='2'] .floors a.tile {
    padding-block: 4px;
    padding-inline: 8px;
    gap: 0;
  }
  .split[data-fit='2'] .fcard footer,
  .split[data-fit='2'] .floor-head .level {
    display: none;
  }
  .split[data-fit='2'] .arow {
    padding-block: 2px;
  }
  @media (max-width: 899px) {
    .floors {
      --tw: 150px;
    }
    .floors > section.floor {
      flex: 1 1 100%;
    }
  }
`;

export const devicesBuildingStyles = [devicesStyleTokens, css`
    :host {
      display: block;
    }
    .ha-refresh {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ha-refresh {
      position: relative;
    }
    .ha-refresh .stale-dot {
      position: absolute;
      inset-block-start: 4px;
      inset-inline-end: 4px;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-warning);
      pointer-events: none;
    }
    .ha-refresh .refreshed {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .floor {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-block-start: 6px;
    }
    .floor-head {
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
    }
    .floor-head h2 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .level {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .floor-sum {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      /* next to the title (owner's 1920 px screenshot: an auto margin pushed the chips to the far edge of the page) */
      margin-inline-start: 6px;
    }
    .floor-sum span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .floor-sum .warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .floor-sum .warm sw-icon,
    .pills .warm sw-icon {
      color: var(--sw-warning);
    }
    .areas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 10px;
    }
    .tile-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .tile-wrap > a.tile {
      flex: 1;
    }
    .tile-wrap.bulk > a.tile .tile-head {
      padding-inline-end: 28px; /* room for the popover trigger in the corner */
    }
    .tile-wrap devices-bulk-menu {
      position: absolute;
      inset-block-start: 6px;
      inset-inline-end: 6px;
    }
    .floor-head devices-bulk-menu {
      margin-inline-start: 4px;
    }
    .bulk-buttons {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px 16px;
      flex-wrap: wrap;
    }
    .seg {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .seg .opts {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
    }
    .seg button {
      border: 0;
      padding: 5px 12px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border-strong);
    }
    .seg button:hover {
      background: var(--sw-hover-wash);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .toolbar .bulk-buttons {
      margin-inline-start: auto;
    }
    /* ---- the mockup's layout: tree panel (inline start) + floor cards */
    /* K88: the plan view - the live plan beside the tree, the floor chooser above it, the room's area summary over it */
    .planview {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      min-block-size: min(70vh, 720px);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .planview explore-floor-map {
      flex: 1;
      min-block-size: 0;
    }
    .planfloors {
      display: flex;
      gap: 6px;
      padding: 8px 10px 0;
      overflow-x: auto;
    }
    .planfloors button {
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      background: var(--sw-surface-2, var(--sw-surface));
      color: var(--sw-text-2);
      padding: 4px 12px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .planfloors button.on {
      border-color: var(--sw-accent);
      color: var(--sw-text);
      background: var(--sw-accent-soft);
    }
    .planpop {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      z-index: 6;
    }
    .planpop .poptrig {
      display: block;
      inline-size: 1px;
      block-size: 1px;
    }
    @media (max-width: 899px) {
      .planview {
        min-block-size: 70vh;
      }
    }
    .split {
      display: grid;
      /* owner 2026-09-29: a wide screen gives the tree (and its area names) more room */
      grid-template-columns: clamp(250px, 16vw, 320px) minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }
    nav.tree {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      position: sticky;
      inset-block-start: 8px;
      /* owner 2026-09-29 ("unnecessary scrolling"): the tree never scrolls on its own unless it is itself taller than
         the viewport - then it sticks and scrolls inside the visible height (the top bar and the page padding off) */
      box-sizing: border-box;
      max-block-size: calc(100dvh - var(--sw-topbar-h) - var(--sw-banner-h, 0px) - 16px); /* the view under the top bar, minus the 8 px sticky offset top and bottom */
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    .tree-row {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      padding: 6px 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      min-inline-size: 0;
    }
    .tree-row:hover {
      background: var(--sw-hover-wash);
    }
    /* HOME polish (2026-10-10): keyboard focus is a ring, not only a wash (the wash alone vanished on a hovered row) */
    .tree-row:focus-visible {
      background: var(--sw-hover-wash);
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .tree-row.selected {
      background: var(--sw-accent-soft, var(--sw-surface-2));
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    @media (prefers-reduced-motion: no-preference) {
      .tree-row,
      .arow,
      .sdot,
      .tile-head .dot,
      .ind .i,
      button.chip {
        transition: background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-state) var(--sw-ease);
      }
    }
    .tree-row .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* owner 2026-09-29 (tree rows): the name takes the row (inline-start, ellipsis only when truly out of room, the full
       name in its title); the lit count sits in a fixed column at the inline end, then the "⋯" column - so every row
       lines up, with or without a menu (a row without one keeps the menu's width free) */
    .tree-row .lit {
      flex: none;
      box-sizing: border-box;
      /* WORSTCASE-2310: a minimum, not a fixed width - every usual count lines up in the 44 px column, a five-digit one (49392 lights
         on the building row) widens its own row instead of pushing the bulb out of the column */
      min-inline-size: var(--dv-tree-count-w, 44px);
      justify-content: flex-end;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .tree-row.nomenu {
      inline-size: auto;
      margin-inline-end: var(--dv-tree-menu-w, 30px);
    }
    .tree-floor .tree-row {
      flex: 1;
      min-inline-size: 0;
    }
    .tree-floor devices-bulk-menu {
      flex: none;
      inline-size: var(--dv-tree-menu-w, 30px);
      justify-content: center;
    }
    .tree-row .lit.warm {
      color: var(--sw-text);
    }
    .tree-row .lit.warm sw-icon {
      color: var(--sw-warning);
    }
    .tree-floor {
      display: flex;
      align-items: center;
      margin-block-start: 6px;
    }
    /* a floor is the tree's grouping level: it reads as the heading of its area rows, not as a smaller caption */
    .tree-floor .tree-row {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      text-transform: none;
    }
    .tree-floor .tree-row > sw-icon {
      color: var(--sw-text-3);
    }
    .tree-floor .tree-row.selected > sw-icon {
      color: inherit;
    }
    /* the floor's fold chevron: a compact column at the row's start (a touch screen's hit area grows invisibly past it) */
    .tfold {
      position: relative;
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      inline-size: 22px;
      block-size: 28px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-3);
      font: inherit;
    }
    button.tfold {
      cursor: pointer;
    }
    button.tfold:hover,
    button.tfold:focus-visible {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
      outline: none;
    }
    button.tfold:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (pointer: coarse) {
      button.tfold::before {
        content: '';
        position: absolute;
        inset-block: -8px;
        inset-inline: -11px; /* UXFIX-A11Y-295: 22 + 22 = 44 px wide, 28 + 16 = 44 px tall */
      }
    }
    .tfold .chev.folded {
      transform: rotate(90deg); /* points to the inline start (left, in Hebrew) */
    }
    .tfold .chev.folded:dir(ltr) {
      transform: rotate(-90deg);
    }
    @media (prefers-reduced-motion: no-preference) {
      .tfold .chev {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .tree-areas {
        animation: tree-areas-in var(--sw-t-med) var(--sw-ease);
      }
    }
    @keyframes tree-areas-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    .tree-floor.tree-all {
      margin-block-start: 0;
    }
    .tree-area {
      position: relative;
      display: flex;
      align-items: center;
      padding-inline-start: 24px; /* under the floor's name: past the fold chevron's column */
    }
    .tree-area devices-bulk-menu {
      flex: 1;
      min-inline-size: 0;
    }
    .tree-row .nm[title] {
      cursor: inherit;
    }
    .sdot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-border-strong);
      flex: none;
    }
    /* something is on: the warm dot carries a soft halo, so the state reads from across the room and in both schemes */
    .sdot.on {
      background: var(--sw-warning);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-warning) 22%, transparent);
    }
    /* the hover "כבה אזור" takes NO room in the row (owner 2026-09-29: an invisible button used to squeeze the names):
       it floats over the count column, before the "⋯", while the row is hovered or focused; on a touch screen the
       row's "⋯" carries the same action, so it is not drawn there at all */
    .quick {
      position: absolute;
      inset-block: 0;
      inset-inline-end: var(--dv-tree-menu-w, 30px);
      display: flex;
      align-items: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .quick sw-button {
      background: var(--dv-surface-solid, var(--sw-surface));
      border-radius: var(--sw-r-sm);
    }
    .tree-area:hover .quick,
    .tree-area:focus-within .quick {
      opacity: 1;
      pointer-events: auto;
    }
    @media (hover: none) {
      .quick {
        display: none;
      }
    }
    .fcards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 14px;
      align-items: start;
    }
    /* HOMEFABLE-297 (impeccable bolder / layout): the floor cards are the page's hero tier - the rounder radius, the ladder's second
       step, a floor title at 20 px / 800; the rows inside are wells (tone step, rounded), not a ruled table */
    section.fcard {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
    }
    /* the hero step over every skin's own panel rule (the skins keep their material; the ladder step and the radius are the home's) */
    :host .fcards > section.fcard {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    :host .kpis[data-kpis] > sw-kpi[data-kpi] {
      background: var(--sw-surface-2);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    }
    .fcard header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 18px 10px;
      flex-wrap: wrap;
    }
    .fcard header h2 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading);
      letter-spacing: -0.025em;
      line-height: 1.15;
    }
    /* owner feedback 2026-09-29: the floor's title enters the floor, like "פתח קומה" */
    .fcard header h2 .ftitle {
      border: 0;
      padding: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: start;
      border-radius: var(--sw-r-2xs);
    }
    /* POLISH-CONTROL-297 (owner decision, P6 item "long floor names"): the name is clamped to the installation's line count (2 by default,
       the full name in the tooltip); 1 = one line with an ellipsis */
    .fcard header h2 .ftitle {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .fcard header h2 .ftitle[data-lines='3'] {
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
    .fcard header h2 .ftitle[data-lines='1'] {
      display: block;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .fcard header h2 .ftitle:hover {
      color: var(--sw-accent);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .fcard header h2 .ftitle:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* an area row is a link into the area (owner feedback 2026-09-29) */
    a.tree-row,
    a.arow {
      box-sizing: border-box;
      text-decoration: none;
    }
    .fcard header .lit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .fcard header .lit.warm sw-icon {
      color: var(--sw-warning);
    }
    .fcard header devices-bulk-menu {
      margin-inline-start: auto; /* the card's own header: the floor action closes the row, as in the mockup */
    }
    .fcard .rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 10px 10px;
    }
    .arow {
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      min-block-size: 42px;
      padding: 7px 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
      flex-wrap: nowrap;
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
    }
    /* mobile-native: a hover only under a pointer that hovers (a tap would leave it stuck); the press answers on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .arow:hover {
        background: var(--sw-surface-3);
      }
    }
    .arow {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    .arow:active {
      transform: scale(var(--sw-press-scale));
    }
    .arow:focus-visible {
      background: var(--sw-surface-3);
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
      border-radius: var(--sw-r-sm);
    }
    .arow-q .arow {
      background: transparent;
    }
    .arow-q:not([data-lit]):not([data-bad]) {
      background: var(--sw-surface-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .arow-q:not([data-lit]):not([data-bad]):hover {
        background: var(--sw-surface-3);
      }
    }
    .arow.empty {
      color: var(--sw-text-3);
      cursor: default;
    }
    .arow.empty:hover {
      background: transparent;
    }
    .arow .nm {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      flex: 1 1 auto;
      min-inline-size: min(3ch, calc(100% - 18px)); /* P6 item 2: the name never squeezes under three letters - the indicators yield first (WORSTCASE-2310: nor past the row's own width after the 8 px dot and 10 px gap) */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* P6 item 2: the temperature / stale time never shrinks or clips ("21.0°" read as "0°"); tabular so rows align */
    /* WORSTCASE-2310: ...but when the name is already at its minimum and the row is still too narrow (a floor card beside the tree and
       three more cards, a quick row with two actions), the reading yields the rest instead of running out of the row under the "⋯"
       and the actions: it ends in an ellipsis on its LTR end ("21.…", never "0°") and carries the full value in its tooltip */
    .arow .tm {
      flex: 0 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
    /* release 0.1.149: what sits after an area's name - one line, never wrapping; at most three on a phone, the rest as "+N" */
    .ind {
      display: inline-flex;
      align-items: center;
      min-block-size: 20px; /* an empty row is as tall as one with indicators */
      flex: none;
      gap: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .ind.none {
      color: var(--sw-text-3);
    }
    .ind .i {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .ind .i.warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .ind .i.warm sw-icon {
      color: var(--sw-warning);
    }
    .ind .i[data-ind='climate'].warm sw-icon {
      color: var(--sw-accent);
    }
    .ind .i[data-ind='climate'].warm.heat sw-icon {
      color: var(--sw-warning);
    }
    .ind .i.dim {
      opacity: 0.5;
    }
    .ind .i.more {
      padding-inline: 6px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .fcard footer {
      display: flex;
      gap: 8px;
      padding: 6px 18px 14px;
    }
    .fcard.loose {
      border-style: dashed;
    }
    @media (max-width: 899px) {
      /* the floor cards carry every row and action of the tree: on a narrow screen they are the whole screen */
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
      nav.tree {
        display: none;
      }
      .fcards {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    a.tile {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      min-block-size: 92px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: inherit;
      text-decoration: none;
    }
    @media (prefers-reduced-motion: no-preference) {
      a.tile {
        transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-state) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
      }
      a.tile:hover {
        transform: translateY(var(--sw-hover-lift));
      }
    }
    a.tile:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    a.tile:focus-visible {
      border-color: var(--sw-border-strong);
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    /* HOMEFABLE-297: a lit area tile is a solid lit field (the same status field as the cards-mode rows), not a fade */
    a.tile.on {
      background: var(--sw-lit-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
    }
    .tile-head > sw-icon {
      color: var(--sw-text-2);
    }
    a.tile.on .tile-head > sw-icon {
      color: var(--sw-warning-text);
    }
    a.tile.empty {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    a.tile.unassigned {
      border-style: dashed;
    }
    .tile-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tile-head .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile-head .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-warning);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-warning) 22%, transparent);
      flex: none;
    }
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pills span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .pills .warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .pills .none {
      color: var(--sw-text-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* ---- the loading skeleton (HOME polish 2026-10-10) ---- */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .skl {
      position: relative;
      overflow: hidden;
      border-radius: var(--sw-r-md);
      background: var(--sw-skeleton);
    }
    .skl::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, var(--sw-skeleton-shine), transparent);
    }
    @media (prefers-reduced-motion: no-preference) {
      .skl::after {
        animation: skl-shine 1.4s var(--sw-ease) infinite;
      }
    }
    @keyframes skl-shine {
      to {
        transform: translateX(100%);
      }
    }
    .skl-band {
      display: flex;
      gap: 12px;
    }
    .skl-band .wg {
      flex: 1 1 210px;
      block-size: 146px;
    }
    .skl-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
    }
    .skl-kpis .kpi {
      block-size: 44px;
    }
    .skl-split {
      display: grid;
      grid-template-columns: clamp(250px, 16vw, 320px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .skl-split .tree {
      block-size: 220px;
    }
    .skl-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 12px;
    }
    .skl-cards .card {
      block-size: 180px;
    }
    @media (max-width: 899px) {
      .skl-band .wg:nth-child(n + 3),
      .skl-split .tree {
        display: none;
      }
      .skl-split,
      .skl-cards {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .areas {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      .floor-sum {
        margin-inline-start: 0;
      }
    }
    /* owner 2026-09-29: a floor's count chips (and the floor card's lit count) open the tiles' panel for that floor */
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      padding: 2px 8px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--sw-text-2);
    }
    .fchips {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .fchips:empty {
      display: none;
    }
    /* HOME polish: the count chips are quiet pills on the card (no outline); the lit chip takes the warm tone when something is on */
    .fchips button.chip {
      position: relative;
      background: var(--sw-surface-2);
      border-color: transparent;
      min-block-size: 28px;
    }
    .fh-chips button.chip.lit {
      background: var(--sw-surface-2);
      border-color: transparent;
    }
    .fh-chips button.chip.lit.warm {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .fh-chips button.chip.lit.warm sw-icon {
      color: var(--sw-warning);
    }
    @media (max-width: 767px), (pointer: coarse) {
      .fchips button.chip {
        min-block-size: 36px;
      }
      .fchips button.chip::before {
        content: '';
        position: absolute;
        inset-block: -4px;
        inset-inline: 0;
      }
    }
    button.chip {
      min-block-size: 28px;
      border-color: var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
    }
    button.chip.warm {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    button.chip:hover {
      border-color: var(--sw-border-strong);
      background: var(--sw-surface-3);
    }
    button.chip:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    button.chip[aria-expanded='true'] {
      border-color: var(--sw-accent);
    }
    @media (max-width: 767px), (pointer: coarse) {
      button.chip {
        min-block-size: 44px;
        padding-inline: 10px;
      }
    }
  `, BUILDING_GLASS, TILE_LAYOUT, HOME_LAYOUT, BUILDING_BUBBLE, HOME_SCREEN_CSS, TREE_UNASSIGNED_CSS, HOME_DRAWER_CSS];
