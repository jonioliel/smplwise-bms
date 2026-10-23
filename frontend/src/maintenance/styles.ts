import { css } from 'lit';
import { tempCss } from '../temperature/styles';

/**
 * CR-MAINT215 slice 2: the visual language of the maintenance section - the owner-approved mockup v2
 * (docs/design/mockups/maintenance-215/index.html), itself drawn from the REAL screens: the temperature page head, KPI row, solid
 * badges and soft chips (temperature/styles.ts, reused as is), the places tree (components/sw-place-tree.ts), the electricity table
 * (`table.t`, the toolbar search and the segmented control), the pill buttons, the sw-state-panel states and sw-dialog. Tokens only.
 */
export const maintCss = [tempCss, css`
  :host { --tc-acc: var(--sw-accent); display: flex; flex-direction: column; gap: 14px; min-inline-size: 0; }
  [data-look='acc'] { --c: var(--sw-accent); --c-text: var(--sw-accent-text); }
  [data-look='ok'] { --c-soft: var(--sw-success-soft); }
  [data-look='warn'] { --c-soft: var(--sw-warning-soft); }
  [data-look='alarm'] { --c-soft: var(--sw-danger-soft); }
  [data-look='unk'] { --c-soft: var(--sw-unknown-soft); }
  [data-look='acc'] { --c-soft: var(--sw-accent-soft); }
  .chip[data-look] { background: var(--c-soft); color: var(--c-text); }
  [hidden] { display: none !important; }
  .num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }
  .mut { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
  .btn.dng { color: var(--sw-danger-text); border-color: var(--sw-danger); }
  .btn.big { padding: 12px 18px; font-size: var(--sw-fs-lg); min-block-size: 48px; justify-content: center; }
  .btn sw-icon { flex: none; }
  .btn.pri:hover { background: var(--sw-accent-hover); }

  /* the page head (screens/infra-temperature.ts .top) */
  .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; color: var(--sw-heading); }
  .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
  .top .sp { flex: 1; }
  .top .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

  /* the KPI row: each a filter (aria-pressed) */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .kpi {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--sw-r-md); background: var(--sw-surface); border: 1px solid var(--sw-border);
    box-shadow: var(--sw-shadow-1); font: inherit; color: inherit; text-align: start; cursor: pointer;
  }
  .kpi:not([data-look]) { --c: var(--sw-accent); }
  .kpi[aria-pressed='true'] { border-color: var(--c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 35%, transparent); }
  .kpi .dot { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 18%, transparent); }
  .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1; font-variant-numeric: tabular-nums; color: var(--sw-heading); }
  .kpi span.l { font-size: var(--sw-fs-state); color: var(--sw-text-2); }
  .kpi:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }

  /* the places tree beside the list; a select on phones */
  .cols { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; align-items: start; min-inline-size: 0; }
  .cols > * { min-inline-size: 0; }
  .panel.flush { padding: 0; overflow: hidden; }
  .tree-m { display: none; }
  .tree-m select, .inp, select.inp {
    inline-size: 100%; font: inherit; color: var(--sw-text); background: var(--sw-surface-solid); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
    min-block-size: 36px; padding: 0 12px; box-sizing: border-box;
  }
  textarea.inp { padding: 8px 12px; min-block-size: 72px; resize: vertical; }
  .inp:focus { outline: none; border-color: var(--sw-accent); box-shadow: 0 0 0 3px var(--sw-accent-soft); }
  .inp[aria-invalid='true'] { border-color: var(--sw-danger); }

  /* the list toolbar: search + segmented control (electricity) */
  .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 14px; border-block-end: 1px solid var(--sw-border); }
  .search {
    flex: 1; min-inline-size: 180px; display: flex; align-items: center; gap: 8px; block-size: 32px; padding: 0 10px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2); color: var(--sw-text-3); box-sizing: border-box;
  }
  .search:focus-within { border-color: var(--sw-accent); box-shadow: 0 0 0 3px var(--sw-accent-soft); background: var(--sw-surface); }
  .search input { flex: 1; border: 0; background: transparent; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); outline: none; min-inline-size: 0; }
  .seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); max-inline-size: 100%; flex-wrap: wrap; }
  .seg button {
    padding: 5px 12px; border-radius: calc(var(--sw-r-sm) - 2px); color: var(--sw-text-2); cursor: pointer; font: inherit; font-size: var(--sw-fs-sm); white-space: nowrap; border: 0;
    background: transparent; min-block-size: 28px;
  }
  .seg button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
  .seg button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }

  /* the table (electricity table.t) */
  .scrollx { overflow-x: auto; }
  table.t { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-md); }
  table.t th {
    text-align: start; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 9px 12px; border-block-end: 1px solid var(--sw-border-strong);
    white-space: nowrap; background: var(--sw-surface-2);
  }
  table.t td { padding: 10px 12px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; white-space: nowrap; }
  table.t tbody tr:last-child td { border-block-end: 0; }
  table.t tbody tr.go { cursor: pointer; }
  table.t tbody tr.go:hover td { background: var(--sw-surface-2); }
  table.t tbody tr:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: -2px; }
  td .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  td .t2 { display: block; font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  td.date { font-variant-numeric: tabular-nums; }
  td.act { text-align: end; }
  td.act .btn + .btn { margin-inline-start: 6px; }
  .cards-m { display: none; }
  .nomatch { padding: 24px 16px; text-align: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  /* tablet (<= 1100, the electricity .hide-tablet rule): the supplier / last-run / request columns leave, the phone cards keep them */
  @media (max-width: 1100px) {
    .hide-tablet { display: none; }
    table.t th, table.t td { padding-inline: 8px; }
    table.t td.name { white-space: normal; min-inline-size: 150px; }
  }

  .skl { border-radius: var(--sw-r-md); background: linear-gradient(90deg, var(--sw-skeleton), var(--sw-skeleton-shine), var(--sw-skeleton)); background-size: 200% 100%;
    animation: skl 1.4s linear infinite; block-size: 160px; }
  @keyframes skl { to { background-position: -200% 0; } }
  .toast {
    position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 20px); inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw;
    background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2);
  }

  /* dialogs: the body of sw-dialog */
  .two { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; align-items: start; }
  .two > * { min-inline-size: 0; display: grid; gap: 14px; align-content: start; }
  .panel .hd { display: flex; align-items: center; gap: 10px; margin-block-end: 10px; flex-wrap: wrap; }
  .panel .hd .sp { flex: 1; }
  .kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 14px; margin: 0; font-size: var(--sw-fs-md); }
  .kv dt { color: var(--sw-text-3); }
  .kv dd { margin: 0; color: var(--sw-text); font-weight: var(--sw-fw-medium); overflow-wrap: anywhere; }
  .kv a { color: var(--sw-accent-text); }
  .bigdate { font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-bold); font-variant-numeric: tabular-nums; color: var(--sw-heading); line-height: 1.1; direction: ltr; unicode-bidi: isolate; }
  .form { display: grid; gap: 10px; }
  .fld { display: flex; flex-direction: column; gap: 5px; min-inline-size: 0; }
  .fld > label, .fld > .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
  .fld .err { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
  .row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
  .row > .fld { flex: 1 1 140px; }
  .check { display: inline-flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
  .hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .hist li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); }
  .hist .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c, var(--sw-success)); flex: none; }
  .hist .t { flex: 1; min-inline-size: 0; }
  .hist .w { color: var(--sw-text-2); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .alert { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-md); border: 1px solid transparent; }
  .alert.err { background: var(--sw-danger-soft); border-color: color-mix(in srgb, var(--sw-danger) 40%, transparent); color: var(--sw-text); }
  .alert.warn { background: var(--sw-warning-soft); }
  .alert > div { flex: 1; min-inline-size: 0; }
  .alert .acts { display: flex; gap: 8px; flex-wrap: wrap; margin-block-start: 8px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .li { display: flex; gap: 10px; align-items: center; padding: 12px; background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); min-inline-size: 0; }
  .li .grow { flex: 1; min-inline-size: 0; }
  .li .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
  .li .t2 { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  .foot { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; inline-size: 100%; }
  .foot .sp { flex: 1; }
  .items { display: grid; gap: 8px; }
  .item { display: grid; grid-template-columns: minmax(0, 1fr) 130px auto; gap: 8px; align-items: end; padding: 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
  .item .range { grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .item .range .inp { inline-size: 100px; }

  /* phone (<= 767): the tree becomes a select, the table becomes cards, the head stacks */
  @media (max-width: 767px) {
    .top { flex-direction: column; align-items: stretch; }
    .top .sp { display: none; }
    .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .cols { grid-template-columns: minmax(0, 1fr); }
    .tree-w { display: none; }
    .tree-m { display: block; padding: 10px 10px 0; }
    .tree-m select { min-block-size: 44px; }
    .toolbar { padding: 10px; gap: 8px; }
    .search { flex-basis: 100%; min-inline-size: 0; block-size: 44px; }
    .seg { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
    .seg button { min-block-size: 38px; flex: none; }
    .scrollx { display: none; }
    .cards-m { display: grid; gap: 8px; padding: 10px; }
    .cards-m .c { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 10px 12px; display: grid; gap: 6px; background: var(--sw-surface); cursor: pointer; text-align: start; font: inherit; color: inherit; }
    .cards-m .c:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .cards-m .c .r1 { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .cards-m .c .r1 .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); min-inline-size: 0; }
    .cards-m .c .r3 { display: flex; gap: 6px; flex-wrap: wrap; }
    .two { grid-template-columns: minmax(0, 1fr); }
    .btn { min-block-size: 44px; }
    .btn.sm { min-block-size: 36px; }
    .item { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    .skl { animation: none; }
  }
`];
