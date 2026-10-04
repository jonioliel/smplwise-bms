import { css } from 'lit';

/**
 * Shared look of the electricity screens (both UI halves reuse it so they match): status chips, tiles, list rows, the table, the search field,
 * a segmented control, form fields and the empty / error frame. Tokens only; the skins (classic, domus, tesla, bubble) come from the tokens, the
 * bubble skin's flat layers from bubbleChrome (include it next to this in a screen). Interactive elements meet the touch dial (44 px).
 */
export const electricityCss = css`
  :host {
    --elec-touch: var(--sw-touch-desktop, 44px);
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
  }
  .mut {
    color: var(--sw-text-3);
  }
  .sp {
    flex: 1;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-inline-size: 0;
  }
  /* status chips: shape + text, never colour alone */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 1px 9px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    line-height: 18px;
    white-space: nowrap;
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
  }
  .chip::before {
    content: '';
    inline-size: 6px;
    block-size: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .chip.nodot::before {
    display: none;
  }
  .chip.ok {
    background: var(--sw-success-soft, var(--sw-live-soft));
    color: var(--sw-success-text, var(--sw-live-text));
  }
  .chip.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .chip.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .chip.acc {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  /* tiles */
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .tile {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-1);
    padding: 12px 14px;
    min-inline-size: 0;
  }
  .tile .k {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .tile .v {
    font-size: var(--sw-fs-2xl);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading, var(--sw-text));
    line-height: 1.2;
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tile .v .u {
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-regular);
    color: var(--sw-text-3);
  }
  .card {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-1);
    padding: 14px;
    min-inline-size: 0;
  }
  .card.flush {
    padding: 0;
    overflow: hidden;
  }
  .scrollx {
    overflow-x: auto;
  }
  /* table */
  table.t {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sw-fs-sm);
  }
  table.t th {
    text-align: start;
    font-weight: var(--sw-fw-medium);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    padding: 10px 12px;
    border-block-end: 1px solid var(--sw-border-strong);
    white-space: nowrap;
  }
  table.t td {
    padding: 8px 12px;
    border-block-end: 1px solid var(--sw-border);
    min-block-size: var(--elec-touch);
    vertical-align: middle;
  }
  table.t tr:last-child td {
    border-block-end: 0;
  }
  table.t td.b {
    font-weight: var(--sw-fw-semibold);
  }
  table.t th.n,
  table.t td.n {
    text-align: end;
  }
  table.t tbody tr.pick {
    cursor: pointer;
  }
  table.t tbody tr.pick:hover td,
  table.t tbody tr.sel td {
    background: var(--sw-surface-2);
  }
  table.t tbody tr.pick:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: -2px;
  }
  /* list rows (phone lists, pickers) */
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .li {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    min-block-size: var(--elec-touch);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    min-inline-size: 0;
  }
  .li.pick {
    cursor: pointer;
    inline-size: 100%;
    text-align: start;
    font: inherit;
    color: inherit;
  }
  .li.sel {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
  }
  .li.dis {
    opacity: 0.75;
  }
  .li .grow {
    flex: 1;
    min-inline-size: 0;
  }
  .li .t1 {
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .li .t2 {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .li .t2.wrap {
    white-space: normal;
  }
  /* search + form fields */
  .inp {
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: var(--elec-touch);
    padding: 0 12px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    color: var(--sw-text);
    min-inline-size: 0;
  }
  .inp:focus-within {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .inp.err {
    border-color: var(--sw-danger);
  }
  .inp input,
  .inp select {
    flex: 1;
    min-inline-size: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    min-block-size: var(--elec-touch);
    margin-block: -1px;
  }
  .inp select {
    cursor: pointer;
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-inline-size: 0;
  }
  .fld > label {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    font-weight: var(--sw-fw-medium);
  }
  .fld .msg {
    font-size: var(--sw-fs-xs);
    color: var(--sw-danger-text, var(--sw-danger));
  }
  /* segmented control */
  .seg {
    display: inline-flex;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    overflow: hidden;
    background: var(--sw-surface);
  }
  .seg button {
    min-block-size: var(--elec-touch);
    padding: 0 14px;
    border: 0;
    background: transparent;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font-weight: var(--sw-fw-semibold);
  }
  /* alert strip */
  .alert {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: var(--sw-r-md);
    font-size: var(--sw-fs-sm);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .alert.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .alert .x {
    flex: none;
    inline-size: 20px;
    block-size: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: currentColor;
    font-weight: var(--sw-fw-bold);
  }
  .alert .x > span {
    color: var(--sw-surface-solid, #fff);
    font-size: 12px;
    line-height: 1;
  }
  /* skeleton */
  .sk {
    block-size: 12px;
    border-radius: 6px;
    background: var(--sw-surface-3);
    animation: elec-pulse 1.4s ease-in-out infinite;
  }
  @keyframes elec-pulse {
    50% {
      opacity: 0.5;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sk {
      animation: none;
    }
  }
  @media (max-width: 760px) {
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
