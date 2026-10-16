import { css } from 'lit';

/**
 * CR-038 slice 6b (D24): the look of the board TABLE - on top of the automations glass layer (styles/automations-glass.ts over
 * styles/media-glass.ts: the `--dv-*` palette, `.btn`, `.seg`, `.chip`, `.pop`, `.statebox`, light / dark by the installation, the five
 * skins through those layers) and the electricity meters / bills table anatomy of the approved mock-up v2: a glass card, a sticky
 * header row of small grey labels, 1 px row dividers, dot chips, tabular numbers. Every menu and popover is OPAQUE
 * (`--sw-menu-surface`, owner rule 2026-10-13). Only `--sw-*` type / radius tokens and the palette knobs (unit-token-lint reads this
 * folder); logical properties only (RTL). The Bubble skin gets component-level rules here (its skin sheet is at its rule budget).
 */
export const ticketTableStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  .tbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-block-end: 12px;
    min-inline-size: 0;
  }
  .tbar .count {
    color: var(--dv-text-2);
    font-size: var(--sw-fs-base);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .anchor {
    position: relative;
    display: inline-flex;
  }
  .anchor > .pop {
    inset-block-start: calc(100% + 6px);
    inset-inline-start: 0;
    background: var(--sw-menu-surface);
    border-color: var(--sw-menu-border);
  }
  /* a long list scrolls inside the popover (the popover itself never overflows its own box) */
  .anchor > .pop.lst {
    max-block-size: none;
    overflow: visible;
  }
  .pop .plist {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-block-size: min(46vh, 380px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .anchor.end > .pop {
    inset-inline-start: auto;
    inset-inline-end: 0;
  }
  .pop .hd {
    padding: 6px 10px 4px;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .pop label.opt {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding-inline: 10px;
    border-radius: var(--sw-r-md);
    font-size: var(--sw-fs-base);
    cursor: pointer;
  }
  .pop label.opt:hover {
    background: var(--dv-surface-3);
  }
  .pop .crow {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pop .crow label.opt {
    flex: 1;
    min-inline-size: 0;
  }
  .pop .crow button.mv {
    inline-size: 36px;
    min-block-size: 36px;
    justify-content: center;
    padding: 0;
  }
  .pop .crow button.mv[disabled] {
    opacity: 0.3;
  }
  .pop input[type='checkbox'],
  .pop input[type='radio'] {
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--dv-accent);
    flex: none;
  }
  .pop .vrow {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pop .vrow > button:first-child {
    flex: 1;
    min-inline-size: 0;
  }
  .pop .vrow > button:first-child span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pop .vrow button.icon {
    inline-size: 40px;
    justify-content: center;
    padding: 0;
  }
  .pop .vrow button.icon[aria-pressed='true'] .ic {
    color: var(--dv-accent-text);
    fill: currentColor;
  }
  .pop .save {
    display: flex;
    gap: 6px;
    padding: 6px;
    align-items: center;
  }
  .pop .save .inp {
    flex: 1;
    min-inline-size: 0;
  }
  .pop .note {
    padding: 4px 10px 8px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .pop .note.err {
    color: var(--dv-danger);
    font-weight: 600;
  }
  .pop .fgrp {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 2px 6px 8px;
  }
  .pop .fgrp .rc {
    min-block-size: 36px;
  }
  .pop .dates {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 2px 6px 8px;
  }
  .pop .dates label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .pop.wide {
    min-inline-size: min(320px, calc(100vw - 32px));
  }
  .rc,
  .pop button.rc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 38px;
    padding-inline: 14px;
    border-radius: 999px;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
  }
  .pop button.rc:hover {
    background: var(--dv-surface-3);
  }
  .rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true']:hover {
    background: var(--dv-text);
    color: var(--dv-surface-solid);
    border-color: transparent;
  }

  /* the table card */
  .tw {
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-2xl);
    box-shadow: var(--dv-shadow-1);
    /* 2.5.5: the height follows the rows (a few rows leave no empty box and no vertical bar); a tall list scrolls inside, the header stays */
    overflow-x: auto;
    overflow-y: auto;
    block-size: auto;
    max-block-size: max(420px, calc(100dvh - 300px));
    overscroll-behavior: contain;
  }
  table.tt {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--sw-fs-md);
  }
  table.tt thead th {
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
    background: var(--dv-surface-solid);
    text-align: start;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--dv-text-2);
    padding: 8px 12px;
    border-block-end: 1px solid var(--dv-border-strong);
    white-space: nowrap;
  }
  table.tt th button.sh {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-block-size: 32px;
    padding: 0 2px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  table.tt th[aria-sort='ascending'] button.sh,
  table.tt th[aria-sort='descending'] button.sh,
  table.tt th button.sh.second {
    color: var(--dv-accent-text);
    font-weight: 700;
  }
  table.tt th button.sh small {
    font-size: var(--sw-fs-xs);
    font-variant-numeric: tabular-nums;
  }
  table.tt td {
    padding: 12px;
    border-block-end: 1px solid var(--dv-border);
    vertical-align: middle;
    color: var(--dv-text);
  }
  table.tt tbody tr:last-child td {
    border-block-end: 0;
  }
  table.tt tbody tr {
    cursor: pointer;
    outline: none;
  }
  table.tt tbody tr:hover td {
    background: var(--dv-surface-2);
  }
  table.tt tbody tr[aria-selected='true'] td {
    background: var(--dv-accent-soft);
  }
  table.tt tbody tr:focus-visible td {
    box-shadow: inset 0 2px 0 var(--dv-focus), inset 0 -2px 0 var(--dv-focus);
  }
  table.tt tbody tr[data-picked] td:first-child {
    box-shadow: inset -3px 0 0 var(--dv-accent);
  }
  :host([data-density='compact']) table.tt td {
    padding-block: 5px;
  }
  :host([data-density='compact']) table.tt .sub {
    display: none;
  }
  th.ck,
  td.ck {
    inline-size: 44px;
    padding-inline: 8px;
  }
  .ckb {
    display: inline-grid;
    place-items: center;
    inline-size: 36px;
    block-size: 36px;
    cursor: pointer;
  }
  .ckb input {
    inline-size: 18px;
    block-size: 18px;
    margin: 0;
    accent-color: var(--dv-accent);
    cursor: pointer;
  }
  .cv {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-inline-size: 240px;
  }
  td.c-title .cv {
    font-weight: 600;
    max-inline-size: 320px;
  }
  td .sub {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-inline-size: 320px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
    margin-block-start: 2px;
  }
  /* TKUI4: the sentence column - what is happening, in the drawer's words; two lines at most */
  th.c-sentence,
  td.c-sentence {
    min-inline-size: 240px;
  }
  td.c-sentence .cv {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    max-inline-size: 360px;
    color: var(--dv-text);
  }
  :host([data-density='compact']) td.c-sentence .cv {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
  td .chip .subst {
    font-weight: 600;
    opacity: 0.85;
  }
  td.c-number {
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  td.c-created,
  td.c-activity,
  td.c-sla {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  td .bad {
    color: var(--dv-danger);
    font-weight: 600;
  }
  td .warn {
    color: var(--au-warn-text);
    font-weight: 600;
  }
  /* 2.5.5: the status / handler menu is a top-layer popover rendered outside the scroll box (tickets/overlay-menu.ts places it: below or
     above the trigger, its own scroll only when taller than the room) - never a child of the cell, so no ancestor can clip it */
  .pop.ov {
    position: fixed;
    inset: auto;
    margin: 0;
    z-index: 30;
    min-inline-size: 190px;
    max-inline-size: calc(100vw - 16px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--sw-menu-surface);
    border-color: var(--sw-menu-border);
  }
  button.cbtn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-inline-size: 100%;
    min-block-size: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button.cbtn .ic.chev {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
  }
  button.cbtn .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-inline-size: 180px;
  }
  .who.none {
    color: var(--dv-text-3);
  }
  .more {
    display: flex;
    justify-content: center;
    padding: 10px;
  }

  /* the bulk bar (replaces the toolbar while rows are selected) */
  .bulk {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--sw-r-2xl);
    /* TKUI4: the bar floats over the rows (sticky at the bottom of the screen), so its fill is opaque under the accent tint */
    background: linear-gradient(var(--dv-accent-soft), var(--dv-accent-soft)), var(--dv-surface-solid);
    border: 1px solid color-mix(in srgb, var(--dv-accent) 35%, transparent);
    box-shadow: var(--dv-shadow-2);
  }
  .bulk .sel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    color: var(--dv-accent-text);
    white-space: nowrap;
  }

  /* the phone: a compact list (number, title, status chip, age); no selection */
  .cl {
    display: flex;
    flex-direction: column;
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-2xl);
    box-shadow: var(--dv-shadow-1);
    overflow: hidden;
  }
  .cl a.ci {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 't s' 'x x' 'm a';
    align-items: center;
    gap: 4px 10px;
    min-block-size: 56px;
    padding: 10px 14px;
    border-block-end: 1px solid var(--dv-border);
    color: inherit;
    text-decoration: none;
  }
  .cl a.ci:last-child {
    border-block-end: 0;
  }
  .cl .ci-t {
    grid-area: t;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: var(--sw-fs-md);
  }
  .cl .ci-m {
    grid-area: m;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .cl .ci-x {
    grid-area: x;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--sw-fs-base);
    line-height: 1.45;
    color: var(--dv-text);
  }
  :host([data-density='compact']) .cl .ci-x {
    display: none;
  }
  .cl .ci-s {
    grid-area: s;
    justify-self: end;
  }
  .cl .ci-a {
    grid-area: a;
    justify-self: end;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  :host([data-density='compact']) .cl a.ci {
    min-block-size: 48px;
    padding-block: 6px;
  }

  /* skeleton rows */
  .sk td {
    padding-block: 14px;
  }
  .sk .skl {
    block-size: 12px;
  }
  .toast {
    margin-block-end: 12px;
  }

  @media (max-width: 767px) {
    .tbar {
      position: relative;
    }
    .tbar .count {
      flex-basis: 100%;
    }
    /* a phone: a popover spans the toolbar (never past the screen's edge) */
    .anchor {
      position: static;
    }
    .anchor > .pop,
    .anchor.end > .pop {
      inset-inline: 0;
      min-inline-size: 0;
    }
  }
  @media (pointer: coarse) {
    table.tt th button.sh,
    button.cbtn {
      min-block-size: 44px;
    }
  }

  /* Bubble: flat, larger radius, no blur (component-level, the skin sheet is at its budget) */
  :host([data-skin='bubble']) .tw,
  :host([data-skin='bubble']) .cl {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: var(--dv-surface-solid);
    border-radius: var(--sw-r-xl);
  }
  :host([data-skin='bubble']) .bulk {
    border-radius: var(--sw-r-xl);
  }
`;
