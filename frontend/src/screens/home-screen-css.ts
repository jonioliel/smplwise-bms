import { css } from 'lit';

/**
 * HOME-295 (the approved home mockup round 2, private/review/HOME_MOCKUP_R2_2026-10-25.html): the new pieces of the home screen - the
 * quick actions of an area (one builder for the tile and the cards-mode row), the alerts and no-connection rows, the floor-off buttons,
 * "more floors", the phone floor switch with its tree sheet and the area sheet. Product tokens only (design/tokens.ts); declared last
 * in devices-building's styles so it wins at equal specificity. Video / map geometry is never touched.
 */
export const HOME_SCREEN_CSS = css`
  /* ---------------------------------------------------------------- quick actions (tile and row share the builder) */
  .qa {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    min-inline-size: 0;
  }
  .qb {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 30px;
    padding: 0 10px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    border: 1px solid var(--sw-border);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
    white-space: nowrap;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    box-sizing: border-box;
  }
  .qb sw-icon {
    color: var(--sw-text-3);
  }
  .qb:hover {
    background: var(--sw-surface-3);
  }
  .qb:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .qb {
      transition: transform var(--sw-t-fast) ease-out, background-color var(--sw-t-fast) ease;
    }
    .qb:active:not(:disabled) {
      transform: scale(0.97);
    }
  }
  .qb[aria-pressed='true'].l {
    background: var(--sw-lit);
    border-color: transparent;
    color: var(--sw-on-lit);
  }
  .qb[aria-pressed='true'].l sw-icon {
    color: var(--sw-on-lit);
  }
  .qb[aria-pressed='true'].c {
    background: var(--sw-cool-soft, color-mix(in srgb, var(--sw-cool) 14%, transparent));
    border-color: color-mix(in srgb, var(--sw-cool) 45%, transparent);
    color: var(--sw-heading);
  }
  .qb[aria-pressed='true'].c sw-icon {
    color: var(--sw-cool);
  }
  .qb[aria-pressed='true'].h {
    background: var(--sw-heat-soft, color-mix(in srgb, var(--sw-heat) 14%, transparent));
    border-color: color-mix(in srgb, var(--sw-heat) 45%, transparent);
    color: var(--sw-heading);
  }
  .qb[aria-pressed='true'].h sw-icon {
    color: var(--sw-heat);
  }
  .qb[aria-pressed='true'].s {
    background: var(--sw-accent-soft);
    border-color: transparent;
    color: var(--sw-accent-text);
  }
  .qb[aria-pressed='true'].s sw-icon {
    color: var(--sw-accent-text);
  }
  .qb.ico {
    padding: 0;
    inline-size: 30px;
    justify-content: center;
  }
  .qb:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .qa.sm .qb {
    block-size: 28px;
    padding: 0 8px;
    gap: 4px;
    font-size: var(--sw-fs-xs);
  }
  .qa.sm .qb.ico {
    inline-size: 28px;
    padding: 0;
  }
  /* the bubble skin: every control meets its touch dial (the layout guard: the desktop dial above 1100 px, 44 px on a touch layout) */
  :host([data-skin='bubble']) .qa .qb,
  :host([data-skin='bubble']) .treebtn {
    block-size: auto;
    min-block-size: var(--sw-touch-desktop);
    min-inline-size: var(--sw-touch-desktop);
  }
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) .qa .qb,
    :host([data-skin='bubble']) .treebtn,
    :host([data-skin='bubble']) .pfl .segs button {
      block-size: auto;
      min-block-size: 44px;
      min-inline-size: 44px;
    }
  }
  /* the narrowest phone in bubble: the touch-sized actions leave the row the name only (as the landscape tablet below drops the temperature) */
  @media (max-width: 359px) {
    :host([data-skin='bubble']) .arow-q .arow .tm {
      display: none;
    }
  }
  /* the blinds' count button opens open / stop / close beside it */
  .cmenu {
    position: absolute;
    inset-block-end: calc(100% + 4px);
    inset-inline-start: 0;
    z-index: 6;
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-pill);
    box-shadow: var(--sw-shadow-3);
  }

  /* ---------------------------------------------------------------- the tile with its quick row (tiles view) */
  /* the tiles' width holds the quick row (the mockup: 222 px at 1440; the fit steps go no lower than 188 px) */
  :host .floors {
    --tw: 214px;
  }
  :host .split[data-fit='1'] .floors {
    --tw: 200px;
  }
  :host .split[data-fit='2'] .floors {
    --tw: 188px;
  }
  @media (max-width: 899px) {
    :host .floors {
      --tw: 150px;
    }
  }
  :host .floors .tile-wrap.has-qa > a.tile {
    box-sizing: border-box;
    padding-block-end: 44px;
    min-block-size: 96px;
  }
  /* the summary tiles share one row on a control screen (the chosen ones; the labels clip before the row wraps) */
  @media (min-width: 900px) {
    :host .kpis[data-kpis][data-summary] {
      grid-template-columns: repeat(var(--kn, 6), minmax(0, 1fr));
    }
    :host .kpis[data-kpis][data-summary] > sw-kpi {
      min-inline-size: 0;
    }
  }
  .tile-wrap > .qa {
    position: absolute;
    inset-inline: 12px;
    inset-block-end: 9px;
  }
  .tile-head .tmp {
    margin-inline-start: auto;
    flex: none;
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
    font-variant-numeric: tabular-nums;
  }
  .tile-wrap.bulk .tile-head .tmp {
    margin-inline-end: 4px;
  }
  a.tile[data-bad] {
    border-color: color-mix(in srgb, var(--sw-danger) 70%, transparent);
    background: var(--sw-danger-soft); /* HOMEFABLE-297: a solid status field, as the lit tile */
  }
  a.tile .sub {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  a.tile .sub.bad {
    color: var(--sw-danger-text);
    font-weight: var(--sw-fw-semibold);
  }
  :host([data-offline]) a.tile,
  :host([data-offline]) a.tile.on {
    background: var(--sw-surface-2);
    border-color: var(--sw-border);
    box-shadow: none;
  }
  :host([data-offline]) a.tile .name,
  :host([data-offline]) a.tile .tmp,
  :host([data-offline]) .arow .nm,
  :host([data-offline]) .arow .tm {
    color: var(--sw-text-3);
  }

  /* ---------------------------------------------------------------- the cards-mode area row with its quick actions */
  .arow-q {
    display: flex;
    align-items: center;
    gap: 6px;
    border-block-start: 1px solid var(--sw-border);
    padding-inline-end: 6px;
    min-inline-size: 0;
  }
  .arow-q > devices-bulk-menu {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .arow-q .arow {
    border-block-start: 0;
  }
  .arow .tm {
    flex: none;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  .arow .btx {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-bold);
  }
  /* a landscape tablet: the row keeps the name and the actions (the mockup drops the temperature there) */
  @media (min-width: 900px) and (max-width: 1180px) {
    .arow-q .arow .tm,
    .arow-q .arow .btx {
      display: none;
    }
    .arow-q .arow {
      padding-inline: 6px;
      gap: 6px;
    }
  }
  .arow-q .arow .nm {
    min-inline-size: 3.5em;
  }
  /* HOMEFABLE-297 (impeccable bolder, status clarity): a room with something on is a whole lit row - a solid warm field with its own
     rounded edge, not a fade that dies halfway across the card; the rows sit as wells inside the floor card (home layout) */
  .arow-q {
    border-radius: var(--sw-r-sm);
    border-block-start: 0;
  }
  .arow-q[data-lit] {
    background: var(--sw-lit-soft);
  }
  .arow-q[data-bad] {
    background: var(--sw-danger-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 55%, transparent);
    border-radius: var(--sw-r-sm);
  }
  .arow-q[data-bad] .sdot {
    background: var(--sw-danger);
  }
  :host([data-offline]) .arow-q[data-lit] {
    background: none;
  }
  :host([data-offline]) .sdot {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--sw-offline);
  }

  /* ---------------------------------------------------------------- floor-off control: two direct buttons */
  .foff {
    display: inline-flex;
    gap: 6px;
    margin-inline-start: auto;
    flex: none;
  }
  .foff button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    block-size: 30px;
    padding: 0 10px;
    border-radius: var(--sw-r-pill);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
    cursor: pointer;
  }
  .foff button.danger {
    color: var(--sw-danger-text);
    border-color: color-mix(in srgb, var(--sw-danger) 45%, transparent);
  }
  .foff button:disabled,
  .off-dim {
    opacity: 0.5;
    pointer-events: none;
  }
  .foff button:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }

  /* ---------------------------------------------------------------- the alerts rows and the no-connection row */
  .alerts {
    display: flex;
    gap: 8px;
  }
  .al {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    block-size: 40px;
    padding: 0 6px 0 12px;
    box-sizing: border-box;
    border-radius: var(--sw-r-md);
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-base);
    border: 1px solid color-mix(in srgb, var(--sw-danger) 35%, transparent);
  }
  .al b {
    color: var(--sw-heading);
    font-weight: var(--sw-fw-bold);
    white-space: nowrap;
  }
  .al .w {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-inline-size: 0;
  }
  .al .gx,
  .conn .gx {
    margin-inline-start: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }
  .abtn {
    block-size: 30px;
    padding: 0 12px;
    border-radius: var(--sw-r-pill);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    background: var(--sw-surface);
    color: var(--sw-heading);
    border: 1px solid var(--sw-border-strong);
    white-space: nowrap;
    cursor: pointer;
  }
  .abtn:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .conn {
    display: flex;
    align-items: center;
    gap: 10px;
    block-size: 40px;
    padding: 0 8px 0 14px;
    box-sizing: border-box;
    border-radius: var(--sw-r-md);
    background: var(--sw-toast-bg);
    color: var(--sw-toast-text);
    font-size: var(--sw-fs-base);
  }
  .conn .w {
    opacity: 0.8;
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
  }
  .conn .abtn {
    background: transparent;
    color: var(--sw-toast-text);
    border-color: color-mix(in srgb, var(--sw-toast-text) 35%, transparent);
  }
  .spin {
    inline-size: 14px;
    block-size: 14px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-inline-end-color: transparent;
    flex: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .spin {
      animation: hs-spin 700ms linear infinite;
    }
  }
  @keyframes hs-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 599px) {
    .alerts {
      flex-direction: column;
      gap: 6px;
    }
    .al {
      block-size: 44px;
    }
  }

  /* ---------------------------------------------------------------- more floors: four (three) cards in one row */
  .fcards[data-cols='4'] {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .fcards[data-cols='3'] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .fcards[data-cols='2'] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .fcards[data-cols='1'] {
    grid-template-columns: minmax(0, 1fr);
  }
  .tree-more {
    display: flex;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    padding: 6px 8px;
    border: 0;
    border-block-start: 1px solid var(--sw-border);
    background: transparent;
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-accent-text);
    cursor: pointer;
    text-align: start;
    border-radius: 0;
  }
  .tree-more:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }

  .tree-loose {
    margin-block-start: 6px;
    border-block-start: 1px solid var(--sw-border);
    border-radius: 0 0 var(--sw-r-sm) var(--sw-r-sm);
    color: var(--sw-text-2);
  }
  /* the screen editor's options card */
  .hs-edit {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    padding: 12px 14px;
    box-shadow: var(--sw-shadow-1);
  }
  .hs-edit h3 {
    margin: 0 0 10px;
    font-size: var(--sw-fs-md);
    color: var(--sw-heading);
  }

  /* ---------------------------------------------------------------- phone: one floor at a time, the tree in a sheet */
  .pfl {
    display: flex;
    align-items: center;
    gap: 8px;
    min-inline-size: 0;
  }
  .pfl .segs {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--sw-seg-track, var(--sw-surface-3));
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-pill);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pfl .segs::-webkit-scrollbar {
    display: none;
  }
  .pfl .segs button {
    flex: 1 0 auto;
    block-size: 30px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-seg-off-text, var(--sw-text-2));
    white-space: nowrap;
    cursor: pointer;
  }
  .pfl .segs button[aria-pressed='true'] {
    background: var(--sw-seg-on-bg, var(--sw-accent));
    color: var(--sw-seg-on-text, var(--sw-text-inverse));
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-seg-on-shadow, var(--sw-shadow-1));
  }
  .treebtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    block-size: 36px;
    padding: 0 12px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border-strong);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
    flex: none;
    cursor: pointer;
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--sw-overlay);
    z-index: 40;
  }
  .hsheet {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 41;
    max-block-size: 88dvh;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 14px 14px;
    background: var(--sw-menu-surface);
    border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
    box-shadow: var(--sw-shadow-3);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .hsheet.full {
    inset-block-start: 0;
    max-block-size: none;
    border-radius: 0;
  }
  .hsheet .grab {
    inline-size: 40px;
    block-size: 4px;
    border-radius: 2px;
    background: var(--sw-border-strong);
    margin: 2px auto;
    flex: none;
  }
  .hsheet .sh {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hsheet .sh b {
    font-size: var(--sw-fs-lg);
    color: var(--sw-heading);
  }
  .hsheet .x {
    margin-inline-start: auto;
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--sw-surface-2);
    border: 1px solid var(--sw-border);
    color: var(--sw-text-2);
    cursor: pointer;
  }
  /* the tree inside the phone sheet is shown (it is hidden on a narrow screen otherwise) */
  .hsheet nav.tree {
    display: flex;
    position: static;
    max-block-size: none;
    border: 0;
    box-shadow: none;
    padding: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .hsheet {
      animation: hs-up var(--sw-t-med) var(--sw-ease);
    }
  }
  @keyframes hs-up {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }
`;
