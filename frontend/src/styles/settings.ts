import { css } from 'lit';

/**
 * SET-polish (2026-10-10): the ONE stylesheet of the settings screens (הגדרות › *). Every `system-*` screen used to carry its
 * own copy of the label / control row, the muted hint, the "saved" / error line and the save footer, each a little different
 * (9 px vs 10 px rows, 220 px vs 280 px controls, a sticky bar on one page and an inline "שמור" on the next). This module is
 * what they all adopt; a designer who re-tunes the settings forms edits this file, no screen. Tokens only (--sw-*).
 *
 * Vocabulary (the class names are the ones the screens and their specs already use, so nothing is renamed):
 *   .sections            the column of cards of one settings tab
 *   .grouplabel          a small eyebrow between card groups ("מערכת ה־NVR")
 *   .row                 label (+ hint) at the start, the control at the end; stacks on a phone
 *   .row .lbl / .muted   the label and its hint
 *   .row .ctl            the control column (a fixed width on a wide screen, the full width on a phone)
 *   .check / .val        a fact row: name at the start, value at the end, with .ok / .warn / .err tones
 *   .hint                a line of explanation under a control or a card
 *   .msg                 an inline status line with an icon (.ok / .err / .warn), role=status or alert
 *   .foot                a card's footer: the primary action first, the status next to it, then the rest
 *   .savebar             the sticky save bar of a page with a draft (unsaved changes / saved / error)
 *   .danger              a card section with destructive actions (a soft red frame)
 *   .actions             a row of buttons
 *   .two                 a two-column card grid (one column on a phone)
 *   .seg                 a small segmented control
 *   input[aria-invalid]  a control whose value the screen rejected (+ .field-error under it)
 */
/** POLISH2-295: the settings pages' segmented control on its own, so a component outside settingsStyles (sw-list-display-settings) shares
 * it instead of keeping its own look; selected = the accent with the inverse label (AA in both schemes), unselected = text-2 on the track. */
export const settingsSegStyles = css`
  .seg {
    display: inline-flex;
    /* VISDIFF-246: the track never gives up width to its row: overflow hidden lets a flex item shrink below its buttons, which
       clipped the last segment ("30 דק׳") of the schedules defaults in the page's 300 px side column at tablet widths */
    flex: none;
    max-inline-size: 100%;
    border: 1px solid var(--sw-seg-border, var(--sw-border-strong));
    border-radius: var(--sw-seg-radius, var(--sw-r-sm));
    overflow: hidden;
    background: var(--sw-seg-track, var(--sw-surface));
    padding: var(--sw-seg-pad, 0);
    gap: var(--sw-seg-gap, 0);
  }
  /* the knobs --sw-seg-* belong to a glass host (TKUI6: the service-management settings): a pill track with a lifted thumb */
  .seg button {
    border: 0;
    border-radius: var(--sw-seg-btn-radius, 0);
    background: transparent;
    padding: 0 14px;
    min-block-size: var(--sw-seg-h, var(--sw-ctl-h-md));
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    color: var(--sw-text-2);
  }
  .seg button + button {
    border-inline-start: var(--sw-seg-divider, 1px solid var(--sw-border));
  }
  .seg button:hover {
    background: var(--sw-hover-wash);
    color: var(--sw-text);
  }
  .seg button[aria-pressed='true'],
  .seg button[aria-selected='true'] {
    background: var(--sw-seg-on-bg, var(--sw-accent));
    color: var(--sw-seg-on-fg, var(--sw-text-inverse));
    box-shadow: var(--sw-seg-on-shadow, none);
  }
  .seg button:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
`;

export const settingsStyles = css`
  :host {
    display: block;
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    max-inline-size: 880px;
    min-inline-size: 0;
  }
  .grouplabel {
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-3);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-block: var(--sw-s-1) 2px;
    grid-column: 1 / -1;
  }
  .grouplabel:not(:first-child) {
    margin-block-start: var(--sw-s-3);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sw-s-3) var(--sw-s-4);
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
    min-inline-size: 0;
  }
  .row:last-child {
    border-block-end: 0;
  }
  .row.stack {
    flex-direction: column;
    align-items: stretch;
  }
  .row .lbl {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
    flex: 1 1 220px;
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text);
  }
  .row .lbl .muted,
  .muted {
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-regular);
    color: var(--sw-text-3);
    line-height: 1.45;
  }
  .row .ctl {
    inline-size: 240px;
    flex: none;
    min-inline-size: 0;
  }
  .row .ctl.wide {
    inline-size: 320px;
  }
  .row .end {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    flex-wrap: wrap;
    justify-content: flex-end;
    min-inline-size: 0;
  }
  .check {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sw-s-2);
    padding: 8px 0;
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
  }
  .check:last-child {
    border-block-end: 0;
  }
  .val {
    color: var(--sw-text-2);
    text-align: end;
    max-inline-size: 60%;
    overflow-wrap: anywhere;
  }
  .val.ok {
    color: var(--sw-success-text);
  }
  .val.warn {
    color: var(--sw-warning-text);
  }
  .val.err {
    color: var(--sw-danger-text);
    font-weight: var(--sw-fw-semibold);
  }
  .hint {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    line-height: 1.5;
  }
  .ltr,
  code {
    direction: ltr;
    unicode-bidi: isolate;
  }
  code {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
    background: var(--sw-surface-2);
    padding: 2px 6px;
    border-radius: var(--sw-r-2xs);
  }
  .msg {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: var(--sw-ctl-h-sm);
    padding: 2px 10px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .msg.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .msg.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .msg.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .msg sw-icon {
    flex: none;
  }
  /* the old plain-text lines: kept as classes so nothing breaks, now with the same tones */
  .ok {
    color: var(--sw-success-text);
    font-size: var(--sw-fs-xs);
  }
  .err {
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-xs);
  }
  .foot {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    padding-block-start: var(--sw-s-3);
    margin-block-start: var(--sw-s-1);
    border-block-start: 1px solid var(--sw-border);
  }
  .foot .grow {
    flex: 1;
  }
  .savebar {
    position: sticky;
    inset-block-end: var(--sw-s-3);
    z-index: 3;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2) var(--sw-s-3);
    padding: 10px 14px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface-solid);
    box-shadow: var(--sw-shadow-3);
    max-inline-size: 880px;
  }
  .savebar .grow {
    flex: 1;
  }
  .savebar .dirty {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .danger {
    margin-block-start: var(--sw-s-3);
    padding: var(--sw-s-3);
    border: 1px solid color-mix(in srgb, var(--sw-danger) 35%, transparent);
    border-radius: var(--sw-r-md);
    background: color-mix(in srgb, var(--sw-danger-soft) 55%, transparent);
  }
  .danger h4 {
    margin: 0 0 4px;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-danger-text);
  }
  .actions {
    display: flex;
    gap: var(--sw-s-2);
    flex-wrap: wrap;
    align-items: center;
    margin-block-start: var(--sw-s-2);
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sw-s-3);
    align-items: start;
  }
  ${settingsSegStyles}
  /* a value the control itself rejects (min / max / pattern / required) after the user touched it, or one the screen marked */
  input[aria-invalid='true'],
  select[aria-invalid='true'],
  textarea[aria-invalid='true'],
  input:user-invalid,
  select:user-invalid,
  textarea:user-invalid {
    border-color: var(--sw-danger) !important;
    box-shadow: 0 0 0 3px var(--sw-danger-soft) !important;
  }
  .field-error {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-block-start: 4px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-danger-text);
  }
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  @media (max-width: 767px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: var(--sw-s-2);
    }
    .row .lbl {
      flex-basis: auto;
    }
    .row .ctl,
    .row .ctl.wide {
      inline-size: auto;
    }
    .row .end {
      justify-content: flex-start;
    }
    .two {
      grid-template-columns: 1fr;
    }
    .savebar {
      inset-block-end: var(--sw-s-2);
      padding: 8px 10px;
    }
    .foot sw-button[variant='primary'] {
      flex: 1 1 100%;
    }
  }
`;
