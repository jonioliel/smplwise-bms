import{g as w,ax as l,i as u,cB as b,A as d,b as i,k as m}from"./index-I3FcVZcW.js";var f=Object.defineProperty,v=Object.getOwnPropertyDescriptor,o=(t,s,e,a)=>{for(var n=a>1?void 0:a?v(s,e):s,c=t.length-1,p;c>=0;c--)(p=t[c])&&(n=(a?p(s,e,n):p(n))||n);return a&&n&&f(s,e,n),n};const h=t=>t.some(s=>!!s.card);let r=class extends u{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText=b("אין שורות להצגה"),this.dense=!1,this.focusRows=!1,this.noFocusRows=!1,this.rowSelectListeners=0}get rowsFocusable(){return this.focusRows||!this.noFocusRows&&this.rowSelectListeners>0}addEventListener(t,s,e){s&&(super.addEventListener(t,s,e),t==="row-select"&&this.rowSelectListeners++===0&&this.requestUpdate())}removeEventListener(t,s,e){s&&(super.removeEventListener(t,s,e),t==="row-select"&&this.rowSelectListeners>0&&--this.rowSelectListeners===0&&this.requestUpdate())}pick(t,s){const e=String(t[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:s?{id:e,row:t,key:s}:{id:e,row:t},bubbles:!0,composed:!0}))}onRowKey(t,s){t.target!==t.currentTarget||t.key!=="Enter"&&t.key!==" "||(t.preventDefault(),this.pick(s,t.key))}willUpdate(){const t=h(this.columns);this.toggleAttribute("card-template",t),this.toggleAttribute("has-card-badge",t&&this.columns.some(s=>s.card==="badge"))}cellClass(t){return[t.ltr?"ltr":"",t.hideBelow?`hb-${t.hideBelow}`:"",t.card&&t.card!=="hide"?`c-${t.card}`:""].filter(Boolean).join(" ")}metaCell(t){const s=this.columns.filter(e=>e.card==="meta").map(e=>e.render?e.render(t):String(t[e.key]??"")).filter(e=>e!==""&&e!==d);return s.length?i`<td class="cmeta" data-card-meta data-label="">${s.map((e,a)=>i`${a?i`<span class="sep"> · </span>`:d}<bdi>${e}</bdi>`)}</td>`:d}render(){if(!this.rows.length)return i`<div class="empty">${this.emptyText}</div>`;const t=h(this.columns),s=this.rowsFocusable;return i`
      <table>
        <thead>
          <tr>${this.columns.map(e=>i`<th class=${e.hideBelow?`hb-${e.hideBelow}`:d} style=${e.width?`width:${e.width}`:""}>${e.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(e=>i`<tr class="clickable ${this.selected===String(e[this.rowKey])?"selected":""}" data-row-id=${String(e[this.rowKey]??"")} @click=${()=>this.pick(e)}
              tabindex=${s?"0":d} @keydown=${s?a=>this.onRowKey(a,e):d}
              @pointerenter=${a=>this.dispatchEvent(new CustomEvent("row-hover",{detail:{id:String(e[this.rowKey]??""),row:e,clientX:a.clientX,clientY:a.clientY,pointerType:a.pointerType},bubbles:!0,composed:!0}))}
              @pointerleave=${()=>this.dispatchEvent(new CustomEvent("row-leave",{detail:{id:String(e[this.rowKey]??"")},bubbles:!0,composed:!0}))}>
              ${this.columns.map(a=>i`<td class=${this.cellClass(a)} data-label=${a.label}>${a.render?a.render(e):String(e[a.key]??"")}</td>`)}${t?this.metaCell(e):d}
            </tr>`)}
        </tbody>
      </table>
    `}};r.styles=w`
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
      min-inline-size: 560px;
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
        box-shadow: inset 3px 0 0 var(--sw-accent);
      }
    }
    th {
      position: sticky;
      top: 0;
      background: var(--sw-surface);
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
  `;o([l({attribute:!1})],r.prototype,"columns",2);o([l({attribute:!1})],r.prototype,"rows",2);o([l()],r.prototype,"rowKey",2);o([l()],r.prototype,"selected",2);o([l()],r.prototype,"emptyText",2);o([l({type:Boolean,reflect:!0})],r.prototype,"dense",2);o([l({type:Boolean,reflect:!0,attribute:"focus-rows"})],r.prototype,"focusRows",2);o([l({type:Boolean,reflect:!0,attribute:"no-focus-rows"})],r.prototype,"noFocusRows",2);r=o([m("sw-table")],r);
