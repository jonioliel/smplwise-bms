import{T as ut,E as ge,U as Ct,e as r,V as Ut,W as qt,X as Ft,Y as M,Z as Bt,$ as se,a0 as Nt,a1 as Wt,a2 as Ht,a3 as Be,A as g,a4 as Vt,a5 as Zt,a6 as Xt,H as gt,j as U,g as L,l as S,a7 as Gt,a8 as Ie,a9 as Kt,aa as C,ab as Yt,ac as Jt,ad as me,ae as Qt,af as bt,ag as es,ah as Me,ai as ts,aj as ss,ak as as,al as is,am as ns,an as os,ao as rs,ap as ls,aq as be,ar as cs,a as ds,as as ps,at as hs,au as ms,av as fs,aw as us,ax as gs,ay as Ne,w as We,az as He,aA as Ve,F as ie,G as z}from"./index-B0gHNuRZ.js";import{r as je,P as bs,m as Ze,n as Se,p as xs,a as B,b as Q,c as vs,d as Xe,v as ws,B as ks,i as ae,w as ys,e as $s,S as Ge,G as Ke,E as Ye,T as xt,f as zs,g as _s,h as Ms,l as Ss,j as Ts,k as Ls,o as Ds,q as Os,s as Es,t as Je,u as xe,x as Qe,y as et,z as tt}from"./home-api-h5oZ44Ke.js";import"./wk-talk-button-D5KPORqJ.js";import{d as X,m as V,c as Rs,i as Is,s as js,a as Ps,r as As,p as Cs}from"./recordings-z0BPACAw.js";import"./sw-logo-art-Va6y_cIM.js";const vt=ge`${ut(String.raw`:host {
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
  --hs-offline-soft: var(--hs-surface-3);}`)}`,wt=ge`
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
  /* the v3 sheets keep the home interface's touch target (the mockup drew 54 px; the tablet rule is the full --hit) */
  @media (min-width: 701px) {
    .ovl .sheet.v3 .rb, .ovl .sheet.v3 .hbtn, .ovl .sheet.v3 .chip2, .ovl .sheet.v3 .seg button { min-block-size: 56px; }
    .ovl .sheet.v3 .rb { min-inline-size: 56px; }
  }
  @media (max-width: 700px) { .fld2 { grid-template-columns: minmax(0, 1fr); gap: 6px; } .pb-days .pbd { min-inline-size: 5ch; font-size: 14px; } }
`,kt={home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>',rooms:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',bulb:'<path d="M9.5 18h5"/><path d="M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',thermo:'<path d="M12 3.5a2 2 0 0 0-2 2v8.6a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2z"/><path d="M12 10.5v6.5"/>',door:'<path d="M6 21V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V21"/><path d="M3 21h18"/><path d="M14.5 12.5v.01"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',unlock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',cam:'<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/>',camoff:'<rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5 21 7.5v9l-5-3"/><path d="M4 4l16 16"/>',bolt:'<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',sliders:'<path d="M4 7h9"/><path d="M19 7h1"/><circle cx="16" cy="7" r="2.5"/><path d="M4 17h1"/><path d="M11 17h9"/><circle cx="8" cy="17" r="2.5"/>',morning:'<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 6v3"/><path d="m5 10.5 2 2"/><path d="m19 10.5-2 2"/>',leave:'<path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M15 12H4"/><path d="m8 8-4 4 4 4"/>',evening:'<path d="M8.5 4h7l2.5 7h-12z"/><path d="M12 11v9"/><path d="M8.5 20h7"/>',night:'<path d="M20 14.5A8 8 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5z"/>',arrive:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="m9 14.5 2 2 4-4"/>',back:'<path d="m9 6 6 6-6 6"/>',fwd:'<path d="m15 6-6 6 6 6"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',minus:'<path d="M5 12h14"/>',power:'<path d="M12 4v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>',shade:'<path d="M4 4h16"/><path d="M6 4v10h12V4"/><path d="M6 7.5h12"/><path d="M6 10.75h12"/><path d="M12 14v4.5"/>',stop:'<rect x="7" y="7" width="10" height="10" rx="2"/>',user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',phone:'<path d="M5 4h4l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2L20 15v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',drop:'<path d="M12 3.5c3 3.6 5.5 6.3 5.5 9.5a5.5 5.5 0 0 1-11 0c0-3.2 2.5-5.9 5.5-9.5z"/>',battery:'<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21.5 11v2"/><path d="M6.5 11v2"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="m5.6 5.6 1.4 1.4"/><path d="m17 17 1.4 1.4"/><path d="m18.4 5.6-1.4 1.4"/><path d="m7 17-1.4 1.4"/>',shield:'<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.5 7 9 4.1-1.5 7-4.8 7-9V6z"/>',swap:'<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',layers:'<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',map:'<path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13"/><path d="M15 6.5v13"/>',media:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/>',system:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m18.4 5.6-2.1 2.1"/><path d="m7.7 16.3-2.1 2.1"/>',plug:'<path d="M9 3v5"/><path d="M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V21"/>',mic:'<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',star:'<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z"/>',heart:'<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/>',pulse:'<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',scenes:'<path d="M12 3v3.5"/><path d="M12 17.5V21"/><path d="M3 12h3.5"/><path d="M17.5 12H21"/><path d="m12 8 1.3 2.7L16 12l-2.7 1.3L12 16l-1.3-2.7L8 12l2.7-1.3z"/>',size:'<path d="M4 9.5V4h5.5"/><path d="M20 14.5V20h-5.5"/><path d="m4 4 6.5 6.5"/><path d="m20 20-6.5-6.5"/>',hold:'<rect x="8" y="5" width="3" height="14" rx="1"/><rect x="13" y="5" width="3" height="14" rx="1"/>',switch:'<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="2.6"/>',fridge:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M6 10h12"/><path d="M9.5 6v1.5"/><path d="M9.5 13v2.5"/>',pump:'<circle cx="12" cy="12" r="6.5"/><path d="M12 5.5v13"/><path d="M5.5 12h13"/><path d="M3 12h2.5"/><path d="M18.5 12H21"/>',palette:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H17a3.5 3.5 0 0 0 3.5-3.5c0-4.7-3.8-8.5-8.5-8.5z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.2" cy="8.5" r="1"/>'};Object.assign(kt,{grid:'<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',board:'<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8.5h8"/><path d="M8 12.5h8"/><path d="M8 16.5h5"/>',wrench:'<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5 17 4"/>',music:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',horn:'<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a4 4 0 0 1 0 5"/><path d="M19.8 7a7.5 7.5 0 0 1 0 10"/>',bill:'<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6"/><path d="M9 12.5h6"/>',gen:'<rect x="3.5" y="7" width="17" height="11" rx="2.5"/><path d="M7 18v2.5"/><path d="M17 18v2.5"/><path d="m12.8 9.5-2.6 3.4h3.6l-2.6 3.4"/>',lift:'<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M12 3.5v17"/><path d="m8 10 1.5-2 1.5 2"/><path d="m13 14 1.5 2 1.5-2"/>',people:'<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16 14.6a4.5 4.5 0 0 1 4.8 4.4"/>',cloud:'<path d="M7 18.5a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 9.6a4.5 4.5 0 0 1 .5 8.9z"/>',rain:'<path d="M7 15.5a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 6.6a4.5 4.5 0 0 1 .5 8.9z"/><path d="M9 18.5 8 21"/><path d="M13 18.5 12 21"/><path d="M17 18.5 16 21"/>',play:'<path d="M8 5.5v13l10.5-6.5z"/>',pause:'<path d="M8.5 5.5v13"/><path d="M15.5 5.5v13"/>',next:'<path d="M6 6v12l9-6z"/><path d="M18 6v12"/>',prev:'<path d="M18 6v12l-9-6z"/><path d="M6 6v12"/>',rew:'<path d="M11 7 5 12l6 5z"/><path d="M19 7l-6 5 6 5z"/>',ffw:'<path d="m13 7 6 5-6 5z"/><path d="m5 7 6 5-6 5z"/>',clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5"/><path d="m16 7 2.5 2.5"/>',film:'<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M8 5v14"/><path d="M16 5v14"/><path d="M3.5 12h4.5"/><path d="M16 12h4.5"/>',vol:'<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6"/>',tv:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/>',spark:'<path d="M12 4v4"/><path d="M12 16v4"/><path d="M4 12h4"/><path d="M16 12h4"/><path d="m6.5 6.5 2.5 2.5"/><path d="m15 15 2.5 2.5"/>',photo:'<rect x="3.5" y="5.5" width="17" height="13.5" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="m5 17 5-4.5 3.5 3 2.5-2 3.5 3.5"/>',guest:'<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 11.5-4"/><path d="M18 14v6"/><path d="M15 17h6"/>',list:'<path d="M8 6.5h12"/><path d="M8 12h12"/><path d="M8 17.5h12"/><path d="M4 6.5h.01"/><path d="M4 12h.01"/><path d="M4 17.5h.01"/>',del:'<path d="M5 7h14"/><path d="M9.5 7V4.5h5V7"/><path d="M7 7l1 13h8l1-13"/>',ok2:'<circle cx="12" cy="12" r="8.5"/><path d="m8 12.5 3 3 5-6"/>',wind:'<path d="M3 9h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 14h14a2.5 2.5 0 1 1-2.5 2.5"/>'});function p(e,t=""){return r`<svg class=${"hi"+(t?" "+t:"")} viewBox="0 0 24 24" aria-hidden="true">${Ct(kt[e]??"")}</svg>`}const H=e=>e===0?"כל האורות כבויים":e===1?"אור אחד דולק":`${e} אורות דולקים`,A=e=>e.reduce((t,s)=>t+s.lights.filter(a=>a.on).length,0),re=e=>e?"דולק":"כבוי",le={cool:"קירור",heat:"חימום",auto:"אוטומטי",heat_cool:"אוטומטי",dry:"ייבוש",fan_only:"אוורור",off:"כבוי"},Us=[["נעים",23],["חיסכון",26],["לילה",22]],fe=e=>e.mode!=="off"&&e.ok,qs=e=>e.lights.some(t=>t.on)||e.zones.some(fe),pe=e=>e.filter(qs),yt=e=>e.flatMap(t=>t.loads.filter(s=>s.on));function Fs(e){const t=e.lights.filter(s=>s.on).length;return!e.lights.length&&!e.shades.length&&!e.zones.length&&!e.loads.length?"אין כאן התקנים":e.lights.length?t===0?"חשוך":t===1?"אור אחד דולק":`${t} אורות דולקים`:"אין אורות"}function st(e){const t=[],s=e.lights.filter(i=>i.on).length;s&&t.push(s===1?"אור אחד":`${s} אורות`);const a=e.zones.find(fe);return a&&t.push(a.target!=null?`מיזוג ${a.target}°`:"מיזוג"),t.join(" · ")||"הכל כבוי"}function Bs(e){const t=A(e),s=pe(e).length;return t||s?`${H(t)}${s?s===1?" · בחדר אחד":` · ב-${s} חדרים`:""}`:"הכל כבוי בבית"}function at(e){const t=e.filter(s=>!s.locked);return e.length?t.length?t.length===1?`${t[0].name} ${t[0].kind==="gate"?"פתוח":"פתוחה"}`:`${t.length} דלתות פתוחות`:"כל הדלתות נעולות":"אין דלתות מחוברות"}const Ns={door_not_mapped:"הדלת עדיין לא משויכת לעמדה",no_permission:"אין הרשאה לפתוח",no_control:"אין הרשאה לפתוח",not_placed:"אין הרשאה לפתוח את הדלת הזו",wall_profile:"מסך קיר לא פותח דלתות",alarm_managed:"נשלטת ממסך האזעקה"},Ws=e=>Ns[e]??"אי אפשר לפתוח מכאן כרגע",Hs=e=>e.kind==="gate"?e.locked?"סגור":"פתוח":e.locked?"נעולה":"פתוחה";function it(e,t=!1,s=null){return t?s==="closing"?"נסגר":"נפתח":e==null?s==="open"?"פתוח":s==="closed"?"סגור":"לא ידוע":e===0?"סגור":e===100?"פתוח":`פתוח ${e}%`}function Vs(e){const t=e.lights.filter(s=>s.on&&!s.sw);return t.length?Math.round(t.reduce((s,a)=>s+a.lvl,0)/t.length):0}function Zs(e){const t=yt(e);return t.length?t.length===1?` · ${t[0].name} נשאר דולק`:` · ${t.length} מפסקים שאינם אור נשארו דולקים`:""}function Xs(e,t=new Date){const s=t.getHours(),a=s<5?"לילה טוב":s<12?"בוקר טוב":s<17?"צהריים טובים":s<21?"ערב טוב":"לילה טוב";return e?`${a}, ${e}`:a}function _(e,t,s){const a=Math.max(1,Math.ceil(e.length/Math.max(1,t))),i=Math.max(0,Math.min(s,a-1));return{items:e.slice(i*t,i*t+t),pages:a,page:i}}const ce=(e,t)=>e.t===t.t&&(e.id??null)===(t.id??null),ve=(e,t=!1)=>e.t==="scene"||e.t==="energy"||e.t==="switch"?1:e.t==="light"?t?1:e.w??2:2,nt=e=>e.t==="cam"?2:1;function Gs(e,t,s,a){const i=[[]];let n=0;for(const o of e){const l=Math.min(t(o),s*a);n+l>s*a&&(i.push([]),n=0),i[i.length-1].push(o),n+=l}return i}const Ks=(e,t)=>e.scenes.filter(s=>s.rooms.length===1&&s.rooms[0]===t),Te=e=>e.scenes.filter(t=>t.rooms.length!==1);function Ys(e,t){const s=[],a=t.rooms.flatMap(o=>o.doors),i=t.rooms.flatMap(o=>o.zones);if(e==="home")return Te(t).slice(0,5).forEach(o=>s.push({t:"scene",id:o.id})),t.hasEnergy&&s.push({t:"energy"}),t.rooms.some(o=>o.lights.length)&&s.push({t:"allLights"}),t.cameras[0]&&s.push({t:"cam",id:t.cameras[0].id}),a[0]&&s.push({t:"door",id:a[0].id}),i[0]&&s.push({t:"climate",id:i[0].id}),a[1]&&s.push({t:"door",id:a[1].id}),s;const n=t.rooms.find(o=>o.id===e);return n&&(Ks(t,n.id).slice(0,2).forEach(o=>s.push({t:"scene",id:o.id})),n.lights.slice(0,2).forEach(o=>s.push({t:"light",id:o.id,w:2})),n.loads.slice(0,2).forEach(o=>s.push({t:"switch",id:o.id})),n.zones[0]&&s.push({t:"climate",id:n.zones[0].id}),n.cams[0]&&s.push({t:"cam",id:n.cams[0]}),n.shades[0]&&s.push({t:"shade",id:n.shades[0].id}),n.lights.slice(2,4).forEach(o=>s.push({t:"light",id:o.id,w:1})),n.doors[0]&&s.push({t:"door",id:n.doors[0].id})),s}function K(e,t){const s=a=>t.rooms.some(i=>a(i).some(n=>n.id===e.id));switch(e.t){case"light":return s(a=>a.lights);case"switch":return s(a=>a.loads);case"climate":return s(a=>a.zones);case"shade":return s(a=>a.shades);case"door":return s(a=>a.doors);case"cam":return t.cameras.some(a=>a.id===e.id);case"scene":return t.scenes.some(a=>a.id===e.id);case"energy":return t.hasEnergy;case"security":return t.hasSecurity;default:return t.rooms.some(a=>a.lights.length)}}function we(e,t){return e.find(s=>s.id===t)?.name??""}const $t=e=>e.split(".")[0];function j(e,t,s,a={},i=!1){return new Promise(n=>{Nt(e,$t(t),t,s,a,!0,o=>{o.phase!=="pending"&&n({ok:o.phase!=="rolled_back",note:o.note})},{confirmed:i})})}const P=(e,t)=>j(`home:${e.id}`,e.id,`${$t(e.id)}.turn_${t?"on":"off"}`),Js=Wt(280);function W(e,t,s){Js(`home:${e.id}`,"light",e.id,t<=0?"light.turn_off":"light.turn_on",t<=0?{}:{brightness_pct:Math.max(1,Math.min(100,Math.round(t)))},t,a=>{a.phase!=="pending"&&s({ok:a.phase!=="rolled_back",note:a.note})})}async function Qs(e,t){if(t)try{const n=await Ut(t.kind,t.id,"lights_off"),o=await qt(t.kind,t.id,"lights_off",n.digest),l=await Ft(o,()=>{});return{ok:l.counts.total===0||l.counts.confirmed+(l.counts.sent??0)>0,note:null}}catch(n){return{ok:!1,note:M(n)}}const s=e.flatMap(n=>n.lights.filter(o=>o.on&&o.can)),i=(await Promise.all(s.map(n=>P(n,!1)))).find(n=>!n.ok);return{ok:!i,note:i?.note??null}}async function ea(e){const s=(await Promise.all(e.filter(a=>a.mode!=="off"&&a.can).map(a=>j(`home:${a.id}`,a.id,"climate.turn_off")))).find(a=>!a.ok);return{ok:!s,note:s?.note??null}}async function ot(e,t){if(e.mode==="off"){const s=e.modes.includes("cool")?"cool":e.modes.find(i=>i!=="off")??"auto",a=await j(`home:${e.id}:mode`,e.id,"climate.set_hvac_mode",{hvac_mode:s});if(!a.ok)return a}return j(`home:${e.id}`,e.id,"climate.set_temperature",{temperature:Math.max(e.min,Math.min(e.max,t))})}const ta=(e,t)=>t==="off"?j(`home:${e.id}:mode`,e.id,"climate.turn_off"):j(`home:${e.id}:mode`,e.id,"climate.set_hvac_mode",{hvac_mode:t}),rt=(e,t)=>j(`home:${e.id}`,e.id,t==="open"?"cover.open_cover":t==="close"?"cover.close_cover":"cover.stop_cover",{},t!=="stop"),sa=e=>j(`home:${e.id}`,e.id,"lock.unlock",{},!0),aa=e=>j(`home:${e.id}`,e.id,"lock.lock",{},!0);async function ia(e){try{return await Bt.applyScene(e.id,{confirm:e.sensitive?!0:void 0,client_request_id:se()}),{ok:!0,note:null}}catch(t){return{ok:!1,note:M(t)}}}var na=Object.getOwnPropertyDescriptor,oa=(e,t,s,a)=>{for(var i=a>1?void 0:a?na(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=o(i)||i);return i};let Le=class extends Ht{constructor(){super(...arguments),this.lastKey=""}unhideRinging(){for(const e of this.active?.calls??[])e.state==="ringing"&&this.hiddenCalls.delete(e.call_id);this.requestUpdate(),this.sync()}updated(){super.updated();const e=this.active?.calls??[],t=e.filter(i=>i.state==="ringing").length,s=e.filter(i=>i.state==="ringing"&&this.hiddenCalls.has(i.call_id)).length,a=`${t}/${s}`;a!==this.lastKey&&(this.lastKey=a,this.dispatchEvent(new CustomEvent("home-calls",{detail:{ringing:t,waiting:s},bubbles:!0,composed:!0})))}mediaNow(e){const t=this.media.get(e.station_id);return t instanceof Promise||t===void 0?null:t}video(e){const t=this.mediaNow(e),s=t?.video?.allowed?t.video.paths.sub??t.video.paths.main??Object.values(t.video.paths)[0]??"":"";return e.online?s?r`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${s} profile="sub" poster=${e.still?Be(e.station_id,this.picture):""}></sw-camera-tile>`:e.has_camera&&e.still?r`<img class="scene-pic call-still" src=${Be(e.station_id,this.picture)} alt=${"מי שבכניסה: "+e.station_name} decoding="async" />`:r`<div class="cam-off big">${p("camoff")}<span>אין תמונה מהכניסה הזו</span></div>`:r`<div class="cam-off big">${p("camoff")}<span>הכניסה לא מחוברת כרגע</span></div>`}render(){this.tick;const e=this.shown();if(!e.length)return g;const t=e[Math.min(this.front,e.length-1)],s=t.answered_by_me||this.talking.has(t.call_id),a=this.busy[t.call_id],i=Vt(this.mediaNow(t)).kind==="talk",n=this.notes[t.call_id],o=this.sessions.get(t.call_id),l=this.doorAsk?.startsWith(`${t.call_id}/`)?Number(this.doorAsk.split("/")[1]):null,h=u=>t.locks.find(f=>f.physical_index===u)?.name||t.station_name,c=t.can_open_door&&t.online&&t.locks.length>0,d=Zt(t,this.fetchedAt,Date.now());let m;if(l!==null)m=r`<h1>לפתוח את ${h(l)}?</h1><p class="sub">הדלת תינעל שוב מעצמה אחרי כמה שניות.</p>
        <div class="call-acts"><button class="hbtn strong xl" data-call-door-yes ?disabled=${a==="door"} @click=${()=>void this.openDoor(t,l)}>${p("unlock")}כן, פתח</button><button class="hbtn xl" data-call-door-no @click=${()=>this.doorAsk=null}>ביטול</button></div>`;else{const u=c?t.locks.map(f=>r`<button class="hbtn xl${s?" strong":""}" data-call-door=${f.physical_index} ?disabled=${!!a} @click=${()=>this.doorAsk=`${t.call_id}/${f.physical_index}`}>${p("unlock")}${t.locks.length>1&&f.name?`פתח: ${f.name}`:"פתח דלת"}</button>`):[];m=r`<p class="ring-line">${p("bell")}${s?"בשיחה":"מצלצלים עכשיו"} <span class="num">${Xt(d)}</span></p><h1>${s?"מדברים עם "+t.station_name:"מישהו ב"+t.station_name.replace(/^ה/,"")}</h1>
        <p class="sub">${s?o?.muted?"המיקרופון מושתק.":"שומעים אותך בכניסה. אפשר לדבר.":i?"אפשר לענות, לפתוח או להתעלם.":"אפשר לפתוח או להתעלם. דיבור עם הכניסה הזו לא זמין מכאן."}</p>
        ${n?r`<p class="sub" role="status" data-call-note=${n.tone}>${n.text}</p>`:g}
        <div class="call-acts">
          ${s?r`<button class="hbtn xl" data-call-hangup aria-pressed="true" ?disabled=${a==="hangUp"} @click=${()=>void this.signal(t,"hangUp")}>${p("mic")}סיים שיחה</button>${o&&o.phase!=="starting"&&o.phase!=="idle"?r`<button class="hbtn xl" data-call-mute @click=${()=>o.toggleMute()}>${p("mic")}${o.muted?"בטל השתקה":"השתק"}</button>`:g}`:i?r`<button class="hbtn strong xl" data-call-answer ?disabled=${!!a||!t.online} @click=${()=>void this.answer(t)}>${p("phone")}${a==="answer"?"עונה…":"ענה ודבר"}</button>`:g}
          ${u}
          ${s?g:r`<button class="hbtn quiet xl" data-call-ignore @click=${()=>this.hide(t)}>התעלם</button>`}
        </div>`}return r`<div class="ovl"><div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label="אינטרקום" data-incoming-call=${t.call_id} data-state=${s?"in_call":"ringing"}>
      <div class="call-video">${this.video(t)}${t.online?r`<span class="live onpic"><i class="dot"></i>חי</span>`:g}</div><div class="call-side">${m}</div></section></div>`}};Le.styles=[vt,wt];Le=oa([gt("sw-home-call")],Le);const ra=ge`${ut(String.raw`/* SmplWise Arx - home interface v3 (round 27, 2026-11-11). Loaded after home.css + v2.css + themes.css.
   Only the added screens. Same tokens (ds.css --hs-*, the home face's --hs-* / --f-* / --hit / --r-*), same primitives (tile, pane, hbtn, rb, seg, sheet).
   Rules kept: no scrolling on any control screen (every list pages), green is status only, the picture / time axis / plan are never mirrored. */
.clamp3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; min-inline-size: 0; }
.pane .mid, .vrow .mid, .wxd .mid { font-size: 22px; font-weight: 600; color: var(--hs-heading); line-height: 1.25; }
.pb-none { padding-block: 12px; }
.foot-note { flex: none; display: flex; align-items: center; gap: 8px; color: var(--hs-text-2); font-size: var(--f-sm); min-block-size: 28px; }
.foot-note .hi { inline-size: 18px; block-size: 18px; flex: none; }
.at .dst { min-inline-size: 0; } .dst > .clamp1 { min-inline-size: 0; }
.hs .rb.play, .ovl .rb.play { background: var(--hs-accent); color: var(--hs-on-accent, #fff); }
.hs .rb.play:disabled { background: var(--hs-surface-3); color: var(--hs-text-2); }
a.wx { color: inherit; min-block-size: var(--hit); padding-inline: 10px; border-radius: 999px; }

/* ---- the hub */
.hub { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 14px; margin-block: 6px 12px; }
.hubt { display: grid; align-content: center; justify-items: center; gap: 6px; padding: 12px 10px; text-align: center; color: var(--hs-heading); transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease; }
.hubt:active { transform: scale(.97); }
.hubt > .hi { inline-size: 40px; block-size: 40px; color: var(--hs-text-2); margin-block-end: 4px; }
.hubt .hl { font-size: var(--f-tile); font-weight: 600; max-inline-size: 100%; }
.hubt .hs2 { font-size: 14px; line-height: 1.3; color: var(--hs-text-2); max-inline-size: 100%; }
.hubt .hs2[data-tone] { color: var(--ct); } .hubt .hs2 .dot { inline-size: 8px; block-size: 8px; margin-inline-end: 6px; }
.hub .hubt > .count { position: absolute !important; inset-block-start: 10px; inset-inline-end: 10px; min-inline-size: 24px; block-size: 24px; border-radius: 12px; background: var(--hs-accent); color: var(--hs-on-accent, #fff); font-size: 13px; font-weight: 700; display: grid; place-items: center; padding: 0 6px; }

/* ---- recordings */
.pb-body { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 14px; }
.hs .pb-pic { background: #000; overflow: hidden; }
.rec-st { display: inline-flex; gap: 6px; font-weight: 500; }
.pb-side { grid-row: 1; grid-column: 2; gap: 6px; }
.pb-ev { inline-size: 100%; flex: 1 1 0; max-block-size: 76px; background: transparent; }
.pb-ev > .hi:first-child { inline-size: 22px; block-size: 22px; color: var(--hs-text-2); flex: none; }
.pb-ev b { flex: none; color: var(--hs-text-2); font-weight: 500; }
.hs .pb-ev[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); }
.pb-ctl { grid-column: 1 / -1; display: flex; align-items: center; gap: 18px; padding: 8px 14px; min-inline-size: 0; }
.pb-btns { display: flex; align-items: center; gap: 8px; flex: none; direction: ltr; }
.tl { flex: 1; min-inline-size: 0; position: relative; padding-block-start: 14px; }
.tl-track { position: relative; block-size: 28px; border-radius: 8px; background: var(--hs-surface-3); }
.tl-seg { position: absolute; inset-block: 0; background: var(--viz-today); border-radius: 4px; opacity: .85; }
.tl-ev { position: absolute; inset-block-start: -9px; inline-size: 8px; block-size: 8px; margin-left: -4px; border-radius: 50%; background: var(--hs-heading); }
.tl-head { position: absolute; inset-block: -8px; inline-size: 4px; margin-left: -2px; border-radius: 2px; background: var(--hs-heading); box-shadow: 0 0 0 3px var(--hs-surface); }
.tl input { position: absolute; inset-inline: 0; inset-block-start: 0; block-size: 56px; inline-size: 100%; margin: 0; opacity: 0; cursor: pointer; }
.tl input:focus-visible + .tl-ax { outline: 3px solid var(--hs-focus); outline-offset: 2px; border-radius: 6px; }
.tl-ax { display: flex; justify-content: space-between; font-size: 13px; color: var(--hs-text-2); margin-block-start: 6px; }
.cf-foot { position: absolute; inset-inline: 0; inset-block-end: 0; display: flex; justify-content: center; padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0px)); }
.ovl .hbtn.onpic { background: rgba(0,0,0,.66); color: #fff; }

/* ---- list rows (diary, calls, people, calendar, schedules) */
.evrow, .srow, .prow, .crow, .cev { display: grid; align-items: center; gap: 14px; padding: 0 16px; }
.evrow, .srow { grid-template-columns: var(--hit) minmax(0, 1fr) auto; }
.crow { grid-template-columns: 96px minmax(0, 1fr); }
.prow { grid-template-columns: 44px minmax(0, 1fr) minmax(0, .9fr); }
.prow.away .av { opacity: .55; }
.pk { display: grid; justify-items: end; text-align: end; min-inline-size: 0; } .pk b { font-weight: 500; color: var(--hs-heading); font-size: var(--f-sm); }
.card-grid.pplg, .card-grid.calg { grid-template-rows: repeat(3, minmax(0, 1fr)); }
.card-grid.ntg { grid-template-rows: repeat(2, minmax(0, 1fr)); }
.me-row { flex: none; }
.row-acts { display: flex; align-items: center; gap: 8px; flex: none; }
.srow.offr .at b { color: var(--hs-text-2); font-weight: 500; }
.arow.tkrow { inline-size: 100%; text-align: start; color: inherit; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease; }
.arow.tkrow:active, .ncard:active, .wd:active { transform: scale(.985); }
.tks { display: grid; justify-items: end; gap: 6px; flex: none; }
.steps { display: flex; gap: 5px; } .steps i { inline-size: 26px; block-size: 6px; border-radius: 3px; background: var(--hs-surface-3); } .steps i.on { background: var(--hs-accent-text); }
.steps.big { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-block: 12px 4px; inline-size: 100%; }
.sp { display: grid; justify-items: center; gap: 6px; font-size: var(--f-sm); color: var(--hs-text-2); }
.sp i { inline-size: 44px; block-size: 44px; border-radius: 50%; background: var(--hs-surface-3); display: grid; place-items: center; } .sp i .hi { inline-size: 22px; block-size: 22px; }
.sp.on { color: var(--hs-heading); font-weight: 600; } .sp.on i { background: var(--hs-accent-soft); color: var(--hs-accent-text); }
.tk-note { display: flex; gap: 10px; align-items: flex-start; inline-size: 100%; background: var(--hs-surface-3); padding: 14px; border-radius: 14px; color: var(--hs-heading); } .tk-note .hi { inline-size: 20px; block-size: 20px; flex: none; color: var(--hs-text-2); margin-block-start: 2px; }

/* ---- calendar */
.week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; flex: none; }
.wd { display: grid; justify-items: center; align-content: center; gap: 1px; min-block-size: 68px; padding: 4px 0; border-radius: var(--r-ctl); background: var(--hs-surface); color: var(--hs-text-2); font-size: var(--f-sm); transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease; }
.wd b { font-size: 21px; font-weight: 600; color: var(--hs-heading); line-height: 1.15; }
.hs .wd[aria-pressed="true"], .ovl .wd[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); } .wd[aria-pressed="true"] b { color: var(--hs-accent-text); }
.wd[data-today] { box-shadow: inset 0 0 0 2px var(--hs-border-strong); }
.wk { display: flex; gap: 3px; block-size: 6px; } .wk i { inline-size: 6px; block-size: 6px; border-radius: 50%; background: var(--hs-text-3); }
.ovl .week.mini { gap: 6px; flex: 0 1 auto; } .ovl .week.mini .wd { min-block-size: 56px; min-inline-size: 56px; background: var(--hs-surface-3); }
.cev { grid-template-columns: 72px minmax(0, 1fr) auto; }
.ct { display: grid; } .ct b { font-size: 22px; font-weight: 600; color: var(--hs-heading); line-height: 1.2; }
.bk .door-list { display: grid; grid-template-rows: repeat(4, minmax(0, 1fr)) auto; gap: 12px; min-block-size: 0; }
.vrow.bkm { grid-template-columns: minmax(0, 1fr) var(--hit); } .vrow.blr { grid-template-columns: minmax(0, 1fr) auto var(--hit); }

/* ---- notices */
.transit { flex: none; display: flex; align-items: center; gap: 16px; padding: 0 18px; min-block-size: 52px; font-size: var(--f-sm); color: var(--hs-text-2); min-inline-size: 0; }
.transit > .hi { inline-size: 20px; block-size: 20px; flex: none; } .transit > b { color: var(--hs-heading); font-weight: 600; flex: none; } .tr { flex: 0 1 auto; } .tr b { color: var(--hs-heading); font-weight: 600; }
.ncard { display: grid; grid-template-rows: auto auto minmax(0, 1fr); align-content: start; justify-items: start; gap: 6px; padding: 16px 20px; text-align: start; overflow: hidden; color: var(--hs-text); inline-size: 100%; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease; }
.nh { display: flex; align-items: center; gap: 10px; min-inline-size: 0; max-inline-size: 100%; }
.newp { flex: none; background: var(--hs-accent); color: var(--hs-on-accent, #fff); font-size: 13px; font-weight: 600; padding: 2px 10px; border-radius: 999px; }
.pinp { flex: none; display: inline-flex; align-items: center; gap: 4px; color: var(--ct); font-size: 13px; font-weight: 600; } .pinp .hi { inline-size: 16px; block-size: 16px; }
.nt { font-size: var(--f-tile); font-weight: 600; color: var(--hs-heading); line-height: 1.3; }
.ncard:not(.new) .nt { font-weight: 500; }
.nb { color: var(--hs-text-2); font-size: var(--f-sm); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.n-body { inline-size: 100%; max-block-size: min(44vh, 360px); overflow-y: auto; line-height: 1.65; padding: 10px 0; color: var(--hs-text); overscroll-behavior: contain; }

/* ---- media */
.md-body { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; }
.md-now { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto auto auto auto; align-items: center; gap: 10px 20px; padding: 18px 20px; overflow: hidden; }
.art { inline-size: clamp(84px, 17vh, 168px); aspect-ratio: 1; border-radius: 20px; display: grid; place-items: center; background: var(--hs-accent-soft); color: var(--hs-accent-text); } .art .hi { inline-size: 40%; block-size: 40%; }
.md-now:not(.is-on) .art { background: var(--hs-surface-3); color: var(--hs-text-2); }
.md-t { display: grid; gap: 4px; min-inline-size: 0; } .md-t b { font-size: 26px; font-weight: 600; line-height: 1.2; color: var(--hs-heading); }
.md-prog { grid-column: 1 / -1; block-size: 6px; border-radius: 3px; background: var(--hs-surface-3); overflow: hidden; } .md-prog i { display: block; block-size: 100%; background: var(--hs-accent-text); transform-origin: left; } .md-prog.none { visibility: hidden; }
.md-ctl { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 22px; }
.volr { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr) 40px; align-items: center; gap: 12px; color: var(--hs-text-2); }
.volr .vi .hi { inline-size: 24px; block-size: 24px; display: block; } .volr .vv { text-align: center; color: var(--hs-heading); font-weight: 600; }
.volr input { -webkit-appearance: none; appearance: none; inline-size: 100%; block-size: var(--hit); margin: 0; background: transparent; cursor: pointer; }
.volr input::-webkit-slider-runnable-track { block-size: 10px; border-radius: 5px; background: linear-gradient(to left, var(--hs-accent-text) var(--v, 0%), var(--hs-surface-3) var(--v, 0%)); /* taste-skill-ignore: a hard-stop fill for the slider's value, not a decorative gradient */ }
.volr input::-webkit-slider-thumb { -webkit-appearance: none; inline-size: 28px; block-size: 28px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); margin-block-start: -9px; }
.volr input::-moz-range-track { block-size: 10px; border-radius: 5px; background: var(--hs-surface-3); } .volr input::-moz-range-thumb { inline-size: 28px; block-size: 28px; border: 0; border-radius: 50%; background: #fff; }
.md-src { grid-column: 1 / -1; display: flex; gap: 8px; min-inline-size: 0; overflow: hidden; }
.md-src .chip2, .chipset .chip2 { padding: 0 16px !important; gap: 8px; background: var(--hs-surface-3); flex: 0 1 auto; } .chip2 .hi { inline-size: 20px; block-size: 20px; flex: none; }
.md-list { display: grid; grid-template-rows: repeat(4, minmax(0, 1fr)) auto; gap: 12px; min-block-size: 0; }
.mrow2 { display: grid; grid-template-columns: var(--hit) minmax(0, 1fr) var(--hit); align-items: center; gap: 12px; padding: 0 14px; }
.mrow2.cur { box-shadow: inset 0 0 0 2px var(--hs-accent-text); } .mrow2.is-on .ai { background: var(--hs-accent-soft); color: var(--hs-accent-text); }
.mrow2 .at b { font-size: var(--f-body); }

/* ---- bill, water, systems */
.bill-now { justify-content: center; gap: 10px; }
.huge.fit { font-size: clamp(48px, 9vw, var(--f-huge)); }
.mprog { block-size: 10px; border-radius: 5px; background: var(--hs-surface-3); overflow: hidden; flex: none; inline-size: 100%; } .mprog i { display: block; block-size: 100%; background: var(--viz-today); transform-origin: right; } .mprog.low i { background: var(--hs-warning); }
.bill-fc { display: grid; gap: 2px; margin-block-start: 10px; padding-block-start: 14px; border-block-start: 1px solid var(--hs-border); }
.wbars { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr); gap: 10px; }
.wb { display: grid; grid-template-rows: 20px minmax(0, 1fr) 22px; justify-items: center; gap: 4px; min-block-size: 0; font-size: var(--f-sm); color: var(--hs-text-2); }
.wb i { inline-size: min(64%, 56px); align-self: end; border-radius: 8px 8px 3px 3px; background: var(--viz-today); } .wb.future i { background: var(--hs-surface-3); block-size: 4px !important; }
.wb .wv { font-size: 13px; }
.leak { align-items: flex-start; justify-content: center; gap: 10px; } .leak h2 { font-size: 24px; } .leak .hbtn { margin-block-start: 8px; max-inline-size: 100%; white-space: normal; }
.sys-grid { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 14px; margin-block-end: 8px; }
.sys-grid.n1 { grid-template-columns: minmax(0, 1fr); } .sys-grid.n3 > :first-child { grid-row: span 2; }
.sys { justify-content: center; gap: 6px; } .sys:has(.sysr) { gap: 0; } .sys .bar { margin-block-end: 2px; }
.sys-k { display: flex; align-items: center; gap: 8px; color: var(--hs-text-2); font-size: var(--f-sm); font-weight: 500; } .sys-k .hi { inline-size: 22px; block-size: 22px; }
.sysr { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: 1 1 0; min-block-size: 44px; max-block-size: 64px; border-block-start: 1px solid var(--hs-border); min-inline-size: 0; }
.sysr > b { flex: 1; min-inline-size: 0; font-weight: 500; color: var(--hs-heading); } .sysr .dst { flex: 0 1 auto; max-inline-size: 58%; } .sysr .st { display: inline-flex; align-items: center; gap: 8px; flex: none; } .sysr .st b { font-size: 20px; color: var(--hs-heading); }

/* ---- the map (schematic plan, never mirrored) */
.plan-wrap { flex: 1; min-block-size: 0; display: grid; }
.plan { position: relative; background: var(--hs-surface); border-radius: var(--r-tile); min-block-size: 0; }
.pr { position: absolute; display: grid; align-content: center; justify-items: center; gap: 4px; padding: 6px; border-radius: 14px; background: var(--hs-off-tile); color: var(--hs-text-2); box-shadow: inset 0 0 0 1px var(--hs-border-strong); text-align: center; overflow: hidden; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease; }
.pr:active { transform: scale(.98); }
.pr b { font-size: var(--f-body); font-weight: 600; color: var(--hs-heading); line-height: 1.2; }
.pr.lit { background: var(--hs-lamp-on); }
.pm { display: inline-flex; align-items: center; gap: 8px; font-size: var(--f-sm); } .pm .hi { inline-size: 18px; block-size: 18px; } .pm .hi.lit { color: var(--hs-lit); }
.pr.void { background: transparent; box-shadow: inset 0 0 0 1px var(--hs-border); }
.plan-leg { flex: none; min-block-size: 44px; } .k.lit { inline-size: 14px; block-size: 14px; border-radius: 4px; background: var(--hs-lit); } .k.dark { inline-size: 14px; block-size: 14px; border-radius: 4px; background: var(--hs-off-tile); box-shadow: inset 0 0 0 1px var(--hs-border-strong); }

/* ---- weather, alarm, my notifications */
.wx-body { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); grid-template-rows: minmax(0, 1fr) minmax(0, 1.5fr); gap: 14px; }
.wx-now { grid-row: 1 / -1; align-items: center; justify-content: center; text-align: center; gap: 10px; } .wx-now > .hi { inline-size: 64px; block-size: 64px; color: var(--hs-lit); }
.wx-t { display: grid; gap: 2px; justify-items: center; }
.wx-f { display: flex; gap: 22px; margin-block-start: 10px; flex-wrap: wrap; justify-content: center; } .wx-f > span { display: inline-flex; align-items: center; gap: 6px; } .wx-f .hi { inline-size: 20px; block-size: 20px; color: var(--hs-text-2); } .wx-f b { color: var(--hs-heading); }
.wx-row { flex: 1; min-block-size: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; align-items: center; }
.wxc { display: grid; justify-items: center; gap: 6px; } .wxc .hi { inline-size: 28px; block-size: 28px; color: var(--hs-text-2); } .wxc b { font-size: 20px; color: var(--hs-heading); }
.wx-days { flex: 1; min-block-size: 0; display: grid; grid-auto-rows: minmax(0, 1fr); }
.wxd { display: grid; grid-template-columns: 78px 28px minmax(0, 1fr) auto; align-items: center; gap: 12px; border-block-start: 1px solid var(--hs-border); } .wxd > b { color: var(--hs-heading); font-weight: 600; } .wxd .hi { inline-size: 24px; block-size: 24px; color: var(--hs-text-2); }
.hl2 { display: inline-flex; gap: 12px; align-items: baseline; } .hl2 b { font-size: 20px; color: var(--hs-heading); }
.alm-main { align-items: center; justify-content: center; text-align: center; gap: 10px; }
.alm-ic { inline-size: 88px; block-size: 88px; border-radius: 50%; display: grid; place-items: center; background: var(--cs); color: var(--ct); } .alm-ic .hi { inline-size: 44px; block-size: 44px; }
.alm-w { font-size: 34px; font-weight: 600; color: var(--hs-heading); line-height: 1.2; }
.alm-acts { display: grid; gap: 10px; inline-size: min(360px, 100%); margin-block-start: 12px; }
.nf-body { flex: 1; min-block-size: 0; display: grid; align-content: start; gap: 18px; margin-block-start: 6px; }

/* ---- v3 sheets (short forms; nothing here scrolls except a long notice) */
.sheet.dialog.v3 { gap: 10px; max-block-size: calc(100dvh - 24px); }
.sheet.v3 .menu-h { inline-size: 100%; } .sheet.v3 .menu-h > .hi { inline-size: 28px; block-size: 28px; color: var(--hs-text-2); flex: none; }
.sheet.v3 .mh-t b { font-size: 22px; }
.fld { display: grid; gap: 6px; inline-size: 100%; font-size: var(--f-sm); color: var(--hs-text-2); }
.inp { min-block-size: var(--hit); inline-size: 100%; border: 0; border-radius: var(--r-ctl); background: var(--hs-surface-3); color: var(--hs-heading); padding: 0 16px; font: inherit; font-size: max(16px, var(--f-body)); }
textarea.inp { padding-block: 12px; resize: none; line-height: 1.4; } .inp::placeholder { color: var(--hs-text-3); }
.chipset { display: flex; flex-wrap: wrap; gap: 8px; inline-size: 100%; } .chipset.tight { inline-size: auto; flex: 0 1 auto; min-inline-size: 0; justify-content: flex-end; }
.ovl .chip2[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); font-weight: 600; }
.sheet.v3 .setrow.flat { gap: 10px; }
.stp { display: inline-flex; align-items: center; gap: 6px; flex: none; } .stp b { min-inline-size: 66px; text-align: center; font-size: 20px; color: var(--hs-heading); }
.setrow .sname.mid-l { flex: none; margin-inline-start: 10px; }
.dlg-acts.three { grid-template-columns: repeat(3, minmax(0, 1fr)); } .sheet.v3 .dlg-acts .hbtn { padding: 0 12px; }
.sheet.v3.center { justify-items: center; text-align: center; }
.code { font-size: 44px; font-weight: 600; letter-spacing: .06em; color: var(--hs-heading); line-height: 1.3; }
.ovl .hbtn.talk { inline-size: 100%; } .ovl .hbtn.talk[aria-pressed="true"] { background: var(--hs-danger-soft); color: var(--hs-danger-text); }
.pin { display: flex; gap: 16px; justify-content: center; margin-block: 6px 10px; } .pin i { inline-size: 16px; block-size: 16px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--hs-border-strong); } .pin i.on { background: var(--hs-heading); box-shadow: none; }
.keys { display: grid; grid-template-columns: repeat(3, 76px); gap: 10px; justify-content: center; } .ovl .keys .rb { inline-size: 76px; block-size: 64px; border-radius: 18px; font-size: 24px; font-weight: 500; }
.rm { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; justify-items: center; gap: 14px; margin-block: 8px; inline-size: 100%; }
.rm-col { display: grid; gap: 10px; justify-items: center; } .dpad { display: grid; grid-template-columns: repeat(3, auto); gap: 8px; place-items: center; }
.ovl .dpad .rb.xl { font-size: 16px; font-weight: 600; background: var(--hs-accent); color: var(--hs-on-accent, #fff); }

/* ---- 1024 tablets: the category row stacks icon over text so nine fit */
@media (max-width: 1100px) and (min-width: 701px) {
  .chips3 { gap: 8px; } .chip3 { flex-direction: column; justify-content: center; gap: 4px; padding: 6px 4px; text-align: center; }
  .chip3 > .hi { inline-size: 28px; block-size: 28px; } .c3-t { justify-items: center; } .c3-t b { font-size: 15px; } .c3-s { font-size: 13px; } .c3-s .dot { display: none; }
  .hubt > .hi { inline-size: 34px; block-size: 34px; } .hubt .hl { font-size: 16px; } .hubt .hs2 { font-size: 13px; } .hub { gap: 10px; }
  .hs-head .acts .hbtn { padding: 0 14px; } .hs .pg-t { font-size: 24px; }
  .md-t b { font-size: 22px; } .prow { grid-template-columns: 44px minmax(0, 1fr) minmax(0, .7fr); }
}
@media (max-height: 800px) and (min-width: 701px) { .nb { -webkit-line-clamp: 2; } .wd { min-block-size: 60px; } .alm-ic { inline-size: 64px; block-size: 64px; } .alm-ic .hi { inline-size: 32px; block-size: 32px; } .art { border-radius: 16px; } }

/* ---- phone */
@media (max-width: 700px) {
  .nv-x { display: none; } .hs.v2 .hs-nav a { font-size: 11px; }
  .chip3[data-cat="more"] { display: none; }
  .hub { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block: 2px 8px; }
  .hubt { padding: 6px 4px; gap: 3px; } .hubt > .hi { inline-size: 28px; block-size: 28px; margin-block-end: 2px; } .hubt .hl { font-size: 14px; } .hubt .hs2 { font-size: 12px; } .hub .hubt > .count { inset-block-start: 6px; inset-inline-end: 6px; }
  .hs-head .pager .pg { min-inline-size: 48px; }
  .pb-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto auto; gap: 8px; }
  .pb-side { grid-row: 3; grid-column: 1; } .pb-ev { flex: none; min-block-size: 48px; } .pb-ctl { grid-row: 2; flex-wrap: wrap; gap: 6px 10px; padding: 8px 10px; justify-content: space-between; }
  .pb-ctl .tl { order: -1; flex: 1 1 100%; } .pb-ctl .hbtn { padding: 0 16px; } .hs-head .cf-nav { display: none; }
  .evrow, .srow, .prow, .crow, .cev { padding: 0 12px; gap: 10px; }
  .card-grid.evg { grid-template-rows: repeat(5, minmax(0, 1fr)); } .card-grid.callg, .card-grid.pplg, .card-grid.calg, .card-grid.schg { grid-template-rows: repeat(4, minmax(0, 1fr)); } .card-grid.ntg { grid-template-rows: repeat(3, minmax(0, 1fr)); }
  .crow { grid-template-columns: 72px minmax(0, 1fr); } .prow { grid-template-columns: 36px minmax(0, 1fr) minmax(0, .8fr); } .srow .what { display: none; }
  .me-row .muted { display: none; } .foot-note { font-size: 13px; }
  .alert-list .at .dst, .crow .dst { font-size: 13px; } .row-acts { gap: 4px; } .tks .muted { font-size: 12px; } .steps i { inline-size: 16px; }
  .week { gap: 4px; } .wd { min-block-size: 54px; border-radius: 12px; } .wd b { font-size: 17px; } .cev { grid-template-columns: 56px minmax(0, 1fr) auto; } .ct b { font-size: 18px; }
  .ovl .week.mini { inline-size: 100%; gap: 2px; } .ovl .week.mini .wd { min-inline-size: 0; min-block-size: 48px; }
  .bk .door-list { grid-template-rows: repeat(2, minmax(0, 1fr)) auto; gap: 8px; flex: 1.1 1 0; } .bk > .pane { flex: 1 1 0; }
  .transit { min-block-size: 44px; padding: 0 12px; gap: 8px; } .ncard { padding: 10px 14px; gap: 3px; } .nb { -webkit-line-clamp: 2; font-size: 13px; }
  .md-body { display: flex; flex-direction: column; gap: 8px; } .md-now { flex: 1 1 auto; padding: 10px 14px; gap: 6px 12px; grid-template-rows: auto auto auto auto auto; } .art { inline-size: 60px; border-radius: 14px; } .md-t b { font-size: 18px; } .md-prog { display: none; }
  .md-ctl { gap: 18px; } .md-ctl .rb.xl { inline-size: 60px; block-size: 60px; } .md-src .chip2 { padding: 0 12px !important; font-size: 14px; min-block-size: 44px; } .volr input { block-size: 44px; }
  .md-list { flex: none; grid-template-rows: repeat(2, 60px) auto; gap: 8px; }
  .huge.fit { font-size: 56px; } .wbars { gap: 4px; } .wb .wv { font-size: 11px; } .leak h2 { font-size: 20px; } .leak { flex: 0 0 auto; } .bill-now { flex: 1.2 1 0; }
  .sys-grid { gap: 8px; } .sys { padding: 10px 12px; } .pane .mid { font-size: 18px; } .sysr { flex-wrap: wrap; gap: 2px 8px; align-content: center; } .sysr .dst { max-inline-size: 100%; font-size: 13px; } .sys .bar { min-block-size: 44px; }
  .pr { padding: 3px; border-radius: 10px; } .pr b { font-size: 13px; } .pm { font-size: 12px; gap: 4px; } .pm .hi { inline-size: 14px; block-size: 14px; } .plan-leg .muted { display: none; }
  .wx-body { display: flex; flex-direction: column; gap: 8px; } .wx-now { flex: 1.3 1 0; gap: 4px; } .wx-now > .hi { inline-size: 40px; block-size: 40px; } .wx-h { flex: none; } .wx-d { flex: 1.6 1 0; } .wxd { grid-template-columns: 62px 24px minmax(0, 1fr) auto; gap: 8px; } .wx-now .huge { font-size: 60px; } .wx-f { margin-block-start: 4px; }
  .alm-main { flex: 1.25 1 0; gap: 6px; } .alm-ic { inline-size: 56px; block-size: 56px; } .alm-ic .hi { inline-size: 28px; block-size: 28px; } .alm-w { font-size: 26px; } .alm .pane:last-child { flex: 1 1 0; } .alm-acts { margin-block-start: 6px; }
  .nf-body { gap: 10px; }
  .sheet.dialog.v3 { padding: 18px 16px; gap: 8px; } .sheet.v3 .mh-t b { font-size: 19px; } .dlg-acts.three { gap: 8px; } .dlg-acts.three .hbtn .hi { display: none; } .sheet.v3 .dlg-acts .hbtn { padding: 0 8px; font-size: 15px; }
  .stp b { min-inline-size: 58px; font-size: 18px; } .setrow .sname.mid-l { margin-inline-start: 0; } .sheet.v3 .setrow.flat { min-block-size: 56px; }
  .chipset .chip2 { min-block-size: 44px; padding: 0 12px !important; font-size: 15px; } .chipset.tight { justify-content: flex-start; inline-size: 100%; }
  .code { font-size: 36px; } .keys { grid-template-columns: repeat(3, 72px); } .ovl .keys .rb { inline-size: 72px; block-size: 56px; }
  .rm { gap: 6px; } .dpad { gap: 6px; } .ovl .dpad .rb.xl { inline-size: 68px; block-size: 68px; }
  .n-body { max-block-size: 46vh; }
}
@media (hover: hover) and (pointer: fine) {
  .hubt:hover, .ncard:hover, .arow.tkrow:hover, .hs .wd:not([aria-pressed="true"]):hover, .pr:not(.void):not(.lit):hover { background: var(--hs-surface-2); }
  :host([data-hs-scheme="light"]) .hubt:hover, :host([data-hs-scheme="light"]) .ncard:hover, :host([data-hs-scheme="light"]) .arow.tkrow:hover { background: #fbfaf8; }
}
@media (prefers-reduced-motion: reduce) { .hubt, .ncard, .wd, .pr, .arow.tkrow { transition-property: background-color, color !important; transform: none !important; } }

/* ---- loop 1 fixes */
.en-body:has(.wbars), .en-body:has(.bill-now) { grid-template-rows: minmax(0, 1fr); }
.dst { max-inline-size: 100%; min-inline-size: 0; }
@media (max-width: 700px) { .wx-now { padding-block: 8px; } .wx-now .huge { font-size: 54px; } .wx-f { gap: 14px; } }
@media (max-width: 700px) { .sys-grid, .sys-grid.n3 { grid-template-columns: minmax(0, 1fr); } .sys-grid.n3 > :first-child { grid-row: auto; } .sys { padding-block: 6px; } .sysr { flex-wrap: nowrap; } .sysr .dst { max-inline-size: 58%; } }

/* ---- loop 2: buttons that are tiles keep the tile surface; chips in sheets; smaller currency sign */
.hs .ncard, .hs .arow.tkrow, .hs .wd { background: var(--hs-surface); }
.ovl .chipset .chip2, .ovl .week.mini .wd { background: var(--hs-surface-3); }
.ovl .chipset .chip2[aria-pressed="true"], .ovl .week.mini .wd[aria-pressed="true"], .hs .wd[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); }
.cur { font-size: .7em; font-weight: 500; color: var(--hs-text-2); } .huge .cur { font-size: .4em; }
.cf-foot .hbtn { text-decoration: none; }
.gw { line-height: 1.3; }
@media (min-width: 701px) { .gw { -webkit-line-clamp: 1; } }
@media (max-width: 700px) { .en-body > .pane:has(.wbars) { flex: 1.6 1 0; } .en-body > .leak { flex: 1 1 0; } }

/* ---- loop 2 (break-ui, worst case) */
.pb-pic > .cam-off { position: absolute !important; inset: 0; padding-block-end: 16px; }
.pb-side .bar h2 { white-space: nowrap; }
.md-src .chip2 { white-space: nowrap; }
.steps.big .sp i { inline-size: 44px; block-size: 44px; flex: none; }
@media (max-width: 1100px) { .pb-side .pager { gap: 6px; } .pb-side .pager .pg { display: none; } .md-src .chip2 { padding: 0 12px !important; } }
@media (max-width: 700px) { .leak .dlg-ic { display: none; } .leak { gap: 4px; padding-block: 10px; } .leak .hbtn { margin-block-start: 4px; } .en-body > .leak { flex: none; } }
.md-src .chip2 { min-inline-size: var(--hit); justify-content: center; }
`)}`,zt=[];function G(e){zt.push(e)}function la(e){return zt.map(t=>t(e))}const te=[];function ne(e){const t=te.findIndex(s=>s.id===e.id);t>=0?te.splice(t,1,e):te.push(e)}function Z(e){return te.filter(t=>{try{return t.visible(e)}catch{return!1}}).sort((t,s)=>t.order-s.order)}function lt(e){return te.some(t=>t.href.split("/")[0]===e)}function ca(e){const t=Z(e),s=t.reduce((i,n)=>i+(n.line(e).badge??0),0),a={tiles:t.length,badges:s};return e.extState.moreSummary=a,a}G(e=>({id:"more",names:["more"],navCur:()=>"more",back:()=>null,enter(){for(const t of Z(e))t.warm?.(e)},render(){const t=Z(e);ca(e);const s=_(t,e.phone?12:18,e.pg("hub"));return t.length?r`${e.head("עוד בבית","כל מה שהבית יודע לעשות, מעבר לחדרים",e.pager("hub",s.pages))}
      <div class="hub">${s.items.map(a=>{const i=a.line(e);return r`<a class="tile hubt" href=${e.href(a.href)} data-mod=${a.id} data-act=${a.act?.(e)??g}>${i.badge?r`<b class="count num">${i.badge}</b>`:g}${p(a.icon)}<b class="hl clamp1">${a.label}</b><span class="hs2 clamp2" data-tone=${i.tone??g}>${i.tone?r`<i class="dot"></i>`:g}${i.text}</span></a>`})}</div>`:r`${e.head("עוד בבית","")}${e.empty("grid","אין כאן עדיין יכולות נוספות","מנהל הבית מפעיל יכולות נוספות לכל אדם. כשיופעלו, הן יופיעו כאן.")}`}}));function _t(e,t){const s=t?` ב${t}`:"";switch(e){case"motion":return{text:`תנועה${s}`,icon:"cam",kind:"cam"};case"person":return{text:`מישהו עבר${s}`,icon:"user",kind:"cam"};case"vehicle":return{text:`רכב${s}`,icon:"cam",kind:"cam"};case"line":case"field":return{text:`מישהו נכנס לאזור שמור${s}`,icon:"shield",kind:"cam"};case"door":case"io":return{text:t?`דלת נפתחה ליד ${t}`:"דלת נפתחה",icon:"door",kind:"door"};case"manual":return{text:`הקלטה${s}`,icon:"film",kind:"cam"};default:return null}}function da(e){return e.door_opened_by_name?{text:`${e.door_opened_by_name} פתח/ה את הדלת`,tone:"ok"}:e.door_opened_at?{text:"הדלת נפתחה",tone:"ok"}:e.outcome==="answered"?{text:e.answered_by_name?`${e.answered_by_name} ענה/תה`:"נענתה",tone:"ok"}:e.outcome==="missed"?{text:"לא נענתה",tone:"warn"}:e.outcome==="rejected"?{text:"נדחתה",tone:"neutral"}:{text:"הסתיימה",tone:"neutral"}}function ke(e,t=Date.now()){const s=e.valid_from?Date.parse(e.valid_from):NaN,a=e.valid_until?Date.parse(e.valid_until):NaN;return e.end_reason||["revoked","cancelled","expired","ended","refused","rejected"].includes(e.state??"")||Number.isFinite(a)&&a<=t?{text:"הסתיימה",tone:"neutral",live:!1}:e.state==="requested"?{text:"מחכה לאישור של מנהל הבית",tone:"warn",live:!0}:e.confirmed?Number.isFinite(s)&&s>t?{text:"עוד לא התחיל",tone:"neutral",live:!0}:{text:"בתוקף עכשיו",tone:"ok",live:!0}:{text:"צריך לאמת את הטלפון של האורח",tone:"warn",live:!0}}function Mt(e,t=!0){if(!t)return{text:"לא זמינה כרגע",tone:"warn"};switch(e){case"disarmed":return{text:"מנוטרלת",tone:"neutral"};case"armed_home":return{text:"דרוכה: בבית",tone:"ok"};case"armed_away":return{text:"דרוכה: מלאה",tone:"ok"};case"armed_night":return{text:"דרוכה: לילה",tone:"ok"};case"armed_vacation":return{text:"דרוכה: חופשה",tone:"ok"};case"armed_custom_bypass":return{text:"דרוכה חלקית",tone:"ok"};case"arming":return{text:"נדרכת…",tone:"warn"};case"pending":return{text:"ממתינה לקוד",tone:"warn"};case"disarming":return{text:"מנטרלת…",tone:"warn"};case"triggered":return{text:"אזעקה פעילה",tone:"danger"};default:return{text:"לא ידוע",tone:"neutral"}}}const ct={arm_away:"דריכה מלאה",arm_home:"דריכה: בבית",arm_night:"דריכת לילה"};function dt(e,t=new Date){return e===0?"היום":e===1?"אתמול":e===2?"שלשום":new Date(t.getTime()-e*864e5).toLocaleDateString("he-IL",{weekday:"short",day:"numeric",month:"numeric",timeZone:"Asia/Jerusalem"})}function pt(e){const t=Math.max(0,Math.round(e*60)),s=a=>String(a).padStart(2,"0");return`${s(Math.floor(t/3600)%24)}:${s(Math.floor(t/60)%60)}:${s(t%60)}`}function pa(e){return e.map(t=>[Math.max(0,t.startMin),Math.min(1440,t.endMin)]).filter(([t,s])=>s>t).sort((t,s)=>t[0]-s[0])}function ha(e,t){return e.some(([s,a])=>t>=s&&t<a)}function De(e){switch(e){case"no_recording":return"אין הקלטה בשעה הזו.";case"forbidden":return"אין הרשאה לצפות בהקלטות של המצלמה הזו.";case"playback_limit":case"too_many_sessions":return"יותר מדי צפיות פתוחות כרגע. נסו שוב בעוד רגע.";default:return"ההקלטות לא זמינות כרגע. נסו שוב מאוחר יותר."}}const b={cam:"",back:0,t:720,play:!1,session:null,spans:[],events:[],tz:"Asia/Jerusalem",loading:!1,note:"",seq:0};let Oe=0;function Ee(e){return X(new Date(Date.now()-e*864e5),b.tz)}function St(e,t){return"playback/"+encodeURIComponent(e+(t?"@"+Math.floor(t.getTime()/1e3):""))}async function ee(e){window.clearInterval(Oe);const t=b.session;b.session=null,b.play=!1,t&&await Rs(t.id).catch(()=>{}),e.requestUpdate()}async function Re(e){const t=++b.seq;b.loading=!0,b.note="",e.requestUpdate();try{const s=Ee(b.back),[a,i]=await Promise.all([As(b.cam,s),L(`cameras/${encodeURIComponent(b.cam)}/events?date=${s}`).catch(()=>({events:[]}))]);if(t!==b.seq)return;a.timezone&&(b.tz=a.timezone);const n=e.d.cameras.find(o=>o.id===b.cam)?.name??null;b.spans=pa(a.segments.map(o=>({startMin:X(new Date(o.start_at),b.tz)===s?V(new Date(o.start_at),b.tz):0,endMin:X(new Date(o.end_at),b.tz)===s?V(new Date(o.end_at),b.tz):1440}))),b.events=i.events.map(o=>{const l=_t(o.type,n);return l?{at:V(new Date(o.occurred_at),b.tz),text:l.text,icon:l.icon}:null}).filter(o=>!!o)}catch(s){if(t!==b.seq)return;b.spans=[],b.events=[],b.note=s instanceof U&&s.status===403?De("forbidden"):De(s instanceof U?s.code:void 0)}b.loading=!1,e.requestUpdate()}async function Y(e,t){b.t=Math.max(0,Math.min(1439.99,t));const s=Is(Ee(b.back),b.t,b.tz).toISOString().replace(/\.\d{3}Z$/,"Z");b.note="";try{b.session=b.session?await js(b.session.id,s):await Ps(b.cam,s);const a=b.session.actual_start_at;a&&X(new Date(a),b.tz)===Ee(b.back)&&(b.t=V(new Date(a),b.tz)),b.play=!0,window.clearInterval(Oe),Oe=window.setInterval(()=>{b.play&&(b.t=Math.min(1439.99,b.t+1/60),e.requestUpdate())},1e3)}catch(a){b.play=!1,b.note=De(a instanceof U?a.status===403?"forbidden":a.code:void 0),b.session&&a instanceof U&&a.code==="session_over"&&(b.session=null)}e.requestUpdate()}function ht(e,t){ee(e),b.cam=t,b.events=[],b.spans=[],e.page={...e.page,pbE:0},Re(e)}ne({id:"rec",order:10,href:"playback",label:"הקלטות",icon:"film",visible:e=>!!e.extFor("playback")&&e.recOk(),line:()=>({text:"מה צולם היום ובימים הקודמים"})});G(e=>({id:"recordings",names:["playback"],back:()=>"cameras",navCur:()=>"more",enter(t,s){const a=decodeURIComponent(s||""),i=a.lastIndexOf("@"),n=i>0?a.slice(0,i):a,o=i>0?new Date(+a.slice(i+1)*1e3):null,l=e.d.cameras,h=l.some(c=>c.id===n)?n:l.some(c=>c.id===b.cam)?b.cam:l[0]?.id??"";o&&Number.isFinite(o.getTime())?(b.back=Math.max(0,Math.round((Date.parse(X(new Date,b.tz))-Date.parse(X(o,b.tz)))/864e5)),b.t=V(o,b.tz)):h!==b.cam&&(b.back=0,b.t=Math.max(0,V(new Date,b.tz)-10)),h&&(h!==b.cam||o?ht(e,h):Re(e),o&&window.setTimeout(()=>void Y(e,b.t),0))},leave(){ee(e)},acts:{pbDay(t){const s=Math.max(0,b.back+ +(t.dataset.d??0));s!==b.back&&(ee(e),b.back=s,e.page={...e.page,pbE:0},Re(e))},pbCam(t){const s=e.d.cameras;if(!s.length)return;const a=Math.max(0,s.findIndex(n=>n.id===b.cam)),i=s[(a+ +(t.dataset.d??1)+s.length)%s.length].id;history.replaceState(null,"","#/home/"+St(i)),ht(e,i)},pbPlay(){b.play?ee(e):Y(e,b.t)},pbSkip(t){const s=b.t+ +(t.dataset.d??0)/60;b.session?Y(e,s):(b.t=Math.max(0,Math.min(1439.99,s)),e.requestUpdate())},pbJump(t){Y(e,+(t.dataset.t??0))},pbLive(){return ee(e),!0}},render(){const t=e.d.cameras,s=t.find(m=>m.id===b.cam)??t[0];if(!e.recOk()||!s)return r`${e.head("הקלטות","")}${e.empty("film","אין מצלמות עם הקלטות","כשתחובר מצלמה, ההקלטות שלה יופיעו כאן.")}`;const a=ha(b.spans,b.t),i=_(b.events,e.phone?2:4,e.pg("pbE")),n=r`${dt(b.back)} <span class="num">${pt(b.t)}</span>`,o=m=>`${m/1440*100}%`,l=b.session&&b.play?r`<sw-live-player class="scene-pic" .wsUrl=${Cs(b.session)} mode="mse" .retry=${!1} fit="contain"></sw-live-player><div class="cap"><span class="clamp1">${s.name}</span><span class="rec-st">${n}</span></div>`:b.loading?r`<div class="cam-off">${p("film")}<span>טוענים את ההקלטות…</span></div>`:b.note?r`<div class="cam-off">${p("film")}<span>${b.note}</span></div>`:b.spans.length?a?r`<div class="cam-off">${p("play")}<span>ההקלטה מוכנה. לחצו על נגן.</span><small>${n}</small></div>`:r`<div class="cam-off">${p("film")}<span>אין הקלטה בשעה הזו</span><small>גררו את הסמן לאזור מסומן בציר</small></div>`:r`<div class="cam-off">${p("film")}<span>אין הקלטות למצלמה הזו ${b.back===0?"היום":"ביום הזה"}</span></div>`,h=r`<span class="cf-nav pb-days" role="group" aria-label="יום"><button class="rb" data-act="pbDay" data-d="1" aria-label="יום קודם">${p("back")}</button><b class="pbd clamp1">${dt(b.back)}</b><button class="rb" data-act="pbDay" data-d="-1" ?disabled=${b.back===0} aria-label="יום אחרי">${p("fwd")}</button></span>${t.length>1?r`<span class="cf-nav"><button class="rb" data-act="pbCam" data-d="-1" aria-label="המצלמה הקודמת">${p("back")}</button><button class="rb" data-act="pbCam" data-d="1" aria-label="המצלמה הבאה">${p("fwd")}</button></span>`:g}`,c=m=>{b.t=+m.target.value,e.requestUpdate()},d=m=>{const u=+m.target.value;b.session?Y(e,u):(b.t=u,e.requestUpdate())};return r`${e.head(e.phone?s.name:`הקלטות: ${s.name}`,e.phone?"בחרו יום וזמן.":"בחרו יום, ואז זמן על הציר או אירוע מהרשימה",h)}
      <div class="pb-body" data-home-playback=${s.id}><section class=${"tile pb-pic"+(b.play?"":" off")} aria-label="תמונה">${l}</section>
        <section class="tile pane pb-side" aria-label="מה קרה"><div class="bar"><h2>מה קרה כאן</h2>${e.pager("pbE",i.pages)}</div>${i.items.length?i.items.map(m=>r`<button class="mrow pb-ev" data-act="pbJump" data-t=${String(m.at)} aria-pressed=${String(Math.abs(m.at-b.t)<1)}>${p(m.icon)}<span class="clamp2">${m.text}</span><b class="num">${pt(m.at).slice(0,5)}</b></button>`):r`<p class="muted pb-none">לא נרשמו אירועים ליד המצלמה הזו ${b.back===0?"היום":"ביום הזה"}.</p>`}</section>
        <section class="tile pb-ctl" aria-label="ניגון"><span class="pb-btns"><button class="rb" data-act="pbSkip" data-d="-10" aria-label="10 שניות אחורה" ?disabled=${!b.spans.length}>${p("rew")}</button><button class="rb play" data-act="pbPlay" aria-pressed=${String(b.play)} aria-label=${b.play?"השהה":"נגן"} ?disabled=${!b.spans.length}>${p(b.play?"pause":"play")}</button><button class="rb" data-act="pbSkip" data-d="10" aria-label="10 שניות קדימה" ?disabled=${!b.spans.length}>${p("ffw")}</button></span>
          <div class="tl" dir="ltr"><div class="tl-track">${b.spans.map(([m,u])=>r`<i class="tl-seg" style=${`left:${o(m)};width:${o(u-m)}`}></i>`)}${b.events.map(m=>r`<i class="tl-ev" style=${`left:${o(m.at)}`}></i>`)}<i class="tl-head" style=${`left:${o(b.t)}`}></i></div><input type="range" min="0" max="1439" step="1" .value=${String(Math.round(b.t))} aria-label="זמן בהקלטה" ?disabled=${!b.spans.length} @input=${c} @change=${d}><div class="tl-ax">${[0,6,12,18,24].map(m=>r`<span class="num">${String(m%24).padStart(2,"0")}:00</span>`)}</div></div>
          <a class="hbtn" href=${e.href("cameras")} data-act="pbLive">${p("cam")}<span class="bt">חזרה לחי</span></a></section></div>`}}));const T={rows:[],tab:"all",loaded:!1,loading:!1,error:"",at:0},Tt=e=>S("events.read")||e.d.modules.has("doors")&&S("access.read");async function Lt(e,t=!1){if(T.loading||!t&&T.loaded&&Date.now()-T.at<6e4)return;T.loading=!0;const s=new Date(Date.now()-7*864e5).toISOString().replace(/\.\d{3}Z$/,"Z"),a=new Date(Date.now()+6e4).toISOString().replace(/\.\d{3}Z$/,"Z"),[i,n]=await Promise.all([S("events.read")?Gt({from:s,to:a,limit:200}).then(l=>l.events).catch(()=>null):Promise.resolve([]),e.d.modules.has("doors")&&S("access.read")?Ie(null,40).then(l=>l.calls).catch(()=>[]):Promise.resolve([])]),o=[];for(const l of i??[]){const h=_t(l.type,l.camera_name??null);h&&o.push({id:"e"+l.id,at:l.occurred_at,text:h.text,icon:h.icon,kind:h.kind,cam:l.camera_id})}for(const l of n)o.push({id:"c"+l.id,at:l.rang_at,text:`צלצול ב${l.station_name||"כניסה"}`,icon:"bell",kind:"door",cam:null});o.sort((l,h)=>Date.parse(h.at)-Date.parse(l.at)),T.rows=o,T.error=i===null&&!n.length?"לא הצלחנו לטעון את היומן. נסו שוב בעוד רגע.":"",T.loaded=!0,T.loading=!1,T.at=Date.now(),e.requestUpdate()}const Dt=()=>{const e=new Date().toLocaleDateString("he-IL",{timeZone:"Asia/Jerusalem"});return T.rows.filter(t=>new Date(t.at).toLocaleDateString("he-IL",{timeZone:"Asia/Jerusalem"})===e).length};ne({id:"events",order:20,href:"events",label:"יומן הבית",icon:"list",visible:e=>Tt(e),warm:e=>void Lt(e),line:()=>{if(!T.loaded)return{text:"מה קרה בבית"};const e=Dt();return{text:e===0?"שקט היום":e===1?"אירוע אחד היום":`${e} אירועים היום`}}});G(e=>({id:"diary",names:["events"],enter(){Lt(e,!0)},acts:{evTab(t){T.tab=t.dataset.v??"all",e.page={...e.page,ev:0},e.requestUpdate()},evWatch(t){e.go(St(t.dataset.cam??"",new Date(Date.parse(t.dataset.at??"")-5e3)))}},render(){if(!Tt(e))return r`${e.head("יומן הבית","")}${e.empty("lock","המסך הזה לא זמין","מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.")}`;const t=T.rows.filter(l=>T.tab==="all"||l.kind===T.tab),s=_(t,e.phone?5:8,e.pg("ev")),a=Dt(),i=e.recOk(),n=e.seg("evTab",[["all","הכל"],["door","דלתות"],["cam","מצלמות"]],T.tab,"סינון"),o=T.loaded?a?a===1?"אירוע אחד היום":`${a} אירועים היום`:"לא קרה שום דבר מיוחד היום":"";return r`${e.headT("יומן הבית",o,n,e.pager("ev",s.pages))}
      <div class="card-grid evg">${T.loaded?T.error?e.empty("list","היומן לא זמין כרגע",T.error):s.items.length?s.items.map(l=>r`<div class="tile evrow" data-diary=${l.kind}><span class="ai">${p(l.icon)}</span><span class="at"><b class="clamp2">${l.text}</b><span class="muted num-r">${je(l.at)}</span></span>${l.cam&&i?r`<button class="rb" data-act="evWatch" data-cam=${l.cam} data-at=${l.at} aria-label="צפה בהקלטה">${p("play")}</button>`:g}</div>`):e.empty("list","אין אירועים להצגה","כשמשהו יקרה בבית, דלת שנפתחה או תנועה במצלמה, הוא יופיע כאן."):r`<div class="empty loading" aria-busy="true">${p("list")}<h2>טוענים…</h2></div>`}</div>`}}));const x={tab:"calls",calls:[],callsLoaded:!1,guests:[],doors:[],guestsOn:!1,guestsLoaded:!1,people:[],peopleLoaded:!1,peopleError:"",draft:null,verifyCode:"",verifyError:"",verifySent:!1},Ot=e=>e.d.modules.has("doors")&&S("access.read"),ma=e=>!!e.pol()?.guests&&S("access.visitor.invite"),Pe=()=>S("access.people.read"),fa=e=>new Date(e).toLocaleDateString("he-IL",{timeZone:"Asia/Jerusalem"})===new Date().toLocaleDateString("he-IL",{timeZone:"Asia/Jerusalem"}),ua=()=>x.calls.filter(e=>e.outcome==="missed"&&fa(e.rang_at)).length,ga=e=>String((e+24)%24).padStart(2,"0")+":00",ye=e=>e?new Date(e).toLocaleString("he-IL",{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"}):"";async function Et(e){try{x.calls=(await Ie(null,40)).calls}catch{x.calls=[]}x.callsLoaded=!0,e.requestUpdate()}async function mt(e){if(!ma(e)){x.guestsOn=!1,x.guestsLoaded=!0;return}try{const[t,s]=await Promise.all([L("access/visitors?mine=true"),L("home/guest-doors")]);x.guests=t.visitors.filter(a=>a.own),x.doors=s.doors,x.guestsOn=!0}catch{x.guestsOn=!1}x.guestsLoaded=!0,e.requestUpdate()}async function ba(e){if(Pe()){try{x.people=(await L("intercom/people?limit=100&sort=name")).people?.records??[],x.peopleError=""}catch{x.people=[],x.peopleError="הרשימה לא זמינה כרגע."}x.peopleLoaded=!0,e.requestUpdate()}}function xa(){return[["calls","שיחות"],...x.guestsOn?[["guests","אורחים"]]:[],...Pe()?[["people","מי נכנס"]]:[]]}function va(e){const t=new Date,s=o=>{const h=new Date(t.getTime()+(e.day==="tom"?864e5:0)).toLocaleDateString("en-CA",{timeZone:"Asia/Jerusalem"}),c=Date.parse(`${h}T${String(o%24).padStart(2,"0")}:00:00Z`),d=u=>{const f=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Jerusalem",hour12:!1,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(u)),v=w=>Number(f.find(R=>R.type===w)?.value??0);return Date.UTC(v("year"),v("month")-1,v("day"),v("hour")%24,v("minute"),v("second"))-u};let m=c-d(c);return m=c-d(m),new Date(m+(o>=24?864e5:0))},a=s(e.from);let i=s(e.to<=e.from?e.to+24:e.to);i.getTime()<=Date.now()&&(i=new Date(Date.now()+36e5));const n=o=>o.toISOString().replace(/\.\d{3}Z$/,"Z");return{from:n(a.getTime()<Date.now()&&e.day==="today"?new Date:a),until:n(i)}}ne({id:"intercom",order:30,href:"intercom",label:"אינטרקום",icon:"phone",visible:e=>Ot(e),warm:e=>void Et(e),line:()=>{const e=ua();return x.callsLoaded?e?{text:e===1?"שיחה אחת לא נענתה":`${e} שיחות לא נענו`,tone:"warn",badge:e}:{text:"אין שיחות שלא נענו"}:{text:"שיחות ואורחים"}}});G(e=>{const t=(a,i={})=>({type:"ext",mod:"intercom",kind:a,...i}),s=a=>{x.draft&&(x.draft={...x.draft,...a},e.requestUpdate())};return{id:"intercom",names:["intercom"],enter(a,i){(i==="guests"||i==="people"||i==="calls")&&(x.tab=i),Et(e),mt(e),Pe()&&ba(e)},acts:{icTab(a){x.tab=a.dataset.v??"calls",history.replaceState(null,"","#/home/intercom/"+x.tab),e.requestUpdate()},icTalk(){e.a_talk()},guestNew(){x.draft={name:"",phone:"",door:x.doors[0]?`${x.doors[0].station_id}#${x.doors[0].relay}`:"",day:"today",from:Math.min(23,new Date().getHours()+1),to:Math.min(23,new Date().getHours()+4),busy:!1,error:""},e.ovl=t("guestNew")},guestDoor(a){s({door:a.dataset.v??""})},guestDay(a){s({day:a.dataset.v==="tom"?"tom":"today"})},guestStep(a){const i=x.draft;if(!i)return;const n=a.dataset.k==="to"?"to":"from";s({[n]:Math.max(0,Math.min(23,i[n]+ +(a.dataset.d??0)))})},guestSave(){const a=x.draft;if(!a||a.busy)return;const i=a.name.trim(),n=a.phone.replace(/[^\d+]/g,"");if(!i)return s({error:"כתבו את שם האורח."});if(n.replace(/\D/g,"").length<9)return s({error:"כתבו את מספר הטלפון של האורח. אליו יישלח הקוד."});const[o,l]=a.door.split("#");if(!o)return s({error:"בחרו דלת."});const h=va(a);s({busy:!0,error:""}),C("access/visitors",{visitor_name:i,phone:n,doors:{[o]:[+l]},valid_from:h.from,valid_until:h.until,purpose:"guest",client_request_id:se()}).then(c=>{x.draft=null,x.guests=[c.visitor,...x.guests.filter(d=>d.id!==c.visitor.id)],e.page={...e.page,gst:0},x.verifyCode="",x.verifyError="",x.verifySent=!1,e.ovl=t("guestShow",{id:c.visitor.id})}).catch(c=>s({busy:!1,error:c instanceof U&&c.status===403?"אין הרשאה להזמין אורח לדלת הזו.":M(c)}))},guestShow(a){x.verifyCode="",x.verifyError="",x.verifySent=!1,e.ovl=t("guestShow",{id:a.dataset.id})},guestVerifySend(a){C(`access/visitors/${encodeURIComponent(a.dataset.id??"")}/verify/send`).then(()=>{x.verifySent=!0,x.verifyError="",e.requestUpdate()}).catch(i=>{x.verifyError=M(i),e.requestUpdate()})},guestVerifyCheck(a){const i=a.dataset.id??"";x.verifyCode.trim()&&C(`access/visitors/${encodeURIComponent(i)}/verify/check`,{code:x.verifyCode.trim()}).then(n=>{x.guests=x.guests.map(o=>o.id===i?n.visitor:o),e.ovl=null,e.toast("המספר אומת. הקוד יישלח לטלפון של האורח בזמן שבחרתם.")}).catch(()=>{x.verifyError="הקוד לא נכון. בקשו מהאורח לבדוק שוב.",e.requestUpdate()})},guestDelAsk(a){const i=x.guests.find(n=>n.id===a.dataset.id);i&&(e.ovl={type:"ask",title:`לבטל את ההזמנה של ${i.visitor.name??"האורח"}?`,text:"הקוד יפסיק לעבוד מיד.",yes:"כן, בטל",run:()=>{Kt(`access/visitors/${encodeURIComponent(i.id)}`).then(()=>{mt(e),e.toast("ההזמנה בוטלה. הקוד כבר לא פותח את הדלת.")}).catch(n=>e.toast(M(n)))}})}},ovl(a){const i=r`<button class="rb" data-act="close" aria-label="סגור">${p("x")}</button>`,n=r`<div class="hscrim" data-act="close"></div>`;if(a.kind==="guestNew"&&x.draft){const o=x.draft,l=(h,c)=>r`<span class="stp" role="group" aria-label=${c}><button class="rb" data-act="guestStep" data-k=${h} data-d="-1" aria-label=${c+": פחות"}>${p("minus")}</button><b class="num">${ga(o[h])}</b><button class="rb" data-act="guestStep" data-k=${h} data-d="1" aria-label=${c+": יותר"}>${p("plus")}</button></span>`;return r`${n}<section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="הזמנת אורח" data-home-guest-new><header class="menu-h">${p("guest")}<span class="mh-t"><b>הזמנת אורח</b><span class="muted">האורח יקבל לטלפון קוד זמני לדלת</span></span>${i}</header>
          <div class="fld2"><label class="fld"><span>שם האורח</span><input class="inp" .value=${o.name} placeholder="למשל: דנה" enterkeyhint="next" maxlength="40" @input=${h=>{o.name=h.target.value}}></label>
          <label class="fld"><span>הטלפון של האורח</span><input class="inp num" type="tel" dir="ltr" inputmode="tel" autocomplete="off" .value=${o.phone} placeholder="05X-XXXXXXX" enterkeyhint="done" maxlength="20" @input=${h=>{o.phone=h.target.value}}></label></div>
          <div class="setrow flat"><span class="sname">איזו דלת</span><div class="chipset tight">${x.doors.slice(0,3).map(h=>{const c=`${h.station_id}#${h.relay}`;return r`<button class="chip2" data-act="guestDoor" data-v=${c} aria-pressed=${String(o.door===c)}><span class="clamp1">${h.name}</span></button>`})}</div></div>
          <div class="setrow flat"><span class="sname">מתי</span>${e.seg("guestDay",[["today","היום"],["tom","מחר"]],o.day,"מתי")}</div>
          <div class="setrow flat"><span class="sname">משעה</span>${l("from","משעה")}<span class="sname mid-l">עד שעה</span>${l("to","עד שעה")}</div>
          ${o.error?r`<p class="muted" data-tone="danger" style="color:var(--ct)" role="alert">${o.error}</p>`:g}
          <div class="dlg-acts"><button class="hbtn strong" data-act="guestSave" ?disabled=${o.busy||!x.doors.length}>צור הזמנה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`}if(a.kind==="guestShow"){const o=x.guests.find(d=>d.id===a.id);if(!o)return g;const l=ke(o),h=o.doors.map(d=>d.name).join(", "),c=l.live&&o.state!=="requested"&&!o.confirmed;return r`${n}<section class="sheet dialog v3 center" role="dialog" aria-modal="true" aria-label="ההזמנה של האורח" data-home-guest-show><span class="dlg-ic">${p("key")}</span><h2 class="clamp2">ההזמנה של ${o.visitor.name??"האורח"}</h2>
          <span class="dst" data-tone=${l.tone}><i class="dot"></i><span class="clamp1">${l.text}</span></span><p class="muted clamp2">${h} · <span class="num">${ye(o.valid_from)}</span> עד <span class="num">${ye(o.valid_until)}</span></p>
          ${c?r`<p class="muted">לפני שהקוד נשלח, מאמתים את הטלפון של האורח: שולחים לו קוד אימות, והוא מקריא לכם אותו.</p>
            ${x.verifySent?r`<label class="fld"><span>הקוד שהאורח קיבל</span><input class="inp num" dir="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="8" .value=${x.verifyCode} @input=${d=>{x.verifyCode=d.target.value.replace(/\D/g,"")}}></label>`:g}
            ${x.verifyError?r`<p class="muted" data-tone="danger" style="color:var(--ct)" role="alert">${x.verifyError}</p>`:g}
            <div class="dlg-acts">${x.verifySent?r`<button class="hbtn strong" data-act="guestVerifyCheck" data-id=${o.id}>אישור</button>`:r`<button class="hbtn strong" data-act="guestVerifySend" data-id=${o.id}>${p("phone")}שלח לאורח קוד אימות</button>`}<button class="hbtn" data-act="close">סגור</button></div>`:r`<p class="muted">${l.live?"הקוד לדלת נשלח לטלפון של האורח. רק הוא רואה אותו.":"ההזמנה הסתיימה."}</p><div class="dlg-acts"><button class="hbtn" data-act="close">סגור</button></div>`}</section>`}return g},render(a,i){if(!Ot(e))return r`${e.head("אינטרקום","")}${e.empty("lock","המסך הזה לא זמין","מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.")}`;const n=xa(),o=n.some(([d])=>d===x.tab)?x.tab:"calls",l=n.length>1?e.seg("icTab",n,o,"תצוגה"):g;if(o==="guests"){const d=x.guests.filter(u=>ke(u).live),m=_(d,e.phone?3:4,e.pg("gst"));return r`${e.headT("אורחים",d.length?"קוד זמני לדלת, לשעות שתבחרו":"נותנים לאורח קוד זמני לדלת",l,r`${e.pager("gst",m.pages)}<button class="hbtn strong" data-act="guestNew" ?disabled=${!x.doors.length}>${p("guest")}<span class="bt">הזמן אורח</span></button>`)}
          <div class="alert-list">${m.items.length?m.items.map(u=>{const f=ke(u);return r`<div class="tile arow grow" data-guest=${u.id}><span class="ai" data-tone=${f.tone} style="background:var(--cs);color:var(--ct)">${p("key")}</span><span class="at"><b class="clamp1">${u.visitor.name??"אורח"}</b><span class="muted clamp2 gw">${u.doors.map(v=>v.name).join(", ")} · <span class="num">${ye(u.valid_from)}</span></span><span class="dst" data-tone=${f.tone}><i class="dot"></i><span class="clamp1">${f.text}</span></span></span><span class="row-acts"><button class="hbtn" data-act="guestShow" data-id=${u.id}>${p("key")}<span class="bt">פרטים</span></button><button class="rb" data-act="guestDelAsk" data-id=${u.id} aria-label=${"בטל את ההזמנה של "+(u.visitor.name??"האורח")}>${p("del")}</button></span></div>`}):e.empty("guest",x.doors.length?"אין אורחים מוזמנים":"אין דלת שאפשר להזמין אליה",x.doors.length?"מזמינים אורח, בוחרים דלת ושעות, והוא מקבל קוד זמני לטלפון.":"מנהל הבית צריך לאפשר לך להזמין אורחים לדלת.")}</div>`}if(o==="people"){const d=_(x.people,e.phone?4:6,e.pg("ppl")),m=f=>f.active?f.valid_until?`עד ${new Date(f.valid_until).toLocaleDateString("he-IL",{day:"numeric",month:"numeric",timeZone:"Asia/Jerusalem"})}`:"קבוע":"לא פעיל",u=f=>{const v=f.stations.filter(w=>w.enabled).reduce((w,R)=>w+Math.max(1,R.doors.length),0);return v===0?"אין דלתות":v===1?"דלת אחת":`${v} דלתות`};return r`${e.headT("מי יכול להיכנס","בני הבית ואיזו דלת כל אחד יכול לפתוח",l,e.pager("ppl",d.pages))}
          <div class="card-grid pplg">${x.peopleLoaded?d.items.length?d.items.map(f=>r`<div class=${"tile prow"+(f.active?"":" away")}><span class="av">${(f.display_name||"?").slice(0,1)}</span><span class="at"><b class="clamp1">${f.display_name}</b><span class="muted clamp1">${m(f)}</span></span><span class="pk"><span class="muted">נכנס ב</span><b class="clamp2">${u(f)}</b></span></div>`):e.empty("people",x.peopleError?"הרשימה לא זמינה":"עוד אין אנשים ברשימה",x.peopleError||"מנהל הבית מוסיף אנשים וקודים בממשק המלא."):r`<div class="empty loading" aria-busy="true">${p("people")}<h2>טוענים…</h2></div>`}</div><p class="foot-note">${p("lock")}הוספת אנשים, קודים ותגים נעשית על ידי מנהל הבית, בממשק המלא.</p>`}const h=_(x.calls,e.phone?4:8,e.pg("calls")),c=x.calls.filter(d=>d.outcome==="missed").length;return r`${e.headT("אינטרקום",x.callsLoaded?x.calls.length?c?c===1?"שיחה אחת לא נענתה":`${c} שיחות לא נענו`:"כל השיחות נענו":"עוד לא היו שיחות":"",l,r`${e.pager("calls",h.pages)}${e.talkTo?r`<button class="hbtn" data-act="icTalk">${p("phone")}<span class="bt">דבר עם הכניסה</span></button>`:g}`)}
        <div class="card-grid callg">${h.items.length?h.items.map(d=>{const m=da(d);return r`<div class="tile crow" data-call=${d.id}><span class="vp vp-ic">${p("bell")}</span><span class="at"><b class="clamp1">צלצול</b><span class="muted clamp1">${d.station_name} · <span class="num-r">${je(d.rang_at)}</span></span><span class="dst" data-tone=${m.tone}><i class="dot"></i><span class="clamp1">${m.text}</span></span></span></div>`}):e.empty("phone","עוד לא היו שיחות","כשמישהו יצלצל בדלת, השיחה תופיע כאן.")}</div>`}}});const F={panel:"",pin:{set:!1,known:!1}},ue=e=>e.d.modules.has("security")&&S("alarm.view"),he=e=>e.panels.find(t=>t.entity_id===F.panel)??e.panels[0],wa={cur:["הקוד האישי הנוכחי","הקישו את הקוד שלכם היום"],panel:["קוד הלוח","לקוד אישי ראשון: הקישו את הקוד של לוח האזעקה"],new1:["קוד אישי חדש","בחרו קוד של 4 עד 8 ספרות"],new2:["שוב, לאישור","הקישו את הקוד החדש פעם נוספת"]};function de(e,t,s,a){e.ovl=null,bt(t.entity_id,s,{confirmed:!0,code:a}).then(()=>{e.toast(s==="disarm"?"האזעקה מנוטרלת":"האזעקה נדרכת"),window.setTimeout(()=>void e.loadPanels(),1500)}).catch(i=>e.toast(i instanceof U&&me[i.code]?me[i.code]:M(i)))}ne({id:"alarm",order:40,href:"security",label:"אזעקה",icon:"shield",visible:e=>ue(e)&&e.panels.length>0,warm:e=>{ue(e)&&!e.panels.length&&e.loadPanels()},line:e=>{const t=he(e),s=Mt(t?.state??null,t?.available??!1);return{text:s.text,tone:s.tone==="neutral"?void 0:s.tone}}});G(e=>{const t=(s,a={})=>({type:"ext",mod:"alarm",kind:"pin",mode:s,v:"",...a});return{id:"alarm",names:["security"],enter(){ue(e)&&e.loadPanels(),(S("alarm.arm")||S("alarm.disarm"))&&Qt().then(s=>{F.pin={set:s.pin_set,known:!0},e.requestUpdate()}).catch(()=>{})},acts:{almPanel(s){F.panel=s.dataset.v??"",e.requestUpdate()},almArm(s){const a=he(e),i=s.dataset.v??"arm_away";if(!a)return;const n=a.code.arm;if(n==="unverifiable"||n==="pin_missing")return e.toast(n==="pin_missing"?'צריך קוד אישי לאזעקה. בחרו "הקוד האישי שלי".':"אי אפשר לאמת קוד לפעולה הזו מכאן.");if(n==="pin"||n==="panel"){e.ovl={type:"code",title:ct[i]??"דריכה",code:"",error:"",run:l=>de(e,a,i,l)};return}const o=a.ready.open.length;e.ovl={type:"ask",title:i==="arm_home"?'לדרוך למצב "בבית"?':i==="arm_night"?"לדרוך ללילה?":"לדרוך את האזעקה?",text:o?`${o===1?"פתח אחד עדיין פתוח":o+" פתחים עדיין פתוחים"}. הם לא יהיו מוגנים.`:i==="arm_away"?"יש לכם זמן לצאת מהבית.":"הגלאים בתוך הבית לא יופעלו.",yes:"כן, דרוך",run:()=>de(e,a,i)}},almDisarm(){const s=he(e);if(!s)return;const a=s.code.disarm;if(a==="unverifiable"||a==="pin_missing")return e.toast(a==="pin_missing"?'צריך קוד אישי לאזעקה. בחרו "הקוד האישי שלי".':"אי אפשר לאמת קוד לפעולה הזו מכאן.");if(a==="pin"||a==="panel"){e.ovl={type:"code",title:"נטרול האזעקה",code:"",error:"",run:i=>de(e,s,"disarm",i)};return}e.ovl={type:"ask",title:"לנטרל את האזעקה?",text:s.name,yes:"כן, נטרל",run:()=>de(e,s,"disarm")}},almPin(){e.ovl=t(F.pin.set?"cur":"panel")},pinKey(s){const a=e.ovl;if(!a||a.kind!=="pin")return;const i=s.dataset.k??"",n=String(a.v??"");e.ovl={...a,err:"",v:i==="del"?n.slice(0,-1):n.length<8?n+i:n}},pinGo(){const s=e.ovl;if(!s||s.kind!=="pin")return;const a=String(s.v??""),i=s.mode;if(!(a.length<4)){if(i==="cur"){e.ovl=t("new1",{cur:a});return}if(i==="panel"){e.ovl=t("new1",{panel:a});return}if(i==="new1"){e.ovl=t("new2",{cur:s.cur,panel:s.panel,first:a});return}if(a!==s.first){e.ovl=t("new1",{cur:s.cur,panel:s.panel,err:"הקודים לא זהים. נסו שוב."});return}Jt(a,s.cur,s.panel).then(()=>{F.pin={set:!0,known:!0},e.ovl=null,e.toast("הקוד האישי הוחלף")}).catch(n=>{e.ovl=t(F.pin.set?"cur":"panel",{err:n instanceof U&&me[n.code]?me[n.code]:M(n)})})}}},ovl(s){if(s.kind!=="pin")return g;const a=s.mode,[i,n]=wa[a],o=String(s.v??"").length,l=["1","2","3","4","5","6","7","8","9","del","0","go"];return r`<div class="hscrim" data-act="close"></div><section class="sheet dialog v3 center pinsheet" role="dialog" aria-modal="true" aria-label=${i} data-home-pin=${a}><h2>${i}</h2><p class="muted">${s.err?r`<span data-tone="danger" style="color:var(--ct)" role="alert">${s.err}</span>`:n}</p>
        <div class="pin" aria-live="polite">${Array.from({length:Math.max(4,o)},(h,c)=>r`<i class=${c<o?"on":""}></i>`)}</div>
        <div class="keys" dir="ltr">${l.map(h=>h==="go"?r`<button class="rb play" data-act="pinGo" ?disabled=${o<4} aria-label="אישור">${p("check")}</button>`:h==="del"?r`<button class="rb" data-act="pinKey" data-k="del" aria-label="מחק">${p("back")}</button>`:r`<button class="rb num" data-act="pinKey" data-k=${h}>${h}</button>`)}</div>
        <button class="hbtn quiet" data-act="close">ביטול</button></section>`},render(){const s=he(e);if(!ue(e)||!s)return r`${e.head("אזעקה","")}${e.empty("shield","אין מערכת אזעקה מחוברת","כשתחובר מערכת אזעקה, אפשר יהיה לדרוך ולנטרל אותה מכאן.")}`;const a=Mt(s.state,s.available),i=!!s.state&&s.state!=="disarmed",n=s.ready.open,o=s.zones.slice().sort((u,f)=>+!u.open-+!f.open),l=_(o,e.phone?3:5,e.pg("alz")),h=["arm_away","arm_home","arm_night"].filter(u=>s.arm_modes.includes(u)),c=s.available?i?s.code.disarm==="pin"?"לנטרול צריך את הקוד האישי שלך.":"לנטרול לחצו על נטרול.":n.length?`${n.length===1?"פתח אחד פתוח":n.length+" פתחים פתוחים"}. כדאי לסגור לפני דריכה.`:"כל הפתחים סגורים.":"המערכת לא זמינה כרגע.",d=F.pin.known&&(S("alarm.arm")||S("alarm.disarm"))?r`<button class="hbtn" data-act="almPin" data-home-pin-change>${p("key")}<span class="bt">הקוד האישי שלי</span></button>`:g,m=e.panels.length>1?e.seg("almPanel",e.panels.slice(0,4).map(u=>[u.entity_id,u.name]),s.entity_id,"מערכת"):g;return r`${e.head("אזעקה",s.last_changed?`${s.name} · השתנתה ${new Date(s.last_changed).toLocaleString("he-IL",{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"})}`:s.name,r`${m}${d}`)}
        <div class="clim-body alm"><section class="tile pane alm-main" data-tone=${a.tone} aria-label=${s.name} data-home-alarm=${s.state??""}><span class="alm-ic">${p("shield")}</span><b class="alm-w">${a.text}</b><span class="muted">${c}</span>
          <div class="alm-acts">${i?r`<button class="hbtn strong xl" data-act="almDisarm" ?disabled=${!s.can.disarm||!s.available}>${p("unlock")}נטרול</button>`:h.map((u,f)=>r`<button class=${"hbtn xl"+(f===0?" strong":"")} data-act="almArm" data-v=${u} ?disabled=${!s.can.arm||!s.available}>${p(u==="arm_home"?"home":u==="arm_night"?"night":"lock")}${ct[u]}</button>`)}</div></section>
          <section class="tile pane" aria-label="פתחים"><div class="bar"><h2>דלתות, חלונות וגלאים</h2>${e.pager("alz",l.pages)}</div>${l.items.length?l.items.map(u=>{const f=Yt(u),v=f.tone==="ok"?"ok":f.tone==="fault"?"danger":f.tone==="bypassed"?"neutral":"warn";return r`<div class="sysr"><b class="clamp1">${u.name}</b><span class="dst" data-tone=${v}><i class="dot"></i><span class="clamp1">${f.label}</span></span></div>`}):r`<p class="muted">אין גלאים להצגה.</p>`}</section></div>`}}});G(e=>({id:"p3",names:[...bs],render:t=>e.p3.screen(t),back:t=>t==="bills"||t==="water"?"energy":"more",navCur:()=>"more"}));const $e=(e,t)=>e.p3.tiles().find(s=>s.id===t),ka=[["media","media","מוזיקה ומסכים","music"],["announce","media","כריזה בבית","horn"],["bills","bills","חשבון חשמל","bill"],["water","water","מים","drop"],["systems","systems","מערכות הבית","gen"],["map","map","מפת הבית","map"]];ka.forEach(([e,t,s,a],i)=>ne({id:"p3-"+e,order:100+i*10,href:t,label:s,icon:a,visible:n=>$e(n,e)!=null,act:n=>$e(n,e)?.act,line:n=>{const o=$e(n,e);return{text:o?.line??"",tone:o?.tone||void 0,badge:o?.badge||void 0}}}));const ft=()=>new Date(Date.now()+15e3).toISOString();function ya(e){const t=e.h;if(!e.has("media")||!e.media)return e.off("מוזיקה ומסכים");const s=e.icon,a=e.mList(),i=e.mCur(a),n=a.filter(D).length,o=t.kioskLocked(),l=()=>{const y=a.filter(I=>D(I));let O=0;for(const I of y){const Fe={command:"transport",action:"pause"};e.offered(I,Fe)&&(O++,e.cmd(I,Fe))}t.toast(O?B(O,"מכשיר אחד נעצר","מכשירים נעצרו"):"אין מה לעצור")},h=r`${o?g:t.scopeSeg()}${e.canAnnounce()?r`<button class="hbtn" data-p3-announce @click=${()=>e.openAnnounce()}>${s("horn")}<span class="bt">כריזה</span></button>`:g}<button class="hbtn" ?disabled=${!n} @click=${l}>${s("stop")}<span class="bt">עצור הכל</span></button>`,c=o?"ב"+(t.ctx()?.name??""):t.scopeWord();if(!i)return r`${t.head("מוזיקה ומסכים",c,h)}${e.empty("music","אין רמקולים או מסכים "+c,t.ctx()&&!o?'בחרו "כל הבית" כדי לראות את שאר המכשירים.':"כשיחוברו רמקול או טלוויזיה, אפשר יהיה לשלוט בהם מכאן.")}`;e.loadPicks(i);const d=Ze(i.kind)==="tv",m=i.live.power==="on",{title:u,by:f}=Se(i.live.now),v=m?xs(i.live.now):null,w=i.live.volume?.level??0,R=e.offered(i,{command:"volume_set",level:w}),E=e.playCmd(i),N={command:"transport",action:"previous"},oe={command:"transport",action:"next"},Ae=e.paged("p3media",a,t.phone?2:4),Ce=i.area_name??"",Ue=t.phone?3:4,qe=d||i.kind==="receiver"?(e.sources[i.key]??[]).slice(0,Ue):[],It=qe.length?[]:(e.library[i.key]??[]).slice(0,Ue),jt=i.live.now?.source_id??null,Pt=d&&(i.caps.keys??[]).length>0&&!!i.can?.control,At=!d&&es(i)&&Me(i,e.media).length>0;return r`${t.head(n?B(n,"מכשיר אחד מנגן","מכשירים מנגנים"):"הכל שקט",c,h)}
    <div class="md-body" data-p3-media>
      <section class=${"tile md-now"+(m?" is-on":"")} aria-label=${i.name}>
        <span class="art" aria-hidden="true">${s(d?"tv":"music")}</span>
        <div class="md-t"><span class="muted clamp1">${i.name}${Ce?" · "+Ce:""}</span><b class="clamp2" data-p3-now>${m?u||(D(i)?"מתנגן":"דולק"):"כבוי"}</b><span class="muted clamp1">${m?f||" ":"בחרו מה לנגן"}</span></div>
        ${v!=null?r`<div class="md-prog" dir="ltr" aria-hidden="true"><i style=${`transform:scaleX(${v})`}></i></div>`:r`<div class="md-prog none" aria-hidden="true"></div>`}
        <div class="md-ctl" dir="ltr">
          <button class="rb" aria-label="הקודם" ?disabled=${!e.offered(i,N)} @click=${()=>void e.cmd(i,N)}>${s("prev")}</button>
          <button class="rb xl play" data-p3-play aria-pressed=${String(D(i))} aria-label=${D(i)?"השהה":"נגן"} ?disabled=${!E} @click=${()=>E&&void e.cmd(i,E)}>${s(D(i)?"pause":"play")}</button>
          <button class="rb" aria-label="הבא" ?disabled=${!e.offered(i,oe)} @click=${()=>void e.cmd(i,oe)}>${s("next")}</button>
        </div>
        <label class="volr"><span class="vi">${s("vol")}</span><input type="range" min="0" max="100" .value=${String(w)} style=${`--v:${w}%`} ?disabled=${!R} aria-label="עוצמה" data-p3-vol
          @input=${y=>{const O=y.target;O.style.setProperty("--v",O.value+"%");const I=O.parentElement?.querySelector(".vv");I&&(I.textContent=O.value),e.setVolume(i,+O.value)}}><span class="num vv">${w}</span></label>
        <div class="md-src">
          ${qe.map(y=>r`<button class="chip2" aria-pressed=${String(jt===y.id)} ?disabled=${!e.offered(i,{command:"source",source_id:y.id})} @click=${()=>void e.cmd(i,{command:"source",source_id:y.id},y.label)}>${y.label}</button>`)}
          ${It.map(y=>r`<button class="chip2" ?disabled=${!e.offered(i,{command:"play_item",item_ref:y.item_ref})} @click=${()=>void e.cmd(i,{command:"play_item",item_ref:y.item_ref},y.name)}>${y.name}</button>`)}
          ${Pt?r`<button class="chip2" data-p3-remote @click=${()=>{t.ovl={type:"p3",sheet:"remote",id:i.key},t.requestUpdate()}}>${s("grid")}שלט</button>`:g}
          ${At?r`<button class="chip2" data-p3-group @click=${()=>{e.draft={grp:Me(i,e.media??[]).filter(y=>y.live.group?.leader_key===i.key).map(y=>y.key)},t.ovl={type:"p3",sheet:"group",id:i.key},t.requestUpdate()}}>${s("plus")}עוד חדרים</button>`:g}
        </div>
      </section>
      <section class="md-list" aria-label="מכשירים">${Ae.items.map(y=>{const O=e.playCmd(y),I=Se(y.live.now).title;return r`<div class=${"tile mrow2"+(y.key===i.key?" cur":"")+(D(y)?" is-on":"")} data-p3-dev=${y.key}><button class="cover" aria-label=${y.name} aria-pressed=${String(y.key===i.key)} @click=${()=>{e.mp=y.key,t.requestUpdate()}}></button><span class="ai">${s(Ze(y.kind)==="tv"?"tv":"music")}</span><span class="at"><b class="clamp1">${y.name}</b><span class="muted clamp1">${y.live.power==="on"?I||(D(y)?"מתנגן":"דולק"):y.live.power==="unavailable"?"לא זמין כרגע":"כבוי"}</span></span><button class="rb" ?disabled=${!O} aria-pressed=${String(D(y))} aria-label=${(D(y)?"השהה":"נגן")+": "+y.name} @click=${()=>O&&void e.cmd(y,O)}>${s(D(y)?"pause":"play")}</button></div>`})}${t.pager("p3media",Ae.pages)}</section>
    </div>`}function $a(e,t){const s=e.h,a=e.media?.find(c=>c.key===t);if(!a)return g;const i=e.icon,n=()=>{s.ovl=null,s.requestUpdate()},o=(c,d,m,u=!1)=>{const f={command:"key",key:c};return r`<button class=${"rb"+(u?" xl":"")} aria-label=${m} data-p3-key=${c} ?disabled=${!e.offered(a,f)} @click=${()=>void e.cmd(a,f)}>${u?"אישור":i(d)}</button>`},l=(c,d,m)=>{const u=e.offered(a,{command:"volume_step",direction:c})?{command:"volume_step",direction:c}:{command:"key",key:c==="up"?"volup":"voldown"};return r`<button class="rb" aria-label=${m} ?disabled=${!e.offered(a,u)} @click=${()=>void e.cmd(a,u)}>${i(d)}</button>`},h=a.live.power==="on"?{command:"power_off"}:{command:"power_on"};return r`<div class="hscrim" @click=${n}></div><section class="sheet dialog v3 remote" role="dialog" aria-modal="true" aria-label=${"שלט: "+a.name} data-p3-sheet="remote">
    <header class="menu-h">${i("tv")}<span class="mh-t"><b class="clamp1">${a.name}</b><span class="muted">שלט</span></span><button class="rb" aria-label="סגור" @click=${n}>${i("x")}</button></header>
    <div class="rm" dir="ltr">
      <div class="rm-col"><span class="muted">עוצמה</span>${l("up","plus","הגבר")}${l("down","minus","הנמך")}</div>
      <div class="dpad"><span></span>${o("up","up","למעלה")}<span></span>${o("left","back","שמאלה")}${o("ok","","אישור",!0)}${o("right","fwd","ימינה")}<span></span>${o("down","down","למטה")}<span></span></div>
      <div class="rm-col"><span class="muted">ערוץ</span>${o("chup","up","ערוץ הבא")}${o("chdown","down","ערוץ קודם")}</div>
    </div>
    <div class="dlg-acts three">
      <button class="hbtn" ?disabled=${!e.offered(a,{command:"key",key:"back"})} @click=${()=>void e.cmd(a,{command:"key",key:"back"})}>חזרה</button>
      <button class="hbtn" ?disabled=${!e.offered(a,{command:"key",key:"home"})} @click=${()=>void e.cmd(a,{command:"key",key:"home"})}>${i("home")}בית</button>
      <button class="hbtn" data-p3-power ?disabled=${!e.offered(a,h)} @click=${()=>void e.cmd(a,h)}>${i("power")}${a.live.power==="on"?"כבה":"הדלק"}</button>
    </div></section>`}function za(e,t){const s=e.h,a=e.media?.find(m=>m.key===t);if(!a)return g;const i=e.icon,n=Me(a,e.media??[]),o=e.paged("p3grp",n,s.phone?4:5),l=e.draft.grp??[],h=()=>{s.ovl=null,s.requestUpdate()},c=n.filter(m=>m.live.group?.leader_key===a.key).map(m=>m.key),d=(m=!1)=>void Rt(e,a,c,l,m);return r`<div class="hscrim" @click=${h}></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="נגן גם בחדרים אחרים" data-p3-sheet="group">
    <header class="menu-h">${i("music")}<span class="mh-t"><b>לנגן גם ב...</b><span class="muted clamp1">${Se(a.live.now).title||a.name}</span></span><button class="rb" aria-label="סגור" @click=${h}>${i("x")}</button></header>
    <div class="grp-list">${o.items.map(m=>{const u=l.includes(m.key);return r`<div class="setrow flat"><span class="sname"><b class="clamp1">${m.area_name||m.name}</b><span class="muted clamp1">${m.name}</span></span><button class="hsw" role="switch" aria-checked=${String(u)} aria-label=${m.area_name||m.name} data-p3-grp=${m.key} @click=${()=>{e.draft={...e.draft,grp:u?l.filter(f=>f!==m.key):[...l,m.key]},s.requestUpdate()}}><i></i></button></div>`})}${n.length?g:r`<p class="muted">אין עוד רמקולים שאפשר לצרף.</p>`}</div>${s.pager("p3grp",o.pages)}
    <div class="dlg-acts"><button class="hbtn strong" data-p3-grp-save @click=${()=>d()}>אישור</button><button class="hbtn" @click=${h}>ביטול</button></div></section>`}async function Rt(e,t,s,a,i){const n=e.h,o=ts(s,a,t.key);n.ovl=null,n.requestUpdate();try{o.join.length&&await C("multimedia/groups/join",{leader_key:t.key,member_keys:o.join,confirmed:i,client_request_id:se(),expires_at:ft()}),o.leave.length&&await C("multimedia/groups/leave",{device_keys:o.leave,client_request_id:se(),expires_at:ft()}),n.toast(a.length?B(a.length+1,"מתנגן בחדר אחד","חדרים מנגנים יחד"):"מתנגן רק כאן"),window.setTimeout(()=>void e.loadMedia(!1),1500)}catch(l){if(!i&&l instanceof U&&l.code==="confirm_required"){n.ovl={type:"ask",title:`לנגן ב-${a.length+1} חדרים?`,text:"המוזיקה תתנגן יחד בכל החדרים שבחרתם.",yes:"כן, נגן",run:()=>void Rt(e,t,s,a,!0)},n.requestUpdate();return}n.toast(M(l))}}function _a(e){const t=e.h,s=e.ann;if(!s)return r``;const a=e.icon,i=t.ctx(),n=!!i&&s.areas.some(w=>w.area_id===i.id),o=t.kioskLocked(),l=e.draft,h=o||l.where==="room"&&n?"room":"house",c=s.templates.find(w=>w.id===l.msg)??null,d=(c?c.text.he:l.text??"").trim(),m=()=>{t.ovl=null,t.requestUpdate()},u=w=>{e.draft={...l,...w},t.requestUpdate()},f=e.paged("p3ann",s.templates,t.phone?4:6),v=async()=>{if(d){m();try{const w=await C("announcements",{scope:h==="room"?"area":"all",ref:h==="room"&&i?i.id:"*",text:d.slice(0,s.max),language:"he",...c?{template_id:c.id}:{}});t.toast(w?.status==="queued"?"ההודעה תושמע כשיסתיימו השעות השקטות":h==="room"&&i?`ההודעה הושמעה ב${i.name}`:"ההודעה הושמעה בכל הבית")}catch(w){t.toast(M(w))}}};return r`<div class="hscrim" @click=${m}></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="כריזה בבית" data-p3-sheet="announce">
    <header class="menu-h">${a("horn")}<span class="mh-t"><b>כריזה בבית</b><span class="muted">הודעה קולית ברמקולים</span></span><button class="rb" aria-label="סגור" @click=${m}>${a("x")}</button></header>
    ${s.templates.length?r`<div class="chipset" role="radiogroup" aria-label="הודעה מוכנה">${f.items.map(w=>r`<button class="chip2" role="radio" aria-checked=${String(l.msg===w.id)} aria-pressed=${String(l.msg===w.id)} data-p3-tpl=${w.id} @click=${()=>u({msg:l.msg===w.id?null:w.id})}>${w.name.he||w.id}</button>`)}${t.pager("p3ann",f.pages)}</div>`:""}
    <label class="fld">${s.templates.length?"או כתבו הודעה משלכם":"מה להכריז?"}<input class="inp" type="text" maxlength=${s.max} .value=${c?"":l.text??""} placeholder="למשל: ארוחת ערב מוכנה" ?disabled=${!!c} data-p3-ann-text @input=${w=>{e.draft={...e.draft,text:w.target.value,msg:null},t.requestUpdate()}}></label>
    ${o?r`<p class="muted">ההודעה תושמע ב${i?.name??"חדר הזה"}.</p>`:r`<div class="setrow flat"><span class="sname">איפה</span>${e.seg([...n&&i?[["room",i.name]]:[],["house","כל הבית"]],h,"איפה",w=>u({where:w}))}</div>`}
    <div class="dlg-acts"><button class="hbtn strong" data-p3-ann-send ?disabled=${!d} @click=${()=>void v()}>${a("horn")}הכרז</button><button class="hbtn" @click=${m}>ביטול</button></div></section>`}const ze=e=>r`<span class="num">${ae(e)}</span><span class="cur"> ₪</span>`;function Ma(e){const t=e.h,s=e.bill;if(!e.has("bills")||!s)return e.off("חשבון חשמל");const a=e.icon,i=r`<a class="hbtn" href=${t.href("energy")}>${a("bolt")}<span class="bt">צריכה</span></a>`,n=s.accounts.length>1&&s.accounts.length<=3?e.seg(s.accounts.map(u=>[u.id,u.name]),s.acc??"","חשבון",u=>void e.loadBill(u)):g;if(s.loading&&!s.status)return r`${t.head("חשבון חשמל","",r`${n}${i}`)}<div class="empty loading" aria-busy="true">${a("bill")}<h2>טוענים את החשבון…</h2></div>`;const o=Q(s.status?.amount_so_far),l=s.status?.period??null,h=s.periods.filter(u=>u.bill&&u.bill.state!=="void"&&u.bill.state!=="draft"&&Q(u.bill.total)!=null);if(s.error||o==null&&!h.length)return r`${t.head("חשבון חשמל","",r`${n}${i}`)}${e.empty("bill","עוד אין חשבון","אחרי החודש הראשון נראה כאן כמה שילמתם וכמה צפוי.")}`;const c=vs(o,l?.from,l?.to),d=h.length?Q(h[0].bill?.total):null,m=e.paged("p3bill",h,t.phone?2:4);return r`${t.head("חשבון חשמל",l?Xe(l.from,l.to):"",r`${n}${i}`)}
    <div class="en-body" data-p3-bills>
      <section class="tile pane bill-now" aria-label="החודש הזה"><h2>עד עכשיו בתקופה הזו</h2><b class="huge fit" data-p3-sofar>${o!=null?ze(o):"—"}</b>
        ${c?r`<div class="mprog" aria-hidden="true"><i style=${`transform:scaleX(${c.day/c.of})`}></i></div><span class="muted">יום <span class="num">${c.day}</span> מתוך <span class="num">${c.of}</span></span>`:g}
        ${c?.forecast!=null?r`<div class="bill-fc"><span class="muted">צפי לסוף התקופה</span><b class="mid" data-p3-forecast>בערך ${ze(c.forecast)}</b><span class="muted">${ws(c.forecast,d)}</span></div>`:g}</section>
      <section class="tile pane" aria-label="חשבונות קודמים"><div class="bar"><h2>חשבונות קודמים</h2>${t.pager("p3bill",m.pages)}</div>
        ${m.items.map(u=>{const f=ks[u.bill?.state??""]??["","neutral"],v=u.bill?.due_date&&f[1]==="warn"?` עד ${u.bill.due_date.slice(8,10)}.${+u.bill.due_date.slice(5,7)}`:"";return r`<div class="vrow blr"><span class="at"><b class="clamp1">${Xe(u.from,u.to)}</b>${f[0]?e.pill(f[1],f[0]+v):g}</span><b class="mid">${ze(Q(u.bill?.total)??0)}</b></div>`})}${h.length?g:r`<p class="muted">עוד אין חשבונות קודמים.</p>`}</section>
    </div>`}function Sa(e){const t=e.h,s=e.water;if(!e.has("water")||!s)return e.off("מים");const a=e.icon,i=r`<a class="hbtn" href=${t.href("energy")}>${a("bolt")}<span class="bt">חשמל</span></a>`,n=ys(s.week);if(s.today==null&&!n.some(c=>c[1]!=null))return r`${t.head("מים","",i)}${e.empty("drop","עוד אין נתוני מים","אחרי יום שימוש ראשון נראה כאן כמה מים הבית צורך.")}`;const o=s.today??n[n.length-1][1]??0;n[n.length-1][1]=o;const l=$s(n),h=Math.max(...n.map(c=>c[1]??0),1);return r`${t.head(r`היום: <span class="num">${ae(o)}</span> ליטר`,l==null||l===0?"כמו ביום רגיל":r`<span class="num">${Math.abs(l)}%</span> ${l<0?"פחות":"יותר"} מיום רגיל`,i)}
    <div class="en-body" data-p3-water>
      <section class="tile pane" aria-label="השבוע"><h2>השבוע, ליטר ליום</h2>
        <div class="wbars" dir="rtl">${n.map(([c,d])=>r`<div class=${"wb"+(d==null?" future":"")}><span class="wv num">${d==null?"":ae(d)}</span><i style=${`height:${d==null?0:Math.max(3,d/h*100)}%`}></i><span class="wbl">${c}</span></div>`)}</div></section>
      <section class="tile pane leak" data-tone=${s.leaks?"warn":"ok"} aria-label="נזילות" data-p3-leak=${s.leaks?"yes":"no"}><span class="dlg-ic">${a("drop")}</span><h2>${s.leaks?"חשד לנזילה":"לא זוהתה נזילה"}</h2>
        <p class="muted">${s.leaks?"המים זורמים ברצף כבר זמן רב, גם כשאף אחד לא משתמש. כדאי לבדוק ברזים ואסלות.":"אנחנו בודקים כל הזמן אם מים זורמים כשלא אמורים."}</p>
        ${s.month!=null?r`<span class="muted">החודש: <span class="num">${(s.month/1e3).toFixed(1)}</span> מ״ק</span>`:g}</section>
    </div>`}function Ta(e){const t=e.h,s=e.sys;if(!e.has("systems"))return e.off("מערכות הבית");if(!s)return r`${t.head("מערכות הבית","")}${e.empty("gen","אין מערכות להצגה","גנרטור, מעליות ומדי טמפרטורה יופיעו כאן כשיחוברו.")}`;const a=e.icon,i=e.sysBad(),n=[],o=s.gen;if(o){const[l,h,c]=Ge[o.supply]??Ge.unknown;n.push(r`<section class="tile pane sys" data-tone=${c} data-p3-sys="power"><span class="sys-k">${a("bolt")}חשמל</span><b class="mid clamp2">${l}</b>${e.pill(c,h)}</section>`);const d=o.loudest;if(d){const[m,u]=Ke[d.state]??Ke.unknown,f=d.fuel;n.push(r`<section class="tile pane sys" data-tone=${u} data-p3-sys="generator"><span class="sys-k">${a("gen")}${o.total>1?d.name:"גנרטור"}</span><b class="mid">${m}</b>
        ${f!=null?r`<div class=${"mprog"+(f<20?" low":"")} aria-hidden="true"><i style=${`transform:scaleX(${Math.max(0,Math.min(100,f))/100})`}></i></div><span class="muted clamp2">דלק <span class="num">${Math.round(f)}%</span>${o.total>1?r` · ${B(o.total,"גנרטור אחד","גנרטורים")}`:g}</span>`:g}</section>`)}}if(s.elev.length){const l=e.paged("p3sysE",s.elev,t.phone?1:2);n.push(r`<section class="tile pane sys" data-p3-sys="lifts"><div class="bar"><span class="sys-k">${a("lift")}מעליות</span>${t.pager("p3sysE",l.pages)}</div>${l.items.map(h=>{const[c,d]=Ye[ss(h)]??Ye.unknown;return r`<div class="sysr"><b class="clamp1">${h.name}</b>${e.pill(d,c)}</div>`})}</section>`)}if(s.temps.length){const l=e.paged("p3sysT",s.temps,t.phone?1:3);n.push(r`<section class="tile pane sys" data-p3-sys="temps"><div class="bar"><span class="sys-k">${a("thermo")}טמפרטורות</span>${t.pager("p3sysT",l.pages)}</div>${l.items.map(h=>{const c=h.value??h.value_last,d=xt.has(h.status);return r`<div class="sysr one"><b class="clamp1">${h.name}</b><span class="st" data-tone=${h.stale||h.status==="offline"||h.status==="unknown"?"neutral":d?"ok":"warn"}><i class="dot"></i><b class="num">${c==null?"—":Math.round(c)+"°"}</b></span></div>`})}</section>`)}return r`${t.head("מערכות הבית",i?B(i,"דבר אחד דורש תשומת לב","דברים דורשים תשומת לב"):"הכל תקין")}
    <div class=${"sys-grid n"+n.length} data-p3-systems>${n}</div><p class="foot-note">${a("lock")}המסך הזה לצפייה בלבד. הפעלה והגדרות נעשות בממשק המלא.</p>`}function La(e){const t=e.h;if(!e.mapOn())return e.off("מפת הבית");const s=e.icon,a=t.visRooms(),i=t.d.floors.filter(d=>a.some(m=>m.floor===d.id));if(!i.length)return r`${t.head("מפת הבית","")}${e.empty("map","עוד אין מפה","כשיהיו חדרים בבית, הם יופיעו כאן לפי קומות.")}`;const n=i.find(d=>d.id===e.mapFloor)??i[0],o=a.filter(d=>d.floor===n.id),l=zs(o.map(d=>({id:d.id,weight:d.lights.length+d.loads.length+d.zones.length+d.shades.length+d.doors.length+d.cams.length})),t.phone?.55:1.9),h=new Map(o.map(d=>[d.id,d])),c=i.length>1?e.seg(i.map(d=>[d.id,d.short||d.name]),n.id,"קומה",d=>{e.mapFloor=d,t.requestUpdate()}):g;return r`${t.head("מפת הבית",r`${n.name} · ${H(A(o))}`,c)}
    <div class="plan-wrap" data-p3-map=${n.id}><div class="plan"><div class="plan-in" dir="ltr" role="group" aria-label=${"תוכנית "+n.name}>${l.map(d=>{const m=h.get(d.id);if(!m)return g;const u=m.lights.some(v=>v.on),f=m.cams.length>0?t.d.cameras.find(v=>m.cams.includes(v.id)):void 0;return r`<a class=${"pr"+(u?" lit":"")} href=${t.href("r/"+m.id)} data-p3-room=${m.id} dir="rtl" style=${`left:calc(${d.x}% + 4px);top:calc(${d.y}% + 4px);width:calc(${d.w}% - 8px);height:calc(${d.h}% - 8px)`} aria-label=${`${m.name}, ${u?"אור דולק":"חשוך"}`}><b class="clamp2">${m.name}</b><span class="pm">${m.temp!=null?r`<span class="num">${Math.round(m.temp)}°</span>`:g}${u?s("bulb","lit"):g}${f?s(f.ok?"cam":"camoff"):g}</span></a>`})}</div></div></div>
    <div class="bar plan-leg"><span class="legend"><span><i class="k lit"></i>אור דולק</span><span><i class="k dark"></i>חשוך</span></span><span class="muted">נגיעה בחדר פותחת אותו</span></div>`}const q=encodeURIComponent,Da="screen,speaker,player,receiver,group",Oa=()=>new Date(Date.now()+15e3).toISOString();class Ea{constructor(t){this.h=t,this.media=null,this.mp=null,this.sources={},this.library={},this.ann=null,this.bill=null,this.water=null,this.sys=null,this.mapFloor=null,this.loaded=!1,this.draft={},this.volT=0,this.pollT=0,this.refreshT=0,this.icon=p}has(t){return this.h.d.modules.has(t)}up(){this.h.requestUpdate()}async load(){const t=[];this.has("media")&&t.push(this.loadMedia(!0)),this.has("announce")&&S("media.announce")&&t.push(this.loadAnnounce()),this.has("bills")&&S("energy.bills")&&t.push(this.loadBillAccounts()),this.has("water")&&t.push(this.loadWater()),this.has("systems")&&t.push(this.loadSystems()),await Promise.all(t.map(s=>s.catch(()=>{}))),this.loaded=!0,window.clearInterval(this.pollT),this.pollT=window.setInterval(()=>{if(!this.h.isConnected){window.clearInterval(this.pollT);return}const s=this.h.route().name;s==="media"&&this.media&&this.loadMedia(!1),s==="systems"&&this.sys&&this.loadSystems()},12e3),this.up()}async loadMedia(t){try{if(t){const a=await L("multimedia/status");if(!a.enabled||!a.can?.read){this.media=null;return}}const s=await L(`multimedia/devices?kind=${Da}`);this.media=s.devices.filter(a=>a.live&&a.caps)}catch{t&&(this.media=null)}finally{this.up()}}async loadAnnounce(){try{const t=await L("announcements/areas");this.ann=t.enabled&&t.areas.length?{areas:t.areas,templates:(t.templates??[]).filter(s=>s.kind!=="emergency"&&s.text?.he),max:t.max_text||400}:null}catch{this.ann=null}}async loadBillAccounts(){try{const s=(await L("energy/accounts")).items.filter(a=>a.status!=="paused");this.bill=s.length?{accounts:s,acc:s[0].id,status:null,periods:[],loading:!0,error:""}:null,this.bill&&await this.loadBill(this.bill.acc)}catch{this.bill=null}}async loadBill(t){if(this.bill){this.bill={...this.bill,acc:t,loading:!0,error:""},this.up();try{const[s,a]=await Promise.all([L(`energy/accounts/${q(t)}/status`),L(`energy/accounts/${q(t)}/periods?past=6&future=0`)]);this.bill={...this.bill,status:s,periods:a.periods.slice().reverse(),loading:!1}}catch(s){this.bill={...this.bill,status:null,periods:[],loading:!1,error:M(s)}}this.up()}}async loadWater(){try{const t=await L("infra/water/status");if(!t.enabled||!t.can_view||!t.meters){this.water=null;return}const s=new Date,a=new Date(s.getFullYear(),s.getMonth(),s.getDate()-6),[i,n,o]=await Promise.all([L("infra/water/meters"),L("infra/water/events/summary").catch(()=>({open_leaks:0})),L(`infra/water/consumption?from=${q(a.toISOString())}&to=${q(s.toISOString())}&bucket=1d`).catch(()=>({series:void 0}))]),l=i.items.filter(c=>c.status!=="retired"),h=c=>l.some(d=>d[c]!=null)?l.reduce((d,m)=>d+(m[c]??0),0):null;this.water={today:h("today_l"),month:h("month_l"),leaks:n.open_leaks??0,week:o.series??null,meters:l.length}}catch{this.water=null}}async loadSystems(){const[t,s,a]=await Promise.all([S("generator.view")?as().then(n=>is(n.devices)).catch(()=>null):Promise.resolve(null),ns().then(n=>n.elevators).catch(()=>[]),os(!1).then(n=>n.units).catch(()=>[])]),i=t&&t.total?t:null;this.sys=i||s.length||a.length?{gen:i,elev:s,temps:a}:null,this.up()}mList(){const t=this.media??[],s=this.h.ctx();return s&&(this.h.kioskLocked()||this.h.scope==="room")?t.filter(a=>a.area_id===s.id):s&&this.h.scope==="floor"?t.filter(a=>a.floor_id===s.floor):t}mCur(t){return t.find(s=>s.key===this.mp)??t.find(s=>D(s))??t[0]??null}offered(t,s){const a=t.live;if(!a||rs(a)||a.caps_known===!1)return!1;const i=t.caps,n=t.can??{control:!1,power:!1,public_ok:!0};if((s.command==="power_on"||s.command==="power_off"||s.command==="source"?!n.power:!n.control)||!n.public_ok&&ls(s))return!1;if(s.command==="power_on")return!!i.power_on&&a.power!=="on";if(s.command==="power_off")return!!i.power_off&&be(a);if(!be(a))return!1;switch(s.command){case"volume_set":return!!i.volume_set;case"volume_step":return!!i.volume_step;case"source":return!!i.sources;case"key":return(i.keys??[]).includes(s.key);case"play_item":return!!(i.favourites||i.stations||i.playlists);case"transport":{const l=i.transport??{play:!1,pause:!1,next:!1,previous:!1,stop:!1,seek:!1};return s.action==="play_pause"?l.play||l.pause:!!l[s.action]}default:return!1}}async cmd(t,s,a=""){try{return await C(`multimedia/devices/${q(t.key)}/commands`,{...s,client_request_id:se(),expires_at:Oa()}),a&&this.h.toast(a),window.clearTimeout(this.refreshT),this.refreshT=window.setTimeout(()=>void this.loadMedia(!1),1200),!0}catch(i){return this.h.toast(cs(i)),!1}}playCmd(t){if(t.live&&!be(t.live))return this.offered(t,{command:"power_on"})?{command:"power_on"}:null;const s={command:"transport",action:D(t)?"pause":"play"};if(this.offered(t,s))return s;const a={command:"transport",action:"play_pause"};return this.offered(t,a)?a:null}async loadPicks(t){const s=t.key;if(t.kind==="screen"||t.kind==="receiver"){if(this.sources[s])return;this.sources[s]=[];try{const a=await L(`multimedia/devices/${q(s)}`);this.sources[s]=(a.sources??[]).filter(i=>!i.hidden)}catch{this.sources[s]=[]}}else if(t.caps.favourites){if(this.library[s])return;this.library[s]=[];try{const a=await L(`multimedia/devices/${q(s)}/library?kind=favourites`);this.library[s]=a.items.filter(i=>!i.hidden)}catch{this.library[s]=[]}}this.up()}setVolume(t,s){t.live?.volume&&(t.live.volume.level=s),window.clearTimeout(this.volT),this.volT=window.setTimeout(()=>void this.cmd(t,{command:"volume_set",level:s}),280)}screen(t){return _s(t)?this.h.kioskLocked()&&t!=="media"?this.h.sRoom():{media:ya,bills:Ma,water:Sa,systems:Ta,map:La}[t](this):null}ovl(t){return t.sheet==="remote"?$a(this,t.id??""):t.sheet==="group"?za(this,t.id??""):_a(this)}roomChips(t){if(!t||!this.has("media")||!this.media)return[];const s=this.media.filter(a=>a.area_id===t.id);return s.length?[["media","מדיה","music",s.some(D)?"מתנגן":"כבוי","","media"]]:[]}canAnnounce(){if(!this.has("announce")||!this.ann)return!1;const t=this.h.ctx();return!this.h.kioskLocked()||!!t&&this.ann.areas.some(s=>s.area_id===t.id)}openAnnounce(){const t=this.h.ctx(),s=!!t&&!!this.ann?.areas.some(a=>a.area_id===t.id);this.draft={msg:null,text:"",where:s?"room":"house"},this.h.ovl={type:"p3",sheet:"announce"},this.up()}energyActs(){const t=this.has("water")&&this.water?r`<a class="hbtn" href=${this.h.href("water")} data-p3-go="water">${p("drop")}<span class="bt">מים</span></a>`:g,s=this.has("bills")&&this.bill?r`<a class="hbtn" href=${this.h.href("bills")} data-p3-go="bills">${p("bill")}<span class="bt">החשבון</span></a>`:g;return r`${t}${s}`}mapOn(){return this.has("map")&&S("map.read")&&this.h.d.floors.length>0&&this.h.visRooms().length>0}tiles(){const t=[],s=(a,i,n,o,l,h="",c=0,d=!1,m)=>t.push({id:a,href:i,label:n,icon:o,line:l,tone:h,badge:c,kiosk:d,act:m});if(this.has("media")&&this.media){const a=new Set(this.media.filter(D).map(i=>i.area_id)).size;s("media","media","מוזיקה ומסכים","music",this.media.length?a?B(a,"מתנגן בחדר אחד","חדרים מנגנים"):"הכל שקט":"אין מכשירים מחוברים","",0,!0)}if(this.canAnnounce()&&s("announce","media","כריזה בבית","horn","הודעה קולית לחדרים","",0,!0,"p3Announce"),this.has("bills")&&this.bill){const a=Q(this.bill.status?.amount_so_far);s("bills","bills","חשבון חשמל","bill",a!=null?`${ae(a)} ₪ עד עכשיו`:"עוד אין חשבון")}if(this.has("water")&&this.water){const a=this.water;s("water","water","מים","drop",a.leaks?"חשד לנזילה":a.today!=null?`${ae(a.today)} ליטר היום`:"עוד אין נתונים",a.leaks?"warn":"")}if(this.has("systems")&&this.sys){const a=this.sysBad();s("systems","systems","מערכות הבית","gen",a?B(a,"דבר אחד דורש תשומת לב","דברים דורשים תשומת לב"):"הכל תקין",a?"warn":"ok")}return this.mapOn()&&s("map","map","מפת הבית","map","הבית לפי קומות"),this.h.kioskLocked()?t.filter(a=>a.kiosk):t}sysBad(){const t=this.sys;if(!t)return 0;const s=t.gen;return(s&&s.supply!=="mains"&&s.supply!=="unknown"?1:0)+(s?s.items.filter(a=>a.state==="fault"||a.state==="alarm").length:0)+t.elev.filter(a=>["fault","out_of_service","fire_service"].includes(a.state)&&!a.stale).length+t.temps.filter(a=>!xt.has(a.status)&&a.status!=="unknown"&&a.status!=="offline").length}empty(t,s,a){return r`<div class="empty">${p(t)}<h2>${s}</h2><p>${a}</p></div>`}off(t){return r`${this.h.head(t,"")}${this.empty("lock","המסך הזה לא זמין","מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.")}`}pill(t,s){return r`<span class="dst" data-tone=${t}><i class="dot"></i><span class="clamp1">${s}</span></span>`}seg(t,s,a,i){return r`<div class="seg" role="group" aria-label=${a}>${t.map(([n,o])=>r`<button aria-pressed=${String(n===s)} @click=${()=>i(n)}>${o}</button>`)}</div>`}paged(t,s,a){return _(s,a,this.h.pg(t))}}const D=e=>!!e.live&&e.live.power==="on"&&e.live.play==="playing",Ra=ge`
  .foot-note { flex: none; display: flex; align-items: center; gap: 8px; color: var(--hs-text-2); font-size: var(--f-sm); min-block-size: 28px; }
  .foot-note .hi { inline-size: 18px; block-size: 18px; flex: none; }
  .pane .mid, .vrow .mid { font-size: 22px; font-weight: 600; color: var(--hs-heading); line-height: 1.25; }
  .dst { max-inline-size: 100%; min-inline-size: 0; } .dst > .clamp1 { min-inline-size: 0; }
  .hs .rb.play, .ovl .rb.play { background: var(--hs-accent); color: var(--hs-on-accent, #fff); }
  .hs .rb.play:disabled { background: var(--hs-surface-3); color: var(--hs-text-2); }
  .cur { font-size: .7em; font-weight: 500; color: var(--hs-text-2); } .huge .cur { font-size: .4em; }

  /* ---- media */
  .md-body { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; }
  .md-now { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto auto auto auto; align-items: center; gap: 10px 20px; padding: 18px 20px; overflow: hidden; }
  .art { inline-size: clamp(84px, 17vh, 168px); aspect-ratio: 1; border-radius: 20px; display: grid; place-items: center; background: var(--hs-accent-soft); color: var(--hs-accent-text); overflow: hidden; }
  .art .hi { inline-size: 40%; block-size: 40%; } .art img { inline-size: 100%; block-size: 100%; object-fit: cover; display: block; }
  .md-now:not(.is-on) .art { background: var(--hs-surface-3); color: var(--hs-text-2); }
  .md-t { display: grid; gap: 4px; min-inline-size: 0; } .md-t b { font-size: 26px; font-weight: 600; line-height: 1.2; color: var(--hs-heading); }
  .md-prog { grid-column: 1 / -1; block-size: 6px; border-radius: 3px; background: var(--hs-surface-3); overflow: hidden; }
  .md-prog i { display: block; block-size: 100%; background: var(--hs-accent-text); transform-origin: left; } .md-prog.none { visibility: hidden; }
  .md-ctl { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 22px; }
  .volr { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr) 40px; align-items: center; gap: 12px; color: var(--hs-text-2); }
  .volr .vi .hi { inline-size: 24px; block-size: 24px; display: block; } .volr .vv { text-align: center; color: var(--hs-heading); font-weight: 600; }
  .volr input { -webkit-appearance: none; appearance: none; inline-size: 100%; block-size: var(--hit); margin: 0; background: transparent; cursor: pointer; }
  .volr input:disabled { cursor: default; opacity: .5; }
  .volr input::-webkit-slider-runnable-track { block-size: 10px; border-radius: 5px; background: linear-gradient(to left, var(--hs-accent-text) var(--v, 0%), var(--hs-surface-3) var(--v, 0%)); /* taste-skill-ignore: a hard-stop fill for the slider's value, not a decorative gradient */ }
  .volr input::-webkit-slider-thumb { -webkit-appearance: none; inline-size: 28px; block-size: 28px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); margin-block-start: -9px; }
  .volr input::-moz-range-track { block-size: 10px; border-radius: 5px; background: var(--hs-surface-3); } .volr input::-moz-range-thumb { inline-size: 28px; block-size: 28px; border: 0; border-radius: 50%; background: #fff; }
  .md-src { grid-column: 1 / -1; display: flex; gap: 8px; min-inline-size: 0; overflow: hidden; }
  .md-src .chip2, .chipset .chip2 { padding: 0 16px !important; gap: 8px; background: var(--hs-surface-3); flex: 0 1 auto; white-space: nowrap; min-inline-size: var(--hit); justify-content: center; }
  .md-src .chip2[aria-pressed="true"], .ovl .chipset .chip2[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); font-weight: 600; }
  .chip2 .hi { inline-size: 20px; block-size: 20px; flex: none; }
  .md-list { display: grid; grid-template-rows: repeat(4, minmax(0, 1fr)) auto; gap: 12px; min-block-size: 0; }
  .mrow2 { display: grid; grid-template-columns: var(--hit) minmax(0, 1fr) var(--hit); align-items: center; gap: 12px; padding: 0 14px; }
  .mrow2.cur { box-shadow: inset 0 0 0 2px var(--hs-accent-text); } .mrow2.is-on .ai { background: var(--hs-accent-soft); color: var(--hs-accent-text); }
  .mrow2 .at b { font-size: var(--f-body); }
  .mrow2 > .ai, .mrow2 > .at { position: relative; pointer-events: none; } .mrow2 > .rb { position: relative; z-index: 1; }

  /* ---- bill, water, systems */
  .en-body:has(.wbars), .en-body:has(.bill-now) { grid-template-rows: minmax(0, 1fr); }
  .bill-now { justify-content: center; gap: 10px; }
  .huge.fit { font-size: clamp(48px, 9vw, var(--f-huge)); }
  .mprog { block-size: 10px; border-radius: 5px; background: var(--hs-surface-3); overflow: hidden; flex: none; inline-size: 100%; }
  .mprog i { display: block; block-size: 100%; background: var(--viz-today); transform-origin: right; } .mprog.low i { background: var(--hs-warning); }
  .bill-fc { display: grid; gap: 2px; margin-block-start: 10px; padding-block-start: 14px; border-block-start: 1px solid var(--hs-border); }
  .blr { grid-template-columns: minmax(0, 1fr) auto; }
  .blr .at { display: grid; gap: 4px; min-inline-size: 0; }
  .wbars { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr); gap: 10px; }
  .wb { display: grid; grid-template-rows: 20px minmax(0, 1fr) 22px; justify-items: center; gap: 4px; min-block-size: 0; font-size: var(--f-sm); color: var(--hs-text-2); }
  .wb i { inline-size: min(64%, 56px); align-self: end; border-radius: 8px 8px 3px 3px; background: var(--viz-today); } .wb.future i { background: var(--hs-surface-3); block-size: 4px !important; }
  .wb .wv { font-size: 13px; }
  .leak { align-items: flex-start; justify-content: center; gap: 10px; } .leak h2 { font-size: 24px; } .leak .dlg-ic { --cs: var(--hs-surface-3); color: var(--ct); }
  .sys-grid { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 14px; margin-block-end: 8px; }
  .sys-grid.n1 { grid-template-columns: minmax(0, 1fr); } .sys-grid.n3 > :first-child { grid-row: span 2; }
  .sys { justify-content: center; gap: 6px; } .sys:has(.sysr) { gap: 0; justify-content: flex-start; } .sys .bar { margin-block-end: 2px; }
  .sys-k { display: flex; align-items: center; gap: 8px; color: var(--hs-text-2); font-size: var(--f-sm); font-weight: 500; } .sys-k .hi { inline-size: 22px; block-size: 22px; }
  .sysr { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: 1 1 0; min-block-size: 44px; max-block-size: 64px; border-block-start: 1px solid var(--hs-border); min-inline-size: 0; }
  .sysr > b { flex: 1; min-inline-size: 0; font-weight: 500; color: var(--hs-heading); } .sysr .dst { flex: 0 1 auto; max-inline-size: 58%; }
  .sysr .st { display: inline-flex; align-items: center; gap: 8px; flex: none; } .sysr .st b { font-size: 20px; color: var(--hs-heading); }

  /* ---- the map (schematic plan, never mirrored) */
  .plan-wrap { flex: 1; min-block-size: 0; display: grid; }
  .plan { position: relative; background: var(--hs-surface); border-radius: var(--r-tile); min-block-size: 0; }
  .plan-in { position: absolute; inset: 14px; }
  .pr { position: absolute; display: grid; align-content: center; justify-items: center; gap: 4px; padding: 6px; border-radius: 14px; background: var(--hs-off-tile); color: var(--hs-text-2); box-shadow: inset 0 0 0 1px var(--hs-border-strong); text-align: center; overflow: hidden; text-decoration: none; transition: transform 120ms var(--hs-ease), background-color var(--hs-t-med) ease; }
  .pr:active { transform: scale(.98); }
  .pr b { font-size: var(--f-body); font-weight: 600; color: var(--hs-heading); line-height: 1.2; }
  .pr.lit { background: var(--hs-lamp-on); }
  .pm { display: inline-flex; align-items: center; gap: 8px; font-size: var(--f-sm); } .pm .hi { inline-size: 18px; block-size: 18px; } .pm .hi.lit { color: var(--hs-lit); }
  .plan-leg { flex: none; min-block-size: 44px; }
  .k.lit { inline-size: 14px; block-size: 14px; border-radius: 4px; background: var(--hs-lit); }
  .k.dark { inline-size: 14px; block-size: 14px; border-radius: 4px; background: var(--hs-off-tile); box-shadow: inset 0 0 0 1px var(--hs-border-strong); }

  /* ---- v3 sheets (short forms; nothing here scrolls) */
  .sheet.dialog.v3 { gap: 10px; max-block-size: calc(100dvh - 24px); }
  .sheet.v3 .menu-h { inline-size: 100%; } .sheet.v3 .menu-h > .hi { inline-size: 28px; block-size: 28px; color: var(--hs-text-2); flex: none; }
  .sheet.v3 .mh-t b { font-size: 22px; }
  .fld { display: grid; gap: 6px; inline-size: 100%; font-size: var(--f-sm); color: var(--hs-text-2); }
  .inp { min-block-size: var(--hit); inline-size: 100%; border: 0; border-radius: var(--r-ctl); background: var(--hs-surface-3); color: var(--hs-heading); padding: 0 16px; font: inherit; font-size: max(16px, var(--f-body)); }
  .inp::placeholder { color: var(--hs-text-3); }
  .chipset { display: flex; flex-wrap: wrap; gap: 8px; inline-size: 100%; }
  .ovl .chipset .chip2 { background: var(--hs-surface-3); }
  .sheet.v3 .setrow.flat { gap: 10px; }
  .dlg-acts.three { grid-template-columns: repeat(3, minmax(0, 1fr)); } .sheet.v3 .dlg-acts .hbtn { padding: 0 12px; }
  .rm { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; justify-items: center; gap: 14px; margin-block: 8px; inline-size: 100%; }
  .rm-col { display: grid; gap: 10px; justify-items: center; } .dpad { display: grid; grid-template-columns: repeat(3, auto); gap: 8px; place-items: center; }
  .ovl .dpad .rb.xl { font-size: 16px; font-weight: 600; background: var(--hs-accent); color: var(--hs-on-accent, #fff); }
  .grp-list { display: grid; gap: 4px; inline-size: 100%; }
  /* the tablet's 56 px target rule inside the phase 3 sheets too (the round-27 sheets drew 54) */
  @media (min-width: 701px) { .sheet.v3 .rb { inline-size: 56px; block-size: 56px; } .sheet.v3 .hsw, .sheet.v3 .hbtn, .sheet.v3 .chip2, .sheet.v3 .seg button { min-block-size: 56px; } }

  /* ---- 1024 tablets */
  @media (max-width: 1100px) and (min-width: 701px) {
    .md-t b { font-size: 22px; } .md-src .chip2 { padding: 0 12px !important; }
  }
  @media (max-height: 800px) and (min-width: 701px) { .art { border-radius: 16px; } }

  /* ---- phone */
  @media (max-width: 700px) {
    .md-body { display: flex; flex-direction: column; gap: 8px; } .md-now { flex: 1 1 auto; padding: 10px 14px; gap: 6px 12px; grid-template-rows: auto auto auto auto auto; }
    .art { inline-size: 60px; border-radius: 14px; } .md-t b { font-size: 18px; } .md-prog { display: none; }
    .md-ctl { gap: 18px; } .md-ctl .rb.xl { inline-size: 60px; block-size: 60px; } .md-src .chip2 { padding: 0 12px !important; font-size: 14px; min-block-size: 44px; } .volr input { block-size: 44px; }
    .md-list { flex: none; grid-template-rows: repeat(2, 60px) auto; gap: 8px; }
    .huge.fit { font-size: 56px; } .wbars { gap: 4px; } .wb .wv { font-size: 11px; } .leak h2 { font-size: 20px; } .bill-now { flex: 1.2 1 0; }
    .leak .dlg-ic { display: none; } .leak { gap: 4px; padding-block: 10px; } .en-body > .leak { flex: none; } .en-body > .pane:has(.wbars) { flex: 1.6 1 0; }
    .sys-grid, .sys-grid.n3 { grid-template-columns: minmax(0, 1fr); gap: 8px; } .sys-grid.n3 > :first-child { grid-row: auto; } .sys { padding: 6px 12px; } .pane .mid { font-size: 18px; }
    .sysr .dst { max-inline-size: 58%; font-size: 13px; } .sys .bar { min-block-size: 44px; }
    .pr { padding: 3px; border-radius: 10px; } .pr b { font-size: 13px; } .pm { font-size: 12px; gap: 4px; } .pm .hi { inline-size: 14px; block-size: 14px; } .plan-leg .muted { display: none; } .plan-in { inset: 8px; }
    .foot-note { font-size: 13px; }
    .sheet.dialog.v3 { padding: 18px 16px; gap: 8px; } .sheet.v3 .mh-t b { font-size: 19px; } .dlg-acts.three { gap: 8px; } .dlg-acts.three .hbtn .hi { display: none; }
    .sheet.v3 .dlg-acts .hbtn { padding: 0 8px; font-size: 15px; } .sheet.v3 .setrow.flat { min-block-size: 56px; }
    .chipset .chip2 { min-block-size: 44px; padding: 0 12px !important; font-size: 15px; }
    .rm { gap: 6px; } .dpad { gap: 6px; } .ovl .dpad .rb.xl { inline-size: 68px; block-size: 68px; }
  }
  @media (hover: hover) and (pointer: fine) { .pr:not(.lit):hover { background: var(--hs-surface-2); } }
  @media (prefers-reduced-motion: reduce) { .pr { transition-property: background-color, color !important; transform: none !important; } }
`;var Ia=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,$=(e,t,s,a)=>{for(var i=a>1?void 0:a?ja(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Ia(t,s,i),i};const J=[["classic","קלאסי","פחם חם וכחול. המראה שאושר.",2],["ocean","אוקיינוס","כחול ים עמוק ותכלת צלול.",2],["sand","חול","אבן חמה וחימר.",2],["plum","שזיף","חציל כהה ולילך רך.",2],["midnight","חצות","כחול כמעט שחור עם פליז. כהה בלבד.",1],["nordic","נורדי","אבן בהירה וכחול צפחה.",2],["pastel","פסטל","לבנדר רך ופטל, לטאבלט של הילדים.",2]],Pa=[["r/home","הבית שלי","home","home"],["scenes","סצנות","scenes","scenes"],["active","פעיל עכשיו","pulse","active"],["more","עוד","grid","more"],["alerts","התראות","bell","alerts"],["settings/favs","הגדרות","sliders","settings"]],Aa=["r","rooms","lights","climate","shades","doors","cameras","energy","alerts","scenes","active","settings","welcome","security"],_e={arm_home:"דריכה בבית",arm_away:"דריכה ביציאה",arm_night:"דריכת לילה",arm_vacation:"דריכה לחופשה",arm_custom_bypass:"דריכה חלקית",disarm:"ניטרול"},Ca=5*6e4,Ua=new Intl.DateTimeFormat("he-IL",{weekday:"long",day:"numeric",month:"long",timeZone:"Asia/Jerusalem"}),qa=new Intl.DateTimeFormat("he-IL",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"});let k=class extends ds{constructor(){super(...arguments),this.path="",this.userName="",this.userFull="",this.role="",this.policy=null,this.data=null,this.error="",this.prefs={favourites:{},layout:{},seed:{}},this.room="home",this.scope="room",this.only=!1,this.lightsTab="lights",this.zone=null,this.period="day",this.alertTab="open",this.edit=!1,this.roomsEdit=!1,this.doorsOnly=!1,this.shadesOnly=!1,this.floor="",this.page={},this.ovl=null,this.wallStamp=0,this.toastMsg=null,this.armed=null,this.sceneRun=null,this.phone=window.innerWidth<=700,this.now=new Date,this.visitors=[],this.kioskUntil=0,this.welcomePick="home",this.panels=[],this.calls={ringing:0,waiting:0},this.talkTo=null,this.lastScene=(()=>{try{return sessionStorage.getItem("home.lastScene")}catch{return null}})(),this.price=null,this.stopHa=null,this.refreshT=0,this.toastT=0,this.armT=0,this.clockT=0,this.holdT=0,this.held=!1,this.swipe=null,this.down={x:0,y:0},this.saveT=0,this.lastRoute="",this.ext=la(this),this.extState={},this.p3=new Ea(this),this.onResize=()=>{const e=window.innerWidth<=700;e!==this.phone&&(this.phone=e)},this.extRoute="",this.onClick=e=>{if(this.held){this.held=!1,e.preventDefault();return}const t=e.composedPath().find(o=>o instanceof HTMLElement&&o.dataset&&o.dataset.act);if(!t||t.disabled)return;const s=t.dataset.act??"",a=this["a_"+s],i=a?null:this.ext.find(o=>o.acts&&s in o.acts),n=a?a.bind(this):i?.acts?.[s];n&&n(t)!==!0&&t.tagName==="A"&&e.preventDefault()},this.onInput=e=>{const t=e.composedPath()[0];if(!(t instanceof HTMLInputElement))return;const s=+t.value;if(t.dataset.master){const a=this.roomById(t.dataset.master);if(!a)return;const n=a.lights.filter(o=>!o.sw&&o.can).some(o=>o.on);for(const o of a.lights)o.can&&(s===0?o.on&&(o.on=!1,o.sw?P(o,!1):W(o,0,()=>{})):!o.sw&&(!n||o.on)&&(o.on=!0,o.lvl=Math.max(1,s),W(o,o.lvl,l=>{l.ok||this.toast(l.note||"העמעום לא הצליח.")})));this.requestUpdate();return}if(t.dataset.dim){const a=this.findLight(t.dataset.dim);if(!a||!a.can)return;a.lvl=Math.max(1,s),a.on=!0,this.requestUpdate(),W(a,a.lvl,i=>{i.ok||(this.toast(i.note||"העמעום לא הצליח."),this.scheduleRefresh(200))})}},this.onPointerDown=e=>{const t=e.composedPath(),s=t.find(n=>n instanceof HTMLElement&&n.dataset?.ft&&(n.classList.contains("lcard")||n.classList.contains("wdg"))),a=t.some(n=>n instanceof HTMLElement&&(n.tagName==="INPUT"||n.classList?.contains("dim")||n.classList?.contains("star")));this.down={x:e.clientX,y:e.clientY},this.swipe=this.route().name==="r"&&!a&&t.some(n=>n instanceof HTMLElement&&n.id==="main")?{x:e.clientX,y:e.clientY}:null,window.clearTimeout(this.holdT),s&&!this.edit&&!a&&(this.holdT=window.setTimeout(()=>{this.held=!0;const n={t:s.dataset.ft,id:s.dataset.fid};this.ovl={type:"hold",f:n,label:this.favLabel(n)}},550)),t.find(n=>n instanceof HTMLElement&&n.classList?.contains("hs-now"))&&this.pol()?.kiosk&&this.pol()?.kiosk_exit!=="none"&&(this.holdT=window.setTimeout(()=>{this.held=!0,this.ovl={type:"kiosk",code:"",error:""}},1200))},this.onPointerMove=e=>{Math.abs(e.clientX-this.down.x)+Math.abs(e.clientY-this.down.y)>10&&window.clearTimeout(this.holdT)},this.onPointerUp=e=>{if(window.clearTimeout(this.holdT),window.setTimeout(()=>{this.held=!1},50),this.swipe&&!this.kioskLocked()){const t=e.clientX-this.swipe.x,s=e.clientY-this.swipe.y;Math.abs(t)>70&&Math.abs(s)<50&&(this.held=!0,this.stepRoom(t>0?1:-1))}this.swipe=null},this.onKey=e=>{e.key==="Escape"&&this.ovl&&(this.ovl=null)},this.tipOver=e=>{const t=e.composedPath().find(u=>u instanceof HTMLElement&&u.classList?.contains("col")),s=e.currentTarget,a=s.querySelector(".tip");if(!t||!a)return;const[i,n,o]=(t.dataset.tip??"").split("|");a.hidden=!1,a.textContent="";const l=document.createElement("b");l.textContent=i,a.append(l);const h=document.createElement("span");h.textContent=n?n+" קוט״ש":"עוד לא הגענו",a.append(h);const c=document.createElement("span");c.textContent=o+" ביום רגיל",a.append(c);const d=t.parentElement.getBoundingClientRect(),m=t.getBoundingClientRect();a.style.left=Math.max(84,Math.min(d.width-84,m.left+m.width/2-d.left))+"px",s.querySelectorAll(".col").forEach(u=>u.classList.toggle("hot",u===t))},this.tipOff=e=>{const t=e.currentTarget,s=t.querySelector(".tip");s&&(s.hidden=!0),t.querySelectorAll(".col.hot").forEach(a=>a.classList.remove("hot"))}}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),this.clockT=window.setInterval(()=>{this.now=new Date},2e4),this.load(),this.stopHa=ps(e=>{(e.type==="entity_state_changed"||e.type==="structure_changed")&&this.scheduleRefresh()})}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.clearInterval(this.clockT),this.stopHa?.()}scheduleRefresh(e=600){window.clearTimeout(this.refreshT),this.refreshT=window.setTimeout(()=>void this.loadOverview(),e)}async load(){try{const[e]=await Promise.all([Ms().catch(()=>this.prefs),this.loadOverview()]);if(this.prefs=e,this.applyLayout(),this.data){const t=this.data.modules,[s,a,i]=await Promise.all([t.has("scenes")||t.has("lights")?Ss():Promise.resolve([]),t.has("alerts")?Ts():Promise.resolve([]),t.has("energy")?Ls():Promise.resolve(null)]);this.data={...this.data,scenes:s,alerts:a,energy:i};const n=this.route();this.extFor(n.name)?.enter?.(n.name,n.arg),t.has("security")&&S("alarm.view")&&this.loadPanels(),t.has("doors")&&S("access.call")&&this.loadTalk(),t.has("energy")&&(S("energy.bills")||S("energy.manage"))&&this.loadPrice(),t.has("doors")&&Ie(null,8).then(o=>{this.visitors=o.calls}).catch(()=>{}),this.p3.load()}}catch(e){this.error=M(e)}}async loadTalk(){try{const e=await hs();for(const t of e.stations??[]){if(!t.online)continue;const s=await ms(t.id).catch(()=>null);if(s?.talk?.available){const a=s.video?.allowed?s.video.paths.sub??s.video.paths.main??"":"";this.talkTo={id:t.id,name:t.name,talk:s.talk,video:a};return}}}catch{this.talkTo=null}}async loadPrice(){try{const t=(await L("energy/tariffs")).items.find(a=>a.kind==="fixed"&&a.current?.price),s=t?parseFloat(String(t.current?.price)):NaN;this.price=Number.isFinite(s)&&s>0?s:null}catch{this.price=null}}async loadPanels(){try{this.panels=(await fs()).panels}catch{this.panels=[]}}async loadOverview(){try{const[e,t]=await Promise.all([Ds(),this.data?Promise.resolve(this.data.cameras):Os()]),s=Es(e,e.modules.includes("cameras")?t:[]);this.data={scenes:[],alerts:[],energy:null,...this.data??{},...s,cameras:e.modules.includes("cameras")?t:[]},!this.floor&&s.floors[0]&&(this.floor=s.floors[0].id),this.error=""}catch(e){this.data||(this.error=M(e))}}applyLayout(){const e=this.prefs.layout,t=this.pol(),s=J.find(i=>i[0]===(e.theme??"classic"))??J[0];let a=e.scheme==="light"||e.scheme==="auto"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";s[3]===1&&(a="dark"),this.setAttribute("data-hs-theme",s[0]),this.setAttribute("data-hs-scheme",a),this.toggleAttribute("data-hs-big",!!e.big_text),t?.kiosk&&t.kiosk_area_id&&!this.path&&(this.room=t.kiosk_area_id)}pol(){return this.policy??this.data?.policy??null}saveLayout(e){this.prefs={...this.prefs,layout:{...this.prefs.layout,...e}},this.applyLayout(),Je({layout:e}).catch(t=>this.toast(M(t)))}saveFavs(e,t){this.prefs={...this.prefs,favourites:{...this.prefs.favourites,[e]:t}},window.clearTimeout(this.saveT),this.saveT=window.setTimeout(()=>void Je({favourites:{[e]:t}}).catch(s=>this.toast(M(s))),400)}willUpdate(e){if(e.has("path")){const{name:t,arg:s}=this.route(),a=this.pol();if(t==="r"){let n=s&&this.data?.rooms.some(o=>o.id===s)?s:s==="home"||!s||this.data?"home":s;this.kioskLocked()&&a?.kiosk_area_id&&(n=a.kiosk_area_id),n!==this.room&&(this.room=n,this.scope="room",this.edit=!1,n!=="home"&&this.prefs.layout.start==="last"&&this.saveLayout({start_room:n}))}this.kioskLocked()&&a?.kiosk_area_id&&this.room!==a.kiosk_area_id&&(this.room=a.kiosk_area_id),this.ovl&&(this.ovl=null);const i=this.extFor(this.extRoute);i&&i!==this.extFor(t)&&i.leave?.(),this.extRoute=t,this.data&&this.extFor(t)?.enter?.(t,s)}}extFor(e){return this.ext.find(t=>t.names.includes(e))}route(){const e=(this.path||"").replace(/^\/+/,"");if(!e){const i=this.prefs.layout,n=this.pol();return n?.kiosk&&n.kiosk_area_id?{name:"r",arg:n.kiosk_area_id}:n?.choose||n?.may_switch&&!i.welcomed?{name:"welcome",arg:""}:(i.start==="last"||i.start==="fixed")&&i.start_room?{name:"r",arg:i.start_room}:{name:"r",arg:"home"}}const[t,s=""]=e.split("/"),a=Aa.includes(t)||this.extFor(t)!=null;return{name:a?t:"r",arg:a?s:""}}kioskLocked(){return!!this.pol()?.kiosk&&Date.now()>this.kioskUntil}href(e){return`#/home/${e}`}go(e){const t=this.href(e);location.hash===t?this.requestUpdate():location.hash=t}get d(){return this.data}world(){const e=this.d;return{rooms:this.visRooms(),cameras:e.cameras,scenes:e.scenes,hasEnergy:!!e.energy&&e.energy.today.length>0,hasSecurity:!1}}visRooms(){const e=new Set(this.prefs.layout.hidden_rooms??[]);return this.d.rooms.filter(t=>!e.has(t.id))}roomById(e){return this.d.rooms.find(t=>t.id===e)}ctx(){return this.room==="home"?null:this.roomById(this.room)??null}scopeRooms(){const e=this.ctx();return!e||this.scope==="house"?this.visRooms():this.scope==="floor"?this.visRooms().filter(t=>t.floor===e.floor):[e]}scopeWord(){const e=this.ctx();return!e||this.scope==="house"?"בכל הבית":this.scope==="floor"?"ב"+we(this.d.floors,e.floor):"ב"+e.name}allDoors(){return this.visRooms().flatMap(e=>e.doors)}zonesOf(e){return e.flatMap(t=>t.zones)}mainZone(e){const t=this.zonesOf(e);return t.find(s=>s.id===this.zone)??t[0]??null}favRooms(){return["home",...(this.prefs.layout.fav_rooms??this.visRooms().slice(0,3).map(t=>t.id)).filter(t=>this.visRooms().some(s=>s.id===t))]}favs(e){return this.prefs.favourites[e]??this.prefs.seed[e]??Ys(e,this.world())}findLight(e){for(const t of this.d.rooms){const s=t.lights.find(a=>a.id===e);if(s)return s}}findIn(e,t){for(const s of this.d.rooms){const a=e(s).find(i=>i.id===t);if(a)return a}}favLabel(e){const t=s=>s?.name??"";switch(e.t){case"scene":return"סצנה: "+t(this.d.scenes.find(s=>s.id===e.id));case"light":return t(this.findLight(e.id??""));case"switch":return t(this.findIn(s=>s.loads,e.id??""));case"shade":return t(this.findIn(s=>s.shades,e.id??""));case"climate":return"מיזוג: "+(this.findIn(a=>a.zones,e.id??"")?.name??"");case"cam":return"מצלמה: "+t(this.d.cameras.find(s=>s.id===e.id));case"door":return t(this.findIn(s=>s.doors,e.id??""));case"allLights":return"כל האורות";default:return"חשמל היום"}}toast(e,t=null){this.toastMsg={text:e,undo:t},window.clearTimeout(this.toastT),this.toastT=window.setTimeout(()=>{this.toastMsg=null},5200)}async outcome(e,t){const s=await e;s.ok?t&&this.toast(t):this.toast(s.note||"הפעולה לא הצליחה."),this.scheduleRefresh(900)}snapshotLights(e){return e.flatMap(t=>t.lights.map(s=>({l:s,on:s.on,lvl:s.lvl})))}undoLights(e){return()=>{for(const t of e)t.on&&(t.l.on=!0,t.l.sw?P(t.l,!0):W(t.l,t.lvl,()=>{}));this.toastMsg=null,this.requestUpdate(),this.scheduleRefresh(1200)}}bulkScope(e){return e.length===1&&e[0].canBulk?{kind:"area",id:e[0].id}:e.length>1&&e.length===this.d.rooms.length&&this.d.canBulk?{kind:"building",id:"*"}:null}offLights(e,t,s){const a=A(e),i=this.snapshotLights(e);for(const o of e)o.lights.forEach(l=>{l.can&&(l.on=!1)}),t&&o.zones.forEach(l=>{l.can&&(l.mode="off")});this.requestUpdate();const n=[Qs(e,this.bulkScope(e))];t&&n.push(ea(this.zonesOf(e))),Promise.all(n).then(o=>{const l=o.find(h=>!h.ok);l&&this.toast(l.note||"חלק מהכיבוי לא הצליח."),this.scheduleRefresh(900)}),this.toast((s||(a===1?"האור כובה":`${a} אורות כובו`))+Zs(e),this.undoLights(i))}stepRoom(e){const t=this.favRooms(),s=Math.max(0,t.indexOf(this.room));this.go("r/"+t[(s+e+t.length)%t.length])}fromEl(e){const t={t:e.dataset.ft};return e.dataset.fid&&(t.id=e.dataset.fid),t}a_light(e){const t=this.findLight(e.dataset.l??"");if(!t||!t.can)return this.toast(t&&!t.ok?"האור לא זמין כרגע.":"אין הרשאה להפעיל את האור הזה.");t.on=!t.on,this.requestUpdate(),this.outcome(t.sw?P(t,t.on):t.on?new Promise(s=>W(t,t.lvl||100,s)):P(t,!1))}a_load(e){const t=this.findIn(s=>s.loads,e.dataset.ld??"");if(!t||!t.can)return this.toast("אין הרשאה להפעיל את המפסק הזה.");if(t.on&&t.guard){this.ovl={type:"guard",id:t.id};return}t.on=!t.on,this.requestUpdate(),this.outcome(P(t,t.on))}a_guardOff(){const e=this.ovl;if(e?.type!=="guard")return;const t=this.findIn(s=>s.loads,e.id);this.ovl=null,t&&(t.on=!1,this.outcome(P(t,!1),"כובה"))}a_roomLights(e){const t=this.roomById(e.dataset.room??"");if(!t)return;if(t.lights.some(a=>a.on))return this.offLights([t],!1,"");for(const a of t.lights.filter(i=>i.can))a.on=!0,a.sw?P(a,!0):new Promise(i=>W(a,a.lvl||100,i));this.requestUpdate(),this.scheduleRefresh(1200)}a_allOff(){this.offLights(this.visRooms(),!1,"")}a_scopeOff(){this.offLights(this.scopeRooms(),!1,"")}a_roomOff(){const e=this.ctx();this.offLights(e?[e]:this.visRooms(),!0,e?`${e.name}: האורות והמיזוג כובו`:"האורות והמיזוג בכל הבית כובו")}a_roomOffId(e){const t=this.roomById(e.dataset.room??"");t&&this.offLights([t],!0,`${t.name}: האורות והמיזוג כובו`)}a_houseOff(){this.offLights(this.visRooms(),!0,"האורות והמיזוג בכל הבית כובו")}a_undo(){this.toastMsg?.undo?.()}a_scene(e){const t=this.d.scenes.find(a=>a.id===e.dataset.scene);if(!t)return;const s=()=>{this.sceneRun=t.id,window.setTimeout(()=>{this.sceneRun=null},620),this.lastScene=t.id;try{sessionStorage.setItem("home.lastScene",t.id)}catch{}this.outcome(ia(t),`סצנת ${t.name} הופעלה`)};t.sensitive?this.ovl={type:"ask",title:`להפעיל את ${t.name}?`,text:"הסצנה הזו משנה גם דברים רגישים.",yes:"כן, הפעל",run:s}:s()}a_askYes(){const e=this.ovl;this.ovl=null,e?.type==="ask"&&e.run()}a_roomStep(e){this.stepRoom(+(e.dataset.d??1))}a_favRoom(e){const t=e.dataset.id??"",s=(this.prefs.layout.fav_rooms??this.favRooms().slice(1)).slice(),a=s.indexOf(t);a>=0?s.splice(a,1):s.push(t),this.saveLayout({fav_rooms:s})}a_roomsEdit(){this.roomsEdit=!this.roomsEdit}a_edit(){this.edit=!this.edit}a_wgMove(e){const t=this.favs(this.room).filter(i=>K(i,this.world())).slice(),s=+(e.dataset.ix??0),a=s+ +(e.dataset.d??0);a<0||a>=t.length||([t[s],t[a]]=[t[a],t[s]],this.saveFavs(this.room,t))}a_wgDel(e){const t=this.favs(this.room).filter(i=>K(i,this.world())).slice(),[s]=t.splice(+(e.dataset.ix??0),1),a=this.room;this.saveFavs(a,t),this.toast("הוסר מהמועדפים",()=>{const i=this.favs(a).slice();i.push(s),this.saveFavs(a,i),this.toastMsg=null})}a_wgSize(e){const t=this.favs(this.room).filter(a=>K(a,this.world())).map(a=>({...a})),s=t[+(e.dataset.ix??0)];s?.t==="light"&&(s.w=ve(s)===2?1:2,this.saveFavs(this.room,t))}a_star(e){const t=this.fromEl(e),s=this.favs(this.room).slice(),a=s.findIndex(n=>ce(n,t)),i=this.ctx();a>=0?(s.splice(a,1),this.toast("הוסר מהמועדפים")):(t.t==="light"&&(t.w=this.findLight(t.id??"")?.sw?1:2),s.push(t),this.toast(`נוסף למועדפים של ${i?i.name:"הבית שלי"}`)),this.saveFavs(this.room,s)}a_holdFav(e){const t=this.ovl;if(t?.type!=="hold")return;const s=e.dataset.k??this.room,a=this.favs(s).slice(),i=a.findIndex(n=>ce(n,t.f));i>=0&&s===this.room?a.splice(i,1):i<0&&a.push({...t.f,...t.f.t==="light"?{w:2}:{}}),this.saveFavs(s,a),this.ovl=null,this.toast(s==="home"?'נוסף ל"הבית שלי"':"המועדפים עודכנו")}a_scope(e){this.scope=e.dataset.v,this.page={},this.zone=null}a_only(e){this.only=e.dataset.v==="1",this.page={...this.page,lights:0,loads:0}}a_shadesOnly(e){this.shadesOnly=e.dataset.v==="1",this.page={...this.page,shades:0}}a_doorsOnly(e){this.doorsOnly=e.dataset.v==="1",this.page={...this.page,doors:0}}a_lightsTab(e){this.lightsTab=e.dataset.v}a_goLoads(){return this.lightsTab="loads",this.scope="house",this.only=!0,!0}a_floor(e){this.floor=e.dataset.v??"",this.page={...this.page,roomsP:0,setRooms:0}}a_page(e){const t=e.dataset.key??"";this.page={...this.page,[t]:Math.max(0,(this.page[t]??0)+ +(e.dataset.d??0))}}a_temp(e){const t=this.findIn(a=>a.zones,e.dataset.zone??"");if(!t||!t.can)return this.toast("אין הרשאה לכוון את המזגן הזה.");const s=t.target??t.temp??23;t.target=Math.max(t.min,Math.min(t.max,s+ +(e.dataset.d??0)*(t.step||1))),t.mode==="off"&&(t.mode=t.modes.includes("cool")?"cool":"auto"),this.requestUpdate(),this.outcome(ot(t,t.target))}a_preset(e){const t=this.findIn(s=>s.zones,e.dataset.zone??"");!t||!t.can||(t.target=+(e.dataset.v??23),this.requestUpdate(),this.outcome(ot(t,t.target)))}a_modeSeg(e){const t=this.mainZone(this.scopeRooms());!t||!t.can||(t.mode=e.dataset.v??"off",this.requestUpdate(),this.outcome(ta(t,t.mode)))}a_zone(e){this.zone=e.dataset.v??null,this.ovl=null}a_zoneGo(e){this.zone=e.dataset.v??null;const t=this.ctx();return t&&!t.zones.some(s=>s.id===this.zone)&&(this.scope="house"),!0}a_zones(){this.ovl={type:"zones"}}a_shade(e){const t=this.findIn(i=>i.shades,e.dataset.id??""),s=e.dataset.v;if(!t||!t.can)return this.toast("אין הרשאה להזיז את התריס הזה.");const a=`${t.id}:${s}`;if(s!=="stop"&&this.armed!==a){this.armed=a,window.clearTimeout(this.armT),this.armT=window.setTimeout(()=>{this.armed=null},3e3);return}this.armed=null,t.moving=s!=="stop",t.state=s==="open"?"opening":s==="close"?"closing":t.state,this.requestUpdate(),this.outcome(rt(t,s))}a_shadesAll(e){const t=e.dataset.v==="open"?"open":"close",s=this.scopeRooms().flatMap(a=>a.shades).filter(a=>a.can);s.length&&(this.ovl={type:"ask",title:t==="open"?"לפתוח את כל התריסים?":"לסגור את כל התריסים?",text:`${s.length===1?"תריס אחד":s.length+" תריסים"} ${this.scopeWord()}.`,yes:t==="open"?"כן, פתח":"כן, סגור",run:()=>{s.forEach(a=>{a.moving=!0,rt(a,t)}),this.toast(t==="open"?"התריסים נפתחים":"התריסים נסגרים"),this.scheduleRefresh(1500)}})}a_doorAsk(e){this.ovl={type:"confirm",door:e.dataset.door??""}}a_doorOpen(e){const t=this.findIn(s=>s.doors,e.dataset.door??"");this.ovl=null,t&&sa(t).then(s=>{s.ok?this.toast(`${t.name}: נשלחה פקודת פתיחה. ${t.kind==="gate"?"השער ייסגר":"הדלת תינעל"} שוב מעצמ${t.kind==="gate"?"ו":"ה"}.`):this.toast(s.note||"הדלת לא נפתחה."),this.scheduleRefresh(1500)})}a_doorLock(e){const t=this.findIn(s=>s.doors,e.dataset.door??"");t&&this.outcome(aa(t),`${t.name} ננעלה`)}a_cam(e){this.ovl={type:"cam",id:e.dataset.cam??""}}a_camStep(e){const t=this.ovl;if(t?.type!=="cam")return;const s=this.d.cameras,a=s.findIndex(i=>i.id===t.id);this.ovl={type:"cam",id:s[(a+ +(e.dataset.d??1)+s.length)%s.length].id}}a_period(e){this.period=e.dataset.v}a_alertTab(e){this.alertTab=e.dataset.v,this.page={...this.page,alerts:0}}a_alertAck(e){const t=this.d.alerts.find(s=>s.id===e.dataset.id);t&&us().ack(t.id).then(()=>{t.open=!1,t.tone="ok",this.requestUpdate(),this.toast("טופל. תודה.")}).catch(s=>this.toast(M(s)))}a_menu(){this.ovl={type:"menu"}}a_close(){this.ovl=null}a_closeNav(){return this.ovl=null,!0}a_face(e){const t=e.dataset.v==="full"?"full":"home";this.ovl=null,t!=="home"&&xe("full").then(()=>{location.hash="#/",location.reload()}).catch(s=>this.toast(M(s)))}a_theme(e){this.saveLayout({scheme:e.dataset.v==="light"?"light":"dark"})}a_hs(e){this.saveLayout({theme:e.dataset.v??"classic"})}a_bigText(){this.saveLayout({big_text:!this.prefs.layout.big_text})}a_start(e){const t=e.dataset.v;this.saveLayout({start:t,start_room:t==="fixed"||t==="last"?this.ctx()?.id??this.prefs.layout.start_room??null:null})}a_setTab(e){this.go("settings/"+(e.dataset.v??"favs"))}a_roomVis(e){const t=e.dataset.id??"",s=new Set(this.prefs.layout.hidden_rooms??[]);s.has(t)?s.delete(t):s.add(t),this.saveLayout({hidden_rooms:[...s]})}a_welcomePick(e){this.welcomePick=e.dataset.v==="full"?"full":"home"}a_welcomeGo(){this.saveLayout({welcomed:!0}),this.welcomePick==="full"?xe("full").then(()=>{location.hash="#/",location.reload()}).catch(e=>this.toast(M(e))):(xe("home").catch(()=>{}),this.go("r/home"))}a_alarm(e){const t=this.panels.find(n=>n.entity_id===e.dataset.panel),s=e.dataset.v;if(!t)return;const a=s==="disarm"?t.code.disarm:t.code.arm;if(a==="unverifiable"||a==="pin_missing")return this.toast(a==="pin_missing"?"צריך קוד אישי לאזעקה. מגדירים אותו בממשק המלא.":"אי אפשר לאמת קוד לפעולה הזו מכאן.");const i=n=>{this.ovl=null,bt(t.entity_id,s,{confirmed:!0,code:n}).then(()=>{this.toast(`${t.name}: ${_e[s]} נשלחה`),window.setTimeout(()=>void this.loadPanels(),1500)}).catch(o=>this.toast(M(o)))};a==="pin"||a==="panel"?this.ovl={type:"code",title:`${_e[s]}: ${t.name}`,code:"",error:"",run:n=>i(n)}:this.ovl={type:"ask",title:`${_e[s]}?`,text:t.name,yes:"כן",run:()=>i()}}a_codeKey(e){const t=this.ovl;if(t?.type!=="code")return;const s=e.dataset.k??"";this.ovl={...t,code:s==="del"?t.code.slice(0,-1):t.code.length<12?t.code+s:t.code,error:""}}a_codeGo(){const e=this.ovl;e?.type==="code"&&e.code&&e.run(e.code)}a_talk(){this.talkTo&&(this.ovl={type:"talk"})}a_p3Announce(){this.p3.openAnnounce()}a_ring(){this.renderRoot.querySelector("sw-home-call")?.unhideRinging()}a_switchUser(){if(Qe()==="arx"){this.ovl=null,gs("logout");return}this.ovl={type:"switchHost"}}a_switchHostGo(){this.ovl=null;try{(window.top??window).location.assign("/profile/general")}catch{window.location.assign("/profile/general")}}a_kioskKey(e){const t=this.ovl;if(t?.type!=="kiosk")return;const s=e.dataset.k??"",a=s==="del"?t.code.slice(0,-1):t.code.length<8?t.code+s:t.code;this.ovl={...t,code:a,error:""}}a_kioskGo(){const e=this.ovl;e?.type!=="kiosk"||e.code.length<4||C("home/kiosk/exit",{code:e.code}).then(()=>{this.kioskUntil=Date.now()+Ca,this.ovl=null,this.toast("מסך הקיר פתוח לחמש דקות.")}).catch(t=>{this.ovl={type:"kiosk",code:"",error:M(t)}})}pg(e){return this.page[e]??0}pager(e,t){if(t<=1)return g;const s=Math.min(this.pg(e),t-1);return r`<div class="pager" role="group" aria-label="דפדוף"><button class="rb" data-act="page" data-key=${e} data-d="-1" ?disabled=${s===0} aria-label="הקודם">${p("back")}</button><span class="pg num" aria-live="polite">${s+1} מתוך ${t}</span><button class="rb" data-act="page" data-key=${e} data-d="1" ?disabled=${s>=t-1} aria-label="הבא">${p("fwd")}</button></div>`}seg(e,t,s,a){return r`<div class="seg" role="group" aria-label=${a}>${t.map(([i,n])=>r`<button data-act=${e} data-v=${i} aria-pressed=${String(i===s)}>${n}</button>`)}</div>`}scopeSeg(){return this.ctx()?this.seg("scope",[["room","החדר הזה"],["floor","הקומה"],["house","כל הבית"]],this.scope,"איפה"):g}onlySeg(e,t,s){return this.seg(e,[["0","הכל"],["1",s]],t?"1":"0","סינון")}head(e,t,s){return r`<header class="hs-head"><div class="ttl"><h2 class="pg-t clamp1">${e}</h2>${t?r`<p class="sub clamp1">${t}</p>`:g}</div>${s?r`<div class="acts">${s}</div>`:g}</header>`}headT(e,t,s,a){return this.phone?r`${this.head(e,t,a)}<div class="bar tabsrow">${s}</div>`:this.head(e,t,r`${s}${a??g}`)}empty(e,t,s){return r`<div class="empty">${p(e)}<h2>${t}</h2><p>${s}</p></div>`}star(e){const t=this.favs(this.room).some(s=>ce(s,e));return r`<button class="rb star" data-act="star" data-ft=${e.t} data-fid=${e.id??""} aria-pressed=${String(t)} aria-label=${t?"הסר מהמועדפים":"הוסף למועדפים"}>${p("star")}</button>`}sw(e,t,s,a=""){return r`<button class="hsw" role="switch" aria-checked=${String(e)} data-act=${t} data-id=${a} aria-label=${s}><i></i></button>`}dimmer(e){const t=e.on?e.lvl:0;return r`<label class="dim${e.on&&e.lvl>=50?"":" lo"}"><span class="dim-fill" style=${`transform:scaleX(${t/100})`}></span><span class="dim-edge" style=${`transform:translateX(${-t}%)`}><i></i></span><input type="range" min="1" max="100" .value=${String(e.lvl)} data-dim=${e.id} ?disabled=${!e.can} aria-label=${"עוצמת "+e.name}><span class="dim-v num">${e.on?e.lvl+"%":"כבוי"}</span></label>`}lampBtn(e){return r`<button class="lamp" data-act="light" data-l=${e.id} aria-pressed=${String(e.on)} ?disabled=${!e.ok} aria-label=${e.name}>${p(e.sw?"switch":"bulb")}</button>`}swCtl(e){return r`<span class="swc"><span class="sw-t">${re(e.on)}</span><button class="hsw" role="switch" aria-checked=${String(e.on)} data-act="light" data-l=${e.id} ?disabled=${!e.ok} aria-label=${e.name}><i></i></button></span>`}trio(e){const t=(s,a,i)=>{const n=this.armed===`${e.id}:${s}`;return r`<button class="rb${n?" armed":""}" data-act="shade" data-id=${e.id} data-v=${s} ?disabled=${!e.can} aria-label=${n?i+": לחצו שוב לאישור":i}>${p(a)}</button>`};return r`<div class="trio">${t("open","up","פתח")}${t("stop","stop","עצור")}${t("close","down","סגור")}</div>`}camPic(e,t){return r`${e.ok?r`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" cameraId=${e.id} state="live" ?live=${t} profile="sub" autoProfile poster=${Ne(e.id)} .stillRefresh=${t?0:30}></sw-camera-tile>`:r`<div class="cam-off">${p("camoff")}<span>המצלמה לא זמינה כרגע</span></div>`}<div class="cap"><span class="clamp1">${e.name}</span>${e.ok?r`<span class="live"><i class="dot"></i>חי</span>`:g}</div>`}strip(e){const t=this.allDoors(),s=t.filter(d=>!d.locked),a=this.d.alerts.filter(d=>d.open).length,i=this.ctx(),n=e!=="r",o=this.kioskLocked(),l=this.favRooms(),h=l.indexOf(this.room),c=r`<span class="tb-t"><h1 class="clamp1">${i?i.name:"הבית שלי"}</h1><span class="tb-c clamp1">${i?we(this.d.floors,i.floor):this.userFull||this.userName}</span></span>`;return r`<header class="hs-strip">
      ${n?this.extBack(e)?r`<a class="tb-back" href=${this.href(this.extBack(e))} aria-label="חזרה">${p("back")}</a>`:r`<a class="tb-back" href=${this.href("r/"+this.room)} aria-label=${"חזרה אל "+(i?i.name:"הבית שלי")}>${p("back")}</a>`:g}
      ${o?r`<span class="tb-room">${c}</span>`:r`<a class="tb-room" href=${this.href("rooms")} aria-label=${"החלפת חדר. עכשיו: "+(i?i.name:"הבית שלי")}>${c}${p("down")}</a>`}
      ${l.length>1&&!o?r`<div class="tb-fav" role="group" aria-label="חדרים מועדפים"><button class="rb" data-act="roomStep" data-d="-1" aria-label="החדר המועדף הקודם">${p("back")}</button><span class="dots" aria-hidden="true">${l.map((d,m)=>r`<i class=${m===h?"on":""}></i>`)}</span><button class="rb" data-act="roomStep" data-d="1" aria-label="החדר המועדף הבא">${p("fwd")}</button></div>`:g}
      <div class="hs-now"><span class="time num">${qa.format(this.now)}</span><span class="date">${Ua.format(this.now)}</span>${this.d.weather&&this.d.weather.t!=null?r`<span class="wx" title="מזג האוויר בחוץ">${p("sun")}<span class="num">${this.d.weather.t}°</span><span class="wxt ellip">${this.d.weather.text}</span></span>`:g}</div>
      <div class="hs-status">
        ${this.calls.waiting?r`<button class="st-pill call" data-act="ring">${p("bell")}<span>מחכים בדלת</span></button>`:g}
        ${this.d.modules.has("doors")?r`<a class="st-pill" href=${this.href("doors")} data-tone=${t.length?s.length?"warn":"ok":"neutral"}><i class="dot"></i><span>${at(t)}</span></a>`:g}
        ${this.d.modules.has("alerts")?r`<a class="st-btn" href=${this.href("alerts")} aria-label=${"התראות"+(a?": "+a+" דורשות טיפול":"")}>${p("bell")}${a?r`<b class="count num">${a}</b>`:g}</a>`:g}
        <button class="st-me" data-act="menu" aria-haspopup="dialog" aria-label=${"התפריט של "+this.userName}><span class="av">${(this.userName||"?").slice(0,1)}</span></button>
      </div></header>`}nav(e){const t=Pa.filter(([,,,s])=>s!=="alerts"||this.d.modules.has("alerts")).filter(([,,,s])=>s!=="scenes"||this.d.modules.has("scenes")).filter(([,,,s])=>s!=="more"||!this.kioskLocked()&&!!this.extFor("more")&&Z(this).length>0);return e=this.extFor(e)?.navCur?.(e)??(lt(e)?"more":e),r`<nav class="hs-nav" aria-label="ניווט ראשי">${t.map(([s,a,i,n])=>r`<a href=${this.href(s)} aria-current=${e===n?"page":g}>${p(i)}<span>${n==="active"?r`פעיל<span class="nv-x"> עכשיו</span>`:a}</span></a>`)}</nav>`}extBack(e){const t=this.extFor(e);return t?.back?t.back(e):lt(e)&&e!=="more"?"more":null}nowBar(){const e=this.ctx(),t=e?e.lights.some(i=>i.on)||e.zones.some(fe):pe(this.visRooms()).length>0,s=e&&e.lights.some(i=>!i.sw)?Vs(e):null,a=e?st(e):Bs(this.visRooms());return r`<footer class="nowbar" aria-label=${e?"עכשיו ב"+e.name:"עכשיו בבית"}><a class="nb-t" href=${this.href("active")}><span class="nb-k">${e?"עכשיו בחדר":"עכשיו בבית"}</span><b class="clamp1">${a}</b></a>
      ${!e&&!this.phone?r`<span class="nb-rooms">${pe(this.visRooms()).slice(0,3).map(i=>r`<a class="chip2" href=${this.href("r/"+i.id)}><span class="clamp1">${i.name}</span></a>`)}</span>`:g}
      ${s!=null&&e?r`<span class="nb-ml">כל האורות</span><label class="dim master${s>=50?"":" lo"}"><span class="dim-fill" style=${`transform:scaleX(${s/100})`}></span><span class="dim-edge" style=${`transform:translateX(${-s}%);opacity:${s?1:0}`}><i></i></span><input type="range" min="0" max="100" .value=${String(s)} data-master=${e.id} aria-label=${"עוצמת כל האורות ב"+e.name}><span class="dim-v num">${s?s+"%":"כבוי"}</span></label>`:g}
      <button class="hbtn nb-off" data-act="roomOff" ?disabled=${!t}>${p("power")}<span class="bt">${e?"כיבוי החדר":"כיבוי כל הבית"}</span></button></footer>`}chips(){const e=this.ctx(),t=e?[e]:this.visRooms(),s=this.d.modules,a=[],i=t.reduce((f,v)=>f+v.lights.length+v.loads.length,0),n=A(t);i&&s.has("lights")&&a.push(["lights","תאורה","bulb",n===0?"כבויים":n===1?"אחד דולק":n+" דולקים",n>0?"lit":""]);const o=this.zonesOf(t);o.length&&s.has("climate")&&a.push(["climate","אקלים","thermo",e?o[0].mode==="off"?"כבוי":r`<span class="num">${o[0].target??"—"}°</span>`:`${o.filter(fe).length} פועלים`,""]);const l=t.flatMap(f=>f.shades);if(l.length&&s.has("shades")){const f=l.filter(v=>(v.pos??0)>0).length;a.push(["shades","תריסים","shade",f===0?"סגורים":f===1?"אחד פתוח":f+" פתוחים",""])}const h=t.flatMap(f=>f.doors);if(h.length&&s.has("doors")){const f=h.filter(v=>!v.locked).length;a.push(["doors","דלתות",f?"unlock":"lock",f?f===1?"אחת פתוחה":f+" פתוחות":"נעול",f?"warn":"ok"])}const c=e?this.d.cameras.filter(f=>e.cams.includes(f.id)):this.d.cameras;if(c.length&&s.has("cameras")){const f=c.filter(v=>!v.ok).length;a.push(["cameras","מצלמות","cam",e?f?"לא זמינה":"חי":f?`${c.length-f} מתוך ${c.length}`:c.length+" פועלות",""])}if(!e&&s.has("doors")&&this.visitors.length&&a.push(["doors","אינטרקום","phone",`${this.visitors.length} ביקורים`,"","intercom"]),!e&&this.d.energy&&this.d.energy.today.length&&s.has("energy")&&a.push(["energy","חשמל","bolt",r`<span class="num">${this.d.energy.today.reduce((f,v)=>f+v,0).toFixed(1)}</span> קוט״ש`,""]),!e&&this.panels.length&&s.has("security")){const f=this.panels.some(w=>w.state&&w.state!=="disarmed"),v=this.panels.some(w=>w.state==="triggered");a.push(["security","אבטחה","shield",v?"אזעקה!":f?"דרוך":"לא דרוך",v?"warn":f?"ok":""])}const d=e?this.d.scenes.filter(f=>f.rooms.includes(e.id)):this.d.scenes;s.has("scenes")&&this.d.scenes.length&&a.push(["scenes","סצנות","scenes",e?d.length?d.length+" בחדר":"של הבית":this.d.scenes.length+" בבית",""]),a.push(...this.p3.roomChips(e));const m=a.slice(0,8),u=m.find(f=>f[5]==="intercom");return u&&this.extFor("intercom")&&(u[0]="intercom"),!e&&this.extFor("more")&&!this.kioskLocked()&&Z(this).length&&m.push(["more","עוד","grid",this.moreChipText(),"","more"]),{n:m.length,t:m.map(([f,v,w,R,E,N])=>r`<a class="chip3" href=${this.href(f)} data-cat=${N??f}>${p(w,E==="lit"?"lit":"")}<span class="c3-t"><b>${v}</b><span class="c3-s" data-tone=${E==="ok"||E==="warn"?E:g}>${E==="ok"||E==="warn"?r`<i class="dot"></i>`:g}<span>${R}</span></span></span></a>`)}}moreChipText(){const e=this.extState.moreSummary??{tiles:Z(this).length,badges:0};return e.badges?e.badges===1?"דבר חדש":`${e.badges} חדשים`:`${e.tiles} נוספים`}widget(e,t){const s=ve(e,e.t==="light"&&!!this.findLight(e.id??"")?.sw),a=this.edit?r`<div class="wg-ed"><span class="ed-n clamp1">${this.favLabel(e)}</span><span class="ed-b"><button class="rb" data-act="wgMove" data-ix=${t} data-d="-1" aria-label="הזז אחורה">${p("back")}</button>${e.t==="light"&&!this.findLight(e.id??"")?.sw?r`<button class="rb" data-act="wgSize" data-ix=${t} aria-label=${s===2?"הקטן":"הגדל, עם עמעום"}>${p("size")}</button>`:g}<button class="rb" data-act="wgMove" data-ix=${t} data-d="1" aria-label="הזז קדימה">${p("fwd")}</button><button class="rb del" data-act="wgDel" data-ix=${t} aria-label="הסר מהמועדפים">${p("x")}</button></span></div>`:g,i=`tile wdg w${this.edit&&this.phone?2:s} h${nt(e)} wg-${e.t==="switch"?"load":e.t}${s===1?" s1":""}${this.edit?" editing":""}`;let n=g;if(e.t==="scene"){const o=this.d.scenes.find(l=>l.id===e.id);n=r`<button class="wg-btn scene${this.sceneRun===o.id?" run":""}" data-act="scene" data-scene=${o.id} aria-pressed=${String(this.activeScene()===o.id)}>${p(o.icon)}<span class="sn clamp2">${o.name}</span></button>`}else if(e.t==="light"){const o=this.findLight(e.id??""),l=this.room!==o.room;n=s===2?r`<div class="lrow wl2${o.on?" is-on":""}">${this.lampBtn(o)}<span class="ln"><b class="clamp1">${o.name}</b>${l?r`<span class="muted clamp1">${this.roomById(o.room)?.name??""}</span>`:g}</span>${this.dimmer(o)}</div>`:r`<button class="wg-btn ltile${o.on?" is-on":""}" data-act="light" data-l=${o.id} aria-pressed=${String(o.on)}>${p(o.sw?"switch":"bulb")}<span class="lt"><b class="clamp2">${o.name}</b></span><span class="lv num">${o.sw?re(o.on):o.on?o.lvl+"%":"כבוי"}</span></button>`}else if(e.t==="switch"){const o=this.findIn(l=>l.loads,e.id??"");n=r`<button class="wg-btn ltile ld${o.on?" is-on":""}" data-act="load" data-ld=${o.id} aria-pressed=${String(o.on)}>${p(this.loadIcon(o))}<span class="lt"><b class="clamp2">${o.name}</b></span><span class="lv">${re(o.on)}</span></button>`}else if(e.t==="climate"){const o=this.findIn(h=>h.zones,e.id??""),l=o.mode==="off";n=r`<a class="cover" href=${this.href("climate")} data-act="zoneGo" data-v=${o.id} aria-label=${"אקלים: "+o.name}></a><div class="wg-c"><span class="wg-k clamp1">${p("thermo")}${this.room===o.room?"אקלים":o.name}</span><b class="big num">${l||o.target==null?"—":o.target+"°"}</b><span class="muted">${l?"כבוי":r`עכשיו <span class="num">${o.temp??"—"}°</span>`}</span></div><div class="pm"><button class="rb" data-act="temp" data-zone=${o.id} data-d="-1" aria-label="קר יותר">${p("down")}</button><button class="rb" data-act="temp" data-zone=${o.id} data-d="1" aria-label="חם יותר">${p("up")}</button></div>`}else if(e.t==="cam"){const o=this.d.cameras.find(l=>l.id===e.id);n=r`<button class="wg-btn pic" data-act="cam" data-cam=${o.id} aria-label=${"מצלמה: "+o.name}>${this.camPic(o,!0)}</button>`}else if(e.t==="door"){const o=this.findIn(l=>l.doors,e.id??"");n=this.doorBody(o,!1)}else if(e.t==="shade"){const o=this.findIn(l=>l.shades,e.id??"");n=r`<span class="dn"><b class="clamp1">${o.name}</b><span class="muted">${it(o.pos,o.moving,o.state)}</span></span>${this.trio(o)}`}else if(e.t==="allLights"){const o=A(this.visRooms());n=r`<a class="cover" href=${this.href("lights")} aria-label="אורות"></a><div class="wg-c"><span class="wg-k">${p("bulb",o?"lit":"")}אורות בבית</span><b class="mid">${H(o)}</b></div><button class="hbtn" data-act="allOff" ?disabled=${!o}>${p("power")}<span class="bt">כבה הכל</span></button>`}else{const o=(this.d.energy?.today??[]).reduce((l,h)=>l+h,0);n=r`<a class="cover" href=${this.href("energy")} aria-label=${`חשמל היום: ${o.toFixed(1)} קוט״ש`}></a><div class="wg-c en1"><span class="wg-k">${p("bolt")}חשמל היום</span><b class="mid num">${o.toFixed(1)}</b><span class="muted">קוט״ש</span></div>`}return r`<div class=${i} data-ft=${e.t} data-fid=${e.id??""}>${n}${a}</div>`}doorBody(e,t){return r`<span class="di" data-tone=${e.locked?"ok":"warn"}>${p(e.locked?"lock":"unlock")}</span><span class="dn"><b class="clamp2">${e.name}</b><span class="dst" data-tone=${e.locked?"ok":"warn"}><i class="dot"></i>${e.ok?Hs(e):"לא זמינה כרגע"}</span></span>${(e.locked||e.wiskey)&&e.noOpen?r`<span class="dno clamp2" data-door-reason=${e.noOpen}>${Ws(e.noOpen)}</span>`:e.locked||e.wiskey?r`<button class="hbtn" data-act="doorAsk" data-door=${e.id} ?disabled=${!e.can}>פתח</button>`:r`<button class="hbtn" data-act="doorLock" data-door=${e.id} ?disabled=${!e.can}>נעל</button>`}${t?this.star({t:"door",id:e.id}):g}`}loadIcon(e){return{boiler:"drop",fridge:"fridge",socket:"plug",pump:"pump",other:"plug"}[e.type]}sRoom(){const e=this.ctx(),t=this.world(),s=this.favs(this.room).filter(d=>K(d,t)),a=this.phone?3:6,i=this.phone?5:3,n=d=>{const m=d[0],u=ve(m,m.t==="light"&&!!this.findLight(m.id??"")?.sw);return(this.phone&&(u===2||this.edit)?3:u)*nt(m)},o=Gs(s.map((d,m)=>[d,m]),n,a,i),l="fav-"+this.room,h=Math.min(this.pg(l),o.length-1),c=this.chips();return r`<nav class="chips3" style=${`--c:${c.n<=5?c.n:4}`} aria-label=${e?"מה יש ב"+e.name:"מה יש בבית"}>${c.t}</nav>
      <section class="favz" aria-label="מועדפים"><div class="bar"><h2>${e?"המועדפים שלי כאן":Xs(this.userName,this.now)}</h2><div class="acts">${this.pager(l,o.length)}<button class="hbtn" data-act="edit" aria-pressed=${String(this.edit)}>${p(this.edit?"check":"edit")}<span class="bt">${this.edit?"סיום":"עריכה"}</span></button></div></div>
        <div class="wgrid">${o[h].length?o[h].map(([d,m])=>this.widget(d,m)):this.empty("star","עוד אין כאן מועדפים","פתחו אורות, סצנות או מצלמות ולחצו על הכוכב כדי להצמיד אותם לכאן.")}</div></section>`}roomTile(e){const t=e.lights.some(a=>a.on),s=this.favRooms().includes(e.id);return r`<div class="tile room" data-room=${e.id} data-cur=${this.room===e.id?"1":g}><a class="cover" href=${this.href("r/"+e.id)} aria-label=${e.name}></a><div class="rt"><b class="clamp1">${e.name}</b><span class="meta">${e.temp!=null?r`<span class="num">${e.temp}°</span> · `:g}${Fs(e)}</span></div>${this.roomsEdit?r`<button class="lamp heart" data-act="favRoom" data-id=${e.id} aria-pressed=${String(s)} aria-label=${s?"הסר מהחדרים המועדפים":"הוסף לחדרים המועדפים"}>${p("heart")}</button>`:e.lights.length?r`<button class="lamp" data-act="roomLights" data-room=${e.id} aria-pressed=${String(t)} aria-label=${"האורות ב"+e.name}>${p("bulb")}</button>`:g}</div>`}sRooms(){const e=r`<button class="hbtn" data-act="roomsEdit" aria-pressed=${String(this.roomsEdit)}>${p(this.roomsEdit?"check":"heart")}<span class="bt">${this.roomsEdit?"סיום":"חדרים מועדפים"}</span></button><a class="hbtn${this.room==="home"?" cur":""}" href=${this.href("r/home")}>${p("home")}<span class="bt">הבית שלי</span></a>`,t=this.visRooms(),s=this.d.floors.filter(a=>t.some(i=>i.floor===a.id));if(!t.length)return r`${this.head("לאיזה חדר?","",e)}${this.empty("rooms","עוד אין חדרים","כשיוגדרו חדרים בבית, הם יופיעו כאן לפי קומות.")}`;if(this.phone){const a=s.some(n=>n.id===this.floor)?this.floor:s[0]?.id??"",i=_(t.filter(n=>n.floor===a),6,this.pg("roomsP"));return r`${this.head("לאיזה חדר?",this.roomsEdit?"סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה":`${t.length} חדרים ב-${s.length} קומות`,e)}<div class="bar">${this.seg("floor",s.map(n=>[n.id,n.short]),a,"קומה")}</div><div class="room-list">${i.items.map(n=>this.roomTile(n))}</div>${this.pager("roomsP",i.pages)}`}return r`${this.head("לאיזה חדר?",this.roomsEdit?"סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה או בחצים שלמעלה":"כל הבית לפי קומות. הנורה מדליקה ומכבה את החדר בלי להיכנס אליו.",e)}<div class="floors-cols" style=${`--n:${s.length}`}>${s.map(a=>{const i=t.filter(o=>o.floor===a.id),n=_(i,6,this.pg("fl-"+a.id));return r`<section class="fcol"><div class="fch"><h2>${a.name}</h2><span class="muted">${H(A(i))}</span></div><div class="fcl">${n.items.map(o=>this.roomTile(o))}</div>${this.pager("fl-"+a.id,n.pages)}</section>`})}</div>`}sLights(){const e=this.scopeRooms(),t=A(e),s=e.length>1,a=this.visRooms().some(c=>c.loads.length),i=this.lightScenes(),n=this.lightsTab==="loads"&&!a||this.lightsTab==="scenes"&&!i.length?"lights":this.lightsTab,o=this.seg("lightsTab",[["lights","אורות"],...a?[["loads","מפסקים"]]:[],...i.length?[["scenes","סצנות"]]:[]],n,"תצוגה");if(n==="scenes"){const c=_(i,this.phone?4:8,this.pg("lsc"));return r`${this.headT("תאורה","סצנות "+this.scopeWord(),o)}<div class="card-grid">${c.items.map(d=>this.sceneCard(d,!1))}</div>${this.pager("lsc",c.pages)}`}if(n==="loads"){let c=e.flatMap(u=>u.loads);const d=c.filter(u=>u.on).length;this.only&&(c=c.filter(u=>u.on));const m=_(c,this.phone?4:8,this.pg("loads"));return r`${this.headT(d===0?"כל המפסקים כבויים":d===1?"מפסק אחד דולק":`${d} מפסקים דולקים`,"מפסקים שאינם אור "+this.scopeWord()+'. "כיבוי הכל" וכיבוי חדר לא נוגעים בהם.',o)}
        <div class="bar wrap">${this.scopeSeg()}${this.onlySeg("only",this.only,"דולקים")}</div>
        <div class="card-grid">${m.items.length?m.items.map(u=>r`<div class="tile lcard sw${u.on?" is-on":""}" data-ft="switch" data-fid=${u.id}><button class="lamp ld" data-act="load" data-ld=${u.id} aria-pressed=${String(u.on)} ?disabled=${!u.ok} aria-label=${u.name}>${p(this.loadIcon(u))}</button><span class="ln"><b class="clamp1">${u.name}</b><span class="muted clamp1">${u.guard?"מוגן: שואל לפני כיבוי":'לא נכבה ב"כיבוי הכל"'}${s?" · "+(this.roomById(u.room)?.name??""):""}</span></span><span class="swc"><span class="sw-t">${re(u.on)}</span><button class="hsw" role="switch" aria-checked=${String(u.on)} data-act="load" data-ld=${u.id} ?disabled=${!u.ok} aria-label=${u.name}><i></i></button></span>${this.star({t:"switch",id:u.id})}</div>`):this.empty("plug",this.only?"אין מפסק דולק "+this.scopeWord():"אין מפסקים "+this.scopeWord(),'בחרו "כל הבית" או "הכל" כדי לראות עוד.')}</div>${this.pager("loads",m.pages)}`}let l=e.flatMap(c=>c.lights);this.only&&(l=l.filter(c=>c.on));const h=_(l,this.phone?3:8,this.pg("lights"));return r`${this.headT(H(t),this.scopeWord(),o,r`<button class="hbtn strong" data-act="scopeOff" ?disabled=${!t}>${p("power")}<span class="bt">כבה הכל</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg("only",this.only,"דולקים")}</div>
      <div class="card-grid">${h.items.length?h.items.map(c=>r`<div class="tile lcard lrow${c.sw?" sw":""}${c.on?" is-on":""}" data-ft="light" data-fid=${c.id}>${this.lampBtn(c)}<span class="ln"><b class="clamp1">${c.name}</b>${c.sw||s||!c.ok?r`<span class="muted clamp1">${[c.ok?"":"לא זמין כרגע",c.sw?"מפסק, בלי עמעום":"",s?this.roomById(c.room)?.name??"":""].filter(Boolean).join(" · ")}</span>`:g}</span>${c.sw?this.swCtl(c):this.dimmer(c)}${this.star({t:"light",id:c.id})}</div>`):this.empty("bulb",this.only?"אין אור דולק "+this.scopeWord():"אין אורות "+this.scopeWord(),this.only?'בחרו "הכל" כדי לראות את כל האורות.':"כשיחוברו אורות הם יופיעו כאן.")}</div>${this.pager("lights",h.pages)}`}lightScenes(){const e=this.ctx(),t=e?this.d.scenes.filter(s=>s.rooms.includes(e.id)):[];return[...t,...Te(this.world()).filter(s=>!t.includes(s))]}activeScene(){if(this.lastScene&&this.d.scenes.some(s=>s.id===this.lastScene))return this.lastScene;const e=new Date().toDateString();return this.d.scenes.filter(s=>s.lastRun&&new Date(s.lastRun).toDateString()===e).sort((s,a)=>Date.parse(a.lastRun??"")-Date.parse(s.lastRun??""))[0]?.id??null}sceneCard(e,t){return r`<div class="tile lcard sc${t?" big":""}" data-ft="scene" data-fid=${e.id}><button class="lamp go${this.sceneRun===e.id?" run":""}" data-act="scene" data-scene=${e.id} aria-pressed=${String(this.activeScene()===e.id)} aria-label=${"הפעל: "+e.name}>${p(e.icon)}</button><span class="ln"><b class="clamp1">${e.name}</b><span class="muted clamp1">${e.does||(e.rooms.length===1?"רק ב"+(this.roomById(e.rooms[0])?.name??"חדר אחד"):"סצנה של הבית")}</span></span>${this.star({t:"scene",id:e.id})}</div>`}dial(e){const t=e.min,s=e.max,a=135,i=270,n=118,o=150,l=150,h=f=>{const v=(a+i*Math.max(0,Math.min(1,(f-t)/(s-t||1))))*Math.PI/180;return[o+n*Math.cos(v),l+n*Math.sin(v)]},c=(f,v)=>{const[w,R]=h(f),[E,N]=h(v),oe=i*(v-f)/(s-t||1)>180?1:0;return`M${w.toFixed(1)} ${R.toFixed(1)}A${n} ${n} 0 ${oe} 1 ${E.toFixed(1)} ${N.toFixed(1)}`},d=e.mode==="off",[m,u]=h(e.temp??t);return r`<svg class="dial" viewBox="0 0 300 300" data-mode=${e.mode} role="img" aria-label=${`${d?"המיזוג כבוי":"מכוון ל-"+e.target+" מעלות"}, עכשיו ${e.temp??"לא ידוע"} מעלות`}><path class="trk" d=${c(t,s)}></path>${d||e.target==null?g:We`<path class="val" d=${c(t,Math.max(t+.01,e.target))}></path>`}${e.temp!=null?We`<circle class="now" cx=${m.toFixed(1)} cy=${u.toFixed(1)} r="7"></circle>`:g}</svg>`}sClimate(){const e=this.scopeRooms(),t=this.zonesOf(e),s=this.mainZone(e);if(!s)return r`${this.head("אקלים",this.scopeWord(),this.scopeSeg())}${this.empty("thermo","אין מיזוג "+this.scopeWord(),this.ctx()?'בחרו "כל הבית" כדי לראות את שאר המזגנים.':"כשיחובר מזגן או תרמוסטט, אפשר יהיה לכוון אותו מכאן.")}`;const a=_(t,4,this.pg("zones")),i=s.mode==="off",n=s.ok?i?"המיזוג כבוי":s.temp==null||s.target==null?le[s.mode]??"":s.temp>s.target?"מקרר עכשיו":s.temp<s.target?"מחמם עכשיו":"נעים בדיוק":"לא זמין כרגע",o=c=>Us.map(([d,m])=>r`<button class=${c} data-act="preset" data-zone=${s.id} data-v=${m} aria-pressed=${String(!i&&s.target===m)} ?disabled=${!s.can||m<s.min||m>s.max}><span>${d}</span>${c==="chip2"?r`<span class="num">${m}°</span>`:r`<b class="num">${m}°</b>`}</button>`),l=t.length>1&&!this.phone?r`<section class="zone-list" aria-label="אזורים">${a.items.map(c=>r`<button class="tile zrow" data-act="zone" data-v=${c.id} aria-pressed=${String(c.id===s.id)}><span class="zn clamp2">${c.name}</span><span class="zt"><b class="num">${c.mode==="off"?"כבוי":(c.target??"—")+"°"}</b><span class="muted">עכשיו <span class="num">${c.temp??"—"}°</span></span></span></button>`)}${this.pager("zones",a.pages)}</section>`:this.phone?g:r`<section class="tile pane clim-side"><h2>מצבים מוכנים</h2>${o("hbtn wideb")}</section>`,h=Object.entries(le).filter(([c])=>c==="off"||s.modes.includes(c)).filter(([c],d,m)=>m.findIndex(([u])=>le[u]===le[c])===d);return r`${this.head("אקלים",`${s.name} · ${n}`,r`${this.scopeSeg()}${this.phone&&t.length>1?r`<button class="hbtn" data-act="zones"><span class="clamp1">${s.name}</span>${p("down")}</button>`:g}`)}
      <div class="clim-body"><section class="tile thermo" aria-label=${s.name}>
        <div class="dial-wrap">${this.dial(s)}<div class="dial-c"><b class="huge num">${i||s.target==null?"—":s.target+"°"}</b><span class="muted">עכשיו <span class="num">${s.temp??"—"}°</span></span></div>
          <div class="dial-pm"><button class="rb xl" data-act="temp" data-zone=${s.id} data-d="-1" ?disabled=${!s.can} aria-label="קר יותר">${p("down")}</button><button class="rb xl" data-act="temp" data-zone=${s.id} data-d="1" ?disabled=${!s.can} aria-label="חם יותר">${p("up")}</button></div></div>
        ${t.length>1||this.phone?r`<div class="presets">${o("chip2")}</div>`:g}
        ${this.seg("modeSeg",h,s.mode==="heat_cool"?"auto":s.mode,"מצב")}</section>${l}</div>`}sShades(){const e=this.scopeRooms();let t=e.flatMap(i=>i.shades);const s=t.filter(i=>(i.pos??0)>0).length;this.shadesOnly&&(t=t.filter(i=>(i.pos??0)>0));const a=_(t,this.phone?4:8,this.pg("shades"));return r`${this.head(s===0?"כל התריסים סגורים":s===1?"תריס אחד פתוח":`${s} תריסים פתוחים`,this.scopeWord(),r`<button class="hbtn" data-act="shadesAll" data-v="open">${p("up")}<span class="bt">פתח הכל</span></button><button class="hbtn" data-act="shadesAll" data-v="close">${p("down")}<span class="bt">סגור הכל</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg("shadesOnly",this.shadesOnly,"פתוחים")}</div><div class="card-grid">${a.items.length?a.items.map(i=>r`<div class="tile lcard sh" data-ft="shade" data-fid=${i.id}><span class="ln"><b class="clamp1">${i.name}</b><span class="muted clamp1">${this.armed?.startsWith(i.id+":")?"לחצו שוב לאישור":it(i.pos,i.moving,i.state)}${e.length>1?" · "+(this.roomById(i.room)?.name??""):""}</span></span>${this.trio(i)}${this.star({t:"shade",id:i.id})}</div>`):this.empty("shade",this.shadesOnly?"אין תריס פתוח "+this.scopeWord():"אין תריסים "+this.scopeWord(),'בחרו "כל הבית" או "הכל" כדי לראות עוד.')}</div>${this.pager("shades",a.pages)}`}sDoors(){const e=this.allDoors(),t=this.doorsOnly?e.filter(n=>!n.locked):e,s=_(t,this.phone?3:4,this.pg("doors")),a=_(this.visitors,this.phone?2:4,this.pg("visitors")),i=n=>{const o=n.door_opened_by_name?`${n.door_opened_by_name} פתח/ה`:n.outcome==="answered"?n.answered_by_name?`${n.answered_by_name} ענה/תה`:"נענה":n.outcome==="missed"?"לא נענה":n.outcome==="rejected"?"נדחה":"הסתיים",l=n.door_opened_at||n.outcome==="answered"?"ok":n.outcome==="missed"?"warn":"neutral";return r`<div class="vrow"><span class="vp vp-ic">${p("bell")}</span><span class="vn"><b class="clamp1">צלצול</b><span class="muted clamp1">${n.station_name}</span></span><span class="vr"><span class="num">${je(n.rang_at)}</span><span class="vres" data-tone=${l}>${o}</span></span></div>`};return r`${this.head(this.phone?"דלתות":"דלתות ואינטרקום",at(e),r`${this.onlySeg("doorsOnly",this.doorsOnly,"לא נעולות")}${this.talkTo?r`<button class="hbtn" data-act="talk">${p("phone")}<span class="bt">דבר עם הכניסה</span></button>`:g}`)}
      <div class="doors-body"><section class="door-list" aria-label="דלתות">${s.items.length?s.items.map(n=>r`<div class="tile drow" data-ft="door" data-fid=${n.id}>${this.doorBody(n,!0)}</div>`):this.empty("door",this.doorsOnly&&e.length?"כל הדלתות נעולות":"אין דלתות מחוברות",this.doorsOnly&&e.length?"אין מה לנעול כרגע.":"כשתחובר דלת או אינטרקום, אפשר יהיה לפתוח ולראות מי הגיע.")}${this.pager("doors",s.pages)}</section>
      <section class="tile pane visitors" aria-label="מי הגיע"><div class="bar"><h2>מי הגיע</h2>${this.pager("visitors",a.pages)}</div>${a.items.length?a.items.map(i):r`<p class="muted">עוד לא הגיע אף אחד היום.</p>`}</section></div>`}sCameras(){const e=this.ctx(),t=e&&this.scope==="room"&&e.cams.length?this.d.cameras.filter(n=>e.cams.includes(n.id)):this.d.cameras,s=_(t,this.phone?4:6,this.pg("cams")),a=t.filter(n=>!n.ok).length,i=this.extFor("playback")&&this.recOk()?r`<a class="hbtn" href=${this.href("playback")} data-home-rec>${p("film")}<span class="bt">הקלטות</span></a>`:g;return r`${this.head("מצלמות",t.length?a===0?t.length===1?"המצלמה פועלת":"כל המצלמות פועלות":a===1?"מצלמה אחת לא זמינה כרגע":`${a} מצלמות לא זמינות כרגע`:"",r`${e&&e.cams.length?this.seg("scope",[["room","החדר הזה"],["house","כל הבית"]],this.scope==="room"?"room":"house","איפה"):g}${this.pager("cams",s.pages)}${t.length?i:g}`)}
      ${t.length?r`<div class=${`cam-grid n${Math.min(s.items.length,6)}`}>${s.items.map(n=>r`<div class="tile cam-t${n.ok?"":" off"}"><button class="wg-btn pic" data-act="cam" data-cam=${n.id} aria-label=${n.name}>${this.camPic(n,!1)}</button>${this.star({t:"cam",id:n.id})}</div>`)}</div>`:this.empty("cam","אין מצלמות מחוברות","כשתחובר מצלמה, התמונה שלה תופיע כאן.")}`}sEnergy(){const e=this.d.energy;if(!e||!e.today.length)return r`${this.head("חשמל","")}${this.empty("bolt","עוד אין נתוני חשמל","אחרי יום שימוש ראשון נראה כאן כמה חשמל הבית צורך.")}`;const t=this.period==="day",s=t?e.usual.map((f,v)=>[String(v).padStart(2,"0")+":00",e.today[v]==null?null:e.today[v],f]):e.week,a=s.reduce((f,v)=>f+(v[1]??0),0),i=s.reduce((f,v)=>f+(v[1]==null?0:v[2]),0),n=i>0?Math.round((a-i)/i*100):0,o=Math.max(.1,...s.map(f=>Math.max(f[1]??0,f[2]))),l=o>12?5:o>4?2:o>2?1:.5,h=Math.ceil(o/l)*l,c=[];for(let f=0;f<=h+1e-9;f+=l)c.push(f);const d=e.byRoom,m=Math.max(...d.map(f=>f[1]),.1),u=new Intl.DateTimeFormat("he-IL",{weekday:"long",timeZone:"Asia/Jerusalem"}).format(this.now);return r`${this.head(r`${t?"היום":"השבוע"}: <span class="num">${a.toFixed(1)}</span> קוט״ש`,r`${i>0?n===0?"כמו ביום רגיל":r`<span class="num">${Math.abs(n)}%</span> ${n<0?"פחות":"יותר"} מ${t?u+" רגיל":"שבוע רגיל"}`:""}${this.price!=null?r` · בערך <span class="num" data-energy-cost>₪${(a*this.price).toFixed(2)}</span>`:g}`,r`${this.p3.energyActs()}${this.seg("period",[["day","היום"],["week","השבוע"]],this.period,"תקופה")}`)}
      <div class="en-body"><section class="tile pane chart" aria-label=${"צריכה לפי "+(t?"שעה":"יום")}><div class="bar"><h2>${t?"לפי שעה":"לפי יום"}</h2><div class="legend"><span><i class="k today"></i>${t?"היום":"השבוע"}</span><span><i class="k usual"></i>${t?"יום רגיל":"שבוע רגיל"}</span></div></div>
        <div class="plot" style=${`--n:${s.length}`} @pointerover=${this.tipOver} @pointerleave=${this.tipOff} @focusin=${this.tipOver} @focusout=${this.tipOff}><div class="yax">${c.map(f=>r`<span style=${`bottom:${f/h*100}%`}><em class="num">${f}</em></span>`)}</div>
          <div class="cols">${s.map(f=>r`<div class=${"col"+(f[1]==null?" future":"")} tabindex="0" data-tip=${`${f[0]}|${f[1]==null?"":f[1].toFixed(1)}|${f[2].toFixed(1)}`}>${f[1]==null?g:r`<i class="b" style=${`height:${Math.max(1.5,f[1]/h*100)}%`}></i>`}<i class="u" style=${`bottom:${f[2]/h*100}%`}></i></div>`)}</div>
          <div class="xax">${s.map((f,v)=>r`<span>${t?v%3===0?r`<em class="num">${f[0].slice(0,2)}</em>`:g:f[0]}</span>`)}</div><div class="tip" hidden></div></div><p class="unit muted">קוט״ש ל${t?"שעה":"יום"}</p></section>
      <section class="tile pane byroom" aria-label="מה צורך הכי הרבה"><h2>איפה צורכים הכי הרבה</h2>${d.slice(0,5).map(f=>r`<div class="hb"><span class="hl clamp1">${f[0]}</span><span class="ht"><i style=${`transform:scaleX(${f[1]/m})`}></i></span><span class="hv num">${f[1].toFixed(1)}</span></div>`)}<p class="unit muted">קוט״ש היום</p></section></div>`}sAlerts(){const e=this.d.alerts.filter(i=>i.open),t=this.alertTab==="open"?e:this.d.alerts,s=_(t,4,this.pg("alerts")),a=e.length;return r`${this.head("התראות",a===0?"אין שום דבר שדורש טיפול":a===1?"דבר אחד מחכה לך":`${a} דברים מחכים לך`,this.seg("alertTab",[["open","מחכות לי"],["all","הכל"]],this.alertTab,"סינון"))}
      <div class="alert-list">${s.items.length?s.items.map(i=>r`<div class="tile arow${i.open?"":" done"}" data-tone=${i.tone}><span class="ai">${p(i.icon)}</span><span class="at"><b class="clamp2">${i.text}</b><span class="muted">${i.when}</span></span>${i.open&&i.canAck?r`<button class="hbtn" data-act="alertAck" data-id=${i.id}><span class="clamp1">הבנתי</span></button>`:i.open?g:r`<span class="muted done-t">${p("check")}טופל</span>`}</div>`):this.empty("check","הכל בסדר בבית","כשמשהו ידרוש את תשומת הלב שלך, הוא יופיע כאן.")}</div>${this.pager("alerts",s.pages)}`}sScenes(){const e=this.ctx(),t=e?[...Te(this.world()),...this.d.scenes.filter(i=>i.rooms.length===1&&i.rooms[0]===e.id)]:this.d.scenes,s=_(t,this.phone?4:8,this.pg("scenes")),a=this.d.scenes.some(i=>i.canEdit);return r`${this.head("סצנות",e?`של הבית ושל ${e.name}. נגיעה מפעילה.`:"נגיעה אחת מפעילה כמה דברים יחד.",a?r`<a class="hbtn" href=${this.href("settings/scenes")}>${p("edit")}<span class="bt">עריכת סצנות</span></a>`:g)}
      <div class="card-grid">${s.items.length?s.items.map(i=>this.sceneCard(i,!0)):this.empty("scenes","עוד אין סצנות","מנהל הבית יכול להגדיר סצנות שמפעילות כמה דברים יחד.")}</div>${this.pager("scenes",s.pages)}`}sActive(){const e=pe(this.visRooms()),t=yt(this.visRooms()),s=[...e.map(n=>({r:n})),...t.length?[{kept:t}]:[]],a=_(s,this.phone?4:5,this.pg("active")),i=A(this.visRooms());return r`${this.head("פעיל עכשיו בבית",e.length===0?"כל האורות והמיזוג כבויים":`${H(i)} · ${e.length===1?"חדר אחד פעיל":e.length+" חדרים פעילים"}`,r`<button class="hbtn strong" data-act="houseOff" ?disabled=${!e.length}>${p("power")}<span class="bt">כיבוי כל הבית</span></button>`)}
      <div class="alert-list act">${a.items.length?a.items.map(n=>"kept"in n?r`<div class="tile arow kept"><span class="ai">${p("plug")}</span><span class="at"><b class="clamp1">${n.kept.length===1?"מפסק אחד שאינו אור דולק":n.kept.length+" מפסקים שאינם אור דולקים"}</b><span class="muted clamp1">${n.kept.slice(0,3).map(o=>o.name).join(", ")}${n.kept.length>3?" ועוד":""} · לא נכבים ב"כיבוי כל הבית"</span></span><a class="hbtn" href=${this.href("lights")} data-act="goLoads">${p("fwd")}<span class="bt">למפסקים</span></a></div>`:r`<div class="tile arow"><span class="ai" data-on="1">${p("pulse")}</span><a class="at" href=${this.href("r/"+n.r.id)}><b class="clamp1">${n.r.name}</b><span class="muted">${st(n.r)} · ${we(this.d.floors,n.r.floor)}</span></a><button class="hbtn" data-act="roomOffId" data-room=${n.r.id}>${p("power")}<span class="bt">כבה</span></button></div>`):this.empty("night","הכל כבוי בבית","כשיידלק אור או מזגן, החדר יופיע כאן.")}</div>${this.pager("active",a.pages)}`}faceChoice(e){const t=!!this.pol()?.may_switch;return r`<div class="face-choice" role="radiogroup" aria-label="הממשק שלי">
      <button role="radio" aria-checked=${String(e==="home")} data-act="face" data-v="home" ?disabled=${!t}><span class="fc-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>ממשק ביתי</b><span>פשוט וגדול, לכל המשפחה</span></span>${p("check","tick")}</button>
      <button role="radio" aria-checked=${String(e==="full")} data-act="face" data-v="full" ?disabled=${!t}><span class="fc-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>ממשק מלא</b><span>כל היכולות, למי שמנהל את הבית</span></span>${p("check","tick")}</button>
    </div>${t?g:r`<p class="lock-note">${p("lock")}הממשק נקבע על ידי מנהל הבית.</p>`}`}sSettings(e){const t=(this.pol()?.wallpaper??"none")!=="none",s=["favs","rooms","scenes","themes","view",...t?["wall"]:[]].includes(e)?e:"favs",a=this.ctx(),i=this.world();let n=g;if(s==="favs"){const o=this.favs(this.room).filter(h=>K(h,i)),l=_(o.map((h,c)=>[h,c]),this.phone?5:8,this.pg("setFavs"));n=r`<p class="hint">המועדפים של ${a?a.name:"הבית שלי"}. מוסיפים בכוכב שליד כל אור, תריס, דלת, מצלמה או סצנה. אפשר לסדר גם במסך החדר עצמו, בכפתור "עריכה".</p><div class="set-list two">${l.items.length?l.items.map(([h,c])=>r`<div class="tile setrow"><span class="sname clamp1">${this.favLabel(h)}</span><span class="mv"><button class="rb" data-act="wgMove" data-ix=${c} data-d="-1" ?disabled=${c===0} aria-label="הזז למעלה">${p("up")}</button><button class="rb" data-act="wgMove" data-ix=${c} data-d="1" ?disabled=${c>=o.length-1} aria-label="הזז למטה">${p("down")}</button><button class="rb" data-act="wgDel" data-ix=${c} aria-label="הסר">${p("x")}</button></span></div>`):this.empty("star","עוד אין כאן מועדפים","לחצו על הכוכב שליד אור, תריס או מצלמה.")}</div>${this.pager("setFavs",l.pages)}`}else if(s==="rooms"){const o=this.d.floors,l=o.some(d=>d.id===this.floor)?this.floor:o[0]?.id??"",h=new Set(this.prefs.layout.hidden_rooms??[]),c=_(this.d.rooms.filter(d=>d.floor===l),this.phone?5:8,this.pg("setRooms"));n=r`<div class="bar wrap"><p class="hint">לב: חדר מועדף, עוברים אליו בהחלקה. מתג: האם החדר מופיע בכלל.</p>${this.seg("floor",o.map(d=>[d.id,d.short]),l,"קומה")}</div><div class="set-list two">${c.items.map(d=>r`<div class="tile setrow"><span class="sname clamp1">${d.name}</span><button class="lamp heart" data-act="favRoom" data-id=${d.id} aria-pressed=${String(this.favRooms().includes(d.id))} aria-label="חדר מועדף">${p("heart")}</button>${this.sw(!h.has(d.id),"roomVis","הצג את "+d.name,d.id)}</div>`)}</div>${this.pager("setRooms",c.pages)}`}else if(s==="scenes"){const o=_(this.d.scenes,this.phone?5:8,this.pg("setScenes"));n=r`<p class="hint">סצנה מפעילה כמה דברים בנגיעה אחת. ${this.d.scenes.some(l=>l.canEdit)?"את תוכן הסצנה עורכים בממשק המלא.":"רק מנהל הבית יכול לערוך סצנות."}</p><div class="set-list two">${o.items.map(l=>r`<div class="tile setrow">${p(l.icon)}<span class="sname"><b>${l.name}</b><span class="muted clamp1">${l.does}</span></span>${l.canEdit&&!this.pol()?.home_only?r`<a class="hbtn" href="#/devices/automations/scenes">${p("edit")}<span class="bt">עריכה</span></a>`:g}</div>`)}</div>${this.pager("setScenes",o.pages)}`}else if(s==="themes"){const o=this.getAttribute("data-hs-theme")??"classic",l=this.getAttribute("data-hs-scheme")??"dark",h=this.phone?_(J,4,this.pg("themes")):{items:J,pages:1};n=r`<div class="bar wrap"><p class="hint">הצבעים של הממשק הביתי שלי. צבעי המצב (תקין, שים לב, אזעקה) נשארים זהים בכל ערכה.</p>${this.seg("theme",[["dark","כהה"],["light","בהיר"]],l,"מראה")}</div>
        <div class="theme-grid" role="radiogroup" aria-label="ערכת נושא">${h.items.map(([c,d,m,u])=>r`<button class="tile thm" role="radio" aria-checked=${String(c===o)} data-act="hs" data-v=${c}><span class="thm-pv" data-hs-theme=${c} data-hs-scheme=${u===1?"dark":l} aria-hidden="true"><i class="pv-a"></i><i class="pv-b"></i><i class="pv-c"></i><i class="pv-d"></i></span><span class="thm-t"><b>${d}</b><span class="muted clamp2">${m}</span></span>${p("check","tick")}</button>`)}</div>${this.pager("themes",h.pages)}`}else if(s==="wall")n=this.wallSettings();else{const o=this.prefs.layout,l=J.find(h=>h[0]===(this.getAttribute("data-hs-theme")??"classic"))?.[1]??"";n=r`<div class="set-view"><section class="tile pane"><h2>הממשק שלי</h2>${this.faceChoice("home")}</section>
        <section class="tile pane"><h2>תצוגה</h2><div class="setrow flat"><span class="sname">מה נפתח ראשון</span>${this.seg("start",[["home","הבית שלי"],["last","החדר האחרון"],["fixed","חדר קבוע"]],o.start??"home","מסך פתיחה")}</div><div class="setrow flat"><span class="sname"><b>ערכת נושא</b><span class="muted">${l}, ${this.getAttribute("data-hs-scheme")==="light"?"בהיר":"כהה"}</span></span><a class="hbtn" href=${this.href("settings/themes")}>${p("palette")}<span class="bt">החלפה</span></a></div><div class="setrow flat"><span class="sname"><b>כתב גדול</b><span class="muted">מגדיל גם את האריחים</span></span>${this.sw(!!o.big_text,"bigText","כתב גדול")}</div></section></div>`}return r`${this.headT("הגדרות","המועדפים, החדרים והתצוגה שלי",this.seg("setTab",[["favs","מועדפים"],["rooms","חדרים"],["scenes","סצנות"],["themes",this.phone?"צבעים":"ערכות נושא"],...t?[["wall","רקע"]]:[],["view","תצוגה"]],s,"נושא"))}${n}`}sWelcome(){return r`<div class="welcome"><span class="mark big" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 24 16 7l10 17"></path><path d="M11 24h10"></path></svg></span><h1>שלום ${this.userName}, איך נוח לך לראות את הבית?</h1><p class="sub">אפשר להחליף בכל רגע מהתפריט האישי.</p>
      <div class="wl-choice" role="radiogroup" aria-label="בחירת ממשק">
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick==="home")} data-act="welcomePick" data-v="home"><span class="wl-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><b>ממשק ביתי</b><span>חדר אחרי חדר: מה שיש בחדר, המועדפים שלך, וכיבוי בנגיעה. בלי מונחים טכניים. מתאים לכל המשפחה ולמסך על הקיר.</span>${p("check","tick")}</button>
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick==="full")} data-act="welcomePick" data-v="full"><span class="wl-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>ממשק מלא</b><span>כל המסכים והיכולות: מפות, הקלטות, תזמונים, הרשאות והגדרות. מתאים למי שמנהל את הבית.</span>${p("check","tick")}</button>
      </div><button class="hbtn strong wide" data-act="welcomeGo">המשך</button></div>`}recOk(){return this.d.modules.has("cameras")&&this.d.cameras.length>0&&S("video.playback")}ovlHtml(){const e=this.ovl;if(!e)return g;if(e.type==="ext")return this.ext.find(t=>t.id===e.mod)?.ovl?.(e)??g;if(e.type==="p3")return this.p3.ovl(e);if(e.type==="cam"){const t=this.d.cameras.find(s=>s.id===e.id)??this.d.cameras[0];return t?r`<div class="hscrim solid"></div><section class="camfull" role="dialog" aria-modal="true" aria-label=${t.name}><div class="cf-pic">${t.ok?r`<sw-camera-tile class="scene-pic" dark noDemo cameraId=${t.id} state="live" live profile="main" autoProfile poster=${Ne(t.id)}></sw-camera-tile>`:r`<div class="cam-off big">${p("camoff")}<span>המצלמה לא זמינה כרגע</span><small>אנחנו מנסים להתחבר שוב. אין צורך לעשות דבר.</small></div>`}</div>
        <header class="cf-bar"><button class="rb onpic" data-act="close" aria-label="סגור">${p("x")}</button><div class="cf-t"><b class="clamp1">${t.name}</b>${t.ok?r`<span class="live onpic"><i class="dot"></i>חי</span>`:g}</div><span class="cf-nav"><button class="rb onpic" data-act="camStep" data-d="-1" aria-label="המצלמה הקודמת">${p("back")}</button><button class="rb onpic" data-act="camStep" data-d="1" aria-label="המצלמה הבאה">${p("fwd")}</button></span></header>${this.extFor("playback")&&this.recOk()?r`<footer class="cf-foot"><a class="hbtn onpic" href=${this.href("playback/"+encodeURIComponent(t.id))} data-act="closeNav" data-home-rec>${p("film")}הקלטות של המצלמה</a></footer>`:g}</section>`:g}if(e.type==="confirm"){const t=this.findIn(s=>s.doors,e.door);return t?r`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="אישור פתיחה"><span class="dlg-ic">${p("unlock")}</span><h2>לפתוח את ${t.name}?</h2><p class="muted">${t.kind==="gate"?"השער ייסגר שוב מעצמו.":"הדלת תינעל שוב מעצמה אחרי כמה שניות."}</p><div class="dlg-acts"><button class="hbtn strong" data-act="doorOpen" data-door=${t.id}>כן, פתח</button><button class="hbtn" data-act="close">ביטול</button></div></section>`:g}if(e.type==="ask")return r`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label=${e.title}><span class="dlg-ic">${p("check")}</span><h2 class="clamp2">${e.title}</h2><p class="muted">${e.text}</p><div class="dlg-acts"><button class="hbtn strong" data-act="askYes">${e.yes}</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;if(e.type==="guard"){const t=this.findIn(s=>s.loads,e.id);return t?r`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="אישור כיבוי"><span class="dlg-ic">${p(this.loadIcon(t))}</span><h2 class="clamp2">לכבות את ${t.name}?</h2><p class="muted">המפסק הזה מסומן כמוגן, כדי שלא יכבה בטעות.</p><div class="dlg-acts"><button class="hbtn strong" data-act="guardOff">כן, כבה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`:g}if(e.type==="menu"){const t=this.getAttribute("data-hs-scheme");return r`<div class="hscrim clear" data-act="close"></div><section class="sheet umenu" role="dialog" aria-modal="true" aria-label="התפריט האישי"><header class="menu-h"><span class="av lg">${(this.userName||"?").slice(0,1)}</span><span class="mh-t"><b class="clamp1">${this.userFull||this.userName}</b><span class="muted">${this.role}</span></span><button class="rb" data-act="close" aria-label="סגור">${p("x")}</button></header>
        <h3>הממשק שלי</h3>${this.faceChoice("home")}
        <div class="menu-rows"><a class="mrow" href=${this.href("settings/favs")} data-act="closeNav">${p("sliders")}<span>ההגדרות שלי</span>${p("fwd")}</a><button class="mrow" data-act="theme" data-v=${t==="dark"?"light":"dark"}>${p(t==="dark"?"sun":"night")}<span>${t==="dark"?"מראה בהיר":"מראה כהה"}</span></button>${Qe()?r`<button class="mrow" data-act="switchUser" data-home-switch-user>${p("user")}<span>החלף משתמש</span>${p("fwd")}</button>`:g}</div></section>`}if(e.type==="zones"){const t=this.zonesOf(this.scopeRooms()).slice(0,6),s=this.mainZone(this.scopeRooms());return r`<div class="hscrim" data-act="close"></div><section class="sheet bottom" role="dialog" aria-modal="true" aria-label="בחירת אזור"><span class="grab" aria-hidden="true"></span><h2>איזה חדר?</h2><div class="pick-list">${t.map(a=>r`<button class="mrow" data-act="zone" data-v=${a.id} aria-pressed=${String(a.id===s?.id)}><span class="clamp1">${a.name}</span><b class="num">${a.mode==="off"?"כבוי":(a.target??"—")+"°"}</b></button>`)}</div></section>`}if(e.type==="hold"){const t=this.favs(this.room).some(a=>ce(a,e.f)),s=this.ctx();return r`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="dialog" aria-modal="true" aria-label="מועדפים"><span class="dlg-ic">${p("star")}</span><h2 class="clamp2">${e.label}</h2><p class="muted">מועדף מופיע במסך החדר, בנגיעה אחת.</p><div class="pick-list wide"><button class="mrow" data-act="holdFav" data-k=${this.room}>${p("star")}<span>${t?"הסר מהמועדפים של ":"הוסף למועדפים של "}${s?s.name:"הבית שלי"}</span></button>${s?r`<button class="mrow" data-act="holdFav" data-k="home">${p("home")}<span>הוסף ל"הבית שלי"</span></button>`:g}<button class="mrow" data-act="close">${p("x")}<span>ביטול</span></button></div></section>`}if(e.type==="talk"){const t=this.talkTo;return t?r`<div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label=${"דבר עם "+t.name}><div class="call-video">${t.video?r`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${t.video} profile="sub"></sw-camera-tile>`:r`<div class="cam-off big">${p("camoff")}<span>אין תמונה מהכניסה הזו</span></div>`}</div>
        <div class="call-side"><p class="ring-line">${p("phone")}שיחה יוצאת</p><h1>מדברים עם ${t.name}</h1><p class="sub">נגיעה פותחת את המיקרופון. השיחה נסגרת בנגיעה נוספת.</p><div class="call-acts"><wk-talk-button dial idleLabel="דבר עם הכניסה" .stationId=${t.id} .talk=${t.talk}></wk-talk-button><button class="hbtn xl" data-act="close">סגור</button></div></div></section>`:g}if(e.type==="code"){const t=["1","2","3","4","5","6","7","8","9","del","0","go"];return r`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label=${e.title}><span class="dlg-ic">${p("shield")}</span><h2 class="clamp2">${e.title}</h2><p class="muted">${e.error||"הקלידו את הקוד."}</p><p class="kp-dots num" aria-live="polite">${e.code.replace(/./g,"•")||" "}</p><div class="kp-grid">${t.map(s=>s==="go"?r`<button class="hbtn strong" data-act="codeGo" ?disabled=${!e.code}>אישור</button>`:s==="del"?r`<button class="hbtn" data-act="codeKey" data-k="del" aria-label="מחק">${p("back")}</button>`:r`<button class="hbtn num" data-act="codeKey" data-k=${s}>${s}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">ביטול</button></div></section>`}if(e.type==="switchHost")return r`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="החלפת משתמש" data-home-switch-host><span class="dlg-ic">${p("user")}</span><h2>החלפת משתמש</h2><p class="muted">הכניסה כאן היא של מערכת הבית. נפתח את דף החשבון שלה: שם יוצאים, והאדם הבא נכנס בשם שלו.</p><div class="dlg-acts"><button class="hbtn strong" data-act="switchHostGo">לדף החשבון</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;if(e.type==="kiosk"){const t=["1","2","3","4","5","6","7","8","9","del","0","go"];return r`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label="יציאה ממסך הקיר"><span class="dlg-ic">${p("lock")}</span><h2>קוד מנהל</h2><p class="muted">${e.error||"הקוד פותח את מסך הקיר לחמש דקות."}</p><p class="kp-dots num" aria-live="polite">${e.code.replace(/./g,"•")||" "}</p><div class="kp-grid">${t.map(s=>s==="go"?r`<button class="hbtn strong" data-act="kioskGo" ?disabled=${e.code.length<4}>אישור</button>`:s==="del"?r`<button class="hbtn" data-act="kioskKey" data-k="del" aria-label="מחק">${p("back")}</button>`:r`<button class="hbtn num" data-act="kioskKey" data-k=${s}>${s}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">ביטול</button></div></section>`}return g}wallOf(e){const t=this.pol()?.wallpaper??"none",s=this.pol()?.room_wallpapers?.[e];if(t!=="none"&&s&&(this.pol()?.kiosk||!this.prefs.layout.wallpapers?.[e]))return"shared:"+s;const a=this.prefs.layout.wallpapers?.[e];return t==="none"||!a?null:a==="img"?t==="gallery_image"?a:null:et.some(i=>"g:"+i.id===a)?a:null}wallBg(e){const t=this.wallOf(e);if(t==="shared:img")return`url("${He("home/room-wallpapers/"+encodeURIComponent(e)+"/image")}") center / cover no-repeat`;const s=t?.startsWith("shared:")?t.slice(7):t;return s==="img"?`url("${He("home/wallpaper/"+encodeURIComponent(e))}?v=${this.wallStamp}") center / cover no-repeat`:tt(s?.slice(2)??"")}wallSettings(){const e=this.room,t=this.ctx(),s=this.prefs.layout.wallpapers?.[e]??"",a=this.pol()?.wallpaper==="gallery_image",i=[["","בלי רקע",""],...et.map(o=>["g:"+o.id,o.name,tt(o.id)])],n=_(i,this.phone?6:9,this.pg("wall"));return r`<div class="bar wrap"><p class="hint">הרקע של ${t?t.name:"הבית שלי"}. הוא מעומעם מאחורי הכפתורים, כדי שהכתב יישאר ברור.</p>${a?r`<label class="hbtn" data-wall-upload>${p("plus")}<span class="bt">${s==="img"?"החלפת התמונה שלי":"תמונה שלי"}</span><input type="file" accept="image/jpeg,image/png" hidden @change=${o=>this.uploadWall(o)}></label>${s==="img"?r`<button class="hbtn" data-act="wallDel">${p("x")}<span class="bt">הסרת התמונה</span></button>`:g}`:g}</div>
      <div class="wall-grid" role="radiogroup" aria-label="רקע לחדר">${n.items.map(([o,l,h])=>r`<button class="tile wall-opt" role="radio" aria-checked=${String(o===s)} data-act="wall" data-v=${o} data-wall-opt=${o||"none"}><span class="wall-pv" style=${h?`--hs-wall:${h}`:g} aria-hidden="true"></span><b class="clamp1">${l}</b>${p("check","tick")}</button>`)}</div>${this.pager("wall",n.pages)}`}a_wall(e){const t=e.dataset.v??"";this.saveLayout({wallpapers:{...this.prefs.layout.wallpapers??{},[this.room]:t}})}a_wallDel(){Ve(`home/wallpaper/${encodeURIComponent(this.room)}`,{method:"DELETE"}).then(e=>{this.prefs={...this.prefs,layout:e.layout},this.toast("התמונה הוסרה")}).catch(e=>this.toast(M(e)))}uploadWall(e){const t=e.target,s=t.files?.[0];if(t.value="",!s)return;if(!/^image\/(jpeg|png)$/.test(s.type))return this.toast("אפשר להעלות JPEG או PNG בלבד.");if(s.size>2e6)return this.toast("התמונה גדולה מ-2 MB.");const a=new FormData;a.append("file",s),Ve(`home/wallpaper/${encodeURIComponent(this.room)}`,{method:"PUT",body:a}).then(i=>{this.wallStamp=Date.now(),this.prefs={...this.prefs,layout:i.layout},this.toast("התמונה נשמרה כרקע")}).catch(i=>this.toast(M(i)))}render(){if(!this.data)return r`<div class="hs v2 bare"><main class="hs-main">${this.error?this.empty("x","לא הצלחנו לטעון את הבית",this.error):r`<div class="empty loading" aria-busy="true">${p("home")}<h2>טוענים את הבית…</h2></div>`}</main></div>`;const e=this.route(),t=this.pol();if(e.name==="welcome")return r`<div class="app-root" @click=${this.onClick}><div class="hs bare"><main class="hs-main enter">${this.sWelcome()}</main></div>${this.toasts()}</div>`;let s=e.name;this.kioskLocked()&&s==="rooms"&&(s="r"),s==="settings"&&t?.kiosk&&this.kioskLocked()&&(s="r");const a=s==="r"?this.room==="home"?"home":"":s,i=this.extFor(s),n=i?i.render(s,e.arg):s==="r"?this.sRoom():s==="rooms"?this.sRooms():s==="lights"?this.sLights():s==="climate"?this.sClimate():s==="shades"?this.sShades():s==="doors"?this.sDoors():s==="cameras"?this.sCameras():s==="energy"?this.sEnergy():s==="alerts"?this.sAlerts():s==="scenes"?this.sScenes():s==="active"?this.sActive():this.sSettings(e.arg),o=this.path!==this.lastRoute;return this.lastRoute=this.path,r`<div class="app-root" @click=${this.onClick} @input=${this.onInput} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove} @pointerup=${this.onPointerUp} @pointercancel=${()=>{window.clearTimeout(this.holdT),this.swipe=null}} @keydown=${this.onKey}>
      <div class=${"hs v2"+(this.kioskLocked()?" kiosk":"")+(s==="r"&&this.wallOf(this.room)?" walled":"")} data-screen=${s} data-wall=${s==="r"?this.wallOf(this.room)??g:g} style=${s==="r"&&this.wallOf(this.room)?`--hs-wall:${this.wallBg(this.room)}`:g}>${this.strip(s)}${this.nav(a)}<main class=${"hs-main"+(o?" enter":"")} id="main">${n}</main>${this.nowBar()}</div>
      <div class="ovl">${this.ovlHtml()}</div>${this.toasts()}
      <sw-home-call data-hs-theme=${this.getAttribute("data-hs-theme")??"classic"} data-hs-scheme=${this.getAttribute("data-hs-scheme")??"dark"} ?data-hs-big=${this.hasAttribute("data-hs-big")} @home-calls=${l=>{this.calls=l.detail}}></sw-home-call></div>`}toasts(){const e=this.toastMsg;return r`<div class="toasts" aria-live="polite">${e?r`<div class="toast2"><span>${e.text}</span>${e.undo?r`<button data-act="undo">ביטול</button>`:g}</div>`:g}</div>`}};k.styles=[vt,ra,wt,Ra];$([ie()],k.prototype,"path",2);$([ie()],k.prototype,"userName",2);$([ie()],k.prototype,"userFull",2);$([ie()],k.prototype,"role",2);$([ie({attribute:!1})],k.prototype,"policy",2);$([z()],k.prototype,"data",2);$([z()],k.prototype,"error",2);$([z()],k.prototype,"prefs",2);$([z()],k.prototype,"room",2);$([z()],k.prototype,"scope",2);$([z()],k.prototype,"only",2);$([z()],k.prototype,"lightsTab",2);$([z()],k.prototype,"zone",2);$([z()],k.prototype,"period",2);$([z()],k.prototype,"alertTab",2);$([z()],k.prototype,"edit",2);$([z()],k.prototype,"roomsEdit",2);$([z()],k.prototype,"doorsOnly",2);$([z()],k.prototype,"shadesOnly",2);$([z()],k.prototype,"floor",2);$([z()],k.prototype,"page",2);$([z()],k.prototype,"ovl",2);$([z()],k.prototype,"wallStamp",2);$([z()],k.prototype,"toastMsg",2);$([z()],k.prototype,"armed",2);$([z()],k.prototype,"sceneRun",2);$([z()],k.prototype,"phone",2);$([z()],k.prototype,"now",2);$([z()],k.prototype,"visitors",2);$([z()],k.prototype,"kioskUntil",2);$([z()],k.prototype,"welcomePick",2);$([z()],k.prototype,"panels",2);$([z()],k.prototype,"calls",2);$([z()],k.prototype,"talkTo",2);$([z()],k.prototype,"lastScene",2);$([z()],k.prototype,"price",2);k=$([gt("sw-home")],k);export{k as SwHome,J as THEMES};
//# sourceMappingURL=sw-home-CMHh2esV.js.map
