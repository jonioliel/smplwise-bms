import { css } from 'lit';

/**
 * R5-INVESTIGATE-297: the shared screen-level layer of the investigation screens (events, playback, sync, history map, reviews, cases,
 * exports, search, rules, live incidents, the event page, the sensor events list). The HOMEFABLE pattern inside the frozen structure:
 * three surface steps (hero table or card / card / well), status as a filled field, display numerals, a press on pointer-down and a
 * hover only under a fine pointer. Appended to each screen's own styles; nothing here reaches another group's screen.
 */
export const INVESTIGATE_R5 = css`
  /* the page's primary object: the list or the main card sits a step above the page (radius lg, shadow 2, a light line on top) */
  sw-table,
  sw-card:not([flush]):not([row]),
  .r5-hero {
    --sw-card-radius: var(--sw-r-lg);
    --sw-card-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    --sw-card-title-fs: var(--sw-fs-xl);
    --sw-card-title-fw: 800;
    border-radius: var(--sw-r-lg);
  }
  sw-table {
    --sw-table-cell-pad: 12px 16px;
    --sw-table-fs: var(--sw-fs-base);
    box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
  }
  /* a well: a row inside a card (tone step down, rounded, no hairline) */
  .r5-well {
    background: var(--sw-surface-2);
    border: 0;
    border-radius: var(--sw-r-sm);
    padding: 10px 12px;
    min-block-size: 44px;
    transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .r5-well[data-tone='bad'] {
    background: var(--sw-danger-soft);
  }
  .r5-well[data-tone='warn'] {
    background: var(--sw-warning-soft);
  }
  .r5-well[data-tone='ok'] {
    background: var(--sw-success-soft);
  }
  .r5-well[data-tone='on'] {
    background: var(--sw-lit-soft);
  }
  @media (hover: hover) and (pointer: fine) {
    .r5-well.r5-press:hover {
      background: var(--sw-surface-3);
    }
  }
  .r5-press:active {
    transform: scale(var(--sw-press-scale));
  }
  /* the reading sizes: a row title, its detail, a display numeral */
  .r5-title {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
    line-height: 1.25;
  }
  .r5-sub {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
    line-height: 1.3;
  }
  .r5-num {
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    color: var(--sw-heading);
  }
  .r5-num.sm {
    font-size: var(--sw-fs-xl);
  }
  /* a key: a raised control (tone step up + shadow 1) that sinks on pointer-down */
  .r5-key {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
  }
  .r5-key:active {
    transform: scale(var(--sw-press-scale));
  }
  /* a facts list (dt / dd) as wells: the value reads first, the label is the caption */
  dl.r5-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  dl.r5-facts > div {
    background: var(--sw-surface-2);
    border-radius: var(--sw-r-sm);
    padding: 8px 12px;
    min-inline-size: 0;
  }
  dl.r5-facts > div.wide {
    grid-column: 1 / -1;
  }
  dl.r5-facts dt {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    margin: 0 0 2px;
  }
  dl.r5-facts dd {
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading);
    overflow-wrap: anywhere;
  }
  dl.r5-facts dd .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
`;
