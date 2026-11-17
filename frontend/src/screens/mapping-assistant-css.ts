import { css } from 'lit';

/**
 * CR-STRUCT-CSS-SPLIT-2442 (code review 06:STRUCT-1 step 1): the style sheets of `mapping-assistant` (screens/mapping-assistant.ts), moved here as they
 * stood - same CSS text, same order, same composition of the array. The screen keeps `static styles = mappingAssistantStyles`.
 */

export const mappingAssistantStyles = css`
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
      background: var(--sw-bg, var(--sw-surface));
      border-radius: var(--sw-r-xl);
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
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
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
      background: var(--sw-accent-soft);
      border-color: transparent;
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold);
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
  `;
