import { css } from 'lit';

/**
 * SYNOPTIC-MOBILE-2342 - the phone board of the synoptic map (under 768 px), owner round 13 answer 1A + note: three layouts behind the option
 * "תצוגת המפה הסינופטית בטלפון" (ui.xs syn_phone_view) - A a compact table (default), B one card per floor, C the cross-section first
 * (mock-up private/design-system-2026-10-27/round12/synoptic-mobile). The root cause of the 2.33.0 overlap was a phone grid of
 * `minmax(0, auto)` number columns holding a lights strip that does not shrink: here every number column has a FIXED width
 * (xs-model PHONE_COL_PX), the name takes what is left and ellipsises, and the strip is a 34 px bar under "2/10" (sub-answer 2B).
 * Only the list scrolls (overscroll contained); the page does not. Hover only under a pointer that hovers; presses read the skin's scale.
 */
export const synPhoneStyles = css`
  .pboard { display: grid; gap: 8px; block-size: 100%; min-block-size: 0; box-sizing: border-box; }
  .pboard.card { padding: 10px 12px; }
  .pboard.pa { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .pboard.pb { grid-template-rows: auto auto minmax(0, 1fr); }
  .pboard.pc { grid-template-rows: auto auto minmax(0, 1fr) auto; padding-block-end: 0; }
  .phead { display: flex; align-items: center; gap: 6px; min-inline-size: 0; min-block-size: 36px; }
  .phead .chips { flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; }
  .phead .live { flex: none; }
  .ib { flex: none; inline-size: 44px; block-size: 44px; margin-block: -4px; margin-inline-end: -10px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--sw-r-md); background: transparent; color: var(--sw-text-2); cursor: pointer; }
  .ib .xi { inline-size: 20px; block-size: 20px; }

  /* every pressable of the phone board: no tap flash, no long-press selection, the click fires at once, the press answers on pointer-down */
  .ib, .pan, .plc, .pfh, .pmt, .pl1, .ppl { font: inherit; color: inherit; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-press) var(--sw-ease); }
  .ib:active, .pan:active, button.plc:active, button.pmt:active, button.ppl:active, .pfh:active, .pl1:active { transform: scale(var(--sw-press-scale)); }

  /* numbers: tabular, isolated left-to-right inside a right-to-left row */
  .n { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
  .pv { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-text); white-space: nowrap; text-align: center; font-variant-numeric: tabular-nums; }
  .pv.mut { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
  .pv.warn { color: var(--sw-danger-text); }
  .pv small, .pval small, .ppl small { font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); margin-inline-start: 1px; direction: ltr; unicode-bidi: isolate; }
  .pv[data-t='hot'], .pval[data-t='hot'] { color: color-mix(in srgb, var(--sw-heat) 62%, var(--sw-heading)); }
  .pv[data-t='cold'], .pval[data-t='cold'] { color: color-mix(in srgb, var(--sw-cool) 62%, var(--sw-heading)); }
  .pv .xi, .pval .xi { inline-size: 16px; block-size: 16px; vertical-align: -3px; }
  .mb { display: block; inline-size: 34px; block-size: 4px; border-radius: 2px; background: var(--sw-surface-3); overflow: hidden; }
  .mb i { display: block; block-size: 100%; border-radius: 2px; background: var(--sw-lit); }
  .pgl { flex: none; display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  .pgl::before, .pgl::after { content: ''; flex: 1; block-size: 2px; border-radius: 2px; background: var(--sw-border-strong); }

  /* A - the compact table */
  .pah, .par, .pfr { display: grid; grid-template-columns: var(--pgrid); align-items: center; column-gap: 6px; }
  .pah { block-size: 24px; padding: 0 10px; color: var(--sw-text-3); }
  .pah > span { display: flex; justify-content: center; min-inline-size: 0; }
  .pah > span:first-child { justify-content: flex-start; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); }
  .pah .xi { inline-size: 16px; block-size: 16px; }
  .plist, .pbl, .cl { min-block-size: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--sw-border-strong) transparent; }
  .plist { display: flex; flex-direction: column; gap: 4px; }
  .par { flex: none; min-block-size: 52px; padding: 0 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
  .plist[data-dense] .par { min-block-size: 44px; }
  .par[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
  .par[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
  .par[data-fire='alarm'], .pfc[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); box-shadow: inset 0 0 0 2px var(--sw-danger); }
  .pan { display: flex; flex-direction: column; justify-content: center; min-inline-size: 0; min-block-size: 44px; padding: 0; border: 0; background: transparent; text-align: start; cursor: pointer; border-radius: var(--sw-r-2xs); }
  .pan .t, .pfh .t { font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pan .t { font-size: var(--sw-fs-md); }
  .pan .s, .pfh .s { color: var(--sw-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pan .s { font-size: var(--sw-fs-xs); }
  .plist[data-dense] .pan .t { font-size: var(--sw-fs-base); }
  .plist[data-dense] .pan .s { font-size: var(--sw-fs-2xs); }
  [data-off] .pan .t, [data-off] .pfh .t, [data-off] .pl1 .t { color: var(--sw-text-2); }
  .pcell { display: flex; justify-content: center; min-inline-size: 0; overflow: hidden; }
  .plc { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-inline-size: 0; min-block-size: 44px; padding: 0; border: 0; border-radius: var(--sw-r-sm); background: transparent; }
  button.plc { cursor: pointer; }

  /* B - one card per floor (above six floors: one row each) */
  .pbl { display: flex; flex-direction: column; gap: 8px; padding-block-end: 2px; }
  .pfc { flex: none; padding: 4px 12px 10px; }
  .pfc.row { padding: 0 12px; }
  .pfh { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; inline-size: 100%; min-block-size: 46px; padding: 0; border: 0; background: transparent; text-align: start; cursor: pointer; border-radius: var(--sw-r-2xs); }
  .pfh > span { min-inline-size: 0; display: flex; flex-direction: column; }
  .pfh .t { font-size: var(--sw-fs-lg); }
  .pfh .s { font-size: var(--sw-fs-state); }
  .pfh .xi, .pfr > .xi { inline-size: 16px; block-size: 16px; color: var(--sw-text-3); }
  :host(:dir(ltr)) .xi.fwd { transform: scaleX(-1); }
  .pfr { min-block-size: 50px; }
  .pfr .pfh { min-block-size: 50px; grid-template-columns: minmax(0, 1fr); }
  .pfm { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .pmt { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; min-block-size: 52px; padding: 7px 9px; border: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); text-align: start; }
  button.pmt { cursor: pointer; }
  .pmt .k { display: flex; align-items: center; gap: 5px; min-inline-size: 0; font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pmt .k .xi { inline-size: 14px; block-size: 14px; }
  .pval { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); line-height: 1.15; color: var(--sw-text); text-align: start; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pmt.lit { background: color-mix(in srgb, var(--sw-lit) 16%, var(--sw-surface-2)); }
  .pmt.lit .mb { inline-size: 100%; margin-block-start: 3px; background: color-mix(in srgb, var(--sw-border-strong) 70%, transparent); }
  .pmt.mut .pval { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
  .pmt.warn .pval { color: var(--sw-danger-text); }
  .pmt.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; }

  /* C - the cross-section first: roof, slabs warm by the share of lights on, the ground line and the floors below it */
  .cl { display: grid; grid-template-columns: var(--slab) minmax(0, 1fr); column-gap: 10px; row-gap: 3px; align-content: start; padding-block-end: 8px; }
  .roof { block-size: 12px; margin: 0 4px -1px; background: var(--sw-border-strong); clip-path: polygon(12% 0, 88% 0, 100% 100%, 0 100%); border-radius: 2px; }
  .sl { position: relative; min-block-size: 58px; border: 1.5px solid var(--sw-border-strong); border-radius: var(--sw-r-2xs); background: var(--sw-surface); overflow: hidden; }
  .cl[data-dense] .sl { min-block-size: 44px; }
  .sl.bg { background: var(--sw-surface-3); }
  .sl > i { position: absolute; inset-block: 0; inset-inline-start: 0; background: color-mix(in srgb, var(--sw-lit) 70%, transparent); }
  .sl > em { position: absolute; inset-inline-end: 4px; inset-block-end: 2px; font-style: normal; font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); font-variant-numeric: tabular-nums; direction: ltr; }
  .sl[data-sel] { border-color: var(--sw-accent); box-shadow: 0 0 0 1.5px var(--sw-accent); }
  .ci { display: flex; flex-direction: column; justify-content: center; gap: 4px; min-inline-size: 0; min-block-size: 44px; padding: 4px 0; }
  .pl1 { display: flex; align-items: baseline; gap: 6px; min-inline-size: 0; min-block-size: 24px; padding: 0; border: 0; border-radius: var(--sw-r-2xs); background: transparent; text-align: start; cursor: pointer; }
  .pl1 .t { flex: none; max-inline-size: 60%; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pl1[aria-pressed='true'] .t { color: var(--sw-accent-text); }
  .pl1 .s { min-inline-size: 0; font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ppls { display: flex; gap: 5px; flex-wrap: nowrap; min-inline-size: 0; }
  .ppl { position: relative; flex: none; display: inline-flex; align-items: center; gap: 4px; block-size: 24px; padding: 0 8px; border: 0; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text); white-space: nowrap; font-variant-numeric: tabular-nums; }
  button.ppl { cursor: pointer; }
  button.ppl::after { content: ''; position: absolute; inset: -10px -3px; } /* a 44 px touch target around the 24 px pill */
  .ppl .xi { inline-size: 13px; block-size: 13px; color: var(--sw-text-2); }
  .ppl.lit { background: color-mix(in srgb, var(--sw-lit) 24%, var(--sw-surface)); }
  .ppl.mut { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
  .ppl.warn { color: var(--sw-danger-text); }
  .ppl.dash { background: transparent; outline: 1.5px dashed var(--sw-border-strong); outline-offset: -1.5px; color: var(--sw-text-3); }
  .cl[data-dense] .ci { flex-direction: row; align-items: center; justify-content: space-between; gap: 6px; }
  .cl[data-dense] .pl1 .s { display: none; }
  .cl[data-dense] .pl1 .t { max-inline-size: none; font-size: var(--sw-fs-base); }
  .cl[data-dense] .ppl { block-size: 22px; padding: 0 6px; font-size: var(--sw-fs-state); }
  .soil { grid-column: 1; block-size: 8px; margin: 1px 0; background: repeating-linear-gradient(135deg, var(--sw-border-strong) 0 2px, transparent 2px 6px); border-block-start: 2px solid var(--sw-border-strong); }
  .soiltx { grid-column: 2; block-size: 8px; margin-block-start: 1px; border-block-start: 2px solid var(--sw-border-strong); }
  .dstrip { display: flex; align-items: center; gap: 8px; min-block-size: 52px; margin-inline: -12px; padding: 6px 12px; border-block-start: 1px solid var(--sw-border); }
  .dstrip .tx { flex: 1; min-inline-size: 0; font-size: var(--sw-fs-sm); line-height: 1.35; color: var(--sw-text-2); }
  .dstrip .tx b { display: block; font-size: var(--sw-fs-md); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* the info sheet (sub-answer 3B: the board's summary behind the info button) */
  .pinfo .sub { margin: 0 0 10px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .pinfo dl { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; font-size: var(--sw-fs-base); }
  .pinfo dt { color: var(--sw-text-3); }
  .pinfo dd { margin: 0; color: var(--sw-text); }
  .pinfo .hint { margin: 12px 0 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .pinfo .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-block-start: 14px; }

  @media (hover: hover) and (pointer: fine) {
    .par:hover { background: var(--sw-surface-3); }
    button.plc:hover, button.ppl:hover { background: color-mix(in srgb, var(--sw-lit) 14%, transparent); }
    button.pmt:hover { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface-2)); }
    .ib:hover { background: var(--sw-surface-2); }
  }
`;
