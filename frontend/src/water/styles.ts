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
  .usage-chart {
    max-inline-size: 560px;
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
