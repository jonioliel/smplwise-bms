import { css } from 'lit';

/**
 * TKUI6 (release 2.6.0): the cards of the "מטפלים וספקים" page, in the language of the automations / multimedia / schedules pages
 * (mock-up v5 `handlers.js`): section heads with a count chip, the card grid, the handler / vendor card (a tile, the name and role,
 * three counts, the department chips, the channel selector), the contact rows. It stands on the glass layer (`automationsStyles`:
 * `.glass`, `.chip`, `.btn`, `.tog`, `.seg`) - every component that uses it puts `automationsStyles` first and calls
 * `applyAutomationsGlass(this)`. Tokens only (`--dv-*` knobs, `--sw-*` scale).
 */
export const handlersGlass = css`
  .sh {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding-inline: 4px;
    margin-block-start: 6px;
  }
  .sh h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-2xl);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .sh h2 .n {
    display: inline-grid;
    place-items: center;
    min-inline-size: 24px;
    block-size: 24px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .sh small {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .sh .grow {
    flex: 1;
  }
  .cgrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 350px), 1fr));
    gap: var(--dv-gap-lg, 16px);
    align-items: stretch;
  }
  .hcard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 18px 14px;
    min-inline-size: 0;
    border-radius: var(--sw-r-2xl);
    transition: box-shadow var(--mm-motion), transform var(--mm-motion);
  }
  .hcard:hover {
    box-shadow: var(--dv-shadow-2);
  }
  .hcard.off {
    opacity: 0.72;
  }
  .hcard header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hcard header .t {
    flex: 1;
    min-inline-size: 0;
  }
  .hcard h3 {
    margin: 0;
    font-size: var(--sw-fs-xl);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hcard .role {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 6px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .hcard .role .chip {
    block-size: 22px;
    padding-inline: 8px;
    font-size: var(--sw-fs-xs);
  }
  .hperiod {
    display: flex;
    flex: none;
  }
  .hperiod select {
    block-size: 38px;
    padding-inline: 12px;
    max-inline-size: 100%;
    min-inline-size: 0;
    border-radius: var(--dv-radius-control);
    background: var(--mm-sheen), var(--dv-surface);
    border: 1px solid var(--dv-border);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
  }
  .hperiod select:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  @media (max-width: 767px) {
    .dh-det .hperiod {
      order: 2;
      flex: 1 1 100%;
    }
    .dh-det .hperiod select {
      inline-size: 100%;
    }
    .hcard .stats {
      gap: 6px 14px;
    }
  }
  .hcard .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .hcard .stats b {
    display: block;
    font-size: var(--sw-fs-3xl);
    font-weight: 800;
    color: var(--dv-text);
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .hcard .stats b.warn {
    color: var(--au-warn-text);
  }
  .hcard .stats small[data-stat-period] {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3, var(--dv-text-2));
  }
  .hcard .stats b.bad {
    color: var(--dv-danger);
  }
  .hcard footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: auto;
  }
  .hcard footer .push {
    margin-inline-start: auto;
  }
  .hcard .main {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-inline-size: 0;
    cursor: pointer;
    border-radius: var(--sw-r-lg);
  }
  .hcard .main:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 3px;
  }
  .tile {
    flex: none;
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--sw-r-lg);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--sw-fs-lg);
    background: color-mix(in srgb, var(--sw-purple) 16%, transparent);
    color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text));
  }
  .tile.int {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .tile.grp {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .tile .ic {
    font-size: var(--sw-fs-2xl);
  }
  .chip.wa {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .chip.pur {
    background: color-mix(in srgb, var(--sw-purple) 16%, transparent);
    color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text));
  }
  .chip.xs {
    block-size: 22px;
    padding-inline: 8px;
    font-size: var(--sw-fs-xs);
  }
  /* the preferred channel: three round choices, one on */
  .chsel {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    background: var(--dv-surface-3);
  }
  .chsel button {
    position: relative;
    border: 0;
    background: transparent;
    inline-size: 32px;
    block-size: 28px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: var(--dv-text-3);
    cursor: pointer;
  }
  .chsel button::before {
    content: '';
    position: absolute;
    inset: -8px -2px;
  }
  .chsel button:disabled {
    cursor: default;
  }
  .chsel button[aria-checked='true'] {
    background: var(--mm-seg-thumb);
    color: var(--dv-accent-text);
    box-shadow: var(--dv-shadow-control);
  }
  .chsel button:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  .chsel .ic {
    font-size: var(--sw-fs-lg);
  }
  .manage {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-block-start: 10px;
    border-block-start: 1px solid var(--dv-border);
  }
  .manage .line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .manage .line .lbl {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 5em;
  }
  .manage .rm {
    margin-inline-start: auto;
    border: 0;
    background: transparent;
    color: var(--dv-danger);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    min-block-size: 36px;
    padding-inline: 8px;
    cursor: pointer;
  }
  .crows {
    padding: 0;
    overflow: hidden;
    border-radius: var(--sw-r-2xl);
  }
  .crow {
    display: grid;
    grid-template-columns: auto minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 6px 16px;
    min-block-size: 56px;
    border: 0;
    border-block-end: 1px solid var(--dv-border);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--sw-fs-md);
    text-align: start;
    inline-size: 100%;
    cursor: pointer;
  }
  .crow:last-child {
    border-block-end: 0;
  }
  .crow:hover {
    background: var(--dv-surface-2);
  }
  .crow:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: -2px;
  }
  .crow[aria-current='true'] {
    background: var(--dv-accent-soft);
  }
  .crow b {
    display: block;
    font-weight: 700;
  }
  .crow small {
    display: block;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
  }
  .crow .av {
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--sw-fs-sm);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .crow .chs {
    display: inline-flex;
    gap: 4px;
  }
  .crow .chs span {
    inline-size: 28px;
    block-size: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .crow .chs span.on {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .crow .chs .ic {
    font-size: var(--sw-fs-base);
  }
  .crow .mut,
  .mut {
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    text-align: start;
  }
  /* the add panel and the editor form share the glass fields */
  .addp {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    border-radius: var(--sw-r-2xl);
  }
  .addp .inp {
    min-block-size: 44px;
    inline-size: auto;
    min-inline-size: 0;
    flex: 1 1 160px;
  }
  .msg {
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    font-size: var(--sw-fs-sm);
  }
  .msg.ok {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .msg.err {
    background: var(--dv-danger-soft);
    color: var(--dv-danger);
  }
  @media (max-width: 767px) {
    .crow {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .crow .hide-p {
      display: none;
    }
    .cgrid {
      grid-template-columns: minmax(0, 1fr);
    }
    .sh h2 {
      font-size: var(--sw-fs-xl);
    }
  }
`;
