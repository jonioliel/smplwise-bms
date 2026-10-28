import { css } from 'lit';

/**
 * Styles of the native schedules screen (CR-036 slice S9). Only `--sw-*` tokens (unit-token-lint), no skin rules: the skins reach
 * the blocks through `sw-card`, the buttons through `sw-button` / `sw-view-switch`, the colours through the tokens each skin sets.
 * `--sch-hit` is the hit area of a control: the look dial on a desktop, 44 px in touch layouts.
 */
export const schedulesCss = css`
  :host {
    display: block;
    --sch-hit: var(--sw-touch-desktop, 44px);
  }
  @media (max-width: 1100px) {
    :host {
      --sch-hit: 44px;
    }
  }
  .status {
    margin: 0;
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-md);
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
    font-size: var(--sw-fs-sm);
  }
  .layout {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
    margin-block-start: var(--sw-s-3);
  }
  .layout.solo {
    grid-template-columns: minmax(0, 1fr);
  }
  .doorcol {
    position: sticky;
    inset-block-start: var(--sw-s-3);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-4);
    min-inline-size: 0;
  }

  /* ---- the door list (a card on a desktop, a sheet on a phone) ---- */
  nav.doors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sw-s-2);
  }
  .doors .ttl {
    padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-1);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-3);
  }
  .doors .station {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: var(--sw-s-2) var(--sw-s-3) 0;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .dot {
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-live);
  }
  .dot.off {
    background: var(--sw-offline);
  }
  .doors button {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--sch-hit);
    padding-inline: var(--sw-s-3) var(--sw-s-3);
    padding-inline-start: var(--sw-s-5);
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    text-align: start;
    cursor: pointer;
  }
  /* R5-SECURITY: a hover only under a fine pointer; the chosen door is a filled accent field, 700; the row sinks on pointer-down */
  @media (hover: hover) and (pointer: fine) {
    .doors button:hover {
      background: var(--sw-hover-wash);
    }
  }
  .doors button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  .doors button:active {
    transform: scale(var(--sw-press-scale));
  }
  .doors button[aria-current='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font-weight: var(--sw-fw-bold);
  }
  .doors .station {
    color: var(--sw-heading, var(--sw-text));
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
  }
  sw-badge {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 18px;
    padding-block: 2px;
  }
  .doors button .name {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip {
    box-sizing: border-box;
    display: none;
    align-items: center;
    gap: var(--sw-s-2);
    max-inline-size: 100%;
    min-block-size: var(--sch-hit);
    padding-inline: var(--sw-s-4);
    border: 1px solid var(--sw-accent);
    border-radius: var(--sw-r-pill);
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
  }
  .chip .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doors button:focus-visible,
  .chip:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }

  /* ---- the door ---- */
  .doorhead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .doorhead h2 {
    margin: 0;
    min-inline-size: 0;
    /* R5-SECURITY: the door is the heading of the page's main column - 20/800 */
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--sw-heading);
    overflow-wrap: anywhere;
  }
  .doorhead .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .doorhead .sp {
    flex: 1;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    padding: var(--sw-s-4);
    min-inline-size: 0;
  }
  .bh {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .bh h3 {
    margin: 0;
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .bh .n {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .bh .sp {
    flex: 1;
  }
  .prog {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .prog .name {
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
    overflow-wrap: anywhere;
  }
  .row .t {
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
  }
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .dates h4 {
    margin: 0 0 var(--sw-s-1);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  sw-week-grid {
    max-inline-size: 100%;
  }

  /* ---- the library and the proposals ---- */
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sw-s-4);
    margin-block-start: var(--sw-s-4);
  }
  sw-table {
    margin-block-start: var(--sw-s-3);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--sw-s-3);
    padding-block: var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
  }
  .row:first-child {
    border-block-start: 0;
  }
  .row .main {
    flex: 1;
    gap: 2px;
  }
  .row .t {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
    overflow-wrap: anywhere;
  }
  .row .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .row sw-badge {
    flex: none;
  }

  @media (max-width: 1100px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 819px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .doorcol {
      display: none;
    }
    .chip {
      display: inline-flex;
    }
    /* the door chip already names the door on a phone: the title would repeat it */
    .doorhead h2 {
      display: none;
    }
    .block {
      padding: var(--sw-s-3);
    }
  }
`;
