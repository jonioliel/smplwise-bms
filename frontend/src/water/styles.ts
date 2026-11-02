/**
 * CR-WATER78: the water pages use the electricity sheet as it is (electricity/styles.ts, `elecCss`); this adds only the few rules of the
 * approved mockup v4 that the electricity pages do not carry (docs/design/mockups/water-78/index.html, its "water additions"): the meter
 * card's facts list and chart (as electricity/meter-card.ts), the share bar, the up / down change colours, the split snooze button and its
 * menu, the settings' chips editor and form grid, the side column. Control screens never scroll at 1440 x 900 (owner rule 24.10): the
 * chart height and the row padding are the mockup's tightened values.
 */
import { css } from 'lit';
import { elecCss } from '../electricity/styles';

export const waterExtraCss = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .head .inp {
    flex: 0 1 280px;
  }
  dl.kv {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 14px;
    margin: 0;
    font-size: var(--sw-fs-sm);
  }
  dl.kv dt {
    color: var(--sw-text-3);
  }
  dl.kv dd {
    margin: 0;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  h3.sec {
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
  }
  svg.chart {
    inline-size: 100%;
    block-size: auto;
    max-block-size: 170px;
    display: block;
  }
  svg.chart .grid {
    stroke: var(--sw-border-strong);
  }
  svg.chart .bar {
    fill: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
  }
  svg.chart .bar.hi {
    fill: var(--sw-accent);
  }
  svg.chart .bar.night {
    fill: color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3));
  }
  svg.chart .bar.leak {
    fill: var(--sw-danger);
  }
  svg.chart .win {
    fill: color-mix(in srgb, var(--sw-heading, var(--sw-text)) 7%, transparent);
  }
  svg.chart text {
    fill: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  svg.chart text.val {
    fill: var(--sw-text-2);
  }
  /* WKWATER-POLISH-2331: the chart is drawn at the card's own width (page-usage.ts measures it), so it fills the card instead of a
     560 px island beside an empty half */
  .usage-chart {
    min-inline-size: 0;
  }
  .legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .legend i {
    display: inline-block;
    inline-size: 10px;
    block-size: 10px;
    border-radius: 2px;
    margin-inline-end: 4px;
    vertical-align: -1px;
  }
  .share {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .share i {
    display: inline-block;
    inline-size: 56px;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-3);
    overflow: hidden;
  }
  .share i b {
    display: block;
    block-size: 100%;
    background: var(--sw-accent);
  }
  .up {
    color: var(--sw-danger-text);
  }
  .down {
    color: var(--sw-success-text);
  }
  .bad {
    color: var(--sw-danger-text);
    font-weight: var(--sw-fw-semibold);
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
  }
  .li .acts {
    flex: none;
  }
  table.t td {
    padding-block: 9px;
  }
  .backrow {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cols.side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 14px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .cols.side .card {
    padding: 12px 14px;
  }
  .cols.side .kv {
    gap: 3px 14px;
  }
  .formgrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .formgrid .wide {
    grid-column: 1 / -1;
  }
  .chips-ed {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .chips-ed .chip {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .chips-ed .chip::before {
    display: none;
  }
  .chips-ed .chip button {
    all: unset;
    cursor: pointer;
    display: inline-grid;
    place-items: center;
    inline-size: 18px;
    block-size: 18px;
    border-radius: 50%;
  }
  .chips-ed .chip button:hover,
  .chips-ed .chip button:focus-visible {
    background: var(--sw-surface-3);
  }
  .sect-nav {
    align-self: flex-start;
  }
  /* WKWATER-POLISH-2331: the page rules that were inline styles - a tile whose figure is an alarm, the end column of a phone row (the
     chip over the reading), its amount line, the skeleton rows, the bill log rows */
  /* a time window (01:00-05:00) is one LTR unit: it never breaks at its dash, never reads backwards in RTL */
  .tile .v .nw {
    white-space: nowrap;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .tile .v.alarm {
    color: var(--sw-danger-text);
  }
  .rowend {
    flex: none;
    text-align: end;
  }
  .rowend .t2 {
    margin-block-start: var(--sw-s-1);
  }
  .li .amt {
    flex: none;
    text-align: end;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading, var(--sw-text));
  }
  .skrow {
    padding-block: 10px;
  }
  .li.pick:focus-visible,
  table.t tr.pick:focus-visible td,
  table.t tr.go:focus-visible td {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: calc(var(--sw-focus-w) * -1);
  }
  /* NOSCROLL-297 on the usage and alerts pages (infra-water.ts gives them the height under the tab rows): the list's card shrinks to the
     room left and scrolls inside, its header row in place; it never grows past its rows */
  @media (min-width: 900px) {
    .page.fit {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    .page.fit > .fitbox {
      flex: 0 1 auto;
      min-block-size: 160px;
      overflow: auto;
      scrollbar-width: thin;
    }
    .page.fit > .fitbox table.t thead th {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
    }
  }
  /* a sheet's form keeps its save / cancel row in view: the row sticks to the foot of the scrolling sheet body */
  .formacts {
    position: sticky;
    inset-block-end: 0;
    z-index: 2;
    margin-block-end: calc(var(--sw-s-3) * -1);
    padding-block: var(--sw-s-3);
    background: var(--sw-surface-solid, var(--sw-surface));
    box-shadow: 0 -1px 0 var(--sw-border);
  }
  /* the bills page's state filter: on a narrow window the segments scroll sideways inside their own row, the search takes the next line */
  @media (max-width: 1099px) {
    .seg.scroll-seg {
      max-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
  .phone-only {
    display: none;
  }
  .notice {
    font-size: var(--sw-fs-sm);
    color: var(--sw-success-text, var(--sw-live-text));
  }
  .paper {
    background: var(--sw-surface-solid, var(--sw-surface));
    color: var(--sw-text);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .paper table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sw-fs-sm);
  }
  .paper th,
  .paper td {
    padding: 6px 8px;
    border-block-end: 1px solid var(--sw-border);
    text-align: start;
  }
  .paper th.n,
  .paper td.n {
    text-align: end;
  }
  .paper tfoot td {
    font-weight: var(--sw-fw-semibold);
    border-block-end: 0;
  }
  .paper .tot td {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading, var(--sw-text));
  }
  @media (max-width: 899px) {
    .cols.side {
      grid-template-columns: minmax(0, 1fr);
    }
    .phone-only {
      display: flex;
    }
    .desk-only {
      display: none;
    }
  }
  @media (max-width: 767px) {
    .formgrid {
      grid-template-columns: minmax(0, 1fr);
    }
    .li {
      flex-wrap: wrap;
    }
    .li .acts {
      flex-basis: 100%;
      justify-content: flex-start;
    }
  }
  @media (max-width: 1099px) {
    .dsk {
      display: none;
    }
  }
`;

/** The water pages' sheet: the electricity sheet + the mockup's additions. */
export const waterCss = [elecCss, waterExtraCss];
