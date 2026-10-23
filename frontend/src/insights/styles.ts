import { css } from 'lit';

/** CR-INSIGHT215: the look of the insight screens (the approved mock-up docs/design/mockups/insight-215), on the product's v2 tokens only. */
export const insightCss = css`
  :host {
    display: block;
    padding: 14px var(--sw-page-pad) 32px;
    max-inline-size: var(--sw-content-max);
    inline-size: 100%;
    box-sizing: border-box;
    color: var(--sw-text);
    font-family: var(--sw-font);
  }
  * { box-sizing: border-box; }
  h1 { font-size: var(--sw-fs-3xl); line-height: 1.2; margin: 0; color: var(--sw-heading); font-weight: 700; letter-spacing: -0.6px; }
  .crumbs { font-size: var(--sw-fs-sm); color: var(--sw-text-2); margin-block-end: 2px; }
  .crumbs a { color: inherit; text-decoration: none; }
  .crumbs a:hover { color: var(--sw-accent-text); }
  .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
  .pages { margin-block-end: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-block-end: 14px; }
  .kpi { --c: var(--sw-accent); display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--sw-r-md); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); font: inherit; color: inherit; text-align: start; }
  button.kpi { cursor: pointer; }
  .kpi[aria-pressed='true'] { border-color: var(--c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 35%, transparent); }
  .kpi .dot { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 18%, transparent); }
  .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1; font-variant-numeric: tabular-nums; }
  .kpi b small { font-size: var(--sw-fs-xs); font-weight: 500; }
  .kpi .l { font-size: var(--sw-fs-state); color: var(--sw-text-2); }
  .kpi .d { font-size: var(--sw-fs-xs); }
  .kpi[data-look='bad'] { --c: var(--sw-danger); } .kpi[data-look='warn'] { --c: var(--sw-warning); } .kpi[data-look='ok'] { --c: var(--sw-success); } .kpi[data-look='unk'] { --c: var(--sw-unknown); }
  .kpi:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
  h2 { font-size: 15px; margin: 0; color: var(--sw-heading); font-weight: 600; }
  button { font: inherit; }
  .num, td.n, .date { font-variant-numeric: tabular-nums; }
  .muted { color: var(--sw-text-3); }
  .row { display: flex; align-items: center; gap: 10px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-block-end: 14px; }
  .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); }
  .pad { padding: 14px 16px; }
  .title { font-weight: 600; color: var(--sw-text); }
  .btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); border-radius: var(--sw-r-pill); padding: 7px 14px; min-block-size: var(--sw-ctl-h-sm); font-weight: var(--sw-fw-semibold); cursor: pointer; white-space: nowrap; text-decoration: none; }
  .btn:focus-visible, .chip:focus-visible, .seg button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
  .btn:hover { background: var(--sw-surface-2); }
  .btn:disabled { opacity: var(--sw-disabled-opacity, 0.5); cursor: default; }
  .btn.primary, .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
  .btn.primary:hover:not(:disabled), .btn.pri:hover:not(:disabled) { background: var(--sw-accent-hover); }
  .btn.icon { padding: 7px; inline-size: 36px; justify-content: center; }
  .seg { display: inline-flex; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); overflow: hidden; }
  .seg button { border: 0; background: var(--sw-surface); color: var(--sw-text-2); padding: 7px 12px; min-block-size: 34px; cursor: pointer; }
  .seg button + button { border-inline-start: 1px solid var(--sw-border-strong); }
  .seg button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: 600; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-pill); padding: 4px 11px; min-block-size: 30px; color: var(--sw-text-2); background: var(--sw-surface); cursor: pointer; white-space: nowrap; }
  .chip.sel { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; font-weight: 600; }
  .chip .n { font-variant-numeric: tabular-nums; opacity: 0.8; font-weight: 400; }
  .chip.off { color: var(--sw-text-3); border-style: dashed; cursor: default; }
  .chip sw-icon { --sw-icon-size: 13px; inline-size: 13px; block-size: 13px; }
  .chip:not(.sel):not(.off) sw-icon.tick { visibility: hidden; }
  .state { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 2px 9px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
  .state::before { content: ''; inline-size: 7px; block-size: 7px; border-radius: 50%; background: currentColor; }
  .s-ok { color: var(--sw-success-text); background: var(--sw-success-soft); }
  .s-bad { color: var(--sw-danger-text); background: var(--sw-danger-soft); }
  .s-warn { color: var(--sw-warning-text); background: var(--sw-warning-soft); }
  .s-unk { color: var(--sw-unknown-text); background: var(--sw-unknown-soft); }
  .up { color: var(--sw-danger-text); }
  .down { color: var(--sw-success-text); }

  .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 14px; align-items: start; }
  .layout.solo { grid-template-columns: minmax(0, 1fr); }
  .treecol { position: sticky; inset-block-start: 62px; }
  .place-m { display: none; }
  .toolbar { display: flex; gap: 10px 14px; align-items: center; flex-wrap: wrap; padding: 12px 14px; border-block-end: 1px solid var(--sw-border); }
  .toolbar .sp { flex: 1; }
  .month { display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); }
  .month button { border: 0; background: none; color: var(--sw-text-2); padding: 7px 8px; cursor: pointer; display: grid; place-items: center; border-radius: var(--sw-r-xs); min-inline-size: 34px; min-block-size: 34px; }
  .month button:hover:not(:disabled) { background: var(--sw-surface-2); }
  .month button:disabled { opacity: 0.35; cursor: default; }
  .month b { min-inline-size: 110px; text-align: center; font-weight: 600; }
  .picker { padding: 10px 14px; border-block-end: 1px solid var(--sw-border); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .rangefields { display: inline-flex; gap: 8px; align-items: center; }
  .inp { inline-size: 100%; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-xs); padding: 7px 10px; min-block-size: 36px; background: var(--sw-surface); color: var(--sw-text); font: inherit; font-variant-numeric: tabular-nums; }
  .inp.err { border-color: var(--sw-danger); }
  .rangefields .inp { inline-size: auto; }

  table { inline-size: 100%; border-collapse: collapse; }
  th { text-align: start; font-weight: 600; color: var(--sw-text-3); font-size: 12.5px; padding: 8px 12px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
  td { padding: 9px 12px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; }
  tr:last-child > td { border-block-end: 0; }
  td.n, th.n { text-align: end; white-space: nowrap; }
  tbody.click tr.hit { cursor: pointer; }
  tbody.click tr.hit:hover td { background: var(--sw-surface-2); }
  .tw { overflow-x: auto; }
  .det td { background: var(--sw-surface-2); }

  .doc { padding: 6px 0 2px; }
  .rs { padding: 16px 18px 18px; border-block-end: 1px solid var(--sw-border); }
  .rs:last-child { border-block-end: 0; }
  .rs .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-block-end: 12px; }
  .rs .rh .muted { font-size: 12.5px; }
  .rs a.muted { text-decoration: none; }
  .rs a.muted:hover { color: var(--sw-accent-text); }
  .figs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); }
  .fig { padding: 10px 14px; border-inline-start: 1px solid var(--sw-border); }
  .fig:first-child { border-inline-start: 0; }
  .fig .v { font-size: 20px; font-weight: 700; color: var(--sw-heading); font-variant-numeric: tabular-nums; line-height: 1.3; }
  .fig .v small { font-size: 12px; font-weight: 500; }
  .fig .l { color: var(--sw-text-3); font-size: 12.5px; }
  .fig .d { font-size: 12.5px; }
  .sumtab td:first-child { color: var(--sw-text-2); inline-size: 40%; }
  .split { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  .meter { block-size: 6px; border-radius: 99px; background: var(--sw-surface-3); overflow: hidden; min-inline-size: 60px; }
  .meter i { display: block; block-size: 100%; background: var(--sw-success); border-radius: 99px; }
  .meter i.w { background: var(--sw-warning); }
  .omitted { margin-block-start: 14px; }
  .omitted .ch-h { padding: 12px 16px; border-block-end: 1px solid var(--sw-border); }
  .omitted .o { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 16px; border-block-end: 1px solid var(--sw-border); }
  .omitted .o:last-child { border-block-end: 0; }
  .omitted .o span:first-child { color: var(--sw-text-2); }
  .reason { color: var(--sw-text-3); font-size: 12.5px; display: inline-flex; gap: 6px; align-items: center; }
  .reason sw-icon { inline-size: 14px; block-size: 14px; }

  .bars { display: flex; align-items: flex-end; gap: 10px; block-size: 110px; padding-block-start: 6px; border-block-end: 1px solid var(--sw-border-strong); position: relative; }
  .bars .col { flex: 1; max-inline-size: 48px; position: relative; block-size: 100%; display: flex; align-items: flex-end; }
  .bars .col i { display: block; inline-size: 100%; background: var(--sw-warning); border-radius: 2px 2px 0 0; min-block-size: 2px; }
  .bars .col u { position: absolute; inset-inline: -2px; border-block-start: 1.5px dashed var(--sw-text-3); text-decoration: none; }
  .axis { display: flex; justify-content: space-around; color: var(--sw-text-3); font-size: 11px; margin-block-start: 4px; font-variant-numeric: tabular-nums; }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-block-start: 10px; font-size: 12.5px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }

  .tl { position: relative; block-size: 46px; margin-block: 4px 2px; }
  .tl .track { position: absolute; inset-block-start: 20px; inset-inline: 0; block-size: 2px; background: var(--sw-border-strong); }
  .tl .win { position: absolute; inset-block-start: 12px; block-size: 18px; background: var(--sw-accent-soft); border-radius: 4px; inset-inline: 0; }
  .tl .open { position: absolute; inset-block-start: 14px; block-size: 14px; background: var(--sw-tl-door); border-radius: 3px; }
  .tl .mk { position: absolute; inset-block-start: 30px; font-size: 11px; color: var(--sw-text-3); white-space: nowrap; }
  .ev { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-xs); padding: 1px 7px; font-size: 12.5px; color: var(--sw-text-2); margin-inline-end: 4px; white-space: nowrap; }
  .ev sw-icon { inline-size: 13px; block-size: 13px; }
  .evs { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: 6px; }

  .blank { display: grid; place-items: center; text-align: center; gap: 10px; padding: 46px 20px; color: var(--sw-text-2); }
  .blank > sw-icon { inline-size: 30px; block-size: 30px; color: var(--sw-text-3); }
  .blank b { color: var(--sw-heading); font-size: 15px; }
  .skel { background: var(--sw-skeleton); border-radius: 6px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }

  .set { display: grid; gap: 14px; max-inline-size: 900px; }
  .sw { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-block-end: 1px solid var(--sw-border); }
  .sw:last-child { border-block-end: 0; }
  .fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 14px; padding: 14px 16px; }
  .fields label { display: grid; gap: 4px; color: var(--sw-text-3); font-size: 12.5px; align-content: start; }
  .ferr { color: var(--sw-danger-text); font-size: 12px; }
  .ch-h { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px; border-block-end: 1px solid var(--sw-border); }
  .formrow { display: grid; gap: 4px; margin-block-end: 12px; color: var(--sw-text-3); font-size: 12.5px; }
  .checks { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .checks label { display: inline-flex; gap: 6px; align-items: center; color: var(--sw-text); font-size: 14px; }
  .banner { padding: 10px 16px; border-radius: var(--sw-r-sm); font-size: 13px; }
  .banner.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
  .banner.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }

  @media (max-width: 900px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .treecol { display: none; }
    .place-m { display: inline-flex; }
    .split { grid-template-columns: minmax(0, 1fr); }
    .figs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fig:nth-child(3) { border-inline-start: 0; }
    .fig:nth-child(n + 3) { border-block-start: 1px solid var(--sw-border); }
    .fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hide-m { display: none; }
    .toolbar .sp { display: none; }
    .rs { padding: 14px 12px 16px; }
    td, th { padding: 8px 8px; }
  }
  @media (max-width: 520px) {
    .fields { grid-template-columns: minmax(0, 1fr); }
    .actions { inline-size: 100%; }
    .actions .btn { flex: 1; justify-content: center; }
  }
`;
