import{j as f,z as p,a as m,cL as g,b as r,A as c,cC as v,cD as k,cE as y,cG as w,m as x}from"./index-CVsAtsN7.js";const $=/^(data-[a-z0-9][a-z0-9._-]*|aria-[a-z]+|title)$/,S=new Set(["data-row-id"]),C=t=>$.test(t)&&!S.has(t);function R(t){const e={};if(!t)return e;for(const[o,s]of Object.entries(t)){const a=o.toLowerCase();!C(a)||s===null||s===void 0||s===!1||(e[a]=s===!0?"":String(s))}return e}const T=["num","muted","status","actions","truncate"],h=t=>(t.kind===void 0?[]:typeof t.kind=="string"?[t.kind]:[...t.kind]).filter(e=>T.includes(e));function z(t){return[t.ltr?"ltr":"",t.hideBelow?`hb-${t.hideBelow}`:"",t.card&&t.card!=="hide"?`c-${t.card}`:"",...h(t).map(e=>`k-${e}`),t.align&&t.align!=="start"?`a-${t.align}`:""].filter(Boolean).join(" ")}const A=t=>["cell",...h(t).map(e=>`cell-${e}`)].join(" ");function E(t){const e=h(t),o=t.align??(e.includes("num")||e.includes("actions")?"end":"start");return[t.hideBelow?`hb-${t.hideBelow}`:"",o!=="start"?`a-${o}`:""].filter(Boolean).join(" ")}function O(t,e,o){if(o<=0)return-1;switch(t){case"ArrowDown":return Math.min(o-1,e+1);case"ArrowUp":return Math.max(0,e-1);case"Home":return 0;case"End":return o-1;default:return-1}}function L(t,e){const o=[{head:null,rows:[]}];for(const s of t)e(s)?o.push({head:s,rows:[]}):o[o.length-1].rows.push(s);return o[0].rows.length||o.length===1?o:o.slice(1)}function B(t,e,o,s){const a=!o&&(!s||s(t)!==!1);return{live:a,tab:a&&e}}var P=Object.defineProperty,H=Object.getOwnPropertyDescriptor,i=(t,e,o,s)=>{for(var a=s>1?void 0:s?H(e,o):e,l=t.length-1,d;l>=0;l--)(d=t[l])&&(a=(s?d(e,o,a):d(a))||a);return s&&a&&P(e,o,a),a};const j=t=>t.some(e=>!!e.foot),b=t=>t.some(e=>!!e.card);class D extends k{constructor(e){if(super(e),this.last=new Set,e.type!==y.ELEMENT)throw new Error("rowHooks() belongs on an element (a row or a cell)")}render(e){return w}update(e,[o]){const s=e.element,a=R(o);for(const l of this.last)l in a||s.removeAttribute(l);for(const[l,d]of Object.entries(a))s.getAttribute(l)!==d&&s.setAttribute(l,d);return this.last=new Set(Object.keys(a)),w}}const u=v(D);let n=class extends m{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText=g("אין שורות להצגה"),this.dense=!1,this.focusRows=!1,this.noFocusRows=!1,this.bare=!1,this.staticRows=!1,this.keepColumns=!1,this.rowSelectListeners=0}get rowsFocusable(){return this.staticRows?!1:this.focusRows||!this.noFocusRows&&this.rowSelectListeners>0}addEventListener(t,e,o){e&&(super.addEventListener(t,e,o),t==="row-select"&&this.rowSelectListeners++===0&&this.requestUpdate())}removeEventListener(t,e,o){e&&(super.removeEventListener(t,e,o),t==="row-select"&&this.rowSelectListeners>0&&--this.rowSelectListeners===0&&this.requestUpdate())}pick(t,e){const o=String(t[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:e?{id:o,row:t,key:e}:{id:o,row:t},bubbles:!0,composed:!0}))}onRowKey(t,e){if(t.target!==t.currentTarget)return;if(t.key==="Enter"||t.key===" "){t.preventDefault(),this.pick(e,t.key);return}const o=[...this.renderRoot.querySelectorAll('tbody tr[tabindex="0"]')],s=O(t.key,o.indexOf(t.currentTarget),o.length);s<0||(t.preventDefault(),o[s].focus())}willUpdate(){const t=b(this.columns);this.toggleAttribute("card-template",t),this.toggleAttribute("has-card-badge",t&&this.columns.some(e=>e.card==="badge"))}cellClass(t){return z(t)}cell(t,e){const o=t.render?t.render(e):String(e[t.key]??""),s=t.kind===void 0?[]:typeof t.kind=="string"?[t.kind]:t.kind,a=t.cellTitle?t.cellTitle(e):s.includes("truncate")&&!t.render?String(e[t.key]??""):void 0,l=s.includes("num")?r`<span class="num">${o}</span>`:s.includes("actions")?r`<span class="acts">${o}</span>`:s.includes("truncate")?r`<span class="trunc">${o}</span>`:o;return r`<td class=${this.cellClass(t)} part=${A(t)} data-label=${t.label} title=${a||c} ${u(t.cellAttrs?t.cellAttrs(e):null)}>${l}</td>`}footCell(t){const e=t.foot?t.foot():c,o=t.kind===void 0?[]:typeof t.kind=="string"?[t.kind]:t.kind,s=e===c||e===""?c:o.includes("num")?r`<span class="num">${e}</span>`:e;return r`<td class=${this.cellClass(t)} part="foot-cell" data-label=${s===c?"":t.label}>${s}</td>`}metaCell(t){const e=this.columns.filter(o=>o.card==="meta").map(o=>o.render?o.render(t):String(t[o.key]??"")).filter(o=>o!==""&&o!==c);return e.length?r`<td class="cmeta" data-card-meta data-label="">${e.map((o,s)=>r`${s?r`<span class="sep"> · </span>`:c}<bdi>${o}</bdi>`)}</td>`:c}headingOf(t){const e=this.groupHeading?this.groupHeading(t):null;return e??null}groupRow(t){const e=this.rowAttrs;return r`<tr class="group" part="group-row" data-row-id=${String(t[this.rowKey]??"")} ${u(e?e(t):null)}><th class="grp" part="group" scope="rowgroup" colspan=${this.columns.length||1}>${this.headingOf(t)}</th></tr>`}dataRow(t,e,o){const s=this.rowAttrs,{live:a,tab:l}=B(t,o,this.staticRows,this.rowFocusable);return r`<tr class="clickable ${this.selected===String(t[this.rowKey])?"selected":""}${a?"":" still"}" part=${a?"row":"row still"} data-row-id=${String(t[this.rowKey]??"")} ${u(s?s(t):null)} @click=${()=>a&&this.pick(t)}
              tabindex=${l?"0":c} @keydown=${l?d=>this.onRowKey(d,t):c}
              @pointerenter=${d=>this.dispatchEvent(new CustomEvent("row-hover",{detail:{id:String(t[this.rowKey]??""),row:t,clientX:d.clientX,clientY:d.clientY,pointerType:d.pointerType},bubbles:!0,composed:!0}))}
              @pointerleave=${()=>this.dispatchEvent(new CustomEvent("row-leave",{detail:{id:String(t[this.rowKey]??"")},bubbles:!0,composed:!0}))}>
              ${this.columns.map(d=>this.cell(d,t))}${e?this.metaCell(t):c}
            </tr>`}render(){if(!this.rows.length)return r`<slot name="empty"><div class="empty" part="empty">${this.emptyText}</div></slot>`;const t=b(this.columns),e=this.rowsFocusable,o=!!this.groupHeading&&this.rows.some(s=>this.headingOf(s)!==null);return r`
      <table part="table">
        <thead>
          <tr part="head-row">${this.columns.map(s=>r`<th class=${s.hideBelow||s.align||s.kind?E(s):c} part="head" style=${s.width?`width:${s.width}`:""}>${s.label}</th>`)}</tr>
        </thead>
        ${o?L(this.rows,s=>this.headingOf(s)!==null).map(s=>r`<tbody>${s.head?this.groupRow(s.head):c}${s.rows.map(a=>this.dataRow(a,t,e))}</tbody>`):r`<tbody>
              ${this.rows.map(s=>this.dataRow(s,t,e))}
            </tbody>`}
        ${j(this.columns)?r`<tfoot><tr part="foot-row">${this.columns.map(s=>this.footCell(s))}</tr></tfoot>`:c}
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
    /* CR-CMP2-POLISH-2470: a still row (rowFocusable false) - no pointer and no press tint, as a static-rows table */
    tr.clickable.still {
      cursor: default;
    }
    tbody tr.clickable.still:active {
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
    /* ---- CR-CMP2-GEN-REST-2460 (owner N10): group heading rows (groupHeading) - one quiet band across the table, the group's name in the
       heading ink; it never sticks (only the column header does) */
    th.grp {
      position: static;
      z-index: auto;
      background: var(--sw-table-group-bg, var(--sw-surface-2));
      color: var(--sw-heading, var(--sw-text));
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      padding: var(--sw-table-group-pad, 7px 14px);
      text-align: start;
    }
    @media (max-width: 767px) {
      :host tr.group {
        display: block;
        padding: 0;
      }
      th.grp {
        display: block;
        grid-column: 1 / -1;
      }
    }
    /* keep-columns: the phone keeps the table (a small grid of figures); the columns that step out stay out */
    @media (max-width: 767px) {
      :host([keep-columns]) table {
        display: table;
      }
      :host([keep-columns]) thead {
        display: table-header-group;
      }
      :host([keep-columns]) tbody {
        display: table-row-group;
      }
      :host([keep-columns]) tfoot {
        display: table-footer-group;
      }
      :host([keep-columns]) tr {
        display: table-row;
        padding: 0;
        border: 0;
      }
      :host([keep-columns]) td {
        display: table-cell;
        padding: var(--sw-table-cell-pad, 9px 14px);
        border-block-end: 1px solid var(--sw-border);
        white-space: nowrap;
      }
      :host([keep-columns]) th.grp {
        display: table-cell;
      }
      :host([keep-columns]) td::before {
        content: none;
      }
      :host([keep-columns]) tbody tr:last-child td,
      :host([keep-columns]) tfoot td {
        border-block-end: 0;
      }
      :host([keep-columns]) tfoot td:empty {
        display: table-cell;
      }
      :host([keep-columns]) td.k-num,
      :host([keep-columns]) td.k-actions,
      :host([keep-columns]) td.a-end {
        text-align: end;
      }
      :host([keep-columns]) td.a-center {
        text-align: center;
      }
      :host([keep-columns]) .hb-phone,
      :host([keep-columns]) .hb-tablet,
      :host([keep-columns]) tfoot td.hb-phone,
      :host([keep-columns]) tfoot td.hb-tablet {
        display: none;
      }
    }
  `;i([p({attribute:!1})],n.prototype,"columns",2);i([p({attribute:!1})],n.prototype,"rows",2);i([p()],n.prototype,"rowKey",2);i([p()],n.prototype,"selected",2);i([p()],n.prototype,"emptyText",2);i([p({type:Boolean,reflect:!0})],n.prototype,"dense",2);i([p({type:Boolean,reflect:!0,attribute:"focus-rows"})],n.prototype,"focusRows",2);i([p({type:Boolean,reflect:!0,attribute:"no-focus-rows"})],n.prototype,"noFocusRows",2);i([p({attribute:!1})],n.prototype,"rowAttrs",2);i([p({type:Boolean,reflect:!0})],n.prototype,"bare",2);i([p({type:Boolean,reflect:!0,attribute:"static-rows"})],n.prototype,"staticRows",2);i([p({attribute:!1})],n.prototype,"groupHeading",2);i([p({type:Boolean,reflect:!0,attribute:"keep-columns"})],n.prototype,"keepColumns",2);i([p({attribute:!1})],n.prototype,"rowFocusable",2);n=i([x("sw-table")],n);
