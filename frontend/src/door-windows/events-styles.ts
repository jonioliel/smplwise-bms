import { css } from 'lit';

/**
 * DOORWIN3-295: the shared form look of the three new door-windows parts (event rules, holidays, open for hours). Tokens only, logical
 * properties only (RTL and LTR); numbers, times and codes stay left-to-right text. 44px touch targets on a phone (coarse pointer, narrow) only.
 */
export const dweCss = css`
  :host { display: block; }
  section { display: grid; gap: 10px; }
  p { overflow-wrap: anywhere; }
  h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: 700; color: var(--sw-text); }
  .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  .card { display: grid; gap: 10px; padding: 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); min-inline-size: 0; }
  .card .top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  .card .top b { font-size: var(--sw-fs-md); overflow-wrap: anywhere; }
  .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .form { display: grid; gap: 14px; }
  .field { display: grid; gap: 6px; }
  .field > label, .field > .lbl { font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); }
  .row2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(9em, 1fr)); gap: 10px; }
  input[type='text'], input[type='date'], input[type='time'], select {
    font: inherit; padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text);
    min-inline-size: 0; inline-size: 100%; box-sizing: border-box;
  }
  input[inputmode='numeric'], input.code, input[type='time'], input[type='date'] { direction: ltr; text-align: start; }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button {
    font: inherit; padding: 6px 12px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); cursor: pointer;
  }
  .seg button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
  .doors { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; max-block-size: 260px; overflow: auto; padding: 4px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
  .doors label, label.chk { display: flex; gap: 8px; align-items: center; padding: 4px 6px; border-radius: var(--sw-r-sm); }
  .doors label, .doors .st, label.chk { min-inline-size: 0; overflow-wrap: anywhere; }
  .doors .st { font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding: 6px 6px 0; }
  .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
  .footer { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  pre.snippet {
    margin: 0; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-text); direction: ltr; text-align: start;
    font-family: var(--sw-font-mono, ui-monospace, monospace); font-size: var(--sw-fs-sm); white-space: pre-wrap; overflow-wrap: anywhere; user-select: all;
  }
  .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  @media (max-width: 767px) and (pointer: coarse) {
    .seg button, input[type='text'], input[type='date'], input[type='time'], select { min-block-size: 44px; }
    .doors label, label.chk { min-block-size: 44px; }
    input[type='checkbox'], input[type='radio'] { inline-size: 22px; block-size: 22px; }
  }
`;
