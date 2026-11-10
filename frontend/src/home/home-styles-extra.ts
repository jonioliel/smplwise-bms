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
`;
