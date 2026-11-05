import{E as h,F as r,a as w,e as i,A as p,H as b}from"./index-CiVWQgDq.js";var u=Object.defineProperty,f=Object.getOwnPropertyDescriptor,o=(e,t,n,l)=>{for(var a=l>1?void 0:l?f(t,n):t,d=e.length-1,c;d>=0;d--)(c=e[d])&&(a=(l?c(t,n,a):c(a))||a);return l&&a&&u(t,n,a),a};let s=class extends w{constructor(){super(...arguments),this.columns=[],this.rows=[],this.rowKey="id",this.selected=null,this.emptyText="אין שורות להצגה",this.dense=!1,this.focusRows=!1}pick(e){const t=String(e[this.rowKey]??"");this.dispatchEvent(new CustomEvent("row-select",{detail:{id:t,row:e},bubbles:!0,composed:!0}))}onRowKey(e,t){e.target!==e.currentTarget||e.key!=="Enter"&&e.key!==" "||(e.preventDefault(),this.pick(t))}render(){return this.rows.length?i`
      <table>
        <thead>
          <tr>${this.columns.map(e=>i`<th class=${e.hideBelow?`hb-${e.hideBelow}`:p} style=${e.width?`width:${e.width}`:""}>${e.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(e=>i`<tr class="clickable ${this.selected===String(e[this.rowKey])?"selected":""}" data-row-id=${String(e[this.rowKey]??"")} @click=${()=>this.pick(e)}
              tabindex=${this.focusRows?"0":p} @keydown=${this.focusRows?t=>this.onRowKey(t,e):p}
              @pointerenter=${t=>this.dispatchEvent(new CustomEvent("row-hover",{detail:{id:String(e[this.rowKey]??""),row:e,clientX:t.clientX,clientY:t.clientY,pointerType:t.pointerType},bubbles:!0,composed:!0}))}
              @pointerleave=${()=>this.dispatchEvent(new CustomEvent("row-leave",{detail:{id:String(e[this.rowKey]??"")},bubbles:!0,composed:!0}))}>
              ${this.columns.map(t=>i`<td class=${[t.ltr?"ltr":"",t.hideBelow?`hb-${t.hideBelow}`:""].filter(Boolean).join(" ")} data-label=${t.label}>${t.render?t.render(e):String(e[t.key]??"")}</td>`)}
            </tr>`)}
        </tbody>
      </table>
    `:i`<div class="empty">${this.emptyText}</div>`}};s.styles=h`
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
    .empty {
      padding: var(--sw-s-6);
      text-align: center;
      color: var(--sw-text-3);
    }
  `;o([r({attribute:!1})],s.prototype,"columns",2);o([r({attribute:!1})],s.prototype,"rows",2);o([r()],s.prototype,"rowKey",2);o([r()],s.prototype,"selected",2);o([r()],s.prototype,"emptyText",2);o([r({type:Boolean,reflect:!0})],s.prototype,"dense",2);o([r({type:Boolean,reflect:!0,attribute:"focus-rows"})],s.prototype,"focusRows",2);s=o([b("sw-table")],s);
//# sourceMappingURL=sw-table-s71dhm_g.js.map
