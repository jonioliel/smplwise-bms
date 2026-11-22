import{bi as A,bj as I,g as N,i as P,bL as V,k2 as C,bQ as M,bS as R,k3 as U,k4 as B,k5 as W,k6 as K,k7 as Q,k8 as G,k9 as H,U as s,ka as _,n as z,kb as X,kc as Y,kd as J,A as u,b as t,ke as Z,kf as D,kg as ss,hs as es,ht as L,kh as ts,ki as as,ax as T,j as b,k as is}from"./index-CPuzFb4-.js";import{O as ns}from"./editor-guards-CEHbVbIV.js";import"./sw-logo-art-PLtEZJxU.js";import"./memo-CyxK7byc.js";const rs=N`
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--sw-z-modal, 1000);
      display: grid;
      place-items: center;
      background: var(--sw-overlay);
      padding: max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px));
      color: var(--sw-text);
      font-family: var(--sw-font);
    }
    .sheet {
      inline-size: min(1360px, 100%);
      block-size: min(860px, 100%);
      /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A): the assistant is a work surface larger than the widest dialog, so it keeps its
         own box - on the one dialog's surface: opaque, the floating-layer hairline, the dialog radius, the round close button */
      box-sizing: border-box;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
    }
    @starting-style {
      .sheet {
        opacity: 0;
        transform: scale(0.98) translateY(8px);
      }
    }
    .sheet {
      transition: opacity 220ms var(--sw-ease-out, ease-out), transform 220ms var(--sw-ease-out, ease-out);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px 22px 12px;
      border-block-end: 1px solid var(--sw-menu-border);
    }
    .num {
      flex: none;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
    }
    .ttl {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      line-height: 1.25;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      text-wrap: balance;
    }
    .q {
      margin-block-start: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      max-inline-size: 90ch;
    }
    .dots {
      display: flex;
      gap: 6px;
      align-items: center;
      flex: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dots i {
      inline-size: 22px;
      block-size: 4px;
      border-radius: 2px;
      background: var(--sw-border);
    }
    .dots i.on {
      background: var(--sw-accent);
    }
    .dots i.past {
      background: color-mix(in srgb, var(--sw-accent) 45%, transparent);
    }
    .x {
      flex: none;
    }
    main {
      min-block-size: 0;
      padding: 14px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }
    footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 22px;
      border-block-start: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    footer .ln {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .sp {
      flex: 1 1 auto;
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
    }
    .notice {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    button {
      font: inherit;
      color: inherit;
    }
    .press {
      transition: transform 140ms var(--sw-ease-out, ease-out), background-color 140ms ease;
    }
    .press:active {
      transform: scale(0.98);
    }
    :focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: var(--sw-focus-offset, 2px);
    }

    /* ---------- step: the mark ---------- */
    .opts {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      flex: none;
    }
    .opt {
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 8px;
      text-align: start;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
      min-inline-size: 0;
    }
    .opt[aria-checked='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 1px var(--sw-accent), var(--sw-shadow-1);
    }
    .opt h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--sw-heading);
    }
    .rd {
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong, var(--sw-border));
      flex: none;
    }
    .opt[aria-checked='true'] .rd {
      border-color: var(--sw-accent);
      background: radial-gradient(circle, var(--sw-accent) 0 4px, transparent 5px);
    }
    .ex {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      align-content: flex-start;
    }
    .ex span {
      padding: 2px 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      white-space: nowrap;
    }
    .ex b {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .ex i {
      font-style: normal;
      color: var(--sw-text-3);
    }
    .fit {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .fit b {
      color: var(--sw-heading);
    }
    .detected {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-accent-soft);
      font-size: var(--sw-fs-sm);
      flex: none;
    }
    .detected sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .detected span {
      flex: 1 1 320px;
      min-inline-size: 0;
    }
    .ctrls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      align-items: center;
      flex: none;
    }
    .grp {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-sm);
    }
    .grp > b {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .ch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 34px;
      padding: 0 12px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .ch[aria-pressed='true'] {
      ${A}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .ch[aria-pressed='true']::before {
      ${I}
    }
    .ch small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    input.tx,
    select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      min-block-size: 34px;
      padding: 0 10px;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    input.tx.short {
      inline-size: 6em;
    }
    .lv {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 280px) auto;
      gap: 12px;
      align-items: center;
      padding: 10px 14px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
    }
    .lv .t {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .lv .t small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .lv .tag.wn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .lv .tag.ok {
      background: var(--sw-success-soft, var(--sw-surface-2));
      color: var(--sw-success-text, var(--sw-text-2));
    }
    @media (max-width: 760px) {
      .lv {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .lv select {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }
    .live {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 12px;
      min-block-size: 0;
      flex: 1 1 auto;
    }
    .panel {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .panel > h3 {
      margin: 0;
      padding: 10px 14px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      border-block-end: 1px solid var(--sw-border);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .panel > h3 .sp + * {
      font-weight: var(--sw-fw-regular);
    }
    .scroll {
      overflow: auto;
      overscroll-behavior: contain;
      min-block-size: 0;
      flex: 1 1 auto;
      scrollbar-width: thin;
    }
    .nm {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      min-inline-size: 0;
    }
    .nm .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nm mark {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-bold);
      border-radius: var(--sw-r-2xs);
      padding: 0 4px;
    }
    .nm.no mark {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .nm small {
      flex: none;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 8px;
      padding: 10px;
      align-content: start;
    }
    .tokc {
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: 8px 10px;
      display: grid;
      gap: 6px;
      min-inline-size: 0;
    }
    .tokc .th {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .g {
      flex: none;
      min-inline-size: 30px;
      block-size: 30px;
      padding: 0 6px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      max-inline-size: 9em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .g.sh {
      background: var(--sw-shared-soft);
      color: var(--sw-shared-text);
      box-shadow: none;
    }
    .g.un {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      box-shadow: none;
    }
    .ct {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .arr {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-inline-size: 0;
    }
    .samp {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    .samp span {
      padding: 1px 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      max-inline-size: 16em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ---------- step: the table ---------- */
    .two {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 12px;
      min-block-size: 0;
      flex: 1 1 auto;
    }
    .tk {
      display: grid;
      grid-template-columns: 24px minmax(90px, 0.6fr) minmax(170px, 1fr) minmax(110px, 0.6fr) minmax(0, 1.6fr);
      gap: 10px;
      align-items: center;
      padding: 8px 14px 8px 10px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .tk.hdr {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding-block: 6px;
      position: sticky;
      inset-block-start: 0;
      background: var(--sw-surface);
      z-index: 1;
    }
    .tk.dropzone {
      background: var(--sw-accent-soft);
    }
    .tk .tok {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-inline-size: 0;
    }
    .tk .tok small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tk .c b {
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    .tk .c small {
      display: block;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      white-space: nowrap;
      inline-size: fit-content;
    }
    .tag.m {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .tag.new {
      background: var(--sw-product-success-soft, var(--sw-accent-soft));
      color: var(--sw-heading);
    }
    .grip {
      cursor: grab;
      color: var(--sw-text-3);
      display: grid;
      place-items: center;
      background: none;
      border: 0;
      padding: 0;
      inline-size: 24px;
      block-size: 30px;
    }
    .add {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 14px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .bl {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 9px 14px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .bl .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .bl .t b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sw-heading);
    }
    .bl .t span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .bl .toks {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-inline-size: 40%;
    }
    .hint {
      padding: 10px 14px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      line-height: 1.5;
    }

    /* ---------- step: decisions ---------- */
    .prog {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      flex: none;
      font-size: var(--sw-fs-sm);
    }
    .prog b {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      flex: 1 1 160px;
      block-size: 8px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-2);
      overflow: hidden;
      max-inline-size: 420px;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: inherit;
      transition: inline-size 240ms var(--sw-ease-out, ease-out);
    }
    .decs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 10px;
      padding: 10px;
      align-content: start;
    }
    .dec {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      min-inline-size: 0;
    }
    .dec .nm2 {
      display: flex;
      gap: 8px;
      align-items: baseline;
      flex-wrap: wrap;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .dec .nm2 small {
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dec .ask {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .big {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .big button {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      min-block-size: 48px;
      padding: 6px 16px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      cursor: pointer;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-align: start;
      max-inline-size: 100%;
    }
    .big button small {
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .big button.rec {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .big button.rec small {
      color: inherit;
      opacity: 0.85;
    }
    .big select {
      min-block-size: 48px;
    }
    .dones {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }
    .done {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .done sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
      flex: none;
    }
    .done b {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .done span {
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .link {
      background: none;
      border: 0;
      color: var(--sw-accent-text, var(--sw-accent));
      cursor: pointer;
      padding: 0 4px;
      font-size: var(--sw-fs-xs);
      min-block-size: 28px;
    }
    .empty {
      display: grid;
      place-items: center;
      gap: 8px;
      text-align: center;
      padding: 30px;
      color: var(--sw-text-2);
    }
    .empty sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
    }

    /* ---------- step: summary ---------- */
    .sum {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
    }
    .srow {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      min-inline-size: 0;
    }
    .srow .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .srow .t b {
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .srow .t span {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .srow .t em {
      font-style: normal;
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .st {
      flex: none;
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .st.wn {
      color: var(--sw-warning-text);
    }
    .applybox {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      padding: 14px 16px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-accent-soft);
      flex: none;
    }
    .applybox .t {
      flex: 1 1 360px;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
    }
    .applybox .t b {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
    .applybox ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      color: var(--sw-text-2);
    }
    .applybox li {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .donebox {
      display: grid;
      gap: 14px;
      justify-items: center;
      text-align: center;
      padding: 30px 16px;
      align-content: center;
      flex: 1 1 auto;
    }
    .donebox h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading);
    }
    .donebox p {
      margin: 0;
      color: var(--sw-text-2);
      max-inline-size: 60ch;
    }
    .badge-ok {
      inline-size: 56px;
      block-size: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .offer {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      padding: 14px 18px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: inset 0 0 0 1px var(--sw-border);
      max-inline-size: 720px;
    }

    /* ---------- advanced ---------- */
    .rules {
      display: flex;
      flex-direction: column;
    }
    .sr {
      display: grid;
      grid-template-columns: 24px 26px minmax(0, 1.6fr) minmax(150px, 0.8fr) minmax(90px, auto) auto;
      gap: 8px;
      align-items: center;
      padding: 7px 12px 7px 8px;
      border-block-end: 1px solid color-mix(in srgb, var(--sw-border) 55%, transparent);
      font-size: var(--sw-fs-sm);
    }
    .sr.dropzone {
      background: var(--sw-accent-soft);
    }
    .sr.off {
      opacity: 0.55;
    }
    .sr .n {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .sr .sent {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .sr .sent .k {
      color: var(--sw-text-2);
    }
    .sr .cnt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .sr .acts {
      display: flex;
      gap: 2px;
    }
    .ib {
      inline-size: 32px;
      block-size: 32px;
      display: grid;
      place-items: center;
      border-radius: var(--sw-r-md);
      background: none;
      border: 0;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .ib:hover {
      background: var(--sw-surface-2);
    }
    .sr.def {
      color: var(--sw-text-3);
    }

    /* ---------- tablet / phone ---------- */
    @media (max-width: 900px) {
      .opts {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 1180px) {
      .two {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
      }
      .two .side .scroll {
        max-block-size: 150px;
      }
      .tk {
        grid-template-columns: 24px minmax(80px, 0.6fr) minmax(160px, 1fr) minmax(100px, 0.6fr) minmax(0, 1fr);
      }
    }
    @media (max-width: 1180px) and (max-height: 820px) {
      .opt .ex {
        display: none;
      }
    }
    @media (max-width: 760px) {
      :host {
        padding: 0;
      }
      .sheet {
        border-radius: 0;
        block-size: 100%;
      }
      header {
        padding: max(12px, env(safe-area-inset-top, 0px)) 14px 10px;
        gap: 10px;
      }
      h1 {
        font-size: var(--sw-fs-lg);
      }
      .num {
        inline-size: 30px;
        block-size: 30px;
      }
      .dots span {
        display: none;
      }
      main {
        padding: 10px 14px;
        gap: 10px;
      }
      footer {
        padding: 10px 14px max(10px, env(safe-area-inset-bottom, 0px));
      }
      footer .ln {
        display: none;
      }
      .opts {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .q {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .detected .more {
        display: none;
      }
      .detected {
        padding: 8px 12px;
      }
      .detected > sw-icon {
        display: none;
      }
      .opt {
        grid-template-rows: auto auto;
        gap: 2px;
        padding: 8px 10px;
      }
      .opt .ex {
        display: none;
      }
      .opt h2 {
        font-size: var(--sw-fs-sm);
      }
      .ctrls {
        gap: 6px;
      }
      .ch {
        min-block-size: 32px;
        padding: 0 10px;
      }
      .live {
        grid-template-columns: minmax(0, 1fr);
      }
      .live .names {
        display: none;
      }
      .groups {
        grid-template-columns: minmax(0, 1fr);
      }
      .tk {
        grid-template-columns: 24px minmax(0, 1fr) auto;
        grid-template-areas: 'g t c' 'g s s';
        row-gap: 6px;
      }
      .tk > .grip {
        grid-area: g;
      }
      .tk > .tok {
        grid-area: t;
      }
      .tk > .c {
        grid-area: c;
        text-align: end;
      }
      .tk > select,
      .tk > .selc {
        grid-area: s;
      }
      .tk > .samp {
        display: none;
      }
      .tk.hdr {
        display: none;
      }
      .two .side {
        display: none;
      }
      .decs {
        grid-template-columns: minmax(0, 1fr);
        padding: 6px;
      }
      .sr {
        grid-template-columns: 24px minmax(0, 1fr) auto;
        grid-template-areas: 'g s a' 'g t c';
      }
      .sr > .grip {
        grid-area: g;
      }
      .sr > .n {
        display: none;
      }
      .sr > .sent {
        grid-area: s;
      }
      .sr > .to {
        grid-area: t;
      }
      .sr > .cnt {
        grid-area: c;
      }
      .sr > .acts {
        grid-area: a;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sheet,
      .press,
      .bar i {
        transition: none;
      }
    }
  `;var os=Object.defineProperty,ls=Object.getOwnPropertyDescriptor,g=(e,a,l,n)=>{for(var i=n>1?void 0:n?ls(a,l):a,m=e.length-1,w;m>=0;m--)(w=e[m])&&(i=(n?w(a,l,i):w(i))||i);return n&&i&&os(a,l,i),i};const ds=[{id:"mark",label:s("צורת הסימון")},{id:"table",label:s("סימון ← בניין")},{id:"decide",label:s("החלטות")},{id:"levels",label:s("קומות ללא מפלס")},{id:"summary",label:s("סיכום")}],S=Array.from({length:66},(e,a)=>a-5),O={start:{title:s("בתחילת השם"),ex:[t`<b>${s("א")}</b> · ${s("לובי")}`,t`<b>1</b> · ${s("לובי")}`,t`<b>B2</b>${s("-לובי")}`]},end:{title:s("בסוף השם"),ex:[t`${s("לובי ·")} <b>${s("א")}</b>`,t`${s("חדר מכונות -")} <b>2</b>`]},label:{title:s("בתווית"),ex:[t`${s("לובי")} <i>${s("תווית")}</i> <b>${s("בניין א")}</b>`,t`${s("חניון")} <i>${s("תווית")}</i> <b>${s("משותף")}</b>`]},word:{title:s("מילה בתוך השם"),ex:[t`${s("לובי בניין")} <b>${s("צפון")}</b>`,t`${s("מחסן מגדל")} <b>2</b>`]},advanced:{title:s("שילוב / מתקדם"),ex:[t`${s("התחלה לרוב השמות")}`,t`${s("תווית לחניון")}`]}},y={"·":'" · "',"-":'"-"',":":'":"'," ":s("רווח")},ps={letter:s("אות"),number:s("מספר"),word:s("מילה"),any:s("כל דבר עד המפריד")},gs={table:s("לפי טבלת הסימונים"),starts:s("השם מתחיל ב-"),ends:s("השם מסתיים ב-"),contains:s("השם מכיל"),label:s("התווית היא"),regex:s("ביטוי רגולרי")};let c=class extends P{constructor(){super(...arguments),this.start="mark",this.advancedOpen=!1,this.step="mark",this.busy=!1,this.error="",this.notice="",this.applied=null,this.multiOn=!1,this.customSep="",this.addTok="",this.dragTok="",this.dragRule=-1,this.pickFor="",this.revision=0,this.seeded=!1,this.sugg=null,this.stepping=new ns,this.savedSt=null,this.memo=null,this.onKey=e=>{e.key!=="Escape"||!V(this,e)||this.busy||this.close()}}static get hasDecisions(){return!!c.decideView}get withDecisions(){return!!c.decideView}willUpdate(){this.data&&!this.seeded&&(this.seeded=!0,this.revision=this.data.revision,this.multiOn=this.data.multi_building,this.sugg=C(this.data.mapItems),this.st=this.data.state?this.data.parsed:{...this.data.parsed,spec:{...this.sugg.spec}},this.savedSt=this.data.state?this.st:null,this.step=this.start,this.advancedOpen&&(this.st={...this.st,advanced:!0}))}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey),M(this)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),R(this)}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}get refs(){return this.data.buildings.map(e=>({id:e.id,name:e.name,shared:e.is_shared}))}model(){if(this.memo&&this.memo.st===this.st&&this.memo.data===this.data)return this.memo;const e=this.data.mapItems,a=U(e,this.st.spec),l=B(a,this.st,this.refs),n=W(e,this.st,{buildings:this.refs,settings:this.data.settings}),i=K(e,n),m=Q(e,n,this.refs,l),w=G(e,n,this.refs,this.data.ourFloors,this.data.links,this.st.levels);return this.memo={st:this.st,data:this.data,det:a,rows:l,res:n,qs:i,sum:m,lq:w},this.memo}setState(e,a=!1){if(a&&Object.keys(e.decisions).length){const l=H(this.data.mapItems,this.st,e,{buildings:this.refs,settings:this.data.settings});this.notice=l?l===1?s("השינוי היה משנה {n} החלטה ידנית - היא נשארת כפי שהחלטתם.",{n:l}):s("השינוי היה משנה {n} החלטות ידניות - הן נשארות כפי שהחלטתם.",{n:l}):""}this.st=e}setSpec(e){this.setState({...this.st,spec:{...this.st.spec,...e}},!0)}bName(e){return e?e.t==="none"?s("לא משויך"):e.t==="new"?e.name:this.data.buildings.find(a=>a.id===e.id)?.name??s("בניין שנמחק"):s("לא נבחר")}isShared(e){return!!e&&e.t==="b"&&!!this.data.buildings.find(a=>a.id===e.id)?.is_shared}async persist(){const e=this.st;if(e!==this.savedSt)try{const a=await _(this.data.site.id,e,this.revision);this.revision=a.revision,this.savedSt=e}catch(a){throw this.error=z(a),a}}go(e){return this.stepping.run(async()=>{this.error="",this.notice="";try{this.busy||await this.persist()}catch{return}e==="decide"&&!this.withDecisions&&(e=this.afterDecide),e==="levels"&&!this.model().lq.length&&(e="summary"),this.step=e})}get afterDecide(){return this.model().lq.length?"levels":"summary"}backFrom(e){const a=this.model();return e==="summary"&&a.lq.length?{to:"levels",label:s("קומות ללא מפלס")}:this.withDecisions&&(a.qs.length||Object.keys(this.st.decisions).length)?{to:"decide",label:s("ההחלטות")}:{to:"table",label:s("הטבלה")}}setLevel(e,a){const l={...this.st.levels};a?l[e]=a:delete l[e],this.setState({...this.st,levels:l})}skipLevels(){const e={...this.st.levels};for(const a of this.model().lq)a.answer||(e[a.id]={t:"skip"});this.setState({...this.st,levels:e})}async apply(){if(!this.busy){this.busy=!0,this.error="";try{const e=this.model(),a=X(this.data.mapItems,e.res,this.refs,this.data.ourFloors,this.data.links,this.st.levels),l=await Y(this.data.site.id,{state:this.st,revision:this.revision,plan:a,kind:"apply",summary:{open:e.sum.open,manual:e.sum.manual,by_floor:e.sum.byFloor,total:e.sum.total,buildings:e.sum.buildings.filter(n=>n.floors+n.areas>0).length}});if(this.revision=l.revision,l.created.buildings.length){const n=new Map(l.created.buildings.map(p=>[p.name,p.id])),i=p=>p&&p.t==="new"&&n.has(p.name)?{t:"b",id:n.get(p.name)}:p,m=Object.fromEntries(Object.entries(this.st.tokens).map(([p,v])=>[p,i(v)])),w=Object.fromEntries(Object.entries(this.st.decisions).map(([p,v])=>[p,i(v)]));this.st={...this.st,tokens:m,decisions:w,rules:this.st.rules.map(p=>({...p,to:i(p.to)}))};try{const p=this.st;this.revision=(await _(this.data.site.id,p,this.revision)).revision,this.savedSt=p}catch{}}this.applied={version:l.version,created:l.created.buildings.length},this.step="done",this.dispatchEvent(new CustomEvent("applied",{detail:{version:l.version,multi:this.multiOn},bubbles:!0,composed:!0}))}catch(e){this.error=z(e)}finally{this.busy=!1}}}async enableMulti(){this.busy=!0;try{await J(!0),this.multiOn=!0}catch(e){this.error=z(e)}finally{this.busy=!1}}render(){if(!this.data||!this.st)return u;const e=this.model().lq.length,a=ds.filter(i=>(i.id!=="decide"||this.withDecisions)&&(i.id!=="levels"||e)),l=a.findIndex(i=>i.id===this.step),n=this.headText();return t`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ma-h" data-mapping-assistant data-step=${this.step}>
      <header>
        <span class="num" aria-hidden="true">${this.step==="done"?t`<sw-icon name="check" size=${18}></sw-icon>`:this.step==="mark"?"?":l}</span>
        <div class="ttl">
          <h1 id="ma-h">${n.title}</h1>
          <div class="q">${n.q}</div>
        </div>
        ${this.step!=="done"?t`<div class="dots" aria-label=${s("שלב {n} מתוך {total}",{n:l+1,total:a.length})}>${a.map((i,m)=>t`<i class=${m<l?"past":m===l?"on":""}></i>`)}<span>${a[l]?.label}</span></div>`:u}
        <sw-button class="x" round icon="close" iconOnly label=${s("סגור")} data-ma-close @click=${()=>this.close()}></sw-button>
      </header>
      <main>
        ${this.notice?t`<div class="notice" role="status" data-ma-manual-impact><sw-icon name="info" size=${15}></sw-icon>${this.notice}</div>`:u}
        ${this.step==="mark"?this.renderMark():this.step==="table"?this.renderTable():this.step==="decide"?c.decideView?.(this):this.step==="levels"?this.renderLevels():this.step==="summary"?this.renderSummary():this.renderDone()}
        ${this.error?t`<div class="err" role="alert">${this.error}</div>`:u}
      </main>
      ${this.renderFoot()}
    </div>`}headText(){const e=this.model(),a=e.det;switch(this.step){case"mark":return{title:s("איך הבניין מסומן בשמות שלכם?"),q:s("המערכת בדקה את כל {total} השמות במערכת הבית וסימנה את מה שנראה הכי סביר. אפשר לבחור אחרת - התצוגה למטה מתעדכנת מיד.",{total:a.total})};case"table":return{title:s("סימון בשם ← בניין"),q:s('{length} סימונים נמצאו. לכל אחד - איזה בניין? שני סימונים לאותו בניין מתאחדים (בחירה או גרירה), סימון בלי בניין - בניין חדש, קיים או "לא משויך".',{length:e.rows.length})};case"decide":return{title:s("מה צריך את ההחלטה שלכם"),q:s("רק החריגים. כל השאר ({n} פריטים) כבר במקום. הכפתור המודגש הוא מה שהמערכת הייתה בוחרת.",{n:a.total-e.qs.reduce((l,n)=>l+n.count,0)})};case"levels":{const l=e.lq.length;return{title:s("קומות ללא מפלס"),q:l===1?s('קומה אחת במערכת הבית בלי מפלס ובלי מספר בשם. באיזה מפלס היא - או "זהה לקומה קיימת"? דילוג = קומה חדשה במפלס 0, כמו היום.'):s('{n} קומות במערכת הבית בלי מפלס ובלי מספר בשם. באיזה מפלס כל אחת - או "זהה לקומה קיימת"? דילוג = קומה חדשה במפלס 0, כמו היום.',{n:l})}}case"summary":return{title:s("סיכום ואישור"),q:s('מה יקרה כשתלחצו "החל". אפשר לחזור ולשנות אחר כך.')};default:return{title:s("המיפוי הוחל"),q:""}}}renderFoot(){const e=this.model(),a=e.qs.length,l=(n,i)=>t`<sw-button variant="secondary" icon="chevron" data-ma-back @click=${()=>void this.go(n)}>${i}</sw-button>`;switch(this.step){case"mark":return t`<footer><sw-button variant="ghost" @click=${()=>this.close()}>${s("ביטול")}</sw-button><span class="ln">${s('שום דבר לא משתנה עד "החל" בסיכום')}</span><span class="sp"></span>
          <sw-button variant="primary" data-ma-next ?disabled=${this.busy} @click=${()=>void this.go("table")}>${s("נכון, המשך")}</sw-button></footer>`;case"table":return t`<footer>${l("mark",s("צורת הסימון"))}<span class="ln">${s('שום דבר לא משתנה עד "החל" בסיכום')}</span><span class="sp"></span>
          <sw-button variant="primary" data-ma-next @click=${()=>void this.go(this.withDecisions&&a?"decide":this.afterDecide)}>${this.withDecisions&&a?a===1?s("המשך - {n} החלטה מחכה",{n:a}):s("המשך - {n} החלטות מחכות",{n:a}):e.lq.length?e.lq.length===1?s("המשך - קומה אחת ללא מפלס"):s("המשך - {n} קומות ללא מפלס",{n:e.lq.length}):s("המשך לסיכום")}</sw-button></footer>`;case"decide":return t`<footer>${l("table",s("הטבלה"))}<span class="ln">${s("אפשר להמשיך גם עם החלטות פתוחות - הפריטים יישארו כמו שהם, עם אזהרה")}</span><span class="sp"></span>
          <sw-button variant="primary" data-ma-next @click=${()=>void this.go(this.afterDecide)}>${e.lq.length?s("המשך - קומות ללא מפלס"):s("המשך לסיכום")}</sw-button></footer>`;case"levels":{const n=this.backFrom("levels"),i=e.lq.filter(m=>!m.answer).length;return t`<footer>${l(n.to,n.label)}<span class="ln">${i?i===1?s("{n} קומה מחכה למפלס",{n:i}):s("{n} קומות מחכות למפלס",{n:i}):s("לכל הקומות יש מפלס")}</span><span class="sp"></span>
          ${i?t`<sw-button variant="secondary" data-ma-levels-skip @click=${()=>{this.skipLevels(),this.go("summary")}}>${i===1?s("דלג - מפלס 0"):s("דלג - מפלס 0 לכולן")}</sw-button>`:u}
          <sw-button variant="primary" data-ma-next ?disabled=${i>0} @click=${()=>void this.go("summary")}>${s("המשך לסיכום")}</sw-button></footer>`}case"summary":{const n=this.backFrom("summary");return t`<footer>${l(n.to,n.label)}<span class="ln">${s("{manual} החלטות שלכם · {byFloor} לפי הקומה · השאר לפי הסימון",{manual:e.sum.manual,byFloor:e.sum.byFloor})}</span><span class="sp"></span></footer>`}default:return t`<footer><span class="sp"></span><sw-button variant="primary" data-ma-finish @click=${()=>this.close()}>${s("סיום")}</sw-button></footer>`}}renderMark(){const e=this.model(),a=e.det,l=this.sugg,n=this.st.advanced?"advanced":this.st.spec.position,i=r=>{r==="advanced"?this.setState({...this.st,advanced:!0,rules:this.st.rules.length?this.st.rules:[{...ts}]},!0):this.setState({...this.st,advanced:!1,spec:{...this.st.spec,position:r}},!0)},m=r=>{if(r==="advanced")return t`${s("רשימת כללים בשפה פשוטה")}`;const f=r===this.st.spec.position?a.pct:l.alternatives[r];return t`${s("מסביר")} <b>${f}%</b> ${s("מהשמות")}`},w=t`<div class="opts" role="radiogroup" aria-label=${s("איפה הסימון")}>
      ${[...Z,...c.rulesView?["advanced"]:[]].map(r=>t`<button type="button" role="radio" class="opt press" data-ma-pos=${r} aria-checked=${String(n===r)} @click=${()=>i(r)}>
          <h2><span class="rd" aria-hidden="true"></span>${O[r].title}</h2>
          <div class="ex">${O[r].ex.map(f=>t`<span>${f}</span>`)}</div>
          <div class="fit">${m(r)}</div>
        </button>`)}
    </div>`,p=Object.entries(a.sepUse).filter(([r])=>r!=="·"),v=t`<div class="detected" data-ma-detected><sw-icon name="sparkle" size=${18}></sw-icon>
      <span>${this.st.spec.position===l.spec.position&&!this.st.advanced?s("זיהינו: "):s("כך נקראים השמות: ")}<b>${O[this.st.spec.position].title}</b>${this.st.spec.position==="start"||this.st.spec.position==="end"?t`${s(", מופרד ב-")}<b>${this.st.spec.seps.map(r=>y[r]??`"${r}"`).join(" / ")}</b>`:u}${s(". מסביר")} <b data-ma-pct>${a.pct}%</b> ${s("מהשמות שלכם -")} <bdi>${a.marked}</bdi> ${s("מתוך")} <bdi>${a.total}</bdi>${p.length?t` (${p.map(([r,f])=>s("{n} עם {sep}",{n:f,sep:y[r]??r})).join(", ")})`:u}.
        <span class="more">${a.unmarked.length?t`${s("{n} שמות בלי סימון -",{n:a.unmarked.length})} ${this.data.settings.floor_inherit==="on"?s("מי שבקומה של בניין ברור נכנס לפי הקומה, על השאר נשאל."):s("נשאל עליהם בהמשך.")}`:s("כל השמות מסומנים.")}</span></span>
    </div>`,h=this.st.spec,o=(r,f,$,k,q="")=>t`<button type="button" class="ch press" aria-pressed=${String(r)} data-ma-chip=${q} @click=${$}>${f}${k?t`<small>${k}</small>`:u}</button>`,d=r=>{const $=h.seps.includes(r)?h.seps.filter(k=>k!==r):[...h.seps,r];$.length&&this.setSpec({seps:$})},x=h.seps.filter(r=>!D.includes(r)),F=this.st.spec.position==="label"?u:t`<div class="ctrls">
      ${h.position==="word"?t`<label class="grp"><b>${s("המילה שלפני הסימון:")}</b><input class="tx short" data-ma-marker .value=${h.marker} @input=${r=>this.setSpec({marker:r.target.value})} /></label>`:t`<div class="grp"><b>${s("המפריד:")}</b>${D.map(r=>o(h.seps.includes(r),y[r],()=>d(r),a.sepUse[r],`sep-${r===" "?"space":r}`))}
            ${x.map(r=>o(!0,`"${r}"`,()=>d(r),a.sepUse[r],"sep-custom"))}
            <input class="tx short" placeholder=${s("אחר…")} aria-label=${s("מפריד אחר")} maxlength="4" .value=${this.customSep} @input=${r=>this.customSep=r.target.value}
              @keydown=${r=>{r.key==="Enter"&&this.customSep.trim()&&!h.seps.includes(this.customSep.trim())&&(this.setSpec({seps:[...h.seps,this.customSep.trim()]}),this.customSep="")}} /></div>`}
      <div class="grp"><b>${h.position==="end"?s("מה אחרי המפריד:"):h.position==="word"?s("הסימון הוא:"):s("מה לפני המפריד:")}</b>${["letter","number","word","any"].map(r=>o(h.kind===r,ps[r],()=>this.setSpec({kind:r}),void 0,`kind-${r}`))}</div>
    </div>`,E=[...this.data.mapItems.slice(0,40),...a.unmarked.slice(0,10)],j=t`<div class="live">
      <div class="panel names"><h3>${s("השמות שלכם, כפי שהמערכת קוראת אותם")}</h3><div class="scroll" data-ma-names>
        ${E.map(r=>{const f=ss(r,h);return f?t`<div class="nm"><span class="t"><bdi>${this.markName(r.name,f.token)}</bdi></span><small>${r.kind==="floor"?s("קומה"):s("אזור")}</small></div>`:t`<div class="nm no"><span class="t"><mark>?</mark> <bdi>${r.name}</bdi></span><small>${s("בלי סימון")}</small></div>`})}
        <div class="hint">${s("… ועוד {n} שמות",{n:Math.max(0,a.total-E.length)})}</div></div></div>
      <div class="panel"><h3>${s("הקיבוץ שיוצא מזה")}<span class="sp"></span><span class="ct">${s("{length} סימונים",{length:a.tokens.length})}</span></h3><div class="scroll"><div class="groups" data-ma-groups>
        ${a.tokens.map(r=>{const $=e.rows.find(k=>k.token===r.token)?.target;return t`<div class="tokc"><div class="th"><span class="g ${this.isShared($)?"sh":$?"":"un"}" title=${r.token}>${r.token}</span><span class="ct">${s("{floors} קומות · {areas} אזורים",{floors:r.floors,areas:r.areas})}</span><span class="arr">← ${$?this.bName($):"?"}</span></div>
            <div class="samp">${r.samples.slice(0,4).map(k=>t`<span title=${k}><bdi>${k}</bdi></span>`)}</div></div>`})}
        ${a.unmarked.length?t`<div class="tokc"><div class="th"><span class="g un">?</span><span class="ct">${s("{length} בלי סימון",{length:a.unmarked.length})}</span><span class="arr">${s("← שאלה")}</span></div><div class="samp">${a.unmarked.slice(0,4).map(r=>t`<span><bdi>${r.name}</bdi></span>`)}</div></div>`:u}
      </div></div></div>
    </div>`;return t`${w}${v}${F}${this.st.advanced&&c.rulesView?c.rulesView(this):j}`}markName(e,a){const l=e.indexOf(a);return l<0?e:t`${e.slice(0,l)}<mark>${a}</mark>${e.slice(l+a.length)}`}targetOptions(e,a){const l=es(this.data.settings),n=t`<option value=${`n:${L(a)}`} ?selected=${e?.t==="new"}>${s('בניין חדש "{name}"',{name:L(a)})}</option>`,i=this.data.buildings.map(p=>t`<option value=${`b:${p.id}`} ?selected=${e?.t==="b"&&e.id===p.id}>${p.name}</option>`),m=t`<option value="none" ?selected=${e?.t==="none"}>${s("לא משויך")}</option>`,w=l.map(p=>p==="new"?n:p==="existing"?t`<optgroup label=${s("בניין קיים")}>${i}</optgroup>`:m);return t`${e?u:t`<option value="" selected>${s("בחרו - או נשאל בהמשך")}</option>`}${w}`}parseTarget(e){return e.startsWith("b:")?{t:"b",id:e.slice(2)}:e.startsWith("n:")?{t:"new",name:e.slice(2)}:e==="none"?{t:"none"}:null}setToken(e,a){const l=this.parseTarget(a),n={...this.st.tokens};l?n[e]=l:delete n[e],this.setState({...this.st,tokens:n},!0)}renderTable(){const e=this.model(),a=o=>{const d=Object.keys(o.stat.seps).filter(x=>x!=="·"&&x!==this.st.spec.seps[0]);return d.length?t`<small>${s("גם עם {list}",{list:d.map(x=>y[x]??`"${x}"`).join(", ")})}</small>`:u},l=o=>d=>{d.preventDefault();const x=this.dragTok;this.dragTok="",x&&x!==o&&this.setState(as(this.st,x,o,this.refs),!0)},n=e.rows.map(o=>t`<div class="tk ${this.dragTok&&this.dragTok!==o.token?"dropzone":""}" data-ma-token=${o.token}
        @dragover=${d=>{this.dragTok&&d.preventDefault()}} @drop=${l(o.token)}>
      <button class="grip" draggable="true" aria-label=${s('גרור את "{token}" על סימון אחר כדי לאחד',{token:o.token})} title=${s("גרירה על שורה אחרת = אותו בניין")}
        @dragstart=${d=>{this.dragTok=o.token,d.dataTransfer?.setData("text/plain",o.token)}} @dragend=${()=>this.dragTok=""}><sw-icon name="grip" size=${16}></sw-icon></button>
      <span class="tok"><span class="g ${this.isShared(o.target)?"sh":o.target?"":"un"}" title=${o.token}>${o.token}</span>${a(o)}${o.merged?t`<span class="tag m" data-ma-merged>${s("מאוחד")}</span>`:u}${o.manual?t`<span class="tag">${s("נוסף ידנית")}</span>`:u}</span>
      <select data-ma-target=${o.token} aria-label=${s('הבניין של "{token}"',{token:o.token})} @change=${d=>this.setToken(o.token,d.target.value)}>${this.targetOptions(o.target,o.token)}</select>
      <span class="c"><b>${s("{floors} קומות, {areas} אזורים",{floors:o.stat.floors,areas:o.stat.areas})}</b>${o.target?o.own?u:t`<small>${s("לפי שם הבניין")}</small>`:t`<small>${s('אין בניין "{token}" - חדש? קיים?',{token:o.token})}</small>`}</span>
      <span class="samp">${o.stat.samples.slice(0,4).map(d=>t`<span title=${d}><bdi>${d}</bdi></span>`)}${o.stat.floors+o.stat.areas>4?t`<span>+${o.stat.floors+o.stat.areas-4}</span>`:u}</span>
    </div>`),i=e.det.unmarked,m=e.sum.byFloor,w=t`<div class="tk" data-ma-token-none><span></span><span class="tok"><span class="g un">?</span><small>${s("בלי סימון")}</small></span><span class="ct">${s("נשאל בהמשך")}</span>
      <span class="c"><b>${s("{floors} קומות, {areas} אזורים",{floors:i.filter(o=>o.kind==="floor").length,areas:i.filter(o=>o.kind==="area").length})}</b>${m?t`<small>${s("{byFloor} מהם ייכנסו לפי הקומה שלהם",{byFloor:m})}</small>`:u}</span>
      <span class="samp">${i.slice(0,4).map(o=>t`<span><bdi>${o.name}</bdi></span>`)}</span></div>`,p=t`<div class="add"><input class="tx short" data-ma-add-token placeholder=${s("למשל A")} aria-label=${s("סימון חדש")} maxlength="12" .value=${this.addTok} @input=${o=>this.addTok=o.target.value} />
      <sw-button size="sm" variant="ghost" icon="plus" data-ma-add ?disabled=${!this.addTok.trim()||e.rows.some(o=>o.token===this.addTok.trim())}
        @click=${()=>{const o=this.addTok.trim();this.setState({...this.st,manual_tokens:[...this.st.manual_tokens,o]}),this.addTok=""}}>${s("הוסף סימון ידנית")}</sw-button>
      <span>${s('אם במערכת הבית יופיעו גם שמות באנגלית, למשל "A" ← בניין א')}</span></div>`,v=e.sum.buildings.filter(o=>o.floors+o.areas+o.tokens.length>0||o.target.t==="b"),h=t`<div class="panel side"><h3><sw-icon name="building" size=${16}></sw-icon>${s("הבניינים שיוצאים מזה")}</h3><div class="scroll" data-ma-side>
      ${v.map(o=>t`<div class="bl"><span class="g ${this.isShared(o.target)?"sh":""}">${o.target.t==="new"?t`<sw-icon name="plus" size=${14}></sw-icon>`:t`<sw-icon name="building" size=${14}></sw-icon>`}</span>
        <span class="t"><b>${this.bName(o.target)}</b><span>${s("{floors} קומות · {areas} אזורים",{floors:o.floors,areas:o.areas})}${o.target.t==="new"?s(" · ייווצר"):""}</span></span>
        <span class="toks">${o.tokens.map(d=>t`<span class="tag">${d}</span>`)}</span></div>`)}
      <div class="bl"><span class="g un">?</span><span class="t"><b>${s("לא משויך / שאלה")}</b><span>${s("{floors} קומות · {areas} אזורים",{floors:e.sum.unassigned.floors,areas:e.sum.unassigned.areas})}</span></span></div>
      <div class="hint">${s('הטבלה נשמרת: שם חדש במערכת הבית שמתחיל ב"ב ·" ייכנס לבניין ב בלי לשאול שוב ({how}). סימון שלא מופיע כאן - שאלה.',{how:this.data.settings.auto_insert==="on"?s("לבד, לפי ההגדרה"):s('אחרי "אשר"')})}</div>
    </div></div>`;return t`<div class="two"><div class="panel"><div class="scroll" data-ma-table>
        <div class="tk hdr"><span></span><span>${s("סימון בשם")}</span><span>${s("בניין אצלנו")}</span><span>${s("כמה")}</span><span>${s("דוגמאות")}</span></div>
        ${n}${w}${p}</div></div>${h}</div>`}renderLevels(){const e=this.model(),a=i=>i?i.t==="skip"?"skip":i.t==="floor"?`f:${i.id}`:`l:${i.level}`:"",l=i=>{if(i==="skip")return{t:"skip"};if(i.startsWith("f:"))return{t:"floor",id:i.slice(2)};if(i.startsWith("l:"))return{t:"level",level:Number(i.slice(2))}},n=e.lq.map(i=>{const m=this.data.mapItems.find(d=>d.kind==="floor"&&d.id===i.id),w=e.res.get(`f:${i.id}`)?.to,p=i.building.startsWith("new:")?[]:this.data.ourFloors.filter(d=>d.building_id===i.building).sort((d,x)=>x.level-d.level),v=a(i.answer),h=i.answer?.t==="level"&&!S.includes(i.answer.level)?[...S,i.answer.level].sort((d,x)=>d-x):S,o=i.answer?i.answer.t==="skip"?t`<span class="tag">${s("מפלס 0")}</span>`:t`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>${s("נקבע")}</span>`:t`<span class="tag wn">${s("מחכה")}</span>`;return t`<div class="lv" data-ma-level=${i.id}>
        <span class="t"><b><bdi>${m?.name??i.rest}</bdi></b><small>${this.bName(w)} · ${i.answer?.t==="floor"?s("לקומה קיימת"):s('קומה "{rest}"',{rest:i.rest})}</small></span>
        <select data-ma-level-pick=${i.id} aria-label=${s('המפלס של "{name}"',{name:m?.name??i.rest})} @change=${d=>this.setLevel(i.id,l(d.target.value))}>
          <option value="" ?selected=${!v}>${s("בחרו מפלס")}</option>
          ${p.length?t`<optgroup label=${s("זהה לקומה קיימת")}>${p.map(d=>t`<option value=${`f:${d.id}`} ?selected=${v===`f:${d.id}`}>${s("{name} (מפלס {level})",{name:d.name,level:d.level})}</option>`)}</optgroup>`:u}
          <optgroup label=${s("מפלס לקומה חדשה")}>${h.map(d=>t`<option value=${`l:${d}`} ?selected=${v===`l:${d}`}>${s("מפלס {n}",{n:d})}</option>`)}</optgroup>
          <option value="skip" ?selected=${v==="skip"}>${s("דלג - מפלס 0, כמו היום")}</option>
        </select>
        ${o}
      </div>`});return t`<div class="panel" style="flex:1 1 auto"><h3><sw-icon name="building" size=${16}></sw-icon>${s("קומות בלי מפלס")}<span class="sp"></span><span class="ct">${e.lq.length}</span></h3>
      <div class="scroll" data-ma-levels>${n}</div></div>`}renderSummary(){const e=this.model(),a=(this.data.versions[0]?.number??0)+1,l=e.sum.buildings.filter(n=>n.floors+n.areas>0||n.target.t==="b");return t`<div class="panel" style="flex:1 1 auto"><div class="scroll"><div class="sum" data-ma-summary>
        ${l.map(n=>t`<div class="srow" data-ma-sum-row=${n.key}>
          <span class="g ${this.isShared(n.target)?"sh":""}"><sw-icon name=${n.target.t==="new"?"plus":"building"} size=${15}></sw-icon></span>
          <div class="t"><b>${this.bName(n.target)}${n.target.t==="new"?t` <span class="tag new">${s("בניין חדש")}</span>`:u}</b>
            <span>${n.floors+n.areas?s("{floors} קומות ו-{areas} אזורים ממערכת הבית יופיעו תחת {building}",{floors:n.floors,areas:n.areas,building:this.bName(n.target)}):s("שום דבר ממערכת הבית לא מגיע לבניין הזה")}${n.manual?t` · <em>${s("{manual} החלטות שלכם",{manual:n.manual})}</em>`:u}${n.byFloor?s(" · {byFloor} לפי הקומה",{byFloor:n.byFloor}):""}${n.tokens.length?s(" · סימון {list}",{list:n.tokens.map(i=>`"${i}"`).join(", ")}):""}</span></div>
          <span class="st ${n.floors+n.areas?"":"wn"}"><sw-icon name=${n.floors+n.areas?"check":"info"} size=${14}></sw-icon>${n.floors+n.areas?s("מוכן"):s("ריק")}</span></div>`)}
        <div class="srow" data-ma-sum-row="none"><span class="g un">?</span>
          <div class="t"><b>${s("לא משויך")}</b><span>${s("{floors} קומות ו-{areas} אזורים יישארו בלי בניין",{floors:e.sum.unassigned.floors,areas:e.sum.unassigned.areas})}${e.sum.open?s(" ({open} מהם מחכים להחלטה - יישארו כמו שהם)",{open:e.sum.open}):""}${s(". אפשר לסדר אותם אחר כך מההגדרות.")}</span></div>
          ${e.qs.length?t`<span class="st wn"><sw-icon name="warning" size=${14}></sw-icon>${s("{length} החלטות פתוחות",{length:e.qs.length})}</span>`:t`<span class="st"><sw-icon name="check" size=${14}></sw-icon>${s("הכל הוחלט")}</span>`}</div>
      </div></div></div>
      <div class="applybox" data-ma-applybox><div class="t"><b>${s("להחיל את המיפוי?")}</b>
          <ul><li><sw-icon name="check" size=${13}></sw-icon>${s("נשמר כגרסה {nextVersion}",{nextVersion:a})}</li><li><sw-icon name="check" size=${13}></sw-icon>${s("נרשם ביומן הפעולות")}</li><li><sw-icon name="check" size=${13}></sw-icon>${s('הפיך: "חזרה לגרסה זו" בהגדרות')}</li><li><sw-icon name="check" size=${13}></sw-icon>${s("שום דבר לא משתנה במערכת הבית עצמה")}</li></ul></div>
        <sw-button variant="ghost" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
        <sw-button variant="primary" icon="check" data-ma-apply ?disabled=${this.busy} @click=${()=>void this.apply()}>${this.busy?s("מחיל…"):s("החל")}</sw-button></div>`}renderDone(){const e=this.applied;return t`<div class="donebox" data-ma-done><span class="badge-ok"><sw-icon name="check" size=${28}></sw-icon></span>
      <h2>${s("המיפוי נשמר - גרסה {version}",{version:e.version})}</h2>
      <p>${e.created?`${e.created===1?s("{n} בניין חדש נוצר.",{n:e.created}):s("{n} בניינים חדשים נוצרו.",{n:e.created})} `:""}${s("שם חדש במערכת הבית עם סימון מוכר {what}. אפשר תמיד לחזור לגרסה קודמת.",{what:this.data.settings.auto_insert==="on"?s("ייכנס למקומו לבד"):s('יחכה ל"אשר" בכרטיס בהגדרות')})}</p>
      ${this.multiOn?t`<p data-ma-multi-on>${s("תצוגת ריבוי הבניינים פעילה: המסך הראשי מציג את האתר לפי בניינים.")}</p>`:this.data.can_toggle?t`<div class="offer" data-ma-offer><span>${s("תצוגת ריבוי הבניינים כבויה - המסך הראשי עדיין מציג בניין אחד.")}</span>
              <sw-button variant="primary" icon="building" data-ma-enable-multi ?disabled=${this.busy} @click=${()=>void this.enableMulti()}>${s("הפעל עכשיו את תצוגת ריבוי הבניינים")}</sw-button></div>`:t`<p>${s("תצוגת ריבוי הבניינים כבויה. מי שמנהל את כל האתרים יכול להפעיל אותה בהגדרות ‹ בניינים ומיפוי.")}</p>`}
    </div>`}};c.decideView=null;c.rulesView=null;c.styles=rs;g([T({attribute:!1})],c.prototype,"data",2);g([T()],c.prototype,"start",2);g([T({type:Boolean})],c.prototype,"advancedOpen",2);g([b()],c.prototype,"step",2);g([b()],c.prototype,"st",2);g([b()],c.prototype,"busy",2);g([b()],c.prototype,"error",2);g([b()],c.prototype,"notice",2);g([b()],c.prototype,"applied",2);g([b()],c.prototype,"multiOn",2);g([b()],c.prototype,"customSep",2);g([b()],c.prototype,"addTok",2);g([b()],c.prototype,"dragTok",2);g([b()],c.prototype,"dragRule",2);g([b()],c.prototype,"pickFor",2);c=g([is("mapping-assistant")],c);export{c as MappingAssistant,O as POS_TEXT,gs as RULE_LABEL};
