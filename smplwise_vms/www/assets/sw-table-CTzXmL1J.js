import{g as f,ax as c,i as m,cw as v,b as o,A as i,hQ as g,hR as x,hS as y,hT as h,k}from"./index-BdSK43oz.js";const $=/^(data-[a-z0-9][a-z0-9._-]*|aria-[a-z]+|title)$/,S=new Set(["data-row-id"]),C=t=>$.test(t)&&!S.has(t);function T(t){const e={};if(!t)return e;for(const[s,a]of Object.entries(t)){const r=s.toLowerCase();!C(r)||a===null||a===void 0||a===!1||(e[r]=a===!0?"":String(a))}return e}const A=["num","muted","status","actions","truncate"],u=t=>(t.kind===void 0?[]:typeof t.kind=="string"?[t.kind]:[...t.kind]).filter(e=>A.includes(e));function R(t){return[t.ltr?"ltr":"",t.hideBelow?`hb-${t.hideBelow}`:"",t.card&&t.card!=="hide"?`c-${t.card}`:"",...u(t).map(e=>`k-${e}`),t.align&&t.align!=="start"?`a-${t.align}`:""].filter(Boolean).join(" ")}const z=t=>["cell",...u(t).map(e=>`cell-${e}`)].join(" ");function E(t){const e=u(t),s=t.align??(e.includes("num")||e.includes("actions")?"end":"start");return[t.hideBelow?`hb-${t.hideBelow}`:"",s!=="start"?`a-${s}`:""].filter(Boolean).join(" ")}function L(t,e,s){if(s<=0)return-1;switch(t){case"ArrowDown":return Math.min(s-1,e+1);case"ArrowUp":return Math.max(0,e-1);case"Home":return 0;case"End":return s-1;default:return-1}}var O=Object.defineProperty,B=Object.getOwnPropertyDescriptor,l=(t,e,s,a)=>{for(var r=a>1?void 0:a?B(e,s):e,d=t.length-1,p;d>=0;d--)(p=t[d])&&(r=(a?p(e,s,r):p(r))||r);return a&&r&&O(e,s,r),r};const P=t=>t.some(e=>!!e.foot),w=t=>t.some(e=>!!e.card);class _ extends x{constructor(e){if(super(e),this.last=new Set,e.type!==y.ELEMENT)throw new Error("rowHooks() belongs on an element (a row or a cell)")}render(e){return h}update(e,[s]){const a=e.element,r=T(s);for(const d of this.last)d in r||a.removeAttribute(d);for(const[d,p]of Object.entries(r))a.getAttribute(d)!==p&&a.setAttribute(d,p);return this.last=new Set(Object.keys(r)),h}}const b=g(_);let n=class extends m{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText=v("אין שורות להצגה"),this.dense=!1,this.focusRows=!1,this.noFocusRows=!1,this.bare=!1,this.staticRows=!1,this.rowSelectListeners=0}get rowsFocusable(){return this.staticRows?!1:this.focusRows||!this.noFocusRows&&this.rowSelectListeners>0}addEventListener(t,e,s){e&&(super.addEventListener(t,e,s),t==="row-select"&&this.rowSelectListeners++===0&&this.requestUpdate())}removeEventListener(t,e,s){e&&(super.removeEventListener(t,e,s),t==="row-select"&&this.rowSelectListeners>0&&--this.rowSelectListeners===0&&this.requestUpdate())}pick(t,e){const s=String(t[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:e?{id:s,row:t,key:e}:{id:s,row:t},bubbles:!0,composed:!0}))}onRowKey(t,e){if(t.target!==t.currentTarget)return;if(t.key==="Enter"||t.key===" "){t.preventDefault(),this.pick(e,t.key);return}const s=[...this.renderRoot.querySelectorAll('tbody tr[tabindex="0"]')],a=L(t.key,s.indexOf(t.currentTarget),s.length);a<0||(t.preventDefault(),s[a].focus())}willUpdate(){const t=w(this.columns);this.toggleAttribute("card-template",t),this.toggleAttribute("has-card-badge",t&&this.columns.some(e=>e.card==="badge"))}cellClass(t){return R(t)}cell(t,e){const s=t.render?t.render(e):String(e[t.key]??""),a=t.kind===void 0?[]:typeof t.kind=="string"?[t.kind]:t.kind,r=t.cellTitle?t.cellTitle(e):a.includes("truncate")&&!t.render?String(e[t.key]??""):void 0,d=a.includes("num")?o`<span class="num">${s}</span>`:a.includes("actions")?o`<span class="acts">${s}</span>`:a.includes("truncate")?o`<span class="trunc">${s}</span>`:s;return o`<td class=${this.cellClass(t)} part=${z(t)} data-label=${t.label} title=${r||i} ${b(t.cellAttrs?t.cellAttrs(e):null)}>${d}</td>`}footCell(t){const e=t.foot?t.foot():i,s=t.kind===void 0?[]:typeof t.kind=="string"?[t.kind]:t.kind,a=e===i||e===""?i:s.includes("num")?o`<span class="num">${e}</span>`:e;return o`<td class=${this.cellClass(t)} part="foot-cell" data-label=${a===i?"":t.label}>${a}</td>`}metaCell(t){const e=this.columns.filter(s=>s.card==="meta").map(s=>s.render?s.render(t):String(t[s.key]??"")).filter(s=>s!==""&&s!==i);return e.length?o`<td class="cmeta" data-card-meta data-label="">${e.map((s,a)=>o`${a?o`<span class="sep"> · </span>`:i}<bdi>${s}</bdi>`)}</td>`:i}render(){if(!this.rows.length)return o`<slot name="empty"><div class="empty" part="empty">${this.emptyText}</div></slot>`;const t=w(this.columns),e=this.rowsFocusable,s=this.rowAttrs;return o`
      <table part="table">
        <thead>
          <tr part="head-row">${this.columns.map(a=>o`<th class=${a.hideBelow||a.align||a.kind?E(a):i} part="head" style=${a.width?`width:${a.width}`:""}>${a.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(a=>o`<tr class="clickable ${this.selected===String(a[this.rowKey])?"selected":""}" part="row" data-row-id=${String(a[this.rowKey]??"")} ${b(s?s(a):null)} @click=${()=>this.staticRows||this.pick(a)}
              tabindex=${e?"0":i} @keydown=${e?r=>this.onRowKey(r,a):i}
              @pointerenter=${r=>this.dispatchEvent(new CustomEvent("row-hover",{detail:{id:String(a[this.rowKey]??""),row:a,clientX:r.clientX,clientY:r.clientY,pointerType:r.pointerType},bubbles:!0,composed:!0}))}
              @pointerleave=${()=>this.dispatchEvent(new CustomEvent("row-leave",{detail:{id:String(a[this.rowKey]??"")},bubbles:!0,composed:!0}))}>
              ${this.columns.map(r=>this.cell(r,a))}${t?this.metaCell(a):i}
            </tr>`)}
        </tbody>
        ${P(this.columns)?o`<tfoot><tr part="foot-row">${this.columns.map(a=>this.footCell(a))}</tr></tfoot>`:i}
      </table>
    `}};n.styles=f`
    :host {
      display: block;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow: auto;
      max-inline-size: 100%;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-table-fs, var(--sw-fs-sm));
      min-inline-size: var(--sw-table-min, 560px);
    }
    /* R5-INVESTIGATE-297 (size hooks): a host may ask for taller rows and a larger reading size (the investigation lists do); the defaults
       are exactly the old values, every other table is unchanged */
    th,
    td {
      padding: var(--sw-table-cell-pad, 9px 14px);
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    :host([dense]) th,
    :host([dense]) td {
      padding: 7px 12px;
    }
    /* Phones (M45): each row is a card — cells stack, the column label becomes a small caption, the first
       column (picture / avatar) sits beside the text. Nothing scrolls sideways. */
    @media (max-width: 767px) {
      :host {
        overflow: visible;
      }
      table {
        min-inline-size: 0;
        display: block;
      }
      thead {
        display: none;
      }
      tbody {
        display: block;
      }
      tr {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 2px 12px;
        padding: 10px 12px;
        border-block-end: 1px solid var(--sw-border);
      }
      tr > td:first-child {
        grid-row: span 6;
        align-self: start;
      }
      tr > td:first-child:not([data-label='']) {
        grid-row: auto;
        grid-column: 1 / -1;
      }
      td {
        display: block;
        padding: 0;
        border: 0;
        white-space: normal;
        grid-column: 2;
        /* full-system sweep: an audit "details" cell (a JSON-ish string with no spaces) or a long entity id
           has no break opportunity, so it ran off the card's edge and widened the whole page sideways */
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      td:not([data-label=''])::before {
        content: attr(data-label);
        display: block;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        line-height: 1.3;
      }
      tr.selected {
        /* CR-CMP2-TABLES-2450: the mark sits on the row's START edge (the right one in Hebrew) */
        box-shadow: inset var(--_sel-mark, 3px) 0 0 var(--sw-accent);
      }
      :host(:dir(rtl)) tr.selected {
        --_sel-mark: -3px;
      }
    }
    th {
      position: sticky;
      top: 0;
      background: var(--sw-table-head-bg, var(--sw-surface));
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
      z-index: 1;
    }
    tbody tr {
      transition: background var(--sw-t-hover) var(--sw-ease-color);
    }
    /* POLISH-CLASSIC-DOMUS-297 (mobile-native): the row tint follows a hovering pointer only; on touch a tapped row stayed tinted */
    @media (hover: hover) and (pointer: fine) {
      tbody tr:hover {
        background: var(--sw-surface-2);
      }
    }
    tbody tr.clickable:active {
      background: var(--sw-surface-3);
    }
    tbody tr.selected {
      background: var(--sw-accent-soft);
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    tr.clickable {
      cursor: pointer;
    }
    /* SHARED-POLISH-2342: the focused row draws the focus ring inside its own box (a table cell clips an outer outline) */
    tbody tr:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: calc(-1 * var(--sw-focus-w));
    }
    /* UXFIX-RTL: a span.ltr inside any cell (a raw JSON payload, a code, an id) is its own left-to-right isolate; the braces no longer
       mirror and a "{" never lands at the line end of an RTL row. */
    td .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: start;
    }
    td.ltr {
      unicode-bidi: isolate;
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* POLISH4-WP1: TableColumn.hideBelow */
    @media (max-width: 1023px) {
      .hb-tablet {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .hb-phone {
        display: none;
      }
    }
    /* ---- AUDIT30-B-SHARED (finding 10, Q8 = א assumed): TableColumn.card - the phone row template (opt-in per table) ----
       one line "title · badge", one meta line; about 60 px a row (was ~160 px of caption / value pairs) */
    .cmeta {
      display: none;
    }
    @media (max-width: 599px) {
      :host([card-template]) tr {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 2px 10px;
        padding: 9px 12px;
      }
      :host([card-template]) tr > td {
        display: none;
        grid-row: auto;
        grid-column: 1 / -1;
      }
      :host([card-template]) tr > td.c-title,
      :host([card-template]) tr > td.c-badge,
      :host([card-template]) tr > td.c-show,
      :host([card-template]) tr > td.cmeta {
        display: block;
      }
      :host([card-template]) tr > td.c-title {
        grid-row: 1;
        grid-column: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-wrap: normal;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      :host([card-template]) tr > td.c-badge {
        grid-row: 1;
        grid-column: 2;
        justify-self: end;
        white-space: nowrap;
      }
      :host([card-template]:not([has-card-badge])) tr > td.c-title {
        grid-column: 1 / -1;
      }
      :host([card-template]) tr > td.cmeta {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-wrap: normal;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
      }
      :host([card-template]) tr > td.c-title::before,
      :host([card-template]) tr > td.c-badge::before,
      :host([card-template]) tr > td.cmeta::before {
        content: none;
      }
      :host([card-template]) .cmeta .sep {
        color: var(--sw-text-3);
      }
    }
    .empty {
      padding: var(--sw-s-6);
      text-align: center;
      color: var(--sw-text-3);
    }
    /* ---- CR-CMP2-TABLES-2450 (owner N10): what the hand-built tables need to move in ----
       a table inside a card draws no second card */
    :host([bare]) {
      background: none;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    /* a read-only list: no pointer and no press tint */
    :host([static-rows]) tr.clickable {
      cursor: default;
    }
    :host([static-rows]) tbody tr.clickable:active {
      background: transparent;
    }
    /* the shared cell vocabulary - classes a column's render may use (the screen's own classes do not reach this shadow root) */
    .t1 {
      display: block;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .t2 {
      display: block;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .mut {
      color: var(--sw-text-3);
    }
    .num {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 1px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      line-height: 20px;
      white-space: nowrap;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .chip::before {
      content: '';
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .chip[data-nodot]::before {
      display: none;
    }
    .chip[data-tone='ok'] {
      background: color-mix(in srgb, var(--sw-success) 24%, var(--sw-surface));
      color: var(--sw-success-text);
    }
    .chip[data-tone='warn'] {
      background: color-mix(in srgb, var(--sw-warning) 26%, var(--sw-surface));
      color: var(--sw-warning-text);
    }
    .chip[data-tone='bad'] {
      background: color-mix(in srgb, var(--sw-danger) 22%, var(--sw-surface));
      color: var(--sw-danger-text);
    }
    .chip[data-tone='info'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    td.k-num {
      font-variant-numeric: tabular-nums;
      text-align: end;
    }
    td.k-muted {
      color: var(--sw-text-3);
    }
    td.k-status {
      white-space: nowrap;
    }
    td.k-actions {
      text-align: end;
      white-space: nowrap;
    }
    td.k-actions .acts {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    /* a table cell ignores max-inline-size in the auto layout: the cut is on an inner block */
    td.k-truncate .trunc {
      display: block;
      max-inline-size: var(--sw-table-trunc, 260px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .a-end {
      text-align: end;
    }
    .a-center {
      text-align: center;
    }
    /* ---- CR-CMP2-TABLES-CONSUMPTION-2450: what the module tables (electricity, water) need on top ----
       links in a cell: a.t1 names the row (it opens the row's page), a.lnk is a link in the accent ink; no underline until hovered; the
       hit area is --sw-table-link-h (a module's touch dial; none by default) */
    a.t1,
    a.lnk {
      display: inline-flex;
      align-items: center;
      min-block-size: var(--sw-table-link-h, auto);
      min-inline-size: var(--sw-table-link-h, auto);
      text-decoration: none;
      border-radius: var(--sw-r-sm);
    }
    a.lnk {
      color: var(--sw-accent-text);
    }
    @media (hover: hover) and (pointer: fine) {
      a.t1:hover,
      a.lnk:hover {
        text-decoration: underline;
      }
    }
    a.t1:focus-visible,
    a.lnk:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* a truncated cell of two lines (t1 over t2): each line takes its own ellipsis */
    td.k-truncate .trunc > .t1,
    td.k-truncate .trunc > .t2 {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* the foot row (TableColumn.foot): a total under the rows */
    tfoot td {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      border-block-start: 1px solid var(--sw-border-strong);
      border-block-end: 0;
    }
    @media (max-width: 767px) {
      tfoot {
        display: block;
      }
      tfoot td:empty {
        display: none;
      }
    }
    /* the phone card stack reads top to bottom: every cell starts at the reading start again */
    @media (max-width: 767px) {
      td.k-num,
      td.k-actions,
      td.a-end,
      td.a-center {
        text-align: start;
      }
      td.k-actions .acts {
        justify-content: flex-start;
      }
      td.k-truncate .trunc {
        max-inline-size: 100%;
      }
    }
  `;l([c({attribute:!1})],n.prototype,"columns",2);l([c({attribute:!1})],n.prototype,"rows",2);l([c()],n.prototype,"rowKey",2);l([c()],n.prototype,"selected",2);l([c()],n.prototype,"emptyText",2);l([c({type:Boolean,reflect:!0})],n.prototype,"dense",2);l([c({type:Boolean,reflect:!0,attribute:"focus-rows"})],n.prototype,"focusRows",2);l([c({type:Boolean,reflect:!0,attribute:"no-focus-rows"})],n.prototype,"noFocusRows",2);l([c({attribute:!1})],n.prototype,"rowAttrs",2);l([c({type:Boolean,reflect:!0})],n.prototype,"bare",2);l([c({type:Boolean,reflect:!0,attribute:"static-rows"})],n.prototype,"staticRows",2);n=l([k("sw-table")],n);
