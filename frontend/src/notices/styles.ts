import { css } from 'lit';

/**
 * CR-NOTICE106: the visual language of the notice board's editing screens - the owner's standing style (the infrastructure
 * temperature / elevators / schedules screens: a head with h1 + subtitle + actions, KPI tiles that are filters, a table on the
 * desktop and cards on the phone, panels with a hairline). Type, radii and colours come from the design tokens only.
 */
export const noticesCss = css`
  :host { display: block; }
  [data-look='ok'] { --c: var(--sw-success); --c-text: var(--sw-success-text); --c-soft: var(--sw-success-soft); }
  [data-look='warn'] { --c: var(--sw-warning); --c-text: var(--sw-warning-text); --c-soft: var(--sw-warning-soft); }
  [data-look='alarm'] { --c: var(--sw-danger); --c-text: var(--sw-danger-text); --c-soft: var(--sw-danger-soft); }
  [data-look='off'] { --c: var(--sw-offline); --c-text: var(--sw-offline-text); --c-soft: var(--sw-offline-soft); }
  [data-look='acc'] { --c: var(--sw-accent); --c-text: var(--sw-accent-text); --c-soft: var(--sw-accent-soft); }
  [data-look='unk'] { --c: var(--sw-unknown); --c-text: var(--sw-unknown-text); --c-soft: var(--sw-unknown-soft); }
  .num { font-variant-numeric: tabular-nums; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  /* HDRFIX-295: this row is the page's own header (the <sw-page> above it is drawn without a heading), so it keeps what the shell reserves
     for the page's first row, as <sw-page>'s own header does: the developer / installer logos at the start (--sw-lead-reserve) and the
     floating corner at the end (--sw-float-reserve) - the title was drawn over the logos and the action button hung under the corner */
  .top { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-block-end: 14px;
    padding-inline-start: var(--sw-lead-reserve, 0px); padding-inline-end: var(--sw-float-reserve, 0px); }
  .top h1 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  .top .sub { margin: 2px 0 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .top .sp { flex: 1; }
  .top .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-block-end: 14px; }
  .kpi { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-lg); border: 1px solid var(--sw-border);
    background: var(--sw-surface); color: var(--sw-text); font: inherit; text-align: start; cursor: pointer; }
  .kpi[aria-pressed='true'] { border-color: var(--c, var(--sw-accent)); box-shadow: inset 0 0 0 1px var(--c, var(--sw-accent)); }
  .kpi .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c, var(--sw-accent)); flex: none; }
  .kpi b { display: block; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); line-height: 1.1; }
  .kpi span.l { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
  .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); padding: 14px 16px; min-inline-size: 0; }
  .panel.flush { padding: 0; overflow: hidden; }
  .panel .hd { display: flex; align-items: center; gap: 10px; margin-block-end: 10px; flex-wrap: wrap; }
  .panel .hd h2 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  .panel .hd .sp { flex: 1; }
  .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px 14px; border-block-end: 1px solid var(--sw-border); }
  .toolbar h2 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  .toolbar .sp { flex: 1; }
  .seg { display: inline-flex; border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); padding: 2px; gap: 2px; background: var(--sw-surface-2); flex-wrap: wrap; }
  .seg button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); padding: 5px 12px; border-radius: var(--sw-r-md); cursor: pointer; }
  .seg button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-text); box-shadow: var(--sw-shadow-1); font-weight: var(--sw-fw-medium); }
  .search { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-pill); padding: 4px 10px; background: var(--sw-surface-2); }
  .search input { font: inherit; font-size: var(--sw-fs-sm); border: 0; outline: 0; background: transparent; color: var(--sw-text); inline-size: 150px; }
  table.t { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
  table.t th { text-align: start; font-weight: var(--sw-fw-medium); color: var(--sw-text-3); font-size: var(--sw-fs-xs); padding: 8px 12px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
  table.t td { padding: 10px 12px; border-block-end: 1px solid var(--sw-border); vertical-align: top; color: var(--sw-text); }
  table.t tr:last-child td { border-block-end: 0; }
  table.t tr.go { cursor: pointer; }
  table.t tr.go:hover td { background: var(--sw-surface-2); }
  .t1 { display: block; font-weight: var(--sw-fw-medium); color: var(--sw-heading); }
  .t2 { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); margin-block-start: 2px; max-inline-size: 48ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mut { color: var(--sw-text-3); }
  .act { white-space: nowrap; text-align: end; }
  .badge { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 10px; white-space: nowrap; font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold); background: var(--c-soft, var(--sw-surface-2)); color: var(--c-text, var(--sw-text)); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 9px; font-size: var(--sw-fs-xs); background: var(--sw-surface-2);
    color: var(--sw-text-2); white-space: nowrap; max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; }
  .chip[data-look] { background: var(--c-soft); color: var(--c-text); }
  .new { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--sw-accent); display: inline-block; margin-inline-start: 6px; vertical-align: middle; }
  .cards { display: none; }
  .card { display: grid; gap: 6px; padding: 12px 14px; border-block-end: 1px solid var(--sw-border); }
  .card:last-child { border-block-end: 0; }
  .card .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .form { display: grid; gap: 12px; align-content: start; }
  .fld > .seg, .fld > .chips, .fld > .sum { justify-self: start; }
  .chips { align-items: center; }
  .form .r { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .fld { display: grid; gap: 4px; min-inline-size: 0; }
  .fld > label, .lbl { font-size: var(--sw-fs-xs); color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
  .inp { font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); background: var(--sw-surface-2); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md);
    padding: 7px 10px; min-inline-size: 0; inline-size: 100%; box-sizing: border-box; }
  textarea.inp { min-block-size: 96px; resize: vertical; }
  .inp:focus { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
  .inp.short { inline-size: 90px; }
  .ck { display: inline-flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
  .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-3); margin: 0; }
  .err { font-size: var(--sw-fs-xs); color: var(--sw-danger-text); }
  .pick { font: inherit; font-size: var(--sw-fs-xs); border: 1px solid var(--sw-border); background: var(--sw-surface-2); color: var(--sw-text-2); border-radius: var(--sw-r-pill);
    padding: 4px 10px; cursor: pointer; display: inline-flex; gap: 5px; align-items: center; }
  .pick[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: var(--sw-accent); }
  .pick:disabled { opacity: 0.5; cursor: default; }
  .sum { display: flex; gap: 6px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .sum b { color: var(--sw-heading); }
  .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
  .kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; font-size: var(--sw-fs-sm); }
  .kv dt { color: var(--sw-text-3); }
  .kv dd { margin: 0; color: var(--sw-text); }
  .toast { position: fixed; inset-block-end: 20px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-heading); color: var(--sw-text-inverse);
    padding: 8px 16px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); z-index: 50; box-shadow: var(--sw-shadow-2); }
  @media (max-width: 767px) {
    .scrollx { display: none; }
    .cards { display: block; }
    .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .search input { inline-size: 110px; }
  }
`;
