import { css } from 'lit';

// HOME-WALL-NIGHT-2500: the wall panel's rest screen, screen takeover and night layer (home-wall-rest.ts). The theme's own colours, so the
// rest screen reads in all seven themes, dark and light; the night layer is the one dark wash on top (dim only - Q73: no device API).
// One fixed screen each: nothing here scrolls (owner rule: no scrolling in control screens).
export const homeWallRestStyles = css`
  .wr {position: fixed; inset: 0; z-index: 50; display: grid; grid-template-rows: 1fr auto; justify-items: center; padding: clamp(24px, 5vmin, 56px) 24px clamp(18px, 3vmin, 32px);
    background: var(--hs-bg); color: var(--hs-heading); cursor: pointer; overflow: hidden; -webkit-tap-highlight-color: transparent; user-select: none;}
  .wr:focus-visible {outline: 3px solid var(--hs-focus); outline-offset: -6px;}
  .wr-in {align-self: center; display: grid; justify-items: center; gap: clamp(8px, 2vmin, 18px); min-inline-size: 0; max-inline-size: 100%; text-align: center;}
  .wr-date {margin: 0; font-size: clamp(18px, 3.4vmin, 30px); color: var(--hs-text-2); font-weight: 500;}
  .wr-time {margin: 0; font-size: clamp(88px, 22vmin, 210px); line-height: .92; font-weight: 300; letter-spacing: -.02em; color: var(--hs-heading);}
  .wr-wx {margin: 0; display: inline-flex; align-items: center; gap: 12px; font-size: clamp(18px, 3.2vmin, 28px); color: var(--hs-text);}
  .wr-wx .hi {inline-size: 1.3em; block-size: 1.3em;}
  .wr-wx .num {font-weight: 600; color: var(--hs-heading);}
  .wr-row {display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-block-start: clamp(6px, 2vmin, 20px); max-inline-size: min(980px, 100%);}
  .wr-pill {background: var(--hs-surface); font-size: clamp(15px, 2.2vmin, 19px); max-inline-size: 36ch; min-inline-size: 0;}
  .wr-pill .hi {color: var(--ct, var(--hs-text-2));}
  .wr-hint {margin: 0; font-size: var(--f-sm, 14px); color: var(--hs-text-3);}
  .wcatch {position: fixed; inset: 0; z-index: 50; background: transparent; cursor: pointer; -webkit-tap-highlight-color: transparent;}

  .wt {position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 24px; background: var(--hs-bg); overflow: hidden;
    background-image: linear-gradient(180deg, var(--cs, transparent), transparent 70%);}
  .wt-in {display: grid; justify-items: center; gap: clamp(10px, 2.2vmin, 18px); inline-size: min(760px, 100%); text-align: center;}
  .wt-ic {display: grid; place-items: center; inline-size: clamp(72px, 14vmin, 112px); block-size: clamp(72px, 14vmin, 112px); border-radius: 50%; background: var(--cs); color: var(--c);}
  .wt-ic .hi {inline-size: 55%; block-size: 55%;}
  .wt[data-tone="danger"] .wt-ic {animation: wt-pulse 1.4s ease-in-out infinite;}
  .wt-k {margin: 0; font-size: clamp(16px, 2.6vmin, 22px); font-weight: 600; color: var(--ct);}
  .wt h1 {margin: 0; font-size: clamp(30px, 6.4vmin, 56px); line-height: 1.12; color: var(--hs-heading);}
  .wt-b {margin: 0; font-size: clamp(17px, 2.8vmin, 24px); line-height: 1.45; color: var(--hs-text); overflow-wrap: anywhere;}
  .wt-b.long {display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;}
  .wt-acts {display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-block-start: clamp(6px, 2vmin, 18px);}
  .wt-acts .hbtn {min-inline-size: 220px;}

  .wdim {position: fixed; inset: 0; z-index: 70; background: #000; pointer-events: none; transition: opacity 900ms ease;}
  @keyframes wt-pulse {50% {transform: scale(1.08);}}
  @media (prefers-reduced-motion: reduce) {
    .wdim {transition: none;}
    .wt[data-tone="danger"] .wt-ic {animation: none;}
  }
  @media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
    .wr-row {flex-direction: column; align-items: center;}
    .wt-acts .hbtn {min-inline-size: 0; inline-size: 100%;}
  }
`;
