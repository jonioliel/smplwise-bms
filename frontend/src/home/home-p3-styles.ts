// HOME-V3-P3-2432: the styles of phase 3 (media, the announcement / remote / group sheets, the bill, water, the house systems, the map),
// ported mechanically from the approved round-27 mockup (private/design-system-2026-10-27/round27/home-full-v3/v3.css, the sections
// "media", "bill, water, systems", "the map", "v3 sheets" and their tablet / phone rules): --sw-* renamed --hs-*, #ovl -> .ovl,
// [data-theme="light"] -> :host([data-hs-scheme="light"]). Same tokens and rules as home-styles.ts: no scrolling on a control screen,
// green is status only, the plan and the progress bar are never mirrored.
import { css } from 'lit';

export const homeP3Styles = css`
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
  /* HOME-V3-FOLLOWUP-A-2431: "הצג חשבון" (the latest bill in the card, an icon per previous bill) */
  .blr:has(.bill-open) { grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; }
  .bill-now .bill-open { align-self: flex-start; margin-block-start: 4px; }
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
`;
