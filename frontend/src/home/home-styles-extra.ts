// HOME-SIMPLE-2420: the few product-only additions on top of the generated mockup styles (home-styles.ts): the live camera tile in
// the picture slot, a shutter button waiting for its confirming second tap, the visitors' row without a picture, the wall panel's
// exit keypad, the loading state. Same tokens (--hs-*), same rules (56 px targets on the tablet, no scrolling).
import { css } from 'lit';

export const homeExtraStyles = css`
  sw-camera-tile.scene-pic { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; display: block; border-radius: inherit; overflow: hidden; }
  .cf-pic sw-camera-tile.scene-pic { border-radius: 0; }
  .rb.armed { background: var(--hs-accent) !important; color: var(--hs-on-accent, #fff) !important; outline: 2px solid var(--hs-accent-text); outline-offset: 2px; }
  .vp.vp-ic { display: grid; place-items: center; background: var(--hs-surface-3); color: var(--hs-text-2); }
  .empty.loading .hi { animation: hs-fade 900ms ease infinite alternate; }
  .kiosk-pad { inline-size: min(380px, calc(100vw - 32px)); }
  .kp-dots { font-size: 32px; letter-spacing: .3em; min-block-size: 44px; text-align: center; color: var(--hs-heading); }
  .kp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; direction: ltr; inline-size: 100%; }
  .kp-grid .hbtn { padding: 0 !important; font-size: 22px; }
  .hs-now { user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  /* the status pill is 44 px tall in the strip; its hit area reaches 56 (the segmented buttons' rule) */
  .st-pill { position: relative; }
  .st-pill::after { content: ''; position: absolute; inset: -6px 0; }
  .hsw:disabled, .lamp:disabled { opacity: .45; cursor: default; }
  /* HOME-SIMPLE-2421: a door the door rule does not let this person open - a quiet line instead of the button */
  .dno { max-inline-size: 16ch; font-size: var(--f-sm); color: var(--hs-text-3); text-align: end; line-height: 1.3; }
  /* HOME-SIMPLE-2421: the room wallpaper - the picture / gallery field under a scrim of the theme's own background (contrast kept) */
  .hs.walled { position: relative; isolation: isolate; }
  .hs.walled::before, .hs.walled::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; }
  .hs.walled::before { background: var(--hs-wall); background-size: cover; background-position: center; }
  .hs.walled::after { background: color-mix(in oklab, var(--hs-bg) 76%, transparent); }
  .wall-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; flex: 1 1 auto; min-block-size: 0; align-content: start; }
  .wall-opt { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 8px; padding: 8px; min-block-size: 96px; text-align: start; position: relative; }
  .wall-pv { display: block; border-radius: 10px; min-block-size: 56px; background: var(--hs-wall, var(--hs-surface-3)); border: 1px solid var(--hs-border); }
  .wall-opt[aria-checked='true'] { outline: 2px solid var(--hs-accent); outline-offset: 2px; }
  .wall-opt .tick { position: absolute; inset-block-start: 12px; inset-inline-end: 12px; opacity: 0; }
  .wall-opt[aria-checked='true'] .tick { opacity: 1; color: var(--hs-accent-text); }
  [data-wall-upload] { cursor: pointer; }
  @media (max-width: 700px), (max-width: 899px) and (orientation: portrait) { .wall-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* HOME-V3-P1-2430: product-only pieces of the v3 screens (the rest is home-styles-v3.ts, ported from the mockup) */
  .pb-days { display: inline-flex; align-items: center; gap: 6px; }
  .pb-days .pbd { min-inline-size: 7ch; text-align: center; font-weight: 600; color: var(--hs-heading); }
  .pb-pic sw-live-player { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
  .pb-pic { position: relative; }
  .crow .vp.vp-ic { block-size: 64px; border-radius: 12px; }
  .crow .vp.vp-ic .hi { inline-size: 28px; block-size: 28px; }
  .fld2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; inline-size: 100%; }
  .pinsheet .rb.play { color: var(--hs-on-accent, #fff); }
  /* the v3 sheets keep the home interface's touch target (the mockup drew 54 px; the tablet rule is the full --hit) */
  @media (min-width: 900px), (min-width: 701px) and (orientation: landscape) {
    .ovl .sheet.v3 .rb, .ovl .sheet.v3 .hbtn, .ovl .sheet.v3 .chip2, .ovl .sheet.v3 .seg button { min-block-size: 56px; }
    .ovl .sheet.v3 .rb { min-inline-size: 56px; }
  }
  @media (max-width: 700px), (max-width: 899px) and (orientation: portrait) { .fld2 { grid-template-columns: minmax(0, 1fr); gap: 6px; } .pb-days .pbd { min-inline-size: 5ch; font-size: 14px; } }
  /* ---- HOME-V3-AUDITFIX-2437: the round-30 design audit (private/design-system-2026-10-27/round30/home-audit/FIXES.md; numbers = items) */
  /* 2: a portrait tablet (701-899 px) takes the phone layout (the boundary of every phone / wide query, sw-home.ts HOME_PHONE_MQ), roomier */
  @media (min-width: 701px) and (max-width: 899px) and (orientation: portrait) {
    :host { --hit: 56px; --f-body: 17px; --f-sm: 15px; --f-tile: 19px; }
    .hs-main { inline-size: 100%; max-inline-size: 760px; margin-inline: auto; }
    .hub { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); }
  }
  /* 1: the phone recordings header keeps the day stepper, on its own row */
  @media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
    .hs-head .acts:has(.pb-days) { flex: 1 1 100%; margin-inline-start: 0; }
    .hs-head .pb-days { flex: 1 1 100%; justify-content: space-between; gap: 8px; }
    .hs-head .pb-days .rb { inline-size: 48px; block-size: 48px; }
    .hs-head .pb-days .pbd { flex: 1 1 auto; text-align: center; font-size: var(--f-body); }
    /* 3: the alarm state pane takes its content's height from the top; the zones pane takes the rest */
    .alm-main { flex: 0 0 auto; justify-content: flex-start; padding-block: 16px 14px; gap: 6px; }
    .alm .pane:last-child { flex: 1 1 0; min-block-size: 0; }
    .alm-ic { inline-size: 48px; block-size: 48px; } .alm-ic .hi { inline-size: 24px; block-size: 24px; }
    .alm-acts { gap: 8px; margin-block-start: 8px; }
    .alm-main > .muted { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    /* 11: the electricity / water reading in the title never truncates - the actions take the next row */
    .hs[data-screen="energy"] .hs-head .acts, .hs[data-screen="water"] .hs-head .acts { flex: 1 1 100%; justify-content: flex-start; margin-inline-start: 0; }
    .hs[data-screen="energy"] .hs-head .pg-t, .hs[data-screen="water"] .hs-head .pg-t { white-space: nowrap; text-overflow: clip; }
  }
  /* 9: the camera stepper names the camera, like the day stepper names the day */
  .pb-cams { display: inline-flex; align-items: center; gap: 6px; }
  .pb-cams .pbc { min-inline-size: 0; max-inline-size: 18ch; }
  .hs-head .acts:has(.pb-cams) { gap: 16px; }
  /* 4: a wall-panel chip's status line shrinks with its chip */
  .chip3 .c3-t { min-inline-size: 0; max-inline-size: 100%; }
  .chip3 .c3-t b, .chip3 .c3-s { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip3 .c3-s > span { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; }
  /* 5: the camera tile's state word follows the real picture */
  .cap .live.still { --c: var(--hs-offline); }
  .cap .live.wait { opacity: .8; }
  /* 14: the call result stays on one line */
  .vr { min-inline-size: 0; }
  .vres { max-inline-size: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 15: a Latin or mixed name takes its own direction, so it truncates at its end (right-aligned like the Hebrew ones) */
  .clamp1:not(.num), .clamp2:not(.num), .c3-t b, .tb-t h1 { unicode-bidi: plaintext; text-align: match-parent; }
  /* 16: "(אני)" never truncates away */
  .pn { display: flex; align-items: baseline; gap: 6px; min-inline-size: 0; }
  .pn > b { min-inline-size: 0; } .pn .me-mark { flex: none; color: var(--hs-text-2); font-weight: 500; }
  .hv small { font-size: .85em; font-weight: 500; }
  /* 18: the sheets' own type, not the shell's */
  .ovl { font-size: var(--f-body); line-height: 1.5; color: var(--hs-text); }
  /* 22: the active media source is marked */
  .hs .md-src .chip2[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); font-weight: 600; }
  /* 24: the new-ticket category icon */
  .chip2 .c2i { inline-size: 20px; block-size: 20px; flex: none; margin-inline-end: 6px; }
  /* motion: the copy of a closing sheet (sw-home.ts ghostOverlay) never takes a touch */
  .ovl.ghost { pointer-events: none; }
`;
