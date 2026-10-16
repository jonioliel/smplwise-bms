import { css } from 'lit';

/**
 * TKRFQ2: the few rules the RFQ screens add to the module's page frame (styles/automations-glass.ts + media-page.ts: .page, .dh, .seg,
 * .rc, .btn, .chip, .banner, .statebox, .glass, .fld, .inp). Mock-up v5 (ticket-module-v4/rfq.css): KPI glass tiles, request rows with a
 * vendor status bar, the vendors table (cards on a phone), the timeline card, the comparison grid with "הזולה" / "המוקדם", the sticky
 * action bar, the new-request sheet. Knobs only (--dv-* palette, --sw-* type / radius / space), logical properties only (RTL first).
 */
export const rfqStyles = css`
  /* the page frame (mediaPageStyles) makes every host a scroll container (overflow: auto); a step nested in tickets-rfqs must NOT be one:
     its sticky action bar would stick to this non-scrolling host (and stay at the end of the content) instead of the screen's scroller */
  :host(tickets-rfq-compare),
  :host(tickets-rfq-board),
  :host(tickets-rfq-order),
  :host(tickets-rfq-new) {
    overflow: visible;
  }
  sw-dialog {
    --sw-surface: var(--dv-surface-solid);
    --sw-glass-blur: none;
  }
  sw-drawer {
    --sw-drawer-modal-w: 760px;
  }
  .vh {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .crumbs {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    margin-block-end: 2px;
  }
  .crumbs a {
    color: inherit;
    text-decoration: none;
  }
  .crumbs a:hover {
    text-decoration: underline;
  }
  .titles {
    min-inline-size: 0;
  }
  .titles h1 {
    overflow-wrap: anywhere;
  }
  .subline {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .subline b {
    color: var(--dv-text);
  }
  .mut {
    color: var(--dv-text-2);
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  /* KPI glass tiles */
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--sw-s-3);
  }
  .kpi {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 18px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    box-shadow: var(--dv-shadow-1);
    min-inline-size: 0;
  }
  .kpi small {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .kpi b {
    font-size: var(--sw-fs-2xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--dv-text);
    overflow-wrap: anywhere;
  }
  .kpi.warn b {
    color: var(--dv-warning-text);
  }
  /* glass cards */
  .rcard {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    box-shadow: var(--dv-shadow-1);
    min-inline-size: 0;
  }
  .rcard > h2,
  .rcard > h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: 700;
  }
  .rcard > h2 .mut,
  .rcard > h3 .mut {
    font-size: var(--sw-fs-sm);
    font-weight: 500;
  }
  .rcard .act {
    margin-inline-start: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
  }
  /* the list: one row per request */
  .rlist {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rrow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(200px, 280px) auto;
    align-items: center;
    gap: 10px 18px;
    padding: 14px 18px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    box-shadow: var(--dv-shadow-1);
    color: inherit;
    text-decoration: none;
    min-block-size: 44px;
  }
  .rrow:hover {
    background: var(--dv-surface-solid);
  }
  .rrow:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .rrow .t {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-inline-size: 0;
  }
  .rrow .t b {
    font-size: var(--sw-fs-md);
    overflow-wrap: anywhere;
  }
  .rrow .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .rrow .end {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    text-align: end;
  }
  .ref {
    font-weight: 700;
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  /* the stacked vendor status bar of a request */
  .vbar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-inline-size: 0;
  }
  .vbar .track {
    display: flex;
    block-size: 8px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
    overflow: hidden;
  }
  .vbar .seg-q {
    background: var(--dv-success);
  }
  .vbar .seg-d {
    background: var(--dv-danger);
  }
  .vbar .seg-o {
    background: var(--dv-accent);
  }
  .vbar .seg-n {
    background: var(--dv-border-strong);
  }
  .vbar .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-2);
  }
  .vbar .legend span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .vbar .legend i {
    display: inline-block;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
  }
  /* the vendors table (cards on a phone) */
  .rtbl {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sw-fs-base);
  }
  .rtbl th {
    text-align: start;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--dv-text-2);
    padding: 6px 8px;
    border-block-end: 1px solid var(--dv-border);
  }
  .rtbl td {
    padding: 10px 8px;
    border-block-end: 1px solid var(--dv-border);
    vertical-align: middle;
  }
  .rtbl tr:last-child td {
    border-block-end: 0;
  }
  .vname {
    display: flex;
    align-items: center;
    gap: 10px;
    min-inline-size: 0;
  }
  .vname > span:last-child {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  .vname b {
    overflow-wrap: anywhere;
  }
  .vname small {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    overflow-wrap: anywhere;
  }
  .av {
    display: inline-grid;
    place-items: center;
    flex: none;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
  }
  .rowacts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
  }
  .ibtn {
    display: inline-grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--sw-r-pill);
    border: 1px solid transparent;
    background: transparent;
    color: var(--dv-text-2);
    cursor: pointer;
  }
  .ibtn:hover {
    background: var(--dv-surface-3);
    color: var(--dv-text);
  }
  .ibtn:focus-visible,
  .btn:focus-visible,
  .seg button:focus-visible,
  .rc:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .chan {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    white-space: nowrap;
  }
  /* TKRFQVP: the per-vendor verification-code switch under the channel */
  .chancol {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .codesw {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 40px;
    padding-inline: 12px;
    font-size: var(--sw-fs-sm);
  }
  .codesw svg {
    inline-size: 16px;
    block-size: 16px;
  }
  @media (pointer: coarse), (max-width: 767px) {
    .codesw {
      min-block-size: 44px;
    }
  }
  .reason {
    display: block;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    margin-block-start: 4px;
  }
  /* the timeline card */
  .tl {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tl li {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 10px;
    padding: 8px 0;
    border-block-end: 1px solid var(--dv-border);
    font-size: var(--sw-fs-sm);
  }
  .tl li:last-child {
    border-block-end: 0;
  }
  .tl time {
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .tl span {
    overflow-wrap: anywhere;
  }
  /* the sticky action bar at the bottom of a step */
  .bar2 {
    position: sticky;
    inset-block-end: 8px;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    padding: 12px 16px;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    box-shadow: var(--dv-shadow-2);
  }
  .bar2 .sum {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .bar2 .sum b {
    color: var(--dv-text);
  }
  /* the comparison grid: a label column and one column per quote */
  .cmpwrap {
    overflow-x: auto;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    box-shadow: var(--dv-shadow-1);
  }
  .cmp {
    display: grid;
    min-inline-size: 100%;
    inline-size: max-content;
  }
  .cmp > div {
    padding: 12px 14px;
    border-block-end: 1px solid var(--dv-border);
    border-inline-start: 1px solid var(--dv-border);
    font-size: var(--sw-fs-base);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .cmp > .lbl {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    border-inline-start: 0;
    background: var(--dv-surface-2-solid);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .cmp > .hd {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cmp > .hd.sel,
  .cmp > .sel {
    background: color-mix(in srgb, var(--dv-accent) 7%, transparent);
  }
  .cmp > .best {
    background: var(--dv-success-soft);
  }
  .cmp > .early {
    background: var(--dv-accent-soft);
  }
  .cmp .tag2 {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-success);
    color: var(--sw-text-inverse);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    margin-inline-start: 6px;
  }
  .cmp .tag2.e {
    background: var(--dv-accent);
  }
  .cmp .big {
    font-size: var(--sw-fs-lg);
    font-weight: 700;
  }
  .ctbl {
    border-collapse: separate;
    border-spacing: 0;
    min-inline-size: 100%;
  }
  .ctbl th,
  .ctbl td {
    padding: 12px 14px;
    border-block-end: 1px solid var(--dv-border);
    border-inline-start: 1px solid var(--dv-border);
    font-size: var(--sw-fs-base);
    text-align: start;
    vertical-align: top;
    min-inline-size: 200px;
    overflow-wrap: anywhere;
  }
  .ctbl th[scope='row'] {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    min-inline-size: 120px;
    inline-size: 150px;
    border-inline-start: 0;
    background: var(--dv-surface-2-solid);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .ctbl thead th {
    font-weight: 500;
  }
  .ctbl thead th[scope='col'] > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ctbl tr:last-child > * {
    border-block-end: 0;
  }
  .ctbl .sel {
    background: color-mix(in srgb, var(--dv-accent) 7%, transparent);
  }
  .ctbl .best {
    background: var(--dv-success-soft);
  }
  .ctbl .early {
    background: var(--dv-accent-soft);
  }
  .ctbl .tag2 {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-success);
    color: var(--sw-text-inverse);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    margin-inline-start: 6px;
  }
  .ctbl .tag2.e {
    background: var(--dv-accent);
  }
  .ctbl .big {
    font-size: var(--sw-fs-lg);
    font-weight: 700;
  }
  .pickrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-block-size: 44px;
    cursor: pointer;
    font-weight: 600;
  }
  .pickrow input {
    inline-size: 20px;
    block-size: 20px;
    margin: 0;
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    font-size: var(--sw-fs-sm);
  }
  .lines li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .lines label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 32px;
  }
  .scope {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .scope .seg button {
    padding-inline: 10px;
  }
  .thr {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .thr li {
    padding: 8px 10px;
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-2);
    font-size: var(--sw-fs-sm);
  }
  .thr li.me {
    background: var(--dv-accent-soft);
  }
  .thr small {
    display: block;
    color: var(--dv-text-2);
  }
  .group-h {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  /* the new-request sheet */
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .form section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .form h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: 700;
  }
  .form h3 .mut {
    font-size: var(--sw-fs-sm);
    font-weight: 500;
  }
  .frm {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 14px;
  }
  .frm .wide {
    grid-column: 1 / -1;
  }
  textarea.inp {
    border-radius: var(--sw-r-lg);
  }
  .fld textarea.inp {
    min-block-size: 96px;
    padding-block: 10px;
    resize: vertical;
    line-height: 1.5;
  }
  .fld .err,
  .err {
    color: var(--dv-danger);
    font-size: var(--sw-fs-sm);
  }
  .inp[aria-invalid='true'] {
    border-color: var(--dv-danger);
  }
  .dates {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .kinds .rc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 40px;
    padding-inline: 14px;
  }
  @media (pointer: coarse), (max-width: 767px) {
    .kinds .rc {
      min-block-size: 44px;
    }
  }
  .files {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 36px;
    padding-inline: 12px;
    border-radius: var(--sw-r-pill);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    font-size: var(--sw-fs-sm);
  }
  .vlist {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-block-size: 360px;
    overflow-y: auto;
    padding: 2px;
  }
  .vrow {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    min-block-size: 52px;
  }
  .vrow.on {
    border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    background: color-mix(in srgb, var(--dv-accent) 6%, var(--dv-surface-2));
  }
  .vrow > input[type='checkbox'] {
    inline-size: 20px;
    block-size: 20px;
    margin: 0;
  }
  .vrow .opts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }
  .vrow .seg button {
    padding-inline: 8px;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-block-size: 44px;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .chk input {
    inline-size: 18px;
    block-size: 18px;
    margin: 0;
  }
  .pv {
    margin: 0;
    padding: 12px 14px;
    border-radius: var(--sw-r-lg);
    border: 1px dashed var(--dv-border-strong);
    background: var(--dv-surface-2);
    font: inherit;
    font-size: var(--sw-fs-base);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .note {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .sheetfoot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .choice {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .choice label {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 2px 10px;
    align-items: start;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    cursor: pointer;
    min-block-size: 44px;
  }
  .choice label[aria-disabled='true'] {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .choice input {
    margin-block-start: 3px;
    inline-size: 18px;
    block-size: 18px;
  }
  .choice small {
    grid-column: 2;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .draft {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
  }
  .draft textarea.inp {
    min-block-size: 88px;
    padding-block: 10px;
    resize: vertical;
    line-height: 1.5;
  }
  .qlines {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .qline {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr) repeat(2, minmax(70px, 110px)) auto;
    gap: 8px;
    align-items: end;
  }
  .qline .one {
    grid-column: span 2;
  }
  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .totals b {
    color: var(--dv-text);
  }
  .thread {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-block-size: 220px;
    overflow-y: auto;
  }
  .thread .m {
    align-self: flex-start;
    max-inline-size: 85%;
    padding: 8px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .thread .m.out {
    align-self: flex-end;
    background: var(--dv-accent-soft);
  }
  .thread small {
    display: block;
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
  }
  .menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  @media (max-width: 1100px) {
    .grid2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (pointer: coarse), (max-width: 767px) {
    a.chip {
      block-size: auto;
      min-block-size: 44px;
    }
  }
  @media (max-width: 767px) {
    .dh-row {
      grid-template-areas: 't .';
      grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
    }
    .dh-det {
      gap: 10px;
    }
    .dh-det .stf {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      inline-size: 100%;
      box-sizing: border-box;
      border-radius: var(--sw-r-xl);
    }
    .dh-det .grow {
      display: none;
    }
    .dh-det .search {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .kpi {
      padding: 12px 14px;
    }
    .kpi b {
      font-size: var(--sw-fs-xl);
    }
    .rrow {
      grid-template-columns: minmax(0, 1fr);
    }
    .rrow .end {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      text-align: start;
    }
    /* the vendors table becomes cards: each cell a labelled line */
    .rtbl thead {
      display: none;
    }
    .rtbl,
    .rtbl tbody,
    .rtbl tr,
    .rtbl td {
      display: block;
    }
    .rtbl tr {
      padding: 10px 0;
      border-block-end: 1px solid var(--dv-border);
    }
    .rtbl tr:last-child {
      border-block-end: 0;
    }
    .rtbl td {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
      border: 0;
    }
    .rtbl td[data-l]::before {
      content: attr(data-l);
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      flex: none;
    }
    .rtbl td.first {
      display: block;
    }
    .tl li {
      grid-template-columns: minmax(0, 1fr);
      gap: 2px;
    }
    .frm,
    .dates {
      grid-template-columns: minmax(0, 1fr);
    }
    .vrow {
      grid-template-columns: auto auto minmax(0, 1fr);
    }
    .vrow .opts {
      grid-column: 1 / -1;
      justify-content: flex-start;
    }
    .qline {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .qline .one,
    .qline .desc {
      grid-column: 1 / -1;
    }
    /* the phone's dock is a row of the shell grid BELOW the scroller (and carries the safe-area inset itself): the bar only needs to sit at
       the scroller's bottom edge. While it only shows the hint it is one compact line; with a selection the summary scrolls inside it. */
    .bar2 {
      inset-block-end: 6px;
      flex-wrap: nowrap;
      gap: 8px 10px;
      padding: 8px 10px;
    }
    .bar2 .btn {
      flex: 0 0 auto;
      min-block-size: 44px;
    }
    .bar2 .sum {
      flex: 1 1 0;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 2px;
      max-block-size: 76px;
      overflow-y: auto;
      font-size: var(--sw-fs-xs, 12px);
      line-height: 1.35;
    }
    .bar2[data-empty] .sum {
      max-block-size: none;
    }
    :host(tickets-rfqs) {
      scroll-padding-block-end: 112px;
    }
  }
`;
