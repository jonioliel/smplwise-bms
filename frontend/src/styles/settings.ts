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
 * it instead of keeping its own look.
 * POLISH4-WP1 (owner Q3a, 02.11): ONE settings key style - the pill-thumb key of the look settings (system-design.ts, system-nav-size.ts):
 * a sunken track (surface-3, 3 px inset, no dividers) and the selected key a lifted thumb (the card surface + shadow 1, the label in the
 * accent ink; in dark the light pill of --sw-seg-key, GATE2370-B: the --sw-seg-thumb lift was under 3:1 from the track). The
 * accent-filled divided keys are gone. The --sw-seg-* knobs of a
 * glass host (TKUI6, system-tickets) still override every part, so those hosts draw as before. */
export const settingsSegStyles = css`
  .seg {
    display: inline-flex;
    /* VISDIFF-246: the track never gives up width to its row: overflow hidden lets a flex item shrink below its buttons, which
       clipped the last segment ("30 דק׳") of the schedules defaults in the page's 300 px side column at tablet widths */
    flex: none;
    max-inline-size: 100%;
    border: 1px solid var(--sw-seg-border, transparent);
    border-radius: var(--sw-seg-radius, var(--sw-r-md));
    overflow: hidden;
    background: var(--sw-seg-track, var(--sw-surface-3));
    padding: var(--sw-seg-pad, 3px);
    gap: var(--sw-seg-gap, 2px);
  }
  /* the knobs --sw-seg-* belong to a glass host (TKUI6: the service-management settings): a pill track with a lifted thumb */
  /* R5-SYSTEM-297: a segment is a KEY - 14/600, 34 px, the hover only under a pointer that hovers (mobile-native) */
  .seg button {
    border: 0;
    border-radius: var(--sw-seg-btn-radius, var(--sw-r-sm));
    background: transparent;
    padding: 0 14px;
    min-block-size: var(--sw-seg-h, 34px);
    font: inherit;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
    color: var(--sw-text-2);
  }
  .seg button + button {
    border-inline-start: var(--sw-seg-divider, 0 solid transparent);
  }
  @media (hover: hover) and (pointer: fine) {
    .seg button:hover {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
    }
  }
  .seg button[aria-pressed='true'],
  .seg button[aria-selected='true'] {
    /* GATE2370-B: in dark the chosen key is the light pill (--sw-seg-key / --sw-seg-key-ink, design/tokens.ts): the --sw-seg-thumb
       lift read ~1.3:1 from the track, a chosen segment needs 3:1 (WCAG 1.4.11); light keeps the card surface + the accent ink */
    background: var(--sw-seg-on-bg, var(--sw-seg-key, var(--sw-surface)));
    color: var(--sw-seg-on-fg, var(--sw-seg-key-ink, var(--sw-accent-text)));
    box-shadow: var(--sw-seg-on-shadow, var(--sw-seg-thumb-shadow, var(--sw-shadow-1)));
  }
  .seg button:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
`;

/** R5-SYSTEM-297: the settings ladder (the HOMEFABLE pattern - hero / card / well - on every הגדרות page). A screen that does not
 * adopt settingsStyles (the audit, storage, update, wizard, readiness, notices pages) takes this sheet alone: the page's cards step
 * up (the card radius, the floating shadow with the 1 px light line, a 17/700 title in the heading ink), every pressable local
 * control gives on pointer-down, and hover stays with a pointer that hovers (mobile-native). Tokens only. */
export const settingsLadderStyles = css`
  :host {
    /* the card step: sw-card reads these (components/sw-card.ts) - the skins keep their material, the step and the title are the settings' */
    --sw-card-radius: var(--sw-r-lg);
    --sw-card-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    --sw-card-title-fs: var(--sw-fs-2xl);
    --sw-card-title-fw: var(--sw-fw-bold);
    --sw-card-pad: 18px;
    /* loop 2 (visible-difference test): the well is a real step down from the card, not a near-white wash - surface-2 pulled a
       quarter of the way toward the border tone; the skins' own surface-2 / border decide the hue, so domus and crystal stay glass */
    --sw-well: color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border));
  }
  /* press feedback (emil-design-eng: a pressable thing gives on pointer-down; 120 ms, transform only) */
  .seg button,
  .kpi,
  .skin,
  .swatch,
  .pages button,
  .chips button,
  .rc,
  .colbtn,
  .pillsel,
  button.opt {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .seg button:active:not(:disabled),
  .kpi:active,
  .skin:active:not(:disabled),
  .swatch:active:not(:disabled),
  .pages button:active,
  .chips button:active,
  .rc:active,
  .colbtn:active,
  button.opt:active:not(:disabled) {
    transform: scale(var(--sw-press-scale));
  }
  @media (prefers-reduced-motion: reduce) {
    .seg button,
    .kpi,
    .skin,
    .swatch,
    .pages button,
    .chips button,
    .rc,
    .colbtn,
    button.opt {
      transition-duration: 0ms;
    }
  }
`;

/** SHARED-POLISH-2342: the pieces the design-polish round (docs/changes/*-POLISH-2331.md) built locally on several settings pages,
 * gathered here under a set- prefix so no existing class changes meaning. All opt-in by class; part of settingsStyles and exported on
 * its own for a page that keeps its own sheet. Tokens only.
 *   .set-col                 a column that stacks its .row (label above the control) when it is narrower than label + control
 *                            (SCHED-POLISH-2331; a NAMED container, so another container query on the page is not affected)
 *   .set-choices / label.set-choice   a radio / checkbox tile list: the checked tile carries the accent (TABSMODE-POLISH-2331)
 *   .set-chips label         a toggle chip whose checkbox stays in the tab order, visually hidden (LOOK-POLISH-2331)
 *   select.set-select        the settings select look, for a select that is not wrapped in sw-field (SCHED-POLISH-2331)
 *   table.set-matrix         a role x permission table in the settings ladder (SCHED-POLISH-2331, the access screens)
 *   .foot.sticky             a card footer whose save stays in view on a phone (INSIGHTS-POLISH-2331) */
export const settingsKitStyles = css`
  .set-col {
    container: sw-set-col / inline-size;
    min-inline-size: 0;
  }
  @container sw-set-col (max-width: 440px) {
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
    .row .seg {
      align-self: flex-start;
    }
  }
  .set-choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: 6px;
  }
  label.set-choice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-block-size: 44px;
    padding: 10px 12px;
    box-sizing: border-box;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    color: var(--sw-text);
    font-size: var(--sw-fs-base);
    cursor: pointer;
    transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  label.set-choice:has(input:checked) {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
    font-weight: var(--sw-fw-semibold);
  }
  label.set-choice:has(input:focus-visible) {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  label.set-choice:active:not(:has(input:disabled)) {
    transform: scale(var(--sw-press-scale));
  }
  label.set-choice:has(input:disabled) {
    cursor: default;
  }
  label.set-choice:has(input:disabled:not(:checked)) {
    opacity: var(--sw-disabled-opacity);
  }
  label.set-choice input {
    margin: 2px 0 0;
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--sw-accent);
    flex: none;
  }
  label.set-choice .t {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  label.set-choice .t .muted {
    font-weight: var(--sw-fw-regular);
  }
  .set-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .set-chips label {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: 36px;
    padding: 0 14px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
  }
  .set-chips input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    cursor: pointer;
  }
  .set-chips label:has(input:checked) {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    box-shadow: inset 0 0 0 1px var(--sw-accent);
  }
  .set-chips label:has(input:focus-visible) {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .set-chips label:active:not(:has(input:disabled)) {
    transform: scale(var(--sw-press-scale));
  }
  .set-chips label:has(input:disabled:not(:checked)) {
    opacity: var(--sw-disabled-opacity);
    cursor: default;
  }
  select.set-select {
    min-block-size: 36px;
    max-inline-size: 100%;
    padding: 0 10px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  select.set-select:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  table.set-matrix {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sw-fs-base);
  }
  .set-matrix th {
    text-align: start;
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    padding: 6px 8px 8px;
    border-block-end: 1px solid var(--sw-border-strong);
  }
  .set-matrix td {
    padding: 10px 8px;
    border-block-start: 1px solid var(--sw-border);
    color: var(--sw-heading, var(--sw-text));
    font-weight: var(--sw-fw-medium);
  }
  .set-matrix tbody tr:first-child td {
    border-block-start: 0;
  }
  .set-matrix td small {
    display: block;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  @media (hover: hover) and (pointer: fine) {
    label.set-choice:hover:not(:has(input:disabled)):not(:has(input:checked)) {
      border-color: var(--sw-border-strong);
      background: color-mix(in srgb, var(--sw-surface) 70%, var(--sw-hover-wash));
    }
    .set-chips label:hover:not(:has(input:checked)):not(:has(input:disabled)) {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
    }
  }
  @media (pointer: coarse) {
    select.set-select {
      min-block-size: 44px;
    }
    .set-chips label {
      min-block-size: 44px;
    }
  }
  @media (max-width: 767px) {
    .foot.sticky {
      position: sticky;
      inset-block-end: var(--sw-s-2);
      z-index: 3;
      margin-inline: calc(-1 * var(--sw-s-2));
      padding: 10px var(--sw-s-2);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-solid);
      box-shadow: var(--sw-shadow-3);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    label.set-choice,
    .set-chips label {
      transition-duration: 0ms;
    }
  }
`;

export const settingsStyles = css`
  ${settingsLadderStyles}
  :host {
    display: block;
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-4);
    max-inline-size: 880px;
    min-inline-size: 0;
  }
  /* R5-SYSTEM-297: a group label is a heading, not a 10 px uppercase smudge (Hebrew has no uppercase to begin with) */
  .grouplabel {
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading, var(--sw-text));
    letter-spacing: -0.005em;
    margin-block: var(--sw-s-2) 2px;
    grid-column: 1 / -1;
  }
  .grouplabel:not(:first-child) {
    margin-block-start: var(--sw-s-4);
  }
  /* R5-SYSTEM-297: a settings row is a WELL (surface-2, rounded, no hairline) inside the card - the third step of the ladder; the
     label reads at a glance (14/600 in the heading ink) and its hint is body-sized secondary text, not an 11 px caption */
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sw-s-3) var(--sw-s-4);
    padding: 14px 16px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: var(--sw-well, var(--sw-surface-2));
    font-size: var(--sw-fs-sm);
    min-inline-size: 0;
  }
  .row + .row {
    margin-block-start: 8px;
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
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading, var(--sw-text));
    letter-spacing: -0.005em;
  }
  .row .lbl .muted,
  .muted {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-regular);
    color: var(--sw-text-2);
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
  /* R5-SYSTEM-297: a fact row keeps its hairline (a dense list) but its value is a display figure (14.5/700 in the heading ink, tabular)
     and a toned value is a FILLED pill, not a coloured word (status as a field) */
  .check {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sw-s-2);
    padding: 9px 0;
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-base);
  }
  .check:last-child {
    border-block-end: 0;
  }
  .val {
    color: var(--sw-heading, var(--sw-text));
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    font-variant-numeric: tabular-nums;
    text-align: end;
    max-inline-size: 60%;
    overflow-wrap: anywhere;
  }
  .val.ok,
  .val.warn,
  .val.err {
    display: inline-flex;
    align-items: center;
    min-block-size: 24px;
    padding: 1px 10px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    line-height: 1.4;
  }
  .val.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .val.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .val.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .hint {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
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
    min-block-size: 28px;
    padding: 2px 12px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
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
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
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
  ${settingsKitStyles}
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
  /* the bubble skin is frozen (unit-bubble-freeze-295): its rows keep the hairline list and its cards their own material */
  :host([data-skin='bubble']) {
    --sw-card-radius: initial;
    --sw-card-shadow: initial;
    --sw-card-title-fs: initial;
    --sw-card-title-fw: initial;
    --sw-card-pad: initial;
  }
  :host([data-skin='bubble']) .row {
    padding: 10px 0;
    border-radius: 0;
    background: transparent;
    border-block-end: 1px solid var(--sw-border);
  }
  :host([data-skin='bubble']) .row + .row {
    margin-block-start: 0;
  }
  :host([data-skin='bubble']) .row:last-child {
    border-block-end: 0;
  }
  @media (max-width: 767px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: var(--sw-s-2);
      padding: 12px;
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
