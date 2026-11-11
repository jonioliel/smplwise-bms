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
  @media (max-width: 700px) { .wall-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  /* HOME-V3-P1-2430: product-only pieces of the v3 screens (the rest is home-styles-v3.ts, ported from the mockup) */
  .pb-days { display: inline-flex; align-items: center; gap: 6px; }
  .pb-days .pbd { min-inline-size: 7ch; text-align: center; font-weight: 600; color: var(--hs-heading); }
  .pb-pic sw-live-player { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
  .pb-pic { position: relative; }
  .crow .vp.vp-ic { block-size: 64px; border-radius: 12px; }
  .crow .vp.vp-ic .hi { inline-size: 28px; block-size: 28px; }
  .fld2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; inline-size: 100%; }
  .pinsheet .rb.play { color: var(--hs-on-accent, #fff); }
  @media (max-width: 700px) { .fld2 { grid-template-columns: minmax(0, 1fr); gap: 6px; } .pb-days .pbd { min-inline-size: 5ch; font-size: 14px; } }
`;
