import{hu as rt,w as ot,E as de,C as Q,D as H,F as g,G as u,a as K,S as X,ou as s,t as m,x as O,A as d,e as n,q as $,bS as ye,H as G,j as A,R as lt,b as Z,oe as Ue,ov as Oe,of as he,h as ge,ow as Qe,k as v,ox as dt,oy as fe,oz as ct,oj as He,cp as S,na as V,o3 as te,nH as ve,nI as De,nJ as pt,nS as ht,B as ce,oA as ue,oB as ut,oC as Pe,oD as mt,oE as ft,oF as Ke,od as Me,oG as vt,o9 as Xe,p as Ne,oH as me,oI as $t,_ as bt,oJ as gt,o as yt,f as wt,s as kt,oK as xt,cL as qt,r as _t,oL as St}from"./index-Dspqd-4d.js";import{a as zt,c as oe,d as Nt,i as Ge,p as Ce,b as le,e as Tt,n as Ot,f as E,l as Se,g as Ye,w as W,h as D,T as Dt,D as Pt,P as Mt,t as Je,M as Ct,o as Ae,j as At,k as ke,m as Et,s as Lt,q as Rt,u as xe,v as Ee,r as x,x as Ze,y as Bt,z as Le,A as Ft,B as It,C as jt,E as Re,F as Vt,G as Wt,H as Ut,I as qe,K as Qt,J as Ht,L as Kt,N as Xt,O as Gt,Q as Be,R as Yt,S as Jt,U as Zt,V as es,W as ts,X as ss}from"./rfq-model-B2csl4rT.js";import{a as Te}from"./media-page-C-TDeDh_.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-DZMSEB5q.js";const as={columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v12"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',history:'<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5M12 8v4l3 2"/>',file:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',hand:'<path d="M6 12V7a2 2 0 0 1 4 0v4M10 11V5a2 2 0 0 1 4 0v6M14 11V7a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a2 2 0 0 1 3.4-2L8 13"/>',ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',clip:'<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',sheet:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 14h7M9 17h7M12 11v6"/>'};function b(e,t=""){return ot`<svg class=${t?`ic ${t}`:"ic"} viewBox="0 0 24 24" aria-hidden="true">${rt(as[e])}</svg>`}const Y=de`
  /* the page frame (mediaPageStyles) makes every host a scroll container (overflow: auto); a step nested in tickets-rfqs must NOT be one:
     its sticky action bar would stick to this non-scrolling host (and stay at the end of the content) instead of the screen's scroller */
  :host(tickets-rfq-compare),
  :host(tickets-rfq-board),
  :host(tickets-rfq-order),
  :host(tickets-rfq-new) {
    overflow: visible;
  }
  /* RFQQUESTIONS: a vendor question waiting for the manager - one unmistakable badge everywhere, the pending section at the top of a request */
  .qbadge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-block-size: 22px;
    padding-inline: 8px;
    border-radius: 999px;
    background: var(--sw-badge-bg);
    color: var(--sw-badge-fg); /* UXREST-295: readable text on the badge fill in both schemes */
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    white-space: nowrap;
  }
  .qbadge.seen {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text, var(--dv-text));
  }
  .qbadge svg {
    inline-size: 14px;
    block-size: 14px;
  }
  .qsec {
    display: grid;
    gap: var(--sw-s-2);
    padding: var(--sw-s-3);
    border-radius: var(--sw-r-lg);
    border: 1px solid color-mix(in srgb, var(--dv-danger) 40%, transparent);
    background: linear-gradient(var(--dv-danger-soft), var(--dv-danger-soft)), var(--dv-surface);
  }
  .qsec h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--sw-fs-md);
  }
  .qsec > small {
    color: var(--dv-text-2);
  }
  .qlist {
    display: grid;
    gap: var(--sw-s-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .qitem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 12px;
    align-items: start;
    padding: 10px 12px;
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-solid, var(--dv-surface));
  }
  .qitem .qmeta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-2);
  }
  .qitem p {
    margin: 4px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .qitem .rowacts {
    justify-content: flex-end;
  }
  .qbox {
    padding: 10px 12px;
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-2, var(--dv-surface));
  }
  .qbox p {
    margin: 4px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .thr pre.pv {
    margin-block-start: 6px;
    white-space: pre-wrap;
  }
  @media (max-width: 767px) {
    .qitem {
      grid-template-columns: minmax(0, 1fr);
    }
    .qitem .rowacts {
      justify-content: flex-start;
    }
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
  /* UXFIX-A11Y-295: a 16 px tall text link; the hit area grows to 44 px on touch, the line stays as drawn */
  @media (pointer: coarse) {
    .crumbs a {
      position: relative;
    }
    .crumbs a::after {
      content: '';
      position: absolute;
      inset-block: -14px;
      inset-inline: -4px;
    }
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
  .rmap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-block-start: 4px;
    padding-inline: 18px;
    min-block-size: 32px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    text-decoration: none;
  }
  .rmap:hover {
    color: var(--dv-text);
    text-decoration: underline;
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
  /* RFQATT: the send preview's list of the files each vendor receives */
  .sendfiles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .sendfiles li {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-sm);
  }
  .sendfiles li > span:nth-child(2) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sendfiles .th {
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--sw-r-sm);
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
  }
  .sendfiles .th img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
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
  .thread .m[data-rfq-system] {
    background: transparent;
    border: 1px dashed var(--dv-text-2);
    font-style: italic;
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
      font-size: var(--sw-fs-xs);
      line-height: 1.35;
    }
    .bar2[data-empty] .sum {
      max-block-size: none;
    }
    :host(tickets-rfqs) {
      scroll-padding-block-end: 112px;
    }
  }
`,ae={files:10,image_bytes:8*1024*1024,document_bytes:10*1024*1024,total_bytes:40*1024*1024,caption:200,types:["jpg","png","webp","pdf"],office:!1},et="application/vnd.openxmlformats-officedocument.wordprocessingml.document",tt="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";function st(e=ae){return e.types.includes("docx")||e.types.includes("xlsx")}function is(e=ae){const t=["image/jpeg","image/png","image/webp","application/pdf",".jpg",".jpeg",".png",".webp",".pdf"];return(st(e)?[...t,et,tt,".docx",".xlsx"]:t).join(",")}function ns(e=ae){return["JPG","PNG","WebP","PDF",...st(e)?["Word","Excel"]:[]].join(", ")}function be(e){const t=(e.name||"").toLowerCase(),a=(e.type||"").toLowerCase();return/^image\/(jpeg|png|webp)$/.test(a)||/\.(jpe?g|png|webp)$/.test(t)?"image":a==="application/pdf"||t.endsWith(".pdf")?"pdf":a===et||t.endsWith(".docx")?"docx":a===tt||t.endsWith(".xlsx")?"xlsx":null}function rs(e,t,a=ae){const i=t.filter(o=>!o.removed);let r=i.length,l=i.reduce((o,c)=>o+c.bytes,0);const p={accepted:[],refused:[]};for(const o of e){const c=be(o);c?(c==="docx"||c==="xlsx")&&!a.types.includes(c)?p.refused.push({name:o.name,reason:"office"}):o.size<=0||o.size>(c==="image"?a.image_bytes:a.document_bytes)?p.refused.push({name:o.name,reason:"size"}):r>=a.files?p.refused.push({name:o.name,reason:"count"}):c!=="image"&&l+o.size>a.total_bytes?p.refused.push({name:o.name,reason:"total"}):(p.accepted.push(o),r+=1,c!=="image"&&(l+=o.size)):p.refused.push({name:o.name,reason:"type"})}return p}function re(e,t="he"){const a=t==="en"?"KB":"ק״ב",i=t==="en"?"MB":"מ״ב";if(!Number.isFinite(e)||e<0)return"";if(e<1024*1024)return`${Math.max(1,Math.round(e/1024))} ${a}`;const r=e/(1024*1024);return`${r<10?r.toFixed(1).replace(/\.0$/,""):Math.round(r)} ${i}`}function Fe(e){return e.filter(t=>t.visible_vendors&&!t.removed)}function Ie(e,t){const a=(e||"").replace(/^.*[\\/]/,"");return`${(a.includes(".")?a.slice(0,a.lastIndexOf(".")):a).trim()||"file"}.${t==="image"?"jpg":t}`}var os=Object.defineProperty,ls=Object.getOwnPropertyDescriptor,ie=(e,t,a,i)=>{for(var r=i>1?void 0:i?ls(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&os(t,a,r),r};const ds={type:"fErrType",office:"fErrOffice",size:"fErrSize",count:"fErrCount",total:"fErrTotal"};let U=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.rows=[],this.limits=ae,this.editable=!1,this.busy=!1,this.notes=[],this.over=!1}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}pick(e){const t=Array.from(e??[]);if(!t.length||!this.editable||this.busy)return;const a=rs(t,this.rows.map(i=>({bytes:i.kind==="image"?0:i.bytes,removed:i.removed})),this.limits);this.notes=a.refused.map(i=>s(ds[i.reason],{name:i.name,n:this.limits.files})),a.accepted.length&&this.emit("files-picked",{files:a.accepted})}onDrop(e){e.preventDefault(),this.over=!1,this.pick(e.dataTransfer?.files)}icon(e){return e==="image"?m("image"):b(e==="xlsx"?"sheet":"file")}row(e){const t=O()==="en"?"en":"he",a=this.editable&&!e.removed;return n`<li class=${e.removed?"removed":""} data-rfq-file=${e.key} data-kind=${e.kind}>
      <span class="th">${e.thumb?n`<img src=${e.thumb} alt="" loading="lazy" decoding="async" />`:this.icon(e.kind)}</span>
      <span class="meta">
        <b title=${e.name}>${$(e.name)}</b>
        <small>${re(e.bytes,t)}${e.removed?n` · ${s("fRemoved")}`:d}${!e.visible&&!e.removed?n` · ${s("fInternal")}`:d}</small>
        ${a?n`<label><span class="vh">${s("fCaption")}</span><input class="inp" maxlength=${this.limits.caption} placeholder=${s("fCaption")} .value=${e.caption}
            ?disabled=${this.busy} data-rfq-file-caption @change=${i=>this.emit("file-caption",{key:e.key,caption:i.target.value.trim()})} /></label>`:e.caption?n`<small data-rfq-file-caption-ro>${$(e.caption)}</small>`:d}
      </span>
      <span class="acts">
        ${a?n`<label class="chk" data-rfq-file-visible><input type="checkbox" .checked=${e.visible} ?disabled=${this.busy}
            @change=${i=>this.emit("file-visible",{key:e.key,visible:i.target.checked})} />${s("fVisible")}</label>`:d}
        ${e.href?n`<a class="btn sm quiet" href=${e.href} target="_blank" rel="noopener noreferrer" ?download=${e.kind!=="image"} data-rfq-file-open>
            ${e.kind==="image"?m("eye"):b("download")}<span>${e.kind==="image"?s("fOpen"):s("fDownload")}</span></a>`:d}
        ${a?n`<button type="button" class="ibtn" ?disabled=${this.busy} aria-label=${s("fRemove",{name:e.name})} data-rfq-file-remove
            @click=${()=>this.emit("file-remove",{key:e.key})}>${m("trash")}</button>`:d}
      </span>
    </li>`}render(){const e=O()==="en"?"en":"he",t=this.limits;return n`
      ${this.editable?n`<div class=${`drop${this.over?" over":""}`} data-rfq-drop
          @dragover=${a=>{a.preventDefault(),this.over=!0}} @dragleave=${()=>this.over=!1} @drop=${a=>this.onDrop(a)}>
        <span>${s("fDrop")}</span>
        <label class="btn sm quiet">${b("clip")}${s("fPick")}<input class="vh" type="file" multiple accept=${is(t)} ?disabled=${this.busy} data-rfq-file-input
          @change=${a=>{const i=a.target;this.pick(i.files),i.value=""}} /></label>
        <label class="btn sm quiet">${m("camera")}${s("fCamera")}<input class="vh" type="file" accept="image/*" capture="environment" ?disabled=${this.busy} data-rfq-camera-input
          @change=${a=>{const i=a.target;this.pick(i.files),i.value=""}} /></label>
        <small>${s("fTypes",{types:ns(t),n:t.files,img:re(t.image_bytes,e),doc:re(t.document_bytes,e),total:re(t.total_bytes,e)})}</small>
      </div>`:d}
      ${this.notes.length?n`<div class="err" role="alert" data-rfq-file-refused>${this.notes.map(a=>n`<div>${$(a)}</div>`)}</div>`:d}
      ${this.rows.length?n`<ul aria-label=${s("secFiles")}>${ye(this.rows,a=>a.key,a=>this.row(a))}</ul>`:this.editable?d:n`<div class="note" data-rfq-files-none>${s("fNone")}</div>`}
    `}};U.styles=[Q,...H,Y,de`
    :host {
      display: block;
    }
    .drop {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border: 1.5px dashed var(--sw-line, rgba(127, 127, 127, 0.4));
      border-radius: var(--sw-r-lg);
    }
    .drop.over {
      border-color: var(--sw-accent);
      background: color-mix(in srgb, var(--sw-accent) 8%, transparent);
    }
    .drop small {
      flex-basis: 100%;
      color: var(--sw-muted, inherit);
    }
    ul {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    li {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-line, rgba(127, 127, 127, 0.25));
    }
    li.removed {
      opacity: 0.6;
    }
    .th {
      inline-size: 56px;
      block-size: 56px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .th img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .meta {
      display: grid;
      gap: 4px;
      min-inline-size: 0;
    }
    .meta b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta small {
      color: var(--sw-muted, inherit);
    }
    .meta .inp {
      min-block-size: 36px;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    /* a phone: the caption field is a 44 px touch target like every other control of the sheet */
    @media (max-width: 767px) {
      .meta .inp {
        min-block-size: 44px;
      }
    }
    @media (max-width: 560px) {
      li {
        grid-template-columns: 48px minmax(0, 1fr);
      }
      .th {
        inline-size: 48px;
        block-size: 48px;
      }
      .acts {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }
  `];ie([g({attribute:!1})],U.prototype,"rows",2);ie([g({attribute:!1})],U.prototype,"limits",2);ie([g({type:Boolean})],U.prototype,"editable",2);ie([g({type:Boolean})],U.prototype,"busy",2);ie([u()],U.prototype,"notes",2);ie([u()],U.prototype,"over",2);U=ie([G("tickets-rfq-files")],U);const cs=Object.freeze(Object.defineProperty({__proto__:null,get TicketsRfqFiles(){return U}},Symbol.toStringTag,{value:"Module"}));var ps=Object.defineProperty,hs=Object.getOwnPropertyDescriptor,P=(e,t,a,i)=>{for(var r=i>1?void 0:i?hs(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&ps(t,a,r),r};let us=0;function at(e){return e<=0?"":e===1?s("previewFile1"):s("previewFiles",{n:e})}const ms=["whatsapp","email","manual"],fs={title:"err_title",description:"err_description",department:"err_department",due:"err_due",window:"err_window",vendors:"err_vendors",place:"err_place"};function k(e){const t=e instanceof A?zt(e.code):null;return t?s(t):lt(e)}let z=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.open=!1,this.meta=null,this.sourceTicket="",this.d=this.blank(),this.contacts=null,this.query="",this.files=[],this.attempt="",this.confirm=!1,this.mode="auto",this.busy=!1,this.error="",this.previewOpen=!0,this.locs=null,this.pickTouched=!1,this.created=null,this.crid=oe()}connectedCallback(){super.connectedCallback(),Z(this)}disconnectedCallback(){super.disconnectedCallback(),this.dropFiles()}dropFiles(){for(const e of this.files)e.url&&URL.revokeObjectURL(e.url);this.files=[]}willUpdate(e){e.has("open")&&this.open&&this.reset(),e.has("meta")&&this.meta&&!this.d.department_id&&(this.d={...this.d,department_id:this.firstDept()})}async loadLocations(){try{this.locs=await Ue().list()}catch{this.locs=null}this.pickTouched||(this.d={...this.d,location_pick:Oe(this.locs,this.d.department_id)})}setDept(e){this.d={...this.d,department_id:e,...this.pickTouched?{}:{location_pick:Oe(this.locs,e)}}}firstDept(){return this.meta?.departments.find(e=>e.can_create)?.id??""}blank(){const e=Nt(new Date,this.meta?.settings.default_due_days??3);return{department_id:"",title:"",description:"",place_text:"",due_date:e.date,due_time:e.time,work_from:"",work_to:"",kinds:["labor","parts"],vendors:[],source_ticket_id:"",location_pick:he,location_nav:!1}}reset(){this.d={...this.blank(),department_id:this.firstDept(),source_ticket_id:this.sourceTicket},this.query="",this.dropFiles(),this.attempt="",this.confirm=!1,this.mode=this.meta?.vendor_page===!1?"manual":"auto",this.error="",this.created=null,this.crid=oe(),this.pickTouched=!1,this.loadContacts(),this.loadLocations()}async loadContacts(){this.contacts=null;try{const[e,t]=await Promise.all([ge().contacts({kind:"vendor"}),ge().contacts({kind:"person"})]);this.contacts=[...e.contacts,...t.contacts]}catch{this.contacts=[]}}set(e,t){this.d={...this.d,[e]:t}}close(){this.busy||this.dispatchEvent(new CustomEvent("close"))}eligible(){return(this.contacts??[]).filter(e=>Ge(e,this.d.department_id))}chosen(e){return this.d.vendors.find(t=>t.contact_id===e)}toggleVendor(e,t){t&&!this.chosen(e.id)?(Qe(e.id,e.display_name,e.vendor_name??e.company),this.set("vendors",[...this.d.vendors,{contact_id:e.id,channel:Ce(e),require_code:e.require_code}])):t||this.set("vendors",this.d.vendors.filter(a=>a.contact_id!==e.id))}setVendorOpt(e,t){this.set("vendors",this.d.vendors.map(a=>a.contact_id===e?{...a,...t}:a))}channelOk(e,t){return t==="manual"||(t==="whatsapp"?e.has_phone:!!e.email)}vendorRow(e){const t=this.chosen(e.id),a=e.display_name,i=e.vendor_name??e.company,r=!!this.meta?.vendor_options,l=t?.channel??Ce(e),p=t?.require_code??e.require_code;return n`<div class=${`vrow${t?" on":""}`} data-rfq-vendor=${e.id}>
      <input type="checkbox" id=${`rv-${e.id}`} .checked=${!!t} ?disabled=${this.busy} aria-describedby=${`rvs-${e.id}`}
        @change=${o=>this.toggleVendor(e,o.target.checked)} />
      <span class="av" aria-hidden="true">${le(i||a)}</span>
      <label for=${`rv-${e.id}`} class="vname"><span><b>${$(i||a)}</b><small id=${`rvs-${e.id}`}>${$([i?a:"",e.phone??e.email??""].filter(Boolean).join(" · "))}</small></span></label>
      <div class="opts">
        ${t&&r?n`<span class="seg sm" role="radiogroup" aria-label=${s("chTitle")} data-rfq-channel=${e.id}>
            ${ms.map(o=>n`<button type="button" role="radio" aria-checked=${String(l===o)} ?disabled=${!this.channelOk(e,o)||this.busy} data-ch=${o}
              @click=${()=>this.setVendorOpt(e.id,{channel:o})}>${this.chIcon(o)}<span class="vh">${s(`ch_${o}`)}</span></button>`)}
          </span>
          <label class="chk" data-rfq-code=${e.id}><input type="checkbox" .checked=${p} ?disabled=${e.require_code||this.busy}
            @change=${o=>this.setVendorOpt(e.id,{require_code:o.target.checked})} />${s("codeOn")}</label>`:n`<span class="chan" data-rfq-channel-ro=${l}>${this.chIcon(l)}${s(`ch_${l}`)}</span>${p?n`<span class="chip" data-rfq-code-ro>${m("lock")}${s("codeOn")}</span>`:d}`}
      </div>
    </div>`}chIcon(e){return e==="whatsapp"?b("chat"):e==="email"?b("mail"):m("copy")}onPicked(e){const t=e.map(a=>({key:`lf${++us}`,file:a,caption:"",visible:!0,url:be(a)==="image"?URL.createObjectURL(a):""}));this.files=[...this.files,...t]}setFile(e,t){this.files=this.files.map(a=>a.key===e?{...a,...t}:a)}removeFile(e){const t=this.files.find(a=>a.key===e);t?.url&&URL.revokeObjectURL(t.url),this.files=this.files.filter(a=>a.key!==e)}fileRows(){return this.files.map(e=>{const t=be(e.file)??"pdf";return{key:e.key,name:Ie(e.file.name,t),kind:t,bytes:e.file.size,caption:e.caption,visible:e.visible,thumb:e.url,href:"",pending:!0}})}vendorFileCount(){return this.files.filter(e=>e.visible).length}async uploadPending(e){let t=e;for(const a of[...this.files]){try{t=await v().uploadAttachment(e.id,a.file,{caption:a.caption||void 0,visible_vendors:a.visible})}catch(i){throw new Error(s("fUploadFailed",{error:`${a.file.name}: ${k(i)}`}))}this.removeFile(a.key)}return this.created=t,t}problems(e){return Tt(this.d,new Date,e)}body(){const e=this.d;return{department_id:e.department_id,title:e.title.trim(),description:e.description.trim()||void 0,...dt(e.location_pick??he,e.place_text),source_ticket_id:e.source_ticket_id||void 0,due_at:Se(e.due_date,e.due_time||"12:00"),work_from:E(e.work_from)||void 0,work_to:E(e.work_to)||void 0,allowed_line_kinds:Ot(e.kinds),vendors:e.vendors.map(t=>({...t})),client_request_id:this.crid}}async ensureCreated(){return this.created?this.created:(this.created=await v().create(this.body()),this.created)}async saveDraft(){if(this.attempt="draft",!Object.keys(this.problems(!1)).length){this.busy=!0,this.error="";try{const e=await this.uploadPending(await this.ensureCreated());this.dispatchEvent(new CustomEvent("rfq-saved",{detail:{id:e.id,sent:!1}}))}catch(e){this.error=k(e)}finally{this.busy=!1}}}toSend(){this.attempt="send",!Object.keys(this.problems(!0)).length&&(this.error="",this.confirm=!0)}async send(){this.busy=!0,this.error="";try{const e=await this.uploadPending(await this.ensureCreated()),t=fe(this.locs,this.d.location_pick??"")?!!this.d.location_nav:void 0;await v().send(e.id,e.revision,this.mode,oe(),t),this.confirm=!1,this.dispatchEvent(new CustomEvent("rfq-saved",{detail:{id:e.id,sent:!0,manual:this.mode==="manual"}}))}catch(e){this.error=k(e),this.created&&(this.created=await v().get(this.created.id).catch(()=>this.created))}finally{this.busy=!1}}preview(){const e=this.d.vendors[0],t=e?this.contacts?.find(i=>i.id===e.contact_id):void 0,a=O();return Ye({name:t?.display_name??s("previewName"),number:s("previewNumber"),title:this.d.title.trim()||s("fTitle"),place:ct(this.locs,this.d.location_pick??he,this.d.place_text,!!this.d.location_nav&&fe(this.locs,this.d.location_pick??"")),due:D(Se(this.d.due_date,this.d.due_time||"12:00")),window:W(E(this.d.work_from),E(this.d.work_to))||s("previewFlexible"),link:s("previewLink"),organization:"",files:at(this.vendorFileCount())},a)}sendFiles(){if(!this.meta?.attachments)return d;const e=this.files.filter(i=>i.visible),t=this.files.length-e.length,a=O()==="en"?"en":"he";return n`<div class="stack" data-rfq-send-files>
      <b>${s("sendFiles")}</b>
      ${e.length?n`<ul class="sendfiles">${e.map(i=>{const r=be(i.file)??"pdf";return n`<li data-rfq-send-file><span class="th">${i.url?n`<img src=${i.url} alt="" />`:b(r==="xlsx"?"sheet":"file")}</span>
          <span>${$(Ie(i.file.name,r))}</span><small>${re(i.file.size,a)}</small></li>`})}</ul>`:n`<span class="note">${s("sendFilesNone")}</span>`}
      ${t?n`<span class="note" data-rfq-send-internal>${s("sendFilesInternal",{n:t})}</span>`:d}
    </div>`}err(e,t){return this.attempt&&t[e]?n`<span class="err" id=${`e-${e}`} role="alert" data-rfq-err=${e}>${s(fs[e])}</span>`:d}inv(e,t){return this.attempt&&t[e]?"true":"false"}form(){const e=this.d,t=this.problems(this.attempt==="send"),a=(this.meta?.departments??[]).filter(o=>o.can_create),i=this.meta?.line_kinds??["labor","parts","travel","other"],r=this.query.trim().toLowerCase(),p=[...this.eligible().filter(o=>!r||`${o.display_name} ${o.company} ${o.vendor_name??""}`.toLowerCase().includes(r))].sort((o,c)=>+!!this.chosen(c.id)-+!!this.chosen(o.id));return n`<div class="form" data-rfq-new-form>
      ${e.source_ticket_id?n`<a class="chip info" href=${`#/tickets/${e.source_ticket_id}`} data-rfq-from>${m("ticket")}${s("fromTicket")}</a>`:d}
      <section aria-labelledby="h-req">
        <h3 id="h-req">${m("edit")}${s("secRequest")}</h3>
        <div class="frm">
          <label class="fld wide">${s("fTitle")}<input class="inp" data-rfq-title maxlength=${Dt} required .value=${e.title} aria-invalid=${this.inv("title",t)}
            aria-describedby="e-title" @input=${o=>this.set("title",o.target.value)} />${this.err("title",t)}</label>
          <label class="fld wide">${s("fDescription")}<textarea class="inp" data-rfq-description maxlength=${Pt} .value=${e.description}
            @input=${o=>this.set("description",o.target.value)}></textarea>${this.err("description",t)}</label>
          <label class="fld">${s("fDepartment")}<select class="inp" data-rfq-department aria-invalid=${this.inv("department",t)} @change=${o=>this.setDept(o.target.value)}>
            ${a.map(o=>n`<option value=${o.id} ?selected=${o.id===e.department_id}>${$(o.name)}</option>`)}
          </select>${this.err("department",t)}</label>
          ${He({ans:this.locs,pick:e.location_pick??he,other:e.place_text,disabled:this.busy,error:this.err("place",t),label:s("fPlace"),rfqPlaceAttr:!0,onPick:o=>{this.pickTouched=!0,this.d={...this.d,location_pick:o,location_nav:!1}},onOther:o=>{this.pickTouched=!0,this.set("place_text",o.slice(0,Mt*2))}})}
          <fieldset class="fld" style="border:0;padding:0;margin:0"><legend>${s("fDue")}</legend>
            <div class="dates">
              <label><span class="vh">${s("fDueDate")}</span><input class="inp" type="date" lang=${S()} data-rfq-due-date .value=${e.due_date} aria-invalid=${this.inv("due",t)} aria-describedby="e-due"
                @change=${o=>this.set("due_date",o.target.value)} /></label>
              <label><span class="vh">${s("fDueTime")}</span><input class="inp" type="time" lang=${S()} data-rfq-due-time .value=${e.due_time} @change=${o=>this.set("due_time",o.target.value)} /></label>
            </div>${this.err("due",t)}</fieldset>
          <fieldset class="fld" style="border:0;padding:0;margin:0"><legend>${s("fWindow")}</legend>
            <div class="dates">
              <label><span class="vh">${s("fWindowFrom")}</span><input class="inp" type="date" lang=${S()} data-rfq-work-from .value=${e.work_from} @change=${o=>this.set("work_from",o.target.value)} /></label>
              <label><span class="vh">${s("fWindowTo")}</span><input class="inp" type="date" lang=${S()} data-rfq-work-to .value=${e.work_to} min=${e.work_from||""} aria-invalid=${this.inv("window",t)}
                @change=${o=>this.set("work_to",o.target.value)} /></label>
            </div>${this.err("window",t)}</fieldset>
          <div class="fld wide"><span id="kinds-l">${s("fKinds")} <span class="mut">(${s("fKindsSub")})</span></span>
            <div class="kinds" role="group" aria-labelledby="kinds-l" data-rfq-kinds>
              ${i.map(o=>n`<button type="button" class="rc" aria-pressed=${String(e.kinds.includes(o)||o==="labor")} ?disabled=${o==="labor"||this.busy} data-kind=${o}
                @click=${()=>this.set("kinds",Je(e.kinds,o))}>${m(e.kinds.includes(o)||o==="labor"?"check":"plus")}${V(`k_${o}`)}</button>`)}
            </div></div>
          ${this.meta?.attachments?n`<div class="fld wide" data-rfq-files><span>${s("fFiles")} <span class="mut">(${s("fFilesSub")})</span></span>
            <tickets-rfq-files editable ?busy=${this.busy} .rows=${this.fileRows()} .limits=${this.meta.attachment_limits??ae}
              @files-picked=${o=>this.onPicked(o.detail.files)}
              @file-caption=${o=>this.setFile(o.detail.key,{caption:o.detail.caption})}
              @file-visible=${o=>this.setFile(o.detail.key,{visible:o.detail.visible})}
              @file-remove=${o=>this.removeFile(o.detail.key)}></tickets-rfq-files>
          </div>`:d}
        </div>
      </section>
      <section aria-labelledby="h-vendors">
        <h3 id="h-vendors">${m("users")}${s("secVendors")}<span class="mut" data-rfq-chosen>${s("vendorsChosen",{n:e.vendors.length})}</span></h3>
        <label class="fld"><span class="vh">${s("vendorsSearch")}</span><input class="inp" type="search" data-rfq-vendor-search maxlength="60" placeholder=${s("vendorsSearch")}
          .value=${this.query} @input=${o=>this.query=o.target.value} /></label>
        ${this.contacts===null?n`<span class="skl" style="block-size:52px" aria-label=${s("vendorsLoading")}></span>`:p.length?n`<div class="vlist" role="group" aria-label=${s("secVendors")}>${ye(p,o=>o.id,o=>this.vendorRow(o))}</div>`:n`<div class="note" data-rfq-vendors-none>${s("vendorsNone")} · <a href="#/tickets/handlers?seg=vendors">${s("vendorsToDirectory")}</a></div>`}
        ${this.err("vendors",t)}
        <div class="note">${this.meta?.vendor_options?s("vendorsHint"):n`${s("vendorFromDirectory")} · ${s("vendorsHint")}`}</div>
      </section>
      <section aria-labelledby="h-preview">
        <h3 id="h-preview">${m("eye")}${s("secPreview")}
          <button type="button" class="btn sm quiet" style="margin-inline-start:auto" aria-expanded=${String(this.previewOpen)} data-rfq-preview-toggle
            @click=${()=>this.previewOpen=!this.previewOpen}>${this.previewOpen?s("previewHide"):s("previewShow")}</button></h3>
        ${this.previewOpen?n`<pre class="pv" dir=${O()==="en"?"ltr":"rtl"} data-rfq-preview>${this.preview()}</pre>`:d}
        <div class="note">${s("previewNote")}</div>
      </section>
      ${this.error&&!this.confirm?n`<div class="err" role="alert" data-rfq-new-error>${this.error}</div>`:d}
    </div>`}footer(){return n`<div slot="footer" class="sheetfoot">
      <button type="button" class="btn primary" data-rfq-to-send ?disabled=${this.busy} @click=${()=>this.toSend()}>${m("send")}${s("toSend")}</button>
      <button type="button" class="btn quiet" data-rfq-save-draft ?disabled=${this.busy} @click=${()=>void this.saveDraft()}>${m("note")}${s("saveDraft")}</button>
      <button type="button" class="btn quiet" data-rfq-new-cancel ?disabled=${this.busy} @click=${()=>this.close()}>${s("cancel")}</button>
    </div>`}confirmDialog(){const e=this.meta?.vendor_page===!1,t=this.d.vendors.length,a=(i,r,l,p)=>n`<label aria-disabled=${String(p)} data-rfq-send-mode=${i}>
      <input type="radio" name="rfqmode" .checked=${this.mode===i} ?disabled=${p||this.busy} @change=${()=>this.mode=i} />
      <b>${s(r)}</b><small>${p?s("sendPageOff"):s(l)}</small></label>`;return n`<sw-dialog ?open=${this.confirm} ?locked=${this.busy} wide heading=${s("sendTitle")} subheading=${s("sendTo",{n:t})} data-rfq-send-dialog @close=${()=>this.confirm=!1}>
      <div class="stack">
        <div class="choice" role="radiogroup" aria-label=${s("sendTitle")}>
          ${a("auto","sendAuto","sendAutoSub",e)}
          ${a("manual","sendManual","sendManualSub",!1)}
        </div>
        ${this.mode==="auto"&&this.d.location_pick&&this.d.location_pick!==he?n`<label class="chk" data-rfq-location-nav>
            <input type="checkbox" .checked=${!!this.d.location_nav} ?disabled=${this.busy||!fe(this.locs,this.d.location_pick)}
              @change=${i=>this.set("location_nav",i.target.checked)} />
            <span><b>${te("navOn")}</b><small>${fe(this.locs,this.d.location_pick)?te("navOnSub"):te("navNoCoords")}</small></span></label>`:d}
        ${this.mode==="auto"?n`<pre class="pv" dir=${O()==="en"?"ltr":"rtl"} data-rfq-send-preview>${this.preview()}</pre>`:d}
        ${this.sendFiles()}
        ${this.error?n`<div class="err" role="alert" data-rfq-send-error>${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${()=>this.confirm=!1}>${s("back")}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-send-confirm ?disabled=${this.busy||e&&this.mode==="auto"} @click=${()=>void this.send()}>${b("bell")}${s("sendNow")}</button>
    </sw-dialog>`}render(){return n`<sw-drawer modal .open=${this.open} heading=${s("newTitle")} subheading=${s("newSub")} data-rfq-new @close=${()=>this.close()}>
      ${this.open?this.form():d}${this.open?this.footer():d}
      ${this.open?this.confirmDialog():d}
    </sw-drawer>`}};z.styles=[Q,...H,Y,de`
    :host {
      display: contents;
    }
  `];P([g({type:Boolean})],z.prototype,"open",2);P([g({attribute:!1})],z.prototype,"meta",2);P([g({attribute:!1})],z.prototype,"sourceTicket",2);P([u()],z.prototype,"d",2);P([u()],z.prototype,"contacts",2);P([u()],z.prototype,"query",2);P([u()],z.prototype,"files",2);P([u()],z.prototype,"attempt",2);P([u()],z.prototype,"confirm",2);P([u()],z.prototype,"mode",2);P([u()],z.prototype,"busy",2);P([u()],z.prototype,"error",2);P([u()],z.prototype,"previewOpen",2);P([u()],z.prototype,"locs",2);z=P([G("tickets-rfq-new")],z);var vs=Object.defineProperty,$s=Object.getOwnPropertyDescriptor,M=(e,t,a,i)=>{for(var r=i>1?void 0:i?$s(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&vs(t,a,r),r};let N=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.open=!1,this.rfq=null,this.vendor=null,this.currencies=["ILS"],this.lines=[ve("labor")],this.currency="ILS",this.includesVat=!0,this.from="",this.to="",this.note="",this.ref="",this.tried=!1,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),Z(this)}willUpdate(e){e.has("open")&&this.open&&(this.lines=[ve("labor")],this.currency=this.currencies[0]??"ILS",this.includesVat=!0,this.from="",this.to="",this.note="",this.ref="",this.tried=!1,this.error="")}kinds(){return this.rfq?.allowed_line_kinds?.length?this.rfq.allowed_line_kinds:["labor","parts"]}setLine(e,t){this.lines=this.lines.map((a,i)=>i===e?{...a,...t}:a)}setKind(e,t){const a=this.lines[e];this.lines=this.lines.map((i,r)=>r===e?{...ve(t),description:a.description}:i)}valid(){return this.lines.length>0&&this.lines.every(e=>!De(e))}async save(){if(this.tried=!0,!(!this.valid()||!this.rfq||!this.vendor)){this.busy=!0,this.error="";try{const e=await v().quoteOnBehalf(this.rfq.id,this.vendor.id,{lines:this.lines.map(pt),currency:this.currency,amounts_include_vat:this.includesVat,...this.from?{work_from:E(this.from)}:{},...this.to?{work_to:E(this.to)}:{},...this.note.trim()?{note:this.note.trim()}:{},...this.ref.trim()?{vendor_ref:this.ref.trim()}:{}});this.dispatchEvent(new CustomEvent("saved",{detail:e}))}catch(e){this.error=k(e)}finally{this.busy=!1}}}num(e,t,a,i){const r=this.lines[e];return n`<label class="fld">${a}<input class="inp num" inputmode="decimal" dir="ltr" .value=${String(r[t])} aria-invalid=${String(i)}
      data-q-field=${t} @input=${l=>this.setLine(e,{[t]:l.target.value})} /></label>`}line(e,t){const a=this.tried?De(e):"";return n`<div class="qline" data-q-line=${t}>
      <label class="fld">${s("qKind")}<select class="inp" data-q-kind @change=${i=>this.setKind(t,i.target.value)}>
        ${this.kinds().map(i=>n`<option value=${i} ?selected=${e.kind===i}>${V(`k_${i}`)}</option>`)}</select></label>
      <label class="fld desc">${s("qDescription")}<input class="inp" maxlength="120" .value=${e.description} aria-invalid=${String(a==="description")} data-q-field="description"
        @input=${i=>this.setLine(t,{description:i.target.value})} /></label>
      ${e.kind==="labor"?n`${this.num(t,"hours",s("qHours"),a==="hours")}${this.num(t,"rate",s("qRate"),a==="rate")}`:e.kind==="parts"?n`${this.num(t,"quantity",s("qQuantity"),a==="quantity")}${this.num(t,"unit_price",s("qUnit"),a==="unit_price")}`:n`<div class="one">${this.num(t,"amount",s("qAmount"),a==="amount")}</div>`}
      <button type="button" class="ibtn" aria-label=${s("qRemoveLine")} ?disabled=${this.lines.length<2} data-q-remove @click=${()=>this.lines=this.lines.filter((i,r)=>r!==t)}>${m("trash")}</button>
    </div>`}render(){const e=this.vendor?this.vendor.contact.company||this.vendor.contact.name:"",t=ht(this.lines,this.includesVat?"included":"excluded",1800),a=O()==="en"?"en":"he";return n`<sw-dialog ?open=${this.open} ?locked=${this.busy} wide heading=${s("onBehalfTitle",{name:e})} data-rfq-quote-dialog @close=${()=>this.dispatchEvent(new CustomEvent("close"))}>
      <div class="stack">
        <div class="qlines" role="group" aria-label=${s("qLines")}>${this.lines.map((i,r)=>this.line(i,r))}</div>
        <div><button type="button" class="btn sm quiet" data-q-add ?disabled=${this.lines.length>=30} @click=${()=>this.lines=[...this.lines,ve(this.kinds()[0]??"labor")]}>${m("plus")}${s("qAddLine")}</button></div>
        <div class="frm">
          <label class="fld">${s("qCurrency")}<select class="inp" data-q-currency @change=${i=>this.currency=i.target.value}>
            ${this.currencies.map(i=>n`<option value=${i} ?selected=${i===this.currency}>${i}</option>`)}</select></label>
          <label class="chk"><input type="checkbox" data-q-vat .checked=${this.includesVat} @change=${i=>this.includesVat=i.target.checked} />${s("qIncludesVat")}</label>
          <label class="fld">${s("qWindowFrom")}<input class="inp" type="date" lang=${S()} .value=${this.from} @change=${i=>this.from=i.target.value} /></label>
          <label class="fld">${s("qWindowTo")}<input class="inp" type="date" lang=${S()} .value=${this.to} min=${this.from||""} @change=${i=>this.to=i.target.value} /></label>
          <label class="fld wide">${s("qNote")}<input class="inp" maxlength="500" .value=${this.note} @input=${i=>this.note=i.target.value} /></label>
          <label class="fld">${s("qVendorRef")}<input class="inp" maxlength="60" .value=${this.ref} @input=${i=>this.ref=i.target.value} /></label>
        </div>
        <div class="totals" data-q-total>${t?n`<span>${s("qTotal")}: <b class="num">${ce(t.total,this.currency,a)}</b></span>`:d}</div>
        ${this.tried&&!this.valid()?n`<div class="err" role="alert">${this.lines.length?s("qBadLine"):s("qNoLines")}</div>`:d}
        ${this.error?n`<div class="err" role="alert" data-q-error>${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${()=>this.dispatchEvent(new CustomEvent("close"))}>${s("cancel")}</button>
      <button slot="footer" type="button" class="btn primary" data-q-submit ?disabled=${this.busy} @click=${()=>void this.save()}>${m("check")}${s("qSubmit")}</button>
    </sw-dialog>`}};N.styles=[Q,...H,Y];M([g({type:Boolean})],N.prototype,"open",2);M([g({attribute:!1})],N.prototype,"rfq",2);M([g({attribute:!1})],N.prototype,"vendor",2);M([g({attribute:!1})],N.prototype,"currencies",2);M([u()],N.prototype,"lines",2);M([u()],N.prototype,"currency",2);M([u()],N.prototype,"includesVat",2);M([u()],N.prototype,"from",2);M([u()],N.prototype,"to",2);M([u()],N.prototype,"note",2);M([u()],N.prototype,"ref",2);M([u()],N.prototype,"tried",2);M([u()],N.prototype,"busy",2);M([u()],N.prototype,"error",2);N=M([G("tickets-rfq-quote-dialog")],N);var bs=Object.defineProperty,gs=Object.getOwnPropertyDescriptor,ee=(e,t,a,i)=>{for(var r=i>1?void 0:i?gs(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&bs(t,a,r),r};let F=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.open=!1,this.rfq=null,this.vendor=null,this.items=null,this.text="",this.notify=!0,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),Z(this)}files(e){const t=v().vendorFileUrl,a=(e.files??[]).filter(r=>!r.removed);if(!a.length&&(e.files_hidden??0)>0)return n`<small data-rfq-question-files-hidden>${s("vendorFileAttached")}</small>`;if(!a.length||!t||!this.rfq)return d;const i=this.rfq.id;return n`<small data-rfq-question-files>${s("rowVendorFiles")}: ${a.map((r,l)=>n`${l?", ":""}<a href=${t(i,r.id)} download
      rel="noopener noreferrer" data-rfq-question-file=${r.id}>${$(r.name)}</a>`)}</small>`}willUpdate(e){e.has("open")&&this.open&&(this.text="",this.notify=this.vendor?.channel!=="manual",this.error="",this.items=null,this.load())}async load(){if(!(!this.rfq||!this.vendor)){try{this.items=(await v().messages(this.rfq.id,this.vendor.id)).items}catch{this.items=[]}if(this.rfq.can.answer&&(this.vendor.questions?.unread??0)>0)try{await v().markRead(this.rfq.id,this.vendor.id),ue()}catch{}}}async save(){if(!(!this.rfq||!this.vendor||!this.text.trim())){this.busy=!0,this.error="";try{const e=await v().writeMessage(this.rfq.id,this.vendor.id,this.text.trim(),this.notify);this.dispatchEvent(new CustomEvent("saved",{detail:{notified:e.notified.queued}}))}catch(e){this.error=k(e)}finally{this.busy=!1}}}render(){const e=this.vendor?this.vendor.contact.company||this.vendor.contact.name:"",t=this.vendor?.channel!=="manual";return n`<sw-dialog ?open=${this.open} ?locked=${this.busy} heading=${s("writeTitle",{name:e})} data-rfq-message-dialog @close=${()=>this.dispatchEvent(new CustomEvent("close"))}>
      <div class="stack">
        <div class="thread" role="log" aria-label=${s("thread")} data-rfq-thread>
          ${this.items===null?n`<span class="skl" style="block-size:40px"></span>`:this.items.length?this.items.map(a=>n`<div class=${`m ${a.direction}`} ?data-rfq-via-whatsapp=${a.via==="whatsapp"} ?data-rfq-system=${a.system===!0}>${$(a.text)}<small>${$(a.system?s("systemAuthor"):a.by)} · ${D(a.at)}${a.via==="whatsapp"?` · ${s("viaWhatsapp")}`:""}${a.question?` · ${s(a.question.state==="answered"?"qAnswered":"qPendingChip")}`:""}${a.to_all?` · ${s("qToAll")}`:""}</small>${this.files(a)}</div>`):n`<span class="note">${s("threadEmpty")}</span>`}
        </div>
        <label class="fld">${s("writeVendor")}<textarea class="inp" style="min-block-size:96px;padding-block:10px" maxlength=${Ct} data-rfq-message-text .value=${this.text}
          @input=${a=>this.text=a.target.value}></textarea></label>
        ${t?n`<label class="chk"><input type="checkbox" data-rfq-message-notify .checked=${this.notify} @change=${a=>this.notify=a.target.checked} />${s("writeNotify")}</label>`:d}
        <div class="note">${s("writeNote")}</div>
        ${this.error?n`<div class="err" role="alert">${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${()=>this.dispatchEvent(new CustomEvent("close"))}>${s("cancel")}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-message-send ?disabled=${this.busy||!this.text.trim()} @click=${()=>void this.save()}>${m("send")}${s("writeSend")}</button>
    </sw-dialog>`}};F.styles=[Q,...H,Y];ee([g({type:Boolean})],F.prototype,"open",2);ee([g({attribute:!1})],F.prototype,"rfq",2);ee([g({attribute:!1})],F.prototype,"vendor",2);ee([u()],F.prototype,"items",2);ee([u()],F.prototype,"text",2);ee([u()],F.prototype,"notify",2);ee([u()],F.prototype,"busy",2);ee([u()],F.prototype,"error",2);F=ee([G("tickets-rfq-message-dialog")],F);var ys=Object.defineProperty,ws=Object.getOwnPropertyDescriptor,R=(e,t,a,i)=>{for(var r=i>1?void 0:i?ws(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&ys(t,a,r),r};let C=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.open=!1,this.rfq=null,this.question=null,this.text="",this.scope="vendor",this.shown="",this.named=!1,this.notify=!0,this.preview=null,this.busy=!1,this.error="",this.crid="",this.close=()=>{this.busy||this.dispatchEvent(new CustomEvent("close"))}}connectedCallback(){super.connectedCallback(),Z(this)}willUpdate(e){(e.has("open")||e.has("question"))&&this.open&&(this.text="",this.scope="vendor",this.shown=this.question?.text??"",this.named=!1,this.notify=!0,this.preview=null,this.error="",this.crid=oe())}body(){return ut(this.text,this.scope,this.shown,this.named,this.notify)}async toPreview(){if(!(!this.rfq||!this.question||Pe(this.body(),this.question.text).length)){this.busy=!0,this.error="";try{this.preview=await v().answerPreview(this.rfq.id,this.question.id,this.body())}catch(e){this.error=k(e)}finally{this.busy=!1}}}async send(){if(!(!this.rfq||!this.question)){this.busy=!0,this.error="";try{const e=await v().answer(this.rfq.id,this.question.id,this.body(),this.crid);this.dispatchEvent(new CustomEvent("saved",{detail:{rfq:e.rfq,copies:e.answer.items.length,notified:e.answer.notified}}))}catch(e){this.error=k(e)}finally{this.busy=!1}}}form(){const e=this.question,t=Pe(this.body(),e.text),a=(i,r,l)=>n`<label data-rfq-answer-scope=${i}>
      <input type="radio" name="qscope" .checked=${this.scope===i} ?disabled=${this.busy} @change=${()=>this.scope=i} /><b>${s(r)}</b><small>${s(l)}</small></label>`;return n`<div class="stack">
        <div class="qbox" data-rfq-answer-question><small>${s("qQuestion")} · ${D(e.at)}${e.unverified?` · ${s("qViaWhatsapp")}`:""}</small><p>${$(e.text)}</p></div>
        <label class="fld">${s("qAnswerLabel")}<textarea class="inp" style="min-block-size:96px;padding-block:10px" maxlength=${mt} data-rfq-answer-text .value=${this.text}
          @input=${i=>this.text=i.target.value}></textarea></label>
        <div class="choice" role="radiogroup" aria-label=${s("qScope")}>${a("vendor","qScopeVendor","qScopeVendorSub")}${a("all","qScopeAll","qScopeAllSub")}</div>
        ${this.scope==="all"?n`<label class="fld">${s("qShownAs")}<textarea class="inp" style="min-block-size:64px;padding-block:10px" maxlength=${ft} data-rfq-answer-shown
            .value=${this.shown} @input=${i=>this.shown=i.target.value}></textarea><small class="mut">${s("qShownNote")}</small></label>
          <label class="chk"><input type="checkbox" data-rfq-answer-named .checked=${this.named} @change=${i=>this.named=i.target.checked} />${s("qNameAsker")}</label>`:d}
        <label class="chk"><input type="checkbox" data-rfq-answer-notify .checked=${this.notify} @change=${i=>this.notify=i.target.checked} />${s("qNotify")}</label>
        <div class="note">${s("writeNote")}</div>
        ${this.error?n`<div class="err" role="alert" data-dlg-error>${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${this.close}>${s("cancel")}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-answer-preview ?disabled=${this.busy||t.length>0} @click=${()=>void this.toPreview()}>${s("qPreview")}</button>`}confirm(){const e=this.preview,t=O()==="en"?"ltr":"rtl";return n`<div class="stack">
        <p class="note">${s("qSendAskNote")}</p>
        <ul class="thr" data-rfq-answer-recipients>${e.recipients.map(a=>n`<li data-rfq-answer-to=${a.vendor_id}>
          <b>${$(a.vendor.company||a.vendor.name)}</b>${a.asker?n` <span class="chip info">${s("qAsker")}</span>`:d}
          <small class="mut">${a.notify_channel?s("qWillNotify",{channel:s(`ch_${a.notify_channel}`)}):s("qNoNotify")}</small>
          <pre class="pv" dir=${t}>${a.text}</pre></li>`)}</ul>
        ${this.error?n`<div class="err" role="alert" data-dlg-error>${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${()=>this.preview=null}>${s("qBack")}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-answer-send ?disabled=${this.busy} @click=${()=>void this.send()}>${m("send")}${s("qSend")}</button>`}render(){const e=this.question;if(!this.open||!e)return d;const t=e.vendor.company||e.vendor.name,a=this.preview?this.preview.recipients.length>1?s("qSendAskAll",{n:this.preview.recipients.length}):s("qSendAsk"):s("qTitle",{name:t});return n`<sw-dialog open wide ?locked=${this.busy} heading=${a} data-rfq-question-dialog=${this.preview?"confirm":"form"} @close=${this.close}>
      ${this.preview?this.confirm():this.form()}
    </sw-dialog>`}};C.styles=[Q,...H,Y];R([g({type:Boolean})],C.prototype,"open",2);R([g({attribute:!1})],C.prototype,"rfq",2);R([g({attribute:!1})],C.prototype,"question",2);R([u()],C.prototype,"text",2);R([u()],C.prototype,"scope",2);R([u()],C.prototype,"shown",2);R([u()],C.prototype,"named",2);R([u()],C.prototype,"notify",2);R([u()],C.prototype,"preview",2);R([u()],C.prototype,"busy",2);R([u()],C.prototype,"error",2);C=R([G("tickets-rfq-question-dialog")],C);var ks=Object.defineProperty,xs=Object.getOwnPropertyDescriptor,ne=(e,t,a,i)=>{for(var r=i>1?void 0:i?xs(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&ks(t,a,r),r};function _e(e){return e instanceof A&&e.code==="vendor_not_allowed"?s("err_order_vendor_not_allowed"):k(e)}function qs(e){const t=e==="vendor_not_allowed"?"err_order_vendor_not_allowed":`err_${e}`;return Ke(t)?s(t):e}let J=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.rfq=null,this.forms={},this.keys={},this.busy="",this.errors={},this.pv=null,this.sending=!1}connectedCallback(){super.connectedCallback(),Z(this)}willUpdate(e){if(e.has("rfq")&&this.rfq){const t={...this.forms};for(const a of Ae(this.rfq))!t[a.id]&&a.can?.order&&(t[a.id]=At(a));this.forms=t}}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}changed(e){this.rfq=e,this.dispatchEvent(new CustomEvent("changed",{detail:e}))}vendorName(e){const t=this.rfq?.vendors.find(a=>a.id===e);return t?t.contact.company||t.contact.name:""}money(e,t){return ce(e??null,t??"ILS",O()==="en"?"en":"he")}setForm(e,t){this.forms={...this.forms,[e]:{...this.forms[e]??{from:"",to:"",docs:""},...t}}}async create(e){const t=this.rfq,a=this.forms[e.id];if(!(!t||!a||!ke(a)||this.busy)){this.keys[e.id]??=oe(),this.busy=e.id,this.errors={...this.errors,[e.id]:""};try{const i=await v().createOrder(t.id,e.id,Et(a,this.keys[e.id]));delete this.keys[e.id],this.changed(i.rfq),this.notice({ok:s("ordCreatedDone",{number:i.ticket?.number??i.award?.ticket?.number??""})})}catch(i){this.errors={...this.errors,[e.id]:_e(i)},i instanceof A&&(i.code==="order_exists"||i.code==="rfq_stale"||i.code==="rfq_invalid_transition")&&await this.reload()}finally{this.busy=""}}}async reload(){if(this.rfq)try{this.changed(await v().get(this.rfq.id))}catch{}}async openPreview(e){const t=this.rfq;if(t){this.pv={award:e,data:null,error:""};try{const a=await v().orderPreview(t.id,e.id);this.pv?.award.id===e.id&&(this.pv={award:e,data:a,error:""})}catch(a){this.pv?.award.id===e.id&&(this.pv={award:e,data:null,error:_e(a)})}}}async send(){const e=this.rfq,t=this.pv;if(!(!e||!t?.data||t.data.refusals.length||this.sending)){this.sending=!0;try{const a=await v().sendOrder(e.id,t.award.id);this.pv=null,this.changed(a.rfq),this.notice({ok:s("ordSentDone")})}catch(a){this.pv={...t,error:_e(a)}}finally{this.sending=!1}}}scope(e){const t=Lt(e.scope,a=>V(`k_${a}`));return t?s(t.key,t.vars):""}ticketLink(e){const t=e.order?.ticket??e.ticket;if(!t)return d;const a=s("ordTicket",{number:t.number});return t.id?n`<a class="btn sm" href=${`#/tickets/${t.id}`} data-rfq-order-ticket-link=${t.id}>${m("ticket")}${a}</a>`:n`<span class="chip">${m("ticket")}${a}</span>`}card(e){const t=this.rfq,a=this.vendorName(e.vendor_id),i=e.order??null,r=i?i.sent?"sent":"created":e.can?.order?"form":"waiting",l=this.forms[e.id]??{from:"",to:"",docs:""},p=this.errors[e.id],o=this.busy===e.id,c=r==="sent"?n`<span class="chip ok" data-ochip>${m("check")}${s("ordSentAt",{when:D(i?.sent?.at)})}</span>`:r==="created"?n`<span class="chip warn" data-ochip>${s("ordNotSent")}</span>`:n`<span class="chip" data-ochip>${s("ordWaitingCreate")}</span>`;return n`<article class="ocard" data-rfq-order-card=${e.vendor_id} data-award=${e.id} data-ostate=${r} aria-label=${`${s("ordSection")}: ${a}`}>
      <div class="ohead"><span class="av" aria-hidden="true">${le(a)}</span><b>${$(a)}</b>${c}</div>
      <div class="orow" data-oscope>${m("layers")}<span><b>${this.scope(e)}</b>${t.can.see_amounts&&e.total_minor!==null?n`<small data-obaseline>${s("ordBaseline")}: <span class="num">${this.money(e.total_minor,e.currency)}</span> · ${s("ordBaselineSub")}</small>`:n`<small>${s("ordBaselineSub")}</small>`}</span></div>
      ${i?n`
        <div class="orow" data-odates>${b("cal")}<span><small>${s("ordDates")}</small><b class="num">${W(i.work_from,i.work_to)||"—"}</b></span></div>
        <div class="oacts">${this.ticketLink(e)}
          ${e.can?.send_order?n`<button type="button" class="btn primary" data-rfq-order-preview=${e.id} @click=${()=>void this.openPreview(e)}>${m("send")}${s("ordPreviewSend")}</button>`:d}
        </div>`:r==="form"?n`
        <div class="frm">
          <label class="fld">${s("ordFrom")}<input class="inp" type="date" lang=${S()} data-order-from .value=${l.from} aria-invalid=${String(!ke(l)&&!!l.from)}
            @change=${h=>this.setForm(e.id,{from:h.target.value})} /></label>
          <label class="fld">${s("ordTo")}<input class="inp" type="date" lang=${S()} data-order-to .value=${l.to} min=${l.from||""}
            @change=${h=>this.setForm(e.id,{to:h.target.value})} /></label>
          <label class="fld wide">${s("ordDocs")}<textarea class="inp" maxlength="1000" data-order-docs .value=${l.docs}
            @input=${h=>this.setForm(e.id,{docs:h.target.value})}></textarea>
            <span class="note">${s("ordDocsHint")}</span></label>
        </div>
        <div class="oacts">
          <button type="button" class="btn primary" data-rfq-order-create=${e.id} ?disabled=${o||!ke(l)} @click=${()=>void this.create(e)}>${m("ticket")}${s("ordCreate")}</button>
          <span class="note">${s("ordCreateNote")}</span>
        </div>`:d}
      ${p?n`<div class="err" role="alert" data-order-error>${p}</div>`:d}
    </article>`}dialog(){const e=this.pv;if(!e)return d;const t=()=>!this.sending&&(this.pv=null),a=this.vendorName(e.award.vendor_id),i=e.data,r=!i||i.refusals.length>0;return n`<sw-dialog open wide ?locked=${this.sending} heading=${`${s("ordPreviewTitle")} · ${a}`} data-rfq-order-dialog @close=${t}>
      <div class="stack">
        ${i?n`
          <pre class="pv" dir=${i.lang==="en"||i.lang==="ru"?"ltr":"rtl"} data-rfq-order-preview-text>${i.text}</pre>
          <div class="note" data-order-channel>${s("ordVia",{channel:Ke(`ch_${i.channel}`)?s(`ch_${i.channel}`):i.channel})}</div>
          ${i.refusals.length?n`<ul class="refusals" data-order-refusals>${i.refusals.map(l=>n`<li data-refusal=${l}>${l==="order_channel_unavailable"?s("ordNoChannel"):qs(l)}</li>`)}</ul>`:n`<div class="note">${s("ordPreviewNote")}</div>`}`:e.error?d:n`<span class="skl" style="block-size:96px" aria-label=${s("ordLoadPreview")}></span>`}
        ${e.error?n`<div class="err" role="alert" data-dlg-error>${e.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.sending} @click=${t}>${s("cancel")}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-order-send ?disabled=${this.sending||r} @click=${()=>void this.send()}>${m("send")}${s("ordSendNow")}</button>
    </sw-dialog>`}render(){const e=this.rfq;if(!e)return d;const t=Ae(e);if(!t.length)return d;const a=Rt(e),i=t.every(r=>r.order);return n`<section class="rcard" aria-labelledby="h-order" data-rfq-order>
      <h2 id="h-order">${b("file")}${s("ordSection")}</h2>
      <p class="note">${i?s("ordAllDone"):s("ordSub")}</p>
      ${t.length>1?n`<p class="note" data-order-split>${s("ordSplit",{n:t.length})}</p>`:d}
      ${a?n`<p class="note" data-order-not-selected>${s("ordNotSelected",{n:a})}</p>`:d}
      <div class="ocards">${t.map(r=>this.card(r))}</div>
    </section>${this.dialog()}`}};J.styles=[Q,...H,Y,de`
    .rcard > p.note { margin: 0; }
    .ocards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--sw-s-4); }
    .ocard { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border);
      background: var(--dv-surface-2); min-inline-size: 0; }
    .ocard[data-ostate='sent'] { border-color: color-mix(in srgb, var(--dv-success) 40%, transparent); }
    .ohead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .ohead b { font-size: var(--sw-fs-md); }
    .ohead .chip { margin-inline-start: auto; }
    .orow { display: flex; align-items: flex-start; gap: 10px; font-size: var(--sw-fs-sm); }
    .orow > .ic { flex: none; font-size: var(--sw-fs-xl); color: var(--dv-text-2); margin-block-start: 1px; }
    .orow b { display: block; font-size: var(--sw-fs-base); }
    .orow small { display: block; color: var(--dv-text-2); }
    .oacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .oacts .note { flex: 1 1 180px; }
    .refusals { margin: 0; padding-inline-start: 18px; color: var(--au-warn-text, var(--dv-warning)); font-size: var(--sw-fs-sm); }
  `];ne([g({attribute:!1})],J.prototype,"rfq",2);ne([u()],J.prototype,"forms",2);ne([u()],J.prototype,"busy",2);ne([u()],J.prototype,"errors",2);ne([u()],J.prototype,"pv",2);ne([u()],J.prototype,"sending",2);J=ne([G("tickets-rfq-order")],J);const je=/^\d{4}-\d{2}-\d{2}$/,_s=/^(\d{1,3})(?:\.(\d{1,2}))?$/,Ss=/^(\d{1,9})(?:\.(\d{1,2}))?$/,zs=e=>{const t=`${Math.floor(e/100)}.${String(e%100).padStart(2,"0")}`;return t.endsWith(".00")?t.slice(0,-3):t};function Ve(e){const t={items:[],due:"completion",date:"",days:"30"};for(const a of e?.items??[])a.kind==="final"?(t.due=["completion","date","after_completion"].includes(a.due)?a.due:"completion",t.date=a.date??"",t.days=a.days===null||a.days===void 0?"30":String(a.days)):t.items.push({kind:a.kind,mode:a.percent?"percent":"amount",value:a.percent??zs(a.amount_minor??0),date:a.date??""});return t}function We(e,t){const a=[];let i="",r=0;return e.items.forEach((l,p)=>{const o=(l.mode==="percent"?_s:Ss).exec(l.value.trim()),c=o?Number(o[1])*100+Number((o[2]??"").padEnd(2,"0")):0;(!o||c<=0||l.mode==="percent"&&c>1e4)&&a.push(`items.${p}.value`),l.mode==="percent"&&o&&(r+=c),!je.test(l.date)||l.date<t||i&&l.date<i?a.push(`items.${p}.date`):i=l.date}),r>1e4&&a.push("items.sum"),e.due==="date"&&(!je.test(e.date)||e.date<(i||t))&&a.push("final.date"),e.due==="after_completion"&&(!/^\d{1,3}$/.test(e.days.trim())||Number(e.days)>180)&&a.push("final.days"),a}function Ns(e){const t=e.items.map(i=>({kind:i.kind,[i.mode]:i.value.trim(),due:"date",date:i.date})),a={kind:"final",due:e.due};return e.due==="date"&&(a.date=e.date),e.due==="after_completion"&&(a.days=Number(e.days)),t.push(a),{items:t}}function ze(e,t){return e.due==="date"?e.date?e.date.split("-").reverse().join("."):"":e.due==="after_completion"?t.after.replace("{n}",String(e.days??0)):t.done}function Ts(e,t,a){return(e?.items??[]).map(i=>{const r=i.kind==="final"?"":i.percent?` ${i.percent}%`:i.amount_minor!==null?` ${t(i.amount_minor)}`:"";return`${a.kinds[i.kind]??i.kind}${r} · ${ze({due:i.due,date:i.date,days:i.days},a)}`})}function Os(e){const t=e.arrival;return t.state==="confirmed"?"trm_confirmed":t.state==="proposed"?"trm_proposed":t.rejected_at?"trm_rejected":t.requested_at?"trm_waiting":"trm_not_asked"}function $e(e){const t=e?new Date(e):null;if(!t||Number.isNaN(t.getTime()))return"";const a=i=>String(i).padStart(2,"0");return`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}`}function Ds(e){const t=e.schedule;return t.total_minor===null||t.items.some(a=>a.amount_minor===null)?!0:t.items.reduce((a,i)=>a+(i.amount_minor??0),0)===t.total_minor}var Ps=Object.defineProperty,Ms=Object.getOwnPropertyDescriptor,pe=(e,t,a,i)=>{for(var r=i>1?void 0:i?Ms(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&Ps(t,a,r),r};let se=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.rfq=null,this.busy="",this.errors={},this.drafts={},this.moving={}}connectedCallback(){super.connectedCallback(),Z(this)}money(e,t){return ce(e??null,t,O()==="en"?"en":"he")}vendorName(e){const t=this.rfq?.vendors.find(a=>a.id===e);return t?t.contact.company||t.contact.name:""}async decide(e,t,a){const i=this.rfq,r=v();if(!(!i||this.busy||!r.decideArrival)){this.busy=e.id,this.errors={...this.errors,[e.id]:""};try{const l=await r.decideArrival(i.id,e.id,a,t.revision);this.rfq=l,this.dispatchEvent(new CustomEvent("changed",{detail:l})),this.dispatchEvent(new CustomEvent("notice",{detail:{ok:s(a==="accept"?"trmAccepted":"trmRejected")},bubbles:!0,composed:!0}))}catch(l){this.errors={...this.errors,[e.id]:k(l)}}finally{this.busy=""}}}async sendDraft(e,t){const a=this.rfq,i=t.draft;if(!a||!i||this.busy)return;const r=(this.drafts[e.id]??i.text).trim();if(r){this.busy=e.id,this.errors={...this.errors,[e.id]:""};try{await v().writeMessage(a.id,e.vendor_id,r,!0,i.send.source);const l=await v().get(a.id);this.rfq=l,this.dispatchEvent(new CustomEvent("changed",{detail:l})),this.dispatchEvent(new CustomEvent("notice",{detail:{ok:s("trmDraftSent")},bubbles:!0,composed:!0}))}catch(l){this.errors={...this.errors,[e.id]:k(l)}}finally{this.busy=""}}}done(e,t){this.rfq=e,this.dispatchEvent(new CustomEvent("changed",{detail:e})),this.dispatchEvent(new CustomEvent("notice",{detail:{ok:t},bubbles:!0,composed:!0}))}async demand(e,t,a){const i=this.rfq,r=v();if(!(!i||this.busy||!r.instalmentDemand)){this.busy=e.id,this.errors={...this.errors,[e.id]:""};try{const l=await r.instalmentDemand(i.id,e.id,t.index,a);this.done(l.rfq,s(a==="create"?l.created?"insDemandMade":"insDemandExists":a==="paid"?"insPaidDone":"insCancelled"))}catch(l){this.errors={...this.errors,[e.id]:k(l)}}finally{this.busy=""}}}openMove(e,t,a){this.moving={...this.moving,[e]:{date:t,to:a,reason:"",notify:!1,message:"",resend:!1,orderText:null}}}closeMove(e){const t={...this.moving};delete t[e],this.moving=t}async move(e,t,a){const i=this.rfq,r=v(),l=a?`${e.id}:${a.index}`:`${e.id}:arrival`,p=this.moving[l];if(!i||!p?.date||this.busy)return;const o={reason:p.reason,notify:p.notify,message:p.message,resendOrder:p.resend};this.busy=e.id,this.errors={...this.errors,[e.id]:""};try{let c=null;if(a&&r.moveInstalment&&(c=await r.moveInstalment(i.id,e.id,a.index,p.date,t.revision,o)),!a&&r.moveArrival&&(c=await r.moveArrival(i.id,e.id,E(p.date),p.to?E(p.to):null,t.revision,o)),!c)return;this.closeMove(l),this.done(c,s(p.resend?"mvOrderResent":p.notify?"insMovedSent":a?"insMovedDone":"arrMovedDone"))}catch(c){this.errors={...this.errors,[e.id]:k(c)}}finally{this.busy=""}}async loadOrderPreview(e,t,a){const i=this.rfq,r=this.moving[t];if(!i||!r)return;const l=e.terms,p=a?$e(l?.arrival.planned_from):r.date,o=a?$e(l?.arrival.planned_to):r.to;try{const c=await v().orderPreview(i.id,e.id,p?{work_from:E(p),work_to:o?E(o):null}:void 0),h=this.moving[t];h&&(this.moving={...this.moving,[t]:{...h,orderText:c.refusals.length?"":c.text}})}catch(c){this.errors={...this.errors,[e.id]:k(c)}}}moveEditor(e,t,a,i,r,l){const p=f=>{this.moving={...this.moving,[i]:{...r,...f}}},o=!!t.can.notify_vendor&&!!t.notice,c=(a?t.notice?.instalment:t.notice?.arrival)??"",h=!r.date||!a&&!!r.to&&r.to<r.date||r.notify&&!r.message.trim()||r.resend&&!r.orderText;return n`<div class="tmove" data-move=${i}>
      <label class="fld">${s(a?"insMoveDate":"arrMoveFrom")}<input class="inp" type="date" lang=${S()} dir="ltr" .value=${r.date}
        @input=${f=>p({date:f.target.value})}></label>
      ${a?d:n`<label class="fld">${s("arrMoveTo")}<input class="inp" type="date" lang=${S()} dir="ltr" .value=${r.to}
        @input=${f=>p({to:f.target.value})}></label>`}
      <label class="fld">${s("insMoveReason")}<input class="inp" type="text" maxlength="500" .value=${r.reason}
        @input=${f=>p({reason:f.target.value})}></label>
      ${o?n`<label class="tcheck" data-move-notify=${i}><input type="checkbox" .checked=${r.notify}
        @change=${f=>p({notify:f.target.checked,message:r.message||c})}>${s("mvNotify")}</label>
        ${r.notify?n`<label class="fld tfull" data-move-message=${i}>${s("mvMessage")}
          <textarea class="inp" rows="3" maxlength="2000" .value=${r.message}
            @input=${f=>p({message:f.target.value})}></textarea>
          <small class="mut">${s("mvMessageNote")}</small></label>`:d}`:d}
      ${e.can?.resend_order?n`<label class="tcheck" data-move-resend=${i}><input type="checkbox" .checked=${r.resend}
        @change=${f=>{const T=f.target.checked;p({resend:T,orderText:null}),T&&this.loadOrderPreview(e,i,a)}}>${s("mvResend")}</label>
        ${r.resend?n`<div class="tfull note" data-move-order-preview=${i}>${r.orderText===null?s("mvOrderLoading"):r.orderText?n`<pre class="tpre">${r.orderText}</pre>`:s("mvOrderUnavailable")}<small class="mut">${s("mvResendNote")}</small></div>`:d}`:d}
      <div class="tacts"><button type="button" class="btn primary sm" data-move-save=${i} ?disabled=${!!this.busy||h||r.date===l}
        @click=${()=>void this.move(e,t,a)}>${s(r.notify?"mvSaveSend":"insMoveSave")}</button>
        <button type="button" class="btn sm" data-move-close=${i} @click=${()=>this.closeMove(i)}>${s("insMoveClose")}</button></div>
    </div>`}instalment(e,t,a,i,r){const l=a.demand??null,p=`${e.id}:${a.index}`,o=this.moving[p],c=v(),h=!!t.can.demand&&!!c.instalmentDemand,f=!!t.can.reschedule&&!!c.moveInstalment&&a.due==="date"&&l?.status!=="paid",T=h&&a.amount_minor!==0&&(!l||l.status==="cancelled"),B=a.overdue||l||T||f&&!o;return n`<li class="tins" data-instalment=${a.kind} data-index=${a.index} data-overdue=${a.overdue?"yes":"no"}>
      <div class="trow"><span>${s(`pk_${a.kind}`)} · ${ze(a,r)}
        ${a.agreed_date?n`<small class="mut" data-moved>${s("insMoved",{date:ze({due:"date",date:a.agreed_date,days:null},r)})}</small>`:d}</span>
        ${a.amount_minor!==null?n`<span class="num">${this.money(a.amount_minor,i)}</span>`:d}</div>
      ${B?n`<div class="tacts">
        ${a.overdue?n`<span class="chip warn" data-overdue-chip>${s("insOverdue")}</span>`:d}
        ${l?n`<span class=${`chip ${l.status==="paid"?"ok":""}`} data-demand=${l.status}>${s(`ds_${l.status}`)}</span>`:d}
        ${T?n`<button type="button" class="btn sm" data-demand-create=${p} ?disabled=${!!this.busy}
          @click=${()=>void this.demand(e,a,"create")}>${s("insDemand")}</button>`:d}
        ${h&&l?.status==="open"?n`<button type="button" class="btn primary sm" data-demand-paid=${p} ?disabled=${!!this.busy}
          @click=${()=>void this.demand(e,a,"paid")}>${m("check")}${s("insPaid")}</button>
          <button type="button" class="btn sm" data-demand-cancel=${p} ?disabled=${!!this.busy} @click=${()=>void this.demand(e,a,"cancel")}>${s("insCancel")}</button>`:d}
        ${f&&!o?n`<button type="button" class="btn sm" data-move-open=${p} ?disabled=${!!this.busy}
          @click=${()=>this.openMove(p,a.date??"","")}>${b("cal")}${s("insMove")}</button>`:d}
      </div>`:d}
      ${f&&o?this.moveEditor(e,t,a,p,o,a.date??""):d}
    </li>`}arrivalMove(e,t){if(!t.can.reschedule_arrival||!v().moveArrival)return d;const a=`${e.id}:arrival`,i=this.moving[a],r=$e(t.arrival.planned_from);return i?this.moveEditor(e,t,null,a,i,r):n`<div class="tacts"><button type="button" class="btn sm" data-arrival-move-open=${e.id} ?disabled=${!!this.busy}
      @click=${()=>this.openMove(a,r,$e(t.arrival.planned_to))}>${b("cal")}${s("arrMove")}</button></div>`}card(e,t){const a=this.vendorName(e.vendor_id),i=Os(t),r=t.schedule,l={done:s("pdDone"),after:s("pdAfter")},p={vendor:"trmSourceVendor",manager:"trmSourceManager",default:"trmSourceDefault"}[r.source],o=t.arrival,c=this.errors[e.id];return n`<article class="tcard" data-rfq-terms-card=${e.vendor_id} data-award=${e.id} data-arrival=${o.state} aria-label=${`${s("trmSection")}: ${a}`}>
      <div class="thead"><span class="av" aria-hidden="true">${le(a)}</span><b>${$(a)}</b>
        <span class=${`chip ${i==="trm_confirmed"?"ok":i==="trm_proposed"?"warn":""}`} data-arrival-chip=${i}>${s(i)}</span></div>
      <div class="trow" data-terms-planned><span>${b("cal")} ${s("trmPlanned")}
        ${o.changed_at?n`<small class="mut" data-arrival-moved>${s("arrMoved")}</small>`:d}</span>
        <b class="num">${W(o.planned_from,o.planned_to)||s("trmNone")}</b></div>
      ${this.arrivalMove(e,t)}
      ${o.state==="proposed"?n`<div class="trow" data-terms-proposed><span>${s("trmProposed")}</span><b class="num">${W(o.proposed_from,o.proposed_to)}</b></div>`:d}
      ${o.reminders?n`<div class="note">${s("trmReminders",{n:o.reminders})}</div>`:d}
      <div class="trow"><b>${s("trmSchedule")}</b><small class="mut">${s(p)}</small></div>
      <ul class="tlist" data-terms-schedule>${r.items.map(h=>this.instalment(e,t,h,r.currency,l))}</ul>
      ${r.total_minor!==null?n`<div class="trow"><span>${s("rowTotal")}</span><b class="num">${this.money(r.total_minor,r.currency)}</b></div>`:d}
      ${Ds(t)?d:n`<div class="err" role="alert">${s("trmInexact")}</div>`}
      ${t.can.decide_arrival&&v().decideArrival?n`<div class="tacts">
        <button type="button" class="btn primary sm" data-arrival-accept=${e.id} ?disabled=${!!this.busy} @click=${()=>void this.decide(e,t,"accept")}>${m("check")}${s("trmAccept")}</button>
        <button type="button" class="btn sm" data-arrival-reject=${e.id} ?disabled=${!!this.busy} @click=${()=>void this.decide(e,t,"reject")}>${s("trmReject")}</button></div>`:d}
      ${t.draft?n`<label class="fld" data-terms-draft=${e.id}>${s("trmDraft")}
        <textarea class="inp" rows="3" maxlength="2000" .value=${this.drafts[e.id]??t.draft.text}
          @input=${h=>{this.drafts={...this.drafts,[e.id]:h.target.value}}}></textarea></label>
        <div class="tacts"><button type="button" class="btn sm" data-terms-draft-send=${e.id} ?disabled=${!!this.busy} @click=${()=>void this.sendDraft(e,t)}>${s("trmDraftSend")}</button></div>`:d}
      ${c?n`<div class="err" role="alert" data-terms-error>${c}</div>`:d}
    </article>`}render(){const e=this.rfq,t=(e?.awards??[]).filter(a=>a.state==="approved"&&a.terms);return!e||!t.length?d:n`<section class="rcard" aria-labelledby="h-terms" data-rfq-terms>
      <h2 id="h-terms">${b("cal")}${s("trmSection")}</h2>
      <p class="note">${s("trmSub")}</p>
      <div class="tcards">${t.map(a=>this.card(a,a.terms))}</div>
    </section>`}};se.styles=[Q,...H,Y,de`
    .tcards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--sw-s-4); }
    .tcard { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border);
      background: var(--dv-surface-2); min-inline-size: 0; }
    .thead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .thead .chip { margin-inline-start: auto; }
    .trow { display: flex; justify-content: space-between; gap: 10px; font-size: var(--sw-fs-sm); }
    .tlist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .tacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .tins { display: flex; flex-direction: column; gap: 6px; padding-block-end: 6px; border-block-end: 1px solid var(--dv-border); }
    .tins:last-child { border-block-end: 0; padding-block-end: 0; }
    .tins[data-overdue='yes'] .trow span:first-child { color: var(--dv-warn, inherit); }
    .tmove { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 8px; }
    .tmove .tacts, .tmove .tfull, .tmove .tcheck { grid-column: 1 / -1; }
    .tpre { white-space: pre-wrap; margin: 4px 0; font: inherit; }
    .tcheck { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); }
  `];pe([g({attribute:!1})],se.prototype,"rfq",2);pe([u()],se.prototype,"busy",2);pe([u()],se.prototype,"errors",2);pe([u()],se.prototype,"drafts",2);pe([u()],se.prototype,"moving",2);se=pe([G("tickets-rfq-terms")],se);var Cs=Object.defineProperty,As=Object.getOwnPropertyDescriptor,q=(e,t,a,i)=>{for(var r=i>1?void 0:i?As(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&Cs(t,a,r),r};let y=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.rfqId="",this.meta=null,this.d=null,this.phase="loading",this.failed="",this.dlg=null,this.busy=!1,this.error="",this.reason="",this.notify=!0,this.sendMode="auto",this.sendNav=!1,this.contacts=null,this.picks=new Set,this.secondNotice=new Map,this.codeLocked=new Set,this.codeBusy="",this.edit={title:"",description:"",place:"",dueDate:"",dueTime:"",from:"",to:"",kinds:[],pick:"",startPick:"",startPlace:""},this.locs=null,this.seq=0}connectedCallback(){super.connectedCallback(),Z(this)}willUpdate(e){e.has("rfqId")&&this.rfqId&&(this.d=null,this.phase="loading",this.load())}async load(){const e=++this.seq;try{const t=await v().get(this.rfqId);if(e!==this.seq)return;this.d=t,this.phase="ready"}catch(t){if(e!==this.seq)return;t instanceof A&&t.status===404?this.phase="missing":(this.failed=k(t),this.phase="error")}}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}money(e,t){return ce(e??null,t??"ILS",O()==="en"?"en":"he")}open(e){this.error="",this.reason="",this.dlg=e}async run(e,t,a=!1){this.busy=!0,this.error="";try{const i=await e();return i&&(this.d=i),a||(this.dlg=null),t&&this.notice({ok:t}),!0}catch(i){return this.error=k(i),i instanceof A&&(i.code==="rfq_stale"||i.code==="quote_stale")&&this.load(),!1}finally{this.busy=!1}}remind(e){const t=this.d;return this.run(()=>v().remind(t.id,e),s("remindDone",{n:e.length}))}send(){const e=this.d,t=this.sendMode==="manual",a=e.location?.map_url?this.sendNav:void 0;return this.run(()=>v().send(e.id,e.revision,this.sendMode,oe(),a),t?s("sendMarked"):s("sendDone"))}async loadContacts(){this.contacts=null;try{const[e,t]=await Promise.all([ge().contacts({kind:"vendor"}),ge().contacts({kind:"person"})]);this.contacts=[...e.contacts,...t.contacts]}catch{this.contacts=[]}}async addVendors(){const e=[...this.picks];e.length&&await this.run(async()=>{let t=this.d;for(const a of e){const i=this.contacts?.find(r=>r.id===a);i&&Qe(i.id,i.display_name,i.vendor_name??i.company),t=await v().addVendor(t.id,a,t.revision),this.d=t}return t},s("saved"))}openEdit(){const e=this.d,t=xe(e.due_at);this.edit={title:e.title,description:e.description,place:e.place.text??"",dueDate:t.date,dueTime:t.time,from:xe(e.work_from).date,to:xe(e.work_to).date,kinds:[...e.allowed_line_kinds],pick:Me(e.location?.id,e.place.text),startPick:Me(e.location?.id,e.place.text),startPlace:e.place.text??""},this.open({kind:"edit"}),this.locs=null,e.state==="draft"&&Ue().list().then(a=>{this.locs=a}).catch(()=>{this.locs=null})}saveEdit(){const e=this.d,t=this.edit,a=e.state==="draft",i={revision:e.revision,...a?{title:t.title.trim(),description:t.description.trim(),place_text:t.place.trim(),allowed_line_kinds:t.kinds,...this.locs?.locations.length?vt(t.startPick,t.startPlace,t.pick,t.place):{}}:{},due_at:Se(t.dueDate,t.dueTime||"12:00")||void 0,work_from:t.from?E(t.from):void 0,work_to:t.to?E(t.to):void 0};return this.run(()=>v().edit(e.id,i),s("saved"))}async del(){const e=this.d;await this.run(()=>v().remove(e.id),s("deleted"))&&this.dispatchEvent(new CustomEvent("gone",{bubbles:!0,composed:!0}))}async confirmSecond(e){const t=this.d,a=this.secondNotice.get(e.id),i=a===void 0||a===!!e.notice?.requested?void 0:a;if(await this.run(async()=>(await v().confirmAward(t.id,e.id,e.revision,i)).rfq,s("secondConfirmed"))){const l=new Map(this.secondNotice);l.delete(e.id),this.secondNotice=l}}secondNoticeTick(e){const t=e.notice;if(!t||t.mode!=="confirm")return d;const a=this.secondNotice.get(e.id)??!!t.requested,i=r=>{const l=new Map(this.secondNotice);l.set(e.id,r),this.secondNotice=l};return n`<label class="chk" data-rfq-second-notice><input type="checkbox" data-rfq-second-notice-send .checked=${a} ?disabled=${this.busy}
        @change=${r=>i(r.target.checked)} />${s("anSecondSend")}</label>
      ${a&&t.requested?n`<small>${s("anSecondNote")}</small>`:d}`}vendorName(e){const t=this.d?.vendors.find(a=>a.id===e);return t?t.contact.company||t.contact.name:""}mapLink(e){const t=Xe(e.plan_area);return t?n`<a class="chip info" href=${t} data-rfq-on-map>${m("link")}${te("showOnMap")}</a>`:d}header(e){const t=Ee(e),a=[e.ref,e.place.text||e.location?.name,e.department.name].filter(Boolean).join(" · ");return n`<header class="dh" data-rfq-board-header>
      <div class="dh-row">
        <div class="titles">
          <div class="crumbs"><a href="#/tickets">${Ne("area")}</a> ‹ <a href=${x({})} data-rfq-crumb>${s("navTitle")}</a> ‹ <b>${e.ref}</b></div>
          <h1 data-rfq-title>${$(e.title)}</h1>
          <div class="subline"><span>${$(a)}</span><span>${s("createdBy",{when:D(e.sent_at??e.created_at),who:e.created_by.name})}</span>
            ${e.due_at?n`<span>${s("fDue")}: <b>${D(e.due_at)}</b></span>`:d}
            ${e.work_from||e.work_to?n`<span>${s("fWindow")}: <b>${W(e.work_from,e.work_to)}</b></span>`:d}</div>
        </div>
        <span class="grow"></span>
      </div>
      <div class="dh-det">
        <span class=${`chip ${Ze(e.state)}`} data-rfq-state=${e.state}>${s(`st_${e.state}`)}</span>
        ${this.qBadge(me(e.questions),"header")}
        ${e.source_ticket?n`<a class="chip info" href=${`#/tickets/${e.source_ticket.id}`} data-rfq-source>${m("ticket")}${s("sourceTicket",{number:e.source_ticket.number})}</a>`:d}
        ${this.mapLink(e)}
        <span class="grow"></span>
        ${e.can.see_amounts&&t?n`<a class="btn" href=${x({id:e.id,view:"compare"})} data-rfq-to-compare>${b("columns")}${s("compareN",{n:t})}</a>`:d}
        ${e.can.send?n`<button type="button" class="btn primary" data-rfq-send @click=${()=>{this.sendMode=this.meta?.vendor_page===!1||!e.vendor_page?"manual":"auto",this.sendNav=!!e.location_nav,this.open({kind:"send"})}}>${m("send")}${s("sendTo",{n:e.vendors.filter(i=>i.state==="draft").length})}</button>`:d}
        ${this.moreItems(e).length?n`<button type="button" class="btn" data-rfq-more aria-haspopup="dialog" @click=${()=>this.open({kind:"more"})}>${m("dots")}${s("more")}</button>`:d}
      </div>
    </header>`}moreItems(e){const t=[];return e.can.edit&&t.push({key:"edit",label:s("edit"),icon:m("edit"),run:()=>this.openEdit()}),e.can.add_vendor&&t.push({key:"add",label:s("addVendors"),icon:m("plus"),run:()=>{this.picks=new Set,this.loadContacts(),this.open({kind:"add"})}}),e.can.close&&t.push({key:"close",label:s("closeRfq"),icon:m("check"),run:()=>this.open({kind:"close"})}),e.can.cancel&&t.push({key:"cancel",label:s("cancelRfq"),icon:b("ban"),run:()=>{this.notify=!0,this.open({kind:"cancel"})},danger:!0}),e.can.delete&&t.push({key:"delete",label:s("deleteRfq"),icon:m("trash"),run:()=>this.open({kind:"delete"}),danger:!0}),t}banners(e){const t=e.awards.find(i=>i.state==="pending_second"),a=e.awards.filter(i=>i.state==="approved");return n`
      ${t?n`<div class="banner warn" role="status" data-rfq-pending-second>${m("clock")}
        <div><b>${s("pendingSecond")}</b><small>${s("pendingSecondLong",{name:this.vendorName(t.vendor_id),amount:this.money(t.total_minor,t.currency)})}</small></div>
        ${e.can.see_amounts&&this.meta&&this.mayDecide(e)?n`<div class="rowacts">
          ${this.secondNoticeTick(t)}
          <button type="button" class="btn sm primary" data-rfq-second-confirm ?disabled=${this.busy} @click=${()=>void this.confirmSecond(t)}>${m("check")}${s("confirmSecond")}</button>
          <button type="button" class="btn sm" data-rfq-second-decline ?disabled=${this.busy} @click=${()=>this.open({kind:"second-decline",a:t})}>${s("declineSecond")}</button></div>`:d}
      </div>`:d}
      ${a.map(i=>n`<div class="banner info" role="status" data-rfq-awarded=${i.vendor_id}>${m("check")}
        <div><b>${s("awardedTo",{name:this.vendorName(i.vendor_id)})}${i.total_minor!==null?n` · <span class="num">${this.money(i.total_minor,i.currency)}</span>`:d}</b>
          <small>${s("baseline")}</small>${this.noticeLine(i)}</div>
        ${i.notice?.can.send?n`<button type="button" class="btn sm" data-rfq-award-notice-send ?disabled=${this.busy} @click=${()=>void this.sendNotice(i)}>${m("send")}${s("anSendNow")}</button>`:d}
        ${i.ticket?n`<a class="btn sm" href=${`#/tickets/${i.ticket.id}`} data-rfq-order-ticket>${m("ticket")}${s("orderTicket",{number:i.ticket.number})}</a>`:d}
      </div>`)}
      ${a.map(i=>this.postponementBanner(i))}
      ${e.state==="cancelled"&&e.cancel_reason?n`<div class="banner bad" role="status">${b("ban")}<div><b>${s("st_cancelled")}</b><small>${$(e.cancel_reason)}</small></div></div>`:d}`}noticeLine(e){const t=e.notice;return!t||t.state==="none"||t.state==="pending"?d:t.state==="queued"?n`<small data-rfq-award-notice="queued">${s("anSentAt",{at:D(t.at)})}</small>`:n`<small data-rfq-award-notice="not_sent">${s("anNotSent")}${t.reason?` · ${s(`anWhy_${t.reason}`)}`:""}</small>`}async sendNotice(e){const t=this.d,a=v();a.sendAwardNotice&&await this.run(async()=>(await a.sendAwardNotice(t.id,e.id)).rfq,s("anSentDone"))}postponementBanner(e){const t=e.postponement?.open;if(!t)return d;const a=t.lead_seconds,i=a===null?0:Math.round(Math.abs(a)/3600),r=v();return n`<div class="banner warn" role="status" data-rfq-postponement=${t.id}>${m("clock")}
      <div><b>${s("ppTitle")} · ${this.vendorName(e.vendor_id)}</b>${t.late?n` <span class="chip warn" title=${s("ppLateTitle")} data-rfq-postponement-late>${s("ppLate")}</span>`:d}
        <small>${s("ppProposed",{date:W(t.proposed_from,t.proposed_to)})}</small>
        ${t.scheduled_from?n`<small>${s("ppScheduled",{date:W(t.scheduled_from,null)})}</small>`:d}
        ${a!==null?n`<small data-rfq-postponement-lead=${a}>${s(a>=0?"ppLeadBefore":"ppLeadAfter",{h:i})}</small>`:d}
        <small>${s("ppReason")}: ${$(t.reason)}</small>
        <small class="mut">${s("ppMoveHint")}</small></div>
      ${e.postponement?.can.acknowledge&&r.ackPostponement?n`<div class="rowacts"><button type="button" class="btn sm" data-rfq-postponement-ack ?disabled=${this.busy}
        @click=${()=>void this.run(()=>r.ackPostponement(this.d.id,e.id,t.id),s("ppAckDone"))}>${m("check")}${s("ppAck")}</button></div>`:d}
    </div>`}mayDecide(e){return e.can.award||e.can.see_amounts&&e.awards.some(t=>t.state==="pending_second")}kpis(e){const t=e.kpis,a=(i,r,l,p=!1)=>n`<div class=${`kpi${p?" warn":""}`} data-kpi=${l}><small>${s(i)}</small><b>${r}</b></div>`;return n`<div class="kpis" data-rfq-kpis>
      ${a("kInvited",t.invited,"invited")}${a("kOpened",t.opened,"opened")}${a("kQuoted",t.quoted,"quoted")}
      ${a("kDeclined",t.declined,"declined")}${a("kNoReply",t.no_response,"no_reply",t.no_response>0&&e.state==="due_passed")}
      ${e.can.see_amounts&&t.lowest_total_minor!==null?a("kLowest",this.money(t.lowest_total_minor,t.currency),"lowest"):d}
    </div>`}qBadge(e,t){return e?n`<span class=${`qbadge${e.fresh?"":" seen"}`} role="status" aria-label=${s("qBadgeAria",{n:e.n})} data-rfq-q-badge=${t} data-n=${e.n}>
      ${b("chat")}${e.n===1?s("qBadgeOne"):s("qBadge",{n:e.n})}${e.fresh?n` · ${s("qBadgeNew")}`:d}</span>`:d}vendorBadges(e){return n`${this.qBadge(me(e.questions),"vendor")}${e.quote?.has_note?n`<span class="chip info" title=${s("qNoteTitle")} data-rfq-note-chip>${s("qVendorNote")}</span>`:d}`}async openQuestion(e){const t=this.d;if(this.open({kind:"answer",q:e}),!e.read&&t.can.answer)try{await v().markRead(t.id,e.vendor_id),ue(),this.load()}catch{}}questionsCard(e){const t=$t(e);return t.length?n`<section class="qsec" aria-labelledby="h-q" data-rfq-questions=${t.length}>
      <h2 id="h-q">${b("chat")}${s("qSection")} ${this.qBadge(me(e.questions),"section")}</h2>
      <small>${s("qSectionSub")}</small>
      <ul class="qlist">${t.map(a=>n`<li class="qitem" data-rfq-question=${a.id} data-read=${String(a.read)}>
        <div>
          <span class="qmeta"><b>${$(a.vendor.company||a.vendor.name)}</b>
            ${a.read?d:n`<span class="qbadge">${s("qBadgeNew")}</span>`}
            <span>${a.age_h>0?s("qAge",{h:a.age_h}):s("qAgeNow")}</span>
            ${a.quote?n`<span>${s("qWithQuote",{n:a.quote.version})}</span>`:d}
            ${a.unverified?n`<span class="chip warn">${s("qViaWhatsapp")}</span>`:d}</span>
          <p>${$(a.text)}</p>
        </div>
        ${e.can.answer?n`<div class="rowacts">
          <button type="button" class="btn sm primary" data-rfq-q-answer=${a.id} @click=${()=>void this.openQuestion(a)}>${m("send")}${s("qAnswer")}</button>
          <button type="button" class="btn sm quiet" data-rfq-q-resolve=${a.id} @click=${()=>this.open({kind:"resolve",q:a})}>${s("qResolve")}</button></div>`:d}
      </li>`)}</ul>
    </section>`:d}chan(e){const t=e.channel==="whatsapp"?b("chat"):e.channel==="email"?b("mail"):m("copy");return n`<span class="chan" title=${s(`ch_${e.channel}`)}>${t}<span class="vh">${s(`ch_${e.channel}`)}</span></span>`}codeSwitchShown(e){const t=this.d;return!!this.meta?.vendor_options&&t.can.edit&&typeof e.require_code=="boolean"&&e.state!=="awarded"&&e.state!=="removed"}async setCode(e,t){const a=this.d;if(!this.codeBusy){this.codeBusy=e.id;try{this.d=await v().vendorOptions(a.id,e.id,{revision:a.revision,require_code:t}),this.notice({ok:s(t?"codeSetOn":"codeSetOff")})}catch(i){i instanceof A&&i.code==="vendor_code_locked"&&(this.codeLocked=new Set(this.codeLocked).add(e.id)),i instanceof A&&i.code==="rfq_stale"&&this.load(),this.notice({error:k(i)})}finally{this.codeBusy=""}}}codeSwitch(e){const t=!!e.require_code,a=t&&this.codeLocked.has(e.id),i=e.contact.company||e.contact.name;return n`<span class="codesw-wrap"><button type="button" class="rc codesw" aria-pressed=${String(t)} aria-label=${s("codeToggle",{name:i})} data-rfq-code-toggle=${e.id}
        data-on=${String(t)} ?disabled=${this.codeBusy===e.id||a} title=${a?s("codeLocked"):""} @click=${()=>void this.setCode(e,!t)}>${m("lock")}<span>${t?s("codeOn"):s("codeOff")}</span></button>
      ${a?n`<small class="reason" data-rfq-code-locked>${s("codeLocked")}</small>`:d}</span>`}vendorActions(e){const t=this.d;return[e.can.quote_on_behalf,e.can.decline_on_behalf,e.can.remove,e.can.message,e.quote?.state==="submitted"&&e.can.quote_on_behalf,e.link?.state==="live"&&t.can.edit].filter(Boolean).length}row(e){const t=this.d,a=e.contact.company||e.contact.name,i=e.quote;return n`<tr data-rfq-vendor-row=${e.id} data-vstate=${e.state}>
      <td class="first"><span class="vname"><span class="av" aria-hidden="true">${le(a)}</span><span><b>${$(a)}</b>${e.contact.company?n`<small>${$(e.contact.name)}</small>`:d}</span></span>
        ${this.vendorBadges(e)}</td>
      <td data-l=${s("colChannel")}><span class="chancol">${this.chan(e)}${this.codeSwitchShown(e)?this.codeSwitch(e):d}</span></td>
      <td data-l=${s("colState")}><span><span class=${`chip ${Bt(e.state)}`} data-vchip>${s(`v_${e.state}`)}</span>
        ${e.decline_reason?n`<span class="reason">${$(e.decline_reason)}</span>`:d}</span></td>
      <td data-l=${s("colSent")} class="num">${D(e.sent_at)||"—"}</td>
      <td data-l=${s("colOpened")} class="num">${D(e.first_opened_at)||"—"}</td>
      <td data-l=${s("colQuote")} class="num" data-rfq-quote-cell>${i&&i.total_minor!==void 0?n`<b>${this.money(i.total_minor,i.currency)}</b> <span class="mut">${Le(i.created_at)}</span>`:i?n`<span class="mut">${Le(i.created_at)}</span>`:"—"}</td>
      <td data-l=${s("colActions")}><div class="rowacts">
        ${e.can.remind?n`<button type="button" class="btn sm quiet" data-rfq-remind=${e.id} @click=${()=>this.open({kind:"remind",ids:[e.id]})}>${b("bell")}${s("remind")}</button>`:d}
        ${i&&t.can.see_amounts?n`<a class="btn sm quiet" href=${x({id:t.id,view:"compare"})} data-rfq-row-compare>${b("columns")}${s("compare")}</a>`:d}
        ${this.vendorActions(e)?n`<button type="button" class="ibtn" aria-label=${`${s("more")}: ${a}`} aria-haspopup="dialog" data-rfq-vendor-more=${e.id} @click=${()=>this.open({kind:"vendor",v:e})}>${m("dots")}</button>`:d}
      </div></td>
    </tr>`}vendorsCard(e){const t=Ft(e.vendors),a=It(e.vendors),i=Ee(e);return n`<section class="rcard" aria-labelledby="h-vendors" data-rfq-vendors>
      <h2 id="h-vendors">${m("users")}${s("secVendors")}
        <div class="act">
          ${e.can.remind&&a.length>1?n`<button type="button" class="btn sm quiet" data-rfq-remind-all @click=${()=>this.open({kind:"remind",ids:a.map(r=>r.id)})}>${b("bell")}${s("remindAll")}</button>`:d}
          ${i&&e.can.see_amounts?n`<a class="btn sm primary" href=${x({id:e.id,view:"compare"})} data-rfq-compare-n>${b("columns")}${s("compareN",{n:i})}</a>`:d}
        </div></h2>
      ${t.length?n`<table class="rtbl">
        <thead><tr><th scope="col">${s("colVendor")}</th><th scope="col">${s("colChannel")}</th><th scope="col">${s("colState")}</th><th scope="col">${s("colSent")}</th>
          <th scope="col">${s("colOpened")}</th><th scope="col">${s("colQuote")}</th><th scope="col"><span class="vh">${s("colActions")}</span></th></tr></thead>
        <tbody>${ye(t,r=>r.id,r=>this.row(r))}</tbody></table>`:n`<div class="note" data-rfq-no-vendors>${s("noVendorsYet")}</div>`}
      ${e.can.add_vendor?n`<div><button type="button" class="btn sm quiet" data-rfq-add-vendors @click=${()=>{this.picks=new Set,this.loadContacts(),this.open({kind:"add"})}}>${m("plus")}${s("addVendors")}</button></div>`:d}
    </section>`}fileRows(e){const t=v();return(e.attachments??[]).map(a=>({key:a.id,name:a.name,kind:a.kind,bytes:a.bytes,caption:a.caption,visible:a.visible_vendors,thumb:a.thumb?t.attachmentUrl(e.id,a.id,!0):"",href:t.attachmentUrl(e.id,a.id),removed:a.removed}))}async addFiles(e){const t=this.d;await this.run(async()=>{let a=t;for(const i of e)a=await v().uploadAttachment(t.id,i,{visible_vendors:!0});return a},s("fileAdded"),!0),this.error&&this.notice({error:this.error})}filesCard(e){if(!this.meta?.attachments&&!(e.attachments??[]).length)return d;const t=!!e.can.attach;if(!t&&!(e.attachments??[]).length)return d;const a=(i,r)=>void this.run(i,r,!0).then(l=>{l||this.notice({error:this.error})});return n`<section class="rcard" aria-labelledby="h-files" data-rfq-files-card>
      <h2 id="h-files">${b("clip")}${s("secFiles")}<span class="mut">${(e.attachments??[]).filter(i=>!i.removed).length||""}</span></h2>
      <tickets-rfq-files ?editable=${t} ?busy=${this.busy} .rows=${this.fileRows(e)} .limits=${this.meta?.attachment_limits??ae}
        @files-picked=${i=>void this.addFiles(i.detail.files)}
        @file-caption=${i=>a(()=>v().editAttachment(e.id,i.detail.key,{caption:i.detail.caption}),s("saved"))}
        @file-visible=${i=>a(()=>v().editAttachment(e.id,i.detail.key,{visible_vendors:i.detail.visible}),s("saved"))}
        @file-remove=${i=>a(()=>v().removeAttachment(e.id,i.detail.key),s("fileRemoved"))}></tickets-rfq-files>
    </section>`}sendFiles(e){const t=(e.attachments??[]).filter(l=>!l.removed);if(!this.meta?.attachments&&!t.length)return d;const a=Fe(t),i=O()==="en"?"en":"he",r=v();return n`<div class="stack" data-rfq-send-files><b>${s("sendFiles")}</b>
      ${a.length?n`<ul class="sendfiles">${a.map(l=>n`<li data-rfq-send-file><span class="th">${l.thumb?n`<img src=${r.attachmentUrl(e.id,l.id,!0)} alt="" />`:b(l.kind==="xlsx"?"sheet":"file")}</span><span>${$(l.name)}</span><small>${re(l.bytes,i)}</small></li>`)}</ul>`:n`<span class="note">${s("sendFilesNone")}</span>`}
      ${t.length>a.length?n`<span class="note" data-rfq-send-internal>${s("sendFilesInternal",{n:t.length-a.length})}</span>`:d}</div>`}timeline(e){return n`<section class="rcard" aria-labelledby="h-tl" data-rfq-timeline>
      <h2 id="h-tl">${b("history")}${s("timeline")}</h2>
      <ol class="tl">${e.timeline.map(t=>{const a=jt(t,i=>this.vendorName(i),(i,r)=>this.money(i,r));return n`<li data-ev=${t.kind}><time datetime=${t.at}>${D(t.at)}</time><span>${$(s(a.key,a.vars))}</span></li>`})}</ol>
    </section>`}dialog(){const e=this.dlg,t=this.d;if(!e||!t)return d;const a=()=>!this.busy&&(this.dlg=null),i=(o,c,h,f=!1,T=!1)=>n`
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${a}>${s("cancel")}</button>
      <button slot="footer" type="button" class=${`btn ${T?"danger":"primary"}`} data-dlg-ok=${c} ?disabled=${this.busy||f} @click=${h}>${o}</button>`,r=this.error?n`<div class="err" role="alert" data-dlg-error>${this.error}</div>`:d,l=(o,c,h,f,T=!1)=>n`<sw-dialog open ?wide=${T} ?locked=${this.busy}
      heading=${o} data-rfq-dialog=${c} @close=${a}><div class="stack">${h}${r}</div>${f}</sw-dialog>`,p=o=>o.contact.company||o.contact.name;switch(e.kind){case"remind":return l(s("remindTitle"),"remind",n`<p class="note">${s("remindBody",{n:e.ids.length})}</p>`,i(s("remind"),"remind",()=>void this.remind(e.ids)));case"send":{const o=t.vendors.filter(B=>B.state==="draft").length,c=!t.vendor_page||this.meta?.vendor_page===!1,h=t.vendors.find(B=>B.state==="draft"),f=Ye({name:h?.contact.name||s("previewName"),number:String(t.number),title:t.title,place:t.place.text||[t.location?.message??"",this.sendNav?t.location?.map_url??"":""].filter(Boolean).join(" · "),due:D(t.due_at),window:W(t.work_from,t.work_to)||s("previewFlexible"),link:s("previewLink"),organization:"",files:at(Fe(t.attachments??[]).length)},O()),T=(B,it,nt,we)=>n`<label aria-disabled=${String(we)} data-rfq-send-mode=${B}>
          <input type="radio" name="bmode" .checked=${this.sendMode===B} ?disabled=${we||this.busy} @change=${()=>this.sendMode=B} /><b>${s(it)}</b><small>${we?s("sendPageOff"):s(nt)}</small></label>`;return l(s("sendTitle"),"send",n`<p class="note">${s("sendTo",{n:o})}</p>
          <div class="choice" role="radiogroup" aria-label=${s("sendTitle")}>${T("auto","sendAuto","sendAutoSub",c)}${T("manual","sendManual","sendManualSub",!1)}</div>
          ${this.sendMode==="auto"&&t.location?n`<label class="chk" data-rfq-location-nav><input type="checkbox" .checked=${this.sendNav}
            ?disabled=${this.busy||!t.location.map_url} @change=${B=>this.sendNav=B.target.checked} />
            <span><b>${te("navOn")}</b><small>${t.location.map_url?te("navOnSub"):te("navNoCoords")}</small></span></label>`:d}
          ${this.sendMode==="auto"?n`<pre class="pv" dir=${O()==="en"?"ltr":"rtl"} data-rfq-send-preview>${f}</pre>`:d}
          ${this.sendFiles(t)}`,i(s("sendNow"),"send",()=>void this.send(),c&&this.sendMode==="auto"),!0)}case"more":{const o=this.moreItems(t);return l(s("more"),"more",n`<div class="menu" role="menu">${o.map(c=>n`<button type="button" role="menuitem" class=${`btn ${c.danger?"danger":""}`} data-more=${c.key}
          @click=${()=>{this.dlg=null,c.run()}}>${c.icon}${c.label}</button>`)}</div>`,d)}case"vendor":{const o=e.v,c=[];return o.can.message&&c.push({key:"message",label:s("writeVendor"),icon:b("chat"),next:{kind:"message",v:o}}),o.can.quote_on_behalf&&c.push({key:"quote",label:s("onBehalf"),icon:b("coin"),next:{kind:"quote",v:o}}),o.quote?.state==="submitted"&&o.can.quote_on_behalf&&c.push({key:"withdraw",label:s("withdraw"),icon:m("x"),next:{kind:"withdraw",v:o}}),o.can.decline_on_behalf&&c.push({key:"decline",label:s("declineBehalf"),icon:b("hand"),next:{kind:"decline",v:o}}),o.link?.state==="live"&&t.can.edit&&c.push({key:"revoke",label:s("revokeLink"),icon:m("lock"),next:{kind:"revoke",v:o},danger:!0}),o.can.remove&&c.push({key:"remove",label:s("removeVendor"),icon:m("trash"),next:{kind:"remove",v:o},danger:!0}),l(p(o),"vendor",n`<div class="menu" role="menu">${c.map(h=>n`<button type="button" role="menuitem" class=${`btn ${h.danger?"danger":""}`} data-vmore=${h.key}
          @click=${()=>this.open(h.next)}>${h.icon}${h.label}${h.key==="message"&&o.messages?n`<small class="mut">(${o.messages})</small>`:d}</button>`)}</div>`,d)}case"remove":return l(s("removeVendor"),"remove",n`<p>${s("removeVendorQ",{name:p(e.v)})}</p>`,i(s("removeVendor"),"remove",()=>void this.run(()=>v().removeVendor(t.id,e.v.id,t.revision),s("saved")),!1,!0));case"revoke":return l(s("revokeLink"),"revoke",n`<p>${s("revokeLinkQ",{name:p(e.v)})}</p>`,i(s("revokeLink"),"revoke",()=>void this.run(()=>v().revokeLink(t.id,e.v.id),s("saved")),!1,!0));case"withdraw":return l(s("withdraw"),"withdraw",n`<p>${s("withdrawQ",{name:p(e.v)})}</p>`,i(s("withdraw"),"withdraw",()=>void this.run(()=>v().withdrawQuote(t.id,e.v.id,e.v.quote?.id??"",e.v.quote?.revision??1),s("saved")),!1,!0));case"decline":return l(s("declineBehalfTitle",{name:p(e.v)}),"decline",n`<label class="fld">${s("declineReason")}<input class="inp" maxlength="200" data-dlg-reason .value=${this.reason}
          @input=${o=>this.reason=o.target.value} /></label>`,i(s("confirm"),"decline",()=>void this.run(()=>v().declineOnBehalf(t.id,e.v.id,this.reason.trim()||void 0),s("saved"))));case"quote":return n`<tickets-rfq-quote-dialog open .rfq=${t} .vendor=${e.v} .currencies=${this.meta?.currencies?.length?this.meta.currencies:["ILS"]}
          @close=${()=>this.dlg=null} @saved=${o=>{this.d=o.detail,this.dlg=null,this.notice({ok:s("qSaved")})}}></tickets-rfq-quote-dialog>`;case"answer":return n`<tickets-rfq-question-dialog open .rfq=${t} .question=${e.q} @close=${()=>this.dlg=null}
          @saved=${o=>{this.d=o.detail.rfq,this.dlg=null,ue(),this.notice({ok:`${o.detail.copies>1?s("qDoneAll",{n:o.detail.copies}):s("qDone")}${o.detail.notified?` · ${s("qDoneNotified",{n:o.detail.notified})}`:""}`})}}></tickets-rfq-question-dialog>`;case"resolve":return l(s("qResolve"),"resolve",n`<div class="qbox"><p>${$(e.q.text)}</p></div><p>${s("qResolveQ")}</p>`,i(s("qResolve"),"resolve",()=>void this.run(()=>v().resolveQuestion(t.id,e.q.id),s("qResolved")).then(()=>ue())));case"message":return n`<tickets-rfq-message-dialog open .rfq=${t} .vendor=${e.v} @close=${()=>this.dlg=null}
          @saved=${o=>{this.dlg=null,ue(),this.notice({ok:o.detail.notified?s("writeDoneNotified"):s("writeDone")}),this.load()}}></tickets-rfq-message-dialog>`;case"add":{const o=new Set(t.vendors.filter(h=>h.state!=="removed").map(h=>h.contact.id)),c=(this.contacts??[]).filter(h=>Ge(h,t.department.id)&&!o.has(h.id));return l(s("addVendorsTitle"),"add",n`<p class="note">${s("addVendorsNote")}</p>
          ${this.contacts===null?n`<span class="skl" style="block-size:52px"></span>`:c.length?n`<div class="vlist" role="group" aria-label=${s("secVendors")}>
            ${c.map(h=>n`<label class=${`vrow${this.picks.has(h.id)?" on":""}`} style="grid-template-columns:auto auto minmax(0,1fr)" data-add-pick=${h.id}>
              <input type="checkbox" .checked=${this.picks.has(h.id)} @change=${f=>{const T=new Set(this.picks);f.target.checked?T.add(h.id):T.delete(h.id),this.picks=T}} />
              <span class="av" aria-hidden="true">${le(h.vendor_name??h.company??h.display_name)}</span>
              <span class="vname"><span><b>${$(h.vendor_name||h.company||h.display_name)}</b><small>${$(h.display_name)}</small></span></span></label>`)}
          </div>`:n`<div class="note">${s("vendorsNone")} · <a href="#/tickets/handlers?seg=vendors">${s("vendorsToDirectory")}</a></div>`}`,i(s("save"),"add",()=>void this.addVendors(),!this.picks.size),!0)}case"edit":{const o=this.edit,c=t.state==="draft",h=f=>this.edit={...o,...f};return l(s("editTitle"),"edit",n`${c?n`
            <label class="fld">${s("fTitle")}<input class="inp" maxlength="120" .value=${o.title} data-edit-title @input=${f=>h({title:f.target.value})} /></label>
            <label class="fld">${s("fDescription")}<textarea class="inp" style="min-block-size:88px;padding-block:10px" maxlength="4000" .value=${o.description} @input=${f=>h({description:f.target.value})}></textarea></label>
            ${He({ans:this.locs,pick:o.pick,other:o.place,disabled:this.busy,label:s("fPlace"),onPick:f=>h({pick:f}),onOther:f=>h({place:f})})}
            <div class="kinds" role="group" aria-label=${s("fKinds")}>${["labor","parts","travel","other"].map(f=>n`<button type="button" class="rc" aria-pressed=${String(o.kinds.includes(f)||f==="labor")}
              ?disabled=${f==="labor"} @click=${()=>h({kinds:Je(o.kinds,f)})}>${V(`k_${f}`)}</button>`)}</div>`:n`<p class="note">${s("editLocked")}</p>`}
          <div class="frm">
            <label class="fld">${s("fDue")}<input class="inp" type="date" lang=${S()} data-edit-due .value=${o.dueDate} @change=${f=>h({dueDate:f.target.value})} /></label>
            <label class="fld">${s("fDueTime")}<input class="inp" type="time" lang=${S()} .value=${o.dueTime} @change=${f=>h({dueTime:f.target.value})} /></label>
            <label class="fld">${s("fWindowFrom")}<input class="inp" type="date" lang=${S()} .value=${o.from} @change=${f=>h({from:f.target.value})} /></label>
            <label class="fld">${s("fWindowTo")}<input class="inp" type="date" lang=${S()} .value=${o.to} min=${o.from||""} @change=${f=>h({to:f.target.value})} /></label>
          </div>`,i(s("save"),"edit",()=>void this.saveEdit(),c&&!o.title.trim()),!0)}case"close":return l(s("closeRfq"),"close",n`<p>${s("closeQ")}</p>`,i(s("closeRfq"),"close",()=>void this.run(()=>v().close(t.id,t.revision),s("closed"))));case"cancel":{const o=t.vendors.some(c=>c.quote&&c.quote.state==="submitted");return l(s("cancelQ"),"cancel",n`<label class="fld">${s("cancelReason")}<input class="inp" maxlength="500" data-dlg-reason .value=${this.reason}
            @input=${c=>this.reason=c.target.value} /></label>
          ${o?n`<label class="chk"><input type="checkbox" data-cancel-notify .checked=${this.notify} @change=${c=>this.notify=c.target.checked} />${s("cancelNotify")}</label>`:d}`,i(s("cancelRfq"),"cancel",()=>void this.run(()=>v().cancel(t.id,t.revision,this.reason.trim()||void 0,o&&this.notify),s("cancelled")),!1,!0))}case"delete":return l(s("deleteRfq"),"delete",n`<p>${s("deleteQ")}</p>`,i(s("deleteRfq"),"delete",()=>void this.del(),!1,!0));case"second-decline":return l(s("declineSecondTitle"),"second-decline",n`<label class="fld">${s("declineSecondReason")}<input class="inp" maxlength="500" required data-dlg-reason .value=${this.reason}
          @input=${o=>this.reason=o.target.value} /></label>`,i(s("declineSecond"),"second-decline",()=>void this.run(()=>v().declineAward(t.id,e.a.id,e.a.revision,this.reason.trim()),s("secondDeclined")),!this.reason.trim(),!0));default:return d}}render(){if(this.phase==="loading")return n`<div class="page" data-rfq-board data-phase="loading" aria-busy="true"><span class="skl" style="block-size:64px"></span><div class="kpis">${[1,2,3,4].map(()=>n`<span class="skl" style="block-size:76px"></span>`)}</div><span class="skl" style="block-size:280px"></span></div>`;if(this.phase==="missing")return n`<div class="page" data-rfq-board data-phase="missing"><div class="statebox glass" role="status"><span class="ring">${m("search")}</span><b>${s("emptyFiltered")}</b><a class="btn sm" href=${x({})}>${s("back")}</a></div></div>`;if(this.phase==="error"||!this.d)return n`<div class="page" data-rfq-board data-phase="error"><div class="statebox glass" role="status"><span class="ring">${m("warning")}</span><b>${s("loadFailed")}</b>
        <span class="vh">${this.failed}</span><button type="button" class="btn sm" @click=${()=>{this.phase="loading",this.load()}}>${m("refresh")}${s("retry")}</button></div></div>`;const e=this.d;return n`<div class="page" data-rfq-board data-phase="ready" data-rfq-id=${e.id}>
      ${this.header(e)}
      ${this.questionsCard(e)}
      ${this.banners(e)}
      ${e.awards.some(t=>t.state==="approved")?n`<tickets-rfq-order .rfq=${e} @changed=${t=>this.d=t.detail}></tickets-rfq-order>`:d}
      ${e.awards.some(t=>t.state==="approved"&&t.terms)?n`<tickets-rfq-terms .rfq=${e} @changed=${t=>this.d=t.detail}></tickets-rfq-terms>`:d}
      ${this.kpis(e)}
      <div class="grid2">${this.vendorsCard(e)}${this.timeline(e)}</div>
      ${this.filesCard(e)}
    </div>${this.dialog()}`}};y.styles=[Q,...H,Te,Y];q([g()],y.prototype,"rfqId",2);q([g({attribute:!1})],y.prototype,"meta",2);q([u()],y.prototype,"d",2);q([u()],y.prototype,"phase",2);q([u()],y.prototype,"failed",2);q([u()],y.prototype,"dlg",2);q([u()],y.prototype,"busy",2);q([u()],y.prototype,"error",2);q([u()],y.prototype,"reason",2);q([u()],y.prototype,"notify",2);q([u()],y.prototype,"sendMode",2);q([u()],y.prototype,"sendNav",2);q([u()],y.prototype,"contacts",2);q([u()],y.prototype,"picks",2);q([u()],y.prototype,"secondNotice",2);q([u()],y.prototype,"codeLocked",2);q([u()],y.prototype,"codeBusy",2);q([u()],y.prototype,"edit",2);q([u()],y.prototype,"locs",2);y=q([G("tickets-rfq-board")],y);var Es=Object.defineProperty,Ls=Object.getOwnPropertyDescriptor,_=(e,t,a,i)=>{for(var r=i>1?void 0:i?Ls(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&Es(t,a,r),r};let w=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.rfqId="",this.meta=null,this.c=null,this.d=null,this.phase="loading",this.failed="",this.filter="all",this.sort="price",this.sel=new Map,this.expanded=new Set,this.confirm=!1,this.drafts=null,this.message=null,this.busy=!1,this.error="",this.pays=new Map,this.arrivals=new Map,this.notices=new Map,this.noticeOff=new Set,this.seq=0}connectedCallback(){super.connectedCallback(),Z(this)}willUpdate(e){e.has("rfqId")&&this.rfqId&&(this.c=null,this.d=null,this.sel=new Map,this.phase="loading",this.load())}async load(){const e=++this.seq;try{const[t,a]=await Promise.all([v().get(this.rfqId),v().comparison(this.rfqId)]);if(e!==this.seq)return;this.d=t,this.c=a,this.sel=new Map([...this.sel].filter(([i])=>a.quotes.some(r=>r.quote_id===i&&r.can.award))),this.phase="ready"}catch(t){if(e!==this.seq)return;t instanceof A&&t.status===403?this.phase="forbidden":(this.failed=k(t),this.phase="error")}}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}money(e,t){return ce(e??null,t,O()==="en"?"en":"he")}name(e){return e.vendor.company||e.vendor.name}canPick(e){return!!this.d?.can.award&&e.can.award&&e.state==="submitted"}toggle(e,t){const a=new Map(this.sel);t?a.set(e.quote_id,{mode:"all"}):a.delete(e.quote_id),this.sel=a}setScope(e,t){this.sel=new Map(this.sel).set(e.quote_id,t)}selections(){const e=this.c?.quotes??[];return[...this.sel].map(([t,a])=>({quote:e.find(i=>i.quote_id===t),scope:a})).filter(t=>!!t.quote)}scopeLabel(e,t){return t.mode==="all"?s("sc_all"):t.mode==="kinds"?t.kinds.map(a=>s("onlyKind",{kind:V(`k_${a}`)})).join(", "):`${s("sc_lines")} (${t.indexes.length}/${e.lines.length})`}async award(){const e=this.d,t=this.selections();if(!e||!t.length||!t.every(r=>Re(r.quote,r.scope)))return;this.busy=!0,this.error="";const a=[];let i="";try{for(const l of Vt(t)){i=l.quote_id;const p=t.find(c=>c.quote.quote_id===l.quote_id)?.quote.vendor_id??"",o=await v().award(e.id,{...l,...this.termsBody(l.quote_id),...this.noticeBody(p)});if(a.push(o),this.d=o.rfq,o.award.state==="pending_second")break}this.confirm=!1;const r=a.some(l=>l.award.state==="pending_second");this.notice({ok:r?s("awardPendingDone"):s("awardDone")}),r||(this.drafts=this.draftsOf(a,t)),this.sel=new Map,this.pays=new Map,this.arrivals=new Map,this.notices=new Map,this.noticeOff=new Set,await this.load()}catch(r){this.error=k(r),this.openEditorOn(r,t.find(l=>l.quote.quote_id===i)?.quote),a.length&&await this.load()}finally{this.busy=!1}}openEditorOn(e,t){const a=e instanceof A?e.body.details?.fields:void 0;!t||!this.termsOn()||this.pays.has(t.quote_id)||!a?.some(i=>String(i.field??"").startsWith("payment"))||(this.setPay(t.quote_id,Ve(t.payment_proposal)),this.error=s("pyInvalid"))}noticeMode(){return this.meta?.award_notice??null}openConfirm(){this.error="",this.confirm=!0,this.loadNotices()}async loadNotices(){const e=this.d,t=v(),a=this.noticeMode();if(!e||!a||a==="off"||!t.awardNoticePreview)return;const i=new Map;for(const r of this.selections())try{i.set(r.quote.vendor_id,await t.awardNoticePreview(e.id,r.quote.vendor_id))}catch{}this.notices=i}noticeBody(e){const t=this.noticeMode();if(!t||t==="off")return{};const a=this.notices.get(e);return t==="auto"?this.noticeOff.has(e)?{award_notice:!1}:{}:{award_notice:!!a&&a.refusals.length===0&&!this.noticeOff.has(e)}}noticeBlock(e){const t=this.noticeMode(),a=this.notices.get(e.vendor_id);if(!t||t==="off"||!a)return d;const i=a.refusals.length>0,r=this.noticeOff.has(e.vendor_id),l=p=>{const o=new Set(this.noticeOff);p?o.delete(e.vendor_id):o.add(e.vendor_id),this.noticeOff=o};return n`<div class="draft" data-cmp-notice=${e.vendor_id} data-notice-mode=${t}>
      <b>${$(this.name(e))} · ${s("anTitle")}</b>
      ${i?n`<div class="banner warn" role="status" data-cmp-notice-blocked>${s("anCannot",{why:s(`anWhy_${a.refusals[0]}`)})}</div>`:d}
      ${t==="confirm"?n`<label class="chk"><input type="checkbox" data-cmp-notice-send .checked=${!i&&!r} ?disabled=${i||this.busy}
          @change=${p=>l(p.target.checked)} />${s("anSend")}</label>`:n`<p class="note">${s("anAuto")}</p><label class="chk"><input type="checkbox" data-cmp-notice-skip .checked=${r} ?disabled=${this.busy}
          @change=${p=>l(!p.target.checked)} />${s("anAutoSkip")}</label>`}
      <p class="note" dir="auto" style="white-space:pre-line" data-cmp-notice-text lang=${a.lang}>${a.text}</p>
      <p class="note">${s("anNote")}</p>
    </div>`}termsOn(){return!!this.meta?.schedule_arrival}termsBody(e){if(!this.termsOn())return{};const t={},a=this.pays.get(e);a?t.payment=Ns(a):this.c?.quotes.find(r=>r.quote_id===e)?.payment_proposal&&(t.payment_source="vendor");const i=this.arrivals.get(e);return i&&(t.arrival={work_from:E(i)}),t}today(){const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}termsOk(){return[...this.pays.values()].every(e=>We(e,this.today()).length===0)}setPay(e,t){const a=new Map(this.pays);t?a.set(e,{...t,items:t.items.map(i=>({...i}))}):a.delete(e),this.pays=a}proposalWords(e){const t={advance:s("pk_advance"),progress:s("pk_progress"),final:s("pk_final")};return Ts(e.payment_proposal,a=>this.money(a,e.currency),{done:s("pdDone"),after:s("pdAfter"),kinds:t})}termsEditor(e){const t=this.pays.get(e.quote_id),a=this.proposalWords(e),i=this.arrivals.get(e.quote_id)??"",r=t?We(t,this.today()):[],l=p=>{const o={...t,items:t.items.map(c=>({...c}))};p(o),this.setPay(e.quote_id,o)};return n`<div class="stack" data-cmp-terms=${e.quote_id}>
      <b>${$(this.name(e))} · ${s("pyRow")}</b>
      ${a.length?n`<ul class="thr">${a.map(p=>n`<li>${p}</li>`)}</ul>`:n`<p class="note">${s("pyNone")}</p>`}
      <label class="chk"><input type="checkbox" data-cmp-pay-edit .checked=${!!t} @change=${p=>this.setPay(e.quote_id,p.target.checked?Ve(e.payment_proposal):null)} />${s("pyEdit")}</label>
      ${t?n`<p class="note">${s("pyEditNote")}</p>
        ${t.items.map((p,o)=>n`<div class="frm" data-cmp-pay-item=${o}>
          <span class="mut">${s(p.kind==="advance"?"pk_advance":"pk_progress")}</span>
          <span class="seg sm" role="radiogroup">${["percent","amount"].map(c=>n`<button type="button" role="radio" aria-checked=${String(p.mode===c)}
            @click=${()=>l(h=>{h.items[o].mode=c})}>${s(c==="percent"?"pyPercent":"pyAmount")}</button>`)}</span>
          <input class="inp" inputmode="decimal" dir="ltr" aria-label=${s(p.mode==="percent"?"pyPercent":"pyAmount")} .value=${p.value} @change=${c=>l(h=>{h.items[o].value=c.target.value})} />
          <input class="inp" type="date" lang=${S()} aria-label=${s("pyDate")} min=${this.today()} .value=${p.date} @change=${c=>l(h=>{h.items[o].date=c.target.value})} />
          <button type="button" class="btn sm quiet" @click=${()=>l(c=>{c.items.splice(o,1)})}>${s("pyRemove")}</button></div>`)}
        <div class="frm">
          ${t.items.length<5&&!t.items.some(p=>p.kind==="advance")?n`<button type="button" class="btn sm" @click=${()=>l(p=>{p.items.unshift({kind:"advance",mode:"percent",value:"",date:""})})}>${s("pyAddAdvance")}</button>`:d}
          ${t.items.length<5?n`<button type="button" class="btn sm" @click=${()=>l(p=>{p.items.push({kind:"progress",mode:"percent",value:"",date:""})})}>${s("pyAddProgress")}</button>`:d}</div>
        <div class="frm" data-cmp-pay-final>
          <span class="mut">${s("pk_final")}</span>
          <select class="inp" aria-label=${s("pk_final")} @change=${p=>l(o=>{o.due=p.target.value})}>
            ${[["completion","pdDone"],["date","pdOnDate"],["after_completion","pdAfterShort"]].map(([p,o])=>n`<option value=${p} ?selected=${t.due===p}>${s(o)}</option>`)}</select>
          ${t.due==="date"?n`<input class="inp" type="date" lang=${S()} aria-label=${s("pyDate")} .value=${t.date} @change=${p=>l(o=>{o.date=p.target.value})} />`:d}
          ${t.due==="after_completion"?n`<input class="inp" inputmode="numeric" dir="ltr" aria-label=${s("pdAfterShort")} .value=${t.days} @change=${p=>l(o=>{o.days=p.target.value.trim()})} />`:d}
        </div>
        ${r.length?n`<div class="err" role="alert" data-cmp-pay-error>${s("pyInvalid")}</div>`:d}`:d}
      <label class="fld">${s("pyArrival")}<input class="inp" type="date" lang=${S()} data-cmp-arrival min=${this.today()} .value=${i}
        @change=${p=>{const o=p.target.value,c=new Map(this.arrivals);o?c.set(e.quote_id,o):c.delete(e.quote_id),this.arrivals=c}} />
        <span class="note">${s("pyArrivalNote")}</span></label>
    </div>`}draftsOf(e,t){const a=[];for(const r of e){const l=r.message_draft,p=t.find(o=>o.quote.quote_id===r.award.quote_id)?.quote;!l||!p||a.push({vendorId:r.award.vendor_id,name:this.name(p),text:l.text,send:!0,notify:l.notify_default,source:l.send.source})}const i=this.d?.title??"";for(const r of Wt(this.c?.quotes??[],t))a.push({vendorId:r.vendor_id,name:this.name(r),text:s("notAwardedDraft",{name:r.vendor.name,title:i}),send:!1,notify:!0});return a}async sendDrafts(){const e=this.d,t=(this.drafts??[]).filter(i=>i.send&&i.text.trim());if(!e)return;if(!t.length){this.drafts=null,this.notice({ok:s("msgNone")});return}this.busy=!0,this.error="";let a=0;try{for(const i of t)await v().writeMessage(e.id,i.vendorId,i.text.trim(),i.notify,i.source),a+=1;this.drafts=null,this.notice({ok:s("msgSent",{n:a})})}catch(i){this.error=k(i),this.drafts=(this.drafts??[]).filter(r=>!t.slice(0,a).includes(r))}finally{this.busy=!1}}head(e){const t=this.sel.has(e.quote_id),a=this.name(e);return n`<th scope="col" class=${t?"sel":""} data-cmp-col=${e.quote_id}><div>
      <span class="vname"><span class="av" aria-hidden="true">${le(a)}</span><span><b>${$(a)}</b><small>${$(e.vendor.company?e.vendor.name:"")}</small></span></span>
      <span class="mut">${s("rowSubmitted")} ${D(e.submitted_at)}${e.version>1?` · ${s("versionN",{n:e.version})}`:""}</span>
      <span>${e.late?n`<span class="chip warn">${s("late")}</span>`:d}
        ${e.award?n`<span class=${`chip ${e.award.state==="approved"?"ok":"warn"}`} data-cmp-award=${e.award.state}>${e.award.state==="approved"?s("v_awarded"):s("pendingSecond")}</span>`:d}
        ${e.state==="not_awarded"?n`<span class="chip">${s("v_not_awarded")}</span>`:d}
        ${this.qBadge(e)}${e.note?.trim()?n`<span class="chip info" title=${s("qNoteTitle")} data-cmp-note-chip>${s("qVendorNote")}</span>`:d}</span>
      ${this.canPick(e)?n`<label class="pickrow"><input type="checkbox" data-cmp-pick=${e.quote_id} .checked=${t} ?disabled=${this.busy}
        @change=${i=>this.toggle(e,i.target.checked)} />${t?s("picked"):s("pick")}<span class="vh"> ${a}</span></label>`:d}
    </div></th>`}qBadge(e){const t=me(e.questions);if(!t)return d;const a=t.n===1?s("qBadgeOne"):s("qBadge",{n:t.n});return n`<span class=${`qbadge${t.fresh?"":" seen"}`} role="status" aria-label=${s("qBadgeAria",{n:t.n})} data-cmp-q-badge=${e.vendor_id}>${b("chat")}${a}${t.fresh?` · ${s("qBadgeNew")}`:""}</span>`}scopeCell(e){const t=this.sel.get(e.quote_id);if(!t)return n`<td><span class="mut">—</span></td>`;const a=Ut(e),i=r=>t.mode==="kinds"&&t.kinds.length===1&&t.kinds[0]===r;return n`<td class="sel" data-cmp-scope=${e.quote_id}><div class="scope">
      <span class="seg sm" role="radiogroup" aria-label=${`${s("rowScope")}: ${this.name(e)}`}>
        <button type="button" role="radio" aria-checked=${String(t.mode==="all")} data-scope="all" @click=${()=>this.setScope(e,{mode:"all"})}>${s("sc_all")}</button>
        ${a.length>1?a.map(r=>n`<button type="button" role="radio" aria-checked=${String(i(r))} data-scope=${r}
          @click=${()=>this.setScope(e,{mode:"kinds",kinds:[r]})}>${s("onlyKind",{kind:V(`k_${r}`)})}</button>`):d}
        ${e.lines.length>1?n`<button type="button" role="radio" aria-checked=${String(t.mode==="lines")} data-scope="lines"
          @click=${()=>this.setScope(e,{mode:"lines",indexes:e.lines.map(r=>r.index)})}>${s("sc_lines")}</button>`:d}
      </span>
      ${t.mode==="lines"?n`<ul class="lines">${e.lines.map(r=>n`<li><label><input type="checkbox" .checked=${t.indexes.includes(r.index)}
          @change=${l=>{const p=l.target.checked;this.setScope(e,{mode:"lines",indexes:p?[...t.indexes,r.index]:t.indexes.filter(o=>o!==r.index)})}} />
          ${V(`k_${r.kind}`)}${r.description?` · ${$(r.description)}`:""}</label><span class="num">${this.money(r.total_minor,e.currency)}</span></li>`)}</ul>`:d}
      <span class="num"><b>${this.money(qe(e,t).total,e.currency)}</b></span>
    </div></td>`}table(e,t){const a=Qt.filter(c=>e.some(h=>h.by_kind[c]>0)),i=e.some(c=>c.valid_until),r=e.some(c=>c.vendor_ref),l=e.some(c=>this.sel.has(c.quote_id)),p=(c,h="")=>`${this.sel.has(c.quote_id)?"sel ":""}${h}`.trim(),o=(c,h,f)=>n`<tr data-cmp-row=${f}><th scope="row">${c}</th>${e.map(h)}</tr>`;return n`<div class="cmpwrap"><table class="ctbl" data-cmp-table>
      <thead><tr><th scope="row">${s("rowVendor")}</th>${e.map(c=>this.head(c))}</tr></thead>
      <tbody>
        ${a.map(c=>o(V(`k_${c}`),h=>n`<td class=${p(h)}><span class="num">${h.by_kind[c]?this.money(h.by_kind[c],h.currency):"—"}</span></td>`,`kind-${c}`))}
        ${o(s("rowSubtotal"),c=>n`<td class=${p(c)}><span class="num">${this.money(c.net_minor,c.currency)}</span></td>`,"net")}
        ${o(s("rowVat"),c=>n`<td class=${p(c)}><span class="num">${c.vat_mode==="none"?V("vatNone"):this.money(c.vat_minor,c.currency)}</span></td>`,"vat")}
        ${o(s("rowTotal"),c=>n`<td class=${p(c,t&&c.lowest?"best":"")} data-cmp-total=${c.quote_id}><span class="num big">${this.money(c.total_minor,c.currency)}</span>
          ${t&&c.lowest?n`<span class="tag2" data-cmp-lowest>${m("check")}${s("cmpLowest")}</span>`:d}</td>`,"total")}
        ${o(s("rowWindow"),c=>n`<td class=${p(c,c.earliest?"early":"")}><span class="num">${W(c.work_from,c.work_to)||"—"}</span>
          ${c.earliest?n`<span class="tag2 e" data-cmp-earliest>${b("bolt")}${s("cmpEarliest")}</span>`:d}
          ${c.in_window===!0?n`<div class="mut">${s("inWindow")}</div>`:c.in_window===!1?n`<div class="mut">${s("outWindow")}</div>`:d}</td>`,"window")}
        ${i?o(s("rowValid"),c=>n`<td class=${p(c)}><span class="num">${D(c.valid_until)||"—"}</span></td>`,"valid"):d}
        ${o(s("rowLines"),c=>{const h=this.expanded.has(c.quote_id);return n`<td class=${p(c)}><button type="button" class="btn sm quiet" aria-expanded=${String(h)} data-cmp-lines=${c.quote_id}
            @click=${()=>{const f=new Set(this.expanded);h?f.delete(c.quote_id):f.add(c.quote_id),this.expanded=f}}>${s("linesN",{n:c.lines.length})} · ${h?s("linesHide"):s("linesShow")}</button>
            ${h?n`<ul class="lines">${c.lines.map(f=>n`<li><span>${V(`k_${f.kind}`)}${f.description?` · ${$(f.description)}`:""}</span><span class="num">${this.money(f.total_minor,c.currency)}</span></li>`)}</ul>`:d}</td>`},"lines")}
        ${o(s("rowNote"),c=>n`<td class=${p(c)}>${c.note?$(c.note):n`<span class="mut">—</span>`}</td>`,"note")}
        ${e.some(c=>c.vendor_files?.length)?o(s("rowVendorFiles"),c=>n`<td class=${p(c)} data-cmp-vendor-files=${c.quote_id}>${this.vendorFiles(c)}</td>`,"vendor-files"):d}
        ${r?o(s("rowRef"),c=>n`<td class=${p(c)}><span class="ltr">${c.vendor_ref??"—"}</span></td>`,"ref"):d}
        ${e.some(c=>c.payment_proposal)?o(s("pyRow"),c=>{const h=this.proposalWords(c);return n`<td class=${p(c)} data-cmp-proposal=${c.quote_id}>${h.length?n`<ul class="lines">${h.map(f=>n`<li><span>${f}</span></li>`)}</ul>`:n`<span class="mut">—</span>`}</td>`},"payment"):d}
        ${o(s("rowMessages"),c=>{const h=this.d?.vendors.find(f=>f.id===c.vendor_id);return n`<td class=${p(c)}>${h?.can.message?n`<button type="button" class="btn sm quiet" data-cmp-ask=${c.vendor_id} @click=${()=>this.message=h}>${b("chat")}${c.questions?.pending?`${s("qAnswer")} (${c.questions.pending})`:c.messages?`${s("messages")} (${c.messages})`:s("ask")}</button>`:c.messages?n`<span>${s("messages")} (${c.messages})</span>`:n`<span class="mut">—</span>`}</td>`},"messages")}
        ${l?o(s("rowScope"),c=>this.scopeCell(c),"scope"):d}
      </tbody></table></div>`}vendorFiles(e){const t=e.vendor_files??[],a=v().vendorFileUrl;if(!t.length||!a)return n`<span class="mut">—</span>`;customElements.get("tickets-rfq-files")||bt(()=>Promise.resolve().then(()=>cs),void 0,import.meta.url).then(()=>this.requestUpdate());const i=t.map(r=>({key:r.id,name:r.name,kind:r.kind,bytes:r.bytes,visible:!0,removed:!1,caption:[r.removed?s("vfRemoved"):"",r.quote_version?s("vfVersion",{n:r.quote_version}):""].filter(Boolean).join(" · "),thumb:r.thumb&&!r.removed?a(this.rfqId,r.id,!0):"",href:a(this.rfqId,r.id)}));return n`<tickets-rfq-files .rows=${i}></tickets-rfq-files>`}bar(){if(!this.d?.can.award)return d;const e=this.selections(),t=Ht(e),a=e.length>0&&e.every(i=>Re(i.quote,i.scope));return n`<div class="bar2" data-cmp-bar ?data-empty=${e.length===0}>
      <button type="button" class="btn primary" data-cmp-approve ?disabled=${!a||this.busy} @click=${()=>this.openConfirm()}>
        ${m("check")}${e.length>1?s("approveSplit",{n:e.length}):s("approveOne")}</button>
      <div class="sum" data-cmp-sum>${e.length?n`${e.map(i=>n`<span>${$(this.name(i.quote))} · ${this.scopeLabel(i.quote,i.scope)} · <b class="num">${this.money(qe(i.quote,i.scope).total,i.quote.currency)}</b></span>`)}
          ${t.length>1?n`<span data-cmp-currency-note>${s("selCurrencyNote")}</span>`:d}`:n`<span>${s("selNone")}</span>`}</div>
    </div>`}confirmDialog(){if(!this.confirm||!this.d||!this.c)return d;const e=this.selections(),t=this.d.second_approval.threshold_minor,a=Kt(t,e,this.c.currency),i=gt(this.d,e.map(r=>r.quote.vendor_id));return n`<sw-dialog open ?locked=${this.busy} wide heading=${s("awardTitle")} data-cmp-confirm @close=${()=>!this.busy&&(this.confirm=!1)}>
      <div class="stack">
        <ul class="thr">${e.map(r=>n`<li data-cmp-confirm-item=${r.quote.quote_id}><b>${$(this.name(r.quote))}</b> · ${this.scopeLabel(r.quote,r.scope)}
          <small class="num">${this.money(qe(r.quote,r.scope).total,r.quote.currency)}</small></li>`)}</ul>
        ${i?n`<div class="banner warn" role="alert" data-cmp-q-warn=${i.total}>${b("chat")}<div><b>${s("qAwardWarn",{n:i.total})}</b>
          ${i.vendors.map(r=>n`<small>${s("qAwardWarnVendor",{name:r})}</small>`)}</div></div>`:d}
        <p class="note">${s("awardBody")}</p>
        ${e.length>1?n`<p class="note">${s("awardSplitNote")}</p>`:d}
        <p class="note">${s("awardOthers")}</p>
        <p class="note" data-cmp-second=${a?"maybe":"off"}>${a&&t!==null?s("awardSecondMaybe",{amount:this.money(t,this.c.currency)}):s("awardSecondOff")}</p>
        ${this.termsOn()?e.map(r=>this.termsEditor(r.quote)):d}
        ${e.map(r=>this.noticeBlock(r.quote))}
        ${this.error?n`<div class="err" role="alert" data-cmp-error>${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${()=>this.confirm=!1}>${s("back")}</button>
      <button slot="footer" type="button" class="btn primary" data-cmp-confirm-ok ?disabled=${this.busy||!this.termsOk()} @click=${()=>void this.award()}>${m("check")}${s("confirm")}</button>
    </sw-dialog>`}draftsDialog(){const e=this.drafts;if(!e)return d;const t=e.filter(l=>l.source),a=e.filter(l=>!l.source),i=(l,p)=>this.drafts=(this.drafts??[]).map(o=>o===l?{...o,...p}:o),r=l=>n`<div class="draft" data-cmp-draft=${l.vendorId} data-draft-kind=${l.source?"winner":"other"}>
      <label class="chk"><input type="checkbox" data-draft-send .checked=${l.send} @change=${p=>i(l,{send:p.target.checked})} />${s("msgSendThis",{name:l.name})}</label>
      <label class="fld"><span class="vh">${s("writeVendor")}</span><textarea class="inp" maxlength="2000" data-draft-text .value=${l.text} ?disabled=${!l.send}
        @input=${p=>i(l,{text:p.target.value})}></textarea></label>
      <label class="chk"><input type="checkbox" .checked=${l.notify} ?disabled=${!l.send} @change=${p=>i(l,{notify:p.target.checked})} />${s("msgNotify")}</label>
    </div>`;return n`<sw-dialog open ?locked=${this.busy} wide heading=${s("msgTitle")} subheading=${s("msgBody")} data-cmp-drafts @close=${()=>!this.busy&&(this.drafts=null)}>
      <div class="stack">
        ${t.length?n`<h3 class="group-h">${s("msgWinner")}</h3>${t.map(r)}`:d}
        ${a.length?n`<h3 class="group-h">${s("msgOthers")}</h3><p class="note">${s("msgOthersNote")}</p>${a.map(r)}`:d}
        <p class="note">${s("writeNote")}</p>
        ${this.error?n`<div class="err" role="alert">${this.error}</div>`:d}
      </div>
      <button slot="footer" type="button" class="btn quiet" data-draft-skip ?disabled=${this.busy} @click=${()=>{this.drafts=null,this.notice({ok:s("msgNone")})}}>${s("msgSkip")}</button>
      <button slot="footer" type="button" class="btn primary" data-draft-send-all ?disabled=${this.busy||!e.some(l=>l.send&&l.text.trim())} @click=${()=>void this.sendDrafts()}>${m("send")}${s("msgSend")}</button>
    </sw-dialog>`}render(){if(this.phase==="loading")return n`<div class="page" data-rfq-compare data-phase="loading" aria-busy="true"><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:360px"></span></div>`;if(this.phase==="forbidden")return n`<div class="page" data-rfq-compare data-phase="forbidden"><div class="statebox glass" role="status"><span class="ring">${m("lock")}</span><b>${s("cmpNoAmounts")}</b><a class="btn sm" href=${x({id:this.rfqId})}>${s("back")}</a></div></div>`;if(this.phase==="error"||!this.c||!this.d)return n`<div class="page" data-rfq-compare data-phase="error"><div class="statebox glass" role="status"><span class="ring">${m("warning")}</span><b>${s("loadFailed")}</b>
        <span class="vh">${this.failed}</span><button type="button" class="btn sm" @click=${()=>{this.phase="loading",this.load()}}>${m("refresh")}${s("retry")}</button></div></div>`;const e=this.c,t=this.d,a=Xt(e.quotes,this.filter,this.sort),i=Gt(a,e.currency),r=e.quotes.find(o=>o.quote_id===e.lowest_quote_id),l=e.quotes.find(o=>o.quote_id===e.earliest_quote_id),p=t.vendors.filter(o=>o.state!=="removed").length;return n`<div class="page" data-rfq-compare data-phase="ready">
      <header class="dh">
        <div class="dh-row"><div class="titles">
          <div class="crumbs"><a href="#/tickets">${Ne("area")}</a> ‹ <a href=${x({})}>${s("navTitle")}</a> ‹ <a href=${x({id:t.id})} data-cmp-back>${t.ref}</a></div>
          <h1>${s("cmpTitle")}</h1>
          <div class="subline"><span>${$(t.title)}</span><span>${s("cmpSub",{ref:t.ref,n:e.quotes.length,m:p})}</span></div>
        </div><span class="grow"></span></div>
        ${e.quotes.length?n`<div class="dh-det">
          <span class="seg sm" role="radiogroup" aria-label=${s("cmpFilter")} data-cmp-filter>
            <button type="button" role="radio" aria-checked=${String(this.filter==="all")} data-f="all" @click=${()=>this.filter="all"}>${s("cmpAll")}<small>${e.filters.all}</small></button>
            <button type="button" role="radio" aria-checked=${String(this.filter==="in_window")} data-f="in_window" ?disabled=${!e.filters.in_window} @click=${()=>this.filter="in_window"}>${s("cmpInWindow")}<small>${e.filters.in_window}</small></button>
          </span>
          <span class="seg sm" role="radiogroup" aria-label=${s("cmpSort")} data-cmp-sort>
            <button type="button" role="radio" aria-checked=${String(this.sort==="price")} @click=${()=>this.sort="price"}>${b("coin")}${s("cmpByPrice")}</button>
            <button type="button" role="radio" aria-checked=${String(this.sort==="date")} @click=${()=>this.sort="date"}>${b("cal")}${s("cmpByDate")}</button>
          </span>
          <span class="grow"></span>
          ${r?n`<span class="chip ok" data-cmp-low-chip>${s("cmpLowestChip",{name:this.name(r),amount:this.money(r.total_minor,r.currency)})}</span>`:d}
          ${l?n`<span class="chip info">${s("cmpEarliestChip",{name:this.name(l),date:W(l.work_from,null)})}</span>`:d}
        </div>`:d}
      </header>
      ${e.quotes.length?i.map(o=>n`<section class="stack" data-cmp-group=${o.currency} aria-label=${s("cmpCurrencyGroup",{currency:o.currency})}>
          ${i.length>1?n`<h2 class="group-h">${s("cmpCurrencyGroup",{currency:o.currency})}${o.ranked?d:n` · <span class="mut">${s("cmpOtherCurrency",{currency:o.currency})}</span>`}</h2>`:d}
          ${this.table(o.quotes,o.ranked)}
        </section>`):n`<div class="statebox glass" role="status" data-cmp-empty><span class="ring">${b("columns")}</span><b>${s("cmpEmpty")}</b><a class="btn sm" href=${x({id:t.id})}>${s("back")}</a></div>`}
      ${e.quotes.length?this.bar():d}
    </div>
    ${this.confirmDialog()}${this.draftsDialog()}
    ${this.message?n`<tickets-rfq-message-dialog open .rfq=${t} .vendor=${this.message} @close=${()=>{this.message=null,this.load()}}
      @saved=${o=>{this.message=null,this.notice({ok:o.detail.notified?s("writeDoneNotified"):s("writeDone")}),this.load()}}></tickets-rfq-message-dialog>`:d}`}};w.styles=[Q,...H,Te,Y];_([g()],w.prototype,"rfqId",2);_([g({attribute:!1})],w.prototype,"meta",2);_([u()],w.prototype,"c",2);_([u()],w.prototype,"d",2);_([u()],w.prototype,"phase",2);_([u()],w.prototype,"failed",2);_([u()],w.prototype,"filter",2);_([u()],w.prototype,"sort",2);_([u()],w.prototype,"sel",2);_([u()],w.prototype,"expanded",2);_([u()],w.prototype,"confirm",2);_([u()],w.prototype,"drafts",2);_([u()],w.prototype,"message",2);_([u()],w.prototype,"busy",2);_([u()],w.prototype,"error",2);_([u()],w.prototype,"pays",2);_([u()],w.prototype,"arrivals",2);_([u()],w.prototype,"notices",2);_([u()],w.prototype,"noticeOff",2);w=_([G("tickets-rfq-compare")],w);var Rs=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,I=(e,t,a,i)=>{for(var r=i>1?void 0:i?Bs(t,a):t,l=e.length-1,p;l>=0;l--)(p=e[l])&&(r=(i?p(t,a,r):p(r))||r);return i&&r&&Rs(t,a,r),r};function j(e,t=!1){if(!t){window.location.hash=e;return}const[a,i=""]=e.replace(/^#/,"").split("?");_t(a,new URLSearchParams(i))}let L=class extends K{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.route=null,this.r=Be(new URLSearchParams),this.screen="loading",this.meta=null,this.items=[],this.next=null,this.failed="",this.q="",this.toast=null,this.phone=window.matchMedia("(max-width: 767px)").matches,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.toastTimer=0,this.qTimer=0,this.offNames=null,this.onNotice=e=>{e.detail.error?this.say(e.detail.error,"bad"):e.detail.ok&&this.say(e.detail.ok),this.load(!0)},this.onSaved=e=>{this.say(e.detail.sent?e.detail.manual?s("sendMarked"):s("sendDone"):s("draftSaved")),this.load(!0),j(x({id:e.detail.id}))}}connectedCallback(){super.connectedCallback(),Z(this),this.phoneMq.addEventListener("change",this.onPhone),this.offNames=yt(()=>this.requestUpdate()),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.offNames?.(),window.clearTimeout(this.toastTimer),window.clearTimeout(this.qTimer)}willUpdate(e){if(e.has("route")&&this.route){const t=this.r;this.r=Be(this.route.params),t.q!==this.r.q&&(this.q=this.r.q),this.screen==="ready"&&this.r.view==="list"&&t.view!=="list"&&this.load(!0)}}async boot(){try{const e=await wt().module();if(kt(e.name),!e.enabled){this.screen="off";return}}catch(e){if(e instanceof A&&e.status===404&&e.code==="feature_disabled"){this.screen="off";return}}try{this.meta=await v().meta()}catch(e){e instanceof A&&e.status===403?this.screen="forbidden":e instanceof A&&e.code==="feature_disabled"?this.screen="off":xt(e)?this.screen="unavailable":(this.failed=k(e),this.screen="error");return}await this.load(!1)}async load(e,t=!1){!e&&!this.items.length&&(this.screen="loading");try{const a=await v().list({state:"all",limit:200,cursor:t?this.next:null});this.items=t?[...this.items,...a.items]:a.items,this.next=a.next_cursor,this.screen="ready"}catch(a){if(e)return;a instanceof A&&a.status===403?this.screen="forbidden":(this.failed=k(a),this.screen="error")}}say(e,t="ok"){this.toast={text:e,tone:t},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,t==="bad"?7e3:3500)}onSearch(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>j(x({...this.r,q:e,id:"",creating:!1}),!0),250)}canCreate(){return!!this.meta?.departments.some(e=>e.can_create)}money(e,t){return e===null?"":ce(e,t??"ILS",O()==="en"?"en":"he")}visible(){return this.items.filter(e=>Yt(e.state,this.r.state)&&(!this.r.dept||e.department.id===this.r.dept)&&Jt(e,this.q))}header(){const e=this.meta?.departments??[],t=this.items.filter(i=>!this.r.dept||i.department.id===this.r.dept),a=Zt(t,St).filter(i=>i.id==="open"||i.id==="all"||i.count>0||i.id===this.r.state);return n`<header class="dh" data-rfq-header>
      <div class="dh-row">
        <div class="titles"><div class="crumbs"><a href="#/tickets">${Ne("area")}</a></div><h1 data-rfq-page-title>${s("navTitle")}</h1></div>
        <span class="grow"></span>
        ${this.screen==="ready"&&this.canCreate()?n`<button type="button" class="btn primary newbtn" data-rfq-new-btn @click=${()=>j(x({...this.r,creating:!0}))}>${m("plus")}${s("newShort")}</button>`:d}
      </div>
      ${this.screen==="ready"?n`<div class="dh-det">
        ${e.length>1?n`<div class="rooms" role="group" aria-label=${s("departmentsGroup")} data-rfq-depts>
          <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${()=>j(x({...this.r,dept:""}))}>${s("allDepartments")}</button>
          ${e.map(i=>n`<button type="button" class="rc" aria-pressed=${String(this.r.dept===i.id)} data-dept=${i.id} @click=${()=>j(x({...this.r,dept:i.id}))}>${$(i.name)}</button>`)}
        </div>`:d}
        <div class="seg sm stf" role="radiogroup" aria-label=${s("stateStrip")} data-rfq-strip>
          ${a.map(i=>n`<button type="button" role="radio" aria-checked=${String(this.r.state===i.id)} data-state=${i.id}
            @click=${()=>j(x({...this.r,state:i.id}))}>${s(`st_${i.id}`)}<small>${i.count}</small></button>`)}
        </div>
        <span class="grow"></span>
        <label class="search">${m("search")}<span class="vh">${s("searchShort")}</span><input type="search" data-rfq-search maxlength="80"
          placeholder=${this.phone?s("searchShort"):s("searchPh")} .value=${this.q} @input=${i=>this.onSearch(i.target.value)} /></label>
      </div>`:d}
    </header>`}tiles(){const e=es(this.items.filter(i=>!this.r.dept||i.department.id===this.r.dept)),t=(i,r,l,p=!1)=>n`<div class=${`kpi${p?" warn":""}`} data-kpi=${l}><small>${s(i)}</small><b>${r}</b></div>`,a=this.items.filter(i=>!this.r.dept||i.department.id===this.r.dept).reduce((i,r)=>i+(r.questions?.pending??0),0);return n`<div class="kpis" data-rfq-tiles>
      ${a?t("qSection",a,"questions",!0):d}
      ${t("tileOpen",e.open,"open")}${t("tileCollecting",e.collecting,"collecting")}${t("tileDecide",e.decide,"decide",e.decide>0)}
      ${t("tileQuotes",e.quotes,"quotes")}${t("tileNoReply",e.noReply,"no_reply")}
    </div>`}bar(e){const t=ts(e.kpis),a=r=>s(`vs_${r==="opened"?"opened":r}`),i={quoted:"seg-q",declined:"seg-d",opened:"seg-o",no_reply:"seg-n"};return e.kpis.invited?n`<div class="vbar" data-rfq-vbar>
      <div class="track" role="img" aria-label=${t.map(r=>`${a(r.key)} ${r.n}`).join(", ")}>${t.map(r=>n`<span class=${i[r.key]} style=${`inline-size:${r.pct}%`}></span>`)}</div>
      <div class="legend">
        <span>${s("vendorsLine",{n:e.kpis.invited})}</span>
        ${t.map(r=>n`<span data-vb=${r.key}><i class=${i[r.key]}></i>${a(r.key)} ${r.n}</span>`)}
      </div>
    </div>`:n`<div class="vbar"><span class="mut">${s("noVendorsYet")}</span></div>`}row(e,t){const a=ss(e.due_at,t);return n`<li><a class="rrow" href=${x({id:e.id})} data-rfq-row=${e.id} data-rstate=${e.state}>
      <div class="t">
        <span class="meta"><span class="ref">${e.ref}</span><span class=${`chip ${Ze(e.state)}`} data-rfq-row-state>${s(`st_${e.state}`)}</span>${this.qBadge(e)}</span>
        <b>${$(e.title)}</b>
        <span class="meta"><span>${$(e.department.name)}</span>${e.place_text?n`<span>${$(e.place_text)}</span>`:d}
          <span>${e.due_at?a?s("duePassed",{when:D(e.due_at)}):s("dueIn",{when:D(e.due_at)}):s("noDue")}</span>
          ${e.internal_owner.name?n`<span>${s("owner")}: ${$(e.internal_owner.name)}</span>`:d}</span>
      </div>
      ${this.bar(e)}
      <div class="end">${e.kpis.lowest_total_minor!==null?n`<span class="num" data-rfq-lowest><b>${s("lowestLine",{amount:this.money(e.kpis.lowest_total_minor,e.kpis.currency)})}</b></span>`:d}
        <span class="chip">${s("vs_quoted")} ${e.kpis.quoted}</span></div>
    </a>${this.mapLink(e)}</li>`}mapLink(e){const t=Xe(e.plan_area);return t?n`<a class="rmap" href=${t} data-rfq-row-on-map=${e.id}>${m("link")}${te("showOnMap")}</a>`:d}qBadge(e){const t=me(e.questions);return t?n`<span class=${`qbadge${t.fresh?"":" seen"}`} aria-label=${s("qBadgeAria",{n:t.n})} data-rfq-q-badge="row" data-n=${t.n}>${b("chat")}${t.n===1?s("qBadgeOne"):s("qBadge",{n:t.n})}${t.fresh?` · ${s("qBadgeNew")}`:""}</span>`:d}stateBox(e,t,a,i){return n`<div class="statebox glass" role="status" data-rfq-state=${a}><span class="ring">${m(e)}</span><b>${t}</b>${i??d}</div>`}list(){switch(this.screen){case"loading":return n`<div data-rfq-state="loading" aria-busy="true" class="stack"><div class="kpis">${[1,2,3,4,5].map(()=>n`<span class="skl" style="block-size:76px"></span>`)}</div>
          ${[1,2,3].map(()=>n`<span class="skl" style="block-size:88px"></span>`)}</div>`;case"off":return this.stateBox("ticket",s("moduleOff"),"off");case"forbidden":return this.stateBox("lock",s("forbidden"),"forbidden");case"unavailable":return this.stateBox("clock",s("unavailable"),"unavailable");case"error":return this.stateBox("warning",s("loadFailed"),"error",n`${this.failed?n`<span class="why" data-rfq-error-why>${this.failed}</span>`:d}<button type="button" class="btn sm" data-rfq-retry
          @click=${()=>{this.screen="loading",this.boot()}}>${m("refresh")}${s("retry")}</button>`)}const e=new Date,t=this.visible();return this.items.length?n`${this.tiles()}
      ${t.length?n`<ul class="rlist" aria-label=${s("listAria")} data-rfq-list>${ye(t,a=>a.id,a=>this.row(a,e))}</ul>`:this.stateBox("search",s("emptyFiltered"),"no-match",n`<button type="button" class="btn sm" data-rfq-clear @click=${()=>{this.q="",j(x({}))}}>${s("clearFilters")}</button>`)}
      ${this.next?n`<div class="more"><button type="button" class="btn sm" data-rfq-more @click=${()=>void this.load(!0,!0)}>${s("loadMore")}</button></div>`:d}`:n`${this.stateBox("note",s("emptyAll"),"empty",this.canCreate()?n`<button type="button" class="btn sm primary" @click=${()=>j(x({creating:!0}))}>${m("plus")}${s("newShort")}</button>`:void 0)}`}render(){const e=this.r,t=this.screen==="ready",a=t&&e.view==="board"?n`<tickets-rfq-board .rfqId=${e.id} .meta=${this.meta} @notice=${this.onNotice} @gone=${()=>j(x({}))}></tickets-rfq-board>`:t&&e.view==="compare"?n`<tickets-rfq-compare .rfqId=${e.id} .meta=${this.meta} @notice=${this.onNotice}></tickets-rfq-compare>`:n`<div class="page" data-screen="tickets-rfqs">${this.header()}${this.list()}</div>`;return n`${a}
      ${t&&this.canCreate()?n`<tickets-rfq-new .open=${e.creating} .meta=${this.meta} .sourceTicket=${e.from}
        @close=${()=>j(x({...e,creating:!1,from:""}),!0)} @rfq-saved=${this.onSaved}></tickets-rfq-new>`:d}
      ${this.toast?n`<div class=${`toast ${this.toast.tone}`} role=${this.toast.tone==="bad"?"alert":"status"} data-rfq-toast ${qt()}>${m(this.toast.tone==="bad"?"warning":"check")}${this.toast.text}</div>`:d}`}};L.styles=[Q,...H,Te,Y,de`
    .dh-row .newbtn {
      flex: none;
    }
    .statebox .why {
      max-inline-size: 52ch;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      text-align: center;
      overflow-wrap: anywhere;
    }
    .more {
      display: flex;
      justify-content: center;
    }
    /* A11Y-POLISHED-2342: the shared failure icon recipe (styles/media-page.ts) - the bare red read 2.8-3.0:1 on the light toast pill */
    .toast.bad .ic {
      color: color-mix(in srgb, var(--sw-danger) 70%, var(--sw-toast-text));
    }
    /* six tiles (with "questions waiting") or five: one row on a wide page, three per row between a phone and a wide page */
    @media (min-width: 768px) and (max-width: 1279px) {
      .kpis {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 767px) {
      .dh-row .grow {
        display: none;
      }
      .dh-row .newbtn {
        grid-area: f;
        align-self: center;
      }
      .kpis {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--sw-s-2);
      }
      .kpi {
        gap: 2px;
        padding: 10px 12px;
        border-radius: var(--sw-r-lg);
      }
      .kpi small {
        font-size: var(--sw-fs-xs);
        line-height: 1.3;
      }
      .kpi b {
        font-size: var(--sw-fs-lg);
      }
    }
  `];I([g({attribute:!1})],L.prototype,"route",2);I([u()],L.prototype,"r",2);I([u()],L.prototype,"screen",2);I([u()],L.prototype,"meta",2);I([u()],L.prototype,"items",2);I([u()],L.prototype,"next",2);I([u()],L.prototype,"failed",2);I([u()],L.prototype,"q",2);I([u()],L.prototype,"toast",2);I([u()],L.prototype,"phone",2);L=I([G("tickets-rfqs")],L);export{L as TicketsRfqsPage};
//# sourceMappingURL=tickets-rfqs-DZPuInNM.js.map
