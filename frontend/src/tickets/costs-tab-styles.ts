import { css } from 'lit';

/**
 * TKUI3 (release 2.6.0): the look of the request's Costs tab (mock-up v5 `.steps`, `.cstage`, `.allow`) on top of the tickets glass
 * layers and the cost card's sheet (tickets/cost-styles.ts). Tokens only (`--dv-*` palette, `--sw-*` type / radius scale - the token
 * lint reads this folder), logical properties only (RTL by default; amounts are isolated). Phone: 44 px targets, the actions wrap and the
 * primary spans the width.
 */
export const costsTabStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  .ct {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-inline-size: 0;
  }
  .cthead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps .st {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    color: var(--dv-text-3);
    white-space: nowrap;
  }
  .steps .st i {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--dv-border-strong);
  }
  .steps .st::after {
    content: '';
    inline-size: 12px;
    block-size: 1px;
    margin-inline: 5px;
    background: var(--dv-border-strong);
  }
  .steps .st:last-child::after {
    display: none;
  }
  .steps .st.done {
    color: var(--au-ok-text);
  }
  .steps .st.done i {
    background: var(--dv-success);
  }
  .steps .st.cur {
    color: var(--dv-accent-text);
  }
  .steps .st.cur i {
    background: var(--dv-accent);
    box-shadow: 0 0 0 3px var(--dv-accent-soft);
  }
  .cstage {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    min-inline-size: 0;
  }
  .cstage.ok {
    border-color: color-mix(in srgb, var(--dv-success) 40%, transparent);
  }
  .cstage.dim {
    opacity: 0.65;
  }
  .csh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-inline-size: 0;
  }
  .csh .sp {
    flex: 1;
  }
  .csh .ic,
  .baseline .ic {
    display: inline-grid;
    place-items: center;
    color: var(--dv-accent-text);
  }
  .csh .ic svg,
  .baseline .ic svg {
    inline-size: 16px;
    block-size: 16px;
  }
  .qlines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ql {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    min-block-size: 28px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .ql.off {
    color: var(--dv-text-3);
    text-decoration: line-through;
  }
  .ql .qd,
  .ql .pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .ql .pick {
    min-block-size: 44px;
    cursor: pointer;
  }
  .ql .pick input {
    inline-size: 20px;
    block-size: 20px;
    accent-color: var(--dv-accent);
  }
  .mk {
    display: inline-grid;
    place-items: center;
  }
  .mk svg {
    inline-size: 14px;
    block-size: 14px;
  }
  .mk.approved {
    color: var(--au-ok-text);
  }
  .mk.not {
    color: var(--dv-text-3);
  }
  .num {
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    white-space: nowrap;
  }
  .qtot {
    padding-block-start: 6px;
    border-block-start: 1px solid var(--dv-border);
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .qnote,
  .why {
    margin: 0;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    overflow-wrap: anywhere;
  }
  .why {
    color: var(--au-warn-text);
  }
  .muted {
    color: var(--dv-text-3);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-block-start: 2px;
  }
  .acts .hint {
    inline-size: 100%;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .acts .more {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .baseline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-success-soft, var(--dv-surface-3));
    font-size: var(--sw-fs-sm);
  }
  .baseline b {
    margin-inline-end: 6px;
  }
  .fold {
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
  }
  .fold > summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-block-size: 44px;
    padding-inline: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .fold > summary:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: -2px;
    border-radius: var(--sw-r-lg);
  }
  /* TKLAYFIX: a closed <details> keeps laying its body out (content-visibility hides it but the boxes still extend below the fold, outside the panel); it takes no space until opened. */
  .fold:not([open]) > .foldbody {
    display: none;
  }
  .foldbody {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 14px 14px;
  }
  .chipsrow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .rc {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-block-size: 36px;
    padding-inline: 12px;
    border-radius: 999px;
    border: 1px solid var(--dv-border-strong);
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .rc svg {
    inline-size: 14px;
    block-size: 14px;
  }
  .rc.on {
    border-color: var(--dv-accent);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .rc:disabled {
    cursor: default;
    opacity: 0.8;
  }
  .rc:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 2px;
  }
  .reqrow {
    flex-wrap: wrap;
  }
  .reqpair {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .draft {
    min-block-size: 120px;
    resize: vertical;
  }
  .slot-note {
    margin: 0;
    color: var(--dv-text-2);
  }
  @media (max-width: 767px) {
    .acts .btn,
    .rc,
    .seg button {
      min-block-size: 44px;
    }
    .acts .btn.primary {
      flex: 1 1 100%;
      justify-content: center;
    }
  }
`;
