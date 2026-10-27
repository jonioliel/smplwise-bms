import { css } from 'lit';

/**
 * CR-INFRA-TEMPERATURE 2.9.1: the visual language of the temperature screens (owner-approved mockup 2026-10-19). Status colours are the
 * `--tc-*` custom properties, mapped onto the design system's status tokens (a skin may override them): ok = success, warning = warning,
 * alarm = danger, sensor offline = offline, climate unit off / unknown = unknown, door = the timeline door colour, defrost and setpoint =
 * the accent. Type and radii come from the token scale only (token lint). Charts are LTR geometry in every language.
 */
export const tempCss = css`
  :host {
    --tc-ok: var(--sw-success);
    --tc-warn: var(--sw-warning);
    --tc-alarm: var(--sw-danger);
    --tc-off: var(--sw-offline);
    --tc-idle: var(--sw-unknown);
    --tc-door: var(--sw-tl-door);
    --tc-acc: var(--sw-accent);
    --tc-line: var(--sw-accent);
    --tc-band: color-mix(in srgb, var(--sw-success) 14%, transparent);
  }
  [data-look='ok'] { --c: var(--tc-ok); --c-text: var(--sw-success-text); --c-soft: var(--sw-success-soft); }
  [data-look='warn'] { --c: var(--tc-warn); --c-text: var(--sw-warning-text); --c-soft: var(--sw-warning-soft); }
  [data-look='alarm'] { --c: var(--tc-alarm); --c-text: var(--sw-danger-text); --c-soft: var(--sw-danger-soft); }
  [data-look='off'] { --c: var(--tc-off); --c-text: var(--sw-offline-text); --c-soft: var(--sw-offline-soft); }
  [data-look='idle'], [data-look='unk'] { --c: var(--tc-idle); --c-text: var(--sw-unknown-text); --c-soft: var(--sw-unknown-soft); }

  .num { font-variant-numeric: tabular-nums; }
  .badge {
    display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 3px 11px; white-space: nowrap;
    background: var(--c-soft); color: var(--c-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); line-height: 1.4;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  /* POLISH-CONTROL-297: the chip's word is set one step larger (the audit's smallest text was these tags) and its tone colour is the
     theme's readable text token, never the raw status colour; a neutral chip reads in the full text colour */
  .chip {
    display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 10px; line-height: 1.5;
    font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); background: var(--sw-surface-2); color: var(--sw-text); white-space: nowrap;
    max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis;
  }
  .chip[data-tone] { font-weight: var(--sw-fw-semibold); }
  .chip[data-tone='err'] { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
  .chip[data-tone='warn'] { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
  .chip[data-tone='door'] { background: color-mix(in srgb, var(--tc-door) 14%, transparent); color: var(--sw-text); }
  .chip[data-tone='doorOpen'] { background: color-mix(in srgb, var(--tc-door) 26%, transparent); color: var(--sw-text); font-weight: var(--sw-fw-semibold); }
  .chip[data-tone='off'] { background: var(--sw-offline-soft); color: var(--sw-offline-text); }
  .chip[data-tone='acc'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
  .chip[data-tone='ok'] { background: var(--sw-success-soft); color: var(--sw-success-text); }

  /* the gauge */
  .gauge { position: relative; flex: none; display: grid; place-items: center; }
  .gauge svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
  .g-track { stroke: var(--sw-surface-3); }
  .g-band { stroke: var(--tc-ok); stroke-opacity: 0.35; }
  .g-val { stroke: var(--c); }
  .g-dot { fill: var(--c); stroke: var(--sw-surface-solid); }
  .g-none { stroke: var(--tc-off); }
  .g-sp { stroke: var(--tc-acc); }
  .g-tick { font-size: var(--sw-fs-2xs); fill: var(--sw-text-3); }
  .gv { position: relative; display: grid; justify-items: center; gap: 1px; margin-block-start: 8px; text-align: center; }
  .gv b { font-size: var(--sw-fs-2xl); line-height: 1; color: var(--sw-heading); }
  .gv b sup { font-size: var(--sw-fs-xs); margin-inline-start: 1px; color: var(--sw-text-2); }
  .gv small { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
  .gv .trend { font-size: var(--sw-fs-xs); color: var(--c-text); font-weight: var(--sw-fw-semibold); }
  [data-stale] .gv b { color: var(--sw-text-3); }

  /* charts */
  .spark { block-size: 52px; border-radius: var(--sw-r-xs); overflow: hidden; background: var(--sw-surface-2); }
  .spark svg { inline-size: 100%; block-size: 100%; display: block; }
  .c-band { fill: var(--tc-band); }
  .c-door { fill: var(--tc-door); opacity: 0.22; }
  .c-defrost { fill: var(--tc-acc); opacity: 0.12; }
  .c-edge { stroke: var(--tc-ok); stroke-opacity: 0.55; stroke-dasharray: 3 3; }
  .c-line { stroke: var(--tc-line); stroke-width: 1.8; stroke-linejoin: round; }
  .c-out { stroke: var(--tc-alarm); stroke-width: 2.2; stroke-linejoin: round; }
  .c-sp { stroke: var(--sw-text-2); stroke-width: 1.4; stroke-dasharray: 5 3; }
  .c-line.big { stroke-width: 2; }
  /* phase 3 (idea 10): the compared units over the main line - categorical timeline colours, dashed so the main unit stays the hero */
  .c-ov { stroke-width: 1.6; stroke-linejoin: round; stroke-dasharray: 6 3; }
  .c-ov[data-ov='0'] { stroke: var(--sw-tl-person); }
  .c-ov[data-ov='1'] { stroke: var(--sw-tl-vehicle); }
  .legend i[data-k='ov0'] { background: var(--sw-tl-person); }
  .legend i[data-k='ov1'] { background: var(--sw-tl-vehicle); }
  .legend i[data-k='duty'] { background: var(--tc-acc); }
  .c-out.big { stroke-width: 2.4; }
  .c-grid { stroke: var(--sw-border); }
  .c-ax { font-size: var(--sw-fs-2xs); fill: var(--sw-text-3); }
  .c-cross { stroke: var(--sw-text-3); stroke-dasharray: 2 3; }
  .c-crossdot { fill: var(--tc-line); stroke: var(--sw-surface-solid); }
  .axis { display: flex; justify-content: space-between; font-size: var(--sw-fs-2xs); color: var(--sw-text-3); direction: ltr; }

  /* the ring */
  .r-seg[data-k='ok'] { fill: var(--tc-ok); opacity: 0.55; }
  .r-seg[data-k='warn'] { fill: var(--tc-warn); }
  .r-seg[data-k='alarm'] { fill: var(--tc-alarm); }
  .r-seg[data-k='defrost'] { fill: var(--tc-acc); opacity: 0.45; }
  .r-seg[data-k='none'] { fill: var(--sw-surface-3); }
  .r-hand { stroke: var(--sw-heading); }
  .r-hub { fill: var(--sw-heading); }

  /* timeline bars */
  .tl { display: flex; block-size: 14px; border-radius: var(--sw-r-2xs); overflow: hidden; background: var(--sw-surface-2); direction: ltr; }
  .tl > span[data-k='open'] { background: var(--tc-door); }
  .tl > span[data-k='ok'] { background: color-mix(in srgb, var(--tc-ok) 45%, transparent); }
  .tl > span[data-k='warn'] { background: var(--tc-warn); }
  .tl > span[data-k='alarm'] { background: var(--tc-alarm); }
  .tl > span[data-k='defrost'] { background: color-mix(in srgb, var(--tc-acc) 35%, transparent); }
  .tl > span[data-k='none'] { background: transparent; }

  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
  .legend i { display: inline-block; inline-size: 12px; block-size: 8px; border-radius: var(--sw-r-2xs); margin-inline-end: 5px; vertical-align: middle; }
  .legend i[data-k='line'] { background: var(--tc-line); }
  .legend i[data-k='out'] { background: var(--tc-alarm); }
  .legend i[data-k='band'] { background: var(--tc-band); outline: 1px dashed var(--tc-ok); }
  .legend i[data-k='door'] { background: color-mix(in srgb, var(--tc-door) 50%, transparent); }
  .legend i[data-k='defrost'] { background: color-mix(in srgb, var(--tc-acc) 30%, transparent); }
  .legend i[data-k='sp'] { background: repeating-linear-gradient(90deg, var(--sw-text-2) 0 5px, transparent 5px 8px); }
  .legend i[data-k='ok'] { background: color-mix(in srgb, var(--tc-ok) 55%, transparent); }
  .legend i[data-k='warn'] { background: var(--tc-warn); }
  .legend i[data-k='alarm'] { background: var(--tc-alarm); }
  .legend i[data-k='none'] { background: var(--sw-surface-3); }

  .btn {
    display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 7px 14px; min-block-size: var(--sw-ctl-h-sm);
    border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-weight: var(--sw-fw-semibold); cursor: pointer;
    text-decoration: none; white-space: nowrap;
  }
  .btn:hover { border-color: var(--sw-border-strong); }
  .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
  .btn.ghost { background: transparent; border-color: transparent; color: var(--sw-accent-text); }
  .btn.sm { padding: 4px 10px; min-block-size: 0; font-size: var(--sw-fs-sm); }
  .btn:disabled { opacity: var(--sw-disabled-opacity); cursor: default; }
  .btn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
  .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); padding: 14px 16px; box-shadow: var(--sw-shadow-1); min-inline-size: 0; }
  .panel h4 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); }
  .hint { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .mono { font-family: var(--sw-font-mono); font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`;
