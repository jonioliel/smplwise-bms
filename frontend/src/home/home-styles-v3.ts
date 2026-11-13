// GENERATED from the approved round-27 home mockup v3 (private/design-system-2026-10-27/round27/home-full-v3/v3.css) by the same
// mechanical port as home-styles.ts: --sw-* renamed --hs-*, #ovl -> .ovl, [data-theme="light"] -> :host([data-hs-scheme="light"]), the demo
// panel dropped. HOME-V3-AUDITFIX-2437 hand-edits (design audit round 30): the phone / wide boundary queries (item 2) and the phone
// day stepper (item 1). The whole v3 sheet is ported once (HOME-V3-P1-2430) so phases 2 and 3 add screens without touching styles. Do not hand-edit;
// product-only additions go to home-styles-extra.ts.
import { css, unsafeCSS } from 'lit';

export const homeV3Styles = css`${unsafeCSS(String.raw`/* SmplWise Arx - home interface v3 (round 27, 2026-11-11). Loaded after home.css + v2.css + themes.css.
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
/* HOME-V3-FOLLOWUP-B-2431: the new ticket's photos - a picker label styled as a button (its file input hidden) and small previews */
.tkpick { position: relative; cursor: pointer; } .tkpick input { position: absolute; inline-size: 1px; block-size: 1px; opacity: 0; pointer-events: none; }
.tkpick[aria-disabled="true"] { opacity: .5; pointer-events: none; } .tkpick:focus-within { outline: 2px solid var(--hs-accent); outline-offset: 2px; }
.tkph { display: flex; align-items: center; gap: 10px; inline-size: 100%; min-inline-size: 0; } .tkph .muted { min-inline-size: 0; }
.tkph .ph { position: relative; flex: none; inline-size: 64px; block-size: 64px; border-radius: 12px; overflow: hidden; background: var(--hs-surface-3); }
.tkph .ph img { inline-size: 100%; block-size: 100%; object-fit: cover; display: block; }
.sheet .tkph .ph .rb { position: absolute; inset-block-start: 4px; inset-inline-end: 4px; inline-size: 30px; block-size: 30px; min-inline-size: 30px; min-block-size: 30px; padding: 0; background: var(--hs-surface-solid); }
.sheet .tkph .ph .rb .hi { inline-size: 16px; block-size: 16px; }
.sheet.v3.center { justify-items: center; text-align: center; }
.code { font-size: 44px; font-weight: 600; letter-spacing: .06em; color: var(--hs-heading); line-height: 1.3; }
.ovl .hbtn.talk { inline-size: 100%; } .ovl .hbtn.talk[aria-pressed="true"] { background: var(--hs-danger-soft); color: var(--hs-danger-text); }
.pin { display: flex; gap: 16px; justify-content: center; margin-block: 6px 10px; } .pin i { inline-size: 16px; block-size: 16px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--hs-border-strong); } .pin i.on { background: var(--hs-heading); box-shadow: none; }
.keys { display: grid; grid-template-columns: repeat(3, 76px); gap: 10px; justify-content: center; } .ovl .keys .rb { inline-size: 76px; block-size: 64px; border-radius: 18px; font-size: 24px; font-weight: 500; }
.rm { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; justify-items: center; gap: 14px; margin-block: 8px; inline-size: 100%; }
.rm-col { display: grid; gap: 10px; justify-items: center; } .dpad { display: grid; grid-template-columns: repeat(3, auto); gap: 8px; place-items: center; }
.ovl .dpad .rb.xl { font-size: 16px; font-weight: 600; background: var(--hs-accent); color: var(--hs-on-accent, #fff); }

/* ---- 1024 tablets: the category row stacks icon over text so nine fit */
@media (max-width: 1100px) and (min-width: 900px), (max-width: 1100px) and (min-width: 701px) and (orientation: landscape) {
  .chips3 { gap: 8px; } .chip3 { flex-direction: column; justify-content: center; gap: 4px; padding: 6px 4px; text-align: center; }
  .chip3 > .hi { inline-size: 28px; block-size: 28px; } .c3-t { justify-items: center; } .c3-t b { font-size: 15px; } .c3-s { font-size: 13px; } .c3-s .dot { display: none; }
  .hubt > .hi { inline-size: 34px; block-size: 34px; } .hubt .hl { font-size: 16px; } .hubt .hs2 { font-size: 13px; } .hub { gap: 10px; }
  .hs-head .acts .hbtn { padding: 0 14px; } .hs .pg-t { font-size: 24px; }
  .md-t b { font-size: 22px; } .prow { grid-template-columns: 44px minmax(0, 1fr) minmax(0, .7fr); }
}
@media (max-height: 800px) and (min-width: 900px), (max-height: 800px) and (min-width: 701px) and (orientation: landscape) { .nb { -webkit-line-clamp: 2; } .wd { min-block-size: 60px; } .alm-ic { inline-size: 64px; block-size: 64px; } .alm-ic .hi { inline-size: 32px; block-size: 32px; } .art { border-radius: 16px; } }

/* ---- phone */
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) {
  .nv-x { display: none; } .hs.v2 .hs-nav a { font-size: 11px; }
  .chip3[data-cat="more"] { display: none; }
  .hub { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block: 2px 8px; }
  .hubt { padding: 6px 4px; gap: 3px; } .hubt > .hi { inline-size: 28px; block-size: 28px; margin-block-end: 2px; } .hubt .hl { font-size: 14px; } .hubt .hs2 { font-size: 12px; } .hub .hubt > .count { inset-block-start: 6px; inset-inline-end: 6px; }
  .hs-head .pager .pg { min-inline-size: 48px; }
  .pb-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto auto; gap: 8px; }
  .pb-side { grid-row: 3; grid-column: 1; } .pb-ev { flex: none; min-block-size: 48px; } .pb-ctl { grid-row: 2; flex-wrap: wrap; gap: 6px 10px; padding: 8px 10px; justify-content: space-between; }
  .pb-ctl .tl { order: -1; flex: 1 1 100%; } .pb-ctl .hbtn { padding: 0 16px; } .hs-head .cf-nav:not(.pb-days) { display: none; } /* HOME-V3-AUDITFIX-2437 item 1: the day stepper stays */
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
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) { .wx-now { padding-block: 8px; } .wx-now .huge { font-size: 54px; } .wx-f { gap: 14px; } }
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) { .sys-grid, .sys-grid.n3 { grid-template-columns: minmax(0, 1fr); } .sys-grid.n3 > :first-child { grid-row: auto; } .sys { padding-block: 6px; } .sysr { flex-wrap: nowrap; } .sysr .dst { max-inline-size: 58%; } }

/* ---- loop 2: buttons that are tiles keep the tile surface; chips in sheets; smaller currency sign */
.hs .ncard, .hs .arow.tkrow, .hs .wd { background: var(--hs-surface); }
.ovl .chipset .chip2, .ovl .week.mini .wd { background: var(--hs-surface-3); }
.ovl .chipset .chip2[aria-pressed="true"], .ovl .week.mini .wd[aria-pressed="true"], .hs .wd[aria-pressed="true"] { background: var(--hs-accent-soft); color: var(--hs-accent-text); }
.cur { font-size: .7em; font-weight: 500; color: var(--hs-text-2); } .huge .cur { font-size: .4em; }
.cf-foot .hbtn { text-decoration: none; }
.gw { line-height: 1.3; }
@media (min-width: 900px), (min-width: 701px) and (orientation: landscape) { .gw { -webkit-line-clamp: 1; } }
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) { .en-body > .pane:has(.wbars) { flex: 1.6 1 0; } .en-body > .leak { flex: 1 1 0; } }

/* ---- loop 2 (break-ui, worst case) */
.pb-pic > .cam-off { position: absolute !important; inset: 0; padding-block-end: 16px; }
.pb-side .bar h2 { white-space: nowrap; }
.md-src .chip2 { white-space: nowrap; }
.steps.big .sp i { inline-size: 44px; block-size: 44px; flex: none; }
@media (max-width: 1100px) { .pb-side .pager { gap: 6px; } .pb-side .pager .pg { display: none; } .md-src .chip2 { padding: 0 12px !important; } }
@media (max-width: 700px), (max-width: 899px) and (orientation: portrait) { .leak .dlg-ic { display: none; } .leak { gap: 4px; padding-block: 10px; } .leak .hbtn { margin-block-start: 4px; } .en-body > .leak { flex: none; } }
.md-src .chip2 { min-inline-size: var(--hit); justify-content: center; }
`)}`;
