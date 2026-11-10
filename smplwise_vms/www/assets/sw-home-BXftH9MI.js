import{T as ht,E as at,U as pt,e as n,V as mt,W as ft,X as gt,Y as $,Z as ut,$ as bt,a0 as xt,a1 as vt,a2 as wt,a3 as V,A as m,a4 as kt,a5 as $t,a6 as yt,H as it,a as zt,a7 as _t,l as I,a8 as Mt,a9 as St,aa as Tt,g as Lt,ab as Rt,ac as Ot,ad as Et,ae as It,af as K,w as Y,ag as Pt,ah as jt,F as E,G as v}from"./index-CmpXuSwg.js";import{g as At,l as Dt,a as Ct,b as Ft,c as Bt,d as Ut,e as Ht,p as X,s as U,r as qt}from"./home-api-ByHrt8wd.js";import"./wk-talk-button-brwZssfz.js";import"./sw-logo-art-Va6y_cIM.js";const nt=at`${ht(String.raw`:host {
  --hs-ease: var(--sw-ease, cubic-bezier(.2, .8, .2, 1)); --hs-ease-drawer: var(--sw-ease-drawer, cubic-bezier(.32, .72, 0, 1));
  --hs-ease-in-out: var(--sw-ease-in-out, cubic-bezier(.65, 0, .35, 1)); --hs-t-med: var(--sw-t-med, 200ms);
  --hs-font: var(--sw-font, system-ui, -apple-system, "Segoe UI", "Noto Sans Hebrew", Arial, sans-serif);
  --hs-fs-xs: var(--sw-fs-xs, 12px); --hs-fs-sm: var(--sw-fs-sm, 13px); --hs-fs-base: var(--sw-fs-base, 14px);
  --hs-r-sm: var(--sw-r-sm, 8px); --hs-shadow-1: var(--sw-shadow-1, 0 1px 2px rgba(0,0,0,.2)); --hs-gap-lg: var(--sw-gap-lg, 24px);
  --hs-rail-text: var(--sw-rail-text, currentColor);
  display: block; font-family: var(--hs-font); line-height: 1.4; -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; overscroll-behavior: none;
}
:host *, :host *::before, :host *::after { box-sizing: border-box; }
h1, h2, h3, p { margin: 0; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
.num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
/* the status tones (the Arx design system's own rule, which the mockup took from ds.css) */
[data-tone="live"], [data-tone="success"], [data-tone="ok"] { --c: var(--hs-live); --ct: var(--hs-live-text); --cs: var(--hs-live-soft); }
[data-tone="recorded"], [data-tone="accent"], [data-tone="info"] { --c: var(--hs-accent); --ct: var(--hs-accent-text); --cs: var(--hs-accent-soft); }
[data-tone="offline"], [data-tone="neutral"] { --c: var(--hs-offline); --ct: var(--hs-offline-text); --cs: var(--hs-offline-soft); }
[data-tone="stale"], [data-tone="warning"], [data-tone="warn"] { --c: var(--hs-warning); --ct: var(--hs-warning-text); --cs: var(--hs-warning-soft); }
[data-tone="danger"], [data-tone="error"], [data-tone="alarm"] { --c: var(--hs-danger); --ct: var(--hs-danger-text); --cs: var(--hs-danger-soft); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
:host {--hs-bg: #131211; --hs-surface: #1d1c1a; --hs-surface-2: #262421; --hs-surface-3: #33302c; --hs-surface-solid: #262421;
  --hs-border: #2e2c28; --hs-border-strong: #45413b; --hs-overlay: rgba(0,0,0,.62);
  --hs-text: #f1ede6; --hs-heading: #faf7f1; --hs-text-2: #bdb6aa; --hs-text-3: #989185; --hs-text-inverse: #ffffff;
  --hs-accent: #3d6ddf; --hs-accent-hover: #4a79ea; --hs-accent-soft: #232b3f; --hs-accent-text: #a3c0ff; --hs-focus: #a3c0ff;
  --hs-lit: #ffb547; --hs-lamp-on: #3a2f1a; --hs-on-tile: #2f2c28; --hs-off-tile: #191817; --hs-dim-fill: #48443d;
  --hs-live: #3ddc84; --hs-live-soft: #1b2b22; --hs-live-text: #5fe39a;
  --hs-warning: #f5b043; --hs-warning-soft: #302717; --hs-warning-text: #f7bd62;
  --hs-offline: #8f887c; --hs-offline-soft: #2a2825; --hs-offline-text: #bdb6aa;
  --hs-danger: #ff6b62; --hs-danger-soft: #35201e; --hs-danger-text: #ff938b;
  --hs-toast-bg: #f1ede6; --hs-toast-text: #1b1a18; --hs-toast-act: #1f4fc4;
  --hs-shadow-3: 0 18px 48px rgba(0,0,0,.55);
  --viz-today: #5f88ee; --viz-usual: #a39c90;
  --f-sm: 15px; --f-body: 17px; --f-tile: 19px; --f-h2: 18px; --f-h1: 34px; --f-num: 52px; --f-huge: 88px;
  --hit: 56px; --r-tile: 22px; --r-ctl: 16px; --gap: 16px;
  color-scheme: dark;}
:host([data-hs-scheme="light"]) {--hs-bg: #f2f0ec; --hs-surface: #ffffff; --hs-surface-2: #f7f5f2; --hs-surface-3: #e9e6e0; --hs-surface-solid: #ffffff;
  --hs-border: #e2ded7; --hs-border-strong: #cdc8bf; --hs-overlay: rgba(28,26,22,.42);
  --hs-text: #24221f; --hs-heading: #171614; --hs-text-2: #57524a; --hs-text-3: #6b665d;
  --hs-accent: #2459d6; --hs-accent-hover: #1d4dc0; --hs-accent-soft: #e6edfc; --hs-accent-text: #1c4fc8; --hs-focus: #2459d6;
  --hs-lit: #b86e00; --hs-lamp-on: #fbe8c2; --hs-on-tile: #ffffff; --hs-off-tile: #e9e6e0; --hs-dim-fill: #d3cec5;
  --hs-live: #1fa75a; --hs-live-soft: #e3f4ea; --hs-live-text: #136c3b;
  --hs-warning: #d97706; --hs-warning-soft: #fbefdc; --hs-warning-text: #8f4a05;
  --hs-offline: #8c867b; --hs-offline-soft: #eeebe6; --hs-offline-text: #57524a;
  --hs-danger: #dc2626; --hs-danger-soft: #fbe9e7; --hs-danger-text: #a81c1c;
  --hs-toast-bg: #24221f; --hs-toast-text: #ffffff; --hs-toast-act: #a3c0ff;
  --hs-shadow-3: 0 18px 48px rgba(40,34,24,.18);
  --viz-today: #2459d6; --viz-usual: #7d776d;
  color-scheme: light;}
:host([data-hs-big]) {--f-sm: 17px; --f-body: 19px; --f-tile: 21px; --f-h2: 20px; --f-h1: 36px;}
::selection {background: var(--hs-accent); color: #fff;}
:focus-visible {outline: 3px solid var(--hs-focus); outline-offset: 3px;}
.app-root {transition: opacity 180ms var(--hs-ease);}
.app-root.swap {opacity: 0;}
.hs a {color: inherit; text-decoration: none;}
.hs button, .ovl button, .hs a, .ovl a {touch-action: manipulation; user-select: none; -webkit-user-select: none;}
.hs button, .ovl button, .toasts button {border: 0; background: none; padding: 0; margin: 0;}
.hi {inline-size: 26px; block-size: 26px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round;}
.hi.lit {color: var(--hs-lit);}
.clamp1 {overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0;}
.clamp2 {display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-inline-size: 0; overflow-wrap: anywhere;}
.muted {color: var(--hs-text-2); font-size: var(--f-sm);}
.tile {background: var(--hs-surface); border-radius: var(--r-tile); position: relative; min-inline-size: 0; min-block-size: 0;}
.cover {position: absolute; inset: 0; border-radius: inherit; z-index: 0;}
.tile > :not(.cover):not(.scene-pic):not(.cap) {position: relative; z-index: 1;}
.tile:has(> .cover) {transition: background-color var(--hs-t-med) var(--hs-ease), transform 140ms var(--hs-ease);}
.tile:has(> .cover:active) {transform: scale(.985);}
.hbtn {display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-block-size: var(--hit); padding: 0 22px; border-radius: var(--r-ctl); background: var(--hs-surface-3); color: var(--hs-heading); font-size: var(--f-body); font-weight: 600; white-space: nowrap; min-inline-size: 0; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.hs .hbtn, .ovl .hbtn {border: 0; background: var(--hs-surface-3); padding: 0 22px;}
.hbtn .hi {inline-size: 22px; block-size: 22px;}
.hs .hbtn.strong, .ovl .hbtn.strong {background: var(--hs-accent); color: #fff;}
.hs .hbtn.quiet, .ovl .hbtn.quiet {background: transparent; color: var(--hs-text-2);}
.hbtn.xl {min-block-size: 72px; font-size: 20px; border-radius: 20px;}
.hbtn.wide {inline-size: min(360px, 100%);}
.hbtn.sm {font-size: var(--f-sm); padding: 0 18px !important;}
.hbtn:active, .rb:active, .lamp:active, .chip2:active, .scene:active, .seg button:active, .ltile:active, .zrow:active, .mrow:active {transform: scale(.97);}
.hbtn:disabled, .rb:disabled {opacity: .38; cursor: default; transform: none;}
.hbtn[aria-pressed] .off-t, .hbtn[aria-pressed="false"] .on-t {display: none;}
.hbtn[aria-pressed="false"] .off-t {display: inline;}
.rb {inline-size: var(--hit); block-size: var(--hit); border-radius: 50%; display: inline-grid; place-items: center; flex: none; color: var(--hs-heading); transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.hs .rb, .ovl .rb {background: var(--hs-surface-3);}
.rb.xl {inline-size: 72px; block-size: 72px;}
.rb.xl .hi {inline-size: 32px; block-size: 32px;}
.ovl .rb.onpic {background: rgba(0,0,0,.6); color: #fff;}
.lamp {inline-size: var(--hit); block-size: var(--hit); border-radius: 50%; display: inline-grid; place-items: center; flex: none; color: var(--hs-text-2); transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease, color var(--hs-t-med) ease;}
.hs .lamp {background: var(--hs-surface-3);}
.hs .lamp[aria-pressed="true"] {background: var(--hs-lamp-on); color: var(--hs-lit);}
.seg {display: inline-flex; padding: 4px; border-radius: var(--r-ctl); background: var(--hs-surface-2); gap: 2px; max-inline-size: 100%;}
:host([data-hs-scheme="light"]) .seg {background: var(--hs-surface-3);}
.seg button {position: relative; min-block-size: 48px; padding: 0 20px !important; border-radius: 12px; color: var(--hs-text-2); font-size: var(--f-body); font-weight: 500; white-space: nowrap; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease, color var(--hs-t-med) ease;}
.seg button::after {content: ""; position: absolute; inset: -4px 0;}
.hs .seg button[aria-pressed="true"], .ovl .seg button[aria-pressed="true"] {background: var(--hs-surface-3); color: var(--hs-heading); font-weight: 600;}
:host([data-hs-scheme="light"]) .hs .seg button[aria-pressed="true"], :host([data-hs-scheme="light"]) .ovl .seg button[aria-pressed="true"] {background: #fff;}
.hsw {inline-size: 68px; block-size: var(--hit); display: inline-grid; place-items: center; flex: none;}
.hsw i {inline-size: 64px; block-size: 36px; border-radius: 18px; background: var(--hs-surface-3); position: relative; transition: background-color var(--hs-t-med) ease;}
.hsw i::after {content: ""; position: absolute; inset-block-start: 4px; inset-inline-start: 4px; inline-size: 28px; block-size: 28px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform var(--hs-t-med) var(--hs-ease);}
.hsw[aria-checked="true"] i {background: var(--hs-accent);}
.hsw[aria-checked="true"] i::after {transform: translateX(-28px);}
.dot {inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c, var(--hs-offline)); flex: none; display: inline-block;}
.bar {display: flex; align-items: center; justify-content: space-between; gap: 12px; min-inline-size: 0;}
.bar.wrap {flex-wrap: wrap;}
.hs h2, .ovl h2 {font-size: var(--f-h2); font-weight: 600; color: var(--hs-heading); line-height: 1.3;}
.pager {display: flex; align-items: center; justify-content: center; gap: 14px; flex: none;}
.pager .pg {font-size: var(--f-sm); color: var(--hs-text-2); min-inline-size: 76px; text-align: center; direction: rtl;}
.empty {flex: 1; display: grid; justify-items: center; align-content: center; gap: 8px; text-align: center; color: var(--hs-text-2); padding: 24px; grid-column: 1 / -1; grid-row: 1 / -1;}
.empty .hi {inline-size: 44px; block-size: 44px; color: var(--hs-text-3); margin-block-end: 6px;}
.empty p {max-inline-size: 36ch; font-size: var(--f-body);}
.scene-pic {position: absolute; inset: 0; inline-size: 100%; block-size: 100%; display: block;}
.cap {position: absolute; inset-inline: 0; inset-block-end: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; background: rgba(0,0,0,.6); color: #fff; font-size: var(--f-sm); font-weight: 500; pointer-events: none;}
.live {display: inline-flex; align-items: center; gap: 6px; font-size: 14px; flex: none; --c: #3ddc84;}
.live.onpic {background: rgba(0,0,0,.6); color: #fff; padding: 6px 12px; border-radius: 999px;}
.cam-off {position: absolute; inset: 0; display: grid; justify-items: center; align-content: center; gap: 6px; text-align: center; padding: 16px 16px 44px; color: var(--hs-text-2); background: var(--hs-surface-2); font-size: var(--f-body);}
.cam-off .hi {inline-size: 34px; block-size: 34px; color: var(--hs-text-3);}
.cam-off small {font-size: 14px; color: var(--hs-text-3);}
.cam-off.big {background: #161514; color: #e9e5de; padding: 24px; font-size: 22px;}
.cam-off.big small {color: #b3ada2; font-size: 17px; max-inline-size: 34ch;}
.cam-off.big .hi {inline-size: 56px; block-size: 56px; color: #b3ada2;}
.hs {display: grid; grid-template-columns: 112px minmax(0, 1fr); grid-template-rows: 72px minmax(0, 1fr); block-size: 100vh; block-size: 100dvh; inline-size: 100vw; overflow: hidden; background: var(--hs-bg); color: var(--hs-text); font-size: var(--f-body); line-height: 1.4;}
.hs.bare {grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr);}
.hs.bare .hs-main {grid-row: 1; grid-column: 1; padding: 24px;}
.hs-strip {grid-column: 1 / -1; display: flex; align-items: center; gap: 28px; padding-inline: 28px 22px; min-inline-size: 0;}
.hs-brand {display: flex; align-items: center; gap: 12px; min-inline-size: 0; flex: 0 1 auto; min-block-size: var(--hit); font-weight: 600; color: var(--hs-heading);}
.mark {inline-size: 40px; block-size: 40px; border-radius: 12px; background: var(--hs-surface-3); display: grid; place-items: center; flex: none;}
.mark svg {inline-size: 26px; block-size: 26px; fill: none; stroke: var(--hs-heading); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round;}
.mark.big {inline-size: 64px; block-size: 64px; border-radius: 20px;}
.mark.big svg {inline-size: 40px; block-size: 40px;}
.hs-brand .house {max-inline-size: 22ch;}
.hs-now {display: flex; align-items: baseline; gap: 16px; min-inline-size: 0; flex: 0 2 auto; color: var(--hs-text-2); white-space: nowrap;}
.hs-now .time {font-size: 28px; font-weight: 600; color: var(--hs-heading); letter-spacing: -.3px;}
.hs-now .wx {display: inline-flex; align-items: center; gap: 6px; min-inline-size: 0; align-self: center;}
.hs-now .wx .hi {inline-size: 22px; block-size: 22px;}
.hs-now .wxt {max-inline-size: 14ch;}
.hs-status {margin-inline-start: auto; display: flex; align-items: center; gap: 10px; flex: none; min-inline-size: 0;}
.st-pill {position: relative; display: inline-flex; align-items: center; gap: 9px; min-block-size: 44px; padding: 0 16px; border-radius: 999px; font-size: var(--f-sm); font-weight: 500; color: var(--hs-text); white-space: nowrap; max-inline-size: 30ch;}
.hs .st-pill {background: var(--hs-surface); padding: 0 16px;}
.st-pill > span {overflow: hidden; text-overflow: ellipsis;}
a.st-pill::after, button.st-pill::after {content: ""; position: absolute; inset: -6px 0;}
.st-pill.quiet {color: var(--hs-text-2);}
.hs .st-pill.quiet {background: transparent; padding: 0 6px;}
.st-pill .hi {inline-size: 20px; block-size: 20px;}
.hs .st-pill.call {background: var(--hs-accent); color: #fff;}
.st-btn, .st-me {position: relative; inline-size: var(--hit); block-size: var(--hit); border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--hs-heading);}
.st-btn .count {position: absolute; inset-block-start: 6px; inset-inline-end: 4px; min-inline-size: 22px; block-size: 22px; border-radius: 11px; background: var(--hs-warning); color: #2b1c00; font-size: 13px; font-weight: 700; display: grid; place-items: center; padding: 0 5px;}
.av {inline-size: 44px; block-size: 44px; border-radius: 50%; background: var(--hs-surface-3); color: var(--hs-heading); display: grid; place-items: center; font-weight: 600; font-size: 18px; flex: none;}
.av.lg {inline-size: 56px; block-size: 56px; font-size: 22px;}
.hs.kiosk .st-me {display: none;}
.hs-nav {grid-row: 2; grid-column: 1; display: flex; flex-direction: column; gap: 4px; padding: 0 12px 16px; min-block-size: 0;}
.hs-nav a, .hs-nav button {flex: 1 1 0; max-block-size: 88px; min-block-size: var(--hit); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border-radius: 20px; font-size: 14px; font-weight: 500; color: var(--hs-text-2); transition: background-color var(--hs-t-med) ease, color var(--hs-t-med) ease, transform 120ms var(--hs-ease);}
.hs-nav a:active, .hs-nav button:active {transform: scale(.96);}
.hs-nav [aria-current] {background: var(--hs-surface); color: var(--hs-heading); font-weight: 600;}
.hs-nav [aria-current] .hi {color: var(--hs-accent-text);}
.phone-only {display: none !important;}
.hs-main {grid-row: 2; grid-column: 2; min-inline-size: 0; min-block-size: 0; padding: 4px 28px 24px 12px; display: flex; flex-direction: column; overflow: hidden;}
.hs-main {padding: 4px 12px 24px 28px;}
.hs-head {display: flex; align-items: center; gap: 16px; min-block-size: 76px; flex: none; margin-block-end: 12px; min-inline-size: 0;}
.hs-head .ttl {flex: 1; min-inline-size: 0;}
.hs h1, .ovl h1 {font-size: var(--f-h1); font-weight: 600; letter-spacing: -.02em; line-height: 1.15; color: var(--hs-heading);}
.hs .sub, .ovl .sub {color: var(--hs-text-2); font-size: var(--f-body); margin-block-start: 2px;}
.hs-head .acts {display: flex; align-items: center; gap: 10px; flex: none;}
@keyframes hs-rise { from { opacity: 0; transform: translateY(10px); } }
@keyframes hs-fade { from { opacity: 0; } }
.hs-main.enter > * {animation: hs-rise 280ms var(--hs-ease) both;}
.hs-main.enter > :nth-child(2) {animation-delay: 40ms;}
.hs-main.enter > :nth-child(3) {animation-delay: 80ms;}
.hs-main.enter > :nth-child(n+4) {animation-delay: 120ms;}
.app-root.enter {animation: hs-fade 240ms ease both;}
.hs-greet {flex: none; margin-block: 2px 16px;}
.hs-greet h1 {font-size: var(--f-h1);}
.scenes {display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; flex: none; margin-block-end: 20px;}
.scene {position: relative; overflow: hidden; display: flex; align-items: center; gap: 12px; min-block-size: 84px; padding: 0 20px !important; border-radius: var(--r-tile); color: var(--hs-heading); font-size: var(--f-tile); font-weight: 600; text-align: start; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.hs .scene {background: var(--hs-surface);}
.scene > * {position: relative;}
.scene .hi {inline-size: 30px; block-size: 30px; color: var(--hs-text-2);}
.scene .sn {flex: 1; min-inline-size: 0; line-height: 1.2;}
.scene .sa {display: grid; opacity: 0; transform: scale(.9); transition: opacity 200ms ease, transform 200ms var(--hs-ease);}
.scene .sa .hi {inline-size: 22px; block-size: 22px; color: var(--hs-accent-text);}
.scene::before {content: ""; position: absolute; inset: 0; background: var(--hs-accent-soft); clip-path: inset(0 0 0 100%); transition: clip-path 200ms var(--hs-ease);}
.scene[aria-pressed="true"]::before {clip-path: inset(0 0 0 0);}
.scene.run::before {transition: clip-path 520ms var(--hs-ease-in-out);}
.scene[aria-pressed="true"] .hi {color: var(--hs-accent-text);}
.scene[aria-pressed="true"] .sa {opacity: 1; transform: none; transition-delay: 260ms;}
.home-body {flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.12fr); gap: 24px;}
.favs {display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 14px; min-block-size: 0;}
.favs.n1 {grid-template: minmax(0, 1fr) / minmax(0, 1fr);}
.favs.n2 {grid-template-rows: minmax(0, 1fr);}
.favs.n5, .favs.n6 {grid-template-columns: repeat(3, minmax(0, 1fr));}
.fav {display: flex; flex-direction: column; padding: 18px 20px 18px; gap: 4px; overflow: hidden;}
.fh {display: flex; align-items: center; gap: 10px; color: var(--hs-text-2); min-inline-size: 0;}
.fh h2 {font-size: var(--f-h2); font-weight: 500; color: var(--hs-text-2); min-inline-size: 0;}
.fv {flex: 1; display: flex; align-items: baseline; align-content: center; flex-wrap: wrap; gap: 4px 10px; color: var(--hs-text-2); min-block-size: 0; pointer-events: none;}
.big {font-size: var(--f-num); font-weight: 500; line-height: 1; letter-spacing: -.02em; color: var(--hs-heading);}
.mid {font-size: 26px; font-weight: 600; color: var(--hs-heading); display: inline-flex; align-items: center; gap: 10px; line-height: 1.2;}
.fav .hbtn {inline-size: 100%;}
.pm {display: flex; gap: 10px; align-items: center;}
.fav.pic {padding: 0;}
.favs.n5 .fav .hbtn, .favs.n6 .fav .hbtn {padding: 0 12px; font-size: var(--f-sm);}
.favs.n5 .big, .favs.n6 .big {font-size: 40px;}
.home-rooms {display: flex; flex-direction: column; gap: 12px; min-block-size: 0;}
.room-grid {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 14px;}
.room {display: flex; padding: 16px 18px; overflow: hidden;}
.room .rt {display: grid; align-content: start; gap: 4px; min-inline-size: 0; flex: 1; pointer-events: none;}
.room .rt b {font-size: var(--f-tile); font-weight: 600; color: var(--hs-heading); line-height: 1.25;}
.room .meta {color: var(--hs-text-2); font-size: var(--f-sm);}
.room .lamp {position: absolute !important; inset-block-end: 14px; inset-inline-end: 14px;}
.floors-cols {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 16px;}
.fcol {display: flex; flex-direction: column; gap: 10px; min-block-size: 0; min-inline-size: 0;}
.fch {display: grid; gap: 0; padding-inline: 6px; flex: none;}
.fcl {flex: 1; min-block-size: 0; display: grid; grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 10px;}
.fcl .room, .room-list .room {align-items: center; padding: 0 16px;}
.fcl .room .rt b, .room-list .room .rt b {font-size: var(--f-body); -webkit-line-clamp: 1;}
.fcl .room .lamp, .room-list .room .lamp {position: relative !important; inset: auto;}
.room-list {flex: 1; min-block-size: 0; display: grid; grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 10px; margin-block: 12px;}
.chips {display: flex; gap: 10px; flex: none; margin-block-end: 16px; min-inline-size: 0;}
.chip2 {min-block-size: var(--hit); padding: 0 24px !important; border-radius: 999px; color: var(--hs-heading); font-size: var(--f-body); font-weight: 500; min-inline-size: 0; flex: 0 1 auto; display: inline-flex; align-items: center; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease, color var(--hs-t-med) ease;}
.hs .chip2 {background: var(--hs-surface);}
.hs .chip2[aria-pressed="true"] {background: var(--hs-accent-soft); color: var(--hs-accent-text); font-weight: 600;}
.room-body {flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px;}
.room-body.solo {grid-template-columns: minmax(0, 820px);}
.pane.pic.tall {flex: 1; min-block-size: 200px; padding: 0 !important;}
.hs .pane.pic.tall {background: #000;}
.pane {padding: 16px 20px 18px; display: flex; flex-direction: column; gap: 8px; overflow: hidden;}
.pane > .bar {min-block-size: var(--hit); flex: none;}
.lights-pane .pager {margin-block-start: auto;}
.lrow {display: grid; grid-template-columns: var(--hit) minmax(0, 1fr) minmax(0, 1.5fr); align-items: center; gap: 14px; min-block-size: 64px;}
.lrow .ln {font-size: var(--f-body); font-weight: 500; color: var(--hs-heading); line-height: 1.25;}
.dim {position: relative; display: block; block-size: var(--hit); border-radius: var(--r-ctl); background: var(--hs-surface-3); overflow: hidden; cursor: pointer;}
.dim-fill {position: absolute; inset: 0; background: var(--hs-dim-fill); transform-origin: 100% 50%; transition: transform 160ms var(--hs-ease);}
.dim-edge {position: absolute; inset: 0; pointer-events: none; transition: transform 160ms var(--hs-ease), opacity 160ms ease; opacity: 0;}
.dim-edge i {position: absolute; inset-block: 14px; left: calc(100% + 8px); inline-size: 4px; border-radius: 2px; background: var(--hs-lit);}
.lrow.is-on .dim-edge {opacity: 1;}
.dim:active .dim-edge {transition: none;}
.dim:active .dim-fill {transition: none;}
.dim input {position: absolute; inset: 0; inline-size: 100%; block-size: 100%; margin: 0; opacity: 0; cursor: pointer; touch-action: pan-y; font-size: 16px;}
.dim-v {position: absolute; right: 16px; inset-block: 0; display: grid; align-items: center; font-size: var(--f-sm); font-weight: 600; color: var(--hs-heading); pointer-events: none;}
.dim:has(input:focus-visible) {outline: 3px solid var(--hs-focus); outline-offset: 3px;}
.side {display: flex; flex-direction: column; gap: 16px; min-block-size: 0; min-inline-size: 0;}
.side .pane {flex: none;}
.side .pane.pic {flex: 1; min-block-size: 110px; padding: 0; text-align: start;}
.hs .side .pane.pic {background: var(--hs-surface); padding: 0;}
.cmini {display: flex; align-items: center; justify-content: space-between; gap: 12px;}
.cm-t {display: grid; gap: 2px; min-inline-size: 0;}
.cmini .big {font-size: 44px;}
.srow2 {display: flex; align-items: center; justify-content: space-between; gap: 12px; min-block-size: 64px;}
.sn2 {display: grid; min-inline-size: 0; font-weight: 500; color: var(--hs-heading);}
.sn2 .muted {font-weight: 400;}
.trio {display: flex; gap: 8px; flex: none;}
.light-grid {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 14px; margin-block: 14px;}
.ltile {display: flex; align-items: center; gap: 14px; padding: 0 20px !important; text-align: start; color: var(--hs-text-2); border-radius: var(--r-tile) !important; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.hs .ltile {background: var(--hs-off-tile);}
.ltile .lt {display: grid; gap: 2px; flex: 1; min-inline-size: 0;}
.ltile b {font-size: var(--f-body); font-weight: 600; color: var(--hs-heading);}
.ltile .lv {font-size: var(--f-sm); font-weight: 600; flex: none;}
.hs .ltile.is-on {background: var(--hs-on-tile);}
.ltile.is-on > .hi {color: var(--hs-lit);}
.ltile.is-on .lv {color: var(--hs-heading);}
.lrow.is-on .dim-v {color: var(--hs-heading);}
.clim-body {flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px;}
.thermo {display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 8px; padding: 20px 24px 22px; overflow: hidden;}
.thermo > h2 {align-self: stretch;}
.dial-wrap {position: relative; inline-size: min(100%, 54vh, 440px); aspect-ratio: 1; flex: none;}
.dial {position: absolute; inset-inline: 0; inset-block-start: 0; inline-size: 100%; aspect-ratio: 1;}
.dial path {fill: none; stroke-width: 14; stroke-linecap: round;}
.dial .trk {stroke: var(--hs-surface-3);}
.dial .val {stroke: var(--hs-accent);}
.dial[data-mode="heat"] .val {stroke: var(--hs-lit);}
.dial .now {fill: var(--hs-heading); stroke: var(--hs-surface); stroke-width: 4;}
.dial-c {position: absolute; inset: 0 0 10% 0; display: grid; justify-items: center; align-content: center; gap: 2px; text-align: center; pointer-events: none;}
.huge {font-size: var(--f-huge); font-weight: 500; letter-spacing: -.03em; line-height: 1; color: var(--hs-heading);}
.dial-pm {position: absolute; inset-inline: 0; inset-block-end: 1%; display: flex; justify-content: center; gap: 20px; direction: ltr;}
.dc-s {color: var(--hs-text); font-weight: 500;}
.zone-list {display: grid; grid-template-rows: repeat(5, minmax(0, 1fr)) auto; gap: 12px; min-block-size: 0;}
.zrow {display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 22px !important; text-align: start; border-radius: var(--r-tile) !important; color: var(--hs-heading); transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.hs .zrow {background: var(--hs-surface);}
.hs .zrow[aria-pressed="true"] {background: var(--hs-accent-soft);}
.zrow .zn {font-size: var(--f-tile); font-weight: 600;}
.zrow .zt {display: grid; justify-items: end; flex: none;}
.zrow .zt b {font-size: 26px; font-weight: 600; line-height: 1.1;}
.doors-body {flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px;}
.door-list {display: grid; grid-template-rows: repeat(4, minmax(0, 1fr)) auto; gap: 12px; min-block-size: 0;}
.drow {display: grid; grid-template-columns: var(--hit) minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 0 20px;}
.di, .ai, .dlg-ic {inline-size: var(--hit); block-size: var(--hit); border-radius: 50%; display: grid; place-items: center; background: var(--cs, var(--hs-surface-3)); color: var(--ct, var(--hs-text-2)); flex: none;}
.dn {display: grid; gap: 2px; min-inline-size: 0;}
.dn b {font-size: var(--f-tile); font-weight: 600; color: var(--hs-heading); line-height: 1.25;}
.dst {display: inline-flex; align-items: center; gap: 8px; font-size: var(--f-sm); color: var(--hs-text-2);}
.drow .hbtn {min-inline-size: 96px;}
.visitors {gap: 4px;}
.vrow {display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; align-items: center; gap: 14px; flex: 1; min-block-size: 68px; max-block-size: 96px;}
.vp {position: relative; inline-size: 96px; block-size: 60px; border-radius: 12px; overflow: hidden; background: #000;}
.vn {display: grid; min-inline-size: 0;}
.vn b {font-weight: 600; color: var(--hs-heading);}
.vr {display: grid; justify-items: end; font-size: var(--f-sm); color: var(--hs-text-2); max-inline-size: 16ch; text-align: end;}
.vres {color: var(--ct, var(--hs-text-2)); font-weight: 500;}
.hscrim {position: fixed; inset: 0; z-index: 40; background: var(--hs-overlay); transition: opacity 240ms ease;}
.hscrim.solid {background: #0a0a09;}
.hscrim.clear {background: rgba(0,0,0,.28);}
.call {position: fixed; inset: 0; z-index: 41; display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(320px, 1fr); background: var(--hs-bg); transition: opacity 260ms ease, transform 320ms var(--hs-ease-drawer);}
.call-video {position: relative; overflow: hidden; background: #000;}
.call-video .live {position: absolute; inset-block-start: 20px; inset-inline-start: 20px;}
.call-side {display: flex; flex-direction: column; justify-content: center; gap: 10px; padding: 40px 36px; min-inline-size: 0; background: var(--hs-surface);}
.call-side h1 {font-size: 36px; overflow-wrap: anywhere;}
.call-acts {display: grid; gap: 12px; margin-block-start: 22px;}
.ring-line, .ok-line {display: inline-flex; align-items: center; gap: 10px; font-weight: 600; font-size: var(--f-body); color: var(--hs-accent-text);}
.ok-line {color: var(--hs-live-text);}
@keyframes hs-ring { 0%, 36%, 100% { transform: rotate(0); } 6%, 18% { transform: rotate(-14deg); } 12%, 24% { transform: rotate(14deg); } 30% { transform: rotate(-6deg); } }
.ring-line .hi {transform-origin: 50% 10%; animation: hs-ring 2.2s var(--hs-ease-in-out) infinite;}
.cam-grid {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 14px;}
.cam-grid.n1 {grid-template: minmax(0, 1fr) / minmax(0, 1fr);}
.cam-grid.n2 {grid-template: minmax(0, 1fr) / repeat(2, minmax(0, 1fr));}
.cam-grid.n3, .cam-grid.n4 {grid-template-columns: repeat(2, minmax(0, 1fr));}
.cam-t {overflow: hidden; border-radius: var(--r-tile) !important; transition: transform 140ms var(--hs-ease);}
.hs .cam-t {background: #000;}
.cam-t:active {transform: scale(.985);}
.camfull {position: fixed; inset: 0; z-index: 41; background: #0a0a09; transition: opacity 220ms ease, transform 260ms var(--hs-ease);}
.cf-pic {position: absolute; inset: 0;}
.cf-bar {position: absolute; inset-inline: 0; inset-block-start: 0; display: flex; align-items: center; gap: 16px; padding: 20px 24px; color: #fff;}
.cf-t {flex: 1; min-inline-size: 0; display: flex; align-items: center; gap: 12px; font-size: 22px;}
.cf-t b {font-weight: 600; background: rgba(0,0,0,.6); padding: 8px 16px; border-radius: 999px;}
.cf-nav {display: flex; gap: 10px;}
.en-body {flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px;}
.legend {display: flex; gap: 18px; font-size: var(--f-sm); color: var(--hs-text-2);}
.legend span, .tip span {display: inline-flex; align-items: center; gap: 8px;}
.k {display: inline-block; flex: none;}
.k.today {inline-size: 12px; block-size: 12px; border-radius: 3px; background: var(--viz-today);}
.k.usual {inline-size: 16px; block-size: 3px; border-radius: 2px; background: var(--viz-usual);}
.plot {position: relative; flex: 1; min-block-size: 120px; direction: ltr; margin-block-start: 6px;}
.yax {position: absolute; inset: 10px 0 28px 0;}
.yax span {position: absolute; inset-inline: 0; block-size: 0; border-block-start: 1px solid var(--hs-border);}
.yax em {position: absolute; left: 0; top: -20px; font-style: normal; font-size: 13px; color: var(--hs-text-3);}
.cols {position: absolute; inset: 10px 0 28px 34px; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 2px;}
.col {position: relative; display: flex; align-items: flex-end; justify-content: center; border-radius: 4px; outline-offset: -2px !important;}
.col .b {display: block; inline-size: min(100%, 30px); border-radius: 4px 4px 0 0; background: var(--viz-today);}
.col .u {position: absolute; inset-inline: 4%; block-size: 3px; margin-block-end: -1.5px; border-radius: 2px; background: var(--viz-usual); box-shadow: 0 0 0 2px var(--hs-surface);}
.col.hot {background: var(--hs-surface-2);}
.xax {position: absolute; inset: auto 0 0 34px; block-size: 22px; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 2px; text-align: center; font-size: 13px; color: var(--hs-text-3); white-space: nowrap;}
.xax em {font-style: normal;}
.tip {position: absolute; top: 0; z-index: 3; transform: translateX(-50%); direction: rtl; display: grid; gap: 2px; padding: 10px 14px; border-radius: 12px; background: var(--hs-toast-bg); color: var(--hs-toast-text); font-size: 14px; white-space: nowrap; pointer-events: none; box-shadow: var(--hs-shadow-3);}
.tip[hidden] {display: none;}
.unit {font-size: 13px; color: var(--hs-text-3); flex: none;}
.byroom {gap: 0; justify-content: space-between;}
.hb {display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding-block: 6px;}
.hl {font-weight: 500; color: var(--hs-heading);}
.hv {color: var(--hs-text-2); font-size: var(--f-sm); font-weight: 600;}
.ht {grid-column: 1 / -1; block-size: 10px; border-radius: 5px; background: var(--hs-surface-3); overflow: hidden;}
.ht i {display: block; block-size: 100%; border-radius: 5px; background: var(--viz-today); transform-origin: 100% 50%;}
.alert-list {flex: 1; min-block-size: 0; display: grid; grid-template-rows: repeat(5, minmax(0, 1fr)); gap: 12px; margin-block-end: 12px;}
.arow {display: grid; grid-template-columns: var(--hit) minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 0 20px;}
.at {display: grid; gap: 2px; min-inline-size: 0;}
.at b {font-size: var(--f-tile); font-weight: 600; color: var(--hs-heading); line-height: 1.3;}
.arow .hbtn {max-inline-size: 240px;}
.arow.done .at b {font-weight: 500; color: var(--hs-text);}
.done-t {display: inline-flex; align-items: center; gap: 6px;}
.done-t .hi {inline-size: 20px; block-size: 20px;}
.hint {color: var(--hs-text-2); font-size: var(--f-body); margin-block: 14px 12px; flex: none;}
.bar.wrap .hint {flex: 1 1 auto;}
.bar.wrap .hint {margin-block: 0;}
.set-list {display: grid; gap: 12px; align-content: start; min-block-size: 0;}
.set-list.two {grid-template-columns: repeat(2, minmax(0, 1fr));}
.setrow {display: flex; align-items: center; gap: 14px; min-block-size: 80px; padding: 0 20px; color: var(--hs-heading); min-inline-size: 0;}
.setrow.flat {padding: 0; min-block-size: 72px; justify-content: space-between;}
.setrow .sname {flex: 1; min-inline-size: 0; display: grid; font-size: var(--f-tile); font-weight: 600;}
.setrow .sname b {font-weight: 600;}
.setrow .sname .muted {font-weight: 400;}
.setrow.offrow .sname {color: var(--hs-text-2); font-weight: 500;}
.mv {display: flex; gap: 8px; flex: none;}
.set-view {display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-block-start: 14px; align-items: start;}
.hs-main > .bar {flex: none;}
.face-choice {display: grid; gap: 10px;}
.face-choice button {display: grid; grid-template-columns: 76px minmax(0, 1fr) 28px; align-items: center; gap: 14px; min-block-size: 84px; padding: 10px 14px !important; border-radius: 18px; text-align: start; color: var(--hs-heading); outline: 2px solid transparent; outline-offset: -2px; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease, outline-color var(--hs-t-med) ease;}
.hs .face-choice button, .ovl .face-choice button {background: var(--hs-surface-2);}
:host([data-hs-scheme="light"]) .hs .face-choice button, :host([data-hs-scheme="light"]) .ovl .face-choice button {background: var(--hs-surface-2);}
.face-choice button[aria-checked="true"] {outline-color: var(--hs-accent-text);}
.hs .face-choice button[aria-checked="true"], .ovl .face-choice button[aria-checked="true"] {background: var(--hs-accent-soft);}
.face-choice button:active {transform: scale(.985);}
.face-choice button:disabled {opacity: .55;}
.fc-t {display: grid; gap: 1px; min-inline-size: 0;}
.fc-t b {font-size: var(--f-body); font-weight: 600;}
.fc-t span {font-size: var(--f-sm); color: var(--hs-text-2);}
.tick {color: var(--hs-accent-text); opacity: 0; transition: opacity 160ms ease;}
[aria-checked="true"] > .tick {opacity: 1;}
.fc-pic, .wl-pic {display: grid; gap: 4px; padding: 6px; border-radius: 10px; background: var(--hs-bg);}
.fc-pic {inline-size: 76px; block-size: 52px;}
.fc-pic i, .wl-pic i {border-radius: 4px; background: var(--hs-surface-3);}
.fc-pic.home {grid-template-columns: 1fr 1fr;}
.fc-pic.home i:first-child, .wl-pic.home i:nth-child(2) {background: var(--hs-accent);}
.fc-pic.full {grid-template-columns: 9px 1fr 1fr; grid-template-rows: repeat(3, 1fr); gap: 3px;}
.fc-pic.full i:first-child {grid-row: 1 / -1;}
.fc-pic.full i:nth-child(2) {grid-column: 2 / -1;}
.lock-note {display: flex; align-items: center; gap: 8px; color: var(--hs-text-2); font-size: var(--f-sm); margin-block-start: 10px;}
.lock-note .hi {inline-size: 20px; block-size: 20px;}
.sheet {position: fixed; z-index: 42; background: var(--hs-surface-solid); color: var(--hs-text); box-shadow: var(--hs-shadow-3); font-size: var(--f-body);}
.sheet.dialog {inset-block-start: 50%; left: 50%; translate: -50% -50%; inline-size: min(440px, calc(100vw - 32px)); border-radius: 28px; padding: 28px; display: grid; gap: 10px; justify-items: start; transition: opacity 200ms ease, transform 240ms var(--hs-ease);}
.sheet.dialog.wide {inline-size: min(620px, calc(100vw - 32px)); justify-items: stretch; gap: 4px;}
.dlg-ic {--cs: var(--hs-accent-soft); --ct: var(--hs-accent-text); margin-block-end: 6px;}
.sheet.dialog h2 {font-size: 24px; overflow-wrap: anywhere;}
.dlg-acts {display: grid; grid-template-columns: 1fr 1fr; gap: 12px; inline-size: 100%; margin-block-start: 16px;}
.sheet.umenu {inset-block-start: 76px; left: 22px; inline-size: min(400px, calc(100vw - 32px)); border-radius: 26px; padding: 18px; display: grid; gap: 12px; transform-origin: 28px 0; transition: opacity 180ms ease, transform 220ms var(--hs-ease);}
.sheet.umenu.at-rail {inset-block: auto 16px; left: auto; right: 84px; transform-origin: 100% 100%; font-family: var(--hs-font);}
.sheet.umenu h3 {font-size: var(--f-sm); font-weight: 500; color: var(--hs-text-2); margin-block-start: 4px;}
.menu-h {display: flex; align-items: center; gap: 14px; min-inline-size: 0;}
.mh-t {flex: 1; min-inline-size: 0; display: grid;}
.mh-t b {font-size: var(--f-tile); font-weight: 600; color: var(--hs-heading);}
.menu-rows, .pick-list {display: grid; gap: 2px;}
.mrow {display: flex; align-items: center; gap: 14px; min-block-size: var(--hit); padding: 0 12px !important; border-radius: 14px; color: var(--hs-heading); font-size: var(--f-body); font-weight: 500; text-align: start; text-decoration: none; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.mrow > span {flex: 1; min-inline-size: 0;}
.mrow > .hi:last-child {inline-size: 20px; block-size: 20px; color: var(--hs-text-3);}
.ovl .mrow[aria-pressed="true"] {background: var(--hs-accent-soft);}
.sheet.bottom {inset-inline: 0; inset-block-end: 0; border-radius: 28px 28px 0 0; padding: 10px 16px calc(20px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 12px; transition: transform 320ms var(--hs-ease-drawer);}
.grab {justify-self: center; inline-size: 44px; block-size: 5px; border-radius: 3px; background: var(--hs-border-strong);}
.more-grid {display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;}
.mt {display: grid; justify-items: center; align-content: center; gap: 8px; min-block-size: 92px; font-weight: 500; color: var(--hs-heading); text-decoration: none;}
.ovl .mt {background: var(--hs-surface-3);}
@starting-style { .hscrim {opacity: 0;}
.sheet.dialog, .sheet.umenu {opacity: 0; transform: scale(.96);}
.sheet.bottom {transform: translateY(100%);}
.call, .camfull {opacity: 0; transform: scale(1.02);} }
.hscrim.out {opacity: 0; transition-duration: 160ms;}
.sheet.dialog.out, .sheet.umenu.out {opacity: 0; transform: scale(.98); transition-duration: 140ms;}
.sheet.bottom.out {transform: translateY(100%); transition-duration: 200ms;}
.call.out, .camfull.out {opacity: 0; transition-duration: 160ms;}
.ovl .still {transition: none !important;}
.toasts {position: fixed; inset-inline: 0; inset-block-end: 24px; z-index: 60; display: grid; justify-items: center; pointer-events: none; padding-inline: 16px;}
.toast2 {--hit: 56px; pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; min-block-size: 64px; padding-inline: 22px 6px; border-radius: 18px; background: var(--hs-toast-bg); color: var(--hs-toast-text); font-family: var(--hs-font); font-size: 17px; font-weight: 500; box-shadow: var(--hs-shadow-3); max-inline-size: 100%; transition: opacity 200ms ease, transform 240ms var(--hs-ease);}
.toast2 > span {padding-inline-end: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;}
.toasts .toast2 button {min-block-size: var(--hit); padding: 0 18px; border-radius: 14px; color: var(--hs-toast-act); font-weight: 700; font-size: 17px; cursor: pointer;}
@starting-style { .toast2 {opacity: 0; transform: translateY(14px);} }
.toast2.out {opacity: 0; transform: translateY(8px); transition-duration: 160ms;}
.welcome {margin: auto; inline-size: min(940px, 100%); display: grid; justify-items: center; text-align: center; gap: 8px;}
.welcome h1 {margin-block-start: 14px; text-wrap: balance;}
.wl-choice {display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; inline-size: 100%; margin-block: 24px;}
.wl {display: grid; gap: 8px; padding: 22px !important; text-align: start; color: var(--hs-text-2); font-size: var(--f-body); border-radius: 26px !important; outline: 2px solid transparent; outline-offset: -2px; transition: transform 140ms var(--hs-ease), outline-color var(--hs-t-med) ease, background-color var(--hs-t-med) ease; align-content: start;}
.hs .wl {background: var(--hs-surface);}
.hs .wl[aria-checked="true"] {background: var(--hs-accent-soft); outline-color: var(--hs-accent-text);}
.wl:active {transform: scale(.985);}
.wl b {font-size: 24px; font-weight: 700; color: var(--hs-heading);}
.wl .tick {position: absolute !important; inset-block-start: 34px; inset-inline-end: 34px; inline-size: 32px; block-size: 32px;}
.wl-pic {block-size: 150px; padding: 12px; gap: 8px; border-radius: 16px; margin-block-end: 8px;}
.wl-pic i {border-radius: 8px;}
.wl-pic.home {grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr;}
.wl-pic.full {grid-template-columns: 16px repeat(4, 1fr); grid-template-rows: 14px 1fr 1fr; gap: 5px;}
.wl-pic.full i {border-radius: 4px;}
.wl-pic.full i:first-child {grid-row: 1 / -1;}
.wl-pic.full i:nth-child(2) {grid-column: 2 / 4;}
.wl-pic.full i:nth-child(3) {grid-column: 4 / -1;}
.wl-pic.full i:nth-child(4) {grid-row: 2 / -1;}
.wl-pic.full i:nth-child(5) {grid-column: 3 / -1;}
@media (max-width: 767px) {
.sheet.umenu.at-rail {right: 12px; inset-block-end: 68px;}
}
@media (min-width: 1400px) and (min-height: 860px) {
:host {--f-h1: 38px; --f-num: 60px; --f-huge: 100px;}
.hs {grid-template-columns: 124px minmax(0, 1fr); grid-template-rows: 80px minmax(0, 1fr);}
.hs-main, .hs-main {padding-block-end: 32px; padding-inline: 16px 36px;}
.scene {min-block-size: 96px;}
}
@media (max-width: 700px) {
:host {--f-sm: 14px; --f-body: 16px; --f-tile: 17px; --f-h2: 16px; --f-h1: 26px; --f-num: 38px; --f-huge: 72px; --hit: 48px; --r-tile: 18px; --r-ctl: 14px;}
:host([data-hs-big]) {--f-sm: 15px; --f-body: 17px; --f-tile: 18px;}
.hs {grid-template-columns: minmax(0, 1fr); grid-template-rows: calc(56px + env(safe-area-inset-top, 0px)) minmax(0, 1fr) auto;}
.hs-strip {gap: 10px; padding-inline: 16px 8px; padding-block-start: env(safe-area-inset-top, 0px);}
.hs-brand .house, .hs-now .date, .hs-now .wx, .st-pill.quiet, .wide-only {display: none !important;}
.hs-brand {min-inline-size: 44px; justify-content: center;}
.mark {inline-size: 34px; block-size: 34px; border-radius: 10px;}
.mark svg {inline-size: 22px; block-size: 22px;}
.hs-now {gap: 10px;}
.hs-now .time {font-size: 22px;}
.hs-status {gap: 2px;}
.st-pill {min-block-size: 36px; font-size: 13px; max-inline-size: 150px;}
.hs .st-pill {padding: 0 12px;}
.st-pill.call > span {display: none;}
.av {inline-size: 36px; block-size: 36px; font-size: 15px;}
.hs-main, .hs-main {grid-row: 2; grid-column: 1; padding: 2px 16px 10px;}
.hs-nav {grid-row: 3; grid-column: 1; flex-direction: row; gap: 2px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px)); background: var(--hs-surface);}
.hs-nav a, .hs-nav button {min-block-size: 56px; font-size: 12px; gap: 3px; border-radius: 14px;}
.hs-nav [aria-current] {background: var(--hs-surface-2);}
.phone-only {display: flex !important;}
.hs-head {min-block-size: 60px; margin-block-end: 8px; gap: 10px; flex-wrap: wrap;}
.hs-head .acts {margin-inline-start: auto;}
.hs-greet {margin-block: 0 10px;}
.hs-greet h1 {font-size: 28px;}
.scenes {gap: 8px; margin-block-end: 12px;}
.scene {flex-direction: column; justify-content: center; gap: 4px; min-block-size: 76px; padding: 4px 2px !important; font-size: 13px; text-align: center;}
.scene .sn {flex: none;}
.scene .sa {display: none;}
.scene .hi {inline-size: 24px; block-size: 24px;}
.home-body {display: flex; flex-direction: column; gap: 12px;}
.favs, .favs.n5, .favs.n6 {grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; flex: 1 1 0;}
.fav {display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto minmax(0, 1fr); padding: 12px 14px; column-gap: 6px;}
.fav .fh {grid-column: 1 / -1;}
.fav .fh .hi {inline-size: 22px; block-size: 22px;}
.fav .fv {align-self: end;}
.fav .hbtn, .fav .pm {align-self: end;}
.fav .hbtn {inline-size: var(--hit); padding: 0 !important; border-radius: 50%;}
.fav .hbtn .bt, .fav[data-fav="doors"] .hbtn, .fav .fsub, .hs-head .hbtn .bt {display: none;}
.hs-head .acts .hbtn:has(.bt) {inline-size: var(--hit); padding: 0 !important; border-radius: 50%;}
.fav .pm {gap: 6px;}
.fav .pm .rb {inline-size: 44px; block-size: 44px;}
.mid {font-size: 20px;}
.fav > .muted {grid-column: 1 / -1;}
.home-rooms {flex: 1.1 1 0; gap: 8px;}
.home-rooms .bar h2 {display: none;}
.home-rooms .seg {inline-size: 100%;}
.seg button {flex: 1 0 auto; min-inline-size: 48px; padding: 0 12px !important; min-block-size: 40px;}
.room-grid {grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;}
.room {padding: 12px 14px;}
.room .lamp {inset-block-end: 10px; inset-inline-end: 10px; inline-size: 44px; block-size: 44px;}
.room .rt b {-webkit-line-clamp: 1;}
.room-body, .clim-body, .doors-body, .en-body, .set-view {display: flex; flex-direction: column; gap: 12px;}
.chips {gap: 8px; margin-block-end: 10px;}
.chip2 {flex: 1 1 0; justify-content: center; padding: 0 10px !important; font-size: 15px;}
.pane {padding: 10px 14px 12px; gap: 6px;}
.lrow {grid-template-columns: var(--hit) minmax(0, 1fr) minmax(0, 1.2fr); gap: 10px; min-block-size: 56px;}
.lrow .ln {font-size: 15px;}
.lights-pane {flex: 1 1 auto;}
.side {gap: 12px; flex: 0 0 auto;}
.side .pane.pic {min-block-size: 96px; flex: 1 0 96px;}
.srow2 {min-block-size: 52px;}
.trio .rb, .cmini .rb {inline-size: 44px; block-size: 44px;}
.cmini .big {font-size: 34px;}
.light-grid {grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 10px; margin-block: 10px;}
.ltile {padding: 0 12px !important; gap: 8px;}
.ltile > .hi {inline-size: 22px; block-size: 22px;}
.ltile b {font-size: 15px;}
.thermo {flex: 1; padding: 14px 16px 16px;}
.dial-wrap {inline-size: min(100%, 40vh);}
.hs-head .acts .hbtn {max-inline-size: 46vw;}
.thermo .seg {inline-size: 100%;}
.door-list {grid-template-rows: repeat(3, minmax(0, 1fr)) auto; flex: 1.3 1 0; gap: 10px;}
.drow {padding: 0 14px; gap: 12px;}
.drow .hbtn {min-inline-size: 76px; padding: 0 14px;}
.visitors {flex: 1 1 0;}
.vrow {grid-template-columns: 72px minmax(0, 1fr) auto; gap: 10px; min-block-size: 56px;}
.vp {inline-size: 72px; block-size: 46px;}
.vr {max-inline-size: 11ch; font-size: 13px;}
.cam-grid, .cam-grid.n3, .cam-grid.n4 {grid-template-columns: minmax(0, 1fr); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 10px;}
.cam-grid.n1 {grid-template-rows: minmax(0, .45fr);}
.cam-grid.n2 {grid-template: repeat(2, minmax(0, .5fr)) / minmax(0, 1fr); align-content: start;}
.chart {flex: 1.25 1 0;}
.byroom {flex: 1 1 0;}
.byroom .hb:nth-of-type(n+4), .byroom .unit {display: none;}
.hb {padding-block: 3px;}
.legend {gap: 12px;}
.alert-list {grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 10px;}
.arow {padding: 0 14px; gap: 12px; grid-template-columns: 44px minmax(0, 1fr) auto;}
.arow .ai {inline-size: 44px; block-size: 44px;}
.at b {font-size: 15px;}
.arow .hbtn {max-inline-size: 104px; padding: 0 12px; font-size: 14px; white-space: normal; line-height: 1.15;}
.set-list.two {grid-template-columns: minmax(0, 1fr);}
.set-list {gap: 8px;}
.setrow {min-block-size: 60px; padding: 0 14px; gap: 8px;}
.setrow.flat {min-block-size: 60px; flex-wrap: wrap;}
.hint {margin-block: 8px; font-size: 15px;}
.mv .rb {inline-size: 44px; block-size: 44px;}
.mv {gap: 4px;}
.set-view {margin-block-start: 10px;}
.face-choice button {min-block-size: 72px; grid-template-columns: 60px minmax(0, 1fr) 24px; gap: 10px;}
.fc-pic {inline-size: 60px; block-size: 44px;}
.call {grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto;}
.call-side {padding: 22px 20px calc(22px + env(safe-area-inset-bottom, 0px)); gap: 6px;}
.call-side h1 {font-size: 28px;}
.call-acts {margin-block-start: 12px; gap: 10px;}
.hbtn.xl {min-block-size: 60px; font-size: 18px;}
.cf-bar {padding: calc(12px + env(safe-area-inset-top, 0px)) 12px 12px; gap: 8px;}
.cf-t {font-size: 17px;}
.cf-t .live {display: none;}
.sheet.umenu {inset: auto 0 0 0; inline-size: auto; border-radius: 28px 28px 0 0; padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px)); transform-origin: 50% 100%; transition: transform 320ms var(--hs-ease-drawer);}
@starting-style { .sheet.umenu {opacity: 1; transform: translateY(100%);} }
.sheet.umenu.out {opacity: 1; transform: translateY(100%); transition-duration: 200ms;}
.toasts {inset-block-end: calc(80px + env(safe-area-inset-bottom, 0px));}
.toast2 {min-block-size: 52px; font-size: 15px;}
.wl-choice {grid-template-columns: minmax(0, 1fr); gap: 12px; margin-block: 14px;}
.wl {padding: 14px !important; font-size: 15px; gap: 4px;}
.wl-pic {block-size: 64px; padding: 8px; gap: 5px;}
.wl b {font-size: 20px;}
.wl .tick {inset-block-start: 20px; inset-inline-end: 20px;}
.hs.bare .hs-main {padding: 16px;}
.welcome h1 {font-size: 24px;}
.mark.big {inline-size: 48px; block-size: 48px; border-radius: 15px;}
.mark.big svg {inline-size: 30px; block-size: 30px;}
.zone-list {display: none;}
}
@media (hover: hover) and (pointer: fine) {
.hs .hbtn:not(.strong):not(.quiet):not(:disabled):hover, .hs .rb:not(:disabled):hover, .ovl .hbtn:not(.strong):not(.quiet):hover, .ovl .rb:not(.onpic):hover {background: var(--hs-border-strong);}
.hs .hbtn.strong:hover, .ovl .hbtn.strong:hover {background: var(--hs-accent-hover);}
.hs-nav a:not([aria-current]):hover, .mrow:hover {background: var(--hs-surface-2); color: var(--hs-heading);}
.hs .scene:hover, .hs .chip2:not([aria-pressed="true"]):hover, .hs .ltile:not(.is-on):hover, .hs .zrow:not([aria-pressed="true"]):hover, .tile:has(> .cover:hover) {background: var(--hs-surface-2);}
:host([data-hs-scheme="light"]) .hs .scene:hover, :host([data-hs-scheme="light"]) .hs .chip2:not([aria-pressed="true"]):hover, :host([data-hs-scheme="light"]) .hs .ltile:not(.is-on):hover, :host([data-hs-scheme="light"]) .hs .zrow:not([aria-pressed="true"]):hover, :host([data-hs-scheme="light"]) .tile:has(> .cover:hover) {background: #fbfaf8;}
}
@media (prefers-reduced-motion: reduce) {
.hs-main.enter > *, .app-root.enter {animation: hs-fade 160ms ease both; animation-delay: 0ms !important; animation-duration: 160ms !important;}
.ring-line .hi {animation: none;}
.scene::before, .scene.run::before {transition: none;}
.sheet, .call, .camfull, .toast2, .hbtn, .rb, .lamp, .scene {transition-property: opacity, background-color, color !important; transform: none !important;}
.sheet.dialog {translate: -50% -50%;}
}
@media (prefers-contrast: more) {
.tile, .hbtn, .rb {outline: 1px solid var(--hs-border-strong);}
}
.fsub {font-size: var(--f-sm); color: var(--hs-text-2); flex-basis: 100%;}
.pick-grid {display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-block-start: 10px;}
.picker .mrow {background: var(--hs-surface-3); min-block-size: 64px; padding: 0 16px !important; display: grid; grid-template-columns: minmax(0, 1fr); align-content: center; gap: 0;}
.picker .mrow[aria-current] {background: var(--hs-accent-soft);}
.picker .seg {justify-self: start; margin-block-start: 8px;}
@media (max-width: 700px) {
.pick-grid {grid-template-columns: minmax(0, 1fr);}
.picker .mrow {min-block-size: 52px;}
.sheet.dialog {padding: 20px;}
}
@media (max-width: 700px) {
.fav[data-fav="climate"] .pm {display: none;}
.fav[data-fav="climate"] .fsub {display: inline; flex-basis: auto;}
.ltile b.clamp1 {white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; overflow-wrap: anywhere;}
.hs-head .sub.clamp1 {white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3;}
}
.dim.lo .dim-v {right: auto; left: 16px;}
.rtemp {position: absolute !important; inset-block-end: 22px; right: 18px; font-size: 30px; font-weight: 500; line-height: 1; color: var(--hs-heading); pointer-events: none; letter-spacing: -.02em;}
.fcl .room .rtemp, .room-list .room .rtemp {position: relative !important; inset: auto; font-size: var(--f-body); color: var(--hs-text-2); margin-inline-end: 12px; flex: none;}
@media (max-width: 700px) {
.room-grid .rtemp {display: none;}
}
.mark.big {background: none;}
.hs.v2 {grid-template-columns: 104px minmax(0, 1fr); grid-template-rows: 72px minmax(0, 1fr) auto;}
.hs.v2 .hs-nav {grid-row: 2 / 4; justify-content: flex-start; gap: 6px; padding: 4px 10px 16px;}
.hs.v2 .hs-nav a {flex: 0 0 84px;}
.hs.v2 .hs-main, .hs.v2 .hs-main {padding: 4px 12px 14px 28px;}
.hs.v2 .hs-strip {gap: 14px; padding-inline: 14px 22px;}
.tb-back {inline-size: var(--hit); block-size: var(--hit); border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--hs-surface-3); color: var(--hs-heading); transition: transform 120ms var(--hs-ease);}
.tb-back:active, .tb-room:active, .chip3:active {transform: scale(.97);}
.tb-room {display: flex; align-items: center; gap: 12px; min-block-size: var(--hit); padding: 0 16px; border-radius: 18px; background: var(--hs-surface); color: var(--hs-heading); min-inline-size: 0; flex: 0 1 auto; max-inline-size: 30ch; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.tb-t {display: grid; min-inline-size: 0;}
.hs .tb-room h1 {font-size: 24px; font-weight: 600; line-height: 1.15; letter-spacing: -.01em;}
.tb-c {font-size: 13px; color: var(--hs-text-2); line-height: 1.2;}
.tb-room > .hi {inline-size: 22px; block-size: 22px; color: var(--hs-text-2);}
.tb-fav {display: flex; align-items: center; gap: 2px; flex: none;}
.hs .tb-fav .rb {background: transparent; color: var(--hs-text-2);}
.dots {display: flex; gap: 7px; padding-inline: 4px;}
.dots i {inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--hs-border-strong); transition: background-color var(--hs-t-med) ease, transform var(--hs-t-med) var(--hs-ease);}
.dots i.on {background: var(--hs-heading); transform: scale(1.25);}
.hs.v2 .hs-now {margin-inline-start: auto;}
.hs.v2 .hs-status {margin-inline-start: 6px;}
@media (max-width: 1399px) {
.hs.v2 .hs-now .date {display: none;}
}
.nowbar {grid-row: 3; grid-column: 2; display: flex; align-items: center; gap: 14px; margin: 0 12px 16px 28px; padding: 10px; min-block-size: 76px; border-radius: var(--r-tile); background: var(--hs-surface); min-inline-size: 0;}
.nb-t {display: grid; align-content: center; min-inline-size: 0; flex: 0 1 34%; min-block-size: var(--hit); padding-inline: 12px; border-radius: 14px; color: var(--hs-heading);}
.nb-k {font-size: 13px; color: var(--hs-text-2); line-height: 1.2;}
.nb-t b {font-weight: 600; font-size: var(--f-body);}
.dim.master {flex: 1 1 0; min-inline-size: 0;}
.dim.master .dim-v {font-weight: 500; white-space: nowrap; direction: rtl;}
.nb-off {flex: none;}
.hs .hbtn[aria-pressed="true"], .ovl .hbtn[aria-pressed="true"] {background: var(--hs-accent-soft); color: var(--hs-accent-text);}
.chips3 {display: flex; gap: 12px; flex: none; margin-block: 2px 14px; min-inline-size: 0;}
.chip3 {flex: 1 1 0; min-inline-size: 0; display: flex; align-items: center; gap: 12px; min-block-size: 84px; padding: 0 16px; border-radius: var(--r-tile); background: var(--hs-surface); color: var(--hs-heading); transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease;}
.chip3 > .hi {inline-size: 32px; block-size: 32px; color: var(--hs-text-2);}
.chip3 > .hi.lit {color: var(--hs-lit);}
.c3-t {display: grid; min-inline-size: 0;}
.c3-t b {font-size: var(--f-tile); font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.c3-s {display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--hs-text-2); white-space: nowrap; overflow: hidden;}
.c3-s .dot {inline-size: 8px; block-size: 8px;}
.favz {flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px;}
.favz > .bar {min-block-size: var(--hit); flex: none;}
.favz > .bar .acts, .hs-head .acts {display: flex; align-items: center; gap: 10px;}
.favz > .bar h2 {font-size: 22px;}
.wgrid {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); grid-auto-flow: row dense; gap: 14px;}
.wdg {display: flex; align-items: center; gap: 12px; padding: 0 16px; overflow: hidden;}
.wdg.w2 {grid-column: span 2;}
.wdg.h2 {grid-row: span 2;}
.wg-btn {inline-size: 100%; block-size: 100%; border-radius: inherit; color: var(--hs-heading); min-inline-size: 0;}
.hs .wg-btn.scene {flex-direction: column; justify-content: center; gap: 10px; min-block-size: 0; padding: 8px 10px !important; text-align: center; font-size: var(--f-body); border-radius: inherit; background: transparent;}
.wg-btn.scene .sn {flex: none;}
.wg-btn.scene .hi {inline-size: 32px; block-size: 32px;}
.hs .wg-btn.ltile {flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 4px; padding: 14px 16px !important; border-radius: inherit !important;}
.wg-btn.ltile .lt {flex: 0 1 auto;}
.wg-btn.ltile > .hi {inline-size: 28px; block-size: 28px;}
.wl2 {display: grid; grid-template-columns: var(--hit) minmax(0, 1fr); grid-template-rows: auto auto; gap: 8px 12px; inline-size: 100%; min-block-size: 0;}
.wl2 .ln, .lcard .ln {display: grid; min-inline-size: 0; align-content: center;}
.wl2 .ln b, .lcard .ln b {font-size: var(--f-body); font-weight: 600; color: var(--hs-heading);}
.wl2 .dim {grid-column: 1 / -1;}
.wg-c {flex: 1; min-inline-size: 0; display: grid; align-content: center; gap: 2px; pointer-events: none;}
.wg-k {display: flex; align-items: center; gap: 6px; font-size: var(--f-sm); color: var(--hs-text-2); min-inline-size: 0;}
.wg-k .hi {inline-size: 20px; block-size: 20px;}
.wdg .big {font-size: 40px;}
.wdg .mid {font-size: 20px;}
.wdg .dn {flex: 1;}
.wdg .dn b {font-size: var(--f-body);}
.wdg .pm {flex: none;}
.wg-btn.pic {position: relative; overflow: hidden; display: block; background: #000;}
.wdg.editing > :not(.wg-ed) {pointer-events: none; opacity: .35;}
.wg-ed {position: absolute !important; inset: 0; z-index: 3 !important; display: flex; flex-wrap: wrap; align-items: center; align-content: center; justify-content: center; gap: 6px; padding: 4px;}
.hs .wg-ed .rb {background: var(--hs-surface-3);}
.hs .wg-ed .rb.del {color: var(--hs-danger-text);}
.wdg.editing {outline: 2px dashed var(--hs-border-strong); outline-offset: -2px;}
.card-grid {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 12px; margin-block: 12px;}
.lcard {display: grid; grid-template-columns: var(--hit) minmax(0, 1fr) minmax(0, 1.25fr) var(--hit); align-items: center; gap: 12px; padding: 0 14px; min-block-size: 0;}
.lcard.sc {grid-template-columns: var(--hit) minmax(0, 1fr) var(--hit);}
.lcard.sh {grid-template-columns: minmax(0, 1fr) auto var(--hit); padding-inline-start: 20px;}
.hs .rb.star {background: transparent; color: var(--hs-text-3);}
.hs .rb.star[aria-pressed="true"] {color: var(--hs-accent-text);}
.star[aria-pressed="true"] .hi, .heart[aria-pressed="true"] .hi {fill: currentColor;}
.hs .lamp.heart[aria-pressed="true"] {background: var(--hs-accent-soft); color: var(--hs-accent-text);}
.hs .pg-t {font-size: 28px; font-weight: 600; letter-spacing: -.01em; line-height: 1.2; color: var(--hs-heading);}
.hs.v2 .hs-head {min-block-size: 64px; margin-block-end: 6px;}
.hs.v2 .hs-main > .bar {min-block-size: var(--hit);}
.room[data-cur] {outline: 2px solid var(--hs-accent-text); outline-offset: -2px;}
.hs.v2 .dial-wrap {inline-size: min(100%, 40vh, 340px);}
.presets {display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;}
.clim-side {gap: 10px; justify-content: flex-start;}
.hbtn.wideb {justify-content: space-between; inline-size: 100%;}
.hs.v2 .zone-list {grid-template-rows: repeat(4, minmax(0, 1fr)) auto;}
.hs.v2 .alert-list {grid-template-rows: repeat(4, minmax(0, 1fr));}
.hs.v2 .alert-list.act {grid-template-rows: repeat(5, minmax(0, 1fr));}
.ai[data-on] {background: var(--hs-accent-soft); color: var(--hs-accent-text);}
.arow a.at {color: inherit; min-block-size: var(--hit); align-content: center;}
.hs.v2 .drow {grid-template-columns: var(--hit) minmax(0, 1fr) auto var(--hit); gap: 12px;}
.cam-t {position: relative;}
.cam-t .star {position: absolute !important; inset-block-start: 8px; left: 8px; z-index: 2 !important;}
.hs .cam-t .rb.star {background: rgba(0,0,0,.6); color: #fff;}
.pick-list.wide {inline-size: 100%;}
@media (min-width: 1400px) and (min-height: 860px) {
.hs.v2 {grid-template-columns: 116px minmax(0, 1fr); grid-template-rows: 80px minmax(0, 1fr) auto;}
.chip3 {min-block-size: 96px;}
.nowbar {margin-block-end: 24px;}
.hs.v2 .dial-wrap {inline-size: min(100%, 42vh, 380px);}
}
@media (max-width: 700px) {
.hs.v2 {grid-template-columns: minmax(0, 1fr); grid-template-rows: calc(56px + env(safe-area-inset-top, 0px)) minmax(0, 1fr) auto auto;}
.hs.v2 .hs-nav {grid-row: 4; grid-column: 1; padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px)); gap: 2px;}
.hs.v2 .hs-nav a {flex: 1 1 0;}
.hs.v2 .hs-main, .hs.v2 .hs-main {padding: 2px 12px 8px;}
.hs.v2 .hs-strip {gap: 6px; padding-inline: 10px 6px;}
.tb-back {inline-size: 44px; block-size: 44px;}
.tb-room {min-block-size: 44px; padding: 0 12px; gap: 6px; border-radius: 14px;}
.hs .tb-room h1 {font-size: 19px;}
.tb-c, .tb-fav .rb, .hs.v2 .hs-status a.st-pill, .hs.v2 .hs-now {display: none;}
.hs.v2 .hs-status {margin-inline-start: auto;}
.dots {gap: 5px;}
.dots i {inline-size: 6px; block-size: 6px;}
.nowbar {grid-row: 3; grid-column: 1; margin: 0 12px 8px; padding: 6px; min-block-size: 56px; gap: 8px; border-radius: 18px;}
.nb-k {display: none;}
.nb-t {padding-inline: 8px; flex: 0 1 44%;}
.nb-t b {font-size: 14px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2;}
.nb-off .bt, .favz .hbtn .bt, .hs-head .acts .hbtn .bt, .arow .hbtn .bt {display: none;}
.nb-off, .favz .hbtn, .hs-head .acts .hbtn:has(.bt), .arow .hbtn:has(.bt) {inline-size: var(--hit); padding: 0 !important; border-radius: 50%;}
.dim.master .dim-v {font-size: 13px;}
.chips3 {display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block: 0 8px;}
.chip3 {flex-direction: column; justify-content: center; gap: 2px; min-block-size: 68px; padding: 4px 2px; text-align: center; border-radius: 16px;}
.chip3 > .hi {inline-size: 24px; block-size: 24px;}
.c3-t {justify-items: center;}
.c3-t b {font-size: 13px;}
.c3-s {font-size: 12px;}
.c3-s .dot {display: none;}
.favz {gap: 6px;}
.favz > .bar h2 {font-size: 17px;}
.favz .pager .pg {min-inline-size: 52px;}
.wgrid {grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 8px;}
.wdg {padding: 0 10px; gap: 8px;}
.wdg .big {font-size: 30px;}
.wdg .pm {gap: 6px;}
.wdg .pm .rb, .wdg .trio .rb, .wg-ed .rb, .lcard .lamp, .lcard.sh .trio .rb, .hs.v2 .pager .rb {inline-size: 44px; block-size: 44px;}
.wdg .trio, .lcard.sh .trio {gap: 4px;}
.wdg .hbtn {padding: 0 14px;}
.wl2 {grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1.2fr); grid-template-rows: auto; gap: 8px; align-items: center;}
.wl2 .dim {grid-column: auto; block-size: 44px;}
.wl2 .lamp {inline-size: 44px; block-size: 44px;}
.wl2 .ln b {font-size: 14px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2;}
.hs .wg-btn.scene {font-size: 14px; gap: 4px;}
.wg-btn.scene .hi {inline-size: 26px; block-size: 26px;}
.hs .wg-btn.ltile {padding: 8px 10px !important;}
.wdg .di, .drow .di {inline-size: 40px; block-size: 40px;}
.card-grid {grid-template-columns: minmax(0, 1fr); gap: 8px; margin-block: 8px;}
.lcard {grid-template-columns: 44px minmax(0, 1fr) 44px; grid-template-rows: auto auto; gap: 6px 10px; padding: 8px 10px; align-content: center;}
.lcard .dim {grid-column: 1 / -1; grid-row: 2; block-size: 44px;}
.lcard .star {grid-column: 3; grid-row: 1;}
.lcard.sh {grid-template-columns: minmax(0, 1fr) auto 44px; grid-template-rows: auto;}
.lcard.sc {grid-template-rows: auto;}
.lcard.sh .star, .lcard.sc .star {grid-column: auto; grid-row: auto;}
.hs .pg-t {font-size: 22px;}
.hs.v2 .hs-head {min-block-size: 52px; margin-block-end: 4px; gap: 8px;}
.hs.v2 .hs-main > .bar {min-block-size: 48px; gap: 8px;}
.hs.v2 .bar.wrap {gap: 6px;}
.hs.v2 .seg button {padding: 0 10px !important; font-size: 14px;}
.hs-head .acts {gap: 6px; flex-wrap: wrap; justify-content: flex-end;}
.hs.v2 .dial-wrap {inline-size: min(100%, 29vh);}
.hs.v2 .thermo {padding: 10px 12px 12px; gap: 6px;}
.presets {gap: 6px;}
.presets .chip2 {min-block-size: 44px; padding: 0 12px !important; font-size: 14px; flex: 1 1 0;}
.hs.v2 .alert-list, .hs.v2 .alert-list.act {grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block-end: 8px;}
.hs.v2 .drow {grid-template-columns: 40px minmax(0, 1fr) auto 44px; gap: 8px; padding: 0 10px;}
.hs.v2 .drow .hbtn {min-inline-size: 60px; padding: 0 12px;}
.hs.v2 .door-list {flex: 1.5 1 0; gap: 8px;}
.hs.v2 .visitors {flex: 1 1 0;}
.hs.v2 .vrow {min-block-size: 48px;}
.hs.v2 .cam-grid, .hs.v2 .room-list {gap: 8px;}
.hs.v2 .room-list {margin-block: 8px;}
.hs.v2 .setrow {min-block-size: 54px;}
.hs.v2 .set-list {gap: 6px;}
.hs.v2 .hint {margin-block: 4px 6px; font-size: 14px; line-height: 1.35;}
}
.hs .wdg {flex-direction: row;}
.hs .wdg.wg-scene, .hs .wdg.wg-rscene, .hs .wdg.wg-cam, .hs .wdg.wg-light.w1 {padding: 0;}
.wdg .big {letter-spacing: -.02em; font-weight: 500;}
.wg-c.en1 {justify-items: start;}
.chip3 {flex-direction: column; justify-content: center; gap: 4px; text-align: center; padding: 6px 4px; min-block-size: 96px;}
.chip3 .c3-t {justify-items: center;}
.dim.master .dim-v {display: flex; align-items: center; gap: 6px;}
.nb-rooms {display: flex; gap: 8px; flex: 1 1 0; min-inline-size: 0;}
.nb-rooms .chip2 {background: var(--hs-surface-2); flex: 0 1 auto; padding: 0 18px !important; font-size: var(--f-sm);}
.nb-off {margin-inline-start: auto;}
@media (min-width: 1400px) and (min-height: 860px) {
.chip3 {min-block-size: 108px;}
}
@media (max-width: 700px) {
.wgrid {grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(5, minmax(0, 1fr));}
.wdg.w2 {grid-column: span 3;}
.chip3 {min-block-size: 68px; gap: 2px; padding: 4px 2px;}
.hs.v2 .byroom .hb:nth-of-type(n+3) {display: none;}
.hs.v2 .dial-wrap {inline-size: min(100%, 26vh);}
.hs-head .acts .hbtn {max-inline-size: 38vw;}
.wg-c.en1 .wg-k {font-size: 12px;}
.wg-c.en1 .muted {font-size: 12px;}
}
.nb-ml {font-size: var(--f-sm); color: var(--hs-text-2); flex: none;}
.dim.master .dim-v {display: grid; direction: ltr;}
.presets .chip2 {gap: 8px;}
.hs .lamp.go {color: var(--hs-heading);}
.hs .lamp.go[aria-pressed="true"] {background: var(--hs-accent-soft); color: var(--hs-accent-text);}
.hs .nowbar .nb-off {margin-inline-start: auto;}
@media (max-width: 700px) {
.nb-ml {display: none;}
.hs .nowbar .nb-t {flex: 1 1 0;}
.hs .nowbar .dim.master {flex: 1.1 1 0;}
}
@media (max-width: 700px) {
.hs.v2 .hs-main, .hs.v2 .hs-main {padding-inline: 16px;}
.nowbar {margin-inline: 16px;}
}
.nb-rooms {overflow: hidden;}
.nb-rooms .chip2 {flex: none; max-inline-size: 18ch;}
.hs .wdg.wg-scene, .hs .wdg.wg-rscene, .hs .wdg.wg-cam, .hs .wdg.wg-light.s1 {padding: 0;}
@media (max-width: 700px) {
.wg-btn.ltile .lt b {-webkit-line-clamp: 1; font-size: 14px;}
.hs .wg-btn.ltile {padding: 6px 10px !important; gap: 0;}
.wg-btn.ltile > .hi {inline-size: 22px; block-size: 22px;}
.wdg.editing .wg-ed {flex-wrap: nowrap;}
}
.wdg.editing > :not(.wg-ed) {opacity: 0;}
.wg-ed {flex-direction: column; flex-wrap: nowrap; gap: 4px;}
.ed-n {font-size: var(--f-sm); font-weight: 600; color: var(--hs-heading); max-inline-size: 100%; text-align: center;}
.ed-b {display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;}
@media (max-width: 700px) {
.chips3 {grid-template-columns: repeat(var(--c, 4), minmax(0, 1fr));}
.wdg.editing .wg-ed {flex-direction: row; justify-content: space-between; padding-inline: 12px 8px; gap: 8px;}
.ed-n {flex: 1; text-align: start;}
.ed-b {flex: none; flex-wrap: nowrap; gap: 4px;}
}
.wdg.s1.editing > :not(.wg-ed) {opacity: .3;}
.wdg.s1.editing .ed-n {display: none;}
@media (max-width: 700px) {
.wdg.s1.editing > :not(.wg-ed) {opacity: 0;}
.wdg.s1.editing .ed-n {display: block;}
}
.swc {display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-inline-size: 0;}
.sw-t {font-size: var(--f-sm); font-weight: 600; color: var(--hs-text-2); white-space: nowrap;}
.lcard.is-on .sw-t {color: var(--hs-heading);}
.hs .lamp.ld[aria-pressed="true"] {background: var(--hs-accent-soft); color: var(--hs-accent-text);}
.hs .ltile.ld.is-on > .hi {color: var(--hs-accent-text);}
.arow.kept .ai {background: var(--hs-surface-3); color: var(--hs-text-2);}
.hs .hbtn.strong, .ovl .hbtn.strong, .hs .st-pill.call {color: var(--hs-on-accent, #fff);}
::selection {color: var(--hs-on-accent, #fff);}
.theme-grid {flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 14px; margin-block: 4px 12px;}
.thm {display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 10px; padding: 12px !important; text-align: start; color: var(--hs-heading); outline: 2px solid transparent; outline-offset: -2px; border-radius: var(--r-tile) !important; transition: transform 120ms var(--hs-ease), outline-color var(--hs-t-med) ease;}
.hs .thm {background: var(--hs-surface);}
.thm:active {transform: scale(.985);}
.thm[aria-checked="true"] {outline-color: var(--hs-accent-text);}
.thm-t {display: grid; gap: 1px; padding-inline: 4px 30px; min-inline-size: 0;}
.thm-t b {font-size: var(--f-body); font-weight: 600;}
.thm .tick {position: absolute !important; inset-block-end: 14px; left: 14px;}
.thm-pv {display: grid; grid-template-columns: 1.3fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 6px; padding: 8px; border-radius: 14px; background: var(--hs-bg); min-block-size: 0;}
.thm-pv i {border-radius: 8px; background: var(--hs-surface);}
.thm-pv .pv-a {grid-row: 1 / 3; background: var(--hs-accent);}
.thm-pv .pv-b {background: var(--hs-on-tile); box-shadow: inset 0 -5px 0 var(--hs-lit);}
.thm-pv .pv-c {background: var(--hs-surface-3);}
.thm-pv .pv-d {grid-column: 2 / 4; background: var(--hs-accent-soft);}
@media (max-width: 700px) {
.lcard.sw {grid-template-columns: 44px minmax(0, 1fr) auto 44px; grid-template-rows: auto;}
.lcard.sw .swc {grid-row: 1; gap: 6px;}
.lcard.sw .star {grid-column: auto; grid-row: auto;}
.lcard.sw .sw-t {display: none;}
.theme-grid {grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-block: 2px 8px;}
.thm {padding: 8px !important; gap: 6px;}
.thm-t .muted {display: none;}
.hs.v2 .seg {max-inline-size: 100%;}
.hs.v2 .hs-head .seg button {padding: 0 8px !important; font-size: 13px;}
}
@media (hover: hover) and (pointer: fine) {
:host([data-hs-scheme="light"]) .hs .scene:hover, :host([data-hs-scheme="light"]) .hs .chip2:not([aria-pressed="true"]):hover, :host([data-hs-scheme="light"]) .hs .ltile:not(.is-on):hover, :host([data-hs-scheme="light"]) .hs .zrow:not([aria-pressed="true"]):hover, :host([data-hs-scheme="light"]) .tile:has(> .cover:hover) {background: var(--hs-surface-2);}
.hs .chip3:hover, .hs .tb-room:hover {background: var(--hs-surface-2);}
}
:host([data-hs-scheme="light"]) .hs .seg button[aria-pressed="true"], :host([data-hs-scheme="light"]) .ovl .seg button[aria-pressed="true"] {background: var(--hs-surface);}
.tabsrow {flex: none;}
@media (max-width: 700px) {
.lcard.sw > .lamp {grid-column: 1; grid-row: 1;}
.lcard.sw > .ln {grid-column: 2; grid-row: 1;}
.lcard.sw > .swc {grid-column: 3; grid-row: 1;}
.lcard.sw > .star {grid-column: 4; grid-row: 1;}
.hs.v2 .tabsrow .seg {inline-size: 100%;}
.hs.v2 .tabsrow .seg button {flex: 1 1 auto; padding: 0 6px !important; font-size: 13.5px;}
.hs.v2 .tabsrow {min-block-size: 44px;}
}
.hs.v2 .di {background: transparent; inline-size: 32px; color: var(--ct, var(--hs-text-2));}
.hs.v2 .di .hi {inline-size: 30px; block-size: 30px;}
.hs .lamp[aria-pressed="true"] {background: var(--hs-surface-3); color: var(--hs-lit); box-shadow: inset 0 0 0 2px var(--hs-lit);}
.hs .lamp.ld[aria-pressed="true"] {background: var(--hs-surface-3); color: var(--hs-accent-text); box-shadow: inset 0 0 0 2px var(--hs-accent-text);}
.hs .lamp.go[aria-pressed="true"] {background: var(--hs-surface-3); color: var(--hs-accent-text); box-shadow: inset 0 0 0 2px var(--hs-accent-text);}
.hs .lamp.heart[aria-pressed="true"] {background: var(--hs-surface-3); color: var(--hs-accent-text); box-shadow: none;}
:host([data-hs-theme="classic"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="classic"][data-hs-scheme="dark"] {--hs-bg: #131211; --hs-surface: #1d1c1a; --hs-surface-2: #262421; --hs-surface-3: #33302c; --hs-surface-solid: #262421;
  --hs-border: #2e2c28; --hs-border-strong: #45413b; --hs-overlay: rgba(0,0,0,.62);
  --hs-text: #f1ede6; --hs-heading: #faf7f1; --hs-text-2: #bdb6aa; --hs-text-3: #989185;
  --hs-accent: #3d6ddf; --hs-accent-hover: #4a79ea; --hs-accent-soft: #232b3f; --hs-accent-text: #a3c0ff; --hs-focus: #a3c0ff; --hs-on-accent: #ffffff;
  --hs-lit: #ffb547; --hs-on-tile: #2f2c28; --hs-off-tile: #191817; --hs-dim-fill: #48443d;
  --hs-toast-bg: #f1ede6; --hs-toast-text: #1b1a18; --hs-toast-act: #1f4fc4; --viz-today: #5f88ee; --viz-usual: #cfc9be;}
:host([data-hs-theme="classic"][data-hs-scheme="light"]), .thm-pv[data-hs-theme="classic"][data-hs-scheme="light"] {--hs-bg: #f2f0ec; --hs-surface: #ffffff; --hs-surface-2: #f7f5f2; --hs-surface-3: #e9e6e0; --hs-surface-solid: #ffffff;
  --hs-border: #e2ded7; --hs-border-strong: #cdc8bf; --hs-overlay: rgba(28,26,22,.42);
  --hs-text: #24221f; --hs-heading: #171614; --hs-text-2: #57524a; --hs-text-3: #6b665d;
  --hs-accent: #2459d6; --hs-accent-hover: #1d4dc0; --hs-accent-soft: #e6edfc; --hs-accent-text: #1c4fc8; --hs-focus: #2459d6; --hs-on-accent: #ffffff;
  --hs-lit: #b86e00; --hs-on-tile: #ffffff; --hs-off-tile: #e9e6e0; --hs-dim-fill: #d3cec5;
  --hs-toast-bg: #24221f; --hs-toast-text: #ffffff; --hs-toast-act: #a3c0ff; --viz-today: #2459d6; --viz-usual: #7d776d;}
:host([data-hs-theme="ocean"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="ocean"][data-hs-scheme="dark"] {--hs-bg: #0a141d; --hs-surface: #122230; --hs-surface-2: #192d3e; --hs-surface-3: #243d52; --hs-surface-solid: #192d3e;
  --hs-border: #1f3649; --hs-border-strong: #35536c; --hs-overlay: rgba(2,8,14,.66);
  --hs-text: #e8f1f8; --hs-heading: #f6fbff; --hs-text-2: #a9c0d3; --hs-text-3: #8aa5ba;
  --hs-accent: #1f74c9; --hs-accent-hover: #2b82d8; --hs-accent-soft: #143353; --hs-accent-text: #8fc8ff; --hs-focus: #8fc8ff; --hs-on-accent: #ffffff;
  --hs-lit: #ffbf5c; --hs-on-tile: #213a4e; --hs-off-tile: #0f1c28; --hs-dim-fill: #36566f;
  --hs-toast-bg: #e8f1f8; --hs-toast-text: #0c1924; --hs-toast-act: #145aa3; --viz-today: #3f8fdc; --viz-usual: #cfd8e0;}
:host([data-hs-theme="ocean"][data-hs-scheme="light"]), .thm-pv[data-hs-theme="ocean"][data-hs-scheme="light"] {--hs-bg: #e9f0f6; --hs-surface: #ffffff; --hs-surface-2: #f3f7fa; --hs-surface-3: #dde7ef; --hs-surface-solid: #ffffff;
  --hs-border: #d3dfe9; --hs-border-strong: #b6c8d7; --hs-overlay: rgba(10,26,40,.42);
  --hs-text: #16293a; --hs-heading: #0c1c2a; --hs-text-2: #45596b; --hs-text-3: #586c7e;
  --hs-accent: #0f5fb0; --hs-accent-hover: #0c5199; --hs-accent-soft: #dcebfa; --hs-accent-text: #0d57a3; --hs-focus: #0f5fb0; --hs-on-accent: #ffffff;
  --hs-lit: #b56a00; --hs-on-tile: #ffffff; --hs-off-tile: #dde7ef; --hs-dim-fill: #c3d3e0;
  --hs-toast-bg: #16293a; --hs-toast-text: #ffffff; --hs-toast-act: #9ccfff; --viz-today: #0f5fb0; --viz-usual: #929292;}
:host([data-hs-theme="sand"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="sand"][data-hs-scheme="dark"] {--hs-bg: #17110e; --hs-surface: #231a15; --hs-surface-2: #2d221c; --hs-surface-3: #3d2f27; --hs-surface-solid: #2d221c;
  --hs-border: #34281f; --hs-border-strong: #54423a; --hs-overlay: rgba(10,6,4,.64);
  --hs-text: #f5ebe1; --hs-heading: #fdf6ee; --hs-text-2: #cdb9a8; --hs-text-3: #ab9685;
  --hs-accent: #b5522c; --hs-accent-hover: #c35e36; --hs-accent-soft: #40241a; --hs-accent-text: #f2ab8b; --hs-focus: #f2ab8b; --hs-on-accent: #ffffff;
  --hs-lit: #ffd27a; --hs-on-tile: #392c24; --hs-off-tile: #1b1410; --hs-dim-fill: #5a473b;
  --hs-toast-bg: #f5ebe1; --hs-toast-text: #1f1611; --hs-toast-act: #9a3f1c; --viz-today: #d06f47; --viz-usual: #d9cfc6;}
:host([data-hs-theme="sand"][data-hs-scheme="light"]), .thm-pv[data-hs-theme="sand"][data-hs-scheme="light"] {--hs-bg: #f3ebe1; --hs-surface: #fffbf6; --hs-surface-2: #f9f2ea; --hs-surface-3: #ebdfd2; --hs-surface-solid: #fffbf6;
  --hs-border: #e4d8ca; --hs-border-strong: #cfbfae; --hs-overlay: rgba(40,26,16,.42);
  --hs-text: #2c2019; --hs-heading: #1d140f; --hs-text-2: #5e4d41; --hs-text-3: #705e51;
  --hs-accent: #a2441f; --hs-accent-hover: #8d3a19; --hs-accent-soft: #f6e0d5; --hs-accent-text: #96401d; --hs-focus: #a2441f; --hs-on-accent: #ffffff;
  --hs-lit: #8f6c00; --hs-on-tile: #fffbf6; --hs-off-tile: #ebdfd2; --hs-dim-fill: #d8c8b7;
  --hs-toast-bg: #2c2019; --hs-toast-text: #ffffff; --hs-toast-act: #f2ab8b; --viz-today: #a2441f; --viz-usual: #958d86;}
:host([data-hs-theme="plum"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="plum"][data-hs-scheme="dark"] {--hs-bg: #140f19; --hs-surface: #1f1827; --hs-surface-2: #2a2034; --hs-surface-3: #3a2d47; --hs-surface-solid: #2a2034;
  --hs-border: #30263c; --hs-border-strong: #504061; --hs-overlay: rgba(8,4,12,.66);
  --hs-text: #f2ebf6; --hs-heading: #fbf7fd; --hs-text-2: #c4b5d0; --hs-text-3: #a593b3;
  --hs-accent: #7c4bbf; --hs-accent-hover: #8a59cd; --hs-accent-soft: #33244a; --hs-accent-text: #d0b4f7; --hs-focus: #d0b4f7; --hs-on-accent: #ffffff;
  --hs-lit: #ffc061; --hs-on-tile: #362a43; --hs-off-tile: #18121e; --hs-dim-fill: #564468;
  --hs-toast-bg: #f2ebf6; --hs-toast-text: #1b1422; --hs-toast-act: #6336a3; --viz-today: #9a6de0; --viz-usual: #d6cfdd;}
:host([data-hs-theme="plum"][data-hs-scheme="light"]), .thm-pv[data-hs-theme="plum"][data-hs-scheme="light"] {--hs-bg: #f1ebf4; --hs-surface: #ffffff; --hs-surface-2: #f8f4fa; --hs-surface-3: #e7deec; --hs-surface-solid: #ffffff;
  --hs-border: #e0d6e6; --hs-border-strong: #c9bbd2; --hs-overlay: rgba(30,16,40,.42);
  --hs-text: #271d2e; --hs-heading: #1a1220; --hs-text-2: #584a62; --hs-text-3: #6a5b75;
  --hs-accent: #6a3aa8; --hs-accent-hover: #5c3094; --hs-accent-soft: #ece1f8; --hs-accent-text: #62349d; --hs-focus: #6a3aa8; --hs-on-accent: #ffffff;
  --hs-lit: #b06a00; --hs-on-tile: #ffffff; --hs-off-tile: #e7deec; --hs-dim-fill: #d2c5db;
  --hs-toast-bg: #271d2e; --hs-toast-text: #ffffff; --hs-toast-act: #d0b4f7; --viz-today: #6a3aa8; --viz-usual: #6f6a74;}
:host([data-hs-theme="midnight"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="midnight"][data-hs-scheme="dark"] {--hs-bg: #080b12; --hs-surface: #111624; --hs-surface-2: #181f31; --hs-surface-3: #242d44; --hs-surface-solid: #181f31;
  --hs-border: #1d2539; --hs-border-strong: #36415d; --hs-overlay: rgba(0,0,0,.7);
  --hs-text: #ece9e1; --hs-heading: #faf8f2; --hs-text-2: #b3b6c2; --hs-text-3: #9396a6;
  --hs-accent: #cf9f4a; --hs-accent-hover: #dcae5c; --hs-accent-soft: #33291a; --hs-accent-text: #e9c27a; --hs-focus: #e9c27a; --hs-on-accent: #1b1305;
  --hs-lit: #fff3cf; --hs-on-tile: #2a3450; --hs-off-tile: #0c1019; --hs-dim-fill: #3d4968;
  --hs-toast-bg: #ece9e1; --hs-toast-text: #121420; --hs-toast-act: #7a5410; --viz-today: #b98a35; --viz-usual: #c9ccd8;
  color-scheme: dark;}
:host([data-hs-theme="nordic"][data-hs-scheme="light"]), .thm-pv[data-hs-theme="nordic"][data-hs-scheme="light"] {--hs-bg: #eceff1; --hs-surface: #ffffff; --hs-surface-2: #f5f7f8; --hs-surface-3: #e1e6ea; --hs-surface-solid: #ffffff;
  --hs-border: #d8dee3; --hs-border-strong: #bcc6ce; --hs-overlay: rgba(20,28,36,.4);
  --hs-text: #1f2a33; --hs-heading: #131c23; --hs-text-2: #4a5761; --hs-text-3: #5d6a74;
  --hs-accent: #3b5b7d; --hs-accent-hover: #314e6d; --hs-accent-soft: #e0e9f1; --hs-accent-text: #34526f; --hs-focus: #3b5b7d; --hs-on-accent: #ffffff;
  --hs-lit: #a96800; --hs-on-tile: #ffffff; --hs-off-tile: #e1e6ea; --hs-dim-fill: #c9d2d9;
  --hs-toast-bg: #1f2a33; --hs-toast-text: #ffffff; --hs-toast-act: #b6d0e8; --viz-today: #3b5b7d; --viz-usual: #949494;}
:host([data-hs-theme="nordic"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="nordic"][data-hs-scheme="dark"] {--hs-bg: #12161a; --hs-surface: #1b2126; --hs-surface-2: #232b31; --hs-surface-3: #303a42; --hs-surface-solid: #232b31;
  --hs-border: #283037; --hs-border-strong: #43505a; --hs-overlay: rgba(0,0,0,.62);
  --hs-text: #e9edf0; --hs-heading: #f7f9fa; --hs-text-2: #b0bac2; --hs-text-3: #909ba4;
  --hs-accent: #4a6f9a; --hs-accent-hover: #567ba6; --hs-accent-soft: #23303d; --hs-accent-text: #a9c6e3; --hs-focus: #a9c6e3; --hs-on-accent: #ffffff;
  --hs-lit: #ffbd5a; --hs-on-tile: #2d373f; --hs-off-tile: #161b1f; --hs-dim-fill: #45525c;
  --hs-toast-bg: #e9edf0; --hs-toast-text: #151a1e; --hs-toast-act: #34526f; --viz-today: #6d97c4; --viz-usual: #cdd4da;}
:host([data-hs-theme="pastel"][data-hs-scheme="light"]), .thm-pv[data-hs-theme="pastel"][data-hs-scheme="light"] {--hs-bg: #f1eefa; --hs-surface: #ffffff; --hs-surface-2: #f7f5fc; --hs-surface-3: #e6e1f4; --hs-surface-solid: #ffffff;
  --hs-border: #dfd9ef; --hs-border-strong: #c6bedd; --hs-overlay: rgba(30,24,60,.4);
  --hs-text: #29253f; --hs-heading: #1b1830; --hs-text-2: #555070; --hs-text-3: #676283;
  --hs-accent: #bb2f68; --hs-accent-hover: #a62659; --hs-accent-soft: #fbe3ec; --hs-accent-text: #ad2a5f; --hs-focus: #bb2f68; --hs-on-accent: #ffffff;
  --hs-lit: #a96a00; --hs-on-tile: #ffffff; --hs-off-tile: #e6e1f4; --hs-dim-fill: #cfc8e6;
  --hs-toast-bg: #29253f; --hs-toast-text: #ffffff; --hs-toast-act: #ffb3cf; --viz-today: #bb2f68; --viz-usual: #6a6880;}
:host([data-hs-theme="pastel"][data-hs-scheme="dark"]), .thm-pv[data-hs-theme="pastel"][data-hs-scheme="dark"] {--hs-bg: #15132a; --hs-surface: #1f1c3a; --hs-surface-2: #292549; --hs-surface-3: #38335f; --hs-surface-solid: #292549;
  --hs-border: #2e2a52; --hs-border-strong: #4d4780; --hs-overlay: rgba(6,4,20,.66);
  --hs-text: #eeebfa; --hs-heading: #faf8ff; --hs-text-2: #beb8de; --hs-text-3: #9f98c4;
  --hs-accent: #b8346c; --hs-accent-hover: #c7417a; --hs-accent-soft: #452244; --hs-accent-text: #ffaecb; --hs-focus: #ffaecb; --hs-on-accent: #ffffff;
  --hs-lit: #ffc869; --hs-on-tile: #353059; --hs-off-tile: #18162f; --hs-dim-fill: #524b85;
  --hs-toast-bg: #eeebfa; --hs-toast-text: #1a1830; --hs-toast-act: #8f2552; --viz-today: #e0668f; --viz-usual: #d3cfe6;}
:host([data-hs-theme]), .thm-pv[data-hs-theme] {--hs-live-soft: color-mix(in srgb, var(--hs-live) 16%, var(--hs-surface));
  --hs-warning-soft: color-mix(in srgb, var(--hs-warning) 16%, var(--hs-surface));
  --hs-danger-soft: color-mix(in srgb, var(--hs-danger) 16%, var(--hs-surface));
  --hs-offline-soft: var(--hs-surface-3);}`)}`,ot=at`
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
`,Nt={home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>',rooms:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',bulb:'<path d="M9.5 18h5"/><path d="M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',thermo:'<path d="M12 3.5a2 2 0 0 0-2 2v8.6a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2z"/><path d="M12 10.5v6.5"/>',door:'<path d="M6 21V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V21"/><path d="M3 21h18"/><path d="M14.5 12.5v.01"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',unlock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',cam:'<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/>',camoff:'<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/><path d="M4 4l16 16"/>',bolt:'<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',sliders:'<path d="M4 7h9"/><path d="M19 7h1"/><circle cx="16" cy="7" r="2.5"/><path d="M4 17h1"/><path d="M11 17h9"/><circle cx="8" cy="17" r="2.5"/>',morning:'<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 6v3"/><path d="m5 10.5 2 2"/><path d="m19 10.5-2 2"/>',leave:'<path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M15 12H4"/><path d="m8 8-4 4 4 4"/>',evening:'<path d="M8.5 4h7l2.5 7h-12z"/><path d="M12 11v9"/><path d="M8.5 20h7"/>',night:'<path d="M20 14.5A8 8 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5z"/>',arrive:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="m9 14.5 2 2 4-4"/>',back:'<path d="m9 6 6 6-6 6"/>',fwd:'<path d="m15 6-6 6 6 6"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',minus:'<path d="M5 12h14"/>',power:'<path d="M12 4v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>',shade:'<path d="M4 4h16"/><path d="M6 4v10h12V4"/><path d="M6 7.5h12"/><path d="M6 10.75h12"/><path d="M12 14v4.5"/>',stop:'<rect x="7" y="7" width="10" height="10" rx="2"/>',user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',phone:'<path d="M5 4h4l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2L20 15v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',drop:'<path d="M12 3.5c3 3.6 5.5 6.3 5.5 9.5a5.5 5.5 0 0 1-11 0c0-3.2 2.5-5.9 5.5-9.5z"/>',battery:'<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21.5 11v2"/><path d="M6.5 11v2"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="m5.6 5.6 1.4 1.4"/><path d="m17 17 1.4 1.4"/><path d="m18.4 5.6-1.4 1.4"/><path d="m7 17-1.4 1.4"/>',shield:'<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.5 7 9 4.1-1.5 7-4.8 7-9V6z"/>',swap:'<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',layers:'<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',map:'<path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13"/><path d="M15 6.5v13"/>',media:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/>',system:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m18.4 5.6-2.1 2.1"/><path d="m7.7 16.3-2.1 2.1"/>',plug:'<path d="M9 3v5"/><path d="M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V21"/>',mic:'<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',star:'<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z"/>',heart:'<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/>',pulse:'<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',scenes:'<path d="M12 3v3.5"/><path d="M12 17.5V21"/><path d="M3 12h3.5"/><path d="M17.5 12H21"/><path d="m12 8 1.3 2.7L16 12l-2.7 1.3L12 16l-1.3-2.7L8 12l2.7-1.3z"/>',size:'<path d="M4 9.5V4h5.5"/><path d="M20 14.5V20h-5.5"/><path d="m4 4 6.5 6.5"/><path d="m20 20-6.5-6.5"/>',hold:'<rect x="8" y="5" width="3" height="14" rx="1"/><rect x="13" y="5" width="3" height="14" rx="1"/>',switch:'<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="2.6"/>',fridge:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M6 10h12"/><path d="M9.5 6v1.5"/><path d="M9.5 13v2.5"/>',pump:'<circle cx="12" cy="12" r="6.5"/><path d="M12 5.5v13"/><path d="M5.5 12h13"/><path d="M3 12h2.5"/><path d="M18.5 12H21"/>',palette:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H17a3.5 3.5 0 0 0 3.5-3.5c0-4.7-3.8-8.5-8.5-8.5z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.2" cy="8.5" r="1"/>'};function l(t,s=""){return n`<svg class=${"hi"+(s?" "+s:"")} viewBox="0 0 24 24" aria-hidden="true">${pt(Nt[t]??"")}</svg>`}const O=t=>t===0?"כל האורות כבויים":t===1?"אור אחד דולק":`${t} אורות דולקים`,M=t=>t.reduce((s,e)=>s+e.lights.filter(a=>a.on).length,0),P=t=>t?"דולק":"כבוי",j={cool:"קירור",heat:"חימום",auto:"אוטומטי",heat_cool:"אוטומטי",dry:"ייבוש",fan_only:"אוורור",off:"כבוי"},Wt=[["נעים",23],["חיסכון",26],["לילה",22]],C=t=>t.mode!=="off"&&t.ok,Vt=t=>t.lights.some(s=>s.on)||t.zones.some(C),D=t=>t.filter(Vt),rt=t=>t.flatMap(s=>s.loads.filter(e=>e.on));function Kt(t){const s=t.lights.filter(e=>e.on).length;return!t.lights.length&&!t.shades.length&&!t.zones.length&&!t.loads.length?"אין כאן התקנים":t.lights.length?s===0?"חשוך":s===1?"אור אחד דולק":`${s} אורות דולקים`:"אין אורות"}function G(t){const s=[],e=t.lights.filter(i=>i.on).length;e&&s.push(e===1?"אור אחד":`${e} אורות`);const a=t.zones.find(C);return a&&s.push(a.target!=null?`מיזוג ${a.target}°`:"מיזוג"),s.join(" · ")||"הכל כבוי"}function Yt(t){const s=M(t),e=D(t).length;return s||e?`${O(s)}${e?e===1?" · בחדר אחד":` · ב-${e} חדרים`:""}`:"הכל כבוי בבית"}function Z(t){const s=t.filter(e=>!e.locked);return t.length?s.length?s.length===1?`${s[0].name} ${s[0].kind==="gate"?"פתוח":"פתוחה"}`:`${s.length} דלתות פתוחות`:"כל הדלתות נעולות":"אין דלתות מחוברות"}const Xt=t=>t.kind==="gate"?t.locked?"סגור":"פתוח":t.locked?"נעולה":"פתוחה";function J(t,s=!1,e=null){return s?e==="closing"?"נסגר":"נפתח":t==null?e==="open"?"פתוח":e==="closed"?"סגור":"לא ידוע":t===0?"סגור":t===100?"פתוח":`פתוח ${t}%`}function Gt(t){const s=t.lights.filter(e=>e.on&&!e.sw);return s.length?Math.round(s.reduce((e,a)=>e+a.lvl,0)/s.length):0}function Zt(t){const s=rt(t);return s.length?s.length===1?` · ${s[0].name} נשאר דולק`:` · ${s.length} מפסקים שאינם אור נשארו דולקים`:""}function Jt(t,s=new Date){const e=s.getHours(),a=e<5?"לילה טוב":e<12?"בוקר טוב":e<17?"צהריים טובים":e<21?"ערב טוב":"לילה טוב";return t?`${a}, ${t}`:a}function k(t,s,e){const a=Math.max(1,Math.ceil(t.length/Math.max(1,s))),i=Math.max(0,Math.min(e,a-1));return{items:t.slice(i*s,i*s+s),pages:a,page:i}}const A=(t,s)=>t.t===s.t&&(t.id??null)===(s.id??null),H=(t,s=!1)=>t.t==="scene"||t.t==="energy"||t.t==="switch"?1:t.t==="light"?s?1:t.w??2:2,Q=t=>t.t==="cam"?2:1;function Qt(t,s,e,a){const i=[[]];let o=0;for(const r of t){const d=Math.min(s(r),e*a);o+d>e*a&&(i.push([]),o=0),i[i.length-1].push(r),o+=d}return i}const ts=(t,s)=>t.scenes.filter(e=>e.rooms.length===1&&e.rooms[0]===s),N=t=>t.scenes.filter(s=>s.rooms.length!==1);function ss(t,s){const e=[],a=s.rooms.flatMap(r=>r.doors),i=s.rooms.flatMap(r=>r.zones);if(t==="home")return N(s).slice(0,5).forEach(r=>e.push({t:"scene",id:r.id})),s.hasEnergy&&e.push({t:"energy"}),s.rooms.some(r=>r.lights.length)&&e.push({t:"allLights"}),s.cameras[0]&&e.push({t:"cam",id:s.cameras[0].id}),a[0]&&e.push({t:"door",id:a[0].id}),i[0]&&e.push({t:"climate",id:i[0].id}),a[1]&&e.push({t:"door",id:a[1].id}),e;const o=s.rooms.find(r=>r.id===t);return o&&(ts(s,o.id).slice(0,2).forEach(r=>e.push({t:"scene",id:r.id})),o.lights.slice(0,2).forEach(r=>e.push({t:"light",id:r.id,w:2})),o.loads.slice(0,2).forEach(r=>e.push({t:"switch",id:r.id})),o.zones[0]&&e.push({t:"climate",id:o.zones[0].id}),o.cams[0]&&e.push({t:"cam",id:o.cams[0]}),o.shades[0]&&e.push({t:"shade",id:o.shades[0].id}),o.lights.slice(2,4).forEach(r=>e.push({t:"light",id:r.id,w:1})),o.doors[0]&&e.push({t:"door",id:o.doors[0].id})),e}function T(t,s){const e=a=>s.rooms.some(i=>a(i).some(o=>o.id===t.id));switch(t.t){case"light":return e(a=>a.lights);case"switch":return e(a=>a.loads);case"climate":return e(a=>a.zones);case"shade":return e(a=>a.shades);case"door":return e(a=>a.doors);case"cam":return s.cameras.some(a=>a.id===t.id);case"scene":return s.scenes.some(a=>a.id===t.id);case"energy":return s.hasEnergy;case"security":return s.hasSecurity;default:return s.rooms.some(a=>a.lights.length)}}function q(t,s){return t.find(e=>e.id===s)?.name??""}const lt=t=>t.split(".")[0];function y(t,s,e,a={},i=!1){return new Promise(o=>{xt(t,lt(s),s,e,a,!0,r=>{r.phase!=="pending"&&o({ok:r.phase!=="rolled_back",note:r.note})},{confirmed:i})})}const _=(t,s)=>y(`home:${t.id}`,t.id,`${lt(t.id)}.turn_${s?"on":"off"}`),es=vt(280);function S(t,s,e){es(`home:${t.id}`,"light",t.id,s<=0?"light.turn_off":"light.turn_on",s<=0?{}:{brightness_pct:Math.max(1,Math.min(100,Math.round(s)))},s,a=>{a.phase!=="pending"&&e({ok:a.phase!=="rolled_back",note:a.note})})}async function as(t,s){if(s)try{const o=await mt(s.kind,s.id,"lights_off"),r=await ft(s.kind,s.id,"lights_off",o.digest),d=await gt(r,()=>{});return{ok:d.counts.total===0||d.counts.confirmed+(d.counts.sent??0)>0,note:null}}catch(o){return{ok:!1,note:$(o)}}const e=t.flatMap(o=>o.lights.filter(r=>r.on&&r.can)),i=(await Promise.all(e.map(o=>_(o,!1)))).find(o=>!o.ok);return{ok:!i,note:i?.note??null}}async function is(t){const e=(await Promise.all(t.filter(a=>a.mode!=="off"&&a.can).map(a=>y(`home:${a.id}`,a.id,"climate.turn_off")))).find(a=>!a.ok);return{ok:!e,note:e?.note??null}}async function tt(t,s){if(t.mode==="off"){const e=t.modes.includes("cool")?"cool":t.modes.find(i=>i!=="off")??"auto",a=await y(`home:${t.id}:mode`,t.id,"climate.set_hvac_mode",{hvac_mode:e});if(!a.ok)return a}return y(`home:${t.id}`,t.id,"climate.set_temperature",{temperature:Math.max(t.min,Math.min(t.max,s))})}const ns=(t,s)=>s==="off"?y(`home:${t.id}:mode`,t.id,"climate.turn_off"):y(`home:${t.id}:mode`,t.id,"climate.set_hvac_mode",{hvac_mode:s}),st=(t,s)=>y(`home:${t.id}`,t.id,s==="open"?"cover.open_cover":s==="close"?"cover.close_cover":"cover.stop_cover",{},s!=="stop"),os=t=>y(`home:${t.id}`,t.id,"lock.unlock",{},!0),rs=t=>y(`home:${t.id}`,t.id,"lock.lock",{},!0);async function ls(t){try{return await ut.applyScene(t.id,{confirm:t.sensitive?!0:void 0,client_request_id:bt()}),{ok:!0,note:null}}catch(s){return{ok:!1,note:$(s)}}}var cs=Object.getOwnPropertyDescriptor,ds=(t,s,e,a)=>{for(var i=a>1?void 0:a?cs(s,e):s,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=r(i)||i);return i};let W=class extends wt{constructor(){super(...arguments),this.lastKey=""}unhideRinging(){for(const t of this.active?.calls??[])t.state==="ringing"&&this.hiddenCalls.delete(t.call_id);this.requestUpdate(),this.sync()}updated(){super.updated();const t=this.active?.calls??[],s=t.filter(i=>i.state==="ringing").length,e=t.filter(i=>i.state==="ringing"&&this.hiddenCalls.has(i.call_id)).length,a=`${s}/${e}`;a!==this.lastKey&&(this.lastKey=a,this.dispatchEvent(new CustomEvent("home-calls",{detail:{ringing:s,waiting:e},bubbles:!0,composed:!0})))}mediaNow(t){const s=this.media.get(t.station_id);return s instanceof Promise||s===void 0?null:s}video(t){const s=this.mediaNow(t),e=s?.video?.allowed?s.video.paths.sub??s.video.paths.main??Object.values(s.video.paths)[0]??"":"";return t.online?e?n`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${e} profile="sub" poster=${t.still?V(t.station_id,this.picture):""}></sw-camera-tile>`:t.has_camera&&t.still?n`<img class="scene-pic call-still" src=${V(t.station_id,this.picture)} alt=${"מי שבכניסה: "+t.station_name} decoding="async" />`:n`<div class="cam-off big">${l("camoff")}<span>אין תמונה מהכניסה הזו</span></div>`:n`<div class="cam-off big">${l("camoff")}<span>הכניסה לא מחוברת כרגע</span></div>`}render(){this.tick;const t=this.shown();if(!t.length)return m;const s=t[Math.min(this.front,t.length-1)],e=s.answered_by_me||this.talking.has(s.call_id),a=this.busy[s.call_id],i=kt(this.mediaNow(s)).kind==="talk",o=this.notes[s.call_id],r=this.sessions.get(s.call_id),d=this.doorAsk?.startsWith(`${s.call_id}/`)?Number(this.doorAsk.split("/")[1]):null,f=h=>s.locks.find(p=>p.physical_index===h)?.name||s.station_name,c=s.can_open_door&&s.online&&s.locks.length>0,u=$t(s,this.fetchedAt,Date.now());let g;if(d!==null)g=n`<h1>לפתוח את ${f(d)}?</h1><p class="sub">הדלת תינעל שוב מעצמה אחרי כמה שניות.</p>
        <div class="call-acts"><button class="hbtn strong xl" data-call-door-yes ?disabled=${a==="door"} @click=${()=>void this.openDoor(s,d)}>${l("unlock")}כן, פתח</button><button class="hbtn xl" data-call-door-no @click=${()=>this.doorAsk=null}>ביטול</button></div>`;else{const h=c?s.locks.map(p=>n`<button class="hbtn xl${e?" strong":""}" data-call-door=${p.physical_index} ?disabled=${!!a} @click=${()=>this.doorAsk=`${s.call_id}/${p.physical_index}`}>${l("unlock")}${s.locks.length>1&&p.name?`פתח: ${p.name}`:"פתח דלת"}</button>`):[];g=n`<p class="ring-line">${l("bell")}${e?"בשיחה":"מצלצלים עכשיו"} <span class="num">${yt(u)}</span></p><h1>${e?"מדברים עם "+s.station_name:"מישהו ב"+s.station_name.replace(/^ה/,"")}</h1>
        <p class="sub">${e?r?.muted?"המיקרופון מושתק.":"שומעים אותך בכניסה. אפשר לדבר.":i?"אפשר לענות, לפתוח או להתעלם.":"אפשר לפתוח או להתעלם. דיבור עם הכניסה הזו לא זמין מכאן."}</p>
        ${o?n`<p class="sub" role="status" data-call-note=${o.tone}>${o.text}</p>`:m}
        <div class="call-acts">
          ${e?n`<button class="hbtn xl" data-call-hangup aria-pressed="true" ?disabled=${a==="hangUp"} @click=${()=>void this.signal(s,"hangUp")}>${l("mic")}סיים שיחה</button>${r&&r.phase!=="starting"&&r.phase!=="idle"?n`<button class="hbtn xl" data-call-mute @click=${()=>r.toggleMute()}>${l("mic")}${r.muted?"בטל השתקה":"השתק"}</button>`:m}`:i?n`<button class="hbtn strong xl" data-call-answer ?disabled=${!!a||!s.online} @click=${()=>void this.answer(s)}>${l("phone")}${a==="answer"?"עונה…":"ענה ודבר"}</button>`:m}
          ${h}
          ${e?m:n`<button class="hbtn quiet xl" data-call-ignore @click=${()=>this.hide(s)}>התעלם</button>`}
        </div>`}return n`<div class="ovl"><div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label="אינטרקום" data-incoming-call=${s.call_id} data-state=${e?"in_call":"ringing"}>
      <div class="call-video">${this.video(s)}${s.online?n`<span class="live onpic"><i class="dot"></i>חי</span>`:m}</div><div class="call-side">${g}</div></section></div>`}};W.styles=[nt,ot];W=ds([it("sw-home-call")],W);var hs=Object.defineProperty,ps=Object.getOwnPropertyDescriptor,x=(t,s,e,a)=>{for(var i=a>1?void 0:a?ps(s,e):s,o=t.length-1,r;o>=0;o--)(r=t[o])&&(i=(a?r(s,e,i):r(i))||i);return a&&i&&hs(s,e,i),i};const L=[["classic","קלאסי","פחם חם וכחול. המראה שאושר.",2],["ocean","אוקיינוס","כחול ים עמוק ותכלת צלול.",2],["sand","חול","אבן חמה וחימר.",2],["plum","שזיף","חציל כהה ולילך רך.",2],["midnight","חצות","כחול כמעט שחור עם פליז. כהה בלבד.",1],["nordic","נורדי","אבן בהירה וכחול צפחה.",2],["pastel","פסטל","לבנדר רך ופטל, לטאבלט של הילדים.",2]],ms=[["r/home","הבית שלי","home","home"],["scenes","סצנות","scenes","scenes"],["active","פעיל עכשיו","pulse","active"],["alerts","התראות","bell","alerts"],["settings/favs","הגדרות","sliders","settings"]],et=["r","rooms","lights","climate","shades","doors","cameras","energy","alerts","scenes","active","settings","welcome","security"],fs={disarmed:"לא דרוך",armed_home:"דרוך, יש מישהו בבית",armed_away:"דרוך, אין איש בבית",armed_night:"דרוך ללילה",armed_vacation:"דרוך לחופשה",armed_custom_bypass:"דרוך חלקית",arming:"נדרך",disarming:"מנטרל",pending:"ממתין לקוד",triggered:"אזעקה!"},R={arm_home:"דריכה בבית",arm_away:"דריכה ביציאה",arm_night:"דריכת לילה",arm_vacation:"דריכה לחופשה",arm_custom_bypass:"דריכה חלקית",disarm:"ניטרול"},gs=5*6e4,us=new Intl.DateTimeFormat("he-IL",{weekday:"long",day:"numeric",month:"long",timeZone:"Asia/Jerusalem"}),bs=new Intl.DateTimeFormat("he-IL",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"});let b=class extends zt{constructor(){super(...arguments),this.path="",this.userName="",this.userFull="",this.role="",this.policy=null,this.data=null,this.error="",this.prefs={favourites:{},layout:{},seed:{}},this.room="home",this.scope="room",this.only=!1,this.lightsTab="lights",this.zone=null,this.period="day",this.alertTab="open",this.edit=!1,this.roomsEdit=!1,this.doorsOnly=!1,this.shadesOnly=!1,this.floor="",this.page={},this.ovl=null,this.toastMsg=null,this.armed=null,this.sceneRun=null,this.phone=window.innerWidth<=700,this.now=new Date,this.visitors=[],this.kioskUntil=0,this.welcomePick="home",this.panels=[],this.calls={ringing:0,waiting:0},this.talkTo=null,this.lastScene=(()=>{try{return sessionStorage.getItem("home.lastScene")}catch{return null}})(),this.price=null,this.stopHa=null,this.refreshT=0,this.toastT=0,this.armT=0,this.clockT=0,this.holdT=0,this.held=!1,this.swipe=null,this.down={x:0,y:0},this.saveT=0,this.lastRoute="",this.onResize=()=>{const t=window.innerWidth<=700;t!==this.phone&&(this.phone=t)},this.onClick=t=>{if(this.held){this.held=!1,t.preventDefault();return}const s=t.composedPath().find(a=>a instanceof HTMLElement&&a.dataset&&a.dataset.act);if(!s||s.disabled)return;const e=this["a_"+s.dataset.act];e&&e.call(this,s)!==!0&&s.tagName==="A"&&t.preventDefault()},this.onInput=t=>{const s=t.composedPath()[0];if(!(s instanceof HTMLInputElement))return;const e=+s.value;if(s.dataset.master){const a=this.roomById(s.dataset.master);if(!a)return;const o=a.lights.filter(r=>!r.sw&&r.can).some(r=>r.on);for(const r of a.lights)r.can&&(e===0?r.on&&(r.on=!1,r.sw?_(r,!1):S(r,0,()=>{})):!r.sw&&(!o||r.on)&&(r.on=!0,r.lvl=Math.max(1,e),S(r,r.lvl,d=>{d.ok||this.toast(d.note||"העמעום לא הצליח.")})));this.requestUpdate();return}if(s.dataset.dim){const a=this.findLight(s.dataset.dim);if(!a||!a.can)return;a.lvl=Math.max(1,e),a.on=!0,this.requestUpdate(),S(a,a.lvl,i=>{i.ok||(this.toast(i.note||"העמעום לא הצליח."),this.scheduleRefresh(200))})}},this.onPointerDown=t=>{const s=t.composedPath(),e=s.find(o=>o instanceof HTMLElement&&o.dataset?.ft&&(o.classList.contains("lcard")||o.classList.contains("wdg"))),a=s.some(o=>o instanceof HTMLElement&&(o.tagName==="INPUT"||o.classList?.contains("dim")||o.classList?.contains("star")));this.down={x:t.clientX,y:t.clientY},this.swipe=this.route().name==="r"&&!a&&s.some(o=>o instanceof HTMLElement&&o.id==="main")?{x:t.clientX,y:t.clientY}:null,window.clearTimeout(this.holdT),e&&!this.edit&&!a&&(this.holdT=window.setTimeout(()=>{this.held=!0;const o={t:e.dataset.ft,id:e.dataset.fid};this.ovl={type:"hold",f:o,label:this.favLabel(o)}},550)),s.find(o=>o instanceof HTMLElement&&o.classList?.contains("hs-now"))&&this.pol()?.kiosk&&(this.holdT=window.setTimeout(()=>{this.held=!0,this.ovl={type:"kiosk",code:"",error:""}},1200))},this.onPointerMove=t=>{Math.abs(t.clientX-this.down.x)+Math.abs(t.clientY-this.down.y)>10&&window.clearTimeout(this.holdT)},this.onPointerUp=t=>{if(window.clearTimeout(this.holdT),window.setTimeout(()=>{this.held=!1},50),this.swipe&&!this.kioskLocked()){const s=t.clientX-this.swipe.x,e=t.clientY-this.swipe.y;Math.abs(s)>70&&Math.abs(e)<50&&(this.held=!0,this.stepRoom(s>0?1:-1))}this.swipe=null},this.onKey=t=>{t.key==="Escape"&&this.ovl&&(this.ovl=null)},this.tipOver=t=>{const s=t.composedPath().find(h=>h instanceof HTMLElement&&h.classList?.contains("col")),e=t.currentTarget,a=e.querySelector(".tip");if(!s||!a)return;const[i,o,r]=(s.dataset.tip??"").split("|");a.hidden=!1,a.textContent="";const d=document.createElement("b");d.textContent=i,a.append(d);const f=document.createElement("span");f.textContent=o?o+" קוט״ש":"עוד לא הגענו",a.append(f);const c=document.createElement("span");c.textContent=r+" ביום רגיל",a.append(c);const u=s.parentElement.getBoundingClientRect(),g=s.getBoundingClientRect();a.style.left=Math.max(84,Math.min(u.width-84,g.left+g.width/2-u.left))+"px",e.querySelectorAll(".col").forEach(h=>h.classList.toggle("hot",h===s))},this.tipOff=t=>{const s=t.currentTarget,e=s.querySelector(".tip");e&&(e.hidden=!0),s.querySelectorAll(".col.hot").forEach(a=>a.classList.remove("hot"))}}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),this.clockT=window.setInterval(()=>{this.now=new Date},2e4),this.load(),this.stopHa=_t(t=>{(t.type==="entity_state_changed"||t.type==="structure_changed")&&this.scheduleRefresh()})}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.clearInterval(this.clockT),this.stopHa?.()}scheduleRefresh(t=600){window.clearTimeout(this.refreshT),this.refreshT=window.setTimeout(()=>void this.loadOverview(),t)}async load(){try{const[t]=await Promise.all([At().catch(()=>this.prefs),this.loadOverview()]);if(this.prefs=t,this.applyLayout(),this.data){const s=this.data.modules,[e,a,i]=await Promise.all([s.has("scenes")||s.has("lights")?Dt():Promise.resolve([]),s.has("alerts")?Ct():Promise.resolve([]),s.has("energy")?Ft():Promise.resolve(null)]);this.data={...this.data,scenes:e,alerts:a,energy:i},s.has("security")&&I("alarm.view")&&this.loadPanels(),s.has("doors")&&I("access.call")&&this.loadTalk(),s.has("energy")&&(I("energy.bills")||I("energy.manage"))&&this.loadPrice(),s.has("doors")&&Mt(null,8).then(o=>{this.visitors=o.calls}).catch(()=>{})}}catch(t){this.error=$(t)}}async loadTalk(){try{const t=await St();for(const s of t.stations??[]){if(!s.online)continue;const e=await Tt(s.id).catch(()=>null);if(e?.talk?.available){const a=e.video?.allowed?e.video.paths.sub??e.video.paths.main??"":"";this.talkTo={id:s.id,name:s.name,talk:e.talk,video:a};return}}}catch{this.talkTo=null}}async loadPrice(){try{const s=(await Lt("energy/tariffs")).items.find(a=>a.kind==="fixed"&&a.current?.price),e=s?parseFloat(String(s.current?.price)):NaN;this.price=Number.isFinite(e)&&e>0?e:null}catch{this.price=null}}async loadPanels(){try{this.panels=(await Rt()).panels}catch{this.panels=[]}}async loadOverview(){try{const[t,s]=await Promise.all([Bt(),this.data?Promise.resolve(this.data.cameras):Ut()]),e=Ht(t,t.modules.includes("cameras")?s:[]);this.data={scenes:[],alerts:[],energy:null,...this.data??{},...e,cameras:t.modules.includes("cameras")?s:[]},!this.floor&&e.floors[0]&&(this.floor=e.floors[0].id),this.error=""}catch(t){this.data||(this.error=$(t))}}applyLayout(){const t=this.prefs.layout,s=this.pol(),e=L.find(i=>i[0]===(t.theme??"classic"))??L[0];let a=t.scheme==="light"||t.scheme==="auto"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";e[3]===1&&(a="dark"),this.setAttribute("data-hs-theme",e[0]),this.setAttribute("data-hs-scheme",a),this.toggleAttribute("data-hs-big",!!t.big_text),s?.kiosk&&s.kiosk_area_id&&!this.path&&(this.room=s.kiosk_area_id)}pol(){return this.policy??this.data?.policy??null}saveLayout(t){this.prefs={...this.prefs,layout:{...this.prefs.layout,...t}},this.applyLayout(),X({layout:t}).catch(s=>this.toast($(s)))}saveFavs(t,s){this.prefs={...this.prefs,favourites:{...this.prefs.favourites,[t]:s}},window.clearTimeout(this.saveT),this.saveT=window.setTimeout(()=>void X({favourites:{[t]:s}}).catch(e=>this.toast($(e))),400)}willUpdate(t){if(t.has("path")){const{name:s,arg:e}=this.route(),a=this.pol();if(s==="r"){let i=e&&this.data?.rooms.some(o=>o.id===e)?e:e==="home"||!e||this.data?"home":e;this.kioskLocked()&&a?.kiosk_area_id&&(i=a.kiosk_area_id),i!==this.room&&(this.room=i,this.scope="room",this.edit=!1,i!=="home"&&this.prefs.layout.start==="last"&&this.saveLayout({start_room:i}))}this.kioskLocked()&&a?.kiosk_area_id&&this.room!==a.kiosk_area_id&&(this.room=a.kiosk_area_id),this.ovl&&(this.ovl=null)}}route(){const t=(this.path||"").replace(/^\/+/,"");if(!t){const a=this.prefs.layout,i=this.pol();return i?.kiosk&&i.kiosk_area_id?{name:"r",arg:i.kiosk_area_id}:i?.may_switch&&!a.welcomed?{name:"welcome",arg:""}:(a.start==="last"||a.start==="fixed")&&a.start_room?{name:"r",arg:a.start_room}:{name:"r",arg:"home"}}const[s,e=""]=t.split("/");return{name:et.includes(s)?s:"r",arg:et.includes(s)?e:""}}kioskLocked(){return!!this.pol()?.kiosk&&Date.now()>this.kioskUntil}href(t){return`#/home/${t}`}go(t){const s=this.href(t);location.hash===s?this.requestUpdate():location.hash=s}get d(){return this.data}world(){const t=this.d;return{rooms:this.visRooms(),cameras:t.cameras,scenes:t.scenes,hasEnergy:!!t.energy&&t.energy.today.length>0,hasSecurity:!1}}visRooms(){const t=new Set(this.prefs.layout.hidden_rooms??[]);return this.d.rooms.filter(s=>!t.has(s.id))}roomById(t){return this.d.rooms.find(s=>s.id===t)}ctx(){return this.room==="home"?null:this.roomById(this.room)??null}scopeRooms(){const t=this.ctx();return!t||this.scope==="house"?this.visRooms():this.scope==="floor"?this.visRooms().filter(s=>s.floor===t.floor):[t]}scopeWord(){const t=this.ctx();return!t||this.scope==="house"?"בכל הבית":this.scope==="floor"?"ב"+q(this.d.floors,t.floor):"ב"+t.name}allDoors(){return this.visRooms().flatMap(t=>t.doors)}zonesOf(t){return t.flatMap(s=>s.zones)}mainZone(t){const s=this.zonesOf(t);return s.find(e=>e.id===this.zone)??s[0]??null}favRooms(){return["home",...(this.prefs.layout.fav_rooms??this.visRooms().slice(0,3).map(s=>s.id)).filter(s=>this.visRooms().some(e=>e.id===s))]}favs(t){return this.prefs.favourites[t]??this.prefs.seed[t]??ss(t,this.world())}findLight(t){for(const s of this.d.rooms){const e=s.lights.find(a=>a.id===t);if(e)return e}}findIn(t,s){for(const e of this.d.rooms){const a=t(e).find(i=>i.id===s);if(a)return a}}favLabel(t){const s=e=>e?.name??"";switch(t.t){case"scene":return"סצנה: "+s(this.d.scenes.find(e=>e.id===t.id));case"light":return s(this.findLight(t.id??""));case"switch":return s(this.findIn(e=>e.loads,t.id??""));case"shade":return s(this.findIn(e=>e.shades,t.id??""));case"climate":return"מיזוג: "+(this.findIn(a=>a.zones,t.id??"")?.name??"");case"cam":return"מצלמה: "+s(this.d.cameras.find(e=>e.id===t.id));case"door":return s(this.findIn(e=>e.doors,t.id??""));case"allLights":return"כל האורות";default:return"חשמל היום"}}toast(t,s=null){this.toastMsg={text:t,undo:s},window.clearTimeout(this.toastT),this.toastT=window.setTimeout(()=>{this.toastMsg=null},5200)}async outcome(t,s){const e=await t;e.ok?s&&this.toast(s):this.toast(e.note||"הפעולה לא הצליחה."),this.scheduleRefresh(900)}snapshotLights(t){return t.flatMap(s=>s.lights.map(e=>({l:e,on:e.on,lvl:e.lvl})))}undoLights(t){return()=>{for(const s of t)s.on&&(s.l.on=!0,s.l.sw?_(s.l,!0):S(s.l,s.lvl,()=>{}));this.toastMsg=null,this.requestUpdate(),this.scheduleRefresh(1200)}}bulkScope(t){return t.length===1&&t[0].canBulk?{kind:"area",id:t[0].id}:t.length>1&&t.length===this.d.rooms.length&&this.d.canBulk?{kind:"building",id:"*"}:null}offLights(t,s,e){const a=M(t),i=this.snapshotLights(t);for(const r of t)r.lights.forEach(d=>{d.can&&(d.on=!1)}),s&&r.zones.forEach(d=>{d.can&&(d.mode="off")});this.requestUpdate();const o=[as(t,this.bulkScope(t))];s&&o.push(is(this.zonesOf(t))),Promise.all(o).then(r=>{const d=r.find(f=>!f.ok);d&&this.toast(d.note||"חלק מהכיבוי לא הצליח."),this.scheduleRefresh(900)}),this.toast((e||(a===1?"האור כובה":`${a} אורות כובו`))+Zt(t),this.undoLights(i))}stepRoom(t){const s=this.favRooms(),e=Math.max(0,s.indexOf(this.room));this.go("r/"+s[(e+t+s.length)%s.length])}fromEl(t){const s={t:t.dataset.ft};return t.dataset.fid&&(s.id=t.dataset.fid),s}a_light(t){const s=this.findLight(t.dataset.l??"");if(!s||!s.can)return this.toast(s&&!s.ok?"האור לא זמין כרגע.":"אין הרשאה להפעיל את האור הזה.");s.on=!s.on,this.requestUpdate(),this.outcome(s.sw?_(s,s.on):s.on?new Promise(e=>S(s,s.lvl||100,e)):_(s,!1))}a_load(t){const s=this.findIn(e=>e.loads,t.dataset.ld??"");if(!s||!s.can)return this.toast("אין הרשאה להפעיל את המפסק הזה.");if(s.on&&s.guard){this.ovl={type:"guard",id:s.id};return}s.on=!s.on,this.requestUpdate(),this.outcome(_(s,s.on))}a_guardOff(){const t=this.ovl;if(t?.type!=="guard")return;const s=this.findIn(e=>e.loads,t.id);this.ovl=null,s&&(s.on=!1,this.outcome(_(s,!1),"כובה"))}a_roomLights(t){const s=this.roomById(t.dataset.room??"");if(!s)return;if(s.lights.some(a=>a.on))return this.offLights([s],!1,"");for(const a of s.lights.filter(i=>i.can))a.on=!0,a.sw?_(a,!0):new Promise(i=>S(a,a.lvl||100,i));this.requestUpdate(),this.scheduleRefresh(1200)}a_allOff(){this.offLights(this.visRooms(),!1,"")}a_scopeOff(){this.offLights(this.scopeRooms(),!1,"")}a_roomOff(){const t=this.ctx();this.offLights(t?[t]:this.visRooms(),!0,t?`${t.name}: האורות והמיזוג כובו`:"האורות והמיזוג בכל הבית כובו")}a_roomOffId(t){const s=this.roomById(t.dataset.room??"");s&&this.offLights([s],!0,`${s.name}: האורות והמיזוג כובו`)}a_houseOff(){this.offLights(this.visRooms(),!0,"האורות והמיזוג בכל הבית כובו")}a_undo(){this.toastMsg?.undo?.()}a_scene(t){const s=this.d.scenes.find(a=>a.id===t.dataset.scene);if(!s)return;const e=()=>{this.sceneRun=s.id,window.setTimeout(()=>{this.sceneRun=null},620),this.lastScene=s.id;try{sessionStorage.setItem("home.lastScene",s.id)}catch{}this.outcome(ls(s),`סצנת ${s.name} הופעלה`)};s.sensitive?this.ovl={type:"ask",title:`להפעיל את ${s.name}?`,text:"הסצנה הזו משנה גם דברים רגישים.",yes:"כן, הפעל",run:e}:e()}a_askYes(){const t=this.ovl;this.ovl=null,t?.type==="ask"&&t.run()}a_roomStep(t){this.stepRoom(+(t.dataset.d??1))}a_favRoom(t){const s=t.dataset.id??"",e=(this.prefs.layout.fav_rooms??this.favRooms().slice(1)).slice(),a=e.indexOf(s);a>=0?e.splice(a,1):e.push(s),this.saveLayout({fav_rooms:e})}a_roomsEdit(){this.roomsEdit=!this.roomsEdit}a_edit(){this.edit=!this.edit}a_wgMove(t){const s=this.favs(this.room).filter(i=>T(i,this.world())).slice(),e=+(t.dataset.ix??0),a=e+ +(t.dataset.d??0);a<0||a>=s.length||([s[e],s[a]]=[s[a],s[e]],this.saveFavs(this.room,s))}a_wgDel(t){const s=this.favs(this.room).filter(i=>T(i,this.world())).slice(),[e]=s.splice(+(t.dataset.ix??0),1),a=this.room;this.saveFavs(a,s),this.toast("הוסר מהמועדפים",()=>{const i=this.favs(a).slice();i.push(e),this.saveFavs(a,i),this.toastMsg=null})}a_wgSize(t){const s=this.favs(this.room).filter(a=>T(a,this.world())).map(a=>({...a})),e=s[+(t.dataset.ix??0)];e?.t==="light"&&(e.w=H(e)===2?1:2,this.saveFavs(this.room,s))}a_star(t){const s=this.fromEl(t),e=this.favs(this.room).slice(),a=e.findIndex(o=>A(o,s)),i=this.ctx();a>=0?(e.splice(a,1),this.toast("הוסר מהמועדפים")):(s.t==="light"&&(s.w=this.findLight(s.id??"")?.sw?1:2),e.push(s),this.toast(`נוסף למועדפים של ${i?i.name:"הבית שלי"}`)),this.saveFavs(this.room,e)}a_holdFav(t){const s=this.ovl;if(s?.type!=="hold")return;const e=t.dataset.k??this.room,a=this.favs(e).slice(),i=a.findIndex(o=>A(o,s.f));i>=0&&e===this.room?a.splice(i,1):i<0&&a.push({...s.f,...s.f.t==="light"?{w:2}:{}}),this.saveFavs(e,a),this.ovl=null,this.toast(e==="home"?'נוסף ל"הבית שלי"':"המועדפים עודכנו")}a_scope(t){this.scope=t.dataset.v,this.page={},this.zone=null}a_only(t){this.only=t.dataset.v==="1",this.page={...this.page,lights:0,loads:0}}a_shadesOnly(t){this.shadesOnly=t.dataset.v==="1",this.page={...this.page,shades:0}}a_doorsOnly(t){this.doorsOnly=t.dataset.v==="1",this.page={...this.page,doors:0}}a_lightsTab(t){this.lightsTab=t.dataset.v}a_goLoads(){return this.lightsTab="loads",this.scope="house",this.only=!0,!0}a_floor(t){this.floor=t.dataset.v??"",this.page={...this.page,roomsP:0,setRooms:0}}a_page(t){const s=t.dataset.key??"";this.page={...this.page,[s]:Math.max(0,(this.page[s]??0)+ +(t.dataset.d??0))}}a_temp(t){const s=this.findIn(a=>a.zones,t.dataset.zone??"");if(!s||!s.can)return this.toast("אין הרשאה לכוון את המזגן הזה.");const e=s.target??s.temp??23;s.target=Math.max(s.min,Math.min(s.max,e+ +(t.dataset.d??0)*(s.step||1))),s.mode==="off"&&(s.mode=s.modes.includes("cool")?"cool":"auto"),this.requestUpdate(),this.outcome(tt(s,s.target))}a_preset(t){const s=this.findIn(e=>e.zones,t.dataset.zone??"");!s||!s.can||(s.target=+(t.dataset.v??23),this.requestUpdate(),this.outcome(tt(s,s.target)))}a_modeSeg(t){const s=this.mainZone(this.scopeRooms());!s||!s.can||(s.mode=t.dataset.v??"off",this.requestUpdate(),this.outcome(ns(s,s.mode)))}a_zone(t){this.zone=t.dataset.v??null,this.ovl=null}a_zoneGo(t){this.zone=t.dataset.v??null;const s=this.ctx();return s&&!s.zones.some(e=>e.id===this.zone)&&(this.scope="house"),!0}a_zones(){this.ovl={type:"zones"}}a_shade(t){const s=this.findIn(i=>i.shades,t.dataset.id??""),e=t.dataset.v;if(!s||!s.can)return this.toast("אין הרשאה להזיז את התריס הזה.");const a=`${s.id}:${e}`;if(e!=="stop"&&this.armed!==a){this.armed=a,window.clearTimeout(this.armT),this.armT=window.setTimeout(()=>{this.armed=null},3e3);return}this.armed=null,s.moving=e!=="stop",s.state=e==="open"?"opening":e==="close"?"closing":s.state,this.requestUpdate(),this.outcome(st(s,e))}a_shadesAll(t){const s=t.dataset.v==="open"?"open":"close",e=this.scopeRooms().flatMap(a=>a.shades).filter(a=>a.can);e.length&&(this.ovl={type:"ask",title:s==="open"?"לפתוח את כל התריסים?":"לסגור את כל התריסים?",text:`${e.length===1?"תריס אחד":e.length+" תריסים"} ${this.scopeWord()}.`,yes:s==="open"?"כן, פתח":"כן, סגור",run:()=>{e.forEach(a=>{a.moving=!0,st(a,s)}),this.toast(s==="open"?"התריסים נפתחים":"התריסים נסגרים"),this.scheduleRefresh(1500)}})}a_doorAsk(t){this.ovl={type:"confirm",door:t.dataset.door??""}}a_doorOpen(t){const s=this.findIn(e=>e.doors,t.dataset.door??"");this.ovl=null,s&&os(s).then(e=>{e.ok?this.toast(`${s.name}: נשלחה פקודת פתיחה. ${s.kind==="gate"?"השער ייסגר":"הדלת תינעל"} שוב מעצמ${s.kind==="gate"?"ו":"ה"}.`):this.toast(e.note||"הדלת לא נפתחה."),this.scheduleRefresh(1500)})}a_doorLock(t){const s=this.findIn(e=>e.doors,t.dataset.door??"");s&&this.outcome(rs(s),`${s.name} ננעלה`)}a_cam(t){this.ovl={type:"cam",id:t.dataset.cam??""}}a_camStep(t){const s=this.ovl;if(s?.type!=="cam")return;const e=this.d.cameras,a=e.findIndex(i=>i.id===s.id);this.ovl={type:"cam",id:e[(a+ +(t.dataset.d??1)+e.length)%e.length].id}}a_period(t){this.period=t.dataset.v}a_alertTab(t){this.alertTab=t.dataset.v,this.page={...this.page,alerts:0}}a_alertAck(t){const s=this.d.alerts.find(e=>e.id===t.dataset.id);s&&Ot().ack(s.id).then(()=>{s.open=!1,s.tone="ok",this.requestUpdate(),this.toast("טופל. תודה.")}).catch(e=>this.toast($(e)))}a_menu(){this.ovl={type:"menu"}}a_close(){this.ovl=null}a_closeNav(){return this.ovl=null,!0}a_face(t){const s=t.dataset.v==="full"?"full":"home";this.ovl=null,s!=="home"&&U("full").then(()=>{location.hash="#/",location.reload()}).catch(e=>this.toast($(e)))}a_theme(t){this.saveLayout({scheme:t.dataset.v==="light"?"light":"dark"})}a_hs(t){this.saveLayout({theme:t.dataset.v??"classic"})}a_bigText(){this.saveLayout({big_text:!this.prefs.layout.big_text})}a_start(t){const s=t.dataset.v;this.saveLayout({start:s,start_room:s==="fixed"||s==="last"?this.ctx()?.id??this.prefs.layout.start_room??null:null})}a_setTab(t){this.go("settings/"+(t.dataset.v??"favs"))}a_roomVis(t){const s=t.dataset.id??"",e=new Set(this.prefs.layout.hidden_rooms??[]);e.has(s)?e.delete(s):e.add(s),this.saveLayout({hidden_rooms:[...e]})}a_welcomePick(t){this.welcomePick=t.dataset.v==="full"?"full":"home"}a_welcomeGo(){this.saveLayout({welcomed:!0}),this.welcomePick==="full"?U("full").then(()=>{location.hash="#/",location.reload()}).catch(t=>this.toast($(t))):(U("home").catch(()=>{}),this.go("r/home"))}a_alarm(t){const s=this.panels.find(o=>o.entity_id===t.dataset.panel),e=t.dataset.v;if(!s)return;const a=e==="disarm"?s.code.disarm:s.code.arm;if(a==="unverifiable"||a==="pin_missing")return this.toast(a==="pin_missing"?"צריך קוד אישי לאזעקה. מגדירים אותו בממשק המלא.":"אי אפשר לאמת קוד לפעולה הזו מכאן.");const i=o=>{this.ovl=null,jt(s.entity_id,e,{confirmed:!0,code:o}).then(()=>{this.toast(`${s.name}: ${R[e]} נשלחה`),window.setTimeout(()=>void this.loadPanels(),1500)}).catch(r=>this.toast($(r)))};a==="pin"||a==="panel"?this.ovl={type:"code",title:`${R[e]}: ${s.name}`,code:"",error:"",run:o=>i(o)}:this.ovl={type:"ask",title:`${R[e]}?`,text:s.name,yes:"כן",run:()=>i()}}a_codeKey(t){const s=this.ovl;if(s?.type!=="code")return;const e=t.dataset.k??"";this.ovl={...s,code:e==="del"?s.code.slice(0,-1):s.code.length<12?s.code+e:s.code,error:""}}a_codeGo(){const t=this.ovl;t?.type==="code"&&t.code&&t.run(t.code)}a_talk(){this.talkTo&&(this.ovl={type:"talk"})}a_ring(){this.renderRoot.querySelector("sw-home-call")?.unhideRinging()}a_switchUser(){this.ovl=null,Et("logout")}a_kioskKey(t){const s=this.ovl;if(s?.type!=="kiosk")return;const e=t.dataset.k??"",a=e==="del"?s.code.slice(0,-1):s.code.length<8?s.code+e:s.code;this.ovl={...s,code:a,error:""}}a_kioskGo(){const t=this.ovl;t?.type!=="kiosk"||t.code.length<4||It("home/kiosk/exit",{code:t.code}).then(()=>{this.kioskUntil=Date.now()+gs,this.ovl=null,this.toast("מסך הקיר פתוח לחמש דקות.")}).catch(s=>{this.ovl={type:"kiosk",code:"",error:$(s)}})}pg(t){return this.page[t]??0}pager(t,s){if(s<=1)return m;const e=Math.min(this.pg(t),s-1);return n`<div class="pager" role="group" aria-label="דפדוף"><button class="rb" data-act="page" data-key=${t} data-d="-1" ?disabled=${e===0} aria-label="הקודם">${l("back")}</button><span class="pg num" aria-live="polite">${e+1} מתוך ${s}</span><button class="rb" data-act="page" data-key=${t} data-d="1" ?disabled=${e>=s-1} aria-label="הבא">${l("fwd")}</button></div>`}seg(t,s,e,a){return n`<div class="seg" role="group" aria-label=${a}>${s.map(([i,o])=>n`<button data-act=${t} data-v=${i} aria-pressed=${String(i===e)}>${o}</button>`)}</div>`}scopeSeg(){return this.ctx()?this.seg("scope",[["room","החדר הזה"],["floor","הקומה"],["house","כל הבית"]],this.scope,"איפה"):m}onlySeg(t,s,e){return this.seg(t,[["0","הכל"],["1",e]],s?"1":"0","סינון")}head(t,s,e){return n`<header class="hs-head"><div class="ttl"><h2 class="pg-t clamp1">${t}</h2>${s?n`<p class="sub clamp1">${s}</p>`:m}</div>${e?n`<div class="acts">${e}</div>`:m}</header>`}headT(t,s,e,a){return this.phone?n`${this.head(t,s,a)}<div class="bar tabsrow">${e}</div>`:this.head(t,s,n`${e}${a??m}`)}empty(t,s,e){return n`<div class="empty">${l(t)}<h2>${s}</h2><p>${e}</p></div>`}star(t){const s=this.favs(this.room).some(e=>A(e,t));return n`<button class="rb star" data-act="star" data-ft=${t.t} data-fid=${t.id??""} aria-pressed=${String(s)} aria-label=${s?"הסר מהמועדפים":"הוסף למועדפים"}>${l("star")}</button>`}sw(t,s,e,a=""){return n`<button class="hsw" role="switch" aria-checked=${String(t)} data-act=${s} data-id=${a} aria-label=${e}><i></i></button>`}dimmer(t){const s=t.on?t.lvl:0;return n`<label class="dim${t.on&&t.lvl>=50?"":" lo"}"><span class="dim-fill" style=${`transform:scaleX(${s/100})`}></span><span class="dim-edge" style=${`transform:translateX(${-s}%)`}><i></i></span><input type="range" min="1" max="100" .value=${String(t.lvl)} data-dim=${t.id} ?disabled=${!t.can} aria-label=${"עוצמת "+t.name}><span class="dim-v num">${t.on?t.lvl+"%":"כבוי"}</span></label>`}lampBtn(t){return n`<button class="lamp" data-act="light" data-l=${t.id} aria-pressed=${String(t.on)} ?disabled=${!t.ok} aria-label=${t.name}>${l(t.sw?"switch":"bulb")}</button>`}swCtl(t){return n`<span class="swc"><span class="sw-t">${P(t.on)}</span><button class="hsw" role="switch" aria-checked=${String(t.on)} data-act="light" data-l=${t.id} ?disabled=${!t.ok} aria-label=${t.name}><i></i></button></span>`}trio(t){const s=(e,a,i)=>{const o=this.armed===`${t.id}:${e}`;return n`<button class="rb${o?" armed":""}" data-act="shade" data-id=${t.id} data-v=${e} ?disabled=${!t.can} aria-label=${o?i+": לחצו שוב לאישור":i}>${l(a)}</button>`};return n`<div class="trio">${s("open","up","פתח")}${s("stop","stop","עצור")}${s("close","down","סגור")}</div>`}camPic(t,s){return n`${t.ok?n`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" cameraId=${t.id} state="live" ?live=${s} profile="sub" autoProfile poster=${K(t.id)} .stillRefresh=${s?0:30}></sw-camera-tile>`:n`<div class="cam-off">${l("camoff")}<span>המצלמה לא זמינה כרגע</span></div>`}<div class="cap"><span class="clamp1">${t.name}</span>${t.ok?n`<span class="live"><i class="dot"></i>חי</span>`:m}</div>`}strip(t){const s=this.allDoors(),e=s.filter(u=>!u.locked),a=this.d.alerts.filter(u=>u.open).length,i=this.ctx(),o=t!=="r",r=this.kioskLocked(),d=this.favRooms(),f=d.indexOf(this.room),c=n`<span class="tb-t"><h1 class="clamp1">${i?i.name:"הבית שלי"}</h1><span class="tb-c clamp1">${i?q(this.d.floors,i.floor):this.userFull||this.userName}</span></span>`;return n`<header class="hs-strip">
      ${o?n`<a class="tb-back" href=${this.href("r/"+this.room)} aria-label=${"חזרה אל "+(i?i.name:"הבית שלי")}>${l("back")}</a>`:m}
      ${r?n`<span class="tb-room">${c}</span>`:n`<a class="tb-room" href=${this.href("rooms")} aria-label=${"החלפת חדר. עכשיו: "+(i?i.name:"הבית שלי")}>${c}${l("down")}</a>`}
      ${d.length>1&&!r?n`<div class="tb-fav" role="group" aria-label="חדרים מועדפים"><button class="rb" data-act="roomStep" data-d="-1" aria-label="החדר המועדף הקודם">${l("back")}</button><span class="dots" aria-hidden="true">${d.map((u,g)=>n`<i class=${g===f?"on":""}></i>`)}</span><button class="rb" data-act="roomStep" data-d="1" aria-label="החדר המועדף הבא">${l("fwd")}</button></div>`:m}
      <div class="hs-now"><span class="time num">${bs.format(this.now)}</span><span class="date">${us.format(this.now)}</span>${this.d.weather&&this.d.weather.t!=null?n`<span class="wx" title="מזג האוויר בחוץ">${l("sun")}<span class="num">${this.d.weather.t}°</span><span class="wxt ellip">${this.d.weather.text}</span></span>`:m}</div>
      <div class="hs-status">
        ${this.calls.waiting?n`<button class="st-pill call" data-act="ring">${l("bell")}<span>מחכים בדלת</span></button>`:m}
        ${this.d.modules.has("doors")?n`<a class="st-pill" href=${this.href("doors")} data-tone=${s.length?e.length?"warn":"ok":"neutral"}><i class="dot"></i><span>${Z(s)}</span></a>`:m}
        ${this.d.modules.has("alerts")?n`<a class="st-btn" href=${this.href("alerts")} aria-label=${"התראות"+(a?": "+a+" דורשות טיפול":"")}>${l("bell")}${a?n`<b class="count num">${a}</b>`:m}</a>`:m}
        <button class="st-me" data-act="menu" aria-haspopup="dialog" aria-label=${"התפריט של "+this.userName}><span class="av">${(this.userName||"?").slice(0,1)}</span></button>
      </div></header>`}nav(t){const s=ms.filter(([,,,e])=>e!=="alerts"||this.d.modules.has("alerts")).filter(([,,,e])=>e!=="scenes"||this.d.modules.has("scenes"));return n`<nav class="hs-nav" aria-label="ניווט ראשי">${s.map(([e,a,i,o])=>n`<a href=${this.href(e)} aria-current=${t===o?"page":m}>${l(i)}<span>${a}</span></a>`)}</nav>`}nowBar(){const t=this.ctx(),s=t?t.lights.some(i=>i.on)||t.zones.some(C):D(this.visRooms()).length>0,e=t&&t.lights.some(i=>!i.sw)?Gt(t):null,a=t?G(t):Yt(this.visRooms());return n`<footer class="nowbar" aria-label=${t?"עכשיו ב"+t.name:"עכשיו בבית"}><a class="nb-t" href=${this.href("active")}><span class="nb-k">${t?"עכשיו בחדר":"עכשיו בבית"}</span><b class="clamp1">${a}</b></a>
      ${!t&&!this.phone?n`<span class="nb-rooms">${D(this.visRooms()).slice(0,3).map(i=>n`<a class="chip2" href=${this.href("r/"+i.id)}><span class="clamp1">${i.name}</span></a>`)}</span>`:m}
      ${e!=null&&t?n`<span class="nb-ml">כל האורות</span><label class="dim master${e>=50?"":" lo"}"><span class="dim-fill" style=${`transform:scaleX(${e/100})`}></span><span class="dim-edge" style=${`transform:translateX(${-e}%);opacity:${e?1:0}`}><i></i></span><input type="range" min="0" max="100" .value=${String(e)} data-master=${t.id} aria-label=${"עוצמת כל האורות ב"+t.name}><span class="dim-v num">${e?e+"%":"כבוי"}</span></label>`:m}
      <button class="hbtn nb-off" data-act="roomOff" ?disabled=${!s}>${l("power")}<span class="bt">${t?"כיבוי החדר":"כיבוי כל הבית"}</span></button></footer>`}chips(){const t=this.ctx(),s=t?[t]:this.visRooms(),e=this.d.modules,a=[],i=s.reduce((h,p)=>h+p.lights.length+p.loads.length,0),o=M(s);i&&e.has("lights")&&a.push(["lights","תאורה","bulb",o===0?"כבויים":o===1?"אחד דולק":o+" דולקים",o>0?"lit":""]);const r=this.zonesOf(s);r.length&&e.has("climate")&&a.push(["climate","אקלים","thermo",t?r[0].mode==="off"?"כבוי":n`<span class="num">${r[0].target??"—"}°</span>`:`${r.filter(C).length} פועלים`,""]);const d=s.flatMap(h=>h.shades);if(d.length&&e.has("shades")){const h=d.filter(p=>(p.pos??0)>0).length;a.push(["shades","תריסים","shade",h===0?"סגורים":h===1?"אחד פתוח":h+" פתוחים",""])}const f=s.flatMap(h=>h.doors);if(f.length&&e.has("doors")){const h=f.filter(p=>!p.locked).length;a.push(["doors","דלתות",h?"unlock":"lock",h?h===1?"אחת פתוחה":h+" פתוחות":"נעול",h?"warn":"ok"])}const c=t?this.d.cameras.filter(h=>t.cams.includes(h.id)):this.d.cameras;if(c.length&&e.has("cameras")){const h=c.filter(p=>!p.ok).length;a.push(["cameras","מצלמות","cam",t?h?"לא זמינה":"חי":h?`${c.length-h} מתוך ${c.length}`:c.length+" פועלות",""])}if(!t&&e.has("doors")&&this.visitors.length&&a.push(["doors","אינטרקום","phone",`${this.visitors.length} ביקורים`,"","intercom"]),!t&&this.d.energy&&this.d.energy.today.length&&e.has("energy")&&a.push(["energy","חשמל","bolt",n`<span class="num">${this.d.energy.today.reduce((h,p)=>h+p,0).toFixed(1)}</span> קוט״ש`,""]),!t&&this.panels.length&&e.has("security")){const h=this.panels.some(w=>w.state&&w.state!=="disarmed"),p=this.panels.some(w=>w.state==="triggered");a.push(["security","אבטחה","shield",p?"אזעקה!":h?"דרוך":"לא דרוך",p?"warn":h?"ok":""])}const u=t?this.d.scenes.filter(h=>h.rooms.includes(t.id)):this.d.scenes;e.has("scenes")&&this.d.scenes.length&&a.push(["scenes","סצנות","scenes",t?u.length?u.length+" בחדר":"של הבית":this.d.scenes.length+" בבית",""]);const g=a.slice(0,8);return{n:g.length,t:g.map(([h,p,w,F,z,B])=>n`<a class="chip3" href=${this.href(h)} data-cat=${B??h}>${l(w,z==="lit"?"lit":"")}<span class="c3-t"><b>${p}</b><span class="c3-s" data-tone=${z==="ok"||z==="warn"?z:m}>${z==="ok"||z==="warn"?n`<i class="dot"></i>`:m}<span>${F}</span></span></span></a>`)}}widget(t,s){const e=H(t,t.t==="light"&&!!this.findLight(t.id??"")?.sw),a=this.edit?n`<div class="wg-ed"><span class="ed-n clamp1">${this.favLabel(t)}</span><span class="ed-b"><button class="rb" data-act="wgMove" data-ix=${s} data-d="-1" aria-label="הזז אחורה">${l("back")}</button>${t.t==="light"&&!this.findLight(t.id??"")?.sw?n`<button class="rb" data-act="wgSize" data-ix=${s} aria-label=${e===2?"הקטן":"הגדל, עם עמעום"}>${l("size")}</button>`:m}<button class="rb" data-act="wgMove" data-ix=${s} data-d="1" aria-label="הזז קדימה">${l("fwd")}</button><button class="rb del" data-act="wgDel" data-ix=${s} aria-label="הסר מהמועדפים">${l("x")}</button></span></div>`:m,i=`tile wdg w${this.edit&&this.phone?2:e} h${Q(t)} wg-${t.t==="switch"?"load":t.t}${e===1?" s1":""}${this.edit?" editing":""}`;let o=m;if(t.t==="scene"){const r=this.d.scenes.find(d=>d.id===t.id);o=n`<button class="wg-btn scene${this.sceneRun===r.id?" run":""}" data-act="scene" data-scene=${r.id} aria-pressed=${String(this.activeScene()===r.id)}>${l(r.icon)}<span class="sn clamp2">${r.name}</span></button>`}else if(t.t==="light"){const r=this.findLight(t.id??""),d=this.room!==r.room;o=e===2?n`<div class="lrow wl2${r.on?" is-on":""}">${this.lampBtn(r)}<span class="ln"><b class="clamp1">${r.name}</b>${d?n`<span class="muted clamp1">${this.roomById(r.room)?.name??""}</span>`:m}</span>${this.dimmer(r)}</div>`:n`<button class="wg-btn ltile${r.on?" is-on":""}" data-act="light" data-l=${r.id} aria-pressed=${String(r.on)}>${l(r.sw?"switch":"bulb")}<span class="lt"><b class="clamp2">${r.name}</b></span><span class="lv num">${r.sw?P(r.on):r.on?r.lvl+"%":"כבוי"}</span></button>`}else if(t.t==="switch"){const r=this.findIn(d=>d.loads,t.id??"");o=n`<button class="wg-btn ltile ld${r.on?" is-on":""}" data-act="load" data-ld=${r.id} aria-pressed=${String(r.on)}>${l(this.loadIcon(r))}<span class="lt"><b class="clamp2">${r.name}</b></span><span class="lv">${P(r.on)}</span></button>`}else if(t.t==="climate"){const r=this.findIn(f=>f.zones,t.id??""),d=r.mode==="off";o=n`<a class="cover" href=${this.href("climate")} data-act="zoneGo" data-v=${r.id} aria-label=${"אקלים: "+r.name}></a><div class="wg-c"><span class="wg-k clamp1">${l("thermo")}${this.room===r.room?"אקלים":r.name}</span><b class="big num">${d||r.target==null?"—":r.target+"°"}</b><span class="muted">${d?"כבוי":n`עכשיו <span class="num">${r.temp??"—"}°</span>`}</span></div><div class="pm"><button class="rb" data-act="temp" data-zone=${r.id} data-d="-1" aria-label="קר יותר">${l("down")}</button><button class="rb" data-act="temp" data-zone=${r.id} data-d="1" aria-label="חם יותר">${l("up")}</button></div>`}else if(t.t==="cam"){const r=this.d.cameras.find(d=>d.id===t.id);o=n`<button class="wg-btn pic" data-act="cam" data-cam=${r.id} aria-label=${"מצלמה: "+r.name}>${this.camPic(r,!0)}</button>`}else if(t.t==="door"){const r=this.findIn(d=>d.doors,t.id??"");o=this.doorBody(r,!1)}else if(t.t==="shade"){const r=this.findIn(d=>d.shades,t.id??"");o=n`<span class="dn"><b class="clamp1">${r.name}</b><span class="muted">${J(r.pos,r.moving,r.state)}</span></span>${this.trio(r)}`}else if(t.t==="allLights"){const r=M(this.visRooms());o=n`<a class="cover" href=${this.href("lights")} aria-label="אורות"></a><div class="wg-c"><span class="wg-k">${l("bulb",r?"lit":"")}אורות בבית</span><b class="mid">${O(r)}</b></div><button class="hbtn" data-act="allOff" ?disabled=${!r}>${l("power")}<span class="bt">כבה הכל</span></button>`}else{const r=(this.d.energy?.today??[]).reduce((d,f)=>d+f,0);o=n`<a class="cover" href=${this.href("energy")} aria-label=${`חשמל היום: ${r.toFixed(1)} קוט״ש`}></a><div class="wg-c en1"><span class="wg-k">${l("bolt")}חשמל היום</span><b class="mid num">${r.toFixed(1)}</b><span class="muted">קוט״ש</span></div>`}return n`<div class=${i} data-ft=${t.t} data-fid=${t.id??""}>${o}${a}</div>`}doorBody(t,s){return n`<span class="di" data-tone=${t.locked?"ok":"warn"}>${l(t.locked?"lock":"unlock")}</span><span class="dn"><b class="clamp2">${t.name}</b><span class="dst" data-tone=${t.locked?"ok":"warn"}><i class="dot"></i>${t.ok?Xt(t):"לא זמינה כרגע"}</span></span>${t.locked||t.wiskey?n`<button class="hbtn" data-act="doorAsk" data-door=${t.id} ?disabled=${!t.can}>פתח</button>`:n`<button class="hbtn" data-act="doorLock" data-door=${t.id} ?disabled=${!t.can}>נעל</button>`}${s?this.star({t:"door",id:t.id}):m}`}loadIcon(t){return{boiler:"drop",fridge:"fridge",socket:"plug",pump:"pump",other:"plug"}[t.type]}sRoom(){const t=this.ctx(),s=this.world(),e=this.favs(this.room).filter(u=>T(u,s)),a=this.phone?3:6,i=this.phone?5:3,o=u=>{const g=u[0],h=H(g,g.t==="light"&&!!this.findLight(g.id??"")?.sw);return(this.phone&&(h===2||this.edit)?3:h)*Q(g)},r=Qt(e.map((u,g)=>[u,g]),o,a,i),d="fav-"+this.room,f=Math.min(this.pg(d),r.length-1),c=this.chips();return n`<nav class="chips3" style=${`--c:${c.n<=5?c.n:4}`} aria-label=${t?"מה יש ב"+t.name:"מה יש בבית"}>${c.t}</nav>
      <section class="favz" aria-label="מועדפים"><div class="bar"><h2>${t?"המועדפים שלי כאן":Jt(this.userName,this.now)}</h2><div class="acts">${this.pager(d,r.length)}<button class="hbtn" data-act="edit" aria-pressed=${String(this.edit)}>${l(this.edit?"check":"edit")}<span class="bt">${this.edit?"סיום":"עריכה"}</span></button></div></div>
        <div class="wgrid">${r[f].length?r[f].map(([u,g])=>this.widget(u,g)):this.empty("star","עוד אין כאן מועדפים","פתחו אורות, סצנות או מצלמות ולחצו על הכוכב כדי להצמיד אותם לכאן.")}</div></section>`}roomTile(t){const s=t.lights.some(a=>a.on),e=this.favRooms().includes(t.id);return n`<div class="tile room" data-room=${t.id} data-cur=${this.room===t.id?"1":m}><a class="cover" href=${this.href("r/"+t.id)} aria-label=${t.name}></a><div class="rt"><b class="clamp1">${t.name}</b><span class="meta">${t.temp!=null?n`<span class="num">${t.temp}°</span> · `:m}${Kt(t)}</span></div>${this.roomsEdit?n`<button class="lamp heart" data-act="favRoom" data-id=${t.id} aria-pressed=${String(e)} aria-label=${e?"הסר מהחדרים המועדפים":"הוסף לחדרים המועדפים"}>${l("heart")}</button>`:t.lights.length?n`<button class="lamp" data-act="roomLights" data-room=${t.id} aria-pressed=${String(s)} aria-label=${"האורות ב"+t.name}>${l("bulb")}</button>`:m}</div>`}sRooms(){const t=n`<button class="hbtn" data-act="roomsEdit" aria-pressed=${String(this.roomsEdit)}>${l(this.roomsEdit?"check":"heart")}<span class="bt">${this.roomsEdit?"סיום":"חדרים מועדפים"}</span></button><a class="hbtn${this.room==="home"?" cur":""}" href=${this.href("r/home")}>${l("home")}<span class="bt">הבית שלי</span></a>`,s=this.visRooms(),e=this.d.floors.filter(a=>s.some(i=>i.floor===a.id));if(!s.length)return n`${this.head("לאיזה חדר?","",t)}${this.empty("rooms","עוד אין חדרים","כשיוגדרו חדרים בבית, הם יופיעו כאן לפי קומות.")}`;if(this.phone){const a=e.some(o=>o.id===this.floor)?this.floor:e[0]?.id??"",i=k(s.filter(o=>o.floor===a),6,this.pg("roomsP"));return n`${this.head("לאיזה חדר?",this.roomsEdit?"סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה":`${s.length} חדרים ב-${e.length} קומות`,t)}<div class="bar">${this.seg("floor",e.map(o=>[o.id,o.short]),a,"קומה")}</div><div class="room-list">${i.items.map(o=>this.roomTile(o))}</div>${this.pager("roomsP",i.pages)}`}return n`${this.head("לאיזה חדר?",this.roomsEdit?"סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה או בחצים שלמעלה":"כל הבית לפי קומות. הנורה מדליקה ומכבה את החדר בלי להיכנס אליו.",t)}<div class="floors-cols" style=${`--n:${e.length}`}>${e.map(a=>{const i=s.filter(r=>r.floor===a.id),o=k(i,6,this.pg("fl-"+a.id));return n`<section class="fcol"><div class="fch"><h2>${a.name}</h2><span class="muted">${O(M(i))}</span></div><div class="fcl">${o.items.map(r=>this.roomTile(r))}</div>${this.pager("fl-"+a.id,o.pages)}</section>`})}</div>`}sLights(){const t=this.scopeRooms(),s=M(t),e=t.length>1,a=this.visRooms().some(c=>c.loads.length),i=this.lightScenes(),o=this.lightsTab==="loads"&&!a||this.lightsTab==="scenes"&&!i.length?"lights":this.lightsTab,r=this.seg("lightsTab",[["lights","אורות"],...a?[["loads","מפסקים"]]:[],...i.length?[["scenes","סצנות"]]:[]],o,"תצוגה");if(o==="scenes"){const c=k(i,this.phone?4:8,this.pg("lsc"));return n`${this.headT("תאורה","סצנות "+this.scopeWord(),r)}<div class="card-grid">${c.items.map(u=>this.sceneCard(u,!1))}</div>${this.pager("lsc",c.pages)}`}if(o==="loads"){let c=t.flatMap(h=>h.loads);const u=c.filter(h=>h.on).length;this.only&&(c=c.filter(h=>h.on));const g=k(c,this.phone?4:8,this.pg("loads"));return n`${this.headT(u===0?"כל המפסקים כבויים":u===1?"מפסק אחד דולק":`${u} מפסקים דולקים`,"מפסקים שאינם אור "+this.scopeWord()+'. "כיבוי הכל" וכיבוי חדר לא נוגעים בהם.',r)}
        <div class="bar wrap">${this.scopeSeg()}${this.onlySeg("only",this.only,"דולקים")}</div>
        <div class="card-grid">${g.items.length?g.items.map(h=>n`<div class="tile lcard sw${h.on?" is-on":""}" data-ft="switch" data-fid=${h.id}><button class="lamp ld" data-act="load" data-ld=${h.id} aria-pressed=${String(h.on)} ?disabled=${!h.ok} aria-label=${h.name}>${l(this.loadIcon(h))}</button><span class="ln"><b class="clamp1">${h.name}</b><span class="muted clamp1">${h.guard?"מוגן: שואל לפני כיבוי":'לא נכבה ב"כיבוי הכל"'}${e?" · "+(this.roomById(h.room)?.name??""):""}</span></span><span class="swc"><span class="sw-t">${P(h.on)}</span><button class="hsw" role="switch" aria-checked=${String(h.on)} data-act="load" data-ld=${h.id} ?disabled=${!h.ok} aria-label=${h.name}><i></i></button></span>${this.star({t:"switch",id:h.id})}</div>`):this.empty("plug",this.only?"אין מפסק דולק "+this.scopeWord():"אין מפסקים "+this.scopeWord(),'בחרו "כל הבית" או "הכל" כדי לראות עוד.')}</div>${this.pager("loads",g.pages)}`}let d=t.flatMap(c=>c.lights);this.only&&(d=d.filter(c=>c.on));const f=k(d,this.phone?3:8,this.pg("lights"));return n`${this.headT(O(s),this.scopeWord(),r,n`<button class="hbtn strong" data-act="scopeOff" ?disabled=${!s}>${l("power")}<span class="bt">כבה הכל</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg("only",this.only,"דולקים")}</div>
      <div class="card-grid">${f.items.length?f.items.map(c=>n`<div class="tile lcard lrow${c.sw?" sw":""}${c.on?" is-on":""}" data-ft="light" data-fid=${c.id}>${this.lampBtn(c)}<span class="ln"><b class="clamp1">${c.name}</b>${c.sw||e||!c.ok?n`<span class="muted clamp1">${[c.ok?"":"לא זמין כרגע",c.sw?"מפסק, בלי עמעום":"",e?this.roomById(c.room)?.name??"":""].filter(Boolean).join(" · ")}</span>`:m}</span>${c.sw?this.swCtl(c):this.dimmer(c)}${this.star({t:"light",id:c.id})}</div>`):this.empty("bulb",this.only?"אין אור דולק "+this.scopeWord():"אין אורות "+this.scopeWord(),this.only?'בחרו "הכל" כדי לראות את כל האורות.':"כשיחוברו אורות הם יופיעו כאן.")}</div>${this.pager("lights",f.pages)}`}lightScenes(){const t=this.ctx(),s=t?this.d.scenes.filter(e=>e.rooms.includes(t.id)):[];return[...s,...N(this.world()).filter(e=>!s.includes(e))]}activeScene(){if(this.lastScene&&this.d.scenes.some(e=>e.id===this.lastScene))return this.lastScene;const t=new Date().toDateString();return this.d.scenes.filter(e=>e.lastRun&&new Date(e.lastRun).toDateString()===t).sort((e,a)=>Date.parse(a.lastRun??"")-Date.parse(e.lastRun??""))[0]?.id??null}sceneCard(t,s){return n`<div class="tile lcard sc${s?" big":""}" data-ft="scene" data-fid=${t.id}><button class="lamp go${this.sceneRun===t.id?" run":""}" data-act="scene" data-scene=${t.id} aria-pressed=${String(this.activeScene()===t.id)} aria-label=${"הפעל: "+t.name}>${l(t.icon)}</button><span class="ln"><b class="clamp1">${t.name}</b><span class="muted clamp1">${t.does||(t.rooms.length===1?"רק ב"+(this.roomById(t.rooms[0])?.name??"חדר אחד"):"סצנה של הבית")}</span></span>${this.star({t:"scene",id:t.id})}</div>`}dial(t){const s=t.min,e=t.max,a=135,i=270,o=118,r=150,d=150,f=p=>{const w=(a+i*Math.max(0,Math.min(1,(p-s)/(e-s||1))))*Math.PI/180;return[r+o*Math.cos(w),d+o*Math.sin(w)]},c=(p,w)=>{const[F,z]=f(p),[B,ct]=f(w),dt=i*(w-p)/(e-s||1)>180?1:0;return`M${F.toFixed(1)} ${z.toFixed(1)}A${o} ${o} 0 ${dt} 1 ${B.toFixed(1)} ${ct.toFixed(1)}`},u=t.mode==="off",[g,h]=f(t.temp??s);return n`<svg class="dial" viewBox="0 0 300 300" data-mode=${t.mode} role="img" aria-label=${`${u?"המיזוג כבוי":"מכוון ל-"+t.target+" מעלות"}, עכשיו ${t.temp??"לא ידוע"} מעלות`}><path class="trk" d=${c(s,e)}></path>${u||t.target==null?m:Y`<path class="val" d=${c(s,Math.max(s+.01,t.target))}></path>`}${t.temp!=null?Y`<circle class="now" cx=${g.toFixed(1)} cy=${h.toFixed(1)} r="7"></circle>`:m}</svg>`}sClimate(){const t=this.scopeRooms(),s=this.zonesOf(t),e=this.mainZone(t);if(!e)return n`${this.head("אקלים",this.scopeWord(),this.scopeSeg())}${this.empty("thermo","אין מיזוג "+this.scopeWord(),this.ctx()?'בחרו "כל הבית" כדי לראות את שאר המזגנים.':"כשיחובר מזגן או תרמוסטט, אפשר יהיה לכוון אותו מכאן.")}`;const a=k(s,4,this.pg("zones")),i=e.mode==="off",o=e.ok?i?"המיזוג כבוי":e.temp==null||e.target==null?j[e.mode]??"":e.temp>e.target?"מקרר עכשיו":e.temp<e.target?"מחמם עכשיו":"נעים בדיוק":"לא זמין כרגע",r=c=>Wt.map(([u,g])=>n`<button class=${c} data-act="preset" data-zone=${e.id} data-v=${g} aria-pressed=${String(!i&&e.target===g)} ?disabled=${!e.can||g<e.min||g>e.max}><span>${u}</span>${c==="chip2"?n`<span class="num">${g}°</span>`:n`<b class="num">${g}°</b>`}</button>`),d=s.length>1&&!this.phone?n`<section class="zone-list" aria-label="אזורים">${a.items.map(c=>n`<button class="tile zrow" data-act="zone" data-v=${c.id} aria-pressed=${String(c.id===e.id)}><span class="zn clamp2">${c.name}</span><span class="zt"><b class="num">${c.mode==="off"?"כבוי":(c.target??"—")+"°"}</b><span class="muted">עכשיו <span class="num">${c.temp??"—"}°</span></span></span></button>`)}${this.pager("zones",a.pages)}</section>`:this.phone?m:n`<section class="tile pane clim-side"><h2>מצבים מוכנים</h2>${r("hbtn wideb")}</section>`,f=Object.entries(j).filter(([c])=>c==="off"||e.modes.includes(c)).filter(([c],u,g)=>g.findIndex(([h])=>j[h]===j[c])===u);return n`${this.head("אקלים",`${e.name} · ${o}`,n`${this.scopeSeg()}${this.phone&&s.length>1?n`<button class="hbtn" data-act="zones"><span class="clamp1">${e.name}</span>${l("down")}</button>`:m}`)}
      <div class="clim-body"><section class="tile thermo" aria-label=${e.name}>
        <div class="dial-wrap">${this.dial(e)}<div class="dial-c"><b class="huge num">${i||e.target==null?"—":e.target+"°"}</b><span class="muted">עכשיו <span class="num">${e.temp??"—"}°</span></span></div>
          <div class="dial-pm"><button class="rb xl" data-act="temp" data-zone=${e.id} data-d="-1" ?disabled=${!e.can} aria-label="קר יותר">${l("down")}</button><button class="rb xl" data-act="temp" data-zone=${e.id} data-d="1" ?disabled=${!e.can} aria-label="חם יותר">${l("up")}</button></div></div>
        ${s.length>1||this.phone?n`<div class="presets">${r("chip2")}</div>`:m}
        ${this.seg("modeSeg",f,e.mode==="heat_cool"?"auto":e.mode,"מצב")}</section>${d}</div>`}sShades(){const t=this.scopeRooms();let s=t.flatMap(i=>i.shades);const e=s.filter(i=>(i.pos??0)>0).length;this.shadesOnly&&(s=s.filter(i=>(i.pos??0)>0));const a=k(s,this.phone?4:8,this.pg("shades"));return n`${this.head(e===0?"כל התריסים סגורים":e===1?"תריס אחד פתוח":`${e} תריסים פתוחים`,this.scopeWord(),n`<button class="hbtn" data-act="shadesAll" data-v="open">${l("up")}<span class="bt">פתח הכל</span></button><button class="hbtn" data-act="shadesAll" data-v="close">${l("down")}<span class="bt">סגור הכל</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg("shadesOnly",this.shadesOnly,"פתוחים")}</div><div class="card-grid">${a.items.length?a.items.map(i=>n`<div class="tile lcard sh" data-ft="shade" data-fid=${i.id}><span class="ln"><b class="clamp1">${i.name}</b><span class="muted clamp1">${this.armed?.startsWith(i.id+":")?"לחצו שוב לאישור":J(i.pos,i.moving,i.state)}${t.length>1?" · "+(this.roomById(i.room)?.name??""):""}</span></span>${this.trio(i)}${this.star({t:"shade",id:i.id})}</div>`):this.empty("shade",this.shadesOnly?"אין תריס פתוח "+this.scopeWord():"אין תריסים "+this.scopeWord(),'בחרו "כל הבית" או "הכל" כדי לראות עוד.')}</div>${this.pager("shades",a.pages)}`}sDoors(){const t=this.allDoors(),s=this.doorsOnly?t.filter(o=>!o.locked):t,e=k(s,this.phone?3:4,this.pg("doors")),a=k(this.visitors,this.phone?2:4,this.pg("visitors")),i=o=>{const r=o.door_opened_by_name?`${o.door_opened_by_name} פתח/ה`:o.outcome==="answered"?o.answered_by_name?`${o.answered_by_name} ענה/תה`:"נענה":o.outcome==="missed"?"לא נענה":o.outcome==="rejected"?"נדחה":"הסתיים",d=o.door_opened_at||o.outcome==="answered"?"ok":o.outcome==="missed"?"warn":"neutral";return n`<div class="vrow"><span class="vp vp-ic">${l("bell")}</span><span class="vn"><b class="clamp1">צלצול</b><span class="muted clamp1">${o.station_name}</span></span><span class="vr"><span class="num">${qt(o.rang_at)}</span><span class="vres" data-tone=${d}>${r}</span></span></div>`};return n`${this.head(this.phone?"דלתות":"דלתות ואינטרקום",Z(t),n`${this.onlySeg("doorsOnly",this.doorsOnly,"לא נעולות")}${this.talkTo?n`<button class="hbtn" data-act="talk">${l("phone")}<span class="bt">דבר עם הכניסה</span></button>`:m}`)}
      <div class="doors-body"><section class="door-list" aria-label="דלתות">${e.items.length?e.items.map(o=>n`<div class="tile drow" data-ft="door" data-fid=${o.id}>${this.doorBody(o,!0)}</div>`):this.empty("door",this.doorsOnly&&t.length?"כל הדלתות נעולות":"אין דלתות מחוברות",this.doorsOnly&&t.length?"אין מה לנעול כרגע.":"כשתחובר דלת או אינטרקום, אפשר יהיה לפתוח ולראות מי הגיע.")}${this.pager("doors",e.pages)}</section>
      <section class="tile pane visitors" aria-label="מי הגיע"><div class="bar"><h2>מי הגיע</h2>${this.pager("visitors",a.pages)}</div>${a.items.length?a.items.map(i):n`<p class="muted">עוד לא הגיע אף אחד היום.</p>`}</section></div>`}sCameras(){const t=this.ctx(),s=t&&this.scope==="room"&&t.cams.length?this.d.cameras.filter(i=>t.cams.includes(i.id)):this.d.cameras,e=k(s,this.phone?4:6,this.pg("cams")),a=s.filter(i=>!i.ok).length;return n`${this.head("מצלמות",s.length?a===0?s.length===1?"המצלמה פועלת":"כל המצלמות פועלות":a===1?"מצלמה אחת לא זמינה כרגע":`${a} מצלמות לא זמינות כרגע`:"",n`${t&&t.cams.length?this.seg("scope",[["room","החדר הזה"],["house","כל הבית"]],this.scope==="room"?"room":"house","איפה"):m}${this.pager("cams",e.pages)}`)}
      ${s.length?n`<div class=${`cam-grid n${Math.min(e.items.length,6)}`}>${e.items.map(i=>n`<div class="tile cam-t${i.ok?"":" off"}"><button class="wg-btn pic" data-act="cam" data-cam=${i.id} aria-label=${i.name}>${this.camPic(i,!1)}</button>${this.star({t:"cam",id:i.id})}</div>`)}</div>`:this.empty("cam","אין מצלמות מחוברות","כשתחובר מצלמה, התמונה שלה תופיע כאן.")}`}sEnergy(){const t=this.d.energy;if(!t||!t.today.length)return n`${this.head("חשמל","")}${this.empty("bolt","עוד אין נתוני חשמל","אחרי יום שימוש ראשון נראה כאן כמה חשמל הבית צורך.")}`;const s=this.period==="day",e=s?t.usual.map((p,w)=>[String(w).padStart(2,"0")+":00",t.today[w]==null?null:t.today[w],p]):t.week,a=e.reduce((p,w)=>p+(w[1]??0),0),i=e.reduce((p,w)=>p+(w[1]==null?0:w[2]),0),o=i>0?Math.round((a-i)/i*100):0,r=Math.max(.1,...e.map(p=>Math.max(p[1]??0,p[2]))),d=r>12?5:r>4?2:r>2?1:.5,f=Math.ceil(r/d)*d,c=[];for(let p=0;p<=f+1e-9;p+=d)c.push(p);const u=t.byRoom,g=Math.max(...u.map(p=>p[1]),.1),h=new Intl.DateTimeFormat("he-IL",{weekday:"long",timeZone:"Asia/Jerusalem"}).format(this.now);return n`${this.head(n`${s?"היום":"השבוע"}: <span class="num">${a.toFixed(1)}</span> קוט״ש`,n`${i>0?o===0?"כמו ביום רגיל":n`<span class="num">${Math.abs(o)}%</span> ${o<0?"פחות":"יותר"} מ${s?h+" רגיל":"שבוע רגיל"}`:""}${this.price!=null?n` · בערך <span class="num" data-energy-cost>₪${(a*this.price).toFixed(2)}</span>`:m}`,this.seg("period",[["day","היום"],["week","השבוע"]],this.period,"תקופה"))}
      <div class="en-body"><section class="tile pane chart" aria-label=${"צריכה לפי "+(s?"שעה":"יום")}><div class="bar"><h2>${s?"לפי שעה":"לפי יום"}</h2><div class="legend"><span><i class="k today"></i>${s?"היום":"השבוע"}</span><span><i class="k usual"></i>${s?"יום רגיל":"שבוע רגיל"}</span></div></div>
        <div class="plot" style=${`--n:${e.length}`} @pointerover=${this.tipOver} @pointerleave=${this.tipOff} @focusin=${this.tipOver} @focusout=${this.tipOff}><div class="yax">${c.map(p=>n`<span style=${`bottom:${p/f*100}%`}><em class="num">${p}</em></span>`)}</div>
          <div class="cols">${e.map(p=>n`<div class=${"col"+(p[1]==null?" future":"")} tabindex="0" data-tip=${`${p[0]}|${p[1]==null?"":p[1].toFixed(1)}|${p[2].toFixed(1)}`}>${p[1]==null?m:n`<i class="b" style=${`height:${Math.max(1.5,p[1]/f*100)}%`}></i>`}<i class="u" style=${`bottom:${p[2]/f*100}%`}></i></div>`)}</div>
          <div class="xax">${e.map((p,w)=>n`<span>${s?w%3===0?n`<em class="num">${p[0].slice(0,2)}</em>`:m:p[0]}</span>`)}</div><div class="tip" hidden></div></div><p class="unit muted">קוט״ש ל${s?"שעה":"יום"}</p></section>
      <section class="tile pane byroom" aria-label="מה צורך הכי הרבה"><h2>איפה צורכים הכי הרבה</h2>${u.slice(0,5).map(p=>n`<div class="hb"><span class="hl clamp1">${p[0]}</span><span class="ht"><i style=${`transform:scaleX(${p[1]/g})`}></i></span><span class="hv num">${p[1].toFixed(1)}</span></div>`)}<p class="unit muted">קוט״ש היום</p></section></div>`}sAlerts(){const t=this.d.alerts.filter(i=>i.open),s=this.alertTab==="open"?t:this.d.alerts,e=k(s,4,this.pg("alerts")),a=t.length;return n`${this.head("התראות",a===0?"אין שום דבר שדורש טיפול":a===1?"דבר אחד מחכה לך":`${a} דברים מחכים לך`,this.seg("alertTab",[["open","מחכות לי"],["all","הכל"]],this.alertTab,"סינון"))}
      <div class="alert-list">${e.items.length?e.items.map(i=>n`<div class="tile arow${i.open?"":" done"}" data-tone=${i.tone}><span class="ai">${l(i.icon)}</span><span class="at"><b class="clamp2">${i.text}</b><span class="muted">${i.when}</span></span>${i.open&&i.canAck?n`<button class="hbtn" data-act="alertAck" data-id=${i.id}><span class="clamp1">הבנתי</span></button>`:i.open?m:n`<span class="muted done-t">${l("check")}טופל</span>`}</div>`):this.empty("check","הכל בסדר בבית","כשמשהו ידרוש את תשומת הלב שלך, הוא יופיע כאן.")}</div>${this.pager("alerts",e.pages)}`}sScenes(){const t=this.ctx(),s=t?[...N(this.world()),...this.d.scenes.filter(i=>i.rooms.length===1&&i.rooms[0]===t.id)]:this.d.scenes,e=k(s,this.phone?4:8,this.pg("scenes")),a=this.d.scenes.some(i=>i.canEdit);return n`${this.head("סצנות",t?`של הבית ושל ${t.name}. נגיעה מפעילה.`:"נגיעה אחת מפעילה כמה דברים יחד.",a?n`<a class="hbtn" href=${this.href("settings/scenes")}>${l("edit")}<span class="bt">עריכת סצנות</span></a>`:m)}
      <div class="card-grid">${e.items.length?e.items.map(i=>this.sceneCard(i,!0)):this.empty("scenes","עוד אין סצנות","מנהל הבית יכול להגדיר סצנות שמפעילות כמה דברים יחד.")}</div>${this.pager("scenes",e.pages)}`}sActive(){const t=D(this.visRooms()),s=rt(this.visRooms()),e=[...t.map(o=>({r:o})),...s.length?[{kept:s}]:[]],a=k(e,this.phone?4:5,this.pg("active")),i=M(this.visRooms());return n`${this.head("פעיל עכשיו בבית",t.length===0?"כל האורות והמיזוג כבויים":`${O(i)} · ${t.length===1?"חדר אחד פעיל":t.length+" חדרים פעילים"}`,n`<button class="hbtn strong" data-act="houseOff" ?disabled=${!t.length}>${l("power")}<span class="bt">כיבוי כל הבית</span></button>`)}
      <div class="alert-list act">${a.items.length?a.items.map(o=>"kept"in o?n`<div class="tile arow kept"><span class="ai">${l("plug")}</span><span class="at"><b class="clamp1">${o.kept.length===1?"מפסק אחד שאינו אור דולק":o.kept.length+" מפסקים שאינם אור דולקים"}</b><span class="muted clamp1">${o.kept.slice(0,3).map(r=>r.name).join(", ")}${o.kept.length>3?" ועוד":""} · לא נכבים ב"כיבוי כל הבית"</span></span><a class="hbtn" href=${this.href("lights")} data-act="goLoads">${l("fwd")}<span class="bt">למפסקים</span></a></div>`:n`<div class="tile arow"><span class="ai" data-on="1">${l("pulse")}</span><a class="at" href=${this.href("r/"+o.r.id)}><b class="clamp1">${o.r.name}</b><span class="muted">${G(o.r)} · ${q(this.d.floors,o.r.floor)}</span></a><button class="hbtn" data-act="roomOffId" data-room=${o.r.id}>${l("power")}<span class="bt">כבה</span></button></div>`):this.empty("night","הכל כבוי בבית","כשיידלק אור או מזגן, החדר יופיע כאן.")}</div>${this.pager("active",a.pages)}`}sSecurity(){const t=this.panels;return n`${this.head("אבטחה",t.length?t.every(s=>s.state==="disarmed")?"המערכת לא דרוכה":"המערכת דרוכה":"")}
      <div class="alert-list">${t.length?t.slice(0,4).map(s=>{const e=["arm_home","arm_away","arm_night"].filter(i=>s.arm_modes.includes(i)),a=!!s.state&&s.state!=="disarmed";return n`<div class="tile arow" data-tone=${s.state==="triggered"?"warn":a?"ok":"info"}><span class="ai">${l("shield")}</span><span class="at"><b class="clamp1">${s.name}</b><span class="muted clamp1">${s.available?fs[s.state??""]??"":"לא זמינה כרגע"}${s.ready.open.length?" · פתוחים: "+s.ready.open.slice(0,2).join(", "):""}</span></span>
          <span class="acts">${a?n`<button class="hbtn strong" data-act="alarm" data-panel=${s.entity_id} data-v="disarm" ?disabled=${!s.can.disarm||!s.available}>${R.disarm}</button>`:e.map(i=>n`<button class="hbtn" data-act="alarm" data-panel=${s.entity_id} data-v=${i} ?disabled=${!s.can.arm||!s.available}>${R[i]}</button>`)}</span></div>`}):this.empty("shield","אין מערכת אזעקה מחוברת","כשתחובר מערכת אזעקה, אפשר יהיה לדרוך ולנטרל אותה מכאן.")}</div>`}faceChoice(t){const s=!!this.pol()?.may_switch;return n`<div class="face-choice" role="radiogroup" aria-label="הממשק שלי">
      <button role="radio" aria-checked=${String(t==="home")} data-act="face" data-v="home" ?disabled=${!s}><span class="fc-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>ממשק ביתי</b><span>פשוט וגדול, לכל המשפחה</span></span>${l("check","tick")}</button>
      <button role="radio" aria-checked=${String(t==="full")} data-act="face" data-v="full" ?disabled=${!s}><span class="fc-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>ממשק מלא</b><span>כל היכולות, למי שמנהל את הבית</span></span>${l("check","tick")}</button>
    </div>${s?m:n`<p class="lock-note">${l("lock")}הממשק נקבע על ידי מנהל הבית.</p>`}`}sSettings(t){const s=["favs","rooms","scenes","themes","view"].includes(t)?t:"favs",e=this.ctx(),a=this.world();let i=m;if(s==="favs"){const o=this.favs(this.room).filter(d=>T(d,a)),r=k(o.map((d,f)=>[d,f]),this.phone?5:8,this.pg("setFavs"));i=n`<p class="hint">המועדפים של ${e?e.name:"הבית שלי"}. מוסיפים בכוכב שליד כל אור, תריס, דלת, מצלמה או סצנה. אפשר לסדר גם במסך החדר עצמו, בכפתור "עריכה".</p><div class="set-list two">${r.items.length?r.items.map(([d,f])=>n`<div class="tile setrow"><span class="sname clamp1">${this.favLabel(d)}</span><span class="mv"><button class="rb" data-act="wgMove" data-ix=${f} data-d="-1" ?disabled=${f===0} aria-label="הזז למעלה">${l("up")}</button><button class="rb" data-act="wgMove" data-ix=${f} data-d="1" ?disabled=${f>=o.length-1} aria-label="הזז למטה">${l("down")}</button><button class="rb" data-act="wgDel" data-ix=${f} aria-label="הסר">${l("x")}</button></span></div>`):this.empty("star","עוד אין כאן מועדפים","לחצו על הכוכב שליד אור, תריס או מצלמה.")}</div>${this.pager("setFavs",r.pages)}`}else if(s==="rooms"){const o=this.d.floors,r=o.some(c=>c.id===this.floor)?this.floor:o[0]?.id??"",d=new Set(this.prefs.layout.hidden_rooms??[]),f=k(this.d.rooms.filter(c=>c.floor===r),this.phone?5:8,this.pg("setRooms"));i=n`<div class="bar wrap"><p class="hint">לב: חדר מועדף, עוברים אליו בהחלקה. מתג: האם החדר מופיע בכלל.</p>${this.seg("floor",o.map(c=>[c.id,c.short]),r,"קומה")}</div><div class="set-list two">${f.items.map(c=>n`<div class="tile setrow"><span class="sname clamp1">${c.name}</span><button class="lamp heart" data-act="favRoom" data-id=${c.id} aria-pressed=${String(this.favRooms().includes(c.id))} aria-label="חדר מועדף">${l("heart")}</button>${this.sw(!d.has(c.id),"roomVis","הצג את "+c.name,c.id)}</div>`)}</div>${this.pager("setRooms",f.pages)}`}else if(s==="scenes"){const o=k(this.d.scenes,this.phone?5:8,this.pg("setScenes"));i=n`<p class="hint">סצנה מפעילה כמה דברים בנגיעה אחת. ${this.d.scenes.some(r=>r.canEdit)?"את תוכן הסצנה עורכים בממשק המלא.":"רק מנהל הבית יכול לערוך סצנות."}</p><div class="set-list two">${o.items.map(r=>n`<div class="tile setrow">${l(r.icon)}<span class="sname"><b>${r.name}</b><span class="muted clamp1">${r.does}</span></span>${r.canEdit&&!this.pol()?.home_only?n`<a class="hbtn" href="#/devices/automations/scenes">${l("edit")}<span class="bt">עריכה</span></a>`:m}</div>`)}</div>${this.pager("setScenes",o.pages)}`}else if(s==="themes"){const o=this.getAttribute("data-hs-theme")??"classic",r=this.getAttribute("data-hs-scheme")??"dark",d=this.phone?k(L,4,this.pg("themes")):{items:L,pages:1};i=n`<div class="bar wrap"><p class="hint">הצבעים של הממשק הביתי שלי. צבעי המצב (תקין, שים לב, אזעקה) נשארים זהים בכל ערכה.</p>${this.seg("theme",[["dark","כהה"],["light","בהיר"]],r,"מראה")}</div>
        <div class="theme-grid" role="radiogroup" aria-label="ערכת נושא">${d.items.map(([f,c,u,g])=>n`<button class="tile thm" role="radio" aria-checked=${String(f===o)} data-act="hs" data-v=${f}><span class="thm-pv" data-hs-theme=${f} data-hs-scheme=${g===1?"dark":r} aria-hidden="true"><i class="pv-a"></i><i class="pv-b"></i><i class="pv-c"></i><i class="pv-d"></i></span><span class="thm-t"><b>${c}</b><span class="muted clamp2">${u}</span></span>${l("check","tick")}</button>`)}</div>${this.pager("themes",d.pages)}`}else{const o=this.prefs.layout,r=L.find(d=>d[0]===(this.getAttribute("data-hs-theme")??"classic"))?.[1]??"";i=n`<div class="set-view"><section class="tile pane"><h2>הממשק שלי</h2>${this.faceChoice("home")}</section>
        <section class="tile pane"><h2>תצוגה</h2><div class="setrow flat"><span class="sname">מה נפתח ראשון</span>${this.seg("start",[["home","הבית שלי"],["last","החדר האחרון"],["fixed","חדר קבוע"]],o.start??"home","מסך פתיחה")}</div><div class="setrow flat"><span class="sname"><b>ערכת נושא</b><span class="muted">${r}, ${this.getAttribute("data-hs-scheme")==="light"?"בהיר":"כהה"}</span></span><a class="hbtn" href=${this.href("settings/themes")}>${l("palette")}<span class="bt">החלפה</span></a></div><div class="setrow flat"><span class="sname"><b>כתב גדול</b><span class="muted">מגדיל גם את האריחים</span></span>${this.sw(!!o.big_text,"bigText","כתב גדול")}</div></section></div>`}return n`${this.headT("הגדרות","המועדפים, החדרים והתצוגה שלי",this.seg("setTab",[["favs","מועדפים"],["rooms","חדרים"],["scenes","סצנות"],["themes",this.phone?"צבעים":"ערכות נושא"],["view","תצוגה"]],s,"נושא"))}${i}`}sWelcome(){return n`<div class="welcome"><span class="mark big" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 24 16 7l10 17"></path><path d="M11 24h10"></path></svg></span><h1>שלום ${this.userName}, איך נוח לך לראות את הבית?</h1><p class="sub">אפשר להחליף בכל רגע מהתפריט האישי.</p>
      <div class="wl-choice" role="radiogroup" aria-label="בחירת ממשק">
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick==="home")} data-act="welcomePick" data-v="home"><span class="wl-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><b>ממשק ביתי</b><span>חדר אחרי חדר: מה שיש בחדר, המועדפים שלך, וכיבוי בנגיעה. בלי מונחים טכניים. מתאים לכל המשפחה ולמסך על הקיר.</span>${l("check","tick")}</button>
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick==="full")} data-act="welcomePick" data-v="full"><span class="wl-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>ממשק מלא</b><span>כל המסכים והיכולות: מפות, הקלטות, תזמונים, הרשאות והגדרות. מתאים למי שמנהל את הבית.</span>${l("check","tick")}</button>
      </div><button class="hbtn strong wide" data-act="welcomeGo">המשך</button></div>`}ovlHtml(){const t=this.ovl;if(!t)return m;if(t.type==="cam"){const s=this.d.cameras.find(e=>e.id===t.id)??this.d.cameras[0];return s?n`<div class="hscrim solid"></div><section class="camfull" role="dialog" aria-modal="true" aria-label=${s.name}><div class="cf-pic">${s.ok?n`<sw-camera-tile class="scene-pic" dark noDemo cameraId=${s.id} state="live" live profile="main" autoProfile poster=${K(s.id)}></sw-camera-tile>`:n`<div class="cam-off big">${l("camoff")}<span>המצלמה לא זמינה כרגע</span><small>אנחנו מנסים להתחבר שוב. אין צורך לעשות דבר.</small></div>`}</div>
        <header class="cf-bar"><button class="rb onpic" data-act="close" aria-label="סגור">${l("x")}</button><div class="cf-t"><b class="clamp1">${s.name}</b>${s.ok?n`<span class="live onpic"><i class="dot"></i>חי</span>`:m}</div><span class="cf-nav"><button class="rb onpic" data-act="camStep" data-d="-1" aria-label="המצלמה הקודמת">${l("back")}</button><button class="rb onpic" data-act="camStep" data-d="1" aria-label="המצלמה הבאה">${l("fwd")}</button></span></header></section>`:m}if(t.type==="confirm"){const s=this.findIn(e=>e.doors,t.door);return s?n`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="אישור פתיחה"><span class="dlg-ic">${l("unlock")}</span><h2>לפתוח את ${s.name}?</h2><p class="muted">${s.kind==="gate"?"השער ייסגר שוב מעצמו.":"הדלת תינעל שוב מעצמה אחרי כמה שניות."}</p><div class="dlg-acts"><button class="hbtn strong" data-act="doorOpen" data-door=${s.id}>כן, פתח</button><button class="hbtn" data-act="close">ביטול</button></div></section>`:m}if(t.type==="ask")return n`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label=${t.title}><span class="dlg-ic">${l("check")}</span><h2 class="clamp2">${t.title}</h2><p class="muted">${t.text}</p><div class="dlg-acts"><button class="hbtn strong" data-act="askYes">${t.yes}</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;if(t.type==="guard"){const s=this.findIn(e=>e.loads,t.id);return s?n`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="אישור כיבוי"><span class="dlg-ic">${l(this.loadIcon(s))}</span><h2 class="clamp2">לכבות את ${s.name}?</h2><p class="muted">המפסק הזה מסומן כמוגן, כדי שלא יכבה בטעות.</p><div class="dlg-acts"><button class="hbtn strong" data-act="guardOff">כן, כבה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`:m}if(t.type==="menu"){const s=this.getAttribute("data-hs-scheme");return n`<div class="hscrim clear" data-act="close"></div><section class="sheet umenu" role="dialog" aria-modal="true" aria-label="התפריט האישי"><header class="menu-h"><span class="av lg">${(this.userName||"?").slice(0,1)}</span><span class="mh-t"><b class="clamp1">${this.userFull||this.userName}</b><span class="muted">${this.role}</span></span><button class="rb" data-act="close" aria-label="סגור">${l("x")}</button></header>
        <h3>הממשק שלי</h3>${this.faceChoice("home")}
        <div class="menu-rows"><a class="mrow" href=${this.href("settings/favs")} data-act="closeNav">${l("sliders")}<span>ההגדרות שלי</span>${l("fwd")}</a><button class="mrow" data-act="theme" data-v=${s==="dark"?"light":"dark"}>${l(s==="dark"?"sun":"night")}<span>${s==="dark"?"מראה בהיר":"מראה כהה"}</span></button>${Pt?n`<button class="mrow" data-act="switchUser" data-home-switch-user>${l("user")}<span>החלף משתמש</span>${l("fwd")}</button>`:m}</div></section>`}if(t.type==="zones"){const s=this.zonesOf(this.scopeRooms()).slice(0,6),e=this.mainZone(this.scopeRooms());return n`<div class="hscrim" data-act="close"></div><section class="sheet bottom" role="dialog" aria-modal="true" aria-label="בחירת אזור"><span class="grab" aria-hidden="true"></span><h2>איזה חדר?</h2><div class="pick-list">${s.map(a=>n`<button class="mrow" data-act="zone" data-v=${a.id} aria-pressed=${String(a.id===e?.id)}><span class="clamp1">${a.name}</span><b class="num">${a.mode==="off"?"כבוי":(a.target??"—")+"°"}</b></button>`)}</div></section>`}if(t.type==="hold"){const s=this.favs(this.room).some(a=>A(a,t.f)),e=this.ctx();return n`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="dialog" aria-modal="true" aria-label="מועדפים"><span class="dlg-ic">${l("star")}</span><h2 class="clamp2">${t.label}</h2><p class="muted">מועדף מופיע במסך החדר, בנגיעה אחת.</p><div class="pick-list wide"><button class="mrow" data-act="holdFav" data-k=${this.room}>${l("star")}<span>${s?"הסר מהמועדפים של ":"הוסף למועדפים של "}${e?e.name:"הבית שלי"}</span></button>${e?n`<button class="mrow" data-act="holdFav" data-k="home">${l("home")}<span>הוסף ל"הבית שלי"</span></button>`:m}<button class="mrow" data-act="close">${l("x")}<span>ביטול</span></button></div></section>`}if(t.type==="talk"){const s=this.talkTo;return s?n`<div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label=${"דבר עם "+s.name}><div class="call-video">${s.video?n`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${s.video} profile="sub"></sw-camera-tile>`:n`<div class="cam-off big">${l("camoff")}<span>אין תמונה מהכניסה הזו</span></div>`}</div>
        <div class="call-side"><p class="ring-line">${l("phone")}שיחה יוצאת</p><h1>מדברים עם ${s.name}</h1><p class="sub">נגיעה פותחת את המיקרופון. השיחה נסגרת בנגיעה נוספת.</p><div class="call-acts"><wk-talk-button dial idleLabel="דבר עם הכניסה" .stationId=${s.id} .talk=${s.talk}></wk-talk-button><button class="hbtn xl" data-act="close">סגור</button></div></div></section>`:m}if(t.type==="code"){const s=["1","2","3","4","5","6","7","8","9","del","0","go"];return n`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label=${t.title}><span class="dlg-ic">${l("shield")}</span><h2 class="clamp2">${t.title}</h2><p class="muted">${t.error||"הקלידו את הקוד."}</p><p class="kp-dots num" aria-live="polite">${t.code.replace(/./g,"•")||" "}</p><div class="kp-grid">${s.map(e=>e==="go"?n`<button class="hbtn strong" data-act="codeGo" ?disabled=${!t.code}>אישור</button>`:e==="del"?n`<button class="hbtn" data-act="codeKey" data-k="del" aria-label="מחק">${l("back")}</button>`:n`<button class="hbtn num" data-act="codeKey" data-k=${e}>${e}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">ביטול</button></div></section>`}if(t.type==="kiosk"){const s=["1","2","3","4","5","6","7","8","9","del","0","go"];return n`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label="יציאה ממסך הקיר"><span class="dlg-ic">${l("lock")}</span><h2>קוד מנהל</h2><p class="muted">${t.error||"הקוד פותח את מסך הקיר לחמש דקות."}</p><p class="kp-dots num" aria-live="polite">${t.code.replace(/./g,"•")||" "}</p><div class="kp-grid">${s.map(e=>e==="go"?n`<button class="hbtn strong" data-act="kioskGo" ?disabled=${t.code.length<4}>אישור</button>`:e==="del"?n`<button class="hbtn" data-act="kioskKey" data-k="del" aria-label="מחק">${l("back")}</button>`:n`<button class="hbtn num" data-act="kioskKey" data-k=${e}>${e}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">ביטול</button></div></section>`}return m}render(){if(!this.data)return n`<div class="hs v2 bare"><main class="hs-main">${this.error?this.empty("x","לא הצלחנו לטעון את הבית",this.error):n`<div class="empty loading" aria-busy="true">${l("home")}<h2>טוענים את הבית…</h2></div>`}</main></div>`;const t=this.route(),s=this.pol();if(t.name==="welcome")return n`<div class="app-root" @click=${this.onClick}><div class="hs bare"><main class="hs-main enter">${this.sWelcome()}</main></div>${this.toasts()}</div>`;let e=t.name;this.kioskLocked()&&e==="rooms"&&(e="r"),e==="settings"&&s?.kiosk&&this.kioskLocked()&&(e="r");const a=e==="r"?this.room==="home"?"home":"":e,i=e==="r"?this.sRoom():e==="rooms"?this.sRooms():e==="lights"?this.sLights():e==="climate"?this.sClimate():e==="shades"?this.sShades():e==="doors"?this.sDoors():e==="cameras"?this.sCameras():e==="energy"?this.sEnergy():e==="alerts"?this.sAlerts():e==="scenes"?this.sScenes():e==="active"?this.sActive():e==="security"?this.sSecurity():this.sSettings(t.arg),o=this.path!==this.lastRoute;return this.lastRoute=this.path,n`<div class="app-root" @click=${this.onClick} @input=${this.onInput} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove} @pointerup=${this.onPointerUp} @pointercancel=${()=>{window.clearTimeout(this.holdT),this.swipe=null}} @keydown=${this.onKey}>
      <div class=${"hs v2"+(this.kioskLocked()?" kiosk":"")} data-screen=${e}>${this.strip(e)}${this.nav(a)}<main class=${"hs-main"+(o?" enter":"")} id="main">${i}</main>${this.nowBar()}</div>
      <div class="ovl">${this.ovlHtml()}</div>${this.toasts()}
      <sw-home-call data-hs-theme=${this.getAttribute("data-hs-theme")??"classic"} data-hs-scheme=${this.getAttribute("data-hs-scheme")??"dark"} ?data-hs-big=${this.hasAttribute("data-hs-big")} @home-calls=${r=>{this.calls=r.detail}}></sw-home-call></div>`}toasts(){const t=this.toastMsg;return n`<div class="toasts" aria-live="polite">${t?n`<div class="toast2"><span>${t.text}</span>${t.undo?n`<button data-act="undo">ביטול</button>`:m}</div>`:m}</div>`}};b.styles=[nt,ot];x([E()],b.prototype,"path",2);x([E()],b.prototype,"userName",2);x([E()],b.prototype,"userFull",2);x([E()],b.prototype,"role",2);x([E({attribute:!1})],b.prototype,"policy",2);x([v()],b.prototype,"data",2);x([v()],b.prototype,"error",2);x([v()],b.prototype,"prefs",2);x([v()],b.prototype,"room",2);x([v()],b.prototype,"scope",2);x([v()],b.prototype,"only",2);x([v()],b.prototype,"lightsTab",2);x([v()],b.prototype,"zone",2);x([v()],b.prototype,"period",2);x([v()],b.prototype,"alertTab",2);x([v()],b.prototype,"edit",2);x([v()],b.prototype,"roomsEdit",2);x([v()],b.prototype,"doorsOnly",2);x([v()],b.prototype,"shadesOnly",2);x([v()],b.prototype,"floor",2);x([v()],b.prototype,"page",2);x([v()],b.prototype,"ovl",2);x([v()],b.prototype,"toastMsg",2);x([v()],b.prototype,"armed",2);x([v()],b.prototype,"sceneRun",2);x([v()],b.prototype,"phone",2);x([v()],b.prototype,"now",2);x([v()],b.prototype,"visitors",2);x([v()],b.prototype,"kioskUntil",2);x([v()],b.prototype,"welcomePick",2);x([v()],b.prototype,"panels",2);x([v()],b.prototype,"calls",2);x([v()],b.prototype,"talkTo",2);x([v()],b.prototype,"lastScene",2);x([v()],b.prototype,"price",2);b=x([it("sw-home")],b);export{b as SwHome,L as THEMES};
//# sourceMappingURL=sw-home-BXftH9MI.js.map
