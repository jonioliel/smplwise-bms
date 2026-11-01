import { css } from 'lit';

/**
 * CALENDARS-UI-2310: the shared visual language of the calendars screens (the approved round-8 mock-up, product tokens only). Type, radii and
 * colours read the design tokens; the eight calendar hues are data colours of this module (never green: green is status only), declared once
 * here for light and dark. Kind marks on every surface: confirmed = tinted fill, pending = dashed outline, maintenance = diagonal hatch,
 * displaced = amber hatch + strike-through, closed hours = fine hatch, imported = neutral well.
 */
export const calCss = css`
  :host {
    /* taste-skill-ignore: calendar data hues (a categorical palette, not UI colour) */
    --cal-blue: #2563eb; --cal-rose: #e11d48; --cal-cyan: #0891b2; --cal-orange: #ea580c; --cal-violet: #7c3aed; --cal-brown: #a16207; --cal-magenta: #c026d3;
    --cal-slate: #64748b;
    --ev-fill: 16%; --ev-ink: 78%;
    color: var(--sw-text);
    font-family: var(--sw-font);
  }
  :host-context(html[data-theme='dark']) {
    --cal-blue: #5b8def; --cal-rose: #f0506e; --cal-cyan: #1a9bb5; --cal-orange: #e06a2c; --cal-violet: #9b6cf0; --cal-brown: #b07a22; --cal-magenta: #d24fe0;
    --cal-slate: #93a1b6;
    --ev-fill: 26%; --ev-ink: 30%;
  }
  * { box-sizing: border-box; }
  .num { font-variant-numeric: tabular-nums; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
  .muted { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
  .sp { flex: 1; }
  .vh { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  /* panels */
  .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-1);
    padding: 16px; min-inline-size: 0; min-block-size: 0; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
  .panel > h2, .ph h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
  .ph { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }

  /* buttons and pills */
  .btn { font: inherit; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-block-size: var(--sw-ctl-h-lg); padding: 0 14px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface-solid);
    color: var(--sw-heading); cursor: pointer; white-space: nowrap; transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent; user-select: none; }
  .btn:active { transform: scale(0.97); }
  .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); box-shadow: var(--sw-shadow-primary); }
  .btn.bad { color: var(--sw-danger-text); }
  .btn.bad.fill { background: var(--sw-danger); border-color: var(--sw-danger); color: var(--sw-text-inverse); }
  .btn.sm { min-block-size: var(--sw-ctl-h-md); font-size: var(--sw-fs-sm); padding: 0 12px; }
  .btn.icon { inline-size: var(--sw-ctl-h-lg); padding: 0; }
  .btn[disabled] { opacity: var(--sw-disabled-opacity); cursor: default; transform: none; }
  .btn:focus-visible, .tab:focus-visible, .chipb:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
  @media (hover: hover) { .btn:not([disabled]):hover { background: var(--sw-hover-wash); } .btn.pri:not([disabled]):hover { background: var(--sw-accent-hover); } }
  .chipb { font: inherit; font-size: var(--sw-fs-md); display: inline-flex; align-items: center; gap: 6px; min-block-size: var(--sw-ctl-h-lg); padding: 0 16px;
    border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); cursor: pointer; white-space: nowrap; }
  .chipb[aria-pressed='true'] { background: var(--sw-heading); color: var(--sw-surface-solid); border-color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
  .chip { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 10px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold);
    background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; }
  .chip.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
  .chip.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
  .chip.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
  .chip.acc { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
  .chip.dash { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-text-2); color: var(--sw-heading); }
  .count { display: inline-grid; place-items: center; min-inline-size: 20px; block-size: 20px; padding: 0 6px; border-radius: var(--sw-r-pill); background: var(--sw-badge-bg);
    color: var(--sw-badge-fg); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold); }

  /* segmented control (settings, view switch) */
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); max-inline-size: 100%; overflow: hidden; }
  .seg button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); padding: 6px 12px; border-radius: var(--sw-r-pill);
    cursor: pointer; white-space: nowrap; min-block-size: 30px; }
  .seg button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
  .seg button[disabled] { opacity: var(--sw-disabled-opacity); cursor: default; }

  /* the calendar's colour dot / square */
  .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--h, var(--cal-slate)); flex: none; }
  .sq { inline-size: 24px; block-size: 24px; border-radius: var(--sw-r-xs); background: var(--h, var(--cal-slate)); flex: none; }

  /* an entry: tinted fill in the calendar's hue; the kind marks */
  .ev { --h: var(--cal-blue); position: relative; display: block; min-inline-size: 0; overflow: hidden; border: 0; text-align: start; font: inherit; cursor: pointer;
    background: color-mix(in srgb, var(--h) var(--ev-fill), var(--sw-surface-solid)); color: color-mix(in srgb, var(--h) var(--ev-ink), var(--sw-heading));
    border-radius: var(--sw-r-xs); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--h) 32%, transparent); padding: 3px 6px; font-size: var(--sw-fs-xs); line-height: 1.3; }
  .ev b { font-weight: var(--sw-fw-bold); }
  .ev small { display: block; font-size: var(--sw-fs-2xs); opacity: 0.85; }
  .ev[data-mark='pending'] { background: color-mix(in srgb, var(--h) 6%, var(--sw-surface-solid)); box-shadow: none; outline: 1.5px dashed color-mix(in srgb, var(--h) 70%, transparent); outline-offset: -1.5px; }
  .ev[data-mark='maint'] { --h: var(--cal-orange); background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--h) 22%, var(--sw-surface-solid)) 0 5px, color-mix(in srgb, var(--h) 8%, var(--sw-surface-solid)) 5px 10px);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--h) 70%, transparent); }
  .ev[data-mark='displaced'] { --h: var(--sw-warning); background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--sw-warning) 30%, var(--sw-surface-solid)) 0 5px, color-mix(in srgb, var(--sw-warning) 12%, var(--sw-surface-solid)) 5px 10px);
    color: var(--sw-warning-text); box-shadow: inset 0 0 0 1.5px var(--sw-warning); }
  .ev[data-mark='displaced'] b { text-decoration: line-through; }
  .ev[data-mark='external'], .ev[data-mark='busy'] { --h: var(--cal-slate); background: var(--sw-surface-3); color: var(--sw-text-2); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
  .ev[data-mark='holiday'] { --h: var(--cal-slate); background: transparent; box-shadow: none; color: var(--sw-text-2); }
  .ev[data-flag='conflict'] { box-shadow: inset 0 0 0 2px var(--sw-danger); }
  .closed { background: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--sw-text-3) 18%, transparent) 6px 7px); }

  /* legend */
  .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); align-items: center; }
  .legend i { display: inline-block; inline-size: 22px; block-size: 12px; border-radius: var(--sw-r-2xs); vertical-align: middle; margin-inline-end: 6px; --h: var(--cal-blue); }

  /* list rows */
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); min-inline-size: 0; }
  .row .name { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
  .row .sub { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  .grow { flex: 1; min-inline-size: 0; }

  /* the pager that replaces a page scroll */
  .pager { display: flex; align-items: center; gap: 8px; justify-content: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .pager .btn { inline-size: var(--sw-ctl-h-lg); padding: 0; }

  /* skeleton (owner answer 26A: after 300 ms, no flash) */
  .skel { border-radius: var(--sw-r-md); background: linear-gradient(90deg, var(--sw-skeleton) 0%, var(--sw-skeleton-shine) 50%, var(--sw-skeleton) 100%); background-size: 200% 100%;
    animation: sk 1.4s linear infinite; }
  @keyframes sk { to { background-position: -200% 0; } }
  .spin { inline-size: 28px; block-size: 28px; border-radius: 50%; border: 3px solid var(--sw-border); border-block-start-color: var(--sw-accent); animation: rot 0.9s linear infinite; }
  @keyframes rot { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .skel, .spin { animation: none; } .btn { transition: none; } }

  /* form fields of the drawers */
  .fld { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px 14px; align-items: center; }
  .fld > label, .fld > .lbl { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  .inp { font: inherit; font-size: var(--sw-fs-md); color: var(--sw-heading); background: var(--sw-surface-2); border: 1px solid transparent; border-radius: var(--sw-r-md);
    padding: 0 12px; min-block-size: 40px; min-inline-size: 0; inline-size: 100%; }
  .inp:focus { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
  select.inp { appearance: none; }
  .note { display: flex; gap: 10px; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-accent-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); }
  .note.warn { background: var(--sw-warning-soft); }
  .note.bad { background: var(--sw-danger-soft); }
  .note b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }

  @media (max-width: 699px) {
    .fld { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    /* mobile-native: 16 px inputs never zoom the page */
    .inp { font-size: max(16px, var(--sw-fs-lg)); }
  }
`;
