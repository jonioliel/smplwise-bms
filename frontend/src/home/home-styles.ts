// GENERATED from the approved round-25 home mockup (private/design-system-2026-10-27/round25/home-simple-v2: home.css + v2.css +
// themes.css) by a mechanical port: scoped to the home element's shadow root, --sw-* renamed --hs-*, the full-interface frame and the
// dev bar dropped. HOME-V3-AUDITFIX-2437 hand-edits (design audit round 30): the phone / wide boundary queries and the two easing fallbacks. Themes: data-hs-theme + data-hs-scheme on the host. Edit the mockup and regenerate rather than hand-editing here,
// except for the product-only additions in home-styles-extra.ts.
import { css, unsafeCSS } from 'lit';

export const homeMockupStyles = css`${unsafeCSS(String.raw`:host {
  --hs-ease: var(--sw-ease, cubic-bezier(.23, 1, .32, 1)); --hs-ease-drawer: var(--sw-ease-drawer, cubic-bezier(.32, .72, 0, 1));
  --hs-ease-in-out: var(--sw-ease-in-out, cubic-bezier(.77, 0, .175, 1)); --hs-t-med: var(--sw-t-med, 200ms);
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
.pick-grid {grid-template-columns: minmax(0, 1fr);}
.picker .mrow {min-block-size: 52px;}
.sheet.dialog {padding: 20px;}
}
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
.fav[data-fav="climate"] .pm {display: none;}
.fav[data-fav="climate"] .fsub {display: inline; flex-basis: auto;}
.ltile b.clamp1 {white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; overflow-wrap: anywhere;}
.hs-head .sub.clamp1 {white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3;}
}
.dim.lo .dim-v {right: auto; left: 16px;}
.rtemp {position: absolute !important; inset-block-end: 22px; right: 18px; font-size: 30px; font-weight: 500; line-height: 1; color: var(--hs-heading); pointer-events: none; letter-spacing: -.02em;}
.fcl .room .rtemp, .room-list .room .rtemp {position: relative !important; inset: auto; font-size: var(--f-body); color: var(--hs-text-2); margin-inline-end: 12px; flex: none;}
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
.nb-ml {display: none;}
.hs .nowbar .nb-t {flex: 1 1 0;}
.hs .nowbar .dim.master {flex: 1.1 1 0;}
}
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
.hs.v2 .hs-main, .hs.v2 .hs-main {padding-inline: 16px;}
.nowbar {margin-inline: 16px;}
}
.nb-rooms {overflow: hidden;}
.nb-rooms .chip2 {flex: none; max-inline-size: 18ch;}
.hs .wdg.wg-scene, .hs .wdg.wg-rscene, .hs .wdg.wg-cam, .hs .wdg.wg-light.s1 {padding: 0;}
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
.wg-btn.ltile .lt b {-webkit-line-clamp: 1; font-size: 14px;}
.hs .wg-btn.ltile {padding: 6px 10px !important; gap: 0;}
.wg-btn.ltile > .hi {inline-size: 22px; block-size: 22px;}
.wdg.editing .wg-ed {flex-wrap: nowrap;}
}
.wdg.editing > :not(.wg-ed) {opacity: 0;}
.wg-ed {flex-direction: column; flex-wrap: nowrap; gap: 4px;}
.ed-n {font-size: var(--f-sm); font-weight: 600; color: var(--hs-heading); max-inline-size: 100%; text-align: center;}
.ed-b {display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;}
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
.chips3 {grid-template-columns: repeat(var(--c, 4), minmax(0, 1fr));}
.wdg.editing .wg-ed {flex-direction: row; justify-content: space-between; padding-inline: 12px 8px; gap: 8px;}
.ed-n {flex: 1; text-align: start;}
.ed-b {flex: none; flex-wrap: nowrap; gap: 4px;}
}
.wdg.s1.editing > :not(.wg-ed) {opacity: .3;}
.wdg.s1.editing .ed-n {display: none;}
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
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
  --hs-offline-soft: var(--hs-surface-3);}`)}`;
