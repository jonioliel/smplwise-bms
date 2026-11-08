import{E as u,F as i,a as w,e as n,A as p,H as f}from"./index-CCDqf4A8.js";var b=Object.defineProperty,v=Object.getOwnPropertyDescriptor,o=(t,s,l,r)=>{for(var a=r>1?void 0:r?v(s,l):s,d=t.length-1,c;d>=0;d--)(c=t[d])&&(a=(r?c(s,l,a):c(a))||a);return r&&a&&b(s,l,a),a};let e=class extends w{constructor(){super(...arguments),this.rows=[],this.selected="all",this.heading="",this.foldLabel="",this.unfoldLabel=""}select(t){this.dispatchEvent(new CustomEvent("place-select",{detail:t,bubbles:!0,composed:!0}))}toggle(t){this.dispatchEvent(new CustomEvent("place-toggle",{detail:t,bubbles:!0,composed:!0}))}row(t){const s=String(t.id===this.selected);return t.kind==="floor"?n`<div class="line floor" data-place-row=${t.id}>
        <button type="button" class="fold" aria-expanded=${String(!!t.open)} aria-label=${(t.open?this.foldLabel:this.unfoldLabel)+" "+t.name} data-place-fold=${t.id} @click=${()=>this.toggle(t.id)}>
          <sw-icon name="chevronDown" size=${14}></sw-icon>
        </button>
        <button type="button" class="pick" aria-current=${s} data-place-pick=${t.id} @click=${()=>this.select(t.id)}>
          <span class="name">${t.name}</span><span class="n">${t.count}</span>
        </button>
      </div>`:n`<div class="line" data-place-row=${t.id}>
      <button type="button" class="pick ${t.depth===1?"depth-1":""}" aria-current=${s} data-place-pick=${t.id} @click=${()=>this.select(t.id)}>
        ${t.kind==="all"?n`<sw-icon name="pin" size=${14}></sw-icon>`:t.dot?n`<span class="dot ${t.dot==="live"?"":t.dot}" aria-hidden="true"></span>`:p}
        <span class="name">${t.name}</span><span class="n">${t.count}</span>
      </button>
    </div>`}render(){return n`<nav aria-label=${this.heading}>${this.heading?n`<div class="ttl">${this.heading}</div>`:p}${this.rows.map(t=>this.row(t))}</nav>`}};e.styles=u`
    :host {
      display: block;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--sw-s-2);
    }
    .ttl {
      padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-1);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .line {
      display: flex;
      align-items: stretch;
      gap: 2px;
    }
    button {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    button:hover {
      background: var(--sw-hover-wash);
    }
    button.pick {
      flex: 1;
      min-inline-size: 0;
    }
    button.pick .name {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    button.fold {
      justify-content: center;
      min-inline-size: var(--sw-touch-desktop, 44px);
      padding-inline: 0;
      color: var(--sw-text-3);
    }
    button.fold sw-icon {
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    button.fold[aria-expanded='false'] sw-icon {
      transform: rotate(90deg);
    }
    .floor .name {
      font-weight: var(--sw-fw-semibold);
    }
    .depth-1 {
      padding-inline-start: var(--sw-s-4);
    }
    button[aria-current='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .n {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .dot.off {
      background: var(--sw-offline);
    }
    .dot.mixed {
      background: var(--sw-unknown);
    }
    /* CR-MAINT215: a place's worst due state */
    .dot.alarm {
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .dot.ok {
      background: var(--sw-success);
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      button {
        min-block-size: 44px;
      }
      button.fold {
        min-inline-size: 44px;
      }
    }
  `;o([i({attribute:!1})],e.prototype,"rows",2);o([i()],e.prototype,"selected",2);o([i()],e.prototype,"heading",2);o([i()],e.prototype,"foldLabel",2);o([i()],e.prototype,"unfoldLabel",2);e=o([f("sw-place-tree")],e);
//# sourceMappingURL=sw-place-tree-CjABiTaj.js.map
